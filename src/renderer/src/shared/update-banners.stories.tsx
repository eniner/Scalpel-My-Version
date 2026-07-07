import type { Meta, StoryObj } from '@storybook/react-vite'
import { UpdateAvailableBanner, JustUpdatedBanner, BrickedReleaseBanner } from './update-banners'

const meta: Meta = {
  title: 'Shared / Update Banners',
}
export default meta

const Host = ({ children }: { children: React.ReactNode }): JSX.Element => <div className="w-[640px]">{children}</div>

export const UpdateAvailable: StoryObj<typeof UpdateAvailableBanner> = {
  render: (args) => (
    <Host>
      <UpdateAvailableBanner {...args} />
    </Host>
  ),
  args: {
    version: '0.9.7-rc8',
    progress: null,
    ready: false,
    onDownload: () => {},
    onRestart: () => {},
  },
  parameters: { docs: { description: { story: 'Initial state: pre-download.' } } },
}

export const Downloading: StoryObj<typeof UpdateAvailableBanner> = {
  render: (args) => (
    <Host>
      <UpdateAvailableBanner {...args} />
    </Host>
  ),
  args: {
    version: '0.9.7-rc8',
    progress: 42,
    ready: false,
    onDownload: () => {},
    onRestart: () => {},
  },
  parameters: { docs: { description: { story: 'Mid-download with the green progress fill at 42%.' } } },
}

export const Ready: StoryObj<typeof UpdateAvailableBanner> = {
  render: (args) => (
    <Host>
      <UpdateAvailableBanner {...args} />
    </Host>
  ),
  args: {
    version: '0.9.7-rc8',
    progress: 100,
    ready: true,
    onDownload: () => {},
    onRestart: () => {},
  },
}

export const JustUpdated: StoryObj<typeof JustUpdatedBanner> = {
  render: (args) => (
    <Host>
      <JustUpdatedBanner {...args} />
    </Host>
  ),
  args: { version: '0.9.7-rc8' },
}

export const Bricked: StoryObj<typeof BrickedReleaseBanner> = {
  render: (args) => (
    <Host>
      <BrickedReleaseBanner {...args} />
    </Host>
  ),
  args: { version: '0.9.7-rc7', message: null },
  parameters: {
    docs: { description: { story: 'Auto-update broke; shown on releases that need a fresh installer download.' } },
  },
}

export const BrickedCustomMessage: StoryObj<typeof BrickedReleaseBanner> = {
  render: (args) => (
    <Host>
      <BrickedReleaseBanner {...args} />
    </Host>
  ),
  args: {
    version: '0.9.7-rc7',
    message: 'A breaking electron upgrade lands in v0.9.8. Download the new installer to continue.',
  },
}
