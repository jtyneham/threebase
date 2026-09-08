import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { countries, countriesById, searchCountries, countryAtCoordinates, countryAltitude } from './data.js';

const { features } = JSON.parse(await readFile(new URL('./assets/boundaries.geojson', import.meta.url), 'utf8'));

test('autocomplete ranks country prefixes and supports aliases and accents', () => {
  assert(searchCountries('G').some(c => c.id === 'DEU'));
  assert(searchCountries('G').some(c => c.id === 'GRL'));
  assert.equal(searchCountries('Deutschland')[0].id, 'DEU');
  assert.equal(searchCountries('UK')[0].id, 'GBR');
  assert.equal(searchCountries('reunion')[0].id, 'REU');
  assert.equal(searchCountries('Cote')[0].id, 'CIV');
  assert.deepEqual(searchCountries('zzzznotacountry'), []);
  assert(searchCountries('').length > 0);
});

test('picking matches mainland, overseas territories, microstates and ocean', () => {
  for (const [lat, lng, id] of [
    [52.52, 13.405, 'DEU'], [48.8566, 2.3522, 'FRA'], [5, -53, 'GUF'],
    [72, -40, 'GRL'], [18.22, -66.59, 'PRI'], [55.95, -3.19, 'GBR'],
    [-85, 0, 'ATA'], [-17.8, 178, 'FJI'], [66, 172, 'RUS'],
    // The Vatican polygon is generalized at 1:50m; use its mapped interior.
    [41.9018, 12.4339, 'VAT'], [-30, -30, null], [0, -140, null],
  ]) assert.equal(countryAtCoordinates(features, lat, lng)?.id ?? null, id, `${lat}, ${lng}`);
});

test('every outline and search result has a coherent record', () => {
  assert.equal(new Set(countries.map(c => c.id)).size, countries.length);
  for (const f of features) {
    assert(countriesById.has(f.properties.id));
    assert(countriesById.get(f.properties.id).bounds);
  }
  for (const c of countries) {
    assert(c.name && Number.isFinite(c.lat) && Number.isFinite(c.lng), c.name);
    assert(c.lat >= -90 && c.lat <= 90 && c.lng >= -180 && c.lng <= 180, c.name);
    assert(c.population === null || c.population >= 0, c.name);
    assert(c.outlineMissing || features.some(f => f.properties.id === c.id), c.name);
  }
});

test('territories, Antarctica and disputed status retain their context', () => {
  assert.equal(countriesById.get('GRL').relationship, 'Kingdom of Denmark');
  assert.equal(countriesById.get('ATA').population, null);
  assert.equal(countriesById.get('ATA').capital, null);
  assert(countriesById.get('ATA').note.includes('Treaty'));
  for (const id of ['UNK', 'TWN', 'PSE', 'ESH']) assert(countriesById.get(id).disputed && countriesById.get(id).note);
});

test('zoom targets stay usable for tiny places and large countries', () => {
  assert(countryAltitude(countriesById.get('VAT'), true) >= .85);
  assert(countryAltitude(countriesById.get('RUS')) <= 2.3);
});
