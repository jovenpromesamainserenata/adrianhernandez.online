// Pelota de tenis (Joven Promesa Main Serenata, 20/09/2026).
// Hay una sola pelota y no se va nunca: sale del ratón al hacer clic en cualquier
// sitio de la ficha, bota, rueda y se queda donde para. Otro clic la vuelve a sacar
// en el sitio nuevo. Se puede coger con el ratón o con el dedo y tirarla por la
// pantalla, y al mover la página tira de ella (prueba pedida por Adrián, 20/09/2026).
// La versión anterior, con hasta 12 pelotas que se desvanecían solas, está guardada
// en herramientas/pelota-varias.js.
//
// La imagen es la foto de la pelota recortada y con la luz aplanada
// (scripts/pelota-foto.js): solo lleva el fieltro y las costuras. El volumen lo
// ponen aquí dos capas de luz que se mueven según dónde esté la pelota, como si
// hubiera una lámpara fija encima de la pantalla.
//
// Las medidas van en proporción al alto de la ventana, no en píxeles, para que el
// bote se sienta igual en un portátil que en un móvil.
(function () {
  const marco = document.querySelector("[data-pelotas]");
  if (!marco || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const plantilla = marco.querySelector("template");
  if (!plantilla) return;

  const GRAVEDAD = 3.4;    // alturas de pantalla por segundo, cada segundo
  const IMPULSO = 1.25;    // alturas de pantalla por segundo al salir del ratón
  const REBOTE = 0.88;     // parte de la velocidad que conserva en cada bote
  const ROZAMIENTO = 0.8;  // lo que frena rodando por el suelo, por segundo
  const GIRO = 0.3;        // cuánto gira sobre sí misma, respecto a lo que rodaría de verdad
  const PARADA = 0.2;      // por debajo de esta velocidad ya no bota, rueda
  const TIRON = 2.5;       // tope al tirarla con la mano, alturas de pantalla por segundo
  const MANO = 120;        // ms: si la mano se para antes de soltar, la pelota se queda
  const ARRASTRE = 0.7;    // cuánto se la lleva la página al moverla
  const EMPUJE = 20;       // impulso que le deja ese arrastre

  const LUZ_ALTA = 0.5;    // la lámpara, por encima del borde de arriba
  // Cuánto se apartan del centro el brillo y la sombra, en anchos de pelota. Van en
  // píxeles y no en %, porque las capas del CSS son mayores que la pelota.
  const BRILLO = 0.28;     // el brillo, hacia la lámpara
  const UMBRA = 0.6;       // la sombra, al lado contrario

  const entre = (v, a, b) => (v < a ? a : v > b ? b : v);

  // La imagen se pide ya, así la pelota no aparece en blanco la primera vez.
  const muestra = plantilla.content.querySelector("img");
  if (muestra) new Image().src = muestra.currentSrc || muestra.src;

  let pelota = null;
  let agarre = null;
  let animando = false;
  let antes = 0;

  function crear() {
    const nodo = plantilla.content.firstElementChild.cloneNode(true);
    nodo.querySelectorAll("img").forEach((i) => i.removeAttribute("loading"));
    marco.appendChild(nodo);
    pelota = {
      nodo,
      cara: nodo.querySelector(".pelota-cara"),
      luz: nodo.querySelector(".pelota-luz"),
      umbra: nodo.querySelector(".pelota-umbra"),
      radio: nodo.offsetWidth / 2 || 20,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      giro: Math.random() * Math.PI * 2,
    };
    nodo.addEventListener("pointerdown", coger);
    nodo.addEventListener("pointermove", mover);
    nodo.addEventListener("pointerup", soltar);
    nodo.addEventListener("pointercancel", soltar);
    return pelota;
  }

  function lanzar(x, y) {
    const p = pelota || crear();
    const alto = innerHeight;
    // Sale hacia arriba, en una dirección cualquiera entre las diez y las dos.
    const angulo = (-90 + (Math.random() * 120 - 60)) * (Math.PI / 180);
    const rapidez = alto * IMPULSO * (0.85 + Math.random() * 0.35);
    p.x = entre(x, p.radio, innerWidth - p.radio);
    p.y = entre(y, p.radio, alto - p.radio);
    p.vx = Math.cos(angulo) * rapidez;
    p.vy = Math.sin(angulo) * rapidez;
    pintar(p, innerWidth, alto);
    despertar();
  }

  // Cogerla con el ratón o con el dedo: mientras está en la mano no hay física,
  // va donde va el puntero, y al soltar sale con la velocidad de la mano.
  function coger(e) {
    if (!pelota || e.button > 0) return;
    e.preventDefault();
    pelota.nodo.setPointerCapture(e.pointerId);
    pelota.nodo.classList.add("agarrada");
    agarre = { id: e.pointerId, dx: pelota.x - e.clientX, dy: pelota.y - e.clientY, t: e.timeStamp };
    pelota.vx = 0;
    pelota.vy = 0;
    despertar();
  }

  function mover(e) {
    if (!agarre || e.pointerId !== agarre.id) return;
    const dt = Math.max((e.timeStamp - agarre.t) / 1000, 0.001);
    agarre.t = e.timeStamp;
    const x = entre(e.clientX + agarre.dx, pelota.radio, innerWidth - pelota.radio);
    const y = entre(e.clientY + agarre.dy, pelota.radio, innerHeight - pelota.radio);
    // Velocidad de la mano, suavizada: si contara solo el último salto, al soltar
    // saldría con el tirón de un fotograma suelto.
    pelota.vx = pelota.vx * 0.4 + ((x - pelota.x) / dt) * 0.6;
    pelota.vy = pelota.vy * 0.4 + ((y - pelota.y) / dt) * 0.6;
    pelota.giro += ((x - pelota.x) / pelota.radio) * GIRO;
    pelota.x = x;
    pelota.y = y;
    pintar(pelota, innerWidth, innerHeight);
  }

  function soltar(e) {
    if (!agarre || e.pointerId !== agarre.id) return;
    const quieta = e.timeStamp - agarre.t > MANO;
    agarre = null;
    pelota.nodo.classList.remove("agarrada");
    const tope = innerHeight * TIRON;
    // Si la mano se paró antes de soltar, se cae ahí mismo en vez de salir disparada.
    pelota.vx = quieta ? 0 : entre(pelota.vx, -tope, tope);
    pelota.vy = quieta ? 0 : entre(pelota.vy, -tope, tope);
    despertar();
  }

  function pintar(p, ancho, alto) {
    p.nodo.style.transform = "translate(" + (p.x - p.radio) + "px, " + (p.y - p.radio) + "px)";
    p.cara.style.transform = "rotate(" + p.giro + "rad)";

    // Dirección de la lámpara desde esta pelota: ahí va el brillo, enfrente la sombra.
    const lx = ancho / 2 - p.x;
    const ly = -alto * LUZ_ALTA - p.y;
    const d = Math.hypot(lx, ly) || 1;
    const lado = p.radio * 2;
    p.luz.style.transform =
      "translate(" + (lx / d) * BRILLO * lado + "px, " + (ly / d) * BRILLO * lado + "px)";
    p.umbra.style.transform =
      "translate(" + (-lx / d) * UMBRA * lado + "px, " + (-ly / d) * UMBRA * lado + "px)";
  }

  function despertar() {
    if (animando) return;
    animando = true;
    antes = performance.now();
    requestAnimationFrame(paso);
  }

  function paso(ahora) {
    const dt = Math.min((ahora - antes) / 1000, 0.05);
    antes = ahora;
    const p = pelota;
    if (!p) {
      animando = false;
      return;
    }
    const ancho = innerWidth;
    const alto = innerHeight;

    // En la mano no hay física: la pinta el propio puntero.
    if (!agarre) {
      p.vy += alto * GRAVEDAD * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      if (p.x - p.radio < 0) {
        p.x = p.radio;
        p.vx = Math.abs(p.vx) * REBOTE;
      } else if (p.x + p.radio > ancho) {
        p.x = ancho - p.radio;
        p.vx = -Math.abs(p.vx) * REBOTE;
      }
      if (p.y - p.radio < 0) {
        p.y = p.radio;
        p.vy = Math.abs(p.vy) * REBOTE;
      } else if (p.y + p.radio > alto) {
        p.y = alto - p.radio;
        p.vy = -Math.abs(p.vy) * REBOTE;
        // Un bote de dos dedos no se ve: a partir de ahí rueda por el suelo.
        if (Math.abs(p.vy) < alto * PARADA) p.vy = 0;
        p.vx -= p.vx * Math.min(ROZAMIENTO * dt, 1);
      }

      // Gira en el sentido en el que rueda, pero menos de lo que giraría de verdad:
      // a este tamaño, una vuelta por circunferencia marea (Adrián, 20/09/2026).
      p.giro += (p.vx / p.radio) * dt * GIRO;
      pintar(p, ancho, alto);
    }

    // Parada en el suelo: se deja de animar hasta que vuelvan a tocarla. La pelota
    // se queda donde está, no se va nunca. Se mira que esté tocando el suelo, no
    // solo que vaya despacio: si no, podría quedarse parada en el aire.
    const enSuelo = p.y + p.radio >= alto - 0.5;
    animando = !!agarre || !enSuelo || Math.abs(p.vx) > 1 || Math.abs(p.vy) > 1;
    if (animando) requestAnimationFrame(paso);
  }

  // Los enlaces, los botones, la barra del reproductor, lo que se arrastra
  // (carrusel, tarjeta) y la propia pelota siguen a lo suyo: ahí no se lanza.
  const SUYO = "a, button, [role='slider'], input, textarea, select, summary, .carrusel-marco, [data-tarjeta], .pelota";

  // La pelota sale al soltar, no al pulsar: así arrastrar para seleccionar un texto
  // (o para mover el carrusel) no la lanza. Tampoco sale si queda texto seleccionado.
  let inicio = null;
  addEventListener("pointerdown", function (e) {
    inicio = e.button > 0 ? null : { x: e.clientX, y: e.clientY, t: e.timeStamp };
  });
  addEventListener("pointerup", function (e) {
    const desde = inicio;
    inicio = null;
    if (!desde || agarre || e.target.closest(SUYO)) return;
    if (Math.hypot(e.clientX - desde.x, e.clientY - desde.y) > 6) return;
    if (e.timeStamp - desde.t > 500) return;
    const seleccion = getSelection();
    if (seleccion && !seleccion.isCollapsed) return;
    lanzar(e.clientX, e.clientY);
  });

  // Al mover la página, la pelota se va con ella y se queda con algo de impulso.
  let desplazado = scrollY;
  addEventListener("scroll", function () {
    const d = scrollY - desplazado;
    desplazado = scrollY;
    if (!pelota || agarre || !d) return;
    const tope = innerHeight * TIRON;
    pelota.y = entre(pelota.y - d * ARRASTRE, pelota.radio, innerHeight - pelota.radio);
    // Se mezcla en vez de sumarse: así sigue a la mano que mueve la página en vez
    // de ir acumulando velocidad mientras dura el scroll.
    pelota.vy = entre(pelota.vy * 0.3 + -d * ARRASTRE * EMPUJE * 0.7, -tope, tope);
    pintar(pelota, innerWidth, innerHeight);
    despertar();
  }, { passive: true });

  // Si la ventana cambia de tamaño, la pelota vuelve dentro y se deja caer otra vez
  // (si la ventana se hace más alta, se habría quedado flotando).
  addEventListener("resize", function () {
    if (!pelota) return;
    pelota.x = entre(pelota.x, pelota.radio, innerWidth - pelota.radio);
    pelota.y = entre(pelota.y, pelota.radio, innerHeight - pelota.radio);
    pintar(pelota, innerWidth, innerHeight);
    despertar();
  });
})();
