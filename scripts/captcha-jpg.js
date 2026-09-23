// Ensucia la casilla del captcha con compresión JPG, para que case con la caja,
// que ya viene así. Los originales limpios están en herramientas/captcha/.
// Cada capa se pinta encima de la caja, se comprime entera (así los artefactos
// se mezclan con el fondo de verdad) y se recorta con su silueta ensanchada y
// suavizada, para que la mancha del JPG alrededor del borde entre también.
// Uso: npm run captcha-jpg  (CALIDAD más baja = más roto)
const sharp = require("sharp");
const path = require("path");

const CALIDAD = 18;   // calidad del JPG, de 1 a 100
const PASADAS = 2;    // cuántas veces se recomprime
const ESCALA = 0.6;   // se reduce y se vuelve a ampliar antes, para emborronar
const HALO = 7;       // px que se ensancha la silueta para meter los artefactos

const raiz = path.join(__dirname, "..");
const caja = path.join(raiz, "src/img/captcha-caja.png");
const capas = ["captcha-casilla", "captcha-casilla-hover", "captcha-tick"];

(async () => {
  const { width: ancho, height: alto } = await sharp(caja).metadata();
  for (const nombre of capas) {
    const origen = path.join(raiz, "herramientas/captcha", nombre + ".png");

    // capa encima de la caja, emborronada y comprimida varias veces
    let img = await sharp(caja).composite([{ input: origen }]).png().toBuffer();
    img = await sharp(img).resize(Math.round(ancho * ESCALA), Math.round(alto * ESCALA)).toBuffer();
    img = await sharp(img).resize(ancho, alto).toBuffer();
    for (let i = 0; i < PASADAS; i++) {
      img = await sharp(img).flatten({ background: "#fff" }).jpeg({ quality: CALIDAD, chromaSubsampling: "4:2:0" }).toBuffer();
    }

    // silueta: alfa del original, ensanchada HALO px y con el borde suave
    const { data: a0 } = await sharp(origen).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const alfa = new Float32Array(ancho * alto);
    for (let y = 0; y < alto; y++) for (let x = 0; x < ancho; x++) {
      let m = 0;
      for (let dy = -HALO; dy <= HALO; dy++) for (let dx = -HALO; dx <= HALO; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= ancho || yy >= alto) continue;
        const d = Math.hypot(dx, dy);
        if (d > HALO) continue;
        // el valor cae hacia el borde del halo
        const v = a0[(yy * ancho + xx) * 4 + 3] * Math.min(1, (HALO - d) / (HALO / 2));
        if (v > m) m = v;
      }
      alfa[y * ancho + x] = m;
    }

    const rgb = await sharp(img).removeAlpha().raw().toBuffer();
    const salida = Buffer.alloc(ancho * alto * 4);
    for (let p = 0; p < ancho * alto; p++) {
      salida[p * 4] = rgb[p * 3];
      salida[p * 4 + 1] = rgb[p * 3 + 1];
      salida[p * 4 + 2] = rgb[p * 3 + 2];
      salida[p * 4 + 3] = alfa[p];
    }
    await sharp(salida, { raw: { width: ancho, height: alto, channels: 4 } })
      .png().toFile(path.join(raiz, "src/img", nombre + ".png"));
    console.log(nombre);
  }
})();
