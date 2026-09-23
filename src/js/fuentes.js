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
  // Al llegar a la portada sin recargar (navegacion.js) con el ratón ya encima de "Image", el
  // navegador no avisa hasta que el ratón se mueve: se mira aquí.
  requestAnimationFrame(() => {
    if (disparador.matches(":hover")) disparador.dispatchEvent(new MouseEvent("mouseenter"));
  });

  // Al irse de la portada sin recargar (navegacion.js) la palabra desaparece sin que llegue el
  // mouseleave: se para aquí.
  (window.__limpiezas ||= []).push(() => clearInterval(temporizador));
})();
