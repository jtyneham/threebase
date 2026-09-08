import { initSiteShell } from '../../site-shell.js';
import './globe.css';
import { countries, countriesById, searchCountries, coordinatesLabel, flagFor, normalize } from './data.js';
import provenance from './assets/provenance.json';

const disposeShell = initSiteShell();
const controller = new AbortController();
const { signal } = controller;
const flagAssets = import.meta.glob('../../../node_modules/flag-icons/flags/4x3/*.svg', { query: '?url', import: 'default', eager: true });
function setFlag(element, country) {
  const url = flagAssets[`../../../node_modules/flag-icons/flags/4x3/${country.code.toLowerCase()}.svg`];
  if (!url || country.id === 'ATA') { element.textContent = flagFor(country); return; }
  const img = document.createElement('img'); img.src = url; img.alt = ''; img.width = 32; img.height = 24;
  element.replaceChildren(img);
}
const $ = selector => document.querySelector(selector);
const workspace = $('.globe-workspace');
const search = $('#country-search');
const list = $('#country-suggestions');
const results = $('.search-results');
const card = $('.country-card');
const announcement = $('#globe-announcement');
let matches = [];
let activeIndex = -1;
let selected = null;
let experience = null;
let disposed = false;

function announce(message) { announcement.textContent = message; }
function closeSearch() {
  results.hidden = true;
  search.setAttribute('aria-expanded', 'false');
  search.removeAttribute('aria-activedescendant');
  activeIndex = -1;
}
function setActive(index) {
  activeIndex = index;
  for (const [i, option] of [...list.children].entries()) option.setAttribute('aria-selected', String(index === i));
  if (index < 0) search.removeAttribute('aria-activedescendant');
  else {
    search.setAttribute('aria-activedescendant', list.children[index].id);
    list.children[index].scrollIntoView({ block: 'nearest' });
  }
}
function openSearch() {
  experience?.stopRotation();
  matches = searchCountries(search.value);
  list.replaceChildren(...matches.map(country => {
    const option = document.createElement('li');
    option.id = `suggestion-${country.id}`;
    option.setAttribute('role', 'option');
    option.setAttribute('aria-selected', 'false');
    option.dataset.country = country.id;
    const flag = document.createElement('span'); flag.className = 'result-flag'; setFlag(flag, country); flag.setAttribute('aria-hidden', 'true');
    const name = document.createElement('span'); name.className = 'result-name';
    const query = normalize(search.value);
    const index = query ? normalize(country.name).indexOf(query) : -1;
    if (index >= 0) {
      const mark = document.createElement('mark'); mark.textContent = country.name.slice(index, index + query.length);
      name.append(country.name.slice(0, index), mark, country.name.slice(index + query.length));
    } else name.textContent = country.name;
    const region = document.createElement('span'); region.className = 'result-region'; region.textContent = country.region === 'Americas' ? 'Americas' : country.region;
    option.append(flag, name, region);
    return option;
  }));
  $('.search-empty').hidden = matches.length > 0;
  $('.search-results__label').textContent = search.value.trim() ? 'Countries & territories' : 'A few places to begin';
  $('.search-clear').hidden = !search.value;
  results.hidden = false;
  search.setAttribute('aria-expanded', 'true');
  setActive(-1);
  if (search.value.trim()) announce(`${matches.length} suggestions available.`);
}

function fact(label, value, detail) {
  const div = document.createElement('div');
  if (value.length > 70) div.classList.add('country-fact--wide');
  const dt = document.createElement('dt'); dt.textContent = label;
  const dd = document.createElement('dd'); dd.textContent = value;
  if (detail) { const small = document.createElement('small'); small.textContent = detail; dd.append(small); }
  div.append(dt, dd); return div;
}

function fitMobileCard() {
  card.classList.remove('country-card--compact');
  if (card.hidden || !matchMedia('(max-width: 47.99rem)').matches) return;
  // Keep readable text and every detail when an unusually long record cannot
  // fit the 40% target even with the compact layout.
  const targetHeight = document.documentElement.clientHeight * .4;
  if (card.offsetHeight > targetHeight) card.classList.add('country-card--compact');
}
window.addEventListener('resize', fitMobileCard, { signal });

function selectCountry(country, { focus = false } = {}) {
  selected = country;
  closeSearch();
  search.value = ''; $('.search-clear').hidden = true;
  search.blur();
  setFlag($('.country-flag'), country);
  $('.country-region').textContent = country.subregion || country.region;
  $('#country-title').textContent = country.name;
  $('.country-status').textContent = country.status + (country.relationship ? ` · ${country.relationship}` : '');
  const antarctica = country.id === 'ATA';
  const population = antarctica ? 'No permanent residents' : country.population == null ? 'Not available' : Math.round(country.population).toLocaleString('en-US');
  $('.country-facts').replaceChildren(
    fact('Capital', country.capital || (antarctica ? 'No national capital' : 'Not listed')),
    fact('Population', population, !antarctica && country.populationYear ? `${country.populationYear} estimate · ${country.populationSource}` : null),
    fact('Area', country.area ? `${country.area.toLocaleString('en-US')} km²` : 'Not available'),
    fact('Region', country.subregion || country.region || 'Not available'),
    fact('Language' + (country.languages.length > 1 ? 's' : ''), country.languages.join(', ') || (antarctica ? 'Research communities' : 'Not listed')),
    fact('Currency', country.currencies.join(', ') || (antarctica ? 'No official currency' : 'Not listed')),
  );
  const notes = [country.note, country.outlineMissing ? 'This small territory has a location marker; an outline is not available at this map’s scale.' : null].filter(Boolean);
  $('.country-note').hidden = notes.length === 0;
  $('.country-note').textContent = notes.join(' ');
  $('.country-coordinates').textContent = coordinatesLabel(country);
  card.hidden = false;
  fitMobileCard();
  workspace.classList.add('has-selection');
  experience?.select(country);
  announce(`${country.name} selected. ${country.capital ? `Capital: ${country.capital}.` : ''}`);
  if (focus) $('#country-title').focus({ preventScroll: true });
}

function closeCard() {
  if (card.hidden) return;
  const focusInside = card.contains(document.activeElement);
  const mobile = matchMedia('(max-width: 47.99rem)').matches;
  selected = null;
  card.hidden = true;
  workspace.classList.remove('has-selection');
  experience?.select(null, { preserveView: mobile });
  if (focusInside) (mobile ? workspace : search).focus({ preventScroll: true });
}

search.addEventListener('input', openSearch, { signal });
search.addEventListener('focus', openSearch, { signal });
search.addEventListener('keydown', event => {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    if (results.hidden) openSearch();
    if (matches.length) setActive((activeIndex + (event.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length);
  } else if (event.key === 'Enter') {
    event.preventDefault();
    if (!results.hidden && matches.length) selectCountry(matches[Math.max(0, activeIndex)], { focus: true });
  } else if (event.key === 'Escape') { event.stopPropagation(); closeSearch(); }
  else if (event.key === 'Tab') closeSearch();
}, { signal });
list.addEventListener('click', event => {
  const option = event.target.closest('[data-country]');
  if (option) selectCountry(countriesById.get(option.dataset.country), { focus: event.detail === 0 });
}, { signal });
$('.search-clear').addEventListener('click', () => { search.value = ''; search.focus(); openSearch(); }, { signal });
document.addEventListener('pointerdown', event => { if (!$('#search-container').contains(event.target)) closeSearch(); }, { signal });
document.addEventListener('keydown', event => {
  if ($('.globe-about').open) return;
  if (event.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) { event.preventDefault(); search.focus(); }
  if (event.key === 'Escape') closeCard();
}, { signal });
$('.country-close').addEventListener('click', closeCard, { signal });
$('.country-locate').addEventListener('click', () => experience?.select(selected), { signal });
$('#zoom-in').addEventListener('click', () => experience?.zoom(.78), { signal });
$('#zoom-out').addEventListener('click', () => experience?.zoom(1.28), { signal });
$('#rotate-toggle').addEventListener('click', () => experience?.toggleRotation(), { signal });
$('#reset-view').addEventListener('click', () => { closeCard(); experience?.reset(); announce('Globe view reset.'); }, { signal });
$('.sources-button').addEventListener('click', () => { closeSearch(); $('.globe-about').showModal(); experience?.setModalOpen(true); }, { signal });
$('.about-close').addEventListener('click', () => $('.globe-about').close(), { signal });
$('.globe-about').addEventListener('close', () => experience?.setModalOpen(false), { signal });
$('.globe-about').addEventListener('click', event => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) event.currentTarget.close(); } }, { signal });
$('[data-place-count]').textContent = `${countries.length} countries, territories and special areas`;
$('[data-snapshot-date]').textContent = provenance.retrieved;
const cardObserver = new ResizeObserver(() => {
  workspace.style.setProperty('--card-height', `${card.offsetHeight}px`);
  experience?.resize();
});
cardObserver.observe(card);

function message(text) { $('.globe-message').textContent = text; $('.globe-message').hidden = !text; }
async function start() {
  try {
    const { createGlobe } = await import('./scene.js');
    if (disposed) return;
    experience = await createGlobe({ container: $('#globe-stage'), card, connector: $('.card-connector'), onSelect: selectCountry, onMessage: message,
      onRotation: rotating => {
        $('#rotate-toggle').setAttribute('aria-pressed', String(rotating));
        $('#rotate-toggle').setAttribute('aria-label', rotating ? 'Pause automatic rotation' : 'Start automatic rotation');
      },
    });
    if (disposed) { experience.dispose(); return; }
    if (selected) experience.select(selected);
  } catch (error) {
    console.error('Globe unavailable', error);
    message('The 3D globe couldn’t load. You can still search countries and read their details. Reload to try the globe again.');
    for (const button of $('.globe-controls').querySelectorAll('button')) button.disabled = true;
    $('.country-locate').disabled = true;
  } finally { $('.globe-loading').hidden = true; }
}
start();

function dispose() { disposed = true; controller.abort(); cardObserver.disconnect(); disposeShell(); experience?.dispose(); }
window.addEventListener('pagehide', event => { if (!event.persisted) dispose(); });
if (import.meta.hot) import.meta.hot.dispose(dispose);
