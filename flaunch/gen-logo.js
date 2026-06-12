import sharp from "sharp";
import { writeFileSync } from "fs";

const GOLD = "#E9B824";
const GOLD_BRIGHT = "#FFD95A";
const INDIGO_DARK = "#171338";
const INDIGO_MID = "#2A2566";

// 5-point star polygon centered at (cx, cy)
function starPoints(cx, cy, outer, inner) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(" ");
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
  <defs>
    <radialGradient id="bg" cx="50%" cy="42%" r="65%">
      <stop offset="0%" stop-color="${INDIGO_MID}"/>
      <stop offset="100%" stop-color="${INDIGO_DARK}"/>
    </radialGradient>
  </defs>

  <!-- dark indigo circle with gold ring -->
  <circle cx="400" cy="400" r="386" fill="url(#bg)" stroke="${GOLD}" stroke-width="10"/>

  <!-- gold star above the book -->
  <polygon points="${starPoints(400, 212, 56, 22)}" fill="${GOLD_BRIGHT}"/>

  <!-- gold open book -->
  <g>
    <!-- left page -->
    <path d="M400,330 C355,298 295,294 252,312 L252,448 C295,432 355,436 400,466 Z" fill="${GOLD}"/>
    <!-- right page -->
    <path d="M400,330 C445,298 505,294 548,312 L548,448 C505,432 445,436 400,466 Z" fill="${GOLD}"/>
    <!-- page detail lines -->
    <path d="M286,340 C320,332 355,336 380,352 M286,372 C320,364 355,368 380,384 M286,404 C320,396 355,400 380,416" stroke="${INDIGO_DARK}" stroke-width="7" fill="none" stroke-linecap="round"/>
    <path d="M514,340 C480,332 445,336 420,352 M514,372 C480,364 445,368 420,384 M514,404 C480,396 445,400 420,416" stroke="${INDIGO_DARK}" stroke-width="7" fill="none" stroke-linecap="round"/>
    <!-- spine -->
    <line x1="400" y1="332" x2="400" y2="464" stroke="${INDIGO_DARK}" stroke-width="9"/>
  </g>

  <!-- wordmark -->
  <text x="412" y="624" text-anchor="middle" font-family="DejaVu Sans" font-weight="bold" font-size="104" letter-spacing="22" fill="${GOLD}">LORE</text>
</svg>`;

const png = await sharp(Buffer.from(svg)).png().toBuffer();
writeFileSync("logo.png", png);
console.log(`logo.png written (${png.length} bytes)`);
