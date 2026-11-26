# Adyzio promo reel – 26 Nov 2026 (v1)

**File:** `film/final.mp4` · 1080×1920 (9:16) · 30 s · 30 fps · sound: original music + effects, −14.7 LUFS
**Made with:** the motionmaxxing skill on HyperFrames-style HTML (`film/index.html`, editable), Earshot sound effects, music composed in code (`film/audio/compose.py`).

## The one idea
Adyzio's own promise from adyzio.com: *"Every good deal in India, checked before it reaches you."* The verb is **check**. So the film moves from "too many offers, which one is real?" to Adyzio checking. The orange accent means only one thing: "checked". It lights up "check" in the lines, "Check latest price" on the real card and "Prices we checked in the last 24 hours" on the real budget panel.

## Beats (what each one makes the viewer believe)
| Time | Beat | On screen | Buys |
|---|---|---|---|
| 0–3.5 s | Hook | the real adyzio.com page racing past, blurred; "ఇన్ని offers… ఏది నిజమైన deal?" | the viewer feels the problem: too many offers |
| 3.5–8 s | Turn | adyzio logo lands; "ప్రతి deal, మీకు చేరే ముందే check చేస్తాం." | Adyzio is the answer, and its job is checking |
| 8–13.3 s | Proof | real deal card from adyzio.com, magnified; "Amazon, Flipkart, Myntra… అన్నీ ఒకే చోట." → "కొనేది store site లోనే."; finger taps Buy Now | all stores in one place, and you buy on the store's own site |
| 13.3–19.5 s | Proof | real "Shop by budget" panel, the line "Prices we checked in the last 24 hours"; "ధరలు, గత 24 గంటల్లో check చేసినవే." | the prices are fresh, not old copies |
| 19.5–25.5 s | Proof | the site's real join banner copy; "రోజుకు కొన్ని useful picks. No spam."; tap Join Telegram | joining is easy and not spammy |
| 25.5–30 s | CTA | logo, adyzio.com, Telegram @adyzio, WhatsApp Adyzio channel | where to go now |

## What is real and what is rebuilt
- **Real screenshots of adyzio.com** (phone size, taken 26 Nov 2026): the deal card (product name, "Good for", "Check latest price", Buy Now, Share) and the Shop by budget panel.
- **No store product photos are shown** (Adyzio rule): only the parts of cards without photos were used. No store logos.
- **Rebuilt in the site's own colours and fonts:** the adyzio logo (as it appears in the site header), the join banner (its exact English text from the site: "Get loot deals before they sell out…", Join Telegram, Join WhatsApp).
- **Checked live on 26 Nov 2026:** adyzio.com opens; Telegram @adyzio is the channel "Adyzio: India's deal hub"; the Adyzio WhatsApp channel exists. Note: `@adyziodeals` (the name in planner task adz-05) is **not** a channel.
- **No prices, ratings, discounts or numbers were invented.** "Under ₹199 / ₹499 / ₹999 / ₹1,999" are the site's own budget groups, not prices.
- **Sound:** music is original (composed in code: 120 bpm, D major). Effects were made by Earshot. No outside recordings, so there are no licence or credit needs.

## Checks (numbers from the scripts)
- `look.py` (final.mp4): G0 PASS (30.00 s, audio present) · G2 PASS (no run of more than 3 flat frames) · G3 PASS (end hold 0.10 s; final shot 4.53 s = 15 % of the film).
- `lint.mjs` (index.html): G5 PASS (no corner labels, counters, progress bars or slide layouts).
- Audio: integrated −14.7 LUFS, true peak −2.4 dBFS, 5 of 8 cuts land on a sound (62 %).
- G1 (readable proof) and G4 (one hero per frame), judged by eye on `film/look-final/sheet.jpg`: the card and budget shots are magnified so their text is large. At the widest point of the budget shot the small grey line is about 2 % of frame height (under the 4 % goal). The Telugu caption above it says the same thing in large type.

## Frame by frame (one sentence each, from the sheet)
1. Dark indigo; the blurred site scrolls past fast; "ఇన్ని offers…" rises.
2. "ఏది నిజమైన deal?" with "deal?" in orange.
3. Light ground; the adyzio pill logo lands from big to normal.
4. Three Telugu lines under the logo; "check" is orange.
5. Close-up of the real card; "Check latest price" is highlighted orange.
6. The camera pulls back to the whole card with the Buy Now button.
7. A finger dot taps Buy Now; the caption reads "కొనేది store site లోనే."
8. Close-up of "Prices we checked in the last 24 hours", highlighted.
9. The camera pulls back to the four budget tiles.
10. The join banner card rises; "No spam." pops.
11. The finger taps Join Telegram.
12. End: logo, adyzio.com, and the Telegram and WhatsApp buttons, drifting slowly to the last frame.

## What could still be better
- Overall motion is calm (average change 1.3/255; human-made promos are usually 4–10). This suits an honest deals brand, but a punchier cut could add more camera moves.
- The join banner shot (about 16.6–19.5 s) is the stillest stretch.
- There is no voice. A Telugu voiceover would need an ElevenLabs key, or Adithya could record one himself.
- The music is simple, made in code. A licensed track could replace it later: change `--audio` in the render step.

## How to edit and re-render
Change the text in `film/index.html`, then:
```
node ~/.claude/skills/motionmaxxing/scripts/render.mjs film/index.html film/final.mp4 --audio film/audio/mix-14.wav
```
(set `CHROME_PATH` to Chrome first). For sound, change `film/audio/compose.py`, run it, then normalise with ffmpeg loudnorm (see that file's header).
