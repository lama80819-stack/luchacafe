/* ENMASCARADOS / Lucha Café - lógica y dibujo del juego (canvas 2D, sin librerías) */
'use strict';
(() => {

/* =========================================================
   CONSTANTES Y UTILIDADES
   ========================================================= */
const W = 960, H = 600;
const HUD = 60;
let COLS = 9;                                              // taquería: 9 x 8 losetas (isoX, isoY); con la remodelación se ensancha a 11 x 8
const ROWS = 8;
const TW = 84, TH = 42, WALL_H = 108;                      // proyección isométrica 2:1 y altura de las paredes
let OX = 444, OY = 200;                                    // origen en pantalla (cambia al remodelar para que el local ensanchado quepa y quede centrado)
const U = TW / 2;                                          // píxeles por loseta a lo largo de un muro
const EAT_TIME = 4, START_MONEY = 250, FREEZE_TIME = 12;  // segundos / pesos (con $250 alcanza para comal, mesa y refri y todavía para el primer pastor)
// Experiencia y cansancio del Novato: la estamina baja al caminar (por segundo) y al cocinar o repartir (por acción)
const STAM = { base: 100, perLevel: 6, walk: 1.3, cook: 3, pickup: 1.5, serve: 3, back: 1, regen: 11, fury: 4 };
const xpNeed = lvl => 40 + 20 * (lvl - 1);                 // XP para pasar del nivel lvl al siguiente
// Tienda: precios en pesos y requisitos
// El primer comal, la primera mesa y el refri cuestan poco (es el tutorial); lo demás sube con cada pieza que ya tienes
const SHOP = { maxTables: 4, maxComals: 2, maxFridges: 1 };
const PRICES = { comal: [40, 1500, 4000], table: [60, 250, 600, 900, 1200, 1200], fridge: [80], drinks: [90] };
const priceOf = (type, owned) => { const a = PRICES[type]; return a[Math.min(owned, a.length - 1)]; };
// Personal contratable: cada uno trabaja solo, tiene su estamina y descansa en la banca. speed = losetas por segundo; drain = cuánto le cansa cada acción
const STAFF = {
  waiter1: { name: 'Primer Mesero Novato',   tag: 'MESERO',    price: 5000,  level: 10, look: 'mesero',  speed: 3.0, drain: 1,   tab: 'staff', desc: 'Atiende solo y se cansa: descansa en la banca' },
  waiter2: { name: 'Segundo Mesero Novato',  tag: 'MESERO 2',  price: 15000, level: 25, look: 'mesero2', speed: 3.0, drain: 1,   tab: 'staff', desc: 'Otro par de manos: atiende pedidos al mismo tiempo' },
  mistico: { name: 'El Místico-Volador',     tag: 'MÍSTICO',   price: 25000, level: 30, look: 'mistico', speed: 6.0, drain: 1,   tab: 'legend', desc: 'Leyenda aérea: se mueve al doble de velocidad' },
  anil:    { name: 'Demonio Añil',           tag: 'DEMONIO',   price: 30000, level: 30, look: 'anil',    speed: 3.0, drain: .15, tab: 'legend', desc: 'Estamina blindada: casi no necesita banca' }
};
const STAFF_IDS = Object.keys(STAFF);
// Mega Ampliación (nivel 40): el local se vuelve una arena con cuadrilátero central; caben 6 mesas y 3 comales
const ARENA = { price: 40000, level: 40, bonus: 1, ring: { c: 4, r: 3, w: 3, h: 3 }, maxTables: 6, maxComals: 3 };
// Inventario ("cajita") para guardar muebles sin colocar: empieza con 5 lugares y se amplía por niveles
const INV_BASE = 5;
const INV_TIERS = [{ cap: 7, level: 10, price: 2500 }, { cap: 10, level: 30, price: 9000 }, { cap: 14, level: 50, price: 25000 }, { cap: 20, level: 70, price: 60000 }];
// Horario: abre a las 8:00 AM y cierra a las 8:00 PM; un día dura DAY_SEC segundos reales
const DAY_SEC = 168, START_H = 8, END_H = 20;
// Remodelación (nivel 15) y decoración: cada mejora estética suma media máscara de reputación
const REMODEL = { price: 8000, level: 15, cols: 11, oy: 188, ox: 417, bonus: .5, paintPrice: 700, awningPrice: 900 };
const PAINTS = {                                              // pintura de paredes: [arriba, abajo, lambrín, nombre]
  cal:      ['#cfcbc1', '#b6b1a5', '#8a857a', 'Cal sucia'],         // la de fábrica: gris y sin gracia
  ocre:     ['#dcaa50', '#c58a2e', '#7a1f3b', 'Ocre y vino'],
  turquesa: ['#3cc3c8', '#1f9aa2', '#16405a', 'Turquesa'],
  rosa:     ['#ff86b4', '#e0508a', '#6b1d4a', 'Rosa mexicano'],
  verde:    ['#86d572', '#52ad4c', '#244a2b', 'Verde nopal'],
  azul:     ['#6a92e8', '#3f66c9', '#1b2a5e', 'Azul talavera'],
  rojo:     ['#e8645a', '#bb382e', '#4a1420', 'Rojo chile']
};
const AWNINGS = {                                             // lona de la fachada: franjas de colores ('' = sin lona)
  '':       { name: 'Sin lona', colors: null },
  rojo:     { name: 'Rojo y crema', colors: ['#e0364a', '#fff4e6'] },
  verde:    { name: 'Verde y crema', colors: ['#2fbf71', '#fff4e6'] },
  azul:     { name: 'Azul y crema', colors: ['#3b82f6', '#fff4e6'] },
  naranja:  { name: 'Naranja y crema', colors: ['#ff8a3d', '#fff4e6'] },
  morado:   { name: 'Morado y crema', colors: ['#8b5cf6', '#fff4e6'] },
  tricolor: { name: 'Tricolor mexicana', colors: ['#2fbf71', '#fff4e6', '#e0364a'] }
};
/* ---------- Decoración: todo se desbloquea por nivel y se compra con monedas (o gemas, solo las piezas exclusivas) ---------- */
const PAINT_INFO = { cal: [0, 1], ocre: [200, 2], turquesa: [250, 3], rosa: [300, 5], verde: [300, 5], azul: [450, 8], rojo: [550, 10] };          // [precio, nivel]
const AWNING_INFO = { '': [0, 1], rojo: [500, 6], verde: [500, 6], azul: [600, 7], naranja: [600, 7], morado: [700, 8], tricolor: [900, 10] };
// Pisos: c0/c1 alternan en damero; pattern = detalle sobre cada loseta. Con gems en vez de price: exclusivo de gemas
const FLOORS = {
  cemento:   { name: 'Cemento gris',        c0: '#a9a69e', c1: '#a09d95', price: 0,    level: 1,  pattern: 'cracks' },
  barro:     { name: 'Barro cocido',        c0: '#cc8b5c', c1: '#bd7c4d', price: 120,  level: 2 },
  madera:    { name: 'Tablones de madera',  c0: '#c9924f', c1: '#b9833f', price: 220,  level: 3,  pattern: 'plank' },
  damero:    { name: 'Damero clásico',      c0: '#efe2bf', c1: '#9cc3b0', price: 400,  level: 4 },
  rojonegro: { name: 'Rojo y negro',        c0: '#d9374a', c1: '#2b2540', price: 800,  level: 8 },
  talavera:  { name: 'Talavera',            c0: '#f4f6fb', c1: '#4a73d4', price: 1300, level: 12, pattern: 'cross' },
  mascaras:  { name: 'Máscaras de lucha',   c0: '#f0e3c4', c1: '#7b2a4a', price: 2600, level: 16, pattern: 'mask' },
  oro:       { name: 'Piso dorado',         c0: '#ffd95a', c1: '#2b2540', gems: 40,    level: 1,  pattern: 'spark' }
};
// Banderas de las paredes
const BUNTINGS = {
  none:     { name: 'Sin banderas' },
  papel:    { name: 'Papel picado',        price: 150, level: 2, cols: ['#e0364a', '#ffc83d', '#17a2b0', '#2fbf71', '#ff5fa2', '#ff8a3d'] },
  tricolor: { name: 'Tricolor',            price: 300, level: 5, cols: ['#2fbf71', '#fff4e6', '#e0364a'] },
  luchador: { name: 'Máscaras colgantes',  price: 700, level: 9, masks: true },
  luces:    { name: 'Foquitos de colores', gems: 10,   level: 1, lights: true }
};
// Pósters y accesorios de pared (cada uno tiene su lugar fijo en el muro) y del piso. kind: 'toggle' = se compra una vez y se prende o apaga
const WALLDECO = {
  felpudo:  { name: 'Felpudo de la entrada', price: 40,  level: 2,  where: 'piso' },
  menu:     { name: 'Pizarrón del menú',     price: 80,  level: 2,  where: 'pared izq.' },
  p_camp:   { name: 'Póster: Campeonato',    price: 120, level: 2,  where: 'pared der.' },
  neon:     { name: 'Letrero de neón',       price: 450, level: 5,  where: 'pared der.' },
  p_copa:   { name: 'Póster: Gran Copa',     price: 260, level: 6,  where: 'pared der.' },
  alfombra: { name: 'Alfombra de ring',      price: 350, level: 6,  where: 'piso' },
  p_noche:  { name: 'Póster: Noche de Leyendas', price: 350, level: 9, where: 'pared izq.' },
  p_rudos:  { name: 'Póster: Rudos vs Técnicos', price: 520, level: 12, where: 'pared izq.' },
  p_arena:  { name: 'Póster: La Gran Arena', price: 800, level: 18, where: 'pared izq.' },
  g_poster: { name: 'Póster de neón que prende', gems: 12, level: 1, where: 'pared izq.' },
  g_mask:   { name: 'Máscara de neón gigante',   gems: 20, level: 1, where: 'pared der.' }
};
// Muebles de adorno: van a la cajita y se colocan en modo EDITAR. max = cuántos puedes tener
const DECOR_FURN = {
  plant:   { price: 80,  level: 2, max: 3 },
  caja:    { price: 200, level: 3, max: 1 },
  trompo:  { price: 350, level: 5, max: 2 },
  estatua: { gems: 30,   level: 1, max: 2 },
  vitrina: { gems: 18,   level: 1, max: 2 }
};
let DECO = { remodeled: false, arena: false, paint: 'cal', awning: '', floor: 'cemento', bunting: 'none', paints: { cal: true }, awnings: { '': true }, floors: { cemento: true }, buntings: { none: true },
  own: {}, on: {}, paintBonus: false, awningBonus: false, dv: 2 };
// Clientes VIP legendarios: llegan al azar, piden un combo grande y pagan varias veces. Si se les hace esperar, castigan.
//   payaso: parodia del Payaso Psicópata (local remodelado) · mistico y anil: solo con la arena (nivel 40)
const VIPS = {
  payaso:  { key: 'payaso',  name: 'EL PAYASO MANIÁTICO', mult: 3, xp: 180, patience: 52, speed: 1.5, scale: 1.12, combo: ['tripa', 'tripa', 'michelada'], chance: .75, win: [11, 17.5],
             need: w => w.deco.remodeled && !!LAYOUT.fridge && LAYOUT.comals.length > 0, intro: 'pide un combo grande y paga el triple' },
  mistico: { key: 'mistico', name: 'EL MÍSTICO-VOLADOR',  mult: 4, xp: 260, patience: 34, speed: 2.8, scale: 1.0,  combo: ['pastor', 'pastor', 'suadero', 'suadero'], chance: .55, win: [10, 18],
             need: w => w.deco.arena && LAYOUT.comals.length > 0, intro: 'pide un combo ULTRA RÁPIDO: ¡sírvelo ya!' },
  anil:    { key: 'anil',    name: 'DEMONIO AÑIL',        mult: 5, xp: 340, patience: 64, speed: 1.2, scale: 1.26, combo: ['cecina', 'cecina', 'tlacoyo', 'michelada'], chance: .55, win: [12, 18],
             need: w => w.deco.arena && !!LAYOUT.fridge && LAYOUT.comals.length > 0, intro: 'pide un combo pesado y paga cinco veces' }
};
// Visitantes que regalan gemas: cada día hay un 30 % de que llegue uno (desde el nivel 3). Si lo atiendes contento, te deja gemas
const GEM_CHANCE = .3, GEM_LEVEL = 3;
const GEMMERS = {
  coleccionista: { key: 'coleccionista', name: 'DOÑA COLECCIONISTA',  gems: [2, 3], patience: 58, speed: 1.4,
                   look: { hoodie: '#7c3aed', mask: 'oro', shoes: 'amarillo', skin: '#e0ac69', label: ['DOÑA', 'COLECCIONA'] } },
  campeon:       { key: 'campeon',       name: 'EL CAMPEÓN RETIRADO', gems: [2, 4], patience: 58, speed: 1.3,
                   look: { hoodie: '#b3862a', mask: 'rayo', shoes: 'blanco', skin: '#c68642', label: ['EL', 'CAMPEÓN'] } },
  joyero:        { key: 'joyero',        name: 'EL JOYERO ENMASCARADO', gems: [1, 3], patience: 58, speed: 1.5,
                   look: { hoodie: '#14a38b', mask: 'turquesa', shoes: 'azul', skin: '#f1c27d', label: ['EL', 'JOYERO'] } }
};
const VIP_MIN_MASKS = 2;
function applyRemodel(on) {                                   // ensancha (o devuelve a su tamaño original) el local en el lienzo
  COLS = on ? REMODEL.cols : 9; OY = on ? REMODEL.oy : 200; OX = on ? REMODEL.ox : 444;
  Grid.blocked = new Uint8Array(COLS * ROWS);
}

/* ---------- Catálogo callejero (costo por tanda, tiempo en el comal, porciones que rinde, precio de venta por porción) ---------- */
const RECIPES = {
  pastor:    { key: 'pastor',    name: 'Tacos al Pastor',        short: 'Pastor',    cost: 10, time: 4,  yield: 4, price: 5,  unit: 'porciones' },
  suadero:   { key: 'suadero',   name: 'Tacos de Suadero',       short: 'Suadero',   cost: 18, time: 6,  yield: 4, price: 8,  unit: 'porciones' },
  gordita:   { key: 'gordita',   name: 'Gorditas de Chicharrón', short: 'Gordita',   cost: 35, time: 9,  yield: 5, price: 14, unit: 'porciones' },
  tripa:     { key: 'tripa',     name: 'Tacos de Tripa Dorada',  short: 'Tripa',     cost: 45, time: 11, yield: 4, price: 20, unit: 'porciones' },
  quesadilla: { key: 'quesadilla', name: 'Quesadillas de Pastor', short: 'Quesadilla', cost: 60, time: 12, yield: 5, price: 22, unit: 'porciones', level: 15 },
  sope:      { key: 'sope',      name: 'Sopes con Cecina',       short: 'Sope',      cost: 80, time: 15, yield: 6, price: 25, unit: 'porciones', level: 20 },
  tlacoyo:   { key: 'tlacoyo',   name: 'Tlacoyos de Frijol y Haba', short: 'Tlacoyo', cost: 110, time: 16, yield: 6, price: 35, unit: 'porciones', level: 28 },
  cecina:    { key: 'cecina',    name: 'Tacos de Cecina Suprema', short: 'Cecina',   cost: 150, time: 18, yield: 5, price: 50, unit: 'porciones', level: 35 },
  michelada: { key: 'michelada', name: 'Michelada Escarchada',   short: 'Michelada', cost: 25, time: 4,  yield: 3, price: 18, unit: 'tarros', drink: true }
};
const MENU = ['pastor', 'suadero', 'gordita', 'tripa', 'quesadilla', 'sope', 'tlacoyo', 'cecina', 'michelada'];
Object.values(RECIPES).forEach(r => { r.level = r.level || 1; });          // nivel necesario para desbloquear el platillo
const FOODS = MENU.filter(k => !RECIPES[k].drink);
// Cada platillo se prepara en su estación: la comida en el comal y las micheladas en el refrigerador
Object.values(RECIPES).forEach(r => { r.station = r.drink ? 'fridge' : 'comal'; });
const STATIONS = {
  comal:  { title: 'COMAL',        items: FOODS,        cap: 1 },
  fridge: { title: 'REFRIGERADOR', items: ['michelada'], cap: 2 }
};
const FONT_DISPLAY = "'Alfa Slab One', 'Rockwell Extra Bold', Impact, serif";
const FONT_UI = "'Barlow Condensed', 'Arial Narrow', Impact, sans-serif";

const P = {
  ink: '#1b1030', night: '#0d0720', violet: '#3a1d5c', plum: '#2a1250',
  red: '#e0364a', gold: '#ffc83d', teal: '#17a2b0', green: '#2fbf71',
  orange: '#ff8a3d', cream: '#f6e7c1', white: '#fff8ea', muted: '#a99bc7'
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const pesos = n => '$' + Math.round(n).toLocaleString('es-MX');
const easeOutBack = t => { const c1 = 1.7, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

/* =========================================================
   CANVAS Y DIBUJO BÁSICO
   ========================================================= */
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let K = 1;
function fit() {
  const r = canvas.getBoundingClientRect();
  const k = clamp(Math.ceil(r.width * (window.devicePixelRatio || 1) / W), 1, 2);
  if (canvas.width !== W * k) { canvas.width = W * k; canvas.height = H * k; }
  K = k;
}
window.addEventListener('resize', fit);

function rr(c, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

let MIRROR = false;                          // true mientras se dibuja un mueble girado (se pinta espejado: el texto se vuelve a voltear)
function txt(c, s, x, y, o = {}) {
  c.save();
  if (MIRROR) { c.translate(x, 0); c.scale(-1, 1); c.translate(-x, 0); }
  c.font = o.font || `700 20px ${FONT_UI}`;
  c.textAlign = o.align || 'left';
  c.textBaseline = o.base || 'alphabetic';
  if (o.ls && 'letterSpacing' in c) c.letterSpacing = o.ls + 'px';
  if (o.alpha != null) c.globalAlpha = o.alpha;
  c.lineJoin = 'round';
  if (o.shadow) { c.fillStyle = o.shadow; c.fillText(s, x + (o.sx || 2), y + (o.sy || 3)); }
  if (o.stroke) { c.lineWidth = o.sw || 4; c.strokeStyle = o.stroke; c.strokeText(s, x, y); }
  c.fillStyle = o.color || P.white;
  c.fillText(s, x, y);
  c.restore();
}

function star(c, x, y, R, r, n = 5) {
  c.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = -Math.PI / 2 + i * Math.PI / n, d = i % 2 ? r : R;
    c[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * d, y + Math.sin(a) * d);
  }
  c.closePath();
}

/* ---------- Máscara de lucha (unidades relativas: ancho ±0.95, alto -1.15..1.25) ---------- */
function maskPath(c) {
  c.beginPath();
  c.moveTo(0, -1.15);
  c.bezierCurveTo(0.75, -1.15, 0.95, -0.6, 0.92, -0.1);
  c.bezierCurveTo(0.9, 0.5, 0.6, 1.0, 0.3, 1.2);
  c.quadraticCurveTo(0, 1.28, -0.3, 1.2);
  c.bezierCurveTo(-0.6, 1.0, -0.9, 0.5, -0.92, -0.1);
  c.bezierCurveTo(-0.95, -0.6, -0.75, -1.15, 0, -1.15);
  c.closePath();
}
function eyePath(c, s) {
  c.beginPath();
  c.moveTo(s * 0.8, -0.3);
  c.quadraticCurveTo(s * 0.45, -0.52, s * 0.1, -0.14);
  c.quadraticCurveTo(s * 0.3, 0.22, s * 0.72, 0.14);
  c.closePath();
}
const MASKS = {
  ring:  { base: '#e0364a', accent: '#17a2b0', trim: '#ffc83d', hole: '#1b1030' },
  novato:{ base: '#2fbf71', accent: '#1b8a52', trim: '#fff3b0', hole: '#ffffff', pupil: true },
  blue:  { base: '#3b5bdb', accent: '#ffc83d', trim: '#ffffff', hole: '#1b1030' },
  black: { base: '#2b2540', accent: '#e0364a', trim: '#ffc83d', hole: '#1b1030' },
  pink:  { base: '#ff5fa2', accent: '#7c3aed', trim: '#fff3b0', hole: '#1b1030' },
  gray:  { base: '#6b6580', accent: '#4a4560', trim: '#8f89a6', hole: '#2a2540' }
};
function drawMask(c, x, y, s, th) {
  c.save();
  c.translate(x, y); c.scale(s, s);
  c.lineJoin = 'round';
  maskPath(c); c.fillStyle = th.base; c.fill();
  c.save();
  maskPath(c); c.clip();
  c.fillStyle = th.accent;
  for (const m of [-1, 1]) {
    c.beginPath();
    c.moveTo(m * 1.1, -1.3); c.lineTo(m * 0.58, -1.3); c.lineTo(m * 0.42, -0.2);
    c.lineTo(m * 0.55, 0.7); c.lineTo(m * 0.45, 1.4); c.lineTo(m * 1.1, 1.4);
    c.closePath(); c.fill();
    c.strokeStyle = th.trim; c.lineWidth = 0.045;
    c.beginPath();
    c.moveTo(m * 0.58, -1.2); c.lineTo(m * 0.42, -0.2); c.lineTo(m * 0.55, 0.7); c.lineTo(m * 0.45, 1.3);
    c.stroke();
  }
  c.restore();
  maskPath(c); c.lineWidth = 0.075; c.strokeStyle = P.ink; c.stroke();
  maskPath(c); c.lineWidth = 0.04; c.strokeStyle = th.trim; c.stroke();
  // frente
  star(c, 0, -0.66, 0.24, 0.1); c.fillStyle = th.trim; c.fill(); c.lineWidth = 0.035; c.strokeStyle = P.ink; c.stroke();
  // ojos
  for (const m of [-1, 1]) {
    eyePath(c, m); c.fillStyle = th.hole; c.fill();
    c.lineWidth = 0.08; c.strokeStyle = th.trim; c.stroke();
    c.lineWidth = 0.03; c.strokeStyle = P.ink; c.stroke();
    if (th.pupil) { c.fillStyle = P.ink; c.beginPath(); c.arc(m * 0.38, -0.12, 0.09, 0, 6.3); c.fill(); }
    else { c.fillStyle = 'rgba(255,255,255,.8)'; c.beginPath(); c.arc(m * 0.5, -0.2, 0.045, 0, 6.3); c.fill(); }
  }
  // boca
  c.beginPath();
  c.moveTo(-0.3, 0.62); c.quadraticCurveTo(0, 0.48, 0.3, 0.62); c.quadraticCurveTo(0, 0.98, -0.3, 0.62);
  c.fillStyle = P.ink; c.fill();
  c.lineWidth = 0.05; c.strokeStyle = th.trim; c.stroke();
  // cordones
  c.lineWidth = 0.035; c.strokeStyle = th.trim;
  for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(-0.1, 1.02 + i * 0.07); c.lineTo(0.1, 1.06 + i * 0.07); c.stroke(); }
  c.restore();
}

/* ---------- Objetos pequeños reutilizables ---------- */
function drawTaco(c, x, y, r, kind = 'pastor') {
  c.save(); c.translate(x, y); c.scale(r / 6.5, r / 6.5);                // se dibuja en una caja de radio 6.5
  c.lineJoin = 'round'; c.lineCap = 'round'; c.strokeStyle = P.ink;
  const tort = kind === 'suadero' ? '#f3e9d0' : kind === 'tripa' ? '#d39a45' : kind === 'cecina' ? '#8a93e6' : '#f2cf6a';
  const blob = (bx, by, br, col) => { c.fillStyle = col; c.beginPath(); c.arc(bx, by, br, 0, 6.3); c.fill(); };
  // relleno detrás de la tortilla (sobresale por arriba)
  if (kind === 'pastor') {
    blob(-3.6, -5.2, 2.7, '#d9421f'); blob(.4, -6.2, 2.9, '#ee6a2c'); blob(3.8, -4.8, 2.5, '#c4381d');
    c.fillStyle = '#ffd24a'; c.fillRect(-1.2, -7.6, 2.6, 2.6); c.fillRect(2, -7.2, 2.2, 2.2);                 // piña
    blob(-5.4, -3.6, 1.6, '#2fa84f'); blob(5.4, -3.2, 1.6, '#2fa84f');                                           // cilantro
  } else if (kind === 'suadero') {
    blob(-3.2, -5, 3.1, '#7a4a2c'); blob(1.6, -5.6, 3.3, '#9a6238'); blob(4.6, -3.8, 2.1, '#6a3d22');
    blob(-.4, -7.2, 1.7, '#59b04a'); blob(3, -7, 1.3, '#59b04a');                                                // salsa verde
    c.fillStyle = '#fff8ea'; c.fillRect(-4.6, -7.4, 1.8, 1.4);                                                   // cebolla
  } else if (kind === 'cecina') {                                                                                // cecina suprema: tiras rojas curadas, aguacate, cebolla morada y una estrella dorada
    c.lineCap = 'round';
    for (const [ox, oy, rot] of [[-3.6, -6.2, -.45], [.2, -7.6, .1], [3.8, -6, .55]]) {
      c.save(); c.translate(ox, oy); c.rotate(rot);
      c.fillStyle = '#c0282e'; c.strokeStyle = P.ink; c.lineWidth = 1.2; rr(c, -4, -2.1, 8, 4.2, 1.8); c.fill(); c.stroke();
      c.fillStyle = 'rgba(255,255,255,.8)'; c.fillRect(-2.4, -.9, 1, 1); c.fillRect(.8, .3, 1, 1);                // cristales de sal
      c.restore();
    }
    blob(-1.8, -9.2, 1.9, '#7bbf3f'); blob(2.2, -9.4, 1.6, '#5aa72f');                                            // aguacate
    c.fillStyle = '#c04aa6'; c.fillRect(-5.6, -9, 2, 1.3); c.fillRect(4.4, -8.8, 2, 1.3);                         // cebolla morada
    star(c, 0, -12.2, 2.8, 1.2); c.fillStyle = '#ffd24a'; c.fill(); c.lineWidth = .8; c.strokeStyle = P.ink; c.stroke();
  } else {
    for (const [col, w] of [[P.ink, 3.4], ['#f0b43a', 1.9]]) {                                                   // tripa: tiras rizadas y crujientes
      c.strokeStyle = col; c.lineWidth = w;
      for (const ox of [-3.8, 0, 3.8]) { c.beginPath(); c.moveTo(ox - 1.8, -3); c.quadraticCurveTo(ox - 2.6, -6, ox, -6.4); c.quadraticCurveTo(ox + 2.6, -6.6, ox + 1.6, -9); c.stroke(); }
    }
    blob(0, -3.6, 1.3, '#8a2a1a');
  }
  // tortilla doblada (media luna)
  c.lineWidth = 1.5; c.strokeStyle = P.ink;
  c.beginPath(); c.arc(0, 0, 6.5, Math.PI, 0); c.closePath(); c.fillStyle = tort; c.fill(); c.stroke();
  c.strokeStyle = kind === 'tripa' ? 'rgba(122,70,20,.55)' : 'rgba(150,100,30,.4)'; c.lineWidth = 1;
  c.beginPath(); c.arc(0, 0, 4.2, Math.PI * 1.1, Math.PI * 1.9); c.stroke();                                    // pliegue
  if (kind === 'suadero') { c.fillStyle = '#6fcf4a'; c.beginPath(); c.arc(6.6, -1, 2.3, Math.PI * .6, Math.PI * 1.6); c.closePath(); c.fill(); c.strokeStyle = P.ink; c.lineWidth = 1.1; c.stroke(); }   // limón
  c.restore();
}
// Dibujo de un platillo del catálogo, centrado en (x, y) con radio r
function drawDish(c, key, x, y, r) {
  if (key === 'suero') {                                                    // botella de suero (bebida isotónica) del vestidor
    c.save(); c.translate(x, y); c.scale(r / 7, r / 7); c.lineJoin = 'round'; c.lineWidth = 1.5; c.strokeStyle = P.ink;
    c.beginPath(); c.moveTo(-3, -5); c.lineTo(3, -5); c.lineTo(3, -7); c.lineTo(-3, -7); c.closePath(); c.fillStyle = '#e0364a'; c.fill(); c.stroke();
    c.beginPath(); c.moveTo(-3, -5); c.quadraticCurveTo(-5.5, -2, -5, 2); c.lineTo(-5, 7); c.lineTo(5, 7); c.lineTo(5, 2); c.quadraticCurveTo(5.5, -2, 3, -5); c.closePath();
    c.fillStyle = '#5fd0ff'; c.fill(); c.stroke();
    c.fillStyle = '#fff8ea'; c.fillRect(-5, 0, 10, 4.5); c.strokeRect(-5, 0, 10, 4.5);
    c.fillStyle = '#2fbf71'; c.fillRect(-3, 1.4, 6, 1.6);
    c.restore();
  } else if (key === 'quesadilla') {                                        // tortilla de harina doblada, marcas de plancha y queso derretido
    c.save(); c.translate(x, y + r * .45); c.scale(r / 6.5, r / 6.5); c.lineJoin = 'round'; c.lineCap = 'round'; c.strokeStyle = P.ink;
    c.fillStyle = '#ffd23a'; c.lineWidth = 1.3;
    for (const [qx, qy, qr] of [[-4.6, 1.4, 1.9], [-1.2, 1.9, 2.2], [2.4, 1.5, 1.8], [5, 1.2, 1.5]]) { c.beginPath(); c.arc(qx, qy, qr, 0, 6.3); c.fill(); c.stroke(); }
    c.lineWidth = 1.5; c.beginPath(); c.arc(0, 0, 7.2, Math.PI, 0); c.closePath(); c.fillStyle = '#f2dfb2'; c.fill(); c.stroke();
    c.strokeStyle = '#a8662a'; c.lineWidth = 1.3;
    for (const [ax, ay, bx, by] of [[-4.6, -1.2, -2.8, -4.8], [-1.2, -1.2, .4, -6], [2.2, -1.2, 3.8, -4.6]]) { c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke(); }
    c.fillStyle = '#d9421f'; c.beginPath(); c.arc(-6, -.8, 1.1, 0, 6.3); c.arc(6.2, -.8, 1.1, 0, 6.3); c.fill();
    c.restore();
  } else if (key === 'sope') {                                              // base de masa con borde, cecina, frijoles, lechuga y crema
    c.save(); c.translate(x, y); c.scale(r / 6.5, r / 6.5); c.lineJoin = 'round'; c.lineCap = 'round'; c.lineWidth = 1.5; c.strokeStyle = P.ink;
    c.fillStyle = '#c79a4a'; c.beginPath(); c.ellipse(0, 2.4, 7.6, 5, 0, 0, 6.3); c.fill(); c.stroke();
    c.fillStyle = '#e6c27a'; c.beginPath(); c.ellipse(0, .6, 7.6, 5.2, 0, 0, 6.3); c.fill(); c.stroke();
    c.fillStyle = '#5a3320'; c.beginPath(); c.ellipse(0, .2, 5.6, 3.6, 0, 0, 6.3); c.fill();
    c.strokeStyle = '#c4381d'; c.lineWidth = 2.1;
    for (const [ax, ay, bx, by] of [[-3.8, -1.2, -1, .6], [-.6, -1.8, 2.4, -.2], [1.6, 1.2, 4.2, -.4]]) { c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke(); }
    c.fillStyle = '#3fb04f'; c.beginPath(); c.ellipse(-4.2, 1.2, 1.9, 1.1, .4, 0, 6.3); c.ellipse(4.4, 1.4, 1.9, 1.1, -.4, 0, 6.3); c.ellipse(0, -2.6, 1.9, 1.1, 0, 0, 6.3); c.fill();
    c.strokeStyle = '#fff8ea'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-4, 2.2); c.lineTo(-2, .4); c.lineTo(0, 2.4); c.lineTo(2, .4); c.lineTo(4, 2.2); c.stroke();
    c.fillStyle = '#fff8ea'; for (const [qx, qy] of [[-2.6, -1.4], [2.8, -1.8], [.6, 3]]) c.fillRect(qx, qy, 1.4, 1.4);
    c.fillStyle = '#e0364a'; c.beginPath(); c.arc(1.2, 1.6, 1.1, 0, 6.3); c.fill();
    c.restore();
  } else if (key === 'tlacoyo') {                                           // óvalo de masa azul con frijol, nopales, queso fresco y salsa roja
    c.save(); c.translate(x, y); c.scale(r / 6.5, r / 6.5); c.lineJoin = 'round'; c.lineCap = 'round'; c.lineWidth = 1.5; c.strokeStyle = P.ink;
    c.fillStyle = '#4f5a9c'; c.beginPath(); c.ellipse(0, 2, 8.4, 4.4, -.12, 0, 6.3); c.fill(); c.stroke();
    c.fillStyle = '#7c86c8'; c.beginPath(); c.ellipse(0, .4, 8.4, 4.4, -.12, 0, 6.3); c.fill(); c.stroke();
    c.fillStyle = '#4a2c1e'; c.beginPath(); c.ellipse(0, .2, 6, 2.5, -.12, 0, 6.3); c.fill();                   // frijol
    c.strokeStyle = '#3f9d3a'; c.lineWidth = 1.9;
    for (const [ax, ay, bx, by] of [[-4.6, -.6, -2.4, 1.4], [-1.2, -1.2, 1, 1.2], [2.2, -.8, 4.6, 1]]) { c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke(); }   // nopal
    c.fillStyle = '#fff8ea'; for (const [qx, qy] of [[-4, -1.8], [-.4, -2.4], [3.4, -1.6], [1.4, 1.6]]) c.fillRect(qx, qy, 1.5, 1.3);
    c.fillStyle = '#e0364a'; c.beginPath(); c.arc(-1.8, .8, 1.1, 0, 6.3); c.arc(3, .2, 1, 0, 6.3); c.fill();
    c.restore();
  } else if (key === 'gordita') {
    c.save(); c.translate(x, y); c.scale(r / 6.5, r / 6.5); c.lineJoin = 'round'; c.lineWidth = 1.5; c.strokeStyle = P.ink;
    c.fillStyle = '#e3b564'; c.beginPath(); c.ellipse(0, 0, 7.4, 5.8, 0, 0, 6.3); c.fill(); c.stroke();
    c.fillStyle = '#8a3b22'; c.beginPath(); c.ellipse(0, -1.4, 5, 2.3, 0, 0, 6.3); c.fill();
    c.fillStyle = '#3fb04f'; c.beginPath(); c.ellipse(-3, -2.6, 2.2, 1.2, .4, 0, 6.3); c.ellipse(3.2, -2.4, 2, 1.1, -.4, 0, 6.3); c.fill();
    c.fillStyle = '#fff8ea'; c.beginPath(); c.arc(0, -3, 1, 0, 6.3); c.fill();
    c.restore();
  } else if (key === 'michelada') {
    c.save(); c.translate(x, y); c.scale(r / 7.6, r / 7.6); c.lineJoin = 'round'; c.lineWidth = 1.5; c.strokeStyle = P.ink;
    c.beginPath(); c.moveTo(-5.4, -7); c.lineTo(5.4, -7); c.lineTo(4.2, 7); c.lineTo(-4.2, 7); c.closePath();
    c.fillStyle = 'rgba(214,235,248,.95)'; c.fill(); c.stroke();
    c.fillStyle = '#c4272f'; c.beginPath(); c.moveTo(-5, -3.5); c.lineTo(5, -3.5); c.lineTo(4.2, 6.4); c.lineTo(-4.2, 6.4); c.closePath(); c.fill();
    c.strokeStyle = '#7a1520'; c.lineWidth = 1.2; c.beginPath(); c.arc(7.2, 0, 3.4, -1.3, 1.3); c.stroke();
    c.lineWidth = 1.5; c.strokeStyle = P.ink;
    c.fillStyle = '#f4e9cf'; c.beginPath(); c.ellipse(0, -7, 5.8, 1.9, 0, 0, 6.3); c.fill(); c.stroke();          // escarcha
    c.fillStyle = '#e0364a'; for (const dx of [-3.6, -.8, 2.2, 4]) c.fillRect(dx, -7.6, 1.1, 1.1);
    c.fillStyle = '#6fcf4a'; c.beginPath(); c.arc(4.6, -7.4, 2.6, Math.PI, 0); c.closePath(); c.fill(); c.stroke();   // limón
    c.restore();
  } else {
    drawTaco(c, x, y + r * .7, r, key);
  }
}
// Una porción servida en un platito (o tarro con posavasos). s = tamaño, glow = resplandor.
function drawPortionPlate(c, key, x, y, s, glow, t) {
  c.save(); c.translate(x, y); c.scale(s, s);
  drawPlate(c, 0, 0, 0, glow, t || 0);
  drawDish(c, key, 0, key === 'michelada' ? -5 : -2, key === 'michelada' ? 7 : 8);
  c.restore();
}
// Pila de porciones listas en la barra del comal con su contador
function drawStack(c, key, count, x, y) {
  const n = key === 'michelada' ? Math.min(count, 3) : Math.min(count, 4);
  for (let i = 0; i < n; i++) {
    if (key === 'michelada') drawDish(c, key, x + (i - (n - 1) / 2) * 9, y - 6, 6.2);
    else drawPortionPlate(c, key, x, y - i * 3.6, .62, false, 0);
  }
  const bx = x + 13, by = y - 12 - (key === 'michelada' ? 0 : n * 2);
  c.fillStyle = P.ink; c.beginPath(); c.arc(bx, by, 8, 0, 6.3); c.fill(); c.lineWidth = 1.5; c.strokeStyle = P.gold; c.stroke();
  txt(c, String(count), bx, by + 4.5, { font: `700 12px ${FONT_UI}`, align: 'center', color: P.gold });
}
function drawPlate(c, x, y, count, glow, t) {
  c.save(); c.translate(x, y);
  if (glow) {
    const p = 0.5 + 0.5 * Math.sin(t * 6);
    c.fillStyle = `rgba(255,200,61,${0.25 + 0.25 * p})`;
    c.beginPath(); c.ellipse(0, -2, 24 + p * 3, 14 + p * 2, 0, 0, 6.3); c.fill();
  }
  c.fillStyle = 'rgba(0,0,0,.2)'; c.beginPath(); c.ellipse(0, 3, 17, 6, 0, 0, 6.3); c.fill();
  c.fillStyle = '#fffaf0'; c.strokeStyle = P.ink; c.lineWidth = 1.5;
  c.beginPath(); c.ellipse(0, 0, 16, 6.5, 0, 0, 6.3); c.fill(); c.stroke();
  c.strokeStyle = '#c9d6ee'; c.lineWidth = 1; c.beginPath(); c.ellipse(0, 0, 11, 4, 0, 0, 6.3); c.stroke();
  const xs = [-9, 9, 0];
  for (let i = 0; i < Math.min(count, 3); i++) drawTaco(c, xs[i], -1 - (i === 2 ? 3 : 0), 6.5);   // 0 = plato vacío
  c.restore();
}
function drawGem(c, x, y, r) {                                       // gema: solo sirve para decoración exclusiva
  c.save(); c.translate(x, y); c.lineJoin = 'round'; c.lineWidth = Math.max(1, r * .16); c.strokeStyle = P.ink;
  c.beginPath(); c.moveTo(-r, -r * .2); c.lineTo(-r * .55, -r * .85); c.lineTo(r * .55, -r * .85); c.lineTo(r, -r * .2); c.lineTo(0, r); c.closePath(); c.fillStyle = '#35c9f0'; c.fill(); c.stroke();
  c.beginPath(); c.moveTo(-r * .55, -r * .85); c.lineTo(r * .55, -r * .85); c.lineTo(r * .3, -r * .2); c.lineTo(-r * .3, -r * .2); c.closePath(); c.fillStyle = '#bff4ff'; c.fill();
  c.beginPath(); c.moveTo(-r, -r * .2); c.lineTo(-r * .3, -r * .2); c.lineTo(0, r); c.moveTo(r, -r * .2); c.lineTo(r * .3, -r * .2); c.lineTo(0, r); c.lineWidth = Math.max(.8, r * .1); c.stroke();
  c.restore();
}
function drawCoin(c, x, y, r, t) {
  c.save(); c.translate(x, y);
  const sq = 0.55 + 0.45 * Math.abs(Math.cos(t * 3));
  c.scale(sq, 1);
  const g = c.createRadialGradient(-r * .3, -r * .3, 1, 0, 0, r);
  g.addColorStop(0, '#fff2a0'); g.addColorStop(1, '#f0a410');
  c.fillStyle = g; c.strokeStyle = '#8a4b05'; c.lineWidth = 2;
  c.beginPath(); c.arc(0, 0, r, 0, 6.3); c.fill(); c.stroke();
  c.strokeStyle = 'rgba(138,75,5,.55)'; c.lineWidth = 1.2;
  c.beginPath(); c.arc(0, 0, r * .72, 0, 6.3); c.stroke();
  c.restore();
  if (sq > .8) txt(c, '$', x, y + r * .4, { font: `700 ${Math.round(r * 1.1)}px ${FONT_UI}`, align: 'center', color: '#8a4b05' });
}

/* =========================================================
   ALMACENAMIENTO (con respaldo en memoria)
   ========================================================= */
const Store = {
  SAVE: 'enmascarados.save.v1', CFG: 'enmascarados.cfg.v1', mem: {},
  read(k) {
    try { const s = localStorage.getItem(k); if (s) return JSON.parse(s); } catch (e) {}
    return this.mem[k] ? JSON.parse(this.mem[k]) : null;
  },
  write(k, v) {
    const s = JSON.stringify(v); this.mem[k] = s;
    try { localStorage.setItem(k, s); } catch (e) {}
  },
  remove(k) { delete this.mem[k]; try { localStorage.removeItem(k); } catch (e) {} },
  SLOTS: 3,
  key(n) { return 'enmascarados.slot.' + n; },
  valid(s) { return !!s && Number.isFinite(s.day) && Number.isFinite(s.money) && Number.isFinite(s.rep); },
  slot(n) { const s = this.read(this.key(n)); return this.valid(s) ? s : null; },
  slots() { const a = []; for (let n = 1; n <= this.SLOTS; n++) a.push(this.slot(n)); return a; },
  anySaved() { return this.slots().some(s => s); },
  freeSlot() { return this.slots().findIndex(s => !s) + 1; },     // 0 si están todas ocupadas
  clearSlot(n) { this.remove(this.key(n)); },
  migrate() {                                                      // la partida única de versiones anteriores pasa a la ranura 1
    const old = this.read(this.SAVE);
    if (old && this.valid(old) && !this.slot(1)) this.write(this.key(1), Object.assign({ at: Date.now() }, old));
    if (old) this.remove(this.SAVE);
  }
};
Store.migrate();
const Settings = Object.assign({ sound: true, volume: 0.6 }, Store.read(Store.CFG) || {});
const saveSettings = () => Store.write(Store.CFG, { sound: Settings.sound, volume: Settings.volume });

/* =========================================================
   AUDIO (síntesis con WebAudio, sin archivos)
   ========================================================= */
const Sfx = {
  ctx: null, master: null, noiseBuf: null,
  unlock() {
    if (!this.ctx) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.connect(this.ctx.destination);
        const n = this.ctx.sampleRate;
        this.noiseBuf = this.ctx.createBuffer(1, n, n);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      } catch (e) { this.ctx = null; }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    this.apply();
  },
  apply() { if (this.master) this.master.gain.value = Settings.sound ? Settings.volume * 0.6 : 0; },
  tone(f, d, o = {}) {
    if (!this.ctx || !Settings.sound) return;
    const c = this.ctx, t = c.currentTime + (o.delay || 0);
    const osc = c.createOscillator(), g = c.createGain();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(f, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + d);
    g.gain.setValueAtTime(o.vol || 0.18, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    osc.connect(g); g.connect(this.master);
    osc.start(t); osc.stop(t + d + 0.03);
  },
  noise(d, o = {}) {
    if (!this.ctx || !Settings.sound) return;
    const c = this.ctx, t = c.currentTime;
    const src = c.createBufferSource(); src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = o.type || 'bandpass'; f.frequency.value = o.freq || 4000;
    const g = c.createGain();
    g.gain.setValueAtTime(o.vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t, Math.random() * 0.5, d + 0.05);
  },
  play(n) { const s = this.sounds[n]; if (s) s.call(this); },
  sounds: {
    click()  { this.tone(620, .07, { vol: .14 }); },
    back()   { this.tone(420, .08, { vol: .14 }); },
    sizzle() { this.noise(.7, { freq: 5200, vol: .22 }); this.tone(180, .1, { vol: .1, type: 'triangle' }); },
    ready()  { this.tone(880, .18, { type: 'sine', vol: .25 }); this.tone(1320, .3, { type: 'sine', vol: .22, delay: .1 }); },
    pickup() { this.tone(400, .09, { type: 'triangle', vol: .22, to: 640 }); },
    serve()  { this.tone(300, .1, { type: 'triangle', vol: .22, to: 480 }); this.tone(480, .12, { type: 'triangle', vol: .2, delay: .08 }); },
    bubble() { this.tone(700, .06, { type: 'sine', vol: .18, to: 1000 }); },
    coin()   { this.tone(988, .07, { vol: .16 }); this.tone(1319, .22, { vol: .16, delay: .06 }); },
    door()   { this.tone(150, .35, { type: 'sawtooth', vol: .08, to: 85 }); },
    angry()  { this.tone(220, .4, { type: 'sawtooth', vol: .18, to: 70 }); },
    fanfare(){ [523, 659, 784, 1047].forEach((f, i) => this.tone(f, .25, { delay: i * .12, vol: .17 })); },
    over()   { [392, 330, 262, 196].forEach((f, i) => this.tone(f, .3, { delay: i * .18, type: 'triangle', vol: .22 })); },
    nope()   { this.tone(160, .12, { vol: .14 }); },
    rage()   { this.tone(110, .5, { type: 'sawtooth', vol: .16, to: 190 }); this.tone(165, .45, { type: 'square', vol: .1, to: 90, delay: .08 }); },
    pum()    { this.noise(.45, { freq: 220, vol: .5, type: 'lowpass' }); this.tone(90, .35, { type: 'sine', vol: .5, to: 40 }); this.tone(420, .12, { type: 'square', vol: .12, to: 180, delay: .02 }); },
    bell()   {                                                   // campana de ring: ¡DONG! ¡DONG!
      for (let k = 0; k < 2; k++) {
        const d = k * .62;
        this.tone(660, 1.5, { type: 'sine', vol: .34, delay: d, to: 650 }); this.tone(1320, 1.1, { type: 'sine', vol: .18, delay: d }); this.tone(1990, .7, { type: 'sine', vol: .1, delay: d });
        this.tone(330, 1.7, { type: 'triangle', vol: .2, delay: d }); this.noise(.08, { freq: 3000, vol: .3, type: 'highpass' });
      }
    },
    pour()   { this.noise(.5, { freq: 900, vol: .2, type: 'lowpass' }); this.tone(520, .12, { type: 'sine', vol: .12, to: 380 }); }
  }
};
const sfx = n => Sfx.play(n);

/* =========================================================
   PROYECCIÓN ISOMÉTRICA, CUADRÍCULA Y BÚSQUEDA DE CAMINOS (BFS)
   Las posiciones de juego están en losetas (isoX, isoY); la pantalla se calcula con isoToScreen().
   isoX crece hacia abajo-derecha, isoY hacia abajo-izquierda.
   ========================================================= */
function isoToScreen(isoX, isoY) {
  return { x: (isoX - isoY) * (TW / 2) + OX, y: (isoX + isoY) * (TH / 2) + OY };
}
function screenToIso(sx, sy) {
  const a = (sx - OX) / (TW / 2), b = (sy - OY) / (TH / 2);
  return { x: (a + b) / 2, y: (b - a) / 2 };
}
const S = (gx, gy, z = 0) => { const p = isoToScreen(gx, gy); return { x: p.x, y: p.y - z }; };   // con altura z en píxeles

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const Grid = {
  blocked: new Uint8Array(COLS * ROWS),
  inb: (c, r) => c >= 0 && r >= 0 && c < COLS && r < ROWS,
  block(c, r) { this.blocked[r * COLS + c] = 1; },
  free(c, r) { return this.inb(c, r) && !this.blocked[r * COLS + c]; },
  pt(c, r) { return { x: c + .5, y: r + .5 }; },                                        // centro de la loseta
  cell(gx, gy) { return { c: clamp(Math.floor(gx), 0, COLS - 1), r: clamp(Math.floor(gy), 0, ROWS - 1) }; },
  path(from, goals) {
    const key = (c, r) => r * COLS + c, start = key(from.c, from.r);
    const gs = new Set(goals.map(g => key(g.c, g.r)));
    if (gs.has(start)) return [];
    const prev = new Int16Array(COLS * ROWS).fill(-2);
    prev[start] = -1;
    const q = [start];
    for (let i = 0; i < q.length; i++) {
      const cur = q[i], c = cur % COLS, r = (cur / COLS) | 0;
      for (const [dc, dr] of DIRS) {
        const nc = c + dc, nr = r + dr;
        if (!this.inb(nc, nr)) continue;
        const k = key(nc, nr);
        if (prev[k] !== -2) continue;
        if (this.blocked[k] && !gs.has(k)) continue;
        prev[k] = cur;
        if (gs.has(k)) {
          const out = [];
          for (let n = k; n !== start; n = prev[n]) out.push({ c: n % COLS, r: (n / COLS) | 0 });
          return out.reverse();
        }
        q.push(k);
      }
    }
    return null;
  }
};

/* ---------- Mobiliario: piezas movibles sobre la cuadrícula ---------- */
// fw x fh = losetas que ocupa (a lo largo de isoX x isoY); h = altura aproximada en px (para detectar clics).
// La mesa incluye sus dos sillas: silla, mesa, mesa, silla.
const FURN = {
  table:  { fw: 4, fh: 1, h: 46,  name: 'Mesa con sillas' },
  comal:  { fw: 2, fh: 1, h: 56,  name: 'Comal' },
  fridge: { fw: 1, fh: 1, h: 66,  name: 'Refrigerador' },
  drinks: { fw: 1, fh: 1, h: 38,  name: 'Mostrador de bebidas' },
  bar:    { fw: 3, fh: 1, h: 38,  name: 'Barra de comida lista' },
  bench:  { fw: 2, fh: 1, h: 58,  name: 'Banca con suero' },
  plant:  { fw: 1, fh: 1, h: 70,  name: 'Planta' },
  trompo: { fw: 1, fh: 1, h: 96,  name: 'Trompo de pastor' },
  caja:   { fw: 1, fh: 1, h: 52,  name: 'Caja registradora' },
  estatua: { fw: 1, fh: 1, h: 104, name: 'Estatua de luchador' },
  vitrina: { fw: 1, fh: 1, h: 78,  name: 'Vitrina del campeón' }
};
const SEATS = [];                                               // todas las sillas de las mesas colocadas
const LAYOUT = { comals: [], tables: [], fridge: null, bar: null, drinks: null, bench: null };
let furnId = 1;
// Girar: it.rot = 1 pone la pieza "de lado" (su largo corre a lo largo de isoY). Todo se calcula con dimsOf/tp; el dibujo se pinta espejado.
const dimsOf = it => { const d = FURN[it.type]; return it.rot ? { fw: d.fh, fh: d.fw } : { fw: d.fw, fh: d.fh }; };
const tp = (it, a, b) => it.rot ? [it.c + b, it.r + a] : [it.c + a, it.r + b];      // (a = a lo largo, b = a lo ancho) → coordenadas de loseta
const TS = (it, a, b, z = 0) => { const q = tp(it, a, b); return S(q[0], q[1], z); };
function withMirror(c, it, fn) {                                  // el espejo respecto a la esquina (c, r) equivale a intercambiar isoX e isoY
  if (!it.rot) { fn(); return; }
  const ax = S(it.c, it.r).x;
  c.save(); c.translate(ax, 0); c.scale(-1, 1); c.translate(-ax, 0);
  MIRROR = true;
  try { fn(); } finally { MIRROR = false; c.restore(); }
}
function makeFurn(type, c = 0, r = 0, rot = 0) {
  const it = { id: furnId++, type, c, r, rot: rot ? 1 : 0 };
  if (type === 'comal') it.slot = { state: 'empty', dish: null, t: 0 };                               // cada comal prepara una tanda a la vez
  if (type === 'fridge') it.slots = [0, 1].map(() => ({ state: 'empty', dish: null, t: 0 }));        // el refrigerador prepara dos tandas
  if (type === 'table') {
    it.seats = [-1, 1].map(side => ({ tb: it, outer: side, dir: -side, customer: null, c: 0, r: 0, gx: 0, gy: 0, plate: { x: 0, y: 0 } }));
    placeSeats(it);
  }
  return it;
}
function placeSeats(tb) {                                       // sillas y platos según dónde esté la mesa
  tb.seats.forEach(s => {
    const q = tp(tb, s.outer < 0 ? 0 : 3, 0), pl = tp(tb, 1 + (s.outer < 0 ? .55 : 1.45), .5);
    s.c = q[0]; s.r = q[1]; s.gx = s.c + .5; s.gy = s.r + .5;
    s.dir = tb.rot ? s.outer : -s.outer;                          // hacia dónde mira en pantalla quien se sienta
    s.plate = S(pl[0], pl[1], 31);
  });
}
const footprint = it => { const d = dimsOf(it), out = []; for (let i = 0; i < d.fw; i++) for (let j = 0; j < d.fh; j++) out.push([it.c + i, it.r + j]); return out; };
const tableMid = tb => tp(tb, 2, .5);                           // centro de la mesa (isoX, isoY) sin contar las sillas
const RING_CELLS = () => { const o = [], g = ARENA.ring; for (let i = 0; i < g.w; i++) for (let j = 0; j < g.h; j++) o.push([g.c + i, g.r + j]); return o; };
// Partida nueva: el local está pelón. Solo trae la barra de comida lista y la banca del vestidor; el comal, la mesa y el refri se compran (tutorial)
const starterFurn = () => [makeFurn('bar', 0, 5), makeFurn('bench', 7, 0)];
// Partidas de versiones muy viejas (sin mobiliario guardado) arrancan con el local completo de antes
const defaultFurn = () => [
  makeFurn('plant', 0, 0), makeFurn('trompo', 0, 1), makeFurn('comal', 0, 2), makeFurn('bar', 0, 5),
  makeFurn('fridge', 1, 0), makeFurn('drinks', 2, 0), makeFurn('caja', 3, 0), makeFurn('bench', 7, 0),
  makeFurn('table', 5, 4), makeFurn('table', 1, 7)
];
function rebuildLayout(w) {                                      // se llama cada vez que cambia el mobiliario colocado
  const f = w.furn, one = t => f.find(x => x.type === t) || null;
  LAYOUT.comals = f.filter(x => x.type === 'comal'); LAYOUT.tables = f.filter(x => x.type === 'table');
  LAYOUT.fridge = one('fridge'); LAYOUT.bar = one('bar'); LAYOUT.drinks = one('drinks'); LAYOUT.bench = one('bench');
  w.slots = LAYOUT.comals.map(x => x.slot);
  w.dslots = LAYOUT.fridge ? LAYOUT.fridge.slots : [];
  SEATS.length = 0; LAYOUT.tables.forEach(t => t.seats.forEach(s => SEATS.push(s)));
  Grid.blocked.fill(0);                                          // mesas, sillas y muebles son sólidos: nadie los atraviesa
  f.forEach(it => footprint(it).forEach(([c, r]) => Grid.block(c, r)));
  if (DECO.arena) RING_CELLS().forEach(([c, r]) => Grid.block(c, r));      // el cuadrilátero central también es sólido
}
const rebuildGrid = rebuildLayout;
function neighborCells(it) {                                     // losetas libres que rodean una pieza (desde donde se le puede atender)
  const own = new Set(footprint(it).map(([c, r]) => r * COLS + c)), seen = new Set(), out = [];
  footprint(it).forEach(([c, r]) => DIRS.forEach(([dc, dr]) => {
    const nc = c + dc, nr = r + dr, k = nr * COLS + nc;
    if (!Grid.inb(nc, nr) || own.has(k) || seen.has(k)) return;
    seen.add(k); if (Grid.free(nc, nr)) out.push({ c: nc, r: nr });
  }));
  return out;
}
const accessFor = key => { const it = RECIPES[key].drink ? (LAYOUT.drinks || LAYOUT.fridge) : LAYOUT.bar; return it ? neighborCells(it) : []; };   // sin mostrador de bebidas, las micheladas se recogen en el refri
const restAccess = () => LAYOUT.bench ? neighborCells(LAYOUT.bench) : [];
const benchSeatPt = i => { const q = tp(LAYOUT.bench, .5 + i, .6); return { x: q[0], y: q[1] }; };
const benchExit = () => { const a = restAccess(); return a.length ? Grid.pt(a[0].c, a[0].r) : null; };

// Posiciones en pantalla de lo que hay sobre cada mueble (null si esa pieza no está colocada)
const barSlot = i => [.4 + (i % 4) * .72, .3 + Math.floor(i / 4) * .42];         // la barra tiene dos filas de cuatro lugares
const barPos = i => { const b = LAYOUT.bar; if (!b) return null; const q = barSlot(i); return TS(b, q[0], q[1], 34); };
const drinkPos = () => {                                         // el refri guarda las micheladas listas al pie si no hay mostrador de bebidas
  const d = LAYOUT.drinks, f = LAYOUT.fridge;
  return d ? S(d.c + .5, d.r + .5, 34) : f ? TS(f, .5, .9, 6) : null;
};
const stockPos = key => RECIPES[key].drink ? drinkPos() : barPos(FOODS.indexOf(key));
const comalPos = (i = 0) => { const it = LAYOUT.comals[i]; return it ? TS(it, 1, .5, 36) : null; };
function stockAt(w, x, y, rad = 20) {                          // la pila de comida lista más cercana al clic (las filas de la barra se acercan entre sí)
  let best = null, bd = rad;
  for (const k of MENU) {
    if (w.stock[k] <= 0) continue;
    const p = stockPos(k); if (!p) continue;
    const d = Math.hypot(x - p.x, y - (p.y - 10));
    if (d < bd) { bd = d; best = k; }
  }
  return best;
}
const slotPos = comalPos;                                       // cada comal tiene un único lugar de cocción
function comalHit(x, y, i = 0) {
  const p = comalPos(i); if (!p) return false;
  const dx = (x - p.x) / 64, dy = (y - (p.y + 2)) / 40;
  return dx * dx + dy * dy <= 1;
}
const fridgeRingPos = i => { const f = LAYOUT.fridge; const p = S(f.c + .5, f.r + .45, FURN.fridge.h + 34); return { x: p.x + (i ? 15 : -15), y: p.y }; };
function itemBox(it, extra = 24) {                               // caja en pantalla (con altura) de una pieza: para clics y resaltado
  const d = dimsOf(it), hh = FURN[it.type].h;
  return { x0: S(it.c, it.r + d.fh).x - 2, x1: S(it.c + d.fw, it.r).x + 2, y0: S(it.c, it.r, hh + extra).y - 2, y1: S(it.c + d.fw, it.r + d.fh).y + 2 };
}
const inBox = (b, x, y) => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1;
const fridgeHit = (x, y) => !!LAYOUT.fridge && inBox(itemBox(LAYOUT.fridge, 44), x, y);          // incluye el rótulo de arriba
const restHit = (x, y) => !!LAYOUT.bench && inBox(itemBox(LAYOUT.bench, 36), x, y);
const DOOR = { ix: 5.5, hingeL: 4.8, hingeR: 6.2, leaf: .7, h: 86, cells: [{ c: 5, r: 0 }] };
const SIDE_Y = -3.2, SPAWN_X = 13, EXIT_X = -1.8;               // banqueta exterior: por dónde entran y se alejan los clientes

// ¿Se puede colocar la pieza it con su esquina en (c, r)? Devuelve null si sí o el motivo si no.
function layoutConnected(w, items) {                             // todo debe seguir siendo alcanzable desde la puerta
  const blocked = new Uint8Array(COLS * ROWS);
  items.forEach(it => footprint(it).forEach(([c, r]) => { blocked[r * COLS + c] = 1; }));
  if (DECO.arena) RING_CELLS().forEach(([c, r]) => { blocked[r * COLS + c] = 1; });
  const entry = DOOR.cells[0], start = entry.r * COLS + entry.c;
  if (blocked[start]) return false;
  const seen = new Uint8Array(COLS * ROWS); seen[start] = 1;
  const q = [start];
  for (let i = 0; i < q.length; i++) {
    const cur = q[i], c = cur % COLS, r = (cur / COLS) | 0;
    for (const [dc, dr] of DIRS) {
      const nc = c + dc, nr = r + dr;
      if (!Grid.inb(nc, nr)) continue;
      const k = nr * COLS + nc;
      if (seen[k] || blocked[k]) continue;
      seen[k] = 1; q.push(k);
    }
  }
  const touches = (c, r) => DIRS.some(([dc, dr]) => Grid.inb(c + dc, r + dr) && seen[(r + dr) * COLS + c + dc]);
  for (const it of items) {
    if (it.type === 'table') { const a = tp(it, 0, 0), b = tp(it, 3, 0); if (!touches(a[0], a[1]) || !touches(b[0], b[1])) return false; }
    else if (it.type === 'bar' || it.type === 'drinks' || it.type === 'bench') { if (!footprint(it).some(([c, r]) => touches(c, r))) return false; }
  }
  const nv = Grid.cell(w.novato.x, w.novato.y);
  if (!w.novato.resting && !blocked[nv.r * COLS + nv.c] && !seen[nv.r * COLS + nv.c]) return false;
  return true;
}
function busyCells(w) {                                           // losetas donde hay alguien parado
  const s = new Set(), add = e => { if (e.x >= 0 && e.y >= 0 && e.x < COLS && e.y < ROWS) { const k = Grid.cell(e.x, e.y); s.add(k.r * COLS + k.c); } };
  w.customers.forEach(cu => { if (!cu.seated) add(cu); });
  add(w.novato); w.staff.forEach(add);
  return s;
}
function canPlace(w, it, c, r) {
  const d = dimsOf(it);
  if (c < 0 || r < 0 || c + d.fw > COLS || r + d.fh > ROWS) return 'Queda fuera del local';
  const moved = { type: it.type, c, r, rot: it.rot || 0 }, tiles = footprint(moved);
  if (tiles.some(([a, b]) => a === DOOR.cells[0].c && b === DOOR.cells[0].r)) return 'Esa loseta es la entrada';
  const taken = new Set();
  w.furn.forEach(o => { if (o !== it) footprint(o).forEach(([a, b]) => taken.add(b * COLS + a)); });
  if (DECO.arena) RING_CELLS().forEach(([a, b]) => taken.add(b * COLS + a));
  if (tiles.some(([a, b]) => taken.has(b * COLS + a))) return DECO.arena && RING_CELLS().some(([a, b]) => tiles.some(([x, y]) => x === a && y === b)) ? 'Ahí está el cuadrilátero' : 'Ahí ya hay otro mueble';
  const busy = busyCells(w);
  if (tiles.some(([a, b]) => busy.has(b * COLS + a))) return 'Hay alguien parado ahí';
  if (!layoutConnected(w, w.furn.filter(o => o !== it).concat([moved]))) return 'Bloquearía el paso';
  return null;
}

/* =========================================================
   INTERFAZ: PUNTERO Y BOTONES
   ========================================================= */
// touch = el último toque vino de un dedo o lápiz: los botones aceptan un margen extra y la edición pide dos toques
const UI = { mx: -99, my: -99, down: false, cursor: false, kb: false, touch: false,
  hit(b) { const s = this.touch ? 5 : 0; return this.mx >= b.x - s && this.mx <= b.x + b.w + s && this.my >= b.y - s && this.my <= b.y + b.h + s; } };
const BTN = {
  red: ['#ff5a6a', '#c81e3c'], teal: ['#2fd0dd', '#0e7f8c'], violet: ['#8b5cf6', '#4c2a9a'],
  dark: ['#5a4888', '#2a1a52'], green: ['#3ddc8a', '#12804a'], gold: ['#ffd95a', '#e29a12'], off: ['#6b6580', '#403a55']
};
function drawButton(c, b, focus) {
  const off = b.disabled;
  const hov = !off && UI.hit(b);
  if (hov) UI.cursor = true;
  const lift = hov ? (UI.down ? 2 : -3) : 0;
  const col = BTN[off ? 'off' : (b.style || 'red')];
  c.save();
  c.fillStyle = 'rgba(0,0,0,.45)'; rr(c, b.x + 2, b.y + 6, b.w, b.h, 12); c.fill();
  c.translate(0, lift);
  const g = c.createLinearGradient(0, b.y, 0, b.y + b.h);
  g.addColorStop(0, col[0]); g.addColorStop(1, col[1]);
  rr(c, b.x, b.y, b.w, b.h, 12); c.fillStyle = g; c.fill();
  c.lineWidth = 3; c.strokeStyle = off ? '#8f89a6' : P.gold; c.stroke();
  c.lineWidth = 1.5; c.strokeStyle = 'rgba(255,255,255,.35)';
  rr(c, b.x + 4, b.y + 4, b.w - 8, b.h * .42, 8); c.stroke();
  if (hov) { c.fillStyle = 'rgba(255,255,255,.14)'; rr(c, b.x, b.y, b.w, b.h, 12); c.fill(); }
  const size = b.size || 26;
  txt(c, b.label, b.x + b.w / 2, b.y + b.h / 2 + size * .33, {
    font: `700 ${size}px ${FONT_UI}`, align: 'center', color: off ? '#cfc9e0' : P.white, stroke: P.ink, sw: 5, ls: 1.5
  });
  if (b.sub) txt(c, b.sub, b.x + b.w / 2, b.y + b.h - 7, { font: `600 12px ${FONT_UI}`, align: 'center', color: '#e8e0ff', ls: 1 });
  if (focus) {
    c.lineWidth = 3; c.strokeStyle = P.white; c.setLineDash([6, 4]);
    rr(c, b.x - 5, b.y - 5, b.w + 10, b.h + 10, 15); c.stroke();
  }
  c.restore();
}
function drawPanel(c, x, y, w, h, title) {
  c.save();
  c.fillStyle = 'rgba(0,0,0,.5)'; rr(c, x + 4, y + 8, w, h, 18); c.fill();
  const g = c.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#34195e'); g.addColorStop(1, '#1b0f38');
  rr(c, x, y, w, h, 18); c.fillStyle = g; c.fill();
  c.lineWidth = 4; c.strokeStyle = P.gold; c.stroke();
  c.lineWidth = 1.5; c.strokeStyle = 'rgba(255,255,255,.18)'; rr(c, x + 8, y + 8, w - 16, h - 16, 12); c.stroke();
  if (title) {
    c.fillStyle = P.red; rr(c, x + w / 2 - 170, y - 24, 340, 52, 8); c.fill();
    c.lineWidth = 3; c.strokeStyle = P.gold; c.stroke();
    txt(c, title, x + w / 2, y + 14, { font: `400 30px ${FONT_DISPLAY}`, align: 'center', color: P.gold, stroke: P.ink, sw: 5 });
  }
  c.restore();
}

/* =========================================================
   FONDO DE RING (menú, ajustes, despedida)
   ========================================================= */
function drawRingBg(c, t) {
  let g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0a0618'); g.addColorStop(.55, '#2a1050'); g.addColorStop(1, '#4a1a3a');
  c.fillStyle = g; c.fillRect(0, 0, W, H);

  // reflectores
  for (let i = 0; i < 4; i++) {
    const x0 = 120 + i * 240, sw = Math.sin(t * .7 + i * 1.7) * 150;
    const lg = c.createLinearGradient(0, 0, 0, 440);
    lg.addColorStop(0, 'rgba(255,240,180,.30)'); lg.addColorStop(1, 'rgba(255,240,180,0)');
    c.fillStyle = lg;
    c.beginPath(); c.moveTo(x0 - 14, -10); c.lineTo(x0 + 14, -10); c.lineTo(x0 + sw + 90, 440); c.lineTo(x0 + sw - 90, 440); c.closePath(); c.fill();
  }

  // público
  const crowd = ['#1a0c33', '#240f45', '#301558'];
  for (let k = 0; k < 3; k++) {
    const yb = 262 + k * 30;
    for (let x = -10 + (k % 2) * 17; x < W + 20; x += 34) {
      const bob = Math.sin(t * 3 + x * .3 + k) * 3, up = ((x / 34 | 0) + k) % 7 === 0;
      c.fillStyle = crowd[k];
      c.beginPath(); c.ellipse(x, yb + 22 + bob, 17, 20, 0, 0, 6.3); c.fill();
      c.beginPath(); c.arc(x, yb + bob, 11, 0, 6.3); c.fill();
      if (up) { c.strokeStyle = crowd[k]; c.lineWidth = 6; c.lineCap = 'round'; c.beginPath(); c.moveTo(x + 10, yb + 14 + bob); c.lineTo(x + 16, yb - 18 + bob + Math.sin(t * 6 + x) * 4); c.stroke(); }
    }
  }

  // lona
  c.beginPath(); c.moveTo(230, 410); c.lineTo(730, 410); c.lineTo(900, 560); c.lineTo(60, 560); c.closePath();
  g = c.createLinearGradient(0, 410, 0, 560);
  g.addColorStop(0, '#2c3e9e'); g.addColorStop(1, '#4258c8');
  c.fillStyle = g; c.fill();
  c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 3; c.stroke();
  // faldón
  c.beginPath(); c.moveTo(60, 560); c.lineTo(900, 560); c.lineTo(944, 600); c.lineTo(16, 600); c.closePath();
  c.fillStyle = '#8f1d33'; c.fill();
  c.strokeStyle = P.gold; c.lineWidth = 3; c.stroke();

  // cuerdas traseras y laterales
  const cols = ['#e0364a', '#fff8ea', '#3b82f6'], fr = [.3, .58, .86];
  const postBack = (x) => { c.fillStyle = '#c9c9dd'; c.fillRect(x - 7, 275, 14, 135); c.strokeStyle = P.ink; c.lineWidth = 2; c.strokeRect(x - 7, 275, 14, 135); };
  const ropes = (fn) => fr.forEach((f, i) => fn(f, cols[i]));
  ropes((f, col) => {
    const yb = 410 - 135 * f, yf = 560 - 220 * f;
    c.lineCap = 'round';
    for (const [x1, y1, x2, y2, w] of [[230, yb, 730, yb, 6], [230, yb, 60, yf, 7], [730, yb, 900, yf, 7]]) {
      c.strokeStyle = P.ink; c.lineWidth = w + 3; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
      c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
    }
  });
  postBack(230); postBack(730);
  // postes delanteros
  for (const x of [60, 900]) {
    c.fillStyle = '#d9d9e8'; c.fillRect(x - 10, 340, 20, 220); c.strokeStyle = P.ink; c.lineWidth = 2; c.strokeRect(x - 10, 340, 20, 220);
    fr.forEach((f, i) => { const y = 560 - 220 * f; c.fillStyle = cols[i]; rr(c, x - 14, y - 12, 28, 24, 6); c.fill(); c.stroke(); });
  }
  [230, 730].forEach(x => fr.forEach((f, i) => { const y = 410 - 135 * f; c.fillStyle = cols[i]; rr(c, x - 10, y - 9, 20, 18, 5); c.fill(); c.lineWidth = 2; c.strokeStyle = P.ink; c.stroke(); }));
}

function drawSunburst(c, x, y, t) {
  c.save(); c.translate(x, y); c.rotate(t * .12);
  for (let i = 0; i < 18; i++) {
    c.rotate(Math.PI / 9);
    c.fillStyle = 'rgba(255,200,61,.10)';
    c.beginPath(); c.moveTo(0, 0); c.lineTo(520, -48); c.lineTo(520, 48); c.closePath(); c.fill();
  }
  c.restore();
}

/* =========================================================
   ESCENAS: MENÚ
   ========================================================= */
const Menu = {
  buttons: [], kbIndex: 0,
  enter() {
    const has = Store.anySaved();
    const w = 200, h = 56, y = 498, x0 = 50, gap = 20;
    this.buttons = [
      { label: 'Nuevo Juego', style: 'red', fn: () => setState('PARTIDAS', { mode: 'new' }) },
      { label: 'Cargar Partida', style: 'teal', disabled: !has, sub: has ? '' : 'sin partida guardada', fn: () => setState('PARTIDAS', { mode: 'load' }) },
      { label: 'Ajustes', style: 'violet', fn: () => setState('AJUSTES', { from: 'MENU' }) },
      { label: 'Salir', style: 'dark', fn: () => setState('SALIR') }
    ].map((b, i) => Object.assign(b, { x: x0 + i * (w + gap), y, w, h }));
    this.kbIndex = this.buttons.findIndex(b => !b.disabled);
    UI.kb = false;
  },
  update() {},
  draw(c) {
    const t = clock;
    drawRingBg(c, t);
    drawSunburst(c, 480, 300, t);

    // máscara central
    const bob = Math.sin(t * 1.6) * 6;
    c.save(); c.translate(0, bob);
    c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(480, 470 - bob, 110, 14, 0, 0, 6.3); c.fill();
    c.shadowColor = 'rgba(255,200,61,.55)'; c.shadowBlur = 40;
    drawMask(c, 480, 305, 118, MASKS.ring);
    c.restore();

    // título
    const title = 'ENMASCARADOS';
    c.save();
    c.translate(480, 0); c.rotate(Math.sin(t * .9) * .012);
    c.font = `400 100px ${FONT_DISPLAY}`;
    const tw = c.measureText(title).width, sc = Math.min(1, 880 / tw);
    c.scale(sc, sc);
    c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.lineJoin = 'round';
    const ty = 118 / sc;
    c.fillStyle = '#6d1226';
    for (let i = 9; i >= 1; i--) c.fillText(title, 0, ty + i);
    c.lineWidth = 14; c.strokeStyle = P.ink; c.strokeText(title, 0, ty);
    const gg = c.createLinearGradient(0, ty - 80, 0, ty);
    gg.addColorStop(0, '#fff6b8'); gg.addColorStop(.5, '#ffc83d'); gg.addColorStop(1, '#ff8a3d');
    c.fillStyle = gg; c.fillText(title, 0, ty);
    c.restore();

    // cinta
    c.save();
    c.fillStyle = P.red; c.strokeStyle = P.gold; c.lineWidth = 3;
    rr(c, 300, 142, 360, 30, 6); c.fill(); c.stroke();
    txt(c, 'TAQUERÍA DE LUCHA LIBRE', 480, 164, { font: `700 20px ${FONT_UI}`, align: 'center', ls: 5, color: P.cream, stroke: P.ink, sw: 3 });
    c.restore();

    this.buttons.forEach((b, i) => drawButton(c, b, UI.kb && i === this.kbIndex));
    txt(c, 'v0.1 · prototipo', W - 14, H - 8, { font: `600 13px ${FONT_UI}`, align: 'right', color: 'rgba(255,248,234,.55)' });
  },
  pointerDown(x, y) {
    UI.kb = false;
    const b = this.buttons.find(b => !b.disabled && UI.hit(b));
    if (b) { sfx('click'); b.fn(); } else if (this.buttons.some(b => b.disabled && UI.hit(b))) sfx('nope');
  },
  pointerMove() { UI.kb = false; },
  pointerUp() {},
  key(e) {
    const n = this.buttons.length;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      const dir = (e.key === 'ArrowDown' || e.key === 'ArrowRight') ? 1 : -1;
      UI.kb = true;
      for (let i = 1; i <= n; i++) { const k = (this.kbIndex + dir * i + n * 2) % n; if (!this.buttons[k].disabled) { this.kbIndex = k; break; } }
      sfx('click'); return true;
    }
    if (e.key === 'Enter' || e.key === ' ') { UI.kb = true; sfx('click'); this.buttons[this.kbIndex].fn(); return true; }
    return false;
  }
};

/* =========================================================
   ESCENAS: AJUSTES
   ========================================================= */
const SettingsScene = {
  from: 'MENU', drag: false, confirmT: 0, buttons: {},
  slider: { x: 410, y: 262, w: 210 },
  enter(arg) {
    this.from = (arg && arg.from) || 'MENU'; this.drag = false; this.confirmT = 0;
    const back = () => { sfx('back'); setState(this.from); };
    this.buttons = {
      sound: { x: 540, y: 168, w: 170, h: 46, size: 22, fn: () => { Settings.sound = !Settings.sound; saveSettings(); Sfx.unlock(); sfx('click'); } },
      reset: { x: 540, y: 318, w: 170, h: 46, size: 22, style: 'red', fn: () => {
        if (this.confirmT > 0) { for (let n = 1; n <= Store.SLOTS; n++) Store.clearSlot(n); this.confirmT = 0; sfx('back'); } else { this.confirmT = 3; sfx('nope'); }
      } },
      back:  { x: 370, y: 410, w: 220, h: 54, style: 'gold', label: 'Volver', fn: back },
      saveExit: { x: 480, y: 410, w: 240, h: 54, style: 'green', label: 'Guardar y salir', size: 22, fn: () => { Game.save(); sfx('back'); setState('MENU'); } }
    };
    if (this.from === 'JUGANDO') Object.assign(this.buttons.back, { x: 240, w: 220 });          // en partida: Volver + Guardar y volver al menú principal
  },
  update(dt) { if (this.confirmT > 0) this.confirmT -= dt; },
  draw(c) {
    scenes[this.from].draw(c);
    c.fillStyle = 'rgba(10,5,30,.74)'; c.fillRect(0, 0, W, H);
    drawPanel(c, 220, 100, 520, 400, 'AJUSTES');
    const B = this.buttons, lab = { font: `700 26px ${FONT_UI}`, color: P.cream, ls: 1 };
    // sonido
    txt(c, 'Sonido', 260, 200, lab);
    B.sound.label = Settings.sound ? 'ACTIVADO' : 'SILENCIO'; B.sound.style = Settings.sound ? 'green' : 'dark';
    drawButton(c, B.sound);
    // volumen
    txt(c, 'Volumen', 260, 275, lab);
    const s = this.slider;
    rr(c, s.x, s.y, s.w, 14, 7); c.fillStyle = '#120a2a'; c.fill(); c.lineWidth = 2; c.strokeStyle = P.violet; c.stroke();
    rr(c, s.x, s.y, Math.max(14, s.w * Settings.volume), 14, 7); c.fillStyle = Settings.sound ? P.gold : '#6b6580'; c.fill();
    const kx = s.x + s.w * Settings.volume;
    c.beginPath(); c.arc(kx, s.y + 7, 14, 0, 6.3); c.fillStyle = P.cream; c.fill(); c.lineWidth = 3; c.strokeStyle = P.ink; c.stroke();
    txt(c, Math.round(Settings.volume * 100) + '%', 710, 276, { font: `700 22px ${FONT_UI}`, align: 'right', color: P.gold });      // alineado con el borde derecho del botón de sonido
    if (UI.mx > s.x - 20 && UI.mx < s.x + s.w + 20 && UI.my > s.y - 16 && UI.my < s.y + 32) UI.cursor = true;
    // progreso
    txt(c, 'Progreso', 260, 345, lab);
    const nSaved = Store.slots().filter(s => s).length, inGame = this.from === 'JUGANDO';
    txt(c, inGame ? (Game.slot ? `Se guarda sola cada 15 s (ranura ${Game.slot})` : 'Esta partida no tiene ranura de guardado') : nSaved ? `${nSaved} de ${Store.SLOTS} partidas guardadas` : 'Sin partidas guardadas', 260, 372, { font: `600 18px ${FONT_UI}`, color: P.muted });
    B.reset.label = this.confirmT > 0 ? '¿SEGURO?' : 'BORRAR TODO'; B.reset.size = this.confirmT > 0 ? 22 : 17;
    B.reset.disabled = inGame || (!nSaved && this.confirmT <= 0);
    if (!inGame) drawButton(c, B.reset);
    drawButton(c, B.back);
    if (inGame) drawButton(c, Object.assign({}, B.saveExit, { disabled: !Game.slot }));
  },
  setVol(x) { Settings.volume = clamp((x - this.slider.x) / this.slider.w, 0, 1); Sfx.apply(); },
  pointerDown(x, y) {
    Sfx.unlock();
    const s = this.slider;
    if (x > s.x - 20 && x < s.x + s.w + 20 && y > s.y - 16 && y < s.y + 32) { this.drag = true; this.setVol(x); return; }
    const inGame = this.from === 'JUGANDO';
    for (const k of ['sound', 'reset', 'back', 'saveExit']) {
      const b = this.buttons[k]; if (k === 'reset' && inGame) continue; if (k === 'saveExit' && (!inGame || !Game.slot)) continue;
      if (!b.disabled && UI.hit(b)) { b.fn(); return; }
    }
  },
  pointerMove(x) { if (this.drag) this.setVol(x); },
  pointerUp() { if (this.drag) { this.drag = false; saveSettings(); sfx('click'); } },
  key(e) { if (e.key === 'Escape' || e.key === 'Enter') { this.buttons.back.fn(); return true; } return false; }
};

/* =========================================================
   ESCENAS: PARTIDAS (3 ranuras para Nuevo Juego y Cargar)
   ========================================================= */
const PartidasScene = {
  mode: 'new', conf: null, btns: [], back: null,
  CARD: { x0: 85, y: 168, w: 250, h: 280, gap: 20 },
  enter(arg) { this.mode = (arg && arg.mode) || 'new'; this.conf = null; this.build(); },
  build() {
    const C = this.CARD, saves = Store.slots();
    this.saves = saves;
    this.btns = saves.map((s, i) => {
      const n = i + 1, x = C.x0 + i * (C.w + C.gap) + 20, bw = C.w - 40, cf = this.conf && this.conf.n === n ? this.conf.kind : '';
      const main = { x, y: C.y + C.h - 96, w: bw, h: 44, size: 21 };
      if (this.mode === 'load') {
        Object.assign(main, s ? { label: 'CARGAR', style: 'teal', fn: () => this.start(n, s) } : { label: 'VACÍA', disabled: true });
      } else if (!s) Object.assign(main, { label: 'EMPEZAR AQUÍ', style: 'green', fn: () => this.start(n, null) });
      else Object.assign(main, cf === 'over' ? { label: '¿SEGURO?', style: 'gold', fn: () => this.start(n, null) }
        : { label: 'SOBRESCRIBIR', style: 'red', size: 19, fn: () => this.ask(n, 'over') });
      const del = s ? { x, y: C.y + C.h - 48, w: bw, h: 30, size: 14, label: cf === 'del' ? '¿BORRAR DE VERDAD?' : 'BORRAR', style: cf === 'del' ? 'gold' : 'dark',
        fn: cf === 'del' ? () => { Store.clearSlot(n); this.conf = null; sfx('back'); this.build(); } : () => this.ask(n, 'del') } : null;
      return { main, del };
    });
    this.back = { x: 380, y: 458, w: 200, h: 42, size: 22, style: 'gold', label: 'Volver', fn: () => { sfx('back'); setState('MENU'); } };
  },
  ask(n, kind) { this.conf = { n, kind, t: 3.5 }; sfx('nope'); this.build(); },
  start(n, save) { Game.newGame(save, n); setState('JUGANDO'); },
  update(dt) { if (this.conf && (this.conf.t -= dt) <= 0) { this.conf = null; this.build(); } },
  fecha(at) {
    if (!at) return '';
    try { const d = new Date(at); return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) + ' · ' + d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; }
  },
  draw(c) {
    drawRingBg(c, clock);
    const C = this.CARD, load = this.mode === 'load';
    drawPanel(c, 50, 110, 860, 400, load ? 'CARGAR PARTIDA' : 'NUEVO JUEGO');
    txt(c, load ? 'Elige cuál partida quieres continuar' : 'Elige una ranura: las demás partidas no se tocan', 480, 150, { font: `600 17px ${FONT_UI}`, align: 'center', color: P.muted });
    this.saves.forEach((s, i) => {
      const x = C.x0 + i * (C.w + C.gap), cx = x + C.w / 2;
      c.save();
      c.fillStyle = 'rgba(0,0,0,.35)'; rr(c, x + 3, C.y + 5, C.w, C.h, 14); c.fill();
      rr(c, x, C.y, C.w, C.h, 14); c.fillStyle = s ? 'rgba(255,255,255,.09)' : 'rgba(255,255,255,.04)'; c.fill();
      c.lineWidth = 2.5; c.strokeStyle = s ? P.gold : 'rgba(255,255,255,.25)'; if (!s) c.setLineDash([8, 6]); c.stroke(); c.setLineDash([]);
      c.restore();
      txt(c, 'PARTIDA ' + (i + 1), cx, C.y + 30, { font: `400 24px ${FONT_DISPLAY}`, align: 'center', color: P.gold, stroke: P.ink, sw: 4 });
      if (s) {
        drawMask(c, cx, C.y + 70, 28, MASKS.ring);
        const ln = { font: `700 17px ${FONT_UI}`, align: 'center', color: P.cream };
        txt(c, `Día ${s.day} · Nivel ${s.level || 1}`, cx, C.y + 116, ln);
        txt(c, pesos(s.money), cx, C.y + 140, { font: `700 20px ${FONT_UI}`, align: 'center', color: P.gold });
        txt(c, `Máscaras ${clamp(s.rep, 0, 5).toFixed(1)} / 5`, cx, C.y + 160, { font: `600 14px ${FONT_UI}`, align: 'center', color: P.muted });
        txt(c, this.fecha(s.at), cx, C.y + 177, { font: `600 13px ${FONT_UI}`, align: 'center', color: P.muted });
      } else {
        txt(c, 'Partida vacía', cx, C.y + 118, { font: `700 20px ${FONT_UI}`, align: 'center', color: 'rgba(255,248,234,.45)' });
        txt(c, load ? 'Aquí no hay nada guardado' : 'Libre para empezar', cx, C.y + 142, { font: `600 14px ${FONT_UI}`, align: 'center', color: 'rgba(255,248,234,.35)' });
      }
      const b = this.btns[i]; drawButton(c, b.main); if (b.del) drawButton(c, b.del);
    });
    drawButton(c, this.back);
  },
  pointerDown(x, y) {
    for (const b of this.btns) for (const k of ['main', 'del']) { const q = b[k]; if (q && !q.disabled && UI.hit(q)) { sfx('click'); q.fn(); return; } }
    if (UI.hit(this.back)) { this.back.fn(); return; }
    if (this.btns.some(b => b.main.disabled && UI.hit(b.main))) sfx('nope');
  },
  pointerMove() {}, pointerUp() {},
  key(e) { if (e.key === 'Escape') { this.back.fn(); return true; } return false; }
};

/* =========================================================
   ESCENAS: SALIR (despedida y créditos)
   ========================================================= */
const ByeScene = {
  t: 0, btn: null,
  enter() { this.t = 0; this.btn = { x: 370, y: 462, w: 220, h: 54, style: 'gold', label: 'Volver al menú', size: 24 }; },
  update(dt) { this.t += dt; },
  draw(c) {
    drawRingBg(c, clock);
    c.fillStyle = 'rgba(10,5,30,.55)'; c.fillRect(0, 0, W, H);
    drawPanel(c, 180, 70, 600, 420, '¡HASTA LUEGO!');
    drawLuchador(c, 480, 268, Object.assign({}, LUCHADORES.novato, { state: 'idle', t: this.t, dir: 1, scale: 2.1 }));
    const fade = clamp(this.t * 1.5, 0, 1);
    c.save(); c.globalAlpha = fade;
    txt(c, 'GRACIAS POR JUGAR, CAMPEÓN', 480, 316, { font: `400 30px ${FONT_DISPLAY}`, align: 'center', color: P.gold, stroke: P.ink, sw: 5 });
    txt(c, 'La taquería queda lista para tu regreso.', 480, 346, { font: `600 20px ${FONT_UI}`, align: 'center', color: P.cream });
    const rows = [['DISEÑO Y CÓDIGO', 'Prototipo ENMASCARADOS v0.1'], ['TECNOLOGÍA', 'HTML5 Canvas · JavaScript puro'], ['PERSONAJE', 'El Novato, luchador de máscara verde']];
    rows.forEach((r, i) => {
      txt(c, r[0], 300, 388 + i * 24, { font: `700 14px ${FONT_UI}`, color: P.muted, ls: 2 });
      txt(c, r[1], 440, 388 + i * 24, { font: `600 19px ${FONT_UI}`, color: P.cream });
    });
    c.restore();
    drawButton(c, this.btn, UI.kb);
  },
  go() { sfx('back'); setState('MENU'); },
  pointerDown() { if (UI.hit(this.btn)) this.go(); },
  pointerMove() {}, pointerUp() {},
  key(e) { if (e.key === 'Enter' || e.key === 'Escape' || e.key === ' ') { this.go(); return true; } return false; }
};

/* =========================================================
   JUEGO: ENTIDADES
   ========================================================= */
/* ---------- Variantes de luchadores (máscaras, tenis, sudaderas) ---------- */
const MASK_STYLES = {
  michelada: { base: '#d6342c', trim: '#ff8a3d', pattern: 'alebrije', glitter: true },
  novato:    { base: '#2fbf71', trim: '#fff3b0', pattern: 'star', accent: '#1b8a52' },
  rosa:      { base: '#e83e8c', trim: '#ffe27a', pattern: 'alebrije', glitter: true },
  turquesa:  { base: '#12a5b5', trim: '#ffe27a', pattern: 'alebrije', glitter: false },
  oro:       { base: '#f0a410', trim: '#7a1a2b', pattern: 'alebrije', glitter: true },
  rayo:      { base: '#3b5bdb', trim: '#ffd95a', pattern: 'bolt' },
  noche:     { base: '#2b2540', trim: '#ffc83d', pattern: 'stripes', accent: '#e0364a' },
  payaso:    { base: '#f4f1e8', trim: '#e0364a', pattern: 'clown' },                  // El Payaso Maniático (VIP)
  mistico:   { base: '#eaf1ff', trim: '#3b82f6', pattern: 'wings', accent: '#9fc4ff' },   // El Místico-Volador: blanco y azul cielo, con alas en las sienes
  anil:      { base: '#3a35a8', trim: '#ff5a5a', pattern: 'horns', accent: '#1d1a63' }    // Demonio Añil: azul añil con cuernos rojos
};
const SHOES = {
  camo:     { upper: '#456b34', sole: '#f4efe2', accent: '#e0c47a' },
  blanco:   { upper: '#f1efe6', sole: '#f4efe2', accent: '#e0364a' },
  rojo:     { upper: '#d6342c', sole: '#f4efe2', accent: '#fff3b0' },
  azul:     { upper: '#3b5bdb', sole: '#f4efe2', accent: '#ffd95a' },
  amarillo: { upper: '#ffb21e', sole: '#f4efe2', accent: '#1b1030' },
  novato:   { upper: '#2fbf71', sole: '#f4efe2', accent: '#ffd95a' }
};
const HOODIES = ['#17171c', '#3b5bdb', '#7c3aed', '#d6342c', '#ffb21e', '#14a38b', '#eeeadf', '#e8509a', '#2b3a67'];
const SKINS = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524'];

// Presets con nombre: se usan tal cual en drawLuchador(ctx, x, y, { ...LUCHADORES.michelada, state: 'walk', t })
const LUCHADORES = {
  michelada: { hoodie: '#17171c', mask: 'michelada', shoes: 'camo', label: ['MICHELADA', 'ENMASCARADA'] },
  novato:    { hoodie: '#eeeadf', mask: 'novato', shoes: 'novato', label: ['EL', 'NOVATO'] },
  mesero:    { hoodie: '#3b82c4', mask: 'novato', shoes: 'azul', label: ['MESERO', 'NOVATO'] },
  mesero2:   { hoodie: '#e8509a', mask: 'novato', shoes: 'rojo', label: ['MESERO', 'NOVATO 2'] },
  mistico:   { hoodie: '#f4f1e8', mask: 'mistico', shoes: 'azul', label: ['MÍSTICO', 'VOLADOR'] },
  anil:      { hoodie: '#241c6b', mask: 'anil', shoes: 'rojo', skin: '#8d5524', label: ['DEMONIO', 'AÑIL'] }
};
function randomLook() {
  const r = Math.random();
  if (r < 0.08) return Object.assign({ skin: pick(SKINS) }, LUCHADORES.michelada);
  if (r < 0.4) return {                                              // algunos clientes van enmascarados
    hoodie: pick(HOODIES), mask: pick(['rosa', 'turquesa', 'oro', 'rayo', 'noche', 'michelada']),
    shoes: pick(['camo', 'blanco', 'rojo', 'azul', 'amarillo']), skin: pick(SKINS), label: null
  };
  const g = Math.random() < .5 ? 'f' : 'm';                          // el resto: gente normal, hombre o mujer, con la cara descubierta
  return {
    casual: true, gender: g, hairStyle: pick(HAIR_STYLES[g]), hairColor: pick(HAIR_COLORS),
    hoodie: pick(HOODIES), pants: pick(['#23232b', '#2d3550', '#3a3a44', '#4a3b2c']),
    shoes: pick(['camo', 'blanco', 'rojo', 'azul', 'amarillo']), skin: pick(SKINS), label: null
  };
}

function step(e, dt) {                    // avanza por e.path; true cuando no queda camino
  let budget = e.speed * dt;
  e.moving = false;
  while (e.path.length && budget > 0) {
    const p = e.path[0], dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy);
    const sdx = dx - dy;                                   // desplazamiento horizontal en pantalla (isométrico)
    if (Math.abs(sdx) > .02) e.dir = sdx > 0 ? 1 : -1;
    if (d <= budget) { e.x = p.x; e.y = p.y; budget -= d; e.path.shift(); }
    else { e.x += dx / d * budget; e.y += dy / d * budget; budget = 0; e.moving = true; }
  }
  if (e.moving) e.phase += dt;
  return e.path.length === 0;
}

/* =========================================================
   LUCHADOR: personaje chibi con hoodie, animado por piezas (puppet)
   Origen (0,0) = suelo bajo los pies. Altura total ≈ 70 u; la cabeza mide ≈ 34 u (≈ 48 %).
   Jerarquía: raíz → piernas | torso → (cuerpo, plato, brazos, cabeza → máscara)
   ========================================================= */
const smooth = t => t * t * (3 - 2 * t);
const hash = i => { const s = Math.sin(i * 127.1) * 43758.5453; return s - Math.floor(s); };
function shade(hex, f) {                                   // f<0 oscurece, f>0 aclara (hex de 6 dígitos)
  const n = parseInt(hex.slice(1), 16);
  const ch = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.round(v + ((f < 0 ? 0 : 255) - v) * Math.abs(f)));
  return `rgb(${ch[0]},${ch[1]},${ch[2]})`;
}
const luma = hex => { const n = parseInt(hex.slice(1), 16); return 0.3 * (n >> 16) + 0.59 * ((n >> 8) & 255) + 0.11 * (n & 255); };

// Ciclo de comer (2.4 s): sube el taco → mordiscos con el taco en la boca → baja el brazo. Devuelve 0..1
function eatCycle(t) {
  const p = (t % 2.4) / 2.4;
  return p < .3 ? smooth(p / .3) : p < .7 ? 1 : p < 1 ? 1 - smooth((p - .7) / .3) : 0;
}

// IK de 2 huesos: ángulos (a1 del hombro, a2 relativo del codo) para extremidades que cuelgan hacia +y
function ik(S, T, l1, l2, side) {
  const dx = T.x - S.x, dy = T.y - S.y;
  const d = clamp(Math.hypot(dx, dy), Math.abs(l1 - l2) + .1, l1 + l2 - .05);
  const base = Math.atan2(dy, dx);
  const A = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
  const f1 = base - side * A;
  const ex = S.x + Math.cos(f1) * l1, ey = S.y + Math.sin(f1) * l1;
  const f2 = Math.atan2(T.y - ey, T.x - ex);
  return [f1 - Math.PI / 2, f2 - f1];
}

function drawShoe(c, side, S) {
  c.lineJoin = 'round'; c.lineWidth = 1.7; c.strokeStyle = P.ink;
  c.fillStyle = S.upper; rr(c, -8, -11, 16, 8, 4); c.fill(); c.stroke();                 // cuerpo del tenis
  c.fillStyle = '#efe9da'; c.beginPath(); c.ellipse(0, -5.2, 5.4, 2.6, 0, 0, 6.3); c.fill();
  c.lineWidth = 1; c.stroke(); c.lineWidth = 1.7;                                          // puntera
  c.fillStyle = shade(S.upper, -.25); rr(c, -3, -12, 6, 3.6, 1.5); c.fill(); c.stroke();   // lengüeta
  c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 1;
  c.beginPath(); c.moveTo(-2, -9.3); c.lineTo(2, -9.3); c.moveTo(-2.4, -7.7); c.lineTo(2.4, -7.7); c.stroke();
  star(c, side * 5.6, -7.2, 2.6, 1.1); c.fillStyle = S.accent; c.fill();                   // estrella lateral
  c.strokeStyle = S.accent; c.lineWidth = 1.2;
  c.beginPath(); c.moveTo(side * 4, -4.6); c.lineTo(side * 7.6, -5.4); c.stroke();         // franja
  c.lineWidth = 1.7; c.strokeStyle = P.ink;
  c.fillStyle = S.sole; rr(c, -8.4, -4.4, 16.8, 5.2, 2.6); c.fill(); c.stroke();           // suela gruesa
  c.strokeStyle = 'rgba(27,16,48,.3)'; c.lineWidth = 1; c.beginPath(); c.moveTo(-6.5, -1.7); c.lineTo(6.5, -1.7); c.stroke();
}

function drawSleeve(c, sx, sy, a1, a2, L1, L2, col, skin, hold) {
  c.save(); c.translate(sx, sy); c.rotate(a1);
  c.lineJoin = 'round'; c.lineWidth = 1.8; c.strokeStyle = P.ink; c.fillStyle = col;
  rr(c, -4.9, -3.5, 9.8, L1 + 5, 4.6); c.fill(); c.stroke();                               // brazo (manga)
  c.translate(0, L1); c.rotate(a2);
  rr(c, -4.5, -3.5, 9, L2 + 2, 4.3); c.fill(); c.stroke();                                 // antebrazo
  c.fillStyle = shade(col, luma(col) < 80 ? .16 : -.22); rr(c, -4.6, L2 - 3.2, 9.2, 3.6, 1.6); c.fill(); c.stroke(); // puño
  c.fillStyle = skin; c.beginPath(); c.arc(0, L2 + 3.4, 3.7, 0, 6.3); c.fill(); c.stroke();  // mano
  c.beginPath(); c.arc(-3.1, L2 + 1.8, 1.7, 0, 6.3); c.fill(); c.stroke();                 // pulgar
  if (hold) { c.translate(0, L2 + 3.4); hold(c, a1 + a2); }
  c.restore();
}

function drawHoodieBody(c, hood, label) {
  const dark = luma(hood) < 80;
  c.lineJoin = 'round'; c.lineWidth = 2; c.strokeStyle = P.ink;
  c.beginPath();
  c.moveTo(-14, -39); c.quadraticCurveTo(-15, -41.5, -11, -41.5); c.lineTo(11, -41.5); c.quadraticCurveTo(15, -41.5, 14, -39);
  c.lineTo(17.5, -17); c.quadraticCurveTo(17.5, -14.5, 14.5, -14.5); c.lineTo(-14.5, -14.5); c.quadraticCurveTo(-17.5, -14.5, -17.5, -17);
  c.closePath();
  c.fillStyle = hood; c.fill(); c.stroke();
  c.fillStyle = dark ? 'rgba(255,255,255,.08)' : 'rgba(255,255,255,.28)'; rr(c, -13, -38, 5, 20, 2.5); c.fill();   // brillo
  c.fillStyle = shade(hood, dark ? .12 : -.2); rr(c, -17, -19.5, 34, 5, 2); c.fill(); c.lineWidth = 1.5; c.stroke(); c.lineWidth = 2;    // elástico
  // bolsillo de canguro
  c.beginPath(); c.moveTo(-8.5, -26.5); c.lineTo(8.5, -26.5); c.lineTo(11.5, -20.5); c.lineTo(-11.5, -20.5); c.closePath();
  c.fillStyle = shade(hood, dark ? .09 : -.1); c.fill(); c.lineWidth = 1.5; c.stroke();
  c.beginPath(); c.moveTo(-8.5, -26.5); c.lineTo(-10.2, -22.5); c.moveTo(8.5, -26.5); c.lineTo(10.2, -22.5); c.stroke();
  // cordones
  c.strokeStyle = '#f4efe2'; c.lineWidth = 1.4; c.lineCap = 'round';
  c.beginPath(); c.moveTo(-4, -39); c.lineTo(-5.4, -32); c.moveTo(4, -39); c.lineTo(5.4, -32); c.stroke();
  c.fillStyle = '#f4efe2'; c.fillRect(-6.2, -32.2, 1.6, 2.2); c.fillRect(4.6, -32.2, 1.6, 2.2);
  if (label) {
    const col = dark ? '#e0603f' : P.ink;
    txt(c, label[0], 0, -32, { font: `700 4px ${FONT_UI}`, align: 'center', color: col, ls: .2 });
    txt(c, label[1], 0, -28.4, { font: `700 4px ${FONT_UI}`, align: 'center', color: col, ls: .2 });
  }
}

// Máscara estilizada vista de frente. s = escala (unidades de maskPath), f = { look, angry, blink, open }
function drawFace(c, cx, cy, s, M, f) {
  c.save(); c.translate(cx, cy); c.scale(s, s); c.lineJoin = 'round';
  maskPath(c); c.fillStyle = M.base; c.fill();
  c.save(); maskPath(c); c.clip();
  if (M.pattern === 'alebrije') {
    c.fillStyle = '#1b1030'; c.beginPath(); c.ellipse(0, -0.66, 0.98, 0.66, 0, 0, 6.3); c.fill();
    const petals = [[.3, -.98, .17, .08, .5, '#8bd450'], [.58, -.84, .16, .08, .2, '#ff5fa2'], [.78, -.58, .15, .08, -.4, '#ffc83d'],
                    [.46, -.55, .13, .07, .9, '#17a2b0'], [.7, -1.0, .13, .07, 1.1, '#8b5cf6'], [.2, -.7, .1, .06, 1.3, '#ff8a3d']];
    for (const m of [-1, 1]) for (const p of petals) {
      c.fillStyle = p[5]; c.beginPath(); c.ellipse(m * p[0], p[1], p[2], p[3], m * p[4], 0, 6.3); c.fill();
      c.fillStyle = 'rgba(255,255,255,.75)'; c.beginPath(); c.arc(m * p[0], p[1], .03, 0, 6.3); c.fill();
    }
    c.fillStyle = '#ff8a3d';                                                                  // llama central
    c.beginPath(); c.moveTo(0, -.3); c.bezierCurveTo(-.2, -.55, -.07, -.72, 0, -1.02); c.bezierCurveTo(.07, -.72, .2, -.55, 0, -.3); c.fill();
    c.fillStyle = '#ffe27a';
    c.beginPath(); c.moveTo(0, -.34); c.bezierCurveTo(-.09, -.5, -.03, -.62, 0, -.8); c.bezierCurveTo(.03, -.62, .09, -.5, 0, -.34); c.fill();
    for (const m of [-1, 1]) {                                                                // hojas laterales
      c.fillStyle = '#8bd450'; c.beginPath(); c.ellipse(m * .82, .38, .1, .2, m * .3, 0, 6.3); c.fill();
      c.fillStyle = '#ffc83d'; c.beginPath(); c.ellipse(m * .72, .82, .09, .16, m * .5, 0, 6.3); c.fill();
    }
    if (M.glitter) for (let i = 0; i < 46; i++) {
      const gx = (hash(i) * 2 - 1) * .9, gy = -.15 + hash(i + 50) * 1.4;
      c.fillStyle = `rgba(255,255,255,${.35 + hash(i + 9) * .45})`; c.beginPath(); c.arc(gx, gy, .018 + hash(i + 3) * .022, 0, 6.3); c.fill();
    }
  } else if (M.pattern === 'star') {
    c.fillStyle = M.accent;
    for (const m of [-1, 1]) { c.beginPath(); c.moveTo(m * 1.1, -1.3); c.lineTo(m * .62, -1.3); c.lineTo(m * .5, -.1); c.lineTo(m * .6, .8); c.lineTo(m * .5, 1.4); c.lineTo(m * 1.1, 1.4); c.closePath(); c.fill(); }
    star(c, 0, -.68, .26, .11); c.fillStyle = M.trim; c.fill(); c.lineWidth = .04; c.strokeStyle = P.ink; c.stroke();
  } else if (M.pattern === 'bolt') {
    c.beginPath(); c.moveTo(.12, -1.1); c.lineTo(-.24, -.55); c.lineTo(-.02, -.55); c.lineTo(-.18, -.2); c.lineTo(.24, -.66); c.lineTo(.02, -.66); c.closePath();
    c.fillStyle = M.trim; c.fill(); c.lineWidth = .04; c.strokeStyle = P.ink; c.stroke();
    c.fillStyle = 'rgba(255,255,255,.22)'; c.fillRect(-1, .62, 2, .12);
  } else if (M.pattern === 'clown') {                                       // maquillaje de payaso: rombos negros en los ojos, mejillas y frente con picos
    c.fillStyle = '#1b1030';
    for (const m of [-1, 1]) { c.beginPath(); c.moveTo(m * .47 + m * .5, -.14); c.lineTo(m * .47, -.64); c.lineTo(m * .47 - m * .5, -.14); c.lineTo(m * .47, .36); c.closePath(); c.fill(); }
    c.beginPath(); c.moveTo(-.5, -1.2); c.lineTo(-.28, -.8); c.lineTo(0, -1.25); c.lineTo(.28, -.8); c.lineTo(.5, -1.2); c.lineTo(.5, -1.4); c.lineTo(-.5, -1.4); c.closePath(); c.fill();
    c.fillStyle = '#e0364a'; for (const m of [-1, 1]) { c.beginPath(); c.arc(m * .62, .46, .15, 0, 6.3); c.fill(); }
  } else if (M.pattern === 'stripes') {
    for (let k = -3; k <= 3; k++) { c.fillStyle = k % 2 ? M.accent : M.trim; c.fillRect(k * .3 - .045, -1.3, .09, .85); }
  } else if (M.pattern === 'wings') {                                       // cielo: franjas azules a los lados y una estrella de cinco picos
    c.fillStyle = M.accent;
    for (const m of [-1, 1]) { c.beginPath(); c.moveTo(m * 1.1, -1.3); c.lineTo(m * .6, -1.3); c.lineTo(m * .46, -.1); c.lineTo(m * .58, .8); c.lineTo(m * .5, 1.4); c.lineTo(m * 1.1, 1.4); c.closePath(); c.fill(); }
    star(c, 0, -.68, .27, .11); c.fillStyle = M.trim; c.fill(); c.lineWidth = .04; c.strokeStyle = P.ink; c.stroke();
  } else if (M.pattern === 'horns') {                                       // añil profundo con una "V" roja en la frente y rayas oscuras
    c.fillStyle = M.accent;
    for (const m of [-1, 1]) { c.beginPath(); c.moveTo(m * 1.1, -1.3); c.lineTo(m * .56, -1.3); c.lineTo(m * .4, -.1); c.lineTo(m * .56, .9); c.lineTo(m * 1.1, 1.4); c.closePath(); c.fill(); }
    c.fillStyle = M.trim; c.beginPath(); c.moveTo(-.42, -1.1); c.lineTo(0, -.45); c.lineTo(.42, -1.1); c.lineTo(.24, -1.1); c.lineTo(0, -.75); c.lineTo(-.24, -1.1); c.closePath(); c.fill();
  }
  c.restore();
  maskPath(c); c.lineWidth = .09; c.strokeStyle = P.ink; c.stroke();
  maskPath(c); c.lineWidth = .04; c.strokeStyle = M.trim; c.stroke();
  if (M.pattern === 'horns') {                                              // cuernos por fuera de la máscara
    for (const m of [-1, 1]) {
      c.beginPath(); c.moveTo(m * .34, -1.08); c.quadraticCurveTo(m * .78, -1.18, m * .62, -1.78); c.quadraticCurveTo(m * 1.0, -1.34, m * .84, -.86); c.closePath();
      c.fillStyle = M.trim; c.fill(); c.lineWidth = .06; c.strokeStyle = P.ink; c.stroke();
    }
  } else if (M.pattern === 'wings') {                                       // alitas de plumas a los lados de la cabeza
    for (const m of [-1, 1]) for (const [fy, fl, fr] of [[-.78, .52, -.5], [-.52, .6, -.12], [-.26, .5, .3]]) {
      c.save(); c.translate(m * .86, fy); c.rotate(m * fr + (m < 0 ? 0 : 0)); c.beginPath(); c.ellipse(m * fl * .5, 0, fl * .5, .11, 0, 0, 6.3);
      c.fillStyle = '#ffffff'; c.fill(); c.lineWidth = .045; c.strokeStyle = P.ink; c.stroke(); c.restore();
    }
  }
  // ojos almendrados
  for (const m of [-1, 1]) {
    c.save(); c.translate(m * .47 + f.look * .05, -.14);
    if (f.blink) c.scale(1, .15);
    const tilt = f.angry ? .22 : .09;
    c.beginPath(); c.moveTo(m * .36, -.16 - tilt); c.quadraticCurveTo(0, -.4, -m * .36, .1); c.quadraticCurveTo(m * .1, .24, m * .36, -.16 - tilt); c.closePath();
    c.fillStyle = '#0b0614'; c.fill(); c.lineWidth = .07; c.strokeStyle = M.trim; c.stroke();
    if (!f.blink) { c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.arc(m * .08 + f.look * .03, -.06, .035, 0, 6.3); c.fill(); }
    c.restore();
  }
  // nariz y boca
  if (M.pattern === 'clown') { c.fillStyle = '#e0364a'; c.beginPath(); c.arc(0, .27, .16, 0, 6.3); c.fill(); c.lineWidth = .04; c.strokeStyle = P.ink; c.stroke(); }   // nariz roja
  else { c.fillStyle = shade(M.base, -.45); c.beginPath(); c.moveTo(-.08, .22); c.lineTo(.08, .22); c.lineTo(0, .38); c.closePath(); c.fill(); }
  const h = .26 + f.open * .2;
  rr(c, -.36 + f.look * .03, .56, .72, h, .13); c.fillStyle = '#0b0614'; c.fill(); c.lineWidth = .07; c.strokeStyle = M.trim; c.stroke();
  c.strokeStyle = 'rgba(255,255,255,.28)'; c.lineWidth = .03;
  c.beginPath(); c.moveTo(-.12, .6); c.lineTo(-.12, .54 + h); c.moveTo(.12, .6); c.lineTo(.12, .54 + h); c.stroke();
  c.restore();
}

/* Cabeza de persona normal (sin máscara), estilo caricatura chibi: cara de piel, ojos grandes, cejas, nariz, boca y peinado.
   o = { gender: 'm' | 'f', hairStyle, hairColor }; f = { dir, hood, skin, dk, angry, blink, open }. Origen = centro de la cabeza (radio ≈ 17). */
const HAIR_COLORS = ['#17171c', '#2b2018', '#4a2f1d', '#6b4a2a', '#c9a24a', '#8a3a22'];
const HAIR_STYLES = { m: ['spiky', 'crop'], f: ['buns', 'long', 'pony'] };
function drawCasualHead(c, o, f) {
  const g = o.gender === 'f', hair = o.hairColor || '#17171c', style = o.hairStyle || (g ? 'buns' : 'spiky'), skin = f.skin, hood = f.hood, dir = f.dir, ink = P.ink;
  c.save(); c.lineJoin = 'round'; c.lineCap = 'round'; c.strokeStyle = ink;
  // capucha caída detrás del cuello
  c.lineWidth = 2; c.fillStyle = hood; c.beginPath(); c.ellipse(0, 10.5, 17, 11, 0, 0, 6.3); c.fill(); c.stroke();
  c.fillStyle = shade(hood, f.dk ? .12 : -.25); c.beginPath(); c.ellipse(0, 11.5, 12, 7, 0, 0, 6.3); c.fill();
  // pelo de atrás
  c.fillStyle = hair; c.lineWidth = 1.8;
  if (style === 'buns') for (const s of [-1, 1]) {
    c.beginPath(); c.arc(s * 11.5, -15, 6.8, 0, 6.3); c.fill(); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.28)'; c.lineWidth = 1; c.beginPath(); c.arc(s * 11.5, -15, 3.6, 3.6, 5.4); c.stroke(); c.strokeStyle = ink; c.lineWidth = 1.8;
  }
  if (style === 'long') { c.beginPath(); c.moveTo(-15.5, -4); c.lineTo(-17.5, 16); c.quadraticCurveTo(0, 22, 17.5, 16); c.lineTo(15.5, -4); c.closePath(); c.fill(); c.stroke(); }
  if (style === 'pony') { c.save(); c.translate(-dir * 15, 4); c.rotate(-dir * .35); c.beginPath(); c.ellipse(0, 6, 4.6, 10, 0, 0, 6.3); c.fill(); c.stroke(); c.restore(); }
  if (style !== 'none') { c.beginPath(); c.ellipse(0, -3, 15.4, 15.2, 0, 0, 6.3); c.fill(); c.stroke(); }
  // orejas (y arete)
  c.fillStyle = skin; c.lineWidth = 1.8;
  for (const s of [-1, 1]) {
    c.beginPath(); c.arc(s * 13.4, 3.2, 3.3, 0, 6.3); c.fill(); c.stroke();
    if (g) { c.strokeStyle = '#d9dde8'; c.lineWidth = 1.3; c.beginPath(); c.arc(s * 13.9, 7.8, 1.9, 0, 6.3); c.stroke(); c.strokeStyle = ink; c.lineWidth = 1.8; }
  }
  // cara
  c.lineWidth = 2; c.beginPath(); c.ellipse(0, 2, 13.4, 14.2, 0, 0, 6.3); c.fill(); c.stroke();
  if (g) { c.fillStyle = 'rgba(235,120,120,.32)'; for (const s of [-1, 1]) { c.beginPath(); c.ellipse(s * 8.2, 8.2, 3.1, 1.8, 0, 0, 6.3); c.fill(); } }
  // ojos y cejas
  const lk = dir * .8;
  for (const s of [-1, 1]) {
    const ex = s * 5.5 + dir * .5, ey = 1.7, by = g ? -4 : -3.6;
    if (f.blink) { c.strokeStyle = ink; c.lineWidth = 1.8; c.beginPath(); c.moveTo(ex - 3.8, ey + .6); c.quadraticCurveTo(ex, ey + 2.4, ex + 3.8, ey + .6); c.stroke(); }
    else {
      c.fillStyle = '#fff'; c.lineWidth = 1.4; c.strokeStyle = ink; c.beginPath(); c.ellipse(ex, ey, g ? 4.1 : 3.9, g ? 3.9 : 2.9, 0, 0, 6.3); c.fill(); c.stroke();
      c.fillStyle = '#0b0614'; c.beginPath(); c.arc(ex + lk * .6, ey + .2, g ? 2.3 : 1.7, 0, 6.3); c.fill();
      if (g) {
        c.fillStyle = '#fff'; c.beginPath(); c.arc(ex + lk * .6 - .9, ey - .8, .9, 0, 6.3); c.fill();
        c.strokeStyle = ink; c.lineWidth = 1.7; c.beginPath(); c.moveTo(ex - s * 4.2, ey - 1); c.quadraticCurveTo(ex, ey - 5, ex + s * 4.4, ey - 1.4); c.lineTo(ex + s * 6.2, ey - 2.8); c.stroke();   // delineado alado
      } else { c.strokeStyle = ink; c.lineWidth = 1.9; c.beginPath(); c.moveTo(ex - 4.1, ey - .5); c.lineTo(ex + 4.1, ey - .9); c.stroke(); }                                              // párpado pesado
    }
    c.strokeStyle = g ? shade(hair, -.1) : hair; c.lineWidth = g ? 1.5 : 2.5;
    c.beginPath(); c.moveTo(ex - s * 3.9, by + (f.angry ? 1.8 : 0)); c.lineTo(ex + s * 3.9, by + (f.angry ? -.9 : g ? -.8 : .1)); c.stroke();
  }
  // nariz y boca
  c.strokeStyle = 'rgba(110,60,35,.8)'; c.lineWidth = 1.3; c.beginPath(); c.moveTo(-1.2, 6.3); c.quadraticCurveTo(.2, 7.8, 1.6, 6.5); c.stroke();
  if (f.open > .12) { c.fillStyle = '#3a1010'; c.strokeStyle = ink; c.lineWidth = 1.5; c.beginPath(); c.ellipse(0, 10.6, 3.3, 1 + f.open * 3, 0, 0, 6.3); c.fill(); c.stroke(); }
  else if (g) { c.fillStyle = '#e48a86'; c.strokeStyle = '#a84f4b'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-3.4, 10.4); c.quadraticCurveTo(0, 9.4, 3.4, 10.4); c.quadraticCurveTo(0, 13.2, -3.4, 10.4); c.closePath(); c.fill(); c.stroke(); }
  else { c.strokeStyle = ink; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-3.8, 10); c.quadraticCurveTo(0, 12.6, 4.4, 9.6); c.stroke(); }
  // peinado de adelante
  c.fillStyle = hair; c.strokeStyle = ink; c.lineWidth = 1.8; c.beginPath();
  if (g) {                                                          // raya en medio
    c.moveTo(-14.4, 5); c.bezierCurveTo(-18.5, -6, -12, -17.5, 0, -17.8); c.bezierCurveTo(12, -17.5, 18.5, -6, 14.4, 5);
    c.lineTo(11.6, -1); c.bezierCurveTo(8, -8, 3, -10.5, 0, -12); c.bezierCurveTo(-3, -10.5, -8, -8, -11.6, -1);
  } else if (style === 'crop') {                                    // corte al ras con flequillo
    c.moveTo(-14.4, 4); c.bezierCurveTo(-18.5, -8, -12, -17, 0, -17.2); c.bezierCurveTo(12, -17, 18.5, -8, 14.4, 4);
    c.lineTo(11.6, -3.4); c.quadraticCurveTo(0, -9.6, -11.6, -3.4);
  } else {                                                          // copete de picos
    c.moveTo(-14.4, 4); c.quadraticCurveTo(-18.5, -6, -14, -14); c.lineTo(-16.5, -20); c.lineTo(-9.5, -16.8); c.lineTo(-8, -23); c.lineTo(-2.5, -17.8); c.lineTo(1.5, -24.5);
    c.lineTo(5.5, -18.2); c.lineTo(10.5, -22); c.lineTo(11.5, -15.8); c.lineTo(16, -17.5); c.quadraticCurveTo(18.5, -6, 14.4, 4);
    c.lineTo(11.6, -3.6); c.quadraticCurveTo(0, -10.4, -11.6, -3.6);
  }
  c.closePath(); c.fill(); c.stroke();
  c.strokeStyle = 'rgba(255,255,255,.22)'; c.lineWidth = 1.2; c.beginPath(); c.arc(0, -3, 12.5, Math.PI * 1.18, Math.PI * 1.5); c.stroke();      // brillo del pelo
  if (g && style === 'long') { c.strokeStyle = ink; c.fillStyle = hair; c.lineWidth = 1.6; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 14, 0); c.quadraticCurveTo(s * 17, 8, s * 14.5, 16); c.lineTo(s * 12.6, 9); c.quadraticCurveTo(s * 13.4, 4, s * 12.4, -1); c.closePath(); c.fill(); c.stroke(); } }
  c.restore();
}

/*
 * drawLuchador(ctx, x, y, options)
 *   x, y     pies del personaje
 *   options  hoodie  color de la sudadera        mask   clave de MASK_STYLES u objeto de máscara
 *            shoes   clave de SHOES u objeto     state  'idle' | 'walk' | 'eat'
 *            t       tiempo de animación (s)     dir    +1 / -1 hacia dónde mira
 *            seated  sentado                     scale  tamaño
 *            carrying lleva un plato             tacosLeft tacos que quedan (estado 'eat')
 *            angry   enojado                     label  ['LINEA 1', 'LINEA 2'] estampado
 *            pants, skin
 */
function drawLuchador(c, x, y, o) {
  const M = typeof o.mask === 'string' ? MASK_STYLES[o.mask] : o.mask;
  const SH = typeof o.shoes === 'string' ? SHOES[o.shoes] : o.shoes;
  const hood = o.hoodie || '#17171c', pants = o.pants || '#23232b', skin = o.skin || '#e8b98a';
  const state = o.state || 'idle', t = o.t || 0, dir = o.dir || 1, seated = !!o.seated, sc = o.scale || 1;
  const walking = state === 'walk', eating = state === 'eat';

  const step = Math.sin(t * 10);                                   // fase del paso
  const breath = walking ? 0 : Math.sin(t * 2.2) * 1.25;           // respiración (±1.25 → rebote de 2.5 px)
  const bounce = walking ? -Math.abs(step) * 3 : 0;                // rebote del cuerpo en cada paso
  const e = eating ? eatCycle(t) : 0;
  const chew = eating ? Math.sin(t * 16) * (.35 + .65 * e) : 0;    // masticar: más fuerte con el taco en la boca
  let headDy = walking ? -Math.abs(Math.sin(t * 10 + .7)) * 2.4 : breath * .6;   // la cabeza rebota alegre sobre el torso
  let headDx = 0, headRot = walking ? Math.sin(t * 10) * .04 : 0;
  if (eating) { headDy += Math.abs(chew) * 1.9; headDx = dir * Math.abs(chew) * .9; headRot = dir * chew * .05; }
  if (o.angry) headDx += Math.sin(t * 34) * .8;
  const blink = ((clock + x * .011) % 3.7) < .13;

  c.save();
  c.translate(x, y); c.scale(sc, sc);
  if (walking) c.rotate(dir * .05 * Math.sin(t * 5));              // ligera inclinación al caminar
  if (!seated) { c.fillStyle = 'rgba(0,0,0,.24)'; c.beginPath(); c.ellipse(0, 1, 16, 5.5, 0, 0, 6.3); c.fill(); }

  // ---- piernas cortas con tenis anchos (oscilan en oposición) ----
  for (const sg of [-1, 1]) {
    const swing = walking ? (sg < 0 ? step : -step) * .5 : 0;
    const lift = walking ? Math.max(0, sg < 0 ? step : -step) * 3.5 : 0;
    c.save(); c.translate(sg * 8.5, -15 - lift); c.rotate(swing);
    if (!seated) { c.lineJoin = 'round'; c.lineWidth = 1.8; c.strokeStyle = P.ink; c.fillStyle = pants; rr(c, -4.4, -1, 8.8, 9, 3); c.fill(); c.stroke(); }
    c.translate(0, 15); c.rotate(-swing * .7);
    drawShoe(c, sg, SH);
    c.restore();
  }

  // ---- torso ----
  c.save(); c.translate(0, bounce + breath + (seated ? 7 : 0));
  drawHoodieBody(c, hood, o.label);
  if (o.carrying) drawPortionPlate(c, o.carrying === true ? 'pastor' : o.carrying, 0, -27, 1.1, false, 0);

  // brazos (mangas con manos)
  const SX = 13.5, SY = -37, L1 = 8.5, L2 = 8.5;
  let lateArm = null;
  for (const sg of [-1, 1]) {
    let a1, a2, hold = null;
    if (eating && sg === dir) {
      const rest = { x: sg * 15, y: -19 }, mouth = { x: sg * 3, y: -44 };
      const T = { x: lerp(rest.x, mouth.x, e), y: lerp(rest.y, mouth.y, e) };
      [a1, a2] = ik({ x: sg * SX, y: SY }, T, L1, L2, sg);
      const ts = (o.tacosLeft == null ? 3 : o.tacosLeft) / 3;
      if (ts > 0) hold = (cc, ang) => { cc.rotate(-ang); cc.translate(-sg * 1.5, -4); drawDish(cc, o.eatKey || 'pastor', 0, 2, 4.4 + ts * 1.8); };
    } else if (o.carrying) {
      [a1, a2] = ik({ x: sg * SX, y: SY }, { x: sg * 12.5, y: -26 }, L1, L2, sg);
    } else if (o.angry) {
      a1 = -sg * (1.1 + Math.sin(t * 26 + sg) * .12); a2 = sg * 1.15;
    } else if (walking) {
      a1 = -sg * .1 + (sg < 0 ? -step : step) * .6; a2 = sg * .15;
    } else {
      a1 = -sg * (.12 + Math.sin(t * 2.2 + sg * 1.3) * .05); a2 = sg * .1;
    }
    const draw = () => drawSleeve(c, sg * SX, SY, a1, a2, L1, L2, hood, skin, hold);
    if (eating && sg === dir) lateArm = draw; else draw();
  }

  // ---- cabeza: capucha circular + máscara ----
  c.save(); c.translate(headDx, -53.5 + headDy); c.rotate(headRot);
  if (o.tufts) {                                                    // mechones de payaso a los lados de la capucha
    c.lineWidth = 2; c.strokeStyle = P.ink;
    o.tufts.forEach((col, i) => { c.fillStyle = col; for (const sx of [-1, 1]) { c.beginPath(); c.arc(sx * (15 + i * 2), -9 - i * 7, 7.5 - i, 0, 6.3); c.fill(); c.stroke(); } });
  }
  const dk = luma(hood) < 80;
  if (o.casual) {                                                   // gente normal: cara descubierta con su peinado (sin máscara)
    drawCasualHead(c, o, { dir, hood, skin, dk, angry: o.angry, blink, open: eating ? clamp(Math.abs(chew), 0, 1) : 0 });
  } else {
    c.lineJoin = 'round'; c.lineWidth = 2.2; c.strokeStyle = P.ink; c.fillStyle = hood;
    c.beginPath(); c.ellipse(0, 0, 17.4, 16.8, 0, 0, 6.3); c.fill(); c.stroke();
    c.strokeStyle = dk ? 'rgba(255,255,255,.14)' : 'rgba(255,255,255,.4)'; c.lineWidth = 1.4;
    c.beginPath(); c.arc(0, 0, 14.8, Math.PI * 1.12, Math.PI * 1.55); c.stroke();                         // pliegue de la capucha
    c.fillStyle = shade(hood, dk ? .13 : -.32); c.beginPath(); c.ellipse(dir * .8, 1, 14.8, 15, 0, 0, 6.3); c.fill();
    c.lineWidth = 1.2; c.strokeStyle = 'rgba(0,0,0,.35)'; c.stroke();
    drawFace(c, dir * 1.4, 1.6, 11.4, M, { look: dir, angry: o.angry, blink, open: eating ? clamp(Math.abs(chew), 0, 1) : 0 });
  }
  c.restore();

  if (lateArm) lateArm();                                           // el brazo que come pasa por delante de la cara
  c.restore();                                                      // fin torso
  c.restore();                                                      // fin raíz
}

/* =========================================================
   JUEGO: MUNDO Y REGLAS
   ========================================================= */
const Game = {
  w: null,
  slot: 0,                                                          // ranura (1–3) donde se guarda la partida en curso; 0 = ninguna
  autoT: 0,                                                         // el progreso se guarda solo cada 15 segundos
  newGame(save, slot) { this.w = createWorld(save); this.slot = slot || 0; this.autoT = 0; if (this.slot && !save) this.save(); },
  save() {
    const w = this.w; if (!w || !this.slot) return;
    const held = w.edit && w.edit.held ? [w.edit.held.it] : [];
    const midDay = w.phase === 'play', pocket = w.coins.reduce((s, co) => s + co.v, 0);   // las monedas sin cobrar también cuentan
    const grab = it => ({ type: it.type, c: it.c, r: it.r, rot: it.rot || 0, slot: it.slot ? { state: it.slot.state, dish: it.slot.dish, t: it.slot.t } : undefined,
      slots: it.slots ? it.slots.map(s => ({ state: s.state, dish: s.dish, t: s.t })) : undefined });
    Store.write(Store.key(this.slot), { v: 9, at: Date.now(), gems: w.gems, tut: w.tut ? w.tut.s : null, day: w.phase === 'summary' ? w.day + 1 : w.day, money: w.money + pocket, rep: w.rep, totalServed: w.totalServed, stock: w.stock, level: w.level, xp: w.xp,
      furn: w.furn.map(grab), inv: w.inv.concat(held).map(f => f.type), invCap: w.invCap, staff: w.staff.map(m => m.id), deco: w.deco,
      resume: midDay ? { dayTime: w.dayTime, dayServed: w.dayServed, dayEarned: w.dayEarned, dayCost: w.dayCost, dayAngry: w.dayAngry, repTemp: w.repTemp, vips: w.vips,
        stam: w.novato.stamina, staffStam: w.staff.map(m => m.stamina) } : null });
  },
  update(dt) {
    const w = this.w;
    if (this.slot && (this.autoT += dt) >= 15) { this.autoT = 0; this.save(); }
    if (w.tut) tutorialUpdate(w);
    if (w.shop || w.edit || (w.tut && (TUT[w.tut.s] === 'intro' || TUT[w.tut.s] === 'outro'))) {   // la tienda, el modo edición y las ventanas del tutorial pausan el juego                                        // la tienda y el modo edición pausan el juego
      w.t += dt; w.shownMoney += (w.money - w.shownMoney) * Math.min(1, dt * 6);
      if (w.moneyFlash > 0) w.moneyFlash -= dt;
      w.toasts.forEach(t => t.t -= dt); w.toasts = w.toasts.filter(t => t.t > 0);
      return;
    }
    updateWorld(w, dt);
  },
  draw(c) { drawWorld(c, this.w); },
  pointerDown(x, y) { worldPointer(this.w, x, y); },
  pointerMove(x, y) { if (this.w.edit) editHover(this.w, x, y); },
  pointerUp() {},
  rightClick() { const w = this.w; if (w.edit && w.edit.held) editCancel(w); },
  key(e) {
    const w = this.w;
    if ((e.key === 'r' || e.key === 'R' || e.code === 'KeyR') && w.edit && w.phase === 'play') { if (!e.repeat) editRotate(w); return true; }      // girar el mueble en modo EDITAR (también con otras distribuciones de teclado)
    if (e.key !== 'Escape') return false;
    sfx('click');
    if (w.edit) { if (w.edit.held) editCancel(w); else exitEdit(w); }
    else if (w.shop) w.shop = false; else if (w.panel) w.panel = false; else setState('AJUSTES', { from: 'JUGANDO' });
    return true;
  }
};

function createWorld(save) {
  const money = save ? save.money : START_MONEY;
  const w = {
    t: 0, day: save ? save.day : 1, money, shownMoney: money, moneyFlash: 0,
    rep: save ? clamp(save.rep, 0, 5) : 1, repTemp: 0, vips: [], staff: [], shopView: 'main', shopTab: 'furn', decCat: 'floor', decPage: 0, totalServed: save ? (save.totalServed || 0) : 0,
    stock: MENU.reduce((o, k) => (o[k] = save && save.stock && save.stock[k] || 0, o), {}),   // porciones listas en la barra
    level: save && save.level ? save.level : 1, xp: save && save.xp ? save.xp : 0, levelFlash: 0, shake: 0, fx: [],
    shop: false, edit: null, bench: [null, null], panelIdx: 0, furn: [], inv: [], invCap: INV_BASE, slots: [], dslots: [],
    panel: false, doorA: 0, doorV: 0, doorOpen: false, toasts: [], btns: [], overlay: []
  };
  w.novato = { x: 2.5, y: 2.5, dir: 1, phase: 0, path: [], speed: 3.2, moving: false, carrying: null, task: null,
    stamina: 100, resting: false, furia: false, busy: false, overwork: 0, zeroWarned: false };
  const sd = save && save.deco, legacy = !!save && !(sd && sd.dv);          // una partida de antes de la decoración por niveles conserva todo lo que ya se veía
  const legOwn = legacy ? { felpudo: true, menu: true, p_camp: true, neon: true, alfombra: true, p_copa: !!(sd && sd.remodeled) } : {};
  w.deco = Object.assign({ remodeled: false, arena: false, paint: legacy ? 'ocre' : 'cal', awning: '', floor: legacy ? 'damero' : 'cemento', bunting: legacy ? 'papel' : 'none',
    paintBonus: false, awningBonus: false }, sd, {
    paints: Object.assign({ cal: true }, sd && sd.paints), awnings: Object.assign({ '': true }, sd && sd.awnings),
    floors: Object.assign({ cemento: true }, legacy ? { damero: true } : {}, sd && sd.floors), buntings: Object.assign({ none: true }, legacy ? { papel: true } : {}, sd && sd.buntings),
    own: Object.assign({}, legOwn, sd && sd.own), on: Object.assign({}, legOwn, sd && sd.on), dv: 2 });
  w.gems = save && save.gems ? save.gems : 0; w.gemsSeen = w.gems > 0;
  w.tut = save ? (Number.isInteger(save.tut) ? { s: save.tut } : null) : { s: 0 };                // tutorial: solo en partida nueva (y se retoma si se guardó a medias)
  DECO = w.deco; applyRemodel(w.deco.remodeled);                                                // el local se ensancha si ya se remodeló
  loadLayout(w, save);                                                                           // mobiliario colocado e inventario
  const hired = save ? (Array.isArray(save.staff) ? save.staff : save.waiter ? ['waiter1'] : []).filter(id => STAFF[id]) : [];
  w.staff = hired.map(id => makeStaff(id, false));
  startDay(w, save && save.resume);
  const hb = (label, x, wd, style, fn) => ({ label, x, y: 10, w: wd, h: 40, size: 15, style, fn });          // botones altos: más fáciles de tocar en celular
  w.btns = [
    hb('EDITAR', 686, 60, 'teal', () => { sfx('click'); enterEdit(w); }),
    hb('TIENDA', 752, 58, 'gold', () => { sfx('click'); w.panel = false; w.shop = true; w.shopView = 'main'; }),
    hb('AJUSTES', 816, 68, 'violet', () => { sfx('click'); setState('AJUSTES', { from: 'JUGANDO' }); }),
    hb('MENÚ', 890, 56, 'dark', () => { Game.save(); sfx('back'); setState('MENU'); })
  ];
  w.banner = (save && save.resume) || w.tut ? 0 : save ? 2.8 : 3.4;
  if (save && save.resume) toast(w, `Partida cargada: seguimos en el día ${w.day}, ${fmtHour(hourOf(w))}`);
  return w;
}

function loadLayout(w, save) {
  const ok = o => o && FURN[o.type];
  if (save && Array.isArray(save.furn)) {                                  // partida con mobiliario guardado
    w.furn = save.furn.filter(ok).map(o => {
      const it = makeFurn(o.type, o.c, o.r, o.rot);
      if (it.type === 'table') placeSeats(it);
      if (it.slot && o.slot && (o.slot.state === 'cook' ? RECIPES[o.slot.dish] : true)) Object.assign(it.slot, o.slot);      // la tanda que se estaba cocinando sigue en el fuego
      if (it.slots && Array.isArray(o.slots)) it.slots.forEach((s, i) => { const q = o.slots[i]; if (q && (q.state !== 'cook' || RECIPES[q.dish])) Object.assign(s, q); });
      return it;
    });
    w.inv = (save.inv || []).filter(t => FURN[t]).map(t => makeFurn(t));
    w.invCap = clamp(Math.max(save.invCap || INV_BASE, w.inv.length), INV_BASE, 99);
  } else {                                                                 // partida nueva (local pelón) o de una versión muy vieja (local completo)
    w.furn = save ? defaultFurn() : starterFurn(); w.inv = []; w.invCap = INV_BASE;
    if (save && save.comal2) w.inv.push(makeFurn('comal'));                // lo ya comprado pasa al inventario
    for (let i = 2; i < (save && save.tables || 2); i++) w.inv.push(makeFurn('table'));
  }
  rebuildLayout(w);
}
// Reloj del día: abre a las 8:00 AM y cierra a las 8:00 PM
const hourOf = w => START_H + (END_H - START_H) * (1 - clamp(w.dayTime / w.dayLen, 0, 1));
function fmtHour(h) {
  const hh = Math.floor(h), mm = Math.floor((h - hh) * 60 / 5) * 5, ap = hh >= 12 ? 'PM' : 'AM', h12 = ((hh + 11) % 12) + 1;
  return `${h12}:${String(mm).padStart(2, '0')} ${ap}`;
}
// ¿Cumple el local las condiciones para recibir a este VIP? (reputación de 2 máscaras o más y la mejora que pide)
const vipEligible = (w, def = VIPS.payaso) => def.need(w) && effRep(w) >= VIP_MIN_MASKS;
// Planea qué VIPs visitan hoy (cada uno llega a una hora al azar si se cumplen sus requisitos); sirve al abrir el día y al comprar una mejora
function planVips(w, fromHour) {
  Object.values(VIPS).forEach(def => {
    if (w.vips.some(v => v.k === def.key) || !vipEligible(w, def) || Math.random() >= def.chance) return;
    const lo = Math.max(def.win[0], fromHour + .5);
    if (lo < def.win[1]) w.vips.push({ k: def.key, at: rand(lo, def.win[1]), done: false });
  });
}
function planGemmer(w) {                                          // 30 % de que hoy llegue alguien que regala gemas (con tutorial en curso, no)
  if (w.level < GEM_LEVEL || w.tut || Math.random() >= GEM_CHANCE) return;
  w.vips.push({ k: pick(Object.keys(GEMMERS)), at: rand(10, 17.5), done: false });
}
function startDay(w, rs) {
  w.phase = 'play';
  w.dayLen = DAY_SEC;
  w.dayTime = w.dayLen; w.closedWarned = false; w.edit = null; w.repTemp = 0;
  w.vips = []; if (!rs) { planVips(w, START_H); planGemmer(w); }
  w.furn.forEach(it => { if (it.type === 'table') { it.down = 0; it.downT = 0; } });
  w.dayServed = 0; w.dayEarned = 0; w.dayCost = 0; w.dayAngry = 0; w.perfect = false; w.loanT = 0;
  w.spawnT = 1.5; w.endT = 0; w.overT = 0; w.banner = 2.6; w.panel = false;
  w.customers = []; w.coins = []; w.parts = [];
  if (!rs) allSlots(w).forEach(s => { s.state = 'empty'; s.dish = null; s.t = 0; });    // al cargar a media jornada, lo que estaba en el fuego sigue ahí
  SEATS.forEach(s => { s.customer = null; });
  const n = w.novato; n.carrying = null; n.task = null; n.path = [];
  n.stamina = maxStamina(w); n.resting = false; n.furia = false; n.busy = false; n.overwork = 0; n.zeroWarned = false;   // amanece descansado
  w.bench = [null, null]; w.shop = false;
  const ns = nearestFree(2.5, 2.5); n.x = ns.x; n.y = ns.y;                  // cada mañana empiezan en una loseta libre
  w.staff.forEach((m, i) => { const ws = nearestFree(6.5 + i * .8, 1.5 + (i % 2)); Object.assign(m, { x: ws.x, y: ws.y, carrying: null, task: null, path: [], stamina: 100, resting: false, needsRest: false, entering: false, think: 1 + i * .3, stun: 0 }); });
  w.fx = [];
  w.overlay = [];
  if (rs) {                                                                  // reanuda la jornada donde se guardó
    w.dayTime = clamp(rs.dayTime, 1, w.dayLen); w.dayServed = rs.dayServed || 0; w.dayEarned = rs.dayEarned || 0; w.dayCost = rs.dayCost || 0; w.dayAngry = rs.dayAngry || 0;
    w.repTemp = rs.repTemp || 0; w.vips = Array.isArray(rs.vips) ? rs.vips.filter(v => VIPS[v.k] || GEMMERS[v.k]) : [];
    if (Number.isFinite(rs.stam)) n.stamina = clamp(rs.stam, 0, maxStamina(w));
    w.staff.forEach((m, i) => { if (rs.staffStam && Number.isFinite(rs.staffStam[i])) m.stamina = clamp(rs.staffStam[i], 0, 100); });
    w.spawnT = 2;
  }
}

function nearestFree(x, y) {                                    // loseta libre más cercana al punto (x, y), sin contar la entrada
  let best = { c: 5, r: 1 }, bd = 1e9;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (!Grid.free(c, r) || (c === DOOR.cells[0].c && r === DOOR.cells[0].r)) continue;
    const d = Math.abs(c + .5 - x) + Math.abs(r + .5 - y);
    if (d < bd) { bd = d; best = { c, r }; }
  }
  return Grid.pt(best.c, best.r);
}
function makeStaff(id, entering, slotIdx = 0) {                // personal contratado: atiende solo y tiene su propia estamina
  const d = STAFF[id];
  const m = { id, isWaiter: true, tag: d.tag, look: d.look, drain: d.drain, x: 6.5, y: 1.5, dir: -1, phase: 0, path: [], speed: d.speed, moving: false, carrying: null, task: null,
    stamina: 100, resting: false, needsRest: false, entering: false, think: 1, stun: 0 };
  if (entering) {                                              // llega por la banqueta y cruza la puerta
    m.x = SPAWN_X; m.y = SIDE_Y; m.entering = true;
    m.path = [{ x: DOOR.ix, y: SIDE_Y }, { x: DOOR.ix, y: -.3 }, Grid.pt(5, 0)];
    const spot = nearestFree(6.5 + slotIdx * .8, 1.5), cells = Grid.path({ c: 5, r: 0 }, [{ c: Math.floor(spot.x), r: Math.floor(spot.y) }]) || [];
    cells.forEach(n => m.path.push(Grid.pt(n.c, n.r)));
  }
  return m;
}
function toast(w, msg) { w.toasts = [{ msg, t: 2.6 }]; }
function addPart(w, p) { w.parts.push(Object.assign({ life: 1, max: 1, x: 0, y: 0, vx: 0, vy: 0 }, p, p.life ? { max: p.life } : {})); }

// posición en pantalla de un actor (sentado: la cadera queda sobre el asiento)
const actorPos = (e, seated) => { const p = S(e.x, e.y); if (seated) p.y -= 7; return p; };

/* ---------- Experiencia, cansancio y modo rudo rabioso ---------- */
const maxStamina = (w, n = w.novato) => n.isWaiter ? 100 : STAM.base + STAM.perLevel * (w.level - 1);
function addXp(w, amt) {
  w.xp += amt;
  while (w.xp >= xpNeed(w.level)) {
    w.xp -= xpNeed(w.level); w.level++; w.levelFlash = 1.6;
    const n = w.novato; n.stamina = Math.min(maxStamina(w), n.stamina + 30); n.zeroWarned = false;     // sube el máximo y recupera un poco
    const unlocked = MENU.filter(k => RECIPES[k].level === w.level && w.level > 1).map(k => RECIPES[k].name);
    const hire = STAFF_IDS.filter(id => STAFF[id].level === w.level).map(id => STAFF[id].name);
    const extra = hire.length ? ` ¡Ya puedes contratar: ${hire.join(' y ')}!` : unlocked.length ? ` Nuevo platillo: ${unlocked.join(' y ')}`
      : w.level === 2 ? ' ¡Ya puedes DECORAR el changarro desde la TIENDA!' : w.level === 5 ? ' ¡La cajita se puede ampliar en la TIENDA!'
      : w.level === REMODEL.level ? ' ¡Ya puedes remodelar el changarro!' : w.level === ARENA.level ? ' ¡Ya puedes construir la Arena!' : '';
    toast(w, `¡Nivel ${w.level}!${extra}`); sfx('fanfare');
    const p = actorPos(n, n.resting);
    addPart(w, { type: 'text', text: `¡NIVEL ${w.level}!`, x: p.x, y: p.y - 112, vy: -30, life: 1.8, color: '#9af0b8' });
  }
}
function spend(w, amt, n = w.novato) {                          // gasta estamina; el jugador con 0 y sin descansar acaba en furia; el mesero se va a descansar
  if (n.resting || n.busy) return;
  const mine = n === w.novato;
  amt *= n.drain || 1;                                              // el Demonio Añil casi no se cansa
  if (n.stamina > 0) {
    n.stamina = Math.max(0, n.stamina - amt);
    if (n.stamina === 0) {
      if (!mine) n.needsRest = true;
      else if (!n.zeroWarned) { n.zeroWarned = true; n.overwork = 0; sfx('nope'); toast(w, '¡El Novato se quedó sin energía! Tócalo para que tome suero'); }
    }
  } else if (mine && !n.furia) {
    n.overwork += amt;
    if (n.overwork >= STAM.fury) startFury(w);
  }
}
function releaseBench(w, n) { w.bench = w.bench.map(b => b === n ? null : b); }
function standUp(w, n) { n.resting = false; releaseBench(w, n); const ex = benchExit(); n.path = ex ? [ex] : []; }
function startFury(w) {
  const n = w.novato; n.furia = true; sfx('rage');
  const p = actorPos(n);
  addPart(w, { type: 'text', text: '¡RABIOSO!', x: p.x, y: p.y - 112, vy: -26, life: 1.6, color: '#ff6b6b' });
  toast(w, '¡El Novato está rabioso! Tócalo para calmarlo o aplicará una quebradora');
}
function restClick(w) {
  const n = w.novato;
  if (n.busy) return;
  if (n.resting) { sfx('click'); standUp(w, n); toast(w, 'El Novato vuelve al trabajo'); return; }
  if (n.stamina >= maxStamina(w) * .97 && !n.furia) { sfx('nope'); toast(w, 'El Novato todavía tiene energía'); return; }
  sfx('click'); setTask(w, { type: 'rest' });
}
function startSlam(w, cu) {                                    // ¡QUEBRADORA!: en vez de servir, levanta al cliente y lo azota
  const n = w.novato, seat = cu.seat;
  n.busy = true; n.carrying = null; n.path = []; n.task = null; n.moving = false;
  n.dir = ((cu.x - n.x) - (cu.y - n.y)) >= 0 ? 1 : -1;
  cu.startPos = actorPos(cu, true);
  cu.state = 'slam'; cu.slamT = 0; cu.seated = false; cu.moving = false; cu.angry = true; cu.served = []; cu.impact = false;
  seat.customer = null; cu.seat = null;                        // la mesa queda libre y la comida se pierde
  sfx('rage');
}
function slamPos(w, cu) {                                      // posición en pantalla y giro del cliente durante la quebradora
  const np = actorPos(w.novato), T = cu.slamT, d = w.novato.dir;
  const hold = { x: np.x, y: np.y - 64 }, ground = { x: np.x + d * 30, y: np.y + 3 };
  if (T < .5) { const e = smooth(T / .5); return { x: lerp(cu.startPos.x, hold.x, e), y: lerp(cu.startPos.y, hold.y, e) - Math.sin(e * Math.PI) * 14, rot: 0, air: true }; }
  if (T < .8) return { x: hold.x + Math.sin(T * 60) * 2, y: hold.y + Math.sin(T * 40) * 1.5, rot: Math.sin(T * 30) * .25, air: true };
  if (T < 1) { const e = ((T - .8) / .2) ** 2; return { x: lerp(hold.x, ground.x, e), y: lerp(hold.y, ground.y, e), rot: e * d * 1.5, air: true }; }
  return { x: ground.x, y: ground.y, rot: d * 1.5, air: false };
}

/* ---------- Pedidos: un platillo al azar y, a veces, una michelada para acompañar ---------- */
// ¿Se puede preparar esto con lo que hay en el local? (la comida pide comal; las micheladas, refri)
const canMake = k => RECIPES[k].drink ? !!LAYOUT.fridge : LAYOUT.comals.length > 0;
function makeOrder(w) {
  if (w.tut) return [{ key: 'pastor', done: false }];                                  // en el tutorial todos piden el taco que acabas de aprender a cocinar
  const menu = MENU.filter(k => RECIPES[k].level <= w.level && canMake(k)), main = pick(menu), items = [{ key: main, done: false }];   // solo piden lo que ya está desbloqueado y se puede cocinar
  if (main !== 'michelada' && canMake('michelada') && Math.random() < .25) items.push({ key: 'michelada', done: false });
  return items;
}
const slotsOf = (w, station) => station === 'fridge' ? w.dslots : w.slots;
const allSlots = w => w.slots.concat(w.dslots);
const pending = cu => cu.order.filter(i => !i.done);
const orderTotal = cu => cu.order.reduce((s, i) => s + RECIPES[i.key].price, 0);
const stockTotal = w => MENU.reduce((s, k) => s + w.stock[k], 0);

/* ---------- Clientes: calle → banqueta → puerta → mesa → puerta → banqueta → desvanecer ---------- */
const effRep = w => Math.max(0, w.rep - w.repTemp);               // máscaras que se ven (la reputación menos el castigo temporal)
function spawnCustomer(w, vip = null, gem = null) {               // vip = definición de VIPS o null · gem = personaje que regala gemas
  if (!LAYOUT.comals.length && !LAYOUT.fridge) return false;                // sin nada que cocinar no llega nadie
  let free = SEATS.filter(s => !s.customer && !(s.tb.down > 0));            // sin las mesas volcadas
  if (vip) { const alone = free.filter(s => s.tb.seats.every(x => !x.customer)); if (alone.length) free = alone; }   // el VIP prefiere una mesa para él solo
  if (!free.length) return false;
  const seat = pick(free);
  const entry = DOOR.cells[0];
  const cells = Grid.path(entry, [{ c: seat.c, r: seat.r }]);
  if (!cells) return false;
  const pts = [
    { x: DOOR.ix, y: SIDE_Y },                       // gira hacia la puerta desde la banqueta
    { x: DOOR.ix, y: -.3 },                          // marco de la puerta
    Grid.pt(entry.c, entry.r),                       // primera loseta del local
    ...cells.map(n => Grid.pt(n.c, n.r))
  ];
  pts[pts.length - 1] = { x: seat.gx, y: seat.gy };
  const pmax = vip ? vip.patience : gem ? gem.patience : Math.max(24, 42 - (w.day - 1) * 3);
  const cu = {
    x: SPAWN_X, y: SIDE_Y, path: pts, speed: vip ? vip.speed : gem ? gem.speed : rand(1.6, 2.0), dir: -1, phase: rand(0, 6), moving: true, alpha: 1,
    state: 'enter', seat, look: vip ? VIP_LOOKS[vip.key] : gem ? gem.look : randomLook(), off: rand(0, 6), seated: false, patience: pmax, pmax, timer: 0, bubbleT: 0, eatT: 0, angry: false,
    order: vip ? vip.combo.map(k => ({ key: k, done: false })) : makeOrder(w), served: [], freeze: 0, vip: !!vip, vd: vip, gd: gem, z: 0, spin: 0
  };
  seat.customer = cu;
  w.customers.push(cu);
  return true;
}
const VIP_LOOKS = {
  payaso:  { hoodie: '#1a1a1f', mask: 'payaso', shoes: 'rojo', skin: '#f0d9b8', label: ['PAYASO', 'MANIÁTICO'], tufts: ['#8b5cf6', '#2fbf71'] },
  mistico: { hoodie: '#f4f1e8', mask: 'mistico', shoes: 'azul', skin: '#e0ac69', label: ['MÍSTICO', 'VOLADOR'] },
  anil:    { hoodie: '#241c6b', mask: 'anil', shoes: 'rojo', skin: '#8d5524', label: ['DEMONIO', 'AÑIL'] }
};
function spawnVip(w, def = VIPS.payaso) {                       // ¡DONG! llega un VIP
  if (!spawnCustomer(w, def)) return false;
  sfx('bell');
  w.fx.push({ type: 'dong', t: 0, life: 1.9 });
  toast(w, `¡DONG! Llegó ${def.name}: ${def.intro}`);
  return true;
}
function spawnGemmer(w, def) {                                  // llega un visitante que trae gemas
  if (!spawnCustomer(w, null, def)) return false;
  sfx('ready');
  toast(w, `¡Llegó ${def.name}! Atiéndelo bien y te deja gemas`);
  return true;
}
const VIP_SHOUT = { payaso: '¡ME HICIERON ESPERAR!', mistico: '¡HORA DEL VUELO!', anil: '¡NADIE ME HACE ESPERAR!' };
/* Castigo del VIP al perder la paciencia (cada uno el suyo) y se va sin pagar:
   payaso: voltea la mesa y da un sillazo · místico: vuelo suicida que tira 2 mesas · añil: llave de sumisión al encargado */
function startVipRage(w, cu) {
  const seat = cu.seat, p = actorPos(cu, true);
  cu.state = 'rage'; cu.rage = { stage: 0, t: 0, tb: seat.tb, target: null, kind: cu.vd.key }; cu.seated = false; cu.angry = true; cu.moving = false;
  cu.x = seat.gx; cu.y = seat.gy; cu.served = []; cu.dir = seat.dir;
  seat.customer = null; cu.seat = null;
  sfx('rage');
  addPart(w, { type: 'text', text: VIP_SHOUT[cu.vd.key], x: p.x, y: p.y - 100, vy: -24, life: 1.8, color: '#ff6b6b' });
}
function nearestWorker(w, cu) {
  const list = [w.novato].concat(w.staff.filter(m => !m.entering)).filter(m => !m.resting);
  return list.sort((a, b) => Math.hypot(a.x - cu.x, a.y - cu.y) - Math.hypot(b.x - cu.x, b.y - cu.y))[0] || null;
}
function tableCrash(w, tb, big) {                                // la mesa sale volando: los de la mesa huyen y la comida se pierde
  tb.down = 22; tb.downT = 0;
  const pl = tb.seats.map(s => s.plate);
  for (const s of tb.seats) if (s.customer) { const o = s.customer, op = actorPos(o, true); addPart(w, { type: 'text', text: '¡Aaah!', x: op.x, y: op.y - 90, vy: -30, life: 1.2, color: '#ffd0d0' }); leaveSeat(w, o, true); }
  for (const q of pl) for (let k = 0; k < 7; k++) addPart(w, { type: 'crumb', x: q.x, y: q.y, vx: rand(-80, 80), vy: -rand(80, 160), gy: q.y + rand(0, 16), life: 1.8, col: pick(['#e8c36a', '#c4492a', '#3fb04f', '#fff4e6']) });
  w.shake = big ? .6 : .45; sfx('pum');
  const m = tableMid(tb), mp = S(m[0], m[1]);
  addPart(w, { type: 'text', text: '¡MESA VOLADA!', x: mp.x, y: mp.y - 60, vy: -28, life: 1.6, color: '#ffd23a' });
}
function updateVipRage(w, cu, dt) {
  const k = cu.rage.kind;
  if (k === 'mistico') updateMisticoRage(w, cu, dt); else if (k === 'anil') updateAnilRage(w, cu, dt); else updatePayasoRage(w, cu, dt);
}
function leaveUnpaid(w, cu) {                                    // sale corriendo por la puerta sin pagar
  cu.speed = 3.8; cu.noPay = true; cu.state = 'leave'; cu.moving = true; cu.dazed = false; cu.z = 0; cu.spin = 0;
  const cells = Grid.path(Grid.cell(cu.x, cu.y), DOOR.cells) || [];
  cu.path = cells.map(n => Grid.pt(n.c, n.r)).concat([{ x: DOOR.ix, y: -.3 }, { x: DOOR.ix, y: SIDE_Y }, { x: EXIT_X, y: SIDE_Y }]);
}
function updateMisticoRage(w, cu, dt) {                          // ¡VUELO SUICIDA!: salta de mesa en mesa y las tira
  const R = cu.rage; R.t += dt;
  if (R.stage === 0) {                                           // sube de un brinco a la silla y se prepara
    cu.z = Math.min(30, R.t * 60) + Math.sin(R.t * 30) * 2;
    if (R.t >= .9) {
      R.targets = LAYOUT.tables.filter(t => !(t.down > 0)).sort((a, b) => Math.hypot(a.c - cu.x, a.r - cu.y) - Math.hypot(b.c - cu.x, b.r - cu.y)).slice(0, 2);
      R.leg = 0; R.t = 0; R.stage = R.targets.length ? 1 : 2;
      if (R.targets.length) { R.from = { x: cu.x, y: cu.y, z: cu.z }; const m = tableMid(R.targets[0]); R.to = { x: m[0], y: m[1] }; sfx('rage'); }
    }
  } else if (R.stage === 1) {                                    // en el aire: arco con maroma
    const T = .85, f = clamp(R.t / T, 0, 1);
    cu.x = lerp(R.from.x, R.to.x, f); cu.y = lerp(R.from.y, R.to.y, f);
    cu.z = lerp(R.from.z, 8, f) + Math.sin(f * Math.PI) * 78; cu.spin = f * 6.283 * cu.dir; cu.moving = false;
    if (f >= 1) {
      tableCrash(w, R.targets[R.leg], true); cu.spin = 0;
      R.leg++;
      if (R.leg < R.targets.length) { R.t = 0; R.from = { x: cu.x, y: cu.y, z: 8 }; const m = tableMid(R.targets[R.leg]); R.to = { x: m[0], y: m[1] }; }
      else { R.stage = 2; R.t = 0; }
    }
  } else if (R.stage === 2 && !R.hit) {                          // aplastado: pierdes media mascara un rato
    R.hit = true; cu.z = 0; cu.spin = 1.45 * cu.dir; cu.dazed = true;
    const p = actorPos(cu);
    w.fx.push({ type: 'vuelo', x: p.x, y: p.y - 116, t: 0, life: 1.8 });
    w.repTemp += 1; w.dayAngry += 1; w.shake = .55;
    toast(w, `¡CRASH! ${R.targets.length > 1 ? 'Tiró 2 mesas' : 'Tiró una mesa'}, pierdes 1 máscara un rato y se va sin pagar`);
  } else if (R.stage === 2 && R.t > 1.6) { leaveUnpaid(w, cu); cu.dazed = true; }
}
function updateAnilRage(w, cu, dt) {                             // llave de sumisión al encargado (el Novato del jugador)
  const R = cu.rage; R.t += dt;
  if (R.stage === 0 && R.t >= 1) {                               // ruge y va directo por el encargado
    const m = w.novato, here = Grid.cell(cu.x, cu.y), mc = Grid.cell(m.x, m.y);
    const goals = DIRS.map(([dc, dr]) => ({ c: mc.c + dc, r: mc.r + dr })).filter(g => Grid.free(g.c, g.r));
    const cells = goals.length ? Grid.path(here, goals) : null;
    cu.path = cells ? cells.map(n => Grid.pt(n.c, n.r)) : [];
    cu.speed = 3.4; cu.moving = cu.path.length > 0; R.target = m; R.stage = 2; R.t = 0;
  } else if (R.stage === 2) {
    const done = step(cu, dt);
    if (done || R.t > 6) { R.stage = 3; R.t = 0; cu.moving = false; }
  } else if (R.stage === 3 && !R.hit) {                          // ¡LLAVE!
    R.hit = true;
    const m = R.target, np = m ? actorPos(m, m.resting) : actorPos(cu);
    if (m) {
      m.stun = 7; m.stunMax = 7; m.path = []; m.task = null; m.moving = false; m.busy = false;
      if (m.carrying) { w.stock[m.carrying]++; m.carrying = null; }
      m.stamina = Math.max(0, m.stamina - 40);
      cu.dir = ((m.x - cu.x) - (m.y - cu.y)) >= 0 ? 1 : -1; m.dir = -cu.dir;
    }
    w.fx.push({ type: 'llave', x: np.x, y: np.y - 116, t: 0, life: 1.9 });
    w.shake = .5; sfx('pum');
    for (let q = 0; q < 9; q++) addPart(w, { type: 'steam', x: np.x + rand(-14, 14), y: np.y + rand(-2, 6), vx: rand(-40, 40), vy: -rand(8, 30), life: rand(.5, .9) });
    w.repTemp += 1; w.dayAngry += 1;
    toast(w, '¡LLAVE DE SUMISIÓN! El encargado queda fuera de combate 7 s, pierdes 1 máscara un rato y se va sin pagar');
  } else if (R.stage === 3 && R.t > 3) leaveUnpaid(w, cu);
}
function updatePayasoRage(w, cu, dt) {
  const R = cu.rage; R.t += dt;
  if (R.stage === 0 && R.t >= .9) {                              // se para con furia y voltea la mesa
    tableCrash(w, R.tb, false);
    R.stage = 1; R.t = 0;
  } else if (R.stage === 1 && R.t >= .6) {                       // agarra una silla y va por el mesero más cercano
    const m = nearestWorker(w, cu);
    R.target = m;
    const here = Grid.cell(cu.x, cu.y);
    const goals = m ? DIRS.map(([dc, dr]) => ({ c: Grid.cell(m.x, m.y).c + dc, r: Grid.cell(m.x, m.y).r + dr })).filter(g => Grid.free(g.c, g.r)) : [];
    const cells = goals.length ? Grid.path(here, goals) : null;
    cu.path = cells ? cells.map(n => Grid.pt(n.c, n.r)) : [];
    cu.speed = 3.8; cu.moving = cu.path.length > 0;
    R.stage = 2; R.t = 0;
  } else if (R.stage === 2) {
    const done = step(cu, dt);
    if (done || R.t > 5) { R.stage = 3; R.t = 0; cu.moving = false; }
  } else if (R.stage === 3 && !R.hit) {                          // ¡SILLAZO DE LUCHA!
    R.hit = true;
    const m = R.target, np = m ? actorPos(m, m.resting) : actorPos(cu);
    if (m) {
      m.stun = 3.4; m.stunMax = 3.4; m.path = []; m.task = null; m.moving = false;
      if (m.carrying) { w.stock[m.carrying]++; m.carrying = null; }
      m.stamina = Math.max(0, m.stamina - 30);
      cu.dir = ((m.x - cu.x) - (m.y - cu.y)) >= 0 ? 1 : -1; m.dir = -cu.dir;
    }
    w.fx.push({ type: 'sillazo', x: np.x, y: np.y - 116, t: 0, life: 1.7 });
    w.shake = .55; sfx('pum');
    for (let k = 0; k < 9; k++) addPart(w, { type: 'steam', x: np.x + rand(-14, 14), y: np.y + rand(-2, 6), vx: rand(-40, 40), vy: -rand(8, 30), life: rand(.5, .9) });
    w.repTemp += 1; w.dayAngry += 1;                              // pierdes una máscara de reputación por un rato
    toast(w, '¡SILLAZO! Pierdes 1 máscara un rato y el VIP se va sin pagar');
  } else if (R.stage === 3 && R.t > .8) leaveUnpaid(w, cu);      // se va corriendo por la puerta sin pagar
}

function leaveSeat(w, cu, angry) {
  const seat = cu.seat;
  cu.state = 'leave'; cu.seated = false; cu.angry = angry; cu.speed = angry ? 2.7 : 1.9; cu.moving = true;
  const cells = Grid.path({ c: seat.c, r: seat.r }, DOOR.cells) || [];
  const pts = cells.map(n => Grid.pt(n.c, n.r));
  pts.push({ x: DOOR.ix, y: -.3 }, { x: DOOR.ix, y: SIDE_Y }, { x: EXIT_X, y: SIDE_Y });   // puerta → banqueta → se aleja
  cu.path = pts;
  seat.customer = null; cu.seat = null;
}

function updateCustomer(w, cu, dt) {
  switch (cu.state) {
    case 'enter':
      if (step(cu, dt)) { cu.state = 'sit'; cu.timer = .6; cu.seated = true; cu.moving = false; cu.dir = cu.seat.dir; }
      break;
    case 'sit':
      cu.timer -= dt;
      if (cu.timer <= 0) {
        cu.state = 'wait'; cu.bubbleT = 0; sfx('bubble');
        if (cu.order.some(i => i.key === 'michelada')) {          // la michelada los entretiene: la espera se congela un rato
          cu.freeze = FREEZE_TIME;
          const p = actorPos(cu, true);
          addPart(w, { type: 'text', text: '¡Espera congelada!', x: p.x, y: p.y - 112, vy: -22, life: 1.7, color: '#9be3ff' });
        }
      }
      break;
    case 'wait':
      cu.bubbleT += dt;
      if (cu.freeze > 0) cu.freeze = Math.max(0, cu.freeze - dt); else if (!w.tut) cu.patience -= dt;       // durante el tutorial nadie se desespera
      if (cu.patience <= 0 && cu.vip) startVipRage(w, cu);                       // el VIP no se va callado: ¡sillazo!
      else if (cu.patience <= 0) {
        const p = actorPos(cu, true);
        addPart(w, { type: 'text', text: '¡Qué lentos!', x: p.x, y: p.y - 92, vy: -30, life: 1.6, color: '#ff8fa0' });
        leaveSeat(w, cu, true);
        loseRep(w); w.dayAngry += 1; sfx('angry');
      }
      break;
    case 'eat': {
      cu.eatT += dt;
      const seat = cu.seat, p = actorPos(cu, true);
      // migajas: salen de la boca al masticar y caen sobre la mesa
      if (eatCycle(cu.eatT) > .6 && Math.random() < dt * 16) {
        const x0 = p.x + cu.dir * 3, y0 = p.y - 38, T0 = .45, g = 320;
        const lx = seat.plate.x + rand(-14, 14), ly = seat.plate.y + rand(-4, 6);
        addPart(w, { type: 'crumb', x: x0, y: y0, vx: (lx - x0) / T0, vy: (ly - y0 - .5 * g * T0 * T0) / T0, gy: ly, life: 1.6, col: pick(['#e8c36a', '#c4492a', '#3fb04f', '#f6d77f']) });
      }
      if (cu.eatT >= EAT_TIME) {
        const total = orderTotal(cu) * (cu.vip ? cu.vd.mult : 1), tip = Math.round(total * .25 * clamp(cu.patience / cu.pmax, 0, 1));
        w.coins.push({ x: seat.plate.x + rand(-8, 8), y: seat.plate.y - 2 + rand(-3, 3), v: total + tip, t: 0, vip: !!cu.vip, xp: cu.vip ? cu.vd.xp : 0,
          gems: cu.gd ? Math.round(rand(cu.gd.gems[0], cu.gd.gems[1])) : 0 });
        w.dayServed += 1; w.totalServed += 1;
        addRep(w, cu.vip ? REP.serve * 2 : REP.serve);                              // cada cliente bien atendido devuelve color a la máscara
        addPart(w, { type: 'text', text: cu.vip ? '¡LEGENDARIO!' : '¡Delicioso!', x: p.x, y: p.y - 92, vy: -26, life: 1.4, color: cu.vip ? P.gold : '#9af0b8' });
        if (cu.gd) { toast(w, `¡${cu.gd.name} quedó encantado! Cobra su moneda: trae gemas`); sfx('fanfare'); }
        if (cu.vip) { toast(w, `¡${cu.vd.name} quedó fascinado! Cobra x${cu.vd.mult} y un bono de ${cu.vd.xp} XP`); sfx('fanfare'); }
        sfx('coin');
        leaveSeat(w, cu, false);
      }
      break;
    }
    case 'slam': {
      cu.slamT += dt;
      const n = w.novato;
      if (!cu.impact && cu.slamT >= 1) {                         // el azote: cartel cómico, temblor de pantalla y polvo
        cu.impact = true;
        const np = actorPos(n);
        w.fx.push({ type: 'quebradora', x: np.x, y: np.y - 116, t: 0, life: 1.7 });
        w.shake = .5; sfx('pum');
        for (let k = 0; k < 9; k++) addPart(w, { type: 'steam', x: np.x + n.dir * 30 + rand(-12, 12), y: np.y + rand(-2, 6), vx: rand(-40, 40), vy: -rand(8, 30), life: rand(.5, .9) });
        loseRep(w); w.dayAngry += 1;
        toast(w, '¡Quebradora! El cliente huyó sin pagar y tu máscara se desvanece un poco');
      }
      if (cu.slamT >= 1.8) {                                     // el cliente se levanta y huye por la puerta sin pagar
        cu.x = n.x; cu.y = n.y;
        const cells = Grid.path(Grid.cell(cu.x, cu.y), DOOR.cells) || [];
        cu.path = cells.map(c => Grid.pt(c.c, c.r)).concat([{ x: DOOR.ix, y: -.3 }, { x: DOOR.ix, y: SIDE_Y }, { x: EXIT_X, y: SIDE_Y }]);
        cu.state = 'leave'; cu.speed = 3.8; cu.moving = true; cu.noPay = true; cu.dazed = true; cu.dir = -n.dir;
        n.busy = false; n.furia = false; n.overwork = 0;
        setTask(w, { type: 'rest' });                            // desquitado, el Novato se va directo por su suero
      }
      break;
    }
    case 'rage': updateVipRage(w, cu, dt); break;
    case 'leave':
      // ya en la banqueta, al alejarse se va volviendo transparente
      if (cu.y < SIDE_Y + .4 && cu.x < DOOR.ix - .2) cu.alpha = clamp((cu.x - EXIT_X) / (DOOR.ix - EXIT_X), 0, 1);
      if (step(cu, dt) || cu.alpha <= .02) cu.dead = true;
      break;
  }
}

/* ---------- El Novato ---------- */
// Estas funciones sirven para el Novato del jugador y para el mesero contratado (n)
function assignPath(w, goals, n = w.novato) {
  const cells = Grid.path(Grid.cell(n.x, n.y), goals.filter(g => Grid.free(g.c, g.r)));
  if (!cells) return false;
  n.path = cells.map(c => Grid.pt(c.c, c.r));
  n.resting = false; releaseBench(w, n);                          // cualquier orden lo levanta de la banca
  return true;
}
function setTask(w, task, n = w.novato) {
  const mine = n === w.novato;
  let goals;
  if (task.type === 'pickup') goals = accessFor(task.dish);
  else if (task.type === 'return') goals = accessFor(n.carrying);
  else if (task.type === 'rest') {
    releaseBench(w, n);
    if (!LAYOUT.bench) { if (mine) { toast(w, 'No hay banca: colócala desde el modo EDITAR'); sfx('nope'); } return false; }
    task.seat = w.bench.findIndex(b => b === null);                // la banca tiene dos lugares: uno por trabajador
    if (task.seat < 0) { if (mine) { toast(w, 'La banca está ocupada: espera tu turno'); sfx('nope'); } return false; }
    goals = restAccess();
  } else {
    const s = task.cust.seat;
    goals = DIRS.map(([dc, dr]) => ({ c: s.c + dc, r: s.r + dr })).filter(g => Grid.free(g.c, g.r));
  }
  if (!assignPath(w, goals, n)) { if (mine) { toast(w, 'El Novato no encuentra camino'); sfx('nope'); } return false; }
  if (task.type === 'rest') { n.path.push(benchSeatPt(task.seat)); w.bench[task.seat] = n; }   // y se sienta en la banca
  n.task = task;
  return true;
}
function resolveTask(w, task, n = w.novato) {
  const mine = n === w.novato;
  if (task.type === 'pickup') {                                  // toma una porción de la barra de comida lista
    if (n.carrying) return;
    if (w.stock[task.dish] > 0) {
      w.stock[task.dish]--; n.carrying = task.dish; n.dir = -1; sfx('pickup'); spend(w, STAM.pickup, n);
      const cu = task.then;                                       // si venía por un pedido, sigue hacia esa mesa
      if (cu && cu.state === 'wait' && cu.seat && cu.order.some(i => !i.done && i.key === n.carrying)) setTask(w, { type: 'serve', cust: cu }, n);
    } else if (mine) toast(w, `Ya no queda ${RECIPES[task.dish].name} en la barra`);
  } else if (task.type === 'return') {                            // devuelve la porción a la barra
    if (n.carrying) { w.stock[n.carrying]++; n.carrying = null; sfx('pickup'); spend(w, STAM.back, n); }
  } else if (task.type === 'rest') {                              // se sienta en la banca y toma suero
    n.resting = true; n.furia = false; n.overwork = 0; n.needsRest = false; n.dir = -1; sfx('pour');
  } else {
    if (mine && n.furia && task.cust.state === 'wait' && task.cust.seat) { startSlam(w, task.cust); return; }     // furia: ¡quebradora en lugar de servir!
    const cu = task.cust, it = cu.order.find(i => !i.done && i.key === n.carrying);
    if (n.carrying && it && cu.state === 'wait' && cu.seat) {
      n.dir = ((cu.x - n.x) - (cu.y - n.y)) >= 0 ? 1 : -1;
      it.done = true; cu.served.push(n.carrying); n.carrying = null; sfx('serve'); spend(w, STAM.serve, n);
      const last = pending(cu).length === 0, p = actorPos(n);
      if (last) { cu.state = 'eat'; cu.eatT = 0; }
      addPart(w, { type: 'text', text: last ? '¡Buen provecho!' : '¡Y lo demás!', x: p.x, y: p.y - 84, vy: -30, life: 1.3, color: P.gold });
    }
  }
}

/* ---------- El mesero contratado: atiende solo y descansa en la banca cuando se agota ---------- */
const workerTargets = (w, cu) => [w.novato].concat(w.staff).some(m => m && m.task && (m.task.cust === cu || m.task.then === cu));
function updateStaff(w, dt) { w.staff.forEach(m => updateWaiter(w, m, dt)); }
function updateWaiter(w, m, dt) {
  if (m.entering) { step(m, dt); if (!m.path.length) m.entering = false; return; }
  if (m.stun > 0) { m.stun -= dt; m.moving = false; return; }       // aturdido por un sillazo
  step(m, dt);
  if (!m.path.length && m.task) { const t = m.task; m.task = null; resolveTask(w, t, m); }
  if (m.moving && !m.resting) spend(w, STAM.walk * dt, m);
  if (m.resting) {                                               // suero: recupera poco a poco y vuelve al trabajo cuando está lleno
    m.stamina = Math.min(100, m.stamina + STAM.regen * dt);
    if (m.stamina >= 100) { m.needsRest = false; standUp(w, m); }
    return;
  }
  if (m.task || m.path.length) return;                           // ocupado
  m.think -= dt; if (m.think > 0) return; m.think = .35;
  if (m.needsRest || m.stamina <= 0) {                           // agotado: deja lo que lleva y va a la banca
    if (m.carrying) { w.stock[m.carrying]++; m.carrying = null; }
    setTask(w, { type: 'rest' }, m);
    return;
  }
  if (m.carrying) {                                              // ya lleva algo: lo sirve a quien lo necesite o lo devuelve
    const cu = w.customers.find(c => c.state === 'wait' && c.seat && c.order.some(i => !i.done && i.key === m.carrying) && !workerTargets(w, c));
    setTask(w, cu ? { type: 'serve', cust: cu } : { type: 'return' }, m);
    return;
  }
  const todo = w.customers.filter(c => c.state === 'wait' && c.seat && !workerTargets(w, c))
    .sort((a, b) => a.patience / a.pmax - b.patience / b.pmax);   // primero al más impaciente
  for (const cu of todo) {
    const it = pending(cu).find(i => w.stock[i.key] > 0);
    if (it && setTask(w, { type: 'pickup', dish: it.key, then: cu }, m)) return;
  }
}

/* ---------- Tienda: mobiliario, equipamiento y contratación ---------- */
// Lo que se compra llega al inventario (la "cajita"), que tiene lugares limitados; de ahí se coloca desde el modo EDITAR.
const countOf = (w, type) => w.furn.filter(f => f.type === type).length + w.inv.filter(f => f.type === type).length + (w.edit && w.edit.held && w.edit.held.it.type === type ? 1 : 0);
const nextInvTier = w => INV_TIERS.find(t => t.cap > w.invCap) || null;
const maxOf = (w, type) => type === 'table' ? (DECO.arena ? ARENA.maxTables : SHOP.maxTables) : type === 'fridge' ? SHOP.maxFridges : type === 'drinks' ? 1 : (DECO.arena ? ARENA.maxComals : SHOP.maxComals);
function shopItems(w) {
  const comals = countOf(w, 'comal'), tables = countOf(w, 'table'), fridges = countOf(w, 'fridge'), drinksN = countOf(w, 'drinks'), tier = nextInvTier(w), full = w.inv.length >= w.invCap;
  const fullMsg = full ? `Inventario lleno (${w.inv.length}/${w.invCap})` : null;
  const mc = maxOf(w, 'comal'), mt = maxOf(w, 'table');
  const staff = id => { const d = STAFF[id]; return { id, tab: d.tab, name: d.name, desc: d.desc, price: d.price, done: w.staff.some(m => m.id === id), need: w.level < d.level ? `Requiere nivel ${d.level}` : null }; };
  const arenaNeed = !DECO.remodeled ? 'Primero remodela el changarro' : w.level < ARENA.level ? `Requiere nivel ${ARENA.level}` : null;
  return [
    { id: 'comal', tab: 'furn', name: comals >= mc ? 'Comales' : comals === 0 ? 'Comal de lámina' : `${comals + 1}º Comal`, desc: comals === 0 ? 'Aquí se cocinan los tacos. Tú lo colocas en el piso' : comals >= 2 ? 'Otro fogón: tres recetas a la vez' : 'Dos recetas a la vez', price: priceOf('comal', comals), done: comals >= mc, need: fullMsg },
    { id: 'table', tab: 'furn', name: tables >= mt ? 'Mesas' : tables === 0 ? 'Mesa con mantel' : `Mesa adicional #${tables + 1}`, desc: tables === 0 ? 'Mesa con dos sillas: aquí comen tus clientes' : 'Otra mesa con dos sillas: más clientes a la vez', price: priceOf('table', tables), done: tables >= mt, need: fullMsg },
    { id: 'fridge', tab: 'furn', name: 'Refrigerador', desc: 'Prepara micheladas (frías y con escarcha) para acompañar', price: priceOf('fridge', fridges), done: fridges >= SHOP.maxFridges, need: fullMsg },
    { id: 'drinks', tab: 'furn', name: 'Mostrador de bebidas', desc: 'Aquí reposan las micheladas que salen del refri, listas para servir', price: priceOf('drinks', drinksN), done: drinksN >= 1, need: fridges < 1 ? 'Primero compra el refrigerador' : fullMsg },
    { id: 'inv', tab: 'furn', hide: w.level < 5, name: 'Ampliar inventario', desc: tier ? `La cajita pasa de ${w.invCap} a ${tier.cap} lugares` : `Inventario al máximo (${w.invCap} lugares)`, price: tier ? tier.price : 0, done: !tier, need: tier && w.level < tier.level ? `Requiere nivel ${tier.level}` : null },
    staff('waiter1'), staff('waiter2'), staff('mistico'), staff('anil'),
    { id: 'remodel', tab: 'works', name: 'Remodelar Changarro', desc: 'El local se ensancha (más lugar para mesas). Suma ½ máscara', price: REMODEL.price, done: !!DECO.remodeled, need: w.level < REMODEL.level ? `Requiere nivel ${REMODEL.level}` : null },
    { id: 'arena', tab: 'works', name: 'Mega Ampliación: Arena', desc: 'Cuadrilátero central, hasta 6 mesas y 3 comales. Llegan VIPs nuevos', price: ARENA.price, done: !!DECO.arena, need: arenaNeed }
  ];
}
// Todas las pestañas se ven desde el inicio, pero se van desbloqueando con el nivel (candado hasta entonces): MUEBLES, DECORAR 2, PERSONAL 10, OBRAS 15, LEYENDAS 30
const SHOP_TABS = [['furn', 'MUEBLES', 1], ['decor', 'DECORAR', 2], ['staff', 'MESEROS', 10], ['works', 'OBRAS', 15], ['legend', 'ESPECIALES', 30]];
const shopTabs = w => SHOP_TABS;
const tabLocked = (w, t) => w.level < t[2];
const shopRows = w => shopItems(w).filter(i => i.tab === w.shopTab && !i.hide);
const SHOPBOX = { x: 150, y: 88, w: 660, rowH: 62, top: 104 };
SHOPBOX.h = SHOPBOX.top + 5 * SHOPBOX.rowH + 34;                       // hasta cinco filas por pestaña
const shopTabBtn = (w, i) => { const t = shopTabs(w)[i]; return { x: SHOPBOX.x + 24 + i * 90, y: SHOPBOX.y + 38, w: 86, h: 30, label: t[1], key: t[0] }; };
const shopBtn = i => ({ x: SHOPBOX.x + SHOPBOX.w - 170, y: SHOPBOX.y + SHOPBOX.top + i * SHOPBOX.rowH + 7, w: 150, h: 38 });
const shopClose = { x: SHOPBOX.x + SHOPBOX.w - 40, y: SHOPBOX.y + 10, w: 30, h: 30 };
function canBuy(w, it) {
  if (it.open) return { ok: true };
  if (it.done) return { ok: false, why: 'Comprado' };
  if (it.need) return { ok: false, why: it.need };
  if (w.money < it.price) return { ok: false, why: `Faltan ${pesos(it.price - w.money)}` };
  return { ok: true };
}
function buy(w, id) {
  const it = shopItems(w).find(i => i.id === id), chk = canBuy(w, it);
  if (!chk.ok) { sfx('nope'); w.moneyFlash = .8; toast(w, chk.why === 'Comprado' ? 'Ya lo compraste' : chk.why); return false; }
  const tier = nextInvTier(w);
  w.money -= it.price; w.dayCost += it.price;
  sfx('fanfare');
  if (id === 'remodel') doRemodel(w);
  else if (id === 'inv') { w.invCap = tier.cap; toast(w, `¡Inventario ampliado a ${tier.cap} lugares!`); }
  else if (id === 'arena') doArena(w);
  else if (STAFF[id]) { const m = makeStaff(id, true, w.staff.length); w.staff.push(m); w.shop = false; toast(w, `¡Contrataste a ${STAFF[id].name}!`); }
  else {                                                         // mueble nuevo: entra al inventario y se pasa directo a colocarlo
    const piece = makeFurn(id);
    w.inv.push(piece); w.shop = false; enterEdit(w); editPick(w, piece, 'inv');
    toast(w, 'Toca una loseta del piso para colocarlo (o guárdalo en la cajita)');
  }
  Game.save();
  return true;
}
function shopPointer(w, x, y) {
  const hit = b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
  if (w.shopView === 'decor') { decorPointer(w, x, y, hit); return; }
  if (hit(shopClose)) { w.shop = false; w.shopView = 'main'; sfx('back'); return; }
  const tabs = shopTabs(w);
  for (let i = 0; i < tabs.length; i++) if (hit(shopTabBtn(w, i))) {
    if (tabs[i][0] === 'decor') {
      if (tabLocked(w, tabs[i])) { sfx('nope'); toast(w, `DECORAR se desbloquea en el nivel ${tabs[i][2]}`); }
      else { w.shopView = 'decor'; w.decPage = 0; sfx('click'); }
    } else if (w.shopTab !== tabs[i][0]) { w.shopTab = tabs[i][0]; sfx('click'); }
    return;
  }
  const items = shopRows(w);
  for (let i = 0; i < items.length; i++) if (hit(shopBtn(i))) { buy(w, items[i].id); return; }
  if (!hit({ x: SHOPBOX.x, y: SHOPBOX.y, w: SHOPBOX.w, h: SHOPBOX.h })) { w.shop = false; w.shopView = 'main'; sfx('back'); }
}

/* ---------- Remodelación (nivel 15) y decoración: más máscaras de reputación ---------- */
// Reputación en máscaras: cada cliente enojado le quita un tercio a la máscara (se va poniendo más pálida; con tres se pierde entera)
// y cada cliente que se atiende bien devuelve un cuarto. Llegar a 0 máscaras no termina la partida: se puede volver a subir todo el día.
const REP = { lose: 1 / 3, serve: .25 };
function addRep(w, amt) {
  const before = Math.floor(w.rep + 1e-6);
  w.rep = clamp(w.rep + amt, 0, 5);
  if (amt > 0 && Math.floor(w.rep + 1e-6) > before) { toast(w, '¡Recuperaste una máscara de reputación!'); sfx('ready'); }
}
function loseRep(w, amt = REP.lose) {
  const before = Math.floor(w.rep + 1e-6);
  w.rep = clamp(w.rep - amt, 0, 5);
  if (Math.floor(w.rep + 1e-6) < before) toast(w, w.rep <= 1e-6 ? 'Sin máscaras, pero sigues: atiende clientes para volver a subir' : 'Perdiste una máscara de reputación');
}
function doRemodel(w) {
  w.coins.forEach(co => collectCoin(w, co, true)); w.coins = [];       // las monedas están en pantalla: se cobran antes de mover la cámara
  w.deco.remodeled = true; applyRemodel(true); rebuildLayout(w);
  LAYOUT.tables.forEach(placeSeats);                                  // los platos de cada mesa se reubican en el lienzo ensanchado
  addRep(w, REMODEL.bonus);
  planVips(w, hourOf(w));
  w.shop = false; w.shopView = 'main'; w.shake = .35;
  toast(w, '¡Remodelación lista! El local se ensanchó (+½ máscara). Decóralo desde la tienda');
}
/* Mega Ampliación (nivel 40): el local se vuelve una arena con un cuadrilátero sólido en el centro.
   Lo que estorbaba en esas losetas se reacomoda solo (o va al inventario si no cabe). */
function doArena(w) {
  w.coins.forEach(co => collectCoin(w, co, true)); w.coins = [];
  w.deco.arena = true;
  const ring = new Set(RING_CELLS().map(([c, r]) => r * COLS + c));
  const moved = w.furn.filter(it => footprint(it).some(([c, r]) => ring.has(r * COLS + c)));
  moved.forEach(it => {                                                 // quien esté sentado o descansando se levanta
    if (it.type === 'table') it.seats.forEach(s => { if (s.customer) { leaveSeat(w, s.customer, false); } });
    if (it.type === 'bench') w.bench.forEach(m => { if (m) standUp(w, m); });
  });
  w.furn = w.furn.filter(it => !moved.includes(it)); rebuildLayout(w);
  let toInv = 0;
  moved.forEach(it => {
    let spot = null;
    for (const rot of [it.rot || 0, it.rot ? 0 : 1]) {
      it.rot = rot;
      for (let r = 0; r < ROWS && !spot; r++) for (let c = 0; c < COLS && !spot; c++) if (!canPlace(w, it, c, r)) spot = { c, r };
      if (spot) break;
    }
    if (spot) { it.c = spot.c; it.r = spot.r; if (it.type === 'table') placeSeats(it); w.furn.push(it); rebuildLayout(w); }
    else { w.inv.push(it); w.invCap = Math.max(w.invCap, w.inv.length); toInv++; }
  });
  [w.novato].concat(w.staff).forEach(m => {                              // nadie se queda parado dentro del cuadrilátero
    const cc = Grid.cell(m.x, m.y);
    if (ring.has(cc.r * COLS + cc.c)) { const s = nearestFree(m.x, m.y); m.x = s.x; m.y = s.y; m.path = []; m.task = null; }
  });
  LAYOUT.tables.forEach(placeSeats); repathAll(w);
  addRep(w, ARENA.bonus);
  planVips(w, hourOf(w));
  w.shop = false; w.shopView = 'main'; w.shake = .5;
  toast(w, `¡La Arena está lista! (+1 máscara)${moved.length ? ` Reacomodé ${moved.length} mueble(s)${toInv ? `, ${toInv} fue(ron) al inventario` : ''}` : ''}`);
}
/* ---------- Decorar el changarro: pisos, paredes, banderas, pósters, muebles de adorno y fachada ----------
   Todo se desbloquea por nivel y se paga con monedas. Las gemas (que regalan ciertos visitantes) solo sirven para piezas EXCLUSIVAS. */
const DEC_CATS = [['floor', 'PISO'], ['paint', 'PAREDES'], ['bunting', 'BANDERAS'], ['wall', 'PÓSTERS'], ['furn', 'MUEBLES'], ['awning', 'FACHADA'], ['gem', '★ EXCLUSIVO']];
const DECOR_ITEMS = [];
Object.keys(FLOORS).forEach(k => { const F = FLOORS[k]; DECOR_ITEMS.push({ id: 'floor:' + k, cat: F.gems ? 'gem' : 'floor', kind: 'floor', key: k, name: F.name, price: F.price || 0, gems: F.gems || 0, level: F.level }); });
Object.keys(PAINTS).forEach(k => DECOR_ITEMS.push({ id: 'paint:' + k, cat: 'paint', kind: 'paint', key: k, name: PAINTS[k][3], price: PAINT_INFO[k][0], gems: 0, level: PAINT_INFO[k][1] }));
Object.keys(BUNTINGS).forEach(k => { const B = BUNTINGS[k]; DECOR_ITEMS.push({ id: 'bunting:' + k, cat: B.gems ? 'gem' : 'bunting', kind: 'bunting', key: k, name: B.name, price: B.price || 0, gems: B.gems || 0, level: B.level || 1 }); });
Object.keys(WALLDECO).forEach(k => { const D = WALLDECO[k]; DECOR_ITEMS.push({ id: 'wall:' + k, cat: D.gems ? 'gem' : 'wall', kind: 'toggle', key: k, name: D.name, price: D.price || 0, gems: D.gems || 0, level: D.level, where: D.where }); });
Object.keys(DECOR_FURN).forEach(k => { const D = DECOR_FURN[k]; DECOR_ITEMS.push({ id: 'furn:' + k, cat: D.gems ? 'gem' : 'furn', kind: 'furn', key: k, name: FURN[k].name, price: D.price || 0, gems: D.gems || 0, level: D.level, max: D.max }); });
Object.keys(AWNINGS).forEach(k => DECOR_ITEMS.push({ id: 'awning:' + k, cat: 'awning', kind: 'awning', key: k, name: AWNINGS[k].name, price: AWNING_INFO[k][0], gems: 0, level: AWNING_INFO[k][1] }));
DECOR_ITEMS.forEach((it, i) => { it.ord = i; });
const decorList = cat => DECOR_ITEMS.filter(i => i.cat === cat).sort((a, b) => (a.level - b.level) || (a.ord - b.ord));
function decorState(w, it) {                                         // own: ya es tuyo · on: está puesto
  const d = w.deco;
  switch (it.kind) {
    case 'floor': return { own: !!d.floors[it.key], on: d.floor === it.key };
    case 'paint': return { own: !!d.paints[it.key], on: d.paint === it.key };
    case 'awning': return { own: !!d.awnings[it.key], on: d.awning === it.key };
    case 'bunting': return { own: !!d.buntings[it.key], on: d.bunting === it.key };
    case 'toggle': return { own: !!d.own[it.key], on: !!d.on[it.key] };
    default: { const n = countOf(w, it.key); return { own: false, on: false, count: n, full: n >= it.max }; }
  }
}
function decorClick(w, it) {
  const st = decorState(w, it), d = w.deco;
  if (w.level < it.level) { sfx('nope'); toast(w, `${it.name}: se desbloquea en el nivel ${it.level}`); return false; }
  if (it.kind === 'furn') {
    if (st.full) { sfx('nope'); toast(w, `Ya tienes el máximo de ${it.max}`); return false; }
    if (w.inv.length >= w.invCap) { sfx('nope'); toast(w, `Inventario lleno (${w.inv.length}/${w.invCap})`); return false; }
  } else if (st.own) {                                               // ya es tuyo: ponerlo (o prender/apagar los pósters)
    if (it.kind === 'toggle') d.on[it.key] = !d.on[it.key];
    else if (it.kind === 'floor') d.floor = it.key; else if (it.kind === 'paint') d.paint = it.key;
    else if (it.kind === 'awning') d.awning = it.key; else d.bunting = it.key;
    sfx('click'); Game.save(); return true;
  }
  if (it.gems) {
    if (w.gems < it.gems) { sfx('nope'); toast(w, `Faltan ${it.gems - w.gems} gemas`); return false; }
    w.gems -= it.gems;
  } else {
    if (w.money < it.price) { sfx('nope'); w.moneyFlash = .8; toast(w, `Faltan ${pesos(it.price - w.money)}`); return false; }
    w.money -= it.price; w.dayCost += it.price;
  }
  sfx(it.gems ? 'fanfare' : 'coin');
  if (it.kind === 'floor') { d.floors[it.key] = true; d.floor = it.key; toast(w, `Piso nuevo: ${it.name}`); }
  else if (it.kind === 'bunting') { d.buntings[it.key] = true; d.bunting = it.key; toast(w, `¡${it.name}! Se ven chidas en las paredes`); }
  else if (it.kind === 'toggle') { d.own[it.key] = true; d.on[it.key] = true; toast(w, `${it.name}: ya está en la pared`); }
  else if (it.kind === 'paint' || it.kind === 'awning') {
    const flag = it.kind === 'paint' ? 'paintBonus' : 'awningBonus';
    if (it.kind === 'paint') { d.paints[it.key] = true; d.paint = it.key; } else { d.awnings[it.key] = true; d.awning = it.key; }
    if (!d[flag]) { d[flag] = true; addRep(w, REMODEL.bonus); toast(w, it.kind === 'paint' ? '¡Paredes nuevas! +½ máscara de reputación' : '¡Lona nueva en la fachada! +½ máscara de reputación'); sfx('fanfare'); }
    else toast(w, `${it.name}: comprado`);
  } else {                                                           // mueble de adorno: a la cajita y directo a colocarlo
    const piece = makeFurn(it.key);
    w.inv.push(piece); w.shop = false; w.shopView = 'main'; enterEdit(w); editPick(w, piece, 'inv');
    toast(w, 'Toca una loseta del piso para colocarlo (o guárdalo en la cajita)');
  }
  Game.save();
  return true;
}
const DECBOX = { x: 100, y: 80, w: 760, h: 436 };
const decClose = { x: DECBOX.x + DECBOX.w - 40, y: DECBOX.y + 10, w: 30, h: 30 };
const decTab = i => ({ x: DECBOX.x + 16 + i * 106, y: DECBOX.y + 42, w: 102, h: 28, key: DEC_CATS[i][0], label: DEC_CATS[i][1] });
const decCard = i => ({ x: DECBOX.x + 21 + (i % 4) * 182, y: DECBOX.y + 82 + Math.floor(i / 4) * 126, w: 172, h: 116 });
const decPrev = { x: DECBOX.x + 300, y: DECBOX.y + 336, w: 44, h: 30, label: '◀', size: 16, style: 'dark' };
const decNext = { x: DECBOX.x + 416, y: DECBOX.y + 336, w: 44, h: 30, label: '▶', size: 16, style: 'dark' };
const decBack = { x: DECBOX.x + 21, y: DECBOX.y + 372, w: 210, h: 40, label: 'VOLVER A LA TIENDA', size: 16, style: 'dark' };
function decorPointer(w, x, y, hit) {
  if (hit(decClose)) { w.shop = false; w.shopView = 'main'; sfx('back'); return; }
  if (hit(decBack)) { w.shopView = 'main'; sfx('back'); return; }
  for (let i = 0; i < DEC_CATS.length; i++) if (hit(decTab(i))) { if (w.decCat !== DEC_CATS[i][0]) { w.decCat = DEC_CATS[i][0]; w.decPage = 0; sfx('click'); } return; }
  const list = decorList(w.decCat), pages = Math.max(1, Math.ceil(list.length / 8));
  if (pages > 1 && hit(decPrev)) { w.decPage = (w.decPage + pages - 1) % pages; sfx('click'); return; }
  if (pages > 1 && hit(decNext)) { w.decPage = (w.decPage + 1) % pages; sfx('click'); return; }
  for (let i = 0; i < 8; i++) { const it = list[w.decPage * 8 + i]; if (it && hit(decCard(i))) { decorClick(w, it); return; } }
  if (!hit(DECBOX)) { w.shop = false; w.shopView = 'main'; sfx('back'); }
}

/* ---------- Modo edición: levantar, guardar y colocar muebles ---------- */
const EDIT = { x: W - 14 - 256, y: 72, w: 256, top: 54, cell: 52, cols: 4 };
const editSlot = i => ({ x: EDIT.x + 14 + (i % EDIT.cols) * (EDIT.cell + 4), y: EDIT.y + EDIT.top + Math.floor(i / EDIT.cols) * (EDIT.cell + 4), w: EDIT.cell, h: EDIT.cell });
const editRows = w => Math.ceil(w.invCap / EDIT.cols);
const editH = w => EDIT.top + editRows(w) * (EDIT.cell + 4) + 168;
function editBtns(w) {
  const y = EDIT.y + EDIT.top + editRows(w) * (EDIT.cell + 4) + 8, bw = EDIT.w - 28, hw = (bw - 6) / 2;
  return { rot: { x: EDIT.x + 14, y, w: hw, h: 36, label: UI.touch ? 'GIRAR' : 'GIRAR (R)', size: 16, style: 'teal' },
    drop: { x: EDIT.x + 14 + hw + 6, y, w: hw, h: 36, label: 'SOLTAR', size: 16, style: 'dark' },
    store: { x: EDIT.x + 14, y: y + 44, w: bw, h: 36, label: 'GUARDAR', size: 17, style: 'violet' },
    done: { x: EDIT.x + 14, y: y + 88, w: bw, h: 42, label: 'LISTO', size: 22, style: 'green' } };
}
function enterEdit(w) {
  w.coins.forEach(co => collectCoin(w, co, true)); w.coins = [];   // las monedas de las mesas se cobran antes de mover nada
  w.panel = false; w.shop = false; w.edit = { held: null, hover: null, hit: null };
  sfx('click'); toast(w, 'Modo edición: toca un mueble para levantarlo y una loseta para soltarlo');
}
function exitEdit(w) {
  if (w.edit && w.edit.held) { toast(w, 'Suelta o guarda el mueble que llevas'); sfx('nope'); return false; }
  w.edit = null; repathAll(w); sfx('back'); Game.save();
  return true;
}
function editHover(w, x, y) {
  const e = w.edit; if (!e) return;
  if (x >= EDIT.x && x <= EDIT.x + EDIT.w && y >= EDIT.y && y <= EDIT.y + editH(w)) { e.hit = null; e.hover = null; return; }   // sobre el panel no se señala nada del local (antes un mueble escondido detrás, como la banca, "robaba" el botón GIRAR)
  const iso = screenToIso(x, y);
  e.hover = (iso.x >= 0 && iso.y >= 0 && iso.x < COLS && iso.y < ROWS) ? { c: Math.floor(iso.x), r: Math.floor(iso.y) } : null;
  e.hit = null;
  if (!e.held) {                                                   // el mueble más cercano a la cámara bajo el cursor
    const depth = it => { const d = dimsOf(it); return it.c + it.r + d.fw + d.fh; };
    e.hit = w.furn.filter(it => inBox(itemBox(it), x, y)).sort((a, b) => depth(b) - depth(a))[0] || null;
    if (e.hit) e.last = e.hit;                                     // el último mueble señalado: así el botón GIRAR sirve aunque el cursor ya esté en el panel
  }
}
const tapKey = (w, e) => { const a = e.hover && e.held ? anchorFor(e.held.it, e.hover) : null; return a ? a.c + ',' + a.r + ',' + (e.held.it.rot || 0) : null; };
const rotTarget = w => { const e = w.edit; return e.hit || (e.last && w.furn.includes(e.last) ? e.last : null); };
const anchorFor = (it, hov) => { const d = dimsOf(it); return { c: hov.c - Math.floor((d.fw - 1) / 2), r: hov.r - Math.floor((d.fh - 1) / 2) }; };
// Gira la pieza 90° (largo a lo largo de isoX ↔ isoY). Con un mueble en la mano lo gira ahí; si no, gira el que está bajo el cursor si cabe.
function editRotate(w) {
  const e = w.edit; if (!e) return false;
  if (e.held) {
    e.held.it.rot = e.held.it.rot ? 0 : 1; if (e.held.it.type === 'table') placeSeats(e.held.it);
    e.armed = null; toast(w, 'Girado: toca una loseta verde para soltarlo'); sfx('click'); return true;
  }
  const it = rotTarget(w);
  if (!it) { toast(w, 'Toca un mueble para levantarlo y luego gíralo con R o con GIRAR'); sfx('nope'); return false; }
  if (it.type === 'table' && it.seats.some(s => s.customer)) { toast(w, 'Hay clientes en esa mesa'); sfx('nope'); return false; }
  if (it.type === 'bench' && w.bench.some(b => b)) { toast(w, 'Alguien está descansando en la banca'); sfx('nope'); return false; }
  const before = it.rot || 0; it.rot = before ? 0 : 1;
  let spot = null;                                                  // intenta girar sobre su misma esquina; si no cabe, con el centro en el mismo sitio
  const d0 = FURN[it.type], cx = it.c + (before ? d0.fh : d0.fw) / 2, cy = it.r + (before ? d0.fw : d0.fh) / 2;
  for (const [c, r] of [[it.c, it.r], [Math.round(cx - dimsOf(it).fw / 2), Math.round(cy - dimsOf(it).fh / 2)]]) if (!spot && !canPlace(w, it, c, r)) spot = { c, r };
  if (spot) {
    it.c = spot.c; it.r = spot.r; if (it.type === 'table') placeSeats(it);
    rebuildLayout(w); repathAll(w); sfx('click'); Game.save();
    return true;
  }
  it.rot = before;                                                  // no cabe donde está: lo levanta ya girado para soltarlo donde quepa
  if (!editPick(w, it, 'map')) return false;
  e.held.it.rot = before ? 0 : 1; if (it.type === 'table') placeSeats(it);
  toast(w, 'Ahí no cabía girado: lo levanté. Toca una loseta verde para soltarlo'); sfx('click');
  return true;
}
function editPick(w, it, from) {
  const e = w.edit;
  if (from === 'map') {
    if (it.type === 'table' && it.seats.some(s => s.customer)) { toast(w, 'Hay clientes en esa mesa'); sfx('nope'); return false; }
    if (it.type === 'bench' && w.bench.some(b => b)) { toast(w, 'Alguien está descansando en la banca'); sfx('nope'); return false; }
    w.furn = w.furn.filter(f => f !== it); rebuildLayout(w);
  } else w.inv = w.inv.filter(f => f !== it);
  e.held = { it, from, origin: { c: it.c, r: it.r, rot: it.rot || 0 } }; e.hit = null; e.armed = null; sfx('pickup');
  return true;
}
function editPlace(w) {
  const e = w.edit, h = e.held;
  if (!h || !e.hover) return false;
  const a = anchorFor(h.it, e.hover), why = canPlace(w, h.it, a.c, a.r);
  if (why) { toast(w, why); sfx('nope'); return false; }
  h.it.c = a.c; h.it.r = a.r; if (h.it.type === 'table') placeSeats(h.it);
  w.furn.push(h.it); rebuildLayout(w); e.held = null; e.armed = null; e.last = h.it; sfx('serve'); Game.save();      // (queda como "el último": GIRAR lo vuelve a girar)
  return true;
}
function editCancel(w) {                                          // suelta el mueble donde estaba (o de vuelta al inventario)
  const e = w.edit, h = e.held;
  if (!h) return;
  if (h.from === 'map') { h.it.c = h.origin.c; h.it.r = h.origin.r; h.it.rot = h.origin.rot; if (h.it.type === 'table') placeSeats(h.it); w.furn.push(h.it); rebuildLayout(w); }
  else w.inv.push(h.it);
  e.held = null; sfx('back');
}
function editStore(w) {
  const e = w.edit, h = e.held;
  if (!h) { toast(w, 'Levanta un mueble para guardarlo'); sfx('nope'); return; }
  if (h.from === 'map' && w.inv.length >= w.invCap) { toast(w, `Inventario lleno (${w.inv.length}/${w.invCap})`); sfx('nope'); return; }
  w.inv.push(h.it); e.held = null; sfx('pickup'); toast(w, `${FURN[h.it.type].name}: guardado en el inventario`);
}
function editPointer(w, x, y) {
  const e = w.edit, hit = b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h, B = editBtns(w);
  if (hit(B.done)) { exitEdit(w); return; }
  if (hit(B.rot)) { editRotate(w); return; }
  if (hit(B.drop)) { if (e.held) editCancel(w); else { toast(w, 'No llevas ningún mueble'); sfx('nope'); } return; }
  if (hit(B.store)) { editStore(w); return; }
  for (let i = 0; i < w.inv.length; i++) if (hit(editSlot(i))) { if (e.held) { toast(w, 'Ya llevas un mueble'); sfx('nope'); } else editPick(w, w.inv[i], 'inv'); return; }
  if (hit({ x: EDIT.x, y: EDIT.y, w: EDIT.w, h: editH(w) })) return;
  editHover(w, x, y);
  if (e.held) {
    if (UI.touch) {                                                // en pantalla táctil: un toque marca el lugar (se ve el fantasma) y otro toque en el mismo sitio lo suelta
      const key = tapKey(w, e);
      if (key && e.armed !== key) { e.armed = key; sfx('click'); return; }
    }
    editPlace(w);
  } else if (e.hit) editPick(w, e.hit, 'map');
}
function repathAll(w) {                                           // tras mover muebles, los que caminan buscan un camino nuevo
  const entry = DOOR.cells[0], door = Grid.pt(entry.c, entry.r), tail = [{ x: DOOR.ix, y: -.3 }, { x: DOOR.ix, y: SIDE_Y }, { x: EXIT_X, y: SIDE_Y }];
  for (const cu of w.customers) {
    if (cu.state === 'enter' && cu.seat) {
      const inside = cu.y >= .3, cells = Grid.path(inside ? Grid.cell(cu.x, cu.y) : entry, [{ c: cu.seat.c, r: cu.seat.r }]);
      if (cells) {
        let pts = cells.map(n => Grid.pt(n.c, n.r));
        pts[pts.length ? pts.length - 1 : 0] = { x: cu.seat.gx, y: cu.seat.gy };
        if (!inside) pts = (cu.y < SIDE_Y + .1 ? [{ x: DOOR.ix, y: SIDE_Y }, { x: DOOR.ix, y: -.3 }, door] : cu.y < -.35 ? [{ x: DOOR.ix, y: -.3 }, door] : [door]).concat(pts);
        cu.path = pts; continue;
      }
      cu.seat.customer = null; cu.seat = null; cu.state = 'leave'; cu.speed = 1.9;                // sin camino: se va
      const out = inside ? (Grid.path(Grid.cell(cu.x, cu.y), DOOR.cells) || []).map(n => Grid.pt(n.c, n.r)) : [];
      cu.path = out.concat(inside || cu.y > -.35 ? tail : [{ x: DOOR.ix, y: SIDE_Y }, { x: EXIT_X, y: SIDE_Y }]);
    } else if (cu.state === 'leave' && cu.y >= .3) {
      const cells = Grid.path(Grid.cell(cu.x, cu.y), DOOR.cells) || [];
      cu.path = cells.map(n => Grid.pt(n.c, n.r)).concat(tail);
    }
  }
  [w.novato].concat(w.staff).forEach(m => { if (m && !m.resting && !m.busy) { m.path = []; m.task = null; } });
}

/* ---------- Panel del comal: catálogo para cocinar ---------- */
const PANEL = { x: W - 14 - 324, y: 72, w: 324, top: 44, rowH: 60 };
const panelClose = { x: PANEL.x + PANEL.w - 36, y: PANEL.y + 8, w: 28, h: 28 };
const panelBtn = i => ({ x: PANEL.x + PANEL.w - 98, y: PANEL.y + PANEL.top + i * PANEL.rowH + (PANEL.rowH - 34) / 2, w: 86, h: 34 });
// lugar libre de la estación abierta: en el comal, el del comal que se tocó; en el refrigerador, cualquiera de sus dos
const slotFor = (w, station) => station === 'fridge' ? w.dslots.find(s => s.state === 'empty') : (w.slots[w.panelIdx] && w.slots[w.panelIdx].state === 'empty' ? w.slots[w.panelIdx] : null);
function canCook(w, key) {
  const r = RECIPES[key];
  if (r.level > w.level) return { ok: false, locked: true, why: `Nivel ${r.level}` };
  if (w.money < r.cost) return { ok: false, why: `Faltan ${pesos(r.cost - w.money)}` };
  if (!slotFor(w, r.station)) return { ok: false, full: true, why: r.station === 'fridge' ? 'Refri ocupado' : 'Comal ocupado' };
  return { ok: true };
}
function startCook(w, key) {
  const chk = canCook(w, key), r = RECIPES[key];
  if (!chk.ok) {
    sfx('nope'); w.moneyFlash = chk.locked ? 0 : .8;
    toast(w, chk.locked ? `${r.name} se desbloquea en el nivel ${r.level}` : chk.full ? (r.station === 'fridge' ? 'El refrigerador está ocupado: espera a que termine una tanda' : 'Este comal está ocupado: espera a que termine la tanda o usa el otro') : `No te alcanza para ${r.name}. ${chk.why}`);
    return false;
  }
  const slot = slotFor(w, r.station);
  slot.state = 'cook'; slot.dish = key; slot.t = 0;
  w.money -= r.cost; w.dayCost += r.cost; spend(w, STAM.cook);
  const p = r.station === 'fridge' ? fridgeRingPos(0) : comalPos(w.panelIdx);
  addPart(w, { type: 'text', text: '-' + pesos(r.cost), x: p.x, y: p.y - 30, vy: -34, life: 1.2, color: '#ff8fa0' });
  sfx(r.drink ? 'pour' : 'sizzle');
  return true;
}
// El panel se ajusta al alto del lienzo: con los 8 platillos del comal las filas se hacen un poco más bajas para que todo quepa
const fitPanel = w => { const n = STATIONS[w.panel || 'comal'].items.length; PANEL.rowH = Math.min(60, Math.floor((H - PANEL.y - PANEL.top - 34) / n)); };
const panelH = w => { fitPanel(w); return PANEL.top + STATIONS[w.panel].items.length * PANEL.rowH + 28; };
function panelPointer(w, x, y) {
  const hit = b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
  if (hit(panelClose)) { w.panel = false; sfx('back'); return; }
  fitPanel(w);
  const items = STATIONS[w.panel].items;
  for (let i = 0; i < items.length; i++) if (hit(panelBtn(i))) { if (startCook(w, items[i])) w.panel = false; return; }
  if (!hit({ x: PANEL.x, y: PANEL.y, w: PANEL.w, h: panelH(w) })) { w.panel = false; sfx('back'); }     // clic fuera: cierra
}

function comalClick(w, i = 0) { w.panel = (w.panel === 'comal' && w.panelIdx === i) ? false : 'comal'; w.panelIdx = i; sfx('click'); }
function fridgeClick(w) { w.panel = w.panel === 'fridge' ? false : 'fridge'; sfx('click'); }
function barClick(w, key) {
  const n = w.novato;
  sfx('click');
  if (n.carrying) setTask(w, { type: 'return' });
  else setTask(w, { type: 'pickup', dish: key });
}
function customerClick(w, cu) {
  const n = w.novato;
  if (cu.state !== 'wait') return false;
  if (w.staff.some(m => m.task && (m.task.cust === cu || m.task.then === cu)) && !n.furia) { sfx('nope'); toast(w, 'Tu personal ya va por ese pedido'); return true; }
  if (n.furia) { sfx('click'); setTask(w, { type: 'serve', cust: cu }); return true; }          // rabioso: va directo por el cliente
  const need = pending(cu);
  if (n.carrying) {
    if (need.some(i => i.key === n.carrying)) { sfx('click'); setTask(w, { type: 'serve', cust: cu }); }
    else { sfx('nope'); toast(w, `Llevas ${RECIPES[n.carrying].name}; ese cliente pidió ${need.map(i => RECIPES[i.key].short).join(' y ')}`); }
    return true;
  }
  const it = need.find(i => w.stock[i.key] > 0);                 // el Novato va por el pedido a la barra y lo lleva a la mesa
  if (it) { sfx('click'); setTask(w, { type: 'pickup', dish: it.key, then: cu }); return true; }
  sfx('nope');
  toast(w, RECIPES[need[0].key].drink ? `No hay ${RECIPES[need[0].key].name} lista: prepárala en el refrigerador` : `No hay ${RECIPES[need[0].key].name} listo: cocínalo en el comal`);
  return true;
}
function collectCoin(w, coin, auto) {
  w.money += coin.v; w.dayEarned += coin.v;
  if (coin.gems) {                                                  // ¡gemas! solo sirven para decoración exclusiva
    w.gems += coin.gems; w.gemsSeen = true;
    addPart(w, { type: 'text', text: `+${coin.gems} GEMAS`, x: coin.x, y: coin.y - 34, vy: -34, life: 1.8, color: '#7be8ff' });
    sfx('fanfare');
  }
  const gain = coin.v + (coin.xp || 0);                            // cobrar también da experiencia: 1 XP por peso (+ bono del VIP)
  if (!auto) {
    addPart(w, { type: 'fly', x: coin.x, y: coin.y, tx: 205, ty: 30, life: .6 });
    addPart(w, { type: 'text', text: `+${pesos(coin.v)}  +${gain} XP`, x: coin.x, y: coin.y - 12, vy: -40, life: 1.2, color: P.gold });
    addXp(w, gain);
    sfx('coin');
  } else addXp(w, gain);
}

function worldPointer(w, x, y) {
  // superposiciones (resumen / fin de partida)
  if (w.phase !== 'play') {
    const b = w.overlay.find(b => UI.hit(b));
    if (b) { sfx('click'); b.fn(); }
    return;
  }
  if (w.tut && tutPointer(w, x, y)) return;                        // ventanas del tutorial y botón de saltarlo
  if (w.shop) { shopPointer(w, x, y); return; }
  if (w.edit) {                                                   // modo edición: solo el botón EDITAR (sale) y el panel/escenario
    const eb = w.btns.find(b => b.label === 'EDITAR');
    if (UI.hit(eb)) { exitEdit(w); return; }
    editPointer(w, x, y); return;
  }
  const hb = w.btns.find(b => UI.hit(b));
  if (hb) { hb.fn(); return; }
  if (w.panel) { panelPointer(w, x, y); return; }
  for (let i = w.coins.length - 1; i >= 0; i--) {
    const c = w.coins[i];
    if (Math.hypot(x - c.x, y - (c.y - 4)) < 26) { w.coins.splice(i, 1); collectCoin(w, c); Game.save(); return; }
  }
  for (let i = w.slots.length - 1; i >= 0; i--) if (comalHit(x, y, i)) { comalClick(w, i); return; }
  if (fridgeHit(x, y)) { fridgeClick(w); return; }
  if (restHit(x, y)) { restClick(w); return; }
  const sk = stockAt(w, x, y);                                    // pilas de la barra de comida lista y del mostrador de bebidas
  if (sk) { barClick(w, sk); return; }
  // el Novato y los clientes sentados: recibe el clic el que está más cerca de la cámara (mayor isoX+isoY)
  const nov = w.novato;
  const cands = w.customers.filter(cu => cu.seated).map(cu => ({ d: cu.x + cu.y, cu }));
  cands.push({ d: nov.x + nov.y, nov: true });
  cands.sort((a, b) => b.d - a.d);
  for (const k of cands) {
    const p = k.nov ? actorPos(nov, nov.resting) : actorPos(k.cu, true);
    if (x > p.x - 25 && x < p.x + 25 && y > p.y - 80 && y < p.y + 12) {
      if (k.nov) { restClick(w); return; }
      if (customerClick(w, k.cu)) return;
    }
  }
  const iso = screenToIso(x, y);
  if (y > HUD && iso.x >= 0 && iso.y >= 0 && iso.x < COLS && iso.y < ROWS) {
    const cell = Grid.cell(iso.x, iso.y);
    if (Grid.free(cell.c, cell.r) && assignPath(w, [cell])) { w.novato.task = null; sfx('click'); }
    else if (!Grid.free(cell.c, cell.r)) sfx('nope');
  }
}

/* ---------- Actualización ---------- */
function updateWorld(w, dt) {
  w.t += dt;
  w.shownMoney += (w.money - w.shownMoney) * Math.min(1, dt * 6);
  if (Math.abs(w.money - w.shownMoney) < 0.5) w.shownMoney = w.money;
  if (w.banner > 0) w.banner -= dt;
  if (w.levelFlash > 0) w.levelFlash -= dt;
  if (w.shake > 0) w.shake -= dt;
  w.fx.forEach(f => f.t += dt); w.fx = w.fx.filter(f => f.t < f.life);
  w.toasts.forEach(t => t.t -= dt); w.toasts = w.toasts.filter(t => t.t > 0);

  // puerta batiente (resorte amortiguado): se abre hacia dentro al entrar y hacia fuera al salir
  let target = 0;
  for (const cu of w.customers) {
    if ((cu.state === 'enter' || cu.state === 'leave') && Math.hypot(cu.x - DOOR.ix, cu.y - .2) < 1.7) target = cu.state === 'enter' ? 1 : -1;
  }
  for (const m of w.staff) if (m.entering && Math.hypot(m.x - DOOR.ix, m.y - .2) < 1.7) target = 1;
  const near = target !== 0;
  if (near && !w.doorOpen) sfx('door');
  w.doorOpen = near;
  w.doorV += ((target - w.doorA) * 130 - w.doorV * 13) * dt;
  w.doorA = clamp(w.doorA + w.doorV * dt, -1.35, 1.35);

  if (w.phase === 'play') {
    if (w.repTemp > 0) w.repTemp = Math.max(0, w.repTemp - dt / 60);          // la máscara perdida por el sillazo se recupera en un minuto
    for (const it of w.furn) if (it.type === 'table' && it.down > 0) {         // mesas volcadas: el personal las vuelve a poner
      it.downT += dt; it.down -= dt;
      if (it.down <= 0) { it.down = 0; sfx('ready'); const tm = tableMid(it), mp = S(tm[0], tm[1]); addPart(w, { type: 'text', text: '¡Mesa lista otra vez!', x: mp.x, y: mp.y - 40, vy: -24, life: 1.5, color: '#9af0b8' }); }
    }
    if (w.dayTime > 0 && !w.customers.some(cu => cu.vip || cu.gd)) {                   // llegada de los VIP y de los que regalan gemas, de uno en uno (si el local aún cumple los requisitos)
      const v = w.vips.find(q => !q.done && hourOf(w) >= q.at);
      if (v && GEMMERS[v.k]) { if (spawnGemmer(w, GEMMERS[v.k])) v.done = true; }
      else if (v) { const def = VIPS[v.k]; if (!vipEligible(w, def)) v.done = true; else if (spawnVip(w, def)) v.done = true; }
    }
    // reloj del día y llegada de clientes
    if (w.dayTime > 0) {
      w.dayTime = Math.max(0, w.dayTime - dt);
      w.spawnT -= dt;
      if (w.spawnT <= 0) {
        const h = hourOf(w), rush = h >= 13 && h < 15.5 ? .6 : h < 9 ? 1.35 : h >= 18.5 ? 1.25 : 1;      // hora de la comida: más gente; temprano y de noche, menos
        const base = clamp(9.5 - (w.day - 1) * .9, 4.2, 9.5) * rush;
        w.spawnT = spawnCustomer(w) ? rand(base * .7, base * 1.3) : 1;
      }
    } else if (!w.closedWarned) { w.closedWarned = true; toast(w, '¡Son las 8:00 PM! Cerramos: atiende a los últimos clientes'); sfx('door'); }
    // comal
    [['comal', w.slots], ['fridge', w.dslots]].forEach(([station, list]) => list.forEach((s, i) => {
      if (s.state !== 'cook') return;
      s.t += dt;
      const sp = station === 'fridge' ? fridgeRingPos(i) : slotPos(i);
      if (Math.random() < dt * 5) {                                // vapor del comal / frío del refrigerador
        if (station === 'fridge') addPart(w, { type: 'steam', cold: true, x: sp.x + rand(-8, 8), y: sp.y + 10, vx: rand(-8, 8), vy: rand(6, 18), life: rand(.7, 1.1) });
        else addPart(w, { type: 'steam', x: sp.x + rand(-8, 8), y: sp.y - 8, vx: rand(-6, 6), vy: -rand(18, 32), life: rand(.8, 1.3) });
      }
      const r = RECIPES[s.dish];
      if (s.t >= r.time) {                                         // tanda lista: las porciones pasan a la barra (comida) o al mostrador de bebidas
        s.state = 'empty'; w.stock[s.dish] += r.yield; sfx('ready');
        const bp = stockPos(s.dish) || sp;                          // (si el mostrador no está colocado, se avisa donde se cocinó)
        addPart(w, { type: 'text', text: `+${r.yield} ${r.short}`, x: bp.x, y: bp.y - 34, vy: -26, life: 1.5, color: P.gold });
        for (let k = 0; k < 6; k++) addPart(w, { type: 'spark', x: bp.x, y: bp.y - 10, vx: rand(-40, 40), vy: -rand(20, 60), life: .6 });
        s.dish = null;
      }
    }));
    // fondo de emergencia: si no hay dinero, ni comida, ni nada en preparación, un compadre presta para reabrir la cocina
    const broke = w.money < 10 && stockTotal(w) === 0 && !allSlots(w).some(s => s.state === 'cook') && !w.coins.length && !w.novato.carrying;
    if (broke && !w.staff.some(m => m.carrying)) { w.loanT += dt; if (w.loanT > 3) { w.loanT = 0; w.money += 30; toast(w, '¡Un compadre te presta $30 para seguir cocinando!'); sfx('coin'); } } else w.loanT = 0;
    if (w.moneyFlash > 0) w.moneyFlash -= dt;
    w.customers.forEach(cu => updateCustomer(w, cu, dt));
    w.customers = w.customers.filter(cu => !cu.dead);

    // novato
    const n = w.novato;
    if (n.stun > 0) { n.stun -= dt; n.moving = false; n.path = []; n.task = null; }              // un sillazo lo deja aturdido un momento
    else if (!n.busy) {                                          // (ocupado = está aplicando una quebradora)
      step(n, dt);
      if (!n.path.length && n.task) { const t = n.task; n.task = null; resolveTask(w, t); }
    }
    if (n.moving && !n.resting && !n.busy) spend(w, STAM.walk * dt);       // caminar cansa
    if (n.resting) {                                             // en la banca: el suero recupera la estamina poco a poco
      const mx = maxStamina(w);
      n.stamina = Math.min(mx, n.stamina + STAM.regen * dt);
      if (n.stamina > 0) n.zeroWarned = false;
      if (n.stamina >= mx) { standUp(w, n); toast(w, 'El Novato recuperó toda su energía'); sfx('ready'); }
    }
    updateStaff(w, dt);

    // monedas
    w.coins.forEach(c => c.t += dt);

    // fin del día / fin de partida
    if (w.overT > 0) { w.overT += dt; if (w.overT > 1.4) endGame(w); }
    else if (w.dayTime <= 0 && w.customers.length === 0) { w.endT += dt; if (w.endT > 1) finishDay(w); }
  }

  for (const p of w.parts) {
    p.life -= dt;
    if (p.type === 'fly') { const k = 1 - clamp(p.life / p.max, 0, 1); p.cx = lerp(p.x, p.tx, k * k); p.cy = lerp(p.y, p.ty, k * k) - Math.sin(k * Math.PI) * 40; }
    else {
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.type === 'spark') p.vy += 120 * dt;
      else if (p.type === 'crumb') { p.vy += 320 * dt; if (p.y >= p.gy) { p.y = p.gy; p.vx = 0; p.vy = 0; } }
    }
  }
  w.parts = w.parts.filter(p => p.life > 0);
}

function finishDay(w) {
  w.coins.forEach(c => collectCoin(w, c, true)); w.coins = [];
  if (w.dayAngry === 0 && w.rep < 5) { w.rep = Math.min(5, w.rep + 1); w.perfect = true; }
  w.phase = 'summary';
  Game.save();
  sfx('fanfare');
  w.overlay = [
    { label: 'Siguiente día', x: 262, y: 392, w: 210, h: 52, style: 'green', size: 24, fn: () => { w.day += 1; startDay(w); Game.save(); } },
    { label: 'Guardar y salir', x: 488, y: 392, w: 210, h: 52, style: 'dark', size: 24, fn: () => setState('MENU') }
  ];
}
function endGame(w) {
  w.phase = 'over'; sfx('over');
  w.overlay = [
    { label: 'Reabrir el día', x: 262, y: 392, w: 210, h: 52, style: 'gold', size: 24, fn: () => { w.rep = 3; startDay(w); } },
    { label: 'Menú', x: 488, y: 392, w: 210, h: 52, style: 'dark', size: 24, fn: () => setState('MENU') }
  ];
}

/* =========================================================
   JUEGO: DIBUJO ISOMÉTRICO (diorama en corte)
   Orden: terreno exterior → piso → actores de afuera (Y-sort) → paredes → muebles y actores de adentro (Y-sort) → interfaz.
   Cada elemento se guarda en una lista con su profundidad (isoX + isoY) y se ordena antes de dibujar.
   ========================================================= */
function isoPoly(c, pts) { c.beginPath(); pts.forEach((p, i) => c[i ? 'lineTo' : 'moveTo'](p.x, p.y)); c.closePath(); }
function groundQuad(c, x0, y0, x1, y1, z = 0) { isoPoly(c, [S(x0, y0, z), S(x1, y0, z), S(x1, y1, z), S(x0, y1, z)]); }
function isoEllipse(c, gx, gy, z, r) {                      // círculo de radio r losetas sobre el suelo
  const p = S(gx, gy, z);
  c.beginPath(); c.ellipse(p.x, p.y, r * TW * .7071, r * TH * .7071, 0, 0, 6.3);
}
function isoBox(c, x0, y0, x1, y1, z0, z1, col, lw = 1.6) {
  if (MIRROR) col = { top: col.top, left: col.right, right: col.left };      // al espejar, la luz sigue cayendo del mismo lado
  c.lineJoin = 'round'; c.lineWidth = lw; c.strokeStyle = P.ink;
  isoPoly(c, [S(x0, y1, z0), S(x1, y1, z0), S(x1, y1, z1), S(x0, y1, z1)]); c.fillStyle = col.left; c.fill(); c.stroke();     // cara +isoY
  isoPoly(c, [S(x1, y1, z0), S(x1, y0, z0), S(x1, y0, z1), S(x1, y1, z1)]); c.fillStyle = col.right; c.fill(); c.stroke();    // cara +isoX
  isoPoly(c, [S(x0, y0, z1), S(x1, y0, z1), S(x1, y1, z1), S(x0, y1, z1)]); c.fillStyle = col.top; c.fill(); c.stroke();      // tapa
}

/* ---------- Exterior: pasto, calle, banqueta ---------- */
function drawGround(c) {
  const g = c.createLinearGradient(0, HUD, 0, H);
  g.addColorStop(0, '#5aa65a'); g.addColorStop(1, '#3a7a46');
  c.fillStyle = g; c.fillRect(0, HUD, W, H - HUD);
  c.strokeStyle = 'rgba(25,80,40,.35)'; c.lineWidth = 1.4; c.beginPath();
  for (let i = 0; i < 150; i++) { const x = hash(i) * W, y = HUD + hash(i + 400) * (H - HUD); c.moveTo(x, y); c.lineTo(x - 2, y - 5); c.moveTo(x, y); c.lineTo(x + 2, y - 5); }
  c.stroke();

  const X0 = -16, X1 = 28;
  const band = (y0, y1, col) => { groundQuad(c, X0, y0, X1, y1); c.fillStyle = col; c.fill(); };
  band(-12, -8.4, '#b9b3a6');                                // banqueta lejana
  band(-8.4, -4.4, '#4a4c5c');                               // calle
  c.fillStyle = '#f2d45c';
  for (let x = X0; x < X1; x += 1.6) { groundQuad(c, x, -6.47, x + .8, -6.33); c.fill(); }
  band(-4.4, -4.2, '#8d8779');                               // bordillo
  band(-4.2, -2.2, '#d0cabb');                               // banqueta de concreto
  c.strokeStyle = 'rgba(70,55,40,.3)'; c.lineWidth = 1.2; c.beginPath();
  for (let x = X0; x < X1; x += 1.5) { const a = S(x, -4.2), b = S(x, -2.2); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); }
  { const a = S(X0, -3.2), b = S(X1, -3.2); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); }
  c.stroke();
  groundQuad(c, 5.05, -2.2, 5.95, 0); c.fillStyle = '#d0cabb'; c.fill();     // sendero a la puerta
  c.strokeStyle = 'rgba(70,55,40,.3)'; c.beginPath();
  for (let y = -2.2; y < 0; y += .75) { const a = S(5.05, y), b = S(5.95, y); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); }
  c.stroke();
}

function drawTree(c, x, y) {
  const p = S(x, y);
  c.fillStyle = 'rgba(0,0,0,.2)'; c.beginPath(); c.ellipse(p.x, p.y + 2, 30, 11, 0, 0, 6.3); c.fill();
  c.lineWidth = 2; c.strokeStyle = P.ink; c.fillStyle = '#7a4a1e'; rr(c, p.x - 5, p.y - 38, 10, 40, 3); c.fill(); c.stroke();
  [[0, -64, 27, '#2f8f4e'], [-19, -50, 19, '#3aa35a'], [19, -50, 19, '#2a7d44'], [4, -76, 16, '#46b868']].forEach(([dx, dy, r, col]) => {
    c.fillStyle = col; c.beginPath(); c.arc(p.x + dx, p.y + dy, r, 0, 6.3); c.fill(); c.stroke();
  });
}
function drawBush(c, x, y) {
  const p = S(x, y);
  c.fillStyle = 'rgba(0,0,0,.18)'; c.beginPath(); c.ellipse(p.x, p.y + 2, 24, 8, 0, 0, 6.3); c.fill();
  c.lineWidth = 2; c.strokeStyle = P.ink;
  [[-10, -9, 12, '#2f8f4e'], [10, -9, 12, '#2a7d44'], [0, -16, 13, '#3aa35a']].forEach(([dx, dy, r, col]) => { c.fillStyle = col; c.beginPath(); c.arc(p.x + dx, p.y + dy, r, 0, 6.3); c.fill(); c.stroke(); });
  c.fillStyle = '#ff5fa2'; [[-8, -14], [6, -8], [2, -22]].forEach(([dx, dy]) => { c.beginPath(); c.arc(p.x + dx, p.y + dy, 2.2, 0, 6.3); c.fill(); });
}
function drawLamp(c, x, y, t) {
  const p = S(x, y);
  c.fillStyle = 'rgba(0,0,0,.2)'; c.beginPath(); c.ellipse(p.x, p.y + 2, 12, 4.5, 0, 0, 6.3); c.fill();
  const g = c.createRadialGradient(p.x, p.y - 80, 2, p.x, p.y - 80, 46);
  g.addColorStop(0, 'rgba(255,230,140,.55)'); g.addColorStop(1, 'rgba(255,230,140,0)');
  c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y - 80, 46, 0, 6.3); c.fill();
  c.lineWidth = 2; c.strokeStyle = P.ink; c.fillStyle = '#2b2540';
  rr(c, p.x - 2.5, p.y - 78, 5, 80, 2); c.fill(); c.stroke();
  rr(c, p.x - 7, p.y - 4, 14, 6, 2); c.fill(); c.stroke();
  c.fillStyle = '#ffe58a'; rr(c, p.x - 7, p.y - 90, 14, 12, 4); c.fill(); c.stroke();
}
const EXT_PROPS = [
  { x: 10.9, y: -1.1, draw: drawTree }, { x: -2.6, y: 2.8, draw: drawTree }, { x: -1.7, y: 6.9, draw: drawBush },
  { x: 9.9, y: -.7, draw: drawBush }, { x: 3, y: -4.5, draw: drawLamp }, { x: 9.5, y: -4.5, draw: drawLamp }, { x: -1.5, y: -4.5, draw: drawLamp }
];

/* ---------- Piso de damero ---------- */
function drawFloor(c) {
  c.lineJoin = 'round'; c.lineWidth = 2; c.strokeStyle = P.ink;
  isoPoly(c, [S(COLS, 0, 0), S(COLS, ROWS, 0), S(COLS, ROWS, -16), S(COLS, 0, -16)]); c.fillStyle = '#54382a'; c.fill(); c.stroke();
  isoPoly(c, [S(0, ROWS, 0), S(COLS, ROWS, 0), S(COLS, ROWS, -16), S(0, ROWS, -16)]); c.fillStyle = '#76503a'; c.fill(); c.stroke();
  c.lineWidth = 1; c.strokeStyle = 'rgba(27,16,48,.22)';
  const F = FLOORS[DECO.floor] || FLOORS.cemento;
  for (let i = 0; i < COLS; i++) for (let j = 0; j < ROWS; j++) floorTile(c, F, [S(i, j), S(i + 1, j), S(i + 1, j + 1), S(i, j + 1)], i, j, clock);
  if (DECO.on.alfombra) {                                                // alfombra de ring
    isoEllipse(c, 4.5, 4.4, 0, 2.1); c.fillStyle = 'rgba(184,50,74,.88)'; c.fill(); c.lineWidth = 3; c.strokeStyle = P.gold; c.stroke();
    isoEllipse(c, 4.5, 4.4, 0, 1.7); c.lineWidth = 1.5; c.strokeStyle = 'rgba(255,200,61,.7)'; c.stroke();
    const rc = S(4.5, 4.4);
    c.save(); c.translate(rc.x, rc.y); c.scale(1, .5); c.globalAlpha = .55; drawMask(c, 0, 0, 25, MASKS.ring); c.restore();
  }
  if (DECO.on.felpudo) { groundQuad(c, 5.12, .1, 5.88, .9); c.fillStyle = '#8f1d33'; c.fill(); c.lineWidth = 2; c.strokeStyle = P.gold; c.stroke(); }   // felpudo en la entrada
}
// Una loseta del piso con el diseño elegido. p = esquinas en pantalla (arriba, derecha, abajo, izquierda)
function floorTile(c, F, p, i, j, t) {
  isoPoly(c, p); c.fillStyle = (i + j) & 1 ? F.c1 : F.c0; c.fill(); c.stroke();
  if (!F.pattern) return;
  const cx = (p[0].x + p[2].x) / 2, cy = (p[0].y + p[2].y) / 2, hw = (p[1].x - p[3].x) / 2, hh = (p[2].y - p[0].y) / 2, seed = hash(i * 17 + j * 5 + 1);
  c.save(); c.lineJoin = 'round'; c.lineCap = 'round';
  if (F.pattern === 'cracks') {                                           // cemento agrietado
    if (seed > .5) { c.strokeStyle = 'rgba(60,58,52,.38)'; c.lineWidth = 1; c.beginPath(); c.moveTo(cx - hw * .5, cy - hh * .1 + seed * 3); c.lineTo(cx - hw * .1, cy + hh * .15); c.lineTo(cx + hw * .2, cy - hh * .05); c.lineTo(cx + hw * .5, cy + hh * .3); c.stroke(); }
    if (seed > .8) { c.fillStyle = 'rgba(60,58,52,.16)'; c.beginPath(); c.ellipse(cx + hw * .25, cy + hh * .3, hw * .22, hh * .16, 0, 0, 6.3); c.fill(); }
  } else if (F.pattern === 'plank') {                                      // tablones a lo largo
    c.strokeStyle = 'rgba(80,45,15,.38)'; c.lineWidth = 1;
    for (const v of [.34, .67]) { const a = { x: p[0].x + (p[3].x - p[0].x) * v, y: p[0].y + (p[3].y - p[0].y) * v }, b = { x: p[1].x + (p[2].x - p[1].x) * v, y: p[1].y + (p[2].y - p[1].y) * v }; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); }
  } else if (F.pattern === 'cross') {                                      // azulejo de talavera: rombo y puntitos
    const col = (i + j) & 1 ? F.c0 : F.c1; c.strokeStyle = col; c.fillStyle = col; c.lineWidth = 1.4;
    c.beginPath(); c.moveTo(cx, cy - hh * .5); c.lineTo(cx + hw * .5, cy); c.lineTo(cx, cy + hh * .5); c.lineTo(cx - hw * .5, cy); c.closePath(); c.stroke();
    c.beginPath(); c.arc(cx, cy, 2, 0, 6.3); c.fill();
  } else if (F.pattern === 'mask') {                                       // máscaras de lucha en las losetas claras, estrellas en las oscuras
    c.translate(cx, cy);
    if ((i + j) & 1) { c.fillStyle = '#ffc83d'; star(c, 0, 0, hh * .55, hh * .22); c.fill(); }
    else { c.scale(1, .5); c.globalAlpha = .9; drawMask(c, 0, 0, hw * .42, MASKS.ring); }
  } else if (F.pattern === 'spark') {                                      // dorado con destellos
    if (seed > .35) { const a = .35 + .65 * Math.max(0, Math.sin(t * 2.6 + seed * 20)); c.fillStyle = `rgba(255,255,255,${a})`; star(c, cx + (seed - .6) * hw, cy, 2 + 3 * a, 1, 4); c.fill(); }
  }
  c.restore();
}

/* ---------- Paredes en esquina ---------- */
function paintWall(c, u0, u1, w0, w1, len) {                  // coordenadas locales: u a lo largo del muro (px), w hacia abajo
  const H = WALL_H;
  c.save(); c.beginPath(); c.rect(u0, w0, u1 - u0, w1 - w0); c.clip();
  const pal = PAINTS[DECO.paint] || PAINTS.cal;                        // pintura elegida en la decoración
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, pal[0]); g.addColorStop(1, pal[1]);
  c.fillStyle = g; c.fillRect(u0, w0, u1 - u0, w1 - w0);
  c.fillStyle = 'rgba(80,40,10,.08)'; for (let u = 0; u < len; u += U) c.fillRect(u, 0, 2, H);
  c.fillStyle = pal[2]; c.fillRect(u0, H - 42, u1 - u0, 34);                                      // lambrín (vinotinto de origen)
  c.strokeStyle = 'rgba(255,200,200,.25)'; c.lineWidth = 1.2;
  for (let u = 0; u < len; u += U) c.strokeRect(u + 4, H - 38, U - 8, 26);
  c.fillStyle = '#f3e9d8'; c.fillRect(u0, H - 45, u1 - u0, 3.5);                                 // moldura
  c.fillStyle = '#f6f1e8'; c.fillRect(u0, H - 8, u1 - u0, 8);                                    // zoclo blanco
  c.fillStyle = 'rgba(27,16,48,.35)'; c.fillRect(u0, H - 8, u1 - u0, 1.2);
  c.fillStyle = '#f9f5ec'; c.fillRect(u0, 0, u1 - u0, 8);                                        // remate superior blanco
  c.fillStyle = 'rgba(0,0,0,.16)'; c.fillRect(u0, 8, u1 - u0, 4);
  c.restore();
}
function drawBunting(c, ranges, t, key = 'papel') {               // banderas del estilo elegido: papel picado, tricolor, máscaras colgantes o foquitos
  const B = BUNTINGS[key] || BUNTINGS.papel, cols = B.cols || [], mk = [MASKS.ring, MASKS.blue, MASKS.black, MASKS.pink];
  const sag = u => 14 + 7 * (1 - Math.pow(((u % 108) / 54) - 1, 2));
  c.strokeStyle = P.ink; c.lineWidth = 1.3;
  ranges.forEach(([a, b]) => {
    c.beginPath(); for (let u = a; u <= b; u += 4) c[u === a ? 'moveTo' : 'lineTo'](u, sag(u)); c.stroke();
    if (B.lights) {
      const bc = ['#ff5a5a', '#ffd23a', '#5fe8ff', '#7cf07c', '#ff8afc'];
      for (let u = a + 8, i = 0; u < b - 4; u += 16, i++) {
        const y = sag(u) + 3, tw = .55 + .45 * Math.sin(t * 3 + i * 1.7);
        c.fillStyle = bc[i % bc.length]; c.globalAlpha = .28 * tw; c.beginPath(); c.arc(u, y + 4, 7.5, 0, 6.3); c.fill();
        c.globalAlpha = 1; c.beginPath(); c.arc(u, y + 4, 3.2, 0, 6.3); c.globalAlpha = .55 + .45 * tw; c.fill(); c.globalAlpha = 1; c.lineWidth = 1; c.stroke();
      }
      return;
    }
    for (let u = a + 10, i = 0; u < b - 6; u += B.masks ? 26 : 20, i++) {
      const y = sag(u), sw = Math.sin(t * 1.7 + u * .07) * 1.6;
      if (B.masks) { c.beginPath(); c.moveTo(u, y); c.lineTo(u + sw * .3, y + 4); c.lineWidth = 1; c.stroke(); drawMask(c, u + sw * .3, y + 12, 7, mk[i % mk.length]); continue; }
      c.fillStyle = cols[i % cols.length];
      c.beginPath(); c.moveTo(u - 8, y); c.lineTo(u + 8, y); c.lineTo(u + sw, y + 15); c.closePath(); c.fill(); c.lineWidth = 1.1; c.stroke();
      c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.arc(u + sw * .3, y + 5, 1.6, 0, 6.3); c.fill();
    }
  });
}
// Pósters de lucha de la pared (cada uno tiene su lugar fijo)
const POSTERS = {
  p_camp:  { th: 'ring',   l1: '¡FUNCIÓN DE', l2: 'CAMPEONATO!', foot: 'SÁBADO 8 PM' },
  p_copa:  { th: 'blue',   l1: 'GRAN COPA',   l2: 'MÁSCARAS',    foot: 'DOMINGO' },
  p_noche: { th: 'black',  l1: 'NOCHE DE',    l2: 'LEYENDAS',    foot: 'VIERNES' },
  p_rudos: { th: 'pink',   l1: 'RUDOS VS',    l2: 'TÉCNICOS',    foot: 'LA REVANCHA' },
  p_arena: { th: 'novato', l1: 'LA GRAN',     l2: 'ARENA',       foot: '¡LLENO TOTAL!' }
};
function drawPoster(c, id, u, w, pw, ph) { const q = POSTERS[id]; drawWallPoster(c, u, w, pw, ph, MASKS[q.th], q.l1, q.l2, q.foot); }
// Póster y máscara de neón (exclusivos de gemas): prenden y parpadean
const neonFl = t => .78 + .22 * Math.sin(t * 9) * Math.sin(t * 3.1);
function drawNeonPoster(c, u, w, pw, ph, t) {
  const fl = neonFl(t);
  c.save(); c.shadowColor = '#5fe8ff'; c.shadowBlur = 12 * fl;
  c.fillStyle = '#0d0722'; c.fillRect(u, w, pw, ph); c.lineWidth = 2; c.strokeStyle = `rgba(95,232,255,${fl})`; c.strokeRect(u + 1.2, w + 1.2, pw - 2.4, ph - 2.4);
  c.shadowColor = '#ff3d8b'; c.save(); c.translate(u + pw / 2, w + ph / 2 - 4); c.scale(ph * .2, ph * .2); maskPath(c); c.lineWidth = .11; c.strokeStyle = `rgba(255,110,176,${fl})`; c.stroke();
  for (const m of [-1, 1]) { eyePath(c, m); c.lineWidth = .08; c.stroke(); }
  c.restore();
  txt(c, '¡LUCHA!', u + pw / 2, w + ph - 5, { font: `400 8px ${FONT_DISPLAY}`, align: 'center', color: `rgba(255,226,122,${fl})` });
  c.restore();
}
function drawNeonMask(c, u, w, t) {
  const fl = neonFl(t + 1.7), s = 21;
  c.save(); c.shadowColor = '#ff3d8b'; c.shadowBlur = 14 * fl; c.translate(u + 23, w + 26); c.scale(s, s);
  maskPath(c); c.lineWidth = .1; c.strokeStyle = `rgba(255,110,176,${fl})`; c.stroke();
  c.shadowColor = '#5fe8ff'; c.strokeStyle = `rgba(95,232,255,${fl})`;
  for (const m of [-1, 1]) { eyePath(c, m); c.lineWidth = .09; c.stroke(); }
  c.beginPath(); c.moveTo(-.3, .62); c.quadraticCurveTo(0, .48, .3, .62); c.quadraticCurveTo(0, .98, -.3, .62); c.stroke();
  star(c, 0, -.66, .24, .1); c.strokeStyle = `rgba(255,226,122,${fl})`; c.stroke();
  c.restore();
}
function drawWallPoster(c, u, w, pw, ph, th, l1, l2, foot) {
  c.fillStyle = '#fff0cc'; c.fillRect(u, w, pw, ph); c.lineWidth = 1.6; c.strokeStyle = P.ink; c.strokeRect(u, w, pw, ph);
  c.fillStyle = th.base; c.fillRect(u + 2.5, w + 2.5, pw - 5, 15);
  txt(c, l1, u + pw / 2, w + 9, { font: `700 6.6px ${FONT_UI}`, align: 'center', color: '#fff0cc', ls: .3 });
  txt(c, l2, u + pw / 2, w + 16, { font: `700 6.6px ${FONT_UI}`, align: 'center', color: P.gold, ls: .3 });
  drawMask(c, u + pw / 2, w + ph / 2 + 6, ph * .17, th);
  txt(c, foot, u + pw / 2, w + ph - 4, { font: `700 5.4px ${FONT_UI}`, align: 'center', color: P.ink, ls: .4 });
}
// Lona de colores de la fachada (la pared con la puerta): franjas inclinadas con volante festoneado
function drawAwning(c, w) {
  const A = AWNINGS[DECO.awning] || AWNINGS[''];
  if (!A.colors) return;
  c.lineJoin = 'round'; c.lineWidth = 1.3; c.strokeStyle = P.ink;
  for (let i = 0; i < COLS * 2; i++) {
    const x0 = i * .5, x1 = x0 + .5, col = A.colors[i % A.colors.length];
    isoPoly(c, [S(x0, 0, 107), S(x1, 0, 107), S(x1, .6, 95), S(x0, .6, 95)]); c.fillStyle = shade(col, .12); c.fill(); c.stroke();
    isoPoly(c, [S(x0, .6, 95), S(x1, .6, 95), S(x1, .6, 88), S(x0, .6, 88)]); c.fillStyle = col; c.fill(); c.stroke();
    isoPoly(c, [S(x0, .6, 88), S((x0 + x1) / 2, .6, 82), S(x1, .6, 88)]); c.fillStyle = col; c.fill(); c.stroke();
  }
}
function drawWalls(c, w) {
  const H = WALL_H, DH = DOOR.h, du0 = DOOR.hingeL * U, du1 = DOOR.hingeR * U, LR = COLS * U, LL = ROWS * U, t = w.t, E = .22;
  c.lineJoin = 'round'; c.lineWidth = 1.6; c.strokeStyle = P.ink;
  // grosor del muro: tapas y cantos
  isoPoly(c, [S(0, 0, H), S(COLS, 0, H), S(COLS, -E, H), S(0, -E, H)]); c.fillStyle = '#fbf7ee'; c.fill(); c.stroke();
  isoPoly(c, [S(COLS, 0, 0), S(COLS, -E, 0), S(COLS, -E, H), S(COLS, 0, H)]); c.fillStyle = '#cfc4b0'; c.fill(); c.stroke();
  isoPoly(c, [S(0, 0, H), S(0, ROWS, H), S(-E, ROWS, H), S(-E, 0, H)]); c.fillStyle = '#f3ecdd'; c.fill(); c.stroke();
  isoPoly(c, [S(0, ROWS, 0), S(-E, ROWS, 0), S(-E, ROWS, H), S(0, ROWS, H)]); c.fillStyle = '#e2d8c4'; c.fill(); c.stroke();
  isoPoly(c, [S(-E, -E, H), S(0, -E, H), S(0, 0, H), S(-E, 0, H)]); c.fillStyle = '#fbf7ee'; c.fill(); c.stroke();
  // jamba interior de la puerta
  isoPoly(c, [S(DOOR.hingeL, 0, 0), S(DOOR.hingeL, -E, 0), S(DOOR.hingeL, -E, DH), S(DOOR.hingeL, 0, DH)]); c.fillStyle = '#5a3a1e'; c.fill(); c.stroke();

  // ----- pared derecha (plano isoY = 0), con abertura de puerta -----
  const o = S(0, 0, H);
  c.save(); c.translate(o.x, o.y); c.transform(1, .5, 0, 1, 0, 0);
  paintWall(c, 0, du0, 0, H, LR); paintWall(c, du1, LR, 0, H, LR); paintWall(c, du0, du1, 0, H - DH, LR);
  c.lineWidth = 1.6; c.strokeStyle = P.ink;
  c.strokeRect(0, 0, du0, H); c.strokeRect(du1, 0, LR - du1, H);
  // marco de madera
  c.fillStyle = '#6b4423';
  c.fillRect(du0 - 5, H - DH, 5, DH); c.fillRect(du1, H - DH, 5, DH); c.fillRect(du0 - 5, H - DH - 4, du1 - du0 + 10, 6);
  c.strokeRect(du0 - 5, H - DH - 4, du1 - du0 + 10, 6);
  // letrero ABIERTO sobre la puerta
  const fl = .85 + .15 * Math.sin(t * 7) * Math.sin(t * 2.3);
  const shut = w.dayTime <= 0, nc = shut ? '255,90,90' : '90,255,150';                              // CERRADO a las 8 PM, ABIERTO el resto del día
  c.save(); c.shadowColor = shut ? '#ff3b3b' : '#3bff8a'; c.shadowBlur = 8 * fl;
  c.fillStyle = '#16072c'; rr(c, du0 + 6, 3, du1 - du0 - 12, 13, 3); c.fill(); c.lineWidth = 1.4; c.strokeStyle = `rgba(${nc},${shut ? .9 : fl})`; c.stroke();
  txt(c, shut ? 'CERRADO' : 'ABIERTO', (du0 + du1) / 2, 13, { font: `700 10px ${FONT_UI}`, align: 'center', color: `rgba(${shut ? '255,150,150' : '160,255,200'},${shut ? .9 : fl})`, ls: 1.5 });
  c.restore();
  const lona = !!(AWNINGS[DECO.awning] || AWNINGS['']).colors;
  if (!lona && DECO.bunting !== 'none') drawBunting(c, [[0, du0 - 8], [du1 + 8, LR]], t, DECO.bunting);     // con lona en la fachada se quitan los banderines
  if (DECO.on.p_camp) drawPoster(c, 'p_camp', 2.35 * U, 34, 46, 52);
  if (DECO.on.p_copa) drawPoster(c, 'p_copa', (DECO.remodeled ? COLS - 1.5 : .45) * U, 34, 46, 52);
  if (DECO.on.g_mask) drawNeonMask(c, 3.62 * U, 28, t);
  if (DECO.on.neon) {                                                                                // letrero de neón
    const ny = lona ? 24 : 10;
    c.save(); c.shadowColor = '#ff3d8b'; c.shadowBlur = 10 * fl;
    c.fillStyle = '#16072c'; rr(c, 6.5 * U, ny, 84, 38, 6); c.fill(); c.lineWidth = 2; c.strokeStyle = `rgba(255,95,162,${fl})`; c.stroke();
    txt(c, 'TAQUERÍA', 6.5 * U + 42, ny + 17, { font: `400 15px ${FONT_DISPLAY}`, align: 'center', color: `rgba(255,170,210,${fl})` });
    txt(c, 'EL RING', 6.5 * U + 42, ny + 32, { font: `400 14px ${FONT_DISPLAY}`, align: 'center', color: `rgba(255,220,120,${fl})` });
    c.restore();
  }
  c.restore();

  // ----- pared izquierda (plano isoX = 0): u crece hacia el vértice central -----
  const o2 = S(0, ROWS, H);
  c.save(); c.translate(o2.x, o2.y); c.transform(1, -.5, 0, 1, 0, 0);
  paintWall(c, 0, LL, 0, H, LL);
  c.fillStyle = 'rgba(50,10,30,.12)'; c.fillRect(0, 0, LL, H);
  c.lineWidth = 1.6; c.strokeStyle = P.ink; c.strokeRect(0, 0, LL, H);
  if (DECO.bunting !== 'none') drawBunting(c, [[0, LL]], t + 1.3, DECO.bunting);
  const up = (ROWS - 3) * U;                                       // altura del comal sobre la pared (iy = 3)
  if (DECO.on.menu) {
    c.fillStyle = P.ink; rr(c, up - 52, 30, 104, 16, 4); c.fill(); c.lineWidth = 1.4; c.strokeStyle = P.gold; c.stroke();
    txt(c, 'MENÚ CALLEJERO', up, 42, { font: `700 10px ${FONT_UI}`, align: 'center', color: P.gold, ls: .8 });
    [[up - 30, MASKS.ring], [up + 26, MASKS.novato]].forEach(([u, th]) => {
      c.strokeStyle = P.ink; c.lineWidth = 1.2; c.beginPath(); c.moveTo(u, 46); c.lineTo(u, 52); c.stroke();
      drawMask(c, u, 64, 9.5, th);
    });
  }
  if (DECO.on.p_noche) drawPoster(c, 'p_noche', .25 * U, 34, 46, 52);
  if (DECO.on.p_rudos) drawPoster(c, 'p_rudos', 1.5 * U, 34, 46, 52);
  if (DECO.on.g_poster) drawNeonPoster(c, 2.75 * U, 34, 46, 52, t);
  if (DECO.on.p_arena) drawPoster(c, 'p_arena', 6.5 * U, 34, 46, 52);
  c.restore();

  drawAwning(c, w);
  // arista del vértice
  c.strokeStyle = P.ink; c.lineWidth = 3.4; const a = S(0, 0, 0), b = S(0, 0, H);
  c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
  c.strokeStyle = '#f6f1e8'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
}

/* ---------- Muebles y utilería ---------- */
function drawTrompo(c, x, y, t) {
  const g = c.createRadialGradient(x - 24, y - 26, 3, x - 24, y - 26, 62);
  g.addColorStop(0, 'rgba(255,120,40,.35)'); g.addColorStop(1, 'rgba(255,120,40,0)');
  c.fillStyle = g; c.beginPath(); c.arc(x - 24, y - 26, 62, 0, 6.3); c.fill();
  c.fillStyle = '#9aa3b2'; c.fillRect(x - 2, y - 50, 4, 52);
  c.fillStyle = '#5b6170'; c.beginPath(); c.ellipse(x, y, 22, 8, 0, 0, 6.3); c.fill(); c.strokeStyle = P.ink; c.lineWidth = 2; c.stroke();
  const layers = 9;
  for (let i = 0; i < layers; i++) {
    const f = i / layers, ly = y - 4 - i * 4.6, wd = lerp(21, 8, f);
    c.fillStyle = i % 2 ? '#b23d1f' : '#d2602d';
    rr(c, x - wd, ly - 4.6, wd * 2, 5.2, 2.5); c.fill();
    c.fillStyle = 'rgba(255,220,160,.5)';
    c.fillRect(x - wd + ((Math.sin(t * 1.4 + i) + 1) / 2) * wd * 1.8, ly - 3.6, 3, 3.2);
  }
  c.lineWidth = 2; c.strokeStyle = P.ink; c.beginPath(); c.moveTo(x - 21, y - 4); c.lineTo(x - 8, y - 46); c.lineTo(x + 8, y - 46); c.lineTo(x + 21, y - 4); c.stroke();
  c.fillStyle = '#ffd24a'; c.beginPath(); c.ellipse(x, y - 52, 9, 8, 0, 0, 6.3); c.fill(); c.stroke();
  c.fillStyle = '#3fb04f'; for (const a of [-.6, 0, .6]) { c.save(); c.translate(x, y - 58); c.rotate(a); c.beginPath(); c.ellipse(0, -5, 2.4, 6, 0, 0, 6.3); c.fill(); c.restore(); }
}
function flame(c, x, y, h) {
  c.fillStyle = '#ff8a3d'; c.beginPath(); c.moveTo(x - 4, y); c.quadraticCurveTo(x, y - h * 1.5, x + 4, y); c.fill();
  c.fillStyle = '#ffe27a'; c.beginPath(); c.moveTo(x - 2, y); c.quadraticCurveTo(x, y - h, x + 2, y); c.fill();
}

/* ---------- Mobiliario: cada pieza se dibuja respecto a su esquina (c, r) ---------- */
function counterBox(c, it, col, h = 34) {                        // mostrador / base de una pieza
  const d = FURN[it.type];
  isoBox(c, it.c + .04, it.r + .08, it.c + d.fw - .04, it.r + d.fh - .08, 0, h, col);
}
const CT_WOOD = { top: '#c98b4e', left: '#b5482f', right: '#8f3624' };

function drawComalItem(c, w, it) {
  const t = w.t, s = it.slot, i = LAYOUT.comals.indexOf(it);
  const x0 = it.c + .04, x1 = it.c + 1.96, y1 = it.r + .92;
  counterBox(c, it, { top: '#3a3d48', left: '#2f323c', right: '#262830' });                                  // fogón
  isoPoly(c, [S(x0 + .2, y1, 5), S(x1 - .2, y1, 5), S(x1 - .2, y1, 22), S(x0 + .2, y1, 22)]); c.fillStyle = '#150806'; c.fill();
  for (let k = 0; k < 5; k++) { const f = S(x0 + .32 + k * .32, y1, 5); flame(c, f.x, f.y, 8 + Math.sin(t * 9 + k * 1.7 + (i < 0 ? 0 : i) * 2) * 3); }
  const p = S(it.c + 1, it.r + .5, 36), rx = .9 * TW * .7071, ry = .9 * TH * .7071;
  if (s.state === 'cook') { c.fillStyle = 'rgba(255,140,60,.2)'; c.beginPath(); c.ellipse(p.x, p.y + 4, rx + 14, ry + 8, 0, 0, 6.3); c.fill(); }
  c.lineWidth = 2.2; c.strokeStyle = P.ink;
  c.fillStyle = '#23252c'; c.fillRect(p.x - rx, p.y, rx * 2, 4); c.beginPath(); c.ellipse(p.x, p.y + 4, rx, ry, 0, 0, Math.PI); c.fill();
  const g = c.createLinearGradient(p.x - rx, p.y - ry, p.x + rx, p.y + ry);
  g.addColorStop(0, '#8b909e'); g.addColorStop(.5, '#4b4f5c'); g.addColorStop(1, '#2f323c');
  c.beginPath(); c.ellipse(p.x, p.y, rx, ry, 0, 0, 6.3); c.fillStyle = g; c.fill(); c.stroke();
  c.strokeStyle = 'rgba(255,255,255,.3)'; c.lineWidth = 1.6; c.beginPath(); c.ellipse(p.x, p.y, rx - 5, ry - 3, 0, Math.PI * 1.05, Math.PI * 1.55); c.stroke();
  if (s.state === 'empty') {
    c.strokeStyle = 'rgba(255,255,255,.2)'; c.lineWidth = 1.4; c.setLineDash([3, 3]);
    c.beginPath(); c.ellipse(p.x, p.y, 16, 8, 0, 0, 6.3); c.stroke(); c.setLineDash([]);
    if (LAYOUT.comals.length > 1 && i >= 0) txt(c, String(i + 1), p.x, p.y + 4, { font: `700 12px ${FONT_UI}`, align: 'center', color: 'rgba(255,255,255,.35)' });
  } else {                                                     // en cocción: el platillo sobre el comal + anillo de progreso
    const rec = RECIPES[s.dish], n = Math.min(rec.yield, 5);
    for (let k = 0; k < n; k++) {
      const ang = k / n * 6.283 + t * .3, ox = Math.cos(ang) * 17, oy = Math.sin(ang) * 8;
      c.fillStyle = '#e7c46a'; c.strokeStyle = P.ink; c.lineWidth = 1.1; c.beginPath(); c.ellipse(p.x + ox, p.y + oy, 5.5, 3, 0, 0, 6.3); c.fill(); c.stroke();
    }
    const pr = s.t / rec.time;
    c.fillStyle = 'rgba(27,16,48,.75)'; c.beginPath(); c.arc(p.x, p.y - 19, 12.5, 0, 6.3); c.fill();
    drawDish(c, s.dish, p.x, p.y - 19, 5.2);
    c.lineWidth = 3; c.strokeStyle = 'rgba(255,255,255,.2)'; c.beginPath(); c.arc(p.x, p.y - 19, 11, 0, 6.3); c.stroke();
    c.strokeStyle = P.gold; c.beginPath(); c.arc(p.x, p.y - 19, 11, -Math.PI / 2, -Math.PI / 2 + pr * 6.283); c.stroke();
  }
}

// Barra de comida lista: una pila por platillo
function drawBarItem(c, w, it) {
  counterBox(c, it, CT_WOOD);
  const o = S(it.c + .04, it.r + .92, 34); c.save(); c.translate(o.x, o.y); c.transform(1, .5, 0, 1, 0, 0);
  txt(c, 'COMIDA LISTA', 1.5 * U, 21, { font: `700 9px ${FONT_UI}`, align: 'center', color: 'rgba(255,240,210,.8)', ls: 1 });
  c.restore();
  FOODS.forEach((k, i) => {
    const q = barSlot(i), p = S(it.c + q[0], it.r + q[1], 34);              // (se dibuja sin girar: withMirror se encarga)
    if (RECIPES[k].level > w.level && w.stock[k] === 0) return;                          // todavía bloqueado: sin lugar marcado
    if (w.stock[k] > 0) drawStack(c, k, w.stock[k], p.x, p.y);
    else {
      c.strokeStyle = 'rgba(255,255,255,.28)'; c.lineWidth = 1.3; c.setLineDash([3, 3]);
      c.beginPath(); c.ellipse(p.x, p.y, 12, 6, 0, 0, 6.3); c.stroke(); c.setLineDash([]);
      c.save(); c.globalAlpha = .3; drawDish(c, k, p.x, p.y - 3, 5); c.restore();
    }
  });
}

function drawFridge(c, w, it) {
  const x0 = it.c + .12, x1 = it.c + .9, y0 = it.r + .08, y1 = it.r + .72, H = FURN.fridge.h;
  isoBox(c, x0, y0, x1, y1, 0, H, { top: '#5d8be6', left: '#2a62c9', right: '#1f4a9c' });
  const o = S(x0, y1, H), uw = (x1 - x0) * U;
  c.save(); c.translate(o.x, o.y); c.transform(1, .5, 0, 1, 0, 0);
  c.fillStyle = '#bfe3ff'; rr(c, 3, 6, uw - 6, H - 22, 3); c.fill(); c.lineWidth = 1.4; c.strokeStyle = P.ink; c.stroke();
  ['#e0364a', '#ffc83d', '#2fbf71', '#ff8a3d', '#8b5cf6'].forEach((col, i) => { c.fillStyle = col; rr(c, 5.5 + i * 4.6, 12, 3.6, 17, 1.4); c.fill(); rr(c, 5.5 + i * 4.6, 33, 3.6, 17, 1.4); c.fill(); });
  txt(c, 'BEBIDAS', uw / 2, H - 6, { font: `700 6px ${FONT_UI}`, align: 'center', color: P.white, ls: .6 });
  c.restore();
  // rótulo y estado de preparación sobre el refrigerador (aquí se hacen las micheladas)
  const tag = S(it.c + .51, it.r + .4, H + 11);
  c.fillStyle = P.ink; rr(c, tag.x - 29, tag.y - 7, 58, 14, 5); c.fill(); c.lineWidth = 1.3; c.strokeStyle = '#5fd0ff'; c.stroke();
  txt(c, 'MICHELADAS', tag.x, tag.y + 3.5, { font: `700 9.5px ${FONT_UI}`, align: 'center', color: '#bfeaff', ls: .6 });
  if (LAYOUT.fridge === it && !LAYOUT.drinks) {                      // sin mostrador de bebidas: las micheladas listas quedan al pie del refri
    const dp = S(it.c + .5, it.r + .9, 6), n = w.stock.michelada;
    if (n > 0) drawStack(c, 'michelada', n, dp.x, dp.y);
  }
  const rp = S(it.c + .5, it.r + .45, H + 34);
  it.slots.forEach((s, i) => {
    if (s.state !== 'cook') return;
    const sp = { x: rp.x + (i ? 15 : -15), y: rp.y }, pr = s.t / RECIPES[s.dish].time;
    c.fillStyle = 'rgba(27,16,48,.8)'; c.beginPath(); c.arc(sp.x, sp.y, 12.5, 0, 6.3); c.fill();
    drawDish(c, s.dish, sp.x, sp.y, 5.2);
    c.lineWidth = 3; c.strokeStyle = 'rgba(255,255,255,.2)'; c.beginPath(); c.arc(sp.x, sp.y, 11, 0, 6.3); c.stroke();
    c.strokeStyle = '#5fd0ff'; c.beginPath(); c.arc(sp.x, sp.y, 11, -Math.PI / 2, -Math.PI / 2 + pr * 6.283); c.stroke();
  });
}

// Mostrador de bebidas: aquí quedan las micheladas listas
function drawDrinks(c, w, it) {
  isoBox(c, it.c + .12, it.r + .1, it.c + .88, it.r + .8, 0, 34, { top: '#c98b4e', left: '#2a62c9', right: '#1f4a9c' });
  const p = S(it.c + .5, it.r + .5, 34), n = w.stock.michelada;
  if (n > 0) drawStack(c, 'michelada', n, p.x, p.y);
  else {
    c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1.3; c.setLineDash([3, 3]);
    c.beginPath(); c.ellipse(p.x, p.y, 13, 6.5, 0, 0, 6.3); c.stroke(); c.setLineDash([]);
    c.save(); c.globalAlpha = .3; drawDish(c, 'michelada', p.x, p.y - 3, 5.5); c.restore();
  }
}

// Banca de dos lugares con suero: aquí descansan el Novato y el mesero
function drawBench(c, w, it) {
  const x0 = it.c + .1, x1 = it.c + 1.9;
  isoBox(c, x0, it.r + .08, x1, it.r + .18, 16, 42, { top: '#d8a25f', left: '#a8703a', right: '#8a5a2c' });          // respaldo
  c.strokeStyle = '#4a3320'; c.lineWidth = 3; c.lineCap = 'round';
  [[x0 + .1, it.r + .35], [x1 - .1, it.r + .35], [x0 + .1, it.r + .78], [x1 - .1, it.r + .78], [it.c + 1, it.r + .35], [it.c + 1, it.r + .78]].forEach(([lx, ly]) => { const a = S(lx, ly, 0), b = S(lx, ly, 14); c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); });
  isoBox(c, x0, it.r + .26, x1, it.r + .86, 14, 19, { top: '#c98b4e', left: '#8f5a2c', right: '#6e4220' });          // asiento largo
  for (let k = 0; k < 6; k++) { const p = S(it.c + .3 + k * .28, it.r + .13, 42); drawDish(c, 'suero', p.x, p.y - 7, 6.5); }    // botellas de suero
  const o = S(x0, it.r + .18, 40); c.save(); c.translate(o.x, o.y); c.transform(1, .5, 0, 1, 0, 0);
  c.fillStyle = '#16072c'; rr(c, 14, -1, 1.8 * U - 28, 11, 3); c.fill(); c.lineWidth = 1.1; c.strokeStyle = '#5fd0ff'; c.stroke();
  txt(c, 'VESTIDOR · SUERO', .9 * U, 7.5, { font: `700 7px ${FONT_UI}`, align: 'center', color: '#bfeaff', ls: .5 });
  c.restore();
  const nv = w.novato;                                                                              // aviso: botella saltarina cuando alguien anda cansado
  if (LAYOUT.bench === it && !nv.resting && (nv.stamina < maxStamina(w) * .35 || nv.furia)) {
    const p = S(it.c + 1, it.r + .4, 84), b = Math.sin(w.t * 6) * 3;
    c.fillStyle = 'rgba(13,7,32,.85)'; rr(c, p.x - 16, p.y - 14 + b, 32, 28, 8); c.fill(); c.lineWidth = 1.6; c.strokeStyle = '#5fd0ff'; c.stroke();
    drawDish(c, 'suero', p.x, p.y + b - 1, 9);
  }
}

function drawPlant(c, it) {
  const p = S(it.c + .5, it.r + .5);
  c.fillStyle = 'rgba(0,0,0,.2)'; c.beginPath(); c.ellipse(p.x, p.y + 2, 22, 8, 0, 0, 6.3); c.fill();
  c.lineWidth = 2; c.strokeStyle = P.ink;
  [[-12, -44, -.5], [12, -46, .5], [0, -56, 0], [-6, -38, -.9], [8, -38, .9]].forEach(([dx, dy, rot]) => {
    c.save(); c.translate(p.x + dx * .5, p.y - 14 + dy * .35); c.rotate(rot); c.fillStyle = '#2f8f4e';
    c.beginPath(); c.ellipse(0, -14, 6, 18, 0, 0, 6.3); c.fill(); c.stroke(); c.restore();
  });
  c.fillStyle = '#c4492a'; c.beginPath(); c.moveTo(p.x - 13, p.y - 22); c.lineTo(p.x + 13, p.y - 22); c.lineTo(p.x + 9, p.y); c.lineTo(p.x - 9, p.y); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#ffc83d'; c.fillRect(p.x - 12, p.y - 20, 24, 3);
}
function drawTrompoItem(c, w, it) {                              // trompo de pastor sobre un mostrador de 1 loseta
  counterBox(c, it, CT_WOOD);
  const p = S(it.c + .5, it.r + .5, 34); drawTrompo(c, p.x, p.y, w.t);
}
function drawCajaItem(c, it) {                                   // caja registradora sobre un mostrador de 1 loseta
  counterBox(c, it, CT_WOOD);
  isoBox(c, it.c + .22, it.r + .28, it.c + .74, it.r + .72, 34, 46, { top: '#e8dcc0', left: '#cdbf9c', right: '#a99a78' });
  const d = S(it.c + .74, it.r + .5, 46); c.fillStyle = '#2a8f96'; rr(c, d.x - 5, d.y - 12, 10, 9, 2); c.fill(); c.lineWidth = 1.3; c.strokeStyle = P.ink; c.stroke();
}

// Estatua de luchador (exclusiva de gemas): luchador dorado sobre un pedestal de mármol, con destellos
function drawStatueItem(c, w, it) {
  isoBox(c, it.c + .1, it.r + .1, it.c + .9, it.r + .9, 0, 16, { top: '#ece8f6', left: '#bdb7d0', right: '#8f89a8' }, 1.6);
  const p = S(it.c + .5, it.r + .5, 16), t = w.t;
  const g = c.createRadialGradient(p.x, p.y - 36, 4, p.x, p.y - 36, 58); g.addColorStop(0, `rgba(255,214,90,${.28 + .1 * Math.sin(t * 2)})`); g.addColorStop(1, 'rgba(255,214,90,0)');
  c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y - 36, 58, 0, 6.3); c.fill();
  drawLuchador(c, p.x, p.y + 2, { hoodie: '#e3b53a', mask: 'oro', shoes: 'amarillo', skin: '#d9a52e', state: 'idle', t: 0, dir: 1, scale: .98 });
  for (let k = 0; k < 3; k++) {                                       // destellos
    const a = Math.max(0, Math.sin(t * 2.4 + k * 2.1)), sx = p.x + Math.cos(k * 2.4 + 1) * 15, sy = p.y - 30 - k * 14;
    c.fillStyle = `rgba(255,255,255,${a})`; star(c, sx, sy, 2 + 4 * a, 1, 4); c.fill();
  }
  const pl = S(it.c + .5, it.r + .9, 8);                              // placa dorada del pedestal
  c.fillStyle = '#ffd24a'; rr(c, pl.x - 9, pl.y - 4, 18, 8, 2); c.fill(); c.lineWidth = 1; c.strokeStyle = P.ink; c.stroke();
}
// Vitrina del campeón (exclusiva de gemas): cinturón dorado dentro de un cristal
function drawVitrinaItem(c, w, it) {
  isoBox(c, it.c + .1, it.r + .1, it.c + .9, it.r + .9, 0, 22, { top: '#7a4a2a', left: '#5a331c', right: '#44261a' }, 1.6);
  const p = S(it.c + .5, it.r + .5, 36);
  c.fillStyle = '#7a1f3b'; rr(c, p.x - 20, p.y - 5, 40, 11, 3); c.fill(); c.lineWidth = 1.4; c.strokeStyle = P.ink; c.stroke();
  c.fillStyle = '#ffd24a'; c.beginPath(); c.ellipse(p.x, p.y, 11, 8.5, 0, 0, 6.3); c.fill(); c.stroke();
  c.fillStyle = '#e0364a'; c.beginPath(); c.arc(p.x, p.y, 3.4, 0, 6.3); c.fill();
  star(c, p.x, p.y, 7, 3, 5); c.lineWidth = .8; c.stroke();
  const gl = a => `rgba(${a},.28)`;
  isoBox(c, it.c + .12, it.r + .12, it.c + .88, it.r + .88, 22, 62, { top: gl('215,240,255'), left: gl('150,205,245'), right: gl('110,170,225') }, 1.4);
  const sh = (Math.sin(w.t * 1.6) + 1) / 2;
  c.strokeStyle = `rgba(255,255,255,${.25 + .35 * sh})`; c.lineWidth = 2; const a = S(it.c + .2, it.r + .88, 30), b = S(it.c + .2, it.r + .88, 54);
  c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
}

function drawChair(c, s) {
  const cx = s.gx, cy = s.gy, seat = () => isoBox(c, cx - .26, cy - .26, cx + .26, cy + .26, 13, 17, { top: '#ffc43a', left: '#ffb21e', right: '#d98f00' });
  c.fillStyle = 'rgba(0,0,0,.18)'; isoEllipse(c, cx, cy, 0, .4); c.fill();
  c.strokeStyle = '#5a3a00'; c.lineWidth = 3; c.lineCap = 'round';
  [[-.2, -.2], [.2, -.2], [-.2, .2], [.2, .2]].forEach(([dx, dy]) => { const a = S(cx + dx, cy + dy, 0), b = S(cx + dx, cy + dy, 14); c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); });
  const bo = s.outer < 0 ? -.3 : .3, rot = s.tb && s.tb.rot;               // el respaldo queda en el extremo de la mesa
  const back = () => rot ? isoBox(c, cx - .24, cy + bo - .04, cx + .24, cy + bo + .04, 17, 46, { top: '#ffcb4d', left: '#ffb21e', right: '#d98f00' })
    : isoBox(c, cx + bo - .04, cy - .24, cx + bo + .04, cy + .24, 17, 46, { top: '#ffcb4d', left: '#ffb21e', right: '#d98f00' });
  if (s.outer < 0) { back(); seat(); } else { seat(); back(); }
}

function drawTableDown(c, tb) {                                  // mesa volteada por El Payaso Maniático: gira hasta quedar de costado
  const tc = tb.c + 1, x0 = tc + .08, x1 = tc + 1.92, y0 = tb.r + .1, y1 = tb.r + .9, yf = y1 + .12;
  const p = clamp((tb.downT || 0) / .35, 0, 1), e = p * p * (3 - 2 * p);
  const flat = [[x0, y0, 30], [x1, y0, 30], [x1, y1, 30], [x0, y1, 30]], fall = [[x0, yf, 2], [x1, yf, 2], [x1, yf, 34], [x0, yf, 34]];
  const pts = flat.map((f, i) => S(lerp(f[0], fall[i][0], e), lerp(f[1], fall[i][1], e), lerp(f[2], fall[i][2], e)));
  c.fillStyle = 'rgba(0,0,0,.2)'; isoPoly(c, [S(x0 - .1, y0, 0), S(x1 + .2, y0, 0), S(x1 + .2, yf + .45, 0), S(x0 - .1, yf + .45, 0)]); c.fill();
  c.lineJoin = 'round'; c.strokeStyle = '#4a3320'; c.lineWidth = 3; c.lineCap = 'round';
  for (const lx of [x0 + .2, x1 - .2]) for (const lz of [8, 26]) {                                // patas hacia el frente
    const a = S(lx, lerp(y0 + .15, yf, e), lerp(30, lz, e)), b = S(lx, lerp(y0 + .15, yf + .42, e), lerp(22, lz, e));
    c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
  }
  isoPoly(c, pts); c.fillStyle = '#fff4e6'; c.fill(); c.lineWidth = 2; c.strokeStyle = P.ink; c.stroke();
  c.strokeStyle = 'rgba(224,54,74,.6)'; c.lineWidth = 3;
  for (let k = 1; k < 7; k++) { const f = k / 7, a = pts[0], b = pts[1], d = pts[3], g = pts[2]; c.beginPath(); c.moveTo(lerp(a.x, b.x, f), lerp(a.y, b.y, f)); c.lineTo(lerp(d.x, g.x, f), lerp(d.y, g.y, f)); c.stroke(); }
}
function drawTable(c, tb, w) {                                   // la mesa y sus platos; girada, la geometría se pinta espejada y los platos van en su sitio real
  if (tb.down > 0) { withMirror(c, tb, () => drawTableDown(c, tb)); return; }
  withMirror(c, tb, () => drawTableBody(c, tb));
  tb.seats.forEach(s => {                                          // platos de los que están comiendo
    const cu = s.customer;
    if (!cu) return;
    const sg = (s.outer < 0 ? 1 : -1) * (tb.rot ? -1 : 1);          // hacia dónde se acomoda el segundo plato (michelada)
    cu.served.forEach((key, k) => {                                // lo que ya se le sirvió; lo segundo (michelada) va al lado
      if (cu.state === 'eat' && cu.eatT > EAT_TIME * .85 && k === 0) return;
      drawPortionPlate(c, key, s.plate.x + k * 19 * sg, s.plate.y + k * 3, .9, false, 0);
    });
  });
}
function drawTableBody(c, tb) {                                  // sin girar, tb.c es la silla izquierda: la mesa ocupa las losetas tb.c+1 y tb.c+2
  const tc = tb.c + 1, x0 = tc + .08, x1 = tc + 1.92, y0 = tb.r + .1, y1 = tb.r + .9, z = 30;
  c.fillStyle = 'rgba(0,0,0,.2)'; isoPoly(c, [S(x0 - .1, y0 + .1, 0), S(x1 + .18, y0 + .1, 0), S(x1 + .18, y1 + .2, 0), S(x0 - .1, y1 + .2, 0)]); c.fill();
  c.strokeStyle = '#4a3320'; c.lineWidth = 3; c.lineCap = 'round';
  [[x0 + .2, y0 + .15], [x1 - .2, y0 + .15], [x0 + .2, y1 - .15], [x1 - .2, y1 - .15]].forEach(([lx, ly]) => { const a = S(lx, ly, 0), b = S(lx, ly, 8); c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); });
  isoBox(c, x0, y0, x1, y1, 8, z, { top: '#fff4e6', left: '#d9374a', right: '#a92a3a' }, 2);       // mantel de plástico colgante
  c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 2;
  for (let x = x0 + .15; x < x1; x += .3) { const a = S(x, y1, 11), b = S(x, y1, z - 2); c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); }
  // gingham sobre la cubierta (plano de losetas)
  const o = S(x0, y0, z);
  c.save(); c.translate(o.x, o.y); c.transform(TW / 2, TH / 2, -TW / 2, TH / 2, 0, 0);
  const wd = x1 - x0, ht = y1 - y0;
  c.fillStyle = 'rgba(224,54,74,.55)';
  for (let i = 0; i * .2 < wd; i += 2) c.fillRect(i * .2, 0, Math.min(.2, wd - i * .2), ht);
  for (let j = 0; j * .2 < ht; j += 2) c.fillRect(0, j * .2, wd, Math.min(.2, ht - j * .2));
  c.restore();
  c.fillStyle = 'rgba(255,255,255,.3)'; isoPoly(c, [S(x0 + .15, y0 + .05, z), S(x0 + .55, y0 + .05, z), S(x0 + .35, y1 - .05, z), S(x0 + .05, y1 - .05, z)]); c.fill();
  isoPoly(c, [S(x0, y0, z), S(x1, y0, z), S(x1, y1, z), S(x0, y1, z)]); c.lineWidth = 2; c.strokeStyle = P.ink; c.stroke();
  // servilletero y salsa
  isoBox(c, tc + .92, tb.r + .38, tc + 1.08, tb.r + .58, z, z + 8, { top: '#dfe2ea', left: '#c9ccd6', right: '#a9acb8' }, 1.2);
  const sb = S(tc + 1.2, tb.r + .5, z); c.fillStyle = '#c4272f'; rr(c, sb.x - 3, sb.y - 14, 6, 14, 2.5); c.fill(); c.lineWidth = 1.3; c.strokeStyle = P.ink; c.stroke();
}

// Dibuja una pieza (las mesas se reparten en tres entradas para ordenar las sillas por profundidad)
function drawFurn(c, w, it) {
  withMirror(c, it, () => {
    switch (it.type) {
      case 'comal': drawComalItem(c, w, it); break;
      case 'bar': drawBarItem(c, w, it); break;
      case 'fridge': drawFridge(c, w, it); break;
      case 'drinks': drawDrinks(c, w, it); break;
      case 'bench': drawBench(c, w, it); break;
      case 'plant': drawPlant(c, it); break;
      case 'trompo': drawTrompoItem(c, w, it); break;
      case 'caja': drawCajaItem(c, it); break;
      case 'estatua': drawStatueItem(c, w, it); break;
      case 'vitrina': drawVitrinaItem(c, w, it); break;
    }
  });
}
const furnDepth = it => { const d = dimsOf(it); return it.type === 'bench' ? it.c + it.r + .9 : it.c + it.r + (d.fw + d.fh) / 2; };   // (la banca va detrás de quien se sienta)

function drawDoorLeaves(c, a) {                                // dos hojas batientes en 3D (suben desde z=12 hasta z=68)
  const z0 = 12, z1 = 72, L = DOOR.leaf, ang = clamp(a, -1.35, 1.35) * 1.05;
  for (const side of [-1, 1]) {
    const hx = side < 0 ? DOOR.hingeL : DOOR.hingeR, dx = -side;
    const fx = hx + dx * L * Math.cos(ang), fy = Math.sin(ang) * L;
    const A = S(hx, 0, z0), B = S(fx, fy, z0), C = S(fx, fy, z1), D = S(hx, 0, z1);
    const sh = clamp(Math.abs(ang) * .3, 0, .35);
    const g = c.createLinearGradient(A.x, 0, B.x, 0);
    g.addColorStop(0, '#a56a2c'); g.addColorStop(1, shade('#8a5524', -sh));
    isoPoly(c, [A, B, C, D]); c.fillStyle = g; c.fill(); c.lineWidth = 2; c.strokeStyle = P.ink; c.stroke();
    c.strokeStyle = 'rgba(27,16,48,.5)'; c.lineWidth = 1.4;
    for (let i = 1; i < 5; i++) {
      const f = i / 5, l = S(hx, 0, lerp(z0, z1, f)), r = S(fx, fy, lerp(z0, z1, f));
      c.beginPath(); c.moveTo(l.x, l.y); c.lineTo(r.x, r.y); c.stroke();
    }
    const k = S(lerp(hx, fx, .88), lerp(0, fy, .88), (z0 + z1) / 2);
    c.fillStyle = P.gold; c.beginPath(); c.arc(k.x, k.y, 2.4, 0, 6.3); c.fill();
  }
}

/* ---------- Arena: cuadrilátero central con dos luchadores de utilería ---------- */
function drawRing(c, w) {
  const g = ARENA.ring, x0 = g.c + .06, y0 = g.r + .06, x1 = g.c + g.w - .06, y1 = g.r + g.h - .06, ZP = 12, t = w.t, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  c.fillStyle = 'rgba(0,0,0,.25)'; isoPoly(c, [S(x0 - .1, y0 - .1, 0), S(x1 + .25, y0 - .1, 0), S(x1 + .25, y1 + .3, 0), S(x0 - .1, y1 + .3, 0)]); c.fill();
  isoBox(c, x0, y0, x1, y1, 0, ZP, { top: '#2f56c9', left: '#c4272f', right: '#8f1c26' }, 2);        // lona azul sobre faldón rojo
  c.lineWidth = 3; c.strokeStyle = 'rgba(255,255,255,.55)';
  isoPoly(c, [S(x0 + .16, y0 + .16, ZP), S(x1 - .16, y0 + .16, ZP), S(x1 - .16, y1 - .16, ZP), S(x0 + .16, y1 - .16, ZP)]); c.stroke();
  const mc = S(cx, cy, ZP);
  c.fillStyle = '#ffc83d'; c.beginPath(); c.ellipse(mc.x, mc.y, 44, 22, 0, 0, 6.3); c.fill();
  c.fillStyle = '#e0364a'; c.beginPath(); c.ellipse(mc.x, mc.y, 34, 17, 0, 0, 6.3); c.fill();
  c.save(); c.translate(mc.x, mc.y); c.scale(1, .5); drawMask(c, 0, 0, 13, MASKS.blue); c.restore();     // emblema de la lona
  const rope = (a, b) => [20, 32, 44].forEach((h, i) => {
    const A = S(a[0], a[1], ZP + h), B = S(b[0], b[1], ZP + h);
    c.lineCap = 'round'; c.strokeStyle = P.ink; c.lineWidth = 5.2; c.beginPath(); c.moveTo(A.x, A.y); c.lineTo(B.x, B.y); c.stroke();
    c.strokeStyle = i === 1 ? '#e0364a' : '#ffffff'; c.lineWidth = 2.6; c.beginPath(); c.moveTo(A.x, A.y); c.lineTo(B.x, B.y); c.stroke();
  });
  const post = p => {
    isoBox(c, p[0] - .07, p[1] - .07, p[0] + .07, p[1] + .07, ZP, ZP + 54, { top: '#c9ceda', left: '#7a8090', right: '#555b6b' }, 1.4);
    isoBox(c, p[0] - .1, p[1] - .1, p[0] + .1, p[1] + .1, ZP + 14, ZP + 48, { top: '#ff6a78', left: '#c81e3c', right: '#8f1530' }, 1.4);   // almohadillas
  };
  const A = [x0, y0], B = [x1, y0], C = [x1, y1], D = [x0, y1];
  rope(A, B); rope(A, D); post(A);                                                                 // lo que queda atrás
  const hop = k => Math.abs(Math.sin(t * 4 + k)) * 5, fighters = [
    { look: { hoodie: '#d6342c', mask: 'rayo', shoes: 'blanco', skin: '#e0ac69' }, p: S(cx - .5, cy + .15, ZP), dir: 1, k: 0 },
    { look: { hoodie: '#3b5bdb', mask: 'oro', shoes: 'amarillo', skin: '#c68642' }, p: S(cx + .45, cy - .15, ZP), dir: -1, k: 1.7 }];
  fighters.sort((a, b) => a.p.y - b.p.y).forEach(f => drawLuchador(c, f.p.x, f.p.y - hop(f.k), Object.assign({}, f.look, { state: 'walk', t: t * 2.4 + f.k, dir: f.dir, scale: .86, angry: true })));
  const pulse = (t % 2.4) / 2.4;                                                                    // ¡PUM! de utilería entre los dos
  if (pulse < .3) { const sp = S(cx, cy, ZP + 60), k = pulse / .3; c.fillStyle = '#ffe27a'; c.strokeStyle = P.ink; c.lineWidth = 1.6; star(c, sp.x, sp.y - k * 8, 10 + k * 8, 4.5, 8); c.fill(); c.stroke(); }
  post(B); post(D); rope(B, C); rope(D, C); post(C);                                                // lo que queda delante
}

/* ---------- Actores y globos ---------- */
function drawCustomer(c, cu, w) {
  const slam = cu.state === 'slam', rage = cu.state === 'rage', sp = slam ? slamPos(w, cu) : null;
  const p = slam ? sp : actorPos(cu, cu.seated), eating = cu.state === 'eat', sc = cu.vip ? cu.vd.scale : 1;
  if (cu.z) p.y -= cu.z;                                                                           // en el aire (vuelo del Místico)
  if (cu.z > 1) { c.fillStyle = 'rgba(0,0,0,.22)'; const g0 = actorPos(cu); c.beginPath(); c.ellipse(g0.x, g0.y + 2, 18 * Math.max(.5, 1 - cu.z / 160), 6, 0, 0, 6.3); c.fill(); }
  c.save(); c.globalAlpha = cu.alpha;
  if (slam) { c.translate(p.x, p.y); c.rotate(sp.rot); c.translate(-p.x, -p.y); }                 // levantado y azotado
  else if (cu.spin) { c.translate(p.x, p.y - 30); c.rotate(cu.spin); c.translate(-p.x, -(p.y - 30)); }
  const opts = Object.assign({}, cu.look, {
    state: slam ? (sp.air ? 'walk' : 'idle') : eating ? 'eat' : cu.moving ? 'walk' : 'idle',
    t: slam ? cu.slamT * 1.6 : eating ? cu.eatT : cu.moving ? cu.phase : w.t + cu.off,
    dir: cu.dir, seated: cu.seated, scale: sc,
    tacosLeft: 3 - Math.floor(cu.eatT / EAT_TIME * 3), eatKey: cu.served[0],
    angry: cu.angry || (cu.state === 'wait' && cu.patience / cu.pmax < .3)
  });
  if (rage) {                                                                                      // el VIP furioso parpadea en rojo
    const pulse = .5 + .5 * Math.sin(w.t * 16);
    c.fillStyle = `rgba(255,40,40,${.16 + .2 * pulse})`; c.beginPath(); c.ellipse(p.x, p.y - 30, 38, 54, 0, 0, 6.3); c.fill();
    drawTinted(c, p.x, p.y, opts, .15 + .5 * pulse);
  } else drawLuchador(c, p.x, p.y, opts);
  c.restore();
  if (rage && cu.rage.kind === 'payaso' && cu.rage.stage >= 1 && cu.rage.stage <= 3) {             // lleva una silla en alto
    const R = cu.rage, swing = R.stage === 3 && !R.hit ? -1.1 + R.t * 9 : R.stage === 3 ? .6 : -.5;
    c.save(); c.translate(p.x + cu.dir * 16, p.y - 76); c.rotate(swing * cu.dir);
    c.lineJoin = 'round'; c.lineWidth = 2; c.strokeStyle = P.ink; c.fillStyle = '#ffb21e';
    rr(c, -11, -3, 22, 8, 3); c.fill(); c.stroke(); rr(c, -11, -22, 7, 19, 3); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(-8, 5); c.lineTo(-8, 15); c.moveTo(8, 5); c.lineTo(8, 15); c.lineWidth = 3; c.strokeStyle = '#5a3a00'; c.stroke();
    c.restore();
  }
  if ((cu.vip || cu.gd) && cu.state !== 'leave' && cu.state !== 'slam') {                         // placa dorada del VIP (o con gemas: del que regala gemas)
    const ty = cu.state === 'wait' ? p.y - 162 : p.y - 98, nm = cu.vip ? cu.vd.name : cu.gd.name;
    c.font = `700 12px ${FONT_UI}`; const tw = c.measureText(nm).width + 30;
    c.fillStyle = 'rgba(27,16,48,.92)'; rr(c, p.x - tw / 2, ty - 8, tw, 17, 8); c.fill(); c.lineWidth = 1.6; c.strokeStyle = cu.vip ? P.gold : '#5fe8ff'; c.stroke();
    if (cu.vip) { star(c, p.x - tw / 2 + 10, ty + .5, 5, 2.2); c.fillStyle = P.gold; c.fill(); star(c, p.x + tw / 2 - 10, ty + .5, 5, 2.2); c.fill(); }
    else { drawGem(c, p.x - tw / 2 + 10, ty + .5, 5); drawGem(c, p.x + tw / 2 - 10, ty + .5, 5); }
    txt(c, nm, p.x, ty + 4, { font: `700 12px ${FONT_UI}`, align: 'center', color: cu.vip ? P.gold : '#9ff0ff', ls: .5 });
  }
  if ((slam && !sp.air) || cu.dazed) {                                                             // estrellitas de aturdido
    const hy = slam ? p.y - 14 : p.y - 82;
    c.fillStyle = '#ffe27a'; c.strokeStyle = P.ink; c.lineWidth = 1.2;
    for (let k = 0; k < 3; k++) { const a = w.t * 6 + k * 2.1; star(c, p.x + Math.cos(a) * 16, hy + Math.sin(a) * 5, 5, 2.2); c.fill(); c.stroke(); }
  }
}

// Dibuja un actor con un parpadeo rojo encima (modo rabioso): se pinta aparte y se tiñe solo donde hay personaje
let tintCv = null, tintK = 0;
function drawTinted(c, x, y, opts, alpha) {
  if (!tintCv || tintK !== K) { tintCv = document.createElement('canvas'); tintCv.width = 160 * K; tintCv.height = 190 * K; tintK = K; }
  const oc = tintCv.getContext('2d');
  oc.setTransform(1, 0, 0, 1, 0, 0); oc.clearRect(0, 0, tintCv.width, tintCv.height); oc.setTransform(K, 0, 0, K, 0, 0);
  drawLuchador(oc, 80, 150, opts);
  oc.globalCompositeOperation = 'source-atop'; oc.fillStyle = `rgba(255,24,24,${alpha})`; oc.fillRect(0, 0, 160, 190);
  oc.globalCompositeOperation = 'source-over';
  c.drawImage(tintCv, x - 80, y - 150, 160, 190);
}
function drawNovatoActor(c, w, nv = w.novato, look = LUCHADORES.novato) {                 // sirve para el Novato y para el mesero contratado
  const p = actorPos(nv, nv.resting), rage = nv.furia || nv.busy;
  const opts = Object.assign({}, look, nv.resting
    ? { state: 'eat', t: w.t, dir: -1, seated: true, scale: 1.04, tacosLeft: 3, eatKey: 'suero' }
    : { state: nv.moving ? 'walk' : 'idle', t: nv.moving ? nv.phase : w.t, dir: nv.dir, scale: 1.04, carrying: nv.carrying, angry: rage });
  const stun = nv.stun > 0;
  c.save();
  if (stun) { const fall = Math.min(1, ((nv.stunMax || 3.4) - nv.stun) / .25) * 1.5 * -(nv.dir || 1); c.translate(p.x, p.y); c.rotate(fall); c.translate(-p.x, -p.y); opts.state = 'idle'; opts.angry = true; }   // derribado de un sillazo
  if (rage && !stun) {
    const pulse = .5 + .5 * Math.sin(w.t * 14);
    c.fillStyle = `rgba(255,40,40,${.18 + .22 * pulse})`; c.beginPath(); c.ellipse(p.x, p.y - 28, 38 + pulse * 6, 52 + pulse * 6, 0, 0, 6.3); c.fill();
    drawTinted(c, p.x, p.y, opts, .15 + .5 * pulse);
  } else drawLuchador(c, p.x, p.y, opts);
  c.restore();
  if (stun) {                                                                                      // estrellitas de aturdido
    c.fillStyle = '#ffe27a'; c.strokeStyle = P.ink; c.lineWidth = 1.2;
    for (let k = 0; k < 3; k++) { const a = w.t * 6 + k * 2.1; star(c, p.x + Math.cos(a) * 16, p.y - 16 + Math.sin(a) * 5, 5, 2.2); c.fill(); c.stroke(); }
  }
}
// Barra de estamina sobre la cabeza del Novato
function drawStaminaBar(c, w, nv = w.novato) {
  const p = actorPos(nv, nv.resting), mx = maxStamina(w, nv), r = clamp(nv.stamina / mx, 0, 1);
  const bw = 46, x = p.x - bw / 2, y = p.y - 92, flash = nv.furia ? (Math.sin(w.t * 16) > 0) : (r < .2 && Math.sin(w.t * 8) > 0);
  c.save();
  c.fillStyle = 'rgba(13,7,32,.85)'; rr(c, x - 12, y - 4, bw + 18, 14, 7); c.fill(); c.lineWidth = 1.6; c.strokeStyle = nv.furia ? '#ff5a5a' : nv.resting ? '#5fd0ff' : 'rgba(255,255,255,.4)'; c.stroke();
  c.fillStyle = '#2a1a52'; rr(c, x, y, bw, 6, 3); c.fill();
  c.fillStyle = nv.furia ? (flash ? '#ff2a2a' : '#8a1520') : nv.resting ? '#5fd0ff' : r > .5 ? P.green : r > .2 ? P.gold : (flash ? '#ff5a5a' : '#c4272f');
  rr(c, x, y, Math.max(3, bw * (nv.furia ? 1 : r)), 6, 3); c.fill();
  c.fillStyle = nv.furia ? '#ff8a8a' : P.gold; c.beginPath();                                            // rayito de energía
  c.moveTo(x - 4, y - 2); c.lineTo(x - 8, y + 3.5); c.lineTo(x - 5.4, y + 3.5); c.lineTo(x - 7, y + 8); c.lineTo(x - 2, y + 2.4); c.lineTo(x - 4.6, y + 2.4); c.closePath(); c.fill();
  if (nv.furia) txt(c, '¡RABIOSO!', p.x, y - 8, { font: `700 13px ${FONT_UI}`, align: 'center', color: flash ? '#ff6b6b' : '#ffd0d0', stroke: P.ink, sw: 4, ls: 1 });
  else if (nv.resting) txt(c, 'SUERO', p.x, y - 8, { font: `700 12px ${FONT_UI}`, align: 'center', color: '#bfeaff', stroke: P.ink, sw: 4, ls: 1.5 });
  else if (nv.stamina <= 0) txt(c, 'SIN ENERGÍA', p.x, y - 8, { font: `700 12px ${FONT_UI}`, align: 'center', color: '#ffc0c0', stroke: P.ink, sw: 4, ls: 1 });
  else if (nv.isWaiter) txt(c, nv.tag || 'MESERO', p.x, y - 8, { font: `700 11px ${FONT_UI}`, align: 'center', color: '#bfe0ff', stroke: P.ink, sw: 4, ls: 1.5 });
  c.restore();
}
// Carteles cómicos de los castigos: [línea 1, línea 2, color de la estrella, color del óvalo]
const FX_BIG = { sillazo: ['¡SILLAZO!', 'DE LUCHA', '#ff9f43', '#7c3aed'], vuelo: ['¡CRASH!', 'VUELO SUICIDA', '#5fd0ff', '#2a4fb8'], llave: ['¡LLAVE!', 'DE SUMISIÓN', '#c4a2ff', '#4c2a9a'] };
function drawFx(c, w) {
  for (const f of w.fx) {
    const k = f.t / f.life, pop = easeOutBack(clamp(f.t / .25, 0, 1)), a = k > .8 ? (1 - k) / .2 : 1;
    const shake = f.t < .6 ? Math.sin(f.t * 70) * 3 : 0;
    if (f.type === 'dong') {                                                  // ¡DONG!: llega el VIP (campana de ring con aros de sonido)
      c.save(); c.globalAlpha = clamp(a, 0, 1);
      c.translate(480 + shake * 2, 128); c.scale(pop, pop); c.rotate(Math.sin(f.t * 22) * Math.max(0, .16 - f.t * .1));
      for (let k2 = 0; k2 < 3; k2++) { c.strokeStyle = `rgba(255,214,90,${.5 - k2 * .14})`; c.lineWidth = 4; c.beginPath(); c.arc(0, -4, 44 + k2 * 14 + f.t * 24, -2.5, -.64); c.stroke(); c.beginPath(); c.arc(0, -4, 44 + k2 * 14 + f.t * 24, 3.78, 5.64); c.stroke(); }
      c.lineJoin = 'round'; c.lineWidth = 3; c.strokeStyle = P.ink; c.fillStyle = '#ffc83d';
      c.beginPath(); c.moveTo(-26, 24); c.quadraticCurveTo(-30, -22, 0, -30); c.quadraticCurveTo(30, -22, 26, 24); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#e0a300'; c.fillRect(-30, 24, 60, 7); c.strokeRect(-30, 24, 60, 7);
      c.fillStyle = '#7a4a1e'; c.beginPath(); c.arc(0, 38, 7, 0, 6.3); c.fill(); c.stroke();
      txt(c, '¡DONG!', 0, 76, { font: `400 40px ${FONT_DISPLAY}`, align: 'center', color: '#fff3b0', stroke: P.ink, sw: 8 });
      c.restore();
      continue;
    }
    const fxk = FX_BIG[f.type], big = !!fxk;
    c.save(); c.globalAlpha = clamp(a, 0, 1);
    c.translate(f.x + shake, f.y - k * 10); c.rotate(-.1 + Math.sin(f.t * 12) * .02); c.scale(pop * (big ? 1.12 : 1), pop * (big ? 1.12 : 1));
    c.beginPath();
    for (let i = 0; i < 28; i++) { const an = i * Math.PI / 14, rad = i % 2 ? 56 : 82; c[i ? 'lineTo' : 'moveTo'](Math.cos(an) * rad * 1.15, Math.sin(an) * rad * .72); }
    c.closePath(); c.fillStyle = big ? fxk[2] : '#ffd23a'; c.fill(); c.lineWidth = 4; c.strokeStyle = P.ink; c.stroke();
    c.beginPath(); c.ellipse(0, 0, 66, 38, 0, 0, 6.3); c.fillStyle = big ? fxk[3] : '#e0364a'; c.fill(); c.lineWidth = 3; c.stroke();
    txt(c, big ? fxk[0] : '¡PUM!', 0, -3, { font: `400 ${big ? 26 : 32}px ${FONT_DISPLAY}`, align: 'center', color: '#fff3b0', stroke: P.ink, sw: 7 });
    txt(c, big ? fxk[1] : '¡QUEBRADORA!', 0, 22, { font: `400 ${big && fxk[1].length > 9 ? 15 : big ? 20 : 17}px ${FONT_DISPLAY}`, align: 'center', color: '#ffffff', stroke: P.ink, sw: 5 });
    c.restore();
  }
}

function drawBubble(c, cu, t) {
  const p = actorPos(cu, true);
  const k = clamp(cu.bubbleT * 5, 0, 1), s = easeOutBack(k);
  const ratio = clamp(cu.patience / cu.pmax, 0, 1);
  const shake = ratio < .3 ? Math.sin(t * 40) * 1.5 : 0;
  const items = pending(cu), frozen = cu.freeze > 0;
  const bw = 20 + items.length * 48, hw = bw / 2, base = frozen ? '#e4f6ff' : cu.vip ? '#fff3c4' : cu.gd ? '#e2fbff' : P.white;
  c.save();
  c.translate(p.x + shake, p.y - 98); c.scale(s, s);
  c.fillStyle = 'rgba(0,0,0,.2)'; rr(c, -hw + 1, -45, bw, 58, 12); c.fill();
  c.fillStyle = base; c.strokeStyle = frozen ? '#3aa9d9' : cu.vip ? '#e0a300' : P.ink; c.lineWidth = cu.vip ? 3.5 : 2.5;
  c.beginPath(); rr(c, -hw, -48, bw, 58, 12); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(-6, 9); c.lineTo(0, 18); c.lineTo(6, 9); c.closePath(); c.fillStyle = base; c.fill();
  c.beginPath(); c.moveTo(-6, 9.5); c.lineTo(0, 18); c.lineTo(6, 9.5); c.stroke();
  c.fillStyle = base; c.fillRect(-5, 7, 10, 4);
  items.forEach((it, k) => {                                          // lo que falta por servir: mismo dibujo que en el menú, con su nombre
    const ix = -hw + 10 + 24 + k * 48, nm = RECIPES[it.key].short;
    drawDish(c, it.key, ix, -30, 12);
    txt(c, nm, ix, -12.5, { font: `700 ${nm.length > 8 ? 9.5 : 10.5}px ${FONT_UI}`, align: 'center', color: frozen ? '#2a6f94' : '#4b3a6e' });
  });
  // barra de paciencia (azul y con escarcha mientras la espera está congelada)
  c.fillStyle = '#d8d3e6'; rr(c, -hw + 7, -5, bw - 14, 6, 3); c.fill();
  c.fillStyle = frozen ? '#5fd0ff' : ratio > .5 ? P.green : ratio > .25 ? P.gold : P.red;
  rr(c, -hw + 7, -5, Math.max(4, (bw - 14) * ratio), 6, 3); c.fill();
  if (frozen) {                                                       // copo de nieve + brillo
    c.strokeStyle = '#2a8fc4'; c.lineWidth = 1.6; c.lineCap = 'round';
    c.beginPath(); for (let a = 0; a < 3; a++) { const an = a * Math.PI / 3; c.moveTo(hw - 9 + Math.cos(an) * 5.5, -39 + Math.sin(an) * 5.5); c.lineTo(hw - 9 - Math.cos(an) * 5.5, -39 - Math.sin(an) * 5.5); } c.stroke();
    c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(-hw + 7 + ((t * 40) % (bw - 14)), -5, 5, 6);
  }
  c.restore();
}

/* ---------- Panel del comal y avisos al pasar el cursor ---------- */
function drawCookPanel(c, w) {
  const st = STATIONS[w.panel], list = w.panel === 'fridge' ? w.dslots : [w.slots[w.panelIdx]], Q = Object.assign({}, PANEL, { h: panelH(w) }), used = list.filter(s => s.state === 'cook').length;
  const title = w.panel === 'comal' && w.slots.length > 1 ? `COMAL ${w.panelIdx + 1}` : st.title;
  const accent = w.panel === 'fridge' ? '#5fd0ff' : P.gold;
  c.save();
  c.fillStyle = 'rgba(0,0,0,.45)'; rr(c, Q.x + 4, Q.y + 8, Q.w, Q.h, 16); c.fill();
  const g = c.createLinearGradient(0, Q.y, 0, Q.y + Q.h); g.addColorStop(0, w.panel === 'fridge' ? '#1c3a6e' : '#34195e'); g.addColorStop(1, '#1b0f38');
  rr(c, Q.x, Q.y, Q.w, Q.h, 16); c.fillStyle = g; c.fill(); c.lineWidth = 3.5; c.strokeStyle = accent; c.stroke();
  const tw = (c.font = `400 ${w.panel === 'fridge' ? 19 : 24}px ${FONT_DISPLAY}`, c.measureText(title).width);
  txt(c, title, Q.x + 16, Q.y + 30, { font: `400 ${w.panel === 'fridge' ? 19 : 24}px ${FONT_DISPLAY}`, color: accent, stroke: P.ink, sw: 4 });
  txt(c, `En uso ${used} de ${list.length}`, Q.x + 28 + tw, Q.y + 29, { font: `600 14px ${FONT_UI}`, color: P.muted, ls: .5 });
  const cl = panelClose, ch = UI.hit(cl); if (ch) UI.cursor = true;
  rr(c, cl.x, cl.y, cl.w, cl.h, 8); c.fillStyle = ch ? '#5a3a8a' : '#2a1a52'; c.fill(); c.lineWidth = 1.6; c.strokeStyle = 'rgba(255,255,255,.35)'; c.stroke();
  c.strokeStyle = P.white; c.lineWidth = 2.4; c.lineCap = 'round'; c.beginPath();
  c.moveTo(cl.x + 9, cl.y + 9); c.lineTo(cl.x + 19, cl.y + 19); c.moveTo(cl.x + 19, cl.y + 9); c.lineTo(cl.x + 9, cl.y + 19); c.stroke();
  const k = Q.rowH / 60;                                              // escala de la fila (1 = 60 px)
  st.items.forEach((key, i) => {
    const r = RECIPES[key], y = Q.y + Q.top + i * Q.rowH, chk = canCook(w, key), b = panelBtn(i);
    if (i % 2 === 0) { c.fillStyle = 'rgba(255,255,255,.05)'; c.fillRect(Q.x + 6, y, Q.w - 12, Q.rowH); }
    c.fillStyle = P.ink; c.beginPath(); c.arc(Q.x + 34, y + Q.rowH / 2, 22 * k, 0, 6.3); c.fill(); c.lineWidth = 2; c.strokeStyle = chk.ok ? P.violet : '#4a4560'; c.stroke();
    c.save(); c.globalAlpha = chk.ok ? 1 : .55; drawDish(c, key, Q.x + 34, y + Q.rowH / 2 - 1, 12 * k); c.restore();
    txt(c, r.name, Q.x + 64, y + 22 * k, { font: `700 16px ${FONT_UI}`, color: chk.ok ? P.cream : '#9d96b4' });
    txt(c, `Cuesta ${pesos(r.cost)} · ${r.time} seg`, Q.x + 64, y + 38 * k, { font: `600 13px ${FONT_UI}`, color: P.muted });
    txt(c, `Rinde ${r.yield} ${r.unit} · venta ${pesos(r.price)} c/u`, Q.x + 64, y + 53 * k, { font: `600 13px ${FONT_UI}`, color: chk.ok ? P.gold : '#8a7a50' });
    drawButton(c, Object.assign({ label: chk.locked ? `NIVEL ${r.level}` : 'COCINAR', style: 'green', size: 15 }, b, { disabled: !chk.ok }));
    if (!chk.ok && !chk.locked) txt(c, chk.why.toUpperCase(), b.x + b.w / 2, b.y + b.h + 9, { font: `700 10.5px ${FONT_UI}`, align: 'center', color: '#ff8fa0', ls: .6 });
  });
  txt(c, 'Toca fuera del panel para cerrar', Q.x + Q.w / 2, Q.y + Q.h - 9, { font: `600 12px ${FONT_UI}`, align: 'center', color: P.muted, ls: .5 });
  c.restore();
}
/* ---------- Tienda ---------- */
function drawShopIcon(c, id, x, y, w) {
  c.save();
  c.fillStyle = '#120a2a'; rr(c, x - 30, y - 30, 60, 60, 12); c.fill(); c.lineWidth = 2; c.strokeStyle = P.violet; c.stroke();
  c.lineJoin = 'round'; c.strokeStyle = P.ink; c.lineWidth = 1.8;
  if (id === 'comal') {
    c.fillStyle = '#23252c'; c.fillRect(x - 22, y + 2, 44, 5); c.beginPath(); c.ellipse(x, y + 7, 22, 10, 0, 0, Math.PI); c.fill();
    const g = c.createLinearGradient(x - 22, y - 10, x + 22, y + 10); g.addColorStop(0, '#8b909e'); g.addColorStop(1, '#2f323c');
    c.beginPath(); c.ellipse(x, y + 2, 22, 10, 0, 0, 6.3); c.fillStyle = g; c.fill(); c.stroke();
    flame(c, x - 9, y + 14, 8 + Math.sin(w.t * 9) * 2); flame(c, x + 9, y + 14, 8 + Math.sin(w.t * 9 + 2) * 2);
    txt(c, String(Math.min(countOf(w, 'comal') + 1, maxOf(w, 'comal'))), x, y - 12, { font: `400 18px ${FONT_DISPLAY}`, align: 'center', color: P.gold, stroke: P.ink, sw: 4 });
  } else if (id === 'remodel') {                                // casita con lona de colores
    c.beginPath(); c.moveTo(x - 20, y + 16); c.lineTo(x - 20, y - 4); c.lineTo(x, y - 18); c.lineTo(x + 20, y - 4); c.lineTo(x + 20, y + 16); c.closePath(); c.fillStyle = '#dcaa50'; c.fill(); c.stroke();
    for (let k = 0; k < 4; k++) { c.fillStyle = k % 2 ? '#fff4e6' : '#e0364a'; c.beginPath(); c.moveTo(x - 22 + k * 11, y - 2); c.lineTo(x - 11 + k * 11, y - 2); c.lineTo(x - 13 + k * 11, y + 6); c.lineTo(x - 24 + k * 11, y + 6); c.closePath(); c.fill(); c.stroke(); }
    c.fillStyle = '#7a4a1e'; c.fillRect(x - 4, y + 7, 8, 9);
  } else if (id === 'inv') {                                    // la "cajita" del inventario
    c.beginPath(); c.moveTo(x - 21, y - 6); c.lineTo(x, y - 16); c.lineTo(x + 21, y - 6); c.lineTo(x, y + 4); c.closePath(); c.fillStyle = '#e6b673'; c.fill(); c.stroke();
    c.beginPath(); c.moveTo(x - 21, y - 6); c.lineTo(x, y + 4); c.lineTo(x, y + 20); c.lineTo(x - 21, y + 10); c.closePath(); c.fillStyle = '#c98b4e'; c.fill(); c.stroke();
    c.beginPath(); c.moveTo(x + 21, y - 6); c.lineTo(x, y + 4); c.lineTo(x, y + 20); c.lineTo(x + 21, y + 10); c.closePath(); c.fillStyle = '#a8703a'; c.fill(); c.stroke();
    txt(c, '+', x, y - 1, { font: `700 18px ${FONT_UI}`, align: 'center', color: P.ink });
  } else if (id === 'drinks') {                                  // mostrador con tarros de michelada
    c.beginPath(); c.moveTo(x - 22, y - 2); c.lineTo(x, y - 12); c.lineTo(x + 22, y - 2); c.lineTo(x, y + 8); c.closePath(); c.fillStyle = '#c98b4e'; c.fill(); c.stroke();
    c.beginPath(); c.moveTo(x - 22, y - 2); c.lineTo(x, y + 8); c.lineTo(x, y + 20); c.lineTo(x - 22, y + 10); c.closePath(); c.fillStyle = '#2a62c9'; c.fill(); c.stroke();
    c.beginPath(); c.moveTo(x + 22, y - 2); c.lineTo(x, y + 8); c.lineTo(x, y + 20); c.lineTo(x + 22, y + 10); c.closePath(); c.fillStyle = '#1f4a9c'; c.fill(); c.stroke();
    drawDish(c, 'michelada', x - 6, y - 10, 7); drawDish(c, 'michelada', x + 7, y - 7, 7);
  } else if (id === 'fridge') {
    c.beginPath(); c.moveTo(x - 12, y + 14); c.lineTo(x - 12, y - 18); c.lineTo(x + 12, y - 18); c.lineTo(x + 12, y + 14); c.closePath(); c.fillStyle = '#5d8be6'; c.fill(); c.stroke();
    c.fillStyle = '#bfe3ff'; rr(c, x - 9, y - 14, 18, 24, 2); c.fill(); c.stroke();
    ['#e0364a', '#ffc83d', '#2fbf71'].forEach((col, k) => { c.fillStyle = col; c.fillRect(x - 7 + k * 5.4, y - 11, 3.6, 8); c.fillRect(x - 7 + k * 5.4, y + 1, 3.6, 8); });
  } else if (STAFF[id]) {
    drawLuchador(c, x, y + 26, Object.assign({}, LUCHADORES[STAFF[id].look], { state: 'idle', t: w.t, dir: 1, scale: .62 }));
  } else if (id === 'arena') {                                  // cuadrilátero con sus cuatro postes y cuerdas
    c.beginPath(); c.moveTo(x - 24, y + 4); c.lineTo(x, y - 8); c.lineTo(x + 24, y + 4); c.lineTo(x, y + 16); c.closePath(); c.fillStyle = '#2f56c9'; c.fill(); c.stroke();
    c.beginPath(); c.moveTo(x - 24, y + 4); c.lineTo(x, y + 16); c.lineTo(x, y + 21); c.lineTo(x - 24, y + 9); c.closePath(); c.fillStyle = '#c4272f'; c.fill(); c.stroke();
    c.beginPath(); c.moveTo(x + 24, y + 4); c.lineTo(x, y + 16); c.lineTo(x, y + 21); c.lineTo(x + 24, y + 9); c.closePath(); c.fillStyle = '#8f1c26'; c.fill(); c.stroke();
    c.strokeStyle = '#fff'; c.lineWidth = 2;
    for (const [px, py] of [[x - 24, y + 4], [x, y - 8], [x + 24, y + 4], [x, y + 16]]) { c.beginPath(); c.moveTo(px, py); c.lineTo(px, py - 17); c.stroke(); }
    c.beginPath(); c.moveTo(x - 24, y - 13); c.lineTo(x, y - 25); c.lineTo(x + 24, y - 13); c.lineTo(x, y - 1); c.closePath(); c.strokeStyle = '#ff6a78'; c.stroke();
  } else {                                                      // mesa con mantel a cuadros
    c.beginPath(); c.moveTo(x - 25, y - 2); c.lineTo(x, y - 15); c.lineTo(x + 25, y - 2); c.lineTo(x, y + 11); c.closePath(); c.fillStyle = '#fff4e6'; c.fill(); c.stroke();
    c.fillStyle = 'rgba(224,54,74,.6)';
    for (let k = -2; k <= 2; k++) { c.beginPath(); c.moveTo(x + k * 9 - 3, y - 8 + Math.abs(k) * 3.5); c.lineTo(x + k * 9 + 3, y - 8 + Math.abs(k) * 3.5 + 1); c.lineTo(x + k * 9 + 3, y + 2); c.lineTo(x + k * 9 - 3, y + 1); c.closePath(); c.fill(); }
    c.beginPath(); c.moveTo(x - 25, y - 2); c.lineTo(x, y + 11); c.lineTo(x, y + 20); c.lineTo(x - 25, y + 7); c.closePath(); c.fillStyle = '#d9374a'; c.fill(); c.stroke();
    c.beginPath(); c.moveTo(x + 25, y - 2); c.lineTo(x, y + 11); c.lineTo(x, y + 20); c.lineTo(x + 25, y + 7); c.closePath(); c.fillStyle = '#a92a3a'; c.fill(); c.stroke();
  }
  c.restore();
}
// Muestra de cada pieza decorativa dentro de su tarjeta (x, y, w, h = área de la muestra)
function drawDecorPreview(c, it, x, y, w, h, t) {
  const cx = x + w / 2, cy = y + h / 2;
  c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
  c.fillStyle = '#120a2a'; c.fillRect(x, y, w, h);
  if (it.kind === 'floor') {
    const F = FLOORS[it.key], hw = 16, hh = 8, ox = cx, oy = cy - 22;
    c.lineWidth = 1; c.strokeStyle = 'rgba(27,16,48,.3)';
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      const px = ox + (i - j) * hw, py = oy + (i + j) * hh;
      floorTile(c, F, [{ x: px, y: py }, { x: px + hw, y: py + hh }, { x: px, y: py + 2 * hh }, { x: px - hw, y: py + hh }], i, j, t);
    }
  } else if (it.kind === 'paint') {
    const pal = PAINTS[it.key], ax = x + 12, aw = w - 24;
    const g = c.createLinearGradient(0, y + 4, 0, y + h); g.addColorStop(0, pal[0]); g.addColorStop(1, pal[1]);
    c.fillStyle = g; c.fillRect(ax, y + 6, aw, h - 6);
    c.fillStyle = pal[2]; c.fillRect(ax, y + h - 30, aw, 22);
    c.fillStyle = '#f3e9d8'; c.fillRect(ax, y + h - 33, aw, 3); c.fillStyle = '#f6f1e8'; c.fillRect(ax, y + h - 8, aw, 8);
    c.strokeStyle = 'rgba(255,200,200,.25)'; c.lineWidth = 1; for (let k = 0; k < 4; k++) c.strokeRect(ax + 6 + k * (aw - 12) / 4, y + h - 28, (aw - 12) / 4 - 4, 16);
  } else if (it.kind === 'bunting') {
    c.save(); c.translate(x + 6, y + 8); c.scale(.92, .92); if (it.key === 'none') txt(c, 'SIN BANDERAS', (w - 12) / .92 / 2, 30, { font: `700 13px ${FONT_UI}`, align: 'center', color: P.muted, ls: 1 }); else drawBunting(c, [[0, (w - 12) / .92]], t, it.key); c.restore();
  } else if (it.kind === 'toggle') {
    const k = it.key;
    if (POSTERS[k]) drawPoster(c, k, cx - 23, y + 5, 46, 52);
    else if (k === 'g_poster') drawNeonPoster(c, cx - 23, y + 5, 46, 52, t);
    else if (k === 'g_mask') drawNeonMask(c, cx - 23, y + 3, t);
    else if (k === 'neon') {
      const fl = neonFl(t); c.save(); c.shadowColor = '#ff3d8b'; c.shadowBlur = 9 * fl;
      c.fillStyle = '#16072c'; rr(c, cx - 42, cy - 19, 84, 38, 6); c.fill(); c.lineWidth = 2; c.strokeStyle = `rgba(255,95,162,${fl})`; c.stroke();
      txt(c, 'TAQUERÍA', cx, cy - 2, { font: `400 15px ${FONT_DISPLAY}`, align: 'center', color: `rgba(255,170,210,${fl})` });
      txt(c, 'EL RING', cx, cy + 13, { font: `400 14px ${FONT_DISPLAY}`, align: 'center', color: `rgba(255,220,120,${fl})` }); c.restore();
    } else if (k === 'menu') {
      c.fillStyle = P.ink; rr(c, cx - 52, cy - 20, 104, 16, 4); c.fill(); c.lineWidth = 1.4; c.strokeStyle = P.gold; c.stroke();
      txt(c, 'MENÚ CALLEJERO', cx, cy - 8, { font: `700 10px ${FONT_UI}`, align: 'center', color: P.gold, ls: .8 });
      drawMask(c, cx - 30, cy + 14, 9.5, MASKS.ring); drawMask(c, cx + 26, cy + 14, 9.5, MASKS.novato);
    } else if (k === 'felpudo') {
      c.fillStyle = '#8f1d33'; rr(c, cx - 34, cy - 12, 68, 24, 4); c.fill(); c.lineWidth = 2; c.strokeStyle = P.gold; c.stroke();
      txt(c, 'BIENVENIDOS', cx, cy + 4, { font: `700 10px ${FONT_UI}`, align: 'center', color: P.gold, ls: .8 });
    } else if (k === 'alfombra') {
      c.fillStyle = 'rgba(184,50,74,.95)'; c.beginPath(); c.ellipse(cx, cy, 52, 24, 0, 0, 6.3); c.fill(); c.lineWidth = 3; c.strokeStyle = P.gold; c.stroke();
      c.save(); c.translate(cx, cy); c.scale(1, .5); c.globalAlpha = .6; drawMask(c, 0, 0, 20, MASKS.ring); c.restore();
    }
  } else if (it.kind === 'awning') {
    const A = AWNINGS[it.key];
    if (A.colors) for (let k = 0; k < 10; k++) { c.fillStyle = A.colors[k % A.colors.length]; c.fillRect(x + 10 + k * (w - 20) / 10, y + 8, (w - 20) / 10 + 1, 30); c.beginPath(); c.arc(x + 10 + (k + .5) * (w - 20) / 10, y + 38, (w - 20) / 20, 0, Math.PI); c.fill(); }
    else txt(c, 'SIN LONA', cx, cy + 4, { font: `700 13px ${FONT_UI}`, align: 'center', color: P.muted, ls: 1 });
  } else {                                                          // mueble de adorno
    drawFurnIcon(c, it.key, cx, cy + 10);
  }
  c.restore();
}
function drawDecor(c, w) {
  const B = DECBOX, list = decorList(w.decCat), pages = Math.max(1, Math.ceil(list.length / 8));
  w.decPage = Math.min(w.decPage, pages - 1);
  c.fillStyle = 'rgba(8,4,24,.74)'; c.fillRect(0, HUD, W, H - HUD);
  drawPanel(c, B.x, B.y, B.w, B.h, 'DECORAR');
  const cl = decClose, ch = UI.hit(cl); if (ch) UI.cursor = true;
  rr(c, cl.x, cl.y, cl.w, cl.h, 8); c.fillStyle = ch ? '#5a3a8a' : '#2a1a52'; c.fill(); c.lineWidth = 1.6; c.strokeStyle = 'rgba(255,255,255,.35)'; c.stroke();
  c.strokeStyle = P.white; c.lineWidth = 2.4; c.lineCap = 'round'; c.beginPath();
  c.moveTo(cl.x + 10, cl.y + 10); c.lineTo(cl.x + 20, cl.y + 20); c.moveTo(cl.x + 20, cl.y + 10); c.lineTo(cl.x + 10, cl.y + 20); c.stroke();
  DEC_CATS.forEach((cat, i) => {                                      // pestañas de categoría
    const q = decTab(i), on = w.decCat === cat[0], hov = UI.hit(q), gem = cat[0] === 'gem';
    if (hov) UI.cursor = true;
    rr(c, q.x, q.y, q.w, q.h, 9); c.fillStyle = on ? (gem ? '#1b8fb0' : '#e29a12') : hov ? '#4a2c80' : '#241447'; c.fill(); c.lineWidth = on ? 3 : 1.6; c.strokeStyle = on ? (gem ? '#9ff0ff' : P.gold) : gem ? 'rgba(95,232,255,.55)' : 'rgba(255,255,255,.3)'; c.stroke();
    txt(c, q.label, q.x + q.w / 2, q.y + 19, { font: `700 13px ${FONT_UI}`, align: 'center', color: on ? (gem ? '#fff' : P.ink) : gem ? '#9ff0ff' : P.cream, ls: .6 });
  });
  list.slice(w.decPage * 8, w.decPage * 8 + 8).forEach((it, i) => {
    const q = decCard(i), st = decorState(w, it), locked = w.level < it.level, hov = UI.hit(q) && !locked;
    if (UI.hit(q)) UI.cursor = true;
    rr(c, q.x, q.y, q.w, q.h, 12); c.fillStyle = hov ? 'rgba(255,255,255,.13)' : 'rgba(255,255,255,.06)'; c.fill();
    c.lineWidth = st.on ? 3.5 : 2; c.strokeStyle = st.on ? '#9af0b8' : it.gems ? 'rgba(95,232,255,.7)' : hov ? P.gold : 'rgba(255,255,255,.22)'; c.stroke();
    c.save(); c.globalAlpha = locked ? .38 : 1; drawDecorPreview(c, it, q.x + 6, q.y + 6, q.w - 12, 66, w.t); c.restore();
    txt(c, it.name, q.x + q.w / 2, q.y + 87, { font: `700 ${it.name.length > 24 ? 12 : 14}px ${FONT_UI}`, align: 'center', color: locked ? '#9d96b4' : P.cream });
    let lab, col = P.gold;
    if (locked) { lab = `NIVEL ${it.level}`; col = '#ff8fa0'; }
    else if (it.kind === 'furn') { lab = st.full ? `MÁXIMO (${st.count})` : null; col = P.muted; }
    else if (st.own) { lab = st.on ? (it.kind === 'toggle' ? '✓ PUESTO · toca para quitar' : '✓ PUESTO') : (it.kind === 'toggle' ? 'TUYO · toca para poner' : 'TUYO · toca para poner'); col = st.on ? '#9af0b8' : P.muted; }
    else lab = null;
    if (lab) txt(c, lab, q.x + q.w / 2, q.y + 106, { font: `700 12px ${FONT_UI}`, align: 'center', color: col, ls: .4 });
    else if (it.gems) {                                              // precio en gemas
      const ok = w.gems >= it.gems; drawGem(c, q.x + q.w / 2 - 20, q.y + 101, 8);
      txt(c, String(it.gems), q.x + q.w / 2 - 8, q.y + 107, { font: `700 17px ${FONT_UI}`, color: ok ? '#9ff0ff' : '#ff8fa0' });
    } else {                                                         // precio en monedas
      const ok = w.money >= it.price; drawCoin(c, q.x + q.w / 2 - 34, q.y + 101, 8, 0);
      txt(c, pesos(it.price), q.x + q.w / 2 - 22, q.y + 107, { font: `700 17px ${FONT_UI}`, color: ok ? P.gold : '#ff8fa0' });
    }
  });
  if (pages > 1) {
    drawButton(c, decPrev); drawButton(c, decNext);
    txt(c, `${w.decPage + 1} / ${pages}`, B.x + 380, B.y + 357, { font: `700 16px ${FONT_UI}`, align: 'center', color: P.cream });
  }
  const blurb = { floor: 'El piso cambia todo el local', paint: 'La primera pintura nueva suma ½ máscara de reputación', bunting: 'Banderas para las dos paredes',
    wall: 'Cada póster tiene su lugar en la pared; tócalo otra vez para quitarlo', furn: 'Van a la cajita: luego los colocas (y los giras) en EDITAR', awning: 'La primera lona nueva suma ½ máscara de reputación',
    gem: 'Solo con gemas: las regalan visitantes especiales (30 % de que llegue uno cada día)' }[w.decCat];
  txt(c, blurb, B.x + B.w / 2, B.y + B.h - 8, { font: `600 13px ${FONT_UI}`, align: 'center', color: P.muted });
  drawButton(c, decBack);
  drawCoin(c, B.x + B.w - 250, B.y + 394, 11, 0);
  txt(c, pesos(w.shownMoney), B.x + B.w - 234, B.y + 402, { font: `700 22px ${FONT_UI}`, color: w.moneyFlash > 0 ? '#ff7a8c' : P.white, stroke: P.ink, sw: 4 });
  drawGem(c, B.x + B.w - 120, B.y + 393, 10);
  txt(c, String(w.gems), B.x + B.w - 104, B.y + 402, { font: `700 22px ${FONT_UI}`, color: '#9ff0ff', stroke: P.ink, sw: 4 });
}
function drawShop(c, w) {
  if (w.shopView === 'decor') { drawDecor(c, w); return; }
  const B = SHOPBOX, items = shopRows(w);
  c.fillStyle = 'rgba(8,4,24,.74)'; c.fillRect(0, HUD, W, H - HUD);
  drawPanel(c, B.x, B.y, B.w, B.h, 'TIENDA');
  const cl = shopClose, ch = UI.hit(cl); if (ch) UI.cursor = true;
  rr(c, cl.x, cl.y, cl.w, cl.h, 8); c.fillStyle = ch ? '#5a3a8a' : '#2a1a52'; c.fill(); c.lineWidth = 1.6; c.strokeStyle = 'rgba(255,255,255,.35)'; c.stroke();
  c.strokeStyle = P.white; c.lineWidth = 2.4; c.lineCap = 'round'; c.beginPath();
  c.moveTo(cl.x + 10, cl.y + 10); c.lineTo(cl.x + 20, cl.y + 20); c.moveTo(cl.x + 20, cl.y + 10); c.lineTo(cl.x + 10, cl.y + 20); c.stroke();
  shopTabs(w).forEach((tb, i) => {                                                   // pestañas: aparecen conforme subes de nivel
    const q = shopTabBtn(w, i), on = w.shopTab === tb[0], hov = UI.hit(q), deco = tb[0] === 'decor', lock = tabLocked(w, tb);
    if (hov) UI.cursor = true;
    rr(c, q.x, q.y, q.w, q.h, 9); c.fillStyle = on ? '#e29a12' : lock ? '#1a1030' : hov ? '#4a2c80' : deco ? '#1b5a6a' : '#241447'; c.fill(); c.lineWidth = on ? 3 : 1.6; c.strokeStyle = on ? P.gold : lock ? 'rgba(255,255,255,.18)' : deco ? '#5fe8ff' : 'rgba(255,255,255,.3)'; c.stroke();
    if (lock) {                                                                       // candado + nivel que lo abre
      const lx = q.x + 10, ly = q.y + 15;
      c.strokeStyle = '#9d96b4'; c.lineWidth = 1.8; c.beginPath(); c.arc(lx, ly - 2, 3.4, Math.PI, 0); c.stroke();
      c.fillStyle = '#9d96b4'; rr(c, lx - 5, ly - 1, 10, 8, 2); c.fill();
      txt(c, q.label, q.x + q.w / 2 + 6, q.y + 15, { font: `700 12px ${FONT_UI}`, align: 'center', color: on ? '#3a2408' : '#8f89a6', ls: .4 });
      txt(c, `NIVEL ${tb[2]}`, q.x + q.w / 2 + 6, q.y + 26, { font: `700 9px ${FONT_UI}`, align: 'center', color: on ? '#8a1c2c' : '#ff9aa8', ls: .6 });
    } else txt(c, q.label, q.x + q.w / 2, q.y + 21, { font: `700 14px ${FONT_UI}`, align: 'center', color: on ? P.ink : P.cream, ls: .8 });
  });
  drawCoin(c, B.x + B.w - 160, B.y + 53, 11, 0);
  txt(c, pesos(w.shownMoney), B.x + B.w - 144, B.y + 62, { font: `700 24px ${FONT_UI}`, color: w.moneyFlash > 0 ? '#ff7a8c' : P.white, stroke: P.ink, sw: 4 });
  if (w.gemsSeen || w.gems > 0) { drawGem(c, B.x + B.w - 160, B.y + 88, 8); txt(c, String(w.gems), B.x + B.w - 144, B.y + 94, { font: `700 18px ${FONT_UI}`, color: '#9ff0ff', stroke: P.ink, sw: 3 }); }
  items.forEach((it, i) => {
    const y = B.y + B.top + i * B.rowH, chk = canBuy(w, it), b = shopBtn(i);
    if (i % 2 === 0) { c.fillStyle = 'rgba(255,255,255,.05)'; c.fillRect(B.x + 8, y, B.w - 16, B.rowH); }
    drawShopIcon(c, it.id, B.x + 56, y + B.rowH / 2, w);
    const dim = !chk.ok && !it.done;
    txt(c, it.name, B.x + 106, y + 22, { font: `700 21px ${FONT_UI}`, color: dim ? '#9d96b4' : P.cream });
    txt(c, it.desc, B.x + 106, y + 38, { font: `600 13.5px ${FONT_UI}`, color: P.muted });
    txt(c, it.open ? 'Ya remodelado' : it.done ? (it.id === 'inv' ? 'Al máximo' : STAFF[it.id] ? 'Contratado' : it.id === 'arena' ? 'Construida' : it.id === 'remodel' ? 'Ya remodelado' : 'En tu taquería') : pesos(it.price), B.x + 106, y + 55,{ font: `700 17px ${FONT_UI}`, color: it.open || it.done ? '#9af0b8' : dim ? '#8a7a50' : P.gold, ls: .5 });
    drawButton(c, Object.assign({ label: it.open ? 'DECORAR' : it.done ? 'COMPRADO' : it.need ? 'BLOQUEADO' : 'COMPRAR', style: it.open ? 'teal' : 'green', size: 18 }, b, { disabled: !chk.ok }));
    if (!chk.ok && !it.done) txt(c, chk.why.toUpperCase(), b.x + b.w / 2, b.y + b.h + 11, { font: `700 10.5px ${FONT_UI}`, align: 'center', color: '#ff8fa0', ls: .6 });
  });
  txt(c, 'El juego queda en pausa mientras compras', B.x + B.w / 2, B.y + B.h - 14, { font: `600 13px ${FONT_UI}`, align: 'center', color: P.muted, ls: 1 });
}
function drawTip(c, x, y, lines) {
  c.save(); c.font = `700 15px ${FONT_UI}`;
  const w = Math.max(...lines.map(l => c.measureText(l).width)) + 20, h = 8 + lines.length * 18;
  const tx = clamp(x, 8, W - w - 8), ty = clamp(y, HUD + 6, H - h - 6);
  c.fillStyle = 'rgba(13,7,32,.92)'; rr(c, tx, ty, w, h, 8); c.fill(); c.lineWidth = 1.6; c.strokeStyle = P.gold; c.stroke();
  lines.forEach((l, i) => txt(c, l, tx + 10, ty + 19 + i * 18, { font: `700 15px ${FONT_UI}`, color: i ? P.muted : P.cream }));
  c.restore();
}
function drawTooltips(c, w) {
  if (UI.mx > 430 && UI.mx < 585 && UI.my < HUD) {                    // explicación de la reputación al pasar el cursor por las máscaras
    drawTip(c, 300, HUD + 8, ['Reputación en máscaras', 'Cliente enojado: la máscara se desvanece 1/3 (con 3 se pierde)', 'Cliente bien atendido: recupera 1/4', 'Sin máscaras no pasa nada: se vuelve a subir todo el día']);
    return;
  }
  if (w.panel) return;
  const sk = stockAt(w, UI.mx, UI.my);                              // pilas de la barra y del mostrador de bebidas
  if (sk) { const p = stockPos(sk); UI.cursor = true; drawTip(c, p.x + 26, p.y - 58, [RECIPES[sk].name, `${w.stock[sk]} listas · venta ${pesos(RECIPES[sk].price)} c/u`]); return; }
  for (const cu of w.customers) {                                  // qué pidió cada cliente
    if (cu.state !== 'wait') continue;
    const p = actorPos(cu, true);
    if (UI.mx > p.x - 25 && UI.mx < p.x + 25 && UI.my > p.y - 80 && UI.my < p.y + 12) {
      UI.cursor = true;
      const bits = cu.order.map(i => (i.done ? '✓ ' : '') + RECIPES[i.key].name);
      drawTip(c, p.x + 30, p.y - 118, ['Pidió:', ...bits].concat(cu.freeze > 0 ? [`Espera congelada ${Math.ceil(cu.freeze)} s`] : [])); return;
    }
  }
  const nv = w.novato, np = actorPos(nv, nv.resting);
  if (UI.mx > np.x - 25 && UI.mx < np.x + 25 && UI.my > np.y - 80 && UI.my < np.y + 12) {
    UI.cursor = true;
    drawTip(c, np.x + 30, np.y - 120, [`El Novato · Nivel ${w.level}`, `Energía ${Math.round(nv.stamina)} de ${maxStamina(w)}`, nv.resting ? 'Toca para que vuelva al trabajo' : 'Toca para que vaya a descansar']); return;
  }
  for (const wt of w.staff) {
    if (wt.entering) continue;
    const wp = actorPos(wt, wt.resting);
    if (UI.mx > wp.x - 25 && UI.mx < wp.x + 25 && UI.my > wp.y - 80 && UI.my < wp.y + 12) {
      drawTip(c, wp.x + 30, wp.y - 120, [STAFF[wt.id].name, `Energía ${Math.round(wt.stamina)} de 100`, wt.stun > 0 ? '¡Fuera de combate!' : wt.resting ? 'Descansando en la banca' : STAFF[wt.id].desc]); return;
    }
  }
  if (restHit(UI.mx, UI.my)) { UI.cursor = true; const bp = TS(LAYOUT.bench, 1, .4, 70); drawTip(c, bp.x - 150, bp.y - 20, ['Vestidor con suero', 'Banca de dos lugares: toca para que el Novato descanse']); return; }
  const cp = comalPos();
  const hov = w.slots.findIndex((_, i) => comalHit(UI.mx, UI.my, i));
  if (hov >= 0) { UI.cursor = true; const hp = comalPos(hov); drawTip(c, hp.x + 70, hp.y - 40, [w.slots.length > 1 ? `Comal ${hov + 1}` : 'Comal', 'Toca para elegir qué cocinar']); }
  else if (fridgeHit(UI.mx, UI.my)) { UI.cursor = true; const fp = fridgeRingPos(0); drawTip(c, fp.x + 30, fp.y - 20, ['Refrigerador', 'Micheladas: toca para prepararlas']); }
}

/* ---------- De día a noche: la calle se va oscureciendo ---------- */
function skyTint(h) {                                           // [hora, r, g, b, alfa]
  const K = [[8, 255, 190, 110, .14], [10, 255, 230, 170, 0], [16.5, 255, 230, 170, 0], [18, 255, 130, 70, .22], [19, 90, 50, 120, .46], [20, 8, 12, 52, .68]];
  if (h <= K[0][0]) return K[0];
  for (let i = 1; i < K.length; i++) {
    if (h <= K[i][0]) { const a = K[i - 1], b = K[i], f = (h - a[0]) / (b[0] - a[0]); return [h, lerp(a[1], b[1], f), lerp(a[2], b[2], f), lerp(a[3], b[3], f), lerp(a[4], b[4], f)]; }
  }
  return K[K.length - 1];
}
const polyPath = (c, pts) => { pts.forEach((p, i) => c[i ? 'lineTo' : 'moveTo'](p.x, p.y)); c.closePath(); };
function drawNight(c, w) {
  const h = hourOf(w), k = skyTint(h), dark = clamp((h - 17.5) / 2.5, 0, 1);
  if (k[4] > .004) {                                            // tinte sobre todo lo de afuera; el piso del local queda iluminado
    c.save();
    c.beginPath(); c.rect(0, HUD, W, H - HUD);
    polyPath(c, [S(0, 0, 0), S(COLS, 0, 0), S(COLS, ROWS, 0), S(0, ROWS, 0)]);
    polyPath(c, [S(COLS, 0, 0), S(COLS, ROWS, 0), S(COLS, ROWS, -16), S(COLS, 0, -16)]);
    polyPath(c, [S(0, ROWS, 0), S(COLS, ROWS, 0), S(COLS, ROWS, -16), S(0, ROWS, -16)]);
    c.fillStyle = `rgba(${Math.round(k[1])},${Math.round(k[2])},${Math.round(k[3])},${k[4].toFixed(3)})`; c.fill('evenodd');
    c.restore();
  }
  if (dark > .05) {                                             // faroles encendidos
    c.save(); c.globalCompositeOperation = 'lighter';
    EXT_PROPS.forEach(p => {
      if (p.draw !== drawLamp) return;
      const q = S(p.x, p.y), g = c.createRadialGradient(q.x, q.y - 80, 2, q.x, q.y - 80, 80);
      g.addColorStop(0, `rgba(255,210,110,${.5 * dark})`); g.addColorStop(1, 'rgba(255,210,110,0)');
      c.fillStyle = g; c.beginPath(); c.arc(q.x, q.y - 80, 80, 0, 6.3); c.fill();
      c.fillStyle = `rgba(255,200,90,${.2 * dark})`; c.beginPath(); c.ellipse(q.x, q.y + 4, 70, 26, 0, 0, 6.3); c.fill();
    });
    c.restore();
  }
}

/* ---------- Modo edición: resaltados, mueble fantasma y panel ---------- */
function drawEditFloor(c, w) {
  const e = w.edit, held = e.held;
  c.lineWidth = 1; c.strokeStyle = 'rgba(255,255,255,.4)';
  for (let i = 0; i < COLS; i++) for (let j = 0; j < ROWS; j++) { groundQuad(c, i, j, i + 1, j + 1); c.stroke(); }
  const en = DOOR.cells[0]; groundQuad(c, en.c, en.r, en.c + 1, en.r + 1); c.fillStyle = 'rgba(255,200,61,.38)'; c.fill();
  txt(c, 'ENTRADA', S(en.c + .5, en.r + .5).x, S(en.c + .5, en.r + .5).y + 4, { font: `700 10px ${FONT_UI}`, align: 'center', color: P.ink, ls: .5 });
  if (DECO.arena) RING_CELLS().forEach(([a, b]) => { groundQuad(c, a, b, a + 1, b + 1); c.fillStyle = 'rgba(255,70,90,.22)'; c.fill(); });
  if (e.hit) { footprint(e.hit).forEach(([a, b]) => { groundQuad(c, a, b, a + 1, b + 1); c.fillStyle = 'rgba(255,200,61,.42)'; c.fill(); }); UI.cursor = true; }
  e.why = null;
  if (held && e.hover) {
    const a = anchorFor(held.it, e.hover), why = canPlace(w, held.it, a.c, a.r);
    e.why = why;
    footprint({ type: held.it.type, c: a.c, r: a.r, rot: held.it.rot || 0 }).forEach(([x, y]) => {
      if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return;
      groundQuad(c, x, y, x + 1, y + 1); c.fillStyle = why ? 'rgba(255,70,90,.5)' : 'rgba(80,230,140,.5)'; c.fill();
    });
    UI.cursor = true;
  }
}
function drawGhost(c, w, it, cc, rr_) {
  if (it.type === 'table') {
    const g = { type: 'table', c: cc, r: rr_, rot: it.rot || 0 };
    g.seats = it.seats.map(s => Object.assign({}, s, { customer: null, tb: g }));
    placeSeats(g);
    drawChair(c, g.seats[0]); drawTable(c, g, w); drawChair(c, g.seats[1]);
  } else drawFurn(c, w, Object.assign({}, it, { c: cc, r: rr_ }));
}
const ICON_COL = {
  table: ['#fff4e6', '#d9374a', '#a92a3a', 'Mesa'], comal: ['#4b4f5c', '#3a3d48', '#2a2c35', 'Comal'], fridge: ['#5d8be6', '#2a62c9', '#1f4a9c', 'Refri'],
  drinks: ['#c98b4e', '#2a62c9', '#1f4a9c', 'Bebidas'], bar: ['#c98b4e', '#b5482f', '#8f3624', 'Barra'], bench: ['#c98b4e', '#8f5a2c', '#6e4220', 'Banca'],
  plant: ['#c4492a', '#2f8f4e', '#2a7d44', 'Planta'], trompo: ['#b23d1f', '#d2602d', '#a63a1f', 'Trompo'], caja: ['#e8dcc0', '#cdbf9c', '#a99a78', 'Caja'],
  estatua: ['#ffe27a', '#e3b53a', '#b88a1f', 'Estatua'], vitrina: ['#d7f0ff', '#6ea6d6', '#4d82b0', 'Vitrina']
};
function drawFurnIcon(c, type, x, y) {                           // cubito isométrico con el color de cada pieza
  const k = ICON_COL[type];
  c.save(); c.lineJoin = 'round'; c.lineWidth = 1.6; c.strokeStyle = P.ink;
  const tall = type === 'fridge' || type === 'plant' || type === 'trompo' || type === 'estatua' || type === 'vitrina' ? 8 : 0;
  c.beginPath(); c.moveTo(x - 17, y - 4 - tall); c.lineTo(x, y - 12 - tall); c.lineTo(x + 17, y - 4 - tall); c.lineTo(x, y + 4 - tall); c.closePath(); c.fillStyle = k[0]; c.fill(); c.stroke();
  c.beginPath(); c.moveTo(x - 17, y - 4 - tall); c.lineTo(x, y + 4 - tall); c.lineTo(x, y + 16); c.lineTo(x - 17, y + 8); c.closePath(); c.fillStyle = k[1]; c.fill(); c.stroke();
  c.beginPath(); c.moveTo(x + 17, y - 4 - tall); c.lineTo(x, y + 4 - tall); c.lineTo(x, y + 16); c.lineTo(x + 17, y + 8); c.closePath(); c.fillStyle = k[2]; c.fill(); c.stroke();
  if (type === 'comal') { c.fillStyle = '#9aa0ae'; c.beginPath(); c.ellipse(x, y - 4 - tall, 11, 5, 0, 0, 6.3); c.fill(); c.stroke(); }
  c.restore();
}
function drawEditPanel(c, w) {
  const e = w.edit, Q = EDIT, h = editH(w), B = editBtns(w);
  c.save();
  c.fillStyle = 'rgba(0,0,0,.45)'; rr(c, Q.x + 4, Q.y + 8, Q.w, h, 16); c.fill();
  const g = c.createLinearGradient(0, Q.y, 0, Q.y + h); g.addColorStop(0, '#12476a'); g.addColorStop(1, '#1b0f38');
  rr(c, Q.x, Q.y, Q.w, h, 16); c.fillStyle = g; c.fill(); c.lineWidth = 3.5; c.strokeStyle = '#5fd0ff'; c.stroke();
  txt(c, 'EDITAR', Q.x + 16, Q.y + 30, { font: `400 21px ${FONT_DISPLAY}`, color: '#bfeaff', stroke: P.ink, sw: 4 });
  txt(c, `Inventario ${w.inv.length}/${w.invCap}`, Q.x + Q.w - 16, Q.y + 30, { font: `700 17px ${FONT_UI}`, align: 'right', color: w.inv.length >= w.invCap ? '#ff8fa0' : P.cream });
  txt(c, 'La cajita guarda muebles sin colocar', Q.x + 16, Q.y + 47, { font: `600 12px ${FONT_UI}`, color: P.muted });
  let tip = null;
  for (let i = 0; i < w.invCap; i++) {
    const s = editSlot(i), it = w.inv[i], hov = UI.hit(s) && !!it;
    rr(c, s.x, s.y, s.w, s.h, 8); c.fillStyle = hov ? 'rgba(95,208,255,.28)' : 'rgba(255,255,255,.07)'; c.fill();
    c.lineWidth = 1.6; c.strokeStyle = it ? '#5fd0ff' : 'rgba(255,255,255,.22)'; if (!it) c.setLineDash([4, 3]); c.stroke(); c.setLineDash([]);
    if (it) {
      drawFurnIcon(c, it.type, s.x + s.w / 2, s.y + 24);
      txt(c, ICON_COL[it.type][3], s.x + s.w / 2, s.y + s.h - 4, { font: `700 10px ${FONT_UI}`, align: 'center', color: P.cream });
      if (hov) { UI.cursor = true; tip = [FURN[it.type].name, 'Toca para sacarlo y colocarlo']; }
    }
  }
  drawButton(c, Object.assign({}, B.rot, { disabled: !e.held && !rotTarget(w) }));
  drawButton(c, Object.assign({}, B.drop, { disabled: !e.held }));
  drawButton(c, Object.assign({}, B.store, { disabled: !e.held }));
  drawButton(c, B.done);
  txt(c, UI.touch ? 'Toca un mueble, GIRAR, toca la loseta dos veces' : 'R o GIRAR: gira · SOLTAR o Esc: devolver', Q.x + Q.w / 2, B.done.y + B.done.h + 18, { font: `600 12px ${FONT_UI}`, align: 'center', color: P.muted });
  c.restore();
  if (e.held) {                                                   // lo que llevas y por qué no se puede soltar ahí
    const lines = [`Llevas: ${FURN[e.held.it.type].name}`];
    if (e.why) lines.push(e.why); else if (e.hover) lines.push(UI.touch ? (e.armed ? 'Toca otra vez para soltarlo aquí' : 'Toca la loseta para ver dónde queda') : 'Toca para soltarlo aquí');
    drawTip(c, clamp(UI.mx + 18, 8, Q.x - 220), UI.my + 8, lines);
  } else if (tip) drawTip(c, UI.mx - 230, UI.my + 6, tip);
  else if (e.hit) drawTip(c, UI.mx + 18, UI.my + 8, [FURN[e.hit.type].name, 'Toca para levantarlo']);
}

/* ---------- Escena completa ---------- */
function drawWorld(c, w) {
  c.save();                                                       // el temblor de la quebradora sacude el escenario (no la interfaz)
  if (w.shake > 0) { const m = w.shake / .5 * 5; c.translate(rand(-m, m), rand(-m, m)); }
  drawGround(c);
  drawFloor(c);
  if (w.edit) drawEditFloor(c, w);

  // Y-sort: cada elemento entra a una lista con su profundidad (isoX + isoY) y se ordena antes de dibujar.
  // Los actores que aún están fuera del muro (isoY < .15) se dibujan antes que la pared; los de adentro, después.
  const outside = [], inside = [];
  EXT_PROPS.forEach(p => outside.push({ d: p.x + p.y, draw: () => p.draw(c, p.x, p.y, w.t) }));

  w.furn.forEach(it => {                                          // todo el mobiliario colocado entra a la lista con su profundidad
    if (it.type === 'table') {
      const tm = tableMid(it), td = tm[0] + tm[1];
      inside.push({ d: td, draw: () => drawTable(c, it, w) });
      it.seats.forEach(s => inside.push({ d: s.outer < 0 ? td - .6 : s.gx + s.gy, draw: () => drawChair(c, s) }));
    } else inside.push({ d: furnDepth(it), draw: () => drawFurn(c, w, it) });
  });
  inside.push({ d: DOOR.ix + .3, draw: () => drawDoorLeaves(c, w.doorA) });
  w.customers.forEach(cu => {
    let d = cu.x + cu.y;
    if (cu.seated) { const s = cu.seat, tm = tableMid(s.tb), td = tm[0] + tm[1]; d = s.outer < 0 ? td + .1 : s.gx + s.gy + .05; }
    if (cu.state === 'slam') d = w.novato.x + w.novato.y + .3;
    (cu.y < .15 ? outside : inside).push({ d, draw: () => drawCustomer(c, cu, w) });
  });
  const nv = w.novato;
  inside.push({ d: nv.resting ? nv.x + nv.y + .15 : nv.x + nv.y, draw: () => drawNovatoActor(c, w) });
  w.staff.forEach(wt => (wt.y < .15 && !wt.resting ? outside : inside).push({ d: wt.resting ? wt.x + wt.y + .15 : wt.x + wt.y, draw: () => drawNovatoActor(c, w, wt, LUCHADORES[wt.look]) }));
  if (DECO.arena) { const g = ARENA.ring; inside.push({ d: g.c + g.w / 2 + g.r + g.h / 2 - .2, draw: () => drawRing(c, w) }); }

  outside.sort((a, b) => a.d - b.d).forEach(i => i.draw());
  drawNight(c, w);                                                 // la calle se oscurece con la hora (el local sigue iluminado)
  drawWalls(c, w);
  inside.sort((a, b) => a.d - b.d).forEach(i => i.draw());
  if (w.edit && w.edit.held && w.edit.hover) {                     // mueble que llevas: se ve semitransparente donde lo soltarías
    const h = w.edit.held, a = anchorFor(h.it, w.edit.hover);
    c.save(); c.globalAlpha = .72; drawGhost(c, w, h.it, a.c, a.r); c.restore();
  }

  // globos de pedido, estamina y carteles
  w.customers.forEach(cu => { if (cu.state === 'wait') drawBubble(c, cu, w.t); });
  drawStaminaBar(c, w);
  w.staff.forEach(wt => { if (!wt.entering || wt.y > -.3) drawStaminaBar(c, w, wt); });
  drawFx(c, w);
  c.restore();

  // monedas
  w.coins.forEach(co => {
    const pop = Math.min(1, co.t * 4), bounce = Math.abs(Math.sin(pop * Math.PI)) * 14 * (1 - pop);
    const pulse = .5 + .5 * Math.sin(w.t * 6);
    c.fillStyle = `rgba(255,214,90,${.2 + .2 * pulse})`; c.beginPath(); c.arc(co.x, co.y - 4, 20 + pulse * 3, 0, 6.3); c.fill();
    c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(co.x, co.y + 8, 10, 3, 0, 0, 6.3); c.fill();
    drawCoin(c, co.x, co.y - 4 - bounce, 12, w.t + co.x);
    txt(c, pesos(co.v), co.x, co.y - 24, { font: `700 14px ${FONT_UI}`, align: 'center', color: P.gold, stroke: P.ink, sw: 4 });
    if (co.gems) {                                                                              // esta moneda trae gemas
      const gy = co.y - 44 + Math.sin(w.t * 5) * 2;
      drawGem(c, co.x - 14, gy, 8); txt(c, '+' + co.gems, co.x - 3, gy + 5, { font: `700 15px ${FONT_UI}`, color: '#9ff0ff', stroke: P.ink, sw: 4 });
    }
  });

  // partículas
  for (const p of w.parts) {
    const a = clamp(p.life / p.max, 0, 1);
    if (p.type === 'steam') { c.fillStyle = p.cold ? `rgba(170,230,255,${.55 * a})` : `rgba(255,255,255,${.35 * a})`; c.beginPath(); c.arc(p.x, p.y, 3 + (1 - a) * 6, 0, 6.3); c.fill(); }
    else if (p.type === 'crumb') { c.fillStyle = p.col; c.globalAlpha = Math.min(1, a * 2.5); c.fillRect(p.x - 1.2, p.y - 1.2, 2.4, 2.4); c.globalAlpha = 1; }
    else if (p.type === 'spark') { c.fillStyle = `rgba(255,226,122,${a})`; star(c, p.x, p.y, 4, 1.6); c.fill(); }
    else if (p.type === 'text') txt(c, p.text, p.x, p.y, { font: `700 20px ${FONT_UI}`, align: 'center', color: p.color, stroke: P.ink, sw: 5, alpha: Math.min(1, a * 2) });
    else if (p.type === 'fly') drawCoin(c, p.cx, p.cy, 9, w.t * 3);
  }

  drawHud(c, w);
  if (w.phase === 'play') {
    if (!w.shop && !w.edit) drawTooltips(c, w);
    if (w.panel && !w.shop && !w.edit) drawCookPanel(c, w);
    if (w.shop) drawShop(c, w);
    if (w.edit) drawEditPanel(c, w);
  }

  // pistas y avisos (con el tutorial en curso, la guía es el cuadro del tutorial)
  if (w.tut && w.phase === 'play') drawTutorial(c, w);
  const hint = w.tut ? null : getHint(w);
  // los textos largos se encogen para caber en el lienzo; el aviso sube sobre la pista para que nunca se tapen
  const fitSize = (s, weight, size) => { c.font = `${weight} ${size}px ${FONT_UI}`; const mw = c.measureText(s).width; return mw > W - 56 ? Math.max(11, Math.floor(size * (W - 56) / mw * 10) / 10) : size; };
  if (hint) {
    const fs = fitSize(hint, 600, 18); c.font = `600 ${fs}px ${FONT_UI}`;
    const tw = c.measureText(hint).width + 28;
    c.fillStyle = 'rgba(13,7,32,.82)'; rr(c, 14, 558, tw, 28, 14); c.fill();
    c.strokeStyle = 'rgba(255,200,61,.6)'; c.lineWidth = 1.5; c.stroke();
    txt(c, hint, 28, 577, { font: `600 ${fs}px ${FONT_UI}`, color: P.cream });
  }
  if (w.toasts.length) {
    const t = w.toasts[0], fs = fitSize(t.msg, 700, 18), ty = hint ? 524 : 558;
    c.font = `700 ${fs}px ${FONT_UI}`;
    const tw = c.measureText(t.msg).width + 28;
    c.save(); c.globalAlpha = clamp(t.t, 0, 1);
    c.fillStyle = P.red; rr(c, W - 14 - tw, ty, tw, 28, 14); c.fill(); c.strokeStyle = P.gold; c.lineWidth = 2; c.stroke();
    txt(c, t.msg, W - 28, ty + 20, { font: `700 ${fs}px ${FONT_UI}`, align: 'right', color: P.white });
    c.restore();
  }
  if (w.banner > 0 && w.phase === 'play') {
    const a = clamp(w.banner, 0, 1);
    c.save(); c.globalAlpha = a;
    c.fillStyle = 'rgba(13,7,32,.7)'; c.fillRect(0, 250, W, 100);
    txt(c, `DÍA ${w.day}`, 480, 306, { font: `400 54px ${FONT_DISPLAY}`, align: 'center', color: P.gold, stroke: P.ink, sw: 8 });
    txt(c, '8:00 AM · ¡Abre la taquería!', 480, 335, { font: `700 24px ${FONT_UI}`, align: 'center', color: P.cream, ls: 3 });
    c.restore();
  }

  if (w.phase === 'summary') drawSummary(c, w);
  if (w.phase === 'over') drawOver(c, w);
}

function drawHud(c, w) {
  let g = c.createLinearGradient(0, 0, 0, HUD);
  g.addColorStop(0, '#34195e'); g.addColorStop(1, '#170a33');
  c.fillStyle = g; c.fillRect(0, 0, W, HUD);
  c.fillStyle = P.gold; c.fillRect(0, HUD - 3, W, 3);
  txt(c, 'DÍA ' + w.day, 18, 29, { font: `400 22px ${FONT_DISPLAY}`, color: P.gold, stroke: P.ink, sw: 4 });
  // nivel y experiencia
  const need = xpNeed(w.level), xr = clamp(w.xp / need, 0, 1), lf = w.levelFlash > 0;
  c.save();
  if (lf) { c.shadowColor = '#7cf0a8'; c.shadowBlur = 10 + Math.sin(w.t * 14) * 4; }
  rr(c, 18, 36, 150, 17, 8.5); c.fillStyle = '#120a2a'; c.fill(); c.lineWidth = 2; c.strokeStyle = lf ? '#9af0b8' : P.violet; c.stroke();
  c.restore();
  const xg = c.createLinearGradient(18, 0, 168, 0); xg.addColorStop(0, '#2fbf71'); xg.addColorStop(1, '#9af0b8');
  rr(c, 18, 36, Math.max(14, 150 * xr), 17, 8.5); c.fillStyle = xg; c.fill();
  txt(c, `NIV ${w.level} · ${w.xp}/${need} XP`, 93, 49, { font: `700 11.5px ${FONT_UI}`, align: 'center', color: P.white, stroke: P.ink, sw: 3, ls: .6 });
  // dinero
  const flash = w.moneyFlash > 0, shake = flash ? Math.sin(w.t * 60) * 2 : 0;
  drawCoin(c, 208, 30, 14, 0);
  txt(c, 'CAJA', 232, 15, { font: `700 11px ${FONT_UI}`, color: P.muted, ls: 2.5 });
  if (w.gemsSeen || w.gems > 0) { drawGem(c, 282, 11, 6); txt(c, String(w.gems), 291, 16, { font: `700 14px ${FONT_UI}`, color: '#9ff0ff', stroke: P.ink, sw: 3 }); }   // gemas
  txt(c, pesos(w.shownMoney), 232 + shake, 45, { font: `700 32px ${FONT_UI}`, color: flash ? '#ff7a8c' : P.white, stroke: P.ink, sw: 4 });
  // reputación
  txt(c, 'REPUTACIÓN', 440, 20, { font: `700 12px ${FONT_UI}`, color: P.muted, ls: 2.5 });
  const er = effRep(w);
  const active = Math.min(4, Math.floor(er + 1e-6));                            // la máscara que se está desvaneciendo o recuperando
  for (let i = 0; i < 5; i++) {                                                // 1 a 5 máscaras de lucha: pierden color en tres pasos
    const x = 450 + i * 30, f = clamp(er - i, 0, 1), lost = clamp(w.rep - i, 0, 1) - f;
    const steps = Math.ceil(f * 3 - 1e-6);                                     // 3 = a todo color, 2 = pálida, 1 = casi borrada
    c.save(); c.globalAlpha = .2; drawMask(c, x, 38, 8.5, MASKS.gray); c.restore();
    if (steps > 0) { c.save(); c.globalAlpha = [0, .38, .68, 1][steps]; drawMask(c, x, 38, 8.5, MASKS.ring); c.restore(); }
    if (lost > .01) {                                                          // máscara perdida por un sillazo: parpadea mientras se recupera
      c.save(); c.globalAlpha = .3 + .3 * Math.sin(w.t * 8); drawMask(c, x, 38, 8.5, MASKS.ring); c.restore();
    }
    if (i === active && steps < 3) {                                           // tres puntitos: cuántos "tercios" le quedan a esa máscara
      for (let k = 0; k < 3; k++) { c.beginPath(); c.arc(x - 6 + k * 6, 54, 2.1, 0, 6.3); c.fillStyle = k < steps ? P.gold : 'rgba(255,255,255,.22)'; c.fill(); }
    }
  }
  if (w.repTemp > .01) txt(c, '-1 un rato', 562, 20, { font: `700 11px ${FONT_UI}`, align: 'right', color: '#ff8fa0' });
  // tiempo
  // reloj: abre a las 8:00 AM, cierra a las 8:00 PM
  const hr = hourOf(w), prog = clamp(1 - w.dayTime / w.dayLen, 0, 1), closed = w.dayTime <= 0, night = hr >= 18.5;
  txt(c, closed ? 'CERRADO' : 'HORA', 612, 17, { font: `700 11px ${FONT_UI}`, color: closed ? '#ff8fa0' : P.muted, ls: 2.5 });
  if (night || closed) {                                                       // luna
    c.fillStyle = '#e8eefc'; c.beginPath(); c.arc(598, 34, 7.5, 0, 6.3); c.fill();
    c.fillStyle = '#26124a'; c.beginPath(); c.arc(602, 31.5, 6.4, 0, 6.3); c.fill();
  } else {                                                                     // sol
    c.strokeStyle = '#ffd23a'; c.lineWidth = 1.8; c.lineCap = 'round'; c.beginPath();
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; c.moveTo(598 + Math.cos(a) * 8.5, 34 + Math.sin(a) * 8.5); c.lineTo(598 + Math.cos(a) * 11.5, 34 + Math.sin(a) * 11.5); }
    c.stroke(); c.fillStyle = '#ffc83d'; c.beginPath(); c.arc(598, 34, 6, 0, 6.3); c.fill();
  }
  txt(c, fmtHour(hr), 612, 40, { font: `700 20px ${FONT_UI}`, color: closed ? '#ff8fa0' : P.white, stroke: P.ink, sw: 4 });
  rr(c, 612, 46, 68, 6, 3); c.fillStyle = '#120a2a'; c.fill();
  rr(c, 612, 46, Math.max(5, 68 * prog), 6, 3); c.fillStyle = night ? '#7b6cff' : '#ffc83d'; c.fill();
  w.btns.forEach(b => drawButton(c, b));
}

function getHint(w) {
  if (w.phase !== 'play') return null;
  const n = w.novato, waiting = w.customers.filter(cu => cu.state === 'wait');
  if (w.panel) return w.panel === 'fridge' ? 'Prepara micheladas aquí: cada tanda cuesta y rinde tarros' : 'Elige qué cocinar: cada tanda cuesta y rinde porciones';
  if (w.shop) return 'Tienda: compra mobiliario, equipamiento y personal';
  if (w.edit) return w.edit.held ? (UI.touch ? 'Toca una loseta verde (otra vez para soltar) · GIRAR · SOLTAR devuelve' : 'Loseta verde: soltar · R o GIRAR: girar · SOLTAR o Esc: devolverlo')
    : (UI.touch ? 'Modo edición: toca un mueble para levantarlo, o saca uno del inventario' : 'Modo edición: toca un mueble para levantarlo (R lo gira), o saca uno del inventario');
  if (!LAYOUT.comals.length) return 'Abre la TIENDA y compra un comal para empezar a cocinar';
  if (!SEATS.length) return 'Compra una mesa en la TIENDA para que lleguen clientes';
  if (n.busy) return '¡QUEBRADORA!';
  if (n.furia) return '¡Rabioso! Tócalo para que vaya al vestidor antes de que azote a un cliente';
  if (n.resting) return 'Tomando suero: recupera energía poco a poco (tócalo para volver al trabajo)';
  if (n.stamina <= 0) return 'Sin energía: tócalo para que tome suero o se pondrá rabioso';
  if (n.stamina < maxStamina(w) * .25) return 'El Novato está cansado: tócalo para que vaya a tomar suero';
  if (w.coins.length) return '¡Pulsa las monedas de la mesa para cobrar!';
  if (n.carrying) return waiting.some(cu => pending(cu).some(i => i.key === n.carrying)) ? `Pulsa al cliente que pidió ${RECIPES[n.carrying].short}` : `Llevas ${RECIPES[n.carrying].short}: espera a que alguien lo pida`;
  const vipC = waiting.find(cu => cu.vip);
  if (vipC && !n.carrying && pending(vipC).length) {
    const lack = vipC.vd.combo.filter((k, i, a) => a.indexOf(k) === i).find(k => w.stock[k] < vipC.vd.combo.filter(q => q === k).length - vipC.served.filter(q => q === k).length);
    if (lack) return `¡${vipC.vd.name} espera su combo! Prepara ${vipC.vd.combo.filter(q => q === lack).length} ${RECIPES[lack].short} antes de que se enoje`;
  }
  const need = waiting.flatMap(cu => pending(cu)).map(i => i.key);
  if (need.some(k => w.stock[k] > 0)) return 'Pulsa al cliente: el Novato recoge su pedido de la barra';
  const missing = need.find(k => !allSlots(w).some(s => s.dish === k && s.state === 'cook'));
  if (missing) return RECIPES[missing].drink ? `Pulsa el refrigerador y prepara ${RECIPES[missing].name}` : `Pulsa el comal y cocina ${RECIPES[missing].name}`;
  if (allSlots(w).some(s => s.state === 'cook')) return 'Preparando…';
  if (w.dayTime <= 0) return 'Último servicio del día';
  const hire = STAFF_IDS.find(id => w.level >= STAFF[id].level && !w.staff.some(m => m.id === id) && w.money >= STAFF[id].price);
  if (hire) return `Ya puedes contratar a ${STAFF[hire].name} en la TIENDA (${pesos(STAFF[hire].price)})`;
  if (w.level >= ARENA.level && DECO.remodeled && !DECO.arena && w.money >= ARENA.price) return `Ya puedes construir la Mega Ampliación: Arena en la TIENDA (${pesos(ARENA.price)})`;
  return 'Pulsa el comal para preparar comida antes de que lleguen';
}

/* =========================================================
   TUTORIAL de la partida nueva: compra comal, mesa y refri; cocina, sirve y cobra
   ========================================================= */
const TUT = ['intro', 'buy_comal', 'place_comal', 'buy_table', 'place_table', 'buy_fridge', 'place_fridge', 'cook', 'serve', 'collect', 'outro'];
const TUT_TYPE = { buy_comal: 'comal', place_comal: 'comal', buy_table: 'table', place_table: 'table', buy_fridge: 'fridge', place_fridge: 'fridge' };
const TUT_NAME = { comal: 'COMAL', table: 'MESA', fridge: 'REFRIGERADOR' };
const TUT_SPOT = { comal: [[0, 2], [0, 3], [1, 2], [2, 2]], table: [[3, 3], [2, 4], [4, 3], [3, 5]], fridge: [[1, 0], [2, 0], [0, 0], [3, 0]] };   // sitios sugeridos (el primero libre)
const TUT_STEPS_SHOWN = 6;                                          // pasos con número (los dos extremos son ventanas)
function tutDone(w, name) {
  const type = TUT_TYPE[name];
  if (name.startsWith('buy_')) return countOf(w, type) >= 1;
  if (name.startsWith('place_')) return w.furn.some(f => f.type === type) && !w.edit;
  if (name === 'cook') return w.slots.some(s => s.state === 'cook') || FOODS.some(k => w.stock[k] > 0) || w.dayServed > 0 || w.coins.length > 0 || w.customers.some(c => c.state === 'eat');
  if (name === 'serve') return w.dayServed > 0 || w.coins.length > 0 || w.customers.some(c => c.state === 'eat');
  if (name === 'collect') return w.dayEarned > 0;
  return false;                                                     // intro y outro esperan el botón
}
function tutorialUpdate(w) {                                         // avanza solo cuando el jugador ya hizo lo que pide el paso
  const t = w.tut; if (!t || w.phase !== 'play') return;
  for (let g = 0; g < 12 && t.s < TUT.length - 1 && tutDone(w, TUT[t.s]); g++) { t.s++; sfx('ready'); }
}
function tutSpot(w, it) {                                            // loseta sugerida para el mueble que llevas
  const type = it.type, d = { type, rot: it.rot || 0 };
  for (const [c0, r0] of TUT_SPOT[type] || []) if (!canPlace(w, it, c0, r0)) return footprint(Object.assign({ c: c0, r: r0 }, d));
  for (let r = 1; r < ROWS; r++) for (let c0 = 0; c0 < COLS; c0++) if (!canPlace(w, it, c0, r)) return footprint(Object.assign({ c: c0, r }, d));
  return [];
}
function tutTarget(w) {                                              // qué señalar con el aro dorado
  const name = TUT[w.tut.s], type = TUT_TYPE[name], btn = l => w.btns.find(b => b.label === l);
  if (name.startsWith('buy_')) {
    if (w.edit) return null;
    if (!w.shop) return { rect: btn('TIENDA') };
    if (w.shopView !== 'main') return null;
    const tabs = shopTabs(w);
    if (w.shopTab !== 'furn') return { rect: shopTabBtn(w, tabs.findIndex(x => x[0] === 'furn')) };
    const idx = shopRows(w).findIndex(r => r.id === type);
    return idx >= 0 ? { rect: shopBtn(idx) } : null;
  }
  if (name.startsWith('place_')) {
    const e = w.edit;
    if (!e) return { rect: btn('EDITAR') };
    if (e.held) return e.held.it.type === type ? { tiles: tutSpot(w, e.held.it) } : null;
    const inv = w.inv.findIndex(f => f.type === type);
    if (inv >= 0) return { rect: editSlot(inv) };
    return { rect: editBtns(w).done };
  }
  if (name === 'cook') { if (w.panel === 'comal') { fitPanel(w); return { rect: panelBtn(0) }; } const p = comalPos(0); return p ? { circle: { x: p.x, y: p.y, r: 48 } } : null; }
  if (name === 'serve') { const cu = w.customers.find(c => c.state === 'wait' && c.seat); if (!cu) return null; const p = actorPos(cu, true); return { circle: { x: p.x, y: p.y - 36, r: 42 } }; }
  if (name === 'collect') { const co = w.coins[0]; return co ? { circle: { x: co.x, y: co.y - 4, r: 30 } } : null; }
  return null;
}
function tutText(w) {                                                // [título, ...líneas]
  const name = TUT[w.tut.s], type = TUT_TYPE[name], n = type ? TUT.indexOf(name) : 0, num = name.startsWith('buy_') ? 1 + (n - 1) / 2 : name.startsWith('place_') ? 1 + (n - 2) / 2 : name === 'cook' ? 4 : name === 'serve' ? 5 : 6;
  const T = type ? TUT_NAME[type] : '';
  switch (name) {
    case 'intro': return ['¡Bienvenido a tu changarro!', 'Tienes un local pelón y $250 en la caja. Lo vas a armar paso a paso: compra un comal, una mesa y un refri; luego cocina, sirve y cobra.', 'Todo lo demás se desbloquea con tus ganancias.'];
    case 'buy_comal': case 'buy_table': case 'buy_fridge': {
      const price = pesos(priceOf(type, 0));
      return [`Paso ${num} de ${TUT_STEPS_SHOWN} · Compra el ${T}`, w.shop ? `Pulsa COMPRAR en la fila del ${T.toLowerCase()} (${price}).` : `Pulsa TIENDA (arriba a la derecha) y compra el ${T.toLowerCase()} por ${price}.`];
    }
    case 'place_comal': case 'place_table': case 'place_fridge':
      if (w.edit && w.edit.held) return [`Paso ${num} de 6 · Colócalo`, 'Toca una loseta verde del piso para dejarlo ahí (la amarilla es una sugerencia).', 'Con la tecla R o el botón GIRAR lo volteas.'];
      if (w.edit) return [`Paso ${num} de 6 · ¡Bien!`, 'Pulsa LISTO para terminar de acomodar.'];
      return [`Paso ${num} de 6 · Acomódalo`, 'Pulsa EDITAR, saca el mueble de la cajita y suéltalo en el piso.'];
    case 'cook': return [`Paso 4 de 6 · ¡A cocinar!`, w.panel === 'comal' ? 'Pulsa COCINAR en Tacos al Pastor (cuesta $10 y rinde 4 porciones).' : 'Toca el comal y elige Tacos al Pastor. Las porciones listas quedan en la barra de comida.'];
    case 'serve': {
      const cu = w.customers.find(c => c.state === 'wait' && c.seat);
      return [`Paso 5 de 6 · Atiende al cliente`, cu ? 'Toca al cliente: el Novato recoge su pedido en la barra y se lo lleva a la mesa.' : 'Espera a que llegue un cliente y a que termine de cocinarse el pastor.'];
    }
    case 'collect': return [`Paso 6 de 6 · ¡Cobra!`, 'Cuando termina de comer deja una moneda en la mesa: tócala para cobrar y ganar experiencia.'];
    default: return ['¡Ya tienes tu taquería!', 'Cada peso que cobras te da experiencia. Al subir de nivel se abren mejoras en la TIENDA (más comales y mesas, meseros) y la pestaña DECORAR: pisos, paredes, banderas y pósters.',
      'Algunos visitantes especiales regalan GEMAS para decoración exclusiva. Si el Novato se cansa, tócalo para que descanse en la banca.'];
  }
}
const TUT_MODAL = { x: 190, y: 150, w: 580, h: 300 };
const tutBtnOk = { x: TUT_MODAL.x + TUT_MODAL.w / 2 - 110, y: TUT_MODAL.y + TUT_MODAL.h - 66, w: 220, h: 50, size: 24, style: 'green' };
const tutBtnSkip = { x: 14, y: 526, w: 164, h: 26, size: 13, style: 'dark', label: 'SALTAR TUTORIAL' };
function tutPointer(w, x, y) {                                       // true si el tutorial se comió el clic
  const name = TUT[w.tut.s];
  if (name === 'intro' || name === 'outro') {
    if (UI.hit(w.tutBtn || tutBtnOk)) {
      sfx('click');
      if (name === 'intro') w.tut.s = 1; else { w.tut = null; toast(w, '¡A trabajar! Sigue ganando y mejorando tu changarro'); }
      Game.save();
    } else { const hb = w.btns.find(b => (b.label === 'MENÚ' || b.label === 'AJUSTES') && UI.hit(b)); if (hb) hb.fn(); }   // salir al menú o a ajustes siempre se puede
    return true;
  }
  if (UI.hit(tutBtnSkip)) { sfx('back'); w.tut = null; toast(w, 'Tutorial omitido. La TIENDA y las mejoras se abren con tu nivel'); Game.save(); return true; }
  return false;
}
function wrapLines(c, s, maxW, font) {
  c.save(); c.font = font; const out = []; let cur = '';
  for (const word of s.split(' ')) { const t = cur ? cur + ' ' + word : word; if (c.measureText(t).width > maxW && cur) { out.push(cur); cur = word; } else cur = t; }
  if (cur) out.push(cur); c.restore(); return out;
}
function drawTutorial(c, w) {
  const name = TUT[w.tut.s], tx = tutText(w), t = w.t;
  if (name === 'intro' || name === 'outro') {
    c.fillStyle = 'rgba(8,4,24,.7)'; c.fillRect(0, HUD, W, H - HUD);
    const paras = tx.slice(1).map(s => wrapLines(c, s, TUT_MODAL.w - 80, `600 19px ${FONT_UI}`)), nRows = paras.reduce((a, p) => a + p.length, 0);
    const mh = 150 + nRows * 25 + (paras.length - 1) * 12 + 36;     // un párrafo por cada frase larga, con un respiro entre ellos
    const M = { x: TUT_MODAL.x, y: Math.round(320 - mh / 2), w: TUT_MODAL.w, h: mh };
    drawPanel(c, M.x, M.y, M.w, M.h, 'TUTORIAL');
    txt(c, tx[0], M.x + M.w / 2, M.y + 62, { font: `400 26px ${FONT_DISPLAY}`, align: 'center', color: P.gold, stroke: P.ink, sw: 5 });
    let ry = M.y + 102;
    paras.forEach(p => { p.forEach(l => { txt(c, l, M.x + M.w / 2, ry, { font: `600 19px ${FONT_UI}`, align: 'center', color: P.cream }); ry += 25; }); ry += 12; });
    w.tutBtn = Object.assign({ label: name === 'intro' ? '¡EMPEZAR!' : '¡A TRABAJAR!' }, tutBtnOk, { y: M.y + M.h - 68 });
    drawButton(c, w.tutBtn);
    return;
  }
  const g = tutTarget(w);                                            // aro dorado que late sobre lo que hay que tocar
  if (g) {
    const k = .5 + .5 * Math.sin(t * 7);
    c.save(); c.lineWidth = 4; c.strokeStyle = `rgba(255,214,90,${.55 + .4 * k})`; c.shadowColor = '#ffc83d'; c.shadowBlur = 10 + 8 * k;
    if (g.rect) { const b = g.rect, p = 4 + 3 * k; rr(c, b.x - p, b.y - p, b.w + p * 2, b.h + p * 2, 12); c.stroke(); }
    else if (g.circle) { c.beginPath(); c.arc(g.circle.x, g.circle.y, g.circle.r + 4 * k, 0, 6.3); c.stroke(); }
    else if (g.tiles) g.tiles.forEach(([a, b]) => { groundQuad(c, a, b, a + 1, b + 1); c.fillStyle = `rgba(255,214,90,${.25 + .3 * k})`; c.fill(); c.stroke(); });
    c.restore();
  }
  const PW = 520, lines = tx.slice(1).flatMap(s => wrapLines(c, s, PW - 36, `600 16px ${FONT_UI}`)), PH = 40 + lines.length * 19, px = 14, py = 70;
  c.save(); c.fillStyle = 'rgba(0,0,0,.4)'; rr(c, px + 3, py + 5, PW, PH, 14); c.fill();
  c.fillStyle = 'rgba(27,15,56,.96)'; rr(c, px, py, PW, PH, 14); c.fill(); c.lineWidth = 3; c.strokeStyle = P.gold; c.stroke();
  txt(c, tx[0], px + 16, py + 24, { font: `700 18px ${FONT_UI}`, color: P.gold, ls: .5 });
  lines.forEach((l, i) => txt(c, l, px + 16, py + 44 + i * 19, { font: `600 16px ${FONT_UI}`, color: P.cream }));
  c.restore();
  drawButton(c, tutBtnSkip);
}

function drawSummary(c, w) {
  c.fillStyle = 'rgba(10,5,30,.75)'; c.fillRect(0, 60, W, H - 60);
  drawPanel(c, 240, 120, 480, 340, `DÍA ${w.day} COMPLETADO`);
  const rows = [['Clientes servidos', String(w.dayServed), P.gold], ['Ventas del día', pesos(w.dayEarned), P.gold], ['Gastos en ingredientes', '-' + pesos(w.dayCost), '#ff8fa0'], ['Caja total', pesos(w.money), P.gold]];
  rows.forEach((r, i) => {
    const y = 184 + i * 33;
    txt(c, r[0], 282, y, { font: `600 22px ${FONT_UI}`, color: P.cream });
    txt(c, r[1], 678, y, { font: `700 26px ${FONT_UI}`, align: 'right', color: r[2], stroke: P.ink, sw: 4 });
    c.strokeStyle = 'rgba(255,255,255,.14)'; c.lineWidth = 1; c.beginPath(); c.moveTo(282, y + 9); c.lineTo(678, y + 9); c.stroke();
  });
  txt(c, 'Reputación', 282, 322, { font: `600 22px ${FONT_UI}`, color: P.cream });
  for (let i = 0; i < 5; i++) {
    const x = 604 + i * 15 - 30, steps = Math.ceil(clamp(w.rep - i, 0, 1) * 3 - 1e-6);
    c.save(); c.globalAlpha = .3; drawMask(c, x, 314, 7, MASKS.gray); c.restore();
    if (steps > 0) { c.save(); c.globalAlpha = [0, .38, .68, 1][steps]; drawMask(c, x, 314, 7, MASKS.ring); c.restore(); }
  }
  txt(c, w.perfect ? '¡Día perfecto! Sin clientes enojados: +1 máscara' : (w.dayAngry ? `${w.dayAngry} cliente(s) se fueron enojados` : 'Todos los clientes quedaron contentos'),
    480, 354, { font: `600 18px ${FONT_UI}`, align: 'center', color: w.perfect ? '#9af0b8' : P.muted });
  txt(c, 'Partida guardada', 480, 378, { font: `600 14px ${FONT_UI}`, align: 'center', color: P.muted, ls: 2 });
  w.overlay.forEach(b => drawButton(c, b));
}
function drawOver(c, w) {
  c.fillStyle = 'rgba(10,5,30,.8)'; c.fillRect(0, 60, W, H - 60);
  drawPanel(c, 240, 120, 480, 340, '¡CLAUSURADO!');
  drawMask(c, 480, 232, 50, MASKS.gray);
  txt(c, 'La reputación llegó a cero.', 480, 318, { font: `700 26px ${FONT_UI}`, align: 'center', color: P.cream });
  txt(c, `Llegaste al día ${w.day} con ${pesos(w.money)} en caja.`, 480, 348, { font: `600 20px ${FONT_UI}`, align: 'center', color: P.muted });
  txt(c, 'Reabrir te devuelve 3 de reputación.', 480, 374, { font: `600 16px ${FONT_UI}`, align: 'center', color: P.muted });
  w.overlay.forEach(b => drawButton(c, b));
}

/* =========================================================
   MÁQUINA DE ESTADOS Y BUCLE PRINCIPAL
   ========================================================= */
const scenes = { MENU: Menu, JUGANDO: Game, AJUSTES: SettingsScene, PARTIDAS: PartidasScene, SALIR: ByeScene };
let state = 'MENU', clock = 0;
function setState(name, arg) {
  state = name;
  const s = scenes[name];
  if (s.enter) s.enter(arg);
}

function toLocal(e) {
  const r = canvas.getBoundingClientRect();
  UI.mx = (e.clientX - r.left) * W / r.width;
  UI.my = (e.clientY - r.top) * H / r.height;
}
canvas.addEventListener('pointerdown', e => {
  UI.touch = e.pointerType === 'touch' || e.pointerType === 'pen';
  try { canvas.focus({ preventScroll: true }); } catch (err) {}      // para que el teclado (R, Esc) llegue siempre al juego
  toLocal(e); UI.down = true; Sfx.unlock();
  scenes[state].pointerDown(UI.mx, UI.my);
  try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
  e.preventDefault();
});
canvas.addEventListener('pointermove', e => { toLocal(e); scenes[state].pointerMove(UI.mx, UI.my); });
const release = e => { toLocal(e); UI.down = false; scenes[state].pointerUp(UI.mx, UI.my); };
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);
canvas.addEventListener('contextmenu', e => { e.preventDefault(); const s = scenes[state]; if (s.rightClick) s.rightClick(); });
canvas.addEventListener('pointerleave', () => { UI.mx = UI.my = -99; });
window.addEventListener('keydown', e => {
  Sfx.unlock();
  const s = scenes[state];
  if (s.key && s.key(e)) e.preventDefault();
});

// iOS: sin zoom por pellizco, sin rebote de pantalla ni selección. (Los toques ya llegan al instante como "pointer events": con touch-action: none no hay retraso de 300 ms.)
['gesturestart', 'gesturechange', 'gestureend'].forEach(n => window.addEventListener(n, e => e.preventDefault()));
['touchstart', 'touchmove'].forEach(n => canvas.addEventListener(n, e => { if (e.cancelable) e.preventDefault(); }, { passive: false }));
window.addEventListener('touchmove', e => { if (e.cancelable && (e.touches.length > 1 || e.target === canvas)) e.preventDefault(); }, { passive: false });
// iPhone y iPad solo dejan activar el audio dentro de un toque terminado (touchend/click): se reintenta hasta que suene
['touchend', 'pointerup', 'click'].forEach(n => window.addEventListener(n, () => { if (!Sfx.ctx || Sfx.ctx.state !== 'running') Sfx.unlock(); }, { passive: true }));
// Guardado al salir: cerrar la pestaña, cambiar de pestaña o esconder la página guarda la partida en curso
const flushSave = () => { try { if (state === 'JUGANDO' || state === 'AJUSTES') Game.save(); } catch (e) {} };
window.addEventListener('pagehide', flushSave);
window.addEventListener('beforeunload', flushSave);
try { if (document.addEventListener) document.addEventListener('visibilitychange', () => { if (document.hidden) flushSave(); }); } catch (e) {}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now; clock += dt;
  fit();
  UI.cursor = false;
  const s = scenes[state];
  let away = false; try { away = !!(window.matchMedia && window.matchMedia('(orientation: portrait) and (max-width: 600px)').matches); } catch (e) {}
  if (!away) s.update(dt);                                          // celular en vertical (se pide girarlo): el juego se queda en pausa
  ctx.setTransform(K, 0, 0, K, 0, 0);
  ctx.clearRect(0, 0, W, H);
  s.draw(ctx);
  canvas.style.cursor = UI.cursor ? 'pointer' : 'default';
  requestAnimationFrame(frame);
}

Game.newGame(null);                // mundo base listo (se reemplaza al elegir Nuevo Juego o Cargar)
setState('MENU');
requestAnimationFrame(frame);

})();
