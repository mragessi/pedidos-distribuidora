#!/usr/bin/env python3
"""Convierte la lista de precios semanal (PDF de la distribuidora) en catalogo.js.

Requisitos: Python 3 y pdftotext/pdfinfo (poppler). En macOS:  brew install poppler

Uso básico (desde la carpeta del repositorio):
  python3 tools/pdf_a_catalogo.py "LISTA DE PRECIOS 09-11-2026.pdf" \
      --fecha 2026-11-09 --titulo "Lista de precios 09/11/2026" \
      --vigencia "Promoción 09/11 al 13/11" \
      --promo "Texto de la promo de la semana" \
      --precio-promo "FRUTA ESCURRIDA x 5Kg=19910,15"

--precio-promo se puede repetir. El nombre tiene que coincidir exacto con el de la lista.
Al terminar revisá el resumen que imprime (cantidad por categoría) contra el PDF.
"""
import argparse, json, re, subprocess, sys, os

PRICE = re.compile(r'^(.*?\S)\s+(\d{1,3}(?:\.\d{3})*,\d{2})(\d*)\s*$')
SECTION = re.compile(r'^(\d{2}) - (.+)$')


def run(cmd):
    return subprocess.run(cmd, check=True, capture_output=True, text=True).stdout


def extraer(pdf):
    info = run(['pdfinfo', pdf])
    paginas = int(re.search(r'Pages:\s+(\d+)', info).group(1))
    m = re.search(r'Page size:\s+([\d.]+) x ([\d.]+)', info)
    ancho, alto = int(float(m.group(1))), int(float(m.group(2)))
    mitad = ancho // 2
    # El PDF fluye por columnas: primero toda la columna izquierda (página 1..N), luego la derecha.
    texto = ''
    for lado in (0, 1):
        texto += '@@STREAM@@\n'
        for p in range(1, paginas + 1):
            texto += run(['pdftotext', '-layout', '-f', str(p), '-l', str(p), '-x', str(lado * mitad),
                          '-y', '0', '-W', str(mitad), '-H', str(alto), pdf, '-'])
    return texto


def parsear(texto):
    items, seccion, sub, iniciado = [], None, '', False
    for raw in texto.splitlines():
        linea = raw.strip()
        if not linea:
            continue
        if linea == '@@STREAM@@':
            iniciado, seccion, sub = False, None, ''
            continue
        m = SECTION.match(linea)
        if m:
            iniciado = True
            nombre = re.sub(r'(?<=[A-ZÉ.])\d$', '', m.group(2).strip())  # saca la llamada al pie (ej. "REPOSTERIA5")
            seccion, sub = f'{m.group(1)} - {nombre}', ''
            continue
        if not iniciado or re.fullmatch(r'\d{1,2}', linea):
            continue
        m = PRICE.match(linea)
        if m:
            precio = float(m.group(2).replace('.', '').replace(',', '.'))  # ignora dígitos sobrantes (ej. 10.820,672)
            items.append({'cat': seccion, 'sub': sub, 'name': m.group(1).strip(), 'price': precio})
        else:
            sub = re.sub(r'(?<=[A-ZÉ])\d$', '', linea)
    return items


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('pdf')
    ap.add_argument('--fecha', required=True, help='AAAA-MM-DD de la lista (identifica la semana)')
    ap.add_argument('--titulo', required=True)
    ap.add_argument('--vigencia', default='')
    ap.add_argument('--promo', default='')
    ap.add_argument('--precio-promo', action='append', default=[], metavar='NOMBRE=PRECIO')
    ap.add_argument('--salida', default=os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'catalogo.js'))
    a = ap.parse_args()

    items = parsear(extraer(a.pdf))
    promos = {}
    for pp in a.precio_promo:
        nombre, _, valor = pp.rpartition('=')
        promos[nombre.strip()] = float(valor.replace('.', '').replace(',', '.'))
    usados = set()
    for it in items:
        if it['name'] in promos:
            it['promo'] = promos[it['name']]
            usados.add(it['name'])
    for faltante in set(promos) - usados:
        print(f'AVISO: no encontré el producto de la promo: {faltante}', file=sys.stderr)

    cat = {'fecha': a.fecha, 'titulo': a.titulo, 'vigencia': a.vigencia, 'promo': a.promo, 'items': items}
    with open(a.salida, 'w', encoding='utf-8') as f:
        f.write('// Generado desde la lista de precios del distribuidor. Se reemplaza cada semana (ver README).\n')
        f.write('window.CATALOGO = ' + json.dumps(cat, ensure_ascii=False, separators=(',', ':')) + ';\n')

    print(f'{len(items)} productos escritos en {os.path.abspath(a.salida)}')
    cuenta = {}
    for it in items:
        cuenta[it['cat']] = cuenta.get(it['cat'], 0) + 1
    for k in sorted(cuenta):
        print(f'  {k}: {cuenta[k]}')


if __name__ == '__main__':
    main()
