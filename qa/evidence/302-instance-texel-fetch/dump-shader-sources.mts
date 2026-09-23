// Dumps the cell shader sources of one checkout (argv[2]) and the instance row size, for the #302 microbench.
import { writeFileSync } from 'node:fs';
const root = process.argv[2];
const shader = await import(`${root}/packages/client/src/app/game/render/cells/cell-shader.ts`);
const instance = await import(`${root}/packages/client/src/app/game/render/cells/cell-instance.ts`);
const source = await import(`${root}/packages/client/src/app/game/render/cells/cell-shader-source.ts`);
writeFileSync(
  process.argv[3],
  JSON.stringify({
    vertex: shader.CELL_VERTEX_SOURCE,
    fragment: shader.CELL_FRAGMENT_SOURCE,
    texels: instance.CELL_INSTANCE_TEXELS,
    uniforms: source.CELL_UNIFORM,
  }),
);
console.log('ok', process.argv[3]);
