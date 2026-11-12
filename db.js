// IndexedDB (roster + sessions) + CSV + Google Apps Script
let _db;
function open() {
  if (_db) return Promise.resolve(_db);
  return new Promise((res, rej) => {
    const r = indexedDB.open('AsistenciaAcusticaDB', 1);
    r.onupgradeneeded = () => {
      r.result.createObjectStore('roster', { keyPath: 'id' });
      r.result.createObjectStore('sessions', { keyPath: 'id' });
    };
    r.onsuccess = () => res((_db = r.result));
    r.onerror = () => rej(r.error);
  });
}
async function run(store, mode, fn) {
  const db = await open();
  return new Promise((res, rej) => {
    const t = db.transaction(store, mode), s = t.objectStore(store);
    const out = fn(s);
    t.oncomplete = () => res(out && out.result !== undefined ? out.result : undefined);
    t.onerror = () => rej(t.error);
  });
}
// ---- roster ----
export const getRoster = () => run('roster', 'readonly', s => s.getAll()).then(r => r || []);
export async function setRoster(list) {
  await run('roster', 'readwrite', s => { s.clear(); list.forEach(p => s.put(p)); });
  return list.length;
}
// Líneas: "Nombre[,Codigo]" (ID = nº de línea) o "ID,Nombre[,Codigo]"
export function parseRoster(text) {
  const out = []; let n = 0;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue; n++;
    const f = line.split(/[,;\t]/).map(x => x.trim());
    if (/^\d+$/.test(f[0]) && f.length >= 2) out.push({ id: +f[0], nombre: f[1], codigo: f[2] || '' });
    else out.push({ id: n, nombre: f[0], codigo: f[1] || '' });
  }
  return out.filter(p => p.id >= 1 && p.id <= 64);
}
export const importRosterText = t => setRoster(parseRoster(t));
export const loadTestRoster = () => setRoster(Array.from({ length: 20 }, (_, i) =>
  ({ id: i + 1, nombre: 'Alumno ' + String(i + 1).padStart(2, '0'), codigo: 'A' + String(100 + i + 1) })));
export async function fetchRosterFromScript(url) {
  const r = await fetch(url + (url.includes('?') ? '&' : '?') + 'action=roster');
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || 'Respuesta inválida');
  return setRoster(j.roster);
}
// ---- sessions ----
export const saveSession = s => run('sessions', 'readwrite', st => st.put(s));
export const getSession = id => run('sessions', 'readonly', st => st.get(id));
export const listSessions = () => run('sessions', 'readonly', s => s.getAll())
  .then(a => (a || []).sort((x, y) => y.id.localeCompare(x.id)));
// ---- filas presentes/ausentes ----
export async function buildRows(sess) {
  const roster = await getRoster(), present = new Set(sess.presentIds);
  const byId = new Map(roster.map(p => [p.id, p]));
  present.forEach(id => { if (!byId.has(id)) byId.set(id, { id, nombre: '', codigo: '' }); });
  return [...byId.values()].sort((a, b) => a.id - b.id).map(p => ({
    id: p.id, nombre: p.nombre, codigo: p.codigo, estado: present.has(p.id) ? 'Presente' : 'Ausente',
  }));
}
export async function exportSessionCSV(sessionId) {
  const s = await getSession(sessionId), rows = await buildRows(s);
  const q = v => `"${String(v).replace(/"/g, '""')}"`;
  const csv = ['ID,Nombre,Codigo,Estado,Fecha', ...rows.map(r => [r.id, q(r.nombre), q(r.codigo), r.estado, q(s.fecha)].join(','))].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `asistencia_${s.id.slice(0, 16).replace(/[:T]/g, '-')}.csv`;
  a.click();
}
export async function syncToGoogleSheets(sessionId, scriptUrl) {
  const s = await getSession(sessionId), rows = await buildRows(s);
  const r = await fetch(scriptUrl, { // text/plain => sin preflight CORS
    method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ sessionId: s.id, fecha: s.fecha, clave: s.clave, rows }),
  });
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || 'Error en Apps Script');
  s.sincronizado = true; await saveSession(s);
  return j.rows;
}
