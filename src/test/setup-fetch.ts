import { afterEach, beforeEach } from 'vitest'

import { installFetchStub, uninstallFetchStub } from './fetch'

beforeEach(() => {
  installFetchStub()
})

afterEach(() => {
  uninstallFetchStub()
})
