// Interfaz de la app: pantallas, botones, temporizadores y celebraciones.
import { CHALLENGES, CHALLENGE_BY_ID, DIFFICULTY, LEVELS, MILESTONES, FINISH_BONUS } from './challenges.js';
import * as L from './logic.js';
import { load, save, clearAll, exportBackup, readBackupFile } from './storage.js';

export const APP_VERSION = '1.0.0';

let state = load();
const ui = {
  tab: 'hoy',
  day: 't', // 't' = hoy, 'y' = ayer
  calId: 'general',
  calMonth: L.todayKey().slice(0, 7),
  calSel: null,
  expanded: {},
  updateReg: null,
};
try { ui.tab = localStorage.getItem('desafios.tab') || 'hoy'; } catch {}

const $app = document.getElementById('app');
const $tabs = document.getElementById('tabs');
let lastToday = L.todayKey();

const today = () => L.todayKey();

// ---------- utilidades ----------

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function keyToDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}
const fmtLong = (key) => keyToDate(key).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtShort = (key) => keyToDate(key).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtNum = (n) => Math.round(n).toLocaleString('es-AR');
const kClass = (k) => (k.length >= 3 ? 's3' : k.length === 2 ? 's2' : '');

const CHECK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5 10 17.5 19 7"/></svg>';

function toast(msg) {
  document.querySelectorAll('.toast').forEach((t) => t.remove());
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

function commit({ celebrate = true } = {}) {
  if (!save(state)) toast('⚠️ No se pudo guardar en el teléfono');
  render();
  if (celebrate) checkCelebrations();
}

function goalText(c, def) {
  if (def.project && !c.goal) return 'Hasta terminarlo';
  return c.goal ? `${c.goal} días` : 'Sin meta';
}

// ---------- pantalla HOY ----------

function rankCard(all) {
  const lv = all.level;
  const next = lv.next
    ? `<span>${fmtNum(all.total)} ki</span><span>${fmtNum(lv.toNext)} para ${esc(lv.next.name)}</span>`
    : `<span>${fmtNum(all.total)} ki</span><span>Rango máximo</span>`;
  return `
    <section class="rank" aria-label="Tu rango">
      <div class="kanji ${lv.level.kanji.length > 1 ? 'long' : ''}">${lv.level.kanji}</div>
      <div>
        <div class="name">${esc(lv.level.name)}</div>
        <div class="title">${esc(lv.level.title)} · rango ${lv.index + 1} de ${LEVELS.length}</div>
        <div class="ki">${next}</div>
        <div class="bar"><i style="width:${Math.round(lv.progress * 100)}%"></i></div>
      </div>
    </section>`;
}

function needsBackupReminder() {
  const hasData = Object.values(state.days).some((d) => Object.keys(d).length);
  if (!hasData) return false;
  const last = state.lastBackupAt ? new Date(state.lastBackupAt) : new Date(state.createdAt);
  return Date.now() - last.getTime() > 30 * 86400000;
}

function challengeCardToday(id, all, date, t) {
  const def = CHALLENGE_BY_ID[id];
  const c = state.ch[id];
  const r = all.per[id];
  const entry = state.days[id]?.[date];
  const done = !!entry?.done;
  const canMark = L.canMarkChallenge(state, id, date, t);
  const isToday = date === t;
  const proj = def.project ? L.currentProject(state, id) : null;
  const lastProj = def.project ? c.projects[c.projects.length - 1] : null;

  let sub = esc(c.text || def.short);
  let meta = `<span>連 Racha <b>${r.currentStreak}</b></span><span>Récord <b>${r.bestStreak}</b></span>`;
  if (def.strict) meta += `<span>Contador <b>${r.progress}</b>/${r.goal || '∞'}</span>`;
  else if (def.project) meta += `<span>Avance <b>${r.progress}</b> ${r.goal ? '/' + r.goal : ''} días</span>`;
  else if (r.goal) meta += `<span><b>${r.progress}</b>/${r.goal}</span>`;
  if (def.multiUse && entry?.uses) meta += `<span>Olas ${isToday ? 'hoy' : 'ayer'} <b>${entry.uses}</b></span>`;

  const acts = [];
  if (def.timer && isToday) {
    const label = def.id === 'seiza' ? 'Empezar 5:00' : 'Ola · 90 s';
    acts.push(`<button class="btn small primary" data-act="timer" data-id="${id}">◯ ${label}</button>`);
  }
  if (def.project) {
    if (proj) {
      acts.push(`<button class="btn small red" data-act="finish" data-id="${id}">完 Terminado</button>`);
    } else {
      if (lastProj?.finishedAt) sub = `Terminaste: <b>${esc(lastProj.text)}</b> 完`;
      else sub = 'Escribí qué proyecto vas a terminar.';
      acts.push(`<button class="btn small primary" data-act="newproject" data-id="${id}">${lastProj ? 'Empezar otro proyecto' : 'Elegir proyecto'}</button>`);
      if (lastProj?.finishedAt && L.diffDays(lastProj.finishedAt, t) <= 1) {
        acts.push(`<button class="btn small ghost" data-act="undofinish" data-id="${id}">Deshacer "Terminado"</button>`);
      }
    }
  }
  if (canMark) acts.push(`<button class="btn small ghost" data-act="note" data-id="${id}">✎ Nota</button>`);

  return `
    <article class="card">
      <div class="ch">
        <div class="k ${kClass(def.kanji)}">${def.kanji}</div>
        <div>
          <h3>${esc(def.name)}</h3>
          <div class="text">${sub}</div>
          <div class="meta">${meta}</div>
        </div>
        <button class="check ${done ? 'on' : ''}" data-act="toggle" data-id="${id}" ${canMark ? '' : 'disabled'}
          aria-pressed="${done}" aria-label="${done ? 'Desmarcar' : 'Marcar'} ${esc(def.name)}">${CHECK_SVG}</button>
      </div>
      ${acts.length ? `<div class="actions">${acts.join('')}</div>` : ''}
      ${entry?.note ? `<div class="note-line">“${esc(entry.note)}”</div>` : ''}
    </article>`;
}

function viewHoy() {
  const t = today();
  const date = ui.day === 'y' ? L.addDays(t, -1) : t;
  const all = L.computeAll(state, t);
  const doneToday = state.order.filter((id) => L.isDone(state, id, t)).length;

  let list;
  if (!state.order.length) {
    list = `
      <div class="card empty">
        <div class="big">道</div>
        <p>El camino empieza con un paso.<br>Todavía no activaste ningún desafío.</p>
        <button class="btn red" data-act="go" data-tab="desafios">Elegir desafíos</button>
      </div>`;
  } else {
    list = `<div class="list">${state.order.map((id) => challengeCardToday(id, all, date, t)).join('')}</div>`;
  }

  return `
    <header class="screen-head"><h1>Hoy<span class="jp">今日</span></h1><span class="sub">${esc(fmtLong(t))}</span></header>
    ${rankCard(all)}
    <div class="today-stats">
      <div class="stat red"><b>+${fmtNum(all.todayPoints)}</b><span>ki de hoy</span></div>
      <div class="stat"><b>${doneToday}/${state.order.length}</b><span>cumplidos hoy</span></div>
      <div class="stat"><b>${all.general.currentStreak}</b><span>días seguidos</span></div>
    </div>
    ${needsBackupReminder() ? `<div class="banner"><span>Hace más de un mes que no hacés un backup.</span><button class="btn small red" data-act="export">Hacer backup</button></div>` : ''}
    ${state.order.length ? `
      <div class="seg" role="tablist">
        <button class="${ui.day === 't' ? 'on' : ''}" data-act="day" data-day="t">Hoy</button>
        <button class="${ui.day === 'y' ? 'on' : ''}" data-act="day" data-day="y">Ayer</button>
      </div>
      ${ui.day === 'y' ? `<div class="yesterday-note">Estás marcando ayer, ${esc(fmtLong(date))}.</div>` : ''}` : ''}
    ${list}`;
}

// ---------- pantalla CALENDARIO ----------

function viewCalendario() {
  const t = today();
  const all = L.computeAll(state, t);
  const withHistory = CHALLENGES.filter((c) => state.ch[c.id].active || all.per[c.id].doneCount || state.ch[c.id].periods.length);
  if (ui.calId !== 'general' && !withHistory.some((c) => c.id === ui.calId)) ui.calId = 'general';

  const chips = [`<button class="chip ${ui.calId === 'general' ? 'on' : ''}" data-act="calid" data-id="general">General</button>`]
    .concat(withHistory.map((c) => `<button class="chip ${ui.calId === c.id ? 'on' : ''}" data-act="calid" data-id="${c.id}">${c.kanji} ${esc(c.name)}</button>`))
    .join('');

  const [y, m] = ui.calMonth.split('-').map(Number);
  const first = `${ui.calMonth}-01`;
  const daysInMonth = new Date(y, m, 0).getDate();
  const offset = (keyToDate(first).getDay() + 6) % 7; // lunes primero
  const mn = keyToDate(first).toLocaleDateString('es-AR', { month: 'long' });
  const monthName = `${mn[0].toUpperCase()}${mn.slice(1)} ${y}`;

  let cells = ['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d) => `<div class="dow">${d}</div>`).join('');
  for (let i = 0; i < offset; i++) cells += '<div class="d blank"></div>';
  for (let day = 1; day <= daysInMonth; day++) {
    const key = `${ui.calMonth}-${String(day).padStart(2, '0')}`;
    let cls = '';
    if (ui.calId === 'general') {
      const n = all.counts[key] || 0;
      if (n) {
        const ratio = n / Math.max(1, L.activeCountOn(state, key));
        cls = ratio >= 1 ? 'l4' : ratio > 0.5 ? 'l3' : ratio > 0.25 ? 'l2' : 'l1';
      } else cls = key > t ? 'future' : 'off';
    } else {
      cls = L.dayStatus(state, ui.calId, key, t);
      if (cls === 'today') cls = '';
      if (state.days[ui.calId]?.[key]?.note) cls += ' has-note';
    }
    if (key === t) cls += ' today';
    cells += `<button class="d ${cls}" data-act="calday" data-key="${key}" aria-label="${key}">${day}</button>`;
  }

  const legend = ui.calId === 'general'
    ? `<span>Menos</span><i style="background:color-mix(in srgb,var(--red) 25%,var(--card))"></i><i style="background:color-mix(in srgb,var(--red) 50%,var(--card))"></i><i style="background:color-mix(in srgb,var(--red) 75%,var(--card))"></i><i style="background:var(--red)"></i><span>Todos</span>`
    : `<span><i style="background:var(--red);border-color:var(--red)"></i>Cumplido</span><span><i style="border-style:dashed;background:transparent"></i>Fallado</span><span><i style="background:transparent"></i>Sin activar / futuro</span>`;

  let detail = '';
  if (ui.calSel && ui.calSel.startsWith(ui.calMonth)) {
    if (ui.calId === 'general') {
      const done = CHALLENGES.filter((c) => L.isDone(state, c.id, ui.calSel));
      detail = `<b>${esc(fmtLong(ui.calSel))}</b><br>${done.length ? done.map((c) => `${c.kanji} ${esc(c.name)}`).join(' · ') : 'Ningún desafío cumplido.'}`;
    } else {
      const st = L.dayStatus(state, ui.calId, ui.calSel, t);
      const label = { done: 'Cumplido ✓', missed: 'Fallado', future: 'Futuro', today: 'Pendiente', off: 'Sin activar' }[st];
      const note = state.days[ui.calId]?.[ui.calSel]?.note;
      const pts = all.per[ui.calId].points[ui.calSel];
      detail = `<b>${esc(fmtLong(ui.calSel))}</b> · ${label}${pts ? ` · +${pts} ki` : ''}${note ? `<div class="note-line">“${esc(note)}”</div>` : ''}`;
    }
  }

  let summary = '';
  if (ui.calId !== 'general') {
    const r = all.per[ui.calId];
    summary = `<div class="today-stats"><div class="stat red"><b>${r.currentStreak}</b><span>racha actual</span></div><div class="stat"><b>${r.bestStreak}</b><span>récord</span></div><div class="stat"><b>${r.goal ? `${r.progress}/${r.goal}` : r.doneCount}</b><span>${r.goal ? 'meta' : 'días'}</span></div></div>`;
  }

  return `
    <header class="screen-head"><h1>Calendario<span class="jp">暦</span></h1></header>
    <div class="chips">${chips}</div>
    ${summary}
    <div class="card">
      <div class="month-nav">
        <button class="btn ghost" data-act="month" data-d="-1" aria-label="Mes anterior">‹</button>
        <h2>${esc(monthName)}</h2>
        <button class="btn ghost" data-act="month" data-d="1" aria-label="Mes siguiente">›</button>
      </div>
      <div class="cal">${cells}</div>
      <div class="legend">${legend}</div>
      ${detail ? `<div class="day-detail">${detail}</div>` : ''}
    </div>`;
}

// ---------- pantalla DESAFÍOS ----------

function challengeCardSetup(def, all) {
  const c = state.ch[def.id];
  const r = all.per[def.id];
  const d = DIFFICULTY[def.difficulty];
  const idx = state.order.indexOf(def.id);
  const exp = ui.expanded[def.id];
  const acts = [`<button class="btn small ghost" data-act="expand" data-id="${def.id}">${exp ? 'Menos' : 'Más info'}</button>`];
  if (c.active) {
    acts.push(`<button class="btn small ghost" data-act="edit" data-id="${def.id}">Editar meta</button>`);
    acts.push(`<button class="btn small ghost" data-act="up" data-id="${def.id}" ${idx === 0 ? 'disabled' : ''} aria-label="Subir">↑</button>`);
    acts.push(`<button class="btn small ghost" data-act="down" data-id="${def.id}" ${idx === state.order.length - 1 ? 'disabled' : ''} aria-label="Bajar">↓</button>`);
  }
  return `
    <article class="card">
      <div class="ch">
        <div class="k ${kClass(def.kanji)}">${def.kanji}</div>
        <div>
          <h3>${esc(def.name)}</h3>
          <div class="meta"><span class="badge ${def.difficulty}">${d.label} · ${d.points} ki/día</span><span>Meta: <b>${esc(goalText(c, def))}</b></span></div>
        </div>
        <button class="switch ${c.active ? 'on' : ''}" data-act="activate" data-id="${def.id}" role="switch" aria-checked="${c.active}" aria-label="Activar ${esc(def.name)}"></button>
      </div>
      <p class="desc">${esc(def.short)}</p>
      ${c.text ? `<p class="desc"><b>${esc(def.project ? 'Proyecto' : def.strict ? 'Práctica' : 'Detalle')}:</b> ${esc(c.text)}</p>` : ''}
      ${exp ? `<p class="desc">${esc(def.long)}</p><p class="desc">Hitos: 25 % · 50 % · 75 % · 100 % de la meta → ${MILESTONES.map((m) => fmtNum(m.bonus * d.mult)).join(' / ')} ki.${def.project ? ` Terminarlo: +${fmtNum(FINISH_BONUS * d.mult)} ki.` : ''}</p>${r.doneCount ? `<p class="desc">Historial: ${r.doneCount} días cumplidos · récord ${r.bestStreak}.</p>` : ''}` : ''}
      <div class="actions">${acts.join('')}</div>
    </article>`;
}

function viewDesafios() {
  const all = L.computeAll(state, today());
  const active = state.order.map((id) => CHALLENGE_BY_ID[id]);
  const inactive = CHALLENGES.filter((c) => !state.ch[c.id].active);
  return `
    <header class="screen-head"><h1>Desafíos<span class="jp">挑戦</span></h1><span class="sub">${active.length} activos</span></header>
    ${active.length ? `<div class="section-title">Activos · en este orden</div><div class="list">${active.map((d) => challengeCardSetup(d, all)).join('')}</div>` : '<p class="prose">Activá los desafíos que quieras encarar. Podés tener varios a la vez y cambiar el orden cuando quieras.</p>'}
    ${inactive.length ? `<div class="section-title">Disponibles</div><div class="list">${inactive.map((d) => challengeCardSetup(d, all)).join('')}</div>` : ''}`;
}

// ---------- pantalla RÉCORDS ----------

function viewRecords() {
  const t = today();
  const all = L.computeAll(state, t);
  const lv = all.level;
  const rows = CHALLENGES.filter((c) => all.per[c.id].doneCount || state.ch[c.id].active)
    .map((c) => {
      const r = all.per[c.id];
      return `<tr><td>${c.kanji} ${esc(c.name)}</td><td>${r.currentStreak}</td><td><b>${r.bestStreak}</b></td><td>${r.doneCount}</td></tr>`;
    }).join('');
  const medals = [...all.medals].reverse().map((m) => {
    const def = CHALLENGE_BY_ID[m.id];
    const what = m.pct === 'fin' ? `Terminado: ${m.project}` : `${m.pct} % · ${m.label}${m.project ? ` (${m.project})` : ''}`;
    return `<div class="medal"><div class="hanko p${m.pct}">${m.medal}</div><div><b>${esc(def.name)}</b> — ${esc(what)}<small>${esc(fmtShort(m.date))} · +${fmtNum(m.bonus)} ki</small></div></div>`;
  }).join('');
  const completed = CHALLENGES.filter((c) => all.per[c.id].completed);
  const ranks = LEVELS.map((l, i) => `<span class="badge ${i <= lv.index ? 'alta' : ''}">${l.kanji} ${esc(l.name)} · ${fmtNum(l.min)}</span>`).join(' ');

  return `
    <header class="screen-head"><h1>Récords<span class="jp">記録</span></h1></header>
    <div class="grid2">
      <div class="big-stat red"><b>${fmtNum(all.total)}</b><span>ki total</span></div>
      <div class="big-stat"><b>${lv.level.kanji} ${esc(lv.level.name)}</b><span>rango actual</span></div>
      <div class="big-stat"><b>${all.general.bestStreak}</b><span>mejor racha general<br>(días con al menos un desafío)</span></div>
      <div class="big-stat"><b>${all.general.currentStreak}</b><span>racha general actual</span></div>
      <div class="big-stat"><b>${all.medals.length}</b><span>medallas</span></div>
      <div class="big-stat"><b>${all.completedCount}</b><span>desafíos completados al 100 %</span></div>
    </div>

    <div class="section-title">Por desafío</div>
    ${rows ? `<div class="card"><table class="rec"><thead><tr><th>Desafío</th><th>Racha</th><th>Récord</th><th>Días</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="prose">Todavía no hay historial.</p>'}

    <div class="section-title">Medallas 印</div>
    ${medals ? `<div class="card medals">${medals}</div>` : '<p class="prose">Las medallas se ganan al llegar al 25 %, 50 %, 75 % y 100 % de la meta de cada desafío.</p>'}

    <div class="section-title">Completados al 100 %</div>
    ${completed.length ? `<div class="card prose">${completed.map((c) => `${c.kanji} <b>${esc(c.name)}</b>`).join('<br>')}</div>` : '<p class="prose">Ninguno todavía. 頑張って!</p>'}

    <div class="section-title">Rangos</div>
    <div class="actions" style="margin-top:0">${ranks}</div>`;
}

// ---------- pantalla AJUSTES ----------

function viewAjustes() {
  const last = state.lastBackupAt ? fmtShort(L.todayKey(new Date(state.lastBackupAt))) : 'nunca';
  return `
    <header class="screen-head"><h1>Ajustes<span class="jp">設定</span></h1></header>

    <div class="section-title">Backup</div>
    <div class="card stack">
      <button class="btn primary block" data-act="export">⬆︎ Exportar backup</button>
      <button class="btn ghost block" data-act="import">⬇︎ Importar backup</button>
      <input type="file" id="import-file" accept="application/json,.json" hidden>
      <div class="prose" style="font-size:14px">Último backup: <b>${esc(last)}</b></div>
      <details class="prose">
        <summary>¿Por qué conviene hacer backup?</summary>
        <p>Tus datos se guardan <b>solo en este iPhone</b>, dentro de la app. No hay ninguna cuenta ni nube. Si borrás el ícono de la app, cambiás de teléfono o el iPhone se resetea, se pierden.</p>
        <p>El backup es un archivo con todo tu historial. Al tocar <b>Exportar</b>, elegí <b>"Guardar en Archivos"</b> (por ejemplo en iCloud Drive) o mandátelo por mail. Para recuperarlo, tocá <b>Importar</b> y elegí ese archivo.</p>
        <p>Recomendación: hacé uno <b>cada dos semanas</b>. La app te avisa si pasó más de un mes.</p>
      </details>
    </div>

    <div class="section-title">Recordatorio diario</div>
    <div class="card prose">
      <p style="margin-top:0">La app no manda notificaciones (así funciona 100 % sin internet). Podés crear un recordatorio con el iPhone:</p>
      <details>
        <summary>Opción 1 · App Recordatorios (la más fácil)</summary>
        <ol>
          <li>Abrí la app <b>Recordatorios</b>.</li>
          <li>Tocá <b>Nuevo recordatorio</b> y escribí "Desafíos 侍".</li>
          <li>Tocá el ícono <b>ⓘ</b> a la derecha.</li>
          <li>Activá <b>Fecha</b> y <b>Hora</b>, y elegí la hora (por ejemplo 21:30).</li>
          <li>En <b>Repetir</b> elegí <b>Diariamente</b>. Tocá <b>OK</b>.</li>
        </ol>
      </details>
      <details>
        <summary>Opción 2 · Atajos (abre la app directo)</summary>
        <ol>
          <li>Abrí la app <b>Atajos</b> y andá a la pestaña <b>Automatización</b>.</li>
          <li>Tocá <b>+</b> (o "Nueva automatización") → <b>Hora del día</b>.</li>
          <li>Elegí la hora, <b>Diariamente</b>, y marcá <b>Ejecutar inmediatamente</b>. Tocá <b>Siguiente</b>.</li>
          <li>Elegí <b>Nuevo atajo en blanco</b>, buscá la acción <b>Abrir app</b> y elegí <b>Desafíos</b>.</li>
          <li>Tocá <b>OK</b>. A esa hora el iPhone te abre la app (o te muestra un aviso para abrirla).</li>
        </ol>
      </details>
    </div>

    <div class="section-title">App</div>
    <div class="card stack prose">
      <div>Versión <b>${APP_VERSION}</b> · funciona sin internet.</div>
      <button class="btn ghost block" data-act="checkupdate">Buscar actualización</button>
    </div>

    <div class="section-title">Zona peligrosa</div>
    <div class="card stack">
      <button class="btn danger block" data-act="reset">Reiniciar todo</button>
      <div class="prose" style="font-size:13px">Borra todo tu historial, ki y medallas. Hacé un backup antes.</div>
    </div>`;
}

// ---------- render ----------

const VIEWS = { hoy: viewHoy, calendario: viewCalendario, desafios: viewDesafios, records: viewRecords, ajustes: viewAjustes };

function render() {
  const updateBanner = ui.updateReg
    ? `<div class="banner"><span>Hay una versión nueva de la app.</span><button class="btn small red" data-act="applyupdate">Actualizar</button></div>`
    : '';
  const prevTab = $app.dataset.tab;
  const scrollY = window.scrollY;
  $app.innerHTML = `<div class="view" ${prevTab === ui.tab ? 'style="animation:none"' : ''}>${updateBanner}${VIEWS[ui.tab]()}</div>`;
  $app.dataset.tab = ui.tab;
  if (prevTab === ui.tab) window.scrollTo(0, scrollY);
  else window.scrollTo(0, 0);
  $tabs.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.tab === ui.tab));
}

function setTab(tab) {
  ui.tab = tab;
  try { localStorage.setItem('desafios.tab', tab); } catch {}
  render();
}

// ---------- hojas (diálogos) ----------

function openSheet(html, onSubmit) {
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  wrap.innerHTML = `<form class="sheet" novalidate>${html}</form>`;
  const close = () => wrap.remove();
  wrap.addEventListener('click', (e) => {
    if (e.target === wrap || e.target.closest('[data-close]')) close();
  });
  wrap.querySelector('form').addEventListener('submit', (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    if (onSubmit(data, wrap) !== false) close();
  });
  document.body.appendChild(wrap);
  const first = wrap.querySelector('input');
  if (first) setTimeout(() => first.focus(), 80);
  return wrap;
}

function sheetError(wrap, msg) {
  let el = wrap.querySelector('.err');
  if (!el) {
    el = document.createElement('p');
    el.className = 'err';
    el.style.color = 'var(--red)';
    wrap.querySelector('.row').before(el);
  }
  el.textContent = msg;
  return false;
}

function configSheet(id, mode) {
  const def = CHALLENGE_BY_ID[id];
  const c = state.ch[id];
  const goalVal = c.goal ?? '';
  const needText = def.strict || def.project;
  const textField = def.textLabel
    ? `<label class="field"><span>${esc(def.textLabel)}</span><input name="text" maxlength="80" value="${esc(c.text)}" placeholder="${esc(def.textPlaceholder || '')}" autocomplete="off"></label>`
    : '';
  const goalHint = def.project ? 'Opcional. Dejalo vacío para "hasta terminarlo". Si ponés días, ganás hitos al 25/50/75/100 %.' : def.strict ? 'Recordá: si faltás un día, el contador vuelve a 0.' : 'Días cumplidos que querés alcanzar.';
  openSheet(`
    <h2>${def.kanji} ${esc(def.name)}</h2>
    <p>${esc(def.long)}</p>
    ${textField}
    <label class="field"><span>Meta (días)</span><input name="goal" type="number" inputmode="numeric" min="1" max="3650" value="${goalVal}" placeholder="${def.project ? 'Hasta terminarlo' : ''}"><div class="hint">${goalHint}</div></label>
    <div class="row"><button type="button" class="btn ghost" data-close>Cancelar</button><button class="btn red">${mode === 'activate' ? 'Activar' : 'Guardar'}</button></div>
  `, (data, wrap) => {
    const text = (data.text || '').trim();
    if (needText && !text) return sheetError(wrap, 'Escribí ' + (def.project ? 'qué proyecto es.' : 'cuál es tu práctica.'));
    let goal = String(data.goal || '').trim();
    if (!goal && !def.project) return sheetError(wrap, 'Poné una meta en días.');
    goal = goal ? Number(goal) : null;
    if (goal !== null && (!Number.isFinite(goal) || goal < 1)) return sheetError(wrap, 'La meta tiene que ser un número de días.');
    const t = today();
    if (mode === 'activate') {
      L.activate(state, id, t, { goal, text });
      toast(`${def.name} activado`);
    } else {
      c.goal = goal === null ? null : Math.round(goal);
      if (def.textLabel) c.text = text;
      const p = def.project && L.currentProject(state, id);
      if (p) p.text = text;
      toast('Guardado');
    }
    commit();
  });
}

function noteSheet(id) {
  const t = today();
  const date = ui.day === 'y' ? L.addDays(t, -1) : t;
  const def = CHALLENGE_BY_ID[id];
  const cur = state.days[id]?.[date]?.note || '';
  openSheet(`
    <h2>Nota · ${esc(def.name)}</h2>
    <p>${esc(fmtLong(date))}</p>
    <label class="field"><span>Una línea (opcional)</span><input name="note" maxlength="140" value="${esc(cur)}" placeholder="${esc(def.notePlaceholder || '¿Cómo te fue?')}" autocomplete="off"></label>
    <div class="row"><button type="button" class="btn ghost" data-close>Cancelar</button><button class="btn red">Guardar</button></div>
  `, (data) => {
    L.setNote(state, id, date, t, (data.note || '').trim());
    commit();
  });
}

function projectSheet(id) {
  const def = CHALLENGE_BY_ID[id];
  openSheet(`
    <h2>頑張る Nuevo proyecto</h2>
    <p>Algo que dijiste que ibas a terminar. Marcá cada día que avances.</p>
    <label class="field"><span>${esc(def.textLabel)}</span><input name="text" maxlength="80" placeholder="${esc(def.textPlaceholder)}" autocomplete="off"></label>
    <div class="row"><button type="button" class="btn ghost" data-close>Cancelar</button><button class="btn red">Empezar</button></div>
  `, (data, wrap) => {
    if (!L.startProject(state, id, today(), data.text || '')) return sheetError(wrap, 'Escribí qué proyecto es.');
    commit();
  });
}

function finishSheet(id) {
  const p = L.currentProject(state, id);
  const bonus = FINISH_BONUS * DIFFICULTY[CHALLENGE_BY_ID[id].difficulty].mult;
  openSheet(`
    <h2>完 ¿Lo terminaste?</h2>
    <p><b>${esc(p.text)}</b><br>Al confirmarlo ganás <b>+${fmtNum(bonus)} ki</b> y una medalla. Después podés empezar otro proyecto.</p>
    <div class="row"><button type="button" class="btn ghost" data-close>Todavía no</button><button class="btn red">¡Terminado!</button></div>
  `, () => {
    L.finishProject(state, id, today());
    commit();
  });
}

function resetSheet() {
  if (!confirm('¿Seguro que querés borrar TODO? Se pierde todo tu historial, ki y medallas.')) return;
  openSheet(`
    <h2>Confirmación final</h2>
    <p>Para borrar todo, escribí <b>BORRAR</b> en mayúsculas.</p>
    <label class="field"><span>Confirmación</span><input name="c" autocomplete="off" autocapitalize="characters"></label>
    <div class="row"><button type="button" class="btn ghost" data-close>Cancelar</button><button class="btn red">Borrar todo</button></div>
  `, (data, wrap) => {
    if ((data.c || '').trim() !== 'BORRAR') return sheetError(wrap, 'Tenés que escribir BORRAR.');
    clearAll();
    try { localStorage.removeItem('desafios.timer'); } catch {}
    state = L.createState();
    ui.day = 't';
    save(state);
    setTab('hoy');
    toast('Todo reiniciado. Empezá de nuevo.');
  });
}

// ---------- backup ----------

async function doExport() {
  const prev = state.lastBackupAt;
  state.lastBackupAt = new Date().toISOString();
  save(state);
  try {
    const r = await exportBackup(state);
    if (r === 'cancelled') {
      state.lastBackupAt = prev;
      save(state);
    } else toast(r === 'shared' ? 'Backup listo ✓' : 'Backup descargado ✓');
  } catch (e) {
    state.lastBackupAt = prev;
    save(state);
    toast('No se pudo exportar el backup');
  }
  render();
}

function doImport() {
  const input = document.getElementById('import-file');
  input.value = '';
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;
    try {
      const imported = await readBackupFile(file);
      if (!confirm('Esto reemplaza todos los datos actuales por los del backup. ¿Continuar?')) return;
      state = imported;
      syncSeen();
      save(state);
      setTab('hoy');
      toast('Backup importado ✓');
    } catch (e) {
      alert('No se pudo importar: ' + e.message);
    }
  };
  input.click();
}

// ---------- celebraciones ----------

const queue = [];
let showing = false;

function syncSeen() {
  const all = L.computeAll(state, today());
  state.seen = { level: all.level.index, medals: all.medals.map((m) => m.key) };
}

function checkCelebrations() {
  const all = L.computeAll(state, today());
  const seen = new Set(state.seen.medals);
  const fresh = all.medals.filter((m) => !seen.has(m.key));
  for (const m of fresh) queue.push({ type: 'medal', m });
  if (all.level.index > state.seen.level) {
    for (let i = state.seen.level + 1; i <= all.level.index; i++) queue.push({ type: 'level', i, all });
  }
  const changed = fresh.length || all.level.index !== state.seen.level || state.seen.medals.length !== all.medals.length;
  state.seen = { level: all.level.index, medals: all.medals.map((m) => m.key) };
  if (changed) save(state);
  showNext();
}

function sparks(n = 18) {
  let s = '';
  for (let i = 0; i < n; i++) s += `<i class="spark" style="--r:${Math.round((360 / n) * i)}deg;animation-delay:${0.15 + (i % 3) * 0.08}s"></i>`;
  return s;
}

function showNext() {
  if (showing || !queue.length) return;
  showing = true;
  const item = queue.shift();
  const el = document.createElement('div');
  el.className = 'celebrate';
  if (item.type === 'level') {
    const lv = LEVELS[item.i];
    const next = LEVELS[item.i + 1];
    el.innerHTML = `<div class="rays"></div><div class="aura"></div>${sparks()}
      <div class="inner">
        <div class="eyebrow">Tu ki se eleva · 昇格</div>
        <div class="bigk ${lv.kanji.length > 1 ? 'long' : ''}">${lv.kanji}</div>
        <h2>${esc(lv.name)}</h2>
        <p>${esc(lv.title)}</p>
        <p style="opacity:.7;font-size:14px">${next ? `Próximo rango: ${esc(next.name)} a ${fmtNum(next.min)} ki` : 'Alcanzaste el rango máximo. Leyenda.'}</p>
        <button class="btn" data-close>押忍 ¡Vamos!</button>
      </div>`;
  } else {
    const m = item.m;
    const def = CHALLENGE_BY_ID[m.id];
    const gold = m.pct === 100 || m.pct === 'fin';
    const title = m.pct === 'fin' ? '¡Proyecto terminado!' : `${m.pct} % · ${m.label}`;
    el.innerHTML = `<div class="rays"></div>${sparks(12)}
      <div class="inner">
        <div class="eyebrow">Hito alcanzado · 印</div>
        <div class="stamp ${gold ? 'gold' : ''}">${m.medal}</div>
        <h2>${esc(title)}</h2>
        <p>${def.kanji} ${esc(def.name)}${m.project ? ` · ${esc(m.project)}` : ''}</p>
        <p style="color:#ffcf8a;font-weight:700">+${fmtNum(m.bonus)} ki</p>
        <button class="btn" data-close>Seguir</button>
      </div>`;
  }
  el.addEventListener('click', (e) => {
    if (!e.target.closest('[data-close]')) return;
    el.remove();
    showing = false;
    render();
    showNext();
  });
  document.body.appendChild(el);
}

// ---------- temporizador (Seiza y Ola) ----------

const TIMER_KEY = 'desafios.timer';
let timerTick = null;
let wakeLock = null;
let audioCtx = null;

function unlockAudio() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    // sonido mudo para "despertar" el audio en iOS
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    g.gain.value = 0;
    o.connect(g).connect(audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + 0.01);
  } catch {}
}

function bell() {
  if (!audioCtx) return;
  try {
    const now = audioCtx.currentTime;
    [[528, 0.35], [792, 0.12], [1056, 0.08]].forEach(([f, v]) => {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(v, now + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 4);
      o.connect(g).connect(audioCtx.destination);
      o.start(now);
      o.stop(now + 4.1);
    });
  } catch {}
}

async function keepAwake() {
  try {
    if ('wakeLock' in navigator && document.visibilityState === 'visible') wakeLock = await navigator.wakeLock.request('screen');
  } catch {}
}
function releaseAwake() {
  try { wakeLock && wakeLock.release(); } catch {}
  wakeLock = null;
}

function readTimer() {
  try { return JSON.parse(localStorage.getItem(TIMER_KEY) || 'null'); } catch { return null; }
}

function startTimer(id) {
  const def = CHALLENGE_BY_ID[id];
  unlockAudio();
  const t = { id, date: today(), end: Date.now() + def.timer * 1000, total: def.timer };
  try { localStorage.setItem(TIMER_KEY, JSON.stringify(t)); } catch {}
  showTimer(t);
}

const fmtClock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

function showTimer(t) {
  document.querySelector('.timer')?.remove();
  const def = CHALLENGE_BY_ID[t.id];
  const msg = t.id === 'seiza' ? 'Espalda recta. Quieto. Solo respirá.' : 'Dejala pasar. No la alimentes. Es solo una ola.';
  const C = 2 * Math.PI * 46;
  const el = document.createElement('div');
  el.className = 'timer';
  el.innerHTML = `
    <div class="ring">
      <svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="none" stroke="#1a1715" stroke-width="1.5"/>
      <circle class="prog" cx="50" cy="50" r="46" fill="none" stroke="#7a1e17" stroke-width="2" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C}"/></svg>
      <div class="t">${fmtClock(t.total)}</div>
    </div>
    <div class="msg">${esc(msg)}</div>
    <button class="cancel" data-tact="cancel">Cancelar</button>`;
  document.body.appendChild(el);
  keepAwake();
  const prog = el.querySelector('.prog');
  const txt = el.querySelector('.t');

  const tick = () => {
    const left = Math.max(0, Math.ceil((t.end - Date.now()) / 1000));
    txt.textContent = fmtClock(left);
    prog.style.strokeDashoffset = String(C * (left / t.total));
    if (left <= 0) finishTimer(t, el, true);
  };
  clearInterval(timerTick);
  timerTick = setInterval(tick, 250);
  tick();

  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tact]');
    if (!b) return;
    if (b.dataset.tact === 'cancel') {
      if (!confirm('¿Cortar el temporizador? No se va a marcar el día.')) return;
      clearInterval(timerTick);
      try { localStorage.removeItem(TIMER_KEY); } catch {}
      releaseAwake();
      el.remove();
    } else if (b.dataset.tact === 'close') {
      el.remove();
      render();
      checkCelebrations();
    }
  });
  void def;
}

function completeTimerState(t) {
  const def = CHALLENGE_BY_ID[t.id];
  try { localStorage.removeItem(TIMER_KEY); } catch {}
  if (!state.ch[t.id].active) return;
  const now = today();
  // si el temporizador empezó antes de medianoche, cuenta para ese día (siempre que sea hoy o ayer)
  const date = L.canMark(t.date, now) ? t.date : now;
  if (def.multiUse) L.addUse(state, t.id, date);
  else L.setDone(state, t.id, date, now, true);
  save(state);
}

function finishTimer(t, el, ring) {
  clearInterval(timerTick);
  completeTimerState(t);
  releaseAwake();
  if (ring) bell();
  el.classList.add('finished');
  el.querySelector('.t').textContent = '完';
  const def = CHALLENGE_BY_ID[t.id];
  const uses = state.days[t.id]?.[t.date]?.uses;
  el.querySelector('.msg').textContent = def.multiUse
    ? `La ola pasó. Día marcado ✓${uses > 1 ? ` (${uses} olas hoy)` : ''}`
    : 'Listo. Día marcado ✓';
  const btn = el.querySelector('.cancel');
  btn.dataset.tact = 'close';
  btn.textContent = 'Cerrar';
}

function resumeTimer() {
  const t = readTimer();
  if (!t || !CHALLENGE_BY_ID[t.id]) return;
  if (Date.now() >= t.end) {
    showTimer({ ...t, end: Date.now() + 1e9 });
    finishTimer(t, document.querySelector('.timer'), false);
  } else showTimer(t);
}

// ---------- eventos ----------

$tabs.addEventListener('click', (e) => {
  const b = e.target.closest('[data-tab]');
  if (b) setTab(b.dataset.tab);
});

const ACTIONS = {
  go: (el) => setTab(el.dataset.tab),
  day: (el) => { ui.day = el.dataset.day; render(); },
  toggle: (el) => {
    const t = today();
    const date = ui.day === 'y' ? L.addDays(t, -1) : t;
    if (L.toggleDay(state, el.dataset.id, date, t)) commit();
  },
  note: (el) => noteSheet(el.dataset.id),
  timer: (el) => startTimer(el.dataset.id),
  finish: (el) => finishSheet(el.dataset.id),
  newproject: (el) => projectSheet(el.dataset.id),
  undofinish: (el) => {
    if (confirm('¿Deshacer "Terminado"? Se quita el bonus de ese proyecto.')) {
      L.undoFinish(state, el.dataset.id);
      commit();
    }
  },
  activate: (el) => {
    const id = el.dataset.id;
    if (state.ch[id].active) {
      L.deactivate(state, id, today());
      commit();
      toast('Desactivado. Su historial queda guardado.');
    } else configSheet(id, 'activate');
  },
  edit: (el) => configSheet(el.dataset.id, 'edit'),
  up: (el) => { L.move(state, el.dataset.id, -1); commit(); },
  down: (el) => { L.move(state, el.dataset.id, 1); commit(); },
  expand: (el) => { ui.expanded[el.dataset.id] = !ui.expanded[el.dataset.id]; render(); },
  calid: (el) => { ui.calId = el.dataset.id; ui.calSel = null; render(); },
  month: (el) => {
    const [y, m] = ui.calMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + Number(el.dataset.d), 1);
    ui.calMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    ui.calSel = null;
    render();
  },
  calday: (el) => { ui.calSel = el.dataset.key; render(); },
  export: () => doExport(),
  import: () => doImport(),
  reset: () => resetSheet(),
  checkupdate: async () => {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (!reg) return toast('Sin conexión al servicio de actualización');
    try { await reg.update(); } catch { return toast('Sin internet: probá más tarde'); }
    setTimeout(() => toast(ui.updateReg ? 'Hay una versión nueva ↑' : 'Ya tenés la última versión'), 1500);
  },
  applyupdate: () => {
    const w = ui.updateReg?.waiting;
    ui.applyingUpdate = true;
    if (w) w.postMessage('skipWaiting');
    else location.reload();
  },
};

$app.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = ACTIONS[el.dataset.act];
  if (fn) fn(el);
});

// Cambio de día (por ejemplo, si dejás la app abierta pasada la medianoche)
function checkDayChange() {
  const t = today();
  if (t !== lastToday) {
    lastToday = t;
    ui.day = 't';
    ui.calMonth = t.slice(0, 7);
    render();
  }
}
setInterval(checkDayChange, 30000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    checkDayChange();
    if (document.querySelector('.timer:not(.finished)')) keepAwake();
  }
});

// ---------- service worker (offline + actualizaciones) ----------

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').then((reg) => {
    const onWaiting = () => { ui.updateReg = reg; render(); };
    if (reg.waiting && navigator.serviceWorker.controller) onWaiting();
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) onWaiting();
      });
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update().catch(() => {});
    });
  }).catch((e) => console.warn('SW no registrado', e));
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // solo recargamos si el usuario tocó "Actualizar" (no en la primera instalación)
    if (reloading || !ui.applyingUpdate) return;
    reloading = true;
    location.reload();
  });
}

// ---------- inicio ----------

render();
resumeTimer();
checkCelebrations();

// Para las pruebas automáticas
window.__desafios = { get state() { return state; }, L };
