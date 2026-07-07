import type { Meta, StoryObj } from '@storybook/react-vite'
import { CurrencyChip } from './CurrencyChip'
import chaosIcon from '../assets/currency/chaos-orb.png'
import divineIcon from '../assets/currency/divine-orb.png'
import goldIcon from '../assets/currency/gold.png'
import dustIcon from '../assets/currency/thaumaturgic-dust.png'

/** CurrencyChip is the "<value> <icon>" pill used wherever we display a
 *  currency-denominated amount that isn't a full price-check result -- gold
 *  prices, dust costs, divine conversions in tooltips. PriceChip's bigger
 *  cousin that handles auto-promote-to-divine logic; this one is a simpler
 *  display primitive. */
const meta: Meta<typeof CurrencyChip> = {
  title: 'Shared / CurrencyChip',
  component: CurrencyChip,
}
export default meta

type Story = StoryObj<typeof CurrencyChip>

export const Chaos: Story = {
  args: { value: 47, icon: chaosIcon },
}

export const Divine: Story = {
  args: { value: 2.3, icon: divineIcon },
}

export const Gold: Story = {
  args: { value: 12500, icon: goldIcon },
}

export const Dust: Story = {
  args: { value: 880, icon: dustIcon, iconSize: 14 },
}

export const StringValue: Story = {
  args: { value: '— / —', icon: chaosIcon },
  parameters: {
    docs: { description: { story: 'Accepts a string for non-numeric display (e.g. range placeholders).' } },
  },
}

export const ZeroWithFallback: Story = {
  args: { value: 0, icon: chaosIcon, fallback: 'free' },
  parameters: {
    docs: {
      description: {
        story: 'When `value === 0` and `fallback` is set, the chip shows the fallback text instead of "0".',
      },
    },
  },
}

export const IconAfter: Story = {
  args: { value: 5, icon: divineIcon, iconPosition: 'after' },
}
