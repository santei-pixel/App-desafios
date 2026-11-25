// Prueba de punta a punta en tamaño iPhone 17 con Playwright.
// Uso: npm run e2e   (levanta un servidor local, abre la app y prueba todo)
// Guarda capturas en tests/screenshots/.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const { chromium, devices } = createRequire(import.meta.url)('playwright');
const root = fileURLToPath(new URL('..', import.meta.url));
const shots = fileURLToPath(new URL('./screenshots/', import.meta.url));
mkdirSync(shots, { recursive: true });

const PORT = 8123;
const URL_APP = `http://localhost:${PORT}/`;
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));

const { defaultBrowserType, ...iphone } = devices['iPhone 17'];
const browser = await chromium.launch();
let passed = 0;
const step = async (name, fn) => {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    console.log(`  ✗ ${name}\n    ${e.message.split('\n').join('\n    ')}`);
    process.exitCode = 1;
  }
};

async function newPage({ time = '2026-11-20T10:00:00', dark = false, state } = {}) {
  const ctx = await browser.newContext({
    ...iphone,
    timezoneId: 'America/Argentina/Buenos_Aires',
    locale: 'es-AR',
    colorScheme: dark ? 'dark' : 'light',
    acceptDownloads: true,
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { console.log('    [error en la página]', e.message); process.exitCode = 1; });
  await page.clock.install({ time: new Date(time) });
  if (state) {
    await page.addInitScript((s) => {
      if (!sessionStorage.getItem('seeded')) {
        localStorage.setItem('desafios.state.v1', s);
        sessionStorage.setItem('seeded', '1');
      }
    }, JSON.stringify(state));
  }
  await page.goto(URL_APP);
  return { ctx, page };
}

const getState = (page) => page.evaluate(() => window.__desafios.state);
const closeCelebrations = async (page) => {
  while (await page.locator('.celebrate').count()) {
    await page.locator('.celebrate [data-close]').click();
  }
};

async function activate(page, id, { goal, text } = {}) {
  await page.locator(`[data-act="activate"][data-id="${id}"]`).click();
  if (text !== undefined) await page.fill('.sheet input[name="text"]', text);
  if (goal !== undefined) await page.fill('.sheet input[name="goal"]', String(goal));
  await page.locator('.sheet button.red').click();
  await page.waitForSelector('.sheet', { state: 'detached' });
}

console.log('Prueba E2E · iPhone 17');

// ---------------- Flujo principal ----------------
{
  const { ctx, page } = await newPage();

  await step('carga la pantalla Hoy vacía', async () => {
    await page.waitForSelector('.empty');
    assert.match(await page.textContent('.rank'), /Deshi/);
    await page.screenshot({ path: shots + '01-hoy-vacio.png' });
  });

  await step('navega por las 5 pestañas', async () => {
    for (const [tab, title] of [['calendario', 'Calendario'], ['desafios', 'Desafíos'], ['records', 'Récords'], ['ajustes', 'Ajustes'], ['hoy', 'Hoy']]) {
      await page.click(`.tabbar [data-tab="${tab}"]`);
      assert.match(await page.textContent('.screen-head h1'), new RegExp(title));
    }
  });

  await step('activa desafíos (Shugyo exige escribir la práctica)', async () => {
    await page.click('.tabbar [data-tab="desafios"]');
    await page.locator('[data-act="activate"][data-id="shugyo"]').click();
    await page.locator('.sheet button.red').click();
    assert.match(await page.textContent('.sheet .err'), /práctica/);
    await page.fill('.sheet input[name="text"]', '20 flexiones');
    await page.locator('.sheet button.red').click();
    await activate(page, 'seiza', { goal: 4 });
    await activate(page, 'repaso');
    await activate(page, 'ola90');
    await activate(page, 'ganbaru', { text: 'Curso de inglés' });
    const s = await getState(page);
    assert.deepEqual(s.order, ['shugyo', 'seiza', 'repaso', 'ola90', 'ganbaru']);
    assert.equal(s.ch.seiza.goal, 4);
    assert.equal(s.ch.shugyo.text, '20 flexiones');
    await page.screenshot({ path: shots + '02-desafios.png', fullPage: true });
  });

  await step('reordena con flechas', async () => {
    await page.locator('[data-act="up"][data-id="ola90"]').click();
    await page.locator('[data-act="up"][data-id="ola90"]').click();
    assert.deepEqual((await getState(page)).order, ['shugyo', 'ola90', 'seiza', 'repaso', 'ganbaru']);
  });

  await step('marca y desmarca hoy (puntos del día)', async () => {
    await page.click('.tabbar [data-tab="hoy"]');
    const btn = page.locator('[data-act="toggle"][data-id="repaso"]');
    await btn.click();
    assert.equal(await btn.getAttribute('aria-pressed'), 'true');
    assert.match(await page.textContent('.today-stats'), /\+10/);
    await btn.click();
    assert.equal(await page.locator('[data-act="toggle"][data-id="repaso"]').getAttribute('aria-pressed'), 'false');
    assert.match(await page.textContent('.today-stats'), /\+0/);
    await page.locator('[data-act="toggle"][data-id="repaso"]').click();
  });

  await step('marca ayer y dispara hitos (Seiza meta 4: 25 % y 50 %)', async () => {
    await page.click('[data-act="day"][data-day="y"]');
    assert.match(await page.textContent('.yesterday-note'), /ayer/);
    await page.locator('[data-act="toggle"][data-id="seiza"]').click();
    await page.waitForSelector('.celebrate');
    assert.match(await page.textContent('.celebrate'), /25 %/);
    await page.screenshot({ path: shots + '03-hito.png' });
    await page.locator('.celebrate [data-close]').click();
    await page.click('[data-act="day"][data-day="t"]');
    await page.locator('[data-act="toggle"][data-id="seiza"]').click();
    await page.waitForSelector('.celebrate');
    assert.match(await page.textContent('.celebrate'), /50 %/);
    await closeCelebrations(page);
  });

  await step('nota del día', async () => {
    await page.locator('[data-act="note"][data-id="repaso"]').click();
    await page.fill('.sheet input[name="note"]', 'Ayudé a mi vieja con la mudanza');
    await page.locator('.sheet button.red').click();
    assert.match(await page.textContent('.list'), /mudanza/);
  });

  await step('temporizador de Seiza: 5 min en negro y marca el día solo', async () => {
    await page.locator('[data-act="toggle"][data-id="seiza"]').click(); // desmarcar hoy
    await closeCelebrations(page);
    assert.equal((await getState(page)).days.seiza['2026-11-20'].done, false);
    await page.locator('[data-act="timer"][data-id="seiza"]').click();
    await page.waitForSelector('.timer');
    await page.clock.runFor(150000);
    assert.match(await page.textContent('.timer .t'), /2:30/);
    await page.screenshot({ path: shots + '04-seiza.png' });
    await page.clock.runFor(151000);
    await page.waitForSelector('.timer.finished');
    assert.equal((await getState(page)).days.seiza['2026-11-20'].done, true);
    await page.click('.timer [data-tact="close"]');
    await closeCelebrations(page);
  });

  await step('Ola de 90 s: dos usos, el día cuenta una vez', async () => {
    for (let i = 0; i < 2; i++) {
      await page.locator('[data-act="timer"][data-id="ola90"]').click();
      await page.clock.runFor(91000);
      await page.waitForSelector('.timer.finished');
      await page.click('.timer [data-tact="close"]');
      await closeCelebrations(page);
    }
    const s = await getState(page);
    assert.equal(s.days.ola90['2026-11-20'].uses, 2);
    assert.match(await page.textContent('.list'), /Olas hoy 2/);
  });

  await step('Ganbaru: Terminado da +1500 ki y medalla', async () => {
    await page.locator('[data-act="toggle"][data-id="ganbaru"]').click();
    await page.locator('[data-act="finish"][data-id="ganbaru"]').click();
    await page.locator('.sheet button.red').click();
    await page.waitForSelector('.celebrate');
    assert.match(await page.textContent('.celebrate'), /1\.?500/);
    await closeCelebrations(page);
    assert.match(await page.textContent('.list'), /Empezar otro proyecto/);
    await page.screenshot({ path: shots + '05-hoy.png', fullPage: true });
  });

  await step('al subir de rango aparece la animación (Ashigaru)', async () => {
    // 1500 de Ganbaru + hitos de Seiza ya superan 300
    const s = await getState(page);
    assert.ok(s.seen.level >= 1);
  });

  await step('Shugyo: al pasar un día sin marcar, el contador vuelve a 0', async () => {
    await page.locator('[data-act="toggle"][data-id="shugyo"]').click();
    await closeCelebrations(page);
    assert.match(await page.locator('.card', { hasText: 'Shugyo' }).textContent(), /Contador 1\/100/);
    await page.clock.setSystemTime(new Date('2026-11-22T10:00:00')); // se saltea el 21
    await page.reload();
    await closeCelebrations(page);
    const card = page.locator('.card', { hasText: 'Shugyo' });
    assert.match(await card.textContent(), /Contador 0\/100/);
    assert.match(await card.textContent(), /Récord 1/);
    // y ya no se puede marcar el 20 (anteayer)
    await page.click('[data-act="day"][data-day="y"]');
    assert.equal(await getState(page).then((s) => s.days.shugyo['2026-11-21']), undefined);
    await page.click('[data-act="day"][data-day="t"]');
  });

  await step('calendario por desafío y general', async () => {
    await page.click('.tabbar [data-tab="calendario"]');
    await page.click('[data-act="calid"][data-id="seiza"]');
    assert.equal(await page.locator('.cal .d.done').count(), 2);
    assert.ok(await page.locator('.cal .d.missed').count() >= 1); // el 21
    await page.screenshot({ path: shots + '06-calendario-seiza.png' });
    await page.click('[data-act="calid"][data-id="general"]');
    assert.ok(await page.locator('.cal .d.l1, .cal .d.l2, .cal .d.l3, .cal .d.l4').count() >= 2);
    await page.click('[data-act="calday"][data-key="2026-11-20"]');
    assert.match(await page.textContent('.day-detail'), /Seiza/);
    await page.screenshot({ path: shots + '07-calendario-general.png' });
  });

  await step('récords y medallas', async () => {
    await page.click('.tabbar [data-tab="records"]');
    const txt = await page.textContent('#app');
    assert.match(txt, /Medallas/);
    assert.ok(await page.locator('.medal').count() >= 3);
    await page.screenshot({ path: shots + '08-records.png', fullPage: true });
  });

  let backupPath;
  await step('exportar backup', async () => {
    await page.click('.tabbar [data-tab="ajustes"]');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-act="export"]')]);
    assert.match(dl.suggestedFilename(), /desafios-backup-2026-11-22\.json/);
    backupPath = shots + 'backup.json';
    await dl.saveAs(backupPath);
    const json = JSON.parse(readFileSync(backupPath, 'utf8'));
    assert.equal(json.app, 'desafios');
    assert.equal(json.state.days.seiza['2026-11-19'].done, true);
    await page.screenshot({ path: shots + '09-ajustes.png', fullPage: true });
  });

  await step('reiniciar todo con doble confirmación', async () => {
    page.once('dialog', (d) => d.accept());
    await page.click('[data-act="reset"]');
    await page.fill('.sheet input[name="c"]', 'borrar');
    await page.locator('.sheet button.red').click();
    assert.match(await page.textContent('.sheet .err'), /BORRAR/);
    await page.fill('.sheet input[name="c"]', 'BORRAR');
    await page.locator('.sheet button.red').click();
    await page.waitForSelector('.empty');
    assert.deepEqual((await getState(page)).order, []);
  });

  await step('importar backup restaura todo', async () => {
    await page.click('.tabbar [data-tab="ajustes"]');
    page.once('dialog', (d) => d.accept());
    await page.click('[data-act="import"]');
    await page.setInputFiles('#import-file', backupPath);
    await page.waitForSelector('.screen-head h1:has-text("Hoy")');
    const s = await getState(page);
    assert.equal(s.order.length, 5);
    assert.equal(s.days.repaso['2026-11-20'].note, 'Ayudé a mi vieja con la mudanza');
    assert.equal(await page.locator('.celebrate').count(), 0); // no repite celebraciones
  });

  await step('funciona offline (modo avión)', async () => {
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload(); // que el service worker controle la página
    await page.waitForFunction(() => navigator.serviceWorker.controller);
    await ctx.setOffline(true);
    await page.reload();
    await page.waitForSelector('.rank');
    await page.click('.tabbar [data-tab="calendario"]');
    await page.waitForSelector('.cal');
    const ok = await page.evaluate(async () => (await fetch('icons/icon-192.png')).ok);
    assert.ok(ok);
    await ctx.setOffline(false);
  });

  await ctx.close();
}

// ---------------- Rango y modo oscuro ----------------
{
  const gaman = {};
  for (let i = 1; i <= 15; i++) gaman[`2026-11-${String(i).padStart(2, '0')}`] = { done: true, note: '', uses: 0 };
  const state = {
    version: 1, createdAt: '2026-09-01T00:00:00.000Z', lastBackupAt: null, order: ['gaman', 'seiza'],
    ch: {
      gaman: { active: true, goal: 30, text: '', periods: [{ from: '2026-11-01', to: null }], projects: [] },
      seiza: { active: true, goal: 30, text: '', periods: [{ from: '2026-11-10', to: null }], projects: [] },
    },
    days: { gaman },
    seen: { level: 0, medals: [] },
  };
  const { ctx, page } = await newPage({ time: '2026-11-16T09:00:00', dark: true, state });

  await step('subida de rango con animación (modo oscuro)', async () => {
    await closeCelebrationsUntilLevel(page);
    assert.match(await page.textContent('.celebrate'), /Ashigaru/);
    await page.waitForTimeout(900);
    await page.screenshot({ path: shots + '10-rango.png' });
    await closeCelebrations(page);
    await page.screenshot({ path: shots + '11-hoy-oscuro.png', fullPage: true });
  });

  await step('aviso de backup si pasó más de un mes', async () => {
    assert.match(await page.textContent('#app'), /backup/);
  });

  await ctx.close();
}

async function closeCelebrationsUntilLevel(page) {
  await page.waitForSelector('.celebrate');
  while (!/Tu ki se eleva/.test(await page.textContent('.celebrate'))) {
    await page.locator('.celebrate [data-close]').click();
    await page.waitForSelector('.celebrate');
  }
}

await browser.close();
server.kill();
console.log(`\n${passed} pasos OK${process.exitCode ? ' · HAY FALLAS' : ''}`);
