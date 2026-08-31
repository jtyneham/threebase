const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

export function getQualityProfile() {
  const reducedMotion = reducedMotionQuery.matches;
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;

  return {
    reducedMotion,
    // High-DPI screens can multiply fragment cost dramatically. Two is an
    // intentional ceiling; coarse-pointer devices start more conservatively.
    pixelRatio: Math.min(window.devicePixelRatio || 1, coarsePointer ? 1.5 : 2),
    antialias: !coarsePointer,
  };
}

export function observeReducedMotion(callback) {
  const handleChange = (event) => callback(event.matches);
  reducedMotionQuery.addEventListener('change', handleChange);
  return () => reducedMotionQuery.removeEventListener('change', handleChange);
}
