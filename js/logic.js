// Lógica pura del juego: fechas, rachas, puntos (ki), hitos, niveles y récords.
// No toca la pantalla ni el almacenamiento, así se puede testear con `npm test`.

import { CHALLENGES, CHALLENGE_BY_ID, DIFFICULTY, LEVELS, MILESTONES, FINISH_BONUS } from './challenges.js';

export const STATE_VERSION = 1;

// ---------- Fechas (siempre texto 'AAAA-MM-DD', en hora local) ----------

const pad = (n) => String(n).padStart(2, '0');

export function toKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayKey(now = new Date()) {
  return toKey(now);
}

function keyToUTC(key) {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function utcToKey(ms) {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function addDays(key, n) {
  return utcToKey(keyToUTC(key) + n * 86400000);
}

export function diffDays(a, b) {
  // cantidad de días de a hasta b (b - a)
  return Math.round((keyToUTC(b) - keyToUTC(a)) / 86400000);
}

export function isValidKey(key) {
  return typeof key === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(key) && utcToKey(keyToUTC(key)) === key;
}

// ---------- Estado ----------

export function createState(now = new Date()) {
  const ch = {};
  for (const c of CHALLENGES) {
    ch[c.id] = { active: false, goal: c.defaultGoal, text: '', periods: [], projects: [] };
  }
  return {
    version: STATE_VERSION,
    createdAt: now.toISOString(),
    lastBackupAt: null,
    order: [],
    ch,
    days: {},
    seen: { level: 0, medals: [] },
  };
}

// Completa campos que falten (por ejemplo, al importar un backup viejo).
export function normalizeState(raw) {
  if (!raw || typeof raw !== 'object' || !raw.ch || typeof raw.ch !== 'object') {
    throw new Error('El archivo no parece un backup de Desafíos.');
  }
  const base = createState();
  const state = { ...base, ...raw };
  state.ch = { ...base.ch };
  for (const c of CHALLENGES) {
    const r = raw.ch[c.id] || {};
    state.ch[c.id] = {
      active: !!r.active,
      goal: !('goal' in r) ? c.defaultGoal : r.goal === null ? null : Math.max(1, Math.round(Number(r.goal))) || c.defaultGoal,
      text: typeof r.text === 'string' ? r.text : '',
      periods: Array.isArray(r.periods) ? r.periods.filter((p) => p && isValidKey(p.from)) : [],
      projects: Array.isArray(r.projects) ? r.projects.filter((p) => p && typeof p === 'object') : [],
    };
  }
  state.days = {};
  for (const id of Object.keys(raw.days || {})) {
    if (!CHALLENGE_BY_ID[id]) continue;
    state.days[id] = {};
    for (const [k, v] of Object.entries(raw.days[id] || {})) {
      if (isValidKey(k) && v && typeof v === 'object') {
        state.days[id][k] = { done: !!v.done, note: typeof v.note === 'string' ? v.note : '', uses: Number(v.uses) || 0 };
      }
    }
  }
  state.order = (Array.isArray(raw.order) ? raw.order : []).filter((id) => state.ch[id] && state.ch[id].active);
  for (const c of CHALLENGES) {
    if (state.ch[c.id].active && !state.order.includes(c.id)) state.order.push(c.id);
  }
  state.seen = {
    level: Number(raw.seen?.level) || 0,
    medals: Array.isArray(raw.seen?.medals) ? raw.seen.medals : [],
  };
  state.version = STATE_VERSION;
  return state;
}

function dayEntry(state, id, date, create = false) {
  if (!state.days[id]) {
    if (!create) return null;
    state.days[id] = {};
  }
  if (!state.days[id][date] && create) state.days[id][date] = { done: false, note: '', uses: 0 };
  return state.days[id][date] || null;
}

export function isDone(state, id, date) {
  return !!state.days[id]?.[date]?.done;
}

export function isActiveOn(state, id, date) {
  return state.ch[id].periods.some((p) => p.from <= date && (!p.to || date <= p.to));
}

export function currentProject(state, id) {
  const ps = state.ch[id].projects;
  const last = ps[ps.length - 1];
  return last && !last.finishedAt ? last : null;
}

// ---------- Acciones (modifican el estado) ----------

export function activate(state, id, today, { goal, text } = {}) {
  const c = state.ch[id];
  const def = CHALLENGE_BY_ID[id];
  if (goal !== undefined) c.goal = goal === null || goal === '' ? null : Math.max(1, Math.round(Number(goal)));
  if (text !== undefined) c.text = String(text).trim();
  if (!c.active) {
    c.active = true;
    const last = c.periods[c.periods.length - 1];
    if (last && last.to && diffDays(last.to, today) <= 1) last.to = null; // reactivado enseguida: mismo período
    else c.periods.push({ from: today, to: null });
    state.order = state.order.filter((x) => x !== id);
    state.order.push(id);
  }
  if (def.project && !currentProject(state, id) && c.text) {
    c.projects.push({ text: c.text, start: today, finishedAt: null });
  }
}

export function deactivate(state, id, today) {
  const c = state.ch[id];
  if (!c.active) return;
  c.active = false;
  const last = c.periods[c.periods.length - 1];
  if (last && !last.to) last.to = today;
  state.order = state.order.filter((x) => x !== id);
}

export function move(state, id, delta) {
  const i = state.order.indexOf(id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= state.order.length) return;
  [state.order[i], state.order[j]] = [state.order[j], state.order[i]];
}

export function canMark(date, today) {
  return date === today || date === addDays(today, -1);
}

export function canMarkChallenge(state, id, date, today) {
  if (!canMark(date, today)) return false;
  if (!state.ch[id].active) return false;
  if (CHALLENGE_BY_ID[id].project && !currentProject(state, id)) return false;
  return true;
}

export function setDone(state, id, date, today, done) {
  if (!canMarkChallenge(state, id, date, today)) return false;
  const e = dayEntry(state, id, date, true);
  e.done = !!done;
  if (!done) e.uses = 0;
  return true;
}

export function toggleDay(state, id, date, today) {
  return setDone(state, id, date, today, !isDone(state, id, date));
}

export function setNote(state, id, date, today, note) {
  if (!canMark(date, today)) return false;
  const e = dayEntry(state, id, date, true);
  e.note = String(note).slice(0, 140);
  return true;
}

// Uso del temporizador de la Ola (puede ser varias veces por día).
export function addUse(state, id, today) {
  if (!state.ch[id].active) return false;
  const e = dayEntry(state, id, today, true);
  e.uses = (e.uses || 0) + 1;
  e.done = true;
  return true;
}

export function finishProject(state, id, today) {
  const p = currentProject(state, id);
  if (!p) return false;
  p.finishedAt = today;
  return true;
}

export function undoFinish(state, id) {
  const ps = state.ch[id].projects;
  const last = ps[ps.length - 1];
  if (!last || !last.finishedAt) return false;
  last.finishedAt = null;
  return true;
}

export function startProject(state, id, today, text) {
  if (currentProject(state, id) || !String(text).trim()) return false;
  state.ch[id].text = String(text).trim();
  state.ch[id].projects.push({ text: state.ch[id].text, start: today, finishedAt: null });
  return true;
}

// ---------- Cálculos ----------

export function streakMultiplier(streak) {
  return 1 + Math.min(0.5, 0.05 * Math.floor(streak / 7));
}

export function dayPoints(difficulty, streak) {
  return Math.round(DIFFICULTY[difficulty].points * streakMultiplier(streak));
}

export function milestoneNeed(goal, pct) {
  return Math.max(1, Math.ceil((goal * pct) / 100));
}

function doneDates(state, id) {
  return Object.keys(state.days[id] || {})
    .filter((k) => state.days[id][k].done)
    .sort();
}

// Recorre día por día y devuelve la racha en cada día cumplido.
export function streaks(dates, today) {
  const set = new Set(dates);
  const at = {};
  let s = 0;
  let best = 0;
  if (dates.length) {
    const end = dates[dates.length - 1] > today ? dates[dates.length - 1] : today;
    for (let d = dates[0]; d <= end; d = addDays(d, 1)) {
      if (set.has(d)) {
        s += 1;
        at[d] = s;
        if (s > best) best = s;
      } else if (d < today) {
        s = 0;
      }
    }
  }
  return { at, current: s, best };
}

export function computeChallenge(state, id, today) {
  const def = CHALLENGE_BY_ID[id];
  const c = state.ch[id];
  const diff = DIFFICULTY[def.difficulty];
  const dates = doneDates(state, id);
  const st = streaks(dates, today);
  const points = {};
  const medals = [];
  let pointsSum = 0;

  for (const d of dates) {
    points[d] = dayPoints(def.difficulty, st.at[d]);
    pointsSum += points[d];
  }

  const goal = c.goal;
  let progress;

  if (def.project) {
    // Ganbaru: progreso y bonus por proyecto
    let prevEnd = '';
    c.projects.forEach((p, idx) => {
      const inProj = dates.filter((d) => d > prevEnd && (!p.finishedAt || d <= p.finishedAt));
      if (goal) {
        for (const m of MILESTONES) {
          const need = milestoneNeed(goal, m.pct);
          if (inProj.length >= need) {
            medals.push({ key: `${id}:${idx}:${m.pct}`, id, pct: m.pct, date: inProj[need - 1], bonus: m.bonus * diff.mult, label: m.label, medal: m.medal, project: p.text });
          }
        }
      }
      if (p.finishedAt) {
        medals.push({ key: `${id}:${idx}:fin`, id, pct: 'fin', date: p.finishedAt, bonus: FINISH_BONUS * diff.mult, label: 'Terminado', medal: '完', project: p.text });
      }
      if (idx === c.projects.length - 1) progress = inProj.length;
      if (p.finishedAt) prevEnd = p.finishedAt;
    });
  } else {
    let count = 0;
    for (const d of dates) {
      count += 1;
      const prog = def.strict ? st.at[d] : count;
      if (!goal) continue;
      for (const m of MILESTONES) {
        const key = `${id}:${m.pct}`;
        if (prog >= milestoneNeed(goal, m.pct) && !medals.some((x) => x.key === key)) {
          medals.push({ key, id, pct: m.pct, date: d, bonus: m.bonus * diff.mult, label: m.label, medal: m.medal });
        }
      }
    }
    progress = def.strict ? st.current : dates.length;
  }

  for (const m of medals) pointsSum += m.bonus;

  const completed = medals.some((m) => m.pct === 100 || m.pct === 'fin');
  const pct = goal ? Math.min(100, Math.round((progress / goal) * 100)) : null;

  return {
    id,
    currentStreak: st.current,
    bestStreak: st.best,
    doneCount: dates.length,
    progress: progress || 0,
    goal,
    pct,
    points,
    medals,
    totalPoints: pointsSum,
    completed,
  };
}

export function levelFor(total) {
  let idx = 0;
  for (let i = 0; i < LEVELS.length; i++) if (total >= LEVELS[i].min) idx = i;
  const cur = LEVELS[idx];
  const next = LEVELS[idx + 1] || null;
  const progress = next ? (total - cur.min) / (next.min - cur.min) : 1;
  return { index: idx, level: cur, next, progress, toNext: next ? next.min - total : 0 };
}

export function computeAll(state, today) {
  const per = {};
  let total = 0;
  let todayPoints = 0;
  const medals = [];
  const counts = {}; // fecha -> cantidad de desafíos cumplidos

  for (const c of CHALLENGES) {
    const r = computeChallenge(state, c.id, today);
    per[c.id] = r;
    total += r.totalPoints;
    todayPoints += r.points[today] || 0;
    for (const m of r.medals) {
      medals.push(m);
      if (m.date === today) todayPoints += m.bonus;
    }
    for (const d of Object.keys(r.points)) counts[d] = (counts[d] || 0) + 1;
  }

  const anyDates = Object.keys(counts).sort();
  const general = streaks(anyDates, today);
  medals.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  return {
    per,
    total,
    todayPoints,
    level: levelFor(total),
    medals,
    counts,
    general: { currentStreak: general.current, bestStreak: general.best, daysWithAny: anyDates.length },
    completedCount: CHALLENGES.filter((c) => per[c.id].completed).length,
  };
}

// Estado de un día en el calendario de un desafío.
export function dayStatus(state, id, date, today) {
  if (isDone(state, id, date)) return 'done';
  if (date > today) return 'future';
  if (date === today) return state.ch[id].active ? 'today' : 'off';
  if (isActiveOn(state, id, date)) return 'missed';
  return 'off';
}

export function activeCountOn(state, date) {
  return CHALLENGES.filter((c) => isActiveOn(state, c.id, date) || isDone(state, c.id, date)).length;
}
