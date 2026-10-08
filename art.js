'use strict';
// ===== ARTE ASCII, PALETA E BUFFER DE CARACTERES =====
const FONT = "'Courier New', ui-monospace, Menlo, Consolas, monospace";
const PLANE = 0.86;
const R = { cvs: null, ctx: null, cols: 0, rows: 0, fs: 10, cw: 6, lh: 10, ox: 0, oy: 0, K: 50, W: 0, H: 0,
  ch: null, ci: null, zb: null, vfx: null, vfy: null, aim: false };

// [escuro, claro] por camada. Índice de cor = camada*10 + nível(0..9)
const LAYERS = [
  [[10, 13, 20], [226, 186, 120]], // 0 mundo
  [[18, 10, 6], [214, 138, 64]],   // 1 madeira
  [[6, 22, 26], [96, 244, 232]],   // 2 runa
  [[70, 24, 0], [255, 224, 96]],   // 3 chama
  [[26, 6, 6], [255, 74, 52]],     // 4 inimigo / perigo
  [[14, 9, 28], [178, 128, 255]],  // 5 sombra
  [[28, 20, 4], [255, 224, 84]],   // 6 item
  [[6, 12, 28], [96, 156, 236]],   // 7 água
  [[70, 56, 24], [255, 255, 232]], // 8 clarão
  [[8, 22, 12], [110, 255, 150]],  // 9 saída aberta
];
const PAL = [];
for (let l = 0; l < LAYERS.length; l++) for (let i = 0; i < 10; i++) {
  const t = Math.pow(i / 9, 0.92), a = LAYERS[l][0], b = LAYERS[l][1];
  PAL.push('rgb(' + Math.round(a[0] + (b[0] - a[0]) * t) + ',' + Math.round(a[1] + (b[1] - a[1]) * t) + ',' + Math.round(a[2] + (b[2] - a[2]) * t) + ')');
}
const CHR = []; for (let i = 0; i < 128; i++) CHR.push(String.fromCharCode(i));
const RAMP = ' .:-=+*#%@';
const code = s => s.charCodeAt(0);

function pad(rows) { const w = Math.max(...rows.map(r => r.length)); return rows.map(r => r + ' '.repeat(w - r.length)); }
function mirror(left) {
  const mp = { '/': '\\', '\\': '/', '(': ')', ')': '(', '[': ']', ']': '[', '<': '>', '>': '<' };
  return left.map(r => r + r.slice(0, -1).split('').reverse().map(c => mp[c] || c).join(''));
}
const ART = {
  goblin: pad([
    '  ,   ,  ', ' /|\\_/|\\ ', ' \\(e_e)/ ', '  ) v (  ', ' /|###|\\ ',
    '/ |###| \\', '  |# #|  ', '  /   \\  ', ' _|   |_ ']),
  orc: pad([
    '    _____    ', '   /#####\\   ', '  |#e###e#|  ', '  |#######|  ', '   \\#|V|#/   ',
    '__/#######\\__', '/###########\\', '|##|#####|##|', '|##|#####|##|', ' ## ##### ## ',
    '    ## ##    ', '   _##_##_   ']),
  shade: pad([
    '   .   ', '  :::  ', ' :e:e: ', ' ::::: ', ':::::::', ':.:::.:', ' ::::: ',
    '.:::::.', ' .:::. ', '  :.:  ', ' .   . ', '  . .  ']),
  boss: pad(mirror([
    '  /|       ', ' / /   ____', '  \\ \\ /####', '   \\ |#e###', '    |######',
    '    \\#|VVVV', ' ___/######', '/##########', '|###|######', '|###|######',
    ' ###|######', '  ##|######', '  ###\\#####', '  ###  ####', ' _###_  ###', '_####_   ##'])),
  corpse: pad(['  ,~#~#~,  ', ' ~#%#,#%#~ ']),
  key: pad([' .-. ', '( o )', " `|' ", '  |= ']),
  ammo: pad([' _____ ', '|=====|', '|_____|']),
  heal: pad(['  _  ', ' |+| ', ' |_| ']),
  note: pad([' _____ ', '(~~~~~)', "'-----'"]),
  candle: pad([' ^ ', ' | ', '[#]', '[#]', '[#]']),
  orb: pad(['  ,*,  ', ' (***) ', '(*****)', ' (***) ', "  `*'  "]),
  gun: pad([
    '        .--.        ', '        |  |        ', '        |##|        ', '        |##|        ',
    '     ___|##|___     ', '    /  [====]  \\    ', '   |   |####|   |   ', '   |___|####|___|   ',
    '       |####|       ', '      /######\\      ', '     /########\\     ']),
  flash: pad(['       \\ || /       ', '      -- ** --      ', '       / || \\       ']),
};
// tamanho (altura em tiles), elevação do chão e camada de cada sprite de item
const ITEM_DEF = {
  k: { art: 'key', sz: 0.32, lift: 0.2, layer: 6 },
  a: { art: 'ammo', sz: 0.22, lift: 0.0, layer: 6 },
  h: { art: 'heal', sz: 0.3, lift: 0.0, layer: 9 },
  n: { art: 'note', sz: 0.24, lift: 0.0, layer: 6 },
  c: { art: 'candle', sz: 0.5, lift: 0.0, layer: 3 },
};

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = window.innerWidth, H = window.innerHeight;
  R.W = W; R.H = H;
  R.cvs.width = Math.floor(W * dpr); R.cvs.height = Math.floor(H * dpr);
  R.cvs.style.width = W + 'px'; R.cvs.style.height = H + 'px';
  const ctx = R.ctx; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const fs = clamp(Math.round(H / 46 * 2) / 2 + (R.boost || 0), 7, 18);
  R.fs = fs; ctx.font = fs + 'px ' + FONT; ctx.textBaseline = 'top';
  R.cw = ctx.measureText('M').width || fs * 0.6; R.lh = fs;
  R.cols = Math.max(40, Math.floor(W / R.cw)); R.rows = Math.max(20, Math.floor(H / R.lh));
  R.ox = (W - R.cols * R.cw) / 2; R.oy = (H - R.rows * R.lh) / 2;
  R.K = (W / 2 / PLANE) / R.lh;
  const n = R.cols * R.rows;
  R.ch = new Uint8Array(n); R.ci = new Uint8Array(n); R.zb = new Float32Array(R.cols);
  R.vfx = new Float32Array(R.cols); R.vfy = new Float32Array(R.rows);
  for (let x = 0; x < R.cols; x++) { const c = 2 * x / R.cols - 1; R.vfx[x] = 1 - 0.36 * c * c; }
  for (let y = 0; y < R.rows; y++) { const c = 2 * y / R.rows - 1; R.vfy[y] = 1 - 0.28 * c * c; }
}

function clearBuf() { R.ch.fill(32); R.ci.fill(0); }
function put(x, y, c, layer, lvl) {
  if (x < 0 || y < 0 || x >= R.cols || y >= R.rows) return;
  const i = y * R.cols + x; R.ch[i] = c; R.ci[i] = layer * 10 + lvl;
}
function putText(x, y, s, layer, lvl) { for (let i = 0; i < s.length; i++) put(x + i, y, s.charCodeAt(i), layer, lvl); }
function putCenter(y, s, layer, lvl) { putText(Math.floor((R.cols - s.length) / 2), y, s, layer, lvl); }

const _seen = new Uint8Array(128), _lo = new Int16Array(128), _hi = new Int16Array(128), _list = new Uint8Array(128);
function present() {
  const ctx = R.ctx, cols = R.cols, rows = R.rows, ch = R.ch, ci = R.ci;
  ctx.fillStyle = '#020204'; ctx.fillRect(0, 0, R.W, R.H);
  for (let r = 0; r < rows; r++) {
    const base = r * cols; let n = 0;
    for (let c = 0; c < cols; c++) {
      if (ch[base + c] === 32) continue;
      const k = ci[base + c];
      if (!_seen[k]) { _seen[k] = 1; _lo[k] = c; _hi[k] = c; _list[n++] = k; } else _hi[k] = c;
    }
    const y = R.oy + r * R.lh;
    for (let j = 0; j < n; j++) {
      const k = _list[j]; _seen[k] = 0;
      let s = '';
      for (let c = _lo[k]; c <= _hi[k]; c++) s += (ci[base + c] === k && ch[base + c] !== 32) ? CHR[ch[base + c]] : ' ';
      ctx.fillStyle = PAL[k];
      ctx.fillText(s, R.ox + _lo[k] * R.cw, y);
    }
  }
}
