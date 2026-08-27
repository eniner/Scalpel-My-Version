export const DEALS_CSS = `
.sd-root {
  box-sizing: border-box;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  color: var(--text, #e0d8cc);
  font-family: var(--font-ui, 'Segoe UI', system-ui, sans-serif);
  font-size: 12.5px;
  line-height: 1.45;
  background: var(--bg, #171821);
}
.sd-root *, .sd-root *::before, .sd-root *::after { box-sizing: border-box; }
.sd-root button {
  font: inherit; cursor: pointer; color: inherit;
  background: var(--bg-card, #23232e); border: 1px solid var(--border, rgba(56,56,77,.5));
  border-radius: 6px; padding: 6px 10px;
}
.sd-root button:hover { background: var(--bg-hover, #2c2c3a); }
.sd-root button.primary {
  background: color-mix(in srgb, var(--accent, #c8a96e) 22%, var(--bg-card, #23232e));
  border-color: color-mix(in srgb, var(--accent, #c8a96e) 45%, transparent);
  color: var(--accent-hover, #e0bd7b);
}
.sd-root button.danger { border-color: color-mix(in srgb, var(--danger, #ef5350) 50%, transparent); color: var(--danger, #ef5350); }
.sd-root button:disabled { opacity: .45; cursor: default; }
.sd-root input, .sd-root select, .sd-root textarea {
  font: inherit; color: inherit; background: var(--bg-card, #23232e);
  border: 1px solid var(--border, rgba(56,56,77,.5)); border-radius: 6px; padding: 6px 8px; width: 100%;
}
.sd-root textarea { min-height: 54px; resize: vertical; }
.sd-root label { display: flex; flex-direction: column; gap: 4px; color: var(--text-dim, #9e9480); font-size: 11px; }

.sd-banner {
  flex-shrink: 0;
  padding: 8px 12px;
  background: color-mix(in srgb, var(--warn, #e67e22) 14%, var(--bg-card, #23232e));
  border-bottom: 1px solid var(--border, rgba(56,56,77,.5));
  color: var(--text, #e0d8cc);
  font-size: 11.5px;
}
.sd-banner strong { color: var(--accent, #c8a96e); }

.sd-header {
  flex-shrink: 0;
  padding: 10px 12px 0;
  border-bottom: 1px solid var(--border, rgba(56,56,77,.5));
}
.sd-title { margin: 0; font-size: 15px; font-weight: 600; }
.sd-sub { margin: 2px 0 8px; color: var(--text-dim, #9e9480); font-size: 11px; }
.sd-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 8px; }
.sd-tabs { display: flex; gap: 2px; }
.sd-tab { border-radius: 6px 6px 0 0; background: transparent; border: 0; color: var(--text-dim, #9e9480); }
.sd-tab.active { background: var(--bg-card, #23232e); color: var(--text, #e0d8cc); }

.sd-body { flex: 1; min-height: 0; overflow: auto; padding: 12px; display: flex; flex-direction: column; gap: 10px; }
.sd-status { font-size: 11px; color: var(--text-dim, #9e9480); }
.sd-status.err { color: var(--danger, #ef5350); }

.sd-card {
  background: var(--bg-card, #23232e);
  border: 1px solid var(--border, rgba(56,56,77,.5));
  border-radius: 8px; padding: 10px 12px;
}
.sd-card h3 { margin: 0 0 6px; font-size: 13px; }
.sd-meta { color: var(--text-dim, #9e9480); font-size: 11px; }
.sd-alert-top { display: flex; justify-content: space-between; gap: 8px; align-items: baseline; }
.sd-price { color: var(--match, #4caf50); font-weight: 600; }
.sd-pct { font-variant-numeric: tabular-nums; }
.sd-actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.sd-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 8px; }
.sd-form { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.sd-form .wide { grid-column: 1 / -1; }
.sd-watch-list { display: flex; flex-direction: column; gap: 6px; }
.sd-watch-row {
  display: flex; gap: 8px; align-items: center; text-align: left; width: 100%;
  padding: 8px 10px;
}
.sd-watch-row.active { outline: 1px solid var(--accent, #c8a96e); }
.sd-empty { color: var(--text-dim, #9e9480); padding: 18px 8px; text-align: center; }
.sd-mod-row { display: grid; grid-template-columns: 1fr 70px 72px 28px; gap: 6px; align-items: center; margin-bottom: 6px; }
.sd-note { color: var(--text-dim, #9e9480); font-size: 11.5px; }

.sd-listing {
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr) auto;
  gap: 10px;
  align-items: start;
}
.sd-listing-icon {
  width: 48px;
  height: 48px;
  object-fit: contain;
  background: rgba(0, 0, 0, .28);
  border-radius: 6px;
  flex-shrink: 0;
}
.sd-listing-icon.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-dim, #9e9480);
  font-size: 9px;
  text-align: center;
  padding: 4px;
}
.sd-listing-name { margin: 0; font-size: 13px; font-weight: 600; }
.sd-listing-base { color: var(--text-dim, #9e9480); font-size: 11px; }
.sd-listing-mods { margin: 4px 0 0; font-size: 11px; color: var(--text-dim, #9e9480); }
.sd-listing-mods div { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sd-seller { font-size: 11.5px; margin-top: 4px; }
.sd-seller.on { color: var(--accent, #c8a96e); }
.sd-seller.off { color: var(--text-dim, #9e9480); }
.sd-listing-side { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
`