#!/usr/bin/env python3
"""Sync docs/tickets/*.md with GitHub Issues.

Backend comes from .agents/config.yml:

    tickets:
      backend: github-source      # or github-mirror
      github:
        repo: owner/name          # optional: inferred from `gh repo view`

Modes
  --push   local tickets -> GitHub (create issues, update body/labels, post Choices)
  --pull   GitHub -> local tickets (github-source only)
  --check  show what would change, touch nothing

Rules
  * GitHub is the source for title, brief, acceptance criteria, status, category,
    blocked_by. Choices are local-only and are pushed as issue comments.
  * github-mirror: local files are authoritative; --push is the only mode.
  * github-source: --pull writes files from issues. If a local file edited
    Brief/AC and the issue changed too, the pull stops on that ticket and leaves
    a .conflict copy instead of overwriting.
  * A ticket is linked to an issue through `github: <number>` in its frontmatter.

No dependencies beyond python3 and the gh CLI.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

STATUSES = {"needs-triage", "needs-info", "ready-for-agent", "ready-for-human", "wontfix"}
CATEGORIES = {"bug", "enhancement"}
STATE_FILE = ".agents/tickets-state.json"
TITLE_RE = re.compile(r"^\[(?P<id>[A-Z]+-\d+)\]\s*(?P<title>.*)$")
MARKER_RE = re.compile(r"<!--\s*prime-agent-ticket:\s*(?P<id>[A-Z]+-\d+)\s*-->")
BLOCKED_RE = re.compile(r"<!--\s*blocked_by:\s*(?P<v>.*?)\s*-->")
SOURCE_RE = re.compile(r"<!--\s*source:\s*(?P<v>.*?)\s*-->")


def sha(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def norm(text: str) -> str:
    return "\n".join(line.rstrip() for line in text.strip().splitlines())


def slugify(text: str) -> str:
    text = re.sub(r"[^\w\s-]", "", text.lower())
    return re.sub(r"[-\s]+", "-", text).strip("-")[:60] or "ticket"


def parse_config(root: Path) -> dict:
    path = root / ".agents" / "config.yml"
    cfg = {"backend": "local", "repo": None, "prefix": "status:"}
    if not path.exists():
        return cfg
    inside = False
    indent = 0
    in_github = False
    github_indent = 0
    for raw in path.read_text().splitlines():
        if not raw.strip() or raw.lstrip().startswith("#"):
            continue
        line = raw.rstrip()
        stripped = line.strip()
        cur_indent = len(line) - len(line.lstrip())
        if stripped == "tickets:":
            inside, indent = True, cur_indent
            continue
        if inside and cur_indent <= indent:
            inside = False
        if not inside:
            continue
        if stripped == "github:":
            in_github, github_indent = True, cur_indent
            continue
        if in_github and cur_indent <= github_indent and stripped != "github:":
            in_github = False
        if ":" not in stripped:
            continue
        key, value = (part.strip() for part in stripped.split(":", 1))
        value = value.strip().strip('"').strip("'")
        if key == "backend" and value:
            cfg["backend"] = value
        elif in_github and key == "repo" and value:
            cfg["repo"] = value
    return cfg


def gh(args: list[str], *, dry: bool = False, capture: bool = True) -> str:
    if dry:
        print("  [dry-run] gh " + " ".join(args))
        return ""
    result = subprocess.run(["gh", *args], capture_output=capture, text=True)
    if result.returncode != 0:
        raise SystemExit(f"gh {' '.join(args)} failed:\n{result.stderr.strip()}")
    return result.stdout if capture else ""


def split_frontmatter(text: str) -> tuple[dict, str]:
    if not text.startswith("---\n"):
        return {}, text
    end = text.find("\n---", 4)
    if end == -1:
        return {}, text
    raw = text[4:end]
    body = text[end + 4 :].lstrip("\n")
    data = {}
    for line in raw.splitlines():
        if ":" in line and not line.startswith(" "):
            key, value = line.split(":", 1)
            data[key.strip()] = value.strip()
    return data, body


def render_frontmatter(data: dict) -> str:
    order = ["id", "title", "status", "category", "blocked_by", "blocks", "source", "github"]
    keys = [k for k in order if k in data] + [k for k in data if k not in order]
    lines = ["---"]
    for key in keys:
        lines.append(f"{key}: {data[key]}")
    lines.append("---")
    return "\n".join(lines)


def split_sections(body: str) -> dict[str, str]:
    sections, current, buf = {}, None, []
    for line in body.splitlines():
        if line.startswith("## "):
            if current:
                sections[current] = norm("\n".join(buf))
            current = line[3:].strip()
            buf = []
        elif current:
            buf.append(line)
        # content before the first heading is ignored
    if current:
        sections[current] = norm("\n".join(buf))
    return sections


def brief_block(sections: dict[str, str]) -> str:
    brief = sections.get("Brief (AGENT-BRIEF)", "")
    ac = sections.get("Acceptance criteria", "")
    return f"## Brief (AGENT-BRIEF)\n{brief}\n\n## Acceptance criteria\n{ac}".strip()


def issue_body(fm: dict, sections: dict[str, str]) -> str:
    blocked = fm.get("blocked_by", "[]").strip("[] ").strip()
    source = fm.get("source", "").strip()
    meta = [f"<!-- prime-agent-ticket: {fm['id']} -->"]
    if blocked:
        meta.append(f"<!-- blocked_by: {blocked} -->")
    if source:
        meta.append(f"<!-- source: {source} -->")
    return "\n".join(meta) + "\n\n" + brief_block(sections) + "\n"


def read_ticket(path: Path) -> tuple[dict, dict[str, str], str]:
    text = path.read_text()
    fm, body = split_frontmatter(text)
    return fm, split_sections(body), text


def write_ticket(path: Path, fm: dict, sections: dict[str, str]) -> None:
    choices = sections.get("Choices", "")
    body = brief_block(sections)
    if choices:
        body += f"\n\n## Choices\n{choices}"
    path.write_text(render_frontmatter(fm) + "\n\n" + body.strip() + "\n")


def load_state(root: Path) -> dict:
    path = root / STATE_FILE
    if not path.exists():
        return {"issues": {}}
    return json.loads(path.read_text())


def save_state(root: Path, state: dict) -> None:
    path = root / STATE_FILE
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(state, indent=2, sort_keys=True) + "\n")


def ticket_index(root: Path) -> dict[int, Path]:
    index = {}
    for path in sorted((root / "docs" / "tickets").glob("*.md")):
        fm, _, _ = read_ticket(path)
        number = fm.get("github", "").strip()
        if number.isdigit():
            index[int(number)] = path
    return index


def labels_for(fm: dict, prefix: str) -> list[str]:
    out = []
    if fm.get("status"):
        out.append(f"{prefix}{fm['status']}")
    if fm.get("category"):
        out.append(f"category:{fm['category']}")
    return out


def ensure_labels(repo: str, labels: list[str], dry: bool) -> None:
    colors = {"status:": "0e8a16", "category:bug": "b60205", "category:enhancement": "1d76db"}
    for label in labels:
        color = next((c for k, c in colors.items() if label.startswith(k)), "ededed")
        gh(["label", "create", label, "--repo", repo, "--color", color, "--force"], dry=dry)


def command_push(root: Path, cfg: dict, *, dry: bool, repo: str) -> int:
    state = load_state(root)
    issues_state = state.setdefault("issues", {})
    for path in sorted((root / "docs" / "tickets").glob("*.md")):
        fm, sections, _ = read_ticket(path)
        if not fm.get("id"):
            print(f"skip {path.name}: no id")
            continue
        body = issue_body(fm, sections)
        body_hash = sha(brief_block(sections))
        title = f"[{fm['id']}] {fm.get('title', '').strip()}"
        labels = labels_for(fm, cfg["prefix"])
        number = fm.get("github", "").strip()
        entry = issues_state.get(number, {}) if number.isdigit() else {}
        if not number.isdigit():
            ensure_labels(repo, labels, dry)
            out = gh(["issue", "create", "--repo", repo, "--title", title,
                      "--body", body, *sum((["--label", l] for l in labels), [])],
                     dry=dry)
            if dry:
                print(f"create issue for {fm['id']}")
                continue
            number = out.strip().splitlines()[-1].rsplit("/", 1)[-1]
            fm["github"] = number
            write_ticket(path, fm, sections)
            issues_state[number] = {"body": body_hash, "choices": "", "title": title,
                                    "labels": sorted(labels)}
            print(f"created #{number} {fm['id']}")
            continue
        changed = []
        if entry.get("body") != body_hash or entry.get("title") != title:
            gh(["issue", "edit", number, "--repo", repo, "--title", title, "--body", body], dry=dry)
            changed.append("body")
        old_labels = set(entry.get("labels", []))
        new_labels = set(labels)
        add = sorted(new_labels - old_labels)
        remove = sorted(old_labels - new_labels)
        if add or remove:
            ensure_labels(repo, add, dry)
            if add:
                gh(["issue", "edit", number, "--repo", repo, *sum((["--add-label", l] for l in add), [])], dry=dry)
            if remove:
                gh(["issue", "edit", number, "--repo", repo, *sum((["--remove-label", l] for l in remove), [])], dry=dry)
            changed.append("labels")
        choices = sections.get("Choices", "")
        if choices and entry.get("choices") != sha(norm(choices)):
            gh(["issue", "comment", number, "--repo", repo,
                "--body", f"## Choices\n{norm(choices)}"], dry=dry)
            changed.append("choices")
        issues_state[number] = {
            "body": body_hash, "title": title, "labels": sorted(new_labels),
            "choices": sha(norm(choices)) if choices else "",
        }
        if changed:
            print(f"updated #{number} {fm['id']} ({', '.join(changed)})")
    save_state(root, state)
    return 0


def command_pull(root: Path, cfg: dict, *, dry: bool, repo: str) -> int:
    raw = gh(["issue", "list", "--repo", repo, "--state", "all", "--limit", "1000",
              "--json", "number,title,body,labels,updatedAt"])
    issues = json.loads(raw or "[]")
    state = load_state(root)
    issues_state = state.setdefault("issues", {})
    index = ticket_index(root)
    conflicts = 0
    for issue in issues:
        title = issue.get("title", "")
        match = TITLE_RE.match(title)
        marker = MARKER_RE.search(issue.get("body", ""))
        if not match and not marker:
            continue
        ticket_id = (marker.group("id") if marker else match.group("id"))
        issue_title = match.group("title") if match else title
        number = str(issue["number"])
        path = index.get(issue["number"])
        labels = [l["name"] for l in issue.get("labels", [])]
        status = next((l.split(":", 1)[1] for l in labels if l.startswith(cfg["prefix"])), "needs-triage")
        category = next((l.split(":", 1)[1] for l in labels if l.startswith("category:")), "enhancement")
        body = issue.get("body", "")
        blocked = BLOCKED_RE.search(body)
        source = SOURCE_RE.search(body)
        sections = split_sections(MARKER_RE.sub("", body))
        remote_body = brief_block(sections)
        fm = {
            "id": ticket_id, "title": issue_title, "status": status, "category": category,
            "blocked_by": f"[{blocked.group('v')}]" if blocked else "[]",
            "blocks": "[]", "source": source.group("v") if source else "", "github": number,
        }
        existing = None
        if path and path.exists():
            existing = read_ticket(path)
        elif not path:
            matches = list((root / "docs" / "tickets").glob(f"{ticket_id}-*.md"))
            if matches:
                path, existing = matches[0], read_ticket(matches[0])
        if path is None:
            path = root / "docs" / "tickets" / f"{ticket_id}-{slugify(issue_title)}.md"
        entry = issues_state.get(number, {})
        if existing:
            old_fm, old_sections, _ = existing
            local_body = brief_block(old_sections)
            local_changed = entry.get("body") and sha(local_body) != entry["body"]
            remote_changed = entry.get("body") and sha(remote_body) != entry["body"]
            if local_changed and remote_changed and sha(local_body) != sha(remote_body):
                conflict = path.with_suffix(".conflict.md")
                if not dry:
                    conflict.write_text(path.read_text())
                print(f"CONFLICT #{number} {ticket_id}: local Brief/AC and issue both changed; wrote {conflict.name}")
                conflicts += 1
                continue
            choices = old_sections.get("Choices", "")
            sections["Choices"] = choices
            fm["blocks"] = old_fm.get("blocks", "[]")
        if dry:
            print(f"would write {path.name} <- #{number} {ticket_id} [{status}]")
            continue
        path.parent.mkdir(parents=True, exist_ok=True)
        write_ticket(path, fm, sections)
        issues_state[number] = {"body": sha(remote_body), "title": title,
                                "labels": sorted(labels), "choices": entry.get("choices", "")}
        print(f"pulled #{number} -> {path.name}")
    if not dry:
        save_state(root, state)
    return 2 if conflicts else 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--push", action="store_true")
    group.add_argument("--pull", action="store_true")
    group.add_argument("--check", action="store_true")
    parser.add_argument("--repo", help="owner/name (default: config or gh repo view)")
    parser.add_argument("--root", default=".", help="repository root")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    root = Path(args.root).resolve()
    cfg = parse_config(root)
    repo = args.repo or cfg.get("repo")
    if not repo:
        repo = gh(["repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"]).strip()
    dry = args.dry_run or args.check
    if cfg["backend"] == "local":
        raise SystemExit("ticket backend is 'local': nothing to sync")
    if args.pull and cfg["backend"] != "github-source":
        raise SystemExit("--pull requires backend: github-source (github-mirror is local-first)")
    if args.push:
        return command_push(root, cfg, dry=dry, repo=repo)
    return command_pull(root, cfg, dry=dry, repo=repo)


if __name__ == "__main__":
    sys.exit(main())
