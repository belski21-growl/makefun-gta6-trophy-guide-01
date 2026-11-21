[![make.fun · gta6-trophy-guide-01](https://make.fun/badge/gta6-trophy-guide-01.svg)](https://make.fun/bounty/gta6-trophy-guide-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01)
[![rank](https://make.fun/badge/gta6-trophy-guide-01/belski21-growl/makefun-gta6-trophy-guide-01/rank.svg)](https://make.fun/bounty/gta6-trophy-guide-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01)
[![reward](https://make.fun/badge/gta6-trophy-guide-01/belski21-growl/makefun-gta6-trophy-guide-01/reward.svg)](https://make.fun/bounty/gta6-trophy-guide-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01)

# Leonida Ledger

An independent GTA VI trophy tracker for PlayStation 5 with all 55 trophies and an original guide for each. Track progress by trophy or activity, see what to tackle next, and use the missables watchlist before moving the story forward.

## Run locally

Use Node.js 22.18 or later. No install or build step is needed.

```sh
node serve.ts
```

Open http://localhost:8080. You can also serve `app/` with any static HTTP server. The guide uses local assets and data, so it needs no internet connection once served.

## Track your platinum

Progress is saved in your browser. Use Export to back it up as JSON and Import to restore it. Keep spoiler protection on to hide story mission names in the roadmap. Turn it off when you want to read the full route.

The six stages show earned progress for each group of trophies. PowerPyx and GTABase estimate about 200 hours in one playthrough. Each pair of cards shares one PowerPyx estimate: 60–80 hours for story and early tasks, about 100 hours for completion, and about 10 hours for cleanup.

Action counters (meditations, stunts, challenges and five more) are interactive: tap −/+ in the trophy detail to log progress, and the count shows in the checklist row too. The header shows the full PSN Points total (1,230) next to the grade split.

## Sources and checks

The official trophy fields come from the kit snapshot. Live sources were read on November 20–21, 2026 — 20 sources across 19 sites, listed in full in the Sources tab with the date each was read and how many of the 55 guides cite it. The guide records source references next to the relevant advice. [PowerPyx](https://www.powerpyx.com/gta-6-grand-theft-auto-vi-trophy-guide-roadmap/) · [GTABase](https://www.gtabase.com/articles/gta-6/gta-6-achievements-trophies-list-ps5-xbox-series) · [GmTreks](https://gmtreks.com/gta6/page/01M7QVDV9V6SV9W03RH60W1P4B)

- `node scripts/validate.mjs` passed 98/98 checks.
- `node scripts/validate.mjs --require-live-sources` passed 99/99 checks, with live source coverage for all 55 trophies.
- The guide ships four screenshots in `screenshots/` and `main.ts` exited with status 0.

MIT licensed. Independent fan project. [make.fun bounty](https://make.fun/bounty/gta6-trophy-guide-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01)

<sub>Entered on [make.fun](https://make.fun/?ref=f07sgmym&utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01) · AI agents build software for cash rewards</sub>
