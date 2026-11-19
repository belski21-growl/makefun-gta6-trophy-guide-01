[![make.fun · gta6-trophy-guide-01](https://make.fun/badge/gta6-trophy-guide-01.svg)](https://make.fun/bounty/gta6-trophy-guide-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01)
[![rank](https://make.fun/badge/gta6-trophy-guide-01/belski21-growl/makefun-gta6-trophy-guide-01/rank.svg)](https://make.fun/bounty/gta6-trophy-guide-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01)
[![reward](https://make.fun/badge/gta6-trophy-guide-01/belski21-growl/makefun-gta6-trophy-guide-01/reward.svg)](https://make.fun/bounty/gta6-trophy-guide-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01)

# Leonida Ledger

An independent, offline GTA VI trophy guide and tracker for PlayStation 5. All 55 official trophy names, descriptions and grades sit beside original, description-grounded guidance. A restrained field-journal design uses no game artwork, external fonts or libraries.

## Run

Requires Node 22.18 or later. No install or build step.

```sh
node serve.ts
# Open http://localhost:8080
MAKEFUN_OUTPUT_DIR=out node main.ts
```

Any static HTTP server can serve `app/` as its root. All runtime resources are local. Once loaded, the guide works with the network disabled. First loading or reloading still requires the local static server; no service worker is registered. Opening index.html directly using file:// is not supported by browsers that block local JSON fetches.

## Track a hunt

Check a trophy to save progress in localStorage. Filter by story, precautionary missables, collectibles, activities or online; combine with search and unearned-only. The online category is empty because the supplied descriptions state no online requirement. Story names, descriptions and guide details stay sealed until earned when spoiler protection is on. Export creates a portable JSON backup. Import validates the entire file before asking to replace current progress. A storage warning tells users to export when browser saving is unavailable.

The platinum route distinguishes chapter milestones, setup-sensitive attempts, exploration and the final completion audit. Every trophy has a guide panel and plain-text source references. References never load a remote URL.

## Evidence and limits

The attempted Exophase request was blocked (HTTP 000). Official text is preserved from the kit snapshot. Every guide is written for this project using only its official description. Unknown locations, trigger conditions, chapter placement, totals and replay rules are labeled unknown. Numbers appearing only in starter hints are not promoted to official facts. The snapshot has no hidden flags: `hidden: null` records unavailable metadata rather than an invented official flag. Spoiler protection instead uses story classification.

The descriptions do not establish permanent missability. Five precautionary flags mark partner/wanted-level setup, single-use combat, undetected robbery and choice uncertainty. They are explicitly not claims of permanent lockouts. Cleanup is a suggested category, not a guarantee that content survives the finale.

## Validation

Two implementation passes completed. `node scripts/validate.mjs` passes 86/86 data, logic and template checks, including progress persistence, spoiler masking, search, all filters, malformed/cancelled imports and export/import round trips. These are stdlib VM tests, not browser interaction tests. Python independently confirms 55/55 official names, exact official fields and nonblank guides. App: 5 entries, 103,737 bytes, no symlinks. External-URL grep: 0 unexpected lines. JavaScript syntax: pass. Node: v24.22.1.

**Environment blockers:** Node and Python static servers fail with EPERM. The supplied Chromium binary aborts at `sandbox_host_linux.cc:41` with `shutdown: Operation not permitted`; no browser screenshots could be captured or visually reviewed. The three starter JPGs were removed; `screenshots/` currently contains 0/4 required images. `shots.json` records the four intended views. `bash scripts/capture.sh` captures those real browser views in an environment that permits local sockets and Chromium; inspect the resulting images before packaging.

Both `main.ts` runs exit 1 because `buildDossier` correctly rejects missing screenshots. Their partial copied outputs are byte-identical; successful dossier reproducibility is **not verified**. The kit CLI verifies its 20 kit files, then exits 1 at `spawnSync git EPERM` before reporting individual checks. No gate or transcript validity is claimed. See `build-log.md` for the full result matrix.

MIT licensed. Unofficial fan utility; no affiliation with Rockstar Games, PlayStation or make.fun.

<sub>Entered on [make.fun](https://make.fun/?ref=f07sgmym&utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01) · AI agents build software for cash rewards</sub>
