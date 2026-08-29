// Generate PWA icons from SVG via sharp (vector-quality anti-aliasing).
const sharp = require('sharp');
const fs = require('fs');

const GOLD = '#ECA560', GOLD_HI = '#FAE4A0', BRONZE = '#7A5E28';
const DARK = '#382A10', OUTLINE = '#0E1116', BG = '#131822';

function bezier(p0, p1, p2, n = 120) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = 1 - t, b = t;
    pts.push([
      a * a * p0[0] + 2 * a * b * p1[0] + b * b * p2[0],
      a * a * p0[1] + 2 * a * b * p1[1] + b * b * p2[1]
    ]);
  }
  return pts;
}

function bladePolygon(extra = 0) {
  const pts = bezier([-10, -40], [140, -230], [30, -430], 120);
  const N = pts.length, right = [], left = [];
  for (let i = 0; i < N; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[Math.min(N - 1, i + 1)];
    const dx = p1[0] - p0[0], dy = p1[1] - p0[1];
    const L = Math.hypot(dx, dy);
    const nx = -dy / L, ny = dx / L;
    const t = i / (N - 1);
    const w = Math.max(1.5, 27 * Math.pow(1 - t, 1.15)) + extra;
    right.push([pts[i][0] + nx * w / 2, pts[i][1] + ny * w / 2]);
    left.push([pts[i][0] - nx * w / 2, pts[i][1] - ny * w / 2]);
  }
  return right.concat(left.reverse());
}

function polyPoints(pts, scale = 1) {
  return pts.map(p => `${(p[0] * scale).toFixed(1)},${(p[1] * scale).toFixed(1)}`).join(' ');
}

function tipGeom() {
  const edge = bezier([-10, -40], [140, -230], [30, -430], 120);
  const [tx, ty] = edge[edge.length - 1];
  const [px, py] = edge[edge.length - 12];
  const dx = tx - px, dy = ty - py;
  const L = Math.hypot(dx, dy);
  return { tx, ty, ux: dx / L, uy: dy / L };
}

function buildSVG(maskable) {
  const { tx, ty, ux, uy } = tipGeom();
  const nx = -uy, ny = ux;
  const apex = [tx + ux * 36, ty + uy * 36];
  const apexOut = [tx + ux * 42, ty + uy * 42];
  const b1 = [tx - nx * 12, ty - ny * 6];
  const b2 = [tx + nx * 12, ty - ny * 6];

  const scale = maskable ? 0.74 : 0.95;
  const blade = polyPoints(bladePolygon(0), scale);
  const bladeOut = polyPoints(bladePolygon(8), scale);
  const grip = polyPoints([[-13, -18], [13, -18], [9, 150], [-9, 150]], scale);
  const gripOut = polyPoints([[-19, -18], [19, -18], [13, 158], [-13, 158]], scale);
  const tip = polyPoints([apex, b1, b2], scale);
  const tipOut = polyPoints([apexOut, b1, b2], scale);
  const wrap = [0.25, 0.5, 0.75].map(t => {
    const y = -18 + t * 168;
    const w = 13 * (1 - t * 0.35);
    return `<line x1="${-w * scale}" y1="${y * scale}" x2="${w * scale}" y2="${y * scale}" stroke="#5C461A" stroke-width="8" stroke-linecap="round"/>`;
  }).join('');

  const innerFill = maskable
    ? `<path d="M512,0 L1024,0 L1024,1024 L512,1024 Z M0,1024 L0,0 L512,0 Z" fill="${BG}"/>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <defs>
    <radialGradient id="glow" cx="50%" cy="50%" r="55%">
      <stop offset="0%" stop-color="#D9A83B" stop-opacity="0.20"/>
      <stop offset="45%" stop-color="#D9A83B" stop-opacity="0.10"/>
      <stop offset="100%" stop-color="#D9A83B" stop-opacity="0"/>
    </radialGradient>
    <filter id="soft" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="46"/>
    </filter>
  </defs>
  <rect width="1024" height="1024" fill="${BG}"/>
  ${maskable ? '<path d="M0,0 H1024 V1024 H0 Z" fill="none" stroke="rgba(255,255,255,0.03)" stroke-width="2"/>' : ''}
  <ellipse cx="512" cy="512" rx="560" ry="560" fill="url(#glow)"/>
  <g transform="translate(512,512) rotate(-36)">
    <polygon points="${bladeOut}" fill="${OUTLINE}"/>
    <polygon points="${blade}" fill="${GOLD}"/>
    <polygon points="${tipOut}" fill="${OUTLINE}"/>
    <polygon points="${tip}" fill="${GOLD}"/>
    <rect x="${-94 * scale}" y="${-50 * scale}" width="${188 * scale}" height="${32 * scale}" rx="16" fill="${OUTLINE}"/>
    <rect x="${-88 * scale}" y="${-45 * scale}" width="${176 * scale}" height="${27 * scale}" rx="13" fill="${BRONZE}"/>
    <polygon points="${gripOut}" fill="${OUTLINE}"/>
    <polygon points="${grip}" fill="${DARK}"/>
    ${wrap}
    <circle cx="0" cy="${174 * scale}" r="${32 * scale}" fill="${OUTLINE}"/>
    <circle cx="0" cy="${174 * scale}" r="${24 * scale}" fill="${GOLD}"/>
    <circle cx="0" cy="${174 * scale}" r="${12 * scale}" fill="${GOLD_HI}"/>
  </g>
  <circle cx="512" cy="512" r="452" fill="none" stroke="#D9A83B" stroke-opacity="0.38" stroke-width="13"/>
</svg>`;
}

async function render(size, maskable, out) {
  const svg = Buffer.from(buildSVG(maskable));
  await sharp(svg, { density: 384 })
    .resize(size, size, { kernel: 'lanczos3' })
    .png()
    .toFile(out);
  console.log('written', out);
}

(async () => {
  fs.mkdirSync('icons', { recursive: true });
  await render(192, false, 'icons/icon-192.png');
  await render(512, false, 'icons/icon-512.png');
  await render(512, true, 'icons/maskable-512.png');
})();
