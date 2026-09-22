// Portada en pantallas táctiles: al tocar Audio o Image la mitad se pone amarilla un momento
// antes de entrar (en el ordenador ya lo hace el hover). El hover del CSS solo vale con ratón.
(function () {
  if (matchMedia("(hover: hover)").matches) return;

  const ESPERA = 260; // ms que se ve el amarillo antes de cambiar de página

  document.querySelectorAll(".mitad").forEach((mitad) => {
    mitad.addEventListener("click", (e) => {
      if (mitad.classList.contains("tocada")) return;
      e.preventDefault();
      mitad.classList.add("tocada");
      setTimeout(() => { location.href = mitad.href; }, ESPERA);
    });
  });

  // Al volver atrás desde la caché del navegador la mitad no debe quedar amarilla
  addEventListener("pageshow", () => {
    document.querySelectorAll(".mitad.tocada").forEach((m) => m.classList.remove("tocada"));
  });
})();
