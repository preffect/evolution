// One acorn barnacle (docs/rendering/opening-dive.md §4, ticket #801, the mockup's `barnacle()`): a shadow to the
// bottom-right, six lit plates with their sutures, the dark opening and its pale lip. The barnacle tile scatters four
// baked shells of it, turned and scaled.

import { RADIANS_PER_FULL_TURN } from '@evolution/shared';
import { SHORE_BARNACLE_SHELL, SHORE_PALETTE } from '../../constants/dive-shore-tiles';
import type { ShoreContext2D } from './shore-canvas';

/** Where a shell is drawn: its centre, radius and turn (`t`, 0–1). */
export interface ShellPlace {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly turn: number;
}

function plateAngle(plate: number, turn: number): number {
  return (plate / SHORE_BARNACLE_SHELL.plates) * RADIANS_PER_FULL_TURN + turn * SHORE_BARNACLE_SHELL.plateTurn;
}

function drawPlates(context: ShoreContext2D, place: ShellPlace): void {
  const shell = SHORE_BARNACLE_SHELL;
  const { x, y, radius, turn } = place;
  const gradient = context.createRadialGradient(
    x + radius * shell.light.x,
    y + radius * shell.light.y,
    radius * shell.light.inner,
    x,
    y,
    radius,
  );
  gradient.addColorStop(0, SHORE_PALETTE.barnacleLight);
  gradient.addColorStop(shell.light.baseStop, SHORE_PALETTE.barnacleBase);
  gradient.addColorStop(1, SHORE_PALETTE.barnacleDark);
  context.fillStyle = gradient;
  context.beginPath();
  for (let plate = 0; plate <= shell.plates; plate += 1) {
    const angle = plateAngle(plate, turn);
    const wobble = shell.plateWobble;
    const reach = radius * (wobble.base + wobble.span * Math.cos(plate * wobble.frequency + turn * wobble.phase));
    if (plate === 0) context.moveTo(x + Math.cos(angle) * reach, y + Math.sin(angle) * reach);
    else context.lineTo(x + Math.cos(angle) * reach, y + Math.sin(angle) * reach);
  }
  context.closePath();
  context.fill();
}

function drawSutures(context: ShoreContext2D, place: ShellPlace): void {
  const suture = SHORE_BARNACLE_SHELL.suture;
  const { x, y, radius, turn } = place;
  context.strokeStyle = suture.colour;
  context.lineWidth = Math.max(suture.minWidth, radius * suture.width);
  for (let plate = 0; plate < SHORE_BARNACLE_SHELL.plates; plate += 1) {
    const angle = plateAngle(plate, turn);
    context.beginPath();
    context.moveTo(x + Math.cos(angle) * radius * suture.from, y + Math.sin(angle) * radius * suture.from);
    context.lineTo(x + Math.cos(angle) * radius * suture.to, y + Math.sin(angle) * radius * suture.to);
    context.stroke();
  }
}

function drawOpening(context: ShoreContext2D, place: ShellPlace): void {
  const { opening, lip, plateTurn } = SHORE_BARNACLE_SHELL;
  const { x, y, radius, turn } = place;
  const tilt = turn * plateTurn;
  context.fillStyle = opening.colour;
  context.beginPath();
  context.ellipse(x, y, radius * opening.radiusX, radius * opening.radiusY, tilt, 0, RADIANS_PER_FULL_TURN);
  context.fill();
  context.strokeStyle = lip.colour;
  context.lineWidth = Math.max(lip.minWidth, radius * lip.width);
  context.beginPath();
  context.ellipse(x, y, radius * opening.radiusX, radius * opening.radiusY, tilt, Math.PI * lip.from, Math.PI * lip.to);
  context.stroke();
}

/** One barnacle at `place` (`barnacle(g, X, Y, rr, t)`). */
export function drawBarnacle(context: ShoreContext2D, place: ShellPlace): void {
  const shadow = SHORE_BARNACLE_SHELL.shadow;
  const { x, y, radius } = place;
  context.fillStyle = shadow.colour;
  context.beginPath();
  context.ellipse(
    x + radius * shadow.x,
    y + radius * shadow.y,
    radius * shadow.radiusX,
    radius,
    0,
    0,
    RADIANS_PER_FULL_TURN,
  );
  context.fill();
  drawPlates(context, place);
  drawSutures(context, place);
  drawOpening(context, place);
}
