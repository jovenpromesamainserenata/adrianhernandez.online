// Hover de las dos mitades de la portada, Audio e Image: cada una con su fragmento.
// A diferencia de los listados (src/js/sonido.js), el fragmento no vuelve a empezar cada vez:
// arranca con el primer hover, va en bucle y el hover solo sube y baja el volumen, de golpe
// (Adrián, 21/09/2026). Al salir se queda unos segundos corriendo en silencio, por si se vuelve
// enseguida, y luego se pausa donde esté: así la pestaña deja de estar marcada como que suena.
//
// Suena con Web Audio y no con un <audio loop>, para que la vuelta del bucle no tenga pausa:
// un mp3 arrastra unas décimas de silencio del codificador al final y el bucle del <audio>
// añade lo suyo. Con el archivo ya descargado en memoria se puede marcar dónde empieza y acaba
// de verdad el sonido (`recorte`) y enlazar ahí, sin hueco. El precio es que la canción entera
// tiene que estar descargada antes de sonar, así que se pide al cargar la página, en cuanto el
// navegador está libre.
(function () {
  if (!matchMedia("(hover: hover)").matches) return;

  const mitades = document.querySelectorAll("[data-audio]");
  if (!mitades.length) return;

  const ESPERA_PAUSA = 5000;  // ms que sigue corriendo en silencio tras salir, antes de pausarse
  const SILENCIO = 0.002;     // por debajo de esto no se considera sonido (unos -54 dB)

  const Contexto = window.AudioContext || window.webkitAudioContext;
  if (!Contexto) return;

  // Un solo AudioContext para toda la visita, compartido con los listados (sonido.js): con la
  // navegación sin recarga (navegacion.js) sigue vivo de una página a otra, así que no se
  // acumulan contextos y el permiso para sonar que dio el primer clic no se pierde.
  const ctx = (window.__audio ||= new Contexto());

  // Primera y última muestra con sonido: es lo que se repite en bucle.
  function recorte(buffer) {
    const canales = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
    const suena = (i) => canales.some((c) => Math.abs(c[i]) > SILENCIO);
    let primera = 0;
    let ultima = buffer.length - 1;
    while (primera < ultima && !suena(primera)) primera++;
    while (ultima > primera && !suena(ultima)) ultima--;
    return { desde: primera / buffer.sampleRate, hasta: (ultima + 1) / buffer.sampleRate };
  }

  function preparar(mitad) {
    const ganancia = ctx.createGain();
    ganancia.gain.value = 0;
    ganancia.connect(ctx.destination);

    let buffer = null;
    let fuente = null;
    let dentro = false;
    let reloj = null;
    let inicio = 0;     // momento del reloj de audio en el que estaría el segundo 0 del bucle
    let posicion = 0;   // por dónde iba la canción cuando se pausó
    let desde = 0;      // primer y último segundo con sonido: lo que se repite
    let hasta = 0;

    // El volumen entra y sale de golpe, en mitad de la onda: el chasquido que eso da es parte
    // de cómo suena el hover (Adrián, 21/09/2026).
    function volumen(valor) {
      ganancia.gain.cancelScheduledValues(ctx.currentTime);
      ganancia.gain.setValueAtTime(valor, ctx.currentTime);
    }

    function sonar() {
      if (!buffer) return;
      ctx.resume();
      volumen(1);
      if (fuente) return;
      fuente = ctx.createBufferSource();
      fuente.buffer = buffer;
      fuente.loop = true;
      fuente.loopStart = desde;
      fuente.loopEnd = hasta;
      fuente.connect(ganancia);
      fuente.start(0, desde + posicion);
      inicio = ctx.currentTime - posicion;
    }

    function pausar() {
      if (!fuente) return;
      posicion = (ctx.currentTime - inicio) % (hasta - desde);
      fuente.stop();
      fuente.disconnect();
      fuente = null;
      ctx.suspend();
    }

    mitad.addEventListener("mouseenter", () => {
      dentro = true;
      clearTimeout(reloj);
      sonar();
    });
    mitad.addEventListener("mouseleave", () => {
      dentro = false;
      volumen(0);
      clearTimeout(reloj);
      reloj = setTimeout(pausar, ESPERA_PAUSA);
    });

    return {
      activarSiDentro() {
        if (dentro) sonar();
      },
      pararYa() {
        clearTimeout(reloj);
        dentro = false;
        volumen(0);
        pausar();
        ganancia.disconnect();
      },
      async cargar() {
        try {
          const datos = await fetch(mitad.dataset.audio).then((r) => r.arrayBuffer());
          buffer = await ctx.decodeAudioData(datos);
          ({ desde, hasta } = recorte(buffer));
          if (dentro) sonar();
        } catch {
          // Sin audio en esta mitad; el resto de la web no se entera.
        }
      },
    };
  }

  const pistas = Array.from(mitades, preparar);

  // Los navegadores no dejan sonar nada hasta que la persona hace un clic: en la portada lo da
  // el captcha, y si por lo que sea no lo ha dado, se espera al primer clic o tecla.
  function alGesto() {
    pistas.forEach((p) => p.activarSiDentro());
  }
  addEventListener("pointerdown", alGesto);
  addEventListener("keydown", alGesto);

  function empezar() {
    (window.requestIdleCallback || setTimeout)(() => pistas.forEach((p) => p.cargar()));
  }
  // El evento "load" solo se dispara una vez por documento: si la página ya había cargado
  // (se vuelve a la portada sin recargarla), se pide directamente.
  if (document.readyState === "complete") empezar();
  else addEventListener("load", empezar, { once: true });

  // Al irse de la portada (navegacion.js) se corta el sonido al instante. El contexto no se
  // cierra: lo siguen usando los listados.
  (window.__limpiezas ||= []).push(function () {
    removeEventListener("pointerdown", alGesto);
    removeEventListener("keydown", alGesto);
    removeEventListener("load", empezar);
    pistas.forEach((p) => p.pararYa());
  });
})();
