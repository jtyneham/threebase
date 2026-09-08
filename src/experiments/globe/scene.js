import Globe from 'globe.gl';
import {
  AmbientLight, DirectionalLight, BufferGeometry, Float32BufferAttribute, LineBasicMaterial,
  LineSegments, Mesh, MeshPhongMaterial, Points, PointsMaterial, SphereGeometry,
  SRGBColorSpace, TextureLoader, Vector3,
} from 'three';
import { countryAtCoordinates, countryAltitude, ringsOf } from './data.js';
import earthUrl from './assets/earth.webp';
import reliefUrl from './assets/relief.png';
import cloudsUrl from './assets/clouds.webp';
import boundariesUrl from './assets/boundaries.geojson?url';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const radians = Math.PI / 180;

function position(lat, lng, radius) {
  return new Vector3(Math.cos(lat * radians) * Math.sin(lng * radians), Math.sin(lat * radians), Math.cos(lat * radians) * Math.cos(lng * radians)).multiplyScalar(radius);
}

function createStars() {
  let seed = 1729;
  const random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
  const vertices = [], colors = [];
  for (let i = 0; i < 1500; i++) {
    const point = position(Math.asin(random() * 2 - 1) / radians, random() * 360 - 180, 1800 + random() * 800);
    vertices.push(...point.toArray());
    const light = .22 + random() * .65;
    colors.push(light * .85, light * .92, light);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  const stars = new Points(geometry, new PointsMaterial({ size: 1.15, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: .7, depthWrite: false }));
  stars.raycast = () => {};
  return stars;
}

function createBorders(features, radius) {
  const vertices = [];
  for (const feature of features) for (const ring of ringsOf(feature)) {
    for (let i = 1; i < ring.length; i++) {
      const a = position(ring[i - 1][1], ring[i - 1][0], 1);
      const b = position(ring[i][1], ring[i][0], 1);
      const divisions = Math.max(1, Math.ceil(a.angleTo(b) / (.9 * radians)));
      for (let part = 0; part < divisions; part++) {
        vertices.push(...a.clone().lerp(b, part / divisions).normalize().multiplyScalar(radius).toArray(), ...a.clone().lerp(b, (part + 1) / divisions).normalize().multiplyScalar(radius).toArray());
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
  const borders = new LineSegments(geometry, new LineBasicMaterial({ color: 0xb3d8e4, transparent: true, opacity: .14, depthWrite: false }));
  borders.raycast = () => {};
  return borders;
}

export async function createGlobe({ container, card, connector, onSelect, onMessage, onRotation }) {
  const response = await fetch(boundariesUrl);
  if (!response.ok) throw new Error('Country outlines could not load.');
  const { features } = await response.json();
  const featureMap = new Map(features.map(feature => [feature.properties.id, feature]));
  const world = new Globe(container, {
    animateIn: false, waitForGlobeReady: false,
    rendererConfig: { antialias: !matchMedia('(pointer: coarse)').matches, alpha: true, powerPreference: 'default' },
  })
    .backgroundColor('#00000000')
    .showAtmosphere(true).atmosphereColor('#66aef2').atmosphereAltitude(.13)
    .globeCurvatureResolution(2)
    .polygonAltitude(.007).polygonSideColor('rgba(0,0,0,0)')
    .polygonCapColor(feature => feature.properties.id === selected?.id ? 'rgba(71,218,232,0.18)' : 'rgba(160,225,237,0.07)')
    .polygonStrokeColor(feature => feature.properties.id === selected?.id ? '#9af3fa' : '#a4cdd3')
    .polygonCapCurvatureResolution(3).polygonsTransitionDuration(0)
    .polygonLabel(() => '').pointLabel(() => '')
    .pointColor('#b3faff').pointAltitude(.012).pointRadius(.13).pointsTransitionDuration(0)
    .enablePointerInteraction(false);

  const controller = new AbortController();
  const { signal } = controller;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const coarse = matchMedia('(pointer: coarse)').matches;
  const renderer = world.renderer();
  const controls = world.controls();
  const camera = world.camera();
  const radius = world.getGlobeRadius();
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-hidden', 'true');
  renderer.setPixelRatio(Math.min(devicePixelRatio, coarse ? 1.5 : 2));
  controls.enablePan = false;
  controls.enableDamping = !reducedMotion.matches;
  controls.dampingFactor = .09;
  controls.rotateSpeed = .55;
  controls.zoomSpeed = .65;
  controls.minDistance = radius * 1.35;
  controls.maxDistance = radius * 10;
  controls.minPolarAngle = .025;
  controls.maxPolarAngle = Math.PI - .025;
  controls.autoRotateSpeed = .26;
  let selected = null, hovered = null, disposed = false, rotating = !reducedMotion.matches;
  let paused = false, contextLost = false, modalOpen = false, settleTimer = null;
  let initialView = true, width = 0, height = 0, scheduledFrame = 0;
  let preserveViewOffset = false;
  const textures = [];
  const ownedObjects = [];
  const hoverLabel = container.parentElement.querySelector('.globe-hover');
  const workspace = container.parentElement;

  const ambient = new AmbientLight(0xb7d0ed, 1.3);
  const sun = new DirectionalLight(0xfff7e9, 2.5);
  sun.position.set(-250, 150, 320);
  // Camera-relative sunlight keeps every selected country readable.
  camera.add(sun);
  if (!camera.parent) world.scene().add(camera);
  world.lights([ambient]);
  const earthMaterial = new MeshPhongMaterial({ color: 0xffffff, shininess: 8, specular: 0x233443, bumpScale: .12 });
  world.globeMaterial(earthMaterial);
  const stars = createStars();
  const borders = createBorders(features, radius * 1.0025);
  ownedObjects.push(stars, borders);
  world.scene().add(stars, borders);

  function canAnimate() { return !disposed && !document.hidden && !contextLost && !modalOpen; }
  function pause() {
    clearTimeout(settleTimer);
    world.pauseAnimation(); paused = true;
  }
  function wake(duration = 350) {
    if (!canAnimate()) return;
    if (paused) { paused = false; world.resumeAnimation(); }
    clearTimeout(settleTimer);
    if (!rotating || reducedMotion.matches) settleTimer = setTimeout(pause, duration);
  }
  function setRotation(value) {
    rotating = value && !reducedMotion.matches;
    controls.autoRotate = rotating;
    onRotation(rotating);
    wake();
  }
  function overviewAltitude() {
    const desiredRadius = Math.min(width * .43, height * .39);
    return clamp(Math.sqrt(1 + (height / (2 * Math.tan(camera.fov * radians / 2) * desiredRadius)) ** 2) - 1, 1.7, 8);
  }
  function applyHighlights() {
    world.polygonsData([...new Set([selected?.id, hovered?.id])].filter(Boolean).map(id => featureMap.get(id)).filter(Boolean));
    world.pointsData(selected?.outlineMissing ? [selected] : []);
    wake();
  }
  function positionCard() {
    if (!selected || width < 768 || card.hidden) { connector.style.visibility = 'hidden'; return; }
    const point = position(selected.lat, selected.lng, radius);
    const view = new Vector3().copy(camera.position).sub(point);
    const visible = point.dot(view) > 0;
    const screen = world.getScreenCoords(selected.lat, selected.lng, .01);
    const cardWidth = card.offsetWidth;
    const cardHeight = card.offsetHeight;
    const topMin = height < 500 ? 80 : width < 1000 ? 100 : 110;
    const cardX = clamp(screen.x + 55, 24, width - cardWidth - 85);
    const cardY = clamp(screen.y - Math.min(130, cardHeight * .3), topMin, Math.max(topMin, height - cardHeight - 64));
    card.style.left = `${cardX}px`; card.style.top = `${cardY}px`; card.style.right = 'auto';
    if (!visible || screen.x < 0 || screen.x > width || screen.y < 100 || screen.y > height - 50) { connector.style.visibility = 'hidden'; return; }
    connector.style.visibility = 'visible';
    const endX = screen.x > cardX + cardWidth / 2 ? cardX + cardWidth : cardX;
    const endY = clamp(screen.y, cardY + 30, cardY + cardHeight - 30);
    const elbowX = screen.x + (endX - screen.x) * .6;
    connector.querySelector('path').setAttribute('d', `M ${screen.x} ${screen.y} L ${elbowX} ${endY} L ${endX} ${endY}`);
    connector.querySelector('circle').setAttribute('cx', screen.x);
    connector.querySelector('circle').setAttribute('cy', screen.y);
  }
  function queueCardPosition() {
    if (scheduledFrame) return;
    scheduledFrame = requestAnimationFrame(() => { scheduledFrame = 0; positionCard(); });
  }
  function resize() {
    if (disposed) return;
    width = container.clientWidth; height = container.clientHeight;
    if (!width || !height) return;
    world.width(width).height(height);
    const narrow = width < 768;
    if (!narrow) preserveViewOffset = false;
    const offsetY = narrow ? (selected ? -Math.min(card.offsetHeight * .48, height * .26) : 26) : 0;
    // Dismissing a mobile card must not shift the globe, including on the
    // subsequent card ResizeObserver callback.
    if (!preserveViewOffset) world.globeOffset([selected && !narrow ? -width * .13 : 0, offsetY]);
    if (narrow) { card.style.removeProperty('left'); card.style.removeProperty('top'); card.style.removeProperty('right'); }
    if (initialView) world.pointOfView({ lat: 23, lng: 12, altitude: overviewAltitude() });
    queueCardPosition(); wake();
  }
  function select(country, { preserveView = false } = {}) {
    preserveViewOffset = preserveView;
    selected = country; hovered = null; initialView = false;
    setRotation(false);
    hoverLabel.hidden = true;
    applyHighlights(); resize();
    if (country) {
      const duration = reducedMotion.matches ? 0 : 1150;
      world.pointOfView({ lat: country.lat, lng: country.lng, altitude: countryAltitude(country, width < 768) }, duration);
      wake(duration + 400);
    }
    queueCardPosition();
  }
  function zoom(factor) {
    initialView = false; setRotation(false);
    const { altitude } = world.pointOfView();
    const duration = reducedMotion.matches ? 0 : 300;
    world.pointOfView({ altitude: clamp(altitude * factor, .35, 8) }, duration);
    wake(duration + 350);
  }
  function reset() {
    preserveViewOffset = false;
    selected = null; hovered = null; initialView = true;
    applyHighlights(); resize();
    world.pointOfView({ lat: 23, lng: 12, altitude: overviewAltitude() }, reducedMotion.matches ? 0 : 850);
    setRotation(!reducedMotion.matches); wake(1200);
  }

  // Explicit gesture tracking prevents a drag or two-finger pinch selecting land.
  const pointers = new Map();
  let gesture = null, hoverAt = 0;
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    pointers.set(event.pointerId, true);
    if (pointers.size === 1) gesture = { x: event.clientX, y: event.clientY, moved: false, multi: false };
    else if (gesture) gesture.multi = true;
    initialView = false; setRotation(false); wake(2000);
  }, { signal });
  canvas.addEventListener('pointermove', event => {
    if (gesture && pointers.has(event.pointerId) && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 7) gesture.moved = true;
    if (pointers.size) { wake(500); return; }
    if (event.pointerType !== 'mouse' || performance.now() - hoverAt < 90) return;
    hoverAt = performance.now();
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left, y = event.clientY - rect.top;
    const coords = world.toGlobeCoords(x, y);
    const country = coords ? countryAtCoordinates(features, coords.lat, coords.lng) : null;
    if (country?.id !== hovered?.id) { hovered = country; applyHighlights(); }
    hoverLabel.hidden = !country;
    if (country) {
      hoverLabel.textContent = country.name;
      hoverLabel.style.left = `${clamp(x + 14, 8, width - hoverLabel.offsetWidth - 12)}px`;
      hoverLabel.style.top = `${clamp(y + 14, 8, height - 38)}px`;
    }
  }, { signal });
  window.addEventListener('pointerup', event => {
    if (!pointers.has(event.pointerId)) return;
    pointers.delete(event.pointerId);
    if (!pointers.size && gesture) {
      const tap = !gesture.moved && !gesture.multi && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) <= 7;
      gesture = null;
      if (tap) {
        const rect = canvas.getBoundingClientRect();
        const coords = world.toGlobeCoords(event.clientX - rect.left, event.clientY - rect.top);
        const country = coords ? countryAtCoordinates(features, coords.lat, coords.lng) : null;
        if (country) onSelect(country);
      }
    }
    wake();
  }, { signal });
  window.addEventListener('pointercancel', () => { pointers.clear(); gesture = null; wake(); }, { signal });
  canvas.addEventListener('pointerleave', () => { hoverLabel.hidden = true; if (hovered) { hovered = null; applyHighlights(); } }, { signal });
  canvas.addEventListener('wheel', () => { initialView = false; setRotation(false); wake(500); }, { passive: true, signal });
  const onChange = () => { queueCardPosition(); if (!paused) wake(); };
  controls.addEventListener('change', onChange);
  controls.addEventListener('start', () => wake(1500));
  world.onZoom(({ altitude }) => {
    borders.material.opacity = clamp(.13 + (2 - altitude) * .08, .12, .27);
    document.getElementById('zoom-in').disabled = altitude <= .351;
    document.getElementById('zoom-out').disabled = altitude >= 7.999;
    queueCardPosition();
  });
  document.addEventListener('visibilitychange', () => document.hidden ? pause() : wake(), { signal });
  window.addEventListener('pagehide', pause, { signal });
  window.addEventListener('pageshow', () => wake(), { signal });
  reducedMotion.addEventListener('change', () => { controls.enableDamping = !reducedMotion.matches; setRotation(false); }, { signal });
  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); contextLost = true; pause(); onMessage('The globe’s graphics paused. Search and country details are still available.'); }, { signal });
  canvas.addEventListener('webglcontextrestored', () => { contextLost = false; onMessage(''); wake(); }, { signal });
  const observer = new ResizeObserver(resize); observer.observe(container);
  resize(); setRotation(rotating);

  const loader = new TextureLoader();
  const loads = await Promise.allSettled([earthUrl, reliefUrl, cloudsUrl].map(url => loader.loadAsync(url)));
  loads.forEach(result => { if (result.status === 'fulfilled') { textures.push(result.value); result.value.anisotropy = Math.min(coarse ? 2 : 4, renderer.capabilities.getMaxAnisotropy()); } });
  if (loads[0].status === 'fulfilled') {
    loads[0].value.colorSpace = SRGBColorSpace; earthMaterial.map = loads[0].value;
  } else onMessage('The satellite image couldn’t load. Country outlines and search are still available. Reload to retry the image.');
  if (loads[1].status === 'fulfilled') earthMaterial.bumpMap = loads[1].value;
  if (loads[2].status === 'fulfilled') {
    loads[2].value.colorSpace = SRGBColorSpace;
    const clouds = new Mesh(new SphereGeometry(radius * 1.004, coarse ? 48 : 72, coarse ? 32 : 48), new MeshPhongMaterial({ map: loads[2].value, transparent: true, opacity: .28, depthWrite: false, shininess: 0 }));
    clouds.raycast = () => {};
    ownedObjects.push(clouds); world.scene().add(clouds);
  }
  earthMaterial.needsUpdate = true;
  wake();

  return {
    select, zoom, resize, reset,
    stopRotation() { setRotation(false); },
    toggleRotation() {
      if (reducedMotion.matches) { onMessage('Automatic rotation is off because your device requests reduced motion. You can still drag and zoom.'); return; }
      setRotation(!rotating);
    },
    setModalOpen(open) { modalOpen = open; if (open) pause(); else wake(); },
    dispose() {
      if (disposed) return;
      disposed = true; controller.abort(); observer.disconnect();
      controls.removeEventListener('change', onChange);
      clearTimeout(settleTimer); cancelAnimationFrame(scheduledFrame); pause();
      for (const object of ownedObjects) { object.removeFromParent(); object.geometry.dispose(); object.material.dispose(); }
      sun.removeFromParent(); sun.dispose(); ambient.dispose();
      textures.forEach(texture => texture.dispose());
      world._destructor(); renderer.forceContextLoss(); container.replaceChildren();
    },
  };
}
