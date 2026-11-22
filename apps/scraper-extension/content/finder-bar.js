// Link finder bar: shown only in the tab the Link finder opened.
(function () {
  if (window.top !== window || document.getElementById('__adz_finder_host')) return;
  let host, root, lastUrl = '';

  function build() {
    host = document.createElement('div');
    host.id = '__adz_finder_host';
    host.style.cssText = 'position:fixed;z-index:2147483647;left:50%;transform:translateX(-50%);top:8px;';
    root = host.attachShadow({ mode: 'closed' });
    root.innerHTML = `
      <style>
        * { box-sizing:border-box; font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif; }
        .bar { background:#111827; color:#fff; border-radius:12px; padding:10px 12px; box-shadow:0 8px 24px rgba(0,0,0,.35);
               display:flex; gap:8px; align-items:center; font-size:13px; max-width:94vw; flex-wrap:wrap; }
        .what { font-weight:700; } .hint { color:#9ca3af; font-size:12px; width:100%; }
        button { border:none; border-radius:8px; padding:7px 10px; font-weight:600; font-size:12.5px; cursor:pointer; }
        .use { background:#16a34a; color:#fff; } .use:disabled { background:#374151; color:#9ca3af; cursor:not-allowed; }
        .sec { background:#374151; color:#fff; } .msg { width:100%; font-size:12px; }
        .ok { color:#86efac; } .err { color:#fca5a5; }
      </style>
      <div class="bar">
        <span class="what" id="what"></span>
        <button class="use" id="use">✓ Use this product</button>
        <button class="sec" id="notSold" title="This store doesn't sell it">Not sold here</button>
        <button class="sec" id="skip" title="Skip this product on every store">Skip product</button>
        <button class="sec" id="back" title="Redo the previous store">↶ Back</button>
        <button class="sec" id="pause">Pause</button>
        <span class="hint" id="hint"></span>
        <span class="msg" id="msg"></span>
      </div>`;
    document.documentElement.appendChild(host);
    const $ = (id) => root.getElementById(id);
    const send = async (m, label) => {
      $('msg').className = 'msg'; $('msg').textContent = label;
      root.querySelectorAll('button').forEach((b) => (b.disabled = true));
      try {
        const r = await chrome.runtime.sendMessage(m);
        if (r && r.error) { $('msg').className = 'msg err'; $('msg').textContent = r.error; refresh(); }
      } catch (e) { $('msg').className = 'msg err'; $('msg').textContent = 'Extension was updated – reload this page.'; }
    };
    $('use').onclick = () => send({ type: 'finderUse', url: location.href }, 'Making the affiliate link…');
    $('notSold').onclick = () => send({ type: 'finderSkip', what: 'store' }, 'Moving to the next store…');
    $('skip').onclick = () => send({ type: 'finderSkip', what: 'product' }, 'Moving to the next product…');
    $('back').onclick = () => send({ type: 'finderBack' }, 'Going back…');
    $('pause').onclick = async () => { await chrome.runtime.sendMessage({ type: 'finderPause' }); host.remove(); };
  }

  async function refresh() {
    let st;
    try { st = await chrome.runtime.sendMessage({ type: 'finderState', url: location.href }); } catch (e) { return; }
    if (!st || !st.active) { if (host) host.style.display = 'none'; return; }
    if (!host) build();
    host.style.display = '';
    const $ = (id) => root.getElementById(id);
    const t = st.target;
    $('what').textContent = `#${t.n} ${t.name} → ${t.store}  (${t.index + 1}/${t.total})`;
    root.querySelectorAll('button').forEach((b) => (b.disabled = false));
    $('use').disabled = !st.product;
    $('hint').textContent = st.product
      ? 'Is this the same product as the reel? Then press Use this product.'
      : `Click the matching product in the ${t.store} results (open it in this tab).`;
    if (st.last && !$('msg').dataset.shown) {
      $('msg').dataset.shown = '1';
      $('msg').className = 'msg ' + (st.last.error ? 'err' : 'ok');
      $('msg').textContent = st.last.error ? `${st.last.name} – ${st.last.store}: ${st.last.error}` : `Saved ${st.last.name} – ${st.last.store}: ${st.last.affiliate}`;
    }
  }

  refresh();
  // Stores like Flipkart and Meesho change pages without reloading.
  setInterval(() => { if (location.href !== lastUrl) { lastUrl = location.href; refresh(); } }, 800);
})();
