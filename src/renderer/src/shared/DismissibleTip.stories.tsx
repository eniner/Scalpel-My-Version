import type { Meta, StoryObj } from '@storybook/react-vite'
import { useEffect } from 'react'
import { DismissibleTip } from './DismissibleTip'

/** DismissibleTip is the gold-bordered "(i) hint" used to surface one-time
 *  guidance (e.g. "Add 'macro' to any custom tag to set a hotkey for it").
 *  It self-clears via localStorage once the user dismisses it; we wipe the
 *  per-story key on mount so the tip always renders here even after the user
 *  has clicked X in a previous session. */
const meta: Meta<typeof DismissibleTip> = {
  title: 'Shared / DismissibleTip',
  component: DismissibleTip,
  decorators: [
    (Story, ctx) => {
      const id = ctx.args.id
      // Strip persisted dismissal so the tip is visible every render.
      useEffect(() => {
        localStorage.removeItem(`tip.${id}.dismissed`)
      }, [id])
      return <Story />
    },
  ],
}
export default meta

type Story = StoryObj<typeof DismissibleTip>

export const Default: Story = {
  args: {
    id: 'storybook.default',
    children: 'Tip: this is the standard one-line hint shape used across the overlay.',
  },
}

export const Long: Story = {
  args: {
    id: 'storybook.long',
    children:
      "Add 'macro' to any custom tag in the regex tool to set a hotkey for it in settings. The tag-pattern matcher recognizes the literal substring anywhere in the tag text.",
  },
}
