# Changelog

Every version of Adyzio, newest first. Version numbers follow **MAJOR.MINOR.PATCH** (explained in [`docs/HOW-WE-WORK.md`](docs/HOW-WE-WORK.md)).
Each version is also a GitHub tag (`v0.4.0`), so you can download exactly that version from GitHub → Tags.

## v0.4.0 — 2026-11-04 — Project organised across GitHub, computer and Drive
- New folder layout used in all three places (see README folder map).
- Added `VERSION`, this changelog, `docs/HOW-WE-WORK.md` (versioning and sync rules), `docs/PROJECT-STATUS.md`, `docs/DECISIONS.md`.
- Added `docs/chat-log/`: one note for each of the 8 Adyzio chats so far (31 Oct – 4 Nov).
- Added `docs/plans/README.md`, an index of every plan with links to the live Claude Docs and Google Docs.
- Moved `docs/LAUNCH-PLAN.md` → `docs/plans/2026-10-31_launch-plan.md`.
- Added `private/` (kept off GitHub), `content/drafts|published`, `marketing/`, `media/`, `archive/`, `docs/guides/`.

## v0.3.0 — 2026-11-02 — Deals page v2 prototype
- `website/deals-v2/`: deals page design with store offer cards, product cards with store logos, share buttons, per-store action buttons (Buy, Book, Visit, Apply, Get App).
- 272 store logos and `data/extrape-stores.csv` store directory.
- Merged from branch `website-deals-v2` on 2026-11-04.

## v0.2.0 — 2026-11-02 — Deal collector
- Link tool `collect`: reads saved WhatsApp/Telegram/Pinterest/deal-site posts into Excel, removes other channels' affiliate tags, adds yours, de-duplicates.
- `extrape-out` / `extrape-in` for converting links in ExtraPe in one batch.
- Amazon prices and images kept out of the website export.
- `data/affiliate-links/deals-template.xlsx`.
- Merged from branch `deal-collector` on 2026-11-04.

## v0.1.0 — 2026-10-31 — Repository started
- Folder structure and README.
- Launch and implementation plan.
- Link tool: `convert`, `validate`, `export`, `captions`, with tests.
- Category map (20 categories), store list, Link Sheet template.
