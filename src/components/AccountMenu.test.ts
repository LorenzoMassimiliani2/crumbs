import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { initTheme, theme } from '@/composables/useTheme'

import AccountMenu from './AccountMenu.vue'

describe('AccountMenu', () => {
  it('shows the initial of the name inside the avatar', () => {
    const wrapper = mount(AccountMenu, { props: { name: 'Lorenzo', email: 'owner@example.com' } })

    expect(wrapper.get('button').text()).toBe('L')
    expect(wrapper.get('button').attributes('aria-label')).toBe('Account di Lorenzo')
  })

  it('falls back to the email initial when the name is missing', () => {
    const wrapper = mount(AccountMenu, { props: { email: 'owner@example.com' } })

    expect(wrapper.get('button').text()).toBe('O')
  })

  it('shows only Esci after clicking the avatar, and emits signOut', async () => {
    const wrapper = mount(AccountMenu, { props: { name: 'Lorenzo' }, attachTo: document.body })

    expect(wrapper.find('[role="menu"]').exists()).toBe(false)
    await wrapper.get('button').trigger('click')

    const items = wrapper.findAll('[role="menuitem"]')
    expect(items.map((item) => item.text())).toEqual(['Esci'])

    await items[0]!.trigger('click')
    expect(wrapper.emitted('signOut')).toHaveLength(1)
    expect(wrapper.find('[role="menu"]').exists()).toBe(false)

    wrapper.unmount()
  })

  it('shows the theme selector above Esci, with Chiaro selected by default', async () => {
    localStorage.clear()
    initTheme()
    const wrapper = mount(AccountMenu, { props: { name: 'Lorenzo' }, attachTo: document.body })

    await wrapper.get('button').trigger('click')

    const options = wrapper.findAll('[role="radio"]')
    expect(options.map((option) => option.text())).toEqual(['Chiaro', 'Scuro'])
    expect(options[0]!.attributes('aria-checked')).toBe('true')
    expect(options[1]!.attributes('aria-checked')).toBe('false')

    const menuitems = wrapper.findAll('[role="menuitem"]')
    expect(menuitems.map((item) => item.text())).toEqual(['Esci'])
    expect(options[0]!.element.compareDocumentPosition(menuitems[0]!.element)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    )

    wrapper.unmount()
  })

  it('switches to the dark theme and keeps Esci working', async () => {
    localStorage.clear()
    initTheme()
    const wrapper = mount(AccountMenu, { props: { name: 'Lorenzo' }, attachTo: document.body })

    await wrapper.get('button').trigger('click')
    await wrapper.findAll('[role="radio"]')[1]!.trigger('click')

    expect(theme.value).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(localStorage.getItem('crumbs.theme')).toBe('dark')
    expect(wrapper.findAll('[role="radio"]')[1]!.attributes('aria-checked')).toBe('true')

    await wrapper.get('[role="menuitem"]').trigger('click')
    expect(wrapper.emitted('signOut')).toHaveLength(1)

    wrapper.unmount()
  })

  it('closes on Escape and on a click outside', async () => {
    const wrapper = mount(AccountMenu, { props: { name: 'Lorenzo' }, attachTo: document.body })

    await wrapper.get('button').trigger('click')
    expect(wrapper.find('[role="menu"]').exists()).toBe(true)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[role="menu"]').exists()).toBe(false)

    await wrapper.get('button').trigger('click')
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[role="menu"]').exists()).toBe(false)

    wrapper.unmount()
  })
})
