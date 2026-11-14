/**
 * ASISTENCIA ACÚSTICA - backend en Google Apps Script.
 * USO: pegá este archivo en https://script.google.com (Proyecto nuevo),
 * elegí la función "setup" arriba y tocá ▶ Ejecutar (aceptá los permisos).
 * Crea sola la planilla y las hojas. Después: Implementar > Nueva implementación
 * > Aplicación web > Ejecutar como "Yo" / Acceso "Cualquier usuario" > Implementar,
 * y pegá la URL /exec en la app (Anfitrión > Padrón y Google Sheets).
 */
const PADRON = 'Padron', ASIST = 'Asistencia', RESUMEN = 'Resumen';
const HEAD = ['Fecha', 'SesionID', 'ID', 'Nombre', 'Codigo', 'Estado'];

function setup() {
  const ss = ss_(true);
  let p = ss.getSheetByName(PADRON);
  if (!p) {
    p = ss.insertSheet(PADRON);
    p.appendRow(['ID', 'Nombre', 'Codigo']);
    for (let i = 1; i <= 20; i++) p.appendRow([i, 'Alumno ' + ('0' + i).slice(-2), 'A' + (100 + i)]); // ejemplo: reemplazalo
    p.setFrozenRows(1); p.getRange('A1:C1').setFontWeight('bold').setBackground('#d9ead3');
    p.setColumnWidth(2, 200);
  }
  let a = ss.getSheetByName(ASIST);
  if (!a) {
    a = ss.insertSheet(ASIST);
    a.appendRow(HEAD); a.setFrozenRows(1);
    a.getRange('A1:F1').setFontWeight('bold').setBackground('#cfe2f3');
    const rng = a.getRange('F2:F5000');
    a.setConditionalFormatRules([
      SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Presente').setBackground('#b6d7a8').setRanges([rng]).build(),
      SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Ausente').setBackground('#f4cccc').setRanges([rng]).build(),
    ]);
  }
  let r = ss.getSheetByName(RESUMEN);
  if (!r) {
    r = ss.insertSheet(RESUMEN);
    r.appendRow(['ID', 'Nombre', 'Clases', 'Presentes', '% Asistencia']);
    const f = [];
    for (let i = 2; i <= 65; i++) f.push([
      `=IF(Padron!A${i}="","",Padron!A${i})`,
      `=IF(A${i}="","",Padron!B${i})`,
      `=IF(A${i}="","",COUNTIF(Asistencia!C:C,A${i}))`,
      `=IF(A${i}="","",COUNTIFS(Asistencia!C:C,A${i},Asistencia!F:F,"Presente"))`,
      `=IF(OR(A${i}="",C${i}=0),"",D${i}/C${i})`]);
    r.getRange(2, 1, f.length, 5).setFormulas(f);
    r.getRange('E2:E65').setNumberFormat('0%');
    r.setFrozenRows(1); r.getRange('A1:E1').setFontWeight('bold').setBackground('#fff2cc');
  }
  const def = ss.getSheetByName('Hoja 1') || ss.getSheetByName('Sheet1');
  if (def && ss.getSheets().length > 1) ss.deleteSheet(def);
  Logger.log('✅ Planilla lista: ' + ss.getUrl());
  Logger.log('Ahora: Implementar > Nueva implementación > Aplicación web (acceso: Cualquier usuario).');
}

// Ejecutalo después de implementar para ver la URL que va en la app.
function mostrarUrl() {
  Logger.log('URL para la app: ' + ScriptApp.getService().getUrl());
}

// Planilla: la vinculada, o la que crea setup() (se guarda el ID).
function ss_(create) {
  const bound = SpreadsheetApp.getActiveSpreadsheet();
  if (bound) return bound;
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty('SS_ID');
  if (id) return SpreadsheetApp.openById(id);
  if (!create) throw new Error('Ejecutá setup() primero');
  const ss = SpreadsheetApp.create('Asistencia Acústica');
  props.setProperty('SS_ID', ss.getId());
  return ss;
}
function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
// GET ?action=roster -> hoja Padron (ID, Nombre, Codigo)
function doGet(e) {
  try {
    const v = ss_().getSheetByName(PADRON).getDataRange().getValues().slice(1).filter(r => r[0] !== '');
    return json_({ ok: true, roster: v.map(r => ({ id: Number(r[0]), nombre: String(r[1]), codigo: String(r[2] || '') })) });
  } catch (err) { return json_({ ok: false, error: String(err) }); }
}
// POST text/plain con JSON {sessionId, fecha, rows:[{id,nombre,codigo,estado}]}
function doPost(e) {
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const d = JSON.parse(e.postData.contents);
    const sh = ss_().getSheetByName(ASIST);
    const last = sh.getLastRow();
    if (last > 1) { // idempotente: reemplaza la sesión si ya existía
      const ids = sh.getRange(2, 2, last - 1, 1).getValues();
      for (let i = ids.length - 1; i >= 0; i--) if (String(ids[i][0]) === d.sessionId) sh.deleteRow(i + 2);
    }
    const out = d.rows.map(r => [d.fecha, d.sessionId, r.id, r.nombre, r.codigo, r.estado]);
    if (out.length) sh.getRange(sh.getLastRow() + 1, 1, out.length, HEAD.length).setValues(out);
    return json_({ ok: true, rows: out.length });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally { lock.releaseLock(); }
}
