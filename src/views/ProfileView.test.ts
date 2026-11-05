import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { fetchStub } from '@/test/fetch'
import ProfileView from './ProfileView.vue'

const SAVED_PROFILE = {
  weight: 78,
  height: 178,
  sex: 'm',
  birthDate: '1990-04-12',
  targetKcal: 2200,
}

const EMPTY_PROFILE = {
  weight: null,
  height: null,
  sex: null,
  birthDate: null,
  targetKcal: null,
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-05T12:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('ProfileView', () => {
  it('loads the saved profile and shows BMR and BMI as information', async () => {
    fetchStub().intercept(/\/api\/profile$/, () => Response.json(SAVED_PROFILE))

    const wrapper = mount(ProfileView)
    await flushPromises()

    expect((wrapper.get('#weight').element as HTMLInputElement).value).toBe('78')
    expect((wrapper.get('#height').element as HTMLInputElement).value).toBe('178')
    expect((wrapper.get('#sex').element as unknown as HTMLSelectElement).value).toBe('m')
    expect((wrapper.get('#birthDate').element as HTMLInputElement).value).toBe('1990-04-12')
    expect((wrapper.get('#targetKcal').element as HTMLInputElement).value).toBe('2200')

    expect(wrapper.text()).toContain('1718')
    expect(wrapper.text()).toContain('24,6')
    expect(wrapper.text()).toContain('informativi')
  })

  it('saves the profile and shows feedback', async () => {
    const requests: Request[] = []
    fetchStub().intercept(/\/api\/profile$/, (request) => {
      requests.push(request)
      return Response.json(request.method === 'PUT' ? SAVED_PROFILE : EMPTY_PROFILE)
    })

    const wrapper = mount(ProfileView)
    await flushPromises()

    await wrapper.get('#weight').setValue('78')
    await wrapper.get('#height').setValue('178')
    await wrapper.get('#sex').setValue('m')
    await wrapper.get('#birthDate').setValue('1990-04-12')
    await wrapper.get('#targetKcal').setValue('2200')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    const put = requests.find((request) => request.method === 'PUT')
    expect(put).toBeDefined()
    expect(await put!.json()).toEqual(SAVED_PROFILE)
    expect(wrapper.text()).toContain('Salvato')
  })

  it('shows the Open Food Facts attribution with a link', async () => {
    fetchStub().intercept(/\/api\/profile$/, () => Response.json(EMPTY_PROFILE))

    const wrapper = mount(ProfileView)
    await flushPromises()

    const link = wrapper.get('a[href="https://world.openfoodfacts.org"]')
    expect(link.text()).toContain('Open Food Facts')
    expect(wrapper.text()).toContain('ODbL')
    expect(wrapper.text()).toContain('Dati da')
  })
})
