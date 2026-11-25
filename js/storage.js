// Guardado en el teléfono (localStorage) y backup en archivo JSON.
import { createState, normalizeState } from './logic.js';

const KEY = 'desafios.state.v1';

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return normalizeState(JSON.parse(raw));
  } catch (e) {
    console.error('No se pudo leer el estado guardado', e);
  }
  return createState();
}

export function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    console.error('No se pudo guardar', e);
    return false;
  }
}

export function clearAll() {
  localStorage.removeItem(KEY);
}

export function backupFileName(now = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `desafios-backup-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}.json`;
}

// Exporta: en iPhone usa el menú "Compartir" (permite guardar en Archivos, mandarlo por mail, etc.).
// Si no está disponible, descarga el archivo.
export async function exportBackup(state) {
  const data = JSON.stringify({ app: 'desafios', exportedAt: new Date().toISOString(), state }, null, 2);
  const name = backupFileName();
  const file = new File([data], name, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Backup de Desafíos' });
      return 'shared';
    } catch (e) {
      if (e && e.name === 'AbortError') return 'cancelled';
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return 'downloaded';
}

export async function readBackupFile(file) {
  const text = await file.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('El archivo no es un JSON válido.');
  }
  const raw = json && json.app === 'desafios' && json.state ? json.state : json;
  return normalizeState(raw);
}
