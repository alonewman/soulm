'use strict';
// ===== CONTROLES: toque (celular deitado) + teclado =====
const KEYS = {};
const TOUCH = { mv: 0, st: 0, run: false, btnRun: false };
const LOOK_SENS = 0.0062;

function setupInput() {
  const $ = id => document.getElementById(id);
  const zoneL = $('zoneL'), zoneR = $('zoneR'), base = $('stickBase'), knob = $('stickKnob');
  const bFire = $('bFire'), bRun = $('bRun'), bReload = $('bReload'), bPause = $('bPause');
  const SR = 54;
  let stickId = null, sx = 0, sy = 0;

  zoneL.addEventListener('pointerdown', e => {
    if (stickId !== null) return;
    e.preventDefault(); stickId = e.pointerId; sx = e.clientX; sy = e.clientY;
    try { zoneL.setPointerCapture(e.pointerId); } catch (x) {}
    base.hidden = false; base.style.left = sx + 'px'; base.style.top = sy + 'px';
    knob.style.transform = 'translate(-50%,-50%)'; base.classList.remove('run');
  });
  zoneL.addEventListener('pointermove', e => {
    if (e.pointerId !== stickId) return;
    let dx = e.clientX - sx, dy = e.clientY - sy;
    const len = Math.hypot(dx, dy);
    const m = Math.min(len, SR) / SR;
    const nx = len > 0 ? dx / len : 0, ny = len > 0 ? dy / len : 0;
    TOUCH.st = m < 0.14 ? 0 : nx * m; TOUCH.mv = m < 0.14 ? 0 : -ny * m;
    TOUCH.run = len > SR * 1.2;
    base.classList.toggle('run', TOUCH.run);
    knob.style.transform = 'translate(calc(-50% + ' + (nx * Math.min(len, SR)) + 'px), calc(-50% + ' + (ny * Math.min(len, SR)) + 'px))';
  });
  const endStick = e => {
    if (e.pointerId !== stickId) return;
    stickId = null; TOUCH.mv = 0; TOUCH.st = 0; TOUCH.run = false; base.hidden = true;
  };
  zoneL.addEventListener('pointerup', endStick); zoneL.addEventListener('pointercancel', endStick);

  // olhar: arrastar na metade direita (ou segurando o botão de tiro)
  const lookers = {};
  function lookOn(el) {
    el.addEventListener('pointerdown', e => { lookers[e.pointerId] = e.clientX; try { el.setPointerCapture(e.pointerId); } catch (x) {} });
    el.addEventListener('pointermove', e => {
      if (!(e.pointerId in lookers)) return;
      const dx = e.clientX - lookers[e.pointerId]; lookers[e.pointerId] = e.clientX;
      IN.look += dx * LOOK_SENS;
    });
    const end = e => { delete lookers[e.pointerId]; };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  }
  lookOn(zoneR); lookOn(bFire);
  bFire.addEventListener('pointerdown', e => { e.preventDefault(); audioInit(); IN.fire = true; bFire.classList.add('down'); });
  const fireUp = () => bFire.classList.remove('down');
  bFire.addEventListener('pointerup', fireUp); bFire.addEventListener('pointercancel', fireUp);
  bReload.addEventListener('pointerdown', e => { e.preventDefault(); IN.reload = true; });
  bRun.addEventListener('pointerdown', e => { e.preventDefault(); TOUCH.btnRun = true; bRun.classList.add('down'); try { bRun.setPointerCapture(e.pointerId); } catch (x) {} });
  const runUp = () => { TOUCH.btnRun = false; bRun.classList.remove('down'); };
  bRun.addEventListener('pointerup', runUp); bRun.addEventListener('pointercancel', runUp);
  bPause.addEventListener('pointerdown', e => { e.preventDefault(); if (UI.pause) UI.pause(); });

  // teclado (testes no computador)
  window.addEventListener('keydown', e => {
    if (e.repeat) return;
    KEYS[e.code] = true;
    if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ControlLeft') { IN.fire = true; e.preventDefault(); }
    if (e.code === 'KeyR') IN.reload = true;
    if (e.code === 'Escape' && UI.pause) UI.pause();
    if (e.code.startsWith('Arrow')) e.preventDefault();
  });
  window.addEventListener('keyup', e => { KEYS[e.code] = false; });
  ['contextmenu', 'gesturestart', 'dblclick'].forEach(t => document.addEventListener(t, e => e.preventDefault()));
}

function pollInput() {
  const k = c => KEYS[c] ? 1 : 0;
  const kmv = k('KeyW') + k('ArrowUp') - k('KeyS') - k('ArrowDown');
  const kst = k('KeyD') - k('KeyA');
  IN.mv = clamp(kmv + TOUCH.mv, -1, 1); IN.st = clamp(kst + TOUCH.st, -1, 1);
  IN.turn = k('ArrowRight') + k('KeyE') - k('ArrowLeft') - k('KeyQ');
  IN.run = !!(KEYS.ShiftLeft || KEYS.ShiftRight || TOUCH.btnRun || TOUCH.run);
}
