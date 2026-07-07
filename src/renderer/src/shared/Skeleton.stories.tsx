import type { Meta, StoryObj } from '@storybook/react-vite'
import { Skeleton } from './Skeleton'

/** Loading-state placeholder with a horizontal shimmer animation. Sized via
 *  utility classes the caller passes through `className` (height, width,
 *  radius). Used in places like trade-result rows and price-check tiles
 *  while data is in flight. */
const meta: Meta<typeof Skeleton> = {
  title: 'Shared / Skeleton',
  component: Skeleton,
}
export default meta

type Story = StoryObj<typeof Skeleton>

export const Line: Story = {
  args: { className: 'h-3 w-40 rounded' },
}

export const ChipShape: Story = {
  args: { className: 'h-6 w-24 rounded-full' },
}

export const ImageThumb: Story = {
  args: { className: 'h-[100px] w-[150px] rounded' },
}

export const Stack: Story = {
  render: () => (
    <div className="flex flex-col gap-2 w-[260px]">
      <Skeleton className="h-3 w-40 rounded" />
      <Skeleton className="h-3 w-32 rounded" />
      <Skeleton className="h-3 w-44 rounded" />
    </div>
  ),
}
