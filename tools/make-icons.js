// Renders the app icons from the same d20 mark used by favicon.svg and the
// sidebar brand: an accent disc with the d20 silhouette knocked out of it.
// Run by hand:  node tools/make-icons.js
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const OUT = path.join(__dirname, "..", "assets");
fs.mkdirSync(OUT, { recursive: true });

const ACCENT = [0x22, 0xc5, 0x5e];   // --accent in dark mode
const BG     = [0x0e, 0x0f, 0x11];   // --bg in dark mode

// The mark, in the 40x40 space favicon.svg uses
const C = { x: 20, y: 20, r: 19 };
const HEX = [[20,6],[32.1,13],[32.1,27],[20,34],[7.9,27],[7.9,13]];
const STROKE = 2.4;

// distance from a point to a line segment
function distSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx*dx + dy*dy;
  let t = len2 ? ((px-ax)*dx + (py-ay)*dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t*dx, cy = ay + t*dy;
  return Math.hypot(px-cx, py-cy);
}
// distance to the hexagon outline (its closest edge)
function distHex(px, py) {
  let d = Infinity;
  for (let i = 0; i < HEX.length; i++) {
    const a = HEX[i], b = HEX[(i+1) % HEX.length];
    d = Math.min(d, distSeg(px, py, a[0], a[1], b[0], b[1]));
  }
  return d;
}

// One icon. `markScale` is how much of the canvas the disc fills, leaving the
// rest as padding: maskable icons need their content inside a safe circle.
function render(size, markScale, transparentBg) {
  const SS = 4;                        // supersample for smooth edges
  const px = Buffer.alloc(size * size * 4);
  const span = 40 / markScale;         // world units across the canvas
  const originX = 20 - span/2, originY = 20 - span/2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let hit = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const wx = originX + ((x + (sx+0.5)/SS) / size) * span;
          const wy = originY + ((y + (sy+0.5)/SS) / size) * span;
          const inDisc = Math.hypot(wx-C.x, wy-C.y) <= C.r;
          const onHex  = distHex(wx, wy) <= STROKE/2;
          if (inDisc && !onHex) hit++;          // disc minus the knockout
        }
      }
      const a = hit / (SS*SS);
      const i = (y*size + x) * 4;
      // composite the accent mark over the background
      for (let ch = 0; ch < 3; ch++) px[i+ch] = Math.round(ACCENT[ch]*a + BG[ch]*(1-a));
      px[i+3] = transparentBg ? Math.round(255*a) : 255;
      if (transparentBg && a > 0) for (let ch = 0; ch < 3; ch++) px[i+ch] = ACCENT[ch];
    }
  }
  return px;
}

// ---- minimal PNG encoder ----
const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return buf => {
    let c = -1;
    for (const b of buf) c = t[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
  };
})();
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(CRC(body));
  return Buffer.concat([len, body, crc]);
}
function png(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;   // 8-bit RGBA
  const raw = Buffer.alloc(size * (size*4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y*(size*4+1)] = 0;                                              // filter: none
    rgba.copy(raw, y*(size*4+1) + 1, y*size*4, (y+1)*size*4);
  }
  return Buffer.concat([
    Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

const JOBS = [
  // name,                  size, mark scale, transparent
  ["icon-192.png",           192, 0.86, false],
  ["icon-512.png",           512, 0.86, false],
  ["icon-maskable-512.png",  512, 0.62, false],   // mark inside the safe circle
  ["apple-touch-icon.png",   180, 0.86, false]    // iOS draws its own rounding
];
JOBS.forEach(([name, size, scale, transparent]) => {
  const file = path.join(OUT, name);
  fs.writeFileSync(file, png(size, render(size, scale, transparent)));
  console.log(`${name.padEnd(24)} ${size}x${size}  ${(fs.statSync(file).size/1024).toFixed(1)} KB`);
});
