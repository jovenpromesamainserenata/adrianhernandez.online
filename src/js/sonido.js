// Hover con sonido en los listados de /audio. La portada tiene el suyo (sonido-portada.js),
// que no reinicia el fragmento y solo sube y baja el volumen.
// No hay interruptor: esto es un portfolio de sonido, así que suena siempre (Adrián, 21/09/2026,
// al quitar el botón "Sound on/off" de toda la web). Los navegadores no dejan sonar nada hasta que
// la persona hace un clic: normalmente ya lo ha hecho en el captcha de la portada, y si entra
// directa a un listado por un enlace, el primer clic o la primera tecla lo desbloquean.
//
// Suena con Web Audio y no con un <audio> (23/09/2026): en Safari el <audio> tardaba en arrancar
// en cada hover, porque tiene que pedir el archivo y llenar su búfer antes de sonar. Aquí los
// fragmentos se descargan todos al cargar la página, uno detrás de otro, y se guardan en memoria;
// al pasar el ratón solo hay que descomprimir el que toca, que es casi instantáneo. Los últimos
// descomprimidos se guardan también (no todos: descomprimido, cada fragmento ocupa unos 10 MB).
(function () {
  if (!matchMedia("(hover: hover)").matches) return;

  const filas = document.querySelectorAll("[data-preview]");
  if (!filas.length) return;

  const Contexto = window.AudioContext || window.webkitAudioContext;
  if (!Contexto) return;

  // Un solo AudioContext para toda la visita, compartido con la portada (sonido-portada.js):
  // con la navegación sin recarga (navegacion.js) sigue vivo de una página a otra, y así el
  // permiso para sonar que dio el primer clic no se pierde.
  const ctx = (window.__audio ||= new Contexto());

  // Se conservan entre páginas: al volver a un listado ya está todo descargado.
  const descargas = (window.__fragmentos ||= new Map());      // url → promesa del mp3 comprimido
  const descomprimidos = (window.__fragmentosListos ||= new Map()); // url → promesa del sonido listo
  const GUARDADOS = 6;

  const url = (fila) => new URL(fila.dataset.preview, location.href).href;

  function descargar(direccion) {
    if (!descargas.has(direccion)) {
      const promesa = fetch(direccion).then((r) => {
        if (!r.ok) throw new Error(r.status);
        return r.arrayBuffer();
      });
      promesa.catch(() => descargas.delete(direccion));
      descargas.set(direccion, promesa);
    }
    return descargas.get(direccion);
  }

  function descomprimir(direccion) {
    if (descomprimidos.has(direccion)) {
      // Se vuelve a poner al final: es el más reciente.
      const listo = descomprimidos.get(direccion);
      descomprimidos.delete(direccion);
      descomprimidos.set(direccion, listo);
      return listo;
    }
    // decodeAudioData se queda el archivo que recibe: se le pasa una copia.
    const listo = descargar(direccion).then((datos) => new Promise((ok, mal) => ctx.decodeAudioData(datos.slice(0), ok, mal)));
    listo.catch(() => descomprimidos.delete(direccion));
    descomprimidos.set(direccion, listo);
    while (descomprimidos.size > GUARDADOS) descomprimidos.delete(descomprimidos.keys().next().value);
    return listo;
  }

  let filaActual = null;
  let fuente = null;
  let turno = 0;   // para que un fragmento que tarda no suene si el ratón ya se ha ido

  function parar() {
    turno++;
    if (!fuente) return;
    try { fuente.stop(); } catch {}
    fuente.disconnect();
    fuente = null;
  }

  async function sonar(fila) {
    if (!fila) return;
    const mio = ++turno;
    let buffer;
    try {
      buffer = await descomprimir(url(fila));
    } catch {
      return;
    }
    if (mio !== turno) return;
    // Si el navegador todavía no deja sonar, el contexto sigue parado y el fragmento arranca en
    // cuanto se desbloquee (con el primer clic o tecla, ver `desbloquear`).
    if (ctx.state !== "running") ctx.resume().catch(() => {});
    fuente = ctx.createBufferSource();
    fuente.buffer = buffer;
    fuente.connect(ctx.destination);
    fuente.start();
  }

  function desbloquear() {
    if (ctx.state !== "running") ctx.resume().catch(() => {});
  }

  function alPasar(e) {
    const fila = e.target.closest("[data-preview]");
    if (fila === filaActual) return;
    filaActual = fila;
    parar();
    sonar(fila);
  }
  function alSalir() {
    filaActual = null;
    parar();
  }

  addEventListener("pointerdown", desbloquear);
  addEventListener("keydown", desbloquear);
  document.addEventListener("mouseover", alPasar);

  // Al llegar sin recargar (navegacion.js) con el ratón ya encima de una fila, el navegador no
  // avisa hasta que el ratón se mueve: se mira aquí.
  requestAnimationFrame(() => {
    const fila = document.querySelector("[data-preview]:hover");
    if (fila && !filaActual) {
      filaActual = fila;
      sonar(fila);
    }
  });
  document.documentElement.addEventListener("mouseleave", alSalir);

  // Descarga de todos los fragmentos de la página, de uno en uno, cuando el navegador está libre.
  let seguir = true;
  async function precargar() {
    const direcciones = [...new Set(Array.from(filas, url))];
    for (const d of direcciones) {
      if (!seguir) return;
      try { await descargar(d); } catch {}
    }
  }
  const empezar = () => (window.requestIdleCallback || setTimeout)(precargar);
  if (document.readyState === "complete") empezar();
  else addEventListener("load", empezar, { once: true });

  // Al irse de la página (navegacion.js) se para el sonido y se quitan los oyentes.
  (window.__limpiezas ||= []).push(function () {
    seguir = false;
    filaActual = null;
    parar();
    removeEventListener("pointerdown", desbloquear);
    removeEventListener("keydown", desbloquear);
    removeEventListener("load", empezar);
    document.removeEventListener("mouseover", alPasar);
    document.documentElement.removeEventListener("mouseleave", alSalir);
  });
})();
