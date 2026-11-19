// news-image-20261119 — "The World in One Day"
// A procedurally drawn newspaper front page summing up Thursday 19 November 2026.
// Everything is drawn at runtime by this program: no image assets, no network.
// PNG encoder (node:zlib deflate + hand-rolled CRC32) and a 5x7 bitmap font
// defined in code. Output is deterministic: two runs write byte-identical PNGs.

const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

// ---------------------------------------------------------------- CRC32 ----
// Standard CRC-32 (IEEE 802.3) used by PNG chunks.
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

// Encode an RGB buffer (width x height x 3) as a PNG (filter 0 on every row).
function encodePng(width, height, rgb) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type 2 = RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const stride = width * 3;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: None
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------- bitmap font ----
// 5x7 pixel font, drawn from these rows ("#" = ink). Uppercase only: the whole
// poster is set in capitals, newspaper style.
const FONT = {
  "A": [" ### ", "#   #", "#   #", "#####", "#   #", "#   #", "#   #"],
  "B": ["#### ", "#   #", "#   #", "#### ", "#   #", "#   #", "#### "],
  "C": [" ####", "#    ", "#    ", "#    ", "#    ", "#    ", " ####"],
  "D": ["#### ", "#   #", "#   #", "#   #", "#   #", "#   #", "#### "],
  "E": ["#####", "#    ", "#    ", "#### ", "#    ", "#    ", "#####"],
  "F": ["#####", "#    ", "#    ", "#### ", "#    ", "#    ", "#    "],
  "G": [" ####", "#    ", "#    ", "# ###", "#   #", "#   #", " ### "],
  "H": ["#   #", "#   #", "#   #", "#####", "#   #", "#   #", "#   #"],
  "I": ["#####", "  #  ", "  #  ", "  #  ", "  #  ", "  #  ", "#####"],
  "J": ["  ###", "   # ", "   # ", "   # ", "   # ", "#  # ", " ##  "],
  "K": ["#   #", "#  # ", "# #  ", "##   ", "# #  ", "#  # ", "#   #"],
  "L": ["#    ", "#    ", "#    ", "#    ", "#    ", "#    ", "#####"],
  "M": ["#   #", "## ##", "# # #", "# # #", "#   #", "#   #", "#   #"],
  "N": ["#   #", "##  #", "##  #", "# # #", "#  ##", "#  ##", "#   #"],
  "O": [" ### ", "#   #", "#   #", "#   #", "#   #", "#   #", " ### "],
  "P": ["#### ", "#   #", "#   #", "#### ", "#    ", "#    ", "#    "],
  "Q": [" ### ", "#   #", "#   #", "#   #", "# # #", "#  # ", " ## #"],
  "R": ["#### ", "#   #", "#   #", "#### ", "# #  ", "#  # ", "#   #"],
  "S": [" ####", "#    ", "#    ", " ### ", "    #", "    #", "#### "],
  "T": ["#####", "  #  ", "  #  ", "  #  ", "  #  ", "  #  ", "  #  "],
  "U": ["#   #", "#   #", "#   #", "#   #", "#   #", "#   #", " ### "],
  "V": ["#   #", "#   #", "#   #", "#   #", "#   #", " # # ", "  #  "],
  "W": ["#   #", "#   #", "#   #", "# # #", "# # #", "## ##", "#   #"],
  "X": ["#   #", "#   #", " # # ", "  #  ", " # # ", "#   #", "#   #"],
  "Y": ["#   #", "#   #", " # # ", "  #  ", "  #  ", "  #  ", "  #  "],
  "Z": ["#####", "    #", "   # ", "  #  ", " #   ", "#    ", "#####"],
  "0": [" ### ", "#  ##", "# # #", "##  #", "#   #", "#   #", " ### "],
  "1": ["  #  ", " ##  ", "  #  ", "  #  ", "  #  ", "  #  ", " ### "],
  "2": [" ### ", "#   #", "    #", "   # ", "  #  ", " #   ", "#####"],
  "3": ["#### ", "    #", "    #", " ### ", "    #", "    #", "#### "],
  "4": ["   # ", "  ## ", " # # ", "#  # ", "#####", "   # ", "   # "],
  "5": ["#####", "#    ", "#### ", "    #", "    #", "#   #", " ### "],
  "6": [" ### ", "#    ", "#    ", "#### ", "#   #", "#   #", " ### "],
  "7": ["#####", "    #", "   # ", "  #  ", "  #  ", "  #  ", "  #  "],
  "8": [" ### ", "#   #", "#   #", " ### ", "#   #", "#   #", " ### "],
  "9": [" ### ", "#   #", "#   #", " ####", "    #", "    #", " ### "],
  " ": ["     ", "     ", "     ", "     ", "     ", "     ", "     "],
  ".": ["     ", "     ", "     ", "     ", " ##  ", " ##  ", "     "],
  ",": ["     ", "     ", "     ", "     ", " ##  ", " ##  ", " #   "],
  "'": ["  #  ", "  #  ", " #   ", "     ", "     ", "     ", "     "],
  "-": ["     ", "     ", "     ", "#####", "     ", "     ", "     "],
  ":": ["     ", " ##  ", " ##  ", "     ", " ##  ", " ##  ", "     "],
  ";": ["     ", " ##  ", " ##  ", "     ", " ##  ", " ##  ", " #   "],
  "!": ["  #  ", "  #  ", "  #  ", "  #  ", "  #  ", "     ", "  #  "],
  "?": [" ### ", "#   #", "    #", "   # ", "  #  ", "     ", "  #  "],
  "(": ["   ##", "  #  ", " #   ", " #   ", " #   ", "  #  ", "   ##"],
  ")": ["##   ", "  #  ", "   # ", "   # ", "   # ", "  #  ", "##   "],
  "/": ["    #", "    #", "   # ", "  #  ", " #   ", "#    ", "#    "],
  "$": ["  #  ", " ####", "# #  ", " ### ", "  # #", "#### ", "  #  "],
  "%": ["##  #", "## # ", "   # ", "  #  ", " #   ", "# ## ", "#  ##"],
  "&": [" ##  ", "#  # ", "# #  ", " #   ", "# # #", "#  # ", " ## #"],
  "+": ["     ", "  #  ", "  #  ", "#####", "  #  ", "  #  ", "     "],
  "=": ["     ", "     ", "#####", "     ", "#####", "     ", "     "],
  '"': [" # # ", " # # ", " # # ", "     ", "     ", "     ", "     "],
};
const BLANK_GLYPH = ["     ", "     ", "     ", "     ", "     ", "     ", "     "];

// ---------------------------------------------------------------- canvas ----
// A plain RGB canvas: width x height x 3 bytes. All drawing is clipped.
const W = 1024;
const H = 1024;
const canvas = Buffer.alloc(W * H * 3);

function px(x, y) {
  return (y * W + x) * 3;
}

function setPixel(x, y, color) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = px(x, y);
  canvas[i] = color[0];
  canvas[i + 1] = color[1];
  canvas[i + 2] = color[2];
}

function fillRect(x, y, w, h, color) {
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(W, Math.ceil(x + w));
  const y1 = Math.min(H, Math.ceil(y + h));
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) {
      const i = px(xx, yy);
      canvas[i] = color[0];
      canvas[i + 1] = color[1];
      canvas[i + 2] = color[2];
    }
  }
}

function frameRect(x, y, w, h, color, t) {
  fillRect(x, y, w, t, color);
  fillRect(x, y + h - t, w, t, color);
  fillRect(x, y, t, h, color);
  fillRect(x + w - t, y, t, h, color);
}

function fillCircle(cx, cy, r, color) {
  for (let dy = -r; dy <= r; dy++) {
    const dx = Math.floor(Math.sqrt(r * r - dy * dy));
    fillRect(cx - dx, cy + dy, dx * 2 + 1, 1, color);
  }
}

function fillEllipse(cx, cy, rx, ry, color) {
  for (let dy = -ry; dy <= ry; dy++) {
    const t = 1 - (dy * dy) / (ry * ry);
    const dx = Math.floor(rx * Math.sqrt(Math.max(0, t)));
    fillRect(cx - dx, cy + dy, dx * 2 + 1, 1, color);
  }
}

// Filled polygon from a list of [x, y] points (scanline fill).
function fillPolygon(points, color) {
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p[1] < minY) minY = p[1];
    if (p[1] > maxY) maxY = p[1];
  }
  for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
    const xs = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
        xs.push(a[0] + ((y - a[1]) * (b[0] - a[0])) / (b[1] - a[1]));
      }
    }
    xs.sort((m, n) => m - n);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      fillRect(Math.ceil(xs[k]), y, Math.floor(xs[k + 1]) - Math.ceil(xs[k]) + 1, 1, color);
    }
  }
}

// Bresenham line with a square brush of side t.
function line(x0, y0, x1, y1, color, t) {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  const half = Math.floor(t / 2);
  for (;;) {
    fillRect(x - half, y - half, t, t, color);
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

// Dashed line: segments of `on` px, gaps of `off` px.
function dashedLine(x0, y0, x1, y1, color, t, on, off) {
  const len = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(1, Math.round(len));
  let drawn = 0;
  let sx = x0;
  let sy = y0;
  while (drawn < steps) {
    const seg = Math.min(on, steps - drawn);
    const ex = Math.round(x0 + ((drawn + seg) / steps) * (x1 - x0));
    const ey = Math.round(y0 + ((drawn + seg) / steps) * (y1 - y0));
    line(sx, sy, ex, ey, color, t);
    drawn += seg + off;
    sx = Math.round(x0 + (drawn / steps) * (x1 - x0));
    sy = Math.round(y0 + (drawn / steps) * (y1 - y0));
  }
}

// ------------------------------------------------------------------ text ----
// Advance per character is 5*scale + tracking (tracking defaults to scale).
function textWidth(text, scale, tracking) {
  const tr = tracking === undefined ? scale : tracking;
  if (text.length === 0) return 0;
  return text.length * (5 * scale + tr) - tr;
}

function drawText(x, y, text, scale, color, opts) {
  const o = opts || {};
  const tr = o.tracking === undefined ? scale : o.tracking;
  let cx = x;
  if (o.center) cx = Math.round(x - textWidth(text, scale, tr) / 2);
  for (const ch of text) {
    const glyph = FONT[ch] || BLANK_GLYPH;
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 5; col++) {
        if (glyph[row][col] === "#") {
          fillRect(cx + col * scale, y + row * scale, scale, scale, color);
        }
      }
    }
    cx += 5 * scale + tr;
  }
}

// Greedy word wrap: returns lines that fit within maxWidth at the given scale.
function wrapText(text, maxWidth, scale) {
  const words = text.split(" ");
  const lines = [];
  let cur = "";
  for (const word of words) {
    const trial = cur === "" ? word : cur + " " + word;
    if (textWidth(trial, scale) <= maxWidth || cur === "") {
      cur = trial;
    } else {
      lines.push(cur);
      cur = word;
    }
  }
  if (cur !== "") lines.push(cur);
  return lines;
}

function drawWrapped(x, y, text, scale, maxWidth, color, lineGap) {
  const lines = wrapText(text, maxWidth, scale);
  const gap = lineGap === undefined ? 4 : lineGap;
  lines.forEach((ln, i) => drawText(x, y + i * (7 * scale + gap), ln, scale, color));
  return lines.length;
}

// ---------------------------------------------------------------- colors ----
const PAPER = [247, 242, 231];
const INK = [20, 20, 20];
const RED = [179, 35, 27];
const LIGHT_RED = [255, 122, 107];
const NAVY = [22, 40, 63];
const NAVY_LIGHT = [30, 58, 92];
const PANEL_BG = [255, 253, 246];
const GOLD = [217, 164, 65];
const TEAL = [42, 127, 111];
const DARK_GREEN = [31, 94, 60];
const SKY = [191, 224, 242];
const CREAM = [245, 240, 225];
const WHITE = [255, 255, 255];
const SAND = [242, 232, 216];
const SPACE = [11, 15, 26];
const DOME = [200, 214, 229];
const DARK_SKYLINE = [15, 31, 51];
// New palette for 19 November: neon sunset, desert dusk, starry blue.
const SUNSET = [255, 94, 60];
const SUNSET_PINK = [255, 120, 170];
const VIOLET = [88, 60, 150];
const NEON = [255, 46, 136];
const PALM = [20, 120, 70];
const DESERT = [224, 178, 110];
const DUSK = [64, 48, 92];
const STARRY = [28, 52, 110];
const SUNFLOWER = [240, 180, 30];

// Small gold story-number badge at the top-right corner of a panel.
function storyNumber(cx, cy, n) {
  fillCircle(cx, cy, 17, GOLD);
  drawText(cx, cy - 10, String(n), 3, NAVY, { center: true });
}

function panel(x, y, w, h, bg) {
  fillRect(x, y, w, h, bg);
  frameRect(x, y, w, h, INK, 3);
}

// ------------------------------------------------------- lead illustration ----
// Shenzhen summit at dusk: three flags (US, China, Russia) over a skyline,
// three leaders shaking hands at a round table.
function drawSummitArt(x, y, w, h) {
  fillRect(x, y, w, h, DUSK);
  // Stars.
  const stars = [
    [24, 16], [84, 12], [164, 26], [264, 12], [324, 36], [54, 56],
    [214, 16], [294, 66], [114, 46], [344, 16], [180, 60], [330, 90],
  ];
  for (const s of stars) fillRect(x + s[0], y + s[1], 3, 3, WHITE);
  // Shenzhen skyline silhouette.
  const buildings = [
    [18, 150, 36, 94], [66, 128, 30, 116], [108, 162, 40, 82],
    [160, 140, 28, 104], [200, 168, 42, 76], [254, 132, 30, 112],
    [296, 158, 38, 86], [342, 148, 24, 96],
  ];
  for (const b of buildings) fillRect(x + b[0], y + b[1], b[2], b[3], DARK_SKYLINE);
  // Lit windows.
  const windows = [
    [26, 162], [74, 140], [120, 172], [168, 152], [212, 178],
    [262, 144], [306, 168], [90, 180], [230, 200], [150, 190],
  ];
  for (const wn of windows) fillRect(x + wn[0], y + wn[1], 4, 5, GOLD);
  // Three flags on poles above the skyline: US, China, Russia.
  const flagX = [52, 168, 284];
  for (let i = 0; i < 3; i++) {
    const fx = x + flagX[i];
    line(fx, y + 58, fx, y + 128, WHITE, 3);
    if (i === 0) {
      // US stripes + blue canton.
      fillRect(fx + 3, y + 58, 34, 22, [179, 35, 27]);
      fillRect(fx + 3, y + 63, 34, 3, WHITE);
      fillRect(fx + 3, y + 71, 34, 3, WHITE);
      fillRect(fx + 3, y + 58, 14, 11, [30, 58, 92]);
    } else if (i === 1) {
      // China: red field, gold stars.
      fillRect(fx + 3, y + 58, 34, 22, [222, 41, 16]);
      fillRect(fx + 8, y + 62, 7, 7, GOLD);
      fillRect(fx + 20, y + 62, 3, 3, GOLD);
      fillRect(fx + 24, y + 68, 3, 3, GOLD);
    } else {
      // Russia: white, blue, red tricolour.
      fillRect(fx + 3, y + 58, 34, 22, WHITE);
      fillRect(fx + 3, y + 65, 34, 8, [30, 80, 180]);
      fillRect(fx + 3, y + 73, 34, 7, [200, 30, 30]);
    }
  }
  // Round summit table with three figures shaking hands.
  fillEllipse(x + 186, y + 226, 92, 14, [120, 90, 60]);
  fillRect(x + 94, y + 222, 184, 8, [150, 115, 75]);
  // Three suited figures behind the table.
  const figures = [120, 186, 252];
  const suits = [NAVY_LIGHT, [120, 30, 30], [40, 60, 90]];
  for (let i = 0; i < 3; i++) {
    const fx = x + figures[i];
    fillRect(fx - 12, y + 190, 24, 34, suits[i]); // torso
    fillCircle(fx, y + 182, 10, [235, 200, 170]); // head
    fillRect(fx - 3, y + 192, 6, 12, WHITE); // shirt
  }
  // Joined hands over the table centre.
  fillCircle(x + 186, y + 218, 8, [235, 200, 170]);
  fillCircle(x + 172, y + 220, 6, [210, 175, 145]);
  fillCircle(x + 200, y + 220, 6, [220, 185, 155]);
}

// ------------------------------------------------------- small illustrations ----
// Vice City at neon sunset: gradient sky, sun, palms, skyline, big VI.
function drawViceCityArt(x, y, w, h) {
  // Sunset bands.
  fillRect(x, y, w, 22, VIOLET);
  fillRect(x, y + 22, w, 22, SUNSET_PINK);
  fillRect(x, y + 44, w, 20, SUNSET);
  // Sun with a slit (retro synthwave), clear of the VI lettering.
  fillCircle(x + 110, y + 28, 16, GOLD);
  fillRect(x + 90, y + 28, 40, 3, SUNSET_PINK);
  // Skyline.
  const towers = [
    [16, 34, 30, 30], [56, 24, 24, 40], [90, 40, 34, 24],
    [134, 28, 26, 36], [170, 36, 30, 28], [330, 30, 34, 34],
    [374, 40, 30, 24], [410, 34, 28, 30],
  ];
  for (const t of towers) fillRect(x + t[0], y + t[1], t[2], t[3], [40, 20, 60]);
  for (const wy of [32, 44, 56]) {
    fillRect(x + 24, y + wy, 14, 3, NEON);
    fillRect(x + 96, y + wy, 20, 3, NEON);
    fillRect(x + 140, y + wy, 14, 3, NEON);
  }
  // Two palm trees framing the VI.
  function palm(px, py) {
    line(px, py, px, py - 26, PALM, 4);
    line(px, py - 26, px - 16, py - 34, PALM, 3);
    line(px, py - 26, px + 16, py - 34, PALM, 3);
    line(px, py - 26, px - 6, py - 40, PALM, 3);
    line(px, py - 26, px + 6, py - 40, PALM, 3);
  }
  palm(x + 30, y + 62);
  palm(x + 428, y + 62);
  // Big VI in the middle.
  drawText(x + 196, y + 8, "VI", 6, WHITE);
  drawText(x + 196, y + 8, "VI", 6, NEON);
}

// Kuwait at dusk: desert, base buildings, incoming missiles, interception burst.
function drawKuwaitArt(x, y, w, h) {
  fillRect(x, y, w, h, DESERT);
  // Dusk sky band.
  fillRect(x, y, w, 26, DUSK);
  fillCircle(x + w - 30, y + 14, 10, GOLD);
  // Sand dunes, kept inside the art box.
  fillEllipse(x + 100, y + 56, 100, 8, [210, 160, 95]);
  fillEllipse(x + 330, y + 56, 90, 7, [210, 160, 95]);
  // Military base: hangars and a radar mast.
  fillRect(x + 24, y + 34, 56, 30, [120, 110, 95]);
  fillRect(x + 92, y + 40, 44, 24, [120, 110, 95]);
  line(x + 170, y + 64, x + 170, y + 22, INK, 3);
  fillCircle(x + 170, y + 20, 8, INK);
  line(x + 170, y + 20, x + 182, y + 8, INK, 2);
  // Three incoming missiles with smoke trails.
  const missiles = [[250, 18], [300, 8], [350, 20]];
  for (const m of missiles) {
    const mx = x + m[0];
    const my = y + m[1];
    dashedLine(mx + 40, my - 12, mx + 8, my + 6, WHITE, 2, 6, 4);
    fillPolygon(
      [[mx, my], [mx + 16, my + 4], [mx, my + 8]],
      INK
    );
    fillCircle(mx + 16, my + 4, 3, SUNSET);
  }
  // Interception burst over the base.
  fillCircle(x + 210, y + 44, 10, GOLD);
  fillCircle(x + 210, y + 44, 5, SUNSET);
  line(x + 210, y + 30, x + 210, y + 58, GOLD, 2);
  line(x + 196, y + 44, x + 224, y + 44, GOLD, 2);
  line(x + 200, y + 34, x + 220, y + 54, GOLD, 2);
  line(x + 220, y + 34, x + 200, y + 54, GOLD, 2);
}

// Anthropic IPO: rising bars, big $83, ANT ticker, opening bell.
function drawIpoArt(x, y, w, h) {
  fillRect(x, y, w, h, [238, 247, 238]);
  // Rising bars.
  const bars = [
    [24, 44, 28, 20], [64, 34, 28, 30], [104, 22, 28, 42], [144, 10, 28, 54],
  ];
  for (let i = 0; i < bars.length; i++) {
    fillRect(x + bars[i][0], y + bars[i][1], bars[i][2], bars[i][3], i === 3 ? GOLD : TEAL);
  }
  // Up arrow over the bars.
  line(x + 16, y + 56, x + 182, y + 8, DARK_GREEN, 6);
  fillPolygon(
    [[x + 184, y + 6], [x + 162, y + 4], [x + 172, y + 28]],
    DARK_GREEN
  );
  // Big $83 and ticker, clear of each other.
  drawText(x + 204, y + 8, "$83", 6, DARK_GREEN);
  drawText(x + 322, y + 22, "ANT", 3, INK);
  drawText(x + 322, y + 44, "NASDAQ", 2, INK);
  // Opening bell at the right.
  fillEllipse(x + 420, y + 34, 16, 12, GOLD);
  fillRect(x + 404, y + 34, 32, 8, GOLD);
  fillCircle(x + 420, y + 48, 4, GOLD);
  line(x + 420, y + 18, x + 420, y + 24, GOLD, 3);
}

// Van Gogh: starry-night swirls, a sunflower, a gilt frame with the price.
function drawVanGoghArt(x, y, w, h) {
  fillRect(x, y, w, h, STARRY);
  // Swirling sky strokes.
  for (let i = 0; i < 5; i++) {
    const sy = y + 8 + i * 9;
    for (let sx = 0; sx < 200; sx += 8) {
      fillRect(x + 20 + sx, sy + Math.round(3 * Math.sin(sx / 18)), 6, 3, [120, 170, 230]);
    }
  }
  // Stars.
  const stars = [
    [240, 10], [280, 22], [320, 12], [360, 26], [400, 14], [430, 30],
  ];
  for (const s of stars) {
    fillCircle(x + s[0], y + s[1], 3, WHITE);
    line(x + s[0] - 6, y + s[1], x + s[0] + 6, y + s[1], WHITE, 1);
    line(x + s[0], y + s[1] - 6, x + s[0], y + s[1] + 6, WHITE, 1);
  }
  // Crescent moon.
  fillCircle(x + 250, y + 40, 12, GOLD);
  fillCircle(x + 255, y + 37, 10, STARRY);
  // Sunflower at the left.
  fillCircle(x + 60, y + 44, 12, SUNFLOWER);
  fillCircle(x + 60, y + 44, 5, [90, 50, 20]);
  for (let a = 0; a < 8; a++) {
    const ang = (a * Math.PI) / 4;
    const px = x + 60 + Math.round(16 * Math.cos(ang));
    const py = y + 44 + Math.round(16 * Math.sin(ang));
    fillCircle(px, py, 4, SUNFLOWER);
  }
  line(x + 60, y + 56, x + 60, y + 64, DARK_GREEN, 3);
  // Gilt frame at the right with the record price.
  fillRect(x + 300, y + 8, 140, 48, GOLD);
  fillRect(x + 306, y + 14, 128, 36, [20, 30, 60]);
  drawText(x + 316, y + 22, "$190.4M", 3, WHITE);
}

// ---------------------------------------------------------------- layout ----
function drawPoster() {
  fillRect(0, 0, W, H, PAPER);

  // Masthead.
  drawText(512, 16, "THE WORLD IN ONE DAY", 4, INK, { center: true });
  drawText(512, 62, "THURSDAY 19 NOVEMBER 2026", 6, INK, {
    center: true,
    tracking: 4,
  });
  fillRect(24, 116, 976, 6, INK);
  fillRect(24, 128, 976, 2, INK);
  drawText(512, 140, "FIVE STORIES THAT DEFINED THE DAY", 3, INK, {
    center: true,
  });

  // Lead story: Trump, Xi and Putin meet in China.
  panel(24, 172, 976, 296, NAVY);
  drawSummitArt(36, 184, 372, 272);
  storyNumber(976, 196, 1);
  drawText(436, 192, "DIPLOMACY", 2, LIGHT_RED);
  drawText(436, 216, "TRUMP, XI AND PUTIN", 4, CREAM);
  drawText(436, 250, "MEET IN CHINA", 4, CREAM);
  fillRect(436, 292, 60, 4, GOLD);
  drawWrapped(
    436,
    308,
    "THE THREE LEADERS SHAKE HANDS IN SHENZHEN ON THE APEC SIDELINES IN A FIRST-EVER TRILATERAL SUMMIT.",
    2,
    552,
    CREAM,
    4
  );

  // Row 2, left: GTA VI launches.
  panel(24, 480, 482, 232, PANEL_BG);
  drawViceCityArt(36, 492, 458, 64);
  storyNumber(484, 502, 2);
  drawText(36, 564, "CULTURE", 2, RED);
  drawText(36, 584, "GTA VI GOES GLOBAL", 4, INK);
  drawText(36, 616, "VICE CITY OPENS", 4, INK);
  drawWrapped(
    36,
    652,
    "AFTER A 13-YEAR WAIT, ROCKSTAR'S SEQUEL LAUNCHES WORLDWIDE. PLAYERS FLOOD BACK INTO VICE CITY.",
    2,
    458,
    INK,
    4
  );

  // Row 2, right: Iran hits US bases in Kuwait.
  panel(518, 480, 482, 232, PANEL_BG);
  drawKuwaitArt(530, 492, 458, 64);
  storyNumber(978, 502, 3);
  drawText(530, 564, "MIDDLE EAST", 2, RED);
  drawText(530, 584, "IRAN HITS US BASES", 4, INK);
  drawText(530, 616, "IN KUWAIT", 4, INK);
  drawWrapped(
    530,
    652,
    "TEHRAN EXPANDS ITS STRIKES TO US DRONE AND MISSILE SITES IN KUWAIT AFTER THE US HIT QESHM ISLAND.",
    2,
    458,
    INK,
    4
  );

  // Row 3, left: Anthropic debuts on Nasdaq.
  panel(24, 724, 482, 232, PANEL_BG);
  drawIpoArt(36, 736, 458, 64);
  storyNumber(484, 746, 4);
  drawText(36, 808, "BUSINESS", 2, RED);
  drawText(36, 828, "ANTHROPIC DEBUTS", 4, INK);
  drawText(36, 860, "ON NASDAQ AS ANT", 4, INK);
  drawWrapped(
    36,
    896,
    "PRICED AT $83 A SHARE, THE $81BN OFFERING IS THE BIGGEST IPO EVER. VALUED AT ABOUT $1.5TN.",
    2,
    458,
    INK,
    4
  );

  // Row 3, right: Van Gogh record sale.
  panel(518, 724, 482, 232, PANEL_BG);
  drawVanGoghArt(530, 736, 458, 64);
  storyNumber(978, 746, 5);
  drawText(530, 808, "ART", 2, RED);
  drawText(530, 828, "VAN GOGH SELLS FOR", 4, INK);
  drawText(530, 860, "RECORD $190.4M", 4, INK);
  drawWrapped(
    530,
    896,
    "A PAINTING WITH A NAZI-ERA PAST SELLS AT AUCTION FOR $190.4M, A RECORD FOR THE ARTIST.",
    2,
    458,
    INK,
    4
  );

  // Footer: sources and the day's claim, so the image stands alone.
  fillRect(24, 966, 976, 2, INK);
  drawText(512, 976, "SOURCES: REUTERS, AP, BBC, NYT", 2, INK, {
    center: true,
  });
  drawText(
    512,
    996,
    "EVERY STORY HAPPENED OR WAS FIRST REPORTED ON 19 NOVEMBER 2026",
    2,
    INK,
    { center: true }
  );
}

// ------------------------------------------------------------------ main ----
function main() {
  drawPoster();
  const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
  fs.mkdirSync(outDir, { recursive: true });
  const png = encodePng(W, H, canvas);
  fs.writeFileSync(path.join(outDir, "entry.png"), png);
}

main();
