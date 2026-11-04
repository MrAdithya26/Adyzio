# 2026-10-31 — Telegram auto-forward link converter

**Chat:** https://claude.ai/chat/36e8378d-c68d-49d1-9e6b-c3e0be40674a

**Asked:** Watch deal channels, send each post to the ExtraPe converter bot, and auto-post the converted deal to the Adyzio channel.

**Done:** Built a Telethon script with settings template, requirements and README: removes source branding, keeps only real store links, de-duplicates, skips any deal not fully converted, and has a dry-run mode.

**Decided:** Never run automation on your main Telegram account. Use a BotFather bot (admin of the Adyzio channel) for posting, and a second account on a separate SIM only if reading channels is needed. Check whether ExtraPe allows its converter bot from a second Telegram login.

**Open:** If you logged in with your main account while testing, delete the session file and end that device session in Telegram.

**Code:** The script was delivered as files in that chat and is not in GitHub yet.
