'use strict';
// ===== LÓGICA DO JOGO =====
const UI = {}; // ganchos preenchidos em main.js

function findExit() {
  G.exit = null;
  for (let y = 0; y < G.H; y++) for (let x = 0; x < G.W; x++) if (G.tiles[y * G.W + x] === 'X') G.exit = { x: x + 0.5, y: y + 0.5 };
}

function startLevel(i) {
  loadLevel(i); findExit();
  G.state = 'play'; G.fireCd = 0;
  if (UI.card) UI.card(G.L.name, G.L.sub);
  say(G.L.sub, 5);
}

function hurtPlayer(dmg) {
  if (G.state !== 'play') return;
  G.hp -= dmg; G.hurt = 0.9; G.shake = Math.max(G.shake, 0.7); SFX.hurt();
  if (G.hp <= 0) { G.hp = 0; G.state = 'dead'; SFX.die(); if (UI.dead) UI.dead(); }
}

function startReload() {
  if (G.reload > 0 || G.clip >= 6 || G.reserve <= 0) return;
  G.reload = 1.5; SFX.reload();
}

function damageEnemy(e, dmg) {
  e.hp -= dmg; e.hurt = 0.12; SFX.hit();
  if (e.state === 'idle') alertEnemy(e);
  e.lose = 0;
  if (e.hp <= 0 && e.state !== 'dying') {
    e.state = 'dying'; e.dead = 0; e.atk = 0; SFX.die();
    if (e.c === 'B') { G.bossDead = true; G.shots = []; say('O coração da montanha parou.\nA saída se abre.', 5); SFX.open(); G.shake = 1; }
  }
}

function tryFire() {
  if (G.state !== 'play' || G.reload > 0 || G.fireCd > 0) return;
  if (G.clip > 0) {
    G.clip--; G.fireCd = 0.3; G.flash = 1; G.recoil = 1; G.burst = 15; G.shake = Math.max(G.shake, 0.25);
    SFX.shoot();
    const a = G.ang + (G.moving > 0.5 ? 0.05 : 0.012) * (Math.random() * 2 - 1);
    const dx = Math.cos(a), dy = Math.sin(a), wd = wallDist(G.px, G.py, dx, dy, 40);
    let best = null, bt = 1e9;
    for (const e of G.enemies) {
      if (e.state === 'dead' || e.state === 'dying') continue;
      const rx = e.x - G.px, ry = e.y - G.py, t = rx * dx + ry * dy;
      if (t < 0.1 || t > wd) continue;
      const lat = Math.abs(rx * dy - ry * dx);
      if (lat < e.T.r + 0.07 && t < bt) { bt = t; best = e; }
    }
    if (best) damageEnemy(best, 1);
    if (G.clip === 0) say(G.reserve > 0 ? 'Pente vazio. Recarregue.' : 'Sem balas. Só a faca.', 2.2);
  } else if (G.reserve > 0) {
    startReload();
  } else if (G.knifeCd <= 0) {
    G.knifeCd = 0.7; G.burst = Math.max(G.burst, 3); SFX.knife();
    for (const e of G.enemies) {
      if (e.state === 'dead' || e.state === 'dying') continue;
      const rx = e.x - G.px, ry = e.y - G.py, d = Math.hypot(rx, ry);
      if (d < 1.25 + e.T.r) {
        let da = Math.atan2(ry, rx) - G.ang; da = Math.atan2(Math.sin(da), Math.cos(da));
        if (Math.abs(da) < 0.75) damageEnemy(e, 0.5);
      }
    }
  } else G.knifeCd = G.knifeCd; // ainda recuperando
}

function alertEnemy(e) {
  if (e.state === 'hunt') return;
  e.state = 'hunt'; e.lose = 0; e.cd = Math.max(e.cd, 0.4);
  const d = Math.hypot(e.x - G.px, e.y - G.py);
  if (d < 16) {
    AU.v = clamp(1 - d / 16, 0.15, 1);
    if (e.c === 'B') SFX.roar(); else if (e.c === 's') SFX.shriek(); else SFX.growl(e.c === 'o');
    AU.v = 1;
  }
}

function updatePlayer(dt) {
  G.ang += IN.turn * 2.3 * dt + IN.look; IN.look = 0;
  let mv = clamp(IN.mv, -1, 1), st = clamp(IN.st, -1, 1);
  const len = Math.hypot(mv, st); if (len > 1) { mv /= len; st /= len; }
  const wantMove = len > 0.08;
  const run = IN.run && wantMove && G.stamina > (G.running ? 2 : 22);
  G.running = run;
  const speed = (run ? 4.1 : 2.3) * (mv < 0 ? 0.7 : 1) * (G.reload > 0 ? 0.92 : 1);
  const c = Math.cos(G.ang), s = Math.sin(G.ang);
  const dx = (c * mv - s * st) * speed * dt, dy = (s * mv + c * st) * speed * dt;
  const o = { x: G.px, y: G.py };
  tryMove(o, o.x + dx, o.y + dy, 0.2);
  const moved = Math.hypot(o.x - G.px, o.y - G.py);
  G.px = o.x; G.py = o.y;
  G.moving += ((moved > 0.0005 ? 1 : 0) - G.moving) * Math.min(1, dt * 10);
  G.bob += moved * (run ? 5.2 : 6.5);
  G.stepD += moved;
  if (G.stepD > (run ? 1.05 : 1.5)) { G.stepD = 0; SFX.step(run); if (G.L.water) SFX.splash(); }
  if (run) G.stamina = Math.max(0, G.stamina - 22 * dt); else G.stamina = Math.min(100, G.stamina + (wantMove ? 14 : 24) * dt);
  G.noise = moved > 0.0005 ? (run ? 9 : 3.4) : 0.6;
  G.burst = Math.max(0, G.burst - dt * 14);
  // portais ocultos
  G.portalCd -= dt;
  if (G.L.portals && G.portalCd <= 0) {
    for (const p of G.L.portals) if (Math.floor(G.px) === p[0] && Math.floor(G.py) === p[1]) {
      G.px = p[2] + 0.5; G.py = p[3] + 0.5; G.portalCd = 1.6; G.flowAt = -1;
      SFX.portal(); G.shake = 1; G.hurt = 0.35; say('Os corredores se dobraram.\nEsta sala já foi outra.', 3.5);
      break;
    }
  }
  // armas
  G.fireCd = Math.max(0, (G.fireCd || 0) - dt);
  G.knifeCd = Math.max(0, G.knifeCd - dt);
  if (IN.fire) { IN.fire = false; tryFire(); }
  if (IN.reload) { IN.reload = false; startReload(); }
  if (G.reload > 0) {
    G.reload -= dt;
    if (G.reload <= 0) { const n = Math.min(6 - G.clip, G.reserve); G.clip += n; G.reserve -= n; }
  }
  G.flash = Math.max(0, G.flash - dt * 7); G.recoil = Math.max(0, G.recoil - dt * 6);
  G.hurt = Math.max(0, G.hurt - dt * 1.5); G.shake = Math.max(0, G.shake - dt * 3);
  if (G.hp < 40 && G.hp > 0) { G.hbT -= dt; if (G.hbT <= 0) { SFX.heart(); G.hbT = 0.55 + G.hp / 100; } }
  if (G.msgT > 0) G.msgT -= dt;
}

function updateDoors(dt) {
  for (const [k, d] of G.doors) {
    const x = k % G.W, y = (k / G.W) | 0, cx = x + 0.5, cy = y + 0.5;
    let near = Math.hypot(G.px - cx, G.py - cy) < 1.5;
    if (!near) for (const e of G.enemies) if (e.state !== 'dead' && Math.hypot(e.x - cx, e.y - cy) < 1.2) { near = true; break; }
    const prev = d.o;
    d.o = clamp(d.o + clamp((near ? 1 : 0) - d.o, -dt * 1.6, dt * 1.6), 0, 1);
    if (prev < 0.04 && d.o >= 0.04 && Math.hypot(G.px - cx, G.py - cy) < 10) { AU.v = clamp(1 - Math.hypot(G.px - cx, G.py - cy) / 12, 0.2, 1); SFX.door(); AU.v = 1; }
  }
}

function updateItems() {
  for (const it of G.items) {
    if (it.taken) continue;
    const d = Math.hypot(G.px - it.x, G.py - it.y);
    if (it.type === 'c') {
      if (!it.lit && d < 1.4) { it.lit = true; G.hp = Math.min(100, G.hp + 25); saveCheckpoint(); say('Vela acesa. Ponto seguro.\nO progresso foi guardado.', 3.6); SFX.candle(); }
      continue;
    }
    if (d > 0.55) continue;
    if (it.type === 'k') { it.taken = true; G.hasKey = true; say('Chave de ferro.\nA saída está em algum lugar.', 4); SFX.key(); }
    else if (it.type === 'a') { it.taken = true; G.reserve += 5; say('+5 balas', 2); SFX.pick(); }
    else if (it.type === 'h') { if (G.hp >= 100) continue; it.taken = true; G.hp = Math.min(100, G.hp + 35); say('Ervas curativas. +35 de vida.', 2.4); SFX.pick(); }
    else if (it.type === 'n') { it.taken = true; SFX.note(); G.state = 'note'; if (UI.note) UI.note(G.L.notes[it.idx] || '...'); }
  }
}

function updateExit(dt) {
  if (!G.exit) return;
  G.exitMsgT -= dt;
  if (Math.hypot(G.px - G.exit.x, G.py - G.exit.y) > 1.15) return;
  const ok = G.L.boss ? G.bossDead : G.hasKey;
  if (ok) {
    G.state = LEVELS[G.lvl + 1] ? 'levelend' : 'win';
    SFX.win();
    try { if (LEVELS[G.lvl + 1]) localStorage.setItem('minas_lvl', String(G.lvl + 1)); else localStorage.removeItem('minas_lvl'); } catch (e) {}
    if (G.state === 'win') { if (UI.win) UI.win(); } else if (UI.levelEnd) UI.levelEnd();
  } else if (G.exitMsgT <= 0) {
    G.exitMsgT = 2.8;
    say(G.L.boss ? 'A porta de pedra não cede.\nAlgo ainda respira.' : 'Trancada. Falta a chave.', 2.6);
  }
}

function enemyStep(e, tx, ty, speed, dt) {
  const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy);
  if (d < 0.001) return;
  tryMove(e, e.x + dx / d * speed * dt, e.y + dy / d * speed * dt, e.T.r);
}
function flowTarget(e) {
  const tx = Math.floor(e.x), ty = Math.floor(e.y);
  let best = flowAtPos(e.x, e.y), bx = e.x, by = e.y;
  for (const [dx, dy] of DIRS4) {
    const f = flowAtPos(tx + dx + 0.5, ty + dy + 0.5);
    if (f < best) { best = f; bx = tx + dx + 0.5; by = ty + dy + 0.5; }
  }
  return [bx, by];
}

function updateEnemies(dt) {
  updateFlow();
  let fearT = 0;
  const noiseR = Math.max(G.noise, G.burst);
  for (const e of G.enemies) {
    if (e.state === 'dead') continue;
    e.t += dt; e.hurt = Math.max(0, e.hurt - dt); e.cd = Math.max(0, e.cd - dt);
    if (e.state === 'dying') { e.dead += dt; if (e.dead >= 0.55) e.state = 'dead'; continue; }
    const T = e.T, dx = G.px - e.x, dy = G.py - e.y, d = Math.hypot(dx, dy);
    const los = d < 14 && hasLOS(e.x, e.y, G.px, G.py);
    const heard = flowAtPos(e.x, e.y) < noiseR * 1.4;
    if (e.state === 'idle') {
      if ((los && d < (e.c === 'B' ? 11 : 7.5)) || heard) alertEnemy(e);
      else { // vagueia perto de casa
        e.wt -= dt;
        if (e.wt <= 0) { e.wt = 1.5 + Math.random() * 3; e.wa = Math.random() * TAU; }
        const sp = T.speed * 0.18;
        const hx = e.x + Math.cos(e.wa) * 0.3, hy = e.y + Math.sin(e.wa) * 0.3;
        tryMove(e, e.x + Math.cos(e.wa) * sp * dt, e.y + Math.sin(e.wa) * sp * dt, T.r);
        void hx; void hy;
      }
      continue;
    }
    // ---- caçando
    if (los || heard) e.lose = 0; else e.lose += dt;
    if (e.lose > 8) { e.state = 'idle'; continue; }
    fearT = Math.max(fearT, clamp(1 - d / (e.c === 's' ? 11 : 8), 0, 1) * (e.c === 'B' ? 1 : 0.8));
    e.gr -= dt;
    if (e.gr <= 0 && d < 14) { e.gr = 3 + Math.random() * 4; AU.v = clamp(1 - d / 14, 0.12, 0.8); if (e.c === 's') SFX.shriek(); else SFX.growl(e.c === 'o' || e.c === 'B'); AU.v = 1; }
    if (e.c === 'B' && e.phase === 1 && e.hp <= T.hp * 0.5) { e.phase = 2; SFX.roar(); G.shake = 1; say('O CHEFE RUGE.', 2.5); e.fire = 0.8; }
    const sMul = (e.c === 'B' && e.phase === 2) ? 1.55 : 1;
    // ataque corpo a corpo com aviso
    if (e.atk > 0) {
      e.atk -= dt;
      if (e.atk <= 0) { e.cd = T.cd; if (d < T.range + 0.3 && los) hurtPlayer(T.dmg); }
    } else if (d < T.range && los && e.cd <= 0) { e.atk = T.wind; }
    // projétil do chefe
    if (e.c === 'B') {
      e.fire -= dt;
      if (e.fire <= 0 && los && d > 2.6 && d < 13 && e.atk <= 0) {
        e.fire = e.phase === 2 ? 2.0 : 3.3; SFX.fire();
        G.shots.push({ x: e.x, y: e.y, vx: dx / d * 3.7, vy: dy / d * 3.7, life: 6 });
      }
    }
    // movimento
    let sp = T.speed * sMul * (e.atk > 0 ? 0.25 : 1);
    if (e.c === 's' && lf(e.x, e.y) > 0.5) sp *= 0.45;
    if (d > T.range * 0.85) {
      if (los && d < 7) enemyStep(e, G.px, G.py, sp, dt);
      else { const t = flowTarget(e); enemyStep(e, t[0], t[1], sp, dt); }
    }
    // separação
    for (const o of G.enemies) if (o !== e && o.state !== 'dead') {
      const ox = e.x - o.x, oy = e.y - o.y, od = Math.hypot(ox, oy);
      if (od < 0.5 && od > 0.001) tryMove(e, e.x + ox / od * dt * 1.2, e.y + oy / od * dt * 1.2, T.r);
    }
  }
  G.fear += (Math.max(fearT, G.hp < 30 ? 0.4 : 0) - G.fear) * Math.min(1, dt * 2.5);
}

function updateShots(dt) {
  for (let i = G.shots.length - 1; i >= 0; i--) {
    const s = G.shots[i];
    s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
    let kill = s.life <= 0;
    if (solidAt(s.x, s.y)) { kill = true; if (Math.hypot(s.x - G.px, s.y - G.py) < 14) { AU.v = 0.5; SFX.boom(); AU.v = 1; } }
    else if (Math.hypot(s.x - G.px, s.y - G.py) < 0.42) { kill = true; hurtPlayer(18); SFX.boom(); }
    if (kill) G.shots.splice(i, 1);
  }
}

function objectiveProximity() {
  let t = null;
  if (G.L.key && !G.hasKey) { const k = G.items.find(i => i.type === 'k' && !i.taken); if (k) t = k; }
  if (!t && G.L.boss && !G.bossDead) { const b = G.enemies.find(e => e.c === 'B' && e.state !== 'dead'); if (b) t = b; }
  if (!t) t = G.exit;
  if (!t) return 0;
  const d = Math.hypot(G.px - t.x, G.py - t.y);
  return Math.pow(clamp(1 - d / 15, 0, 1), 1.6);
}

function update(dt) {
  G.time += dt;
  if (G.state !== 'play') { audioUpdate(0.05, G.fear * 0.5); return; }
  updatePlayer(dt);
  if (G.state !== 'play') return;
  updateDoors(dt); updateItems();
  if (G.state !== 'play') return;
  updateEnemies(dt); updateShots(dt); updateExit(dt);
  audioUpdate(objectiveProximity(), G.fear);
}
