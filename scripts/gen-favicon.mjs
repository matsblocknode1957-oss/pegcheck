// Generates public/apple-touch-icon.png and public/favicon.ico from SVG source.
// Run once: node scripts/gen-favicon.mjs
import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// ── SVG sources ───────────────────────────────────────────────────────────────

const appleSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
  <rect width="180" height="180" rx="36" fill="#0f172a"/>
  <text x="90" y="102" text-anchor="middle" dominant-baseline="middle"
    fill="white" font-size="76" font-weight="800" font-family="Arial, Helvetica, sans-serif">P&#x2713;</text>
</svg>`;

const icoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
  <rect width="32" height="32" rx="4" fill="#0f172a"/>
  <text x="16" y="19" text-anchor="middle" dominant-baseline="middle"
    fill="white" font-size="13" font-weight="800" font-family="Arial, Helvetica, sans-serif">P&#x2713;</text>
</svg>`;

// ── apple-touch-icon.png (180x180) ────────────────────────────────────────────
const applePng = await sharp(Buffer.from(appleSvg)).resize(180, 180).png().toBuffer();
writeFileSync(join(root, 'public', 'apple-touch-icon.png'), applePng);
console.log('✓ public/apple-touch-icon.png');

// ── favicon.ico (32x32 PNG wrapped in ICO container) ─────────────────────────
const ico32 = await sharp(Buffer.from(icoSvg)).resize(32, 32).png().toBuffer();

// ICO format: 6-byte ICONDIR + 16-byte ICONDIRENTRY + PNG data
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);   // reserved
header.writeUInt16LE(1, 2);   // type 1 = ICO
header.writeUInt16LE(1, 4);   // 1 image

const entry = Buffer.alloc(16);
entry.writeUInt8(32, 0);          // width
entry.writeUInt8(32, 1);          // height
entry.writeUInt8(0, 2);           // color count (0 = truecolor)
entry.writeUInt8(0, 3);           // reserved
entry.writeUInt16LE(1, 4);        // color planes
entry.writeUInt16LE(32, 6);       // bits per pixel
entry.writeUInt32LE(ico32.length, 8);  // size of image data
entry.writeUInt32LE(22, 12);      // offset to image data (6 + 16)

writeFileSync(join(root, 'public', 'favicon.ico'), Buffer.concat([header, entry, ico32]));
console.log('✓ public/favicon.ico');

// ── icon-192.png (192×192) ────────────────────────────────────────────────────
const icon192Svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192" width="192" height="192">
  <rect width="192" height="192" rx="38" fill="#0f172a"/>
  <text x="96" y="109" text-anchor="middle" dominant-baseline="middle"
    fill="white" font-size="81" font-weight="800" font-family="Arial, Helvetica, sans-serif">P&#x2713;</text>
</svg>`;
const icon192Png = await sharp(Buffer.from(icon192Svg)).resize(192, 192).png().toBuffer();
writeFileSync(join(root, 'public', 'icons', 'icon-192.png'), icon192Png);
console.log('✓ public/icons/icon-192.png');

// ── icon-512.png (512×512) ────────────────────────────────────────────────────
const icon512Svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" rx="102" fill="#0f172a"/>
  <text x="256" y="290" text-anchor="middle" dominant-baseline="middle"
    fill="white" font-size="216" font-weight="800" font-family="Arial, Helvetica, sans-serif">P&#x2713;</text>
</svg>`;
const icon512Png = await sharp(Buffer.from(icon512Svg)).resize(512, 512).png().toBuffer();
writeFileSync(join(root, 'public', 'icons', 'icon-512.png'), icon512Png);
console.log('✓ public/icons/icon-512.png');

// ── icon-maskable-512.png (512×512, full-bleed, content within safe zone) ─────
const iconMaskable512Svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" fill="#0f172a"/>
  <text x="256" y="290" text-anchor="middle" dominant-baseline="middle"
    fill="white" font-size="172" font-weight="800" font-family="Arial, Helvetica, sans-serif">P&#x2713;</text>
</svg>`;
const iconMaskable512Png = await sharp(Buffer.from(iconMaskable512Svg)).resize(512, 512).png().toBuffer();
writeFileSync(join(root, 'public', 'icons', 'icon-maskable-512.png'), iconMaskable512Png);
console.log('✓ public/icons/icon-maskable-512.png');
