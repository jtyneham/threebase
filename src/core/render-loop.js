export function createRenderLoop(render) {
  let frameId = 0;
  let previousTime = 0;
  let continuous = false;

  function frame(time) {
    frameId = 0;
    const delta = previousTime ? Math.min((time - previousTime) / 1000, 0.1) : 0;
    previousTime = time;
    render({ elapsed: time / 1000, delta });
    if (continuous) requestFrame();
  }

  function requestFrame() {
    if (!frameId && !document.hidden) frameId = requestAnimationFrame(frame);
  }

  function setContinuous(value) {
    continuous = Boolean(value);
    previousTime = 0;
    if (continuous) requestFrame();
  }

  function handleVisibility() {
    previousTime = 0;
    if (document.hidden && frameId) {
      cancelAnimationFrame(frameId);
      frameId = 0;
    } else if (continuous) {
      requestFrame();
    }
  }

  document.addEventListener('visibilitychange', handleVisibility);

  return {
    invalidate: requestFrame,
    setContinuous,
    dispose() {
      continuous = false;
      if (frameId) cancelAnimationFrame(frameId);
      document.removeEventListener('visibilitychange', handleVisibility);
    },
  };
}
