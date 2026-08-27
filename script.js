const canvas = document.querySelector('#room-canvas');
const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });

// A small ray-cast room: Canvas 2D only, no WebGL, no downloaded models or textures.
const ROOM_MAP = [
  [1, 1, 1, 3, 3, 3, 3, 3, 1, 1, 1, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 1, 1, 1, 1, 2, 2, 1, 1, 1, 1, 1],
];

const MAP_WIDTH = ROOM_MAP[0].length;
const MAP_HEIGHT = ROOM_MAP.length;
const FOV = Math.PI / 3;
const EYE_HEIGHT = 0.5;
const PLAYER_RADIUS = 0.22;
const NEAR_PLANE = 0.08;
const MAX_PIXELS = 410000;

const state = {
  x: 6.05,
  y: 8.15,
  yaw: -Math.PI / 2,
  pitch: 0,
};

const keys = new Set();
const touchPointers = new Map();
let touchMove = { forward: 0, strafe: 0 };
let renderQueued = false;
let movementRunning = false;
let movementTime = 0;
let mouseDrag = null;
let canvasWidth = 0;
let canvasHeight = 0;

const wallColors = {
  1: { r: 208, g: 200, b: 183 },
  2: { r: 117, g: 75, b: 48 },
  3: { r: 73, g: 135, b: 151 },
  4: { r: 75, g: 116, b: 106 },
  5: { r: 152, g: 112, b: 72 },
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function normalizeAngle(angle) {
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

function rgb(color, factor, warmth = 0) {
  const r = Math.round(clamp(color.r * factor + warmth, 0, 255));
  const g = Math.round(clamp(color.g * factor + warmth * 0.55, 0, 255));
  const b = Math.round(clamp(color.b * factor, 0, 255));
  return `rgb(${r}, ${g}, ${b})`;
}

function requestRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    renderScene();
  });
}

function resizeCanvas() {
  const bounds = canvas.getBoundingClientRect();
  const cssWidth = Math.max(1, bounds.width);
  const cssHeight = Math.max(1, bounds.height);
  const scale = Math.min(0.9, Math.sqrt(MAX_PIXELS / (cssWidth * cssHeight)));

  canvasWidth = Math.max(280, Math.floor(cssWidth * scale));
  canvasHeight = Math.max(220, Math.floor(cssHeight * scale));
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'low';
  requestRender();
}

function wallAt(x, y) {
  if (x < 0 || y < 0 || x >= MAP_WIDTH || y >= MAP_HEIGHT) return 1;
  return ROOM_MAP[y][x];
}

function isBlocked(x, y) {
  const samples = [
    [x - PLAYER_RADIUS, y - PLAYER_RADIUS],
    [x + PLAYER_RADIUS, y - PLAYER_RADIUS],
    [x - PLAYER_RADIUS, y + PLAYER_RADIUS],
    [x + PLAYER_RADIUS, y + PLAYER_RADIUS],
  ];

  if (samples.some(([sampleX, sampleY]) => wallAt(Math.floor(sampleX), Math.floor(sampleY)) !== 0)) return true;

  return objects.some((object) => {
    const distance = Math.hypot(x - object.x, y - object.y);
    return distance < PLAYER_RADIUS + object.collision;
  });
}

function movePlayer(deltaX, deltaY) {
  const nextX = state.x + deltaX;
  const nextY = state.y + deltaY;

  if (!isBlocked(nextX, state.y)) state.x = nextX;
  if (!isBlocked(state.x, nextY)) state.y = nextY;
}

function castRay(angle) {
  const rayX = Math.cos(angle);
  const rayY = Math.sin(angle);
  let mapX = Math.floor(state.x);
  let mapY = Math.floor(state.y);
  const deltaDistanceX = rayX === 0 ? Number.POSITIVE_INFINITY : Math.abs(1 / rayX);
  const deltaDistanceY = rayY === 0 ? Number.POSITIVE_INFINITY : Math.abs(1 / rayY);
  const stepX = rayX < 0 ? -1 : 1;
  const stepY = rayY < 0 ? -1 : 1;
  let sideDistanceX = rayX < 0 ? (state.x - mapX) * deltaDistanceX : (mapX + 1 - state.x) * deltaDistanceX;
  let sideDistanceY = rayY < 0 ? (state.y - mapY) * deltaDistanceY : (mapY + 1 - state.y) * deltaDistanceY;
  let side = 0;
  let type = 0;

  for (let steps = 0; steps < 64; steps += 1) {
    if (sideDistanceX < sideDistanceY) {
      sideDistanceX += deltaDistanceX;
      mapX += stepX;
      side = 0;
    } else {
      sideDistanceY += deltaDistanceY;
      mapY += stepY;
      side = 1;
    }
    type = wallAt(mapX, mapY);
    if (type !== 0) break;
  }

  const distance = side === 0
    ? (mapX - state.x + (1 - stepX) / 2) / rayX
    : (mapY - state.y + (1 - stepY) / 2) / rayY;
  const hitX = state.x + distance * rayX;
  const hitY = state.y + distance * rayY;
  let wallU = side === 0 ? hitY - Math.floor(hitY) : hitX - Math.floor(hitX);
  if ((side === 0 && rayX > 0) || (side === 1 && rayY < 0)) wallU = 1 - wallU;

  return { distance, side, type, wallU };
}

function cameraPoint(x, y) {
  const deltaX = x - state.x;
  const deltaY = y - state.y;
  const cos = Math.cos(state.yaw);
  const sin = Math.sin(state.yaw);

  return {
    sideways: -sin * deltaX + cos * deltaY,
    forward: cos * deltaX + sin * deltaY,
  };
}

function projectFloorPoint(x, y, focal, horizon) {
  const point = cameraPoint(x, y);
  if (point.forward <= NEAR_PLANE) return null;

  return {
    x: canvasWidth / 2 + (point.sideways / point.forward) * focal,
    y: horizon + (EYE_HEIGHT / point.forward) * focal,
    forward: point.forward,
  };
}

function clipFloorSegment(start, end, focal, horizon) {
  let first = cameraPoint(start.x, start.y);
  let second = cameraPoint(end.x, end.y);
  let firstWorld = start;
  let secondWorld = end;

  if (first.forward <= NEAR_PLANE && second.forward <= NEAR_PLANE) return null;

  if (first.forward <= NEAR_PLANE || second.forward <= NEAR_PLANE) {
    const amount = (NEAR_PLANE - first.forward) / (second.forward - first.forward);
    const intersection = {
      x: start.x + (end.x - start.x) * amount,
      y: start.y + (end.y - start.y) * amount,
    };
    if (first.forward <= NEAR_PLANE) {
      firstWorld = intersection;
      first = cameraPoint(intersection.x, intersection.y);
    } else {
      secondWorld = intersection;
      second = cameraPoint(intersection.x, intersection.y);
    }
  }

  const projectedStart = projectFloorPoint(firstWorld.x, firstWorld.y, focal, horizon);
  const projectedEnd = projectFloorPoint(secondWorld.x, secondWorld.y, focal, horizon);
  if (!projectedStart || !projectedEnd) return null;
  return [projectedStart, projectedEnd];
}

function drawFloorPolygon(points, fill, focal, horizon, stroke) {
  const projected = points.map((point) => projectFloorPoint(point.x, point.y, focal, horizon));
  if (projected.some((point) => point === null)) return;

  ctx.beginPath();
  projected.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();

  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function drawFloorEllipse(x, y, radiusX, radiusY, fill, focal, horizon) {
  const points = [];
  for (let index = 0; index < 14; index += 1) {
    const angle = (index / 14) * Math.PI * 2;
    points.push({ x: x + Math.cos(angle) * radiusX, y: y + Math.sin(angle) * radiusY });
  }
  drawFloorPolygon(points, fill, focal, horizon);
}

function drawBackdrop(horizon) {
  const ceiling = ctx.createLinearGradient(0, 0, 0, horizon);
  ceiling.addColorStop(0, '#d9d8cf');
  ceiling.addColorStop(0.68, '#c4c4b9');
  ceiling.addColorStop(1, '#a7ada5');
  ctx.fillStyle = ceiling;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  const floor = ctx.createLinearGradient(0, horizon, 0, canvasHeight);
  floor.addColorStop(0, '#79837b');
  floor.addColorStop(0.44, '#687068');
  floor.addColorStop(1, '#424943');
  ctx.fillStyle = floor;
  ctx.fillRect(0, horizon, canvasWidth, canvasHeight - horizon);

  // A soft ceiling light, painted once per rendered view rather than animated.
  const light = ctx.createRadialGradient(canvasWidth * 0.52, horizon * 0.42, 0, canvasWidth * 0.52, horizon * 0.42, canvasWidth * 0.44);
  light.addColorStop(0, 'rgba(255, 246, 217, 0.28)');
  light.addColorStop(1, 'rgba(255, 246, 217, 0)');
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, canvasWidth, Math.max(horizon, 1));
}

function drawFloor(focal, horizon) {
  // Grid seams: inexpensive lines that provide perspective and movement cues.
  ctx.strokeStyle = 'rgba(213, 209, 190, 0.15)';
  ctx.lineWidth = 1;

  for (let x = 1; x < MAP_WIDTH; x += 1) {
    const segment = clipFloorSegment({ x, y: 1 }, { x, y: MAP_HEIGHT - 1 }, focal, horizon);
    if (!segment) continue;
    ctx.beginPath();
    ctx.moveTo(segment[0].x, segment[0].y);
    ctx.lineTo(segment[1].x, segment[1].y);
    ctx.stroke();
  }

  for (let y = 1; y < MAP_HEIGHT; y += 1) {
    const segment = clipFloorSegment({ x: 1, y }, { x: MAP_WIDTH - 1, y }, focal, horizon);
    if (!segment) continue;
    ctx.beginPath();
    ctx.moveTo(segment[0].x, segment[0].y);
    ctx.lineTo(segment[1].x, segment[1].y);
    ctx.stroke();
  }

  // Soft rug and furniture shadows live in world coordinates, so they move naturally with the room.
  drawFloorPolygon(
    [{ x: 4.15, y: 3.35 }, { x: 8.72, y: 3.35 }, { x: 8.72, y: 5.92 }, { x: 4.15, y: 5.92 }],
    '#955f4c',
    focal,
    horizon,
    'rgba(238, 200, 136, 0.32)',
  );

  for (let y = 3.8; y < 5.7; y += 0.47) {
    const segment = clipFloorSegment({ x: 4.28, y }, { x: 8.58, y }, focal, horizon);
    if (!segment) continue;
    ctx.strokeStyle = 'rgba(244, 211, 150, 0.39)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(segment[0].x, segment[0].y);
    ctx.lineTo(segment[1].x, segment[1].y);
    ctx.stroke();
  }

  objects.forEach((object) => {
    drawFloorEllipse(object.x, object.y + object.collision * 0.26, object.collision * 1.25, object.collision * 0.54, 'rgba(17, 23, 23, 0.25)', focal, horizon);
  });
}

function wallFill(type, wallU, side, correctedDistance) {
  const distanceShade = clamp(1.04 - correctedDistance * 0.07, 0.39, 1);
  const sideShade = side === 1 ? 0.78 : 1;
  const variation = Math.sin(wallU * 45) * 0.035;
  const base = wallColors[type] || wallColors[1];

  if (type === 3) {
    const frame = wallU < 0.06 || wallU > 0.94 || Math.abs(wallU - 0.5) < 0.025;
    return frame ? rgb({ r: 37, g: 61, b: 65 }, distanceShade * sideShade) : rgb(base, (distanceShade + variation) * (side === 1 ? 0.88 : 1), 3);
  }

  if (type === 2) {
    const grain = Math.sin(wallU * 110) * 0.08 + Math.sin(wallU * 29) * 0.04;
    return rgb(base, (distanceShade + grain) * sideShade, 6);
  }

  if (type === 5) {
    const grain = Math.sin(wallU * 66) * 0.05;
    return rgb(base, (distanceShade + grain) * sideShade, 4);
  }

  return rgb(base, (distanceShade + variation) * sideShade);
}

function drawWalls(focal, horizon) {
  const rayCount = clamp(Math.floor(canvasWidth / 2.7), 120, 250);
  const zBuffer = new Array(rayCount);
  const stripWidth = canvasWidth / rayCount + 1;
  const halfFovTan = Math.tan(FOV / 2);

  for (let index = 0; index < rayCount; index += 1) {
    const cameraX = ((index + 0.5) / rayCount) * 2 - 1;
    const angle = state.yaw + Math.atan(cameraX * halfFovTan);
    const hit = castRay(angle);
    const correctedDistance = Math.max(0.001, hit.distance * Math.cos(angle - state.yaw));
    const wallHeight = focal / correctedDistance;
    const top = horizon - wallHeight * (1 - EYE_HEIGHT);
    const bottom = horizon + wallHeight * EYE_HEIGHT;
    const columnX = index * (canvasWidth / rayCount);

    zBuffer[index] = correctedDistance;
    ctx.fillStyle = wallFill(hit.type, hit.wallU, hit.side, correctedDistance);
    ctx.fillRect(columnX, top, stripWidth, bottom - top + 1);

    // Sparse wall details use the same low ray count as the walls.
    if (hit.type === 1 && wallHeight > 46 && Math.floor(hit.wallU * 7) % 4 === 0) {
      ctx.fillStyle = `rgba(76, 73, 65, ${clamp(0.13 - correctedDistance * 0.006, 0.035, 0.13)})`;
      ctx.fillRect(columnX, top + wallHeight * 0.33, stripWidth, Math.max(1, wallHeight * 0.008));
    }

    if (hit.type === 3 && wallHeight > 28 && Math.floor(hit.wallU * 7) % 3 === 1) {
      ctx.fillStyle = `rgba(223, 247, 238, ${clamp(0.2 - correctedDistance * 0.008, 0.04, 0.2)})`;
      ctx.fillRect(columnX, top + wallHeight * 0.22, stripWidth, Math.max(1, wallHeight * 0.03));
    }

    if (hit.type === 2 && wallHeight > 40 && hit.wallU > 0.73 && hit.wallU < 0.79) {
      ctx.fillStyle = `rgba(30, 25, 20, ${clamp(0.42 - correctedDistance * 0.02, 0.1, 0.42)})`;
      ctx.fillRect(columnX, top + wallHeight * 0.53, stripWidth, Math.max(2, wallHeight * 0.04));
    }
  }

  return { zBuffer, rayCount };
}

function roundRect(context, x, y, width, height, radius) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.arcTo(x + width, y, x + width, y + height, safeRadius);
  context.arcTo(x + width, y + height, x, y + height, safeRadius);
  context.arcTo(x, y + height, x, y, safeRadius);
  context.arcTo(x, y, x + width, y, safeRadius);
  context.closePath();
}

function makeSprite(width, height, draw) {
  const sprite = document.createElement('canvas');
  sprite.width = width;
  sprite.height = height;
  const spriteContext = sprite.getContext('2d');
  spriteContext.imageSmoothingEnabled = true;
  draw(spriteContext, width, height);
  return sprite;
}

const textures = {
  desk: makeSprite(220, 146, (c, w, h) => {
    c.fillStyle = 'rgba(15, 18, 17, 0.18)';
    c.beginPath(); c.ellipse(w / 2, h - 10, w * 0.42, 9, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#5d3d2d'; c.fillRect(21, 100, 178, 14);
    c.fillStyle = '#8e6444'; c.fillRect(16, 91, 188, 13);
    c.fillStyle = '#4b3027'; c.fillRect(28, 104, 9, 37); c.fillRect(182, 104, 9, 37);
    c.fillStyle = '#1b2c32'; roundRect(c, 68, 24, 90, 65, 4); c.fill();
    c.fillStyle = '#73b9bd'; roundRect(c, 74, 30, 78, 52, 2); c.fill();
    c.fillStyle = 'rgba(224, 250, 241, 0.48)'; c.fillRect(83, 43, 45, 4); c.fillRect(83, 53, 30, 3);
    c.fillStyle = '#293a39'; c.fillRect(109, 89, 8, 12); c.fillRect(91, 100, 44, 5);
    c.fillStyle = '#2b3938'; roundRect(c, 43, 107, 49, 7, 2); c.fill();
    c.fillStyle = '#dfd8c3'; c.beginPath(); c.arc(174, 98, 8, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#d7cfb9'; c.lineWidth = 3; c.beginPath(); c.arc(181, 96, 6, -1.1, 1.1); c.stroke();
  }),
  chair: makeSprite(136, 178, (c, w, h) => {
    c.fillStyle = 'rgba(15, 18, 17, 0.19)'; c.beginPath(); c.ellipse(w / 2, h - 8, 48, 9, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#3f5c62'; roundRect(c, 29, 24, 78, 61, 17); c.fill();
    c.fillStyle = '#57757a'; roundRect(c, 34, 28, 68, 51, 13); c.fill();
    c.fillStyle = '#3e5a60'; roundRect(c, 20, 92, 96, 28, 10); c.fill();
    c.fillStyle = '#618087'; roundRect(c, 27, 95, 82, 19, 8); c.fill();
    c.fillStyle = '#293f44'; c.fillRect(63, 119, 9, 37); c.fillRect(27, 155, 82, 5);
    c.fillRect(31, 151, 5, 19); c.fillRect(100, 151, 5, 19);
    c.beginPath(); c.arc(28, 171, 6, 0, Math.PI * 2); c.arc(108, 171, 6, 0, Math.PI * 2); c.fill();
  }),
  plant: makeSprite(126, 205, (c, w, h) => {
    const leaf = (x, y, rotation, color, sizeX, sizeY) => {
      c.save(); c.translate(x, y); c.rotate(rotation); c.fillStyle = color; c.beginPath(); c.ellipse(0, -sizeY / 2, sizeX, sizeY, 0, 0, Math.PI * 2); c.fill(); c.restore();
    };
    c.fillStyle = 'rgba(15, 18, 17, 0.16)'; c.beginPath(); c.ellipse(w / 2, h - 10, 43, 8, 0, 0, Math.PI * 2); c.fill();
    leaf(61, 121, -0.7, '#41765e', 13, 61); leaf(58, 119, 0.55, '#639374', 15, 66); leaf(59, 118, 0.08, '#4b8568', 14, 77); leaf(62, 127, -1.12, '#588e6d', 10, 51); leaf(61, 127, 1.05, '#376a56', 11, 53);
    c.fillStyle = '#9d5e42'; c.beginPath(); c.moveTo(33, 145); c.lineTo(92, 145); c.lineTo(83, 194); c.lineTo(42, 194); c.closePath(); c.fill();
    c.fillStyle = '#c48358'; c.fillRect(31, 143, 63, 9);
  }),
  lamp: makeSprite(88, 230, (c, w, h) => {
    const glow = c.createRadialGradient(w / 2, 48, 4, w / 2, 48, 47); glow.addColorStop(0, 'rgba(255, 224, 144, 0.52)'); glow.addColorStop(1, 'rgba(255, 224, 144, 0)'); c.fillStyle = glow; c.fillRect(0, 0, w, 100);
    c.fillStyle = '#d6bd82'; c.beginPath(); c.moveTo(14, 65); c.lineTo(74, 65); c.lineTo(64, 20); c.lineTo(24, 20); c.closePath(); c.fill();
    c.fillStyle = '#ab8957'; c.fillRect(41, 66, 6, 133); c.fillRect(21, 198, 46, 7);
    c.fillStyle = '#72583d'; c.fillRect(25, 205, 38, 7);
  }),
  sofa: makeSprite(230, 142, (c, w, h) => {
    c.fillStyle = 'rgba(15, 18, 17, 0.19)'; c.beginPath(); c.ellipse(w / 2, h - 11, 94, 9, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#4b675f'; roundRect(c, 18, 63, 194, 54, 11); c.fill();
    c.fillStyle = '#597b70'; roundRect(c, 29, 32, 172, 55, 12); c.fill();
    c.fillStyle = '#6d9080'; roundRect(c, 38, 41, 76, 37, 8); c.fill(); roundRect(c, 118, 41, 74, 37, 8); c.fill();
    c.fillStyle = '#3b514c'; roundRect(c, 10, 62, 29, 56, 7); c.fill(); roundRect(c, 191, 62, 29, 56, 7); c.fill();
    c.fillStyle = '#2d3e3b'; c.fillRect(31, 113, 9, 19); c.fillRect(189, 113, 9, 19);
  }),
  shelf: makeSprite(130, 205, (c, w, h) => {
    c.fillStyle = 'rgba(15, 18, 17, 0.17)'; c.beginPath(); c.ellipse(w / 2, h - 8, 47, 7, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#694936'; c.fillRect(18, 18, 94, 174); c.fillStyle = '#ab7951'; c.fillRect(24, 25, 82, 8); c.fillRect(24, 82, 82, 8); c.fillRect(24, 139, 82, 8);
    const book = (x, y, width, color) => { c.fillStyle = color; c.fillRect(x, y, width, 39); };
    book(30, 39, 13, '#4f7d72'); book(45, 36, 10, '#d4a35e'); book(57, 41, 15, '#3d5d66'); book(76, 34, 12, '#bd7460');
    book(31, 96, 16, '#d1a165'); book(50, 94, 10, '#3f6f6a'); book(62, 101, 15, '#a75d4b'); book(80, 95, 13, '#627b8d');
    c.fillStyle = '#dfcf9a'; c.beginPath(); c.arc(66, 162, 15, 0, Math.PI * 2); c.fill();
  }),
};

const objects = [
  { kind: 'desk', x: 8.65, y: 2.08, width: 2.38, height: 1.34, collision: 0.92 },
  { kind: 'chair', x: 7.35, y: 4.08, width: 1.12, height: 1.05, collision: 0.55 },
  { kind: 'plant', x: 2.13, y: 2.18, width: 0.88, height: 1.38, collision: 0.39 },
  { kind: 'lamp', x: 2.08, y: 6.15, width: 0.55, height: 1.63, collision: 0.28 },
  { kind: 'sofa', x: 9.42, y: 7.54, width: 2.0, height: 0.92, collision: 0.9 },
  { kind: 'shelf', x: 1.92, y: 8.63, width: 0.75, height: 1.46, collision: 0.38 },
];

function drawObjects(zBuffer, rayCount, focal, horizon) {
  const visible = objects
    .map((object) => {
      const deltaX = object.x - state.x;
      const deltaY = object.y - state.y;
      const distance = Math.hypot(deltaX, deltaY);
      const relativeAngle = normalizeAngle(Math.atan2(deltaY, deltaX) - state.yaw);
      const forward = distance * Math.cos(relativeAngle);
      return { ...object, distance, relativeAngle, forward };
    })
    .filter((object) => object.forward > NEAR_PLANE && Math.abs(object.relativeAngle) < FOV * 0.7)
    .sort((first, second) => second.forward - first.forward);

  visible.forEach((object) => {
    const screenX = canvasWidth / 2 + Math.tan(object.relativeAngle) * focal;
    const rayIndex = clamp(Math.floor((screenX / canvasWidth) * rayCount), 0, rayCount - 1);
    if (object.forward > zBuffer[rayIndex] + 0.16) return;

    const screenHeight = (object.height / object.forward) * focal;
    const screenWidth = (object.width / object.forward) * focal;
    const bottom = horizon + (EYE_HEIGHT / object.forward) * focal;
    const top = bottom - screenHeight;
    const left = screenX - screenWidth / 2;
    const alpha = clamp(1.1 - object.forward * 0.027, 0.63, 1);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(textures[object.kind], left, top, screenWidth, screenHeight);
    ctx.restore();
  });
}

function drawVignette() {
  const vignette = ctx.createRadialGradient(
    canvasWidth * 0.5,
    canvasHeight * 0.47,
    canvasWidth * 0.18,
    canvasWidth * 0.5,
    canvasHeight * 0.47,
    canvasWidth * 0.79,
  );
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(0.7, 'rgba(9, 18, 17, 0.015)');
  vignette.addColorStop(1, 'rgba(9, 18, 17, 0.25)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
}

function renderScene() {
  if (!canvasWidth || !canvasHeight) return;

  const horizon = clamp(canvasHeight * (0.5 + state.pitch * 0.36), canvasHeight * 0.27, canvasHeight * 0.73);
  const focal = canvasWidth / (2 * Math.tan(FOV / 2));

  drawBackdrop(horizon);
  drawFloor(focal, horizon);
  const rays = drawWalls(focal, horizon);
  drawObjects(rays.zBuffer, rays.rayCount, focal, horizon);
  drawVignette();
}

function keyboardMovement() {
  const forward = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) + touchMove.forward;
  const strafe = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0) + touchMove.strafe;
  return { forward: clamp(forward, -1, 1), strafe: clamp(strafe, -1, 1) };
}

function motionActive() {
  const input = keyboardMovement();
  return Math.abs(input.forward) > 0.01 || Math.abs(input.strafe) > 0.01;
}

function movementFrame(time) {
  const delta = Math.min(34, time - movementTime || 16.67);
  movementTime = time;
  const input = keyboardMovement();

  if (Math.abs(input.forward) > 0.01 || Math.abs(input.strafe) > 0.01) {
    const amount = Math.hypot(input.forward, input.strafe) || 1;
    const forward = input.forward / amount;
    const strafe = input.strafe / amount;
    const speed = 2.65 * (delta / 1000);
    const cos = Math.cos(state.yaw);
    const sin = Math.sin(state.yaw);
    movePlayer((cos * forward - sin * strafe) * speed, (sin * forward + cos * strafe) * speed);
    renderScene();
  }

  if (motionActive()) {
    requestAnimationFrame(movementFrame);
  } else {
    movementRunning = false;
    movementTime = 0;
  }
}

function startMovement() {
  if (movementRunning || !motionActive()) return;
  movementRunning = true;
  movementTime = performance.now();
  requestAnimationFrame(movementFrame);
}

function refreshTouchMovement() {
  const mover = [...touchPointers.values()].find((pointer) => pointer.role === 'move');
  if (!mover) {
    touchMove = { forward: 0, strafe: 0 };
    return;
  }

  touchMove = {
    forward: clamp((mover.startY - mover.lastY) / 85, -1, 1),
    strafe: clamp((mover.lastX - mover.startX) / 85, -1, 1),
  };
  startMovement();
}

canvas.addEventListener('pointerdown', (event) => {
  canvas.focus({ preventScroll: true });

  if (event.pointerType === 'touch') {
    const bounds = canvas.getBoundingClientRect();
    const role = event.clientX - bounds.left < bounds.width * 0.48 ? 'move' : 'look';
    touchPointers.set(event.pointerId, {
      role,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
    });
    canvas.setPointerCapture(event.pointerId);
    if (role === 'move') refreshTouchMovement();
    event.preventDefault();
    return;
  }

  if (event.pointerType === 'mouse' && document.pointerLockElement !== canvas) {
    // Pointer lock is ideal for a desktop 360° view. A drag fallback still works in preview frames that block it.
    mouseDrag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    canvas.setPointerCapture(event.pointerId);
    const lock = canvas.requestPointerLock?.();
    if (lock?.catch) lock.catch(() => {});
  }
});

canvas.addEventListener('pointermove', (event) => {
  const pointer = touchPointers.get(event.pointerId);
  if (pointer) {
    const deltaX = event.clientX - pointer.lastX;
    const deltaY = event.clientY - pointer.lastY;
    pointer.lastX = event.clientX;
    pointer.lastY = event.clientY;

    if (pointer.role === 'look') {
      state.yaw = normalizeAngle(state.yaw + deltaX * 0.007);
      state.pitch = clamp(state.pitch - deltaY * 0.0038, -0.34, 0.34);
      requestRender();
    } else {
      refreshTouchMovement();
    }

    event.preventDefault();
    return;
  }

  if (mouseDrag && mouseDrag.id === event.pointerId && document.pointerLockElement !== canvas) {
    state.yaw = normalizeAngle(state.yaw + (event.clientX - mouseDrag.x) * 0.006);
    state.pitch = clamp(state.pitch - (event.clientY - mouseDrag.y) * 0.0032, -0.34, 0.34);
    mouseDrag.x = event.clientX;
    mouseDrag.y = event.clientY;
    requestRender();
  }
});

function releasePointer(event) {
  if (touchPointers.has(event.pointerId)) {
    touchPointers.delete(event.pointerId);
    refreshTouchMovement();
  }

  if (mouseDrag && mouseDrag.id === event.pointerId) mouseDrag = null;
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
}

canvas.addEventListener('pointerup', releasePointer);
canvas.addEventListener('pointercancel', releasePointer);

canvas.addEventListener('contextmenu', (event) => event.preventDefault());

document.addEventListener('pointerlockchange', () => {
  const isLocked = document.pointerLockElement === canvas;
  canvas.classList.toggle('is-locked', isLocked);
  if (isLocked && mouseDrag) {
    if (canvas.hasPointerCapture(mouseDrag.id)) canvas.releasePointerCapture(mouseDrag.id);
    mouseDrag = null;
  }
});

document.addEventListener('mousemove', (event) => {
  if (document.pointerLockElement !== canvas) return;
  state.yaw = normalizeAngle(state.yaw + event.movementX * 0.00255);
  state.pitch = clamp(state.pitch - event.movementY * 0.0023, -0.34, 0.34);
  requestRender();
});

document.addEventListener('keydown', (event) => {
  const moveKeys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown'];

  if (moveKeys.includes(event.code)) {
    keys.add(event.code);
    startMovement();
    event.preventDefault();
    return;
  }

  if (event.code === 'ArrowLeft' || event.code === 'ArrowRight') {
    state.yaw = normalizeAngle(state.yaw + (event.code === 'ArrowLeft' ? -0.09 : 0.09));
    requestRender();
    event.preventDefault();
  }
});

document.addEventListener('keyup', (event) => {
  if (keys.delete(event.code)) event.preventDefault();
});

window.addEventListener('blur', () => {
  keys.clear();
  touchPointers.clear();
  touchMove = { forward: 0, strafe: 0 };
});

if ('ResizeObserver' in window) {
  new ResizeObserver(resizeCanvas).observe(canvas);
} else {
  window.addEventListener('resize', resizeCanvas, { passive: true });
}

resizeCanvas();
