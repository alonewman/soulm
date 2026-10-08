'use strict';
// ===== RENDERIZADOR 3D EM ASCII =====
let NL = [], LR = 4;
function prepLights() {
  NL = [];
  for (const l of G.lights) { const dx = l.x - G.px, dy = l.y - G.py; if (dx * dx + dy * dy < 400) NL.push([l.x, l.y, 0.55, l.x * 7 + l.y * 3]); }
  for (const it of G.items) if (it.type === 'c' && it.lit) NL.push([it.x, it.y, 0.85, it.x * 5 + it.y]);
  LR = G.L.light * (0.94 + 0.06 * Math.sin(G.time * 9.1 + Math.sin(G.time * 3.3) * 2)) * (1 - 0.22 * G.fear * (0.5 + 0.5 * Math.sin(G.time * 31)));
}
function lf(x, y) {
  const dx = x - G.px, dy = y - G.py, d = Math.sqrt(dx * dx + dy * dy);
  let b = 0.075 * Math.max(0, 1 - d / 16);
  if (d < LR) { const a = 1 - d / LR; b += Math.pow(a, 1.15) * 1.12; }
  for (let i = 0; i < NL.length; i++) {
    const l = NL[i], ex = x - l[0], ey = y - l[1], e2 = ex * ex + ey * ey;
    if (e2 < 49) { const a = 1 - Math.sqrt(e2) / 7; b += a * a * l[2] * (0.88 + 0.12 * Math.sin(G.time * 11 + l[3])); }
  }
  if (G.flash > 0) b += G.flash * Math.max(0, 1 - d / 9) * 1.3;
  return b;
}

const WOOD = ' .:!|IHH#@';
let wch = 32, wlay = 0, wlvl = 0;
function stoneCell(mx, my, u, v, b, side) {
  const row = Math.floor(v * 5), off = (row & 1) ? 0.5 : 0, fr = v * 5 - row;
  const bu = u * 2 + off, bi = Math.floor(bu);
  const mort = fr < 0.13 || (bu - bi) < 0.07;
  b *= mort ? 0.45 : 0.8 + 0.32 * hash2(mx * 3 + bi, my * 3 + row, side, 7);
  const lvl = clamp(Math.round(b * 9), 0, 9);
  wlay = 0; wlvl = lvl; wch = lvl === 0 ? 32 : (mort ? (lvl > 3 ? 58 : 46) : RAMP.charCodeAt(lvl));
}
function wallCell(c, mx, my, u, v, b, side, unlocked) {
  if (c === 'D') {
    wlay = 1; let ch = 0;
    const pl = (u * 4) % 1;
    if (pl < 0.07) { ch = 124; b *= 0.5; }
    else if ((v > 0.16 && v < 0.24) || (v > 0.76 && v < 0.84)) { ch = 61; b *= 1.2; }
    else if (Math.abs(u - 0.82) < 0.025 && Math.abs(v - 0.5) < 0.02) { ch = 111; b *= 1.6; }
    const lvl = clamp(Math.round(b * 9), 0, 9);
    wlvl = lvl; wch = lvl === 0 ? 32 : (ch || WOOD.charCodeAt(lvl)); return;
  }
  if (c === 'X') {
    wlay = unlocked ? 9 : 4;
    let ch = 0, k = b;
    if (u < 0.1 || u > 0.9 || v < 0.07) { ch = 35; k *= 1.1; }
    else if (Math.abs(u - 0.5) < 0.07 && Math.abs(v - 0.55) < 0.07) { ch = 79; k = 1.3; }
    else if ((u * 6) % 1 < 0.18) { ch = 124; }
    else ch = 58;
    let lvl = clamp(Math.round(k * 9), 0, 9);
    lvl = unlocked ? clamp(Math.max(lvl, 5) + Math.round(1.5 * Math.sin(G.time * 3)), 4, 9) : Math.max(lvl, 2);
    wlvl = lvl; wch = ch; return;
  }
  stoneCell(mx, my, u, v, b, side);
  if (c === '%') {
    if (u > 0.18 && u < 0.82 && v > 0.2 && v < 0.8) {
      const gu = Math.floor((u - 0.18) / 0.64 * 5), gv = Math.floor((v - 0.2) / 0.6 * 7);
      if (gu === 2 || hash2(mx, my, gu, gv) < 0.4) {
        wlay = 2; wch = (gu === 2) ? 124 : (gv & 1 ? 43 : 45);
        wlvl = clamp(5 + Math.round(2 * Math.sin(G.time * 2 + mx + my * 2)), 4, 8);
      }
    }
  } else if (c === '=') {
    if (u > 0.36 && u < 0.64 && v > 0.3 && v < 0.7) {
      wlay = 3; wlvl = 8 + (((G.time * 9 + u * 13) | 0) & 1);
      wch = [94, 42, 39][((G.time * 8 + u * 11 + v * 7) | 0) % 3];
    } else if (u > 0.44 && u < 0.56 && v >= 0.7 && v < 0.88) { wlay = 1; wch = 124; wlvl = 5; }
  }
}

function render() {
  const cols = R.cols, rows = R.rows, ch = R.ch, ci = R.ci, K = R.K;
  clearBuf(); prepLights(); R.aim = false;
  const sh = G.shake > 0 ? (Math.random() - 0.5) * G.shake * 1.6 : 0;
  const horizon = rows / 2 + (G.moving ? Math.sin(G.bob) * 0.7 : 0) + sh;
  const dirX = Math.cos(G.ang), dirY = Math.sin(G.ang), plX = -dirY * PLANE, plY = dirX * PLANE;
  const px = G.px, py = G.py, W = G.W, water = !!G.L.water;
  const unlocked = G.L.boss ? G.bossDead : G.hasKey;
  const T = G.time;
  for (let x = 0; x < cols; x++) {
    const camX = 2 * x / cols - 1, rdx = dirX + plX * camX, rdy = dirY + plY * camX;
    let mx = Math.floor(px), my = Math.floor(py);
    const ddx = Math.abs(1 / (rdx || 1e-9)), ddy = Math.abs(1 / (rdy || 1e-9));
    const stx = rdx < 0 ? -1 : 1, sty = rdy < 0 ? -1 : 1;
    let sdx = (rdx < 0 ? px - mx : mx + 1 - px) * ddx, sdy = (rdy < 0 ? py - my : my + 1 - py) * ddy;
    let side = 0, c = '#', doorO = 0;
    for (let i = 0; i < 64; i++) {
      if (sdx < sdy) { sdx += ddx; mx += stx; side = 0; } else { sdy += ddy; my += sty; side = 1; }
      c = tileAt(mx, my);
      if (c === '#' || c === '%' || c === '=' || c === 'X') break;
      if (c === 'D') { doorO = G.doors.get(my * W + mx).o; if (doorO < 0.6) break; }
      c = '.';
    }
    if (c === '.') c = '#';
    const perp = Math.max(0.04, side === 0 ? sdx - ddx : sdy - ddy);
    R.zb[x] = perp;
    const lineRows = K / perp, top0 = horizon - lineRows / 2, bot0 = horizon + lineRows / 2;
    let wx = side === 0 ? py + perp * rdy : px + perp * rdx; wx -= Math.floor(wx);
    if ((side === 0 && rdx > 0) || (side === 1 && rdy < 0)) wx = 1 - wx;
    const vfx = R.vfx[x];

    // ---- teto
    const cEnd = Math.min(rows - 1, Math.ceil(top0) - 1);
    for (let r = 0; r <= cEnd; r++) {
      const p = horizon - (r + 0.5); if (p < 0.3) continue;
      const d = K / (2 * p), fx = px + rdx * d, fy = py + rdy * d;
      const b = lf(fx, fy) * 0.62 * vfx * R.vfy[r];
      const lvl = clamp(Math.round(b * 9), 0, 9);
      if (lvl < 1) continue;
      const n = hash2(Math.floor(fx * 2), Math.floor(fy * 2), 5, 2);
      const i = r * cols + x;
      ch[i] = n > 0.55 ? 46 : (n > 0.3 ? 39 : 96); ci[i] = lvl - 1;
    }
    // ---- chão
    for (let r = Math.max(0, Math.floor(bot0) + 1); r < rows; r++) {
      const p = r + 0.5 - horizon; if (p < 0.3) continue;
      const d = K / (2 * p), fx = px + rdx * d, fy = py + rdy * d;
      const b = lf(fx, fy) * vfx * R.vfy[r];
      const i = r * cols + x;
      if (water) {
        const w = Math.sin(fx * 3.1 + T * 1.3) + Math.sin(fy * 2.7 - T * 1.1) + Math.sin((fx + fy) * 1.9 + T * 0.7);
        const lvl = clamp(Math.round(b * 9) + (w > 1.3 ? 1 : 0), 0, 9);
        if (lvl < 1) continue;
        ch[i] = w > 1.3 ? 126 : (w > 0.3 ? 45 : (w > -0.6 ? 44 : 46)); ci[i] = 70 + lvl;
      } else {
        const lvl = clamp(Math.round(b * 8.5), 0, 9);
        if (lvl < 1) continue;
        const ffx = fx - Math.floor(fx), ffy = fy - Math.floor(fy);
        const n = hash2(Math.floor(fx * 2), Math.floor(fy * 2), 3, 1);
        if (ffx < 0.05 || ffy < 0.05) { ch[i] = lvl > 2 ? 45 : 46; ci[i] = lvl; }
        else { ch[i] = n > 0.9 ? 44 : (n < 0.08 ? 39 : (lvl > 4 ? 58 : 46)); ci[i] = Math.max(1, lvl - 1); }
      }
    }
    // ---- parede
    const hx = px + rdx * perp * 0.985, hy = py + rdy * perp * 0.985;
    const b0 = lf(hx, hy) * (side ? 0.8 : 1) * vfx;
    const lift = (c === 'D' && doorO > 0) ? doorO / 0.6 * lineRows : 0;
    const top = top0 - lift, bot = bot0 - lift;
    const r0 = Math.max(0, Math.ceil(top)), r1 = Math.min(rows - 1, Math.floor(bot));
    const distFade = perp > 11 ? 1 : 0;
    for (let r = r0; r <= r1; r++) {
      const v = (r + 0.5 - top) / (bot - top);
      const t2 = Math.abs(2 * v - 1);
      const b = b0 * R.vfy[r] * (1 - 0.45 * t2 * t2 * t2);
      wallCell(c, mx, my, wx, v, b, side, unlocked);
      if (wch === 32) continue;
      const i = r * cols + x;
      ch[i] = wch; ci[i] = wlay * 10 + Math.max(0, wlvl - (wlay === 2 ? distFade : 0));
    }
  }
  renderSprites(dirX, dirY, plX, plY, horizon);
  drawWeapon();
  drawHUD();
  postFX();
}

function drawSprite(art, sp, sz, lift, layer, lvl, opt) {
  const cols = R.cols, rows = R.rows, K = R.K, ty = sp.ty;
  const aw = art[0].length, ah = art.length;
  const scaleY = opt.scaleY === undefined ? 1 : opt.scaleY;
  const hR = K * sz / ty * scaleY;
  const wC = (aw * 0.55 / ah) * sz * K * (R.lh / R.cw) / ty;
  const screenX = (cols / 2) * (1 + sp.tx / ty);
  const ground = opt.horizon + K / (2 * ty);
  const bottom = ground - lift * K / ty, top = bottom - hR;
  const sx0 = Math.floor(screenX - wC / 2), sx1 = Math.max(sx0, Math.floor(screenX + wC / 2));
  const wN = sx1 - sx0 + 1, r0 = Math.max(0, Math.ceil(top)), r1 = Math.min(rows - 1, Math.floor(bottom));
  const eyes = opt.eyes, mid = cols >> 1;
  for (let c = Math.max(0, sx0); c <= sx1 && c < cols; c++) {
    if (ty >= R.zb[c]) continue;
    const ac = Math.min(aw - 1, Math.floor((c - sx0 + 0.5) / wN * aw));
    if (opt.enemy && c === mid) R.aim = true;
    for (let r = r0; r <= r1; r++) {
      const ar = Math.min(ah - 1, Math.floor((r + 0.5 - top) / (bottom - top) * ah));
      const cc = art[ar].charCodeAt(ac);
      if (cc === 32) continue;
      const i = r * cols + c;
      if (cc === 101) { if (eyes) { R.ch[i] = 64; R.ci[i] = 49; } continue; }
      if (lvl <= 0) continue;
      R.ch[i] = cc; R.ci[i] = layer * 10 + lvl;
    }
  }
}

function renderSprites(dirX, dirY, plX, plY, horizon) {
  const list = [];
  for (const it of G.items) if (!it.taken) list.push({ k: 'item', x: it.x, y: it.y, it });
  for (const e of G.enemies) list.push({ k: 'enemy', x: e.x, y: e.y, e });
  for (const s of G.shots) list.push({ k: 'orb', x: s.x, y: s.y, s });
  const inv = 1 / (plX * dirY - dirX * plY);
  for (const sp of list) {
    const dx = sp.x - G.px, dy = sp.y - G.py;
    sp.tx = inv * (dirY * dx - dirX * dy); sp.ty = inv * (-plY * dx + plX * dy); sp.d = dx * dx + dy * dy;
  }
  list.sort((a, b) => b.d - a.d);
  for (const sp of list) {
    if (sp.ty < 0.12) continue;
    if (sp.k === 'item') {
      const it = sp.it, def = ITEM_DEF[it.type];
      let lvl = clamp(Math.round(lf(it.x, it.y) * 9), 0, 9);
      let layer = def.layer;
      if (it.type === 'c') { if (!it.lit) { layer = 0; lvl = Math.max(lvl, 2); } else lvl = 9; }
      else lvl = Math.max(lvl, 4 + (((G.time * 3 + it.x * 5) | 0) & 1) * 2);
      const art = (it.type === 'c' && !it.lit) ? ART.candle.map((r, i) => i === 0 ? '   ' : r) : ART.candle && ART[def.art];
      drawSprite(art, sp, def.sz, def.lift, layer, lvl, { horizon });
    } else if (sp.k === 'orb') {
      drawSprite(ART.orb, sp, 0.3, 0.45, 3, 9, { horizon });
    } else {
      const e = sp.e, T = e.T;
      if (e.state === 'dead') {
        const lvl = clamp(Math.round(lf(e.x, e.y) * 9), 0, 6);
        drawSprite(ART.corpse, sp, 0.14, 0, 4, lvl, { horizon });
        continue;
      }
      let lvl = clamp(Math.round(lf(e.x, e.y) * 10), 0, 9), layer = T.layer;
      if (e.c === 's' && lvl < 3) lvl = 0;
      if (e.hurt > 0) { layer = 8; lvl = 9; }
      else if (e.atk > 0 && ((G.time * 14) | 0) % 2) { lvl = 9; }
      const bob = e.state === 'hunt' ? 0.03 * Math.sin(e.t * 10) : 0.012 * Math.sin(e.t * 2);
      const opt = { horizon, eyes: e.state !== 'dying', enemy: true };
      if (e.state === 'dying') { opt.scaleY = Math.max(0.05, 1 - e.dead / 0.55); opt.enemy = false; }
      drawSprite(ART[T.art], sp, T.sz, bob, layer, lvl, opt);
    }
  }
}

function drawWeapon() {
  const art = ART.gun, w = art[0].length, h = art.length;
  const ox = Math.floor(R.cols / 2 - w / 2 + Math.sin(G.bob * 0.5) * G.moving * 2.4);
  let oy = R.rows - h + 1 + Math.round(Math.abs(Math.sin(G.bob)) * G.moving * 1.4) - Math.round(G.recoil * 3);
  if (G.reload > 0) { const p = 1 - G.reload / 1.5; oy += Math.round(Math.sin(p * Math.PI) * (h - 2)); }
  const lvl = clamp(5 + Math.round(G.flash * 5), 4, 9);
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
    const cc = art[r].charCodeAt(c); if (cc === 32) continue;
    put(ox + c, oy + r, cc, 0, cc === 35 ? Math.max(2, lvl - 2) : lvl);
  }
  if (G.flash > 0.45) {
    const f = ART.flash;
    for (let r = 0; r < f.length; r++) for (let c = 0; c < w; c++) { const cc = f[r].charCodeAt(c); if (cc !== 32) put(ox + c, oy - f.length + r, cc, 8, 9); }
  }
  if (G.knifeCd > 0.35) { // golpe de faca
    const my = (R.rows >> 1) - 3, mx = R.cols >> 1;
    for (let i = -6; i <= 6; i++) put(mx + i, my + Math.round(i * 0.5), i < 0 ? 92 : 47, 8, 9);
  }
}

function drawHUD() {
  const rows = R.rows, cols = R.cols;
  put(cols >> 1, rows >> 1, 43, R.aim ? 4 : 0, R.aim ? 9 : 5);
  const hpN = clamp(Math.round(G.hp / 10), 0, 10);
  putText(2, rows - 2, 'VIDA [' + '#'.repeat(hpN) + '.'.repeat(10 - hpN) + '] ' + Math.ceil(G.hp), 4, G.hp < 35 ? 9 : 6);
  let ammo = '';
  for (let i = 0; i < 6; i++) ammo += i < G.clip ? '|' : '.';
  const am = G.reload > 0 ? 'RECARREGANDO...' : ('BALAS [' + ammo + '] +' + G.reserve);
  putText(cols - am.length - 2, rows - 2, am, 6, (G.clip === 0 && G.reload <= 0) ? 9 : 7);
  if (G.stamina < 98) { const sN = Math.round(G.stamina / 10); putText(2, rows - 3, 'FOLEGO [' + '='.repeat(sN) + ' '.repeat(10 - sN) + ']', 0, 5); }
  const key = G.L.boss ? '' : (G.hasKey ? 'CHAVE [o-]' : 'CHAVE [  ]');
  if (key) putCenter(1, key, G.hasKey ? 9 : 0, G.hasKey ? 8 : 4);
  putText(2, 1, G.L.name, 0, 4);
  if (G.msgT > 0 && G.msg) {
    const lines = G.msg.split('\n');
    lines.forEach((ln, i) => putCenter(rows - 5 - (lines.length - 1 - i), ln, 0, G.msgT < 0.7 ? 5 : 8));
  }
}

const GLITCH = '@#%&?!/\\|<>~^';
function postFX() {
  const n = R.cols * R.rows, ch = R.ch, ci = R.ci;
  const amt = Math.max(G.hurt, G.hp < 30 ? 0.22 + 0.14 * Math.sin(G.time * 6) : 0);
  if (amt > 0.02) for (let i = 0; i < n; i++) if (ch[i] !== 32 && Math.random() < amt) ci[i] = 40 + (ci[i] % 10);
  if (G.fear > 0.15) {
    const k = Math.floor(G.fear * n * 0.003);
    for (let j = 0; j < k; j++) {
      const i = (Math.random() * n) | 0;
      ch[i] = GLITCH.charCodeAt((Math.random() * GLITCH.length) | 0); ci[i] = 43 + ((Math.random() * 5) | 0);
    }
    if (G.fear > 0.5 && Math.random() < 0.05) {
      const x = 8 + ((Math.random() * (R.cols - 20)) | 0), y = 4 + ((Math.random() * (R.rows * 0.5)) | 0);
      put(x, y, 111, 4, 9); put(x + 3, y, 111, 4, 9);
    }
  }
}
