import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import HomeView from './HomeView.vue'

describe('HomeView', () => {
  it('shows the diary title and placeholder content', () => {
    const wrapper = mount(HomeView)

    expect(wrapper.text()).toContain('Diario alimentare')
    expect(wrapper.text()).toContain('Qui andranno i pasti del giorno')
  })
})
