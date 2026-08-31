export function observeRendererSize({ container, renderer, camera, pixelRatio, onResize }) {
  let previousWidth = 0;
  let previousHeight = 0;

  function resize() {
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    if (width === previousWidth && height === previousHeight) return;

    previousWidth = width;
    previousHeight = height;
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    onResize?.({ width, height, pixelRatio });
  }

  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();

  return () => observer.disconnect();
}
