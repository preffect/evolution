// A fence after the work handed to the GPU so far (docs/rendering/opening-dive.md §6, ticket #814): the opening
// dive's autoplay waits until its bands' warm-up (their programs, textures and mipmaps, seconds under software GL) is
// done, so the fall never starts into that wait. It never blocks: the check reads the fence's status, which the
// browser updates between tasks.

/** The slice of a WebGL 2 context a fence needs; a WebGL 1 context lacks `fenceSync`. */
export type GpuFenceContext = Pick<
  WebGL2RenderingContext,
  | 'SYNC_GPU_COMMANDS_COMPLETE'
  | 'SYNC_STATUS'
  | 'SIGNALED'
  | 'fenceSync'
  | 'getSyncParameter'
  | 'deleteSync'
  | 'flush'
  | 'isContextLost'
>;

/** Whether the GPU has done the work fenced; asked once a frame. */
export type GpuFenceCheck = () => boolean;

const PASSED: GpuFenceCheck = () => true;

/**
 * Fences the work handed to `context` so far and answers its check. Where there is no fence to set (no WebGL 2, the
 * context lost), the check passes at once: nothing waits on what cannot be told.
 */
export function fenceGpuWork(context: Partial<GpuFenceContext> | null): GpuFenceCheck {
  if (context === null || typeof context.fenceSync !== 'function') return PASSED;
  const webGl = context as GpuFenceContext;
  if (webGl.isContextLost()) return PASSED;
  const sync = webGl.fenceSync(webGl.SYNC_GPU_COMMANDS_COMPLETE, 0);
  if (sync === null) return PASSED;
  // Without a flush the fence may sit in the command buffer and never be reached.
  webGl.flush();
  let hasPassed = false;
  return () => {
    if (hasPassed) return true;
    hasPassed = webGl.isContextLost() || webGl.getSyncParameter(sync, webGl.SYNC_STATUS) === webGl.SIGNALED;
    if (hasPassed) webGl.deleteSync(sync);
    return hasPassed;
  };
}
