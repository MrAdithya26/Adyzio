# Changelog

Every version of Adyzio, newest first. Version numbers follow **MAJOR.MINOR.PATCH** (explained in [`docs/HOW-WE-WORK.md`](docs/HOW-WE-WORK.md)).
Each version lists its **commit ID**. To see or download exactly that version, open `https://github.com/MrAdithya26/Adyzio/tree/<commit ID>` and press Code → Download ZIP.

## v0.6.0 — 2026-11-22 — Scraper extension 1.7.0 (Wishlink profiles + dashboard)
Commit: [`bbb7ce1`](https://github.com/MrAdithya26/Adyzio/tree/bbb7ce1)
- `apps/scraper-extension/` updated from 1.3.0 to **1.7.0** (built 18 Nov in another Claude workspace; copied unchanged from `affiliate-scraper-extension-v1.7.0.zip`). The 1.3.0 files stay in git history (commit a19f004) and as `apps/affiliate-scraper-extension-1.3.0.zip` on the computer.
- New in 1.7.0: Wishlink profile → Excel (every product, real store link), Apps Script dashboard for PC and phone (Overview, Platforms, Categories, Products, Add links, Activity), phone Queue processed every 15 minutes, product Status (Scraped → Converted → Live), Live tab, automatic copy of Live products into the Link Sheet tab of Adyzio Deals Hub, access key.
- Found, not fixed yet: plugin 1.6 creates any category name it doesn't know (store categories like "Mobiles & Accessories" would become new main categories), and it would show scraped Amazon prices for 24 hours. Fix planned in Adyzio Core 1.7.0.

## v0.5.0 — 2026-11-22 — Plugin and extension code saved; Deals Hub is the master sheet
Commit: [`a3bad51`](https://github.com/MrAdithya26/Adyzio/tree/a3bad51)
- Added `website/adyzio-core/`: Adyzio Core **1.6.0**, the WordPress plugin running on adyzio.com (homepage, 726 categories, Excel/CSV import, Google Sheet sync every 15 minutes, Rank Math SEO). Copied unchanged from `adyzio-core-1.6.0.zip` (4 Nov). Its own version history is in `website/adyzio-core/readme.txt`.
- Added `apps/scraper-extension/`: Chrome extension "Deal Scraper & Affiliate Converter" **1.3.0** (4 Nov): scrape store pages → Google Sheet via your Apps Script, convert links (Amazon SiteStripe, others via ExtraPe in your logged-in browser). Copied unchanged from `affiliate-scraper-extension (2).zip`.
- Decision: **Adyzio Deals Hub** (Google Sheet) is the master product sheet. Adyzio Link Sheet is kept as history.
- Not yet found: extension 1.7.0 with Wishlink profile scraping.

## v0.4.0 — 2026-11-04 — Project organised across GitHub, computer and Drive
Commit: [`cd64cf4`](https://github.com/MrAdithya26/Adyzio/tree/cd64cf4)
- New folder layout used in all three places (see README folder map).
- Added `VERSION`, this changelog, `docs/HOW-WE-WORK.md` (versioning and sync rules), `docs/PROJECT-STATUS.md`, `docs/DECISIONS.md`.
- Added `docs/chat-log/`: one note for each of the 8 Adyzio chats so far (31 Oct – 4 Nov).
- Added `docs/plans/README.md`, an index of every plan with links to the live Claude Docs and Google Docs.
- Moved `docs/LAUNCH-PLAN.md` → `docs/plans/2026-10-31_launch-plan.md`.
- Added `private/` (kept off GitHub), `content/drafts|published`, `marketing/`, `media/`, `archive/`, `docs/guides/`.

## v0.3.0 — 2026-11-02 — Deals page v2 prototype
Commit: [`8a5f47e`](https://github.com/MrAdithya26/Adyzio/tree/8a5f47e)
- `website/deals-v2/`: deals page design with store offer cards, product cards with store logos, share buttons, per-store action buttons (Buy, Book, Visit, Apply, Get App).
- 272 store logos and `data/extrape-stores.csv` store directory.
- Merged from branch `website-deals-v2` on 2026-11-04.

## v0.2.0 — 2026-11-02 — Deal collector
Commit: [`c21249f`](https://github.com/MrAdithya26/Adyzio/tree/c21249f)
- Link tool `collect`: reads saved WhatsApp/Telegram/Pinterest/deal-site posts into Excel, removes other channels' affiliate tags, adds yours, de-duplicates.
- `extrape-out` / `extrape-in` for converting links in ExtraPe in one batch.
- Amazon prices and images kept out of the website export.
- `data/affiliate-links/deals-template.xlsx`.
- Merged from branch `deal-collector` on 2026-11-04.

## v0.1.0 — 2026-10-31 — Repository started
Commit: [`f8562c0`](https://github.com/MrAdithya26/Adyzio/tree/f8562c0)
- Folder structure and README.
- Launch and implementation plan.
- Link tool: `convert`, `validate`, `export`, `captions`, with tests.
- Category map (20 categories), store list, Link Sheet template.
