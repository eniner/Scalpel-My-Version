export const DPS_CSS = `
.sd-root {
  --bg: #0a0a0a;
  --panel: #121212;
  --elevated: #1a1a1a;
  --border: #3a3a3a;
  --border-soft: #2a2a2a;
  --text: #c8c8c8;
  --muted: #8a8a8a;
  --faint: #5a5a5a;
  --rise: #1c9079;
  --fall: #c44b4b;
  --flat: #8a8a8a;
  --rare: #ffff77;
  --unique: #af6025;
  --magic: #8888ff;
  --normal: #c8c8c8;
  --implicit: #88f;
  --mod: #88f;
  --font: 'Fontin', 'Segoe UI', Tahoma, sans-serif;
  --mono: ui-monospace, Consolas, monospace;

  box-sizing: border-box;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  color: var(--text);
  font-family: var(--font);
  font-size: 12.5px;
  line-height: 1.4;
  background: var(--bg);
}
.sd-root *, .sd-root *::before, .sd-root *::after { box-sizing: border-box; }
.sd-root button {
  font: inherit;
  cursor: pointer;
  color: inherit;
  background: transparent;
  border: none;
}
.sd-root input[type="number"],
.sd-root input[type="text"],
.sd-root textarea {
  font: inherit;
  color: var(--text);
  background: #0e0e0e;
  border: 1px solid var(--border);
  border-radius: 2px;
  padding: 5px 8px;
  outline: none;
  width: 100%;
}
.sd-root textarea {
  font-family: var(--mono);
  font-size: 11px;
  resize: vertical;
}
.sd-root input:focus, .sd-root textarea:focus { border-color: #666; }
.sd-root input[type="number"] {
  font-family: var(--mono);
  font-variant-numeric: tabular-nums;
}

.sd-header {
  flex-shrink: 0;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-soft);
  background: #101010;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.sd-title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.sd-title {
  margin: 0;
  font-size: 15px;
  font-weight: 650;
  color: #e8e8e8;
}
.sd-ver {
  margin-left: 8px;
  padding: 1px 7px;
  border: 1px solid var(--border);
  border-radius: 2px;
  font-size: 11px;
  font-weight: 600;
  color: var(--muted);
  vertical-align: middle;
}
.sd-mode {
  display: inline-flex;
  border: 1px solid var(--border);
  overflow: hidden;
}
.sd-mode button {
  padding: 4px 9px;
  font-size: 11px;
  color: var(--muted);
  background: #141414;
}
.sd-mode button.active {
  background: #2a2418;
  color: #e0c070;
}
.sd-sub {
  margin: 2px 0 0;
  color: var(--muted);
  font-size: 11.5px;
}
.sd-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}
.sd-btn {
  display: inline-flex;
  align-items: center;
  padding: 5px 10px;
  border-radius: 2px;
  border: 1px solid var(--border);
  background: #1a1a1a;
  color: var(--text);
}
.sd-btn:hover { background: #242424; border-color: #555; }
.sd-btn-primary {
  background: #2a2418;
  border-color: #6a5a30;
  color: #e0c070;
}
.sd-btn-ghost { background: transparent; }
.sd-status { color: var(--muted); font-size: 11.5px; }
.sd-status-err { color: var(--fall); }
.sd-clip {
  color: #e0c070;
  font-size: 12px;
  font-weight: 600;
}

.sd-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sd-paste {
  background: var(--panel);
  border: 1px solid var(--border);
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.sd-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.sd-card-title {
  margin: 0;
  font-size: 12px;
  font-weight: 650;
}
.sd-paste-area { min-height: 100px; }

.sd-tips {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  align-items: start;
}
@media (max-width: 820px) {
  .sd-tips { grid-template-columns: 1fr; }
}

.sd-tip-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}
.sd-tip-slot {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
}

.sd-tooltip {
  background: linear-gradient(#0c0c0c, #141414);
  border: 1px solid #5a5a5a;
  box-shadow: 0 0 0 1px #000, 0 8px 24px rgba(0,0,0,.55);
  padding: 10px 12px 12px;
  min-height: 220px;
}
.sd-tip-empty {
  color: var(--muted);
  padding: 24px 8px;
  text-align: center;
}
.sd-tip-ready {
  margin-top: 10px;
  color: #e0c070;
  font-weight: 600;
}
.sd-tip-name {
  font-size: 15px;
  font-weight: 700;
  text-align: center;
  line-height: 1.25;
}
.sd-tip-name.rarity-rare, .rarity-rare .sd-tip-name { color: var(--rare); }
.sd-tip-name.rarity-unique, .rarity-unique .sd-tip-name { color: var(--unique); }
.sd-tip-name.rarity-magic, .rarity-magic .sd-tip-name { color: var(--magic); }
.sd-tip-name.rarity-normal { color: var(--normal); }
.sd-tip-base {
  text-align: center;
  color: var(--muted);
  font-size: 12px;
  margin-top: 2px;
}
.sd-tip-rule {
  height: 1px;
  background: #3a3a3a;
  margin: 8px 0;
}
.sd-tip-mod {
  color: #8888ff;
  font-size: 12px;
  padding: 1px 0;
}
.sd-tip-mod.implicit { color: #88f; }
.sd-tip-mod.enchant { color: #b4b4ff; font-style: italic; }
.sd-tip-mod.faint { color: var(--faint); font-style: italic; }
.sd-tip-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  margin-top: 4px;
}
.sd-tip-stats span {
  display: block;
  color: var(--faint);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.sd-tip-stats strong {
  font-family: var(--mono);
  font-weight: 650;
  font-variant-numeric: tabular-nums;
}
.sd-tip-stats strong.dps { color: #e0c070; font-size: 14px; }

.sd-compare {
  background: #101010;
  border: 1px solid var(--border);
  padding: 12px 14px;
}
.sd-compare h3 {
  margin: 0 0 10px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text);
}
.sd-compare h3 em {
  font-style: normal;
  color: var(--rare);
}
.sd-compare ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.sd-compare li {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 3px 0;
  border-bottom: 1px solid #1c1c1c;
  font-size: 12.5px;
}
.sd-compare .lab { color: var(--muted); }
.sd-compare .val {
  font-family: var(--mono);
  font-variant-numeric: tabular-nums;
  font-weight: 650;
}
.sd-compare .val.up { color: var(--rise); }
.sd-compare .val.down { color: var(--fall); }
.sd-compare .val.flat { color: var(--flat); }
.sd-compare-foot {
  margin-top: 10px;
  color: var(--muted);
  font-size: 12px;
}
.sd-compare-foot .up { color: var(--rise); }
.sd-compare-foot .down { color: var(--fall); }

.sd-baseline {
  background: var(--panel);
  border: 1px solid var(--border-soft);
  padding: 8px 10px 10px;
}
.sd-baseline-toggle {
  width: 100%;
  text-align: left;
  color: var(--muted);
  font-size: 12px;
  font-weight: 600;
  padding: 4px 0 8px;
}
.sd-globals-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}
@media (max-width: 900px) {
  .sd-globals-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
.sd-field {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.sd-field label {
  color: var(--muted);
  font-size: 11px;
}
`
