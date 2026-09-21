// Reproductor propio para los vídeos de R2 (18/09/2026).
// Clic en el vídeo para reproducir o pausar: desde el 21/09/2026 no hay botón de play en los
// controles, porque el clic en el vídeo ya hace las dos cosas (Adrián). La línea, pegada al borde
// de abajo, sirve para saltar (clic o arrastrando, y con las flechas del teclado si tiene el foco).
// Los vídeos suenan siempre: no hay forma de quitarles el sonido (Adrián, 21/09/2026: esto es un
// portfolio de sonido, quitar el audio no tiene sentido). Solo suena un vídeo a la vez.
// Los controles solo salen mientras el vídeo se reproduce: con el vídeo parado se ve solo el
// triángulo del centro, y al pararlo se esconden hasta que se le vuelve a dar al play
// (Adrián, 20/09/2026). Mientras se reproduce, con ratón se ven con el ratón encima del vídeo y se
// esconden si el ratón no se mueve; vuelven al moverlo. En el móvil se ven al tocar.
// La barra espaciadora reproduce o pausa el vídeo que suena, o el último usado, o el más visible.
(function () {
  const reproductores = [...document.querySelectorAll("[data-reproductor]")];
  const SALTO = 5;         // segundos con las flechas del teclado
  const ESPERA = 2000;     // ms sin mover el ratón hasta que se esconden los controles
  const conRaton = matchMedia("(hover: hover)").matches;
  const alternadores = new Map();
  let ultimo = null;

  const minutos = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  reproductores.forEach((r) => {
    const video = r.querySelector("video");
    const pantalla = r.querySelector(".reproductor-pantalla");
    const completa = r.querySelector("[data-pantalla]");
    const linea = r.querySelector("[data-linea]");
    const avance = r.querySelector(".reproductor-avance");
    const cargado = r.querySelector(".reproductor-cargado");
    const duracion = () => video.duration || Number(linea.getAttribute("aria-valuemax")) || 1;
    let temporizador;
    let encima = false;
    let empezado = false;   // sin darle al play no se enseña la barra (Adrián, 20/09/2026)
    r.classList.add("es-oculto");

    // La línea es lo único que cuenta por dónde va el vídeo: el tiempo en números se quitó el
    // 21/09/2026 (Adrián). En el lector de pantalla sí sigue leyéndose, en `aria-valuetext`.
    function pintarTiempo() {
      const t = video.currentTime;
      avance.style.width = `${Math.min(100, (t / duracion()) * 100)}%`;
      linea.setAttribute("aria-valuenow", Math.floor(t));
      linea.setAttribute("aria-valuetext", `${minutos(t)} of ${minutos(duracion())}`);
    }

    function pintarCargado() {
      const b = video.buffered;
      if (b.length) cargado.style.width = `${(b.end(b.length - 1) / duracion()) * 100}%`;
    }

    // Mientras suena, la línea se repinta en cada fotograma (timeupdate solo llega unas 4 veces por segundo).
    function bucle() {
      pintarTiempo();
      if (!video.paused) requestAnimationFrame(bucle);
    }

    // `forzar` es para el teclado: si alguien llega a los controles con el tabulador, se ven
    // aunque el vídeo no haya empezado.
    function mostrar(forzar) {
      if (!empezado && !forzar) return;
      r.classList.remove("es-oculto");
      clearTimeout(temporizador);
      if (!video.paused) temporizador = setTimeout(esconder, ESPERA);
    }
    // No se esconden si se está usando el teclado dentro del reproductor (foco visible);
    // después de un clic con el ratón, sí.
    function esconder() {
      if (!r.querySelector(":focus-visible")) r.classList.add("es-oculto");
    }

    function alternar() {
      ultimo = r;
      if (video.paused) {
        reproductores.forEach((otro) => otro !== r && otro.querySelector("video").pause());
        video.play();
      } else {
        video.pause();
      }
    }

    video.addEventListener("play", () => {
      empezado = true;
      r.classList.add("es-reproduciendo");
      if (encima || !conRaton) mostrar();
      bucle();
    });
    // Al parar (o al acabar) vuelve el círculo del centro y la barra se esconde: para que vuelva
    // a salir hay que darle otra vez al play (Adrián, 20/09/2026). Si alguien está usando el
    // teclado dentro del reproductor, la barra se queda (lo comprueba `esconder`).
    function parado() {
      empezado = false;
      r.classList.remove("es-reproduciendo");
      clearTimeout(temporizador);
      esconder();
      pintarTiempo();
    }
    video.addEventListener("pause", parado);
    video.addEventListener("ended", parado);
    video.addEventListener("seeked", pintarTiempo);
    video.addEventListener("progress", pintarCargado);

    video.addEventListener("click", alternar);

    function entrar(e) {
      if (e.pointerType === "mouse") { encima = true; ultimo = r; }
      mostrar();
    }
    pantalla.addEventListener("pointerenter", entrar);
    pantalla.addEventListener("pointermove", entrar);
    pantalla.addEventListener("pointerdown", entrar);
    pantalla.addEventListener("pointerleave", (e) => {
      if (e.pointerType !== "mouse") return;
      encima = false;
      clearTimeout(temporizador);
      esconder();
    });
    // Al pulsar un botón con el ratón no se queda seleccionado, así la barra espaciadora sigue
    // yendo al vídeo en vez de volver a pulsar ese botón. Con el teclado se seleccionan como siempre.
    r.querySelectorAll("button, [data-linea]").forEach((b) =>
      b.addEventListener("mousedown", (e) => e.preventDefault())
    );
    alternadores.set(r, alternar);
    r.addEventListener("focusin", () => mostrar(true));

    // Pantalla completa con los mismos controles; en el iPhone, la del sistema.
    completa.addEventListener("click", () => {
      const dentro = document.fullscreenElement || document.webkitFullscreenElement;
      if (dentro) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      else if (pantalla.requestFullscreen) pantalla.requestFullscreen();
      else if (pantalla.webkitRequestFullscreen) pantalla.webkitRequestFullscreen();
      else if (video.webkitEnterFullscreen) video.webkitEnterFullscreen();
    });

    // Saltar: clic o arrastre sobre la línea.
    function saltarA(e) {
      const caja = linea.getBoundingClientRect();
      const x = Math.min(1, Math.max(0, (e.clientX - caja.left) / caja.width));
      video.currentTime = x * duracion();
      pintarTiempo();
    }
    linea.addEventListener("pointerdown", (e) => {
      linea.setPointerCapture(e.pointerId);
      saltarA(e);
    });
    linea.addEventListener("pointermove", (e) => {
      if (linea.hasPointerCapture(e.pointerId)) saltarA(e);
    });

    // Con el foco en la línea, las flechas saltan dentro del vídeo en vez de cambiar de proyecto.
    linea.addEventListener("keydown", (e) => {
      const paso = { ArrowLeft: -SALTO, ArrowRight: SALTO }[e.key];
      if (!paso) return;
      e.preventDefault();
      e.stopPropagation();
      video.currentTime = Math.min(duracion(), Math.max(0, video.currentTime + paso));
      pintarTiempo();
    });
  });

  // Parte del reproductor que se ve en pantalla, de 0 a 1.
  function visible(r) {
    const c = r.getBoundingClientRect();
    const alto = Math.min(c.bottom, innerHeight) - Math.max(c.top, 0);
    return Math.max(0, alto) / (c.height || 1);
  }

  document.addEventListener("keydown", (e) => {
    if ((e.key !== " " && e.code !== "Space") || e.altKey || e.metaKey || e.ctrlKey || e.repeat) return;
    // Con un botón o un enlace seleccionado (teclado), la barra espaciadora hace lo suyo.
    if (e.target.closest("button, a, input, textarea, select, [contenteditable]")) return;
    const r =
      e.target.closest("[data-reproductor]") ||
      reproductores.find((x) => !x.querySelector("video").paused) ||
      (ultimo && visible(ultimo) > 0 ? ultimo : null) ||
      reproductores.filter((x) => visible(x) > 0).sort((a, b) => visible(b) - visible(a))[0];
    if (!r) return;
    e.preventDefault(); // si no, la página baja
    alternadores.get(r)();
  });
})();
