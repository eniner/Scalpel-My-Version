import { useState } from 'react'
import { GUIDE_CSS } from './guide-chrome'

type Tab = 'jewel' | 'amulet' | 'ring' | 'staff'

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'jewel', label: 'Jewel' },
  { id: 'amulet', label: 'Amulet' },
  { id: 'ring', label: 'Ring' },
  { id: 'staff', label: 'Staff' },
]

export function WaMonkCraftsGuide(): JSX.Element {
  const [tab, setTab] = useState<Tab>('jewel')
  return (
    <div className="lg-root">
      <style>{GUIDE_CSS}</style>
      <div className="lg-header">
        <div>
          <h1>WA Monk crafts</h1>
          <div className="lg-meta">PoE2 · Whirling Assault — jewel · amulet · ring · staff</div>
        </div>
      </div>
      <div className="lg-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`lg-tab${tab === t.id ? ' on' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="lg-fill-body">
        {tab === 'jewel' && <Jewel />}
        {tab === 'amulet' && <Amulet />}
        {tab === 'ring' && <Ring />}
        {tab === 'staff' && <Staff />}
      </div>
      <div className="lg-footer">Open buttons below = source craft videos</div>
    </div>
  )
}

function Jewel(): JSX.Element {
  return (
    <div className="lg-board" style={{ gridTemplateRows: 'auto minmax(0,1fr)' }}>
      <div className="lg-panel span-2">
        <div className="lg-update" style={{ marginBottom: 0 }}>
          <div className="l1">
            5-Mod Sapphire — crit suffixes + ES prefixes · Contempt +1 Suffix locks Chaos/Velocity to prefixes
          </div>
        </div>
      </div>
      <div className="lg-panel">
        <div className="lg-grid" style={{ gap: 8, flex: 1 }}>
          <div className="lg-card green">
            <div className="lg-card-title">Buy</div>
            <ul>
              <li>Sapphire · Crit Hit + Crit Multi</li>
              <li>Not corrupted / fractured (~4–5d)</li>
              <li>Extra socket = Zarokh&apos;s Gift</li>
            </ul>
          </div>
          <div className="lg-card amber">
            <div className="lg-card-title">Trick</div>
            <ul>
              <li>Contempt → +1 Suffix (50/50)</li>
              <li>3 suffixes lock Chaos to prefixes</li>
              <li>Finish with Potent Velocity</li>
            </ul>
          </div>
        </div>
      </div>
      <div className="lg-panel span-2">
        <div className="lg-section-head">
          <span className="lg-num">01</span>
          <div className="lg-section-title">Steps</div>
        </div>
        <ol className="lg-steps">
          <li>Contempt → must hit +1 Suffix. Prefix = new sapphire.</li>
          <li>Cranium desecrate 3rd suffix. Well + Abyssal Echoes (6 looks).</li>
          <li>Bad unveil? Light + Annul desecrated only → again.</li>
          <li>Sinistral Annulment + Annul → remove “+1 Suffix allowed”.</li>
          <li>Exalt open prefix. Chaos spam prefixes only → Max ES + keeper.</li>
          <li>Velocity removes a prefix (prefer Max ES). Divine finish.</li>
        </ol>
      </div>
      <div className="lg-panel">
        <div className="lg-grid" style={{ gap: 8, flex: 1 }}>
          <div className="lg-card green">
            <div className="lg-card-title">Do</div>
            <ul>
              <li>Confirm Echoes red border</li>
              <li>Stop when 3rd suffix is useful</li>
              <li>Chaos until 2 keepable prefixes</li>
            </ul>
          </div>
          <div className="lg-card red">
            <div className="lg-card-title">Don&apos;t</div>
            <ul>
              <li>No fractured / corrupted starts</li>
              <li>Don&apos;t continue after +1 Prefix</li>
              <li>Don&apos;t naked annul</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

function Amulet(): JSX.Element {
  return (
    <div className="lg-board">
      <div className="lg-panel">
        <div className="lg-update" style={{ marginBottom: 8 }}>
          <div className="l1">Solar Amulet (+4 Melee) — Fractured +Melee · T1 Spirit · ES · Crit Multi / Res</div>
        </div>
        <div className="lg-grid" style={{ gap: 8, flex: 1 }}>
          <div className="lg-card green">
            <div className="lg-card-title">Base</div>
            <ul>
              <li>Solar · 10–15 Spirit · ilvl ≥80</li>
              <li>Buy Fractured +3 Melee (~28d)</li>
            </ul>
          </div>
          <div className="lg-card">
            <div className="lg-card-title">Wanted</div>
            <ul>
              <li>T1 Spirit · %ES · flat ES</li>
              <li>+Melee fractured · Crit Multi / Res</li>
              <li>Reaver &gt;33% Q → +3 becomes +4</li>
            </ul>
          </div>
        </div>
      </div>
      <div className="lg-panel span-2">
        <div className="lg-section-head">
          <span className="lg-num">01</span>
          <div className="lg-section-title">Steps</div>
        </div>
        <ol className="lg-steps">
          <li>Fractured +3 Melee + junk. Chaos → T1 Spirit.</li>
          <li>Dextral Exalt junk suffix. Crystallisation + Breach → +20 max Q.</li>
          <li>Carapace 40% def Q. Sinistral + Catalysing + Perfect Ex → ES.</li>
          <li>Reaver 40% attack Q. &gt;33% → Fractured +3 becomes +4.</li>
          <li>Whittling + Chaos → remove Max Quality. Enhancement essence → Global def %.</li>
          <li>Collarbone + Echoes (Crit Multi / All Res). Light to reroll.</li>
        </ol>
      </div>
    </div>
  )
}

function Ring(): JSX.Element {
  return (
    <div className="lg-board">
      <div className="lg-panel">
        <div className="lg-update" style={{ marginBottom: 8 }}>
          <div className="l1">Dusk Ring — 4× flat damage · ~300div craft / ~2k value</div>
        </div>
        <div className="lg-grid" style={{ gap: 8, flex: 1 }}>
          <div className="lg-card green">
            <div className="lg-card-title">Base</div>
            <ul>
              <li>4 prefixes / 2 suffixes · ilvl ≥75</li>
              <li>Finish: Colandre&apos;s Touch to mirror</li>
            </ul>
          </div>
          <div className="lg-card amber">
            <div className="lg-card-title">Targets</div>
            <ul>
              <li>T1 Phys / Fire / Cold / Lightning</li>
              <li>Suffixes: All Res + Rarity</li>
              <li>Divine flats BEFORE fracture</li>
            </ul>
          </div>
        </div>
      </div>
      <div className="lg-panel span-2">
        <div className="lg-section-head">
          <span className="lg-num">01</span>
          <div className="lg-section-title">Steps</div>
        </div>
        <ol className="lg-steps">
          <li>Annul → 1 mod → Chaos T1 flat → Divine → Exalt×2 → Collarbone → Fracture (33%).</li>
          <li>Annul to Fractured T1 + junk → Chaos 2nd T1. Dextral Exalt junk suffix.</li>
          <li>Crystallisation + Breach → +20 max Q. Catalyst missing flat → 40% Q.</li>
          <li>Sinistral + Catalysing + Perfect Ex → 3rd flat. Reaver → 40% attack Q.</li>
          <li>Whittling + Chaos → remove Quality. 4th flat via Necromancy + Echoes + Collarbone.</li>
          <li>Suffixes: Greater Exaltation + Perfect Exalt (2 suffixes).</li>
        </ol>
      </div>
    </div>
  )
}

function Staff(): JSX.Element {
  return (
    <div className="lg-board">
      <div className="lg-panel">
        <div className="lg-update" style={{ marginBottom: 8 }}>
          <div className="l1">Sinister Quarterstaff — budget · +3 Melee · flat ele · crit · stepping-stone</div>
        </div>
        <div className="lg-grid" style={{ gap: 8, flex: 1 }}>
          <div className="lg-card green">
            <div className="lg-card-title">Base</div>
            <ul>
              <li>Sinister (12% crit) · Magic · ilvl 81</li>
              <li>+3 Melee · empty prefix or flat ele</li>
            </ul>
          </div>
          <div className="lg-card amber">
            <div className="lg-card-title">Finish</div>
            <ul>
              <li>Whetstone 20% · Artificer&apos;s 2 sock</li>
              <li>Atziri&apos;s Acuity + Greater Storm</li>
            </ul>
          </div>
        </div>
      </div>
      <div className="lg-panel span-2">
        <div className="lg-section-head">
          <span className="lg-num">01</span>
          <div className="lg-section-title">Steps + Do/Don&apos;t</div>
        </div>
        <div className="lg-grid lg-grid-2" style={{ flex: 1 }}>
          <ol className="lg-steps one-col">
            <li>Buy Magic Sinister +3 Melee ilvl 81. Optional Perfect Aug for flat ele.</li>
            <li>Greater Seeking → Crit Chance. Greater Exaltation + Greater Exalt.</li>
            <li>Jawbone desecrate + Echoes → Crit Multi. Whetstone → sockets → runes.</li>
          </ol>
          <div className="lg-grid" style={{ gap: 8 }}>
            <div className="lg-card green">
              <div className="lg-card-title">Do</div>
              <ul>
                <li>Prefer Sinister 12% crit base</li>
                <li>Treat as staircase upgrade path</li>
              </ul>
            </div>
            <div className="lg-card red">
              <div className="lg-card-title">Don&apos;t</div>
              <ul>
                <li>Don&apos;t buy +5 Melee for budget craft</li>
                <li>Don&apos;t naked Annul the +3 Melee</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
