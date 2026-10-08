const fs = require('fs');
const src = fs.readFileSync(__dirname + '/../game.js', 'utf8');
const test = `
const fake = { fillRect() {}, fillText() {}, measureText() { return { width: 6 }; }, setTransform() {} };
const W_ = Number(process.env.SW || 900), H_ = Number(process.env.SH || 420);
globalThis.window = { innerWidth: W_, innerHeight: H_, devicePixelRatio: 1, addEventListener() {} };
R.cvs = { style: {}, width: 0, height: 0 }; R.ctx = fake; resize();
Object.assign(UI, { card() {}, note() {}, dead() {}, levelEnd() {}, win() {}, title() {}, pause() {} });
console.log('grade', R.cols + 'x' + R.rows, 'fonte', R.fs);

function bfsNext(tx, ty) { // próximo tile no caminho até (tx,ty), com portais
  const sx = Math.floor(G.px), sy = Math.floor(G.py);
  const key = (x, y) => y * G.W + x, prev = new Map(), q = [[sx, sy]]; prev.set(key(sx, sy), null);
  const portals = (G.L.portals || []);
  while (q.length) {
    const [x, y] = q.shift();
    if (x === tx && y === ty) break;
    const nb = DIRS4.map(d => [x + d[0], y + d[1]]);
    for (const p of portals) if (p[0] === x && p[1] === y) nb.push([p[2], p[3]]);
    for (const [nx, ny] of nb) {
      if (prev.has(key(nx, ny))) continue;
      const c = tileAt(nx, ny);
      if (c === '#' || c === '%' || c === '=' || c === 'X') continue;
      prev.set(key(nx, ny), [x, y]); q.push([nx, ny]);
    }
  }
  if (!prev.has(key(tx, ty))) return null;
  let cur = [tx, ty], p = prev.get(key(tx, ty));
  if (!p) return [tx, ty];
  while (prev.get(key(p[0], p[1]))) { cur = p; p = prev.get(key(p[0], p[1])); }
  return cur;
}
function runLevel(i) {
  loadLevel(i); findExit(); G.state = 'play'; G.reserve = 999; G.clip = 6; G.hp = 1e6;
  const t0 = Date.now(); let frames = 0, kills0 = G.enemies.length, maxFear = 0;
  let key = G.items.find(it => it.type === 'k');
  const ex = Math.floor(G.exit.x), ey = Math.floor(G.exit.y);
  let exitAdj = DIRS4.map(d => [ex + d[0], ey + d[1]]).find(p => !['#', '%', '=', 'X'].includes(tileAt(p[0], p[1])));
  while (frames < 20000 && (G.state === 'play' || G.state === 'note')) {
    frames++;
    if (G.state === 'note') { G.state = 'play'; continue; }
    // alvo
    let target;
    if (G.L.key && !G.hasKey) target = [Math.floor(key.x), Math.floor(key.y)];
    else if (G.L.boss && !G.bossDead) { const b = G.enemies.find(e => e.c === 'B'); target = [Math.floor(b.x), Math.floor(b.y)]; }
    else target = exitAdj;
    // combate: mira no inimigo visível mais próximo
    let foe = null, fd = 1e9;
    for (const e of G.enemies) if (e.state !== 'dead' && e.state !== 'dying') { const d = Math.hypot(e.x - G.px, e.y - G.py); if (d < 11 && d < fd && hasLOS(G.px, G.py, e.x, e.y)) { fd = d; foe = e; } }
    if (foe && (foe.state === 'hunt' || fd < 6)) {
      G.ang = Math.atan2(foe.y - G.py, foe.x - G.px); IN.mv = fd > 3 ? 0 : -0.5; IN.st = 0; IN.fire = true; IN.run = false;
      if (G.clip === 0) IN.reload = true;
    } else {
      const nx = bfsNext(target[0], target[1]);
      const nt = nx || target;
      const wx = nt[0] + 0.5, wy = nt[1] + 0.5;
      G.ang = Math.atan2(wy - G.py, wx - G.px); IN.mv = 1; IN.st = 0; IN.run = false;
    }
    IN.look = 0; IN.turn = 0;
    update(1 / 30); render(); present();
    if (G.state === 'dead') break;
    for (const v of [G.px, G.py, G.ang, G.hp, G.fear]) if (!Number.isFinite(v)) throw new Error('NaN no estado, quadro ' + frames);
    maxFear = Math.max(maxFear, G.fear);
  }
  const ms = (Date.now() - t0) / frames;
  const killed = G.enemies.filter(e => e.state === 'dead' || e.state === 'dying').length;
  return { nivel: G.L.name, estado: G.state, quadros: frames, 'ms/quadro': ms.toFixed(2), chave: G.hasKey, mortos: killed + '/' + kills0, balasRestantes: G.clip + '+' + G.reserve, medoMax: maxFear.toFixed(2) };
}
let fail = 0;
for (let i = 0; i < LEVELS.length; i++) {
  try {
    const r = runLevel(i); console.log(r);
    if (!(r.estado === 'levelend' || r.estado === 'win')) { fail++; console.log('  >>> NÃO CONCLUIU', 'pos', G.px.toFixed(2), G.py.toFixed(2)); }
  } catch (e) { fail++; console.log('ERRO fase', i, e.stack); }
}
// teste de dano: inimigo ataca jogador parado
loadLevel(0); G.state = 'play'; G.hp = 100;
const gob = G.enemies.find(e => e.c === 'g'); gob.x = G.px + 1.4; gob.y = G.py; gob.state = 'hunt';
for (let k = 0; k < 120 && G.state === 'play'; k++) { IN.mv = 0; IN.st = 0; IN.fire = false; update(1 / 30); }
console.log('dano por goblin em 4s parado: hp', Math.round(G.hp));
if (G.hp >= 100) { fail++; console.log('  >>> goblin nao atacou'); }
// teste de morte e retorno ao checkpoint
G.hp = 5; hurtPlayer(20); console.log('morte ->', G.state); restoreCheckpoint(); G.state = 'play'; console.log('checkpoint ->', G.state, 'hp', G.hp);
// stress de render em resolucoes
console.log(fail ? 'FALHAS: ' + fail : 'TUDO OK');
process.exitCode = fail ? 1 : 0;
`;
new Function('process', 'require', src + '\n' + test)(process, require);
