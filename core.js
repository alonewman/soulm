'use strict';
// ===== NÚCLEO: estado, mapa, colisão, inimigos =====
const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
function hash2(a, b, c, d) {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 2147483647) + Math.imul(d | 0, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const G = {
  state: 'title', lvl: 0, L: null, W: 0, H: 0, tiles: null, doors: new Map(),
  lights: [], items: [], enemies: [], shots: [],
  px: 1.5, py: 1.5, ang: 0, hp: 100, stamina: 100, clip: 6, reserve: 6,
  hasKey: false, bossDead: false, time: 0,
  flash: 0, recoil: 0, reload: 0, hurt: 0, shake: 0, fear: 0, noise: 0, burst: 0,
  bob: 0, stepD: 0, msg: '', msgT: 0, cp: null, flow: null, flowAt: -1,
  portalCd: 0, knifeCd: 0, moving: 0, running: false, fadeT: 0, hbT: 0, hint: '', exitMsgT: 0,
};
const IN = { mv: 0, st: 0, turn: 0, fire: false, reload: false, run: false, look: 0 };

const ETYPES = {
  g: { name: 'goblin', hp: 2, speed: 2.5, r: 0.22, dmg: 9, range: 0.85, wind: 0.28, cd: 1.0, sz: 0.62, art: 'goblin', layer: 4 },
  o: { name: 'orc', hp: 5, speed: 1.35, r: 0.3, dmg: 24, range: 1.0, wind: 0.55, cd: 1.6, sz: 0.95, art: 'orc', layer: 4 },
  s: { name: 'sombra', hp: 3, speed: 2.9, r: 0.22, dmg: 13, range: 0.9, wind: 0.3, cd: 1.2, sz: 0.9, art: 'shade', layer: 5 },
  B: { name: 'chefe', hp: 30, speed: 1.45, r: 0.55, dmg: 32, range: 1.7, wind: 0.7, cd: 2.0, sz: 1.35, art: 'boss', layer: 4 },
};
function makeEnemy(c, x, y) {
  const T = ETYPES[c];
  return { c, T, x, y, hp: T.hp, state: 'idle', t: Math.random() * 10, atk: 0, cd: 0.5, hurt: 0, dead: 0,
    lose: 0, wa: Math.random() * TAU, wt: 0, fire: 2.5, phase: 1, roar: 0, gr: 2 + Math.random() * 4 };
}

function loadLevel(i) {
  const L = LEVELS[i]; G.lvl = i; G.L = L;
  const rows = L.map; G.H = rows.length; G.W = Math.max(...rows.map(r => r.length));
  G.tiles = new Array(G.W * G.H).fill('#');
  G.doors.clear(); G.lights = []; G.items = []; G.enemies = []; G.shots = [];
  let nIdx = 0;
  for (let y = 0; y < G.H; y++) for (let x = 0; x < G.W; x++) {
    const c = rows[y][x] || '#', cx = x + 0.5, cy = y + 0.5;
    let t = c;
    if (c === 'S') { G.px = cx; G.py = cy; t = '.'; }
    else if ('kahnc'.includes(c)) { G.items.push({ type: c, x: cx, y: cy, taken: false, idx: c === 'n' ? nIdx++ : 0, lit: false }); t = '.'; }
    else if ('gosB'.includes(c)) { G.enemies.push(makeEnemy(c, cx, cy)); t = '.'; }
    else if (c === 'p') t = '.';
    else if (c === 'D') G.doors.set(y * G.W + x, { o: 0, snd: 0 });
    else if (c === '=') G.lights.push({ x: cx, y: cy, k: 1 });
    G.tiles[y * G.W + x] = t;
  }
  G.ang = L.dir; G.hp = Math.max(G.hp, 60); G.stamina = 100; G.clip = Math.min(G.clip, 6);
  G.hasKey = false; G.bossDead = false; G.flowAt = -1; G.reload = 0; G.flash = 0; G.hurt = 0; G.fear = 0;
  G.portalCd = 0; G.msg = ''; G.msgT = 0; G.hint = '';
  if (i === 0 && !G._keepAmmo) { G.hp = 100; G.clip = 6; G.reserve = 6; }
  saveCheckpoint(true);
}

function saveCheckpoint(silent) {
  G.cp = {
    x: G.px, y: G.py, ang: G.ang, hp: G.hp, clip: G.clip, reserve: G.reserve, hasKey: G.hasKey,
    items: G.items.map(it => [it.taken, it.lit]),
    en: G.enemies.map(e => [e.hp, e.dead, e.x, e.y, e.state]),
    bossDead: G.bossDead,
  };
}
function restoreCheckpoint() {
  const c = G.cp; if (!c) return;
  G.px = c.x; G.py = c.y; G.ang = c.ang; G.hp = Math.max(c.hp, 45); G.clip = c.clip; G.reserve = Math.max(c.reserve, 3);
  G.hasKey = c.hasKey; G.bossDead = c.bossDead;
  G.items.forEach((it, i) => { it.taken = c.items[i][0]; it.lit = c.items[i][1]; });
  G.enemies.forEach((e, i) => { const s = c.en[i]; e.hp = s[0]; e.dead = s[1]; e.x = s[2]; e.y = s[3]; e.state = s[1] ? 'dead' : 'idle'; e.atk = 0; e.cd = 1; e.lose = 0; });
  G.shots = []; G.reload = 0; G.hurt = 0; G.flowAt = -1; G.fear = 0; G.stamina = 100;
}

function tileAt(x, y) { return (x < 0 || y < 0 || x >= G.W || y >= G.H) ? '#' : G.tiles[y * G.W + x]; }
function isSolid(x, y) {
  const c = tileAt(x, y);
  if (c === '#' || c === '%' || c === '=' || c === 'X') return true;
  if (c === 'D') return G.doors.get(y * G.W + x).o < 0.6;
  return false;
}
function solidAt(fx, fy) { return isSolid(Math.floor(fx), Math.floor(fy)); }
function blocked(x, y, r) { return solidAt(x - r, y - r) || solidAt(x + r, y - r) || solidAt(x - r, y + r) || solidAt(x + r, y + r); }
function tryMove(o, nx, ny, r) {
  if (!blocked(nx, o.y, r)) o.x = nx;
  if (!blocked(o.x, ny, r)) o.y = ny;
}

// raio simples (para visão e tiro). devolve distância até a parede
function wallDist(x, y, dx, dy, maxD) {
  let mx = Math.floor(x), my = Math.floor(y);
  const ddx = Math.abs(1 / (dx || 1e-9)), ddy = Math.abs(1 / (dy || 1e-9));
  let sx = dx < 0 ? -1 : 1, sy = dy < 0 ? -1 : 1;
  let sdx = (dx < 0 ? x - mx : mx + 1 - x) * ddx, sdy = (dy < 0 ? y - my : my + 1 - y) * ddy;
  let d = 0;
  for (let i = 0; i < 64; i++) {
    if (sdx < sdy) { d = sdx; sdx += ddx; mx += sx; } else { d = sdy; sdy += ddy; my += sy; }
    if (d > maxD) return maxD;
    if (isSolid(mx, my)) return d;
  }
  return maxD;
}
function hasLOS(ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy);
  if (d < 0.01) return true;
  return wallDist(ax, ay, dx / d, dy / d, d) >= d - 0.05;
}

function updateFlow() {
  const k = Math.floor(G.py) * G.W + Math.floor(G.px);
  if (k === G.flowAt) return; G.flowAt = k;
  const N = G.W * G.H;
  if (!G.flow || G.flow.length !== N) G.flow = new Int16Array(N);
  G.flow.fill(9999);
  const q = new Int32Array(N); let h = 0, t = 0;
  G.flow[k] = 0; q[t++] = k;
  while (h < t) {
    const cur = q[h++], cx = cur % G.W, cy = (cur / G.W) | 0, d = G.flow[cur] + 1;
    for (const [dx, dy] of DIRS4) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= G.W || ny >= G.H) continue;
      const nk = ny * G.W + nx;
      if (G.flow[nk] <= d) continue;
      const c = G.tiles[nk];
      if (c === '#' || c === '%' || c === '=' || c === 'X') continue;
      G.flow[nk] = d; q[t++] = nk;
    }
  }
}
function flowAtPos(x, y) {
  const tx = Math.floor(x), ty = Math.floor(y);
  if (tx < 0 || ty < 0 || tx >= G.W || ty >= G.H) return 9999;
  return G.flow ? G.flow[ty * G.W + tx] : 9999;
}

function say(text, t) { G.msg = text; G.msgT = t || 3.2; }

// luz num ponto do mundo (0..1): lanterna + tochas + velas + clarão do tiro
function lightAt(x, y) {
  const d = Math.hypot(x - G.px, y - G.py), R = G.L.light * (0.94 + 0.06 * Math.sin(G.time * 9.1 + Math.sin(G.time * 3.3) * 2));
  let b = 0;
  if (d < R) { const a = 1 - d / R; b = a * a * (0.55 + 0.45 * a); }
  b += lightExtra(x, y);
  if (G.flash > 0) b += G.flash * Math.max(0, 1 - d / 9) * 1.3;
  return b;
}
function lightExtra(x, y) {
  let b = 0;
  for (const l of G.lights) {
    const dx = x - l.x, dy = y - l.y, d2 = dx * dx + dy * dy;
    if (d2 < 49) { const a = 1 - Math.sqrt(d2) / 7; b += a * a * 0.55 * (0.88 + 0.12 * Math.sin(G.time * 11 + l.x * 7 + l.y * 3)); }
  }
  for (const it of G.items) if (it.type === 'c' && it.lit) {
    const dx = x - it.x, dy = y - it.y, d2 = dx * dx + dy * dy;
    if (d2 < 64) { const a = 1 - Math.sqrt(d2) / 8; b += a * a * 0.8; }
  }
  return b;
}
