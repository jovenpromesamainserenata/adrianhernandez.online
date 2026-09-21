// Dibuja una pelota de tenis. Fue la de la ficha de Joven Promesa Main Serenata
// hasta el 20/09/2026, cuando Adrián la cambió por la foto recortada
// (herramientas/pelota-foto.png). Se guarda en herramientas/ para no pisar la foto:
// si se quiere volver a la dibujada, se copia sobre
// originales/joven-promesa-main-serenata/pelota.png y se pasa npm run imagenes.
// Solo la superficie: fieltro y costuras, sin luces (las luces las pone el CSS y
// cambian según dónde esté la pelota, ver src/js/pelota.js).
// Se guarda en originales/ y de ahí sale el webp con `npm run imagenes`.
//
//   npm run pelota
//
// Amarillo lima como el acento de la web (--amarillo) y costuras finas, poco
// brillantes, con la forma de la pelota de referencia de Adrián (20/09/2026).
// Sin pelusa en el borde: se probó y no le gustó.
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const DESTINO = "herramientas/pelota-dibujada.png";
const LADO = 320;
const RADIO = LADO * 0.49;   // el círculo, casi todo el lienzo
const FILO = 1.2;            // píxeles de suavizado del borde

// Fieltro: del lima de la web a un amarillo verdoso más apagado.
const CLARO = [236, 255, 96];
const OSCURO = [188, 234, 0];
// Costura: gris muy claro con una pizca de azul. Nada de blanco puro: con la luz
// encima brillaba demasiado (Adrián, 20/09/2026).
const COSTURA = [208, 219, 215];

// Ruido de valor: números al azar en una rejilla, suavizados entre celda y celda.
const azar = (x, y, s) => {
  let n = (x * 374761393 + y * 668265263 + s * 1274126177) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
};
const suave = (t) => t * t * (3 - 2 * t);
function ruido(x, y, s) {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = suave(x - x0), fy = suave(y - y0);
  const a = azar(x0, y0, s), b = azar(x0 + 1, y0, s);
  const c = azar(x0, y0 + 1, s), d = azar(x0 + 1, y0 + 1, s);
  return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
}
// Varias capas de ruido, cada una más fina y con menos peso: el grano del fieltro.
function grano(x, y, s) {
  let v = 0, peso = 0, escala = 1;
  for (let i = 0; i < 4; i++) {
    v += ruido(x * escala, y * escala, s + i) * (1 / escala);
    peso += 1 / escala;
    escala *= 2.3;
  }
  return v / peso;
}
// Hebras: el mismo ruido estirado en tres direcciones, que es lo que da el pelo
// entrelazado del fieltro en vez de una textura de manchas.
function hebras(x, y, s) {
  let v = 0;
  for (let k = 0; k < 3; k++) {
    const a = (k * Math.PI) / 3 + 0.4;
    const ca = Math.cos(a), sa = Math.sin(a);
    v = Math.max(v, ruido(x * ca + y * sa, (-x * sa + y * ca) * 8, s + k * 13));
  }
  return v;
}

// Las dos costuras: arcos de circunferencia con el centro al otro lado de la pelota,
// que es lo que las deja cerca de los polos y curvadas como en la referencia
// (la de arriba, más baja por el centro que por los lados; la de abajo al revés).
const SEPARACION = 1.2;    // a qué distancia del centro está el centro del arco
const ARCO = 0.65;         // radio del arco, en radios de pelota
const GROSOR = 0.038;      // medio ancho de la costura
function costura(u, v) {
  const arriba = Math.abs(Math.hypot(u, v + SEPARACION) - ARCO);
  const abajo = Math.abs(Math.hypot(u, v - SEPARACION) - ARCO);
  return Math.min(arriba, abajo);
}

const mezclar = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const limitar = (v, min, max) => Math.min(Math.max(v, min), max);

function main() {
  const datos = Buffer.alloc(LADO * LADO * 4);
  const centro = LADO / 2;

  for (let y = 0; y < LADO; y++) {
    for (let x = 0; x < LADO; x++) {
      const i = (y * LADO + x) * 4;
      const dx = x + 0.5 - centro, dy = y + 0.5 - centro;
      const d = Math.hypot(dx, dy);
      if (d > RADIO + FILO) continue;

      // Coordenadas dentro del círculo (-1 a 1) y curvatura de la esfera.
      const u = dx / RADIO, v = dy / RADIO;
      const plano = Math.min(d / RADIO, 1);
      const canto = Math.sqrt(Math.max(1 - plano * plano, 0));  // 1 en el centro, 0 en el borde
      // Cerca del borde se ve más superficie en menos píxeles: la textura se aprieta.
      const apriete = 1 / (0.3 + 0.7 * canto);

      const tx = u * apriete * 22, ty = v * apriete * 22;
      const fondo = grano(tx, ty, 11);
      const pelo = hebras(tx * 2.1, ty * 2.1, 37);
      const tono = limitar(fondo * 0.4 + pelo * 1.05 - 0.28, 0, 1);
      let color = mezclar(OSCURO, CLARO, tono);

      // Costura: fina, apagada y con el fieltro de al lado comiéndole los bordes.
      const c = costura(u, v);
      const borde = 0.03 / apriete;
      const grosor = GROSOR * (0.5 + 0.5 * canto);   // de canto se ve más estrecha
      if (c < grosor + borde) {
        const dentro = 1 - limitar((c - grosor + borde) / (borde * 2), 0, 1);
        const comida = 0.72 + pelo * 0.45;
        color = mezclar(color, COSTURA, limitar(dentro * comida, 0, 1));
        // Hundida: una sombra fina justo al lado.
        const canal = limitar((c - grosor - borde) / (grosor * 0.9), 0, 1);
        if (c > grosor + borde * 0.5) color = color.map((k) => k * (0.9 + 0.1 * canal));
      }

      datos[i] = limitar(color[0], 0, 255);
      datos[i + 1] = limitar(color[1], 0, 255);
      datos[i + 2] = limitar(color[2], 0, 255);
      datos[i + 3] = Math.round(limitar((RADIO - d) / FILO + 0.5, 0, 1) * 255);
    }
  }

  fs.mkdirSync(path.dirname(DESTINO), { recursive: true });
  sharp(datos, { raw: { width: LADO, height: LADO, channels: 4 } })
    .png()
    .toFile(DESTINO)
    .then(() => console.log(`Listo: ${DESTINO} (${LADO} × ${LADO})`));
}

main();
