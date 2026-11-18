// World news of Wednesday 18 November 2026, drawn as one newspaper front
// page. Version 2: a real front page, not six equal boxes — one big lead
// story (the US-Iran tanker war), two mid stories, three compact stories,
// a COP31 footer line, and type big enough to read at 300 px across.
// Pure Node 22 standard library only: no network, no randomness, no Date.
// Writes a 1024x1024 PNG to $MAKEFUN_OUTPUT_DIR/entry.png (default
// /output). Two runs write byte-identical bytes.
//
// Stories (all first reported on 18 November 2026, each checked against
// at least two independent news sources before drawing):
//   1. US sinks five Iranian oil tankers; Iran hits back at ships and a
//      base in Jordan; oil tops $100.
//   2. APEC opens in Shenzhen: Xi opens the summit, Putin lands, Trump
//      flies in from Manila; three-way talks set for Thursday.
//   3. Kerch Bridge shut a second night; Russia hits two Kyiv bridges.
//   4. North Korea fires a ballistic missile into the Sea of Japan.
//   5. UN warns of cold deaths in Gaza as winter sets in; 1.7m displaced.
//   6. Cyclone Akvan strengthens in the Bay of Bengal; landfall due 20 Nov.
//   Footer: COP31 climate talks enter their decisive phase, 144 items
//   still disputed.
//
// Dropped from v1 on purpose: the Nvidia earnings panel (first reported
// 17 Nov, not 18 Nov) and the Dhoni footer line (not verified as 18 Nov
// news). The Quad talks are folded into the APEC story, where they belong.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

const W = 1024;
const H = 1024;
const img = new Uint8Array(W * H * 4);

// ---------------------------------------------------------------- colours
// Each colour is [red, green, blue]; alpha is a separate argument.
type RGB = [number, number, number];
const PAPER: RGB = [246, 239, 221];
const INK: RGB = [26, 26, 26];
const WHITE: RGB = [255, 255, 255];
const GREY: RGB = [110, 104, 90];
const CARD: RGB = [255, 253, 247];
const BLUE: RGB = [30, 90, 160];
const TEAL: RGB = [0, 120, 110];
const RED: RGB = [180, 40, 30];
const ORANGE: RGB = [190, 90, 20];
const GREEN: RGB = [20, 130, 60];
const PURPLE: RGB = [90, 70, 160];
const GOLD: RGB = [220, 160, 40];
const SKY: RGB = [120, 180, 220];
const SEA: RGB = [40, 110, 170];
const SMOKE: RGB = [120, 118, 112];
const SAND: RGB = [210, 180, 130];

// ------------------------------------------------------- pixel primitives
function put(x: number, y: number, c: RGB, a: number): void {
  if (x < 0 || y < 0 || x >= W || y >= H || a <= 0) return;
  const i = (y * W + x) * 4;
  const ia = 1 - a;
  img[i] = Math.round(c[0] * a + img[i] * ia);
  img[i + 1] = Math.round(c[1] * a + img[i + 1] * ia);
  img[i + 2] = Math.round(c[2] * a + img[i + 2] * ia);
  img[i + 3] = 255;
}

// Edge coverage from a signed distance: 1 inside, fading to 0 over ~1.6 px.
function cov(d: number): number {
  const t = 0.5 - d / 1.6;
  return t <= 0 ? 0 : t >= 1 ? 1 : t;
}

function box(x: number, y: number, w: number, h: number, c: RGB, alpha = 1): void {
  const x0 = Math.max(0, Math.floor(x));
  const x1 = Math.min(W - 1, Math.ceil(x + w) - 1);
  const y0 = Math.max(0, Math.floor(y));
  const y1 = Math.min(H - 1, Math.ceil(y + h) - 1);
  for (let yy = y0; yy <= y1; yy++)
    for (let xx = x0; xx <= x1; xx++) put(xx, yy, c, alpha);
}

function disc(cx: number, cy: number, r: number, c: RGB, alpha = 1): void {
  const x0 = Math.max(0, Math.floor(cx - r - 2));
  const x1 = Math.min(W - 1, Math.ceil(cx + r + 2));
  const y0 = Math.max(0, Math.floor(cy - r - 2));
  const y1 = Math.min(H - 1, Math.ceil(cy + r + 2));
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) - r;
      const a = cov(d) * alpha;
      if (a > 0) put(x, y, c, a);
    }
}

function circ(cx: number, cy: number, r: number, t: number, c: RGB, alpha = 1): void {
  const steps = Math.max(24, Math.floor(2 * Math.PI * r));
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * 2 * Math.PI;
    disc(cx + r * Math.cos(a), cy + r * Math.sin(a), t / 2, c, alpha);
  }
}

function oval(cx: number, cy: number, rx: number, ry: number, c: RGB, alpha = 1): void {
  const x0 = Math.max(0, Math.floor(cx - rx - 2));
  const x1 = Math.min(W - 1, Math.ceil(cx + rx + 2));
  const y0 = Math.max(0, Math.floor(cy - ry - 2));
  const y1 = Math.min(H - 1, Math.ceil(cy + ry + 2));
  const m = Math.min(rx, ry);
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const nx = (x + 0.5 - cx) / rx;
      const ny = (y + 0.5 - cy) / ry;
      const d = (Math.hypot(nx, ny) - 1) * m;
      const a = cov(d) * alpha;
      if (a > 0) put(x, y, c, a);
    }
}

function segD(x: number, y: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 === 0 ? 0 : ((x - ax) * dx + (y - ay) * dy) / l2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
}

function triD(x: number, y: number, ax: number, ay: number, bx: number, by: number, cx: number, cy: number): number {
  const d1 = segD(x, y, ax, ay, bx, by);
  const d2 = segD(x, y, bx, by, cx, cy);
  const d3 = segD(x, y, cx, cy, ax, ay);
  const d = Math.min(d1, d2, d3);
  const s1 = (bx - ax) * (y - ay) - (by - ay) * (x - ax);
  const s2 = (cx - bx) * (y - by) - (cy - by) * (x - bx);
  const s3 = (ax - cx) * (y - cy) - (ay - cy) * (x - cx);
  const inside = (s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0);
  return inside ? -d : d;
}

function tri(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, c: RGB, alpha = 1): void {
  const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx) - 2));
  const x1 = Math.min(W - 1, Math.ceil(Math.max(ax, bx, cx) + 2));
  const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy) - 2));
  const y1 = Math.min(H - 1, Math.ceil(Math.max(ay, by, cy) + 2));
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const d = triD(x + 0.5, y + 0.5, ax, ay, bx, by, cx, cy);
      const a = cov(d) * alpha;
      if (a > 0) put(x, y, c, a);
    }
}

// A thick line with round caps.
function stroke(x1: number, y1: number, x2: number, y2: number, w: number, c: RGB, alpha = 1): void {
  const r = w / 2;
  const x0 = Math.max(0, Math.floor(Math.min(x1, x2) - r - 2));
  const x1b = Math.min(W - 1, Math.ceil(Math.max(x1, x2) + r + 2));
  const y0 = Math.max(0, Math.floor(Math.min(y1, y2) - r - 2));
  const y1b = Math.min(H - 1, Math.ceil(Math.max(y1, y2) + r + 2));
  for (let y = y0; y <= y1b; y++)
    for (let x = x0; x <= x1b; x++) {
      const d = segD(x + 0.5, y + 0.5, x1, y1, x2, y2) - r;
      const a = cov(d) * alpha;
      if (a > 0) put(x, y, c, a);
    }
}

// A thick quadratic bezier stroke, drawn as overlapping discs.
function curve(x1: number, y1: number, cx: number, cy: number, x2: number, y2: number, w: number, c: RGB, alpha = 1): void {
  const steps = 48;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;
    const x = mt * mt * x1 + 2 * mt * t * cx + t * t * x2;
    const y = mt * mt * y1 + 2 * mt * t * cy + t * t * y2;
    disc(x, y, w / 2, c, alpha);
  }
}

// ---------------------------------------------------------- 5x7 bitmap font
// Each glyph is 7 rows of 5 bits, stored as numbers; bit 4 is the leftmost
// column. A '?' renders for any character without a glyph.
const GLYPHS: Record<string, number[]> = {
  A: [14, 17, 17, 31, 17, 17, 17],
  B: [30, 17, 17, 30, 17, 17, 30],
  C: [14, 17, 16, 16, 16, 17, 14],
  D: [30, 17, 17, 17, 17, 17, 30],
  E: [31, 16, 16, 30, 16, 16, 31],
  F: [31, 16, 16, 30, 16, 16, 16],
  G: [14, 17, 16, 23, 17, 17, 15],
  H: [17, 17, 17, 31, 17, 17, 17],
  I: [14, 4, 4, 4, 4, 4, 14],
  J: [7, 2, 2, 2, 2, 18, 12],
  K: [17, 18, 20, 24, 20, 18, 17],
  L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17],
  N: [17, 25, 21, 19, 17, 17, 17],
  O: [14, 17, 17, 17, 17, 17, 14],
  P: [30, 17, 17, 30, 16, 16, 16],
  Q: [14, 17, 17, 17, 21, 18, 13],
  R: [30, 17, 17, 30, 20, 18, 17],
  S: [15, 16, 16, 14, 1, 1, 30],
  T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14],
  V: [17, 17, 17, 17, 17, 10, 4],
  W: [17, 17, 17, 21, 21, 27, 17],
  X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 10, 4, 4, 4, 4],
  Z: [31, 1, 2, 4, 8, 16, 31],
  '0': [14, 17, 19, 21, 25, 17, 14],
  '1': [4, 12, 4, 4, 4, 4, 14],
  '2': [14, 17, 1, 6, 8, 16, 31],
  '3': [30, 1, 1, 14, 1, 1, 30],
  '4': [2, 6, 10, 18, 31, 2, 2],
  '5': [31, 16, 30, 1, 1, 17, 14],
  '6': [6, 8, 16, 30, 17, 17, 14],
  '7': [31, 1, 2, 4, 8, 8, 8],
  '8': [14, 17, 17, 14, 17, 17, 14],
  '9': [14, 17, 17, 15, 1, 2, 12],
  ' ': [0, 0, 0, 0, 0, 0, 0],
  '.': [0, 0, 0, 0, 0, 12, 12],
  ',': [0, 0, 0, 0, 12, 4, 8],
  ':': [0, 12, 12, 0, 12, 12, 0],
  ';': [0, 12, 12, 0, 12, 4, 8],
  "'": [4, 4, 8, 0, 0, 0, 0],
  '-': [0, 0, 0, 14, 0, 0, 0],
  '/': [1, 2, 2, 4, 8, 8, 16],
  '(': [2, 4, 8, 8, 8, 4, 2],
  ')': [8, 4, 2, 2, 2, 4, 8],
  '$': [4, 15, 20, 14, 5, 30, 4],
  '%': [25, 26, 2, 4, 8, 22, 19],
  '&': [12, 18, 20, 8, 21, 18, 13],
  '+': [0, 4, 4, 31, 4, 4, 0],
  '?': [14, 17, 1, 6, 4, 0, 4],
  '!': [4, 4, 4, 4, 4, 0, 4],
  '=': [0, 0, 31, 0, 31, 0, 0],
  '*': [0, 21, 14, 31, 14, 21, 0],
};

function glyph(ch: string): number[] {
  return GLYPHS[ch] ?? GLYPHS['?'];
}

// Width of a string at a scale, with an advance of `adv` cells per glyph.
// Headlines use adv 5.5 (tight tracking); body and kickers use 6.
function textW(s: string, scale: number, adv = 6): number {
  return s.length * adv * scale - scale;
}

function text(x: number, y: number, s: string, scale: number, c: RGB, adv = 6): void {
  let cx = x;
  for (const ch of s) {
    const g = glyph(ch);
    for (let r = 0; r < 7; r++) {
      const row = g[r];
      for (let col = 0; col < 5; col++) {
        if ((row >> (4 - col)) & 1) box(cx + col * scale, y + r * scale, scale, scale, c);
      }
    }
    cx += adv * scale;
  }
}

function textC(cx: number, y: number, s: string, scale: number, c: RGB, adv = 6): void {
  text(cx - Math.floor(textW(s, scale, adv) / 2), y, s, scale, c, adv);
}

// Greedy word wrap to a maximum pixel width; returns the lines.
function wrap(s: string, scale: number, maxW: number, adv = 6): string[] {
  const words = s.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur === '' ? w : cur + ' ' + w;
    if (textW(next, scale, adv) <= maxW) cur = next;
    else {
      if (cur !== '') lines.push(cur);
      cur = w;
    }
  }
  if (cur !== '') lines.push(cur);
  return lines;
}

// ------------------------------------------------------------------- icons
// Every icon draws inside a square centred on (cx, cy), spanning about
// [-s, s] in each axis, so the same drawing works at any size.

function flake(x: number, y: number, r: number, c: RGB): void {
  stroke(x - r, y, x + r, y, 2, c);
  stroke(x - r * 0.7, y - r * 0.7, x + r * 0.7, y + r * 0.7, 2, c);
  stroke(x + r * 0.7, y - r * 0.7, x - r * 0.7, y + r * 0.7, 2, c);
  disc(x, y, 2, c);
}

function iconSea(cx: number, cy: number, s: number): void {
  // Sun at left, sea, two tankers (one listing and burning) and a distant ship.
  disc(cx - s * 0.55, cy - s * 0.62, s * 0.2, GOLD);
  box(cx - s, cy + s * 0.08, 2 * s, s * 0.92, SEA);
  // Distant ship on the horizon, between the two tankers.
  box(cx - s * 0.02, cy + s * 0.02, s * 0.22, s * 0.06, GREY);
  stroke(cx + s * 0.09, cy + s * 0.02, cx + s * 0.09, cy - s * 0.12, 3, GREY);
  // Upright tanker, left.
  box(cx - s * 0.88, cy + s * 0.12, s * 0.72, s * 0.16, INK);
  tri(cx - s * 0.16, cy + s * 0.12, cx - s * 0.16, cy + s * 0.28, cx - s * 0.02, cy + s * 0.28, INK);
  box(cx - s * 0.42, cy - s * 0.06, s * 0.1, s * 0.18, INK);
  box(cx - s * 0.8, cy - s * 0.02, s * 0.14, s * 0.14, RED);
  box(cx - s * 0.62, cy - s * 0.02, s * 0.14, s * 0.14, GREEN);
  // Listing tanker, right: hull as a tilted parallelogram with a pale deck
  // line so the list reads, smoke from its funnel, blast at its stern.
  tri(cx + s * 0.18, cy + s * 0.42, cx + s * 0.82, cy + s * 0.24, cx + s * 0.82, cy + s * 0.38, INK);
  tri(cx + s * 0.18, cy + s * 0.42, cx + s * 0.82, cy + s * 0.38, cx + s * 0.18, cy + s * 0.56, INK);
  stroke(cx + s * 0.18, cy + s * 0.42, cx + s * 0.82, cy + s * 0.24, 3, WHITE, 0.9);
  stroke(cx + s * 0.45, cy + s * 0.33, cx + s * 0.55, cy + s * 0.12, s * 0.08, INK);
  disc(cx + s * 0.55, cy + s * 0.02, s * 0.1, SMOKE);
  disc(cx + s * 0.62, cy - s * 0.14, s * 0.11, SMOKE);
  disc(cx + s * 0.16, cy + s * 0.28, s * 0.09, GOLD);
  tri(cx + s * 0.06, cy + s * 0.12, cx + s * 0.26, cy + s * 0.12, cx + s * 0.16, cy + s * 0.28, ORANGE);
  // Wave lines.
  stroke(cx - s * 0.9, cy + s * 0.62, cx - s * 0.3, cy + s * 0.62, 4, WHITE, 0.8);
  stroke(cx + s * 0.1, cy + s * 0.78, cx + s * 0.7, cy + s * 0.78, 4, WHITE, 0.8);
  stroke(cx - s * 0.6, cy + s * 0.88, cx + s * 0.2, cy + s * 0.88, 4, WHITE, 0.8);
}

function iconGlobe(cx: number, cy: number, s: number): void {
  disc(cx, cy, s * 0.92, SEA);
  disc(cx - s * 0.32, cy - s * 0.28, s * 0.3, GREEN);
  disc(cx + s * 0.38, cy + s * 0.22, s * 0.26, GREEN);
  disc(cx + s * 0.28, cy - s * 0.42, s * 0.17, GREEN);
  stroke(cx - s * 0.88, cy, cx + s * 0.88, cy, 3, WHITE, 0.85);
  stroke(cx, cy - s * 0.88, cx, cy + s * 0.88, 3, WHITE, 0.85);
  // Three pins: the three powers meeting in Shenzhen.
  disc(cx - s * 0.45, cy - s * 0.05, s * 0.1, RED);
  disc(cx + s * 0.05, cy - s * 0.55, s * 0.1, BLUE);
  disc(cx + s * 0.5, cy + s * 0.35, s * 0.1, GOLD);
}

function iconBridge(cx: number, cy: number, s: number): void {
  // Water.
  stroke(cx - s * 0.95, cy + s * 0.68, cx + s * 0.95, cy + s * 0.68, 4, SEA);
  stroke(cx - s * 0.7, cy + s * 0.85, cx + s * 0.7, cy + s * 0.85, 4, SEA);
  // Towers.
  box(cx - s * 0.85, cy - s * 0.5, s * 0.16, s * 1.0, INK);
  box(cx + s * 0.69, cy - s * 0.5, s * 0.16, s * 1.0, INK);
  // Deck in two pieces: a gap in the middle where the span fell.
  stroke(cx - s * 0.95, cy + s * 0.45, cx - s * 0.2, cy + s * 0.45, 8, INK);
  stroke(cx + s * 0.2, cy + s * 0.45, cx + s * 0.95, cy + s * 0.45, 8, INK);
  // Fallen span, tilted into the water.
  stroke(cx - s * 0.18, cy + s * 0.48, cx + s * 0.02, cy + s * 0.72, 7, GREY);
  // Arch cable over the left half.
  curve(cx - s * 0.85, cy - s * 0.5, cx - s * 0.5, cy + s * 0.1, cx - s * 0.14, cy + s * 0.45, 4, INK);
  // Blast star above the gap.
  disc(cx, cy - s * 0.28, s * 0.2, GOLD);
  tri(cx - s * 0.07, cy - s * 0.55, cx + s * 0.07, cy - s * 0.55, cx, cy - s * 0.22, GOLD);
  tri(cx - s * 0.33, cy - s * 0.36, cx - s * 0.1, cy - s * 0.26, cx - s * 0.23, cy - s * 0.1, ORANGE);
  tri(cx + s * 0.33, cy - s * 0.36, cx + s * 0.1, cy - s * 0.26, cx + s * 0.23, cy - s * 0.1, ORANGE);
}

function iconMissile(cx: number, cy: number, s: number): void {
  // Sea at the bottom, launch arc, rocket climbing with flame and smoke.
  box(cx - s, cy + s * 0.72, 2 * s, s * 0.28, SEA);
  curve(cx - s * 0.9, cy + s * 0.85, cx - s * 0.2, cy + s * 0.1, cx + s * 0.1, cy - s * 0.5, 4, GREY, 0.7);
  box(cx - s * 0.14, cy - s * 0.55, s * 0.28, s * 0.75, WHITE);
  tri(cx - s * 0.14, cy - s * 0.55, cx + s * 0.14, cy - s * 0.55, cx, cy - s * 0.85, RED);
  box(cx - s * 0.14, cy - s * 0.1, s * 0.28, s * 0.08, RED);
  tri(cx - s * 0.14, cy + s * 0.2, cx - s * 0.34, cy + s * 0.38, cx - s * 0.14, cy + s * 0.38, INK);
  tri(cx + s * 0.14, cy + s * 0.2, cx + s * 0.34, cy + s * 0.38, cx + s * 0.14, cy + s * 0.38, INK);
  tri(cx - s * 0.1, cy + s * 0.2, cx + s * 0.1, cy + s * 0.2, cx, cy + s * 0.62, ORANGE);
  tri(cx - s * 0.05, cy + s * 0.2, cx + s * 0.05, cy + s * 0.2, cx, cy + s * 0.45, GOLD);
  disc(cx - s * 0.05, cy + s * 0.72, s * 0.12, SMOKE, 0.8);
  disc(cx + s * 0.12, cy + s * 0.8, s * 0.1, SMOKE, 0.8);
}

function iconTents(cx: number, cy: number, s: number): void {
  // Three tents on the ground, snow falling on a displaced camp.
  stroke(cx - s, cy + s * 0.7, cx + s, cy + s * 0.7, 4, GREY);
  tri(cx - s * 0.95, cy + s * 0.7, cx - s * 0.55, cy + s * 0.7, cx - s * 0.75, cy + s * 0.15, SAND);
  tri(cx - s * 0.4, cy + s * 0.7, cx + s * 0.05, cy + s * 0.7, cx - s * 0.17, cy + s * 0.05, [190, 150, 90]);
  tri(cx + s * 0.25, cy + s * 0.7, cx + s * 0.7, cy + s * 0.7, cx + s * 0.48, cy + s * 0.2, SAND);
  tri(cx - s * 0.79, cy + s * 0.7, cx - s * 0.71, cy + s * 0.7, cx - s * 0.75, cy + s * 0.45, INK);
  tri(cx - s * 0.21, cy + s * 0.7, cx - s * 0.13, cy + s * 0.7, cx - s * 0.17, cy + s * 0.45, INK);
  tri(cx + s * 0.44, cy + s * 0.7, cx + s * 0.52, cy + s * 0.7, cx + s * 0.48, cy + s * 0.48, INK);
  flake(cx - s * 0.7, cy - s * 0.45, s * 0.11, SKY);
  flake(cx + s * 0.1, cy - s * 0.65, s * 0.11, SKY);
  flake(cx + s * 0.75, cy - s * 0.35, s * 0.11, SKY);
}

function iconStorm(cx: number, cy: number, s: number): void {
  // Spiral over the sea, curling onto a green coastline at bottom right.
  tri(cx + s * 0.1, cy + s * 0.9, cx + s, cy + s * 0.9, cx + s * 0.85, cy + s * 0.1, GREEN);
  circ(cx - s * 0.1, cy - s * 0.1, s * 0.75, s * 0.11, PURPLE);
  circ(cx - s * 0.1, cy - s * 0.1, s * 0.48, s * 0.11, PURPLE);
  circ(cx - s * 0.1, cy - s * 0.1, s * 0.22, s * 0.1, PURPLE);
  disc(cx - s * 0.1, cy - s * 0.1, s * 0.08, GOLD);
  tri(cx - s * 0.75, cy + s * 0.55, cx - s * 0.65, cy + s * 0.55, cx - s * 0.7, cy + s * 0.75, SEA);
  tri(cx - s * 0.45, cy + s * 0.62, cx - s * 0.35, cy + s * 0.62, cx - s * 0.4, cy + s * 0.82, SEA);
}

// ------------------------------------------------------------------ stories
interface Story {
  kicker: string;
  heads: string[];
  body: string;
  fact: string;
  accent: RGB;
  tint: RGB;
  icon: (cx: number, cy: number, s: number) => void;
}

const LEAD: Story = {
  kicker: 'GULF WAR - US V IRAN',
  heads: ['US SINKS FIVE', 'IRANIAN TANKERS'],
  body: 'CENTCOM DESTROYS FIVE OIL TANKERS AFTER IRAN FIRES AT A US WARSHIP. IRAN HITS BACK AT SHIPS AND A BASE IN JORDAN. OIL TOPS $100.',
  fact: '',
  accent: RED,
  tint: [222, 236, 246],
  icon: iconSea,
};

const MID: Story[] = [
  {
    kicker: 'CHINA - APEC',
    heads: ['APEC OPENS', 'IN SHENZHEN'],
    body: 'XI OPENS THE SUMMIT. PUTIN LANDS. TRUMP FROM MANILA. TALKS THURSDAY.',
    fact: '',
    accent: BLUE,
    tint: [214, 230, 244],
    icon: iconGlobe,
  },
  {
    kicker: 'UKRAINE - WAR',
    heads: ['BRIDGE WAR', 'IN UKRAINE'],
    body: 'KERCH BRIDGE SHUT AGAIN. RUSSIA HITS TWO KYIV BRIDGES. POWER CUT.',
    fact: '',
    accent: RED,
    tint: [244, 214, 210],
    icon: iconBridge,
  },
];

const SMALL: Story[] = [
  {
    kicker: 'KOREA - MISSILE',
    heads: ['NORTH KOREA', 'FIRES MISSILE'],
    body: '',
    fact: 'TO SEA OF JAPAN',
    accent: ORANGE,
    tint: [244, 226, 208],
    icon: iconMissile,
  },
  {
    kicker: 'GAZA - WINTER',
    heads: ['GAZA FACES', 'COLD WINTER'],
    body: '',
    fact: '1.7M DISPLACED',
    accent: TEAL,
    tint: [208, 236, 232],
    icon: iconTents,
  },
  {
    kicker: 'INDIA - WEATHER',
    heads: ['CYCLONE AKVAN', 'NEARS INDIA'],
    body: '',
    fact: 'WINDS 145 KM/H',
    accent: PURPLE,
    tint: [226, 220, 244],
    icon: iconStorm,
  },
];

// ------------------------------------------------------------- draw the page
for (let i = 0; i < W * H; i++) {
  img[i * 4] = PAPER[0];
  img[i * 4 + 1] = PAPER[1];
  img[i * 4 + 2] = PAPER[2];
  img[i * 4 + 3] = 255;
}

// Thin double border around the whole page.
box(10, 10, W - 20, 4, INK);
box(10, H - 14, W - 20, 4, INK);
box(10, 10, 4, H - 20, INK);
box(W - 14, 10, 4, H - 20, INK);

// Masthead: the paper name and the day it sums up, nothing else.
textC(512, 28, 'WORLD NEWS', 9, INK);
box(24, 106, 976, 5, INK);
box(24, 116, 976, 2, INK);
textC(512, 130, 'WEDNESDAY 18 NOVEMBER 2026', 4, INK);
box(24, 172, 976, 3, INK);

// A story card: paper face, coloured top bar, thin ink frame.
function frame(x: number, y: number, w: number, h: number, accent: RGB): void {
  box(x, y, w, h, CARD);
  box(x, y, w, 12, accent);
  box(x, y, w, 3, INK);
  box(x, y + h - 3, w, 3, INK);
  box(x, y, 3, h, INK);
  box(x + w - 3, y, 3, h, INK);
}

// LEAD: full width, big scene on the left, headline at scale 6.
{
  const x = 24;
  const y = 184;
  frame(x, y, 976, 292, LEAD.accent);
  box(x + 16, y + 26, 300, 240, LEAD.tint);
  LEAD.icon(x + 166, y + 146, 120);
  text(x + 336, y + 34, LEAD.kicker, 3, LEAD.accent);
  text(x + 336, y + 64, LEAD.heads[0], 6, INK, 5.5);
  text(x + 336, y + 112, LEAD.heads[1], 6, INK, 5.5);
  box(x + 336, y + 164, 624, 2, INK);
  const lines = wrap(LEAD.body, 3, 624);
  for (let li = 0; li < lines.length && li < 4; li++) {
    text(x + 336, y + 178 + li * 24, lines[li], 3, INK);
  }
}

// MID: two wide panels, icon left, headline at scale 4, body at scale 3.
const MID_X = [24, 520];
for (let m = 0; m < MID.length; m++) {
  const st = MID[m];
  const x = MID_X[m];
  const y = 488;
  frame(x, y, 480, 236, st.accent);
  box(x + 14, y + 24, 96, 96, st.tint);
  st.icon(x + 62, y + 72, 44);
  text(x + 124, y + 30, st.kicker, 3, st.accent);
  text(x + 124, y + 58, st.heads[0], 4, INK, 5.5);
  text(x + 124, y + 88, st.heads[1], 4, INK, 5.5);
  const lines = wrap(st.body, 3, 452);
  for (let li = 0; li < lines.length && li < 4; li++) {
    text(x + 14, y + 136 + li * 24, lines[li], 3, INK);
  }
}

// SMALL: three compact panels, picture on top, headline and one fact line.
const SMALL_X = [24, 353, 682];
for (let s = 0; s < SMALL.length; s++) {
  const st = SMALL[s];
  const x = SMALL_X[s];
  const y = 736;
  frame(x, y, 317, 236, st.accent);
  textC(x + 158, y + 20, st.kicker, 3, st.accent);
  box(x + 98, y + 44, 120, 76, st.tint);
  st.icon(x + 158, y + 82, 36);
  textC(x + 158, y + 124, st.heads[0], 4, INK, 5.5);
  textC(x + 158, y + 154, st.heads[1], 4, INK, 5.5);
  textC(x + 158, y + 192, st.fact, 3, st.accent);
}

// Footer strip: one more verified story of the day.
box(24, 980, 976, 2, INK);
textC(512, 990, 'ALSO: COP31 TALKS ENTER DECISIVE PHASE - 144 ITEMS DISPUTED', 2, INK);

// ------------------------------------------------------------- PNG encode
const CRC = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC[n] = c;
}
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type: string, data: Buffer): Buffer {
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

// Filter one scanline with filter f; returns [score, bytes].
function filterRow(row: Uint8Array, prev: Uint8Array | null, f: number): [number, Buffer] {
  const out = Buffer.alloc(row.length);
  let score = 0;
  for (let i = 0; i < row.length; i++) {
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
    out[i] = fv;
    score += Math.abs(fv < 128 ? fv : fv - 256);
  }
  return [score, out];
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
  const row = img.subarray(y * stride, (y + 1) * stride);
  const prev = y === 0 ? null : img.subarray((y - 1) * stride, y * stride);
  let bestId = 0;
  let bestScore = Infinity;
  let bestBuf: Buffer | null = null;
  for (let f = 0; f <= 4; f++) {
    const [score, buf] = filterRow(row, prev, f);
    if (score < bestScore) {
      bestScore = score;
      bestId = f;
      bestBuf = buf;
    }
  }
  raw[y * (stride + 1)] = bestId;
  raw.set(bestBuf as Buffer, y * (stride + 1) + 1);
}

const idat = deflateSync(raw, { level: 9 });
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  pngChunk('IHDR', ihdr),
  pngChunk('IDAT', idat),
  pngChunk('IEND', Buffer.alloc(0)),
]);

const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'entry.png'), png);
