// Floating button on official store pages: one-click affiliate conversion + scrape.
(async function () {
  if (window.top !== window || document.getElementById('__deal_float_host')) return;
  try {
    const { settings } = await chrome.storage.sync.get('settings');
    if (settings && settings.floatingButton === false) return;
  } catch (e) { return; }

  const host = document.createElement('div');
  host.id = '__deal_float_host';
  host.style.cssText = 'position:fixed;z-index:2147483646;right:18px;bottom:90px;';
  const root = host.attachShadow({ mode: 'closed' });
  root.innerHTML = `
    <style>
      * { box-sizing: border-box; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
      .fab { display:flex; align-items:center; gap:6px; background:#2563eb; color:#fff; border:none; border-radius:999px;
             padding:10px 14px; font-size:13px; font-weight:600; cursor:pointer; box-shadow:0 6px 18px rgba(37,99,235,.4); }
      .fab:hover { background:#1d4ed8; }
      .panel { display:none; position:absolute; right:0; bottom:48px; width:320px; background:#fff; color:#111827;
               border-radius:12px; box-shadow:0 12px 32px rgba(0,0,0,.25); padding:14px; font-size:13px; }
      .panel.open { display:block; }
      .row { display:flex; gap:8px; margin-top:10px; }
      button.act { flex:1; border:1px solid #d1d5db; background:#f9fafb; color:#111827; border-radius:8px; padding:8px; cursor:pointer; font-size:12.5px; font-weight:600; }
      button.act.primary { background:#2563eb; border-color:#2563eb; color:#fff; }
      button.act:disabled { opacity:.6; cursor:wait; }
      .title { font-weight:700; font-size:14px; display:flex; justify-content:space-between; align-items:center; }
      .close { background:none; border:none; font-size:18px; cursor:pointer; color:#6b7280; }
      .out { margin-top:10px; padding:8px; background:#eff6ff; border-radius:8px; word-break:break-all; display:none; }
      .out.err { background:#fef2f2; color:#b91c1c; }
      .muted { color:#6b7280; font-size:12px; margin-top:4px; }
    </style>
    <div class="panel" id="panel">
      <div class="title"><span>Affiliate Tools</span><button class="close" id="close">×</button></div>
      <div class="muted" id="store"></div>
      <div class="row">
        <button class="act primary" id="convert">Convert this link</button>
        <button class="act" id="scrape">Scrape page → Excel</button>
      </div>
      <div class="out" id="out"></div>
    </div>
    <button class="fab" id="fab" title="Affiliate link converter">₹ Affiliate</button>
  `;
  document.documentElement.appendChild(host);

  const $ = (id) => root.getElementById(id);
  const out = $('out');
  const show = (html, isErr) => { out.style.display = 'block'; out.className = 'out' + (isErr ? ' err' : ''); out.innerHTML = ''; out.append(...html); };
  const textNode = (t, style) => { const d = document.createElement('div'); d.textContent = t; if (style) d.style.cssText = style; return d; };

  $('store').textContent = location.hostname.replace(/^www\./, '');
  $('fab').addEventListener('click', () => $('panel').classList.toggle('open'));
  $('close').addEventListener('click', () => $('panel').classList.remove('open'));

  $('convert').addEventListener('click', async () => {
    const btn = $('convert');
    btn.disabled = true;
    btn.textContent = 'Converting…';
    try {
      const r = await chrome.runtime.sendMessage({ type: 'convertOne', url: location.href });
      if (r && r.affiliate) {
        try { await navigator.clipboard.writeText(r.affiliate); } catch (e) { /* clipboard blocked */ }
        const copy = document.createElement('button');
        copy.className = 'act';
        copy.textContent = 'Copy';
        copy.style.marginTop = '6px';
        copy.onclick = () => navigator.clipboard.writeText(r.affiliate).then(() => { copy.textContent = 'Copied ✓'; });
        const parts = [textNode(r.affiliate, 'font-weight:600;color:#1d4ed8'), textNode(`${r.method} · copied to clipboard`, 'color:#6b7280;font-size:12px;margin-top:4px')];
        if (r.error) parts.push(textNode(r.error, 'color:#b45309;font-size:12px;margin-top:4px'));
        parts.push(copy);
        show(parts);
      } else {
        show([textNode((r && r.error) || 'Conversion failed')], true);
      }
    } catch (e) {
      show([textNode('Extension was updated – reload this page. (' + e.message + ')')], true);
    }
    btn.disabled = false;
    btn.textContent = 'Convert this link';
  });

  $('scrape').addEventListener('click', async () => {
    try {
      await chrome.runtime.sendMessage({ type: 'scrape' });
      show([textNode('Scraping started. Open the extension icon to follow progress.')]);
    } catch (e) {
      show([textNode('Extension was updated – reload this page.')], true);
    }
  });
})();
