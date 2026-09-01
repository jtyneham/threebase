import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export type BicMiniLighterRuntime = {
  nodes: Record<string, THREE.Object3D>;
  meshes: Record<string, THREE.Mesh>;
  sockets: Record<string, THREE.Object3D>;
  colliders: Record<string, unknown>;
  destructionGroups: Record<string, THREE.Object3D[]>;
};

type TextureDraw = (context: CanvasRenderingContext2D, width: number, height: number) => void;

function canvasTexture(width: number, height: number, draw: TextureDraw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d')!;
  draw(context, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function roughnessTexture(kind: 'plastic' | 'metal', seed = 17) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d')!;
  const image = context.createImageData(size, size);
  let value = seed >>> 0;
  const random = () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0xffffffff;
  };
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const grain = kind === 'metal'
        ? Math.sin(y * 1.8 + random() * 2.2) * 12 + (random() - 0.5) * 22
        : (random() - 0.5) * 28 + Math.sin((x + y) * 0.055) * 5;
      const tone = THREE.MathUtils.clamp((kind === 'metal' ? 110 : 120) + grain, 55, 205);
      const index = (y * size + x) * 4;
      image.data[index] = tone;
      image.data[index + 1] = tone;
      image.data[index + 2] = tone;
      image.data[index + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(kind === 'metal' ? 2 : 1.25, kind === 'metal' ? 7 : 2.5);
  return texture;
}

function superellipseOutline(width: number, height: number, exponent = 4.25, segments = 80, taper = 0.94) {
  const points: THREE.Vector2[] = [];
  const power = 2 / exponent;
  for (let index = 0; index < segments; index += 1) {
    const angle = index / segments * Math.PI * 2;
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    const yNormalized = Math.sign(sine) * Math.pow(Math.abs(sine), power);
    const widthScale = THREE.MathUtils.lerp(taper, 1, (yNormalized + 1) * 0.5);
    points.push(new THREE.Vector2(
      Math.sign(cosine) * Math.pow(Math.abs(cosine), power) * width * 0.5 * widthScale,
      yNormalized * height * 0.5,
    ));
  }
  return points;
}

function lighterBodyOutline(width: number, height: number) {
  const halfWidth = width * 0.5;
  const halfHeight = height * 0.5;
  const bottomHalfWidth = halfWidth * 0.955;
  const corner = Math.min(2.6, width * 0.12);
  const shape = new THREE.Shape();
  shape.moveTo(-halfWidth + corner, halfHeight);
  shape.lineTo(halfWidth - corner, halfHeight);
  shape.quadraticCurveTo(halfWidth, halfHeight, halfWidth, halfHeight - corner);
  shape.lineTo(bottomHalfWidth, -halfHeight + corner);
  shape.quadraticCurveTo(bottomHalfWidth, -halfHeight, bottomHalfWidth - corner, -halfHeight);
  shape.lineTo(-bottomHalfWidth + corner, -halfHeight);
  shape.quadraticCurveTo(-bottomHalfWidth, -halfHeight, -bottomHalfWidth, -halfHeight + corner);
  shape.lineTo(-halfWidth, halfHeight - corner);
  shape.quadraticCurveTo(-halfWidth, halfHeight, -halfWidth + corner, halfHeight);
  shape.closePath();
  return shape.getSpacedPoints(80).slice(0, -1);
}

function capsuleHalfWidthAtDepth(width: number, depth: number, z: number) {
  const radius = depth * 0.5;
  const straightHalfWidth = Math.max(0, width * 0.5 - radius);
  const clampedZ = THREE.MathUtils.clamp(z, -radius, radius);
  return straightHalfWidth + Math.sqrt(Math.max(0, radius * radius - clampedZ * clampedZ));
}

function capsuleSurfaceDepthAtX(width: number, depth: number, x: number) {
  const radius = depth * 0.5;
  const straightHalfWidth = Math.max(0, width * 0.5 - radius);
  const curvedX = Math.max(0, Math.abs(x) - straightHalfWidth);
  return Math.sqrt(Math.max(0, radius * radius - curvedX * curvedX));
}

function loftedRoundedBody(width: number, height: number, depth: number, taper = 0.94) {
  const outline = height > 12
    ? lighterBodyOutline(width, height)
    : superellipseOutline(width, height, 4.35, 80, taper);
  const halfDepth = depth * 0.5;
  const slices = [-1, -0.94, -0.78, -0.52, -0.26, 0, 0.26, 0.52, 0.78, 0.94, 1].map((depthRatio) => {
    const z = halfDepth * depthRatio;
    return {
      z,
      xScale: capsuleHalfWidthAtDepth(width, depth, z) / (width * 0.5),
      yScale: 1 - Math.abs(depthRatio) * 0.004,
    };
  });
  const positions: number[] = [];
  const indices: number[] = [];
  for (const slice of slices) {
    for (const point of outline) positions.push(point.x * slice.xScale, point.y * slice.yScale, slice.z);
  }
  const ring = outline.length;
  for (let slice = 0; slice < slices.length - 1; slice += 1) {
    for (let point = 0; point < ring; point += 1) {
      const next = (point + 1) % ring;
      const a = slice * ring + point;
      const b = slice * ring + next;
      const c = (slice + 1) * ring + next;
      const d = (slice + 1) * ring + point;
      indices.push(a, b, d, b, c, d);
    }
  }
  const capTriangles = THREE.ShapeUtils.triangulateShape(outline, []);
  const backSlice = slices[0];
  const backCapStart = positions.length / 3;
  for (const point of outline) {
    positions.push(point.x * backSlice.xScale, point.y * backSlice.yScale, backSlice.z);
  }
  const frontSlice = slices[slices.length - 1];
  const frontCapStart = positions.length / 3;
  for (const point of outline) {
    positions.push(point.x * frontSlice.xScale, point.y * frontSlice.yScale, frontSlice.z);
  }
  for (const [a, b, c] of capTriangles) {
    indices.push(backCapStart + a, backCapStart + c, backCapStart + b);
    indices.push(frontCapStart + a, frontCapStart + b, frontCapStart + c);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function curvedFrontPlane(width: number, height: number, centerX: number, bodyWidth: number, bodyDepth: number) {
  const geometry = new THREE.PlaneGeometry(width, height, 28, 1);
  const position = geometry.getAttribute('position');
  for (let index = 0; index < position.count; index += 1) {
    const objectX = position.getX(index) + centerX;
    position.setZ(index, capsuleSurfaceDepthAtX(bodyWidth, bodyDepth, objectX) + 0.045);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

function capsuleBandGeometry(width: number, height: number, depth: number) {
  const radius = depth * 0.5;
  const straightHalfWidth = Math.max(0, width * 0.5 - radius);
  const shape = new THREE.Shape();
  shape.moveTo(-straightHalfWidth, -radius);
  shape.lineTo(straightHalfWidth, -radius);
  shape.absarc(straightHalfWidth, 0, radius, -Math.PI * 0.5, Math.PI * 0.5, false);
  shape.lineTo(-straightHalfWidth, radius);
  shape.absarc(-straightHalfWidth, 0, radius, Math.PI * 0.5, Math.PI * 1.5, false);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: false,
    curveSegments: 32,
  });
  geometry.translate(0, 0, -height * 0.5);
  geometry.rotateX(-Math.PI * 0.5);
  geometry.computeVertexNormals();
  return geometry;
}

function flameProfileGeometry(height: number, maxRadius: number, baseRadius: number, segments: number) {
  const points = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(baseRadius, height * 0.018),
    new THREE.Vector2(maxRadius * 0.28, height * 0.055),
    new THREE.Vector2(maxRadius * 0.46, height * 0.12),
    new THREE.Vector2(maxRadius * 0.68, height * 0.2),
    new THREE.Vector2(maxRadius * 0.9, height * 0.28),
    new THREE.Vector2(maxRadius, height * 0.36),
    new THREE.Vector2(maxRadius * 0.97, height * 0.44),
    new THREE.Vector2(maxRadius * 0.89, height * 0.53),
    new THREE.Vector2(maxRadius * 0.78, height * 0.62),
    new THREE.Vector2(maxRadius * 0.63, height * 0.72),
    new THREE.Vector2(maxRadius * 0.47, height * 0.81),
    new THREE.Vector2(maxRadius * 0.3, height * 0.89),
    new THREE.Vector2(maxRadius * 0.15, height * 0.95),
    new THREE.Vector2(0, height),
  ];
  const geometry = new THREE.LatheGeometry(points, segments);
  geometry.computeVertexNormals();
  return geometry;
}

function extrudedShape(shape: THREE.Shape, depth: number, bevelSize = 0.28, bevelSegments = 3) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.02, depth - bevelSize * 2),
    bevelEnabled: true,
    bevelThickness: bevelSize,
    bevelSize,
    bevelSegments,
    curveSegments: 18,
  });
  geometry.translate(0, 0, -depth * 0.5);
  geometry.computeVertexNormals();
  return geometry;
}

function roundedRectPath(x: number, y: number, width: number, height: number, radius: number) {
  const path = new THREE.Path();
  path.moveTo(x + radius, y);
  path.lineTo(x + width - radius, y);
  path.quadraticCurveTo(x + width, y, x + width, y + radius);
  path.lineTo(x + width, y + height - radius);
  path.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  path.lineTo(x + radius, y + height);
  path.quadraticCurveTo(x, y + height, x, y + height - radius);
  path.lineTo(x, y + radius);
  path.quadraticCurveTo(x, y, x + radius, y);
  path.closePath();
  return path;
}

function hoodPlateShape() {
  const shape = new THREE.Shape();
  shape.moveTo(-1.95, -6.55);
  shape.lineTo(-1.95, 6.75);
  shape.lineTo(6.55, 6.75);
  shape.quadraticCurveTo(7.15, 6.75, 7.15, 6.1);
  shape.lineTo(7.15, -6.55);
  shape.closePath();
  shape.holes.push(roundedRectPath(4.05, -3.35, 1.95, 1.5, 0.34));
  return shape;
}

function hoodTopShape() {
  const halfWidth = 7.15;
  const radius = 5.2;
  const straightHalfWidth = halfWidth - radius;
  const shape = new THREE.Shape();
  shape.moveTo(-straightHalfWidth, -radius);
  shape.lineTo(straightHalfWidth, -radius);
  shape.absarc(straightHalfWidth, 0, radius, -Math.PI * 0.5, Math.PI * 0.5, false);
  shape.lineTo(-straightHalfWidth, radius);
  shape.absarc(-straightHalfWidth, 0, radius, Math.PI * 0.5, Math.PI * 1.5, false);
  shape.closePath();

  const burnerOpening = new THREE.Path();
  burnerOpening.absarc(-4.25, 0, 2.05, 0, Math.PI * 2, true);
  shape.holes.push(burnerOpening);
  shape.holes.push(roundedRectPath(2.15, -2.8, 4.0, 5.6, 0.9));
  return shape;
}

function hoodBurnerEndWrapGeometry() {
  const endCenterX = -1.95;
  const endRadius = 5.2;
  const yBottom = -6.55;
  const yTop = 6.38;
  const segments = 36;
  const positions: number[] = [];
  const indices: number[] = [];
  for (const y of [yBottom, yTop]) {
    for (let segment = 0; segment <= segments; segment += 1) {
      const angle = -Math.PI * 0.5 + segment / segments * Math.PI;
      positions.push(
        endCenterX - Math.cos(angle) * endRadius,
        y,
        Math.sin(angle) * endRadius,
      );
    }
  }
  const row = segments + 1;
  for (let segment = 0; segment < segments; segment += 1) {
    const a = segment;
    const b = segment + 1;
    const c = row + segment + 1;
    const d = row + segment;
    indices.push(a, b, d, b, c, d);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function leverShape() {
  const shape = new THREE.Shape();
  shape.moveTo(-3.9, -2.1);
  shape.lineTo(2.65, -2.1);
  shape.bezierCurveTo(4.0, -2.1, 4.45, -1.25, 4.45, 0.1);
  shape.bezierCurveTo(4.45, 1.55, 3.55, 2.25, 2.25, 2.25);
  shape.lineTo(-3.0, 2.25);
  shape.quadraticCurveTo(-4.0, 1.2, -3.9, -2.1);
  return shape;
}

function markSurfaceDetail(object: THREE.Object3D) {
  object.userData.explodeWithParent = true;
  object.renderOrder = 3;
  return object;
}

export function createBicMiniLighterModel() {
  const root = new THREE.Group();
  root.name = 'root';

  const runtime: BicMiniLighterRuntime = {
    nodes: {root},
    meshes: {},
    sockets: {},
    colliders: {},
    destructionGroups: {},
  };

  const register = <T extends THREE.Object3D>(id: string, object: T, parent: THREE.Object3D = root) => {
    object.name = id;
    parent.add(object);
    runtime.nodes[id] = object;
    if (object instanceof THREE.Mesh) runtime.meshes[id] = object;
    return object;
  };

  const plasticRoughness = roughnessTexture('plastic', 31);
  const metalRoughness = roughnessTexture('metal', 73);
  const bodyMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x06080a,
    roughness: 0.31,
    roughnessMap: plasticRoughness,
    metalness: 0,
    clearcoat: 0.36,
    clearcoatRoughness: 0.24,
    side: THREE.DoubleSide,
  });
  const collarMaterial = new THREE.MeshPhysicalMaterial({color: 0x030405, roughness: 0.4, clearcoat: 0.18, clearcoatRoughness: 0.35});
  const redMaterial = new THREE.MeshPhysicalMaterial({color: 0xc70d32, roughness: 0.25, clearcoat: 0.55, clearcoatRoughness: 0.17});
  const hoodMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xaab2b9,
    roughness: 0.29,
    roughnessMap: metalRoughness,
    metalness: 0.92,
    anisotropy: 0.72,
    anisotropyRotation: Math.PI * 0.5,
    side: THREE.DoubleSide,
  });
  const hoodWrapMaterial = new THREE.MeshBasicMaterial({
    color: 0xb8c0c5,
    side: THREE.DoubleSide,
    toneMapped: true,
  });
  const wheelMaterial = new THREE.MeshStandardMaterial({color: 0x697177, roughness: 0.4, roughnessMap: metalRoughness, metalness: 0.91});
  const wheelBandMaterial = new THREE.MeshStandardMaterial({color: 0x929ba1, roughness: 0.24, roughnessMap: metalRoughness, metalness: 0.96});
  const bottomMaterial = new THREE.MeshPhysicalMaterial({color: 0xb8d8e8, roughness: 0.38, clearcoat: 0.24, clearcoatRoughness: 0.28});
  const darkMaterial = new THREE.MeshStandardMaterial({color: 0x010203, roughness: 0.82, metalness: 0});
  const nozzleMaterial = new THREE.MeshStandardMaterial({color: 0xcfd6da, roughness: 0.24, metalness: 0.86});

  const body = register('body-shell', new THREE.Mesh(loftedRoundedBody(22, 50.8, 11, 0.94), bodyMaterial));
  body.position.y = -5.2;
  body.castShadow = body.receiveShadow = true;

  const bottomGeometry = capsuleBandGeometry(20.2, 1.55, 10.3);
  const bottom = register('bottom-plug', new THREE.Mesh(bottomGeometry, bottomMaterial));
  bottom.position.y = -30.95;
  bottom.castShadow = true;

  const collar = register('top-collar', new THREE.Mesh(loftedRoundedBody(21.35, 4.35, 10.7, 0.97), collarMaterial));
  collar.position.y = 21.35;
  collar.castShadow = true;

  const ignitionHead = register('ignition-head', new THREE.Group());
  runtime.destructionGroups.ignition = [];

  const hood = register('metal-hood', new THREE.Group(), ignitionHead);
  hood.position.set(-2.55, 27.15, 0);
  hood.scale.y = 0.9;
  const frontPlateGeometry = extrudedShape(hoodPlateShape(), 0.58, 0.11, 2);
  const rearPlateGeometry = extrudedShape(hoodPlateShape(), 0.58, 0.11, 2);
  const frontPlate = register('hood-front-plate', new THREE.Mesh(frontPlateGeometry, hoodMaterial), hood);
  frontPlate.position.z = 4.95;
  frontPlate.castShadow = true;
  const rearPlate = register('hood-rear-plate', new THREE.Mesh(rearPlateGeometry, hoodMaterial), hood);
  rearPlate.position.z = -4.95;
  rearPlate.castShadow = true;
  const burnerEndWrap = markSurfaceDetail(register('hood-burner-end-wrap', new THREE.Mesh(hoodBurnerEndWrapGeometry(), hoodWrapMaterial), hood));
  burnerEndWrap.castShadow = true;

  const hoodTopGeometry = extrudedShape(hoodTopShape(), 0.68, 0.12, 2);
  hoodTopGeometry.rotateX(-Math.PI / 2);
  const crown = register('hood-crown-bridge', new THREE.Mesh(hoodTopGeometry, hoodMaterial), hood);
  crown.position.y = 6.38;
  crown.castShadow = true;
  const burnerRimGeometry = new THREE.TorusGeometry(2.05, 0.34, 14, 52);
  burnerRimGeometry.rotateX(Math.PI / 2);
  const burnerRim = new THREE.Mesh(burnerRimGeometry, hoodMaterial);
  burnerRim.position.set(-4.25, 6.73, 0);
  burnerRim.castShadow = true;
  hood.add(burnerRim);
  const flameCavity = register('flame-cavity', new THREE.Mesh(new THREE.CylinderGeometry(1.92, 2.02, 1.35, 40, 1, true), darkMaterial), hood);
  flameCavity.position.set(-4.25, 6.0, 0);
  const ventInterior = register('hood-vent-inserts', new THREE.Group(), hood);
  const burnerVentX = -5.4;
  const burnerVentLocalX = burnerVentX + 1.95;
  const burnerVentDepth = Math.sqrt(Math.max(0, 5.2 * 5.2 - burnerVentLocalX * burnerVentLocalX));
  for (const zSign of [-1, 1]) {
    const vent = new THREE.Mesh(new RoundedBoxGeometry(1.1, 2.7, 0.16, 2, 0.22), darkMaterial);
    vent.position.set(burnerVentX, 2.68, zSign * (burnerVentDepth + 0.04));
    vent.rotation.y = Math.atan2(burnerVentLocalX / 5.2, zSign * burnerVentDepth / 5.2);
    ventInterior.add(vent);
    const lower = new THREE.Mesh(new RoundedBoxGeometry(2.1, 1.55, 0.16, 2, 0.25), darkMaterial);
    lower.position.set(5.03, -2.6, zSign * 4.83);
    ventInterior.add(lower);
  }

  const wheel = register('spark-wheel', new THREE.Group(), ignitionHead);
  wheel.position.set(3.15, 29.65, 0);
  wheel.scale.setScalar(0.9);
  const rimGeometry = new THREE.CylinderGeometry(3.82, 3.82, 1.72, 48, 2);
  rimGeometry.rotateX(Math.PI / 2);
  const frontRim = register('wheel-front-rim', new THREE.Mesh(rimGeometry, wheelMaterial), wheel);
  frontRim.position.z = 3.2;
  const rearRim = register('wheel-rear-rim', new THREE.Mesh(rimGeometry.clone(), wheelMaterial), wheel);
  rearRim.position.z = -3.2;
  const centerGeometry = new THREE.CylinderGeometry(4.5, 4.5, 4.85, 64, 2);
  centerGeometry.rotateX(Math.PI / 2);
  register('wheel-center-band', new THREE.Mesh(centerGeometry, wheelBandMaterial), wheel);
  const axleGeometry = new THREE.CylinderGeometry(0.62, 0.62, 11.35, 20);
  axleGeometry.rotateX(Math.PI / 2);
  register('wheel-axle', new THREE.Mesh(axleGeometry, nozzleMaterial), ignitionHead).position.set(3.15, 29.65, 0);

  const toothGeometry = new THREE.BoxGeometry(0.38, 0.52, 1.46);
  toothGeometry.translate(0, 0.1, 0);
  const teeth = new THREE.InstancedMesh(toothGeometry, wheelMaterial, 64);
  teeth.name = 'wheel-teeth';
  const dummy = new THREE.Object3D();
  let toothIndex = 0;
  for (const z of [-3.2, 3.2]) {
    for (let index = 0; index < 32; index += 1) {
      const angle = index / 32 * Math.PI * 2;
      dummy.position.set(Math.cos(angle) * 3.86, Math.sin(angle) * 3.86, z);
      dummy.rotation.set(0, 0, angle - Math.PI * 0.5);
      dummy.scale.set(1, 0.88 + Math.sin(index * 2.73) * 0.045, 1);
      dummy.updateMatrix();
      teeth.setMatrixAt(toothIndex, dummy.matrix);
      toothIndex += 1;
    }
  }
  wheel.add(teeth);
  runtime.nodes['wheel-teeth'] = teeth;
  runtime.meshes['wheel-teeth'] = teeth;
  wheel.traverse((part) => {
    if (part instanceof THREE.Mesh) part.castShadow = true;
  });

  const lever = register('fuel-lever', new THREE.Group(), ignitionHead);
  lever.position.set(6.35, 23.85, 0);
  const leverPaddle = new THREE.Mesh(extrudedShape(leverShape(), 9.15, 0.32, 4), redMaterial);
  leverPaddle.castShadow = true;
  lever.add(leverPaddle);
  const leverLip = new THREE.Mesh(new RoundedBoxGeometry(8.7, 0.52, 9.55, 4, 0.24), redMaterial);
  leverLip.position.set(0.2, 2.12, 0);
  leverLip.castShadow = true;
  lever.add(leverLip);
  const stem = register('lever-stem', new THREE.Mesh(new RoundedBoxGeometry(3.5, 4.0, 6.8, 4, 0.58), redMaterial), lever);
  stem.position.set(-2.5, -2.65, 0);
  const moldDotMaterial = new THREE.MeshStandardMaterial({color: 0x85021d, roughness: 0.42});
  for (const z of [-2.55, 2.55]) {
    const moldDot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.08, 18), moldDotMaterial);
    moldDot.position.set(2.65, 2.42, z);
    lever.add(moldDot);
  }

  const nozzleGeometry = new THREE.CylinderGeometry(0.92, 0.92, 4.5, 24);
  const nozzle = register('gas-nozzle', new THREE.Mesh(nozzleGeometry, nozzleMaterial), ignitionHead);
  nozzle.position.set(-6.85, 28.75, 0);
  nozzle.castShadow = true;
  const nozzleOpening = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.08, 18), darkMaterial);
  nozzleOpening.position.y = 2.27;
  nozzle.add(nozzleOpening);

  const decalMap = canvasTexture(1024, 384, (context, width, height) => {
    context.clearRect(0, 0, width, height);
    context.save();
    context.translate(12, 12);
    context.rotate(-0.035);
    context.lineJoin = 'round';

    const paleBlue = '#c7eafb';
    const ink = '#070a0d';
    const yellow = '#f4b900';

    context.fillStyle = paleBlue;
    context.beginPath();
    context.roundRect(190, 50, 792, 270, 62);
    context.fill();
    context.fillStyle = ink;
    context.beginPath();
    context.roundRect(210, 68, 754, 234, 49);
    context.fill();
    context.fillStyle = yellow;
    context.beginPath();
    context.roundRect(225, 82, 724, 206, 40);
    context.fill();

    context.fillStyle = ink;
    context.font = 'italic 900 215px Arial Black, Arial, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText('BIC', 585, 195);

    context.strokeStyle = paleBlue;
    context.lineWidth = 23;
    context.lineCap = 'round';
    context.beginPath();
    context.moveTo(106, 205);
    context.lineTo(70, 286);
    context.moveTo(142, 205);
    context.lineTo(170, 286);
    context.moveTo(82, 148);
    context.lineTo(28, 194);
    context.moveTo(148, 139);
    context.lineTo(188, 88);
    context.stroke();

    context.fillStyle = paleBlue;
    context.beginPath();
    context.roundRect(56, 112, 128, 124, 34);
    context.fill();
    context.fillStyle = yellow;
    context.strokeStyle = ink;
    context.lineWidth = 12;
    context.beginPath();
    context.roundRect(72, 128, 96, 92, 22);
    context.fill();
    context.stroke();

    context.fillStyle = paleBlue;
    context.beginPath();
    context.arc(126, 78, 58, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = ink;
    context.beginPath();
    context.arc(126, 78, 40, 0, Math.PI * 2);
    context.fill();

    context.strokeStyle = paleBlue;
    context.lineWidth = 29;
    context.beginPath();
    context.moveTo(143, 134);
    context.lineTo(193, 56);
    context.stroke();
    context.strokeStyle = ink;
    context.lineWidth = 13;
    context.beginPath();
    context.moveTo(143, 134);
    context.lineTo(193, 56);
    context.stroke();

    context.strokeStyle = ink;
    context.lineWidth = 11;
    context.beginPath();
    context.moveTo(104, 218);
    context.lineTo(70, 286);
    context.moveTo(142, 218);
    context.lineTo(170, 286);
    context.moveTo(73, 150);
    context.lineTo(28, 194);
    context.stroke();
    context.restore();
  });
  const decalMaterial = new THREE.MeshBasicMaterial({map: decalMap, transparent: true, alphaTest: 0.08, depthWrite: false, toneMapped: false});
  const decalCenterX = 0.75;
  const decal = markSurfaceDetail(register('front-bic-decal', new THREE.Mesh(curvedFrontPlane(11.35, 4.4, decalCenterX, 22, 11), decalMaterial), body));
  decal.position.set(decalCenterX, 20.6, 0);

  const frontMarkMap = canvasTexture(512, 256, (context, width, height) => {
    context.clearRect(0, 0, width, height);
    context.strokeStyle = 'rgba(39,45,50,.88)';
    context.fillStyle = 'rgba(39,45,50,.82)';
    context.lineWidth = 5;
    context.beginPath();
    context.arc(72, 87, 24, 0, Math.PI * 2);
    context.stroke();
    context.beginPath();
    context.moveTo(72, 112);
    context.lineTo(72, 170);
    context.moveTo(72, 127);
    context.lineTo(40, 151);
    context.moveTo(72, 127);
    context.lineTo(105, 98);
    context.stroke();
    context.strokeRect(125, 48, 285, 132);
    context.font = 'italic 900 106px Arial Black, Arial, sans-serif';
    context.fillText('BIC', 146, 153);
    context.font = '38px Arial, sans-serif';
    context.fillText('®', 418, 82);
  });
  const engravingMaterial = new THREE.MeshBasicMaterial({map: frontMarkMap, transparent: true, opacity: 0.72, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2});
  const frontMark = markSurfaceDetail(register('hood-front-mark', new THREE.Mesh(new THREE.PlaneGeometry(7.2, 3.2), engravingMaterial), hood));
  frontMark.position.set(-0.9, -0.65, 5.26);

  const rearMarkMap = canvasTexture(768, 420, (context, width) => {
    context.clearRect(0, 0, width, 420);
    context.fillStyle = 'rgba(39,45,50,.88)';
    context.textAlign = 'center';
    context.font = '600 72px Arial, sans-serif';
    context.fillText('made in France', width * 0.5, 160);
    context.font = '700 70px Arial, sans-serif';
    context.fillText('r1 120 2', width * 0.5, 262);
  });
  const rearMarkMaterial = new THREE.MeshBasicMaterial({map: rearMarkMap, transparent: true, opacity: 0.92, depthWrite: false, depthTest: true, side: THREE.DoubleSide, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -3});
  const rearMark = markSurfaceDetail(register('hood-rear-mark', new THREE.Mesh(new THREE.PlaneGeometry(8.2, 4.5), rearMarkMaterial), hood));
  rearMark.position.set(-1.0, -0.55, -5.36);
  rearMark.rotation.y = Math.PI;

  const embossMap = canvasTexture(512, 256, (context, width, height) => {
    context.clearRect(0, 0, width, height);
    context.strokeStyle = 'rgba(105,0,28,.72)';
    context.lineWidth = 8;
    context.roundRect(112, 48, 320, 150, 36);
    context.stroke();
    context.fillStyle = 'rgba(105,0,28,.65)';
    context.font = 'italic 900 104px Arial Black, Arial, sans-serif';
    context.textAlign = 'center';
    context.fillText('BIC', 274, height * 0.66);
    context.strokeStyle = 'rgba(105,0,28,.72)';
    context.beginPath();
    context.arc(74, 82, 27, 0, Math.PI * 2);
    context.moveTo(74, 110);
    context.lineTo(74, 176);
    context.moveTo(74, 128);
    context.lineTo(40, 155);
    context.moveTo(74, 128);
    context.lineTo(111, 92);
    context.stroke();
    context.beginPath();
    context.arc(466, 72, 10, 0, Math.PI * 2);
    context.stroke();
  });
  const embossMaterial = new THREE.MeshBasicMaterial({map: embossMap, transparent: true, opacity: 0.7, depthWrite: false});
  const emboss = markSurfaceDetail(register('lever-emboss-mark', new THREE.Mesh(new THREE.PlaneGeometry(5.55, 2.15), embossMaterial), lever));
  emboss.rotation.x = -Math.PI / 2;
  emboss.position.set(0.2, 2.43, 0.1);

  const bottomMap = canvasTexture(768, 360, (context, width, height) => {
    context.clearRect(0, 0, width, height);
    context.strokeStyle = 'rgba(83,129,150,.62)';
    context.fillStyle = 'rgba(83,129,150,.62)';
    context.lineWidth = 14;
    context.beginPath();
    context.ellipse(width * 0.5, height * 0.5, width * 0.38, height * 0.34, 0, 0, Math.PI * 2);
    context.stroke();
    context.font = '700 58px Arial, sans-serif';
    context.textAlign = 'center';
    context.fillText('19  ♻  PP', width * 0.5, height * 0.57);
  });
  const bottomReliefMaterial = new THREE.MeshBasicMaterial({map: bottomMap, transparent: true, opacity: 0.62, depthWrite: false});
  const bottomRelief = markSurfaceDetail(register('bottom-panel-relief', new THREE.Mesh(new THREE.PlaneGeometry(14.6, 7.1), bottomReliefMaterial), bottom));
  bottomRelief.rotation.x = Math.PI / 2;
  bottomRelief.position.y = -0.79;
  const fillRing = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.23, 12, 32), new THREE.MeshStandardMaterial({color: 0x6e9aae, roughness: 0.55}));
  fillRing.rotation.x = Math.PI / 2;
  fillRing.position.set(0, -0.82, 0);
  bottom.add(fillRing);

  const scratchGroup = register('body-scratch-detail', new THREE.Group(), body);
  const scratchMaterial = new THREE.LineBasicMaterial({color: 0x76818a, transparent: true, opacity: 0.14});
  let scratchSeed = 183;
  const randomScratch = () => {
    scratchSeed = (scratchSeed * 16807) % 2147483647;
    return scratchSeed / 2147483647;
  };
  for (let index = 0; index < 24; index += 1) {
    const x = (randomScratch() - 0.5) * 18;
    const y = (randomScratch() - 0.5) * 39 - 4;
    const length = 0.35 + randomScratch() * 1.55;
    const z = capsuleSurfaceDepthAtX(22, 11, x) + 0.055;
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(x, y, z),
      new THREE.Vector3(x + (randomScratch() - 0.5) * 0.45, y + length, z + 0.01),
    ]);
    const line = new THREE.Line(geometry, scratchMaterial);
    line.userData.explodeWithParent = true;
    scratchGroup.add(line);
  }

  const flame = register('flame-effect', new THREE.Group(), ignitionHead);
  flame.position.set(-6.8, 33.2, 0);
  const outerFlameMaterial = new THREE.MeshBasicMaterial({color: 0xff8a18, transparent: true, opacity: 0.72, depthWrite: false, blending: THREE.AdditiveBlending});
  const innerFlameMaterial = new THREE.MeshBasicMaterial({color: 0xbdefff, transparent: true, opacity: 0.88, depthWrite: false, blending: THREE.AdditiveBlending});
  const outerFlame = new THREE.Mesh(flameProfileGeometry(21.5, 3.65, 0.72, 40), outerFlameMaterial);
  const innerFlame = new THREE.Mesh(flameProfileGeometry(11.2, 1.7, 0.42, 32), innerFlameMaterial);
  flame.add(outerFlame, innerFlame);
  flame.visible = false;

  const socket = new THREE.Object3D();
  socket.name = 'ignition-socket';
  socket.position.set(0, 20.4, 0);
  root.add(socket);
  runtime.sockets['ignition-socket'] = socket;
  runtime.colliders.root = {type: 'rounded-box', size: [22, 62, 11]};
  runtime.destructionGroups.reservoir = [body, collar, bottom];
  runtime.destructionGroups.ignition = [hood, wheel, lever, nozzle];

  root.traverse((part) => {
    if (part instanceof THREE.Mesh) {
      part.castShadow = true;
      part.receiveShadow = true;
    }
  });
  root.userData.sculptRuntime = runtime;
  root.userData.actionState = {wheelRotation: 0, leverRest: lever.rotation.z};
  return root;
}
