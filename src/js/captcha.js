// Captcha falso de la portada.
// No comprueba nada: está para que la persona haga un clic. Los navegadores
// bloquean el sonido hasta que hay un clic, y así el hover de audio de /audio/
// ya puede sonar (desde el 21/09/2026 no hay botón de sonido: suena siempre).
// Solo sale la primera vez de cada visita: al volver a la portada desde dentro
// de la web no vuelve a aparecer.
(function () {
  const captcha = document.querySelector("[data-captcha]");
  if (!captcha) return;

  const raiz = document.documentElement;
  if (raiz.classList.contains("captcha-visto")) {
    captcha.remove();
    return;
  }

  const boton = captcha.querySelector("[data-captcha-boton]");
  const ESPERA_TICK = 600;   // ms que se ve el tick antes de irse
  const DESVANECIDO = 450;   // ms que tarda en irse (igual que en el CSS)

  boton.addEventListener("click", () => {
    if (captcha.classList.contains("captcha-hecho")) return;
    captcha.classList.add("captcha-hecho");
    boton.disabled = true;

    try { sessionStorage.setItem("captcha", "hecho"); } catch {}

    setTimeout(() => {
      captcha.classList.add("captcha-fuera");
      setTimeout(() => {
        raiz.classList.add("captcha-visto");
        captcha.remove();
      }, DESVANECIDO);
    }, ESPERA_TICK);
  });
})();
