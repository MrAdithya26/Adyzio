// Link finder (1.8.0): walks a product list store by store. You open the right product, it saves the
// product link + affiliate link and moves to the next store / product. State lives in chrome.storage.local "finder".
(function (g) {
  const KEY = 'finder';
  const TEMPLATES = {
    amazon: 'https://www.amazon.in/s?k=', flipkart: 'https://www.flipkart.com/search?q=',
    meesho: 'https://www.meesho.com/search?q=', myntra: 'https://www.myntra.com/', ajio: 'https://www.ajio.com/search/?text=',
  };

  async function get() { return (await chrome.storage.local.get(KEY))[KEY] || null; }
  async function save(f) { f.updatedAt = Date.now(); await chrome.storage.local.set({ [KEY]: f }); return f; }

  function searchUrl(f, it, s) {
    const st = f.stores[s];
    if (it.search[st.name]) return it.search[st.name];
    const t = TEMPLATES[st.name.toLowerCase()];
    return t ? t + encodeURIComponent(it.name).replace(/%20/g, '+') : '';
  }
  function open(it, st) { return !it.aff[st] && !it.skip[st]; }

  // First (item, store) from cur onward that still needs work.
  function seek(f, i, s) {
    for (; i < f.items.length; i++, s = 0) {
      const it = f.items[i];
      for (; s < f.stores.length; s++) if (open(it, f.stores[s].name) && searchUrl(f, it, s)) return { i, s };
    }
    return null;
  }

  function status(f, it) {
    const names = f.stores.map((s) => s.name);
    const got = names.filter((n) => it.aff[n]).length;
    const left = names.filter((n) => !it.aff[n] && !it.skip[n]).length;
    if (!got) return left ? 'Link needed' : (names.some((n) => it.skip[n] === 'skipped') ? 'Skipped' : 'Not on any store');
    return left || names.some((n) => it.skip[n] === 'skipped') ? 'Some links' : 'All links';
  }

  async function goTo(f) {
    const pos = seek(f, f.cur.i, f.cur.s);
    if (!pos) { f.cur = { i: f.items.length, s: 0 }; f.done = true; await save(f); return { done: true }; }
    f.cur = pos; f.done = false;
    const url = searchUrl(f, f.items[pos.i], pos.s);
    let tab = null;
    if (f.tabId) { try { tab = await chrome.tabs.update(f.tabId, { url, active: true }); } catch (e) { tab = null; } }
    if (!tab) { tab = await chrome.tabs.create({ url, active: true }); f.tabId = tab.id; }
    await save(f);
    return { ok: true, i: pos.i, store: f.stores[pos.s].name };
  }

  function target(f) {
    if (!f || f.done || f.cur.i >= f.items.length) return null;
    const it = f.items[f.cur.i];
    return { n: it.n, name: it.name, store: f.stores[f.cur.s].name, index: f.cur.i, total: f.items.length };
  }

  // Is this URL a single product page of the store being searched?
  function isProductPage(url, store) {
    const u = String(url || '');
    switch (store.toLowerCase()) {
      case 'amazon': return /\/(dp|gp\/product|gp\/aw\/d)\/[A-Z0-9]{10}/i.test(u);
      case 'flipkart': return /flipkart\.com\/.+\/p\/itm/i.test(u);
      case 'meesho': return /meesho\.com\/.+\/p\/[a-z0-9]+/i.test(u);
      default: return !/search|[?&](q|k|text)=/i.test(u);
    }
  }

  async function handle(msg, sender, deps) {
    let f = await get();
    switch (msg.type) {
      case 'finderState': {
        const t = target(f);
        const mine = !!(f && sender.tab && sender.tab.id === f.tabId);
        return { active: !!t && mine, target: t, product: t ? isProductPage(msg.url, t.store) : false, last: f && f.last };
      }
      case 'finderGo':
        if (!f) return { error: 'Load a file first.' };
        if (msg.index != null) f.cur = { i: msg.index, s: 0 };
        return goTo(f);
      case 'finderUse': {
        const t = target(f);
        if (!t) return { error: 'Nothing to fill.' };
        if (!isProductPage(msg.url, t.store)) return { error: 'This is not a product page. Open the product first.' };
        const it = f.items[f.cur.i];
        const settings = await deps.getSettings();
        const ctx = deps.converter.newContext();
        let r;
        try { r = await deps.converter.convertOne(msg.url, settings, ctx); } finally { await deps.converter.closeContext(ctx); }
        f = await get(); // conversion may take a while; re-read
        it.product[t.store] = r.clean || msg.url;
        if (r.affiliate && r.affiliate !== r.clean) it.aff[t.store] = r.affiliate;
        if (r.error || !it.aff[t.store]) it.note[t.store] = 'Convert failed: ' + (r.error || 'no affiliate link') + ' (product link saved)';
        else delete it.note[t.store];
        f.items[f.cur.i] = it;
        f.last = { name: it.name, store: t.store, affiliate: it.aff[t.store] || '', error: it.note[t.store] || '' };
        // A failed conversion still counts as visited: mark the store so the walk moves on.
        if (!it.aff[t.store]) it.skip[t.store] = 'failed';
        f.cur.s += 1;
        await save(f);
        const next = await goTo(f);
        return { ok: true, saved: f.last, next };
      }
      case 'finderSkip': {
        if (!target(f)) return { error: 'Nothing to skip.' };
        const it = f.items[f.cur.i];
        if (msg.what === 'product') { f.stores.forEach((x) => { if (!it.aff[x.name] && !it.skip[x.name]) it.skip[x.name] = 'skipped'; }); f.cur = { i: f.cur.i + 1, s: 0 }; }
        else { it.skip[f.stores[f.cur.s].name] = 'not sold'; f.cur.s += 1; }
        await save(f);
        return goTo(f);
      }
      case 'finderBack': {
        if (!f) return { error: 'Load a file first.' };
        let { i, s } = f.cur;
        if (i >= f.items.length) { i = f.items.length - 1; s = f.stores.length - 1; }
        else if (s > 0) s -= 1; else if (i > 0) { i -= 1; s = f.stores.length - 1; }
        const it = f.items[Math.min(i, f.items.length - 1)];
        const st = f.stores[s].name;
        delete it.aff[st]; delete it.skip[st]; delete it.note[st]; delete it.product[st];
        f.cur = { i, s }; f.done = false;
        await save(f);
        return goTo(f);
      }
      case 'finderPause':
        if (f) { f.tabId = null; await save(f); }
        return { ok: true };
    }
    return null;
  }

  g.DealFinder = { handle, status, get, save, TEMPLATES };
})(self);
