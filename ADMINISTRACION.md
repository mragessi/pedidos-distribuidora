# Guía de administración

Esta guía es para quien administra la app (instalación, actualización semanal y mantenimiento). Las instrucciones para hacer un pedido están en el [README](README.md).

## Qué obtiene quien administra

Cada vez que alguien envía o modifica su pedido, se actualizan automáticamente en una carpeta de tu Drive llamada **«Pedidos distribuidora»**:

| Archivo | Contenido |
|---|---|
| `pedidoCompleto_AAAA-MM-DD.csv` | Todos los pedidos enviados ese día, sumados por producto (cantidad, precio unitario, subtotal y total). Es el que se manda a la distribuidora. |
| `pedido_Apellido.csv` | El último pedido de esa persona, con su detalle y subtotal. Uno por persona (si dos comparten apellido, el segundo se llama `pedido_Apellido_Nombre.csv`). |

La fecha del archivo completo es **el día en que se envía el pedido**. Si alguien modifica su pedido otro día, pasa al archivo de ese día y el del día anterior se rehace sin él.

En la pestaña **«3 · Pedido total»** de la app se ve lo mismo en pantalla (total y detalle por persona), con botones para copiar el pedido, enviarlo por WhatsApp, descargarlo en CSV, imprimirlo y abrir la carpeta de Drive. Desde ahí también se puede quitar el pedido de una persona (se borra su CSV y se rehace el completo).

La hoja de Google conserva el historial (pestaña `Pedidos`) y cuenta los dispositivos que usaron la app (pestaña `Usuarios`, también visible al pie de la app).

> Los CSV usan `;` como separador y coma decimal, para que se abran bien en Excel y Google Sheets en español.

## Instalar el script de Google (una sola vez)

Los nombres de menú están en inglés, como en tu cuenta.

1. Creá una hoja de cálculo nueva en [sheets.new](https://sheets.new) con el nombre «Pedidos distribuidora».
2. Menú **Extensions → Apps Script**. Borrá el contenido y pegá todo el archivo `apps-script/Code.gs`. Guardá.
3. Elegí la función **`configurar`** en la barra superior y tocá **Run**. Google pide permisos (hojas de cálculo y Drive): tocá **Review permissions**, elegí tu cuenta y, si aparece «Google hasn't verified this app», entrá en **Advanced → Go to (proyecto) (unsafe)**. **Marcá todas las casillas** de permisos y aceptá. Esto crea las pestañas y la carpeta de Drive.
4. **Deploy → New deployment → ⚙ → Web app**:
   - *Execute as*: **Me**
   - *Who has access*: **Anyone** (necesario para que tus compañeros/as puedan enviar sin iniciar sesión)
   - Tocá **Deploy** y copiá la **Web app URL** (termina en `/exec`).
5. Pegá esa URL en `config.js`, en `servidor.url`, y subí el cambio a GitHub.
6. *(Opcional)* **Clave del equipo**: en Apps Script, ⚙ **Project Settings → Script Properties → Add script property**: nombre `CLAVE`, valor la palabra que quieras. Se aplica enseguida, sin volver a implementar. La app la pide una vez por dispositivo. Para cambiarla (y dejar sin acceso a quien la tenía), cambiá el valor.

Si más adelante modificás `Code.gs` o cambiás permisos, hay que volver a implementar: **Deploy → Manage deployments → ✏ → Version: New version → Deploy**. La URL no cambia.

### Si no instalás el script

Dejá `servidor.url` vacío: la app funciona igual, pero cada persona tiene que mandarte su pedido como enlace (botón de WhatsApp al enviar). Al abrir el enlace, el pedido se importa en tu pestaña «Pedido total». En este modo no se generan los CSV automáticos, aunque podés descargarlos desde la pestaña 3.

## Actualizar la lista cada lunes

1. Guardá el PDF nuevo en la carpeta del repositorio (no lo subas a GitHub si no querés que sea público).
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
5. Subí `catalogo.js` a GitHub (desde la web: **Add file → Upload files**, o con `git add catalogo.js && git commit -m "Lista 09/11" && git push`).

`--fecha` identifica la lista: un pedido queda asociado a la lista con la que se hizo.

La lista del 02/11/2026 se cargó con **654 productos**. Las promociones de esa semana (-8%) se aplicaron a: fruta escurrida común x 10 kg, fruta escurrida x 5 kg, esencia de vainilla 110 cc y agua de azahar 110 ml. La fruta escurrida «especial» x 10 kg figura en la promo pero la lista no publica su precio con descuento, por eso queda con el precio de lista.

## Publicar y actualizar en GitHub Pages

**Desde el navegador (sin Terminal):**
1. Creá un repositorio público en [github.com/new](https://github.com/new) llamado `pedidos-distribuidora`, sin README.
2. Tocá **uploading an existing file**, arrastrá el contenido de la carpeta (`index.html`, `catalogo.js`, `config.js`, `README.md`, `ADMINISTRACION.md` y las carpetas `apps-script` y `tools`) y tocá **Commit changes**.
3. **Settings → Pages → Build and deployment → Source: Deploy from a branch → main / (root) → Save**.
4. En 2 o 3 minutos queda en `https://TU_USUARIO.github.io/pedidos-distribuidora/`.

Para actualizar un archivo: **Add file → Upload files** con el mismo nombre, o abrirlo en GitHub y tocar el lápiz ✏. Después de un cambio, la página tarda 1 o 2 minutos en reflejarlo; recargá con ⌘⇧R.

**Desde la Terminal** (requiere iniciar sesión en GitHub con token o con `gh auth login`):

```bash
cd ~/Documents/GitHub/pedidos-distribuidora
git init && git add . && git commit -m "App de pedidos"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/pedidos-distribuidora.git
git push -u origin main
```

## Solución de problemas

La app muestra un «Detalle técnico» cuando falla el envío:

- **«No cuentas con el permiso para llamar a SpreadsheetApp…» / permisos de Drive**: el script no tiene todos los permisos. Ejecutá `configurar` de nuevo marcando **todas** las casillas; si no pide nada, quitá el acceso en [myaccount.google.com/connections](https://myaccount.google.com/connections), volvé a ejecutar `configurar` y hacé **Deploy → Manage deployments → ✏ → New version → Deploy**.
- **«Failed to fetch»**: el navegador no llega al script. Verificá que la URL de `config.js` termine en `/exec`, que *Who has access* sea **Anyone** y probá en una ventana de incógnito (descarta extensiones).
- **«Respuesta inesperada del script…»**: el script devolvió una página en lugar de datos (suele ser un tema de permisos o de acceso); el texto que sigue indica cuál.
- **La app dice que la clave no es correcta**: la clave del equipo cambió o se escribió mal; se vuelve a pedir al recargar.
- **Una prueba rápida del script**: pegá la URL `/exec` en el navegador; debe mostrar `{"ok":false,"error":"accion desconocida"}`.

## Privacidad y límites

- El repositorio es público: el código y la lista de precios los puede ver cualquiera. **Los pedidos no están en GitHub**, están en tu cuenta de Google.
- La URL del script está en `config.js` (público). Quien la tenga puede enviar pedidos y, sin clave, leerlos. Para un grupo de trabajo chico alcanza; usá la clave del equipo como barrera mínima. No es seguridad fuerte: es una clave compartida.
- El contador cuenta **dispositivos/navegadores** distintos, no personas (una persona con celular y computadora suma dos).
- Los precios de cada pedido los calcula la página con la lista vigente; el script no los recalcula.

## Estructura

- `index.html`: la app (HTML, CSS y JS en un solo archivo).
- `catalogo.js`: productos y precios de la semana (se regenera con el script de Python).
- `config.js`: título y URL del script de Google.
- `apps-script/Code.gs`: servidor (Google Apps Script) que guarda pedidos, genera los CSV y cuenta usuarios.
- `tools/pdf_a_catalogo.py`: convierte el PDF de la distribuidora en `catalogo.js`.
