import * as THREE from 'three';

function extrudeCurved(draw, depth, bevel = 0.35) {
  const shape = new THREE.Shape();
  draw(shape);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    steps: 1,
    bevelEnabled: bevel > 0,
    bevelSize: bevel,
    bevelThickness: bevel,
    bevelSegments: 4,
    curveSegments: 28,
  });
  geometry.translate(0, 0, -depth / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function faceGeometry(draw) {
  const shape = new THREE.Shape();
  draw(shape);
  return new THREE.ShapeGeometry(shape, 28);
}

function createWoodTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 320;
  const context = canvas.getContext('2d');
  const gradient = context.createLinearGradient(0, 0, canvas.width, 0);
  gradient.addColorStop(0, '#2a110e');
  gradient.addColorStop(0.17, '#4b2119');
  gradient.addColorStop(0.42, '#713a28');
  gradient.addColorStop(0.72, '#4d261d');
  gradient.addColorStop(1, '#25100d');
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  let seed = 811;
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let index = 0; index < 125; index += 1) {
    const y = random() * canvas.height;
    context.beginPath();
    context.moveTo(-30, y);
    for (let x = -30; x <= canvas.width + 30; x += 28) {
      const wave = Math.sin(x * 0.012 + random() * 2.5) * (2 + random() * 8);
      context.lineTo(x, y + wave);
    }
    context.strokeStyle = `rgba(${18 + random() * 42},${6 + random() * 20},${4 + random() * 14},${0.08 + random() * 0.2})`;
    context.lineWidth = 0.5 + random() * 2.2;
    context.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1.05, 1.1);
  texture.center.set(0.5, 0.5);
  texture.rotation = Math.PI / 2;
  return texture;
}

function createEngravingTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 360;
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = 'rgba(23, 25, 24, .92)';
  context.strokeStyle = 'rgba(23, 25, 24, .92)';
  context.lineCap = 'round';
  context.lineJoin = 'round';

  context.save();
  context.translate(62, 74);
  context.lineWidth = 6;
  context.beginPath();
  context.moveTo(16, 120);
  context.lineTo(84, 28);
  context.moveTo(16, 28);
  context.lineTo(84, 120);
  context.moveTo(4, 74);
  context.quadraticCurveTo(49, 42, 96, 74);
  context.quadraticCurveTo(49, 102, 4, 74);
  context.stroke();
  context.restore();

  context.lineWidth = 5;
  context.beginPath();
  context.moveTo(150, 164);
  context.lineTo(1000, 164);
  context.moveTo(1000, 164);
  context.lineTo(955, 148);
  context.moveTo(1000, 164);
  context.lineTo(955, 180);
  context.stroke();

  context.font = '700 132px Arial Narrow, Arial, sans-serif';
  context.fillText('HALLER', 208, 200);
  context.font = '500 58px Arial, sans-serif';
  context.fillText('440 stainless', 350, 286);
  context.font = '500 44px Arial, sans-serif';
  context.fillText('®', 936, 102);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.anisotropy = 8;
  return texture;
}

function drawHandleProfile(shape) {
  shape.moveTo(-3.4, 3.7);
  shape.bezierCurveTo(-2.1, 5.5, 1.6, 6.45, 5.7, 6.2);
  shape.bezierCurveTo(9.7, 5.95, 11.4, 5.05, 15.5, 4.8);
  shape.bezierCurveTo(27, 4.2, 39.5, 4.4, 49.7, 5.15);
  shape.bezierCurveTo(58, 5.7, 65.1, 7.1, 70.1, 6.4);
  shape.bezierCurveTo(74, 5.8, 76.2, 2.3, 75.8, -0.8);
  shape.bezierCurveTo(75.3, -4.1, 72.5, -7.1, 68.2, -7.8);
  shape.bezierCurveTo(64.4, -8.4, 60.4, -6.7, 56.8, -5.2);
  shape.bezierCurveTo(50.2, -3.45, 43.3, -3.2, 36, -3.25);
  shape.bezierCurveTo(29.1, -3.3, 23.7, -3.55, 19.2, -4.05);
  shape.bezierCurveTo(14.5, -4.55, 12.3, -6.4, 9.2, -7.55);
  shape.lineTo(7.25, -8.55);
  shape.bezierCurveTo(5.25, -8, 3.35, -6.7, 1.7, -5.25);
  shape.bezierCurveTo(0.3, -3.6, -1.6, -3.1, -3.3, -2);
  shape.bezierCurveTo(-4.9, -0.9, -4.8, 2.1, -3.4, 3.9);
  shape.closePath();
}

function drawFrontBolster(shape) {
  shape.moveTo(-3.2, 3.6);
  shape.bezierCurveTo(-1.7, 5.45, 1.5, 6.25, 5.7, 6.05);
  shape.bezierCurveTo(9.5, 5.85, 11.3, 5.05, 14.6, 4.8);
  shape.lineTo(14, -4.8);
  shape.bezierCurveTo(12, -5.7, 10.7, -6.9, 8.9, -7.45);
  shape.lineTo(7.2, -8.4);
  shape.bezierCurveTo(5.25, -7.9, 3.2, -6.6, 1.7, -5.2);
  shape.bezierCurveTo(0.25, -3.25, -1.4, -3, -3.2, -1.9);
  shape.bezierCurveTo(-4.5, -0.8, -4.5, 2.1, -3.2, 3.8);
  shape.closePath();
}

function drawBand(shape, x0, x1) {
  shape.moveTo(x0, 5.15);
  shape.lineTo(x1, 4.95);
  shape.lineTo(x1 - 0.7, -4.55);
  shape.lineTo(x0 - 0.7, -4.25);
  shape.closePath();
}

function drawBladeProfile(shape) {
  shape.moveTo(1.1, 4.35);
  shape.lineTo(-2, 4.35);
  shape.bezierCurveTo(-3.3, 4.35, -3.7, 5.15, -5.2, 5.35);
  shape.bezierCurveTo(-15.5, 5.85, -28, 5.95, -38, 5.2);
  shape.bezierCurveTo(-46.7, 4.55, -53.4, 2.4, -57.6, 0.45);
  shape.bezierCurveTo(-53, -2, -45.8, -4, -37.5, -5.05);
  shape.bezierCurveTo(-27.4, -6.35, -16, -6.65, -6.2, -5.45);
  shape.lineTo(-3.8, -5);
  shape.bezierCurveTo(-3.15, -5.55, -2.45, -5.85, -1.75, -5.48);
  shape.bezierCurveTo(-1.1, -5.12, -0.8, -4.55, -0.1, -4.2);
  shape.lineTo(1.2, -3.65);
  shape.closePath();
}

function drawBladeBevel(shape) {
  shape.moveTo(-57.15, 0.35);
  shape.bezierCurveTo(-52.6, -1.95, -45.5, -3.8, -37.4, -4.85);
  shape.bezierCurveTo(-27.3, -6.1, -16.2, -6.35, -6.35, -5.25);
  shape.lineTo(-3.9, -4.8);
  shape.bezierCurveTo(-13.5, -3.55, -25.8, -2.95, -36.2, -2);
  shape.bezierCurveTo(-45, -1.25, -52, -0.2, -57.15, 0.35);
  shape.closePath();
}

function drawNailNick(shape) {
  shape.moveTo(-39.2, 3.85);
  shape.bezierCurveTo(-34.6, 5.25, -25.3, 5.2, -18.7, 4.55);
  shape.bezierCurveTo(-24.7, 3.55, -34.2, 3.15, -39.2, 3.85);
  shape.closePath();
}

export function createHallerPocketKnifeModel() {
  const root = new THREE.Group();
  root.name = 'Haller Pocket Knife';
  const meshes = {};
  const nodes = { root };

  const wood = new THREE.MeshPhysicalMaterial({ map: createWoodTexture(), color: '#9a4b30', emissive: '#160503', emissiveIntensity: 0.12, roughness: 0.43, clearcoat: 0.18, clearcoatRoughness: 0.36, envMapIntensity: 0.35 });
  const bolsterWood = new THREE.MeshPhysicalMaterial({ color: '#0d0302', roughness: 0.5, clearcoat: 0.12, clearcoatRoughness: 0.42, envMapIntensity: 0.1, side: THREE.DoubleSide });
  const bladeSteel = new THREE.MeshPhysicalMaterial({ color: '#aeb8ba', metalness: 0.7, roughness: 0.24, side: THREE.DoubleSide });
  const edgeSteel = new THREE.MeshPhysicalMaterial({ color: '#d9e0e0', metalness: 0.76, roughness: 0.14, side: THREE.DoubleSide });
  const linerSteel = new THREE.MeshPhysicalMaterial({ color: '#777d7d', metalness: 0.82, roughness: 0.3 });
  const springSteel = new THREE.MeshPhysicalMaterial({ color: '#626767', metalness: 0.85, roughness: 0.35 });
  const brass = new THREE.MeshPhysicalMaterial({ color: '#c18b3c', metalness: 0.77, roughness: 0.24, side: THREE.DoubleSide });
  const spacerBlack = new THREE.MeshStandardMaterial({ color: '#11110f', roughness: 0.62, side: THREE.DoubleSide });
  const cavityBlack = new THREE.MeshBasicMaterial({ color: '#070807', side: THREE.DoubleSide });

  const frame = new THREE.Group();
  frame.name = 'Handle assembly';
  root.add(frame);
  nodes['handle-frame'] = frame;

  const spacer = new THREE.Mesh(extrudeCurved(drawHandleProfile, 1.35, 0.18), spacerBlack);
  frame.add(spacer);
  meshes['central-spacer'] = spacer;

  const linerGeometry = extrudeCurved(drawHandleProfile, 0.72, 0.22);
  for (const side of [1, -1]) {
    const liner = new THREE.Mesh(linerGeometry, linerSteel);
    liner.position.z = side * 1.03;
    liner.scale.set(1.012, 1.045, 1);
    frame.add(liner);
    meshes[side > 0 ? 'left-liner' : 'right-liner'] = liner;
  }

  const scaleGeometry = extrudeCurved(drawHandleProfile, 3.15, 0.72);
  for (const side of [1, -1]) {
    const scale = new THREE.Mesh(scaleGeometry, wood);
    scale.position.z = side * 3.02;
    frame.add(scale);
    meshes[side > 0 ? 'left-scale' : 'right-scale'] = scale;
  }

  const spring = new THREE.Mesh(extrudeCurved((shape) => {
    shape.moveTo(-0.5, 5.55);
    shape.bezierCurveTo(15, 4.55, 35, 4.25, 50, 5);
    shape.bezierCurveTo(61, 5.55, 68, 6.55, 71, 5.8);
    shape.lineTo(70.1, 4.55);
    shape.bezierCurveTo(52, 3.75, 31, 3.5, 13, 4.05);
    shape.lineTo(-0.7, 4.35);
    shape.closePath();
  }, 1.55, 0.12), springSteel);
  frame.add(spring);
  meshes.backspring = spring;

  const faceZ = 5.36;
  for (const side of [1, -1]) {
    const faceOffset = side * faceZ;
    const bolster = new THREE.Mesh(faceGeometry(drawFrontBolster), bolsterWood);
    bolster.position.z = faceOffset;
    bolster.renderOrder = 3;
    frame.add(bolster);

    const blackBand = new THREE.Mesh(faceGeometry((shape) => drawBand(shape, 13.6, 21)), spacerBlack);
    blackBand.position.z = faceOffset + side * 0.012;
    blackBand.renderOrder = 4;
    frame.add(blackBand);

    const brassBand = new THREE.Mesh(faceGeometry((shape) => drawBand(shape, 16.65, 17.9)), brass);
    brassBand.position.z = faceOffset + side * 0.024;
    brassBand.renderOrder = 5;
    frame.add(brassBand);
  }

  const pinLayout = [
    ['pivot-pin', 0.25, 1.65, 1.55],
    ['scale-pin-upper', 28.2, 2.05, 0.88],
    ['scale-pin-lower', 30.2, -0.95, 0.88],
    ['scale-pin-rear', 64.8, 2.55, 0.92],
  ];
  for (const [name, x, y, radius] of pinLayout) {
    const geometry = new THREE.CylinderGeometry(radius, radius, 11.2, 32);
    geometry.rotateX(Math.PI / 2);
    const pin = new THREE.Mesh(geometry, brass);
    pin.name = name;
    pin.position.set(x, y, 0);
    frame.add(pin);
    meshes[name] = pin;
  }

  const holeX = 67.2;
  const holeY = -2.15;
  const holeGeometry = new THREE.CylinderGeometry(1.78, 1.78, 11.4, 36);
  holeGeometry.rotateX(Math.PI / 2);
  const hole = new THREE.Mesh(holeGeometry, cavityBlack);
  hole.position.set(holeX, holeY, 0);
  frame.add(hole);
  meshes['lanyard-hole'] = hole;
  for (const side of [1, -1]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.18, 0.43, 12, 40), brass);
    ring.position.set(holeX, holeY, side * 5.5);
    frame.add(ring);
    meshes[side > 0 ? 'lanyard-tube-front' : 'lanyard-tube-back'] = ring;
  }

  const scarCurve = new THREE.EllipseCurve(34, -0.9, 4.2, 2.9, Math.PI * 1.05, Math.PI * 1.88, false, 0.12);
  const scarPoints = scarCurve.getPoints(30).map((point) => new THREE.Vector3(point.x, point.y, -5.395));
  const scaleScar = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(scarPoints),
    new THREE.LineBasicMaterial({ color: '#b88167', transparent: true, opacity: 0.72, toneMapped: false }),
  );
  scaleScar.name = 'Reverse scale wear mark';
  scaleScar.renderOrder = 8;
  frame.add(scaleScar);

  const bladePivot = new THREE.Group();
  bladePivot.name = 'Blade hinge pivot';
  root.add(bladePivot);
  nodes['blade-pivot'] = bladePivot;

  const blade = new THREE.Mesh(extrudeCurved(drawBladeProfile, 2.05, 0.14), bladeSteel);
  blade.name = 'Drop-point blade';
  bladePivot.add(blade);
  meshes.blade = blade;

  const bladeFaceZ = 1.2;
  for (const side of [1, -1]) {
    const bevel = new THREE.Mesh(faceGeometry(drawBladeBevel), edgeSteel);
    bevel.position.z = side * bladeFaceZ;
    bevel.renderOrder = 3;
    bladePivot.add(bevel);
    meshes[side > 0 ? 'blade-bevel-front' : 'blade-bevel-back'] = bevel;
  }

  const nick = new THREE.Mesh(
    faceGeometry(drawNailNick),
    new THREE.MeshBasicMaterial({ color: '#313533', transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
  );
  nick.position.z = bladeFaceZ + 0.018;
  nick.renderOrder = 5;
  bladePivot.add(nick);
  meshes['nail-nick'] = nick;

  const engraving = new THREE.Mesh(
    new THREE.PlaneGeometry(32.5, 8.4),
    new THREE.MeshBasicMaterial({ map: createEngravingTexture(), transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -8 }),
  );
  engraving.name = 'HALLER / 440 stainless engraving';
  engraving.position.set(-22.1, -0.25, bladeFaceZ + 0.028);
  engraving.renderOrder = 6;
  bladePivot.add(engraving);
  meshes['blade-engraving'] = engraving;

  const bladeWearPoints = [];
  for (const [x1, y1, x2, y2] of [
    [-49, 2.1, -39, 2.45],
    [-45, -0.8, -33, -0.35],
    [-36, 3.25, -25, 3.5],
    [-31, -3.2, -18, -2.7],
    [-24, 1.75, -14, 1.95],
    [-15, -4.1, -7, -3.7],
  ]) {
    bladeWearPoints.push(x1, y1, bladeFaceZ + 0.04, x2, y2, bladeFaceZ + 0.04);
  }
  const bladeWearGeometry = new THREE.BufferGeometry();
  bladeWearGeometry.setAttribute('position', new THREE.Float32BufferAttribute(bladeWearPoints, 3));
  const bladeWear = new THREE.LineSegments(
    bladeWearGeometry,
    new THREE.LineBasicMaterial({ color: '#eef1ee', transparent: true, opacity: 0.2, toneMapped: false }),
  );
  bladeWear.name = 'Fine blade wear';
  bladeWear.renderOrder = 7;
  bladePivot.add(bladeWear);

  root.userData.sculptRuntime = { nodes, meshes };
  root.userData.bladeState = { closedAngle: Math.PI + 0.075, openAngle: 0 };
  return root;
}
