import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

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
