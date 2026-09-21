// Prepara la foto de la pelota de tenis para la ficha de Joven Promesa Main Serenata.
//
//   npm run pelota-foto
//
// Parte del recorte a resolución completa (herramientas/pelota-foto.png, la foto
// que pasó Adrián con el fondo de damero ya quitado) y le aplana la luz: la foto
// venía iluminada desde arriba a la izquierda, con su sombra cocida, y eso no
// sirve aquí porque el volumen lo pone el CSS y se mueve según dónde esté la
// pelota en la pantalla (src/js/pelota.js). Lo que queda es el fieltro y las
// costuras, planos, como si la pelota estuviera bajo una luz uniforme.
//
// Cómo: se mide la luz suave de la foto (un desenfoque muy grande, midiendo solo
// el fieltro para que las costuras blancas no manchen la medida) y se le resta,
// dejando el color medio del fieltro. La textura se conserva, y se reescala para
// que en la zona de sombra no quede lavada.
//
// El resultado va a originales/joven-promesa-main-serenata/pelota.png (cuadrado,
// centrado, con un 1 % de aire alrededor) y de ahí sale el webp con `npm run imagenes`.
const sharp = require("sharp");

const ORIGEN = "herramientas/pelota-foto.png";
const DESTINO = process.argv[2] || "originales/joven-promesa-main-serenata/pelota.png";
const LADO = 320;           // lado de la imagen final
const AIRE = 0.98;          // parte del lienzo que ocupa la pelota

const RADIO_LUZ = 0.04;     // desenfoque para medir la luz, respecto al ancho
const COSTURA = 40;         // verde menos azul: por debajo de esto no es fieltro
// Color al que va el fieltro. La foto da un lima apagado y Adrián lo quiere
// fosforito (20/09/2026), cerca del amarillo del acento de la web (#D5FF00). El
// viraje solo toca al fieltro: las costuras se quedan en su gris claro.
const FIELTRO = [224, 252, 0];
const CONTRASTE = [0.7, 1.9];  // límites al reescalado de la textura

const limitar = (v, a, b) => (v < a ? a : v > b ? b : v);

// Desenfoque de caja separable, tres pasadas: se parece bastante a un gaussiano
// y con sumas acumuladas cuesta lo mismo sea cual sea el radio.
function desenfocar(fuente, W, H, r) {
  let datos = fuente;
  for (let pasada = 0; pasada < 3; pasada++) {
    const medio = new Float64Array(W * H);
    for (let y = 0; y < H; y++) {
      let suma = 0;
      const fila = y * W;
      for (let x = 0; x <= r && x < W; x++) suma += datos[fila + x];
      for (let x = 0; x < W; x++) {
        medio[fila + x] = suma;
        const entra = x + r + 1, sale = x - r;
        if (entra < W) suma += datos[fila + entra];
        if (sale >= 0) suma -= datos[fila + sale];
      }
    }
    const salida = new Float64Array(W * H);
    for (let x = 0; x < W; x++) {
      let suma = 0;
      for (let y = 0; y <= r && y < H; y++) suma += medio[y * W + x];
      for (let y = 0; y < H; y++) {
        salida[y * W + x] = suma;
        const entra = y + r + 1, sale = y - r;
        if (entra < H) suma += medio[entra * W + x];
        if (sale >= 0) suma -= medio[sale * W + x];
      }
    }
    datos = salida;
  }
  return datos;
}

const luz = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

async function main() {
  const { data, info } = await sharp(ORIGEN).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, N = W * H;
  const r = Math.round(Math.max(W, H) * RADIO_LUZ);

  // Fieltro: lo que está dentro de la pelota, sin el borde de pelusa y sin las
  // costuras. Es lo único que se mide para saber cómo la iluminaron.
  const dentro = new Float64Array(N);
  const fieltro = new Float64Array(N);
  for (let k = 0; k < N; k++) {
    const o = k * 4;
    if (data[o + 3] < 250) continue;
    dentro[k] = 1;
    if (data[o + 1] - data[o + 2] > COSTURA) fieltro[k] = 1;
  }
  // Se aparta el borde: ahí la pelusa ya mezcla con el fondo.
  const margen = Math.round(Math.max(W, H) * 0.012);
  for (let paso = 0; paso < margen; paso++) {
    const copia = Float64Array.from(dentro);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const k = y * W + x;
      if (!copia[k]) continue;
      const fuera = x === 0 || y === 0 || x === W - 1 || y === H - 1 ||
        !copia[k - 1] || !copia[k + 1] || !copia[k - W] || !copia[k + W];
      if (fuera) dentro[k] = 0;
    }
  }
  for (let k = 0; k < N; k++) if (!dentro[k]) fieltro[k] = 0;

  // Luz suave: media del fieltro en un radio grande. Al dividir por la misma
  // media de la máscara, las costuras y el exterior no cuentan y el valor se
  // extiende solo hacia ellos.
  const canales = [0, 1, 2].map((c) => {
    const v = new Float64Array(N);
    for (let k = 0; k < N; k++) v[k] = fieltro[k] ? data[k * 4 + c] : 0;
    return desenfocar(v, W, H, r);
  });
  const peso = desenfocar(Float64Array.from(fieltro), W, H, r);
  const campo = [new Float64Array(N), new Float64Array(N), new Float64Array(N)];
  for (let k = 0; k < N; k++) {
    const p = peso[k] || 1e-9;
    for (let c = 0; c < 3; c++) campo[c][k] = canales[c][k] / p;
  }

  // Color al que se lleva todo el fieltro: la mediana de la propia foto, así no
  // se aclara ni se oscurece de más.
  const medianas = [0, 1, 2].map((c) => {
    const v = [];
    for (let k = 0; k < N; k++) if (fieltro[k]) v.push(campo[c][k]);
    v.sort((a, b) => a - b);
    return v[Math.floor(v.length / 2)];
  });
  const luzMedia = luz(medianas[0], medianas[1], medianas[2]);
  const viraje = FIELTRO.map((v, i) => v - medianas[i]);

  // Se quita la luz medida y se pone el color medio. La textura se reescala
  // según lo apagada que estuviera esa zona: en la sombra la foto la comprime.
  const salida = Buffer.alloc(N * 4);
  for (let k = 0; k < N; k++) {
    const o = k * 4;
    const luzLocal = luz(campo[0][k], campo[1][k], campo[2][k]) || 1;
    const k2 = limitar(luzMedia / luzLocal, CONTRASTE[0], CONTRASTE[1]);
    // Cuánto tiene el píxel de fieltro (verde menos azul): las costuras no viran.
    const esFieltro = limitar((data[o + 1] - data[o + 2] - 20) / 60, 0, 1);
    for (let c = 0; c < 3; c++) {
      const base = medianas[c] + viraje[c] * esFieltro;
      salida[o + c] = limitar(Math.round(base + (data[o + c] - campo[c][k]) * k2), 0, 255);
    }
    salida[o + 3] = data[o + 3];
  }

  const bola = Math.round(LADO * AIRE);
  const borde = (LADO - bola) / 2;
  const info2 = await sharp(salida, { raw: { width: W, height: H, channels: 4 } })
    .resize({ width: bola, height: bola, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({
      top: Math.floor(borde), bottom: Math.ceil(borde),
      left: Math.floor(borde), right: Math.ceil(borde),
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9 })
    .toFile(DESTINO);

  console.log(`Listo: ${DESTINO} (${info2.width} x ${info2.height}).`);
  console.log(`Fieltro llevado a rgb(${FIELTRO.join(", ")}), medido rgb(${medianas.map((v) => Math.round(v)).join(", ")}).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
