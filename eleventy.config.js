const fs = require("fs");
const path = require("path");

const MANIFIESTO = path.join(__dirname, "src/_data/imagenes.json");
const MANIFIESTO_VIDEOS = path.join(__dirname, "src/_data/videos.json");

// Los vídeos propios viven en Cloudflare R2 (videos.adrianhernandez.online).
// En la vista previa se sirven desde la carpeta videos/ del ordenador, así se ven antes de subirlos.
const EN_VISTA_PREVIA = process.env.ELEVENTY_RUN_MODE === "serve";
const BASE_VIDEOS = EN_VISTA_PREVIA ? "/videos" : require("./src/_data/site.json").videos;

// Iconos del reproductor (dibujados en una rejilla de 20 × 20, color del texto).
const icono = (clase, trazo) =>
  `<svg class="${clase}" viewBox="0 0 20 20" aria-hidden="true" fill="currentColor">${trazo}</svg>`;
const ICONOS = {
  // Triángulo del botón del centro del vídeo. Desde el 21/09/2026 es el único play que queda:
  // el de la barra se quitó porque el clic en el vídeo ya reproduce y para (Adrián).
  marca: icono("icono-marca", '<path d="M5 3.5v13l11-6.5z"/>'),
  pantalla: icono(
    "icono-pantalla",
    '<path d="M3 7.5V3h4.5M12.5 3H17v4.5M17 12.5V17h-4.5M7.5 17H3v-4.5" fill="none" stroke="currentColor" stroke-width="1.8"/>'
  ),
};

// `seccion` y `categoria` admiten un valor o una lista.
const lista = (valor) => [].concat(valor ?? []);
const incluye = (valor, buscado) => lista(valor).includes(buscado);

// `orden` puede ser un número o, en proyectos de las dos secciones, uno por sección:
// orden: { audio: 4, image: 7 }
const ordenEn = (proyecto, seccion) => {
  const orden = proyecto.data.orden;
  return (typeof orden === "object" && orden ? orden[seccion] : orden) || 0;
};

// Orden de los listados: `orden` más alto primero y, a igualdad, año más reciente.
function ordenar(proyectos, seccion) {
  return proyectos.sort(
    (a, b) =>
      ordenEn(b, seccion) - ordenEn(a, seccion) ||
      (b.data.anio || 0) - (a.data.anio || 0)
  );
}

function escapar(texto) {
  return String(texto ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}

module.exports = function (eleventyConfig) {
  // Puerto de la vista previa: el que asigne el entorno (PORT) o 8080 por defecto.
  eleventyConfig.setServerOptions({ port: Number(process.env.PORT) || 8080 });

  eleventyConfig.addPassthroughCopy({ "src/css": "css" });
  eleventyConfig.addPassthroughCopy({ "src/js": "js" });
  eleventyConfig.addPassthroughCopy({ "src/fuentes": "fuentes" });
  eleventyConfig.addPassthroughCopy({ "src/CNAME": "CNAME" });
  eleventyConfig.addPassthroughCopy({ media: "media" });
  if (EN_VISTA_PREVIA) eleventyConfig.addPassthroughCopy({ videos: "videos" });

  // Todos los proyectos viven en src/proyectos/. Un proyecto de las dos secciones genera una
  // página por sección (`pagination` en proyectos.11tydata.json), cada una con su propia dirección
  // y solo con su material y sus créditos: /audio/cocky/ la música y /image/cocky/ la imagen
  // (Adrián, 21/09/2026). Cada página se filtra por la sección que le toca, `seccionActual`.
  const proyectos = (api, seccion) =>
    api.getFilteredByGlob("src/proyectos/*.md").filter((p) => p.data.seccionActual === seccion);

  eleventyConfig.addCollection("soundDesign", (api) =>
    ordenar(proyectos(api, "audio").filter((p) => incluye(p.data.categoria, "sound-design")), "audio")
  );
  eleventyConfig.addCollection("musicProduction", (api) =>
    ordenar(proyectos(api, "audio").filter((p) => incluye(p.data.categoria, "music-production")), "audio")
  );
  eleventyConfig.addCollection("image", (api) => ordenar(proyectos(api, "image"), "image"));

  eleventyConfig.addFilter("incluye", incluye);

  // Listados en los que aparece un proyecto, con el nombre que usan las páginas.
  const LISTADOS = { "sound-design": "soundDesign", "music-production": "musicProduction", image: "image" };
  eleventyConfig.addFilter("listasDe", (url, collections) =>
    Object.keys(LISTADOS).filter((nombre) => (collections[LISTADOS[nombre]] || []).some((p) => p.url === url))
  );
  // Proyecto anterior y siguiente dentro de un listado, dando la vuelta al llegar a un extremo.
  eleventyConfig.addFilter("vecinos", (url, collections, nombre) => {
    const lista = collections[LISTADOS[nombre]] || [];
    const i = lista.findIndex((p) => p.url === url);
    if (i < 0 || lista.length < 2) return null;
    return {
      anterior: lista[(i - 1 + lista.length) % lista.length],
      siguiente: lista[(i + 1) % lista.length],
    };
  });
  eleventyConfig.addFilter("lista", lista);
  // `portada` puede ser una sola o, en proyectos de las dos secciones, una por sección:
  // portada: { audio: nombre/portada-audio, image: nombre/portada }
  eleventyConfig.addFilter("portadaEn", (portada, seccion) =>
    typeof portada === "object" && portada ? portada[seccion] : portada
  );
  // Créditos por sección, como ya hacen `portada` y `orden` (Adrián, 21/09/2026). En un proyecto
  // compartido cada disciplina lleva sus créditos pegados a su material, y no se mezclan:
  //   datos:
  //     audio: ["Music production for ..."]
  //     image: ["Cover artwork for ..."]
  // Si están divididos coge los de esta sección; si no, los coge tal cual.
  const dividido = (valor) => valor && typeof valor === "object" && !Array.isArray(valor);
  eleventyConfig.addFilter("deSeccion", (valor, seccion) => (dividido(valor) ? valor[seccion] || [] : lista(valor)));

  // El enlace del pie de la ficha ("Listen", "Watch the full show"). Puede ser uno solo:
  //   enlace: { url: "https://...", texto: Listen }
  // o uno por sección, y entonces sale pegado a los créditos de esa disciplina y no al final de
  // todo (Adrián, 21/09/2026: "el listen tiene que ir después de los créditos de producción musical"):
  //   enlace:
  //     audio: { url: "https://...", texto: Listen }
  // Se distinguen porque el enlace suelto lleva `url` y el partido por secciones no.
  const porSecciones = (valor) => valor && typeof valor === "object" && !valor.url;
  eleventyConfig.addFilter("enlaceDe", (valor, seccion) => (porSecciones(valor) ? valor[seccion] : valor));

  // Parte una lista de créditos en grupos, usando las líneas vacías como separador (Adrián, 21/09/2026).
  // Cada grupo se pinta como su propio bloque, separado de los demás por el hueco de siempre:
  //   colaboradores:
  //     - "Track 2 — ..."
  //     - ""                  ← aquí empieza otro grupo
  //     - "Mixing and mastering by ..."
  eleventyConfig.addFilter("grupos", (valor) => {
    const grupos = [[]];
    for (const linea of lista(valor)) {
      if (String(linea).trim()) grupos[grupos.length - 1].push(linea);
      else if (grupos[grupos.length - 1].length) grupos.push([]);
    }
    return grupos.filter((g) => g.length);
  });

  // Extrae el número de un enlace de Vimeo (https://vimeo.com/123456789).
  eleventyConfig.addFilter("vimeoId", (url) => (String(url).match(/vimeo\.com\/(?:video\/)?(\d+)/) || [])[1]);

  // Dirección para incrustar un vídeo, sea de Vimeo o de YouTube.
  // YouTube se pide por youtube-nocookie.com para no dejar cookies de seguimiento.
  eleventyConfig.addFilter("incrustar", (url) => {
    const enlace = String(url);
    const vimeo = enlace.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}?dnt=1&title=0&byline=0&portrait=0`;
    const youtube = enlace.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]+)/);
    if (youtube) return `https://www.youtube-nocookie.com/embed/${youtube[1]}?rel=0`;
    return "";
  });

  // {% imagen "audio/desigual/portada", "Texto alternativo", "(min-width: 700px) 34vw, 90vw" %}
  // Lee el manifiesto que genera `npm run imagenes`. Si la imagen aún no existe, pinta un bloque gris.
  eleventyConfig.addShortcode("imagen", (ruta, alt = "", sizes = "100vw", clase = "") => {
    if (!ruta) return `<div class="hueco ${clase}" aria-hidden="true"></div>`;
    if (ruta.endsWith(".svg")) {
      return `<img class="${clase}" src="/media/${ruta}" alt="${escapar(alt)}" loading="lazy">`;
    }
    const manifiesto = JSON.parse(fs.readFileSync(MANIFIESTO, "utf8"));
    const info = manifiesto[ruta];
    if (!info) return `<div class="hueco ${clase}" role="img" aria-label="${escapar(alt)}"></div>`;
    const srcset = info.anchos.map((w) => `/media/${ruta}-${w}.webp ${w}w`).join(", ");
    const mediano = info.anchos[Math.min(1, info.anchos.length - 1)];
    return `<img class="${clase}" src="/media/${ruta}-${mediano}.webp" srcset="${srcset}" sizes="${sizes}" width="${info.ancho}" height="${info.alto}" alt="${escapar(alt)}" loading="lazy" decoding="async">`;
  });

  // {% video "4ever/video-01", "Título" %}
  // Vídeo propio con el reproductor de la web (src/js/reproductor.js). Controles sueltos sobre el
  // vídeo, que se esconden mientras se reproduce: la pantalla completa abajo a la derecha y la
  // línea de avance pegada al borde de abajo. El tiempo se quitó el 21/09/2026: con la línea basta. El sonido se quita y se pone desde el
  // botón "Sound on/off" de la esquina de la página, el mismo sitio que en los listados de /audio/. Lee el manifiesto que genera
  // `npm run videos` (medidas y duración). Si el vídeo aún no existe, pinta un bloque gris.
  eleventyConfig.addShortcode("video", (ruta, titulo = "") => {
    const manifiesto = fs.existsSync(MANIFIESTO_VIDEOS) ? JSON.parse(fs.readFileSync(MANIFIESTO_VIDEOS, "utf8")) : {};
    const info = manifiesto[ruta];
    if (!info) return `<div class="media"><div class="hueco" style="aspect-ratio: 16/9" role="img" aria-label="${escapar(titulo)}"></div></div>`;
    const url = `${BASE_VIDEOS}/${ruta}`;
    return `<div class="media reproductor" style="--proporcion: ${info.ancho}/${info.alto}" data-reproductor>
    <div class="reproductor-pantalla">
      <video src="${url}.mp4" poster="${url}.jpg" preload="none" playsinline aria-label="${escapar(titulo)}"></video>
      <div class="reproductor-marca" aria-hidden="true">${ICONOS.marca}</div>
      <div class="reproductor-controles">
        <button class="reproductor-boton" type="button" data-pantalla aria-label="Full screen">${ICONOS.pantalla}</button>
        <div class="reproductor-linea" data-linea role="slider" tabindex="0" aria-label="Seek" aria-valuemin="0" aria-valuemax="${info.duracion}" aria-valuenow="0">
          <div class="reproductor-cargado"></div>
          <div class="reproductor-avance"></div>
        </div>
      </div>
    </div>
  </div>`;
  });

  return {
    dir: { input: "src", includes: "_includes", data: "_data", output: "_site" },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
};
