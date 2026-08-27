const canvas = document.querySelector('#room-canvas');
const viewport = document.querySelector('.viewport-shell');
const resetButton = document.querySelector('#reset-view');
const lightingButton = document.querySelector('#lighting-toggle');
const lightingState = document.querySelector('#lighting-state');
const hint = document.querySelector('#interaction-hint');
const zoomValue = document.querySelector('#zoom-value');
const turnRight = document.querySelector('#turn-right');
const turnLeft = document.querySelector('#turn-left');
const zoomIn = document.querySelector('#zoom-in');
const zoomOut = document.querySelector('#zoom-out');

const context = canvas.getContext('2d', {
  alpha: false,
  desynchronized: true,
});

const defaults = Object.freeze({
  yaw: -0.62,
  pitch: 0.19,
  zoom: 1,
});

const state = {
  ...defaults,
  night: false,
};

const metrics = {
  width: 0,
  height: 0,
  ratio: 1,
  centerX: 0,
  centerY: 0,
  unit: 0,
};

const palettes = {
  day: {
    backgroundTop: '#d6dfdb',
    backgroundBottom: '#93aaa7',
    haze: 'rgba(243, 232, 203, 0.22)',
    floor: '#b6aa98',
    floorLine: 'rgba(88, 86, 76, 0.18)',
    wall: '#e8e3d9',
    sideWall: '#d4d0ca',
    edge: 'rgba(39, 48, 48, 0.22)',
    baseboard: '#9a9389',
    rug: '#c27755',
    rugLine: 'rgba(252, 232, 189, 0.5)',
    window: '#91c4d4',
    windowLight: '#c6e1e2',
    frame: '#3b555a',
    frameGlow: 'rgba(213, 239, 230, 0.7)',
    artwork: '#315660',
    artworkDetail: '#dea867',
    deskTop: '#8d6546',
    deskFront: '#704a32',
    deskSide: '#5e3e2c',
    deskEdge: 'rgba(47, 30, 20, 0.44)',
    monitor: '#253a42',
    monitorSide: '#1d2c31',
    screen: '#8ececf',
    screenLine: 'rgba(226, 255, 248, 0.63)',
    chairTop: '#63818a',
    chairFront: '#48656e',
    chairSide: '#3e5760',
    plantPot: '#b87952',
    plantSide: '#955c3d',
    leafA: '#4d806f',
    leafB: '#6ca58a',
    lamp: '#b99361',
    lampShade: '#dfc98e',
    lampGlow: 'rgba(255, 233, 169, 0.38)',
    shadow: 'rgba(42, 46, 42, 0.15)',
  },
  night: {
    backgroundTop: '#203a46',
    backgroundBottom: '#101d27',
    haze: 'rgba(74, 151, 159, 0.12)',
    floor: '#38454a',
    floorLine: 'rgba(182, 236, 222, 0.1)',
    wall: '#50626a',
    sideWall: '#3c5059',
    edge: 'rgba(207, 250, 239, 0.14)',
    baseboard: '#67787c',
    rug: '#8d5547',
    rugLine: 'rgba(244, 198, 126, 0.38)',
    window: '#1d485e',
    windowLight: '#76bdca',
    frame: '#192c34',
    frameGlow: 'rgba(142, 226, 204, 0.49)',
    artwork: '#1e3e48',
    artworkDetail: '#dca264',
    deskTop: '#684c3d',
    deskFront: '#50372e',
    deskSide: '#3f2b26',
    deskEdge: 'rgba(15, 12, 10, 0.64)',
    monitor: '#14252d',
    monitorSide: '#0d1c22',
    screen: '#4b9faa',
    screenLine: 'rgba(190, 247, 234, 0.48)',
    chairTop: '#45656f',
    chairFront: '#334e57',
    chairSide: '#2a4048',
    plantPot: '#85553e',
    plantSide: '#68402f',
    leafA: '#366454',
    leafB: '#4b8d70',
    lamp: '#c2955f',
    lampShade: '#e5c777',
    lampGlow: 'rgba(255, 204, 114, 0.62)',
    shadow: 'rgba(1, 9, 12, 0.38)',
  },
};

let framePending = false;
let activePointer = null;
let hintUsed = false;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

function scheduleRender() {
  if (framePending) return;
  framePending = true;
  requestAnimationFrame(() => {
    framePending = false;
    render();
  });
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));

  // Limiting both DPR and pixel count keeps the scene friendly to low-end phones.
  const deviceRatio = Math.min(window.devicePixelRatio || 1, 1.25);
  const maxPixels = 820000;
  const pixelRatio = Math.min(deviceRatio, Math.sqrt(maxPixels / (width * height)));

  metrics.width = width;
  metrics.height = height;
  metrics.ratio = Math.max(0.75, pixelRatio);
  metrics.centerX = width * 0.53;
  metrics.centerY = height * 0.64;
  metrics.unit = Math.min(width * 0.092, height * 0.112) * state.zoom;

  canvas.width = Math.max(1, Math.round(width * metrics.ratio));
  canvas.height = Math.max(1, Math.round(height * metrics.ratio));
  scheduleRender();
}

function transformedPoint(point) {
  const yawCos = Math.cos(state.yaw);
  const yawSin = Math.sin(state.yaw);
  const pitchCos = Math.cos(state.pitch);
  const pitchSin = Math.sin(state.pitch);

  const x = point.x * yawCos - point.z * yawSin;
  const z = point.x * yawSin + point.z * yawCos;

  return {
    x,
    y: point.y * pitchCos + z * pitchSin,
    z: -point.y * pitchSin + z * pitchCos,
  };
}

function project(point) {
  const transformed = transformedPoint(point);
  const perspective = 13.4 / (13.4 + transformed.z);

  return {
    x: metrics.centerX + transformed.x * metrics.unit * perspective,
    y: metrics.centerY - transformed.y * metrics.unit * perspective,
    z: transformed.z,
    perspective,
  };
}

function addPolygon(items, vertices, fill, options = {}) {
  const points = vertices.map(project);
  const depth = points.reduce((sum, point) => sum + point.z, 0) / points.length;

  items.push({
    type: 'polygon',
    points,
    depth,
    fill,
    stroke: options.stroke,
    width: options.width || 1,
    layer: options.layer ?? 1,
  });
}

function addLine(items, from, to, stroke, options = {}) {
  const first = project(from);
  const second = project(to);

  items.push({
    type: 'line',
    points: [first, second],
    depth: (first.z + second.z) / 2,
    stroke,
    width: options.width || 1,
    layer: options.layer ?? 1,
  });
}

function addGlow(items, position, radius, color, options = {}) {
  const point = project(position);

  items.push({
    type: 'glow',
    point,
    radius: radius * metrics.unit * point.perspective,
    depth: point.z,
    color,
    layer: options.layer ?? 3,
  });
}

function addBox(items, box, colors, options = {}) {
  const { x0, x1, y0, y1, z0, z1 } = box;
  const a = { x: x0, y: y0, z: z0 };
  const b = { x: x1, y: y0, z: z0 };
  const c = { x: x1, y: y1, z: z0 };
  const d = { x: x0, y: y1, z: z0 };
  const e = { x: x0, y: y0, z: z1 };
  const f = { x: x1, y: y0, z: z1 };
  const g = { x: x1, y: y1, z: z1 };
  const h = { x: x0, y: y1, z: z1 };
  const layer = options.layer ?? 2;
  const stroke = options.stroke;

  addPolygon(items, [a, b, c, d], colors.front, { layer, stroke });
  addPolygon(items, [b, f, g, c], colors.side, { layer, stroke });
  addPolygon(items, [e, a, d, h], colors.side, { layer, stroke });
  addPolygon(items, [d, c, g, h], colors.top, { layer, stroke });
  addPolygon(items, [a, e, f, b], colors.bottom || colors.side, { layer, stroke });
  addPolygon(items, [f, e, h, g], colors.back || colors.front, { layer, stroke });
}

function addRoom(items, colors) {
  const left = -5;
  const right = 5;
  const front = -4;
  const back = 4;
  const height = 5.7;

  // The room itself: a floor, a back wall, and one side wall. The open front keeps it readable.
  addPolygon(items, [
    { x: left, y: 0, z: front },
    { x: right, y: 0, z: front },
    { x: right, y: 0, z: back },
    { x: left, y: 0, z: back },
  ], colors.floor, { layer: 0, stroke: colors.edge });

  addPolygon(items, [
    { x: left, y: 0, z: back },
    { x: right, y: 0, z: back },
    { x: right, y: height, z: back },
    { x: left, y: height, z: back },
  ], colors.wall, { layer: 0, stroke: colors.edge });

  addPolygon(items, [
    { x: left, y: 0, z: front },
    { x: left, y: 0, z: back },
    { x: left, y: height, z: back },
    { x: left, y: height, z: front },
  ], colors.sideWall, { layer: 0, stroke: colors.edge });

  // Low-contrast floor seams give depth without using a texture image.
  for (let z = -3; z <= 3; z += 1.2) {
    addLine(items, { x: left, y: 0.012, z }, { x: right, y: 0.012, z }, colors.floorLine, { layer: 1, width: 0.7 });
  }
  for (let x = -4; x <= 4; x += 1.35) {
    addLine(items, { x, y: 0.012, z: front }, { x, y: 0.012, z: back }, colors.floorLine, { layer: 1, width: 0.7 });
  }

  // Baseboard lines keep the corner crisp.
  addLine(items, { x: left, y: 0.16, z: back - 0.02 }, { x: right, y: 0.16, z: back - 0.02 }, colors.baseboard, { layer: 1, width: 2 });
  addLine(items, { x: left + 0.02, y: 0.16, z: front }, { x: left + 0.02, y: 0.16, z: back }, colors.baseboard, { layer: 1, width: 2 });

  // Window in the rear wall.
  const windowZ = back - 0.035;
  addPolygon(items, [
    { x: 0.35, y: 2.25, z: windowZ },
    { x: 3.4, y: 2.25, z: windowZ },
    { x: 3.4, y: 4.65, z: windowZ },
    { x: 0.35, y: 4.65, z: windowZ },
  ], colors.window, { layer: 1, stroke: colors.frame, width: 2 });
  addPolygon(items, [
    { x: 0.52, y: 3.47, z: windowZ - 0.006 },
    { x: 3.23, y: 3.47, z: windowZ - 0.006 },
    { x: 3.23, y: 4.48, z: windowZ - 0.006 },
    { x: 0.52, y: 4.48, z: windowZ - 0.006 },
  ], colors.windowLight, { layer: 1 });
  addLine(items, { x: 1.88, y: 2.27, z: windowZ - 0.01 }, { x: 1.88, y: 4.63, z: windowZ - 0.01 }, colors.frame, { layer: 2, width: 1.4 });
  addLine(items, { x: 0.37, y: 3.46, z: windowZ - 0.01 }, { x: 3.38, y: 3.46, z: windowZ - 0.01 }, colors.frame, { layer: 2, width: 1.4 });
  addLine(items, { x: 0.35, y: 4.66, z: windowZ - 0.01 }, { x: 3.4, y: 4.66, z: windowZ - 0.01 }, colors.frameGlow, { layer: 2, width: 1 });

  // A small framed print adds a quiet focal point to the wall.
  addPolygon(items, [
    { x: -3.9, y: 2.05, z: windowZ },
    { x: -2.38, y: 2.05, z: windowZ },
    { x: -2.38, y: 3.8, z: windowZ },
    { x: -3.9, y: 3.8, z: windowZ },
  ], colors.artwork, { layer: 1, stroke: colors.frame, width: 3 });
  addPolygon(items, [
    { x: -3.58, y: 2.42, z: windowZ - 0.01 },
    { x: -2.68, y: 2.42, z: windowZ - 0.01 },
    { x: -3.13, y: 3.45, z: windowZ - 0.01 },
  ], colors.artworkDetail, { layer: 2 });
}

function addRug(items, colors) {
  addPolygon(items, [
    { x: -2.9, y: 0.025, z: -2.9 },
    { x: 2.65, y: 0.025, z: -2.9 },
    { x: 2.65, y: 0.025, z: 1.23 },
    { x: -2.9, y: 0.025, z: 1.23 },
  ], colors.rug, { layer: 1, stroke: colors.edge });

  for (let z = -2.45; z < 1; z += 0.75) {
    addLine(items, { x: -2.62, y: 0.032, z }, { x: 2.38, y: 0.032, z }, colors.rugLine, { layer: 2, width: 0.8 });
  }
}

function addDesk(items, colors) {
  const desk = { top: colors.deskTop, front: colors.deskFront, side: colors.deskSide };
  const leg = { top: colors.deskSide, front: colors.deskFront, side: colors.deskSide };
  const monitor = { top: colors.monitor, front: colors.monitor, side: colors.monitorSide };

  addBox(items, { x0: 0.05, x1: 3.92, y0: 1.48, y1: 1.73, z0: 1.52, z1: 3.25 }, desk, { stroke: colors.deskEdge });

  [[0.24, 0.46, 1.66, 1.89], [3.5, 3.72, 1.66, 1.89], [0.24, 0.46, 2.91, 3.13], [3.5, 3.72, 2.91, 3.13]].forEach(([x0, x1, z0, z1]) => {
    addBox(items, { x0, x1, y0: 0, y1: 1.49, z0, z1 }, leg, { stroke: colors.deskEdge });
  });

  // Monitor, screen, stand, keyboard and a small coffee cup.
  addBox(items, { x0: 0.76, x1: 2.81, y0: 1.88, y1: 3.28, z0: 2.58, z1: 2.72 }, monitor, { stroke: colors.edge });
  addPolygon(items, [
    { x: 0.9, y: 2.02, z: 2.565 },
    { x: 2.67, y: 2.02, z: 2.565 },
    { x: 2.67, y: 3.12, z: 2.565 },
    { x: 0.9, y: 3.12, z: 2.565 },
  ], colors.screen, { layer: 3, stroke: colors.screenLine, width: 0.7 });
  addLine(items, { x: 1.1, y: 2.82, z: 2.55 }, { x: 2.22, y: 2.82, z: 2.55 }, colors.screenLine, { layer: 3, width: 1.2 });
  addLine(items, { x: 1.1, y: 2.59, z: 2.55 }, { x: 1.83, y: 2.59, z: 2.55 }, colors.screenLine, { layer: 3, width: 0.9 });
  addBox(items, { x0: 1.67, x1: 1.89, y0: 1.7, y1: 1.9, z0: 2.6, z1: 2.72 }, monitor, { stroke: colors.edge });
  addBox(items, { x0: 1.32, x1: 2.23, y0: 1.72, y1: 1.78, z0: 2.48, z1: 2.83 }, monitor, { stroke: colors.edge });
  addBox(items, { x0: 0.72, x1: 1.06, y0: 1.74, y1: 2.04, z0: 1.95, z1: 2.28 }, { top: colors.windowLight, front: colors.windowLight, side: colors.frame }, { stroke: colors.edge });
}

function addChair(items, colors) {
  const chair = { top: colors.chairTop, front: colors.chairFront, side: colors.chairSide };
  const darkChair = { top: colors.chairSide, front: colors.chairSide, side: colors.chairSide };

  addBox(items, { x0: -2.3, x1: -0.67, y0: 0.76, y1: 1.02, z0: -1.56, z1: 0.04 }, chair, { stroke: colors.edge });
  addBox(items, { x0: -2.3, x1: -0.67, y0: 1.01, y1: 2.5, z0: -0.02, z1: 0.17 }, chair, { stroke: colors.edge });

  [[-2.12, -1.94, -1.36, -1.17], [-1.03, -0.85, -1.36, -1.17], [-2.12, -1.94, -0.17, 0.01], [-1.03, -0.85, -0.17, 0.01]].forEach(([x0, x1, z0, z1]) => {
    addBox(items, { x0, x1, y0: 0, y1: 0.76, z0, z1 }, darkChair, { stroke: colors.edge });
  });
}

function addPlant(items, colors) {
  const pot = { top: colors.plantPot, front: colors.plantPot, side: colors.plantSide };
  addBox(items, { x0: -4.47, x1: -3.7, y0: 0, y1: 0.6, z0: 2.89, z1: 3.57 }, pot, { stroke: colors.edge });

  const base = { x: -4.09, y: 0.57, z: 3.24 };
  addPolygon(items, [base, { x: -4.96, y: 1.84, z: 3.29 }, { x: -4.15, y: 1.31, z: 3.13 }], colors.leafA, { layer: 3, stroke: colors.edge, width: 0.5 });
  addPolygon(items, [base, { x: -3.23, y: 1.92, z: 3.31 }, { x: -3.9, y: 1.21, z: 3.35 }], colors.leafB, { layer: 3, stroke: colors.edge, width: 0.5 });
  addPolygon(items, [base, { x: -4.18, y: 2.38, z: 3.5 }, { x: -4.41, y: 1.17, z: 3.13 }], colors.leafB, { layer: 3, stroke: colors.edge, width: 0.5 });
  addPolygon(items, [base, { x: -3.46, y: 1.57, z: 2.61 }, { x: -4.0, y: 1.14, z: 3.24 }], colors.leafA, { layer: 3, stroke: colors.edge, width: 0.5 });
}

function addLamp(items, colors) {
  addBox(items, { x0: -4.35, x1: -3.58, y0: 0.01, y1: 0.1, z0: -0.18, z1: 0.25 }, { top: colors.lamp, front: colors.lamp, side: colors.lamp }, { layer: 2, stroke: colors.edge });
  addLine(items, { x: -3.96, y: 0.1, z: 0.04 }, { x: -3.96, y: 3.45, z: 0.04 }, colors.lamp, { layer: 3, width: 2 });
  addPolygon(items, [
    { x: -4.4, y: 3.38, z: -0.06 },
    { x: -3.52, y: 3.38, z: -0.06 },
    { x: -3.64, y: 3.93, z: -0.06 },
    { x: -4.28, y: 3.93, z: -0.06 },
  ], colors.lampShade, { layer: 3, stroke: colors.edge });
  addGlow(items, { x: -3.96, y: 3.38, z: -0.1 }, state.night ? 0.42 : 0.3, colors.lampGlow, { layer: 4 });
}

function addRoomShadows(items, colors) {
  addPolygon(items, [
    { x: -3.5, y: 0.018, z: -2.1 },
    { x: 4.35, y: 0.018, z: -2.1 },
    { x: 4.35, y: 0.018, z: 3.45 },
    { x: -3.5, y: 0.018, z: 3.45 },
  ], colors.shadow, { layer: 1 });
}

function drawBackground(colors) {
  const gradient = context.createLinearGradient(0, 0, 0, metrics.height);
  gradient.addColorStop(0, colors.backgroundTop);
  gradient.addColorStop(0.63, colors.backgroundBottom);
  gradient.addColorStop(1, colors.backgroundBottom);
  context.fillStyle = gradient;
  context.fillRect(0, 0, metrics.width, metrics.height);

  const halo = context.createRadialGradient(
    metrics.width * 0.74,
    metrics.height * 0.19,
    3,
    metrics.width * 0.74,
    metrics.height * 0.19,
    Math.max(metrics.width, metrics.height) * 0.56,
  );
  halo.addColorStop(0, colors.haze);
  halo.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = halo;
  context.fillRect(0, 0, metrics.width, metrics.height);
}

function drawItem(item) {
  context.save();
  context.lineJoin = 'round';
  context.lineCap = 'round';

  if (item.type === 'polygon') {
    context.beginPath();
    item.points.forEach((point, index) => {
      if (index === 0) context.moveTo(point.x, point.y);
      else context.lineTo(point.x, point.y);
    });
    context.closePath();
    if (item.fill) {
      context.fillStyle = item.fill;
      context.fill();
    }
    if (item.stroke) {
      context.strokeStyle = item.stroke;
      context.lineWidth = item.width;
      context.stroke();
    }
  }

  if (item.type === 'line') {
    context.beginPath();
    context.moveTo(item.points[0].x, item.points[0].y);
    context.lineTo(item.points[1].x, item.points[1].y);
    context.strokeStyle = item.stroke;
    context.lineWidth = item.width;
    context.stroke();
  }

  if (item.type === 'glow') {
    const gradient = context.createRadialGradient(item.point.x, item.point.y, 0, item.point.x, item.point.y, item.radius);
    gradient.addColorStop(0, item.color);
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(item.point.x, item.point.y, item.radius, 0, Math.PI * 2);
    context.fill();
  }

  context.restore();
}

function render() {
  if (!metrics.width || !metrics.height) return;

  metrics.unit = Math.min(metrics.width * 0.092, metrics.height * 0.112) * state.zoom;
  context.setTransform(metrics.ratio, 0, 0, metrics.ratio, 0, 0);
  context.clearRect(0, 0, metrics.width, metrics.height);

  const colors = state.night ? palettes.night : palettes.day;
  drawBackground(colors);

  const items = [];
  addRoom(items, colors);
  addRoomShadows(items, colors);
  addRug(items, colors);
  addDesk(items, colors);
  addChair(items, colors);
  addPlant(items, colors);
  addLamp(items, colors);

  items
    .sort((a, b) => a.layer - b.layer || b.depth - a.depth)
    .forEach(drawItem);
}

function hideHint() {
  if (hintUsed) return;
  hintUsed = true;
  hint.classList.add('is-hidden');
}

function setZoom(value) {
  state.zoom = clamp(value, 0.84, 1.18);
  zoomValue.textContent = `${Math.round(state.zoom * 100)}%`;
  scheduleRender();
}

function resetView() {
  state.yaw = defaults.yaw;
  state.pitch = defaults.pitch;
  setZoom(defaults.zoom);
  scheduleRender();
}

function updateLighting() {
  viewport.classList.toggle('is-night', state.night);
  lightingButton.setAttribute('aria-pressed', String(state.night));
  lightingButton.setAttribute('aria-label', state.night ? 'تفعيل الإضاءة النهارية' : 'تفعيل الإضاءة المسائية');
  lightingState.textContent = state.night ? 'إضاءة مسائية' : 'إضاءة نهارية';
  scheduleRender();
}

canvas.addEventListener('pointerdown', (event) => {
  activePointer = {
    id: event.pointerId,
    x: event.clientX,
    y: event.clientY,
  };
  canvas.setPointerCapture(event.pointerId);
  canvas.classList.add('is-dragging');
  canvas.focus({ preventScroll: true });
  hideHint();
});

canvas.addEventListener('pointermove', (event) => {
  if (!activePointer || activePointer.id !== event.pointerId) return;

  const deltaX = event.clientX - activePointer.x;
  const deltaY = event.clientY - activePointer.y;
  activePointer.x = event.clientX;
  activePointer.y = event.clientY;

  state.yaw = clamp(state.yaw - deltaX * 0.006, -1.02, -0.18);
  state.pitch = clamp(state.pitch - deltaY * 0.0032, 0.08, 0.37);
  scheduleRender();
});

function endPointer(event) {
  if (!activePointer || activePointer.id !== event.pointerId) return;
  activePointer = null;
  canvas.classList.remove('is-dragging');
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
}

canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);

canvas.addEventListener('keydown', (event) => {
  const key = event.key;
  let changed = true;

  if (key === 'ArrowRight') state.yaw = clamp(state.yaw + 0.08, -1.02, -0.18);
  else if (key === 'ArrowLeft') state.yaw = clamp(state.yaw - 0.08, -1.02, -0.18);
  else if (key === 'ArrowUp') state.pitch = clamp(state.pitch + 0.04, 0.08, 0.37);
  else if (key === 'ArrowDown') state.pitch = clamp(state.pitch - 0.04, 0.08, 0.37);
  else if (key === '+' || key === '=') setZoom(state.zoom + 0.06);
  else if (key === '-') setZoom(state.zoom - 0.06);
  else if (key.toLowerCase() === 'r') resetView();
  else changed = false;

  if (changed) {
    event.preventDefault();
    hideHint();
    scheduleRender();
  }
});

turnRight.addEventListener('click', () => {
  state.yaw = clamp(state.yaw + 0.1, -1.02, -0.18);
  hideHint();
  scheduleRender();
});

turnLeft.addEventListener('click', () => {
  state.yaw = clamp(state.yaw - 0.1, -1.02, -0.18);
  hideHint();
  scheduleRender();
});

zoomIn.addEventListener('click', () => setZoom(state.zoom + 0.06));
zoomOut.addEventListener('click', () => setZoom(state.zoom - 0.06));
resetButton.addEventListener('click', resetView);
lightingButton.addEventListener('click', () => {
  state.night = !state.night;
  updateLighting();
});

if ('ResizeObserver' in window) {
  new ResizeObserver(resizeCanvas).observe(viewport);
} else {
  window.addEventListener('resize', resizeCanvas, { passive: true });
}

resizeCanvas();
updateLighting();
