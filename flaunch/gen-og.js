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

const icon = (tx, ty, s) => `<g transform="translate(${tx},${ty}) scale(${s})">
  <polygon points="${starPoints(400, 212, 56, 22)}" fill="${GOLD_BRIGHT}"/>
  <path d="M400,330 C355,298 295,294 252,312 L252,448 C295,432 355,436 400,466 Z" fill="${GOLD}"/>
  <path d="M400,330 C445,298 505,294 548,312 L548,448 C505,432 445,436 400,466 Z" fill="${GOLD}"/>
  <line x1="400" y1="332" x2="400" y2="464" stroke="${INDIGO_DARK}" stroke-width="9"/>
</g>`;

const stars = [[980, 120, 12], [1080, 230, 8], [1130, 90, 10], [900, 300, 7], [1050, 380, 9], [1160, 320, 7]]
  .map(([x, y, r]) => `<polygon points="${starPoints(x, y, r, r * 0.4)}" fill="${GOLD_BRIGHT}" opacity="0.7"/>`).join("\n");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs><radialGradient id="bg" cx="28%" cy="38%" r="95%">
    <stop offset="0%" stop-color="${INDIGO_MID}"/><stop offset="100%" stop-color="${INDIGO_DARK}"/>
  </radialGradient></defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  ${stars}
  ${icon(-60, 80, 0.62)}
  <text x="430" y="300" font-family="DejaVu Sans" font-weight="bold" font-size="150" letter-spacing="18" fill="${GOLD}">LORE</text>
  <text x="437" y="370" font-family="DejaVu Sans" font-size="40" fill="#CFC9EE">Every legend starts somewhere.</text>
  <text x="437" y="438" font-family="DejaVu Sans" font-size="28" fill="#8F86C9">Live onchain creator-fee transparency · Base</text>
  <rect x="437" y="476" width="326" height="58" rx="29" fill="none" stroke="${GOLD}" stroke-width="2"/>
  <text x="600" y="514" text-anchor="middle" font-family="DejaVu Sans" font-weight="bold" font-size="26" fill="${GOLD_BRIGHT}">lore-claims.vercel.app</text>
</svg>`;

const png = await sharp(Buffer.from(svg)).png().toBuffer();
writeFileSync("lore-claims/og.png", png);
console.log(`lore-claims/og.png written (${png.length} bytes, 1200x630)`);
