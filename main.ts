// news-image-20261119 — "The World in One Day", Thursday 19 November 2026.
// A newspaper front page drawn entirely in code: five stories, one day.
// No assets, no network. Node 22, standard library only.
// The PNG writer and the 5x7 letterforms below are written for this entry;
// running the program twice writes byte-identical files.

const { mkdirSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");
const { deflateSync } = require("node:zlib");

// ---- CRC-32 (IEEE) ---------------------------------------------------------
// Table built once from the reversed polynomial; the checksum covers each
// PNG chunk's type bytes plus its payload.
function buildCrcTable() {
  const tab = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let v = n;
    for (let b = 0; b < 8; b++) v = v & 1 ? 0xedb88320 ^ (v >>> 1) : v >>> 1;
    tab[n] = v >>> 0;
  }
  return tab;
}
const CRC_TAB = buildCrcTable();

function crcOf(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TAB[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// ---- PNG writing -----------------------------------------------------------
// One chunk: length, type, payload, CRC. Picture is RGB, 8-bit, filter 0.
function mkChunk(kind, payload) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(payload.length, 0);
  head.write(kind, 4, "ascii");
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crcOf(Buffer.concat([Buffer.from(kind, "ascii"), payload])), 0);
  return Buffer.concat([head, payload, tail]);
}

function toPng(w, h, rgb) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const step = w * 3;
  const raw = Buffer.alloc(h * (step + 1));
  for (let row = 0; row < h; row++) {
    raw[row * (step + 1)] = 0;
    rgb.copy(raw, row * (step + 1) + 1, row * step, (row + 1) * step);
  }
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    mkChunk("IHDR", ihdr),
    mkChunk("IDAT", idat),
    mkChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---- palette ---------------------------------------------------------------
const C = {
  paper: [247, 242, 231],
  ink: [20, 20, 20],
  red: [179, 35, 27],
  softRed: [255, 122, 107],
  navy: [22, 40, 63],
  navyLt: [30, 58, 92],
  card: [255, 253, 246],
  gold: [217, 164, 65],
  teal: [42, 127, 111],
  pine: [31, 94, 60],
  sky: [191, 224, 242],
  cream: [245, 240, 225],
  white: [255, 255, 255],
  sand: [242, 232, 216],
  space: [11, 15, 26],
  dome: [200, 214, 229],
  skyline: [15, 31, 51],
  sunset: [255, 94, 60],
  pink: [255, 120, 170],
  violet: [88, 60, 150],
  neon: [255, 46, 136],
  palm: [20, 120, 70],
  desert: [224, 178, 110],
  dusk: [64, 48, 92],
  starry: [28, 52, 110],
  flower: [240, 180, 30],
};

// ---- drawing surface -------------------------------------------------------
// One RGB buffer for the whole page; every primitive clips to the page.
const W = 1024;
const H = 1024;
const img = Buffer.alloc(W * H * 3);
const at = (x, y) => (y * W + x) * 3;

function rect(x, y, w, h, c) {
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(W, Math.ceil(x + w));
  const y1 = Math.min(H, Math.ceil(y + h));
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) {
      const i = at(xx, yy);
      img[i] = c[0];
      img[i + 1] = c[1];
      img[i + 2] = c[2];
    }
  }
}

function border(x, y, w, h, c, t) {
  rect(x, y, w, t, c);
  rect(x, y + h - t, w, t, c);
  rect(x, y, t, h, c);
  rect(x + w - t, y, t, h, c);
}

function disc(cx, cy, r, c) {
  for (let dy = -r; dy <= r; dy++) {
    const dx = Math.floor(Math.sqrt(r * r - dy * dy));
    rect(cx - dx, cy + dy, dx * 2 + 1, 1, c);
  }
}

function oval(cx, cy, rx, ry, c) {
  for (let dy = -ry; dy <= ry; dy++) {
    const t = 1 - (dy * dy) / (ry * ry);
    const dx = Math.floor(rx * Math.sqrt(Math.max(0, t)));
    rect(cx - dx, cy + dy, dx * 2 + 1, 1, c);
  }
}

// Scanline fill for a list of [x, y] corners.
function poly(pts, c) {
  let lo = Infinity;
  let hi = -Infinity;
  for (const p of pts) {
    if (p[1] < lo) lo = p[1];
    if (p[1] > hi) hi = p[1];
  }
  for (let y = Math.floor(lo); y <= Math.ceil(hi); y++) {
    const xs = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
        xs.push(a[0] + ((y - a[1]) * (b[0] - a[0])) / (b[1] - a[1]));
      }
    }
    xs.sort((m, n) => m - n);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      rect(Math.ceil(xs[k]), y, Math.floor(xs[k + 1]) - Math.ceil(xs[k]) + 1, 1, c);
    }
  }
}

// Bresenham segment with a square brush of side t.
function seg(x0, y0, x1, y1, c, t) {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  const half = Math.floor(t / 2);
  for (;;) {
    rect(x - half, y - half, t, t, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

// Dashes of `on` px with `off` px gaps along a segment.
function dash(x0, y0, x1, y1, c, t, on, off) {
  const len = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(1, Math.round(len));
  let done = 0;
  let sx = x0;
  let sy = y0;
  while (done < steps) {
    const part = Math.min(on, steps - done);
    const ex = Math.round(x0 + ((done + part) / steps) * (x1 - x0));
    const ey = Math.round(y0 + ((done + part) / steps) * (y1 - y0));
    seg(sx, sy, ex, ey, c, t);
    done += part + off;
    sx = Math.round(x0 + (done / steps) * (x1 - x0));
    sy = Math.round(y0 + (done / steps) * (y1 - y0));
  }
}

// ---- letterforms -----------------------------------------------------------
// A 5x7 pixel alphabet, one glyph per line: the character, then its 7 rows
// ("#" = ink). The whole poster is set in capitals, newspaper style.
const GLYPHS = [
  ["A", " ### ", "#   #", "#   #", "#####", "#   #", "#   #", "#   #"],
  ["B", "#### ", "#   #", "#   #", "#### ", "#   #", "#   #", "#### "],
  ["C", " ####", "#    ", "#    ", "#    ", "#    ", "#    ", " ####"],
  ["D", "#### ", "#   #", "#   #", "#   #", "#   #", "#   #", "#### "],
  ["E", "#####", "#    ", "#    ", "#### ", "#    ", "#    ", "#####"],
  ["F", "#####", "#    ", "#    ", "#### ", "#    ", "#    ", "#    "],
  ["G", " ####", "#    ", "#    ", "# ###", "#   #", "#   #", " ### "],
  ["H", "#   #", "#   #", "#   #", "#####", "#   #", "#   #", "#   #"],
  ["I", "#####", "  #  ", "  #  ", "  #  ", "  #  ", "  #  ", "#####"],
  ["J", "  ###", "   # ", "   # ", "   # ", "   # ", "#  # ", " ##  "],
  ["K", "#   #", "#  # ", "# #  ", "##   ", "# #  ", "#  # ", "#   #"],
  ["L", "#    ", "#    ", "#    ", "#    ", "#    ", "#    ", "#####"],
  ["M", "#   #", "## ##", "# # #", "# # #", "#   #", "#   #", "#   #"],
  ["N", "#   #", "##  #", "##  #", "# # #", "#  ##", "#  ##", "#   #"],
  ["O", " ### ", "#   #", "#   #", "#   #", "#   #", "#   #", " ### "],
  ["P", "#### ", "#   #", "#   #", "#### ", "#    ", "#    ", "#    "],
  ["Q", " ### ", "#   #", "#   #", "#   #", "# # #", "#  # ", " ## #"],
  ["R", "#### ", "#   #", "#   #", "#### ", "# #  ", "#  # ", "#   #"],
  ["S", " ####", "#    ", "#    ", " ### ", "    #", "    #", "#### "],
  ["T", "#####", "  #  ", "  #  ", "  #  ", "  #  ", "  #  ", "  #  "],
  ["U", "#   #", "#   #", "#   #", "#   #", "#   #", "#   #", " ### "],
  ["V", "#   #", "#   #", "#   #", "#   #", "#   #", " # # ", "  #  "],
  ["W", "#   #", "#   #", "#   #", "# # #", "# # #", "## ##", "#   #"],
  ["X", "#   #", "#   #", " # # ", "  #  ", " # # ", "#   #", "#   #"],
  ["Y", "#   #", "#   #", " # # ", "  #  ", "  #  ", "  #  ", "  #  "],
  ["Z", "#####", "    #", "   # ", "  #  ", " #   ", "#    ", "#####"],
  ["0", " ### ", "#  ##", "# # #", "##  #", "#   #", "#   #", " ### "],
  ["1", "  #  ", " ##  ", "  #  ", "  #  ", "  #  ", "  #  ", " ### "],
  ["2", " ### ", "#   #", "    #", "   # ", "  #  ", " #   ", "#####"],
  ["3", "#### ", "    #", "    #", " ### ", "    #", "    #", "#### "],
  ["4", "   # ", "  ## ", " # # ", "#  # ", "#####", "   # ", "   # "],
  ["5", "#####", "#    ", "#### ", "    #", "    #", "#   #", " ### "],
  ["6", " ### ", "#    ", "#    ", "#### ", "#   #", "#   #", " ### "],
  ["7", "#####", "    #", "   # ", "  #  ", "  #  ", "  #  ", "  #  "],
  ["8", " ### ", "#   #", "#   #", " ### ", "#   #", "#   #", " ### "],
  ["9", " ### ", "#   #", "#   #", " ####", "    #", "    #", " ### "],
  [" ", "     ", "     ", "     ", "     ", "     ", "     ", "     "],
  [".", "     ", "     ", "     ", "     ", " ##  ", " ##  ", "     "],
  [",", "     ", "     ", "     ", "     ", " ##  ", " ##  ", " #   "],
  ["'", "  #  ", "  #  ", " #   ", "     ", "     ", "     ", "     "],
  ["-", "     ", "     ", "     ", "#####", "     ", "     ", "     "],
  [":", "     ", " ##  ", " ##  ", "     ", " ##  ", " ##  ", "     "],
  [";", "     ", " ##  ", " ##  ", "     ", " ##  ", " ##  ", " #   "],
  ["!", "  #  ", "  #  ", "  #  ", "  #  ", "  #  ", "     ", "  #  "],
  ["?", " ### ", "#   #", "    #", "   # ", "  #  ", "     ", "  #  "],
  ["(", "   ##", "  #  ", " #   ", " #   ", " #   ", "  #  ", "   ##"],
  [")", "##   ", "  #  ", "   # ", "   # ", "   # ", "  #  ", "##   "],
  ["/", "    #", "    #", "   # ", "  #  ", " #   ", "#    ", "#    "],
  ["$", "  #  ", " ####", "# #  ", " ### ", "  # #", "#### ", "  #  "],
  ["%", "##  #", "## # ", "   # ", "  #  ", " #   ", "# ## ", "#  ##"],
  ["&", " ##  ", "#  # ", "# #  ", " #   ", "# # #", "#  # ", " ## #"],
  ["+", "     ", "  #  ", "  #  ", "#####", "  #  ", "  #  ", "     "],
  ["=", "     ", "     ", "#####", "     ", "#####", "     ", "     "],
  ['"', " # # ", " # # ", " # # ", "     ", "     ", "     ", "     "],
];
const FONT = new Map(GLYPHS.map(([ch, ...rows]) => [ch, rows]));
const EMPTY_ROW = ["     ", "     ", "     ", "     ", "     ", "     ", "     "];

// ---- setting type ----------------------------------------------------------
// Each character advances 5*scale + gap (gap defaults to scale).
function measure(s, scale, gap) {
  const g = gap === undefined ? scale : gap;
  if (s.length === 0) return 0;
  return s.length * (5 * scale + g) - g;
}

function putText(x, y, s, scale, c, opts) {
  const o = opts || {};
  const g = o.gap === undefined ? scale : o.gap;
  let cx = x;
  if (o.center) cx = Math.round(x - measure(s, scale, g) / 2);
  for (const ch of s) {
    const rows = FONT.get(ch) || EMPTY_ROW;
    for (let r = 0; r < 7; r++) {
      for (let col = 0; col < 5; col++) {
        if (rows[r][col] === "#") rect(cx + col * scale, y + r * scale, scale, scale, c);
      }
    }
    cx += 5 * scale + g;
  }
}

// Greedy word wrap: lines that fit within maxW at the given scale.
function wrap(s, maxW, scale) {
  const words = s.split(" ");
  const lines = [];
  let cur = "";
  for (const word of words) {
    const trial = cur === "" ? word : cur + " " + word;
    if (measure(trial, scale) <= maxW || cur === "") {
      cur = trial;
    } else {
      lines.push(cur);
      cur = word;
    }
  }
  if (cur !== "") lines.push(cur);
  return lines;
}

function para(x, y, s, scale, maxW, c, gap) {
  const lines = wrap(s, maxW, scale);
  const g = gap === undefined ? 4 : gap;
  lines.forEach((ln, i) => putText(x, y + i * (7 * scale + g), ln, scale, c));
  return lines.length;
}

// Gold story-number badge at a panel's top-right corner.
function badge(cx, cy, n) {
  disc(cx, cy, 17, C.gold);
  putText(cx, cy - 10, String(n), 3, C.navy, { center: true });
}

// ---- pictures --------------------------------------------------------------
// Shenzhen summit at dusk: three flags over a skyline, three leaders shaking
// hands across a round table.
function summit(x, y, w, h) {
  rect(x, y, w, h, C.dusk);
  const stars = [
    [30, 20], [90, 14], [150, 30], [230, 14], [300, 40], [60, 60],
    [200, 18], [280, 70], [120, 50], [340, 20], [170, 64], [320, 96],
  ];
  for (const s of stars) rect(x + s[0], y + s[1], 3, 3, C.white);
  const towers = [
    [20, 152, 34, 92], [68, 130, 28, 114], [110, 164, 38, 80],
    [162, 142, 26, 102], [202, 170, 40, 74], [256, 134, 28, 110],
    [298, 160, 36, 84], [344, 150, 22, 94],
  ];
  for (const t of towers) rect(x + t[0], y + t[1], t[2], t[3], C.skyline);
  const lit = [
    [28, 164], [76, 142], [122, 174], [170, 154], [214, 180],
    [264, 146], [308, 170], [92, 182], [232, 202], [152, 192],
  ];
  for (const wn of lit) rect(x + wn[0], y + wn[1], 4, 5, C.gold);
  // Three flags on poles: US, China, Russia.
  const flagX = [52, 168, 284];
  for (let i = 0; i < 3; i++) {
    const fx = x + flagX[i];
    seg(fx, y + 58, fx, y + 128, C.white, 3);
    if (i === 0) {
      rect(fx + 3, y + 58, 34, 22, [179, 35, 27]);
      rect(fx + 3, y + 63, 34, 3, C.white);
      rect(fx + 3, y + 71, 34, 3, C.white);
      rect(fx + 3, y + 58, 14, 11, [30, 58, 92]);
    } else if (i === 1) {
      rect(fx + 3, y + 58, 34, 22, [222, 41, 16]);
      rect(fx + 8, y + 62, 7, 7, C.gold);
      rect(fx + 20, y + 62, 3, 3, C.gold);
      rect(fx + 24, y + 68, 3, 3, C.gold);
    } else {
      rect(fx + 3, y + 58, 34, 22, C.white);
      rect(fx + 3, y + 65, 34, 8, [30, 80, 180]);
      rect(fx + 3, y + 73, 34, 7, [200, 30, 30]);
    }
  }
  // Round table with three suited figures behind it.
  oval(x + 186, y + 226, 92, 14, [120, 90, 60]);
  rect(x + 94, y + 222, 184, 8, [150, 115, 75]);
  const figures = [120, 186, 252];
  const suits = [C.navyLt, [120, 30, 30], [40, 60, 90]];
  for (let i = 0; i < 3; i++) {
    const fx = x + figures[i];
    rect(fx - 12, y + 190, 24, 34, suits[i]);
    disc(fx, y + 182, 10, [235, 200, 170]);
    rect(fx - 3, y + 192, 6, 12, C.white);
  }
  // Joined hands over the table centre.
  disc(x + 186, y + 218, 8, [235, 200, 170]);
  disc(x + 172, y + 220, 6, [210, 175, 145]);
  disc(x + 200, y + 220, 6, [220, 185, 155]);
}

// Vice City at neon sunset: banded sky, low sun, palms, skyline, big VI.
function viceCity(x, y, w, h) {
  rect(x, y, w, 22, C.violet);
  rect(x, y + 22, w, 22, C.pink);
  rect(x, y + 44, w, 20, C.sunset);
  disc(x + 110, y + 28, 16, C.gold);
  rect(x + 90, y + 28, 40, 3, C.pink);
  const blocks = [
    [14, 36, 28, 28], [52, 26, 22, 38], [86, 42, 32, 22],
    [130, 30, 24, 34], [166, 38, 28, 26], [326, 32, 32, 32],
    [370, 42, 28, 22], [406, 36, 26, 28],
  ];
  for (const t of blocks) rect(x + t[0], y + t[1], t[2], t[3], [40, 20, 60]);
  for (const wy of [34, 46, 58]) {
    rect(x + 22, y + wy, 14, 3, C.neon);
    rect(x + 94, y + wy, 20, 3, C.neon);
    rect(x + 138, y + wy, 14, 3, C.neon);
  }
  function palm(px, py) {
    seg(px, py, px, py - 26, C.palm, 4);
    seg(px, py - 26, px - 16, py - 34, C.palm, 3);
    seg(px, py - 26, px + 16, py - 34, C.palm, 3);
    seg(px, py - 26, px - 6, py - 40, C.palm, 3);
    seg(px, py - 26, px + 6, py - 40, C.palm, 3);
  }
  palm(x + 30, y + 62);
  palm(x + 428, y + 62);
  putText(x + 196, y + 8, "VI", 6, C.neon);
}

// Kuwait at dusk: desert, base hangars, a radar mast, incoming missiles and
// one interception burst over the base.
function kuwait(x, y, w, h) {
  rect(x, y, w, h, C.desert);
  rect(x, y, w, 26, C.dusk);
  disc(x + w - 30, y + 14, 10, C.gold);
  oval(x + 100, y + 56, 100, 8, [210, 160, 95]);
  oval(x + 330, y + 56, 90, 7, [210, 160, 95]);
  rect(x + 24, y + 34, 56, 30, [120, 110, 95]);
  rect(x + 92, y + 40, 44, 24, [120, 110, 95]);
  seg(x + 170, y + 64, x + 170, y + 22, C.ink, 3);
  disc(x + 170, y + 20, 8, C.ink);
  seg(x + 170, y + 20, x + 182, y + 8, C.ink, 2);
  const incoming = [[250, 18], [300, 8], [350, 20]];
  for (const m of incoming) {
    const mx = x + m[0];
    const my = y + m[1];
    dash(mx + 40, my - 12, mx + 8, my + 6, C.white, 2, 6, 4);
    poly([[mx, my], [mx + 16, my + 4], [mx, my + 8]], C.ink);
    disc(mx + 16, my + 4, 3, C.sunset);
  }
  disc(x + 210, y + 44, 10, C.gold);
  disc(x + 210, y + 44, 5, C.sunset);
  seg(x + 210, y + 30, x + 210, y + 58, C.gold, 2);
  seg(x + 196, y + 44, x + 224, y + 44, C.gold, 2);
  seg(x + 200, y + 34, x + 220, y + 54, C.gold, 2);
  seg(x + 220, y + 34, x + 200, y + 54, C.gold, 2);
}

// Anthropic IPO: rising bars, an up arrow, the $83 price, ANT, and the bell.
function ipo(x, y, w, h) {
  rect(x, y, w, h, [238, 247, 238]);
  const bars = [
    [24, 44, 28, 20], [64, 34, 28, 30], [104, 22, 28, 42], [144, 10, 28, 54],
  ];
  for (let i = 0; i < bars.length; i++) {
    rect(x + bars[i][0], y + bars[i][1], bars[i][2], bars[i][3], i === 3 ? C.gold : C.teal);
  }
  seg(x + 16, y + 56, x + 182, y + 8, C.pine, 6);
  poly([[x + 184, y + 6], [x + 162, y + 4], [x + 172, y + 28]], C.pine);
  putText(x + 204, y + 8, "$83", 6, C.pine);
  putText(x + 322, y + 22, "ANT", 3, C.ink);
  putText(x + 322, y + 44, "NASDAQ", 2, C.ink);
  oval(x + 420, y + 34, 16, 12, C.gold);
  rect(x + 404, y + 34, 32, 8, C.gold);
  disc(x + 420, y + 48, 4, C.gold);
  seg(x + 420, y + 18, x + 420, y + 24, C.gold, 3);
}

// Van Gogh: a starry-night sky, a sunflower, and the record price in a gilt
// frame.
function vanGogh(x, y, w, h) {
  rect(x, y, w, h, C.starry);
  for (let i = 0; i < 5; i++) {
    const sy = y + 8 + i * 9;
    for (let sx = 0; sx < 200; sx += 8) {
      rect(x + 20 + sx, sy + Math.round(3 * Math.sin(sx / 18)), 6, 3, [120, 170, 230]);
    }
  }
  const stars = [
    [240, 10], [280, 22], [320, 12], [360, 26], [400, 14], [430, 30],
  ];
  for (const s of stars) {
    disc(x + s[0], y + s[1], 3, C.white);
    seg(x + s[0] - 6, y + s[1], x + s[0] + 6, y + s[1], C.white, 1);
    seg(x + s[0], y + s[1] - 6, x + s[0], y + s[1] + 6, C.white, 1);
  }
  disc(x + 250, y + 40, 12, C.gold);
  disc(x + 255, y + 37, 10, C.starry);
  disc(x + 60, y + 44, 12, C.flower);
  disc(x + 60, y + 44, 5, [90, 50, 20]);
  for (let a = 0; a < 8; a++) {
    const ang = (a * Math.PI) / 4;
    const px = x + 60 + Math.round(16 * Math.cos(ang));
    const py = y + 44 + Math.round(16 * Math.sin(ang));
    disc(px, py, 4, C.flower);
  }
  seg(x + 60, y + 56, x + 60, y + 64, C.pine, 3);
  rect(x + 300, y + 8, 140, 48, C.gold);
  rect(x + 306, y + 14, 128, 36, [20, 30, 60]);
  putText(x + 316, y + 22, "$190.4M", 3, C.white);
}

// ---- the front page --------------------------------------------------------
// One story panel: picture strip on top, tag, two headline lines, body copy.
function story(x, y, w, h, n, tag, h1, h2, body, draw) {
  rect(x, y, w, h, C.card);
  border(x, y, w, h, C.ink, 3);
  draw(x + 12, y + 12, w - 24, 64);
  badge(x + w - 18, y + 22, n);
  putText(x + 12, y + 84, tag, 2, C.red);
  putText(x + 12, y + 104, h1, 4, C.ink);
  putText(x + 12, y + 136, h2, 4, C.ink);
  para(x + 12, y + 172, body, 2, w - 24, C.ink, 4);
}

function frontPage() {
  rect(0, 0, W, H, C.paper);

  // Masthead.
  putText(512, 16, "THE WORLD IN ONE DAY", 4, C.ink, { center: true });
  putText(512, 62, "THURSDAY 19 NOVEMBER 2026", 6, C.ink, {
    center: true,
    gap: 4,
  });
  rect(24, 116, 976, 6, C.ink);
  rect(24, 128, 976, 2, C.ink);
  putText(512, 140, "FIVE STORIES THAT DEFINED THE DAY", 3, C.ink, {
    center: true,
  });

  // Lead story: Trump, Xi and Putin meet in China.
  rect(24, 172, 976, 296, C.navy);
  border(24, 172, 976, 296, C.ink, 3);
  summit(36, 184, 372, 272);
  badge(976, 196, 1);
  putText(436, 192, "DIPLOMACY", 2, C.softRed);
  putText(436, 216, "TRUMP, XI AND PUTIN", 4, C.cream);
  putText(436, 250, "MEET IN CHINA", 4, C.cream);
  rect(436, 292, 60, 4, C.gold);
  para(
    436,
    308,
    "THE THREE LEADERS SHAKE HANDS IN SHENZHEN ON THE APEC SIDELINES IN A FIRST-EVER TRILATERAL SUMMIT.",
    2,
    552,
    C.cream,
    4
  );

  // GTA VI launches worldwide.
  story(
    24, 480, 482, 232, 2, "CULTURE",
    "GTA VI GOES GLOBAL", "VICE CITY OPENS",
    "AFTER A 13-YEAR WAIT, ROCKSTAR'S SEQUEL LAUNCHES WORLDWIDE. PLAYERS FLOOD BACK INTO VICE CITY.",
    viceCity
  );

  // Iran hits US bases in Kuwait.
  story(
    518, 480, 482, 232, 3, "MIDDLE EAST",
    "IRAN HITS US BASES", "IN KUWAIT",
    "TEHRAN EXPANDS ITS STRIKES TO US DRONE AND MISSILE SITES IN KUWAIT AFTER THE US HIT QESHM ISLAND.",
    kuwait
  );

  // Anthropic debuts on the Nasdaq.
  story(
    24, 724, 482, 232, 4, "BUSINESS",
    "ANTHROPIC DEBUTS", "ON NASDAQ AS ANT",
    "PRICED AT $83 A SHARE, THE $81BN OFFERING IS THE BIGGEST IPO EVER. VALUED AT ABOUT $1.5TN.",
    ipo
  );

  // Van Gogh sells for a record price.
  story(
    518, 724, 482, 232, 5, "ART",
    "VAN GOGH SELLS FOR", "RECORD $190.4M",
    "A PAINTING WITH A NAZI-ERA PAST SELLS AT AUCTION FOR $190.4M, A RECORD FOR THE ARTIST.",
    vanGogh
  );

  // Footer: sources and the day's claim, so the image stands alone.
  rect(24, 966, 976, 2, C.ink);
  putText(512, 976, "SOURCES: REUTERS, AP, BBC, NYT", 2, C.ink, {
    center: true,
  });
  putText(
    512,
    996,
    "EVERY STORY HAPPENED OR WAS FIRST REPORTED ON 19 NOVEMBER 2026",
    2,
    C.ink,
    { center: true }
  );
}

// ---- run -------------------------------------------------------------------
function run() {
  frontPage();
  const out = process.env.MAKEFUN_OUTPUT_DIR || "/output";
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, "entry.png"), toPng(W, H, img));
}

run();
