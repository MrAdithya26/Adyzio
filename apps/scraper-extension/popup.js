const $ = (id) => document.getElementById(id);
const send = (msg) => chrome.runtime.sendMessage(msg);
let currentTab = null;
let pageScrapable = true;

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function showResult(box, r) {
  box.classList.remove('hidden', 'err');
  box.innerHTML = '';
  if (r && r.affiliate) {
    box.append(el('div', 'link', r.affiliate));
    box.append(el('div', 'meta', `${r.store || ''} · ${r.method}`));
    if (r.error) box.append(el('div', 'note', r.error));
    const copy = el('button', 'btn', 'Copy link');
    copy.onclick = async () => { await navigator.clipboard.writeText(r.affiliate); copy.textContent = 'Copied ✓'; };
    box.append(copy);
  } else {
    box.classList.add('err');
    box.textContent = (r && r.error) || 'Conversion failed';
  }
}

function renderState(state) {
  const { status, job, busy } = state || {};
  // Option 2 info
  if (job) {
    const when = new Date(job.createdAt).toLocaleString('en-IN');
    $('jobInfo').textContent = `${job.count} product(s) from ${job.store} · scraped ${when}` + (job.convertedAt ? ' · links converted ✓' : '');
    const pending = job.count - (job.converted || 0);
    $('convertJobBtn').textContent = job.converted && pending > 0
      ? `Convert remaining ${pending} link(s)`
      : `Convert ${job.count} scraped link(s)`;
    if (job.converted && pending > 0) $('jobInfo').textContent += ` · ${job.converted} converted, ${pending} left`;
  }
  $('convertJobBtn').disabled = !job || busy;
  $('redownloadBtn').disabled = !job || busy;
  $('scrapeBtn').disabled = !!busy || !pageScrapable;
  $('queueBtn').disabled = !!busy;
  $('wishlinkExport').disabled = !!busy;
  $('wishlinkExportAff').disabled = !!busy;

  if (!status) return;
  const card = $('statusCard');
  card.classList.remove('hidden');
  const line = $('statusText');
  line.textContent = status.phase || '';
  line.parentElement.className = 'status-line' + (status.state === 'done' ? ' ok' : status.state === 'error' ? ' err' : status.state === 'stopped' ? ' stopped' : '');
  const stopBtn = $('stopBtn');
  const running = status.state === 'running' && busy;
  stopBtn.classList.toggle('hidden', !running);
  if (running && !/^Stopping/.test(status.phase || '')) { stopBtn.disabled = false; stopBtn.textContent = "■ Stop & download what's done"; }
  const prog = $('progress');
  if (status.state === 'running') {
    prog.classList.remove('hidden');
    const pct = status.total ? Math.round((status.done / status.total) * 100) : 15;
    $('progressBar').style.width = pct + '%';
  } else {
    prog.classList.add('hidden');
  }
  const w = $('warnings');
  w.innerHTML = '';
  (status.warnings || []).forEach((x) => w.append(el('li', null, x)));
  const links = $('statusLinks');
  links.innerHTML = '';
  if ((status.state === 'done' || status.state === 'stopped') && status.links) {
    const add = (href, label) => { const a = el('a', null, label); a.href = href; a.target = '_blank'; links.append(a); };
    if (status.links.driveLink) add(status.links.driveLink, '📄 Open Excel in Google Drive');
    if (status.links.imagesFolder) add(status.links.imagesFolder, '🖼 Open product images folder');
    if (status.links.sheetLink) add(status.links.sheetLink, '📊 Open Google Sheet');
    if (status.links.downloaded) links.append(el('div', 'muted small', `⬇ Saved to Downloads/DealScraper/${status.links.downloaded}`));
  }
}

async function refresh() {
  try { renderState(await send({ type: 'getState' })); } catch (e) { /* worker waking up */ }
}

async function init() {
  const settings = await DealSettings.getSettings();
  $('tAutoScroll').checked = !!settings.autoScroll;
  $('tUploadImages').checked = !!settings.uploadImages;
  $('tAutoScroll').onchange = (e) => DealSettings.saveSettings({ autoScroll: e.target.checked });
  $('tUploadImages').onchange = (e) => DealSettings.saveSettings({ uploadImages: e.target.checked });

  // Batch fields (saved as you type, used by the next scrape).
  const { batchDefaults = {} } = await chrome.storage.local.get('batchDefaults');
  const batchInputs = [...document.querySelectorAll('[data-batch]')];
  batchInputs.forEach((i) => {
    i.value = batchDefaults[i.dataset.batch] || '';
    i.oninput = () => {
      const v = {};
      batchInputs.forEach((x) => { v[x.dataset.batch] = x.value; });
      chrome.storage.local.set({ batchDefaults: v });
    };
  });
  if (batchInputs.some((i) => i.value)) document.querySelector('.batch').open = true;
  $('clearBatch').onclick = () => { batchInputs.forEach((i) => { i.value = ''; }); chrome.storage.local.set({ batchDefaults: {} }); };

  const missing = [];
  if (!settings.scriptUrl || !settings.imagesFolderLink || !settings.sheetLink) missing.push('Google Drive/Sheet links');
  if (!settings.amazonTag) missing.push('Amazon tag');
  if (missing.length) {
    const w = $('setupWarn');
    w.classList.remove('hidden');
    w.append(`Setup needed: ${missing.join(', ')}. `);
    const a = el('a', null, 'Open settings');
    a.href = '#';
    a.onclick = (e) => { e.preventDefault(); chrome.runtime.openOptionsPage(); };
    w.append(a);
  }

  [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = (currentTab && currentTab.url) || '';
  const store = DealStores.detectStore(url);
  $('storeBadge').textContent = store.id === 'other' ? 'Other site' : store.name;
  $('pageUrl').textContent = url;
  $('pageUrl').title = url;
  pageScrapable = /^https?:/.test(url);
  if (!pageScrapable) {
    $('convertPage').disabled = true;
    $('scrapeBtn').disabled = true;
  }

  $('openSettings').onclick = () => chrome.runtime.openOptionsPage();

  $('convertPage').onclick = async () => {
    const btn = $('convertPage');
    btn.disabled = true;
    btn.textContent = 'Converting…';
    const r = await send({ type: 'convertOne', url });
    showResult($('pageResult'), r);
    if (r && r.affiliate) { try { await navigator.clipboard.writeText(r.affiliate); } catch (e) { /* ignore */ } }
    btn.disabled = false;
    btn.textContent = 'Convert this page link';
  };

  $('scrapeBtn').onclick = async () => {
    $('scrapeBtn').disabled = true;
    await send({ type: 'scrape', tabId: currentTab.id });
    setTimeout(refresh, 300);
  };

  $('convertJobBtn').onclick = async () => {
    $('convertJobBtn').disabled = true;
    await send({ type: 'convertJob' });
    setTimeout(refresh, 300);
  };

  // Wishlink profiles: prefill with the open profile, remember what was typed.
  const { wishlinkProfiles = '' } = await chrome.storage.local.get('wishlinkProfiles');
  const onWishlinkProfile = store.id === 'wishlink' && !/\/share\//i.test(url);
  $('wishlinkIn').value = wishlinkProfiles || (onWishlinkProfile ? url : '');
  if (onWishlinkProfile && wishlinkProfiles && !wishlinkProfiles.includes(url.split('?')[0])) {
    $('wishlinkIn').value = `${url.split('?')[0]}\n${wishlinkProfiles}`;
  }
  if (onWishlinkProfile) $('wishlinkCard').parentNode.insertBefore($('wishlinkCard'), $('setupWarn').nextSibling);
  $('wishlinkIn').oninput = () => chrome.storage.local.set({ wishlinkProfiles: $('wishlinkIn').value });
  const startWishlink = async (withAffiliate) => {
    const profiles = $('wishlinkIn').value.split(/[\s,]+/).map((x) => x.trim()).filter(Boolean);
    if (!profiles.length) { $('wishlinkIn').focus(); return; }
    chrome.storage.local.set({ wishlinkProfiles: $('wishlinkIn').value });
    $('wishlinkExport').disabled = true;
    $('wishlinkExportAff').disabled = true;
    await send({ type: 'wishlinkExport', profiles, withAffiliate });
    setTimeout(refresh, 300);
  };
  $('wishlinkExport').onclick = () => startWishlink(false);
  $('wishlinkExportAff').onclick = () => startWishlink(true);

  $('redownloadBtn').onclick = () => send({ type: 'redownload' });
  $('stopBtn').onclick = async () => {
    $('stopBtn').disabled = true;
    $('stopBtn').textContent = 'Stopping…';
    await send({ type: 'stopJob' });
    setTimeout(refresh, 300);
  };
  $('openDash').onclick = () => {
    if (!settings.scriptUrl) return chrome.runtime.openOptionsPage();
    chrome.tabs.create({ url: settings.scriptUrl.trim() });
  };
  $('queueBtn').onclick = async () => {
    $('queueBtn').disabled = true;
    await send({ type: 'processQueue' });
    setTimeout(refresh, 300);
  };
  send({ type: 'queueInfo' }).then((q) => {
    if (!q || !q.ready) return;
    $('queueRow').classList.remove('hidden');
    $('queueText').textContent = q.count ? `📱 Phone queue: ${q.count} link(s) waiting` : '📱 Phone queue is empty';
    $('queueBtn').textContent = q.count ? 'Process' : 'Check again';
  }).catch(() => {});
  $('openExtrapeBtn').onclick = () => chrome.tabs.create({ url: settings.extrapeConverterUrl || DealSettings.BUILT_IN_EXTRAPE_URL });
  $('finderBtn').onclick = () => chrome.tabs.create({ url: chrome.runtime.getURL('finder.html') });
  $('uploadFileBtn').onclick = () => chrome.tabs.create({ url: chrome.runtime.getURL('convert-file.html') });

  $('bulkBtn').onclick = async () => {
    const text = $('bulkIn').value.trim();
    if (!text) return;
    const btn = $('bulkBtn');
    btn.disabled = true;
    btn.textContent = 'Converting…';
    const r = await send({ type: 'convertText', text });
    $('bulkOutWrap').classList.remove('hidden');
    if (r && r.text != null) {
      const failed = (r.results || []).filter((x) => !x.affiliate).length;
      $('bulkOut').value = r.text + (failed ? `\n\n⚠ ${failed} link(s) not converted: ` + r.results.filter((x) => !x.affiliate).map((x) => x.error).join('; ') : '');
    } else {
      $('bulkOut').value = (r && r.error) || 'Failed';
    }
    btn.disabled = false;
    btn.textContent = 'Convert all links in text';
  };
  $('bulkCopy').onclick = async () => {
    const v = $('bulkOut').value.split('\n\n⚠')[0];
    await navigator.clipboard.writeText(v);
    $('bulkCopy').textContent = 'Copied ✓';
  };

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && (changes.jobStatus || changes.lastJob)) refresh();
  });
  refresh();
}

init();
