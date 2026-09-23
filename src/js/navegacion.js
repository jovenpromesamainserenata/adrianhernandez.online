// Navegación sin recarga por toda la web (23/09/2026; antes, desde el 22/09/2026, solo entre la
// portada y los listados de audio).
// Motivo: en Safari, el permiso para sonar audio (el que da el clic del captcha falso) se pierde
// en cada carga de página nueva, así que los hovers de sonido no sonaban hasta un clic aparte
// aunque ya se hubiera pasado el captcha (Chrome sí guarda ese permiso al navegar). Pasaba sobre
// todo al volver a la portada desde cualquier sitio que no fuera un listado de audio. Cambiando el
// contenido sin recargar el documento, el permiso se mantiene porque para el navegador sigue
// siendo la misma página.
// Solo con ratón: en el móvil no hay hover que proteger, así que ahí se navega como siempre.
//
// Cada script que deja algo vivo fuera de sus propios elementos (oyentes en window o document,
// bucles de animación, sonido) apunta en `window.__limpiezas` cómo quitarlo, y aquí se ejecuta
// todo eso antes de cambiar de página.
(function () {
  if (!matchMedia("(hover: hover)").matches) return;
  if (window.__navegacion) return;  // este script se carga en todas las páginas: solo una vez
  window.__navegacion = true;

  let enCurso = false;

  function limpiar() {
    const pendientes = window.__limpiezas || [];
    window.__limpiezas = [];
    pendientes.forEach((f) => {
      try { f(); } catch {}
    });
  }

  async function navegar(url, { historial = true } = {}) {
    if (enCurso) return;
    enCurso = true;

    // Se para todo lo que estuviera sonando o escuchando en la página que se deja, antes incluso
    // de pedir la siguiente: al quitar el contenido, elementos como las mitades de la portada
    // desaparecen sin disparar su "mouseleave", así que si no se paran aquí (y ya, sin esperar a
    // la respuesta del servidor) se quedan sonando de fondo (Adrián, 23/09/2026).
    limpiar();

    let html;
    try {
      const respuesta = await fetch(url.href);
      if (!respuesta.ok || !(respuesta.headers.get("content-type") || "").includes("text/html")) {
        throw new Error(respuesta.status);
      }
      html = await respuesta.text();
    } catch {
      location.href = url.href;
      return;
    }

    const nuevo = new DOMParser().parseFromString(html, "text/html");

    // Hojas de estilo que haga falta cargar y que todavía no estén (la portada pide sus fuentes
    // de Google; el resto de páginas, ninguna).
    nuevo.querySelectorAll('head link[rel="stylesheet"]').forEach((enlace) => {
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

    // La marca `dentro` deja saber a la página nueva que se llegó desde otra de la web: sin recarga,
    // `document.referrer` sigue siendo el de la primera página de la visita (la "x" del About).
    if (historial) history.pushState({ dentro: true }, "", url.href);
    window.scrollTo({ top: 0, behavior: "instant" });

    // Los scripts de la página (menos este) se vuelven a ejecutar de cero, en su orden: los que
    // van escritos en la página, al momento; los de archivo, en orden (async = false).
    nuevo.body.querySelectorAll("script").forEach((script) => {
      const copia = document.createElement("script");
      if (script.hasAttribute("src")) {
        const src = new URL(script.getAttribute("src"), location.href).href;
        // Este mismo y el de recarga automática de la vista previa ya están cargados.
        if (src.endsWith("/js/navegacion.js") || src.includes("/.11ty/")) return;
        copia.src = src;
        copia.async = false;
      } else {
        copia.textContent = script.textContent;
      }
      document.body.appendChild(copia);
    });

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
    if (url.pathname === location.pathname && url.search === location.search) return;
    // Archivos (mp3, pdf, imágenes...): se abren como siempre.
    if (/\.[a-z0-9]+$/i.test(url.pathname) && !url.pathname.endsWith(".html")) return;

    e.preventDefault();
    navegar(url);
  });

  // Atrás y adelante del navegador.
  addEventListener("popstate", () => navegar(new URL(location.href), { historial: false }));
})();
