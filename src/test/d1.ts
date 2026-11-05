import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync, type SQLInputValue } from 'node:sqlite'
import { fileURLToPath } from 'node:url'

const MIGRATIONS_DIR = fileURLToPath(new URL('../../migrations', import.meta.url))

function resultMeta(
  started: bigint,
  changes: number,
  lastRowId: number,
): D1Meta & Record<string, unknown> {
  return {
    duration: Number(process.hrtime.bigint() - started) / 1e6,
    size_after: 0,
    rows_read: 0,
    rows_written: changes,
    last_row_id: lastRowId,
    changed_db: changes > 0,
    changes,
  }
}

class TestD1PreparedStatement implements D1PreparedStatement {
  private readonly db: DatabaseSync
  private readonly query: string
  private readonly params: SQLInputValue[]

  constructor(db: DatabaseSync, query: string, params: SQLInputValue[] = []) {
    this.db = db
    this.query = query
    this.params = params
  }

  bind(...values: unknown[]): D1PreparedStatement {
    return new TestD1PreparedStatement(this.db, this.query, values as SQLInputValue[])
  }

  async first<T = Record<string, unknown>>(colName?: string): Promise<T | null> {
    const row = this.db.prepare(this.query).get(...this.params) as
      | Record<string, unknown>
      | undefined
    if (row === undefined) return null
    if (colName !== undefined) return (row[colName] ?? null) as T | null
    return row as T
  }

  async run<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    const started = process.hrtime.bigint()
    const outcome = this.db.prepare(this.query).run(...this.params)
    return {
      success: true,
      results: [],
      meta: resultMeta(started, Number(outcome.changes), Number(outcome.lastInsertRowid)),
    }
  }

  async all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    const started = process.hrtime.bigint()
    const rows = this.db.prepare(this.query).all(...this.params) as T[]
    return { success: true, results: rows, meta: resultMeta(started, 0, 0) }
  }

  raw<T = unknown[]>(options: { columnNames: true }): Promise<[string[], ...T[]]>
  raw<T = unknown[]>(options?: { columnNames?: false }): Promise<T[]>
  async raw<T = unknown[]>(
    options?: { columnNames?: boolean },
  ): Promise<T[] | [string[], ...T[]]> {
    const rows = this.db.prepare(this.query).all(...this.params) as Record<
      string,
      unknown
    >[]
    const values = rows.map((row) => Object.values(row) as T)
    if (!options?.columnNames) return values
    const columns = rows.length > 0 ? Object.keys(rows[0]!) : []
    return [columns, ...values]
  }
}

class TestD1Database implements D1Database {
  private readonly db: DatabaseSync

  constructor(db: DatabaseSync) {
    this.db = db
  }

  prepare(query: string): D1PreparedStatement {
    return new TestD1PreparedStatement(this.db, query)
  }

  async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    const results: D1Result<T>[] = []
    for (const statement of statements) {
      results.push(await statement.all<T>())
    }
    return results
  }

  async exec(query: string): Promise<D1ExecResult> {
    const started = process.hrtime.bigint()
    this.db.exec(query)
    const count = query.split(';').filter((part) => part.trim().length > 0).length
    return { count, duration: Number(process.hrtime.bigint() - started) / 1e6 }
  }

  withSession(): D1DatabaseSession {
    return this as unknown as D1DatabaseSession
  }

  getBookmark(): string | null {
    return null
  }

  async dump(): Promise<ArrayBuffer> {
    throw new Error('dump() is not supported by the test D1 adapter')
  }
}

function applyMigrations(db: DatabaseSync): void {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort()

  for (const file of files) {
    db.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'))
  }
}

export function createTestDatabase(): D1Database {
  const db = new DatabaseSync(':memory:')
  applyMigrations(db)
  return new TestD1Database(db)
}
