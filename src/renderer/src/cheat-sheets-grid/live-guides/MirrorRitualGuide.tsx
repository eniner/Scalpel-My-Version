import { useState } from 'react'
import { GUIDE_CSS } from './guide-chrome'

type TabletTab = 'cheap' | 'middle' | 'expensive' | 'planb'

const TABLET_TABS: Array<{ id: TabletTab; label: string; badge?: string }> = [
  { id: 'cheap', label: 'Cheap', badge: 'Atlas #2' },
  { id: 'middle', label: 'Middle', badge: 'core ≈80%' },
  { id: 'expensive', label: 'Expensive', badge: 'extract' },
  { id: 'planb', label: 'Plan B', badge: 'Atlas #3' },
]

/**
 * Full Mirror Ritual Farming guide.
 * Sources: Gary Peacock spreadsheet + Full Guide video + Doryani update video.
 * Layout: single column (read top → bottom). Content is NEVER shortened.
 */
export function MirrorRitualGuide(): JSX.Element {
  const [doryaniOpen, setDoryaniOpen] = useState(true)
  const [whyOpen, setWhyOpen] = useState(true)
  const [qaOpen, setQaOpen] = useState(true)
  const [tablet, setTablet] = useState<TabletTab>('middle')

  return (
    <div className="lg-root lg-single">
      <style>{GUIDE_CSS}</style>
      <style>{SINGLE_CSS}</style>

      <div className="lg-header">
        <div>
          <h1>Mirror ritual farming</h1>
          <div className="lg-meta">
            PoE2 · Gary Peacock spreadsheet · Full guide + Doryani update · read top → bottom
          </div>
        </div>
        <div className="lg-tags">
          {['head', 'audience', 'tablet / waystone', 'fracture', 'whittle', 'divine'].map((t) => (
            <span key={t} className="lg-tag">
              {t}
            </span>
          ))}
        </div>
      </div>

      <div className="lg-update">
        <div className="l1">
          <b>Note from sheet:</b> This is a repeatable Income since no Lucky Drops were Involved!!! Everyone can do
          this!
        </div>
        <div className="l2">
          Same tablet / ritual loop as the full guide. Update: <b>Doryani run → mirror in 7 days</b> (was 9 on Jado).
          Omens = floor (consistency). Belts / HH / mageblood = ceiling (luck). Speed in/out — rituals only.
        </div>
      </div>

      <div className="lg-stack">
        {/* ═══════ 01 Must-take atlas ═══════ */}
        <section className="lg-panel">
          <div className="lg-section-head">
            <span className="lg-num">01</span>
            <div className="lg-section-title">
              Must-take atlas
              <small>from spreadsheet — exact points look at YT</small>
            </div>
          </div>
          <ul>
            <li>
              Boss: <b>Doryani</b> or <b>Jado</b> (see §09 for the full comparison and when to swap)
            </li>
            <li>
              Sheet listed Jado as the default atlas boss option; Doryani is the update-video preference{' '}
              <b>if it works for you</b>
            </li>
            <li>Partial Translations</li>
            <li>Keen Appraisal</li>
            <li>Unforeseen Threats (sheet spelling: Unforseen Threats)</li>
            <li>In the Wrong Hands</li>
            <li>
              <b>Summoning Circles</b> — Summoning Circle bosses have a high chance to drop Fracturing Orbs
            </li>
            <li>Fill the rest of the tree with Pack Size / Magic Pack Size</li>
            <li>
              Item rarity ≈200%: more raw currency drops (chaos, divines, perfect chaos/exalts) — does <b>not</b> change
              omen rolls inside Ritual. Helps finance the farm. Focus IR late in your gear progression.
            </li>
          </ul>
        </section>

        {/* ═══════ 02 Head + Audience + King ═══════ */}
        <section className="lg-panel">
          <div className="lg-section-head">
            <span className="lg-num">02</span>
            <div className="lg-section-title">
              Head + Audience + King
              <small>sheet “Setup” rows — every map package</small>
            </div>
          </div>
          <ul>
            <li>
              Always run through maps with <b>An Audience with the King</b> and kill him to get % chance for a
              high-value unique and <b>100% Head of the King</b>. Switch the King fight here to <b>Doryani</b> (update
              path) / Head of the Snake when you want the 2-unique chance.
            </li>
            <li>
              Use <b>Head of the King</b> to select <b>6 maps</b> which you run with your tablet setup to increase
              chances for Omens and raw currency.
            </li>
            <li>
              Put Head of the King on <b>any</b> maps — not only city maps. A lot of people say “only cities” — that is
              wrong for this setup. Cities are better but highly overrated; normal maps with Head still print omens.
            </li>
            <li>
              Keep Audience running so you do not have to buy Heads (Heads ~2div if you sell extras). King of the Mists:
              Doryani / Head of the Snake → chance at 2 uniques (Ingenuity belt, From Nothing jewels).
            </li>
          </ul>
        </section>

        {/* ═══════ 03 Atlas pivot ═══════ */}
        <section className="lg-panel">
          <div className="lg-section-head">
            <span className="lg-num">03</span>
            <div className="lg-section-title">
              Atlas pivot
              <small>full guide — still core to every run</small>
            </div>
          </div>
          <div className="lg-grid lg-grid-2">
            <div className="lg-card green">
              <div className="lg-card-title">
                Tree #2 — acquire omens <span className="lg-badge">≈80–90% of maps</span>
              </div>
              <ul>
                <li>Increased number of favors → more omen rolls (higher chance omens spawn)</li>
                <li>Use while building omen stockpile</li>
                <li>Pair with Cheap / Middle tablet setups</li>
                <li>This is the core acquire phase — run over and over until ritual is clogged</li>
              </ul>
            </div>
            <div className="lg-card amber">
              <div className="lg-card-title">
                Tree #3 — extract omens <span className="lg-badge">tribute pivot</span>
              </div>
              <ul>
                <li>50% reduced penalty to tribute granted → you gain more tribute</li>
                <li>Switch when ritual is clogged (≈6+ omens stuck, often 9–12) — strategy becomes “too successful”</li>
                <li>Pair with Expensive / Plan B extract tablets</li>
                <li>This is the main answer to “how do you get so much tribute?”</li>
              </ul>
            </div>
          </div>
        </section>

        {/* ═══════ 04 Tablets ═══════ */}
        <section className="lg-panel">
          <div className="lg-section-head">
            <span className="lg-num">04</span>
            <div className="lg-section-title">
              Tablet setups
              <small>spreadsheet columns + full guide middle tier — pick one tab</small>
            </div>
          </div>
          <p className="lg-note">
            <b>Waystone:</b> Pack Size as high as possible (tribute). Beginner T15 pack-size waystone can be ~50ex /
            whole Cheap kit &lt;1 Divine. <b>Freedom of Faith</b> (Unique Ritual Tablet) = bread &amp; butter — Ritual
            Altars cost more but you get double rerolls; this alone drove a huge share of profit (he said roughly half a
            mirror from Freedom alone).
          </p>
          <div className="lg-tabs">
            {TABLET_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`lg-tab${tablet === t.id ? ' on' : ''}`}
                onClick={() => setTablet(t.id)}
              >
                {t.label}
                {t.badge ? <span className="lg-tab-badge">{t.badge}</span> : null}
              </button>
            ))}
          </div>
          <TabletPanel tab={tablet} />
        </section>

        {/* ═══════ 05 Core loop ═══════ */}
        <section className="lg-panel">
          <div className="lg-section-head">
            <span className="lg-num">05</span>
            <div className="lg-section-title">
              Core concepts / loop
              <small>spreadsheet Core Concepts + full guide</small>
            </div>
          </div>
          <div className="lg-loop">
            <div className="lg-loop-item">
              <span className="lg-loop-num">1</span>
              <span>
                Pick <b>Doryani</b> or <b>Jado</b> (test ≈30 maps — see §09). Run the <b>Cheap / Middle</b> setup with
                Atlas <b>#2</b> until you acquire that many omens that you have to switch to the expensive setup (≈6+
                stockpiled; often 9–12 clogged).
              </span>
            </div>
            <div className="lg-loop-item">
              <span className="lg-loop-num">2</span>
              <span>
                Pivot to <b>Expensive / Plan B</b> + Atlas <b>#3</b> →{' '}
                <b>Buy all Omens with expensive Setup until Ritual is empty</b> (buy/defer every omen).
              </span>
            </div>
            <div className="lg-loop-item">
              <span className="lg-loop-num">3</span>
              <span>Switch back to Cheap / Middle Setup + Atlas #2.</span>
            </div>
            <div className="lg-loop-item">
              <span className="lg-loop-num">4</span>
              <span>Watch out for expensive Uniques. Rinse and Repeat.</span>
            </div>
            <div className="lg-loop-item">
              <span className="lg-loop-num">5</span>
              <span>
                <b>Tribute Gain: Do the Boss First</b> on open maps (boss spawns into later rituals). Skip on linear
                maps (e.g. Ravine) — just run rituals then boss. <b>Savannah:</b> rituals <b>before</b> boss (~25% of
                maps break if you do the hyena first — rituals become unclickable and you can lose the whole map).
              </span>
            </div>
            <div className="lg-loop-item">
              <span className="lg-loop-num">6</span>
              <span>
                Reserve ≈2,500 Tribute after paying remaining rerolls. Use <b>all</b> rerolls — omen rate with this
                setup is high. Do not skip rerolls to “save” tribute.
              </span>
            </div>
          </div>
        </section>

        {/* ═══════ 06 What to buy ═══════ */}
        <section className="lg-panel">
          <div className="lg-section-head">
            <span className="lg-num">06</span>
            <div className="lg-section-title">
              What to look for
              <small>exact spreadsheet buy list</small>
            </div>
          </div>
          <div className="lg-grid lg-grid-2">
            <div className="lg-card">
              <div className="lg-card-title">Omens</div>
              <ul>
                <li>Whittling</li>
                <li>Sinistral Erasure</li>
                <li>Dextral Erasure</li>
                <li>Sinistral Annulment</li>
                <li>Dextral Annulment</li>
                <li>
                  Ancestral Erasure (full guide — the purple / pink omen group; bread &amp; butter with the erasures)
                </li>
                <li>
                  <b>Are Waystone Omens worth buying?</b> No. They go for roughly half a divine but deferring / keeping
                  them is a tribute headache. Skip them.
                </li>
              </ul>
            </div>
            <div className="lg-card">
              <div className="lg-card-title">Uniques</div>
              <ul>
                <li>Rathpith (sheet: Rathpit) — big ticket unique between omen pays</li>
                <li>
                  Lavianga&apos;s (sheet: Laviangatas) — perfect roll = <b>70%</b> reduced amount recovered; corrupt for
                  extra quality / more value
                </li>
                <li>
                  Lookout for Uniques with a price-checking tool like <b>Exiled Exchange 2</b>
                </li>
                <li>
                  Don&apos;t buy anything else from the list to save the slots for Omens unless it is your{' '}
                  <b>last Ritual</b> and you have Tribute to spare
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* ═══════ 07 Map priority ═══════ */}
        <section className="lg-panel">
          <div className="lg-section-head">
            <span className="lg-num">07</span>
            <div className="lg-section-title">
              Map setup / priority
              <small>spreadsheet Map Setup + full guide + update</small>
            </div>
          </div>
          <ul>
            <li>
              <b>1 — Cleansed Areas Priority</b> since they drop the most raw currency but also Omens in his experience.
              With Doryani + Volatile Connection you get many Cleansed maps → Fracturing Orbs (~11div each; average
              ~5/week → ~66div/week). He personally runs Cleansed even more than City.
            </li>
            <li>
              <b>2 — City Areas</b> for 4 Tablets — as good as Cleansed Areas when lucky. Good, not mandatory. Do not
              only run city maps.
            </li>
            <li>
              <b>3 — Corruption Areas</b> — convert the middle map so it becomes Cleansed; usually do not farm
              Corruption itself (kept on the sheet from the older setup).
            </li>
            <li>
              <b>Savannah bug:</b> if you spawn into Savannah, do the rituals first. ~25% of maps: if you kill the hyena
              boss first, the other rituals break / cannot be clicked and you lose the map.
            </li>
            <li>
              <b>Are you only running City Maps?</b> No — Head of the King on normal maps into city maps, also Cleansed.
              City focus is overrated for this setup.
            </li>
            <li>
              Delirium is usually too hard / slow to set up — you lose time. Core concept: be fast. In and out. Rituals
              only (plus a 10-stone on the way if you want).
            </li>
          </ul>
        </section>

        {/* ═══════ 08 Tribute & tips ═══════ */}
        <section className="lg-panel">
          <div className="lg-section-head">
            <span className="lg-num">08</span>
            <div className="lg-section-title">
              Tribute management &amp; final tips
              <small>sheet Final Tips + video showcase math</small>
            </div>
          </div>
          <div className="lg-card" style={{ marginBottom: 8 }}>
            <div className="lg-card-title">Tribute rules</div>
            <ul>
              <li>
                Manage your Tribute until last Ritual for Potential Jackpot Item. Rule of thumb:{' '}
                <b>around 2500 Tribute as Reserve</b>
              </li>
              <li>
                Budget = total Tribute − (rerolls × cost) − 2,500 reserve. Example from the video: 9 rerolls × 1000 =
                9,000 already committed; + 2,500 reserve → 11,500 “gone” before you shop; work with what remains
              </li>
              <li>Buy cheap omens / must-haves first; defer big tickets if tight</li>
              <li>Some rerolls are free — always check before spending</li>
              <li>
                Why not defer Omens directly to make them cheaper? Use all your rerolls first — chances to hit omens
                with this strategy are very high, so you do not want to lose rerolls
              </li>
              <li>
                Wildwood Wisps increase your Tribute Gain by <b>30%</b>. Always stand in them while clearing. They can
                be hard to see under FX — look for a blue shimmer going toward the sky
              </li>
              <li>Run Pack Size if you have trouble with Tribute Management</li>
            </ul>
          </div>
          <div className="lg-card">
            <div className="lg-card-title">Final tips (sheet + videos)</div>
            <ul>
              <li>As Faster you map as more Chances and Rituals you get</li>
              <li>Fast maps &gt; juicy slow maps — in/out is the strategy</li>
              <li>Freedom of Faith Unique alone drove a huge share of profit</li>
              <li>Pack Size early → tribute; Item Rarity late → raw currency, not omen rolls</li>
              <li>Jackpots (HH / Mageblood) are bonus — don&apos;t build the farm around them</li>
              <li>Omens = floor (consistency). Belts / HH / mageblood = ceiling (luck)</li>
              <li>Summoning Circle bosses have a high chance to drop Fracturing Orbs</li>
              <li>
                How do you get so many rerolls and so much tribute? Head of the King in general + Freedom Unique and/or
                additional-reroll tablet + Jado 40% tablet explicit effect when it procs + Atlas #3 when clogged. Best
                maps he mentioned: ~32–34 rerolls with huge tribute
              </li>
            </ul>
          </div>
        </section>

        {/* ═══════ 09 Doryani (full, expanded by default) ═══════ */}
        <section className="lg-panel">
          <button
            type="button"
            className="lg-collapse-btn"
            onClick={() => setDoryaniOpen((v) => !v)}
            aria-expanded={doryaniOpen}
          >
            <span className="lg-num">09</span>
            <span className="lg-section-title">
              Doryani vs Jado
              <small>full update video — {doryaniOpen ? 'click to collapse' : 'click to expand'}</small>
            </span>
            <span className="lg-chevron">{doryaniOpen ? '▾' : '▸'}</span>
          </button>
          {doryaniOpen && (
            <>
              <div className="lg-compare">
                <div className="lg-compare-row">
                  <div className="lg-compare-label">Omens / day</div>
                  <div className="lg-track">
                    <div className="lg-fill d" style={{ width: '100%' }} />
                  </div>
                  <div className="lg-compare-val">38.7</div>
                </div>
                <div className="lg-compare-row">
                  <div className="lg-compare-label" />
                  <div className="lg-track">
                    <div className="lg-fill j" style={{ width: '80%' }} />
                  </div>
                  <div className="lg-compare-val">31.2</div>
                </div>
                <div className="lg-compare-row">
                  <div className="lg-compare-label">Tracked pace</div>
                  <div className="lg-track">
                    <div className="lg-fill d" style={{ width: '100%' }} />
                  </div>
                  <div className="lg-compare-val">110 div/hr</div>
                </div>
                <div className="lg-compare-row">
                  <div className="lg-compare-label" />
                  <div className="lg-track">
                    <div className="lg-fill j" style={{ width: '87%' }} />
                  </div>
                  <div className="lg-compare-val">96 div/hr</div>
                </div>
                <div className="lg-legend">
                  <span>
                    <i className="lg-dot d" />
                    Doryani — ≈24% more omens/day, mirror ~2 days faster (7 vs 9) even with worse belt luck
                  </span>
                  <span>
                    <i className="lg-dot j" />
                    Jado — fallback; boom/dry swings; 40%↑ effect of explicit modifiers on tablets
                  </span>
                </div>
              </div>
              <div className="lg-grid lg-grid-2">
                <div className="lg-card green">
                  <div className="lg-card-title">Prefer Doryani — if it works</div>
                  <ul>
                    <li>
                      <b>More consistent floor</b>: 1–2 omens/map vs Jado boom/dry swings (Jado can spike 6 in a map
                      then dry)
                    </li>
                    <li>
                      Enables <b>Volatile Connection</b> → more Cleansed maps → Fracturing Orbs (~11div; he saw 3–4
                      sometimes even 8 from cleansed; average ~5/week)
                    </li>
                    <li>
                      Mirror run ≈2 days faster than Jado even when belt/HH/MB luck was much worse on Doryani (~455div
                      belts vs ~2000div on the Jado run) — proves the omen floor carries the strategy
                    </li>
                    <li>Item rarity does not affect omen rolls; ~200% IR still helps finance via raw currency drops</li>
                  </ul>
                </div>
                <div className="lg-card red">
                  <div className="lg-card-title">Fallback to Jado — if Doryani fails</div>
                  <ul>
                    <li>
                      Some players get dead Doryani results even with the sheet correct — connections, waystones,
                      tablets double-checked; reason still unknown
                    </li>
                    <li>
                      Test ≈30 maps: if only ≈10–12 omens, swap to Jado and re-test (maybe another day). That is not
                      enough for 30 maps on a working Doryani run
                    </li>
                    <li>
                      Jado = <b>40%↑</b> tablet explicit effect — still strong / repeatable. Best node for tablet
                      strategies on the sheet
                    </li>
                    <li>Cannot run Volatile Connection on Jado — fewer Cleansed Fractures</li>
                  </ul>
                </div>
              </div>
            </>
          )}
        </section>

        {/* ═══════ 10 Why Ritual ═══════ */}
        <section className="lg-panel">
          <button
            type="button"
            className="lg-collapse-btn"
            onClick={() => setWhyOpen((v) => !v)}
            aria-expanded={whyOpen}
          >
            <span className="lg-num">10</span>
            <span className="lg-section-title">
              Why Ritual?
              <small>exact spreadsheet Pro / Contra — {whyOpen ? 'collapse' : 'expand'}</small>
            </span>
            <span className="lg-chevron">{whyOpen ? '▾' : '▸'}</span>
          </button>
          {whyOpen && (
            <div className="lg-grid lg-grid-2">
              <div className="lg-card green">
                <div className="lg-card-title">Pro</div>
                <ul>
                  <li>No rarity Needed</li>
                  <li>Constant good Income</li>
                  <li>Omens keep Increasing</li>
                  <li>Cheap</li>
                  <li>Easy Setup</li>
                  <li>Perfect for Twister</li>
                  <li>Jackpot Possibility (Mageblood)</li>
                </ul>
              </div>
              <div className="lg-card red">
                <div className="lg-card-title">Contra</div>
                <ul>
                  <li>Summoning Circles</li>
                  <li>Chaos Damage</li>
                  <li>Lot of Puddles on Ground</li>
                </ul>
              </div>
            </div>
          )}
        </section>

        {/* ═══════ 11 Q&A ═══════ */}
        <section className="lg-panel">
          <button type="button" className="lg-collapse-btn" onClick={() => setQaOpen((v) => !v)} aria-expanded={qaOpen}>
            <span className="lg-num">11</span>
            <span className="lg-section-title">
              Q&amp;A
              <small>sheet questions + full guide answers — {qaOpen ? 'collapse' : 'expand'}</small>
            </span>
            <span className="lg-chevron">{qaOpen ? '▾' : '▸'}</span>
          </button>
          {qaOpen && (
            <div className="lg-qa-stack">
              <div className="lg-card">
                <div className="lg-card-title">Why are you not deferring the Omens directly to make them Cheaper?</div>
                <ul>
                  <li>
                    Use all your rerolls. The chance you hit omens with this strategy is very high — do not lose rerolls
                    to save a little tribute.
                  </li>
                  <li>
                    Always calculate: remaining reroll cost + ≈2,500 reserve first, then buy cheap / defer expensive
                    with what is left. Check for free rerolls every time.
                  </li>
                </ul>
              </div>
              <div className="lg-card">
                <div className="lg-card-title">How do you get so many Rerolls and so much Tribute?</div>
                <ul>
                  <li>Head of the King on maps increases ritual value / rerolls</li>
                  <li>Freedom of Faith Unique and/or the additional-reroll tablet</li>
                  <li>Jado 40% increased effect of explicit modifiers on tablets can stack huge reroll counts</li>
                  <li>Switch to Atlas #3 when you have many omens and need tribute to extract</li>
                  <li>Pack Size on waystone / tablets if you are tribute-starved</li>
                </ul>
              </div>
              <div className="lg-card">
                <div className="lg-card-title">Are Waystone Omens worth buying?</div>
                <ul>
                  <li>No. Roughly half a divine each, but they clog tribute and slots. Focus real omens + uniques.</li>
                </ul>
              </div>
              <div className="lg-card">
                <div className="lg-card-title">Are you only running City Maps?</div>
                <ul>
                  <li>
                    No. Head of the King on normal maps, city maps, and cleansed areas. Cities are better but not so
                    much better that you should only focus on them.
                  </li>
                </ul>
              </div>
              <div className="lg-card amber">
                <div className="lg-card-title">
                  What do you think of the expensive Setup with the Additional Reroll Tablet?
                </div>
                <ul>
                  <li>
                    Usually overrated. Extra-reroll tablet ~20–25div (sometimes quoted higher with omen% rolled on it).
                    Needs ≈2.5 Omen of Whittling just to break even on cost.
                  </li>
                  <li>Dry streaks wipe the investment. HH / Mageblood jackpots are rare and prices fell.</li>
                  <li>
                    Only sensible when you already have many omens stuck and are emptying the bank, or you are fully
                    decked / crafting with spare currency. Skip if still gearing or early Mirror farm.
                  </li>
                  <li>
                    His use-case when he does run it: pair with omen% tablets on extract so you still get tribute
                    without Freedom&apos;s tribute penalty while clearing a clogged ritual.
                  </li>
                </ul>
              </div>
              <div className="lg-card green">
                <div className="lg-card-title">Beginner path (update video)</div>
                <ul>
                  <li>
                    Cheap setup intentionally &lt;1 Divine total — T15 pack-size waystone (~50ex) + Omens% tablets
                    rolled cheap + Freedom Unique (~150ex in his example)
                  </li>
                  <li>Focus increased chance to be Omens ×2 + Freedom. Don&apos;t overcomplicate.</li>
                  <li>On city maps, optional 3rd Omens% tablet. Snowball gear, then upgrade tablets.</li>
                  <li>Same Doryani / Jado 30-map test rules apply to beginners.</li>
                  <li>Promise from full guide: first ~18 maps with Cheap setup → at least ~2 omens</li>
                </ul>
              </div>
              <div className="lg-card blue">
                <div className="lg-card-title">Speed</div>
                <ul>
                  <li>
                    Core part of the strategy: in and out fast. Do the maps, do the ritual, back to hideout, stash, next
                    map.
                  </li>
                  <li>
                    Example pace from the video: first 12 maps in under ~30 minutes (2 omens), then another 3 maps in
                    under ~10 minutes (6 more omens). Volume beats slow juicy clears.
                  </li>
                </ul>
              </div>
            </div>
          )}
        </section>

        <section className="lg-panel">
          <div className="lg-section-head">
            <span className="lg-num">12</span>
            <div className="lg-section-title">Links / credit</div>
          </div>
          <ul>
            <li>YouTube: https://www.youtube.com/@GaryPeacockPOE</li>
            <li>
              Mobalytics build (from sheet): fierce-flame-gpm8td Temporalis / ritual character link on the spreadsheet
            </li>
            <li>Use the Open buttons below for Update (Doryani) · Full Guide · Spreadsheet</li>
          </ul>
        </section>
      </div>

      <div className="lg-footer">
        Source: Gary Peacock spreadsheet + Full Guide (bHY-yGvvpS0) + Update Doryani (lDRd4Io4URA) — nothing
        intentionally omitted from those sources
      </div>
    </div>
  )
}

function TabletPanel({ tab }: { tab: TabletTab }): JSX.Element {
  if (tab === 'cheap') {
    return (
      <div className="lg-card green">
        <div className="lg-card-title">
          Cheap Tablet Setup / Atlas #2 <span className="lg-badge">beginner &lt;1 Divine</span>
        </div>
        <ul>
          <li>
            <b>Waystone:</b> Pack Size as high as possible (T15 pack-size WS is fine to start)
          </li>
          <li>Increased % of Omens</li>
          <li>Increased % of Omens (×2 — bread &amp; butter; aim ≥65% when you can)</li>
          <li>Unique Ritual Tablet (Freedom of Faith)</li>
          <li>Pack Size (sheet lists this on the Cheap column; optional early if budget is tight)</li>
          <li>City maps: optional 3rd Increased % of Omens tablet</li>
          <li>Atlas #2 · snowball gear, then upgrade tablets</li>
          <li>First ~18 maps: expect at least ~2 omens with this kit</li>
          <li>Freedom Unique alone drove a huge share of profit — do not skip it</li>
        </ul>
      </div>
    )
  }
  if (tab === 'middle') {
    return (
      <div className="lg-card green">
        <div className="lg-card-title">
          Middle / Atlas #2 <span className="lg-badge">core ≈80% of all maps</span>
        </div>
        <ul>
          <li>
            Omens% ≥65% + Effectiveness <b>or</b> Pack Size (increases tribute)
          </li>
          <li>
            Omens% ≥65% + Rerolling favors / Ritual Altars cost reduced Tribute (reroll cost often drops from ~1000 →
            ~600–800)
          </li>
          <li>Unique Ritual Tablet (Freedom of Faith) again</li>
          <li>Waystone: more Pack Size for tribute</li>
          <li>Atlas #2 — this is what prints most of your omens</li>
          <li>Spreadsheet “Expensive/2” column is the extract pair; Middle is the acquire workhorse from the video</li>
        </ul>
      </div>
    )
  }
  if (tab === 'expensive') {
    return (
      <div className="lg-card amber">
        <div className="lg-card-title">
          Expensive / 2 — extract <span className="lg-badge">switch at ≥6 omens stuck</span>
        </div>
        <ul>
          <li>Increased % of Omens + Rerolling costs less Tribute</li>
          <li>Increased % of Omens + Rerolling costs less Tribute (sheet lists this twice)</li>
          <li>Unique Ritual Tablet</li>
          <li>Switch when ≥6 omens stuck in ritual (often 9–12) to empty the bank</li>
          <li>Buy / defer every omen until Ritual is empty</li>
          <li>T16 waystone — high Pack Size · pair with Atlas #3 for tribute</li>
          <li>Defer cost −20–30% where the tablet mods allow</li>
        </ul>
      </div>
    )
  }
  return (
    <div className="lg-card red">
      <div className="lg-card-title">
        PLAN B / 3 — Additional Reroll Tablet <span className="lg-badge">Atlas #3</span>
      </div>
      <ul>
        <li>Additional Reroll Tablet (Ritual Altars allow rerolling favors 3 additional times) — ~20–25 Divine</li>
        <li>Increased % of Omens + Rerolling costs less Tribute</li>
        <li>Increased % of Omens + Rerolling costs less Tribute</li>
        <li>Increased % of Omens + Rerolling costs less Tribute (sheet Plan B column)</li>
        <li>
          <b>Verdict:</b> usually overrated — needs ≈2.5 Whittling to pay for itself. Dry streaks wipe the investment.
          HH/MB prices falling make jackpot-justified spend worse.
        </li>
        <li>OK if fully geared + emptying a full omen bank, or for fun when currency is not the bottleneck</li>
        <li>Skip if still gearing / early Mirror farm</li>
      </ul>
    </div>
  )
}

const SINGLE_CSS = `
.lg-root.lg-single {
  max-width: 760px;
  margin: 0 auto;
}
.lg-stack {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.lg-stack > .lg-panel {
  background: var(--surface);
  border: 1px solid var(--border-soft);
  border-radius: 8px;
  padding: 12px 14px;
}
.lg-collapse-btn {
  display: flex; align-items: baseline; gap: 8px; width: 100%;
  margin: 0 0 8px; padding: 0; border: 0; background: transparent;
  color: inherit; cursor: pointer; text-align: left;
}
.lg-collapse-btn .lg-section-title { flex: 1; }
.lg-chevron {
  font-family: Consolas, monospace; color: var(--gold); font-size: 14px; min-width: 14px;
}
.lg-tab-badge {
  margin-left: 6px; font-size: 10px; opacity: 0.75; font-family: Consolas, monospace;
}
.lg-qa-stack { display: flex; flex-direction: column; gap: 8px; }
.lg-panel > ul { margin: 0; padding: 0; list-style: none; }
.lg-panel > ul > li {
  position: relative; padding-left: 12px; margin-bottom: 6px;
  font-size: 13px; color: var(--secondary); line-height: 1.45;
}
.lg-panel > ul > li::before { content: "–"; position: absolute; left: 0; color: var(--muted); }
.lg-panel > ul > li b { color: var(--text); font-weight: 600; }
.lg-note {
  font-size: 12px; color: var(--secondary); margin: 0 0 10px; line-height: 1.45;
}
.lg-note b { color: var(--text); }
`
