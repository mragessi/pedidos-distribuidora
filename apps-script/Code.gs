/**
 * Servidor de la app de pedidos (Google Apps Script).
 *
 * Qué hace:
 *  - Recibe los pedidos que envía la página y los guarda en la hoja «Pedidos».
 *  - Mantiene en una carpeta de tu Drive:
 *      pedidoCompleto_AAAA-MM-DD.csv   -> todos los pedidos enviados ese día, sumados por producto
 *      pedido_Apellido.csv             -> el último pedido de cada persona (uno por persona)
 *  - Cuenta los dispositivos que abrieron la app (hoja «Usuarios»).
 *
 * Instalación: ver README, sección «Instalar el script de Google».
 */

var TZ = 'America/Argentina/Cordoba';
var NOMBRE_CARPETA = 'Pedidos distribuidora';
var MAX_LINEAS = 300;

/* ---------- entrada web ---------- */

function doPost(e) {
  return responder_(function () { return manejar_(JSON.parse(e.postData.contents)); });
}

function doGet(e) {
  return responder_(function () { return manejar_(e.parameter || {}); });
}

function responder_(fn) {
  var salida;
  try { salida = fn(); } catch (err) { salida = { ok: false, error: String(err && err.message || err) }; }
  return ContentService.createTextOutput(JSON.stringify(salida)).setMimeType(ContentService.MimeType.JSON);
}

function manejar_(d) {
  var clave = PropertiesService.getScriptProperties().getProperty('CLAVE');
  if (clave && String(d.clave || '') !== String(clave)) return { ok: false, error: 'clave' };

  var lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    switch (d.accion) {
      case 'visita':   return visita_(d);
      case 'contador': return { ok: true, usuarios: contarUsuarios_() };
      case 'guardar':  return guardar_(d);
      case 'listar':   return listar_(d);
      case 'borrar':   return borrar_(d);
      default:         return { ok: false, error: 'accion desconocida' };
    }
  } finally {
    lock.releaseLock();
  }
}

/* ---------- configuración inicial (ejecutar una vez desde el editor) ---------- */

function configurar() {
  hojaPedidos_(); hojaPersonas_(); hojaUsuarios_();
  var carpeta = carpeta_();
  Logger.log('Listo. Carpeta de Drive: ' + carpeta.getUrl());
}

/* ---------- acciones ---------- */

function visita_(d) {
  var dev = String(d.dev || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 40);
  if (dev) {
    var hoja = hojaUsuarios_();
    var filas = hoja.getDataRange().getDisplayValues();
    var existe = false;
    for (var i = 1; i < filas.length; i++) { if (filas[i][0] === dev) { existe = true; break; } }
    if (!existe) hoja.appendRow([dev, ahora_('yyyy-MM-dd HH:mm')]);
  }
  return { ok: true, usuarios: contarUsuarios_() };
}

function guardar_(d) {
  var ape = limpiar_(d.apellido), nom = limpiar_(d.nombre);
  if (!ape || !nom) throw new Error('Falta el apellido o el nombre.');
  var lineas = validarLineas_(d.lineas);
  if (!lineas.length) throw new Error('El pedido está vacío.');
  var lista = String(d.lista || '').replace(/[^0-9\-]/g, '').slice(0, 10);
  if (!lista) throw new Error('Falta la fecha de la lista.');

  var json = JSON.stringify(lineas);
  if (json.length > 45000) throw new Error('El pedido es demasiado grande.');
  var total = redondear_(lineas.reduce(function (s, l) { return s + l.q * l.p; }, 0));
  var hoy = ahora_('yyyy-MM-dd'), hora = ahora_('HH:mm');
  var k = clavePersona_(ape, nom);
  var archivo = archivoPersona_(k, ape, nom);

  var hoja = hojaPedidos_();
  var filas = hoja.getDataRange().getDisplayValues();
  var fila = -1, fechaAnterior = '';
  for (var i = 1; i < filas.length; i++) {
    if (filas[i][0] === k && filas[i][3] === lista) { fila = i + 1; fechaAnterior = filas[i][4]; break; }
  }
  var datos = [k, ape, nom, lista, hoy, hora, total, archivo, json];
  if (fila > 0) hoja.getRange(fila, 1, 1, datos.length).setValues([datos]);
  else hoja.appendRow(datos);

  escribirArchivo_(archivo, csvPersona_(ape, nom, lista, hoy, lineas, total));
  regenerarCompleto_(hoy);
  if (fechaAnterior && fechaAnterior !== hoy) regenerarCompleto_(fechaAnterior);

  return { ok: true, k: k, archivoPersona: archivo, archivoGeneral: 'pedidoCompleto_' + hoy + '.csv',
           fecha: hoy, total: total, carpetaUrl: carpeta_().getUrl() };
}

function listar_(d) {
  var lista = String(d.lista || '');
  var filas = hojaPedidos_().getDataRange().getDisplayValues();
  var pedidos = [];
  for (var i = 1; i < filas.length; i++) {
    if (filas[i][3] !== lista) continue;
    var lineas = [];
    try { lineas = JSON.parse(filas[i][8]); } catch (e) {}
    var items = {};
    lineas.forEach(function (l) { items[l.id] = l.q; });
    pedidos.push({ k: filas[i][0], a: filas[i][1], m: filas[i][2], f: filas[i][4], i: items });
  }
  return { ok: true, pedidos: pedidos, carpetaUrl: carpeta_().getUrl() };
}

function borrar_(d) {
  var k = String(d.k || ''), lista = String(d.lista || '');
  var hoja = hojaPedidos_();
  var filas = hoja.getDataRange().getDisplayValues();
  for (var i = 1; i < filas.length; i++) {
    if (filas[i][0] === k && filas[i][3] === lista) {
      var fecha = filas[i][4], archivo = filas[i][7];
      hoja.deleteRow(i + 1);
      var it = carpeta_().getFilesByName(archivo);
      while (it.hasNext()) it.next().setTrashed(true);
      regenerarCompleto_(fecha);
      return { ok: true };
    }
  }
  return { ok: true };
}

/* ---------- archivos CSV ---------- */

function regenerarCompleto_(fecha) {
  var filas = hojaPedidos_().getDataRange().getDisplayValues();
  var acum = {}, orden = [];
  for (var i = 1; i < filas.length; i++) {
    if (filas[i][4] !== fecha) continue;
    var lineas = [];
    try { lineas = JSON.parse(filas[i][8]); } catch (e) {}
    lineas.forEach(function (l) {
      var id = l.id || (l.c + '|' + l.n);
      if (!acum[id]) { acum[id] = { c: l.c, s: l.s, n: l.n, o: l.o, p: l.p, q: 0 }; orden.push(id); }
      acum[id].q += l.q; acum[id].p = l.p;
    });
  }
  orden.sort(function (a, b) { return (acum[a].o || 0) - (acum[b].o || 0); });
  var salida = [['Categoria', 'Producto', 'Cantidad', 'Precio unitario', 'Subtotal']], total = 0;
  orden.forEach(function (id) {
    var l = acum[id], sub = redondear_(l.q * l.p);
    total += sub;
    salida.push([l.c, l.n, l.q, num_(l.p), num_(sub)]);
  });
  salida.push(['', 'TOTAL', '', '', num_(redondear_(total))]);
  escribirArchivo_('pedidoCompleto_' + fecha + '.csv', csv_(salida));
}

function csvPersona_(ape, nom, lista, fecha, lineas, total) {
  var f = [['Apellido', ape], ['Nombre', nom], ['Lista de precios', lista], ['Fecha del pedido', fecha], [],
           ['Categoria', 'Producto', 'Cantidad', 'Precio unitario', 'Subtotal']];
  lineas.slice().sort(function (a, b) { return (a.o || 0) - (b.o || 0); }).forEach(function (l) {
    f.push([l.c, l.n, l.q, num_(l.p), num_(redondear_(l.q * l.p))]);
  });
  f.push(['', 'TOTAL', '', '', num_(total)]);
  return csv_(f);
}

function escribirArchivo_(nombre, contenido) {
  var carpeta = carpeta_(), it = carpeta.getFilesByName(nombre);
  if (it.hasNext()) it.next().setContent(contenido);
  else carpeta.createFile(nombre, contenido, MimeType.CSV);
}

function csv_(filas) {
  return '﻿' + filas.map(function (f) {
    return f.map(function (c) {
      c = String(c);
      return /[;"\n\r]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c;
    }).join(';');
  }).join('\r\n');
}

/* ---------- personas y nombres de archivo ---------- */

function archivoPersona_(k, ape, nom) {
  var hoja = hojaPersonas_();
  var filas = hoja.getDataRange().getDisplayValues();
  var usados = {};
  for (var i = 1; i < filas.length; i++) {
    if (filas[i][0] === k) return filas[i][3];
    usados[filas[i][3]] = true;
  }
  var base = 'pedido_' + seguro_(ape), nombre = base + '.csv';
  if (usados[nombre]) nombre = base + '_' + seguro_(nom) + '.csv';
  var n = 2;
  while (usados[nombre]) { nombre = base + '_' + seguro_(nom) + '_' + n + '.csv'; n++; }
  hoja.appendRow([k, ape, nom, nombre]);
  return nombre;
}

/* ---------- utilidades ---------- */

function limpiar_(s) {
  return String(s == null ? '' : s).replace(/[\u0000-\u001f<>\/\\]/g, '').replace(/\s+/g, ' ').trim().replace(/^[=+\-@]+/, '').trim().slice(0, 40);  // sin fórmulas (=, +, -, @) al inicio
}
function sinTildes_(s) { return String(s).normalize('NFD').replace(/[̀-ͯ]/g, ''); }
function seguro_(s) { return sinTildes_(s).replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'sin_nombre'; }
function clavePersona_(ape, nom) { return sinTildes_(ape).toLowerCase() + '|' + sinTildes_(nom).toLowerCase(); }
function redondear_(n) { return Math.round(n * 100) / 100; }
function num_(n) { return Number(n).toFixed(2).replace('.', ','); }
function ahora_(fmt) { return Utilities.formatDate(new Date(), TZ, fmt); }

function validarLineas_(lineas) {
  if (!Array.isArray(lineas)) return [];
  if (lineas.length > MAX_LINEAS) throw new Error('Demasiados productos en un pedido.');
  var out = [];
  lineas.forEach(function (l) {
    var q = parseInt(l.q, 10), p = Number(l.p);
    if (!(q > 0) || !isFinite(p) || p < 0 || p > 1e9) return;
    out.push({ id: String(l.id || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 20),
               c: String(l.c || '').replace(/[\u0000-\u001f]/g, '').slice(0, 60),
               s: String(l.s || '').replace(/[\u0000-\u001f]/g, '').slice(0, 60),
               n: String(l.n || '').replace(/[\u0000-\u001f]/g, '').slice(0, 120),
               o: parseInt(l.o, 10) || 0, q: Math.min(q, 9999), p: redondear_(p) });
  });
  return out;
}

function contarUsuarios_() { return Math.max(0, hojaUsuarios_().getLastRow() - 1); }

/* ---------- hojas y carpeta ---------- */

function hoja_(nombre, encabezado) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var h = ss.getSheetByName(nombre);
  if (!h) {
    h = ss.insertSheet(nombre);
    h.getRange(1, 1, 1, encabezado.length).setValues([encabezado]);
    h.setFrozenRows && h.setFrozenRows(1);
    // columnas de texto para que Google Sheets no convierta fechas ni códigos
    h.getRange(1, 1, 1000, encabezado.length).setNumberFormat('@');
  }
  return h;
}
function hojaPedidos_()  { return hoja_('Pedidos',  ['Clave', 'Apellido', 'Nombre', 'Lista', 'Fecha del pedido', 'Hora', 'Total', 'Archivo', 'Lineas']); }
function hojaPersonas_() { return hoja_('Personas', ['Clave', 'Apellido', 'Nombre', 'Archivo']); }
function hojaUsuarios_() { return hoja_('Usuarios', ['Dispositivo', 'Primera visita']); }

function carpeta_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('CARPETA_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  var it = DriveApp.getFoldersByName(NOMBRE_CARPETA);
  var c = it.hasNext() ? it.next() : DriveApp.createFolder(NOMBRE_CARPETA);
  props.setProperty('CARPETA_ID', c.getId());
  return c;
}
