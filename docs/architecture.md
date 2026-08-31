# Threebase architecture

This document records the project's current policies. It is intentionally practical rather than a framework specification; boundaries should evolve when real experiments expose better ones.

## Information architecture

The top-level collections are:

1. **Playground** for website layout, styling, and interaction experiments.
2. **Object Lab** for real-life references rebuilt as procedural Three.js objects.

Metadata is defined in `src/content/catalog.js` and rendered by `src/ui/render-collections.js`. Implementations belong in `src/experiments/` or `src/objects/`. A future entry may link to its own HTML entry point without converting the site into a client-side routed application.

## Page and rendering ownership

Semantic HTML owns navigation, copy, collection entries, loading/error messages, and every essential interaction. Three.js enhances a region but must not be required to understand or navigate the site.

The canvas is decorative and uses `pointer-events: none` by default. An experiment may opt into canvas input only when it supplies equivalent touch, mouse, and keyboard behavior without blocking page scroll or nearby controls.

`src/core/experience.js` owns renderer creation and disposal. Scene modules own their scene-specific resources and expose:

```js
{
  scene,
  camera,
  update({ elapsed, delta, reducedMotion }),
  resize({ width, height, pixelRatio }),
  dispose(),
  wantsContinuousRendering
}
```

The empty scene validates this contract but renders no visual experience.
The landing page lazy-loads Three.js during browser idle time so semantic HTML and collection UI initialize first.

## Rendering policy

- Rendering is event-driven by default. Continuous animation is an explicit scene choice.
- Rendering pauses while the document is hidden and large frame deltas are clamped.
- Continuous animation is disabled when reduced motion is requested unless a future scene provides an intentionally static alternative.
- Canvas size follows its container through `ResizeObserver`, not assumed window dimensions.
- Device pixel ratio is capped at 2 and begins at 1.5 on coarse-pointer devices.
- Antialiasing starts disabled on coarse-pointer devices to reduce mobile fragment cost.
- Context loss pauses rendering and reports a readable status. Restoration requests a fresh frame.

These are conservative starting values, not device-quality guarantees. Measure real experiments before adding dynamic quality adaptation.

## Resource ownership and cleanup

Every module that creates a GPU resource owns its disposal unless ownership is explicitly transferred. Scene disposal must cover geometries, materials, textures, render targets, controls, observers, event listeners, and workers. Shared cached resources need reference ownership before they are introduced.

The application disposes its scene before the renderer and releases the WebGL context on page teardown. Asset loaders must provide an error path and must ignore or abort late results after disposal.

## Assets and deployment

Vite is configured with `base: './'`. Prefer importing assets from JavaScript or CSS so production URLs are rewritten and fingerprinted. If a file must live in `public/`, resolve its URL with `import.meta.env.BASE_URL`; never embed `/threebase/` or use repository-root absolute asset paths.

GitHub Pages receives only the generated `dist/` artifact. The site has no server runtime, secret storage, database, or private API proxy. Features requiring those capabilities must use a separately managed service and must degrade safely when unavailable.

Use glTF/GLB for conventional runtime models. Object Lab's procedural reconstructions should remain code-generated when using the img2threejs workflow. Compress and right-size textures, audio, video, and environment maps before committing them.

## Accessibility and motion

- Normal content and navigation remain usable without WebGL.
- Canvas elements are hidden from assistive technology unless they convey information unavailable elsewhere.
- Status and failure messages use ordinary HTML.
- Reduced motion changes whether animation runs; it is not merely a slower animation speed.
- Touch targets, visible focus, document zoom, high contrast, text resizing, and keyboard order must be verified for every experiment.

## Extension rule

Build the smallest scene-specific implementation first. Extract shared code only after a second use demonstrates a stable boundary. Cameras, controls, lighting, post-processing, and effects may become independent modules where an experiment benefits, but Threebase does not require a universal abstraction for them.
