import { vi } from 'vitest'

type Matcher = string | RegExp | ((request: Request) => boolean)
type Responder = (request: Request) => Response | Promise<Response>

interface Route {
  matcher: Matcher
  responder: Responder
}

const TEST_ORIGIN = 'https://crumbs.test'

function resolveUrl(input: RequestInfo | URL): RequestInfo | URL {
  if (typeof input === 'string' && input.startsWith('/')) {
    return new URL(input, TEST_ORIGIN)
  }
  return input
}

function matches(matcher: Matcher, request: Request): boolean {
  if (typeof matcher === 'string') return request.url === matcher
  if (matcher instanceof RegExp) return matcher.test(request.url)
  return matcher(request)
}

export class FetchStub {
  readonly requests: Request[] = []
  private routes: Route[] = []

  intercept(matcher: Matcher, responder: Responder): this {
    this.routes.push({ matcher, responder })
    return this
  }

  handle = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request =
      input instanceof Request && init === undefined
        ? input
        : new Request(resolveUrl(input), init)
    this.requests.push(request)

    for (const route of this.routes) {
      if (matches(route.matcher, request)) return route.responder(request)
    }

    throw new Error(
      `Blocked outbound network request in tests: ${request.method} ${request.url}`,
    )
  }
}

let current: FetchStub | null = null

export function installFetchStub(): FetchStub {
  current = new FetchStub()
  vi.stubGlobal('fetch', current.handle)
  return current
}

export function uninstallFetchStub(): void {
  current = null
  vi.unstubAllGlobals()
}

export function fetchStub(): FetchStub {
  if (!current) throw new Error('the fetch stub is not installed for this test')
  return current
}
