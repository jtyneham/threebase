# Threebase

A mobile-first base for creative web experiments built with Three.js, HTML, CSS, and JavaScript.

Threebase has two collections:

- **Playground** — website experiments under **Websites**, and interactive explorations under **Misc**.
- **Object Lab** — real-world references reconstructed as procedural Three.js objects.

**Globe**, under Playground → Misc, is a mobile-first Earth explorer with country selection, autocomplete, and locally bundled geographic data. Open `/playground/globe/` during development. Its renderer and geographic assets load only on that page.

The homepage retains its lightweight, transparent, event-driven foundation scene.

## Development

Requirements: Node.js 20.19+ or 22.12+.

```sh
npm install
npm run dev
```

Create a production build with:

```sh
npm run build
npm run preview
```

Vite writes the static site to `dist/`. Asset URLs are generated relative to the current path so the build works under a GitHub repository subdirectory.

## Adding entries

Collection metadata lives in `src/content/catalog.js`. Add a unique entry there and place its implementation under the matching directory:

```text
src/experiments/<project-slug>/
src/objects/<object-slug>/
```

Empty collections show an accessible placeholder automatically. Entries may add a `href` when their page is ready.

See [docs/architecture.md](docs/architecture.md) for lifecycle contracts, performance policy, asset conventions, and future extension points.

See [docs/globe.md](docs/globe.md) for Globe's data sources, refresh workflow, interaction design, and verification.
