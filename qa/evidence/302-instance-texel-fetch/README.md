# Ticket #302: fetch each instance texel once

`dump-shader-sources.mts` writes the real cell shader sources of a checkout to JSON (run it with the server
package's `tsx` against main and against the change). `shader-microbench.mjs` compiles both programs in one
SwiftShader WebGL2 context, feeds them the same deterministic instance rows and textures, and draws both passes of
30 instanced cells on a 512² canvas.

- **Pixels:** the two programs' outputs are identical: 0 of 145 670 lit pixels differ (`shader-microbench.log`).
- **Time:** 10 alternating rounds of 2 frames each, a 1 px readback forcing the GPU to finish. Median ms per frame
  was main 1188.8 and change 1157.0, so B/A is 0.973. The per-round paired ratio has a median of 0.92, and the spread
  between rounds is ±20 %. Box load average was 18–32 on 4 cores (other agents' runs), so the only claim is "no
  slower, a few percent faster on SwiftShader". SwiftShader's compiler likely merges some repeated fetches already.
  The effect on a real GPU is **unmeasured**.
- **Full-app frame:** a whole-app bench frame from each build (`?bench=42&tick=120&zoom=8&window=1&preserve=1`) could
  not be captured at this load. Both captures timed out at 560 s, so the shader-level identity above is the pixel
  evidence.
