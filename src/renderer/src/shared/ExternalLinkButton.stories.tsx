import type { Meta, StoryObj } from '@storybook/react-vite'
import { ExternalLinkButton } from './ExternalLinkButton'

/** Tiny pill button used inside the "Open in" InfoChip on the price-check
 *  hero, one per external-link target. Styled to match Dust/DivCards
 *  Explore buttons; on hover the background brightens. */
const meta: Meta<typeof ExternalLinkButton> = {
  title: 'Shared / ExternalLinkButton',
  component: ExternalLinkButton,
  args: { onClick: () => {} },
  decorators: [
    (Story) => (
      <div className="inline-flex">
        <Story />
      </div>
    ),
  ],
}
export default meta

type Story = StoryObj<typeof ExternalLinkButton>

export const Wiki: Story = { args: { label: 'Wiki', title: 'Open in PoE Wiki' } }
export const PoEDB: Story = { args: { label: 'PoEDB', title: 'Open in PoEDB' } }
export const Ninja: Story = { args: { label: 'poe.ninja', title: 'Open in poe.ninja' } }
