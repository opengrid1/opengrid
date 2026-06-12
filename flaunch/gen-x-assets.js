import sharp from "sharp";
import { writeFileSync } from "fs";

const GOLD = "#E9B824";
const GOLD_BRIGHT = "#FFD95A";
const INDIGO_DARK = "#171338";
const INDIGO_MID = "#2A2566";

function starPoints(cx, cy, outer, inner) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(" ");
}

// Book + star icon group (same geometry as the logo, centered ~(400, 311))
const icon = `
  <polygon points="${starPoints(400, 212, 56, 22)}" fill="${GOLD_BRIGHT}"/>
  <path d="M400,330 C355,298 295,294 252,312 L252,448 C295,432 355,436 400,466 Z" fill="${GOLD}"/>
  <path d="M400,330 C445,298 505,294 548,312 L548,448 C505,432 445,436 400,466 Z" fill="${GOLD}"/>
  <path d="M286,340 C320,332 355,336 380,352 M286,372 C320,364 355,368 380,384 M286,404 C320,396 355,400 380,416" stroke="${INDIGO_DARK}" stroke-width="7" fill="none" stroke-linecap="round"/>
  <path d="M514,340 C480,332 445,336 420,352 M514,372 C480,364 445,368 420,384 M514,404 C480,396 445,400 420,416" stroke="${INDIGO_DARK}" stroke-width="7" fill="none" stroke-linecap="round"/>
  <line x1="400" y1="332" x2="400" y2="464" stroke="${INDIGO_DARK}" stroke-width="9"/>
`;

const scatter = [
  [1100, 110, 13, 0.8], [1265, 295, 9, 0.55], [1390, 170, 15, 0.9],
  [1185, 420, 8, 0.5], [1430, 405, 11, 0.7], [1055, 255, 7, 0.45],
  [1330, 60, 7, 0.5], [1470, 280, 8, 0.6],
]
  .map(([x, y, r, o]) => `<polygon points="${starPoints(x, y, r, r * 0.4)}" fill="${GOLD_BRIGHT}" opacity="${o}"/>`)
  .join("\n  ");

const banner = `<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="500" viewBox="0 0 1500 500">
  <defs>
    <radialGradient id="bg" cx="30%" cy="40%" r="90%">
      <stop offset="0%" stop-color="${INDIGO_MID}"/>
      <stop offset="100%" stop-color="${INDIGO_DARK}"/>
    </radialGradient>
  </defs>
  <rect width="1500" height="500" fill="url(#bg)"/>
  ${scatter}
  <g transform="translate(-90, -30) scale(0.9)">${icon}</g>
  <text x="480" y="300" font-family="DejaVu Sans" font-weight="bold" font-size="150" letter-spacing="20" fill="${GOLD}">LORE</text>
  <text x="487" y="365" font-family="DejaVu Sans" font-size="36" fill="#CFC9EE">Every legend starts somewhere.</text>
  <text x="487" y="420" font-family="DejaVu Sans" font-size="27" fill="#8F86C9">$LORE · Base mainnet · flaunch.gg</text>
</svg>`;

const bannerPng = await sharp(Buffer.from(banner)).png().toBuffer();
writeFileSync("x-banner.png", bannerPng);
console.log(`x-banner.png written (${bannerPng.length} bytes, 1500x500)`);

const avatarPng = await sharp("logo.png").resize(400, 400).png().toBuffer();
writeFileSync("x-avatar.png", avatarPng);
console.log(`x-avatar.png written (${avatarPng.length} bytes, 400x400)`);
