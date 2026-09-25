# scpcb-mapgen

![conformance](https://github.com/Syial/scpcb-mapgen/actions/workflows/ci.yml/badge.svg)

Deterministic, **bit-exact** map generator for **SCP: Containment Breach**, ported from the game's Blitz3D source to TypeScript.

Enter a seed, get the exact facility the game would generate: main map, maintenance tunnels, and SCP-860's forest. Everything runs in the browser; nothing is sent to a server.

Finishability is checked automatically in Trace and Search - something the game itself never verifies.

## Features

- **Trace** - full map for any seed, seed-accurate: each room with its events, items, code, keycard, zone, and doors, plus the maintenance tunnels grid and SCP-860's forest.
- **Search** - scan seed ranges (millions at a time) with combinable criteria: room present or absent, distance between two rooms, residual overlaps, finishability. Runs in a Web Worker so the UI stays responsive; import/export results to resume a scan later.

## Accuracy

The source describes the algorithm, but not how the compiler resolves floating-point arithmetic at the bit level; that part had to be reverse-engineered from the compiled binary. The port reproduces Blitz3D v1.108c's generator (Lehmer LCG, A=48271, M=2³¹−1) down to float32 x87 semantics, including engine quirks (loop bounds re-evaluated per iteration, non-short-circuit `Or`, un-normalized angle matrices differing by one ULP).

Verified against ground truth: the game compiled in debug mode, instrumented to dump the raw bits of every room extent it computes. The conformance suite compares bit patterns - a single ULP fails the test.

```
npm test
# ✓ 6 maps, 7321 extents - 100% bit-exact
```

## Credits & license

This project is a derivative work of [SCP: Containment Breach](https://github.com/Regalis11/scpcb) by Regalis, whose game and source code are licensed under [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). The map generation logic is ported from its source (`MapSystem.bb`, `UpdateEvents.bb`, `Main.bb`), and the forest heightmap data is extracted from the game's assets.

Accordingly, the port and visualizer (by [Syial](https://github.com/Syial)) are released under **[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)** (a later version of the same license, as permitted by its ShareAlike terms). See [LICENSE](LICENSE).