import { readFile, writeFile } from 'node:fs/promises';
import { topology } from 'topojson-server';
import { merge } from 'topojson-client';
import { geoArea, geoBounds, geoCentroid } from 'd3-geo';

const read = async (name) => JSON.parse(await readFile(`.globe-cache/${name}.json`, 'utf8'));
const [boundaries, countries, populations] = await Promise.all(['boundaries', 'countries', 'populations'].map(read));
if (!Array.isArray(populations[1])) throw new Error('World Bank response is not a data page.');
const populationMap = new Map();
for (const row of populations[1]) {
  if (row.value != null && (!populationMap.has(row.countryiso3code) || populationMap.get(row.countryiso3code).year < +row.date)) {
    populationMap.set(row.countryiso3code, { value: row.value, year: +row.date });
  }
}
if (populationMap.has('XKX')) populationMap.set('UNK', populationMap.get('XKX'));
const records = new Map(countries.map(c => [c.cca3, {
  id: c.cca3, code: c.cca2, name: c.name.common, officialName: c.name.official,
  aliases: [...c.altSpellings, ...Object.values(c.name.native ?? {}).map(n => n.common)],
  capital: c.capital.join(' / ') || null, region: c.region, subregion: c.subregion,
  area: c.area, languages: Object.values(c.languages),
  currencies: Object.entries(c.currencies).map(([code, value]) => `${value.name} (${code})`),
  lat: c.latlng[0], lng: c.latlng[1], independent: c.independent === true,
  status: c.independent ? 'Country' : 'Territory', relationship: null,
  population: populationMap.get(c.cca3)?.value ?? null, populationYear: populationMap.get(c.cca3)?.year ?? null,
}]));
const aliases = { KOS: 'UNK', NJM: 'SJM', NSV: 'SJM', ATC: 'AUS' };
const groups = new Map();
for (const feature of boundaries.features) {
  const p = feature.properties;
  const id = aliases[p.GU_A3] ?? [p.GU_A3, p.ISO_A3, p.ISO_A3_EH, p.ADM0_A3].find(code => records.has(code)) ?? p.GU_A3;
  if (!records.has(id)) {
    records.set(id, {
      id, code: '', name: p.NAME_LONG, officialName: p.FORMAL_EN || p.NAME_LONG,
      aliases: [p.NAME, p.ADMIN], capital: null, region: p.REGION_UN, subregion: p.SUBREGION,
      area: null, languages: [], currencies: [], lat: p.LABEL_Y, lng: p.LABEL_X,
      status: 'Disputed area', disputed: true, independent: false, relationship: null, population: null, populationYear: null,
    });
  }
  const record = records.get(id);
  if (!record.independent && p.SOVEREIGNT && p.SOVEREIGNT !== p.ADMIN) record.relationship = p.SOVEREIGNT;
  if (p.TYPE === 'Disputed' || p.TYPE === 'Indeterminate' || p.BRK_DIFF === 1) record.disputed = true;
  if (!groups.has(id)) groups.set(id, []);
  groups.get(id).push({ ...feature, properties: { id } });
}
const topo = topology({ units: { type: 'FeatureCollection', features: [...groups.values()].flat() } });
const geometries = new Map();
for (const geometry of topo.objects.units.geometries) {
  const id = geometry.properties.id;
  if (!geometries.has(id)) geometries.set(id, []);
  geometries.get(id).push(geometry);
}
const features = [];
for (const [id, geometriesForId] of geometries) {
  const geometry = merge(topo, geometriesForId);
  const f = { type: 'Feature', properties: { id }, geometry };
  // d3-geo uses clockwise exteriors for small spherical polygons.
  for (const coordinates of geometry.coordinates) {
    if (geoArea({ type: 'Polygon', coordinates }) > 2 * Math.PI) coordinates.forEach(ring => ring.reverse());
  }
  features.push(f);
  const record = records.get(id);
  record.bounds = geoBounds(f);
  if (!Number.isFinite(record.lat)) [record.lng, record.lat] = geoCentroid(f);
}
// Natural Earth estimates supplement territories not covered by the World Bank.
// Use a whole-country feature, never add subunit estimates from different years.
const countryBoundaries = await read('countryBoundaries');
for (const record of records.values()) {
  if (record.population !== null) continue;
  const p = countryBoundaries.features.find(f => [f.properties.ADM0_A3, f.properties.ISO_A3, aliases[f.properties.ADM0_A3]].includes(record.id))?.properties
    ?? boundaries.features.find(f => [f.properties.GU_A3, f.properties.ISO_A3].includes(record.id))?.properties;
  if (p && p.POP_EST >= 0) {
    record.population = p.POP_EST;
    record.populationYear = p.POP_YEAR > 0 ? p.POP_YEAR : null;
    record.populationSource = 'Natural Earth';
  }
}
for (const record of records.values()) {
  if (record.population !== null && !record.populationSource) record.populationSource = 'World Bank';
  if (record.disputed) record.note = 'Status or boundaries are disputed. The outline follows Natural Earth’s map units and does not imply endorsement of a claim.';
  if (!geometries.has(record.id)) record.outlineMissing = true;
}
const overrides = {
  BVT: { relationship: 'Norway' },
  GIB: { relationship: 'United Kingdom', disputed: true, note: 'Gibraltar is administered by the United Kingdom and claimed by Spain.' },
  UMI: { relationship: 'United States' },
  GRL: { status: 'Autonomous territory', relationship: 'Kingdom of Denmark' },
  FRO: { status: 'Self-governing territory', relationship: 'Kingdom of Denmark' },
  PRI: { status: 'Territory', relationship: 'United States' },
  HKG: { status: 'Special administrative region', relationship: 'China' },
  MAC: { status: 'Special administrative region', relationship: 'China' },
  COK: { status: 'Self-governing in free association', relationship: 'New Zealand' },
  NIU: { status: 'Self-governing in free association', relationship: 'New Zealand' },
  TWN: { status: 'Self-governed · disputed status', relationship: null, disputed: true,
    note: 'Taiwan is self-governed and claimed by the People’s Republic of China. Its international status is disputed.' },
  UNK: { status: 'Partially recognized state', relationship: null, disputed: true,
    note: 'Kosovo declared independence in 2008. Recognition is not universal; Serbia claims it as part of its territory.' },
  PSE: { status: 'State · disputed boundaries', relationship: null, disputed: true,
    note: 'Palestine is a UN non-member observer State. Borders and the status of Jerusalem remain disputed.', capital: 'East Jerusalem (claimed); Ramallah (administrative)' },
  ISR: { note: 'Jerusalem is the seat of government. Its status and the area’s boundaries remain internationally disputed.', capital: 'Jerusalem (status disputed)' },
  ESH: { status: 'Disputed territory', relationship: null, disputed: true,
    note: 'Western Sahara’s sovereignty is disputed. The map uses the Natural Earth outline; it does not resolve competing claims.', capital: 'Laayoune (disputed)' },
  ATA: { status: 'Antarctic Treaty area', relationship: null, disputed: false, capital: null, population: null, populationYear: null,
    currencies: [], languages: [], lat: -82, lng: 0,
    note: 'No permanent population or national capital. Research station populations vary by season. The Antarctic Treaty preserves differing positions on territorial claims.' },
};
for (const [id, values] of Object.entries(overrides)) Object.assign(records.get(id), values);
const round = (_, value) => typeof value === 'number' ? Math.round(value * 10000) / 10000 : value;
await writeFile('src/experiments/globe/assets/boundaries.geojson', JSON.stringify({ type: 'FeatureCollection', features }, round));
await writeFile('src/experiments/globe/assets/countries.json', JSON.stringify([...records.values()].sort((a, b) => a.name.localeCompare(b.name)), round));
console.log(`${records.size} searchable places; ${features.length} outlines. Missing outlines: ${[...records.values()].filter(c => c.outlineMissing).map(c => c.name).join(', ')}`);
