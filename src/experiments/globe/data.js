import countries from './assets/countries.json' with { type: 'json' };
import { geoContains } from 'd3-geo';

export { countries };
export const countriesById = new Map(countries.map(country => [country.id, country]));
export const normalize = text => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
const searchIndex = countries.map(country => ({ country, name: normalize(country.name), aliases: [country.officialName, country.id, country.code, ...country.aliases].map(normalize) }));
// Pick six distinct places once per page load, so reopening search stays steady.
const starterSuggestions = (() => {
  const pool = [...countries];
  for (let i = 0; i < 6; i++) {
    const next = i + Math.floor(Math.random() * (pool.length - i));
    [pool[i], pool[next]] = [pool[next], pool[i]];
  }
  return pool.slice(0, 6);
})();

export function searchCountries(query, limit = 8) {
  const key = normalize(query);
  if (!key) return starterSuggestions.slice(0, limit);
  return searchIndex.map(entry => {
    const score = entry.name === key ? 0 : entry.aliases.some(a => a === key) ? .5 : entry.name.startsWith(key) ? 1 : entry.name.includes(key) ? 3 : entry.aliases.some(a => a.startsWith(key)) ? 4 : entry.aliases.some(a => a.includes(key)) ? 5 : 99;
    return { ...entry, score };
  }).filter(entry => entry.score < 99).sort((a, b) => a.score - b.score || a.name.localeCompare(b.name)).slice(0, limit).map(entry => entry.country);
}

export function ringsOf(feature) {
  return feature.geometry.type === 'Polygon' ? feature.geometry.coordinates : feature.geometry.coordinates.flat();
}

export function countryAtCoordinates(features, lat, lng) {
  let match = null;
  for (const feature of features) {
    const country = countriesById.get(feature.properties.id);
    const [[west, south], [east, north]] = country.bounds;
    if (lat < south || lat > north) continue;
    if (west <= east ? lng < west || lng > east : lng < west && lng > east) continue;
    // Generalized boundaries can overlap around enclaves. Prefer the smaller place.
    if (geoContains(feature, [lng, lat]) && (!match || (country.area ?? Infinity) < (match.area ?? Infinity))) match = country;
  }
  return match;
}

export function countryAltitude(country, narrow = false) {
  // Country-level exploration, with a comfortable lower limit for tiny islands.
  const area = country.area ?? 100000;
  return Math.min(2.3, Math.max(narrow ? .85 : .55, Math.sqrt(area) / 2700));
}

export function coordinatesLabel(country) {
  return `${Math.abs(country.lat).toFixed(1)}° ${country.lat < 0 ? 'S' : 'N'}  /  ${Math.abs(country.lng).toFixed(1)}° ${country.lng < 0 ? 'W' : 'E'}`;
}

export function flagFor(country) {
  return country.code && country.id !== 'ATA' ? String.fromCodePoint(...[...country.code.toUpperCase()].map(c => c.charCodeAt(0) + 127397)) : '◎';
}
