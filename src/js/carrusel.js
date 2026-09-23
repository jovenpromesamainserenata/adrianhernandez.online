// Carrusel horizontal infinito dentro de una ficha de proyecto.
// Mismo truco que el scroll infinito de los listados, pero en horizontal:
// se rellena un bloque hasta que mide más de una pantalla, se triplica,
// y al llegar a un extremo se salta un bloque sin que se note.
// Se mueve con el trackpad (gesto horizontal) y arrastrando con el ratón. La rueda
// vertical se deja para la página, porque la tira está fija en el centro de la pantalla.
(function () {
  document.querySelectorAll("[data-carrusel]").forEach(preparar);

  function preparar(pista) {
    const originales = [...pista.children];
    if (!originales.length) return;
    const marco = pista.parentElement;

    function clonar(elemento) {
      const copia = elemento.cloneNode(true);
      copia.setAttribute("aria-hidden", "true");
      return copia;
    }

    // 1. Un bloque tiene que ser más ancho que la pantalla.
    let porBloque = originales.length;
    while (pista.scrollWidth < marco.clientWidth * 1.5 && porBloque < 200) {
      originales.forEach((el) => pista.appendChild(clonar(el)));
      porBloque += originales.length;
    }

    // 2. Tres bloques iguales.
    const bloque = [...pista.children];
    for (let i = 0; i < 2; i++) bloque.forEach((el) => pista.appendChild(clonar(el)));

    let ancho = 0;
    const medir = () => {
      ancho = pista.children[porBloque].offsetLeft - pista.children[0].offsetLeft;
      if (ancho) marco.scrollLeft = ancho;
    };

    // Las imágenes llegan tarde: hasta que no cargan, las medidas no son buenas.
    medir();
    const imagenes = [...pista.querySelectorAll("img")];
    let pendientes = imagenes.filter((img) => !img.complete).length;
    imagenes.forEach((img) => {
      if (img.complete) return;
      img.addEventListener("load", () => { if (--pendientes === 0) medir(); }, { once: true });
      img.addEventListener("error", () => { if (--pendientes === 0) medir(); }, { once: true });
    });

    marco.addEventListener("scroll", () => {
      if (!ancho) return;
      const x = marco.scrollLeft;
      if (x >= ancho * 2) marco.scrollLeft = x - ancho;
      else if (x <= 0) marco.scrollLeft = x + ancho;
    }, { passive: true });

    window.addEventListener("resize", medir);
    // Al irse de la ficha sin recargar (navegacion.js).
    (window.__limpiezas ||= []).push(() => window.removeEventListener("resize", medir));

    // Arrastrar con el ratón.
    let arrastrando = false;
    let desdeX = 0;
    let desdeScroll = 0;
    marco.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "touch") return;  // en móvil el dedo ya arrastra
      arrastrando = true;
      desdeX = e.clientX;
      desdeScroll = marco.scrollLeft;
      marco.setPointerCapture(e.pointerId);
      marco.classList.add("es-arrastrando");
    });
    marco.addEventListener("pointermove", (e) => {
      if (!arrastrando) return;
      marco.scrollLeft = desdeScroll - (e.clientX - desdeX);
    });
    const soltar = () => {
      arrastrando = false;
      marco.classList.remove("es-arrastrando");
    };
    marco.addEventListener("pointerup", soltar);
    marco.addEventListener("pointercancel", soltar);
  }
})();
