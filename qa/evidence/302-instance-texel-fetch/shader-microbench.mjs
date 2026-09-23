// Ticket #302 microbench: the real cell shaders of main (A) and the change (B), same inputs, in one SwiftShader
// WebGL2 context: ms per frame (both passes over INSTANCES quads, then a 1 px readback), alternated; and the outputs
// compared pixel for pixel.
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
const A = JSON.parse(readFileSync('/workspace/.qa/scratch/perf-302-src-A.json', 'utf8'));
const B = JSON.parse(readFileSync('/workspace/.qa/scratch/perf-302-src-B.json', 'utf8'));
const ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const browser = await chromium.launch({ args: ARGS });
try {
  const page = await browser.newPage();
  await page.setContent('<canvas id="c" width="512" height="512"></canvas>');
  const result = await page.evaluate(
    async ({ A, B, rounds, framesPerRound, instances }) => {
      const gl = document.getElementById('c').getContext('webgl2', { preserveDrawingBuffer: true, antialias: false });
      gl.getExtension('EXT_color_buffer_float');
      const compile = (type, src) => {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
        return s;
      };
      const program = (src) => {
        const p = gl.createProgram();
        gl.attachShader(p, compile(gl.VERTEX_SHADER, src.vertex));
        gl.attachShader(p, compile(gl.FRAGMENT_SHADER, src.fragment));
        gl.bindAttribLocation(p, 0, 'aPosition');
        gl.bindAttribLocation(p, 1, 'aInstanceIndex');
        gl.linkProgram(p);
        if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
        return p;
      };
      // Deterministic instance rows: cells spread over the canvas, a plausible value in every float.
      let seed = 42;
      const rand = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
      const texels = A.texels;
      const row = new Float32Array(texels * 4 * instances);
      for (let i = 0; i < instances; i += 1) {
        const base = i * texels * 4;
        for (let f = 0; f < texels * 4; f += 1) row[base + f] = rand();
        row[base + 0] = (rand() - 0.5) * 900;
        row[base + 1] = (rand() - 0.5) * 900; // x, y
        row[base + 2] = 40 + rand() * 60;
        row[base + 3] = 1.6; // radius, quad extent
        row[base + 6] = Math.floor(rand() * 4); // palette row
        row[base + 23] = 1; // alpha
      }
      const texture = (w, h, data, internal, format, type) => {
        const t = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, data);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        return t;
      };
      const bytes = (n) => {
        const b = new Uint8Array(n);
        for (let i = 0; i < n; i += 1) b[i] = Math.floor(rand() * 256);
        return b;
      };
      const textures = [
        texture(texels, instances, row, gl.RGBA32F, gl.RGBA, gl.FLOAT),
        texture(256, 16, bytes(256 * 16 * 4), gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE),
        texture(64, 64, bytes(64 * 64 * 4), gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE),
        texture(16, 8, bytes(16 * 8 * 4), gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE),
      ];
      const quad = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      const index = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, index);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(Array.from({ length: instances }, (_, i) => i)), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 0, 0);
      gl.vertexAttribDivisor(1, 1);
      const setup = (p) => {
        gl.useProgram(p);
        const u = (n) => gl.getUniformLocation(p, n);
        ['uInstances', 'uStrip', 'uTile', 'uPalette'].forEach((n, i) => {
          gl.activeTexture(gl.TEXTURE0 + i);
          gl.bindTexture(gl.TEXTURE_2D, textures[i]);
          gl.uniform1i(u(n), i);
        });
        const s = 1 / 512;
        gl.uniformMatrix3fv(u('uProjectionMatrix'), false, [s, 0, 0, 0, s, 0, 0, 0, 1]);
        gl.uniformMatrix3fv(u('uWorldTransformMatrix'), false, [1, 0, 0, 0, 1, 0, 0, 0, 1]);
        gl.uniformMatrix3fv(u('uTransformMatrix'), false, [1, 0, 0, 0, 1, 0, 0, 0, 1]);
        gl.uniform1f(u('uTimeSeconds'), 1.25);
        gl.uniform1f(u('uZoom'), 8);
        for (const n of [
          'uWhite',
          'uOutline',
          'uChloroLight',
          'uToxinGlow',
          'uRibosome',
          'uCytoskeleton',
          'uCellWall',
          'uCellWallLight',
          'uCilia',
          'uDanger',
          'uGain',
        ])
          gl.uniform3f(u(n), 0.6, 0.5, 0.4);
        return u('uPass');
      };
      const programs = { A: program(A), B: program(B) };
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      const frame = (label) => {
        const pass = setup(programs[label]);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.uniform1f(pass, 0);
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, instances);
        gl.uniform1f(pass, 1);
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, instances);
      };
      const pixels = (label) => {
        frame(label);
        const out = new Uint8Array(512 * 512 * 4);
        gl.readPixels(0, 0, 512, 512, gl.RGBA, gl.UNSIGNED_BYTE, out);
        return out;
      };
      const pa = pixels('A');
      const pb = pixels('B');
      let differing = 0,
        lit = 0;
      for (let i = 0; i < pa.length; i += 4) {
        if (pa[i] + pa[i + 1] + pa[i + 2] > 0) lit += 1;
        if (pa[i] !== pb[i] || pa[i + 1] !== pb[i + 1] || pa[i + 2] !== pb[i + 2] || pa[i + 3] !== pb[i + 3])
          differing += 1;
      }
      const sync = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4)); // waits for the GPU
      const times = { A: [], B: [] };
      for (let r = 0; r < rounds; r += 1) {
        for (const label of r % 2 === 0 ? ['A', 'B'] : ['B', 'A']) {
          frame(label);
          sync();
          const t0 = performance.now();
          for (let f = 0; f < framesPerRound; f += 1) frame(label);
          sync();
          times[label].push((performance.now() - t0) / framesPerRound);
        }
      }
      return { differing, lit, pixels: pa.length / 4, times };
    },
    {
      A,
      B,
      rounds: Number(process.env.ROUNDS ?? 8),
      framesPerRound: Number(process.env.FRAMES ?? 5),
      instances: Number(process.env.INSTANCES ?? 100),
    },
  );
  const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  console.log(JSON.stringify({ differing: result.differing, lit: result.lit, pixels: result.pixels }));
  console.log(
    'A ms/frame',
    result.times.A.map((t) => t.toFixed(1)).join(' '),
    'median',
    median(result.times.A).toFixed(1),
  );
  console.log(
    'B ms/frame',
    result.times.B.map((t) => t.toFixed(1)).join(' '),
    'median',
    median(result.times.B).toFixed(1),
  );
  console.log(
    'B/A',
    (median(result.times.B) / median(result.times.A)).toFixed(3),
    'load',
    readFileSync('/proc/loadavg', 'utf8').trim(),
  );
  await page.close();
} finally {
  await browser.close();
}
