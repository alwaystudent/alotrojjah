import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const publicDir = path.resolve(process.cwd(), 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// 1. Base SVG Icon (512x512)
const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#2D2218" />
      <stop offset="100%" stop-color="#1A130C" />
    </linearGradient>
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FCE196" />
      <stop offset="40%" stop-color="#EAB338" />
      <stop offset="100%" stop-color="#C88A14" />
    </linearGradient>
    <linearGradient id="pageGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFDF9" />
      <stop offset="100%" stop-color="#F2E8D5" />
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#000" flood-opacity="0.35"/>
    </filter>
  </defs>

  <!-- Background rounded squircle -->
  <rect width="512" height="512" rx="108" fill="url(#bgGrad)" />

  <!-- Outer Islamic geometric octagram border -->
  <g filter="url(#shadow)">
    <rect x="106" y="106" width="300" height="300" rx="36" fill="none" stroke="url(#goldGrad)" stroke-width="8" stroke-opacity="0.85" />
    <rect x="106" y="106" width="300" height="300" rx="36" transform="rotate(45 256 256)" fill="none" stroke="url(#goldGrad)" stroke-width="8" stroke-opacity="0.85" />
    
    <!-- Inner golden circle -->
    <circle cx="256" cy="256" r="148" fill="none" stroke="url(#goldGrad)" stroke-width="4" stroke-opacity="0.6" stroke-dasharray="6 6" />

    <!-- Open Holy Quran Pages Motif -->
    <!-- Left page -->
    <path d="M 256 320 C 220 300 170 300 148 316 L 148 206 C 172 190 220 190 256 210 Z" fill="url(#pageGrad)" stroke="#C88A14" stroke-width="4" />
    <!-- Right page -->
    <path d="M 256 320 C 292 300 342 300 364 316 L 364 206 C 340 190 292 190 256 210 Z" fill="url(#pageGrad)" stroke="#C88A14" stroke-width="4" />
    
    <!-- Quran Book Spine / Central fold -->
    <path d="M 256 206 L 256 322" stroke="#C88A14" stroke-width="5" stroke-linecap="round" />

    <!-- Page lines simulation -->
    <line x1="168" y1="225" x2="236" y2="225" stroke="#84715E" stroke-width="3" stroke-linecap="round" stroke-opacity="0.5" />
    <line x1="168" y1="245" x2="236" y2="245" stroke="#84715E" stroke-width="3" stroke-linecap="round" stroke-opacity="0.5" />
    <line x1="168" y1="265" x2="236" y2="265" stroke="#84715E" stroke-width="3" stroke-linecap="round" stroke-opacity="0.5" />
    <line x1="168" y1="285" x2="224" y2="285" stroke="#84715E" stroke-width="3" stroke-linecap="round" stroke-opacity="0.5" />

    <line x1="276" y1="225" x2="344" y2="225" stroke="#84715E" stroke-width="3" stroke-linecap="round" stroke-opacity="0.5" />
    <line x1="276" y1="245" x2="344" y2="245" stroke="#84715E" stroke-width="3" stroke-linecap="round" stroke-opacity="0.5" />
    <line x1="276" y1="265" x2="344" y2="265" stroke="#84715E" stroke-width="3" stroke-linecap="round" stroke-opacity="0.5" />
    <line x1="288" y1="285" x2="344" y2="285" stroke="#84715E" stroke-width="3" stroke-linecap="round" stroke-opacity="0.5" />

    <!-- Golden Crown Sparkle / Light of Mishkat on top -->
    <circle cx="256" cy="162" r="14" fill="url(#goldGrad)" />
    <polygon points="256,134 261,152 278,162 261,172 256,190 251,172 234,162 251,152" fill="url(#goldGrad)" opacity="0.9" />

    <!-- Base Book Stand (Rihal) -->
    <path d="M 216 332 L 180 372 M 296 332 L 332 372" stroke="url(#goldGrad)" stroke-width="8" stroke-linecap="round" />
  </g>
</svg>`;

// 2. Maskable SVG Icon (Safe zone inside central 80%)
const maskableSvgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#2D2218" />
      <stop offset="100%" stop-color="#1A130C" />
    </linearGradient>
    <linearGradient id="goldGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FCE196" />
      <stop offset="40%" stop-color="#EAB338" />
      <stop offset="100%" stop-color="#C88A14" />
    </linearGradient>
    <linearGradient id="pageGrad2" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFDF9" />
      <stop offset="100%" stop-color="#F2E8D5" />
    </linearGradient>
  </defs>

  <!-- Full-bleed background -->
  <rect width="512" height="512" fill="url(#bgGrad2)" />

  <!-- Content scaled to safe 74% zone (centered at 256,256) -->
  <g transform="translate(66.56, 66.56) scale(0.74)">
    <rect x="106" y="106" width="300" height="300" rx="36" fill="none" stroke="url(#goldGrad2)" stroke-width="10" stroke-opacity="0.85" />
    <rect x="106" y="106" width="300" height="300" rx="36" transform="rotate(45 256 256)" fill="none" stroke="url(#goldGrad2)" stroke-width="10" stroke-opacity="0.85" />
    <circle cx="256" cy="256" r="148" fill="none" stroke="url(#goldGrad2)" stroke-width="5" stroke-opacity="0.6" stroke-dasharray="6 6" />

    <path d="M 256 320 C 220 300 170 300 148 316 L 148 206 C 172 190 220 190 256 210 Z" fill="url(#pageGrad2)" stroke="#C88A14" stroke-width="5" />
    <path d="M 256 320 C 292 300 342 300 364 316 L 364 206 C 340 190 292 190 256 210 Z" fill="url(#pageGrad2)" stroke="#C88A14" stroke-width="5" />
    <path d="M 256 206 L 256 322" stroke="#C88A14" stroke-width="6" stroke-linecap="round" />

    <circle cx="256" cy="162" r="15" fill="url(#goldGrad2)" />
    <polygon points="256,134 261,152 278,162 261,172 256,190 251,172 234,162 251,152" fill="url(#goldGrad2)" />
    <path d="M 216 332 L 180 372 M 296 332 L 332 372" stroke="url(#goldGrad2)" stroke-width="9" stroke-linecap="round" />
  </g>
</svg>`;

async function run() {
  fs.writeFileSync(path.join(publicDir, 'icon.svg'), svgIcon, 'utf-8');
  console.log('Written public/icon.svg');

  const svgBuffer = Buffer.from(svgIcon);
  const maskableSvgBuffer = Buffer.from(maskableSvgIcon);

  await sharp(svgBuffer)
    .resize(192, 192)
    .png()
    .toFile(path.join(publicDir, 'pwa-192x192.png'));
  console.log('Generated public/pwa-192x192.png');

  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'pwa-512x512.png'));
  console.log('Generated public/pwa-512x512.png');

  await sharp(svgBuffer)
    .resize(180, 180)
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));
  console.log('Generated public/apple-touch-icon.png');

  await sharp(maskableSvgBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'pwa-maskable-512x512.png'));
  console.log('Generated public/pwa-maskable-512x512.png');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
