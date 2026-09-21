// Borra _site antes de cada build: Eleventy no elimina páginas que ya no existen.
const fs = require("fs");
fs.rmSync("_site", { recursive: true, force: true });
