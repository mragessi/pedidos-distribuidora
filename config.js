// Configuración de la app. Este archivo es público (está en el repositorio): no pongas contraseñas acá.
window.CONFIG = {
  // Nombre que se muestra arriba de la app.
  titulo: "Pedidos a la distribuidora",

  // SERVIDOR (Google Apps Script en tu cuenta de Google).
  // Pegá acá la URL de la aplicación web que termina en /exec (ver README, «Instalar el script de Google»).
  // Con la URL cargada: los pedidos llegan solos, se guardan en tu hoja de Google, se actualizan los CSV
  // en tu Drive y se cuenta cuántos dispositivos usan la app.
  // Si la dejás vacía, la app funciona igual pero cada persona tiene que mandar su pedido por enlace.
  servidor: {
    url: "https://script.google.com/macros/s/AKfycbxLyh3TfwGVTM3TMTQ90SjA1iQpNieH5LnnMT58N5afEDqh9z6gYwhFJuu7gfUTe7Ly/exec"
  }
};
