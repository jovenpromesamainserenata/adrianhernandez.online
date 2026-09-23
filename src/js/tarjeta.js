// Tarjeta que gira (Juguete, 18/09/2026).
// Sola gira despacio sobre su eje inclinado, para que se vea que tiene dos caras
// y que se puede mover. Arrastrando (ratón o dedo) se gira hacia cualquier lado,
// como una bola; al soltar sigue con el impulso y poco a poco vuelve a su postura
// inclinada y al giro lento.
//
// La postura se guarda como un cuaternión [w, x, y, z]: una forma de apuntar una
// rotación en 3D que se puede ir sumando sin que se desordene. Los ejes son los del CSS:
// x a la derecha, y hacia abajo, z hacia quien mira.
(function () {
  const G = Math.PI / 180;
  const reducir = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const CRUCERO = reducir ? 0 : 0.02 * G;  // giro solo, por milisegundo (18 s por vuelta)
  const SENSIBILIDAD = 0.5 * G;            // giro por píxel arrastrado
  const FRENO = 0.003;                     // lo rápido que vuelve al giro lento tras soltar
  const ENDEREZAR = 0.0015;                // lo rápido que vuelve a su inclinación tras soltar

  const multiplicar = (a, b) => [
    a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
    a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
    a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
    a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0],
  ];
  const normalizar = (q) => {
    const n = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
    return q.map((v) => v / n);
  };
  const inverso = (q) => [q[0], -q[1], -q[2], -q[3]];
  // Giro de `angulo` radianes alrededor del eje (x, y, z).
  const giro = (x, y, z, angulo) => {
    const n = Math.hypot(x, y, z) || 1;
    const s = Math.sin(angulo / 2);
    return [Math.cos(angulo / 2), (x / n) * s, (y / n) * s, (z / n) * s];
  };
  const matriz = ([w, x, y, z]) =>
    "matrix3d(" +
    [
      1 - 2 * (y * y + z * z), 2 * (x * y + w * z), 2 * (x * z - w * y), 0,
      2 * (x * y - w * z), 1 - 2 * (x * x + z * z), 2 * (y * z + w * x), 0,
      2 * (x * z + w * y), 2 * (y * z - w * x), 1 - 2 * (x * x + y * y), 0,
      0, 0, 0, 1,
    ].join(",") +
    ")";

  let viva = true;  // se apaga al irse de la ficha sin recargar (navegacion.js)
  const observadores = [];
  (window.__limpiezas ||= []).push(function () {
    viva = false;
    observadores.forEach((o) => o.disconnect());
  });

  document.querySelectorAll("[data-tarjeta]").forEach(function (marco) {
    const tarjeta = marco.querySelector(".tarjeta");

    // Postura de reposo: inclinada en diagonal (--tarjeta-inclinacion en el CSS).
    // Su eje de giro es el vertical de la tarjeta, inclinado igual.
    const inclinacion = (parseFloat(getComputedStyle(marco).getPropertyValue("--tarjeta-inclinacion")) || 0) * G;
    const reposo = giro(0, 0, 1, inclinacion);
    const eje = [-Math.sin(inclinacion), Math.cos(inclinacion), 0];
    const crucero = eje.map((v) => v * CRUCERO);

    let postura = reposo;
    let velocidad = crucero.slice();  // eje de giro por su rapidez, por milisegundo
    let arrastrando = false;
    let x = 0, y = 0, t = 0;
    let visible = true;

    marco.addEventListener("pointerdown", function (e) {
      arrastrando = true;
      x = e.clientX;
      y = e.clientY;
      t = e.timeStamp;
      velocidad = [0, 0, 0];
      marco.setPointerCapture(e.pointerId);
      marco.classList.add("es-arrastrando");
    });
    marco.addEventListener("pointermove", function (e) {
      if (!arrastrando) return;
      const dx = e.clientX - x;
      const dy = e.clientY - y;
      const dt = Math.max(e.timeStamp - t, 1);
      x = e.clientX;
      y = e.clientY;
      t = e.timeStamp;
      const distancia = Math.hypot(dx, dy);
      if (!distancia) return;
      // Se gira alrededor del eje perpendicular al movimiento, como al empujar una bola.
      const angulo = distancia * SENSIBILIDAD;
      postura = normalizar(multiplicar(giro(-dy, dx, 0, angulo), postura));
      const nueva = [-dy / distancia, dx / distancia, 0].map((v) => (v * angulo) / dt);
      velocidad = velocidad.map((v, i) => v + (nueva[i] - v) * 0.6);
      pintar();
    });
    const soltar = function (e) {
      if (!arrastrando) return;
      arrastrando = false;
      // Si se quedó quieta antes de soltar, no hay impulso.
      if (e.timeStamp - t > 80) velocidad = [0, 0, 0];
      marco.classList.remove("es-arrastrando");
    };
    marco.addEventListener("pointerup", soltar);
    marco.addEventListener("pointercancel", soltar);
    // Las imágenes no se arrastran como archivo.
    marco.addEventListener("dragstart", (e) => e.preventDefault());

    // Fuera de la pantalla no hace falta moverla.
    const observador = new IntersectionObserver(function (entradas) {
      visible = entradas[0].isIntersecting;
    });
    observador.observe(marco);
    observadores.push(observador);

    function pintar() {
      tarjeta.style.transform = matriz(postura);
    }

    // Vuelve poco a poco a la inclinación de reposo sin cambiar la cara que enseña:
    // se quita la parte del giro que no es alrededor de su eje.
    function enderezar(k) {
      const r = multiplicar(postura, inverso(reposo));
      const p = r[1] * eje[0] + r[2] * eje[1] + r[3] * eje[2];
      let meta = normalizar([r[0], eje[0] * p, eje[1] * p, eje[2] * p]);
      if (r[0] * meta[0] + r[1] * meta[1] + r[2] * meta[2] + r[3] * meta[3] < 0) meta = meta.map((v) => -v);
      const mezcla = normalizar(r.map((v, i) => v + (meta[i] - v) * k));
      postura = normalizar(multiplicar(mezcla, reposo));
    }

    let antes = performance.now();
    function paso(ahora) {
      const dt = Math.min(ahora - antes, 50);
      antes = ahora;
      if (visible && !arrastrando) {
        const k = Math.min(FRENO * dt, 1);
        velocidad = velocidad.map((v, i) => v + (crucero[i] - v) * k);
        const rapidez = Math.hypot(velocidad[0], velocidad[1], velocidad[2]);
        if (rapidez) postura = normalizar(multiplicar(giro(velocidad[0], velocidad[1], velocidad[2], rapidez * dt), postura));
        enderezar(Math.min(ENDEREZAR * dt, 1));
        pintar();
      }
      if (viva) requestAnimationFrame(paso);
    }
    pintar();
    requestAnimationFrame(paso);
  });
})();
