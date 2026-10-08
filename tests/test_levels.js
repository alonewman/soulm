const fs = require('fs');
const src = fs.readFileSync(__dirname + '/../levels.js', 'utf8') + '\nmodule.exports = LEVELS;';
const m = { exports: {} };
new Function('module', src)(m);
const LEVELS = m.exports;

let bad = 0;
LEVELS.forEach((L, li) => {
  const h = L.map.length, w = Math.max(...L.map.map(r => r.length));
  const widths = [...new Set(L.map.map(r => r.length))];
  let issues = [];
  if (widths.length > 1) issues.push('larguras diferentes: ' + L.map.map((r, i) => i + ':' + r.length).join(' '));
  const at = (x, y) => (y < 0 || y >= h || x < 0 || x >= w) ? '#' : (L.map[y][x] || '#');
  let start = null, items = [], exit = null, keys = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = at(x, y);
    if (c === 'S') start = [x, y];
    if (c === 'X') exit = [x, y];
    if ('kahnc'.includes(c)) items.push([c, x, y]);
    if ('gosB'.includes(c)) items.push([c, x, y]);
    if (c === 'k') keys++;
  }
  if (!start) issues.push('sem início');
  if (!exit) issues.push('sem saída');
  if (L.key && keys !== 1) issues.push('chaves: ' + keys);
  const pass = c => c !== '#' && c !== '%' && c !== '=' && c !== 'X';
  const seen = new Set();
  const q = [start];
  seen.add(start && start.join(','));
  const portals = (L.portals || []);
  while (q.length) {
    const [x, y] = q.shift();
    const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [dx, dy] of nb) {
      const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
      if (seen.has(k)) continue;
      if (!pass(at(nx, ny))) continue;
      seen.add(k); q.push([nx, ny]);
    }
    for (const p of portals) if (p[0] === x && p[1] === y) {
      const k = p[2] + ',' + p[3];
      if (!seen.has(k)) { seen.add(k); q.push([p[2], p[3]]); }
    }
  }
  items.forEach(([c, x, y]) => { if (!seen.has(x + ',' + y)) issues.push('inalcançável ' + c + ' em ' + x + ',' + y); });
  if (exit) {
    const adj = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen.has((exit[0] + dx) + ',' + (exit[1] + dy)));
    if (!adj) issues.push('saída inalcançável');
  }
  // portais precisam estar em chão
  portals.forEach(p => { if (!pass(at(p[0], p[1])) || !pass(at(p[2], p[3]))) issues.push('portal em parede ' + p); });
  console.log((issues.length ? 'FALHA ' : 'ok    ') + L.name + ' (' + w + 'x' + h + ') ' + issues.join(' | '));
  bad += issues.length;
});
process.exit(bad ? 1 : 0);
