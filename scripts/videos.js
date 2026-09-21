// Comprime los vídeos de originales/ para la web y los deja en videos/, listos para subir a R2.
// - Busca originales/<proyecto>/video-01.mp4 (o .mov, .m4v).
// - Sale videos/<proyecto>/video-01.mp4 (H.264, como mucho 1920 px de ancho y unos 5 Mbps)
//   y videos/<proyecto>/video-01.jpg (primer fotograma, se ve mientras carga).
// Escribe src/_data/videos.json con el ancho, el alto (para su proporción) y la duración de cada vídeo.
// Solo procesa lo que ha cambiado desde la última vez.
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const ffmpeg = require("ffmpeg-static");

const ORIGEN = "originales";
const DESTINO = "videos";
const MANIFIESTO = "src/_data/videos.json";
const ANCHO_MAX = 1920;
const EXTENSIONES = [".mp4", ".mov", ".m4v"];

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

function ejecutar(args) {
  const r = spawnSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: "inherit" });
  if (r.status !== 0) throw new Error(`ffmpeg falló con: ${args.join(" ")}`);
}

// Si el original ya trae el audio en AAC se copia tal cual, sin volver a codificarlo (Adrián, 21/09/2026):
// recodificar un AAC pierde un poco cada vez y no gana nada. Solo se codifica lo que llega en otro formato
// (por ejemplo un .mov con audio sin comprimir). Los 11 vídeos subidos a R2 antes de este cambio se quedan
// como están; esto vale para los siguientes.
function audioSegunOrigen(archivo) {
  const r = spawnSync(ffmpeg, ["-hide_banner", "-i", archivo], { encoding: "utf8" });
  const codec = (r.stderr.match(/Stream #\d+:\d+.*: Audio: (\w+)/) || [])[1];
  return codec === "aac" ? ["-c:a", "copy"] : ["-c:a", "aac", "-b:a", "256k"];
}

// ffmpeg -i sin salida escribe la información del archivo en stderr.
function medidas(archivo) {
  const r = spawnSync(ffmpeg, ["-hide_banner", "-i", archivo], { encoding: "utf8" });
  const m = r.stderr.match(/Video:.*?(\d{2,5})x(\d{2,5})/);
  const d = r.stderr.match(/Duration: (\d+):(\d+):([\d.]+)/);
  return {
    ...(m && { ancho: Number(m[1]), alto: Number(m[2]) }),
    ...(d && { duracion: Number((Number(d[1]) * 3600 + Number(d[2]) * 60 + Number(d[3])).toFixed(1)) }),
  };
}

const anterior = fs.existsSync(MANIFIESTO) ? JSON.parse(fs.readFileSync(MANIFIESTO, "utf8")) : {};
const manifiesto = {};
let comprimidos = 0;

for (const archivo of recorrer(ORIGEN)) {
  const ext = path.extname(archivo).toLowerCase();
  if (!EXTENSIONES.includes(ext)) continue;
  const sinExt = path.relative(ORIGEN, archivo).split(path.sep).join("/").slice(0, -ext.length);
  const video = path.join(DESTINO, `${sinExt}.mp4`);
  const poster = path.join(DESTINO, `${sinExt}.jpg`);
  fs.mkdirSync(path.dirname(video), { recursive: true });

  if (masNuevo(archivo, video)) {
    console.log(`Comprimiendo ${sinExt}...`);
    ejecutar([
      "-i", archivo,
      "-map", "0:v:0", "-map", "0:a:0?",
      "-vf", `scale='min(${ANCHO_MAX},iw)':-2:flags=lanczos,format=yuv420p`,
      "-c:v", "libx264", "-preset", "slow", "-crf", "21", "-maxrate", "5M", "-bufsize", "10M",
      ...audioSegunOrigen(archivo),
      // Pone el índice al principio del archivo para que empiece a reproducirse sin descargarlo entero.
      "-movflags", "+faststart",
      video,
    ]);
    comprimidos++;
  }
  if (masNuevo(video, poster)) {
    ejecutar(["-i", video, "-frames:v", "1", "-q:v", "3", poster]);
  }

  const mb = (fs.statSync(video).size / 1e6).toFixed(1);
  manifiesto[sinExt] = { ...medidas(video), mb: Number(mb) };
  console.log(`${sinExt}: ${(fs.statSync(archivo).size / 1e6).toFixed(0)} MB → ${mb} MB`);
}

for (const ruta of Object.keys(anterior)) {
  if (!manifiesto[ruta]) console.log(`Ya no existe el original de "${ruta}". Puedes borrarlo de videos/ y de R2.`);
}

fs.writeFileSync(MANIFIESTO, JSON.stringify(manifiesto, null, 2) + "\n");
const total = Object.values(manifiesto).reduce((s, v) => s + v.mb, 0);
console.log(`Listo: ${comprimidos} vídeos comprimidos, ${Object.keys(manifiesto).length} en total (${total.toFixed(0)} MB).`);
