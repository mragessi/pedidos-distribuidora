# Pedidos a la distribuidora

Aplicación web para que un grupo de trabajo arme sus pedidos a una distribuidora a partir de la lista de precios semanal. Cada persona elige sus productos y ve el subtotal en pesos; la administración obtiene el pedido total unificado para enviar y facturar.

Funciona desde el celular o la computadora, sin instalar nada. Se publica gratis con GitHub Pages y guarda los pedidos en una hoja y en archivos CSV de **tu propia cuenta de Google**.

## Cómo usarla (para quienes hacen un pedido)

1. Abrí el enlace que te pasó quien administra.
2. En **«1 · Armar pedido»** buscá los productos (por ejemplo «almendra» o «avena») o filtrá por categoría, y elegí cantidades con **+** y **−**. Abajo ves cuánto va sumando tu pedido.
3. En **«2 · Mi pedido»** escribí tu **apellido** y tu **nombre**, revisá el detalle y tocá **Enviar pedido**.
4. Si te equivocás o querés cambiar algo, modificá las cantidades y volvé a tocar **Enviar pedido**: se reemplaza el anterior.

Los precios son los de la lista vigente y pueden variar durante la semana; el total final lo confirma la distribuidora.

## Qué obtiene quien administra

Cada vez que alguien envía o modifica su pedido, se actualizan automáticamente en una carpeta de tu Drive llamada **«Pedidos distribuidora»**:

| Archivo | Contenido |
|---|---|
| `pedidoCompleto_AAAA-MM-DD.csv` | Todos los pedidos enviados ese día, sumados por producto (cantidad, precio unitario, subtotal y total). Es el que se manda a la distribuidora. |
| `pedido_Apellido.csv` | El último pedido de esa persona, con su detalle y subtotal. Uno por persona (si dos comparten apellido, el segundo se llama `pedido_Apellido_Nombre.csv`). |

La fecha del archivo completo es **el día en que se envía el pedido**. Si alguien modifica su pedido otro día, pasa al archivo de ese día y el del día anterior se rehace sin él.

Además, en la pestaña **«3 · Pedido total»** de la app se ve lo mismo en pantalla (total, detalle por persona), con botones para copiar el pedido, enviarlo por WhatsApp, descargarlo en CSV o imprimirlo. Desde ahí también se puede quitar el pedido de una persona.

La hoja de Google conserva todo el historial (pestaña `Pedidos`) y cuenta los dispositivos que usaron la app (pestaña `Usuarios`, también visible al pie de la app).

> Los CSV usan `;` como separador y coma decimal, para que se abran bien en Excel y Google Sheets en español.

## Instalar el script de Google (una sola vez, ~10 minutos)

1. Creá una hoja de cálculo nueva en [sheets.new](https://sheets.new) con el nombre «Pedidos distribuidora».
2. Menú **Extensiones → Apps Script**. Borrá el contenido y pegá todo el archivo `apps-script/Code.gs`. Guardá.
3. Elegí la función **`configurar`** en la barra superior y tocá **Ejecutar**. Google va a pedir permisos (hojas de cálculo y Drive) y puede mostrar un aviso de «app no verificada»: es tu propio script; entrá en *Configuración avanzada → Ir a … (no seguro)* y aceptá. Esto crea las pestañas y la carpeta de Drive.
4. **Implementar → Nueva implementación → ⚙ → Aplicación web**:
   - *Ejecutar como*: **Yo**
   - *Quién tiene acceso*: **Cualquier persona** (necesario para que tus compañeros/as puedan enviar sin iniciar sesión)
   - Tocá **Implementar** y copiá la **URL de la aplicación web** (termina en `/exec`).
5. Pegá esa URL en `config.js`, en `servidor.url`, y subí el cambio a GitHub.
6. *(Opcional)* **Clave del equipo**: en Apps Script, ⚙ **Configuración del proyecto → Propiedades de la secuencia de comandos → Agregar propiedad**: nombre `CLAVE`, valor la palabra que quieras. La app la pedirá una vez en cada dispositivo. Evita el uso accidental por parte de personas ajenas, pero no es una seguridad fuerte (la clave se escribe en cada celular).

Si más adelante modificás `Code.gs`, hay que volver a implementar: **Implementar → Administrar implementaciones → ✏ → Versión: Nueva versión → Implementar**. La URL no cambia.

### Si no instalás el script

Dejá `servidor.url` vacío: la app funciona igual, pero cada persona tiene que mandarte su pedido como enlace (botón de WhatsApp al enviar). Al abrir el enlace, el pedido se importa en tu pestaña «Pedido total». En este modo no se generan los CSV automáticos, aunque podés descargarlos desde la pestaña 3.

## Actualizar la lista cada lunes

1. Guardá el PDF nuevo en la carpeta del repositorio.
2. Instalá poppler una vez (macOS: `brew install poppler`).
3. Ejecutá, ajustando fecha, textos y precios de promo:

```bash
python3 tools/pdf_a_catalogo.py "LISTA DE PRECIOS 09-11-2026.pdf" \
  --fecha 2026-11-09 \
  --titulo "Lista de precios 09/11/2026" \
  --vigencia "Promoción 09/11 al 13/11" \
  --promo "Texto de la promo de la semana" \
  --precio-promo "NOMBRE EXACTO DEL PRODUCTO=19910,15"
```

4. Revisá en la salida la cantidad de productos por categoría contra el PDF.
5. Subí los cambios: `git add catalogo.js && git commit -m "Lista 09/11" && git push`.

`--fecha` identifica la lista: un pedido queda asociado a la lista con la que se hizo.

La lista del 02/11/2026 se cargó con **654 productos**. Las promociones de esa semana (-8%) se aplicaron a: fruta escurrida común x 10 kg, fruta escurrida x 5 kg, esencia de vainilla 110 cc y agua de azahar 110 ml. La fruta escurrida «especial» x 10 kg figura en la promo pero la lista no publica su precio con descuento, por eso queda con el precio de lista.

## Publicar en GitHub Pages

```bash
cd ~/Documents/GitHub/pedidos-distribuidora
git init
git add .
git commit -m "App de pedidos"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/pedidos-distribuidora.git
git push -u origin main
```

En GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch → main / (root)**. En un par de minutos queda en `https://TU_USUARIO.github.io/pedidos-distribuidora/`: ese es el enlace para el equipo.

## Privacidad y límites

- El repositorio es público: el código y la lista de precios los puede ver cualquiera. **Los pedidos no están en GitHub**, están en tu cuenta de Google.
- La URL del script está en `config.js` (público). Quien la tenga puede enviar pedidos y, sin clave, leerlos. Para un grupo de trabajo chico alcanza; usá la clave del equipo si querés una barrera mínima.
- El contador cuenta **dispositivos/navegadores** distintos, no personas (una persona con celular y computadora suma dos).
- Los precios de cada pedido los calcula la página con la lista vigente; el script no los recalcula.

## Estructura

- `index.html`: la app (HTML, CSS y JS en un solo archivo).
- `catalogo.js`: productos y precios de la semana (se regenera con el script de Python).
- `config.js`: título y URL del script de Google.
- `apps-script/Code.gs`: servidor (Google Apps Script) que guarda pedidos, genera los CSV y cuenta usuarios.
- `tools/pdf_a_catalogo.py`: convierte el PDF de la distribuidora en `catalogo.js`.
