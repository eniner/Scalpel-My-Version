import type { Meta, StoryObj } from '@storybook/react-vite'
import { IconGlow } from './IconGlow'
import chaosIcon from '../assets/currency/chaos-orb.png'
import divineIcon from '../assets/currency/divine-orb.png'

/** IconGlow renders a sharp icon with a soft glow halo behind it. We use it
 *  in price-check chips, audit cards, and anywhere a single icon needs to
 *  pop against the dark overlay backdrop. The four halo knobs (`glow`,
 *  `blur`, `saturate`, `opacity`) are independent so designers can dial in
 *  the look without touching the component. */
const meta: Meta<typeof IconGlow> = {
  title: 'Shared / IconGlow',
  component: IconGlow,
  args: { src: chaosIcon, size: 32 },
}
export default meta

type Story = StoryObj<typeof IconGlow>

export const Default: Story = {
  args: {},
}

export const Subtle: Story = {
  args: { glow: 1.5, blur: 6, saturate: 1.2, opacity: 0.3 },
}

export const HeavyHalo: Story = {
  args: { glow: 3, blur: 18, saturate: 2.5, opacity: 0.7 },
}

export const Divine: Story = {
  args: { src: divineIcon, size: 40 },
}

export const Large: Story = {
  args: { size: 64 },
}
