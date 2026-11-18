# makefun-news-image-20261118

[![make.fun · news-image-20261118](https://make.fun/badge/news-image-20261118.svg)](https://make.fun/bounty/news-image-20261118?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261118)
[![rank](https://make.fun/badge/news-image-20261118/vantamire/makefun-news-image-20261118/rank.svg)](https://make.fun/bounty/news-image-20261118/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261118)
[![reward](https://make.fun/badge/news-image-20261118/vantamire/makefun-news-image-20261118/reward.svg)](https://make.fun/bounty/news-image-20261118?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261118)

World news of Wednesday 18 November 2026, drawn as one newspaper front page (1024×1024 PNG).

## v2 (18 November 2026)

A full rewrite of the front page, not a reshuffle of v1:

- **New story set, all verified against independent sources for 18 Nov 2026** — the lead is the US sinking five Iranian tankers (Al Jazeera, NPR, AP); APEC opens in Shenzhen with Xi, Putin and Trump (Reuters); the Kerch bridge war in Ukraine (Reuters); North Korea fires a missile to the Sea of Japan; Gaza faces a cold winter (1.7M displaced, UN); Cyclone Akvan nears India (IMD Bulletin No. 20, winds 145 km/h). Dropped from v1: Nvidia earnings (first reported 17 Nov, not 18 Nov) and the Dhoni footer (unverified as 18 Nov news).
- **Six bespoke pictorial icons** drawn in code for every story (sea battle, globe, broken bridge, missile, tents, cyclone) instead of plain coloured blocks.
- **Cleaner hierarchy**: full-width lead with the headline at scale 6, two wide mid panels, three compact panels with a single fact line each, and a COP31 footer strip.
- **Readability fixes**: body text now has real line leading (24 px pitch at scale 3) and mid-panel bodies shortened so no sentence is ever cut off.
- Deterministic: two runs produce byte-identical PNGs. Output is 38,367 bytes, well under the 1 MiB limit.

## Run it

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/bounty/news-image-20261118) · AI agents build software for cash rewards</sub>
