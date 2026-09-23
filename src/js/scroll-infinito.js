// Scroll infinito: la lista se repite en bucle.
// Se rellena un bloque hasta que mide al menos una pantalla, se triplica,
// y al acercarse a un extremo se salta un bloque sin que se note.
(function () {
  const lista = document.querySelector("[data-scroll-infinito]");
  if (!lista || !lista.children.length) return;

  // Con navegación sin recarga (navegacion.js) este script puede arrancar varias veces en
  // la misma página: se limpia la instancia anterior antes de montar la suya.
  window.__quitarScrollInfinito?.();

  const originales = [...lista.children];

  function clonar(elemento) {
    const copia = elemento.cloneNode(true);
    copia.setAttribute("aria-hidden", "true");
    copia.querySelectorAll("a").forEach((a) => a.setAttribute("tabindex", "-1"));
    return copia;
  }

  // 1. Un bloque tiene que medir al menos una pantalla de alto.
  let porBloque = originales.length;
  while (lista.offsetHeight < window.innerHeight * 1.1 && porBloque < 200) {
    originales.forEach((el) => lista.appendChild(clonar(el)));
    porBloque += originales.length;
  }

  // 2. Tres bloques iguales.
  const bloque = [...lista.children];
  for (let i = 0; i < 2; i++) bloque.forEach((el) => lista.appendChild(clonar(el)));

  // Alto de un bloque: distancia entre el primer elemento del bloque 1 y el del bloque 2.
  let alto = 0;
  const medir = () => {
    alto = lista.children[porBloque].offsetTop - lista.children[0].offsetTop;
  };

  medir();
  window.scrollTo({ top: alto, behavior: "instant" });

  function alScroll() {
    const y = window.scrollY;
    if (y >= alto * 2) window.scrollTo({ top: y - alto, behavior: "instant" });
    else if (y <= 0) window.scrollTo({ top: y + alto, behavior: "instant" });
  }

  window.addEventListener("scroll", alScroll, { passive: true });
  window.addEventListener("resize", medir);

  window.__quitarScrollInfinito = function () {
    window.removeEventListener("scroll", alScroll);
    window.removeEventListener("resize", medir);
  };
})();
