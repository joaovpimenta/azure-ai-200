/** Generate dependency-free PNG icons required for PWA installation. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

const GLYPHS = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  '2': ['11110', '00001', '00001', '01110', '10000', '10000', '11111'],
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110']
};

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const label = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([label, data])));
  return Buffer.concat([length, label, data, checksum]);
}

function roundedRect(x, y, left, top, right, bottom, radius) {
  if (x < left || x >= right || y < top || y >= bottom) return false;
  const cx = Math.max(left + radius, Math.min(x, right - radius));
  const cy = Math.max(top + radius, Math.min(y, bottom - radius));
  return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
}

function createIcon(size, maskable = false) {
  const pixels = Buffer.alloc(size * size * 4);
  const set = (x, y, rgba) => {
    const offset = (y * size + x) * 4;
    pixels[offset] = rgba[0]; pixels[offset + 1] = rgba[1];
    pixels[offset + 2] = rgba[2]; pixels[offset + 3] = rgba[3];
  };
  const bg = [23, 59, 50, 255];
  const panel = [39, 125, 105, 255];
  const white = [248, 246, 240, 255];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (maskable || roundedRect(x, y, size * .045, size * .045, size * .955, size * .955, size * .17)) set(x, y, bg);
      if (roundedRect(x, y, size * .19, size * .19, size * .81, size * .81, size * .11)) set(x, y, panel);
    }
  }
  const renderLabel = (label, top, cell) => {
    const width = (label.length * 5 + label.length - 1) * cell;
    const x0 = Math.round((size - width) / 2);
    const y0 = Math.round(size * top);
    for (let c = 0; c < label.length; c++) {
      const glyph = GLYPHS[label[c]];
      for (let gy = 0; gy < 7; gy++) {
        for (let gx = 0; gx < 5; gx++) {
          if (glyph[gy][gx] !== '1') continue;
          const left = Math.round(x0 + (c * 6 + gx) * cell);
          const right = Math.round(x0 + (c * 6 + gx + 1) * cell);
          const y1 = Math.round(y0 + gy * cell);
          const y2 = Math.round(y0 + (gy + 1) * cell);
          for (let py = y1; py < y2; py++) for (let px = left; px < right; px++) set(px, py, white);
        }
      }
    }
  };
  renderLabel('AI', .255, size * .038);
  renderLabel('200', .56, size * .024);

  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

export function generatePwaIcons(distDir) {
  const iconsDir = join(distDir, 'icons');
  mkdirSync(iconsDir, { recursive: true });
  for (const size of [192, 512]) {
    writeFileSync(join(iconsDir, 'icon-' + size + '.png'), createIcon(size));
    writeFileSync(join(iconsDir, 'icon-' + size + '-maskable.png'), createIcon(size, true));
  }
  writeFileSync(join(distDir, 'apple-touch-icon.png'), createIcon(180));
}
