# 2026-11-22 — Status check, scraper extension and master sheet

**Chat:** this session (Claude, linked to your computer)

**Asked:** Status of all Adyzio work. Then: the scraper extension ("affiliate-scraper-extension-v1.7.0", with Wishlink profile scraping) should collect product links, convert them to your affiliate links, write them to the Google Sheet, and the plugin should publish them every 15 minutes with the right category, without API keys.

**Found:**
- No Adyzio build work between 4 and 22 Nov. Site live on WordPress, plugin 1.6.0 installed.
- In Downloads: `adyzio-core-1.6.0.zip` and extension 1.3.0 (`affiliate-scraper-extension (2).zip`, same as the unzipped folder). Version 1.7.0 and the Wishlink scraping code were not found.
- The chain already needs no API keys: the extension writes to the sheet through your own Apps Script web app; the plugin reads the sheet through its CSV export link every 15 minutes.

**Done:** Saved plugin 1.6.0 and extension 1.3.0 source to GitHub (v0.5.0). Moved "Adyzio Deals Hub" into Drive › 04 Adyzio › data.

**Decided:** Adyzio Deals Hub is the master sheet. Categories are chosen automatically. Profiles scraped: your own and other creators' (titles and descriptions rewritten before posting).

**Open:** location of extension 1.7.0; 726-category tab in Deals Hub; Wishlink support in the extension.
