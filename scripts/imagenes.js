// Convierte lo que hay en originales/ a versiones ligeras en media/.
// - Imágenes (jpg, png, tif, webp): webp en 600, 1200 y 2000 px de ancho.
// - SVG y mp3: se copian tal cual.
// Escribe src/_data/imagenes.json con los anchos y el tamaño de cada imagen.
// Solo procesa lo que ha cambiado desde la última vez.
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ORIGEN = "originales";
const DESTINO = "media";
const MANIFIESTO = "src/_data/imagenes.json";
const ANCHOS = [600, 1200, 2000];
const CALIDAD = 78;
const AVISO_MP3_MB = 1.5;

function recorrer(carpeta) {
  if (!fs.existsSync(carpeta)) return [];
  return fs.readdirSync(carpeta, { withFileTypes: true }).flatMap((e) => {
    const ruta = path.join(carpeta, e.name);
    if (e.name.startsWith(".")) return [];
    return e.isDirectory() ? recorrer(ruta) : [ruta];
  });
}

const masNuevo = (origen, destino) =>
  !fs.existsSync(destino) || fs.statSync(origen).mtimeMs > fs.statSync(destino).mtimeMs;

async function main() {
  const anterior = fs.existsSync(MANIFIESTO) ? JSON.parse(fs.readFileSync(MANIFIESTO, "utf8")) : {};
  const manifiesto = {};
  let convertidas = 0;

  for (const archivo of recorrer(ORIGEN)) {
    const ext = path.extname(archivo).toLowerCase();
    const relativa = path.relative(ORIGEN, archivo).split(path.sep).join("/");
    const sinExt = relativa.slice(0, -ext.length);

    if (/[^a-z0-9/_.-]/.test(relativa)) {
      console.warn(`Aviso: "${relativa}" tiene mayúsculas, acentos o espacios. Mejor renombrarlo.`);
    }

    if (ext === ".svg" || ext === ".mp3") {
      const destino = path.join(DESTINO, relativa);
      if (masNuevo(archivo, destino)) {
        fs.mkdirSync(path.dirname(destino), { recursive: true });
        fs.copyFileSync(archivo, destino);
        console.log(`Copiado ${relativa}`);
      }
      const mb = fs.statSync(archivo).size / 1e6;
      if (ext === ".mp3" && mb > AVISO_MP3_MB) {
        console.warn(`Aviso: ${relativa} pesa ${mb.toFixed(1)} MB. Para un fragmento de hover conviene menos de ${AVISO_MP3_MB} MB.`);
      }
      continue;
    }

    if (![".jpg", ".jpeg", ".png", ".tif", ".tiff", ".webp"].includes(ext)) continue;

    const { width, height } = await sharp(archivo).rotate().metadata().then((m) =>
      m.orientation >= 5 ? { width: m.height, height: m.width } : m
    );
    const anchos = ANCHOS.filter((w) => w < width);
    if (anchos.length < ANCHOS.length) anchos.push(Math.min(width, ANCHOS[ANCHOS.length - 1]));

    for (const w of anchos) {
      const destino = path.join(DESTINO, `${sinExt}-${w}.webp`);
      if (!masNuevo(archivo, destino)) continue;
      fs.mkdirSync(path.dirname(destino), { recursive: true });
      await sharp(archivo).rotate().resize({ width: w }).webp({ quality: CALIDAD }).toFile(destino);
      convertidas++;
    }
    manifiesto[sinExt] = { anchos, ancho: width, alto: height };
  }

  for (const ruta of Object.keys(anterior)) {
    if (!manifiesto[ruta]) console.log(`Ya no existe el original de "${ruta}". Puedes borrar sus webp de media/.`);
  }

  fs.writeFileSync(MANIFIESTO, JSON.stringify(manifiesto, null, 2) + "\n");
  console.log(`Listo: ${convertidas} archivos webp nuevos, ${Object.keys(manifiesto).length} imágenes en el manifiesto.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
