import { useState } from 'react'
import { GUIDE_CSS } from './guide-chrome'

type Tab = 'wand' | 'amulet'

export function BeltonCraftingGuide(): JSX.Element {
  const [tab, setTab] = useState<Tab>('wand')
  return (
    <div className="lg-root">
      <style>{GUIDE_CSS}</style>
      <div className="lg-header">
        <div>
          <h1>Belton crafting</h1>
          <div className="lg-meta">PoE2 · +11/+12 Spellslinger wand · Archmage amulet</div>
        </div>
      </div>
      <div className="lg-tabs">
        <button type="button" className={`lg-tab${tab === 'wand' ? ' on' : ''}`} onClick={() => setTab('wand')}>
          Wand (+11 / +12)
        </button>
        <button type="button" className={`lg-tab${tab === 'amulet' ? ' on' : ''}`} onClick={() => setTab('amulet')}>
          Archmage amulet
        </button>
      </div>
      <div className="lg-fill-body">{tab === 'wand' ? <WandPanel /> : <AmuletPanel />}</div>
      <div className="lg-footer">Belton — Open: Notes · Part 1 · Part 2 · Amulet</div>
    </div>
  )
}

function WandPanel(): JSX.Element {
  return (
    <div className="lg-board" style={{ gridTemplateRows: 'minmax(0,1fr) minmax(0,1.1fr)' }}>
      <div className="lg-panel">
        <div className="lg-update" style={{ marginBottom: 8 }}>
          <div className="l1">
            Alloy suffix (≥25% socketed augment) + Rune Caller 75% → <b>100% socket effect</b>
          </div>
          <div className="l2">
            Doubles Serle&apos;s Triumph (+1 Suffix → +2). Extra suffixes stay after temp pieces come off.
          </div>
        </div>
        <div className="lg-grid lg-grid-3" style={{ flex: 1 }}>
          <div className="lg-card green">
            <div className="lg-card-title">Base</div>
            <ul>
              <li>2-socket · Spellslinger · 30% Q</li>
              <li>ilvl 80/81 (81 for +5 ele gem)</li>
              <li>Runes: +1 Crafted · +1 Suffix</li>
            </ul>
          </div>
          <div className="lg-card">
            <div className="lg-card-title">Key pieces</div>
            <ul>
              <li>Alloy 20–30% (need ≥25%)</li>
              <li>Rune Caller Eldar&apos;s 75%</li>
              <li>Lifesprig +2 · +1 all spells rune</li>
            </ul>
          </div>
          <div className="lg-card amber">
            <div className="lg-card-title">Finish</div>
            <ul>
              <li>Lock-corrupt → +1 socket</li>
              <li>Architect&apos;s = twice-corrupt</li>
              <li>Yaomac&apos;s → enchant +1→+2</li>
            </ul>
          </div>
        </div>
      </div>
      <div className="lg-panel">
        <div className="lg-section-head">
          <span className="lg-num">01</span>
          <div className="lg-section-title">Targets</div>
        </div>
        <div className="lg-grid lg-grid-2" style={{ flex: 1 }}>
          <div className="lg-card">
            <div className="lg-card-title">Prefixes</div>
            <ul>
              <li>P1 — 119% Spell Damage</li>
              <li>P2 — 119% Lightning / 30% Extra</li>
              <li>P3 — +1 all Spells / +188 Mana</li>
            </ul>
          </div>
          <div className="lg-card">
            <div className="lg-card-title">Suffixes (during craft)</div>
            <ul>
              <li>S1 — +5 Lightning (or +4 all)</li>
              <li>S2 — T1 Cast (natural, not alloy)</li>
              <li>S3 — T1 Spell Crit · S4 Alloy 30% · S5 Crit Bonus</li>
            </ul>
          </div>
        </div>
      </div>
      <div className="lg-panel span-2">
        <div className="lg-section-head">
          <span className="lg-num">02</span>
          <div className="lg-section-title">Main craft (+11 pinnacle)</div>
        </div>
        <ol className="lg-steps">
          <li>Socket +1 Crafted + +1 Suffix. Lock prefixes: 119% Spell, 119% X / 30% Extra, craft Mana/+1.</li>
          <li>Suffixes: +5 X / +4 all, T1 Cast (natural), T1 Spell Crit. Craft Alloy 30% as 4th.</li>
          <li>Swap Crafted Mod → 75% Socket Effect. +1 Suffix becomes +2 (100% socket effect).</li>
          <li>Desecrate final suffix → T1 Crit Bonus (5 suffixes; extras keep after swaps).</li>
          <li>Remove 75% rune → Lifesprig (+2 all). Keep +1 Suffix. Lock-corrupt +1 socket → +1 all spells rune.</li>
          <li>Twice-corrupt for +1 matching enchant (50% brick). Yaomac&apos;s deletes Alloy → enchant +2.</li>
        </ol>
      </div>
      <div className="lg-panel">
        <div className="lg-grid lg-grid-1" style={{ flex: 1, display: 'grid', gap: 8, gridTemplateRows: '1fr 1fr' }}>
          <div className="lg-card green">
            <div className="lg-card-title">Final (ideal)</div>
            <ul>
              <li>30Q L20 · 3 sockets · +1/+2 spell runes</li>
              <li>Enchant +2 X · 119/119 · Mana/+1</li>
              <li>+5 X · Cast · Spell Crit · Crit Bonus ≈ +11</li>
            </ul>
          </div>
          <div className="lg-card red">
            <div className="lg-card-title">Do / Don&apos;t</div>
            <ul>
              <li>DO match % ele to +5 type · natural T1 cast</li>
              <li>DON&apos;T drop Serle early · DON&apos;T Yaomac without Alloy left</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

function AmuletPanel(): JSX.Element {
  return (
    <div className="lg-board" style={{ gridTemplateRows: 'auto minmax(0,1fr)' }}>
      <div className="lg-panel span-2">
        <div className="lg-update" style={{ marginBottom: 0 }}>
          <div className="l1">
            Goal: T1 flat Mana + T1 Mana% + +3 all Spells + T1 Cast · 50% caster Q · ilvl 82 = no fracture
          </div>
          <div className="l2">ilvl 82 → T1 flat Mana is the only ilvl-82 prefix → second prefix always lower.</div>
        </div>
      </div>
      <div className="lg-panel">
        <div className="lg-grid lg-grid-1" style={{ gap: 8, flex: 1 }}>
          <div className="lg-card green">
            <div className="lg-card-title">Targets</div>
            <ul>
              <li>+3 all Spell Skills</li>
              <li>T1 flat Mana · T1 Mana %</li>
              <li>T1 Cast · 50% caster Q</li>
            </ul>
          </div>
          <div className="lg-card amber">
            <div className="lg-card-title">Cost notes</div>
            <ul>
              <li>~50 Tainted Infusers → 50Q</li>
              <li>+3 Spells ~1/1600 at 82</li>
              <li>His hit ~598div · Lock sanctify</li>
            </ul>
          </div>
        </div>
      </div>
      <div className="lg-panel">
        <div className="lg-section-head">
          <span className="lg-num">01</span>
          <div className="lg-section-title">Quality → +3 Spells</div>
        </div>
        <ol className="lg-steps one-col">
          <li>Rare → Essence of the Breach (+20 Q). Keep essence mod.</li>
          <li>Sibilant catalysts → 40% Q. Tainted Infusers → 50% Q.</li>
          <li>Annul to ONE mod. Chaos spam +3 all Spells (~1/1600).</li>
        </ol>
      </div>
      <div className="lg-panel">
        <div className="lg-section-head">
          <span className="lg-num">02</span>
          <div className="lg-section-title">Mana → Cast · finish</div>
        </div>
        <ol className="lg-steps one-col">
          <li>Desecrate high ilvl (≥75) suffix first (protects whittles).</li>
          <li>Open prefix → Perfect Ex/Chaos for T1 flat Mana, then T1 Mana %.</li>
          <li>Cast via desecrate (Light + Echoes). Catalysts → Lock sanctify.</li>
        </ol>
      </div>
      <div className="lg-panel">
        <div className="lg-card red" style={{ flex: 1 }}>
          <div className="lg-card-title">Do / Don&apos;t</div>
          <ul>
            <li>DO ilvl 82 for no-fracture path</li>
            <li>DO chaos on single mod for +3</li>
            <li>DON&apos;T Cast before both Mana prefixes</li>
            <li>DON&apos;T naked-sanctify a finished 4-mod</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
