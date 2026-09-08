import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

// Run explicitly to refresh the checked-in, offline-capable Globe assets.
const sources = {
  boundaries: ['https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_map_units.geojson', '.globe-cache/boundaries.json'],
  countryBoundaries: ['https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson', '.globe-cache/countryBoundaries.json'],
  countries: ['https://raw.githubusercontent.com/mledoze/countries/master/countries.json', '.globe-cache/countries.json'],
  populations: ['https://api.worldbank.org/v2/country/all/indicator/SP.POP.TOTL?date=2024:2025&format=json&per_page=1000', '.globe-cache/populations.json'],
  earth: ['https://raw.githubusercontent.com/vasturiano/three-globe/master/example/img/earth-blue-marble.jpg', '.globe-cache/earth.jpg'],
  relief: ['https://raw.githubusercontent.com/vasturiano/three-globe/master/example/img/earth-topology.png', 'src/experiments/globe/assets/relief.png'],
  clouds: ['https://raw.githubusercontent.com/vasturiano/globe.gl/master/example/clouds/clouds.png', '.globe-cache/clouds.png'],
  countriesLicense: ['https://raw.githubusercontent.com/mledoze/countries/master/LICENSE', 'src/experiments/globe/assets/COUNTRIES-LICENSE.txt'],
};
await mkdir('.globe-cache', { recursive: true });
await mkdir('src/experiments/globe/assets', { recursive: true });
const provenance = await Promise.all(Object.entries(sources).map(async ([name, [url, path]]) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (path.endsWith('.json')) JSON.parse(bytes.toString());
  await writeFile(path, bytes);
  console.log(`${name}: ${bytes.length.toLocaleString()} bytes`);
  return { name, url, sha256: createHash('sha256').update(bytes).digest('hex') };
}));
await writeFile('src/experiments/globe/assets/provenance.json', JSON.stringify({ retrieved: new Date().toISOString().slice(0, 10), sources: provenance }, null, 2) + '\n');
await Promise.all([
  sharp('.globe-cache/earth.jpg').resize(4096).webp({ quality: 88 }).toFile('src/experiments/globe/assets/earth.webp'),
  sharp('.globe-cache/clouds.png').resize(2048).webp({ quality: 75 }).toFile('src/experiments/globe/assets/clouds.webp'),
]);
