import type { Meta, StoryObj } from '@storybook/react-vite'
import { ItemRowContent } from './ItemRowContent'
import chaosIcon from '../assets/currency/chaos-orb.png'
import divineIcon from '../assets/currency/divine-orb.png'

/** ItemRowContent is the shared body for sister-overlay rows + unique-base
 *  cards on the filter page: name on top, icon (with glow) + optional price
 *  chip below. The wrapping element (zebra row vs card button) is the
 *  caller's concern. */
const meta: Meta<typeof ItemRowContent> = {
  title: 'Shared / ItemRowContent',
  component: ItemRowContent,
  decorators: [
    (Story) => (
      <div className="bg-bg-card rounded p-3 w-[180px]">
        <Story />
      </div>
    ),
  ],
}
export default meta

type Story = StoryObj<typeof ItemRowContent>

export const Currency: Story = {
  args: {
    name: 'Chaos Orb',
    iconUrl: chaosIcon,
    nameColor: '#fff',
    price: { chaosValue: 1 },
  },
}

export const Unique: Story = {
  args: {
    name: 'Headhunter',
    iconUrl: divineIcon,
    nameColor: '#af6025',
    price: { chaosValue: 350, divineValue: 1.7 },
    chaosPerDivine: 200,
  },
  parameters: { docs: { description: { story: 'Unique-rarity name color + price auto-promoted to divine.' } } },
}

export const NoPrice: Story = {
  args: {
    name: "Chayula's Domain Map",
    iconUrl: chaosIcon,
    nameColor: '#7e57c2',
  },
  parameters: { docs: { description: { story: 'Price omitted: only name + icon render.' } } },
}

export const NoIcon: Story = {
  args: {
    name: 'Mystery Item',
    nameColor: '#fff',
    price: { chaosValue: 5 },
  },
  parameters: {
    docs: {
      description: {
        story:
          'Icon omitted: an empty placeholder reserves the same space so name alignment stays consistent across rows.',
      },
    },
  },
}
