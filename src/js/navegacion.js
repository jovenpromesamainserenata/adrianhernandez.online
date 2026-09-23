// Navegación sin recarga entre la portada y los listados de audio.
// Motivo: en Safari, el permiso para sonar audio (el que da el clic del captcha falso)
// se pierde en cada carga de página nueva, así que el primer hover de /audio/ no sonaba
// hasta un clic aparte, aunque ya se hubiera pasado el captcha en la portada (Chrome sí
// guarda ese permiso al navegar). Cambiando el contenido sin recargar el documento, el
// permiso se mantiene porque para el navegador sigue siendo la misma página.
// Solo entre estas tres páginas, y solo con ratón: en el móvil no hay hover que proteger,
// así que ahí se navega como siempre.
(function () {
  if (!matchMedia("(hover: hover)").matches) return;

  const RUTAS = ["/", "/audio/", "/audio/music-production/"];
  let enCurso = false;

  function esRutaBlanda(pathname) {
    return RUTAS.includes(pathname);
  }

  async function navegar(url, { historial = true } = {}) {
    if (enCurso) return;
    enCurso = true;

    // Se para todo lo que estuviera sonando o escuchando en la página que se deja, antes incluso
    // de pedir la siguiente: al quitar el contenido, elementos como las mitades de la portada
    // desaparecen sin disparar su "mouseleave", así que si no se paran aquí (y ya, sin esperar a
    // la respuesta del servidor) se quedan sonando de fondo (Adrián, 23/09/2026).
    window.__pararSonido?.();
    window.__quitarScrollInfinito?.();
    window.__cerrarSonidoPortada?.();

    let html;
    try {
      const respuesta = await fetch(url.href);
      if (!respuesta.ok) throw new Error(respuesta.status);
      html = await respuesta.text();
    } catch {
      location.href = url.href;
      return;
    }

    const nuevo = new DOMParser().parseFromString(html, "text/html");

    // Fuentes de Google que haga falta cargar y que todavía no estén (la portada pide
    // las suyas; los listados, ninguna).
    nuevo.querySelectorAll('head link[href*="fonts.googleapis.com"]').forEach((enlace) => {
      if (!document.querySelector(`head link[href="${enlace.getAttribute("href")}"]`)) {
        document.head.appendChild(enlace.cloneNode(true));
      }
    });

    // Los <script> del body se quitan de aquí: se vuelven a añadir aparte, ya vivos, más abajo.
    const contenido = nuevo.body.cloneNode(true);
    contenido.querySelectorAll("script").forEach((s) => s.remove());

    document.title = nuevo.title;
    document.body.className = nuevo.body.className;
    document.body.innerHTML = contenido.innerHTML;

    if (historial) history.pushState(null, "", url.href);

    // Un listado apunta su sección y su pestaña en el propio HTML (ver listado.njk): el
    // script inline que las guardaba en sessionStorage no se ejecuta al insertarlo así.
    const listado = document.querySelector(".listado[data-seccion]");
    if (listado) {
      try {
        sessionStorage.setItem("seccion", listado.dataset.seccion);
        sessionStorage.setItem("lista", listado.dataset.lista);
      } catch {}
    }

    // Los scripts de la página (menos este) se vuelven a ejecutar de cero. Cada uno se
    // limpia solo al arrancar (por eso pueden ejecutarse varias veces sin acumular nada).
    nuevo.querySelectorAll("script[src]").forEach((script) => {
      const src = new URL(script.getAttribute("src"), location.href).href;
      if (src.endsWith("/js/navegacion.js")) return;
      const copia = document.createElement("script");
      copia.src = src;
      document.body.appendChild(copia);
    });

    window.scrollTo({ top: 0, behavior: "instant" });
    enCurso = false;
  }

  document.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest("a");
    if (!a || a.target || a.hasAttribute("download")) return;

    let url;
    try {
      url = new URL(a.getAttribute("href"), location.href);
    } catch {
      return;
    }
    if (url.origin !== location.origin) return;
    if (!esRutaBlanda(url.pathname) || !esRutaBlanda(location.pathname)) return;
    if (url.pathname === location.pathname) return;

    e.preventDefault();
    navegar(url);
  });

  addEventListener("popstate", () => {
    if (esRutaBlanda(location.pathname)) navegar(new URL(location.href), { historial: false });
  });
})();
