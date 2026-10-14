// The plankton in the drop on the dive's stage (docs/rendering/opening-dive.md §4, ticket #803, the mockup's `ORGS`
// drawn by `nauplius`, `ciliate`, `dino` and `pennate`): each a halo sprite, the strokes that move under its body, its
// still body as a sprite from the rung of its ladder for its size on screen, the strokes that move over it, and its
// rim; the two big pennates are quads of their own, mixing their bright- and dark-field pictures. Layered halos,
// strokes, bodies, strokes, rims: the organisms never overlap, so this is the mockup's order for each.

import { Container, Sprite, type Texture } from 'pixi.js';
import { hexToNumber } from '../../colour';
import { DIAMETER_PER_RADIUS, HALF } from '../../geometry';
import {
  SLIME_ORGANISMS,
  SLIME_ORGANISM_VISIBLE_LENGTHS,
  SLIME_PLANKTON_KIND,
  type SlimeOrganism,
} from '../../constants/dive-slime-plankton';
import { SLIME_STROKES_CAPACITY } from '../../constants/dive-slime';
import { SLIME_PICTURE_BOXES } from '../../constants/dive-slime-diatoms';
import type { PlanktonLayerName, PlanktonRung } from './slime-atlases';
import { marginBox } from './slime-pictures';
import { SLIME_PLANKTON_LOOKS, type PlanktonLook } from './slime-plankton-looks';
import type { SlimeFrame } from './slime-frame';
import type { SlimeMesh } from './slime-meshes';
import { bindTexture, uniformVector, type SlimeProgram } from './slime-programs';
import { SLIME_PENNATE_UNIFORM } from './slime-shader-pennate';
import { rungFor } from './slime-sprite-ladder';
import { SlimeStrokes, type StrokePlacement } from './slime-strokes';

/** A rung of a layer as the GPU has it. */
export interface PlanktonRungTexture {
  readonly rung: PlanktonRung;
  readonly texture: Texture;
}

export type PlanktonTextures = Readonly<Record<PlanktonLayerName, readonly PlanktonRungTexture[]>>;

/** Where an organism draws this frame: hidden, or its centre on the stage, heading and css px to its unit. */
export type OrganismPlacement = (StrokePlacement & { readonly isShown: true }) | { readonly isShown: false };

/** The organism's place this frame (`vis`, its least size, and its own motion), or hidden. */
export function organismPlacement(organism: SlimeOrganism, frame: SlimeFrame, look: PlanktonLook): OrganismPlacement {
  const scale = frame.pixelsPerMetre;
  const unitPx = organism.lengthM * scale;
  const halfWidthM = (frame.stageWidthPx * HALF) / scale;
  const halfHeightM = (frame.stageHeightPx * HALF) / scale;
  const reach = organism.lengthM * SLIME_ORGANISM_VISIBLE_LENGTHS;
  const isInView = Math.abs(organism.x) - reach < halfWidthM && Math.abs(organism.y) - reach < halfHeightM;
  if (!frame.isShown || !isInView || unitPx < look.hideBelowPx) return { isShown: false };
  const motion = look.motion(organism, frame.timeSeconds);
  return {
    isShown: true,
    x: frame.stageWidthPx * HALF + (organism.x + motion.driftX * organism.lengthM) * scale,
    y: frame.stageHeightPx * HALF + organism.y * scale,
    angle: organism.angle + motion.turn,
    unitPx,
  };
}

function placeSprite(sprite: Sprite, rung: PlanktonRungTexture, placement: StrokePlacement): void {
  const { box } = rung.rung;
  const width = box.right - box.left;
  const height = box.bottom - box.top;
  sprite.texture = rung.texture;
  sprite.anchor.set(-box.left / width, -box.top / height);
  sprite.width = width * placement.unitPx;
  sprite.height = height * placement.unitPx;
  sprite.position.set(placement.x, placement.y);
  sprite.rotation = placement.angle;
  sprite.visible = true;
}

/** The rung of `rungs` for an object `unitPx` css px long. */
export function rungTextureFor(rungs: readonly PlanktonRungTexture[], unitPx: number): PlanktonRungTexture | undefined {
  return rungs[
    rungFor(
      rungs.map((rung) => rung.rung.unitPx),
      unitPx,
    )
  ];
}

interface OrganismLayers {
  readonly organism: SlimeOrganism;
  readonly look: PlanktonLook;
  readonly halo: Sprite;
  readonly body: Sprite;
  readonly rim: Sprite;
  readonly pennate: { readonly mesh: SlimeMesh; readonly program: SlimeProgram } | null;
}

export class SlimeOrganisms {
  readonly view = new Container();
  private readonly halos = new Container();
  private readonly bodies = new Container();
  private readonly rims = new Container();
  private readonly under: SlimeStrokes;
  private readonly over: SlimeStrokes;
  private readonly layers: OrganismLayers[];
  private textures: PlanktonTextures | null = null;

  constructor(
    strokes: SlimeProgram,
    pennates: readonly { readonly mesh: SlimeMesh; readonly program: SlimeProgram }[],
    glow: Texture,
  ) {
    this.under = new SlimeStrokes(strokes.shader, SLIME_STROKES_CAPACITY.under);
    this.over = new SlimeStrokes(strokes.shader, SLIME_STROKES_CAPACITY.over);
    const pennateQueue = [...pennates];
    this.layers = SLIME_ORGANISMS.map((organism) => {
      const isPennate = organism.kind === SLIME_PLANKTON_KIND.pennate;
      const layers: OrganismLayers = {
        organism,
        look: SLIME_PLANKTON_LOOKS[organism.kind],
        halo: new Sprite({ texture: glow, anchor: HALF, visible: false }),
        body: new Sprite({ visible: false }),
        rim: new Sprite({ visible: false }),
        pennate: isPennate ? (pennateQueue.shift() ?? null) : null,
      };
      this.halos.addChild(layers.halo);
      if (layers.pennate !== null) this.bodies.addChild(layers.pennate.mesh);
      else this.bodies.addChild(layers.body);
      this.rims.addChild(layers.rim);
      return layers;
    });
    this.view.addChild(this.halos, this.under.mesh, this.bodies, this.over.mesh, this.rims);
  }

  /** Once the ladders have baked: each layer's rungs as the GPU has them. */
  bind(textures: PlanktonTextures): void {
    this.textures = textures;
  }

  /** The organisms set up for this frame; answers whether any shows. */
  update(frame: SlimeFrame): boolean {
    this.view.alpha = frame.slimeAlpha;
    this.under.begin();
    this.over.begin();
    let isAnyShown = false;
    for (const layers of this.layers) isAnyShown = this.place(layers, frame) || isAnyShown;
    this.under.end();
    this.over.end();
    return isAnyShown;
  }

  private place(layers: OrganismLayers, frame: SlimeFrame): boolean {
    const { organism, look, halo, body, rim, pennate } = layers;
    const placement = organismPlacement(organism, frame, look);
    halo.visible = body.visible = rim.visible = false;
    if (pennate !== null) pennate.mesh.visible = false;
    if (!placement.isShown) return false;
    const radius = look.halo.radius * placement.unitPx;
    halo.tint = hexToNumber(look.halo.colour);
    halo.alpha = look.halo.base + look.halo.darkField * frame.darkField;
    halo.width = halo.height = radius * DIAMETER_PER_RADIUS;
    halo.position.set(placement.x, placement.y);
    halo.visible = true;
    const pen = { unitPx: placement.unitPx };
    this.under.add(look.strokesUnder(pen, frame), placement);
    this.over.add(look.strokesOver(pen, frame), placement);
    if (pennate !== null) this.placePennate(pennate, organism, placement);
    if (this.textures === null) return true;
    if (look.body !== null) this.placeLayer(body, look.body, placement);
    if (look.rim !== null) this.placeLayer(rim, look.rim, placement);
    return true;
  }

  private placeLayer(sprite: Sprite, layer: PlanktonLayerName, placement: StrokePlacement): void {
    const rung = rungTextureFor(this.textures?.[layer] ?? [], placement.unitPx);
    if (rung !== undefined) placeSprite(sprite, rung, placement);
  }

  /** A pennate's quad: its rung's pictures once bound, its outline until then. */
  private placePennate(
    pennate: { readonly mesh: SlimeMesh; readonly program: SlimeProgram },
    organism: SlimeOrganism,
    placement: StrokePlacement,
  ): void {
    const bright = rungTextureFor(this.textures?.pennate ?? [], placement.unitPx);
    const dark = rungTextureFor(this.textures?.pennateDark ?? [], placement.unitPx);
    const isBound = bright !== undefined && dark !== undefined;
    const box = bright?.rung.box ?? marginBox(SLIME_PICTURE_BOXES.pennate, placement.unitPx);
    const { program } = pennate;
    const { x, y, lengthM, angle } = organism;
    uniformVector(program, SLIME_PENNATE_UNIFORM.pennate).set([x, y, lengthM, angle]);
    uniformVector(program, SLIME_PENNATE_UNIFORM.box).set([box.left, box.top, box.right, box.bottom]);
    const reach = Math.max(-box.left, box.right, -box.top, box.bottom);
    uniformVector(program, SLIME_PENNATE_UNIFORM.reach).set([reach, isBound ? 1 : 0]);
    if (isBound) {
      bindTexture(program, SLIME_PENNATE_UNIFORM.bright, bright.texture.source);
      bindTexture(program, SLIME_PENNATE_UNIFORM.dark, dark.texture.source);
    }
    program.uniforms.update();
    pennate.mesh.visible = true;
  }

  /** Its sprites and stroke meshes go; the pennates' meshes and every texture are the band's. */
  destroy(): void {
    this.under.destroy();
    this.over.destroy();
    this.view.destroy({ children: true });
  }
}
