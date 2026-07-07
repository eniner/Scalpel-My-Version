import type { Meta, StoryObj } from '@storybook/react-vite'
import { PoeVersionProvider } from './poe-version-context'
import { CurrencyLabelsProvider } from './currency-labels-context'
import { PriceChip } from './PriceChip'

const meta: Meta = {
  title: 'shared/CurrencyIcon',
}
export default meta

type Story = StoryObj

function Row({ version, textMode }: { version: 1 | 2; textMode: boolean }): JSX.Element {
  return (
    <PoeVersionProvider version={version}>
      <CurrencyLabelsProvider value={textMode}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 8 }}>
          <span style={{ fontSize: 11, color: '#888', width: 120 }}>
            PoE{version} · {textMode ? 'text labels' : 'icons'}
          </span>
          <PriceChip chaosValue={47} />
          <PriceChip chaosValue={250} chaosPerDivine={200} />
          <PriceChip chaosValue={5} divineValue={5} />
        </div>
      </CurrencyLabelsProvider>
    </PoeVersionProvider>
  )
}

export const SideBySide: Story = {
  render: () => (
    <div style={{ background: '#171821', color: '#eee' }}>
      <Row version={1} textMode={false} />
      <Row version={1} textMode={true} />
      <Row version={2} textMode={false} />
      <Row version={2} textMode={true} />
    </div>
  ),
}
