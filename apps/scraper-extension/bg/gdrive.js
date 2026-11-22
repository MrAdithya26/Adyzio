// Talks to your Google Apps Script web app (apps-script/Code.gs), which saves images to your
// Drive folder and writes rows to your Google Sheet. No Google sign-in inside the extension.
(function (g) {
  function base64(buffer) {
    const bytes = new Uint8Array(buffer);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(bin);
  }

  function configured(settings) {
    return !!(settings.scriptUrl && /^https:\/\/script\.google(usercontent)?\.com\//.test(settings.scriptUrl.trim()));
  }

  async function call(settings, action, payload) {
    if (!configured(settings)) throw new Error('Apps Script web app URL is missing in Settings.');
    const r = await fetch(settings.scriptUrl.trim(), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, ...payload }),
      redirect: 'follow',
      credentials: 'omit',
    });
    const text = await r.text();
    let j;
    try {
      j = JSON.parse(text);
    } catch (e) {
      if (/accounts\.google\.com|ServiceLogin|Sign in/i.test(text)) {
        throw new Error('The Apps Script web app is not public. Redeploy it with "Who has access: Anyone".');
      }
      throw new Error(`Unexpected reply from Apps Script (HTTP ${r.status}). Check the web app URL.`);
    }
    if (!j.ok) throw new Error(j.error || 'Apps Script error');
    return j;
  }

  g.DealGDrive = { base64, configured, call };
})(self);
