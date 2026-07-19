# scpcb-mapgen

[![conformance](https://github.com/Syial/scpcb-mapgen/actions/workflows/ci.yml/badge.svg)](https://github.com/Syial/scpcb-mapgen/actions/workflows/ci.yml)

Deterministic map generator for **SCP: Containment Breach**, ported from the game's Blitz3D source to TypeScript — **bit-exact**.

Enter a seed, get the exact facility the game would generate: main map, maintenance tunnels, SCP-860's forest, and whether the run is finishable at all.

## What it does

- **Trace** — full map for any seed: rooms, zones, layout, plus the maintenance tunnels grid and SCP-860's forest, both seed-accurate.
- **Analyze** — some seeds never generate rooms required to finish the game (`room2ccont` is missing in ~6.3% of seeds). The visualizer detects them.
- **Search** — scan seed ranges for criteria: missing rooms, unfinishable maps, residual room overlaps.
- **Mod mode** — the speedrun mod seeds the RNG with a raw number, reaching seed-space regions the base game's hash never produces. Both modes are supported.

## Accuracy

The port reproduces the generator of Blitz3D v1.108c down to float32 x87 semantics, including engine quirks (loop bounds re-evaluated per iteration, non-short-circuit `Or`, un-normalized angle matrices differing by one ULP).

Verified against ground truth: the game compiled in debug mode, instrumented to dump the raw bits of every room extent it computes. The conformance suite compares bit patterns — a single ULP fails the test.

```
npm test
# ✓ 6 maps, 7321 extents — 100% bit-exact
```

## Run it

```
npm install
npm run dev
```

## Credits & license

This project is a derivative work of [SCP: Containment Breach](https://github.com/Regalis11/scpcb) by Regalis, whose game and source code are licensed under [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). The map generation logic is ported from its source (`MapSystem.bb`, `UpdateEvents.bb`, `Main.bb`), and the forest heightmap data is extracted from the game's assets.

Accordingly, the port and visualizer (by [Syial](https://github.com/Syial)) are released under the same license: **CC BY-SA 3.0**. See [LICENSE](LICENSE).
