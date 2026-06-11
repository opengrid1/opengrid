// Generates logo.png: 800x800, dark indigo circle, gold open book,
// gold star above it, and the word "LORE" below.
const fs = require("fs");
const { PNG } = require("pngjs");

const SIZE = 800;
const png = new PNG({ width: SIZE, height: SIZE });

const BG = [12, 10, 28, 255]; // near-black backdrop
const INDIGO = [49, 46, 129, 255]; // dark indigo circle
const INDIGO_EDGE = [99, 102, 241, 255]; // subtle rim
const GOLD = [212, 175, 55, 255];
const GOLD_BRIGHT = [255, 215, 0, 255];

function setPx(x, y, c) {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
  const i = (SIZE * y + x) << 2;
  png.data[i] = c[0];
  png.data[i + 1] = c[1];
  png.data[i + 2] = c[2];
  png.data[i + 3] = c[3];
}

// background
for (let y = 0; y < SIZE; y++)
  for (let x = 0; x < SIZE; x++) setPx(x, y, BG);

// indigo disc with thin rim
const cx = 400, cy = 400, R = 360;
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const d = Math.hypot(x - cx, y - cy);
    if (d <= R) setPx(x, y, d > R - 6 ? INDIGO_EDGE : INDIGO);
  }
}

function fillRect(x0, y0, w, h, c) {
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++) setPx(x, y, c);
}

function fillPoly(pts, c) {
  const ys = pts.map((p) => p[1]);
  const y0 = Math.floor(Math.min(...ys)), y1 = Math.ceil(Math.max(...ys));
  for (let y = y0; y <= y1; y++) {
    const xs = [];
    for (let i = 0; i < pts.length; i++) {
      const [xa, ya] = pts[i];
      const [xb, yb] = pts[(i + 1) % pts.length];
      if (ya === yb) continue;
      if ((y >= Math.min(ya, yb)) && (y < Math.max(ya, yb))) {
        xs.push(xa + ((y - ya) / (yb - ya)) * (xb - xa));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let x = Math.round(xs[k]); x <= Math.round(xs[k + 1]); x++) setPx(x, y, c);
    }
  }
}

// gold star (5-pointed), centered at (400, 200)
function star(cx, cy, rOuter, rInner, c) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? rOuter : rInner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  fillPoly(pts, c);
}
star(400, 195, 60, 24, GOLD_BRIGHT);

// gold open book, centered around (400, 380)
// left page
fillPoly([[180, 330], [390, 300], [390, 460], [180, 490]], GOLD);
// right page
fillPoly([[410, 300], [620, 330], [620, 490], [410, 460]], GOLD);
// spine
fillRect(390, 300, 20, 162, GOLD_BRIGHT);
// page lines (indigo on gold)
for (let i = 0; i < 4; i++) {
  const y = 350 + i * 30;
  fillPoly([[205, y + 4], [375, y - 8], [375, y - 2], [205, y + 10]], INDIGO);
  fillPoly([[425, y - 8], [595, y + 4], [595, y + 10], [425, y - 2]], INDIGO);
}

// the word LORE in blocky gold letters, baseline area y=540..640
const T = 18; // stroke thickness
const H = 100; // letter height
const top = 545;
function L(x) {
  fillRect(x, top, T, H, GOLD_BRIGHT);
  fillRect(x, top + H - T, 64, T, GOLD_BRIGHT);
}
function O(x) {
  fillRect(x, top, 64, T, GOLD_BRIGHT);
  fillRect(x, top + H - T, 64, T, GOLD_BRIGHT);
  fillRect(x, top, T, H, GOLD_BRIGHT);
  fillRect(x + 64 - T, top, T, H, GOLD_BRIGHT);
}
function Rl(x) {
  fillRect(x, top, T, H, GOLD_BRIGHT); // left stem
  fillRect(x, top, 64, T, GOLD_BRIGHT); // top
  fillRect(x + 64 - T, top, T, 50, GOLD_BRIGHT); // right upper
  fillRect(x, top + 50 - T, 64, T, GOLD_BRIGHT); // mid bar
  // diagonal leg
  for (let i = 0; i < H - 50; i++) {
    fillRect(x + 24 + Math.round((i * (40 - T)) / (H - 50)), top + 50 + i, T, 2, GOLD_BRIGHT);
  }
}
function E(x) {
  fillRect(x, top, T, H, GOLD_BRIGHT);
  fillRect(x, top, 64, T, GOLD_BRIGHT);
  fillRect(x, top + 50 - T / 2, 52, T, GOLD_BRIGHT);
  fillRect(x, top + H - T, 64, T, GOLD_BRIGHT);
}
// center 4 letters: each 64 wide + 28 gap => 4*64+3*28 = 340; start x = 230
L(230);
O(322);
Rl(414);
E(506);

fs.writeFileSync("logo.png", PNG.sync.write(png));
console.log("wrote logo.png");
