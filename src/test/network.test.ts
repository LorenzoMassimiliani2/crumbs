import { describe, expect, it } from 'vitest'

import { fetchStub } from './fetch'

describe('test network boundary', () => {
  it('fails clearly when an outbound request is not intercepted', async () => {
    await expect(
      fetch('https://world.openfoodfacts.org/api/v2/product/123'),
    ).rejects.toThrow(
      'Blocked outbound network request in tests: GET https://world.openfoodfacts.org/api/v2/product/123',
    )
  })

  it('serves an intercepted external request from a fixture', async () => {
    fetchStub().intercept(/world\.openfoodfacts\.org/, () =>
      Response.json({ status: 1, product: { product_name: 'Pane' } }),
    )

    const response = await fetch('https://world.openfoodfacts.org/api/v2/product/123')
    expect(await response.json()).toEqual({
      status: 1,
      product: { product_name: 'Pane' },
    })
  })
})
