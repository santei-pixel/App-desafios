// Tests de la lógica. Se corren con:  npm test   (o: node --test tests/)
import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../js/logic.js';

const T = '2026-03-31'; // "hoy" fijo para los tests

function stateWith(id, dates, { goal, activatedOn } = {}) {
  const s = L.createState();
  const from = activatedOn || dates[0] || T;
  L.activate(s, id, from, goal !== undefined ? { goal } : {});
  s.days[id] = {};
  for (const d of dates) s.days[id][d] = { done: true, note: '', uses: 0 };
  return s;
}

const range = (start, n) => Array.from({ length: n }, (_, i) => L.addDays(start, i));

test('fechas: sumar días cruza meses y años bisiestos', () => {
  assert.equal(L.addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(L.addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(L.addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(L.diffDays('2026-01-01', '2026-03-01'), 59);
});

test('racha: días seguidos, hoy sin marcar no corta la racha', () => {
  const s = stateWith('seiza', range('2026-03-25', 6)); // 25..30
  const r = L.computeChallenge(s, 'seiza', T);
  assert.equal(r.currentStreak, 6);
  assert.equal(r.bestStreak, 6);
});

test('racha: si falta ayer y hoy, la racha actual es 0', () => {
  const s = stateWith('seiza', range('2026-03-20', 5)); // 20..24
  const r = L.computeChallenge(s, 'seiza', T);
  assert.equal(r.currentStreak, 0);
  assert.equal(r.bestStreak, 5);
  assert.equal(r.doneCount, 5);
});

test('racha: fallar corta la racha pero no borra los días cumplidos (no Shugyo)', () => {
  const dates = [...range('2026-03-01', 10), ...range('2026-03-12', 3)];
  const s = stateWith('harahachibu', dates, { goal: 30 });
  const r = L.computeChallenge(s, 'harahachibu', '2026-03-14');
  assert.equal(r.currentStreak, 3);
  assert.equal(r.bestStreak, 10);
  assert.equal(r.progress, 13);
});

test('Shugyo: regla estricta, si falto un día el contador vuelve a 0', () => {
  const dates = [...range('2026-03-01', 10), ...range('2026-03-12', 3)];
  const s = stateWith('shugyo', dates, { goal: 100 });
  const r = L.computeChallenge(s, 'shugyo', '2026-03-14');
  assert.equal(r.progress, 3);
  assert.equal(r.doneCount, 13);
  assert.equal(r.bestStreak, 10);
});

test('Shugyo: las medallas ya ganadas se conservan tras reiniciar y no se ganan dos veces', () => {
  // meta 8: 25% = 2 días. Hace 4 días, falla, hace 4 días de nuevo.
  const dates = [...range('2026-03-01', 4), ...range('2026-03-06', 4)];
  const s = stateWith('shugyo', dates, { goal: 8 });
  const r = L.computeChallenge(s, 'shugyo', '2026-03-09');
  const pcts = r.medals.map((m) => m.pct);
  assert.deepEqual(pcts, [25, 50]);
  assert.equal(r.medals[0].date, '2026-03-02');
  assert.equal(r.progress, 4);
});

test('puntos por dificultad: baja 10, media 20, alta 30', () => {
  assert.equal(L.dayPoints('baja', 1), 10);
  assert.equal(L.dayPoints('media', 1), 20);
  assert.equal(L.dayPoints('alta', 1), 30);
});

test('bonus de racha: +5% cada 7 días seguidos, tope +50%', () => {
  assert.equal(L.streakMultiplier(6), 1);
  assert.equal(L.streakMultiplier(7), 1.05);
  assert.equal(L.streakMultiplier(14), 1.1);
  assert.equal(L.streakMultiplier(69), 1.45);
  assert.equal(L.streakMultiplier(70), 1.5);
  assert.equal(L.streakMultiplier(400), 1.5);
  assert.equal(L.dayPoints('alta', 7), 32); // 31.5 redondeado
  assert.equal(L.dayPoints('alta', 70), 45);
});

test('puntos totales: 7 días seguidos de dificultad baja', () => {
  const s = stateWith('repaso', range('2026-03-01', 7), { goal: 1000 });
  const r = L.computeChallenge(s, 'repaso', '2026-03-07');
  // 6 días × 10 + el séptimo con +5% (10.5 → 11)
  assert.equal(r.totalPoints, 60 + 11);
});

test('hitos: 25/50/75/100% dan bonus × multiplicador de dificultad', () => {
  const s = stateWith('gaman', range('2026-01-01', 30), { goal: 30 }); // alta ×3
  const r = L.computeChallenge(s, 'gaman', '2026-01-30');
  assert.deepEqual(r.medals.map((m) => [m.pct, m.bonus]), [[25, 150], [50, 300], [75, 600], [100, 1500]]);
  assert.equal(r.medals[0].date, '2026-01-08'); // ceil(7.5) = 8 días
  assert.equal(r.medals[3].date, '2026-01-30');
  assert.equal(r.completed, true);
  assert.equal(r.pct, 100);
});

test('hitos: dificultad baja ×1 y media ×2', () => {
  const s = stateWith('repaso', range('2026-01-01', 4), { goal: 4 });
  assert.deepEqual(L.computeChallenge(s, 'repaso', '2026-01-04').medals.map((m) => m.bonus), [50, 100, 200, 500]);
  const s2 = stateWith('seiza', range('2026-01-01', 4), { goal: 4 });
  assert.deepEqual(L.computeChallenge(s2, 'seiza', '2026-01-04').medals.map((m) => m.bonus), [100, 200, 400, 1000]);
});

test('desmarcar un día recalcula puntos y medallas', () => {
  const s = stateWith('repaso', range('2026-03-30', 2), { goal: 2 });
  let r = L.computeChallenge(s, 'repaso', T);
  assert.equal(r.medals.length, 4);
  L.toggleDay(s, 'repaso', T, T);
  r = L.computeChallenge(s, 'repaso', T);
  assert.deepEqual(r.medals.map((m) => m.pct), [25, 50]);
});

test('solo se puede marcar hoy y ayer', () => {
  const s = L.createState();
  L.activate(s, 'seiza', '2026-03-01');
  assert.equal(L.toggleDay(s, 'seiza', T, T), true);
  assert.equal(L.toggleDay(s, 'seiza', '2026-03-30', T), true);
  assert.equal(L.toggleDay(s, 'seiza', '2026-03-29', T), false);
  assert.equal(L.toggleDay(s, 'seiza', '2026-04-01', T), false);
  assert.equal(L.isDone(s, 'seiza', '2026-03-29'), false);
});

test('no se puede marcar un desafío inactivo, pero su historial se conserva', () => {
  const s = stateWith('seiza', ['2026-03-30']);
  L.deactivate(s, 'seiza', T);
  assert.equal(L.toggleDay(s, 'seiza', T, T), false);
  assert.equal(L.computeChallenge(s, 'seiza', T).doneCount, 1);
  L.activate(s, 'seiza', T);
  assert.equal(s.ch.seiza.periods.length, 1); // reactivado el mismo día: mismo período
});

test('orden de activos: activar agrega al final, mover cambia posiciones', () => {
  const s = L.createState();
  L.activate(s, 'gaman', T);
  L.activate(s, 'seiza', T);
  L.activate(s, 'repaso', T);
  assert.deepEqual(s.order, ['gaman', 'seiza', 'repaso']);
  L.move(s, 'repaso', -1);
  assert.deepEqual(s.order, ['gaman', 'repaso', 'seiza']);
  L.move(s, 'gaman', -1); // ya está primero
  assert.deepEqual(s.order, ['gaman', 'repaso', 'seiza']);
  L.deactivate(s, 'repaso', T);
  assert.deepEqual(s.order, ['gaman', 'seiza']);
});

test('Ola: varios usos en el día cuentan como un solo día', () => {
  const s = L.createState();
  L.activate(s, 'ola90', T);
  L.addUse(s, 'ola90', T);
  L.addUse(s, 'ola90', T);
  L.addUse(s, 'ola90', T);
  assert.equal(s.days.ola90[T].uses, 3);
  const r = L.computeChallenge(s, 'ola90', T);
  assert.equal(r.doneCount, 1);
  assert.equal(r.totalPoints, 10); // un día, ningún hito todavía (25% de 30 = 8 días)
});

test('Ganbaru: sin proyecto no se puede marcar; Terminado da bonus 1500', () => {
  const s = L.createState();
  L.activate(s, 'ganbaru', '2026-03-28');
  assert.equal(L.toggleDay(s, 'ganbaru', T, T), false);
  L.startProject(s, 'ganbaru', '2026-03-28', 'Curso de inglés');
  assert.equal(L.toggleDay(s, 'ganbaru', '2026-03-30', T), true);
  assert.equal(L.toggleDay(s, 'ganbaru', T, T), true);
  L.finishProject(s, 'ganbaru', T);
  const r = L.computeChallenge(s, 'ganbaru', T);
  assert.equal(r.completed, true);
  assert.equal(r.totalPoints, 30 + 30 + 1500);
  assert.equal(r.medals[0].project, 'Curso de inglés');
  // ya terminado: no se puede seguir marcando hasta empezar otro
  assert.equal(L.canMarkChallenge(s, 'ganbaru', T, T), false);
  L.startProject(s, 'ganbaru', T, 'Ordenar el placard');
  assert.equal(L.canMarkChallenge(s, 'ganbaru', T, T), true);
  assert.equal(L.computeChallenge(s, 'ganbaru', T).progress, 0);
});

test('niveles: umbrales y progreso al siguiente', () => {
  assert.equal(L.levelFor(0).level.name, 'Deshi');
  assert.equal(L.levelFor(299).level.name, 'Deshi');
  assert.equal(L.levelFor(300).level.name, 'Ashigaru');
  assert.equal(L.levelFor(25000).level.name, 'Shōgun');
  assert.equal(L.levelFor(99999).level.name, 'Kensei');
  assert.equal(L.levelFor(99999).next, null);
  assert.equal(L.levelFor(150).progress, 0.5);
});

test('récords generales: mejor racha cumpliendo al menos un desafío', () => {
  const s = L.createState();
  L.activate(s, 'seiza', '2026-03-01');
  L.activate(s, 'repaso', '2026-03-01');
  s.days.seiza = Object.fromEntries(range('2026-03-01', 3).map((d) => [d, { done: true }]));
  s.days.repaso = Object.fromEntries(range('2026-03-04', 3).map((d) => [d, { done: true }]));
  const all = L.computeAll(s, '2026-03-10');
  assert.equal(all.general.bestStreak, 6);
  assert.equal(all.general.currentStreak, 0);
  assert.equal(all.counts['2026-03-02'], 1);
});

test('puntos del día incluyen bonus de hitos ganados hoy', () => {
  const s = stateWith('repaso', range('2026-03-30', 2), { goal: 8 }); // 25% = 2 días → hoy
  const all = L.computeAll(s, T);
  assert.equal(all.todayPoints, 10 + 50);
});

test('calendario: cumplido, fallado, futuro y sin activar', () => {
  const s = stateWith('seiza', ['2026-03-28'], { activatedOn: '2026-03-27' });
  assert.equal(L.dayStatus(s, 'seiza', '2026-03-26', T), 'off');
  assert.equal(L.dayStatus(s, 'seiza', '2026-03-27', T), 'missed');
  assert.equal(L.dayStatus(s, 'seiza', '2026-03-28', T), 'done');
  assert.equal(L.dayStatus(s, 'seiza', T, T), 'today');
  assert.equal(L.dayStatus(s, 'seiza', '2026-04-01', T), 'future');
});

test('backup: normalizar un estado exportado lo deja igual y rechaza basura', () => {
  const s = stateWith('gaman', range('2026-03-01', 5), { goal: 20 });
  L.setNote(s, 'gaman', T, T, 'Aguanté la reunión');
  const back = L.normalizeState(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(L.computeAll(back, T), L.computeAll(s, T));
  assert.equal(back.days.gaman[T].note, 'Aguanté la reunión');
  assert.throws(() => L.normalizeState({ hola: 1 }));
  assert.throws(() => L.normalizeState(null));
});
