'use strict';
// ===== INICIALIZAÇÃO, INTERFACE E LAÇO PRINCIPAL =====
function ui$(id) { return document.getElementById(id); }
let savedLvl = 0;
try { savedLvl = parseInt(localStorage.getItem('minas_lvl') || '0', 10) || 0; } catch (e) {}

function showOv(html) { const ov = ui$('ov'); ov.innerHTML = '<div class="wrap">' + html + '</div>'; ov.scrollTop = 0; ov.hidden = false; ui$('app').classList.add('ovon'); }
function hideOv() { ui$('ov').hidden = true; ui$('app').classList.remove('ovon'); }
function onTap(id, fn) {
  const el = ui$(id); if (!el) return;
  let t = 0;
  const go = e => { e.preventDefault(); e.stopPropagation(); const n = Date.now(); if (n - t < 500) return; t = n; fn(); };
  el.addEventListener('pointerdown', go); el.addEventListener('click', go); // click = reserva caso o toque falhe
}

function enterFullscreen() {
  try { const el = document.documentElement; (el.requestFullscreen || el.webkitRequestFullscreen || function () { return Promise.reject(); }).call(el).catch(() => {}); } catch (e) {}
  try { screen.orientation.lock('landscape').catch(() => {}); } catch (e) {}
  try { navigator.wakeLock.request('screen').catch(() => {}); } catch (e) {}
}

function beginGame(lvl, fresh) {
  audioInit(); enterFullscreen(); hideOv();
  if (fresh) { G.hp = 100; G.clip = 6; G.reserve = 6; G._keepAmmo = false; }
  else if (lvl > 0) { G.hp = 100; G.clip = 6; G.reserve = 8; G._keepAmmo = true; }
  startLevel(lvl);
}

UI.title = function () {
  G.state = 'title';
  const cont = savedLvl > 0 && LEVELS[savedLvl]
    ? '<button class="btn" id="oCont">CONTINUE &mdash; ' + LEVELS[savedLvl].name + '</button>' : '';
  showOv(
    '<div class="panel title">' +
    '<div class="kicker">-=[ ASCII horror game ]=-</div>' +
    '<h1>THE FORGOTTEN<br>MINES</h1>' +
    '<p class="lead">A dwarven fortress with no end. A few bullets, a lantern, and something that hears you breathe.</p>' +
    '<div class="btns"><button class="btn main" id="oNew">NEW GAME</button>' + cont + '</div>' +
    '</div>' +
    '<div class="panel howto"><h2>How to play</h2><ul>' +
    '<li><b>Left:</b> drag to walk. Drag far to <b>run</b>.</li>' +
    '<li><b>Right:</b> drag to look. <b>FIRE</b> also turns if you slide.</li>' +
    '<li>Running and shooting make <b>noise</b>. Monsters listen.</li>' +
    '<li>Find the <b>key</b>, then the <b>exit</b>. Candles save your progress.</li>' +
    '<li>Runes glow in the dark. Items glint.</li>' +
    '<li class="dim">Turn your phone sideways. Use headphones.</li></ul></div>'
  );
  onTap('oNew', () => beginGame(0, true));
  onTap('oCont', () => beginGame(savedLvl, false));
};
UI.note = function (text) {
  showOv('<div class="panel note"><div class="kicker">note found</div><p class="parch">' + text.replace(/\n/g, '<br>') + '</p><button class="btn" id="oClose">KEEP</button></div>');
  onTap('oClose', () => { hideOv(); G.state = 'play'; });
};
UI.dead = function () {
  setTimeout(() => {
    if (G.state !== 'dead') return;
    showOv('<div class="panel dead"><h1 class="red">YOU DIED</h1><p class="lead">The stone keeps those who do not return.</p><button class="btn main" id="oRetry">TRY AGAIN</button></div>');
    onTap('oRetry', () => { restoreCheckpoint(); hideOv(); G.state = 'play'; G.hurt = 0; say('Back at the last candle.', 3); });
  }, 1100);
};
UI.levelEnd = function () {
  const nxt = LEVELS[G.lvl + 1];
  setTimeout(() => {
    showOv('<div class="panel"><div class="kicker">level complete</div><h1>' + G.L.name + '</h1><p class="lead">The door gives way. Deeper.</p><button class="btn main" id="oNext">DESCEND &mdash; ' + nxt.name + '</button></div>');
    onTap('oNext', () => { hideOv(); G._keepAmmo = true; G.hp = Math.min(100, G.hp + 20); startLevel(G.lvl + 1); });
  }, 1400);
};
UI.win = function () {
  setTimeout(() => {
    showOv('<div class="panel"><div class="kicker">the end</div><h1>LIGHT</h1><p class="lead">The door opens onto a night with no stars. The cold air is almost sweet.<br><br>Behind you, far below, the humming starts again.</p><button class="btn main" id="oAgain">BACK TO THE START</button></div>');
    onTap('oAgain', () => { try { localStorage.removeItem('minas_lvl'); } catch (e) {} savedLvl = 0; G._keepAmmo = false; loadLevel(0); findExit(); UI.title(); });
  }, 1600);
};
UI.pause = function () {
  if (G.state === 'play') {
    G.state = 'pause';
    showOv('<div class="panel"><h1>PAUSED</h1><div class="btns"><button class="btn main" id="oRes">RESUME</button><button class="btn" id="oRst">RESTART LEVEL</button><button class="btn" id="oSnd">SOUND: ' + (AU.on ? 'ON' : 'MUTED') + '</button></div></div>');
    onTap('oRes', () => { hideOv(); G.state = 'play'; });
    onTap('oRst', () => { hideOv(); G._keepAmmo = true; startLevel(G.lvl); });
    onTap('oSnd', () => { AU.on = !AU.on; if (AU.master) AU.master.gain.value = AU.on ? 0.85 : 0; ui$('oSnd').textContent = 'SOUND: ' + (AU.on ? 'ON' : 'MUTED'); });
  }
};
UI.card = function (name, sub) {
  const c = ui$('card'); c.innerHTML = '<div class="cn">' + name + '</div><div class="cs">' + sub + '</div>';
  c.classList.remove('show'); void c.offsetWidth; c.classList.add('show');
};

let last = 0, lastDraw = 0;
function frame(ts) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (ts - last) / 1000 || 0.016); last = ts;
  pollInput();
  if (G.state === 'title') { G.time += dt; G.ang += dt * 0.12; G.moving = 0; G.fear = 0; }
  else update(dt);
  if (ts - lastDraw < 28) return; // ~30 quadros/s: poupa bateria do celular
  lastDraw = ts;
  const t0 = performance.now();
  render(); present();
  // qualidade adaptativa: se o aparelho engasgar, usa letras maiores (menos células)
  const ft = performance.now() - t0;
  R.ema = (R.ema || ft) * 0.95 + ft * 0.05;
  if (++R.cnt > 90 && R.ema > 20 && (R.boost || 0) < 6) { R.boost = (R.boost || 0) + 1; R.cnt = 0; R.ema = 0; resize(); }
}

function boot() {
  R.cnt = 0; R.boost = 0; R.cvs = ui$('cv'); R.ctx = R.cvs.getContext('2d', { alpha: false });
  resize(); window.addEventListener('resize', resize);
  setupInput();
  loadLevel(0); findExit(); G.ang = 0.35;
  UI.title();
  document.addEventListener('visibilitychange', () => { if (document.hidden && G.state === 'play') UI.pause(); });
  requestAnimationFrame(frame);
}
if (typeof document !== 'undefined' && document.getElementById('cv')) boot();
