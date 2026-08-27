/** Shared chrome — wide spreadsheet-style boards; content is never truncated for fit. */
export const GUIDE_CSS = `
.lg-root {
  --bg: #0B0D10;
  --surface: #12151A;
  --border: #242A32;
  --border-soft: #1C2027;
  --text: #F0F2F5;
  --secondary: #C4C9D2;
  --muted: #8B929E;
  --gold: #E8A33D;
  --green: #5FBF7A;
  --amber: #E8A33D;
  --red: #E0665A;
  --blue: #5B9FD9;
  box-sizing: border-box;
  height: 100%;
  overflow: auto;
  padding: 12px 14px 10px;
  background: var(--bg);
  color: var(--text);
  font-family: Segoe UI, system-ui, sans-serif;
  font-size: 13px;
  line-height: 1.4;
  -webkit-font-smoothing: antialiased;
}
.lg-root *, .lg-root *::before, .lg-root *::after { box-sizing: border-box; }
.lg-header {
  display: flex; justify-content: space-between; align-items: flex-end; gap: 12px;
  padding-bottom: 10px; border-bottom: 1px solid var(--border); margin-bottom: 10px;
}
.lg-header h1 {
  margin: 0 0 3px; font-size: 22px; font-weight: 700; color: var(--gold); letter-spacing: -0.01em;
}
.lg-meta { font-size: 11px; color: var(--secondary); font-family: Consolas, monospace; }
.lg-tags { display: flex; flex-wrap: wrap; gap: 5px; justify-content: flex-end; }
.lg-tag {
  font-family: Consolas, monospace; font-size: 10px; color: var(--secondary);
  border: 1px solid var(--border); border-radius: 3px; padding: 2px 6px;
}
.lg-update {
  background: var(--surface); border: 1px solid var(--border); border-left: 3px solid var(--gold);
  border-radius: 0 6px 6px 0; padding: 10px 12px; margin-bottom: 10px;
}
.lg-update .l1 { font-size: 13px; font-weight: 600; margin-bottom: 3px; }
.lg-update .l2 { font-size: 12px; color: var(--secondary); }
.lg-sheet, .lg-board {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  align-content: start;
}
.lg-sheet > .lg-panel, .lg-board > .lg-panel {
  background: var(--surface);
  border: 1px solid var(--border-soft);
  border-radius: 8px;
  padding: 10px 12px;
}
.lg-sheet > .lg-panel.span-2, .lg-board > .lg-panel.span-2 { grid-column: span 2; }
.lg-sheet > .lg-panel.span-3, .lg-board > .lg-panel.span-3 { grid-column: span 3; }
.lg-fill-body { display: flex; flex-direction: column; gap: 10px; }
.lg-steps.one-col { columns: 1; }
.lg-section-head { display: flex; align-items: baseline; gap: 8px; margin-bottom: 8px; }
.lg-num { font-family: Consolas, monospace; font-size: 11px; color: #C98A2E; }
.lg-section-title {
  font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.02em;
}
.lg-section-title small {
  display: inline; font-size: 11px; font-weight: 400; text-transform: none;
  color: var(--muted); letter-spacing: 0; margin-left: 8px;
}
.lg-grid { display: grid; gap: 8px; }
.lg-grid-2 { grid-template-columns: 1fr 1fr; }
.lg-grid-3 { grid-template-columns: 1fr 1fr 1fr; }
.lg-grid-4 { grid-template-columns: repeat(4, 1fr); }
.lg-card {
  background: rgba(0,0,0,0.22); border: 1px solid var(--border-soft);
  border-left: 3px solid var(--muted); border-radius: 0 6px 6px 0; padding: 8px 10px;
}
.lg-card.green { border-left-color: var(--green); }
.lg-card.red { border-left-color: var(--red); }
.lg-card.amber { border-left-color: var(--amber); }
.lg-card.blue { border-left-color: var(--blue); }
.lg-card-title {
  display: flex; align-items: center; justify-content: space-between; gap: 6px;
  font-size: 12px; font-weight: 700; margin-bottom: 6px;
}
.lg-card.green .lg-card-title { color: var(--green); }
.lg-card.red .lg-card-title { color: var(--red); }
.lg-card.amber .lg-card-title { color: var(--amber); }
.lg-card.blue .lg-card-title { color: var(--blue); }
.lg-badge {
  font-family: Consolas, monospace; font-size: 9px; font-weight: 400;
  padding: 1px 5px; border-radius: 3px; background: rgba(255,255,255,0.06); color: var(--secondary);
}
.lg-card ul, .lg-panel > ul { margin: 0; padding: 0; list-style: none; }
.lg-card li, .lg-panel > ul > li {
  position: relative; padding-left: 12px; margin-bottom: 4px;
  font-size: 12px; color: var(--secondary); line-height: 1.4;
}
.lg-card li:last-child, .lg-panel > ul > li:last-child { margin-bottom: 0; }
.lg-card li::before, .lg-panel > ul > li::before { content: "–"; position: absolute; left: 0; color: var(--muted); }
.lg-card li b, .lg-card .kw, .lg-panel > ul > li b { color: var(--text); font-weight: 600; }
.lg-card .val { font-family: Consolas, monospace; font-size: 11px; color: var(--text); }
.lg-compare {
  background: rgba(0,0,0,0.22); border: 1px solid var(--border-soft); border-radius: 6px;
  padding: 10px 12px; margin-bottom: 8px;
}
.lg-compare-row {
  display: grid; grid-template-columns: 100px 1fr 72px; align-items: center; gap: 10px; margin-bottom: 8px;
}
.lg-compare-row:last-of-type { margin-bottom: 0; }
.lg-compare-label { font-size: 11px; color: var(--secondary); }
.lg-track { height: 7px; background: var(--border-soft); border-radius: 4px; overflow: hidden; }
.lg-fill { height: 100%; border-radius: 4px; }
.lg-fill.d { background: var(--green); }
.lg-fill.j { background: var(--muted); }
.lg-compare-val { font-family: Consolas, monospace; font-size: 11px; text-align: right; }
.lg-legend {
  display: flex; flex-wrap: wrap; gap: 12px; margin-top: 8px; padding-top: 8px;
  border-top: 1px solid var(--border-soft); font-size: 11px; color: var(--secondary);
}
.lg-legend span { display: flex; align-items: center; gap: 5px; }
.lg-dot { width: 7px; height: 7px; border-radius: 2px; flex-shrink: 0; }
.lg-dot.d { background: var(--green); }
.lg-dot.j { background: var(--muted); }
.lg-loop { display: flex; flex-direction: column; gap: 0; }
.lg-loop-item {
  display: flex; gap: 10px; padding: 7px 0; border-bottom: 1px solid var(--border-soft);
  font-size: 12px; color: var(--secondary); line-height: 1.4;
}
.lg-loop-item:last-child { border-bottom: none; }
.lg-loop-num { font-family: Consolas, monospace; color: var(--gold); min-width: 14px; font-weight: 700; }
.lg-loop-item b { color: var(--text); font-weight: 600; }
.lg-tabs { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
.lg-tab {
  font-size: 12px; padding: 5px 11px; border-radius: 4px; border: 1px solid var(--border);
  background: transparent; color: var(--secondary); cursor: pointer;
}
.lg-tab:hover { color: var(--text); border-color: var(--muted); }
.lg-tab.on { background: var(--gold); color: #0B0D10; border-color: var(--gold); font-weight: 700; }
.lg-steps { margin: 0; padding-left: 18px; }
.lg-steps li { margin-bottom: 6px; color: var(--secondary); font-size: 12px; line-height: 1.4; }
.lg-steps li::marker { color: var(--gold); font-weight: 700; }
.lg-footer {
  margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--border);
  font-size: 10px; color: var(--muted); font-family: Consolas, monospace;
}
.lg-note {
  font-size: 12px; color: var(--secondary); margin-bottom: 8px; line-height: 1.4;
}
.lg-note b { color: var(--text); }
.lg-fill-body { display: flex; flex-direction: column; gap: 10px; }
@media (max-width: 1100px) {
  .lg-sheet { grid-template-columns: 1fr 1fr; }
  .lg-sheet > .lg-panel.span-2, .lg-sheet > .lg-panel.span-3 { grid-column: span 2; }
  .lg-grid-4 { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 720px) {
  .lg-sheet { grid-template-columns: 1fr; }
  .lg-sheet > .lg-panel.span-2, .lg-sheet > .lg-panel.span-3 { grid-column: span 1; }
  .lg-grid-2, .lg-grid-3, .lg-grid-4 { grid-template-columns: 1fr; }
}
` as const
