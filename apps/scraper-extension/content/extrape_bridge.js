// Runs inside the ExtraPe converter page. Pastes one link, presses Convert, and returns the new link.
// Uses your logged-in ExtraPe session. Selectors can be overridden in Settings if ExtraPe changes its page.
(function () {
  if (window.__extrapeConvert) return;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const URL_RE = /https?:\/\/[^\s"'<>\\)]+/g;

  const visible = (el) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const st = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none';
  };

  function pick(sel) {
    if (!sel) return null;
    try { return [...document.querySelectorAll(sel)].find(visible) || document.querySelector(sel); } catch (e) { return null; }
  }

  function findInput(cfg) {
    const chosen = pick(cfg.input);
    if (chosen) return chosen;
    const fields = [...document.querySelectorAll('textarea, input[type="url"], input[type="text"], input:not([type]), [contenteditable="true"]')]
      .filter(visible)
      .filter((el) => !el.readOnly && !el.disabled);
    const hinted = fields.filter((el) => /link|url|paste|text|deal/i.test(
      (el.getAttribute('placeholder') || '') + ' ' + (el.getAttribute('name') || '') + ' ' + (el.getAttribute('aria-label') || '') + ' ' + (el.id || '')
    ));
    const pool = hinted.length ? hinted : fields.filter((el) => el.tagName === 'TEXTAREA');
    pool.sort((a, b) => b.offsetWidth * b.offsetHeight - a.offsetWidth * a.offsetHeight);
    return pool[0] || null;
  }

  function findButton(cfg, input) {
    const chosen = pick(cfg.button);
    if (chosen) return chosen;
    const all = [...document.querySelectorAll('button, [role="button"], input[type="submit"], input[type="button"], a')]
      .filter(visible)
      .filter((b) => /convert|generate|make\s*link|earn|get\s*link|create\s*link/i.test((b.innerText || b.value || b.getAttribute('aria-label') || '').trim()));
    if (!all.length) return null;
    // Prefer the button that sits closest to the input box.
    const ir = input.getBoundingClientRect();
    all.sort((a, b) => {
      const ar = a.getBoundingClientRect();
      const br = b.getBoundingClientRect();
      return Math.hypot(ar.x - ir.x, ar.y - ir.y) - Math.hypot(br.x - ir.x, br.y - ir.y);
    });
    return all[0];
  }

  function setValue(el, value) {
    el.focus();
    if (el.isContentEditable) {
      el.textContent = value;
    } else {
      const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
      setter.call(el, value); // works with React-controlled inputs
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function pageUrls(outputSel) {
    const urls = [];
    const add = (s) => { (String(s || '').match(URL_RE) || []).forEach((u) => urls.push(u.replace(/[.,;]+$/, ''))); };
    if (outputSel) {
      try {
        document.querySelectorAll(outputSel).forEach((el) => { add(el.value); add(el.innerText); add(el.getAttribute('href')); });
      } catch (e) { /* bad selector */ }
      return urls;
    }
    document.querySelectorAll('textarea, input').forEach((el) => add(el.value));
    document.querySelectorAll('a[href]').forEach((a) => add(a.href));
    add(document.body.innerText);
    return urls;
  }

  const sameProduct = (a, b) => {
    const norm = (u) => u.replace(/^https?:\/\/(www\.|m\.)?/, '').replace(/[?#].*$/, '').replace(/\/$/, '');
    return norm(a) === norm(b);
  };

  window.__extrapeConvert = async function (url, cfg) {
    cfg = cfg || {};
    const input = findInput(cfg);
    if (!input) {
      const loginHint = /log\s*in|sign\s*in|otp/i.test(document.body.innerText) ? ' It looks like you are not logged in to ExtraPe.' : '';
      return { ok: false, error: 'Could not find the ExtraPe link box on ' + location.href + '.' + loginHint + ' Set the converter page URL / selectors in Settings.' };
    }
    const before = new Set(pageUrls(cfg.output));
    setValue(input, '');
    await sleep(150);
    setValue(input, url);
    await sleep(300);
    const btn = findButton(cfg, input);
    if (btn) {
      btn.click();
    } else {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
      const form = input.closest('form');
      if (form) form.requestSubmit ? form.requestSubmit() : form.submit();
    }

    const deadline = Date.now() + (cfg.timeoutMs || 25000);
    while (Date.now() < deadline) {
      await sleep(500);
      const fresh = pageUrls(cfg.output).filter((u) => !before.has(u) && u !== url && !sameProduct(u, url));
      if (fresh.length) {
        // Prefer short/affiliate-looking links over anything else that appeared.
        const preferred = fresh.find((u) => /extp|extrape|fkrt|myntr|ajiio|bit\.ly|amzn|wishlink|ekaro|earnkaro|clnk|linkredirect|tinyurl/i.test(u));
        return { ok: true, link: preferred || fresh[0] };
      }
    }
    return { ok: false, error: 'ExtraPe did not return a link in time (are you logged in? is this the converter page?)' };
  };
})();
