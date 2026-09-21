// Hover con sonido en los listados de /audio. La portada tiene el suyo (sonido-portada.js),
// que no reinicia el fragmento y solo sube y baja el volumen.
// No hay interruptor: esto es un portfolio de sonido, así que suena siempre (Adrián, 21/09/2026,
// al quitar el botón "Sound on/off" de toda la web). Los navegadores no dejan sonar nada hasta que
// la persona hace un clic: normalmente ya lo ha hecho en el captcha de la portada, y si entra
// directa a un listado por un enlace, el primer clic o la primera tecla lo desbloquean.
(function () {
  if (!matchMedia("(hover: hover)").matches) return;

  const audio = new Audio();
  audio.preload = "none";
  let filaActual = null;
  let bloqueado = false;

  function parar() {
    audio.pause();
  }
  function sonar(fila) {
    if (!fila) return;
    const src = new URL(fila.dataset.preview, location.href).href;
    if (audio.src !== src) audio.src = src;
    audio.currentTime = 0;
    audio.play().catch(() => {
      // El navegador lo ha bloqueado: hace falta un clic o una tecla en cualquier sitio.
      bloqueado = true;
    });
  }

  function desbloquear() {
    if (!bloqueado) return;
    bloqueado = false;
    sonar(filaActual);
  }
  addEventListener("pointerdown", desbloquear);
  addEventListener("keydown", desbloquear);

  document.addEventListener("mouseover", (e) => {
    const fila = e.target.closest("[data-preview]");
    if (fila === filaActual) return;
    filaActual = fila;
    parar();
    sonar(fila);
  });
  document.documentElement.addEventListener("mouseleave", () => {
    filaActual = null;
    parar();
  });
})();
