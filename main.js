'use strict';
// ===== INICIALIZAÇÃO, INTERFACE E LAÇO PRINCIPAL =====
function ui$(id) { return document.getElementById(id); }
let savedLvl = 0;
try { savedLvl = parseInt(localStorage.getItem('minas_lvl') || '0', 10) || 0; } catch (e) {}

function showOv(html) { const ov = ui$('ov'); ov.innerHTML = html; ov.hidden = false; ui$('app').classList.add('ovon'); }
function hideOv() { ui$('ov').hidden = true; ui$('app').classList.remove('ovon'); }
function onTap(id, fn) { const el = ui$(id); if (el) el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); fn(); }); }

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
    ? '<button class="btn" id="oCont">CONTINUAR &mdash; ' + LEVELS[savedLvl].name + '</button>' : '';
  showOv(
    '<div class="panel title">' +
    '<div class="kicker">-=[ jogo de terror em ASCII ]=-</div>' +
    '<h1>AS MINAS<br>ESQUECIDAS</h1>' +
    '<p class="lead">Uma fortaleza anã que não termina. Poucas balas, uma lanterna e algo que ouve você respirar.</p>' +
    '<div class="btns"><button class="btn main" id="oNew">NOVO JOGO</button>' + cont + '</div>' +
    '</div>' +
    '<div class="panel howto"><h2>Como jogar</h2><ul>' +
    '<li><b>Esquerda:</b> arraste para andar. Arraste bem longe para <b>correr</b>.</li>' +
    '<li><b>Direita:</b> arraste para olhar. <b>ATIRAR</b> também gira se você deslizar.</li>' +
    '<li>Correr e atirar fazem <b>barulho</b>. Monstros ouvem.</li>' +
    '<li>Ache a <b>chave</b>, depois a <b>saída</b>. Velas salvam o progresso.</li>' +
    '<li>Runas brilham no escuro. Itens cintilam.</li>' +
    '<li class="dim">Deite o celular na horizontal. Use fones.</li></ul></div>'
  );
  onTap('oNew', () => beginGame(0, true));
  onTap('oCont', () => beginGame(savedLvl, false));
};
UI.note = function (text) {
  showOv('<div class="panel note"><div class="kicker">bilhete encontrado</div><p class="parch">' + text.replace(/\n/g, '<br>') + '</p><button class="btn" id="oClose">GUARDAR</button></div>');
  onTap('oClose', () => { hideOv(); G.state = 'play'; });
};
UI.dead = function () {
  setTimeout(() => {
    if (G.state !== 'dead') return;
    showOv('<div class="panel dead"><h1 class="red">VOCÊ MORREU</h1><p class="lead">A pedra guarda quem não volta.</p><button class="btn main" id="oRetry">TENTAR DE NOVO</button></div>');
    onTap('oRetry', () => { restoreCheckpoint(); hideOv(); G.state = 'play'; G.hurt = 0; say('De volta à última vela.', 3); });
  }, 1100);
};
UI.levelEnd = function () {
  const nxt = LEVELS[G.lvl + 1];
  setTimeout(() => {
    showOv('<div class="panel"><div class="kicker">fase concluída</div><h1>' + G.L.name + '</h1><p class="lead">A porta cede. Mais fundo.</p><button class="btn main" id="oNext">DESCER &mdash; ' + nxt.name + '</button></div>');
    onTap('oNext', () => { hideOv(); G._keepAmmo = true; G.hp = Math.min(100, G.hp + 20); startLevel(G.lvl + 1); });
  }, 1400);
};
UI.win = function () {
  setTimeout(() => {
    showOv('<div class="panel"><div class="kicker">fim</div><h1>LUZ</h1><p class="lead">A porta se abre para uma noite sem estrelas. O ar frio é quase doce.<br><br>Atrás de você, muito fundo, o zumbido recomeça.</p><button class="btn main" id="oAgain">VOLTAR AO INÍCIO</button></div>');
    onTap('oAgain', () => { try { localStorage.removeItem('minas_lvl'); } catch (e) {} savedLvl = 0; G._keepAmmo = false; loadLevel(0); findExit(); UI.title(); });
  }, 1600);
};
UI.pause = function () {
  if (G.state === 'play') {
    G.state = 'pause';
    showOv('<div class="panel"><h1>PAUSA</h1><div class="btns"><button class="btn main" id="oRes">CONTINUAR</button><button class="btn" id="oRst">REINICIAR FASE</button><button class="btn" id="oSnd">SOM: ' + (AU.on ? 'LIGADO' : 'MUDO') + '</button></div></div>');
    onTap('oRes', () => { hideOv(); G.state = 'play'; });
    onTap('oRst', () => { hideOv(); G._keepAmmo = true; startLevel(G.lvl); });
    onTap('oSnd', () => { AU.on = !AU.on; if (AU.master) AU.master.gain.value = AU.on ? 0.85 : 0; ui$('oSnd').textContent = 'SOM: ' + (AU.on ? 'LIGADO' : 'MUDO'); });
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
