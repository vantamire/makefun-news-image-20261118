// World news of Wednesday 18 November 2026, drawn as one newspaper front page.
// Pure Node 22 standard library only: no network, no randomness, no Date.
// Writes a 1024x1024 PNG to $MAKEFUN_OUTPUT_DIR/entry.png (default /output).
// Two runs write byte-identical bytes.
//
// Layout: masthead with the day named in full, then six story panels in a
// 2 x 3 grid, each with a pictorial icon, a short headline and a one-line
// summary, plus a footer strip. All text is drawn with a small embedded
// 5x7 bitmap font defined below, scaled up so it stays legible small.
//
// Stories (all reported on 18 November 2026, checked against several
// news sources before drawing):
//   1. APEC leaders meet in Shenzhen, 18-19 Nov; Trump, Xi and Putin plan
//      a first three-way talk on 19 Nov.
//   2. Trump arrives in Manila for Quad talks with India, Australia
//      and Japan ahead of his China visit.
//   3. Ukraine damages the Crimea Bridge; Russia hits two bridges in
//      Kyiv, cutting power and water.
//   4. Iranian drones aimed at a US radar in Bahrain are intercepted;
//      US jets hit a site on Qeshm Island; Kuwait intercepts drones.
//   5. Nvidia reports revenue of $115.8bn, up 103%, its first results
//      since Jensen Huang left as chief.
//   6. Cyclone Akvan strengthens in the Bay of Bengal and heads for
//      Andhra Pradesh; landfall forecast for 20 Nov.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

const W = 1024;
const H = 1024;
const px = new Uint8Array(W * H * 4);

// ------------------------------------------------------------------ colours
type RGBA = [number, number, number, number];
const PAPER: RGBA = [246, 239, 221, 1];
const INK: RGBA = [26, 26, 26, 1];
const WHITE: RGBA = [255, 255, 255, 1];
const GREY: RGBA = [110, 104, 90, 1];
const CARD: RGBA = [255, 253, 247, 1];
const BLUE: RGBA = [30, 90, 160, 1];
const TEAL: RGBA = [0, 120, 110, 1];
const RED: RGBA = [180, 40, 30, 1];
const ORANGE: RGBA = [190, 90, 20, 1];
const GREEN: RGBA = [20, 130, 60, 1];
const PURPLE: RGBA = [90, 70, 160, 1];
const GOLD: RGBA = [220, 160, 40, 1];
const SKY: RGBA = [120, 180, 220, 1];
const SEA: RGBA = [40, 110, 170, 1];

// --------------------------------------------------------- pixel primitives
function blend(x: number, y: number, r: number, g: number, b: number, a: number): void {
  if (x < 0 || y < 0 || x >= W || y >= H || a <= 0) return;
  const i = (y * W + x) * 4;
  const ia = 1 - a;
  px[i] = Math.round(r * a + px[i] * ia);
  px[i + 1] = Math.round(g * a + px[i + 1] * ia);
  px[i + 2] = Math.round(b * a + px[i + 2] * ia);
  px[i + 3] = 255;
}

// Coverage from a signed distance (negative inside): 1 inside, fading to
// 0 over ~1.6 px outside the edge, for clean anti-aliased edges.
function cov(d: number): number {
  const t = 0.5 - d / 1.6;
  return t <= 0 ? 0 : t >= 1 ? 1 : t;
}

function rect(x: number, y: number, w: number, h: number, c: RGBA, alpha = 1): void {
  const x0 = Math.max(0, Math.floor(x));
  const x1 = Math.min(W - 1, Math.ceil(x + w) - 1);
  const y0 = Math.max(0, Math.floor(y));
  const y1 = Math.min(H - 1, Math.ceil(y + h) - 1);
  for (let yy = y0; yy <= y1; yy++) {
    for (let xx = x0; xx <= x1; xx++) blend(xx, yy, c[0], c[1], c[2], alpha * c[3]);
  }
}

function circle(cx: number, cy: number, r: number, c: RGBA, alpha = 1): void {
  const x0 = Math.max(0, Math.floor(cx - r - 2));
  const x1 = Math.min(W - 1, Math.ceil(cx + r + 2));
  const y0 = Math.max(0, Math.floor(cy - r - 2));
  const y1 = Math.min(H - 1, Math.ceil(cy + r + 2));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) - r;
      const a = cov(d) * alpha * c[3];
      if (a > 0) blend(x, y, c[0], c[1], c[2], a);
    }
  }
}

function ring(cx: number, cy: number, r: number, t: number, c: RGBA, alpha = 1): void {
  // Outline only: small discs along the circumference, so nothing inside
  // the ring is painted over.
  const steps = Math.max(24, Math.floor(2 * Math.PI * r));
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * 2 * Math.PI;
    circle(cx + r * Math.cos(a), cy + r * Math.sin(a), t / 2, c, alpha);
  }
}

function ellipse(cx: number, cy: number, rx: number, ry: number, c: RGBA, alpha = 1): void {
  const x0 = Math.max(0, Math.floor(cx - rx - 2));
  const x1 = Math.min(W - 1, Math.ceil(cx + rx + 2));
  const y0 = Math.max(0, Math.floor(cy - ry - 2));
  const y1 = Math.min(H - 1, Math.ceil(cy + ry + 2));
  const m = Math.min(rx, ry);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const nx = (x + 0.5 - cx) / rx;
      const ny = (y + 0.5 - cy) / ry;
      const d = (Math.hypot(nx, ny) - 1) * m;
      const a = cov(d) * alpha * c[3];
      if (a > 0) blend(x, y, c[0], c[1], c[2], a);
    }
  }
}

function distSeg(pxx: number, pyy: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((pxx - ax) * dx + (pyy - ay) * dy) / len2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(pxx - (ax + t * dx), pyy - (ay + t * dy));
}

function sdTriangle(x: number, y: number, ax: number, ay: number, bx: number, by: number, cx: number, cy: number): number {
  const d1 = distSeg(x, y, ax, ay, bx, by);
  const d2 = distSeg(x, y, bx, by, cx, cy);
  const d3 = distSeg(x, y, cx, cy, ax, ay);
  const d = Math.min(d1, d2, d3);
  const s1 = (bx - ax) * (y - ay) - (by - ay) * (x - ax);
  const s2 = (cx - bx) * (y - by) - (cy - by) * (x - bx);
  const s3 = (ax - cx) * (y - cy) - (ay - cy) * (x - cx);
  const inside = (s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0);
  return inside ? -d : d;
}

function triangle(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, c: RGBA, alpha = 1): void {
  const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx) - 2));
  const x1 = Math.min(W - 1, Math.ceil(Math.max(ax, bx, cx) + 2));
  const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy) - 2));
  const y1 = Math.min(H - 1, Math.ceil(Math.max(ay, by, cy) + 2));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const d = sdTriangle(x + 0.5, y + 0.5, ax, ay, bx, by, cx, cy);
      const a = cov(d) * alpha * c[3];
      if (a > 0) blend(x, y, c[0], c[1], c[2], a);
    }
  }
}

// A thick line with round caps.
function line(x1: number, y1: number, x2: number, y2: number, w: number, c: RGBA, alpha = 1): void {
  const r = w / 2;
  const x0 = Math.max(0, Math.floor(Math.min(x1, x2) - r - 2));
  const x1b = Math.min(W - 1, Math.ceil(Math.max(x1, x2) + r + 2));
  const y0 = Math.max(0, Math.floor(Math.min(y1, y2) - r - 2));
  const y1b = Math.min(H - 1, Math.ceil(Math.max(y1, y2) + r + 2));
  for (let y = y0; y <= y1b; y++) {
    for (let x = x0; x <= x1b; x++) {
      const d = distSeg(x + 0.5, y + 0.5, x1, y1, x2, y2) - r;
      const a = cov(d) * alpha * c[3];
      if (a > 0) blend(x, y, c[0], c[1], c[2], a);
    }
  }
}

// A thick quadratic bezier stroke, drawn as overlapping discs.
function bezier(x1: number, y1: number, cx: number, cy: number, x2: number, y2: number, w: number, c: RGBA, alpha = 1): void {
  const steps = 48;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;
    const x = mt * mt * x1 + 2 * mt * t * cx + t * t * x2;
    const y = mt * mt * y1 + 2 * mt * t * cy + t * t * y2;
    circle(x, y, w / 2, c, alpha);
  }
}

// ------------------------------------------------------- 5x7 bitmap font
// Each glyph is 7 rows of 5 cells; '#' is ink, '.' is empty.
const FONT: Record<string, string[]> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.####'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['.###.', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '..##.', '.#...', '#....', '#####'],
  '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.##..', '.##..'],
  ',': ['.....', '.....', '.....', '.....', '.##..', '..#..', '.#...'],
  ':': ['.....', '.##..', '.##..', '.....', '.##..', '.##..', '.....'],
  ';': ['.....', '.##..', '.##..', '.....', '.##..', '..#..', '.#...'],
  "'": ['..#..', '..#..', '.#...', '.....', '.....', '.....', '.....'],
  '-': ['.....', '.....', '.....', '.###.', '.....', '.....', '.....'],
  '/': ['....#', '...#.', '...#.', '..#..', '.#...', '.#...', '#....'],
  '(': ['...#.', '..#..', '.#...', '.#...', '.#...', '..#..', '...#.'],
  ')': ['.#...', '..#..', '...#.', '...#.', '...#.', '..#..', '.#...'],
  '$': ['..#..', '.####', '#.#..', '.###.', '..#.#', '####.', '..#..'],
  '%': ['##..#', '##.#.', '...#.', '..#..', '.#...', '#.##.', '#..##'],
  '&': ['.##..', '#..#.', '#.#..', '.#...', '#.#.#', '#..#.', '.##.#'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  '?': ['.###.', '#...#', '....#', '..##.', '..#..', '.....', '..#..'],
  '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
  '=': ['.....', '.....', '#####', '.....', '#####', '.....', '.....'],
  '*': ['.....', '#.#.#', '.###.', '#####', '.###.', '#.#.#', '.....'],
};

function textWidth(text: string, scale: number): number {
  return text.length * 6 * scale - scale;
}

function drawText(x: number, y: number, text: string, scale: number, c: RGBA): void {
  let cx = x;
  for (const ch of text) {
    const g = FONT[ch] ?? FONT['?'];
    for (let r = 0; r < 7; r++) {
      const row = g[r];
      for (let col = 0; col < 5; col++) {
        if (row[col] === '#') rect(cx + col * scale, y + r * scale, scale, scale, c);
      }
    }
    cx += 6 * scale;
  }
}

function drawCentered(cx: number, y: number, text: string, scale: number, c: RGBA): void {
  drawText(cx - Math.floor(textWidth(text, scale) / 2), y, text, scale, c);
}

// Greedy word wrap to a maximum pixel width; returns the lines.
function wrap(text: string, scale: number, maxW: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur === '' ? w : cur + ' ' + w;
    if (textWidth(next, scale) <= maxW) {
      cur = next;
    } else {
      if (cur !== '') lines.push(cur);
      cur = w;
    }
  }
  if (cur !== '') lines.push(cur);
  return lines;
}

// ------------------------------------------------------------------- icons
// Each icon is drawn inside a 128 x 150 box centred on (cx, cy).

function iconGlobe(cx: number, cy: number): void {
  circle(cx, cy, 52, INK);
  circle(cx, cy, 47, SEA);
  // Land blobs.
  circle(cx - 16, cy - 14, 16, GREEN);
  circle(cx + 18, cy + 12, 14, GREEN);
  circle(cx + 14, cy - 22, 9, GREEN);
  // Meridian and equator lines over the globe.
  line(cx - 44, cy, cx + 44, cy, 4, WHITE, 0.85);
  line(cx, cy - 44, cx, cy + 44, 4, WHITE, 0.85);
}

function iconQuad(cx: number, cy: number): void {
  const cols: RGBA[] = [RED, BLUE, GREEN, GOLD];
  const spots: Array<[number, number]> = [[-26, -26], [26, -26], [-26, 26], [26, 26]];
  for (let i = 0; i < 4; i++) {
    circle(cx + spots[i][0], cy + spots[i][1], 26, WHITE);
    circle(cx + spots[i][0], cy + spots[i][1], 22, cols[i]);
  }
  circle(cx, cy, 12, INK);
  circle(cx, cy, 5, GOLD);
}

function iconBridge(cx: number, cy: number): void {
  // Water.
  line(cx - 58, cy + 42, cx + 58, cy + 42, 4, SEA);
  line(cx - 44, cy + 54, cx + 44, cy + 54, 4, SEA);
  // Towers.
  rect(cx - 52, cy - 30, 10, 62, INK);
  rect(cx + 42, cy - 30, 10, 62, INK);
  // Deck in two pieces: a gap in the middle where the span fell.
  line(cx - 58, cy + 28, cx - 12, cy + 28, 8, INK);
  line(cx + 12, cy + 28, cx + 58, cy + 28, 8, INK);
  // Fallen span, tilted into the water.
  line(cx - 10, cy + 30, cx + 8, cy + 44, 7, GREY);
  // Arch cable over the left half.
  bezier(cx - 52, cy - 30, cx - 30, cy + 6, cx - 8, cy + 28, 4, INK);
  // Blast star above the gap.
  circle(cx, cy - 18, 12, GOLD);
  triangle(cx - 4, cy - 34, cx + 4, cy - 34, cx, cy - 14, GOLD);
  triangle(cx - 20, cy - 22, cx - 6, cy - 16, cx - 14, cy - 6, ORANGE);
  triangle(cx + 20, cy - 22, cx + 6, cy - 16, cx + 14, cy - 6, ORANGE);
}

function iconDrone(cx: number, cy: number): void {
  // Radar dish below.
  bezier(cx - 34, cy + 44, cx, cy + 66, cx + 34, cy + 44, 6, INK);
  line(cx, cy + 52, cx, cy + 66, 5, INK);
  circle(cx, cy + 52, 5, RED);
  // Drone body and arms.
  line(cx - 34, cy - 26, cx + 34, cy - 26, 6, INK);
  line(cx - 34, cy - 26, cx - 34, cy - 6, 5, INK);
  line(cx + 34, cy - 26, cx + 34, cy - 6, 5, INK);
  rect(cx - 16, cy - 34, 32, 16, INK);
  circle(cx, cy - 26, 6, RED);
  // Rotors.
  line(cx - 52, cy - 38, cx - 16, cy - 38, 5, GREY);
  line(cx + 16, cy - 38, cx + 52, cy - 38, 5, GREY);
  circle(cx - 34, cy - 38, 5, GREY);
  circle(cx + 34, cy - 38, 5, GREY);
  // Intercept burst between drone and dish.
  circle(cx + 22, cy + 8, 7, GOLD);
  line(cx + 14, cy + 2, cx + 30, cy + 14, 3, GOLD);
}

function iconChip(cx: number, cy: number): void {
  // Chip body with pins.
  rect(cx - 34, cy - 34, 68, 68, INK);
  rect(cx - 22, cy - 22, 44, 44, GREEN);
  rect(cx - 12, cy - 12, 24, 24, INK);
  for (let i = -1; i <= 1; i++) {
    rect(cx + i * 20 - 3, cy - 46, 6, 12, INK);
    rect(cx + i * 20 - 3, cy + 34, 6, 12, INK);
    rect(cx - 46, cy + i * 20 - 3, 12, 6, INK);
    rect(cx + 34, cy + i * 20 - 3, 12, 6, INK);
  }
  // Rising bars chart above the chip.
  rect(cx - 44, cy - 62, 10, 12, GREEN);
  rect(cx - 22, cy - 70, 10, 20, GREEN);
  rect(cx, cy - 78, 10, 28, GREEN);
  rect(cx + 22, cy - 86, 10, 36, GREEN);
  line(cx - 48, cy - 88, cx + 36, cy - 92, 4, GREEN);
  triangle(cx + 36, cy - 98, cx + 36, cy - 84, cx + 50, cy - 91, GREEN);
}

function iconCyclone(cx: number, cy: number): void {
  // Swirl: three rings and a calm eye.
  ring(cx, cy - 6, 48, 7, PURPLE);
  ring(cx, cy - 6, 32, 7, PURPLE);
  ring(cx, cy - 6, 16, 6, PURPLE);
  circle(cx, cy - 6, 6, GOLD);
  // Rain drops below.
  for (const dx of [-30, -10, 10, 30]) {
    triangle(cx + dx - 5, cy + 44, cx + dx + 5, cy + 44, cx + dx, cy + 58, SEA);
    circle(cx + dx, cy + 44, 5, SEA);
  }
  // Wind arrow curling in.
  bezier(cx - 58, cy - 52, cx - 20, cy - 66, cx + 6, cy - 52, 5, SKY);
  triangle(cx + 6, cy - 58, cx + 6, cy - 44, cx + 18, cy - 51, SKY);
}

// ------------------------------------------------------------------ stories
interface Story {
  kicker: string;
  head1: string;
  head2: string;
  body: string;
  place: string;
  accent: RGBA;
  tint: RGBA;
  icon: (cx: number, cy: number) => void;
}

const STORIES: Story[] = [
  {
    kicker: 'CHINA - APEC',
    head1: 'APEC OPENS',
    head2: 'IN SHENZHEN',
    body: 'LEADERS OF 21 ECONOMIES MEET 18-19 NOV. TRUMP, XI AND PUTIN PLAN A FIRST THREE-WAY TALK ON 19 NOV.',
    place: 'SHENZHEN, CHINA',
    accent: BLUE,
    tint: [214, 230, 244, 1],
    icon: iconGlobe,
  },
  {
    kicker: 'PHILIPPINES - QUAD',
    head1: 'QUAD MEETS',
    head2: 'IN MANILA',
    body: 'TRUMP ARRIVES FOR TALKS WITH INDIA, AUSTRALIA AND JAPAN BEFORE HIS VISIT TO CHINA.',
    place: 'MANILA, PHILIPPINES',
    accent: TEAL,
    tint: [208, 236, 232, 1],
    icon: iconQuad,
  },
  {
    kicker: 'UKRAINE - WAR',
    head1: 'BRIDGE WAR',
    head2: 'IN UKRAINE',
    body: 'UKRAINE DAMAGES THE CRIMEA BRIDGE. RUSSIA HITS TWO BRIDGES IN KYIV, CUTTING POWER AND WATER.',
    place: 'KERCH STRAIT - KYIV',
    accent: RED,
    tint: [244, 214, 210, 1],
    icon: iconBridge,
  },
  {
    kicker: 'GULF - TENSION',
    head1: 'DRONES OVER',
    head2: 'THE GULF',
    body: 'IRAN DRONES AIMED AT A US RADAR IN BAHRAIN ARE INTERCEPTED. US JETS HIT A SITE ON QESHM ISLAND.',
    place: 'BAHRAIN - QESHM',
    accent: ORANGE,
    tint: [244, 226, 208, 1],
    icon: iconDrone,
  },
  {
    kicker: 'TECH - MARKETS',
    head1: 'NVIDIA',
    head2: 'DOUBLES SALES',
    body: 'REVENUE OF $115.8BN, UP 103 PERCENT. FIRST RESULTS SINCE JENSEN HUANG LEFT AS CHIEF.',
    place: 'AI CHIPS - USA',
    accent: GREEN,
    tint: [210, 238, 220, 1],
    icon: iconChip,
  },
  {
    kicker: 'INDIA - WEATHER',
    head1: 'CYCLONE AKVAN',
    head2: 'NEARS INDIA',
    body: 'STORM AKVAN STRENGTHENS IN THE BAY OF BENGAL AND HEADS FOR ANDHRA PRADESH. LANDFALL DUE 20 NOV.',
    place: 'BAY OF BENGAL',
    accent: PURPLE,
    tint: [226, 220, 244, 1],
    icon: iconCyclone,
  },
];

// ------------------------------------------------------------- draw the page
for (let i = 0; i < W * H; i++) {
  px[i * 4] = PAPER[0];
  px[i * 4 + 1] = PAPER[1];
  px[i * 4 + 2] = PAPER[2];
  px[i * 4 + 3] = 255;
}

// Thin double border around the whole page.
rect(10, 10, W - 20, 4, INK);
rect(10, H - 14, W - 20, 4, INK);
rect(10, 10, 4, H - 20, INK);
rect(W - 14, 10, 4, H - 20, INK);

// Masthead.
drawCentered(512, 28, 'WORLD NEWS', 9, INK);
rect(24, 106, 976, 5, INK);
rect(24, 116, 976, 2, INK);
drawCentered(512, 130, 'WEDNESDAY 18 NOVEMBER 2026', 4, INK);
drawCentered(512, 164, 'SIX STORIES FROM ONE DAY AROUND THE WORLD', 2, GREY);
rect(24, 188, 976, 3, INK);

// Story panels: 2 columns x 3 rows.
const PW = 480;
const PH = 248;
const PX0 = [24, 520];
const PY0 = [200, 464, 728];
for (let s = 0; s < STORIES.length; s++) {
  const st = STORIES[s];
  const x = PX0[s % 2];
  const y = PY0[Math.floor(s / 2)];
  // Card.
  rect(x, y, PW, PH, CARD);
  rect(x, y, PW, 12, st.accent);
  rect(x, y, PW, 3, INK);
  rect(x, y + PH - 3, PW, 3, INK);
  rect(x, y, 3, PH, INK);
  rect(x + PW - 3, y, 3, PH, INK);
  // Icon zone.
  rect(x + 14, y + 26, 128, 150, st.tint);
  st.icon(x + 78, y + 101);
  // Dateline centred on the whole panel, below the body text.
  drawCentered(x + 240, y + 220, st.place, 2, GREY);
  // Text zone.
  const tx = x + 156;
  drawText(tx, y + 30, st.kicker, 2, st.accent);
  drawText(tx, y + 58, st.head1, 3, INK);
  drawText(tx, y + 86, st.head2, 3, INK);
  rect(tx, y + 118, 310, 2, INK);
  const lines = wrap(st.body, 2, 310);
  for (let li = 0; li < lines.length && li < 4; li++) {
    drawText(tx, y + 132 + li * 18, lines[li], 2, INK);
  }
}

// Footer strip.
rect(24, 984, 976, 2, INK);
drawCentered(512, 994, 'ALSO: MS DHONI ENDS HIS IPL CAREER AND BECOMES CSK MENTOR', 2, INK);

// ------------------------------------------------------------- PNG encode
const CRC_TABLE = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c;
}
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}
function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // colour type RGBA
ihdr[10] = 0; // compression
ihdr[11] = 0; // filter
ihdr[12] = 0; // interlace

// Filter each scanline with the best of the five PNG filters (deterministic).
const stride = W * 4;
const raw = Buffer.alloc(H * (stride + 1));
for (let y = 0; y < H; y++) {
  const row = px.subarray(y * stride, (y + 1) * stride);
  const prev = y === 0 ? null : px.subarray((y - 1) * stride, y * stride);
  let bestId = 0;
  let best: Buffer | null = null;
  let bestScore = Infinity;
  for (let f = 0; f <= 4; f++) {
    const cand = Buffer.alloc(stride);
    let score = 0;
    for (let i = 0; i < stride; i++) {
      const v = row[i];
      const a = i >= 4 ? row[i - 4] : 0;
      const b = prev ? prev[i] : 0;
      const c = prev && i >= 4 ? prev[i - 4] : 0;
      let fv: number;
      if (f === 0) fv = v;
      else if (f === 1) fv = (v - a) & 0xff;
      else if (f === 2) fv = (v - b) & 0xff;
      else if (f === 3) fv = (v - ((a + b) >> 1)) & 0xff;
      else fv = (v - paeth(a, b, c)) & 0xff;
      cand[i] = fv;
      score += Math.abs(fv < 128 ? fv : fv - 256);
    }
    if (score < bestScore) {
      bestScore = score;
      bestId = f;
      best = cand;
    }
  }
  raw[y * (stride + 1)] = bestId;
  raw.set(best as Buffer, y * (stride + 1) + 1);
}

const idat = deflateSync(raw, { level: 9 });
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', idat),
  chunk('IEND', Buffer.alloc(0)),
]);

const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'entry.png'), png);
