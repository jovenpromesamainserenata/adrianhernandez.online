// Pelota de tenis (Joven Promesa Main Serenata, 20/09/2026).
// Al hacer clic en cualquier sitio de la ficha sale una pelota desde el ratón y
// bota por la pantalla hasta que se queda rodando y se desvanece.
// Se activa con el campo `pelota` del proyecto (la pinta proyecto.njk).
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
  const QUIETA = 2.5;      // segundos quieta antes de desvanecerse
  const FUNDIDO = 500;     // lo que tarda en irse (igual que la transición del CSS)
  const MAXIMO = 12;       // pelotas a la vez; al pasarse se va la más vieja

  const LUZ_ALTA = 0.5;    // la lámpara, por encima del borde de arriba
  // Cuánto se apartan del centro el brillo y la sombra, en anchos de pelota. Van en
  // píxeles y no en %, porque las capas del CSS son mayores que la pelota.
  const BRILLO = 0.28;     // el brillo, hacia la lámpara
  const UMBRA = 0.6;       // la sombra, al lado contrario

  // La imagen se pide ya, así la primera pelota no aparece en blanco.
  const muestra = plantilla.content.querySelector("img");
  if (muestra) new Image().src = muestra.currentSrc || muestra.src;

  const pelotas = [];
  let animando = false;
  let antes = 0;

  function lanzar(x, y) {
    const nodo = plantilla.content.firstElementChild.cloneNode(true);
    nodo.querySelectorAll("img").forEach((i) => i.removeAttribute("loading"));
    marco.appendChild(nodo);

    const radio = nodo.offsetWidth / 2 || 20;
    const alto = innerHeight;
    // Sale hacia arriba, en una dirección cualquiera entre las diez y las dos.
    const angulo = (-90 + (Math.random() * 120 - 60)) * (Math.PI / 180);
    const rapidez = alto * IMPULSO * (0.85 + Math.random() * 0.35);
    const pelota = {
      nodo,
      cara: nodo.querySelector(".pelota-cara"),
      luz: nodo.querySelector(".pelota-luz"),
      umbra: nodo.querySelector(".pelota-umbra"),
      radio,
      x: Math.min(Math.max(x, radio), innerWidth - radio),
      y: Math.min(Math.max(y, radio), alto - radio),
      vx: Math.cos(angulo) * rapidez,
      vy: Math.sin(angulo) * rapidez,
      giro: Math.random() * Math.PI * 2,
      descanso: 0,
    };
    pelotas.push(pelota);
    pintar(pelota, innerWidth, alto);

    // Las que ya se están desvaneciendo siguen en la lista un momento: no cuentan.
    const vivas = pelotas.filter((p) => !p.yendose);
    if (vivas.length > MAXIMO) retirar(vivas[0]);

    if (!animando) {
      animando = true;
      antes = performance.now();
      requestAnimationFrame(paso);
    }
  }

  function retirar(pelota) {
    if (pelota.yendose) return;
    pelota.yendose = true;
    pelota.nodo.classList.add("se-va");
    setTimeout(function () {
      pelota.nodo.remove();
      const i = pelotas.indexOf(pelota);
      if (i > -1) pelotas.splice(i, 1);
    }, FUNDIDO);
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

  function paso(ahora) {
    const dt = Math.min((ahora - antes) / 1000, 0.05);
    antes = ahora;
    const ancho = innerWidth;
    const alto = innerHeight;
    const gravedad = alto * GRAVEDAD;

    for (const p of pelotas) {
      p.vy += gravedad * dt;
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

      // Quieta en el suelo un rato: se va.
      const parada = !p.vy && Math.abs(p.vx) < alto * 0.03;
      p.descanso = parada ? p.descanso + dt : 0;
      if (p.descanso > QUIETA) retirar(p);
    }

    animando = pelotas.length > 0;
    if (animando) requestAnimationFrame(paso);
  }

  // Los enlaces, los botones, el reproductor entero (el clic en el vídeo lo
  // reproduce o lo para: ahí no pinta una pelota, Adrián 20/09/2026) y lo que se
  // arrastra (carrusel, tarjeta) siguen a lo suyo: ahí no sale pelota.
  const SUYO = "a, button, [role='slider'], input, textarea, select, summary, .carrusel-marco, [data-tarjeta], [data-reproductor]";

  // La pelota sale al soltar, no al pulsar: así arrastrar para seleccionar un texto
  // (o para mover el carrusel) no la lanza. Tampoco sale si queda texto seleccionado.
  let inicio = null;
  function alPulsar(e) {
    inicio = e.button > 0 ? null : { x: e.clientX, y: e.clientY, t: e.timeStamp };
  }
  function alSoltar(e) {
    const desde = inicio;
    inicio = null;
    if (!desde || e.target.closest(SUYO)) return;
    if (Math.hypot(e.clientX - desde.x, e.clientY - desde.y) > 6) return;
    if (e.timeStamp - desde.t > 500) return;
    const seleccion = getSelection();
    if (seleccion && !seleccion.isCollapsed) return;
    lanzar(e.clientX, e.clientY);
  }

  // Si la ventana cambia de tamaño, las que se queden fuera vuelven dentro.
  function alCambiarTamano() {
    for (const p of pelotas) {
      p.x = Math.min(Math.max(p.x, p.radio), innerWidth - p.radio);
      p.y = Math.min(Math.max(p.y, p.radio), innerHeight - p.radio);
      pintar(p, innerWidth, innerHeight);
    }
  }

  addEventListener("pointerdown", alPulsar);
  addEventListener("pointerup", alSoltar);
  addEventListener("resize", alCambiarTamano);

  // Al irse de la ficha sin recargar (navegacion.js) se quitan los oyentes y las pelotas.
  (window.__limpiezas ||= []).push(function () {
    removeEventListener("pointerdown", alPulsar);
    removeEventListener("pointerup", alSoltar);
    removeEventListener("resize", alCambiarTamano);
    pelotas.length = 0;
  });
})();
