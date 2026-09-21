// Portada: al pasar el ratón por "Image", la palabra cambia de fuente muy rápido.
(function () {
  // Las mismas que carga src/index.njk desde Google Fonts.
  const FUENTES = [
    "Roboto Mono",
    "Archivo Black",
    "EB Garamond",
    "Saira",
    "League Script",
    "Roboto",
    "Allerta",
    "Carrois Gothic",
    "IBM Plex Sans KR",
  ];
  const MILISEGUNDOS = 70;

  const palabra = document.querySelector("[data-roll-fuentes]");
  if (!palabra || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const disparador = palabra.closest("a") || palabra;

  // Se descargan al cargar la página para que el primer hover no se quede en blanco.
  if (document.fonts) FUENTES.forEach((f) => document.fonts.load(`1em "${f}"`, palabra.textContent));

  let temporizador = null;
  let i = 0;

  disparador.addEventListener("mouseenter", () => {
    clearInterval(temporizador);
    temporizador = setInterval(() => {
      palabra.style.fontFamily = `"${FUENTES[i++ % FUENTES.length]}", var(--fuente)`;
    }, MILISEGUNDOS);
  });
  disparador.addEventListener("mouseleave", () => {
    clearInterval(temporizador);
    palabra.style.fontFamily = "";
  });
})();
