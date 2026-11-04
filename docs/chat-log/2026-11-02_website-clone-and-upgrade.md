# 2026-11-02 — Website clone and upgrade

**Chat:** https://claude.ai/chat/4b89b55c-b329-45c9-a1b3-108efd0dcb0b

**Asked:** Study deals.techclick.in and build an upgraded, professional Adyzio deals site using all Adyzio data.

**Done:**
- **Deals page v2** design: store offer cards, product cards with store logos, share buttons, 272-store directory, per-store action buttons. Now in `website/deals-v2/` (v0.3.0).
- **Deal collector** added to the link tool: reads exported Telegram/WhatsApp chats and saved posts into `deals.xlsx`, opens short links, removes other channels' affiliate tags, adds your Amazon tag, de-duplicates; `extrape-out`/`extrape-in` for one-batch ExtraPe conversion; `validate` and `export`. Now in `apps/link-tools/` (v0.2.0).

**Decided:** Amazon prices and images stay in the Excel sheet only and are never sent to the website. Prices older than 1 day are rejected by `validate`. Separate Amazon tracking IDs for the website and for other channels (IDs kept in `private/`).

**Open:** Test the collector with a small real Telegram export and report any `OPEN_SHORT_LINK` rows.
