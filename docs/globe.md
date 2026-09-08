# Globe

Globe is an independent Vite entry point at `playground/globe/index.html`, listed under Playground → Misc. Websites and Misc share the same level in navigation and on the collection page. The worktree is for review; nothing is automatically merged or published.

## Experience

- Real Earth imagery, a translucent cloud layer, atmospheric glow and a deterministic star field.
- Drag to rotate; scroll or pinch to zoom. A drag or multi-pointer gesture does not select a country.
- Tap a mapped country or use the accessible autocomplete. The `/` shortcut focuses search; arrows and Enter select; Escape dismisses suggestions or details.
- Prefixes, ISO codes, common alternate names and diacritic-insensitive search are supported.
- Selected borders and a transparent fill remain legible over satellite imagery. Search flies to the selected location.
- On narrow screens the card is a scrollable bottom sheet and the globe is shifted into the remaining space. Desktop cards track the selected location, remain within the viewport, and hide their connector when the location is behind Earth.
- Automatic rotation stops on interaction. Reduced-motion preferences disable automatic movement and camera transitions. Paused scenes stop rendering after controls settle; hidden pages and an open About dialog pause rendering.
- Search and data cards work independently of WebGL. The page reports loading and graphics failures without disabling country exploration.

## Data and attribution

The checked-in assets are a snapshot. The browser does not contact a country API, map server, or flag CDN.

| Source | Use | Terms |
| --- | --- | --- |
| [Natural Earth 1:50m map units](https://www.naturalearthdata.com/downloads/50m-cultural-vectors/) | Country and territory boundaries; supplementary dated population estimates | [Public domain](https://www.naturalearthdata.com/about/terms-of-use/) |
| [World Bank SP.POP.TOTL](https://data.worldbank.org/indicator/SP.POP.TOTL) | Latest non-null 2024–2025 population estimate | [CC BY 4.0, subject to source exceptions](https://www.worldbank.org/en/about/legal/terms-of-use-for-datasets) |
| [mledoze/countries](https://github.com/mledoze/countries) | Names, capitals, area, languages, currencies and ISO codes | ODbL; full license in `assets/COUNTRIES-LICENSE.txt` |
| [NASA Blue Marble via Three Globe](https://github.com/vasturiano/three-globe/tree/master/example/img) | Satellite texture and relief | NASA public imagery; Three Globe MIT |
| [WebGL Earth via Globe.gl](https://github.com/vasturiano/globe.gl/tree/master/example/clouds) | Illustrative cloud texture | MIT distribution; not live weather |
| [flag-icons](https://github.com/lipis/flag-icons) | Local SVG flag assets | MIT |

The derived country database in `assets/countries.json` is distributed under ODbL, with attribution to mledoze/countries and Natural Earth and World Bank for supplementary fields. `assets/provenance.json` records retrieval date, input URLs and source SHA-256 hashes. Population cards display the year and source rather than implying a live count. Missing facts display as unavailable.

Map units are joined by ISO / Natural Earth codes, with explicit aliases where codes differ. Subunits belonging to a single country are dissolved using TopoJSON so, for example, UK selection includes England, Scotland, Wales and Northern Ireland without internal borders. Separately coded territories such as French Guiana remain individually selectable.

Boundaries are a generalized cartographic snapshot, not a settlement of territorial claims. Status notes cover disputed units and special cases. Three places absent from the map-unit geometry (Bouvet Island, Gibraltar and United States Minor Outlying Islands) use a location marker and an explanatory card. Tiny polygons, coastlines and enclaves are subject to the source's 1:50m generalization. Search is the reliable way to select very small places. Some country coordinate anchors are approximate, especially for dispersed island groups.

Antarctica has no permanent population or national capital and uses a tailored card. The cloud layer and camera-relative sunlight are illustrative, not live conditions.

## Refreshing assets

With dependencies installed, run:

```sh
node scripts/fetch-globe-assets.mjs
node scripts/prepare-globe-data.mjs
npm test
npm run build
```

Fetching is explicit and requires network access. The preparation step is offline and consumes `.globe-cache/`. Only compact derived data and optimized textures are shipped. Raw downloaded data is ignored by Git. Review status notes, changed codes and source terms whenever refreshing. The population year window is explicit in the fetch script and should advance with future refreshes.

## Verification

`npm test` checks autocomplete ranking, alternate names, picking in mainland and overseas territories, polar and date-line regions, ocean non-selection, dataset integrity, status handling and country zoom limits. `npm run build` validates all static entry points and rewrites assets for GitHub Pages subdirectory hosting.

Browser review should cover phone portrait and landscape, search with a software keyboard, two-finger gestures on a real phone, selection and dismissal, long cards, reduced motion, context loss and keyboard-only operation. Desktop viewport emulation cannot establish real-device GPU performance or touch behavior.

The initial worktree was checked in the local browser at 320 × 568, 390 × 844, and 844 × 390, plus a desktop viewport. Checks covered autocomplete, keyboard selection, direct country picking, drag without accidental selection, long scrolling cards, country flags, navigation grouping and screen overflow. Real-device pinch gestures, GPU performance, reduced-motion emulation and induced context loss were not part of that browser pass.
