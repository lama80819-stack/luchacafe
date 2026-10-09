/* Tacos Enmascarados - lógica y dibujo del juego (canvas 2D, sin librerías) */
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
// XP para pasar del nivel lvl al siguiente: cuesta un poco más que antes (≈ 1.3 veces hasta el nivel 10 y ≈ 1.7 veces hasta el 40)
const xpNeed = lvl => Math.round(45 + 24 * (lvl - 1) + .5 * (lvl - 1) * (lvl - 1));
const YEAR = (() => { try { return new Date().getFullYear(); } catch (e) { return 2026; } })();
const COPY = `© ${YEAR} ACP PRODUCCION. Todos los derechos reservados.`;
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
  anil:    { name: 'Demonio Añil',           tag: 'DEMONIO',   price: 30000, level: 30, look: 'anil',    speed: 3.0, drain: .15, tab: 'legend', desc: 'Estamina blindada: casi no necesita banca' },
  // v1.4 · barato pero se cansa el doble de rápido; cobra cada semana (wage)
  payaso:  { name: 'Mesero Payasito',        tag: 'PAYASITO',  price: 1000,  level: 15, look: 'payasito', speed: 3.0, drain: 2.2, tab: 'staff', desc: 'Barato y sin sueldo, pero se cansa el doble de rápido' },
  // v1.4 · meseros que se roban a los restaurantes rivales al vencer a su jefe (no se compran)
  vaquero: { name: 'Vaquero Veloz',          tag: 'VAQUERO',   price: 0, level: 14, look: 'vaquero',  speed: 4.6, drain: .9, wage: 10, steal: 'coyote',   desc: 'Rápido como el viento · $10 por semana' },
  mariachi: { name: 'Mariachi Serenata',     tag: 'MARIACHI',  price: 0, level: 20, look: 'mariachi', speed: 3.2, drain: .8, wage: 10, steal: 'gallos',   perk: 'tip',  desc: 'Canta en las mesas: +8 % de propina · $10 por semana' },
  cholo:   { name: 'Cholo Lowrider',         tag: 'LOWRIDER',  price: 0, level: 26, look: 'cholo',    speed: 3.6, drain: .45, wage: 10, steal: 'lowrider', desc: 'Aguanta todo el día sin cansarse · $10 por semana' },
  itamae:  { name: 'Itamae Kenji',           tag: 'ITAMAE',    price: 0, level: 32, look: 'itamae',   speed: 3.4, drain: .8, wage: 10, steal: 'sakura',   perk: 'cook', desc: 'Cuchillo veloz: todo se cocina 10 % más rápido · $10 por semana' }
};
const STAFF_IDS = Object.keys(STAFF);
const HIRE_IDS = STAFF_IDS.filter(id => STAFF[id].tab);          // los que se compran en la tienda (los meseros robados a los rivales no)
/* =========================================================
   VERSIÓN 1.8: el pueblo (calles, cine, boutique, tienda de muebles, casas, parque y canchas)
   VERSIÓN 1.7: llegada de clientes por mesas y fiestas, más paciencia, sueldos de $10, abrir y cerrar el local, comales de 2/4 lugares, parrilla de 8, vitrina de máscaras y 2 ampliaciones del local
   VERSIÓN 1.6: cocineros, 10 ampliaciones de inventario, estacionamiento grande con coches reales y faroles con luz de verdad
   VERSIÓN 1.5: manos (cuadros de carga abajo, desbloqueables por nivel) y OBRAS con inventario y estacionamiento
   VERSIÓN 1.4: sueldos semanales, cadeneros, Estrellas de Sabor, técnicas de lucha y restaurantes rivales
   ========================================================= */
// Cadeneros: se paran afuera, junto a la puerta, con su bate. Alargan la espera de la fila (drain = qué tan rápido se les acaba la paciencia) y la mantienen en orden:
// al que está por perder la paciencia le llaman la atención (warns veces como máximo por cliente) y le devuelven la calma (warn = fracción de paciencia que recupera)
const GUARDS = {
  cadenero1: { name: 'Cadenero Matón', tag: 'CADENERO', price: 2000, level: 12, wage: 10, drain: .42, warns: 1, warn: .4, look: 'ladron', bat: 'madera', spot: 0,
    desc: 'Máscara negra y bate: la fila espera más del doble y se mantiene en orden · $10 por semana' },
  cadenero2: { name: 'El Oso, Jefe de Puerta', tag: 'JEFE', price: 7500, level: 24, wage: 10, drain: .25, warns: 2, warn: .6, look: 'oso', bat: 'acero', spot: 1,
    desc: 'Enorme y de pocas pulgas: la fila espera 4 veces más y casi no hay pleitos · $10 por semana' }
};
const GUARD_IDS = Object.keys(GUARDS);
// Cocineros (v1.5): cocinan solos. Se paran junto al comal, ven qué piden los clientes y qué falta en la barra, y arrancan una tanda cuando hay lugar libre.
// maxCost = tanda más cara que se atreven a cocinar · timeMul / costMul = lo que tardan y gastan en comparación con cocinar tú (1 = igual) · react = cada cuántos segundos deciden algo
// wage = sueldo por semana (0 = solo pagas una vez al contratarlo). El comienzo es barato pero cobra; los mejores se pagan una sola vez
const CHEFS = {
  chef1: { name: 'Doña Chuy, la Cocinera', tag: 'COCINERA', price: 1500, level: 8, wage: 10, look: 'cocinera', speed: 2.6, react: 2.6, maxCost: 60, drinks: false, timeMul: 1, costMul: 1,
    desc: 'Cocina sola lo sencillo del comal (tandas de hasta $60) · $10 por semana' },
  chef2: { name: 'Chef Ramiro', tag: 'CHEF', price: 9000, level: 20, wage: 0, look: 'chefmedio', speed: 3.0, react: 1.5, maxCost: 150, drinks: true, timeMul: .85, costMul: .92,
    desc: 'Comal, antojitos y bebidas: 15 % más rápido y gasta 8 % menos · pago único' },
  chef3: { name: 'Gran Chef Ibarra', tag: 'GRAN CHEF', price: 28000, level: 35, wage: 0, look: 'chefgran', speed: 3.4, react: .8, maxCost: 999, drinks: true, timeMul: .7, costMul: .8,
    desc: 'Domina todo el menú: 30 % más rápido y gasta 20 % menos · pago único' }
};
const CHEF_IDS = Object.keys(CHEFS);
const chefDef = id => STAFF[id] || GUARDS[id] || CHEFS[id];
function chefHome(i) {                                              // dónde espera: junto al comal (o en una loseta libre si todavía no hay)
  const it = LAYOUT.comals && LAYOUT.comals[0];
  if (it) { const g = neighborCells(it); if (g.length) { const n = g[i % g.length]; return Grid.pt(n.c, n.r); } }
  return nearestFree(2.5 + i * .8, 1.5);
}
function makeChef(id, entering, idx = 0) {
  const d = CHEFS[id], sp = chefHome(idx);
  const m = { id, x: entering ? SPAWN_X : sp.x, y: entering ? SIDE_Y : sp.y, dir: -1, phase: 0, moving: false, speed: d.speed, path: [], t: Math.random() * 6, think: 1.2 + idx * .4, job: null, jobT: 0, work: false, entering: !!entering };
  if (entering) {                                                    // llega por la banqueta y cruza la puerta
    m.path = [{ x: DOOR.ix, y: SIDE_Y }, { x: DOOR.ix, y: -.3 }, Grid.pt(5, 0)];
    const cells = Grid.path({ c: 5, r: 0 }, [{ c: Math.floor(sp.x), r: Math.floor(sp.y) }]) || [];
    cells.forEach(n => m.path.push(Grid.pt(n.c, n.r)));
  }
  return m;
}
const chefCost = (D, r) => Math.max(1, Math.round(r.cost * D.costMul));
const chefTime = (w, D, r) => Math.round(r.time * D.timeMul * (perkOn(w, 'cook') ? .9 : 1) * 10) / 10;
function chefPick(w, ch) {                                          // qué cocinar: primero lo que piden y no hay; si no, lo que se está acabando
  const D = CHEFS[ch.id], want = {};
  w.customers.forEach(cu => { if (cu.state === 'wait') pending(cu).forEach(i => { want[i.key] = (want[i.key] || 0) + 1; w.chefSeen[i.key] = true; }); });
  const busy = new Set(allSlots(w).filter(s => s.state === 'cook').map(s => s.dish));
  let best = null, bs = 0;
  for (const key of MENU) {
    const r = RECIPES[key];
    if (r.level > w.level || r.cost > D.maxCost || (r.drink && !D.drinks) || busy.has(key) || !shelfItem(key)) continue;
    const idx = r.station === 'fridge' ? (LAYOUT.fridge ? w.dslots.findIndex(s => s.state === 'empty') : -1) : w.slots.findIndex((q, j) => q.state === 'empty' && (!r.needs || LAYOUT.slotItem[j].type === r.needs));
    if (idx < 0) continue;
    const cost = chefCost(D, r);
    if (w.money < cost + 25 || w.dayTime < r.time * D.timeMul + 20) continue;
    const short = (want[key] || 0) - w.stock[key];
    let score = 0;
    if (short > 0) score = 100 + short * 5 + r.price;                // hay clientes esperando eso
    else if (w.open && w.stock[key] < 2 && (w.chefSeen[key] || FOODS.indexOf(key) < 2)) score = (2 - w.stock[key]) * 10 + r.price / 10;   // se está acabando algo que sí se vende
    if (score > bs) { bs = score; best = { key, idx, station: r.station, item: r.station === 'fridge' ? LAYOUT.fridge : LAYOUT.slotItem[idx], slot: r.station === 'fridge' ? w.dslots[idx] : w.slots[idx] }; }
  }
  return best;
}
function chefStart(w, ch) {                                         // llegó y preparó: arranca la tanda (si el lugar sigue libre y alcanza el dinero)
  const job = ch.job, D = CHEFS[ch.id], r = RECIPES[job.key], cost = chefCost(D, r);
  if (job.slot.state !== 'empty' || w.money < cost || r.level > w.level) return false;
  Object.assign(job.slot, { state: 'cook', dish: job.key, t: 0, n: r.yield, dur: chefTime(w, D, r), snd: .5 });
  w.money -= cost; w.dayCost += cost;
  const p = r.station === 'fridge' ? fridgeRingPos(0) : slotPos(job.idx);
  addPart(w, { type: 'text', text: '-' + pesos(cost), x: p.x, y: p.y - 30, vy: -34, life: 1.2, color: '#ff8fa0' });
  sfx(r.drink ? 'drinkStart' : 'cookStart');
  return true;
}
function updateChefs(w, dt) {
  for (const ch of w.chefs) {
    const D = CHEFS[ch.id];
    ch.t += dt; step(ch, dt);
    if (ch.entering) { if (!ch.path.length) ch.entering = false; continue; }
    if (ch.path.length) { ch.work = false; continue; }
    if (ch.job) {                                                    // ya está junto a la estación: prepara y arranca
      ch.work = true; ch.jobT -= dt;
      if (ch.jobT <= 0) { chefStart(w, ch); ch.job = null; ch.work = false; ch.think = D.react; }
      continue;
    }
    ch.work = false;
    if ((ch.think -= dt) > 0 || w.dayTime <= 0 || w.tut || w.phase !== 'play') continue;
    ch.think = D.react;
    const job = chefPick(w, ch); if (!job || !job.item) continue;
    const goals = neighborCells(job.item), cells = goals.length ? Grid.path(Grid.cell(ch.x, ch.y), goals) : null;
    if (!cells) { ch.think = 4; continue; }
    ch.job = job; ch.jobT = .5 + D.react * .4; ch.path = cells.map(n => Grid.pt(n.c, n.r));
  }
}
const guardSpot = i => ({ x: DOOR.ix + 1.0 + i * 1.3, y: -2.15 });
const queueDrain = w => {                                          // qué tan rápido se les acaba la paciencia a los de la fila (1 = normal)
  const g = (w.guards || []).filter(q => !q.path.length); if (!g.length) return 1;
  return Math.min(...g.map(q => GUARDS[q.id].drain)) * (g.length > 1 ? .85 : 1);
};
// Estrellas de Sabor: empiezas con media. Se roban a los restaurantes rivales; con más estrellas llegan mejores clientes (más VIP y famosos, más propina y un poco más de gente)
const STAR_START = .5, STAR_MAX = 5;
const starsOf = w => clamp(w.stars == null ? STAR_START : w.stars, STAR_START, STAR_MAX);
const starBonus = w => starsOf(w) - STAR_START;                    // 0 con la media estrella del principio, 4.5 con las cinco
function starTxt(s) { const n = Math.round(s * 2) / 2, f = Math.floor(n); return n % 1 ? (f ? f + '½' : '½') : String(n); }
const perkOn = (w, k) => w.staff.some(m => STAFF[m.id].perk === k && !m.resting && !m.entering);       // ventaja del mesero robado (si está trabajando)
// Sueldos: el personal nuevo cobra cada semana del calendario (7 días del calendario ≈ 2.3 días de juego). Quien no alcanza a cobrar renuncia
const weekOf = day => Math.floor((day - 1) * CAL_STEP / 7);
const payDay = day => weekOf(day + 1) > weekOf(day);               // ¿al cerrar este día termina la semana?
const daysToPay = day => { for (let k = 0; k < 9; k++) if (payDay(day + k)) return k; return 8; };
const crewOf = w => w.staff.filter(m => STAFF[m.id].wage).map(m => ({ kind: 'staff', ref: m, id: m.id, name: STAFF[m.id].name, wage: STAFF[m.id].wage }))
  .concat((w.guards || []).map(g => ({ kind: 'guard', ref: g, id: g.id, name: GUARDS[g.id].name, wage: GUARDS[g.id].wage })))
  .concat((w.chefs || []).filter(m => CHEFS[m.id].wage).map(m => ({ kind: 'chef', ref: m, id: m.id, name: CHEFS[m.id].name, wage: CHEFS[m.id].wage })));
const weeklyWage = w => crewOf(w).reduce((s, q) => s + q.wage, 0);
function payCrew(w) {
  const out = { total: 0, paid: [], quit: [] };
  crewOf(w).sort((a, b) => a.wage - b.wage).forEach(q => {
    if (w.money >= q.wage) { w.money -= q.wage; out.total += q.wage; out.paid.push(q.name); }
    else { out.quit.push(q.name); if (q.kind === 'guard') w.guards = w.guards.filter(g => g !== q.ref); else if (q.kind === 'chef') w.chefs = w.chefs.filter(m => m !== q.ref); else { releaseBench(w, q.ref); w.staff = w.staff.filter(m => m !== q.ref); } }
  });
  return out;
}
// Técnicas de lucha (se compran en la tienda, pestaña TÉCNICAS). dmg = daño base, cost = energía de lucha que gasta, hits = momentos del golpe dentro de la animación
const MOVES = {
  golpe:       { name: 'Golpe Rudo',     level: 1,  price: 0,     dmg: 8,  cost: 0,  dur: 1.0, hits: [.45], desc: 'Tu golpe de siempre. No gasta energía' },
  punetazo:    { name: 'Puñetazo Doble', level: 10, price: 800,   dmg: 15, cost: 10, dur: 1.15, hits: [.36, .62], desc: 'Dos golpes seguidos' },
  patada:      { name: 'Patada Voladora', level: 12, price: 1600,  dmg: 22, cost: 18, dur: 1.2, hits: [.55], desc: 'Salto con patada al pecho' },
  tope:        { name: 'Tope Suicida',   level: 16, price: 3200,  dmg: 30, cost: 26, dur: 1.4, hits: [.6], desc: 'Vuelo de cabeza contra el rival' },
  rana:        { name: 'Huracanrana',    level: 20, price: 5500,  dmg: 28, cost: 30, dur: 1.6, hits: [.62], stun: 1, desc: 'Lo lanza por los aires: pierde su turno' },
  cangrejo:    { name: 'El Cangrejo',    level: 23, price: 8500,  dmg: 22, cost: 30, dur: 1.7, hits: [.5, .72], weak: 2, desc: 'Llave que lo debilita: su golpe duele la mitad 2 turnos' },
  plancha:     { name: 'Plancha Mortal', level: 26, price: 12000, dmg: 44, cost: 42, dur: 1.6, hits: [.66], desc: 'Salto desde lo más alto' },
  quebradora:  { name: 'Quebradora',     level: 29, price: 17000, dmg: 52, cost: 50, dur: 1.9, hits: [.7], desc: 'Lo levanta y lo estrella contra el piso' },
  supermortal: { name: 'Súper Mortal',   level: 32, price: 26000, dmg: 78, cost: 70, dur: 2.1, hits: [.74], desc: 'Doble maroma desde la tercera cuerda' }
};
const MOVE_IDS = Object.keys(MOVES), MOVE_BUY = MOVE_IDS.filter(k => MOVES[k].price > 0);
const MOVES_LEVEL = 10;                                             // nivel en que se abre la pestaña TÉCNICAS
const hasMove = (w, k) => k === 'golpe' || !!(w.moves && w.moves[k]);
const fighterHp = w => 100 + 4 * w.level;
const FIGHT_EN = { max: 100, regen: 18, guard: 22, serum: .28, serums: 2 };         // energía de lucha, recuperación por turno, extra al cubrirse, suero (fracción de vida) y cuántos por pelea
// Restaurantes rivales (mapa). need = técnicas que hay que haber comprado. diff = dificultad (1 a 4). Al vencer al jefe se roban estrellas, dinero, gemas y un mesero
const RIVALS = [
  { id: 'coyote', name: 'Rancho El Coyote', sub: 'Parrilla del Viejo Oeste', boss: 'Sheriff Cuervo', look: 'sheriff', level: 14, need: ['punetazo', 'patada'], hp: 170, diff: 1, stars: 1, money: 1500, gems: 0, waiter: 'vaquero',
    col: '#c98b4e', atk: [{ n: 'Lazo Atrapa-todo', d: 10, k: 'lasso', w: 2 }, { n: 'Patada de Mula', d: 13, k: 'kick', w: 2 }, { n: 'Gancho del Rancho', d: 11, k: 'punch', w: 3 }],
    intro: 'Carne asada, sombreros y puños de hierro', win: '¡El Sheriff Cuervo cuelga la placa!' },
  { id: 'gallos', name: 'Cantina Los Gallos', sub: 'Mariachi y tequila', boss: 'Don Gallo', look: 'gallo', level: 20, need: ['punetazo', 'patada', 'tope', 'rana'], hp: 300, diff: 2, stars: 1, money: 3000, gems: 5, waiter: 'mariachi',
    col: '#17a2b0', atk: [{ n: 'Guitarrazo', d: 17, k: 'smash', w: 3 }, { n: 'Serenata Sónica', d: 20, k: 'notes', w: 2 }, { n: 'Zapateado Veloz', d: 15, k: 'kick', w: 2 }],
    intro: 'Aquí el que no canta, no cobra', win: '¡Don Gallo se queda sin voz!' },
  { id: 'lowrider', name: 'Lowrider Grill', sub: 'Tacos de barrio sobre ruedas', boss: 'El Flaco', look: 'flaco', level: 26, need: ['punetazo', 'patada', 'tope', 'rana', 'cangrejo', 'plancha'], hp: 370, diff: 3, stars: 1, money: 6000, gems: 10, waiter: 'cholo',
    col: '#8b5cf6', atk: [{ n: 'Rin Volador', d: 22, k: 'disc', w: 2 }, { n: 'Embestida Lowrider', d: 27, k: 'charge', w: 2 }, { n: 'Directo del Barrio', d: 21, k: 'punch', w: 3 }],
    intro: 'Bajito y suavecito… hasta que te toca pelear', win: '¡El Flaco se queda sin llantas!' },
  { id: 'sakura', name: 'Sakura Dojo Ramen', sub: 'Cocina japonesa de maestro', boss: 'Maestro Kenji', look: 'kenji', level: 32, need: MOVE_BUY.slice(), hp: 440, diff: 4, stars: 1.5, money: 12000, gems: 20, waiter: 'itamae',
    col: '#ff5fa2', atk: [{ n: 'Sushi Volador', d: 25, k: 'throw', w: 2 }, { n: 'Golpe de Karate', d: 29, k: 'chop', w: 3 }, { n: 'Patada de Garza', d: 27, k: 'kick', w: 2 }],
    intro: 'El maestro nunca pierde la calma… ni los combates', win: '¡El Maestro Kenji se inclina ante ti!' }
];
const RIVAL = Object.fromEntries(RIVALS.map(r => [r.id, r]));
const rivalNeed = (w, R) => R.need.filter(k => !hasMove(w, k));
function rivalState(w, R) {                                         // conq = ya es tuyo · lvl / moves = te falta nivel o técnicas · lock = perdiste hoy · ok = a pelear
  if (w.conq && w.conq[R.id]) return 'conq';
  if (w.level < R.level) return 'lvl';
  if (rivalNeed(w, R).length) return 'moves';
  if (w.fightLock && w.fightLock[R.id] === w.day) return 'lock';
  return 'ok';
}
const MAP_LEVEL = RIVALS[0].level;                                  // desde este nivel el mapa muestra restaurantes disponibles
// Mega Ampliación (nivel 40): el local se vuelve una arena con cuadrilátero central; caben 6 mesas y 3 comales
const ARENA = { price: 40000, level: 40, bonus: 1, ring: { c: 4, r: 3, w: 3, h: 3 }, maxTables: 6, maxComals: 3 };
// Inventario ("cajita") para guardar muebles sin colocar: empieza con 5 lugares y se amplía por niveles
const INV_BASE = 5;
const INV_TIERS = [{ cap: 6, level: 5, price: 600 }, { cap: 7, level: 10, price: 2500 }, { cap: 8, level: 16, price: 4500 }, { cap: 9, level: 22, price: 7000 }, { cap: 10, level: 30, price: 9000 },
  { cap: 12, level: 38, price: 15000 }, { cap: 14, level: 50, price: 25000 }, { cap: 16, level: 58, price: 38000 }, { cap: 18, level: 64, price: 50000 }, { cap: 20, level: 70, price: 60000 }];
// Horario: abre a las 8:00 AM y cierra a las 11:00 PM; un día dura DAY_SEC segundos reales (14 s por hora de juego, como antes)
const DAY_SEC = 210, START_H = 8, END_H = 23;
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
  payaso:  { key: 'payaso',  name: 'EL PAYASO MANIÁTICO', mult: 3, xp: 180, patience: 52, speed: 1.5, scale: 1.12, combo: ['tripa', 'tripa', 'michelada'], chance: .75, win: [11, 20],
             need: w => w.deco.remodeled && !!LAYOUT.fridge && LAYOUT.comals.length > 0, intro: 'pide un combo grande y paga el triple' },
  mistico: { key: 'mistico', name: 'EL MÍSTICO-VOLADOR',  mult: 4, xp: 260, patience: 34, speed: 2.8, scale: 1.0,  combo: ['pastor', 'pastor', 'suadero', 'suadero'], chance: .55, win: [10, 21],
             need: w => w.deco.arena && LAYOUT.comals.length > 0, intro: 'pide un combo ULTRA RÁPIDO: ¡sírvelo ya!' },
  anil:    { key: 'anil',    name: 'DEMONIO AÑIL',        mult: 5, xp: 340, patience: 64, speed: 1.2, scale: 1.26, combo: ['cecina', 'cecina', 'tlacoyo', 'michelada'], chance: .55, win: [12, 21],
             need: w => w.deco.arena && !!LAYOUT.fridge && LAYOUT.comals.length > 0, intro: 'pide un combo pesado y paga cinco veces' }
};
// Visitantes que regalan gemas: cada día hay un 30 % de que llegue uno (desde el nivel 3). Si lo atiendes contento, te deja gemas
// La suerte depende de las máscaras que se ven: con 1 máscara hay ~21 % de que hoy llegue alguien con gemas; con 5, ~73 %. Con 3 o más puede llegar un segundo visitante,
// y los famosos (La Reina del Ring, El Cronista) solo vienen si tu fama es alta. Los VIPs también llegan más seguido.
const GEM_LEVEL = 3;
const gemChance = w => clamp(.08 + .13 * effRep(w) + .012 * starBonus(w), .08, .75);
const vipLuck = w => (.5 + .22 * effRep(w)) * (1 + .15 * starBonus(w));       // las Estrellas de Sabor atraen más VIPs                                  // multiplica la probabilidad base de cada VIP
const GEMMERS = {
  coleccionista: { key: 'coleccionista', name: 'DOÑA COLECCIONISTA',  gems: [2, 3], patience: 58, speed: 1.4,
                   look: { hoodie: '#7c3aed', mask: 'oro', shoes: 'amarillo', skin: '#e0ac69', label: ['DOÑA', 'COLECCIONA'] } },
  campeon:       { key: 'campeon',       name: 'EL CAMPEÓN RETIRADO', gems: [2, 4], patience: 58, speed: 1.3,
                   look: { hoodie: '#b3862a', mask: 'rayo', shoes: 'blanco', skin: '#c68642', label: ['EL', 'CAMPEÓN'] } },
  joyero:        { key: 'joyero',        name: 'EL JOYERO ENMASCARADO', gems: [1, 3], patience: 58, speed: 1.5,
                   look: { hoodie: '#14a38b', mask: 'turquesa', shoes: 'azul', skin: '#f1c27d', label: ['EL', 'JOYERO'] } },
  cronista:      { key: 'cronista',      name: 'EL CRONISTA DEPORTIVO', gems: [0, 1], patience: 62, speed: 1.5, minRep: 2, rep: .5, xp: 150, fame: true, note: 'escribe una reseña: +½ máscara',
                   look: { hoodie: '#2b3a67', mask: 'noche', shoes: 'blanco', skin: '#e0ac69', label: ['PRENSA', 'LUCHA'] } },
  reina:         { key: 'reina',         name: 'LA REINA DEL RING',     gems: [3, 5], patience: 66, speed: 1.4, minRep: 3, xp: 220, fame: true, note: 'una leyenda: deja muchas gemas',
                   look: { hoodie: '#c4272f', mask: 'rosa', shoes: 'amarillo', skin: '#c68642', label: ['LA', 'REINA'] } }
};
const VIP_MIN_MASKS = 2;
// v1.7: 0 = local original (9), 1 = remodelado (11), 2 = Ampliación II (13), 3 = Ampliación III (15)
const EXT_COLS = [9, 11, 13, 15];
const EXPANDS = { 2: { level: 26, price: 22000, bonus: .25 }, 3: { level: 46, price: 60000, bonus: .25 } };
const extOf = d => d.ext != null ? d.ext : d.remodeled ? 1 : 0;
function applyRemodel(on) {                                   // ensancha (o devuelve a su tamaño original) el local en el lienzo
  const n = typeof on === 'number' ? on : on ? 1 : 0;
  COLS = EXT_COLS[n] || 9; OX = 444 - 13.5 * (COLS - 9); OY = 200 - 6 * (COLS - 9);
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
// Antojitos (van a la "barra de antojitos"), aguas de sabores y cervezas (van al mostrador de bebidas). Margen ≈ 2x por tanda, como lo anterior
Object.assign(RECIPES, {
  elote:       { key: 'elote',       name: 'Elotes Locos',            short: 'Elote',       cost: 28,  time: 8,  yield: 5, price: 12, unit: 'porciones', level: 5,  shelf: 'bar2' },
  tostada:     { key: 'tostada',     name: 'Tostadas de Tinga',       short: 'Tostada',     cost: 55,  time: 12, yield: 5, price: 23, unit: 'porciones', level: 12, shelf: 'bar2' },
  pambazo:     { key: 'pambazo',     name: 'Pambazos Rojos',          short: 'Pambazo',     cost: 85,  time: 14, yield: 5, price: 36, unit: 'porciones', level: 18, shelf: 'bar2' },
  chilaquiles: { key: 'chilaquiles', name: 'Chilaquiles Verdes',      short: 'Chilaquiles', cost: 120, time: 16, yield: 6, price: 38, unit: 'porciones', level: 24, shelf: 'bar2' },
  cochinita:   { key: 'cochinita',   name: 'Tacos de Cochinita',      short: 'Cochinita',   cost: 140, time: 17, yield: 6, price: 40, unit: 'porciones', level: 30, shelf: 'bar2' },
  pozole:      { key: 'pozole',      name: 'Pozole Rojo',             short: 'Pozole',      cost: 170, time: 20, yield: 5, price: 60, unit: 'porciones', level: 38, shelf: 'bar2' },
  horchata:    { key: 'horchata',    name: 'Agua de Horchata',        short: 'Horchata',    cost: 20,  time: 5,  yield: 4, price: 11, unit: 'vasos',   drink: true, level: 3 },
  jamaica:     { key: 'jamaica',     name: 'Agua de Jamaica',         short: 'Jamaica',     cost: 22,  time: 5,  yield: 4, price: 12, unit: 'vasos',   drink: true, level: 6 },
  cerveza:     { key: 'cerveza',     name: 'Cerveza Clara Bien Fría', short: 'Cerveza',     cost: 44,  time: 6,  yield: 4, price: 24, unit: 'botellas', drink: true, level: 8, keep: true },
  limonada:    { key: 'limonada',    name: 'Limonada con Chía',       short: 'Limonada',    cost: 24,  time: 5,  yield: 4, price: 13, unit: 'vasos',   drink: true, level: 10 },
  oscura:      { key: 'oscura',      name: 'Cerveza Oscura de Barril', short: 'Oscura',     cost: 60,  time: 7,  yield: 4, price: 32, unit: 'tarros',  drink: true, level: 16, keep: true },
  asada:       { key: 'asada',       name: 'Tacos de Carne Asada',    short: 'Asada',       cost: 105, time: 14, yield: 8, price: 23, unit: 'porciones', level: 18, shelf: 'bar2', needs: 'parrilla' },
  arrachera:   { key: 'arrachera',   name: 'Arrachera con Cebollitas', short: 'Arrachera',  cost: 190, time: 19, yield: 8, price: 42, unit: 'porciones', level: 28, shelf: 'bar2', needs: 'parrilla' }
});
// Orden del menú: por nivel. Las bebidas van a su mostrador; la comida original a la barra y los antojitos a la barra de antojitos
const MENU = ['pastor', 'suadero', 'gordita', 'tripa', 'elote', 'tostada', 'quesadilla', 'pambazo', 'asada', 'sope', 'chilaquiles', 'tlacoyo', 'arrachera', 'cochinita', 'cecina', 'pozole',
  'michelada', 'horchata', 'jamaica', 'cerveza', 'limonada', 'oscura'];
Object.values(RECIPES).forEach(r => { r.level = r.level || 1; });          // nivel necesario para desbloquear el platillo
const FOODS = MENU.filter(k => !RECIPES[k].drink);
const DRINKS = MENU.filter(k => RECIPES[k].drink);
// Cada platillo se prepara en su estación: la comida en el comal y las bebidas en el refrigerador
Object.values(RECIPES).forEach(r => { r.station = r.drink ? 'fridge' : 'comal'; r.shelf = r.shelf || (r.drink ? 'drinks' : 'bar'); });
const SHELF_KEYS = { bar: [], bar2: [], drinks: [] };                       // qué platillos se exhiben en cada mostrador (en el orden de sus lugares)
MENU.forEach(k => SHELF_KEYS[RECIPES[k].shelf].push(k));
const STATIONS = {
  comal:  { title: 'COMAL',        items: FOODS,  cap: 1 },
  fridge: { title: 'REFRIGERADOR', items: DRINKS, cap: 2 }
};
// Comida y bebida que sobra al cerrar se echa a perder (desde el nivel 5) salvo la que cabe en el refri de sobrantes
const SPOIL_LEVEL = 5, STORAGE_CAP = 16;
const FONT_DISPLAY = "'Luckiest Guy', 'Bangers', Impact, 'Arial Black', sans-serif";
const FONT_UI = "'Barlow Condensed', 'Arial Narrow', Impact, sans-serif";

// Colores del logotipo: negro y blanco con los colores de la máscara (rojo, naranja, amarillo, verde, turquesa, morado y rosa)
const P = {
  ink: '#0c0b0d', night: '#060606', violet: '#34303f', plum: '#1c1a25',
  red: '#e0364a', gold: '#ffc83d', teal: '#17a2b0', green: '#2fbf71',
  orange: '#ff8a3d', cream: '#f6e7c1', white: '#fff8ea', muted: '#b4afc4',
  purple: '#8b5cf6', pink: '#ff5fa2', blue: '#3b82f6'
};
const RAINBOW = ['#e0364a', '#ff8a3d', '#ffc83d', '#2fbf71', '#17a2b0', '#3b82f6', '#8b5cf6', '#ff5fa2'];       // la tira de colores del logotipo

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
/* PANTALLA COMPLETA Y CÁMARA ADAPTABLE (iPhone, Android, plegables, tabletas, ventanas de PC, pantallas 16:10, 3:2, 16:9, 21:9 y 32:9; no se usa ninguna lista de modelos):
   1. En modo "completo" el lienzo ocupa toda la ventana, borde a borde (full bleed). Es completo en celulares y tabletas, en una app nativa (Capacitor / Electron),
      con la pantalla completa del navegador (tecla F o F11) y en una app instalada.
   2. Se miden en vivo los márgenes seguros del sistema (notch, cámara perforada, Dynamic Island, barra de gestos) con env(safe-area-inset-*).
      En Android la app nativa también los deja en las variables --safe-area-inset-* (Capacitor SystemBars).
   3. El diseño de 960 x 600 se escala para caber dentro del área segura y se centra en ella (EX/EY = su esquina dentro del lienzo, SL = margen seguro izquierdo).
      Cámara: el escenario nunca se estira; en pantallas muy anchas se ve más decorado a los lados (FOV horizontal adaptable) y en pantallas altas, arriba y abajo.
   4. El HUD se ancla a los bordes seguros, pero nunca más allá de una proporción 2.4:1 (así en 32:9 los botones no quedan a medio metro del escenario).
   5. Resolución interna: la calidad (AUTO / ALTA / MEDIA / BAJA) limita los píxeles del lienzo y AUTO baja sola si el equipo no mantiene los cuadros por segundo. */
let CW = W, CH = H, EX = 0, EY = 0, EB = 0, SL = 0, GL = 0, GR = 0;      // GL / GR = espacio sobrante (dentro del área segura) a la izquierda y a la derecha del diseño: el HUD se ancla a esos bordes
const MOB_Q = '(pointer: coarse), (max-height: 700px) and (orientation: landscape)';
const HUD_MAX_ASPECT = 2.4;
const IS_NATIVE = (() => { try { return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()); } catch (e) { return false; } })();
const IS_ELECTRON = /Electron\//.test(navigator.userAgent || '');
const mq = q => { try { return !!(window.matchMedia && window.matchMedia(q).matches); } catch (e) { return false; } };
const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement || null;
function isFull() { return IS_NATIVE || IS_ELECTRON || !!fsElement() || mq(MOB_Q) || mq('(display-mode: fullscreen)') || mq('(display-mode: standalone)'); }
function canFullscreen() { return IS_ELECTRON ? true : !IS_NATIVE && !!(document.fullscreenEnabled || document.webkitFullscreenEnabled); }
function screenFull() { try { return !!fsElement() || (window.innerWidth >= screen.width - 1 && window.innerHeight >= screen.height - 1); } catch (e) { return false; } }
function toggleFullscreen() {                                      // PC: pantalla completa sin bordes (borderless); en el navegador también sirve F11
  try {
    if (window.desktop && window.desktop.toggleFullscreen) { window.desktop.toggleFullscreen(); return; }      // app de Windows (Electron): ventana nativa
    const el = document.documentElement;
    if (fsElement()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    else (el.requestFullscreen || el.webkitRequestFullscreen).call(el, { navigationUI: 'hide' });
  } catch (e) {}
}
let probeEl = null;
function safeInsets() {                                            // márgenes seguros actuales (px de CSS)
  try {
    if (window.__insets) return window.__insets;                   // (solo para pruebas)
    if (!probeEl) {
      probeEl = document.createElement('div');
      probeEl.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top,var(--safe-area-inset-top,0px)) env(safe-area-inset-right,var(--safe-area-inset-right,0px)) env(safe-area-inset-bottom,var(--safe-area-inset-bottom,0px)) env(safe-area-inset-left,var(--safe-area-inset-left,0px))';
      document.body.appendChild(probeEl);
    }
    const cs = window.getComputedStyle(probeEl), p = k => parseFloat(cs[k]) || 0;
    return { t: p('paddingTop'), r: p('paddingRight'), b: p('paddingBottom'), l: p('paddingLeft') };
  } catch (e) { return { t: 0, r: 0, b: 0, l: 0 }; }
}
// Calidad gráfica: tope de píxeles internos por unidad de diseño (1 = nítido en pantallas normales, 2 = nítido en pantallas retina)
const Gfx = {
  cap: null, slow: 0, n: 0, acc: 0,
  limit() {                                                        // tope actual de la resolución interna
    const q = Settings.quality;
    if (q === 'alta') return 2; if (q === 'media') return 1.5; if (q === 'baja') return 1;
    if (this.cap == null) {                                        // AUTO: equipos modestos empiezan en 1.5
      let weak = false; try { weak = (navigator.deviceMemory && navigator.deviceMemory <= 3) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4); } catch (e) {}
      this.cap = weak ? 1.5 : 2;
    }
    return this.cap;
  },
  tick(dt) {                                                       // AUTO baja la resolución si pasa mucho tiempo por debajo de ~40 cuadros por segundo
    if (Settings.quality !== 'auto' || document.hidden) return;
    this.acc += dt; this.n++;
    if (this.n < 120) return;
    const avg = this.acc / this.n; this.acc = 0; this.n = 0;
    if (avg > 1 / 36 && this.limit() > 1) { if (++this.slow >= 2) { this.cap = this.limit() > 1.5 ? 1.5 : 1; this.slow = 0; } } else this.slow = 0;
  }
};
function fit() {
  const full = isFull();
  try { document.documentElement.classList.toggle('full', full); } catch (e) {}
  if (full && window.getComputedStyle) {
    const vw = Math.max(200, window.innerWidth || 0), vh = Math.max(150, window.innerHeight || 0), ins = safeInsets();
    const sw = Math.max(120, vw - ins.l - ins.r), sh = Math.max(100, vh - ins.t - ins.b);
    const sc = Math.min(sw / W, sh / H);                           // px de CSS por unidad del diseño
    CW = vw / sc; CH = vh / sc;
    EX = (ins.l + (sw - W * sc) / 2) / sc; EY = (ins.t + (sh - H * sc) / 2) / sc; EB = CH - EY - H; SL = ins.l / sc;
    const side = Math.max(0, (H * HUD_MAX_ASPECT - W) / 2);
    GL = Math.min(side, Math.max(0, EX - SL)); GR = Math.min(side, Math.max(0, CW - EX - W - ins.r / sc));
    canvas.style.setProperty('--cw', vw + 'px'); canvas.style.setProperty('--ch', vh + 'px');
    UI.small = H * sc < 470; Cam.def = UI.small ? 1.14 : 1;        // pantallas chicas (iPhone SE): el local se ve un poco más grande y los botones tienen más margen al tocar
  } else { CW = W; CH = H; EX = EY = EB = SL = GL = GR = 0; canvas.style.removeProperty('--cw'); canvas.style.removeProperty('--ch'); UI.small = false; Cam.def = 1; }
  const r = canvas.getBoundingClientRect();
  const k = clamp(Math.min(r.width * (window.devicePixelRatio || 1) / CW, Gfx.limit()), 1, 2);
  const kk = Math.round(k * 4) / 4;                                // pasos de 0.25: no se redimensiona el lienzo por cambios mínimos
  if (canvas.width !== Math.round(CW * kk) || canvas.height !== Math.round(CH * kk)) { canvas.width = Math.round(CW * kk); canvas.height = Math.round(CH * kk); }
  K = kk;
}
window.addEventListener('resize', fit);
window.addEventListener('orientationchange', () => setTimeout(fit, 60));
['fullscreenchange', 'webkitfullscreenchange'].forEach(n => document.addEventListener(n, () => setTimeout(fit, 30)));
try { if (window.visualViewport) window.visualViewport.addEventListener('resize', fit); } catch (e) {}      // plegables y ventanas redimensionables

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
  let font = o.font || `700 20px ${FONT_UI}`, ls = o.ls || 0;
  if (o.maxW) {                                                    // que el texto nunca se salga de su caja: se encoge letra y espaciado
    c.font = font; if ('letterSpacing' in c) c.letterSpacing = '0px';
    const wd = c.measureText(String(s)).width + ls * Math.max(0, String(s).length - 1);
    if (wd > o.maxW) { const k = o.maxW / wd; font = font.replace(/(\d+(?:\.\d+)?)px/, (m, a) => (a * k).toFixed(2) + 'px'); ls *= k; }
  }
  c.font = font;
  c.textAlign = o.align || 'left';
  c.textBaseline = o.base || 'alphabetic';
  if (ls && 'letterSpacing' in c) {
    c.letterSpacing = ls + 'px';
    const al = o.align || 'left'; if (al === 'center') x += (MIRROR ? -1 : 1) * ls / 2; else if (al === 'right') x += (MIRROR ? -1 : 1) * ls;      // el último espacio no cuenta: el texto queda realmente centrado
  }
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
  ring:  { base: '#e0364a', accent: '#17a2b0', trim: '#ffc83d', hole: P.ink },
  novato:{ base: '#2fbf71', accent: '#1b8a52', trim: '#fff3b0', hole: '#ffffff', pupil: true },
  blue:  { base: '#3b5bdb', accent: '#ffc83d', trim: '#ffffff', hole: P.ink },
  black: { base: '#2b2540', accent: '#e0364a', trim: '#ffc83d', hole: P.ink },
  pink:  { base: '#ff5fa2', accent: '#7c3aed', trim: '#fff3b0', hole: P.ink },
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

/*LOGO-START*/
/* =========================================================
   LOGOTIPO: la máscara de ENMASCARADOS
   Borde blanco grueso que resalta sobre lo oscuro; por dentro es muy colorida (flores, hojas y llamas de talavera / alebrije).
   Solo usa el lienzo (sin nada del juego) para que el mismo dibujo sirva en el menú y en los íconos de la app.
   ========================================================= */
const LG = { red: '#e0364a', orange: '#ff8a3d', yellow: '#ffc83d', green: '#2fbf71', teal: '#17a2b0', purple: '#8b5cf6', pink: '#ff5fa2', cream: '#fff3b0', blue: '#3b82f6', ink: '#08080c' };
function lgHead(c) {
  c.beginPath(); c.moveTo(0, -1.15);
  c.bezierCurveTo(0.75, -1.15, 0.95, -0.6, 0.92, -0.1); c.bezierCurveTo(0.9, 0.5, 0.6, 1.0, 0.3, 1.2);
  c.quadraticCurveTo(0, 1.28, -0.3, 1.2); c.bezierCurveTo(-0.6, 1.0, -0.9, 0.5, -0.92, -0.1); c.bezierCurveTo(-0.95, -0.6, -0.75, -1.15, 0, -1.15); c.closePath();
}
function lgEye(c, m) {
  c.beginPath(); c.moveTo(m * 0.86, -0.30); c.quadraticCurveTo(m * 0.52, -0.58, m * 0.10, -0.2); c.quadraticCurveTo(m * 0.28, 0.2, m * 0.70, 0.16); c.quadraticCurveTo(m * 0.9, 0.02, m * 0.86, -0.30); c.closePath();
}
function lgMouth(c) {
  c.beginPath(); c.moveTo(-0.24, 0.52); c.lineTo(0.24, 0.52); c.quadraticCurveTo(0.4, 0.52, 0.4, 0.64); c.quadraticCurveTo(0.4, 0.78, 0.24, 0.78); c.lineTo(-0.24, 0.78); c.quadraticCurveTo(-0.4, 0.78, -0.4, 0.64); c.quadraticCurveTo(-0.4, 0.52, -0.24, 0.52); c.closePath();
}
function lgNose(c) { c.beginPath(); c.moveTo(0, 0.24); c.quadraticCurveTo(0.1, 0.32, 0.07, 0.39); c.quadraticCurveTo(0, 0.43, -0.07, 0.39); c.quadraticCurveTo(-0.1, 0.32, 0, 0.24); c.closePath(); }
function lgPetal(c, x, y, len, wid, ang, col) {
  c.save(); c.translate(x, y); c.rotate(ang); c.beginPath(); c.moveTo(0, 0);
  c.bezierCurveTo(wid, -len * .25, wid * .85, -len * .8, 0, -len); c.bezierCurveTo(-wid * .85, -len * .8, -wid, -len * .25, 0, 0);
  c.fillStyle = col; c.fill(); c.lineWidth = .014; c.strokeStyle = LG.ink; c.stroke(); c.restore();
}
function lgFlower(c, x, y, r, n, col, center, rot = 0) {
  for (let i = 0; i < n; i++) lgPetal(c, x, y, r, r * .46, rot + i / n * 6.2832, col);
  c.fillStyle = center; c.beginPath(); c.arc(x, y, r * .3, 0, 6.3); c.fill(); c.lineWidth = .014; c.strokeStyle = LG.ink; c.stroke();
  c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.arc(x - r * .08, y - r * .08, r * .07, 0, 6.3); c.fill();
}
function drawLogoMask(c, x, y, s) {
  const rnd = i => { const q = Math.sin(i * 127.1 + 311.7) * 43758.5453; return q - Math.floor(q); };
  c.save(); c.translate(x, y); c.scale(s, s); c.lineJoin = 'round'; c.lineCap = 'round';
  lgHead(c); c.fillStyle = LG.ink; c.fill();
  c.save(); lgHead(c); c.clip();
  // confeti de colores sobre el fondo negro
  const cols = [LG.red, LG.orange, LG.yellow, LG.green, LG.teal, LG.purple, LG.pink];
  for (let i = 0; i < 260; i++) { const a = rnd(i) * 6.2832, r = Math.sqrt(rnd(i + 200)) * 1.0; c.fillStyle = cols[i % cols.length]; c.beginPath(); c.arc(Math.cos(a) * r * .95, 0.05 + Math.sin(a) * r * 1.2, .016 + rnd(i + 400) * .028, 0, 6.3); c.fill(); }
  // enredaderas que rodean los ojos y el cachete
  c.lineWidth = .04; c.strokeStyle = LG.green;
  for (const m of [-1, 1]) {
    c.beginPath(); c.moveTo(m * .9, -.5); c.bezierCurveTo(m * .7, -.78, m * .35, -.74, m * .08, -.46); c.stroke();
    c.strokeStyle = LG.pink; c.beginPath(); c.moveTo(m * .9, .06); c.bezierCurveTo(m * .86, .42, m * .6, .62, m * .46, .5); c.stroke();
    c.strokeStyle = LG.yellow; c.beginPath(); c.moveTo(m * .42, .3); c.bezierCurveTo(m * .3, .42, m * .52, .62, m * .3, .62); c.stroke();
    c.strokeStyle = LG.teal; c.beginPath(); c.moveTo(m * .3, .9); c.bezierCurveTo(m * .5, .88, m * .6, .98, m * .5, 1.04); c.stroke(); c.strokeStyle = LG.green;
  }
  // frente: llama central, tulipanes, hojas y flores
  for (const m of [-1, 1]) {
    lgPetal(c, m * .16, -.46, .36, .13, m * .75, LG.green); lgPetal(c, m * .3, -.5, .3, .1, m * 1.15, LG.teal);
    lgPetal(c, m * .22, -.56, .44, .15, m * .38, LG.purple); lgPetal(c, m * .22, -.56, .28, .09, m * .38, LG.pink);
    lgFlower(c, m * .52, -.84, .18, 8, LG.pink, LG.yellow, m * .3); lgFlower(c, m * .24, -1.0, .1, 6, LG.teal, LG.cream);
    lgPetal(c, m * .82, -.3, .34, .1, m * 1.9, LG.green); lgPetal(c, m * .86, -.5, .3, .09, m * 1.2, LG.teal);
    lgFlower(c, m * .62, .36, .24, 10, LG.orange, LG.red, m * .2); lgFlower(c, m * .66, -.58, .17, 9, LG.yellow, LG.red, m * .1); lgFlower(c, m * .13, .0, .09, 6, LG.purple, LG.yellow); lgFlower(c, m * .25, .44, .1, 7, LG.pink, LG.yellow); lgPetal(c, m * .2, .3, .24, .07, m * 2.2, LG.green); lgPetal(c, m * .3, .6, .2, .06, m * 2.9, LG.teal); lgFlower(c, m * .6, .72, .1, 7, LG.teal, LG.yellow); lgFlower(c, m * .14, .98, .12, 8, LG.pink, LG.cream); lgFlower(c, m * .8, .58, .12, 7, LG.pink, LG.yellow);
    lgPetal(c, m * .45, .22, .3, .09, m * 2.4, LG.green); lgPetal(c, m * .72, .78, .28, .09, m * 2.7, LG.teal);
    lgFlower(c, m * .36, .86, .18, 9, LG.yellow, LG.red); lgFlower(c, m * .78, .3, .1, 6, LG.purple, LG.cream); lgPetal(c, m * .22, 1.0, .26, .08, m * 2.2, LG.green);
  }
  lgPetal(c, 0, -.36, .74, .26, 0, LG.yellow); lgPetal(c, 0, -.36, .55, .17, 0, LG.orange); lgPetal(c, 0, -.36, .34, .1, 0, LG.red);
  lgFlower(c, 0, 1.03, .1, 6, LG.teal, LG.yellow);
  lgFlower(c, 0, .06, .12, 8, LG.orange, LG.red); lgPetal(c, 0, .24, .16, .06, 3.1416, LG.green);
  // lentejuela roja en el borde interior
  for (let i = 0; i < 90; i++) { const a = i / 90 * 6.2832, px = Math.sin(a) * .83, py = -Math.cos(a) * (Math.cos(a) > 0 ? 1.05 : 1.02) + .06; c.fillStyle = i % 3 ? LG.red : '#ff9a9a'; c.beginPath(); c.arc(px, py, .016, 0, 6.3); c.fill(); }
  c.restore();
  // ojos, nariz y boca: huecos negros con aro blanco
  for (const hole of [() => lgEye(c, -1), () => lgEye(c, 1), () => lgNose(c), () => lgMouth(c)]) {
    hole(); c.fillStyle = LG.ink; c.fill(); c.lineWidth = .15; c.strokeStyle = LG.ink; c.stroke(); c.lineWidth = .075; c.strokeStyle = '#fff'; c.stroke(); hole(); c.fillStyle = LG.ink; c.fill();
  }
  for (const m of [-1, 1]) { c.fillStyle = 'rgba(255,255,255,.85)'; c.beginPath(); c.arc(m * .5, -.22, .04, 0, 6.3); c.fill(); }          // brillito en cada ojo
  c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = .025; c.beginPath(); c.moveTo(-.24, .59); c.lineTo(.24, .59); c.stroke();                       // brillo del labio
  // borde blanco grueso (con un filo negro por fuera para que resalte sobre cualquier fondo)
  lgHead(c); c.lineWidth = .24; c.strokeStyle = LG.ink; c.stroke(); lgHead(c); c.lineWidth = .17; c.strokeStyle = '#fff'; c.stroke();
  c.restore();
}
// Versión guardada en memoria (se dibuja una sola vez por tamaño): sirve para poner brillo detrás sin gastar cuadros
const lgCache = {};
function drawLogoCached(c, x, y, s, k = 2) {
  const key = Math.round(s * k), W2 = Math.ceil(2.6 * key), H2 = Math.ceil(3.0 * key);
  let cv = lgCache[key];
  if (!cv) { cv = lgCache[key] = document.createElement('canvas'); cv.width = W2; cv.height = H2; const g = cv.getContext('2d'); if (g) { g.translate(W2 / 2, H2 * .47); drawLogoMask(g, 0, 0, key); } }
  c.drawImage(cv, x - W2 / 2 / k, y - H2 * .47 / k, W2 / k, H2 / k);
}
/*LOGO-END*/

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
  } else if (kind === 'cochinita') {                                                                             // cochinita pibil: carne roja de achiote, cebolla morada encurtida y habanero
    blob(-3.4, -5.2, 2.8, '#d9621f'); blob(.8, -6, 3, '#e8782a'); blob(4, -4.6, 2.4, '#c4501a');
    c.fillStyle = '#c04aa6'; c.fillRect(-4.8, -8.2, 2.4, 1.4); c.fillRect(1.4, -8.4, 2.6, 1.4); c.fillRect(4.2, -7.6, 2, 1.3);
    blob(-1, -8, 1.4, '#ff8a1e');
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
  } else if (kind === 'asada') {                                                                                // carne asada: cubitos dorados con marcas de parrilla, cebollitas y limón
    blob(-3.8, -5, 2.7, '#7a3a22'); blob(.6, -6.2, 3, '#8f4a2a'); blob(4, -4.8, 2.5, '#6a3019');
    c.strokeStyle = 'rgba(20,8,4,.7)'; c.lineWidth = .9; for (const [ax, ay] of [[-3.8, -5], [.6, -6.2], [4, -4.8]]) { c.beginPath(); c.moveTo(ax - 1.6, ay - 1.2); c.lineTo(ax + 1.6, ay + 1.2); c.moveTo(ax - 1.6, ay + .4); c.lineTo(ax + 1, ay + 2); c.stroke(); }
    c.strokeStyle = '#6fcf4a'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-5.6, -3.8); c.lineTo(-6.8, -8); c.moveTo(5.8, -3.4); c.lineTo(7, -7.8); c.stroke();
    c.fillStyle = '#fff8ea'; c.fillRect(-1.2, -8.6, 2.2, 1.5); blob(2.6, -8.2, 1.2, '#9bd84a');
  } else if (kind === 'arrachera') {                                                                            // arrachera: tiras gruesas con la marca de la parrilla y cebollitas cambray
    c.lineWidth = 1.2; c.strokeStyle = P.ink;
    for (const [ox, oy, rot] of [[-3.4, -5.6, -.4], [.4, -7, .05], [3.8, -5.4, .5]]) { c.save(); c.translate(ox, oy); c.rotate(rot); c.fillStyle = '#9a4a34'; rr(c, -4.2, -2.2, 8.4, 4.4, 1.8); c.fill(); c.stroke(); c.strokeStyle = 'rgba(25,8,4,.75)'; c.beginPath(); c.moveTo(-2.4, -1.8); c.lineTo(-1.2, 1.8); c.moveTo(.6, -1.8); c.lineTo(1.8, 1.8); c.stroke(); c.restore(); c.strokeStyle = P.ink; }
    blob(-5.4, -8.6, 1.9, '#f4f1e8'); blob(5.6, -8.4, 1.7, '#f4f1e8'); c.strokeStyle = '#4fbf4a'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(-5.4, -9.6); c.lineTo(-6, -12.4); c.moveTo(5.6, -9.4); c.lineTo(6.2, -12.2); c.stroke();
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
  } else if (key === 'elote') {                                             // elote en vaso... en palito: mazorca con mayonesa, queso y chile
    c.save(); c.translate(x, y); c.scale(r / 6.5, r / 6.5); c.lineJoin = 'round'; c.lineCap = 'round'; c.lineWidth = 1.5; c.strokeStyle = P.ink;
    c.strokeStyle = '#a8793a'; c.lineWidth = 2.4; c.beginPath(); c.moveTo(-8, 6); c.lineTo(-2.6, 1.6); c.stroke();                // palito
    c.save(); c.rotate(-.5); c.strokeStyle = P.ink; c.lineWidth = 1.5; c.fillStyle = '#ffd23a'; c.beginPath(); c.ellipse(1.2, -.4, 8.2, 4.2, 0, 0, 6.3); c.fill(); c.stroke();
    c.strokeStyle = 'rgba(190,130,20,.75)'; c.lineWidth = .8;
    for (let k = -6; k <= 6; k += 2.4) { c.beginPath(); c.moveTo(1.2 + k, -3.9 * Math.sqrt(Math.max(0, 1 - k * k / 67))); c.lineTo(1.2 + k, 3.9 * Math.sqrt(Math.max(0, 1 - k * k / 67))); c.stroke(); }
    c.strokeStyle = '#fff8ea'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-4.4, -1.4); c.quadraticCurveTo(-1, -3, 2, -1); c.quadraticCurveTo(5, 1, 7, -.6); c.stroke();     // mayonesa
    c.fillStyle = '#e0364a'; for (const [qx, qy] of [[-3, 1.2], [.2, -2], [3.4, 1.6], [5.6, -1.8]]) c.fillRect(qx, qy, 1.3, 1.3);                                         // chile
    c.fillStyle = '#fff3d0'; for (const [qx, qy] of [[-1.6, 2.2], [2, -.6], [4.8, 1]]) c.fillRect(qx, qy, 1.5, 1.2);                                                         // queso
    c.restore(); c.restore();
  } else if (key === 'tostada') {                                           // tostada de tinga: tortilla dorada con pollo rojo, lechuga, crema y aguacate
    c.save(); c.translate(x, y); c.scale(r / 6.5, r / 6.5); c.lineJoin = 'round'; c.lineCap = 'round'; c.lineWidth = 1.5; c.strokeStyle = P.ink;
    c.fillStyle = '#c99a4a'; c.beginPath(); c.ellipse(0, 2.2, 8, 4.8, 0, 0, 6.3); c.fill(); c.stroke();
    c.fillStyle = '#e8c070'; c.beginPath(); c.ellipse(0, .6, 8, 4.8, 0, 0, 6.3); c.fill(); c.stroke();
    c.fillStyle = '#3fb04f'; c.beginPath(); c.ellipse(-2.4, -.6, 3.6, 1.7, .3, 0, 6.3); c.ellipse(2.6, 0, 3.2, 1.5, -.3, 0, 6.3); c.fill();
    c.fillStyle = '#b3321c'; for (const [bx, by, br] of [[-2.8, -1.2, 2.2], [.8, -2.2, 2.4], [3.2, -.8, 2]]) { c.beginPath(); c.arc(bx, by, br, 0, 6.3); c.fill(); }
    c.strokeStyle = '#fff8ea'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-4.4, 1); c.lineTo(-2.2, -.6); c.lineTo(0, 1.2); c.lineTo(2.2, -.6); c.lineTo(4.4, 1); c.stroke();
    c.fillStyle = '#7bbf3f'; c.beginPath(); c.arc(-.4, -3.6, 1.7, 0, 6.3); c.fill(); c.strokeStyle = P.ink; c.lineWidth = 1; c.stroke();
    c.restore();
  } else if (key === 'pambazo') {                                           // pan bañado en salsa roja relleno de papa con chorizo y lechuga
    c.save(); c.translate(x, y); c.scale(r / 6.5, r / 6.5); c.lineJoin = 'round'; c.lineCap = 'round'; c.lineWidth = 1.5; c.strokeStyle = P.ink;
    c.fillStyle = '#b23318'; c.beginPath(); c.ellipse(0, 3, 8.2, 3.6, 0, 0, 6.3); c.fill(); c.stroke();                                  // pan de abajo
    c.fillStyle = '#e8b04a'; c.beginPath(); c.ellipse(0, .8, 7.4, 2.7, 0, 0, 6.3); c.fill();                                              // papa
    c.fillStyle = '#c4381d'; for (const qx of [-4, -1, 2.4, 5]) c.fillRect(qx, -.2, 1.5, 1.3);                                           // chorizo
    c.fillStyle = '#3fb04f'; c.beginPath(); c.ellipse(-2, -.6, 3.4, 1.3, .2, 0, 6.3); c.ellipse(3, -.4, 3, 1.2, -.2, 0, 6.3); c.fill();
    c.fillStyle = '#d14122'; c.beginPath(); c.moveTo(-8.2, -.4); c.quadraticCurveTo(-7, -7.6, 0, -7.8); c.quadraticCurveTo(7, -7.6, 8.2, -.4); c.quadraticCurveTo(0, -2.6, -8.2, -.4); c.closePath(); c.fill(); c.stroke();   // tapa
    c.fillStyle = 'rgba(255,255,255,.4)'; c.beginPath(); c.ellipse(-2.6, -4.8, 2.6, 1.2, -.3, 0, 6.3); c.fill();
    c.fillStyle = '#fff3d0'; for (const [qx, qy] of [[2, -5.2], [4.2, -3.6], [-.4, -2.6]]) c.fillRect(qx, qy, 1.2, 1);
    c.restore();
  } else if (key === 'chilaquiles') {                                       // totopos en salsa verde con crema, queso y huevo estrellado
    c.save(); c.translate(x, y); c.scale(r / 6.5, r / 6.5); c.lineJoin = 'round'; c.lineCap = 'round'; c.lineWidth = 1.5; c.strokeStyle = P.ink;
    c.fillStyle = '#fffaf0'; c.beginPath(); c.ellipse(0, 1.6, 8.6, 5.2, 0, 0, 6.3); c.fill(); c.stroke();
    c.fillStyle = '#6fae3a'; c.beginPath(); c.ellipse(0, .8, 7.2, 4, 0, 0, 6.3); c.fill();
    c.fillStyle = '#e0d070'; for (const [tx, ty, rot] of [[-4.2, .2, .3], [-1.4, 1.8, -.4], [2, .8, .9], [4.4, 2, -.2], [-3.4, 2.6, 1], [.6, -1.6, .1]]) { c.save(); c.translate(tx, ty); c.rotate(rot); c.beginPath(); c.moveTo(-2, 1.4); c.lineTo(2, 1.4); c.lineTo(0, -1.8); c.closePath(); c.fill(); c.stroke(); c.restore(); }
    c.fillStyle = '#fff8ea'; c.beginPath(); c.ellipse(-.6, -.8, 3.4, 2.2, .2, 0, 6.3); c.fill(); c.stroke();                                   // huevo
    c.fillStyle = '#ffc01e'; c.beginPath(); c.arc(-.6, -.9, 1.2, 0, 6.3); c.fill();
    c.strokeStyle = '#fff8ea'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(2.4, -2); c.quadraticCurveTo(4.6, -.4, 6, -2); c.stroke();
    c.restore();
  } else if (key === 'pozole') {                                            // cazuelita de barro con caldo rojo, maíz, rábano y limón
    c.save(); c.translate(x, y); c.scale(r / 6.5, r / 6.5); c.lineJoin = 'round'; c.lineCap = 'round'; c.lineWidth = 1.5; c.strokeStyle = P.ink;
    c.fillStyle = '#a8542c'; c.beginPath(); c.moveTo(-8, -1); c.lineTo(8, -1); c.quadraticCurveTo(7, 7.6, 0, 7.8); c.quadraticCurveTo(-7, 7.6, -8, -1); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#c8683a'; c.beginPath(); c.ellipse(0, -1, 8.2, 2.7, 0, 0, 6.3); c.fill(); c.stroke();
    c.fillStyle = '#b0241a'; c.beginPath(); c.ellipse(0, -1, 6.6, 1.9, 0, 0, 6.3); c.fill();
    c.fillStyle = '#fff3d0'; for (const [qx, qy] of [[-3.6, -1.2], [-1, -.4], [1.8, -1.6], [4, -.8], [.4, -2.1]]) { c.beginPath(); c.arc(qx, qy, .95, 0, 6.3); c.fill(); }
    c.fillStyle = '#3fb04f'; c.beginPath(); c.ellipse(-4.4, -2.8, 2.1, 1, .5, 0, 6.3); c.ellipse(3.6, -2.9, 2, 1, -.5, 0, 6.3); c.fill();
    c.fillStyle = '#e0364a'; c.beginPath(); c.arc(-.6, -3, 1.5, 0, 6.3); c.fill(); c.stroke();
    c.fillStyle = '#6fcf4a'; c.beginPath(); c.arc(5.4, -2.4, 2, Math.PI, 0); c.closePath(); c.fill(); c.stroke();
    c.restore();
  } else if (key === 'horchata' || key === 'jamaica' || key === 'limonada') {   // vaso de agua fresca: cada sabor su color y su adorno
    const col = key === 'horchata' ? ['#f8f1e0', '#e4d6b8'] : key === 'jamaica' ? ['#b0165c', '#7a0d3d'] : ['#d6ee74', '#a9cc3c'];
    c.save(); c.translate(x, y); c.scale(r / 7.6, r / 7.6); c.lineJoin = 'round'; c.lineWidth = 1.5; c.strokeStyle = P.ink;
    c.beginPath(); c.moveTo(-5.4, -7); c.lineTo(5.4, -7); c.lineTo(4.2, 7); c.lineTo(-4.2, 7); c.closePath(); c.fillStyle = 'rgba(214,235,248,.95)'; c.fill(); c.stroke();
    c.fillStyle = col[0]; c.beginPath(); c.moveTo(-5, -4.6); c.lineTo(5, -4.6); c.lineTo(4.2, 6.4); c.lineTo(-4.2, 6.4); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(-4, -3.8, 1.8, 8);
    c.fillStyle = 'rgba(255,255,255,.75)'; for (const [qx, qy] of [[-1.6, -1], [1.8, 1.8], [0, 4]]) c.fillRect(qx, qy, 2.4, 2.4);                    // hielos
    if (key === 'horchata') { c.strokeStyle = '#8a5a2c'; c.lineWidth = 2; c.beginPath(); c.moveTo(1, -2); c.lineTo(5.8, -9.6); c.stroke(); c.strokeStyle = '#c4915a'; c.lineWidth = .9; c.beginPath(); c.moveTo(1.4, -2.4); c.lineTo(6, -9.6); c.stroke(); }
    else if (key === 'jamaica') { c.fillStyle = '#d6203f'; for (let k = 0; k < 5; k++) { const a = k * 1.2566; c.beginPath(); c.ellipse(5.2 + Math.cos(a) * 2, -6.6 + Math.sin(a) * 2, 1.6, 1.1, a, 0, 6.3); c.fill(); } c.fillStyle = '#ffc83d'; c.beginPath(); c.arc(5.2, -6.6, .9, 0, 6.3); c.fill(); }
    else { c.fillStyle = P.ink; for (const [qx, qy] of [[-2.6, -2], [-.4, 1], [2.4, -.4], [.8, 3.6], [-2.8, 3.4]]) c.fillRect(qx, qy, .9, .9);                       // chía
      c.fillStyle = '#6fcf4a'; c.beginPath(); c.arc(4.8, -7, 3, 0, 6.3); c.fill(); c.stroke(); c.strokeStyle = '#d6ee74'; c.lineWidth = .8; c.beginPath(); c.moveTo(4.8, -10); c.lineTo(4.8, -4); c.moveTo(1.8, -7); c.lineTo(7.8, -7); c.stroke(); }
    c.restore();
  } else if (key === 'cerveza' || key === 'oscura') {                       // tarro de cerveza: clara y dorada, u oscura con espuma café
    const dark = key === 'oscura';
    c.save(); c.translate(x, y); c.scale(r / 7.6, r / 7.6); c.lineJoin = 'round'; c.lineWidth = 1.5; c.strokeStyle = P.ink;
    c.strokeStyle = '#d6e8f2'; c.lineWidth = 2.2; c.beginPath(); c.arc(6.2, 0, 3.6, -1.3, 1.3); c.stroke();                                  // asa
    c.strokeStyle = P.ink; c.lineWidth = 1.5;
    c.fillStyle = 'rgba(214,235,248,.95)'; c.beginPath(); c.moveTo(-5.6, -6); c.lineTo(5.2, -6); c.lineTo(4.6, 7); c.lineTo(-4.6, 7); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = dark ? '#4a2210' : '#f3b630'; c.beginPath(); c.moveTo(-5.2, -3.4); c.lineTo(4.9, -3.4); c.lineTo(4.4, 6.4); c.lineTo(-4.4, 6.4); c.closePath(); c.fill();
    c.fillStyle = dark ? 'rgba(255,200,120,.25)' : 'rgba(255,255,255,.35)'; c.fillRect(-4, -2.6, 1.6, 8);
    c.fillStyle = dark ? '#d9b98a' : '#fffaf0'; c.beginPath(); c.arc(-3.6, -4.8, 2.6, 0, 6.3); c.arc(-.6, -5.8, 3, 0, 6.3); c.arc(2.8, -5, 2.8, 0, 6.3); c.fill(); c.lineWidth = 1.1; c.stroke();
    c.restore();
  } else {
    drawTaco(c, x, y + r * .7, r, key);
  }
}
// Una porción servida en un platito (o tarro con posavasos). s = tamaño, glow = resplandor.
function drawPortionPlate(c, key, x, y, s, glow, t) {
  c.save(); c.translate(x, y); c.scale(s, s);
  drawPlate(c, 0, 0, 0, glow, t || 0);
  drawDish(c, key, 0, RECIPES[key] && RECIPES[key].drink ? -5 : -2, RECIPES[key] && RECIPES[key].drink ? 7 : 8);
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
const Settings = Object.assign({ sound: true, music: true, volume: 0.6, quality: 'auto', fps: 'auto' }, Store.read(Store.CFG) || {});
if (!['auto', 'alta', 'media', 'baja'].includes(Settings.quality)) Settings.quality = 'auto';
if (!['auto', '60', '30'].includes(Settings.fps)) Settings.fps = 'auto';
const saveSettings = () => Store.write(Store.CFG, { sound: Settings.sound, music: Settings.music, volume: Settings.volume, quality: Settings.quality, fps: Settings.fps });

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
    if (this.ctx && this.ctx.state !== 'running') { try { const p = this.ctx.resume(); if (p && p.catch) p.catch(() => {}); } catch (e) {} }     // (iPhone: también 'interrupted' tras una llamada o al volver a la app)
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
    const c = this.ctx, t = c.currentTime + (o.delay || 0);
    const src = c.createBufferSource(); src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = o.type || 'bandpass'; f.frequency.value = o.freq || 4000; if (o.q) f.Q.value = o.q;
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
    carArrive() { this.noise(.9, { freq: 260, vol: .16, type: 'lowpass' }); this.tone(70, .7, { type: 'sawtooth', vol: .07, to: 115 }); this.tone(520, .12, { type: 'square', vol: .06, delay: .55 }); this.tone(660, .16, { type: 'square', vol: .06, delay: .7 }); },
    pum()    { this.noise(.45, { freq: 220, vol: .5, type: 'lowpass' }); this.tone(90, .35, { type: 'sine', vol: .5, to: 40 }); this.tone(420, .12, { type: 'square', vol: .12, to: 180, delay: .02 }); },
    bell()   {                                                   // campana de ring: ¡DONG! ¡DONG!
      for (let k = 0; k < 2; k++) {
        const d = k * .62;
        this.tone(660, 1.5, { type: 'sine', vol: .34, delay: d, to: 650 }); this.tone(1320, 1.1, { type: 'sine', vol: .18, delay: d }); this.tone(1990, .7, { type: 'sine', vol: .1, delay: d });
        this.tone(330, 1.7, { type: 'triangle', vol: .2, delay: d }); this.noise(.08, { freq: 3000, vol: .3, type: 'highpass' });
      }
    },
    pour()   { this.noise(.5, { freq: 900, vol: .2, type: 'lowpass' }); this.tone(520, .12, { type: 'sine', vol: .12, to: 380 }); },
    /* --- cocina: se oyen mientras se cocina o se prepara una bebida --- */
    crackle() { for (let k = 0; k < 4; k++) this.noise(.05 + Math.random() * .05, { freq: 5000 + Math.random() * 3000, vol: .07 + Math.random() * .05, type: 'bandpass', delay: k * (.04 + Math.random() * .05), q: 2 }); },
    sizzle2() { this.noise(.9, { freq: 6200, vol: .1, type: 'bandpass', q: .8 }); this.noise(.5, { freq: 3200, vol: .05, type: 'bandpass', delay: .1 }); },
    spatula() { this.tone(2300, .06, { type: 'square', vol: .05 }); this.tone(3450, .05, { type: 'square', vol: .03, delay: .015 }); this.noise(.05, { freq: 4200, vol: .06, type: 'highpass', delay: .05 }); },
    chop() { for (let k = 0; k < 3; k++) { this.tone(330 - k * 20, .06, { type: 'triangle', vol: .13, to: 170, delay: k * .09 }); this.noise(.03, { freq: 1500, vol: .08, type: 'bandpass', delay: k * .09 }); } },
    tortilla() { this.noise(.12, { freq: 1200, vol: .09, type: 'bandpass' }); this.tone(150, .08, { type: 'sine', vol: .1, to: 95, delay: .02 }); },
    ice() { [3300, 4200, 2900, 3700].forEach((f, k) => this.tone(f, .07, { type: 'sine', vol: .07, delay: k * .06 + Math.random() * .02 })); },
    shaker() { for (let k = 0; k < 5; k++) this.noise(.06, { freq: 3800, vol: .09, type: 'bandpass', delay: k * .075, q: 2 }); },
    bottle() { this.noise(.05, { freq: 2600, vol: .16, type: 'highpass' }); this.tone(900, .08, { type: 'sine', vol: .15, to: 260 }); this.noise(.5, { freq: 7500, vol: .06, type: 'highpass', delay: .06 }); },
    fizz() { this.noise(.7, { freq: 8000, vol: .06, type: 'highpass' }); },
    squeeze() { this.noise(.22, { freq: 1600, vol: .09, type: 'lowpass' }); this.tone(780, .08, { type: 'sine', vol: .06, to: 1100, delay: .05 }); },
    glug() { [0, .09, .19, .3].forEach((d, k) => this.tone(210 + k * 35, .09, { type: 'sine', vol: .11, to: 330 + k * 30, delay: d })); this.noise(.45, { freq: 700, vol: .09, type: 'lowpass' }); },
    cookStart() { this.sounds.chop.call(this); this.sounds.tortilla.call(this); this.noise(.9, { freq: 5800, vol: .13, type: 'bandpass', delay: .3, q: .8 }); },
    drinkStart() { this.sounds.bottle.call(this); setTimeout(() => { this.sounds.glug.call(this); this.sounds.ice.call(this); }, 260); },
    ding() { this.tone(1760, .5, { type: 'sine', vol: .16 }); this.tone(2637, .35, { type: 'sine', vol: .08, delay: .01 }); },
    /* --- logotipo de la compañía --- */
    introSweep() { this.tone(110, 1.2, { type: 'sawtooth', vol: .07, to: 880 }); this.noise(1.1, { freq: 1200, vol: .12, type: 'bandpass', q: .6 }); },
    introHit() { this.tone(70, .8, { type: 'sine', vol: .55, to: 36 }); this.tone(440, 1.6, { type: 'sine', vol: .12, delay: .02 }); this.tone(880, 1.4, { type: 'sine', vol: .07, delay: .02 }); this.tone(1320, 1.2, { type: 'sine', vol: .05, delay: .02 }); this.noise(.5, { freq: 6000, vol: .1, type: 'highpass' }); },
    /* --- máquina de garra --- */
    arcadeCoin() { this.tone(1320, .08, { type: 'square', vol: .12 }); this.tone(1760, .2, { type: 'square', vol: .12, delay: .07 }); },
    clawMove() { this.tone(150, .3, { type: 'sawtooth', vol: .05, to: 210 }); this.tone(300, .3, { type: 'square', vol: .02, to: 420 }); },
    clawDown() { this.tone(260, .7, { type: 'sawtooth', vol: .06, to: 120 }); this.noise(.6, { freq: 900, vol: .04, type: 'bandpass' }); },
    clawUp() { this.tone(120, .7, { type: 'sawtooth', vol: .06, to: 260 }); this.noise(.6, { freq: 900, vol: .04, type: 'bandpass' }); },
    clawGrab() { this.tone(180, .08, { type: 'square', vol: .16, to: 90 }); this.noise(.06, { freq: 2200, vol: .12, type: 'bandpass' }); this.tone(1400, .05, { type: 'square', vol: .06, delay: .05 }); },
    clawDrop() { this.tone(520, .35, { type: 'triangle', vol: .12, to: 150 }); this.noise(.12, { freq: 400, vol: .2, type: 'lowpass', delay: .32 }); },
    clawWin() { [523, 659, 784, 1047, 1319].forEach((f, k) => this.tone(f, .22, { type: 'square', vol: .1, delay: k * .09 })); [1047, 1319, 1568].forEach(f => this.tone(f, .5, { type: 'sine', vol: .1, delay: .5 })); },
    clawFail() { [392, 349, 311, 262].forEach((f, k) => this.tone(f, .22, { type: 'triangle', vol: .14, delay: k * .17 })); },
    whoosh() { this.noise(.26, { freq: 1900, vol: .13, type: 'bandpass', q: .7 }); this.tone(280, .2, { type: 'sine', vol: .05, to: 760 }); },
    type() { this.tone(900 + Math.random() * 200, .03, { type: 'square', vol: .05 }); },
    camera() { this.noise(.05, { freq: 3000, vol: .12, type: 'highpass' }); this.tone(1200, .04, { type: 'square', vol: .06, delay: .05 }); }
  }
};
const sfx = n => Sfx.play(n);

/* =========================================================
   MÚSICA (composiciones originales, sintetizadas con WebAudio: no hay archivos ni derechos de terceros)
   · menu  = "Entrada del Campeón": rock de lucha libre en mi menor (guitarras, batería, metales y público)
   · juego = "Cumbia de la Taquería": cumbia alegre en la menor (acordeón, güiro, congas y bajo tumbao)
   ========================================================= */
const midiHz = m => 440 * Math.pow(2, (m - 69) / 12);
const Music = {
  want: null, cur: null, step: 0, next: 0, tg: null, gtr: null, led: null, mus: null, curve: null,
  setup() {
    const c = Sfx.ctx; if (this.mus || !c) return;
    this.mus = c.createGain(); this.mus.connect(Sfx.master);
    this.curve = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 255 * 2 - 1; this.curve[i] = Math.tanh(x * 3.4); }
  },
  level() { return Settings.sound && Settings.music ? .5 : 0; },
  fadeOut(g) {
    const c = Sfx.ctx; if (!g) return;
    try { g.gain.cancelScheduledValues(c.currentTime); g.gain.setValueAtTime(g.gain.value, c.currentTime); g.gain.linearRampToValueAtTime(0, c.currentTime + .6); } catch (e) {}
    setTimeout(() => { try { g.disconnect(); } catch (e) {} }, 1200);
  },
  start(name) {                                                    // arma los buses de la pista nueva y atenúa la anterior
    const c = Sfx.ctx;
    this.fadeOut(this.tg);
    const tg = c.createGain(); tg.gain.setValueAtTime(0.0001, c.currentTime); tg.gain.linearRampToValueAtTime(1, c.currentTime + .3); tg.connect(this.mus);
    const gtr = c.createGain(); gtr.gain.value = .55; const sh = c.createWaveShaper(); sh.curve = this.curve; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200;
    gtr.connect(sh); sh.connect(lp); lp.connect(tg);
    const led = c.createGain(); led.gain.value = 1; led.connect(tg);
    const dly = c.createDelay(.8); dly.delayTime.value = name === 'menu' ? .234 : .29; const fb = c.createGain(); fb.gain.value = .3; const dg = c.createGain(); dg.gain.value = .38;
    led.connect(dly); dly.connect(fb); fb.connect(dly); dly.connect(dg); dg.connect(tg);
    this.tg = tg; this.gtr = gtr; this.led = led; this.cur = name; this.step = 0; this.next = c.currentTime + .1;
  },
  update() {
    const c = Sfx.ctx; if (!c || c.state !== 'running') return;
    this.setup();
    const lv = this.level(), target = lv > 0 ? this.want : null;
    if (this.mus) this.mus.gain.value = lv;
    if (target !== this.cur) {
      if (!target) { this.fadeOut(this.tg); this.tg = null; this.cur = null; return; }
      this.start(target);
    }
    if (!this.cur) return;
    const T = TRACKS[this.cur], sd = 60 / T.bpm / 4;
    if (this.next < c.currentTime - .4) this.next = c.currentTime + .05;     // se pausó (otra pestaña): retoma sin ráfaga
    while (this.next < c.currentTime + .22) { T.tick(this.step % T.steps, this.next, sd); this.next += sd; this.step++; }
  },
  /* instrumentos: cada uno crea sus nodos, suena y se apaga solo */
  osc(type, f, t, dur, vol, dest, o = {}) {
    const c = Sfx.ctx, os = c.createOscillator(), g = c.createGain();
    os.type = type; os.frequency.setValueAtTime(f, t); if (o.to) os.frequency.exponentialRampToValueAtTime(o.to, t + (o.tt || dur));
    if (o.det) os.detune.value = o.det;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + (o.a || .006)); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    if (o.lp) { const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(o.lp, t); if (o.lpTo) lp.frequency.exponentialRampToValueAtTime(o.lpTo, t + dur); os.connect(lp); lp.connect(g); } else os.connect(g);
    if (o.vib) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 5.6; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(o.vib, t + Math.min(.25, dur * .8)); l.connect(lg); lg.connect(os.detune); l.start(t); l.stop(t + dur + .05); }
    g.connect(dest); os.start(t); os.stop(t + dur + .05);
  },
  noise(t, dur, vol, type, freq, dest, q = 1) {
    const c = Sfx.ctx, src = c.createBufferSource(); src.buffer = Sfx.noiseBuf; src.loop = true;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(dest); src.start(t, Math.random() * .5); src.stop(t + dur + .05);
  },
  kick(t, v = .9) { this.osc('sine', 165, t, .24, v, this.tg, { to: 44, tt: .14, a: .002 }); this.noise(t, .02, v * .25, 'highpass', 2500, this.tg); },
  snare(t, v = .5) { this.noise(t, .17, v, 'bandpass', 1900, this.tg, .7); this.osc('triangle', 210, t, .1, v * .5, this.tg, { to: 130 }); },
  clap(t, v = .3) { for (let k = 0; k < 3; k++) this.noise(t + k * .011, .07, v, 'bandpass', 1500, this.tg, 1.4); },
  hat(t, v = .13, open = false) { this.noise(t, open ? .2 : .04, v, 'highpass', 8200, this.tg); },
  crash(t, v = .3) { this.noise(t, 1.5, v, 'highpass', 5200, this.tg); this.osc('square', 340, t, .5, v * .12, this.tg, { to: 300 }); },
  bass(t, m, dur, v = .5, type = 'sawtooth', lp = 520) { this.osc(type, midiHz(m), t, dur, v, this.tg, { lp, lpTo: lp * .45, a: .01 }); },
  power(t, m, dur, v = .3) { for (const [k, det] of [[0, -7], [7, 5], [12, 0]]) this.osc('sawtooth', midiHz(m + k), t, dur, v * (k === 12 ? .6 : 1), this.gtr, { det, a: .004 }); },
  pluck(t, notes, dur, v = .2) { for (const m of notes) { this.osc('triangle', midiHz(m), t, dur, v, this.tg, { a: .003 }); this.osc('sawtooth', midiHz(m), t, dur * .7, v * .35, this.tg, { lp: 2400, lpTo: 600, a: .003 }); } },
  lead(t, m, dur, v, type = 'sawtooth', lp = 3200) { this.osc(type, midiHz(m), t, dur, v, this.led, { lp, vib: 14, a: .012 }); this.osc('square', midiHz(m) * 1.003, t, dur, v * .45, this.led, { lp: lp * .6, a: .012 }); },
  accordion(t, m, dur, v) { for (const d of [-9, 9]) this.osc('sawtooth', midiHz(m), t, dur, v * .6, this.led, { det: d, lp: 2600, vib: 18, a: .02 }); this.osc('square', midiHz(m + 12), t, dur, v * .18, this.led, { lp: 2200, a: .02 }); },
  stab(t, notes, dur, v = .28) { for (const m of notes) this.osc('sawtooth', midiHz(m), t, dur, v, this.tg, { lp: 3600, lpTo: 900, a: .004 }); },
  guiro(t, v = .12, long = false) { this.noise(t, long ? .13 : .05, v, 'bandpass', 5800, this.tg, 3); },
  conga(t, hi, v = .3) { this.osc('sine', hi ? 330 : 205, t, .16, v, this.tg, { to: hi ? 270 : 160, tt: .12, a: .002 }); this.noise(t, .02, v * .4, 'bandpass', 1400, this.tg); },
  crowd(t, dur, v = .16) {                                           // el público ruge: ruido filtrado que sube y baja
    const c = Sfx.ctx, src = c.createBufferSource(); src.buffer = Sfx.noiseBuf; src.loop = true;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 850; f.Q.value = .8; const g = c.createGain();
    g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(v, t + dur * .35); g.gain.linearRampToValueAtTime(.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.tg); src.start(t, Math.random() * .4); src.stop(t + dur + .05);
  }
};
// Cada pista: bpm, pasos (16 por compás, 8 compases) y tick(paso, tiempo) que programa los instrumentos. Las melodías son [paso, nota MIDI, duración en pasos]
const MEL_MENU = [
  [[0, 64, 3], [4, 67, 1], [6, 71, 2], [8, 76, 4], [12, 74, 2], [14, 71, 2]],
  [[0, 69, 2], [2, 71, 2], [4, 74, 4], [8, 71, 2], [10, 67, 2], [12, 64, 4]],
  [[0, 72, 3], [4, 76, 1], [6, 79, 2], [8, 76, 2], [10, 72, 2], [12, 67, 4]],
  [[0, 74, 3], [4, 78, 1], [6, 81, 2], [8, 78, 2], [10, 74, 2], [12, 69, 4]],
  [[0, 76, 2], [2, 76, 1], [3, 79, 1], [4, 83, 4], [8, 81, 2], [10, 79, 2], [12, 76, 4]],
  [[0, 74, 3], [4, 71, 1], [6, 67, 2], [8, 71, 2], [10, 74, 2], [12, 79, 4]],
  [[0, 76, 2], [2, 79, 2], [4, 84, 4], [8, 83, 2], [10, 79, 2], [12, 76, 4]],
  [[0, 78, 2], [2, 75, 2], [4, 71, 4], [8, 69, 2], [10, 71, 2], [12, 59, 4]]
];
const MEL_GAME = [
  [[0, 69, 2], [3, 72, 1], [4, 76, 2], [6, 74, 1], [8, 72, 2], [10, 71, 1], [12, 69, 4]],
  [[0, 76, 2], [2, 74, 1], [3, 72, 1], [4, 71, 2], [6, 72, 1], [8, 74, 4], [12, 71, 2]],
  [[0, 74, 2], [3, 77, 1], [4, 81, 2], [6, 79, 1], [8, 77, 2], [10, 76, 1], [12, 74, 4]],
  [[0, 76, 2], [3, 80, 1], [4, 83, 2], [6, 81, 1], [8, 80, 2], [10, 76, 1], [12, 71, 4]],
  [[0, 69, 2], [3, 72, 1], [4, 76, 2], [6, 81, 2], [8, 79, 2], [10, 76, 2], [12, 72, 4]],
  [[0, 69, 2], [2, 72, 2], [4, 77, 4], [8, 76, 2], [10, 72, 2], [12, 69, 4]],
  [[0, 74, 2], [2, 77, 2], [4, 81, 4], [8, 79, 2], [10, 77, 2], [12, 74, 4]],
  [[0, 76, 3], [4, 74, 1], [6, 71, 2], [8, 68, 2], [12, 64, 4]]
];
const TRACKS = {
  menu: {
    bpm: 128, steps: 128, roots: [40, 40, 36, 38, 40, 43, 36, 35],
    tick(s, t, sd) {
      const bar = s >> 4, st = s & 15, r = this.roots[bar], M = Music;
      if (st === 0 || st === 8 || (st === 10 && bar % 2) || (st === 6 && bar > 3)) M.kick(t);
      if (st === 4 || st === 12) { M.snare(t); if (st === 12) M.clap(t, .18); }
      if (st % 2 === 0) M.hat(t, st % 4 === 2 ? .15 : .1, st === 14 && bar % 2 === 1);
      if (st === 0 && (bar === 0 || bar === 4)) { M.crash(t); M.stab(t, [r + 24, r + 31, r + 36], .5); }
      if (st === 0 && bar === 0) M.crowd(t, 3.2);
      if (st === 8 && bar === 7) M.crowd(t, 2.0, .12);
      if (st % 2 === 0) M.bass(t, r + (st % 8 === 6 ? 12 : 0), sd * 1.7, .46, 'sawtooth', 460);
      if ([0, 3, 6, 8, 11, 14].includes(st)) M.power(t, r + 12, sd * (st === 0 || st === 8 ? 2.6 : 1.4), .2);
      for (const [ms, m, len] of MEL_MENU[bar]) if (ms === st) M.lead(t, m, sd * len * .95, .16);
    }
  },
  juego: {
    bpm: 100, steps: 128, roots: [45, 45, 50, 52, 45, 41, 50, 52], chords: [[57, 60, 64], [57, 60, 64], [62, 65, 69], [64, 68, 71], [57, 60, 64], [60, 65, 69], [62, 65, 69], [64, 68, 71]],
    tick(s, t, sd) {
      const bar = s >> 4, st = s & 15, r = this.roots[bar], ch = this.chords[bar], M = Music;
      if (st === 0 || st === 8) M.kick(t, .7);
      if (st === 4 || st === 12) M.snare(t, .22);
      if ([0, 2, 3, 6, 8, 10, 11, 14].includes(st)) M.guiro(t, st % 8 === 0 ? .15 : .1, st === 3 || st === 11);
      if (st === 0 || st === 8) M.conga(t, false, .26);
      if ([3, 6, 11, 14].includes(st)) M.conga(t, true, .2);
      if (st === 0 || st === 8) M.bass(t, r, sd * 3, .5, 'triangle', 700);
      if (st === 6) M.bass(t, r + 7, sd * 1.6, .42, 'triangle', 700);
      if (st === 11) M.bass(t, r + 12, sd * 1.4, .38, 'triangle', 700);
      if (st === 12) M.bass(t, r + 7, sd * 3, .44, 'triangle', 700);
      if ([2, 6, 10, 14].includes(st)) M.pluck(t, ch, sd * 1.5, .1);
      for (const [ms, m, len] of MEL_GAME[bar]) if (ms === st) M.accordion(t, m, sd * len * .96, bar < 4 || bar === 7 ? .15 : .17);
    }
  }
};

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

/* ---------- Cámara: zoom y desplazamiento del local (rueda del ratón, pellizco o botones + / −) ----------
   Solo se mueve el escenario; la interfaz (HUD, paneles, botones) se queda fija. camWorld convierte un punto de la pantalla
   al mundo del diorama y camScreen hace lo contrario. */
const Cam = { z: 1, px: 0, py: 0, MIN: .6, MAX: 2.4, def: 1 };
const CAMC = { x: 480, y: 330 };
const camWorld = (x, y) => ({ x: (x - CAMC.x - Cam.px) / Cam.z + CAMC.x, y: (y - CAMC.y - Cam.py) / Cam.z + CAMC.y });
const camScreen = (x, y) => ({ x: (x - CAMC.x) * Cam.z + CAMC.x + Cam.px, y: (y - CAMC.y) * Cam.z + CAMC.y + Cam.py });
function camClamp() {
  Cam.z = clamp(Cam.z, Cam.MIN, Cam.MAX);
  const mx = Math.max(0, Cam.z - 1) * 520 + 90, my = Math.max(0, Cam.z - 1) * 330 + 60;
  Cam.px = clamp(Cam.px, -mx, mx); Cam.py = clamp(Cam.py, -my, my);
}
function camZoomAt(f, sx, sy) {                                        // acerca o aleja manteniendo fijo el punto (sx, sy) de la pantalla
  const p = camWorld(sx, sy); Cam.z = clamp(Cam.z * f, Cam.MIN, Cam.MAX);
  Cam.px = sx - CAMC.x - (p.x - CAMC.x) * Cam.z; Cam.py = sy - CAMC.y - (p.y - CAMC.y) * Cam.z; camClamp();
}
function camReset() { Cam.z = Cam.def || 1; Cam.px = 0; Cam.py = 0; }
function camApply(c) { c.translate(CAMC.x + Cam.px, CAMC.y + Cam.py); c.scale(Cam.z, Cam.z); c.translate(-CAMC.x, -CAMC.y); }

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
  parrilla: { fw: 3, fh: 1, h: 80, name: 'Parrilla de carne asada' },
  vitrinam: { fw: 1, fh: 1, h: 84, name: 'Vitrina de máscaras' },
  fridge: { fw: 1, fh: 1, h: 66,  name: 'Refrigerador' },
  drinks: { fw: 2, fh: 1, h: 38,  name: 'Mostrador de bebidas' },
  bar:    { fw: 3, fh: 1, h: 38,  name: 'Barra de comida lista' },
  bar2:   { fw: 3, fh: 1, h: 38,  name: 'Barra de antojitos' },
  storage: { fw: 1, fh: 1, h: 66, name: 'Refri de sobrantes' },
  garra:  { fw: 1, fh: 1, h: 124, name: 'Máquina de garra' },
  chairs: { fw: 2, fh: 1, h: 40,  name: 'Juego de sillas' },                 // (solo en el inventario: se pone sobre una mesa)
  cartel: { fw: 1, fh: 1, h: 196, name: 'Cartel de tacos', out: true },
  farol: { fw: 1, fh: 1, h: 100, name: 'Farol de calle', out: true },       // (se coloca afuera, en el pasto)
  parking: { fw: 4, fh: 3, h: 0, name: 'Estacionamiento', out: true },         // (se coloca afuera, en el frente del local)
  bench:  { fw: 2, fh: 1, h: 58,  name: 'Banca con suero' },
  plant:  { fw: 1, fh: 1, h: 70,  name: 'Planta' },
  trompo: { fw: 1, fh: 1, h: 96,  name: 'Trompo de pastor' },
  caja:   { fw: 1, fh: 1, h: 52,  name: 'Caja registradora' },
  estatua: { fw: 1, fh: 1, h: 104, name: 'Estatua de luchador' },
  vitrina: { fw: 1, fh: 1, h: 78,  name: 'Vitrina del campeón' }
};
/* Mesas y sillas se venden por separado. Cada mesa lleva un juego de dos sillas (que se pone en el modo EDITAR).
   tip = propina extra de la mesa; comfort = comodidad de las sillas (más paciencia y un poco más de propina). */
const TABLES = {
  mantel:   { name: 'Mesa con mantel',    desc: 'La clásica de taquería: mantel de plástico a cuadros',           mult: 1,   level: 1,  tip: 0 },
  madera:   { name: 'Mesa de madera',     desc: 'Tablones barnizados: se ve más cuidada. +2 % de propina',        mult: 1.4, level: 4,  tip: .02 },
  barril:   { name: 'Mesa de barril',     desc: 'Barril con aros de acero, muy cantinera. +3 % de propina',       mult: 1.9, level: 8,  tip: .03 },
  talavera: { name: 'Mesa de talavera',   desc: 'Azulejos pintados a mano. +5 % de propina',                      mult: 2.5, level: 13, tip: .05 },
  ring:     { name: 'Mesa de ring',       desc: 'Lona azul con cuerdas y faldón rojo. +7 % de propina',           mult: 3.2, level: 18, tip: .07 },
  oro:      { name: 'Mesa del campeón',   desc: 'Exclusiva de gemas: dorada y reluciente. +10 % de propina',      gems: 30,    level: 1,  tip: .10 }
};
const CHAIRS = {
  plastico:  { name: 'Sillas de plástico',   desc: 'Amarillas y resistentes: lo básico',                     price: 30,  level: 1,  comfort: 0, seat: { top: '#ffc43a', left: '#ffb21e', right: '#d98f00' }, back: { top: '#ffcb4d', left: '#ffb21e', right: '#d98f00' }, leg: '#5a3a00' },
  madera:    { name: 'Sillas de madera',     desc: 'Respaldo de tablillas. Clientes más pacientes',          price: 90,  level: 3,  comfort: 1, seat: { top: '#d9a066', left: '#b07a40', right: '#8a5a2c' }, back: { top: '#e0b27a', left: '#b07a40', right: '#8a5a2c' }, leg: '#4a3320', slats: true },
  taburete:  { name: 'Taburetes de barra',   desc: 'Altos y sin respaldo, con cojín rojo',                   price: 130, level: 6,  comfort: 1, seat: { top: '#e0364a', left: '#b02a3a', right: '#8a2030' }, leg: '#2b2540', stool: true },
  acolchada: { name: 'Sillas acolchadas',    desc: 'Vinil rojo bien mullido. Más paciencia y propina',       price: 260, level: 10, comfort: 2, seat: { top: '#ff5a6a', left: '#d9374a', right: '#a92a3a' }, back: { top: '#ff6a78', left: '#d9374a', right: '#a92a3a' }, leg: '#2b2540', tall: 52 },
  ring:      { name: 'Sillas de ring',       desc: 'Plegables de acero con la máscara en el respaldo',       price: 520, level: 15, comfort: 3, seat: { top: '#c9ceda', left: '#7a8090', right: '#555b6b' }, back: { top: '#e0364a', left: '#c81e3c', right: '#8f1530' }, leg: '#555b6b', emblem: true },
  talavera:  { name: 'Sillas de talavera',   desc: 'Pintadas a mano en azul y blanco. Muy cómodas',          price: 820, level: 20, comfort: 4, seat: { top: '#f4f6fb', left: '#3f66c9', right: '#2a4a9a' }, back: { top: '#f4f6fb', left: '#3f66c9', right: '#2a4a9a' }, leg: '#2a4a9a', tall: 54, tiles: true },
  trono:     { name: 'Tronos del campeón',   desc: 'Exclusivas de gemas: doradas con joyas. Comodidad máxima', gems: 25,  level: 1,  comfort: 5, seat: { top: '#ffe27a', left: '#e3b53a', right: '#b88a1f' }, back: { top: '#ffe27a', left: '#e3b53a', right: '#b88a1f' }, leg: '#8a6a1a', tall: 66, gem: true }
};
const tablePrice = (style, owned) => Math.round(priceOf('table', owned) * (TABLES[style].mult || 1) / 5) * 5;
const comfortOf = tb => (tb && tb.chair && CHAIRS[tb.chair] ? CHAIRS[tb.chair].comfort : 0);
const SEATS = [];                                               // todas las sillas de las mesas colocadas
const LAYOUT = { mask: null, comals: [], slotItem: [], slotK: [], parrilla: null, tables: [], fridge: null, bar: null, bar2: null, drinks: null, bench: null, storage: null, claw: null };
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
function makeFurn(type, c = 0, r = 0, rot = 0, extra = null) {
  const it = { id: furnId++, type, c, r, rot: rot ? 1 : 0 };
  if (type === 'table') { it.style = extra && TABLES[extra.style] ? extra.style : 'mantel'; it.chair = extra && extra.chair !== undefined ? extra.chair : null; }
  if (type === 'chairs') it.style = extra && CHAIRS[extra.style] ? extra.style : 'plastico';
  if (type === 'comal' || type === 'parrilla') {                                                      // v1.7: varios lugares de cocción (2, 4 u 8)
    it.cap = type === 'parrilla' ? 8 : ([2, 4].includes(extra && extra.cap) ? extra.cap : 2);
    it.slots = Array.from({ length: it.cap }, () => ({ state: 'empty', dish: null, t: 0 }));
  }
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
  makeFurn('table', 5, 4, 0, { chair: 'plastico' }), makeFurn('table', 1, 7, 0, { chair: 'plastico' })
];
function rebuildLayout(w) {                                      // se llama cada vez que cambia el mobiliario colocado
  const f = w.furn, one = t => f.find(x => x.type === t) || null;
  LAYOUT.comals = f.filter(x => x.type === 'comal' || x.type === 'parrilla'); LAYOUT.tables = f.filter(x => x.type === 'table'); LAYOUT.parrilla = one('parrilla');
  LAYOUT.fridge = one('fridge'); LAYOUT.bar = one('bar'); LAYOUT.bar2 = one('bar2'); LAYOUT.drinks = one('drinks'); LAYOUT.bench = one('bench'); LAYOUT.storage = one('storage'); LAYOUT.claw = one('garra'); LAYOUT.mask = one('vitrinam');
  LAYOUT.slotItem = []; LAYOUT.slotK = []; LAYOUT.comals.forEach(x => x.slots.forEach((_, k) => { LAYOUT.slotItem.push(x); LAYOUT.slotK.push(k); }));
  w.slots = [].concat(...LAYOUT.comals.map(x => x.slots));
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
// El mostrador donde se exhibe cada platillo: comida en su barra; bebidas en el mostrador de bebidas (solo las micheladas pueden quedar al pie del refri)
const shelfItem = key => { const sh = RECIPES[key].shelf; return sh === 'drinks' ? (LAYOUT.drinks || (key === 'michelada' ? LAYOUT.fridge : null)) : LAYOUT[sh]; };
const accessFor = key => { const it = shelfItem(key); return it ? neighborCells(it) : []; };
const restAccess = () => LAYOUT.bench ? neighborCells(LAYOUT.bench) : [];
const benchSeatPt = i => { const q = tp(LAYOUT.bench, .5 + i, .6); return { x: q[0], y: q[1] }; };
const benchExit = () => { const a = restAccess(); return a.length ? Grid.pt(a[0].c, a[0].r) : null; };

// Posiciones en pantalla de lo que hay sobre cada mueble (null si esa pieza no está colocada)
const barSlot = i => [.4 + (i % 4) * .72, .3 + Math.floor(i / 4) * .42];         // la barra tiene dos filas de cuatro lugares
const drinkSlot = i => [.42 + (i % 3) * .58, .3 + Math.floor(i / 3) * .42];      // el mostrador de bebidas (2 losetas): dos filas de tres lugares
const stockPos = key => {
  const sh = RECIPES[key].shelf;
  if (sh === 'drinks') {
    const d = LAYOUT.drinks, f = LAYOUT.fridge;                                  // sin mostrador, el refri guarda las micheladas listas al pie
    if (d) { const q = drinkSlot(SHELF_KEYS.drinks.indexOf(key)); return TS(d, q[0], q[1], 34); }
    return key === 'michelada' && f ? TS(f, .5, .9, 6) : null;
  }
  const b = LAYOUT[sh]; if (!b) return null;
  const q = barSlot(SHELF_KEYS[sh].indexOf(key)); return TS(b, q[0], q[1], 34);
};
const comalPos = (i = 0) => { const it = LAYOUT.comals[i]; return it ? TS(it, FURN[it.type].fw / 2, .5, 36) : null; };
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
const SLOT_XY = { 2: [[.5, .5], [1.5, .5]], 4: [[.55, .3], [1.45, .3], [.55, .72], [1.45, .72]], 8: [[.4, .3], [1.03, .3], [1.66, .3], [2.3, .3], [.4, .72], [1.03, .72], [1.66, .72], [2.3, .72]] };
const slotPosOf = (it, k) => { const q = (SLOT_XY[it.cap] || SLOT_XY[2])[k] || [1, .5]; return TS(it, q[0], q[1], it.type === 'parrilla' ? 40 : 36); };
const slotPos = i => { const it = LAYOUT.slotItem[i]; return it ? slotPosOf(it, LAYOUT.slotK[i]) : { x: 0, y: 0 }; };      // posición en pantalla del lugar de cocción n (de todos los comales juntos)
function comalHit(x, y, i = 0) {
  const p = comalPos(i); if (!p) return false;
  const dx = (x - p.x) / (32 * FURN[LAYOUT.comals[i].type].fw), dy = (y - (p.y + 2)) / 40;
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
    else if (it.type === 'bar' || it.type === 'bar2' || it.type === 'drinks' || it.type === 'bench') { if (!footprint(it).some(([c, r]) => touches(c, r))) return false; }
  }
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
  if (!layoutConnected(w, w.furn.filter(o => o !== it).concat([moved]))) return 'Bloquearía el paso';
  return null;
}

/* =========================================================
   INTERFAZ: PUNTERO Y BOTONES
   ========================================================= */
// touch = el último toque vino de un dedo o lápiz: los botones aceptan un margen extra y la edición pide dos toques
const UI = { mx: -99, my: -99, down: false, cursor: false, kb: false, touch: false, small: false,
  hit(b) { const s = this.touch ? (this.small ? 9 : 5) : 0; return this.mx >= b.x - s && this.mx <= b.x + b.w + s && this.my >= b.y - s && this.my <= b.y + b.h + s; } };
const BTN = {
  red: ['#ff5a6a', '#c81e3c'], teal: ['#2fd0dd', '#0e7f8c'], violet: ['#8b5cf6', '#4c2a9a'], pink: ['#ff7ab8', '#c4247a'],
  dark: ['#58566a', '#24222f'], green: ['#3ddc8a', '#12804a'], gold: ['#ffd95a', '#e29a12'], off: ['#6b6878', '#3d3b48']
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
  c.lineWidth = 3; c.strokeStyle = off ? '#8f8c9e' : P.white; c.stroke();
  c.lineWidth = 1.5; c.strokeStyle = 'rgba(255,255,255,.35)';
  rr(c, b.x + 4, b.y + 4, b.w - 8, b.h * .42, 8); c.stroke();
  if (hov) { c.fillStyle = 'rgba(255,255,255,.14)'; rr(c, b.x, b.y, b.w, b.h, 12); c.fill(); }
  const size = b.size || 26, lift2 = b.sub ? Math.min(7, b.h * .12) : 0;
  txt(c, b.label, b.x + b.w / 2, b.y + b.h / 2 + size * .33 - lift2, {
    font: `700 ${size}px ${FONT_UI}`, align: 'center', color: off ? '#cfc9e0' : P.white, stroke: P.ink, sw: 5, ls: 1.5, maxW: b.w - 18
  });
  if (b.sub) txt(c, b.sub, b.x + b.w / 2, b.y + b.h - 8, { font: `600 12px ${FONT_UI}`, align: 'center', color: '#e8e0ff', ls: 1, maxW: b.w - 14 });
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
  g.addColorStop(0, '#2b2935'); g.addColorStop(1, '#101017');
  rr(c, x, y, w, h, 18); c.fillStyle = g; c.fill();
  c.lineWidth = 6; c.strokeStyle = P.ink; c.stroke(); c.lineWidth = 3.5; c.strokeStyle = P.white; c.stroke();            // borde blanco grueso con filo negro, como la máscara
  c.lineWidth = 1.5; c.strokeStyle = 'rgba(255,255,255,.16)'; rr(c, x + 8, y + 8, w - 16, h - 16, 12); c.stroke();
  if (title) {
    const tw = Math.min(w - 40, 340), tx = x + w / 2 - tw / 2;
    c.fillStyle = P.ink; rr(c, tx - 3, y - 27, tw + 6, 58, 10); c.fill();
    c.fillStyle = P.red; rr(c, tx, y - 24, tw, 52, 8); c.fill();
    c.lineWidth = 3; c.strokeStyle = P.white; c.stroke();
    for (let i = 0; i < 8; i++) { c.fillStyle = RAINBOW[i]; c.fillRect(tx + 6 + i * (tw - 12) / 8, y + 22, (tw - 12) / 8 + .5, 3); }       // tira de colores bajo el título
    txt(c, title, x + w / 2, y + 12, { font: `400 ${fitDisplay(c, title, tw - 24, 28)}px ${FONT_DISPLAY}`, align: 'center', color: P.white, stroke: P.ink, sw: 5 });
  }
  c.restore();
}

/* =========================================================
   FONDO DE RING (menú, ajustes, despedida)
   ========================================================= */
function drawRingBg(c, t) {
  let g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#050505'); g.addColorStop(.55, '#151517'); g.addColorStop(1, '#341626');
  c.fillStyle = g; c.fillRect(-EX, -EY, CW, CH);

  // reflectores
  for (let i = 0; i < 4; i++) {
    const x0 = 120 + i * 240, sw = Math.sin(t * .7 + i * 1.7) * 150;
    const lg = c.createLinearGradient(0, 0, 0, 440);
    lg.addColorStop(0, 'rgba(255,255,255,.26)'); lg.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = lg;
    c.beginPath(); c.moveTo(x0 - 14, -10); c.lineTo(x0 + 14, -10); c.lineTo(x0 + sw + 90, 440); c.lineTo(x0 + sw - 90, 440); c.closePath(); c.fill();
  }

  // público
  const crowd = ['#0d0d0e', '#151517', '#1e1e20'];
  for (let k = 0; k < 3; k++) {
    const yb = 262 + k * 30;
    for (let x = -EX - 10 + (k % 2) * 17; x < CW - EX + 20; x += 34) {
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
// Título del juego: letra por letra, relleno blanco, borde negro y una sombra de color distinta en cada letra
function drawBrandTitle(c, cx, word, base, size, t, depth) {
  c.save(); c.font = `400 ${size}px ${FONT_DISPLAY}`; c.textBaseline = 'alphabetic'; c.textAlign = 'left'; c.lineJoin = 'round';
  const ws = [...word].map(ch => c.measureText(ch).width), gap = size * .02, tot = ws.reduce((a, b) => a + b, 0) + gap * (word.length - 1), sc = Math.min(1, 900 / tot);
  c.translate(cx, 0); c.scale(sc, sc); c.rotate(Math.sin(t * .9 + size) * .008);
  let x = -tot / 2; const by = base / sc;
  [...word].forEach((ch, i) => {
    const bob = Math.sin(t * 2.4 + i * .7) * 2.2, y = by + bob, d = Math.round(size * .14);
    c.strokeStyle = P.ink; c.lineWidth = size * .13;
    for (let k = d; k >= 0; k -= 2) c.strokeText(ch, x + k * .45, y + k);                      // silueta negra de la letra con su relieve
    c.fillStyle = RAINBOW[(i + (word === 'TACOS' ? 2 : 0)) % RAINBOW.length];
    for (let k = d; k >= 1; k--) c.fillText(ch, x + k * .45, y + k);                            // relieve de color
    c.lineWidth = size * .085; c.strokeText(ch, x, y);
    c.fillStyle = P.white; c.fillText(ch, x, y);
    x += ws[i] + gap;
  });
  c.restore();
}
function drawConfetti(c, t) {                                      // confeti de colores que cae despacio por detrás de la máscara
  c.save();
  for (let i = 0; i < 46; i++) {
    const sp = 14 + hash(i + 3) * 22, x = (hash(i) * (W + 80) - 40 + Math.sin(t * .6 + i) * 18), y = ((hash(i + 80) * H + t * sp) % (H + 40)) - 20, rot = t * (1 + hash(i + 9) * 2) + i;
    c.save(); c.translate(x, y); c.rotate(rot); c.globalAlpha = .55; c.fillStyle = RAINBOW[i % RAINBOW.length]; c.fillRect(-4, -2, 8, 4); c.restore();
  }
  c.restore();
}
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
    drawConfetti(c, t);

    // máscara central
    const bob = Math.sin(t * 1.6) * 6;
    c.save(); c.translate(0, bob);
    c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(480, 482 - bob, 104, 13, 0, 0, 6.3); c.fill();
    c.shadowColor = 'rgba(255,255,255,.55)'; c.shadowBlur = 38;
    drawLogoCached(c, 480, 322, 112, K);                              // el logotipo: máscara blanca con adorno de colores por dentro
    c.restore();

    // título: letras blancas con borde negro y una sombra de colores distinta en cada letra (como el adorno de la máscara)
    drawBrandTitle(c, 480, 'TACOS', 78, 54, t, 7);
    drawBrandTitle(c, 480, 'ENMASCARADOS', 150, 100, t, 9);

    // cinta
    c.save();
    c.fillStyle = P.ink; rr(c, 297, 159, 366, 36, 8); c.fill();
    c.fillStyle = P.red; c.strokeStyle = P.white; c.lineWidth = 3;
    rr(c, 300, 162, 360, 30, 6); c.fill(); c.stroke();
    txt(c, 'TAQUERÍA DE LUCHA LIBRE', 480, 184, { font: `700 20px ${FONT_UI}`, align: 'center', ls: 5, color: P.white, stroke: P.ink, sw: 3, maxW: 340 });
    c.restore();

    this.buttons.forEach((b, i) => drawButton(c, b, UI.kb && i === this.kbIndex));
    txt(c, COPY, 480, H - 9, { font: `600 13px ${FONT_UI}`, align: 'center', color: 'rgba(255,248,234,.6)', ls: .4 });
    txt(c, 'v1.4.0', W - 12, H - 9, { font: `600 12px ${FONT_UI}`, align: 'right', color: 'rgba(255,248,234,.4)' });
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
  slider: { x: 410, y: 232, w: 210 },
  enter(arg) {
    this.from = (arg && arg.from) || 'MENU'; this.drag = false; this.confirmT = 0;
    const back = () => { sfx('back'); setState(this.from); };
    const cyc = (key, list) => () => { Settings[key] = list[(list.indexOf(Settings[key]) + 1) % list.length]; if (key === 'quality') Gfx.slow = 0; saveSettings(); Sfx.unlock(); sfx('click'); };
    this.buttons = {
      sound: { x: 540, y: 124, w: 170, h: 40, size: 21, fn: () => { Settings.sound = !Settings.sound; saveSettings(); Sfx.unlock(); sfx('click'); } },
      music: { x: 540, y: 170, w: 170, h: 40, size: 21, fn: () => { Settings.music = !Settings.music; saveSettings(); Sfx.unlock(); sfx('click'); } },
      screen: { x: 540, y: 262, w: 170, h: 40, size: 20, fn: () => { Sfx.unlock(); sfx('click'); toggleFullscreen(); } },
      quality: { x: 540, y: 308, w: 170, h: 40, size: 20, fn: cyc('quality', ['auto', 'alta', 'media', 'baja']) },
      fps: { x: 540, y: 354, w: 170, h: 40, size: 20, fn: cyc('fps', ['auto', '60', '30']) },
      reset: { x: 540, y: 410, w: 170, h: 38, size: 18, style: 'red', fn: () => {
        if (this.confirmT > 0) { for (let n = 1; n <= Store.SLOTS; n++) Store.clearSlot(n); this.confirmT = 0; sfx('back'); } else { this.confirmT = 3; sfx('nope'); }
      } },
      back:  { x: 370, y: 466, w: 220, h: 50, style: 'gold', label: 'Volver', fn: back },
      saveExit: { x: 480, y: 466, w: 240, h: 50, style: 'green', label: 'Guardar y salir', size: 22, fn: () => { Game.save(); sfx('back'); setState('MENU'); } }
    };
    if (this.from === 'JUGANDO') Object.assign(this.buttons.back, { x: 240, w: 220 });
    this.buttons.back.y = this.buttons.saveExit.y = 468;          // en partida: Volver + Guardar y volver al menú principal
  },
  update(dt) { if (this.confirmT > 0) this.confirmT -= dt; },
  draw(c) {
    scenes[this.from].draw(c);
    c.fillStyle = 'rgba(15,14,18,.74)'; c.fillRect(-EX, -EY, CW, CH);
    drawPanel(c, 220, 76, 520, 460, 'AJUSTES');
    const B = this.buttons, lab = { font: `700 24px ${FONT_UI}`, color: P.cream, ls: 1 };
    // sonido
    txt(c, 'Sonido', 260, 150, lab);
    B.sound.label = Settings.sound ? 'ACTIVADO' : 'SILENCIO'; B.sound.style = Settings.sound ? 'green' : 'dark';
    drawButton(c, B.sound);
    // música
    txt(c, 'Música', 260, 196, lab);
    B.music.label = Settings.music ? 'ACTIVADA' : 'APAGADA'; B.music.style = Settings.music && Settings.sound ? 'green' : 'dark'; B.music.disabled = !Settings.sound;
    drawButton(c, B.music);
    // volumen
    txt(c, 'Volumen', 260, 247, lab);
    const s = this.slider;
    rr(c, s.x, s.y, s.w, 14, 7); c.fillStyle = '#16151b'; c.fill(); c.lineWidth = 2; c.strokeStyle = P.violet; c.stroke();
    rr(c, s.x, s.y, Math.max(14, s.w * Settings.volume), 14, 7); c.fillStyle = Settings.sound ? P.gold : '#6b6580'; c.fill();
    const kx = s.x + s.w * Settings.volume;
    c.beginPath(); c.arc(kx, s.y + 7, 14, 0, 6.3); c.fillStyle = P.cream; c.fill(); c.lineWidth = 3; c.strokeStyle = P.ink; c.stroke();
    txt(c, Math.round(Settings.volume * 100) + '%', 710, 248, { font: `700 22px ${FONT_UI}`, align: 'right', color: P.gold });      // alineado con el borde derecho del botón de sonido
    if (UI.mx > s.x - 20 && UI.mx < s.x + s.w + 20 && UI.my > s.y - 16 && UI.my < s.y + 32) UI.cursor = true;
    // pantalla / calidad / FPS (para PC; en celular la pantalla ya es completa)
    txt(c, 'Pantalla', 260, 288, lab);
    const sf = screenFull() || IS_NATIVE || mq(MOB_Q); B.screen.label = sf ? 'COMPLETA' : 'VENTANA'; B.screen.style = sf ? 'green' : 'dark'; B.screen.disabled = IS_NATIVE || !canFullscreen();
    drawButton(c, B.screen);
    txt(c, 'Calidad', 260, 334, lab);
    B.quality.label = Settings.quality.toUpperCase(); B.quality.style = Settings.quality === 'auto' ? 'teal' : 'dark';
    drawButton(c, B.quality);
    txt(c, 'Cuadros / seg', 260, 380, lab);
    B.fps.label = Settings.fps === 'auto' ? 'AUTO' : Settings.fps; B.fps.style = Settings.fps === 'auto' ? 'teal' : 'dark';
    drawButton(c, B.fps);
    // progreso
    txt(c, 'Progreso', 260, 432, lab);
    const nSaved = Store.slots().filter(s => s).length, inGame = this.from === 'JUGANDO';
    txt(c, inGame ? (Game.slot ? `Se guarda sola cada 15 s (ranura ${Game.slot})` : 'Sin ranura de guardado') : nSaved ? `${nSaved} de ${Store.SLOTS} partidas guardadas` : 'Sin partidas guardadas', 260, 456, { font: `600 17px ${FONT_UI}`, color: P.muted });
    B.reset.label = this.confirmT > 0 ? '¿SEGURO?' : 'BORRAR TODO'; B.reset.size = this.confirmT > 0 ? 21 : 16;
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
    for (const k of ['sound', 'music', 'screen', 'quality', 'fps', 'reset', 'back', 'saveExit']) {
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
    c.fillStyle = 'rgba(15,14,18,.55)'; c.fillRect(-EX, -EY, CW, CH);
    drawPanel(c, 180, 70, 600, 420, '¡HASTA LUEGO!');
    drawLuchador(c, 480, 268, Object.assign({}, LUCHADORES.novato, { state: 'idle', t: this.t, dir: 1, scale: 2.1 }));
    const fade = clamp(this.t * 1.5, 0, 1);
    c.save(); c.globalAlpha = fade;
    txt(c, 'GRACIAS POR JUGAR, CAMPEÓN', 480, 316, { font: `400 30px ${FONT_DISPLAY}`, align: 'center', color: P.gold, stroke: P.ink, sw: 5 });
    txt(c, 'La taquería queda lista para tu regreso.', 480, 346, { font: `600 20px ${FONT_UI}`, align: 'center', color: P.cream });
    const rows = [['PRODUCCIÓN', 'ACP PRODUCCION'], ['TECNOLOGÍA', 'HTML5 Canvas · JavaScript puro'], ['MÚSICA Y SONIDO', 'Composiciones originales (sin derechos de terceros)']];
    rows.forEach((r, i) => {
      txt(c, r[0], 300, 388 + i * 24, { font: `700 14px ${FONT_UI}`, color: P.muted, ls: 2 });
      txt(c, r[1], 440, 388 + i * 24, { font: `600 19px ${FONT_UI}`, color: P.cream });
    });
    c.restore();
    drawButton(c, this.btn, UI.kb);
    txt(c, COPY, 480, H - 12, { font: `600 13px ${FONT_UI}`, align: 'center', color: 'rgba(255,248,234,.6)', ls: .4 });
  },
  go() { sfx('back'); setState('MENU'); },
  pointerDown() { if (UI.hit(this.btn)) this.go(); },
  pointerMove() {}, pointerUp() {},
  key(e) { if (e.key === 'Enter' || e.key === 'Escape' || e.key === ' ') { this.go(); return true; } return false; }
};

/* =========================================================
   ESCENAS: INTRO (logotipo animado de ACP PRODUCCION antes del menú)
   ========================================================= */
// Texto letra por letra con espaciado propio (no depende de que el navegador soporte letterSpacing en el canvas)
function spacedText(c, s, cx, y, ls, font, fill, alphaOf, yOf) {
  c.save(); c.font = font; c.textBaseline = 'alphabetic'; c.textAlign = 'left';
  const ws = [...s].map(ch => c.measureText(ch).width), tot = ws.reduce((a, b) => a + b, 0) + ls * (s.length - 1);
  let x = cx - tot / 2;
  [...s].forEach((ch, i) => {
    const a = alphaOf ? alphaOf(i) : 1;
    if (a > .01) { c.globalAlpha = clamp(a, 0, 1); c.fillStyle = typeof fill === 'function' ? fill(x, ws[i]) : fill; c.fillText(ch, x, y + (yOf ? yOf(i) : 0)); }
    x += ws[i] + ls;
  });
  c.restore();
}
const FONT_BRAND = `'Unbounded', 'Outfit', 'Avenir Next', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif`;
const FONT_WIDE = `'Unbounded', 'Outfit', 'Avenir Next', 'Segoe UI', Arial, sans-serif`;
const IntroScene = {
  t: 0, DUR: 5.4, hitSound: false, swoosh: false,
  enter() { this.t = 0; this.hitSound = false; this.swoosh = false; UI.kb = false; },
  update(dt) {
    this.t += dt;
    if (!this.swoosh && this.t > .55) { this.swoosh = true; sfx('introSweep'); }
    if (!this.hitSound && this.t > 1.45) { this.hitSound = true; sfx('introHit'); }
    if (this.t >= this.DUR) this.done();
  },
  done() { if (state === 'INTRO') setState('MENU'); },
  draw(c) {
    // Intro minimalista: fondo negro y letras blancas
    const t = this.t, out = clamp((t - (this.DUR - .7)) / .7, 0, 1), cx = 480, cy = 292, WHITE = '#ffffff';
    c.fillStyle = '#000'; c.fillRect(-EX, -EY, CW, CH);
    const glow = clamp(t / 1.2, 0, 1);
    c.save(); c.globalAlpha = 1 - out;
    // aro fino blanco que se traza girando
    const ring = smooth(clamp((t - .35) / 1.1, 0, 1));
    if (ring > 0) {
      c.save(); c.translate(cx, cy - 4); c.rotate(-1.57 + t * .5);
      c.strokeStyle = WHITE; c.lineWidth = 2; c.lineCap = 'round';
      c.beginPath(); c.arc(0, 0, 160, 0, 6.2832 * ring); c.stroke();
      c.lineWidth = 1; c.globalAlpha = (1 - out) * .45; c.beginPath(); c.arc(0, 0, 172, 0, 6.2832 * ring * .75); c.stroke();
      c.restore();
    }
    // ACP: tres letras gruesas que caen una por una
    const bigFont = `700 112px ${FONT_BRAND}`;
    spacedText(c, 'ACP', cx, cy + 22, 14, bigFont, WHITE, i => clamp((t - .75 - i * .22) / .3, 0, 1), i => -(1 - easeOutBack(clamp((t - .75 - i * .22) / .5, 0, 1))) * 70);
    // línea que se abre desde el centro
    const ln = smooth(clamp((t - 1.7) / .7, 0, 1));
    if (ln > 0) { c.fillStyle = WHITE; c.fillRect(cx - 230 * ln, cy + 48, 460 * ln, 2); }
    // PRODUCCION: letras muy espaciadas que se aprietan al aparecer
    const pk = clamp((t - 2.1) / 1.0, 0, 1), ls = lerp(30, 12, smooth(pk));
    spacedText(c, 'PRODUCCION', cx, cy + 96, ls, `300 26px ${FONT_WIDE}`, WHITE, i => clamp((pk * 1.7 - i * .09), 0, 1));
    // lema y derechos
    const ck = clamp((t - 3.0) / .8, 0, 1);
    txt(c, 'PRESENTA', cx, cy + 138, { font: `300 13px ${FONT_BRAND}`, align: 'center', color: `rgba(255,255,255,${.75 * ck})`, ls: 7 });
    txt(c, COPY, cx, H - 24, { font: `300 12px ${FONT_BRAND}`, align: 'center', color: `rgba(255,255,255,${.6 * ck})`, ls: .4 });
    c.restore();
    if (t > .8 && t < this.DUR - .9) txt(c, 'Toca para saltar', W - 16, H - 24, { font: `600 12px ${FONT_UI}`, align: 'right', color: `rgba(255,255,255,${.4 + .2 * Math.sin(t * 4)})`, ls: 1 });
    if (t > this.DUR - .7) { c.fillStyle = `rgba(0,0,0,${out * .6})`; c.fillRect(-EX, -EY, CW, CH); }
  },
  pointerDown() { Sfx.unlock(); if (this.t > .5) this.done(); },
  pointerMove() {}, pointerUp() {},
  key(e) { if (this.t > .3 && (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape')) { this.done(); return true; } return false; }
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
  anil:      { base: '#3a35a8', trim: '#ff5a5a', pattern: 'horns', accent: '#1d1a63' },   // Demonio Añil: azul añil con cuernos rojos
  carnaval:  { base: '#ff7a1a', trim: '#2b2540', pattern: 'alebrije', glitter: true },    // exclusivas de la garra
  jade:      { base: '#2e9e6a', trim: '#ffe27a', pattern: 'star', accent: '#1c6b44' },
  tigre:     { base: '#ffb21e', trim: '#2b2540', pattern: 'stripes', accent: '#2b2540' },
  ladron:    { base: '#0b0b10', trim: '#5a5a70', pattern: 'thief', eye: '#f4f1e8' }              // los cadeneros: máscara toda negra de ladrón, con los ojos claros
};
MASK_STYLES.catrina = { base: '#f4f1e8', trim: '#e8509a', pattern: 'alebrije', glitter: true };
MASK_STYLES.azteca = { base: '#14a38b', trim: '#ffc83d', pattern: 'stripes', accent: '#7a1a2b' };
MASK_STYLES.cosmos = { base: '#2a1f6b', trim: '#7cf0ff', pattern: 'star', accent: '#9b5cff' };
MASK_STYLES.fuego = { base: '#e0361e', trim: '#ffd23a', pattern: 'bolt', glitter: true };
MASK_STYLES.plata = { base: '#c9ced8', trim: '#5a6070', pattern: 'bolt' };
MASK_STYLES.arcoiris = { base: '#ff5fa2', trim: '#5fe8ff', pattern: 'alebrije', glitter: true };
const SHOES = {
  galaxia:  { upper: '#2a1f6b', sole: '#f4efe2', accent: '#7cf0ff' },
  lava:     { upper: '#e0361e', sole: '#17171c', accent: '#ffd23a' },
  plata:    { upper: '#c9ced8', sole: '#ffffff', accent: '#5a6070' },
  camo:     { upper: '#456b34', sole: '#f4efe2', accent: '#e0c47a' },
  blanco:   { upper: '#f1efe6', sole: '#f4efe2', accent: '#e0364a' },
  rojo:     { upper: '#d6342c', sole: '#f4efe2', accent: '#fff3b0' },
  azul:     { upper: '#3b5bdb', sole: '#f4efe2', accent: '#ffd95a' },
  amarillo: { upper: '#ffb21e', sole: '#f4efe2', accent: P.ink },
  novato:   { upper: '#2fbf71', sole: '#f4efe2', accent: '#ffd95a' },
  neon:     { upper: '#7cf0a8', sole: '#17171c', accent: '#ffffff' },                      // exclusivos de la garra
  oro:      { upper: '#ffd23a', sole: '#ffffff', accent: '#e0364a' },
  bota:     { upper: '#5a3a1e', sole: '#2b1a0e', accent: '#e0c47a' },                          // v1.4: botas vaqueras, zapatos negros y los zapatotes del payaso
  negro:    { upper: '#17171c', sole: '#f4efe2', accent: '#e0364a' },
  payaso:   { upper: '#e0364a', sole: '#ffd23a', accent: '#3b82f6' }
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
  anil:      { hoodie: '#241c6b', mask: 'anil', shoes: 'rojo', skin: '#8d5524', label: ['DEMONIO', 'AÑIL'] },
  // v1.4 · personal nuevo
  payasito:  { clown: true, hoodie: '#e8509a', pants: '#3b5bdb', shoes: 'payaso', wig: ['#ff5a3a', '#ffd23a', '#3b82f6'], label: ['EL', 'PAYASITO'] },
  ladron:    { hoodie: '#15151b', pants: '#15151b', mask: 'ladron', shoes: 'negro', label: ['SEGU', 'RIDAD'] },
  oso:       { casual: true, gender: 'm', hairStyle: 'none', hairColor: '#2b2018', hoodie: '#5b3a1e', pants: '#17171c', shoes: 'negro', skin: '#c68642', shades: true, scale: 1.2, label: ['JEFE', 'PUERTA'] },
  // meseros robados a los rivales
  vaquero:   { casual: true, gender: 'm', hairStyle: 'spiky', hairColor: '#6b4a2a', hoodie: '#b5482f', pants: '#3b4a7a', shoes: 'bota', skin: '#e0ac69', hat: 'vaquero', hatCol: '#c98b4e', stache: true, label: ['VAQUERO', 'VELOZ'] },
  mariachi:  { casual: true, gender: 'm', hairStyle: 'crop', hairColor: '#17171c', hoodie: '#e0364a', pants: '#17171c', shoes: 'negro', skin: '#c68642', hat: 'charro', hatCol: '#f4efe2', stache: true, label: ['MARIACHI', 'SERENATA'] },
  cholo:     { casual: true, gender: 'm', hairStyle: 'crop', hairColor: '#17171c', hoodie: '#e8e8f0', pants: '#2d3550', shoes: 'blanco', skin: '#8d5524', hat: 'cholo', shades: true, label: ['LOWRIDER', 'DEL BARRIO'] },
  itamae:    { casual: true, gender: 'm', hairStyle: 'spiky', hairColor: '#17171c', hoodie: '#f4f1e8', pants: '#2d3550', shoes: 'negro', skin: '#f1c27d', hat: 'japones', label: ['ITAMAE', 'KENJI'] },
  // jefes de los restaurantes rivales
  sheriff:   { casual: true, gender: 'm', hairStyle: 'crop', hairColor: '#2b2018', hoodie: '#7a4a2b', pants: '#2d3550', shoes: 'bota', skin: '#e0ac69', hat: 'vaquero', hatCol: '#5a3a1e', stache: true, scale: 1.1, label: ['SHERIFF', 'CUERVO'] },
  gallo:     { casual: true, gender: 'm', hairStyle: 'crop', hairColor: '#17171c', hoodie: '#17171c', pants: '#17171c', shoes: 'negro', skin: '#c68642', hat: 'charro', hatCol: '#17171c', stache: true, scale: 1.1, label: ['DON', 'GALLO'] },
  flaco:     { casual: true, gender: 'm', hairStyle: 'crop', hairColor: '#17171c', hoodie: '#8b5cf6', pants: '#2d3550', shoes: 'blanco', skin: '#8d5524', hat: 'cholo', shades: true, scale: 1.1, label: ['EL', 'FLACO'] },
  kenji:     { casual: true, gender: 'm', hairStyle: 'spiky', hairColor: '#17171c', hoodie: '#b7233a', pants: '#17171c', shoes: 'negro', skin: '#f1c27d', hat: 'japones', scale: 1.1, label: ['MAESTRO', 'KENJI'] },
  // v1.5 · cocineros (gente normal, con gorro)
  cocinera:  { casual: true, gender: 'f', hairStyle: 'pony', hairColor: '#2b1a10', hoodie: '#f4efe2', pants: '#8b3a2a', shoes: 'negro', skin: '#c68642', hat: 'cocinera', hatCol: '#e0364a', label: ['DOÑA', 'CHUY'] },
  chefmedio: { casual: true, gender: 'm', hairStyle: 'crop', hairColor: '#2b2018', hoodie: '#ffffff', pants: '#2d3550', shoes: 'negro', skin: '#e0ac69', hat: 'chef', stache: true, scale: 1.03, label: ['CHEF', 'RAMIRO'] },
  chefgran:  { casual: true, gender: 'm', hairStyle: 'spiky', hairColor: '#9a9aa6', hoodie: '#17171c', pants: '#17171c', shoes: 'negro', skin: '#f1c27d', hat: 'chefalto', stache: true, stacheCol: '#9a9aa6', scale: 1.08, label: ['GRAN', 'CHEF'] }
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
  c.strokeStyle = 'rgba(28,26,33,.3)'; c.lineWidth = 1; c.beginPath(); c.moveTo(-6.5, -1.7); c.lineTo(6.5, -1.7); c.stroke();
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
    c.fillStyle = P.ink; c.beginPath(); c.ellipse(0, -0.66, 0.98, 0.66, 0, 0, 6.3); c.fill();
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
    c.fillStyle = P.ink;
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
    c.fillStyle = M.eye || '#0b0614'; c.fill(); c.lineWidth = .07; c.strokeStyle = M.trim; c.stroke();
    if (!f.blink && M.eye) { c.fillStyle = '#0b0614'; c.beginPath(); c.arc(m * .06 + f.look * .1, -.04, .11, 0, 6.3); c.fill(); }
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
  if (style !== 'none') {
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
  }
  if (g && style === 'long') { c.strokeStyle = ink; c.fillStyle = hair; c.lineWidth = 1.6; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 14, 0); c.quadraticCurveTo(s * 17, 8, s * 14.5, 16); c.lineTo(s * 12.6, 9); c.quadraticCurveTo(s * 13.4, 4, s * 12.4, -1); c.closePath(); c.fill(); c.stroke(); } }
  c.restore();
}

/* ---------- Accesorios (v1.4): sombreros, lentes, bigote, cara de payaso, el bate de los cadeneros y las poses de pelea ---------- */
// Se dibujan con el origen en el centro de la cabeza (radio ≈ 17)
function drawHat(c, kind, dir, o) {
  c.save(); c.lineJoin = 'round'; c.lineCap = 'round'; c.lineWidth = 1.8; c.strokeStyle = P.ink;
  const col = o.hatCol;
  if (kind === 'vaquero') {                                                       // sombrero vaquero de ala ancha
    const b = col || '#8a5a2b';
    c.fillStyle = shade(b, -.15); c.beginPath(); c.moveTo(-12, -8); c.quadraticCurveTo(-13.5, -25, -6, -26); c.quadraticCurveTo(0, -21, 6, -26); c.quadraticCurveTo(13.5, -25, 12, -8); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = b; c.beginPath(); c.moveTo(-27, -13); c.quadraticCurveTo(-24, -5, -12, -7); c.quadraticCurveTo(0, -4, 12, -7); c.quadraticCurveTo(24, -5, 27, -13); c.quadraticCurveTo(14, -17, 0, -15.5); c.quadraticCurveTo(-14, -17, -27, -13); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#e0364a'; c.fillRect(-11.6, -11.5, 23.2, 3.2);
  } else if (kind === 'charro') {                                                 // sombrero de mariachi: ala enorme con greca dorada
    const b = col || '#17171c';
    c.fillStyle = b; c.beginPath(); c.moveTo(-9, -10); c.lineTo(-6.5, -29); c.quadraticCurveTo(0, -32, 6.5, -29); c.lineTo(9, -10); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.ellipse(0, -10, 31, 6.5, 0, 0, 6.3); c.fill(); c.stroke();
    c.strokeStyle = '#ffc83d'; c.lineWidth = 2; c.beginPath(); c.ellipse(0, -10, 28, 5, 0, .15, Math.PI - .15); c.stroke();
    c.lineWidth = 1.8; c.strokeStyle = P.ink; c.fillStyle = '#ffc83d'; c.fillRect(-9, -15.5, 18, 3.2);
    c.fillStyle = '#e0364a'; for (const sx of [-4.5, 0, 4.5]) { c.beginPath(); c.arc(sx, -13.9, 1.3, 0, 6.3); c.fill(); }
  } else if (kind === 'cholo') {                                                  // paliacate azul amarrado en la frente, con el nudo a un lado
    c.fillStyle = '#3b6fd0'; c.beginPath(); c.moveTo(-15.5, -4); c.quadraticCurveTo(0, -14, 15.5, -4); c.lineTo(15, -10.5); c.quadraticCurveTo(0, -19.5, -15, -10.5); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#fff'; for (const [x, y] of [[-8, -10.4], [-2, -12.2], [5, -11.4], [10.5, -8.5], [-12, -7]]) { c.beginPath(); c.arc(x, y, 1.1, 0, 6.3); c.fill(); }
    c.fillStyle = '#3b6fd0'; c.beginPath(); c.moveTo(dir * 14, -8); c.lineTo(dir * 22, -12); c.lineTo(dir * 20, -4); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(dir * 14, -8); c.lineTo(dir * 21, -2); c.lineTo(dir * 15, 0); c.closePath(); c.fill(); c.stroke();
  } else if (kind === 'japones') {                                                // hachimaki: cinta blanca con el sol rojo
    c.fillStyle = '#fff8ea'; c.beginPath(); c.moveTo(-15.6, -5); c.quadraticCurveTo(0, -15, 15.6, -5); c.lineTo(15.2, -11.5); c.quadraticCurveTo(0, -21.5, -15.2, -11.5); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#e0364a'; c.beginPath(); c.arc(0, -14.2, 3.4, 0, 6.3); c.fill();
    c.fillStyle = '#fff8ea'; c.beginPath(); c.moveTo(-dir * 14, -8); c.lineTo(-dir * 25, -3); c.lineTo(-dir * 22, -11); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(-dir * 14, -8); c.lineTo(-dir * 24, -13); c.lineTo(-dir * 18, -16); c.closePath(); c.fill(); c.stroke();
  } else if (kind === 'chef' || kind === 'chefalto') {                              // gorro de cocinero: banda y nubes blancas (el gran chef lo lleva altísimo y con cinta dorada)
    const tall = kind === 'chefalto', top = tall ? -48 : -36;
    const puffs = tall ? [[-10, top + 17, 9], [0, top + 10, 11], [10, top + 17, 9], [-5, top + 22, 8], [5, top + 22, 8]] : [[-9.5, top + 15, 9], [0, top + 9, 10.5], [9.5, top + 15, 9]];
    c.fillStyle = '#fffdf6'; puffs.forEach(([px, py, pr]) => { c.beginPath(); c.arc(px, py, pr, 0, 6.3); c.fill(); c.stroke(); });
    c.fillRect(-12.5, top + 19, 25, -9 - (top + 19));
    c.beginPath(); c.moveTo(-12.5, top + 19); c.lineTo(-12.5, -9); c.moveTo(12.5, top + 19); c.lineTo(12.5, -9); c.stroke();
    c.fillStyle = tall ? '#ffc83d' : '#e8e2d0'; c.fillRect(-12.5, -15, 25, 6); c.strokeRect(-12.5, -15, 25, 6);
  } else if (kind === 'cocinera') {                                                 // pañuelo rojo con puntitos y un nudo a un lado
    const b = col || '#e0364a';
    c.fillStyle = b; c.beginPath(); c.moveTo(-16.5, -2); c.quadraticCurveTo(-18, -22, 0, -23); c.quadraticCurveTo(18, -22, 16.5, -2); c.quadraticCurveTo(0, -11, -16.5, -2); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#fff'; for (const [px, py] of [[-9, -12], [-2, -17], [6, -14], [11, -8], [-12, -6], [1, -9]]) { c.beginPath(); c.arc(px, py, 1.3, 0, 6.3); c.fill(); }
    c.fillStyle = b; c.beginPath(); c.moveTo(dir * 15, -11); c.lineTo(dir * 25, -18); c.lineTo(dir * 24, -7); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(dir * 15, -11); c.lineTo(dir * 24, -3); c.lineTo(dir * 17, -2); c.closePath(); c.fill(); c.stroke();
  }
  c.restore();
}
function drawShades(c, dir) {                                                      // lentes oscuros
  c.save(); c.lineJoin = 'round'; c.lineWidth = 1.5; c.strokeStyle = P.ink; c.fillStyle = '#0b0a10';
  for (const s of [-1, 1]) { rr(c, s * 5.5 + dir * .5 - 5.2, -2.2, 10.4, 7, 3); c.fill(); c.stroke(); }
  c.beginPath(); c.moveTo(-.3 + dir * .5, .4); c.lineTo(.3 + dir * .5, .4); c.stroke();
  c.fillStyle = 'rgba(255,255,255,.35)'; for (const s of [-1, 1]) c.fillRect(s * 5.5 + dir * .5 - 3.4, -1, 3, 1.2);
  c.restore();
}
function drawStache(c, col) {                                                      // bigote
  c.save(); c.fillStyle = col || '#17171c'; c.strokeStyle = P.ink; c.lineWidth = 1; c.lineJoin = 'round';
  for (const s of [-1, 1]) { c.beginPath(); c.moveTo(0, 7.6); c.quadraticCurveTo(s * 5, 4.8, s * 9.5, 8.6); c.quadraticCurveTo(s * 5, 9.8, 0, 8.8); c.closePath(); c.fill(); c.stroke(); }
  c.restore();
}
function drawClownHead(c, o, f) {                                                  // cara de payaso: peluca de colores, cara blanca, rombos azules, nariz roja y sonrisa pintada
  const wig = o.wig || ['#ff5a3a', '#ffd23a', '#3b82f6'];
  c.save(); c.lineJoin = 'round'; c.lineCap = 'round'; c.lineWidth = 2; c.strokeStyle = P.ink;
  for (const s of [-1, 1]) [[19, -2, 8.5, wig[0]], [17, -12, 7, wig[1]], [16, 8, 6.5, wig[2]]].forEach(([x, y, r, col]) => { c.fillStyle = col; c.beginPath(); c.arc(s * x, y, r, 0, 6.3); c.fill(); c.stroke(); });
  c.fillStyle = wig[1]; c.beginPath(); c.arc(0, -19, 6.5, 0, 6.3); c.fill(); c.stroke();
  c.restore();
  drawCasualHead(c, Object.assign({}, o, { gender: 'm', hairStyle: 'none', hairColor: '#fff' }), Object.assign({}, f, { skin: '#fbf3e4' }));
  c.save(); c.lineJoin = 'round'; c.lineCap = 'round';
  for (const s of [-1, 1]) {
    c.globalAlpha = .4; c.fillStyle = '#2f8cff'; c.beginPath(); c.moveTo(s * 5.5, -7.2); c.lineTo(s * 9.2, -2.2); c.lineTo(s * 5.5, 3); c.lineTo(s * 1.8, -2.2); c.closePath(); c.fill(); c.globalAlpha = 1;
    c.fillStyle = '#ff6a7a'; c.beginPath(); c.arc(s * 9.4, 8.2, 3, 0, 6.3); c.fill();
  }
  c.strokeStyle = P.ink; c.lineWidth = 4.8; c.beginPath(); c.moveTo(-9.8, 8.4); c.quadraticCurveTo(0, 18, 9.8, 8.4); c.stroke();
  c.strokeStyle = '#e0364a'; c.lineWidth = 2.8; c.stroke();
  c.fillStyle = '#e0364a'; c.strokeStyle = P.ink; c.lineWidth = 1.4; c.beginPath(); c.arc(0, 5.6, 4.8, 0, 6.3); c.fill(); c.stroke();
  c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.arc(-1.5, 4.2, 1.3, 0, 6.3); c.fill();
  c.restore();
}
function drawBat(c, kind, ang) {                                                   // bate: se dibuja desde la mano, apuntando hacia arriba y girado ang
  c.save(); c.rotate(ang); c.lineJoin = 'round'; c.lineWidth = 1.6; c.strokeStyle = P.ink;
  const L = 32, steel = kind === 'acero';
  c.fillStyle = steel ? '#3a3d48' : '#c98b4e';
  c.beginPath(); c.moveTo(-1.8, 5); c.lineTo(-3.2, -L + 7); c.quadraticCurveTo(-4.2, -L, 0, -L - 1.5); c.quadraticCurveTo(4.2, -L, 3.2, -L + 7); c.lineTo(1.8, 5); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = steel ? '#e0364a' : '#f4efe2'; c.fillRect(-2, -3, 4, 8); c.strokeRect(-2, -3, 4, 8);
  if (steel) { c.fillStyle = '#e0364a'; c.fillRect(-3.4, -L + 8, 6.8, 2.6); c.fillRect(-3.8, -L + 14, 7.6, 2.6); }
  else { c.strokeStyle = 'rgba(90,50,20,.6)'; c.lineWidth = 1; c.beginPath(); c.moveTo(-1.4, -L + 10); c.lineTo(-1.8, -8); c.stroke(); }
  c.restore();
}
// Brazos según la pose (pelea, cadenero): devuelve [ángulo del hombro, ángulo del codo]
function poseArm(pose, sg, dir, o, SX, SY, L1, L2, t) {
  const front = sg === dir, sh = { x: sg * SX, y: SY };
  switch (pose) {
    case 'punch': return front ? ik(sh, { x: dir * (SX + 20), y: SY + 1 }, L1, L2, sg) : [-sg * .9, sg * 1.4];
    case 'hit': return [-sg * (2.3 + Math.sin(t * 40 + sg) * .12), sg * .25];
    case 'flex': return [-sg * 2.65, sg * .5];
    case 'fly': return [Math.PI + sg * .16, 0];
    case 'guard': return ik(sh, { x: sg * 5, y: -49 }, L1, L2, sg);
    case 'grab': return ik(sh, { x: dir * (SX + 12 + (front ? 4 : 0)), y: SY + 9 }, L1, L2, sg);
    case 'bat': return front ? ik(sh, o.handT || { x: dir * (SX + 9), y: SY + 9 }, L1, L2, sg) : [-sg * .14, sg * .1];
    case 'throw': return front ? ik(sh, { x: dir * (SX + 10), y: SY - 18 }, L1, L2, sg) : [-sg * .8, sg * 1.2];
    case 'down': return [-sg * 1.1, sg * .2];
    case 'kick': return [-sg * 1.2, sg * .3];
    default: return [-sg * .12, sg * .1];
  }
}
/* ---------- Cadeneros: se paran junto a la puerta con su bate ---------- */
function makeGuard(id, entering) {
  const sp = guardSpot(GUARDS[id].spot);
  return { id, x: entering ? SPAWN_X : sp.x, y: entering ? SIDE_Y : sp.y, dir: -1, phase: 0, moving: false, speed: 2.4, swing: 0, cd: 1.2, t: Math.random() * 6,
    path: entering ? [{ x: sp.x, y: SIDE_Y }, { x: sp.x, y: sp.y }] : [] };
}
const BAT_T = .8;                                                  // lo que dura el batazo al aire
function updateGuards(w, dt) {
  for (const g of w.guards) {
    g.t += dt; step(g, dt); if (g.swing > 0) g.swing -= dt; if (g.cd > 0) g.cd -= dt;
    if (g.path.length) continue;
    g.dir = -1;
    if (g.cd > 0 || w.dayTime <= 0) continue;
    const D = GUARDS[g.id], cu = w.queue.find(q => q.state === 'queue' && q.patience < q.pmax * .3 && (q.warned || 0) < D.warns);   // al que está por desesperarse le llama la atención
    if (cu) {
      cu.warned = (cu.warned || 0) + 1; cu.patience = Math.max(cu.patience, cu.pmax * D.warn); g.swing = BAT_T; g.cd = 2.2;
      const p = actorPos(cu); addPart(w, { type: 'text', text: '¡ORDEN EN LA FILA!', x: p.x, y: p.y - 100, vy: -24, life: 1.5, color: '#9af0b8' });
      w.shake = Math.max(w.shake, .12); sfx('pum');
    }
  }
}
function drawGuard(c, w, g) {
  const D = GUARDS[g.id], L = LUCHADORES[D.look], p = S(g.x, g.y), k = g.swing > 0 ? 1 - g.swing / BAT_T : -1;
  let ang = g.dir * .55, handT = null;                                     // en reposo el bate descansa sobre el hombro
  if (k >= 0) {                                                            // batazo al aire: se echa atrás, pega y regresa
    const a = k < .3 ? .55 + k / .3 * .95 : k < .55 ? 1.5 - (k - .3) / .25 * 2.9 : -1.4 + (k - .55) / .45 * 1.95;
    ang = g.dir * a; handT = { x: g.dir * 18, y: k < .3 ? -44 : -30 };
  }
  const o = Object.assign({}, L, { state: g.path.length ? 'walk' : 'idle', t: g.path.length ? g.phase : g.t, dir: g.dir, scale: (L.scale || 1), pose: 'bat', handT, holdFn: (cc, aa) => { cc.rotate(-aa); drawBat(cc, D.bat, ang); } });
  drawLuchador(c, p.x, p.y, o);
  const tp = p.y - 76 * (L.scale || 1) - 8;
  txt(c, D.tag, p.x, tp, { font: `700 11px ${FONT_UI}`, align: 'center', color: '#ffe0a0', stroke: P.ink, sw: 4, ls: 1.5 });
}
/* ---------- Cocineros: espátula, gorro y el personaje ---------- */
function drawSpatula(c, ang) {                                       // espátula: se dibuja desde la mano, apuntando hacia arriba y girada ang
  c.save(); c.rotate(ang); c.lineJoin = 'round'; c.lineWidth = 1.5; c.strokeStyle = P.ink;
  c.fillStyle = '#8a5a2b'; rr(c, -1.7, -17, 3.4, 22, 1.6); c.fill(); c.stroke();                       // mango de madera
  c.fillStyle = '#c9ced8'; rr(c, -6, -32, 12, 16, 2.5); c.fill(); c.stroke();                           // hoja de acero
  c.strokeStyle = 'rgba(60,64,80,.7)'; c.lineWidth = 1; for (const sx of [-2.4, 0, 2.4]) { c.beginPath(); c.moveTo(sx, -29); c.lineTo(sx, -20); c.stroke(); }
  c.restore();
}
function drawChef(c, w, ch) {
  const D = CHEFS[ch.id], L = LUCHADORES[D.look], p = S(ch.x, ch.y), sc = L.scale || 1;
  const moving = ch.path.length > 0, k = Math.sin(ch.t * 9), ang = ch.dir * (ch.work ? .55 + .35 * k : .45);
  const o = Object.assign({}, L, { state: moving ? 'walk' : 'idle', t: moving ? ch.phase : ch.t, dir: ch.dir, scale: sc, pose: 'bat',
    handT: ch.work ? { x: ch.dir * 15, y: -32 + k * 5 } : null, holdFn: (cc, aa) => { cc.rotate(-aa); drawSpatula(cc, ang); } });
  c.fillStyle = 'rgba(0,0,0,.2)'; c.beginPath(); c.ellipse(p.x, p.y + 2, 17, 6, 0, 0, 6.3); c.fill();
  drawLuchador(c, p.x, p.y, o);
  const tp = p.y - 76 * sc - (L.hat === 'chefalto' ? 52 : L.hat === 'chef' ? 42 : 24);
  txt(c, D.tag, p.x, tp, { font: `700 11px ${FONT_UI}`, align: 'center', color: '#ffe0a0', stroke: P.ink, sw: 4, ls: 1.5 });
}
/* ---------- Letrero de Estrellas de Sabor (en la pared de la puerta) ---------- */
function drawStarPlaque(c, w, x, y, wd, ht) {
  const s = starsOf(w);
  c.save();
  c.fillStyle = '#5a3a1e'; c.strokeStyle = P.ink; c.lineWidth = 1.6; for (const px of [x + 12, x + wd - 17]) { c.fillRect(px, y + ht - 2, 5, 14); c.strokeRect(px, y + ht - 2, 5, 14); }       // postes
  c.fillStyle = '#2a1e12'; rr(c, x, y, wd, ht, 5); c.fill(); c.lineWidth = 2; c.strokeStyle = P.gold; c.stroke();
  c.lineWidth = 1; c.strokeStyle = 'rgba(255,200,61,.4)'; rr(c, x + 3, y + 3, wd - 6, ht - 6, 3); c.stroke();
  txt(c, 'ESTRELLAS DE SABOR', x + wd / 2, y + 12, { font: `700 7px ${FONT_UI}`, align: 'center', color: P.gold, ls: .5, maxW: wd - 14 });
  for (let i = 0; i < 5; i++) {
    const cx = x + wd / 2 + (i - 2) * 14.5, cy = y + ht - 11, f = clamp(s - i, 0, 1);
    c.fillStyle = 'rgba(255,255,255,.12)'; star(c, cx, cy, 6.2, 2.8); c.fill(); c.lineWidth = .9; c.strokeStyle = 'rgba(255,255,255,.4)'; c.stroke();
    if (f > 0) { c.save(); c.beginPath(); c.rect(cx - 7, cy - 7, 14 * f, 14); c.clip(); c.fillStyle = P.gold; star(c, cx, cy, 6.2, 2.8); c.fill(); c.lineWidth = .9; c.strokeStyle = P.ink; c.stroke(); c.restore(); }
  }
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
  const pose = o.pose || null;                                       // v1.4: 'punch' | 'kick' | 'fly' | 'hit' | 'guard' | 'grab' | 'flex' | 'down' | 'bat' | 'throw'

  c.save();
  c.translate(x, y); c.scale(sc, sc);
  if (walking) c.rotate(dir * .05 * Math.sin(t * 5));              // ligera inclinación al caminar
  if (!seated) { c.fillStyle = 'rgba(0,0,0,.24)'; c.beginPath(); c.ellipse(0, 1, 16, 5.5, 0, 0, 6.3); c.fill(); }

  // ---- piernas cortas con tenis anchos (oscilan en oposición) ----
  for (const sg of [-1, 1]) {
    let swing = walking ? (sg < 0 ? step : -step) * .5 : 0;
    let lift = walking ? Math.max(0, sg < 0 ? step : -step) * 3.5 : 0;
    if (pose === 'kick') { if (sg === dir) { swing = -dir * 1.5; lift = 2; } else swing = dir * .35; }
    else if (pose === 'fly') swing = sg * .08;
    else if (pose === 'hit') swing = sg * .3 * Math.sin(t * 30);
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
    let a1, a2, hold = o.holdFn && sg === dir ? o.holdFn : null;
    if (pose) { [a1, a2] = poseArm(pose, sg, dir, o, SX, SY, L1, L2, t); }
    else if (eating && sg === dir) {
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
  if (o.clown) {                                                    // payaso: peluca de colores y cara pintada
    drawClownHead(c, o, { dir, hood, skin, dk, angry: o.angry, blink, open: eating ? clamp(Math.abs(chew), 0, 1) : 0 });
  } else if (o.casual) {                                                   // gente normal: cara descubierta con su peinado (sin máscara)
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
  if (o.stache) drawStache(c, o.stacheCol);
  if (o.shades) drawShades(c, dir);
  if (o.hat) drawHat(c, o.hat, dir, o);
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
  newGame(save, slot) { camReset(); this.w = createWorld(save); this.slot = slot || 0; this.autoT = 0; if (this.slot && !save) this.save(); },
  save() {
    const w = this.w; if (!w || !this.slot) return;
    const held = w.edit && w.edit.held ? [w.edit.held.it] : [];
    const midDay = w.phase === 'play', pocket = w.coins.reduce((s, co) => s + co.v, 0);   // las monedas sin cobrar también cuentan
    const grab = it => ({ type: it.type, c: it.c, r: it.r, rot: it.rot || 0, style: it.style, chair: it.type === 'table' ? it.chair : undefined, cap: it.cap,
      slots: it.slots ? it.slots.map(s => ({ state: s.state, dish: s.dish, t: s.t, n: s.n, dur: s.dur })) : undefined });
    Store.write(Store.key(this.slot), { v: 12, stars: w.stars, moves: w.moves, conq: w.conq, flock: w.fightLock, guards: w.guards.map(g => g.id), chefs: w.chefs.map(m => m.id), town: townPersist(w), cookN: w.cookN || 0, at: Date.now(), gems: w.gems, char: w.char, outs: w.outs.map(o => ({ type: o.type, c: o.c, r: o.r })), lot: w.lot ? { c: w.lot.c, r: w.lot.r } : null, clawN: w.clawN, clawDay: w.clawDay, tut: w.tut ? w.tut.s : null, day: w.phase === 'summary' ? w.day + 1 : w.day, money: w.money + pocket, rep: w.rep, totalServed: w.totalServed, stock: stockSaved(w), hands: w.nHands, level: w.level, xp: w.xp,
      furn: w.furn.map(grab), inv: w.inv.concat(held).map(f => ({ type: f.type, style: f.style, chair: f.type === 'table' ? f.chair : undefined })), invCap: w.invCap, staff: w.staff.map(m => m.id), deco: w.deco,
      resume: midDay ? { dayTime: w.dayTime, dayServed: w.dayServed, dayEarned: w.dayEarned, dayCost: w.dayCost, dayAngry: w.dayAngry, repTemp: w.repTemp, vips: w.vips,
        stam: w.novato.stamina, staffStam: w.staff.map(m => m.stamina) } : null });
  },
  update(dt) {
    const w = this.w;
    if (this.slot && (this.autoT += dt) >= 15) { this.autoT = 0; this.save(); }
    if (w.tut) tutorialUpdate(w);
    if ((w.modal === 'fight' && !w.fight) || (w.modal === 'map' && !w.map)) w.modal = null;                     // red de seguridad: ventana sin datos
    if (w.pendingLv.length && !w.modal && !w.shop && !w.edit && !w.tut && w.phase === 'play') openLevelUp(w);                  // ¡subiste de nivel!: ventana con lo que se desbloquea
    if (w.shop || w.edit || w.modal || (w.tut && (TUT[w.tut.s] === 'intro' || TUT[w.tut.s] === 'outro'))) {   // la tienda, el modo edición y las ventanas del tutorial pausan el juego                                        // la tienda y el modo edición pausan el juego
      w.t += dt; w.shownMoney += (w.money - w.shownMoney) * Math.min(1, dt * 6);
      if (w.modal === 'claw') updateClaw(w, dt);
      if (w.modal === 'lvl') updateLevelUp(w, dt);
      if (w.modal === 'fight') updateFight(w, dt);
      if (w.modal === 'penal') updatePenal(w, dt);
      updateFade(w, dt);
      if (w.moneyFlash > 0) w.moneyFlash -= dt;
      w.toasts.forEach(t => t.t -= dt); w.toasts = w.toasts.filter(t => t.t > 0);
      return;
    }
    updateWorld(w, dt);
    updateFade(w, dt); if (w.loc !== 'rest') updateAway(w, dt);
  },
  draw(c) { drawWorld(c, this.w); },
  // Un toque sobre el escenario se resuelve al soltar (si no fue un arrastre): arrastrar mueve la cámara, pellizcar hace zoom
  pend: null,
  pointerDown(x, y) {
    const w = this.w;
    if (Pinch.active) return;
    if (clickDeferrable(w, x, y)) { this.pend = { x, y, sx: x, sy: y, px: Cam.px, py: Cam.py, drag: false }; return; }
    worldPointer(w, x, y);
  },
  pointerMove(x, y) {
    const w = this.w, p = this.pend;
    if (p && !Pinch.active) {
      if (!p.drag && Math.hypot(x - p.sx, y - p.sy) > (UI.touch ? 12 : 8)) p.drag = true;
      if (p.drag) { Cam.px = p.px + (x - p.sx); Cam.py = p.py + (y - p.sy); camClamp(); }
    }
    if (w.edit) editHover(w, x, y);
    if (w.hedit) homeEditHover(w, x, y);
  },
  pointerUp() { const p = this.pend; this.pend = null; if (p && !p.drag && !Pinch.active) worldPointer(this.w, p.x, p.y); },
  rightClick() { const w = this.w; if (w.edit && w.edit.held) editCancel(w); },
  key(e) {
    const w = this.w;
    if (w.modal) { if (w.modal === 'sign') return signKey(w, e); if (w.modal === 'cal') return calKey(w, e); if (w.modal === 'lvl') return lvKey(w, e); if (w.modal === 'map') return mapKey(w, e); if (w.modal === 'fight') return fightKey(w, e); if (w.modal === 'dlg') return dlgKey(w, e); if (w.modal === 'catalog') { if (e.key === 'Escape') { w.modal = null; sfx('back'); return true; } return false; } if (w.modal === 'paint') { if (e.key === 'Escape') { w.modal = null; Game.save(); sfx('back'); return true; } return false; } if (w.modal === 'penal') { if (e.key === 'Escape') { penalClosePanel(w); return true; } return false; } if (e.key === 'Escape') { w.modal = null; sfx('back'); return true; } return false; }
    if (w.phase === 'play' && !w.shop) {                                                             // zoom con el teclado
      if (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd') { camZoomAt(1.2, CAMC.x, CAMC.y); return true; }
      if (e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract') { camZoomAt(1 / 1.2, CAMC.x, CAMC.y); return true; }
      if (e.key === '0') { camReset(); return true; }
    }
    if (handsOn(w) && !e.ctrlKey && !e.altKey && !e.metaKey && handKey(w, e)) return true;                                           // 1–4 o Tab: cambiar de mano
    if ((e.key === 'r' || e.key === 'R' || e.code === 'KeyR') && w.hedit) { if (!e.repeat) homeRotate(w); return true; }
    if (e.key === 'Escape' && w.hedit) { homeEditDone(w); return true; }
    if ((e.key === 'r' || e.key === 'R' || e.code === 'KeyR') && w.edit && w.phase === 'play') { if (!e.repeat) editRotate(w); return true; }      // girar el mueble en modo EDITAR (también con otras distribuciones de teclado)
    if ((e.key === 'c' || e.key === 'C') && w.phase === 'play' && !w.shop && !w.edit && !w.tut) { openCal(w); return true; }          // C = calendario
    if ((e.key === 'm' || e.key === 'M') && mapAvail(w)) { openMap(w); return true; }                                                  // M = mapa de rivales
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
    rep: save ? clamp(save.rep, 0, 5) : 1, repTemp: 0, vips: [], staff: [], chefs: [], chefSeen: {}, shopView: 'main', shopTab: 'furn', decCat: 'floor', decPage: 0, totalServed: save ? (save.totalServed || 0) : 0,
    stock: MENU.reduce((o, k) => (o[k] = save && save.stock && save.stock[k] || 0, o), {}),   // porciones listas en la barra
    level: save && save.level ? save.level : 1, xp: save && save.xp ? save.xp : 0, levelFlash: 0, shake: 0, fx: [],
    shop: false, edit: null, bench: [null, null], panelIdx: 0, furn: [], inv: [], invCap: INV_BASE, slots: [], dslots: [],
    hands: [null, null, null, null], hand: 0, nHands: save ? clamp(save.hands || 1, 1, HANDS.length) : 1,
    open: true, maskCust: 0,
    panel: false, doorA: 0, doorV: 0, doorOpen: false, toasts: [], btns: [], overlay: []
  };
  w.novato = { x: 2.5, y: 2.5, dir: 1, phase: 0, path: [], speed: 3.2, moving: false, carrying: null, task: null,
    stamina: 100, resting: false, furia: false, busy: false, overwork: 0, zeroWarned: false };
  const sd = save && save.deco, legacy = !!save && !(sd && sd.dv);          // una partida de antes de la decoración por niveles conserva todo lo que ya se veía
  const legOwn = legacy ? { felpudo: true, menu: true, p_camp: true, neon: true, alfombra: true, p_copa: !!(sd && sd.remodeled) } : {};
  w.deco = Object.assign({ remodeled: false, arena: false, paint: legacy ? 'ocre' : 'cal', awning: '', floor: legacy ? 'damero' : 'cemento', bunting: legacy ? 'papel' : 'none',
    paintBonus: false, awningBonus: false, sign: { t1: 'ENMASCARADOS', t2: 'TACOS', st: 0, li: true } }, sd, {
    paints: Object.assign({ cal: true }, sd && sd.paints), awnings: Object.assign({ '': true }, sd && sd.awnings),
    floors: Object.assign({ cemento: true }, legacy ? { damero: true } : {}, sd && sd.floors), buntings: Object.assign({ none: true }, legacy ? { papel: true } : {}, sd && sd.buntings),
    own: Object.assign({}, legOwn, sd && sd.own), on: Object.assign({}, legOwn, sd && sd.on), dv: 2 });
  w.gems = save && save.gems ? save.gems : 0; w.gemsSeen = w.gems > 0;
  w.char = { look: Object.assign({}, LOOK_DEFAULT, save && save.char && save.char.look), own: Object.assign({}, save && save.char && save.char.own) };            // personalización del personaje
  w.cookN = save && save.cookN ? clamp(save.cookN | 0, 0, 6) : 0; w.outs = []; w.pendingLv = []; w.lot = null; w.cars = []; w.carT = 12; w.clawN = save && save.clawN ? save.clawN : 0; w.clawDay = save && save.clawDay ? save.clawDay : 0; w.shopPage = 0; w.modal = null;
  w.tut = save ? (Number.isInteger(save.tut) ? { s: save.tut } : null) : { s: 0 };                // tutorial: solo en partida nueva (y se retoma si se guardó a medias)
  DECO = w.deco; applyRemodel(extOf(w.deco));                                                // el local se ensancha si ya se remodeló
  loadLayout(w, save);                                                                           // mobiliario colocado e inventario
  const hired = save ? (Array.isArray(save.staff) ? save.staff : save.waiter ? ['waiter1'] : []).filter(id => STAFF[id]) : [];
  w.staff = hired.map(id => makeStaff(id, false));
  w.guards = ((save && save.guards) || []).filter(id => GUARDS[id]).map(id => makeGuard(id, false));
  w.chefs = ((save && save.chefs) || []).filter(id => CHEFS[id]).map((id, i) => makeChef(id, false, i));
  townInit(w, save);
  w.stars = save && Number.isFinite(save.stars) ? clamp(Math.round(save.stars * 2) / 2, STAR_START, STAR_MAX) : STAR_START;
  w.moves = Object.assign({}, save && save.moves); w.conq = Object.assign({}, save && save.conq); w.fightLock = Object.assign({}, save && save.flock);
  w.pay = null; w.fight = null; w.map = null; w.fireAsk = null;
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
    let comalN = 0;
    w.furn = save.furn.filter(ok).map(o => {
      const it = makeFurn(o.type, o.c, o.r, o.rot, { style: o.style, chair: o.chair === undefined ? 'plastico' : o.chair, cap: o.type === 'comal' ? (o.cap || (comalN++ === 0 ? 2 : 4)) : undefined });        // las mesas de antes ya traían sillas de plástico
      if (it.type === 'table') placeSeats(it);
      if (it.slots && o.slot && !Array.isArray(o.slots) && (o.slot.state === 'cook' ? RECIPES[o.slot.dish] : true)) Object.assign(it.slots[0], o.slot);      // la tanda que se estaba cocinando sigue en el fuego
      if (it.slots && Array.isArray(o.slots)) it.slots.forEach((s, i) => { const q = o.slots[i]; if (q && (q.state !== 'cook' || RECIPES[q.dish])) Object.assign(s, q); });
      return it;
    });
    w.inv = (save.inv || []).map(t => typeof t === 'string' ? { type: t } : t).filter(t => t && FURN[t.type]).map(t => makeFurn(t.type, 0, 0, 0, { style: t.style, chair: t.chair === undefined ? (t.type === 'table' ? 'plastico' : null) : t.chair }));
    w.outs = (save.outs || []).filter(o => o && FURN[o.type] && FURN[o.type].out && Number.isFinite(o.c) && Number.isFinite(o.r)).map(o => ({ id: furnId++, type: o.type, c: o.c, r: o.r }));
    w.invCap = clamp(Math.max(save.invCap || INV_BASE, w.inv.length), INV_BASE, 99);
    if (save.lot && Number.isFinite(save.lot.c) && Number.isFinite(save.lot.r)) w.lot = { id: furnId++, type: 'parking', c: save.lot.c | 0, r: save.lot.r | 0 };
  } else {                                                                 // partida nueva (local pelón) o de una versión muy vieja (local completo)
    w.furn = save ? defaultFurn() : starterFurn(); w.inv = []; w.invCap = INV_BASE;
    if (save && save.comal2) w.inv.push(makeFurn('comal'));                // lo ya comprado pasa al inventario
    for (let i = 2; i < (save && save.tables || 2); i++) w.inv.push(makeFurn('table'));
  }
  fixLayout(w); fixOuts(w);
  rebuildLayout(w);
}
// Si una pieza cambió de tamaño o de sitio (p. ej. el mostrador de bebidas ahora mide 2 losetas), las que quedan encimadas o fuera se reacomodan solas
function fixLayout(w) {
  const taken = new Set(), keep = [], bad = [], ring = DECO.arena ? new Set(RING_CELLS().map(([c, r]) => r * COLS + c)) : new Set();
  const okTiles = t => t.every(([c, r]) => c >= 0 && r >= 0 && c < COLS && r < ROWS && !taken.has(r * COLS + c) && !ring.has(r * COLS + c) && !(c === DOOR.cells[0].c && r === DOOR.cells[0].r));
  w.furn.forEach(it => { const t = footprint(it); if (okTiles(t)) { t.forEach(([c, r]) => taken.add(r * COLS + c)); keep.push(it); } else bad.push(it); });
  bad.forEach(it => {
    let spot = null;
    for (const rot of [it.rot || 0, it.rot ? 0 : 1]) {
      for (let r = 0; r < ROWS && !spot; r++) for (let c = 0; c < COLS && !spot; c++) if (okTiles(footprint({ type: it.type, c, r, rot }))) spot = { c, r, rot };
      if (spot) break;
    }
    if (spot) { it.c = spot.c; it.r = spot.r; it.rot = spot.rot; if (it.type === 'table') placeSeats(it); footprint(it).forEach(([c, r]) => taken.add(r * COLS + c)); keep.push(it); } else w.inv.push(it);
  });
  w.furn = keep; w.invCap = Math.max(w.invCap, w.inv.length);
}
// Reloj del día: abre a las 8:00 AM y cierra a las 11:00 PM
const hourOf = w => START_H + (END_H - START_H) * (1 - clamp(w.dayTime / w.dayLen, 0, 1));
function fmtHour(h) {
  const hh = Math.floor(h), mm = Math.floor((h - hh) * 60 / 5) * 5, ap = hh >= 12 ? 'PM' : 'AM', h12 = ((hh + 11) % 12) + 1;
  return `${h12}:${String(mm).padStart(2, '0')} ${ap}`;
}
/* =========================================================
   CALENDARIO Y FECHAS ESPECIALES
   Cada día de juego avanza 3 días del calendario (un año dura 122 días de juego, unas 7 horas de partida). El juego empieza el 1 de enero.
   En las fechas especiales cambia la decoración de la calle, llega más (o menos) gente y algunos platillos se venden más caros.
   Economía: el efecto es chico y dura pocos días al año; nunca hay más de +35 % de clientes ni más de +30 % de precio en un platillo.
   ========================================================= */
const MONTHS = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
const MON3 = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
const MDAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31], CAL_STEP = 3;
const doyOf = (m, d) => MDAYS.slice(0, m).reduce((a, b) => a + b, 0) + d;          // día del año (1 a 365)
function dateOf(day) {
  const n = (day - 1) * CAL_STEP, doy = n % 365 + 1; let m = 0, r = doy;
  while (r > MDAYS[m]) { r -= MDAYS[m]; m++; }
  return { doy, m, d: r, year: Math.floor(n / 365) + 1 };
}
// [mes inicial, día inicial, mes final, día final] (mes de 0 a 11). arr = clientes, tip = propina extra, price = precio de todo, fav = platillos que se venden más caros (favMult)
const EVENTS = [
  { id: 'anio',   name: 'Año Nuevo',            r: [0, 1, 0, 3],   col: '#ffd23a', deco: 'fireworks', cols: ['#ffd23a', '#ff5fa2', '#5fe8ff', '#fff4e6'], arr: 1.15, tip: .06, fav: ['cerveza', 'oscura', 'michelada'], favMult: 1.25, desc: 'Brindis para empezar el año' },
  { id: 'reyes',  name: 'Día de Reyes',         r: [0, 5, 0, 7],   col: '#e0364a', deco: 'crown',     cols: ['#e0364a', '#ffc83d', '#8b5cf6', '#2fbf71'], arr: 1.10, tip: .05, fav: ['horchata', 'jamaica'], favMult: 1.3, desc: 'Rosca y aguas frescas' },
  { id: 'candel', name: 'Día de la Candelaria', r: [1, 1, 1, 3],   col: '#2fbf71', deco: 'candles',   cols: ['#2fbf71', '#fff4e6', '#ffc83d'], arr: 1.10, tip: 0, fav: ['pastor', 'suadero', 'gordita', 'cochinita'], favMult: 1.25, desc: 'Se come taquiza' },
  { id: 'amor',   name: 'Amor y Amistad',       r: [1, 13, 1, 15], col: '#ff5fa2', deco: 'hearts',    cols: ['#ff5fa2', '#e0364a', '#fff4e6'], arr: 1.20, tip: .10, fav: ['michelada', 'limonada'], favMult: 1.25, desc: 'Parejas y amigos' },
  { id: 'patrias', name: 'Fiestas Patrias',     r: [8, 14, 8, 16], col: '#2fbf71', deco: 'patria',    cols: ['#2fbf71', '#fff4e6', '#e0364a'], arr: 1.30, tip: .05, fav: ['pozole', 'tostada', 'pambazo', 'chilaquiles'], favMult: 1.3, desc: '¡Viva México!' },
  { id: 'brujas', name: 'Noche de Brujas',      r: [9, 27, 9, 30], col: '#ff8a3d', deco: 'pumpkin',   cols: ['#ff8a3d', '#8b5cf6', '#2b2540'], arr: 1.15, tip: 0, fav: ['oscura', 'cerveza'], favMult: 1.2, desc: 'Fiesta de disfraces' },
  { id: 'muertos', name: 'Día de Muertos',      r: [9, 31, 10, 2], col: '#ff9f1c', deco: 'muertos',   cols: ['#ff9f1c', '#ff5fa2', '#8b5cf6', '#fff4e6', '#2fbf71'], arr: 1.25, tip: .06, fav: ['pozole', 'tlacoyo', 'cochinita'], favMult: 1.3, desc: 'Ofrenda y banquete' },
  { id: 'buenfin', name: 'El Buen Fin',         r: [10, 15, 10, 18], col: '#ffd23a', deco: 'sale',    cols: ['#e0364a', '#ffd23a', '#fff4e6'], arr: 1.35, tip: 0, price: .9, fav: [], favMult: 1, desc: 'Ofertas: más gente, todo 10 % más barato' },
  { id: 'revol',  name: 'Día de la Revolución', r: [10, 19, 10, 21], col: '#e0364a', deco: 'patria',  cols: ['#2fbf71', '#fff4e6', '#e0364a'], arr: 1.15, tip: 0, fav: ['tlacoyo', 'sope', 'quesadilla'], favMult: 1.2, desc: 'Desfile y antojitos' },
  { id: 'virgen', name: 'Día de la Virgen',     r: [11, 11, 11, 13], col: '#17a2b0', deco: 'roses',   cols: ['#17a2b0', '#ff5fa2', '#fff4e6'], arr: 1.20, tip: .04, fav: ['elote', 'tostada', 'pambazo', 'tlacoyo', 'sope'], favMult: 1.25, desc: 'Antojitos en la romería' },
  { id: 'posadas', name: 'Posadas',             r: [11, 16, 11, 23], col: '#ff5a5a', deco: 'xmas',    cols: ['#e0364a', '#2fbf71', '#ffd23a', '#fff4e6'], arr: 1.30, tip: .06, fav: ['jamaica', 'horchata', 'cochinita', 'pozole'], favMult: 1.25, desc: 'Piñatas y ponche' },
  { id: 'navidad', name: 'Navidad',             r: [11, 24, 11, 26], col: '#2fbf71', deco: 'xmas',    cols: ['#e0364a', '#2fbf71', '#ffd23a', '#fff4e6'], arr: 1.15, tip: .12, fav: ['cecina', 'chilaquiles', 'cochinita'], favMult: 1.3, desc: 'Cena de gala' },
  { id: 'finanio', name: 'Fin de Año',          r: [11, 29, 11, 31], col: '#8b5cf6', deco: 'fireworks', cols: ['#8b5cf6', '#ffd23a', '#5fe8ff', '#ff5fa2'], arr: 1.30, tip: .05, fav: ['cerveza', 'michelada', 'oscura'], favMult: 1.25, desc: 'Despedida del año' }
];
EVENTS.forEach(e => { e.a = doyOf(e.r[0], e.r[1]); e.b = doyOf(e.r[2], e.r[3]); });
function eventFor(day) {                                           // fecha especial que toca algún día del calendario de este día de juego
  const doy = dateOf(day).doy;
  return EVENTS.find(e => e.a <= doy + CAL_STEP - 1 && e.b >= doy) || null;
}
const fmtDate = day => { const q = dateOf(day); return `${q.d} ${MON3[q.m]}`; };
const rangeText = e => e.r[0] === e.r[2] ? `${e.r[1]}–${e.r[3]} ${MON3[e.r[0]]}` : `${e.r[1]} ${MON3[e.r[0]]} – ${e.r[3]} ${MON3[e.r[2]]}`;
function eventEffect(e) {                                           // texto corto de lo que hace la fecha
  const p = [];
  p.push(`+${Math.round((e.arr - 1) * 100)} % clientes`);
  if (e.tip) p.push(`+${Math.round(e.tip * 100)} % propina`);
  if (e.price && e.price < 1) p.push(`precios -${Math.round((1 - e.price) * 100)} %`);
  if (e.fav && e.fav.length) p.push(`${e.fav.map(k => RECIPES[k].short).slice(0, 3).join(', ')}${e.fav.length > 3 ? '…' : ''} x${e.favMult}`);
  return p.join(' · ');
}
let CUR_EVENT = null;                                               // la fecha especial de hoy (la fija startDay)
const dishPrice = k => Math.round(RECIPES[k].price * (CUR_EVENT ? (CUR_EVENT.price || 1) * (CUR_EVENT.fav.includes(k) ? CUR_EVENT.favMult : 1) : 1) * 100) / 100;
const isFav = k => !!(CUR_EVENT && CUR_EVENT.fav.includes(k));
BUNTINGS.ev = { name: 'Fiesta', cols: ['#ffd23a', '#ff5fa2', '#5fe8ff', '#fff4e6'] };   // banderines de la fecha especial (los colores los pone el evento)

// ---------- Ventana del calendario ----------
const CALBOX = { x: 80, y: 74, w: 800, h: 470 };
const calChip = i => ({ x: CALBOX.x + 40 + i * 60, y: CALBOX.y + 54, w: 56, h: 28, label: MON3[i], size: 14 });
const calBtn = k => k === 'close' ? { x: CALBOX.x + CALBOX.w / 2 - 80, y: CALBOX.y + CALBOX.h - 52, w: 160, h: 38, label: 'CERRAR', size: 18, style: 'gold' }
  : k === 'prev' ? { x: CALBOX.x + 40, y: CALBOX.y + 96, w: 36, h: 30, label: '◀', size: 15, style: 'dark' } : { x: CALBOX.x + 40 + 404 - 36, y: CALBOX.y + 96, w: 36, h: 30, label: '▶', size: 15, style: 'dark' };
const CAL_GRID = { x: CALBOX.x + 40, y: CALBOX.y + 164, cw: 58, ch: 40, gap: 0 };
function openCal(w) { const q = dateOf(w.day); w.modal = 'cal'; w.panel = false; w.calM = q.m; sfx('click'); }
function calPointer(w, x, y) {
  const hit = b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
  if (hit(calBtn('close')) || !hit(CALBOX)) { w.modal = null; sfx('back'); return; }
  for (let i = 0; i < 12; i++) if (hit(calChip(i))) { w.calM = i; sfx('click'); return; }
  if (hit(calBtn('prev'))) { w.calM = (w.calM + 11) % 12; sfx('click'); return; }
  if (hit(calBtn('next'))) { w.calM = (w.calM + 1) % 12; sfx('click'); return; }
}
function calKey(w, e) {
  if (e.key === 'Escape' || e.key === 'Enter' || e.key === 'c' || e.key === 'C') { w.modal = null; sfx('back'); return true; }
  if (e.key === 'ArrowLeft') { w.calM = (w.calM + 11) % 12; sfx('click'); return true; }
  if (e.key === 'ArrowRight') { w.calM = (w.calM + 1) % 12; sfx('click'); return true; }
  return false;
}
function drawCalendar(c, w) {
  const B = CALBOX, q = dateOf(w.day), m = w.calM == null ? q.m : w.calM, ev = EVENTS.filter(e => e.r[0] === m || e.r[2] === m);
  c.fillStyle = 'rgba(12,11,15,.78)'; c.fillRect(-EX, -EY, CW, CH);
  drawPanel(c, B.x, B.y, B.w, B.h, 'CALENDARIO');
  txt(c, `AÑO ${q.year}`, B.x + B.w - 36, B.y + 36, { font: `700 18px ${FONT_UI}`, align: 'right', color: P.gold, ls: 1.5 });
  for (let i = 0; i < 12; i++) {                                    // los 12 meses: los que tienen fechas especiales llevan una estrella
    const b = calChip(i), cur = i === q.m, sel = i === m, hov = UI.hit(b); if (hov) UI.cursor = true;
    rr(c, b.x, b.y, b.w, b.h, 8); c.fillStyle = sel ? '#6a3fb0' : hov ? '#403c4c' : '#23212a'; c.fill(); c.lineWidth = cur ? 2.6 : 1.4; c.strokeStyle = cur ? P.gold : 'rgba(255,255,255,.28)'; c.stroke();
    txt(c, b.label, b.x + b.w / 2, b.y + b.h / 2 + 5, { font: `700 ${b.size}px ${FONT_UI}`, align: 'center', color: sel ? P.white : P.cream, ls: .5 });
    if (EVENTS.some(e => e.r[0] === i || e.r[2] === i)) { c.fillStyle = P.gold; star(c, b.x + b.w - 8, b.y + 8, 4, 1.8); c.fill(); }
  }
  // cuadrícula del mes (todas las celdas miden lo mismo; el número va centrado)
  const G = CAL_GRID, pb = calBtn('prev'), nb = calBtn('next'), gw = G.cw * 7;
  drawButton(c, pb); drawButton(c, nb);
  txt(c, `${MONTHS[m]}`, G.x + gw / 2, pb.y + 22, { font: `400 24px ${FONT_DISPLAY}`, align: 'center', color: P.gold, stroke: P.ink, sw: 4 });
  ['L', 'M', 'M', 'J', 'V', 'S', 'D'].forEach((d, i) => txt(c, d, G.x + i * G.cw + G.cw / 2, G.y - 8, { font: `700 13px ${FONT_UI}`, align: 'center', color: P.muted, ls: 1 }));
  const first = doyOf(m, 1), off = (first - 1) % 7, today0 = q.doy, today1 = q.doy + CAL_STEP - 1;
  for (let d = 1; d <= MDAYS[m]; d++) {
    const k = off + d - 1, cx = G.x + (k % 7) * G.cw, cy = G.y + Math.floor(k / 7) * G.ch, doy = first + d - 1;
    const e = EVENTS.find(v => v.a <= doy && v.b >= doy), isT = doy >= today0 && doy <= today1, isP = doy < today0;
    rr(c, cx + 2, cy + 2, G.cw - 4, G.ch - 4, 6); c.fillStyle = e ? e.col : '#1f1d25'; c.globalAlpha = e ? .42 : 1; c.fill(); c.globalAlpha = 1;
    c.lineWidth = isT ? 3 : e ? 1.8 : 1; c.strokeStyle = isT ? P.gold : e ? e.col : 'rgba(255,255,255,.14)'; c.stroke();
    txt(c, String(d), cx + G.cw / 2, cy + G.ch / 2 + 5, { font: `700 17px ${FONT_UI}`, align: 'center', color: isT ? P.gold : isP ? 'rgba(246,231,193,.45)' : P.cream });
    if (e) { c.fillStyle = e.col; c.beginPath(); c.arc(cx + G.cw - 9, cy + 9, 3, 0, 6.3); c.fill(); }
  }
  // fechas especiales del mes
  const rx = CALBOX.x + 40 + gw + 24, rw = CALBOX.x + CALBOX.w - 40 - rx;
  txt(c, 'FECHAS ESPECIALES', rx + rw / 2, CALBOX.y + 116, { font: `700 15px ${FONT_UI}`, align: 'center', color: P.gold, ls: 2 });
  if (!ev.length) txt(c, 'Sin fechas especiales este mes', rx + rw / 2, CALBOX.y + 190, { font: `600 16px ${FONT_UI}`, align: 'center', color: P.muted });
  ev.forEach((e, i) => {
    const y = CALBOX.y + 130 + i * 70, on = CUR_EVENT === e && m === q.m;
    rr(c, rx, y, rw, 62, 10); c.fillStyle = 'rgba(255,255,255,.06)'; c.fill(); c.lineWidth = on ? 2.4 : 1.4; c.strokeStyle = on ? P.gold : e.col; c.stroke();
    c.fillStyle = e.col; c.beginPath(); c.arc(rx + 16, y + 20, 7, 0, 6.3); c.fill(); c.lineWidth = 1.6; c.strokeStyle = P.ink; c.stroke();
    txt(c, e.name, rx + 32, y + 25, { font: `700 ${fitFont(c, e.name, rw - 44, 18, 700)}px ${FONT_UI}`, color: P.white });
    txt(c, rangeText(e), rx + rw - 12, y + 25, { font: `700 13px ${FONT_UI}`, align: 'right', color: e.col });
    const eff = eventEffect(e);
    txt(c, eff, rx + 12, y + 50, { font: `600 ${fitFont(c, eff, rw - 24, 13, 600)}px ${FONT_UI}`, color: P.cream });
  });
  // hoy y la próxima fecha especial
  const nx = nextEvent(w.day), line = CUR_EVENT ? `Hoy: ${fmtDate(w.day)} · ${CUR_EVENT.name}` : `Hoy: ${fmtDate(w.day)}`;
  txt(c, line, CALBOX.x + CALBOX.w / 2, CALBOX.y + CALBOX.h - 76, { font: `700 18px ${FONT_UI}`, align: 'center', color: CUR_EVENT ? CUR_EVENT.col : P.cream });
  if (nx) txt(c, `Próxima fecha especial: ${nx.e.name} (${nx.days <= 1 ? 'mañana' : 'en ' + nx.days + ' días de juego'})`, CALBOX.x + CALBOX.w / 2, CALBOX.y + CALBOX.h - 58 + 0, { font: `600 14px ${FONT_UI}`, align: 'center', color: P.muted });
  drawButton(c, calBtn('close'));
}
function nextEvent(day) {                                           // la siguiente fecha especial distinta de la de hoy (en días de juego)
  for (let k = 1; k <= 130; k++) { const e = eventFor(day + k); if (e && e !== CUR_EVENT) return { e, days: k }; }
  return null;
}

// ---------- Decoración de la fecha especial: banderines, adornos en la banqueta y fuegos artificiales ----------
function drawEventProp(c, deco, x, y, t) {
  const p = S(x, y); c.save(); c.lineJoin = 'round'; c.lineCap = 'round'; c.lineWidth = 2; c.strokeStyle = P.ink;
  c.fillStyle = 'rgba(0,0,0,.2)'; c.beginPath(); c.ellipse(p.x, p.y + 2, 15, 5, 0, 0, 6.3); c.fill();
  const balloon = (dx, dy, col) => { c.beginPath(); c.moveTo(p.x + dx * .3, p.y - 4); c.lineTo(p.x + dx + Math.sin(t * 2 + dx) * 2, p.y - 46 + dy); c.lineWidth = 1.2; c.stroke(); c.lineWidth = 2; c.fillStyle = col; c.beginPath(); c.ellipse(p.x + dx + Math.sin(t * 2 + dx) * 2, p.y - 56 + dy, 9, 11, 0, 0, 6.3); c.fill(); c.stroke(); };
  if (deco === 'pumpkin') {
    c.fillStyle = '#ff8a3d'; c.beginPath(); c.ellipse(p.x, p.y - 12, 15, 12, 0, 0, 6.3); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(p.x - 5, p.y - 22); c.quadraticCurveTo(p.x - 8, p.y - 12, p.x - 5, p.y - 2); c.moveTo(p.x + 5, p.y - 22); c.quadraticCurveTo(p.x + 8, p.y - 12, p.x + 5, p.y - 2); c.lineWidth = 1.2; c.stroke();
    c.fillStyle = '#5a8a2a'; c.fillRect(p.x - 2, p.y - 27, 4, 6);
    c.fillStyle = `rgba(255,236,120,${.8 + .2 * Math.sin(t * 6)})`; [[-6, -14], [6, -14]].forEach(([dx, dy]) => { c.beginPath(); c.moveTo(p.x + dx - 3, p.y + dy + 3); c.lineTo(p.x + dx + 3, p.y + dy + 3); c.lineTo(p.x + dx, p.y + dy - 3); c.closePath(); c.fill(); });
    c.beginPath(); c.moveTo(p.x - 7, p.y - 6); c.lineTo(p.x - 3, p.y - 8); c.lineTo(p.x, p.y - 6); c.lineTo(p.x + 3, p.y - 8); c.lineTo(p.x + 7, p.y - 6); c.fill();
  } else if (deco === 'hearts' || deco === 'roses') {
    balloon(-8, 0, deco === 'hearts' ? '#ff5fa2' : '#ffb3d1'); balloon(9, 6, deco === 'hearts' ? '#e0364a' : '#fff4e6');
  } else if (deco === 'muertos') {
    c.fillStyle = '#7a4a1e'; rr(c, p.x - 12, p.y - 10, 24, 12, 3); c.fill(); c.stroke();
    [[-8, -16, '#ff9f1c'], [0, -20, '#ffb347'], [8, -16, '#ff9f1c'], [-3, -14, '#ffc861'], [4, -14, '#ff8a1c']].forEach(([dx, dy, col]) => { c.fillStyle = col; c.beginPath(); c.arc(p.x + dx, p.y + dy, 5.2, 0, 6.3); c.fill(); c.lineWidth = 1.4; c.stroke(); });
    c.fillStyle = '#fff4e6'; c.beginPath(); c.arc(p.x, p.y - 36, 8, 0, 6.3); c.fill(); c.lineWidth = 1.6; c.stroke(); c.fillStyle = P.ink; [[-3, -37], [3, -37]].forEach(([dx, dy]) => { c.beginPath(); c.arc(p.x + dx, p.y + dy, 2, 0, 6.3); c.fill(); }); c.fillRect(p.x - 3, p.y - 31, 6, 1.5);
  } else if (deco === 'xmas') {
    c.fillStyle = '#7a4a1e'; c.fillRect(p.x - 3, p.y - 8, 6, 8);
    [[-13, -8, 13, -8, 0, -30], [-10, -24, 10, -24, 0, -44], [-7, -38, 7, -38, 0, -56]].forEach(([a, b, d, e2, f, g], i) => { c.fillStyle = i % 2 ? '#2fbf71' : '#27a862'; c.beginPath(); c.moveTo(p.x + a, p.y + b); c.lineTo(p.x + d, p.y + e2); c.lineTo(p.x + f, p.y + g); c.closePath(); c.fill(); c.stroke(); });
    const lc = ['#ff5a5a', '#ffd23a', '#5fe8ff', '#ff8afc']; [[-6, -14], [6, -20], [-3, -32], [4, -40], [0, -50]].forEach(([dx, dy], i) => { c.fillStyle = lc[i % 4]; c.globalAlpha = .55 + .45 * Math.sin(t * 5 + i * 1.7); c.beginPath(); c.arc(p.x + dx, p.y + dy, 2.3, 0, 6.3); c.fill(); }); c.globalAlpha = 1;
    c.fillStyle = '#ffd23a'; star(c, p.x, p.y - 58, 5, 2.2); c.fill(); c.stroke();
  } else if (deco === 'patria') {
    c.lineWidth = 3; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x, p.y - 60); c.stroke(); c.lineWidth = 2;
    const wv = Math.sin(t * 5) * 2; [['#2fbf71', 0], ['#fff4e6', 11], ['#e0364a', 22]].forEach(([col, dx]) => { c.fillStyle = col; c.beginPath(); c.moveTo(p.x + 1 + dx, p.y - 58 + wv * (dx / 22)); c.lineTo(p.x + 12 + dx, p.y - 58 - wv * (1 - dx / 22)); c.lineTo(p.x + 12 + dx, p.y - 38); c.lineTo(p.x + 1 + dx, p.y - 38); c.closePath(); c.fill(); });
    c.strokeRect(p.x + 1, p.y - 58, 33, 20);
  } else if (deco === 'sale') {
    c.fillStyle = '#e0364a'; rr(c, p.x - 22, p.y - 44, 44, 30, 5); c.fill(); c.stroke(); c.fillStyle = '#7a4a1e'; c.fillRect(p.x - 2, p.y - 14, 4, 14);
    txt(c, 'OFERTA', p.x, p.y - 33, { font: `400 ${fitDisplay(c, 'OFERTA', 38, 12)}px ${FONT_DISPLAY}`, align: 'center', color: '#fff3b0' });
    txt(c, '-10 %', p.x, p.y - 20, { font: `400 12px ${FONT_DISPLAY}`, align: 'center', color: '#ffd23a' });
  } else if (deco === 'crown') {
    c.fillStyle = '#ffc83d'; c.beginPath(); c.moveTo(p.x - 14, p.y - 6); c.lineTo(p.x - 14, p.y - 26); c.lineTo(p.x - 7, p.y - 17); c.lineTo(p.x, p.y - 30); c.lineTo(p.x + 7, p.y - 17); c.lineTo(p.x + 14, p.y - 26); c.lineTo(p.x + 14, p.y - 6); c.closePath(); c.fill(); c.stroke();
    ['#e0364a', '#2fbf71', '#5fd0ff'].forEach((col, i) => { c.fillStyle = col; c.beginPath(); c.arc(p.x - 8 + i * 8, p.y - 11, 2.4, 0, 6.3); c.fill(); });
  } else if (deco === 'candles') {
    [[-8, 22, '#fff4e6'], [0, 30, '#ffe9a8'], [8, 20, '#fff4e6']].forEach(([dx, h, col]) => { c.fillStyle = col; c.fillRect(p.x + dx - 3, p.y - h, 6, h); c.strokeRect(p.x + dx - 3, p.y - h, 6, h); c.fillStyle = `rgba(255,190,60,${.85 + .15 * Math.sin(t * 9 + dx)})`; c.beginPath(); c.ellipse(p.x + dx, p.y - h - 5, 3, 5.5, 0, 0, 6.3); c.fill(); });
  } else { balloon(-10, 0, '#ffd23a'); balloon(0, 8, '#ff5fa2'); balloon(10, 2, '#5fe8ff'); }      // fireworks / default: globos
  c.restore();
}
const EV_PROPS = [[3.6, -1.5], [7.4, -1.5], [2.2, -2.3]];
function drawEventSky(c, w) {                                         // fuegos artificiales sobre la calle al caer la noche (en la fecha especial que los trae)
  if (!w.event || !['fireworks', 'patria'].includes(w.event.deco)) return;
  const h = hourOf(w), a = clamp((h - 18.8) / 1.2, 0, 1); if (a <= 0) return;
  const cols = w.event.cols;
  c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
  for (let k = 0; k < 4; k++) {
    const per = 2.6 + k * .35, ph = ((w.t + k * 1.7) % per) / per, id = Math.floor((w.t + k * 1.7) / per);
    const bx = 90 + hash(id * 4 + k) * 780, by = HUD + 36 + hash(id * 4 + k + 50) * 110;
    if (ph < .12) { c.strokeStyle = 'rgba(255,230,160,.8)'; c.lineWidth = 2; c.beginPath(); c.moveTo(bx, by + 140 * (1 - ph / .12)); c.lineTo(bx, by + 140 * (1 - ph / .12) + 12); c.stroke(); continue; }
    const q = (ph - .12) / .88, r = 8 + 56 * (1 - Math.pow(1 - q, 2)), col = cols[(id + k) % cols.length];
    c.strokeStyle = col; c.globalAlpha = a * (1 - q) * .95; c.lineWidth = 2.4;
    for (let i = 0; i < 16; i++) { const an = i / 16 * 6.283, x0 = bx + Math.cos(an) * r * .72, y0 = by + Math.sin(an) * r * .72 + q * 18, x1 = bx + Math.cos(an) * r, y1 = by + Math.sin(an) * r + q * 22; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); }
  }
  c.restore();
}
const CLOCKBTN = { x: 586, y: 6, w: 98, h: 48 };                       // la hora del HUD abre el calendario
// ¿Cumple el local las condiciones para recibir a este VIP? (reputación de 2 máscaras o más y la mejora que pide)
const vipEligible = (w, def = VIPS.payaso) => def.need(w) && effRep(w) >= VIP_MIN_MASKS;
// Planea qué VIPs visitan hoy (cada uno llega a una hora al azar si se cumplen sus requisitos); sirve al abrir el día y al comprar una mejora
function planVips(w, fromHour) {
  Object.values(VIPS).forEach(def => {
    if (w.vips.some(v => v.k === def.key) || !vipEligible(w, def) || Math.random() >= Math.min(.95, def.chance * vipLuck(w))) return;
    const lo = Math.max(def.win[0], fromHour + .5);
    if (lo < def.win[1]) w.vips.push({ k: def.key, at: rand(lo, def.win[1]), done: false });
  });
}
function planGemmer(w) {                                          // ¿llega hoy alguien que regala gemas? Depende de las máscaras (con el tutorial en curso, no)
  if (w.level < GEM_LEVEL || w.tut || Math.random() >= gemChance(w)) return;
  const pool = Object.keys(GEMMERS).filter(k => (GEMMERS[k].minRep || 0) <= effRep(w) + 1e-6);
  const k = pick(pool);
  w.vips.push({ k, at: rand(10, 17), done: false });
  if (effRep(w) >= 3 && Math.random() < .3 + .08 * effRep(w)) {                       // con buena fama a veces vienen dos el mismo día
    const rest = pool.filter(q => q !== k); if (rest.length) w.vips.push({ k: pick(rest), at: rand(15, 21), done: false });
  }
}
function startDay(w, rs) {
  w.phase = 'play';
  w.dayLen = DAY_SEC;
  w.event = eventFor(w.day); CUR_EVENT = w.event; if (w.event) BUNTINGS.ev.cols = w.event.cols;
  w.dayTime = w.dayLen; w.closedWarned = false; w.edit = null; w.repTemp = 0;
  w.vips = []; if (!rs) { planVips(w, START_H); planGemmer(w); }
  w.furn.forEach(it => { if (it.type === 'table') { it.down = 0; it.downT = 0; } });
  w.dayServed = 0; w.dayEarned = 0; w.dayCost = 0; w.dayAngry = 0; w.perfect = false; w.loanT = 0;
  w.spawnT = 1.5; w.endT = 0; w.overT = 0; w.banner = w.event ? 3.4 : 2.6; w.panel = false;
  if (w.event && !rs && !w.tut) toast(w, `${w.event.name}: ${eventEffect(w.event)}`);
  w.clawCust = 0; w.clawBusy = 0; w.maskCust = 0;
  w.loc = 'rest'; w.inId = null; w.inn = null; w.hedit = null; w.fade = null; w.novato.away = false; if (w.town) { w.town.movies = 0; w.town.penalN = 0; w.town.sit = null; w.town.path = []; }
  w.customers = []; w.queue = []; w.cars = []; w.carT = rand(8, 16); w.coins = []; w.parts = [];
  if (!rs) allSlots(w).forEach(s => { s.state = 'empty'; s.dish = null; s.t = 0; });    // al cargar a media jornada, lo que estaba en el fuego sigue ahí
  SEATS.forEach(s => { s.customer = null; });
  const n = w.novato; n.carrying = null; handsReset(w); n.task = null; n.path = [];
  n.stamina = maxStamina(w); n.resting = false; n.furia = false; n.busy = false; n.overwork = 0; n.zeroWarned = false;   // amanece descansado
  w.bench = [null, null]; w.shop = false;
  const ns = nearestFree(2.5, 2.5); n.x = ns.x; n.y = ns.y;                  // cada mañana empiezan en una loseta libre
  w.staff.forEach((m, i) => { const ws = nearestFree(6.5 + i * .8, 1.5 + (i % 2)); Object.assign(m, { x: ws.x, y: ws.y, carrying: null, task: null, path: [], stamina: 100, resting: false, needsRest: false, entering: false, think: 1 + i * .3, stun: 0 }); });
  w.chefs.forEach((m, i) => { const sp = chefHome(i); Object.assign(m, { x: sp.x, y: sp.y, path: [], job: null, work: false, entering: false, think: 1 + i * .4 }); });
  w.chefSeen = {};
  w.guards.forEach(g => { const sp = guardSpot(GUARDS[g.id].spot); Object.assign(g, { x: sp.x, y: sp.y, path: [], moving: false, swing: 0, cd: 1.2 }); });
  w.pay = null;
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

/* Llegada de clientes (v1.7): cada asiento atiende ≈ a un cliente cada 36 s, así que el ritmo sigue a los lugares que tienes en las mesas con silla
   (2 mesas ≈ 1 cliente cada 12 s al principio; 6 mesas ≈ cada 4 s). Con los días se acerca al límite de lo que cabe, y en las fechas especiales llega más gente. */
const seatCount = () => Math.max(2, SEATS.filter(s => s.tb.chair).length);
const arrivalGap = w => (36 / seatCount()) / clamp(.75 + .04 * (w.day - 1), .75, 1.12) / (CUR_EVENT ? Math.pow(CUR_EVENT.arr, 1.5) : 1);
/* ---------- Experiencia, cansancio y modo rudo rabioso ---------- */
const maxStamina = (w, n = w.novato) => n.isWaiter ? 100 : STAM.base + STAM.perLevel * (w.level - 1);
function addXp(w, amt) {
  w.xp += amt;
  while (w.xp >= xpNeed(w.level)) {
    w.xp -= xpNeed(w.level); w.level++; w.levelFlash = 1.6;
    const n = w.novato; n.stamina = Math.min(maxStamina(w), n.stamina + 30); n.zeroWarned = false;     // sube el máximo y recupera un poco
    const unlocked = MENU.filter(k => RECIPES[k].level === w.level && w.level > 1).map(k => RECIPES[k].name);
    const hire = HIRE_IDS.filter(id => STAFF[id].level === w.level).map(id => STAFF[id].name).concat(GUARD_IDS.filter(id => GUARDS[id].level === w.level).map(id => GUARDS[id].name)).concat(CHEF_IDS.filter(id => CHEFS[id].level === w.level).map(id => CHEFS[id].name));
    const extra = hire.length ? ` ¡Ya puedes contratar: ${hire.join(' y ')}!` : unlocked.length ? ` Nuevo platillo: ${unlocked.join(' y ')}`
      : w.level === 2 ? ' ¡Ya puedes DECORAR el changarro desde la TIENDA!' : w.level === SPOIL_LEVEL ? ' ¡Ojo! La comida que sobra se echa a perder: compra el Refri de sobrantes' : w.level === 3 ? ' Nueva bebida: Agua de Horchata' : w.level === 13 ? ' ¡Ya puedes comprar la Máquina de garra!'
      : w.level === REMODEL.level ? ' ¡Ya puedes remodelar el changarro!' : w.level === ARENA.level ? ' ¡Ya puedes construir la Arena!' : '';
    toast(w, `¡Nivel ${w.level}!${extra}`); sfx('fanfare'); w.pendingLv.push(w.level);
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
const canMake = k => RECIPES[k].drink ? !!LAYOUT.fridge && !!shelfItem(k) : LAYOUT.comals.length > 0 && !!shelfItem(k) && (!RECIPES[k].needs || LAYOUT.comals.some(x => x.type === RECIPES[k].needs));
function makeOrder(w) {
  if (w.tut) return [{ key: 'pastor', done: false }];                                  // en el tutorial todos piden el taco que acabas de aprender a cocinar
  const menu = MENU.filter(k => RECIPES[k].level <= w.level && canMake(k));                       // solo piden lo que ya está desbloqueado y se puede cocinar
  if (!menu.length) return [{ key: 'pastor', done: false }];                                          // (sin barra donde exhibir: pide lo básico)
  const foods = menu.filter(k => !RECIPES[k].drink), drinks = menu.filter(k => RECIPES[k].drink);
  const main = drinks.length && (!foods.length || Math.random() < .16) ? pick(drinks) : pick(foods), items = [{ key: main, done: false }];
  if (!RECIPES[main].drink && drinks.length && Math.random() < .3) items.push({ key: pick(drinks), done: false });      // a veces piden una bebida para acompañar (cualquiera de las desbloqueadas)
  return items;
}
const slotsOf = (w, station) => station === 'fridge' ? w.dslots : w.slots;
const allSlots = w => w.slots.concat(w.dslots);
const pending = cu => cu.order.filter(i => !i.done);
const orderTotal = cu => Math.round(cu.order.reduce((s, i) => s + dishPrice(i.key), 0));
const stockTotal = w => MENU.reduce((s, k) => s + w.stock[k], 0);

/* ---------- Clientes: calle → banqueta → puerta → mesa → puerta → banqueta → desvanecer ---------- */
const effRep = w => Math.max(0, w.rep - w.repTemp);               // máscaras que se ven (la reputación menos el castigo temporal)
/* =========================================================
   ESTACIONAMIENTO Y COCHES (nivel 20)
   Se compra en la tienda y se coloca en modo EDITAR en el frente del local (hay pocos lugares válidos). Si el local se ensancha (remodelación) y el
   estacionamiento queda estorbando, se acomoda solo en otro lugar válido, sin costo. Si tú lo quieres mover, cuesta LOT_MOVE pesos.
   Llegan coches con 1 a 3 pasajeros cada 28 a 40 s (más en las horas pico): cada pasajero es un cliente normal (y si no hay mesa, hace fila afuera).
   Quien llega en coche deja un 40 % más de propina. Con 4 cajones nunca hay más de 4 coches al mismo tiempo.
   Economía: cuesta $6,000 y trae ~12 clientes extra al día (≈ +$230 de ganancia neta al día en el nivel 20): se paga en ~26 días de juego.
   ========================================================= */
// v1.5: cajones de 1.3 losetas, carril de 1.5 y fondo de 2.5 (los coches miden ≈ 2.2 x 1): 5.2 x 4 losetas en total (antes 4 x 3)
const PARKING_LEVEL = 20, PARKING_PRICE = 6000, LOT_MOVE = 450, LOT_W = 5.2, LOT_H = 4, LOT_LANE = 1.5, BAY_W = 1.3, CAR_X = -3.5;
const CAR_COLS = [['#e0364a', '#a92a3a'], ['#3b82f6', '#1f4a9c'], ['#ffd23a', '#c9a31a'], ['#2fbf71', '#1f8f52'], ['#f2f2f5', '#bcbcc8'], ['#8b5cf6', '#5b3aa6'], ['#ff8a3d', '#c46a22'], ['#2b2540', '#1a191e']];
function inWallBand(p) {                                            // ¿ese punto de la pantalla queda tapado por una de las dos paredes del local?
  const A = S(0, 0), B = S(COLS, 0), Cc = S(0, ROWS);
  for (const [P0, P1] of [[A, B], [A, Cc]]) {
    const lo = Math.min(P0.x, P1.x), hi = Math.max(P0.x, P1.x);
    if (p.x >= lo && p.x <= hi) { const t = (p.x - P0.x) / (P1.x - P0.x), by = P0.y + (P1.y - P0.y) * t; if (p.y <= by + 2 && p.y >= by - WALL_H - 2) return true; }
  }
  return false;
}
function lotCan(w, c, r) {                                          // null si el estacionamiento cabe con su esquina en (c, r)
  if (r < ROWS) return 'El estacionamiento va al frente del local: por ahí no pueden entrar los coches';
  const pts = []; for (let i = 0; i <= LOT_W; i += LOT_W / 2) for (let j = 0; j <= LOT_H; j += LOT_H / 2) pts.push(S(c + i, r + j));
  if (pts.some(p => p.x < -50 || p.x > W - 16 || p.y < HUD + 14 || p.y > H + 30)) return 'Ahí se saldría de la pantalla';
  if (pts.some(inWallBand)) return 'Ahí lo taparía el local';
  if ((w.outs || []).some(o => o.c >= c && o.c < c + LOT_W && o.r >= r && o.r < r + LOT_H)) return 'Ahí está un cartel o un farol';
  return null;
}
function bestLot(w, c0 = 3, r0 = 8) {                               // el lugar válido más cercano a (c0, r0)
  let best = null, bd = 1e9;
  for (let r = ROWS; r <= ROWS + 8; r++) for (let c = -8; c <= COLS + 6; c++) if (!lotCan(w, c, r)) { const d = Math.abs(c - c0) + Math.abs(r - r0); if (d < bd) { bd = d; best = { c, r }; } }
  return best;
}
function fixLot(w) {                                                // tras ensanchar el local, el estacionamiento se acomoda solo
  if (!w.lot || !lotCan(w, w.lot.c, w.lot.r)) return;
  const b = bestLot(w, w.lot.c, w.lot.r);
  if (b) { w.lot.c = b.c; w.lot.r = b.r; } else { w.inv.push(w.lot); w.lot = null; }
  clearCars(w);
}
const lotInfo = lot => ({ inY: lot.r + .42, outY: lot.r + 1.08, walkY: lot.r + 1.4, bayY: lot.r + LOT_LANE + 1.25, bx: k => lot.c + BAY_W * (k + .5) });
function clearCars(w) { (w.cars || []).forEach(cr => { cr.state = 'gone'; }); w.customers.forEach(cu => { if (cu.car) cu.car = null; }); w.cars = []; }
function carWalkBack(car) {                                         // de la banqueta de vuelta a su coche
  if (!car || car.state === 'gone' || !car.lot) return [];
  const I = lotInfo(car.lot);
  return [{ x: CAR_X, y: SIDE_Y }, { x: CAR_X, y: I.walkY }, { x: car.x, y: I.walkY }];
}
function spawnCar(w) {
  const lot = w.lot; if (!lot) return false;
  const used = new Set((w.cars || []).filter(cr => cr.state !== 'gone').map(cr => cr.bay)), free = [0, 1, 2, 3].filter(k => !used.has(k));
  if (!free.length) return false;
  const I = lotInfo(lot), bay = pick(free), r = Math.random(), party = r < .35 ? 1 : r < .75 ? 2 : 3;
  const car = { id: furnId++, lot, bay, col: Math.floor(Math.random() * CAR_COLS.length), model: pick(CAR_KEYS), x: -9.5, y: I.inY, o: 'x', fx: 1, fy: 0, state: 'in', speed: 3.6, moving: true, phase: 0, dir: 1,
    path: [{ x: I.bx(bay), y: I.inY }, { x: I.bx(bay), y: I.bayY }], party, pend: party, alive: 0, t: 0, tries: 0, brake: 0, hornT: 0 };
  w.cars.push(car); sfx('carArrive');
  return true;
}
function carPassengerDone(car, cu) { if (car && car.alive > 0) car.alive--; }
function updateCars(w, dt) {
  const lot = w.lot;
  if (lot && w.dayTime > 25 && w.open && !w.tut && w.phase === 'play') {                                     // llegan coches
    w.carT -= dt;
    if (w.carT <= 0) {
      const h = hourOf(w), rush = h >= 13 && h < 15.5 ? .75 : h >= 18 && h < 21 ? .8 : h < 9 || h >= 21.5 ? 1.5 : 1;
      w.carT = spawnCar(w) ? rand(28, 40) * rush / (CUR_EVENT ? CUR_EVENT.arr : 1) : 4;
    }
  }
  for (const car of w.cars) {
    const I = car.lot ? lotInfo(car.lot) : null;
    if (car.brake > 0) car.brake -= dt;
    if (car.state === 'in' || car.state === 'out') {
      const nx = car.path[0];
      if (nx) { const dx = nx.x - car.x, dy = nx.y - car.y; if (Math.abs(dx) > .02 || Math.abs(dy) > .02) { car.o = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y'; car.fx = car.o === 'x' ? Math.sign(dx) : 0; car.fy = car.o === 'y' ? Math.sign(dy) : 0; } }
      car.speed = car.state === 'in' ? (car.path.length === 1 && Math.hypot(car.path[0].x - car.x, car.path[0].y - car.y) < 1.5 ? 1.7 : 3.6) : 3.2;
      if (step(car, dt)) {
        if (car.state === 'in') { car.state = 'park'; car.t = 0; car.o = 'y'; car.fx = 0; car.fy = 1; car.brake = 1.2; sfx('door'); }
        else car.state = 'gone';
      }
    } else if (car.state === 'park') {                                                            // bajan los pasajeros uno por uno
      car.t += dt; if (w.dayTime <= 0 || !w.open) car.pend = 0;                                              // ya cerramos: los que faltaban por bajar se quedan en el coche
      if (car.pend > 0 && car.t >= .8) {
        car.t = 0;
        const src = { x: car.x, y: I.walkY, pre: [{ x: CAR_X, y: I.walkY }, { x: CAR_X, y: SIDE_Y }], car };
        if (spawnCustomer(w, null, null, src)) { car.pend--; car.alive++; car.tries = 0; }
        else if (++car.tries >= 4) { car.pend--; car.tries = 0; }                                 // no hay dónde sentarse ni hacer fila: ese pasajero se queda en el coche
      }
      if (car.pend <= 0 && car.alive <= 0) { car.idle = (car.idle || 0) + dt; if (car.idle > 1.3) { car.state = 'out'; car.speed = 3.2; car.brake = 0; car.path = [{ x: car.x, y: I.outY }, { x: -10.5, y: I.outY }]; sfx('carArrive'); } }
    }
  }
  w.cars = w.cars.filter(cr => cr.state !== 'gone');
}
/* Coches (v1.5): del tamaño de verdad frente a los personajes: ≈ 2 a 2.4 losetas de largo, 1 de ancho y casi tan altos como un luchador.
   Cuatro modelos (sedán, hatchback, pickup y van) con llantas, ventanas, faros, luces de freno y, de noche, los faros alumbran el piso. */
const CAR_MODELS = {
  sedan:  { L: 1.1,  W: .46, zh: 25, cz: 45, c0: -.5,  c1: .32 },
  hatch:  { L: .98,  W: .45, zh: 26, cz: 47, c0: -.74, c1: .5 },
  pickup: { L: 1.2,  W: .48, zh: 28, cz: 49, c0: -.02, c1: .62, bed: true },
  van:    { L: 1.15, W: .5,  zh: 54, cz: 54, van: true }
};
const CAR_KEYS = ['sedan', 'sedan', 'hatch', 'hatch', 'pickup', 'van'];
const nightK = w => clamp((hourOf(w) - 17.5) / 2.5, 0, 1);               // 0 de día, 1 ya de noche
function drawCar(c, car, w) {
  const M = CAR_MODELS[car.model] || CAR_MODELS.sedan, x = car.x, y = car.y, along = car.o === 'x', f = (along ? car.fx : car.fy) || 1;
  const L = M.L, Wd = M.W, base = CAR_COLS[car.col] || CAR_COLS[0], nk = nightK(w), ZB = 7, zh = M.zh;
  const dim = col => nk > 0 ? shade(col, -.22 * nk) : col;
  const body = { top: dim(base[0]), left: dim(shade(base[0], -.14)), right: dim(base[1]) };
  const roof = { top: dim(shade(base[0], .1)), left: dim(shade(base[0], -.12)), right: dim(shade(base[1], -.04)) };
  const dark = { top: '#2b2d36', left: '#1c1d24', right: '#14151b' };
  const Rc = (t0, t1, u0, u1) => {                                       // caja (t = a lo largo del coche, positivo hacia la nariz; u = de lado)
    const a = Math.min(f * t0, f * t1), b = Math.max(f * t0, f * t1);
    return along ? { x0: x + a, x1: x + b, y0: y + u0, y1: y + u1 } : { x0: x + u0, x1: x + u1, y0: y + a, y1: y + b };
  };
  const bx = (b, z0, z1, col, lw = 1.5) => isoBox(c, b.x0, b.y0, b.x1, b.y1, z0, z1, col, lw);
  const faceQ = (kind, v, a0, a1, z0, z1) => kind === 'y' ? [S(a0, v, z0), S(a1, v, z0), S(a1, v, z1), S(a0, v, z1)] : [S(v, a0, z0), S(v, a1, z0), S(v, a1, z1), S(v, a0, z1)];
  const sideK = along ? 'y' : 'x', endK = along ? 'x' : 'y';
  const glass = nk > .35 ? '#1d364d' : '#8ccbe8', glass2 = nk > .35 ? '#2a4d6c' : '#c9edfa';
  const pane = (pts) => { isoPoly(c, pts); c.fillStyle = glass; c.fill(); c.lineWidth = 1; c.strokeStyle = P.ink; c.stroke(); const m = pts[0], n = pts[1]; c.strokeStyle = glass2; c.lineWidth = 1.4; c.beginPath(); c.moveTo(m.x + (n.x - m.x) * .15, m.y + (n.y - m.y) * .15 - 3); c.lineTo(m.x + (n.x - m.x) * .45, m.y + (n.y - m.y) * .45 - 3); c.stroke(); };
  const all = Rc(-L, L, -Wd, Wd);
  groundQuad(c, all.x0 - .08, all.y0 - .08, all.x1 + .2, all.y1 + .2); c.fillStyle = 'rgba(0,0,0,' + (.3 - .1 * nk).toFixed(2) + ')'; c.fill();     // sombra
  // luz de los faros sobre el piso (de noche, mientras se mueve o recién llega)
  const lightsOn = nk > .12 && (car.state === 'in' || car.state === 'out' || (car.state === 'park' && car.t < 1.6));
  const nose = f * L, pn = (t, u) => along ? S(x + t, y + u, 0) : S(x + u, y + t, 0);
  if (lightsOn) {
    const a0 = pn(f * (L - .05), -Wd * .6), a1 = pn(f * (L - .05), Wd * .6), b0 = pn(f * (L + 2.6), -Wd * 1.7), b1 = pn(f * (L + 2.6), Wd * 1.7), mid = pn(f * (L + 2.4), 0);
    c.save(); c.globalCompositeOperation = 'lighter';
    const g = c.createLinearGradient(a0.x, a0.y, mid.x, mid.y); g.addColorStop(0, `rgba(255,240,170,${.42 * nk})`); g.addColorStop(1, 'rgba(255,240,170,0)');
    c.fillStyle = g; c.beginPath(); c.moveTo(a0.x, a0.y); c.lineTo(b0.x, b0.y); c.lineTo(b1.x, b1.y); c.lineTo(a1.x, a1.y); c.closePath(); c.fill(); c.restore();
  }
  // llantas de los dos lados que no se ven (apenas asoman por abajo) y carrocería
  if (M.van) {
    bx(all, ZB, zh, body, 1.6);
    bx(Rc(-L, L, -Wd, Wd), zh, zh + 1, roof, 1.2);
  } else if (M.bed) {                                                     // pickup: cabina al frente y caja abierta atrás
    bx(all, ZB, zh - 6, body);
    const bedB = Rc(-L, M.c0 * L, -Wd, Wd), rims = [Rc(-L, M.c0 * L, -Wd, -Wd + .1), Rc(-L, -L + .1, -Wd, Wd), Rc(-L, M.c0 * L, Wd - .1, Wd)];
    isoPoly(c, [S(bedB.x0, bedB.y0, zh - 5), S(bedB.x1, bedB.y0, zh - 5), S(bedB.x1, bedB.y1, zh - 5), S(bedB.x0, bedB.y1, zh - 5)]); c.fillStyle = '#2b2d36'; c.fill(); c.lineWidth = 1; c.strokeStyle = P.ink; c.stroke();
    rims.sort((p, q) => (p.x0 + p.x1 + p.y0 + p.y1) - (q.x0 + q.x1 + q.y0 + q.y1)).forEach(rm => bx(rm, zh - 6, zh, body, 1.2));
    const cabB = Rc(M.c0 * L, M.c1 * L + .12, -Wd, Wd); bx(cabB, zh - 6, zh + 2, body);
  } else {
    bx(all, ZB, zh - 4, body);                                            // capó, cajuela y costados
    bx(Rc(M.c0 * L - .12, M.c1 * L + .12, -Wd, Wd), zh - 4, zh, body);     // base de la cabina
  }
  // llantas del lado que se ve
  const wheel = tc => {
    const rt = .25, rz = 10.5, zc = 10.5, v = (dd, zz) => along ? S(x + f * tc + dd, y + Wd + .01, zz) : S(x + Wd + .01, y + f * tc + dd, zz);
    for (const [k, col] of [[1, '#15141a'], [.56, '#b4bac8']]) {
      const pts = []; for (let a = 0; a < 6.3; a += .55) pts.push(v(Math.cos(a) * rt * k, zc + Math.sin(a) * rz * k));
      isoPoly(c, pts); c.fillStyle = col; c.fill(); c.lineWidth = k === 1 ? 1.6 : 1; c.strokeStyle = P.ink; c.stroke();
    }
  };
  wheel(L * .6); wheel(-L * .6);
  // cabina y ventanas
  if (M.van) {
    const sp0 = along ? all.x0 : all.y0, sp1 = along ? all.x1 : all.y1, sv = along ? all.y1 : all.x1, ev = along ? all.x1 : all.y1;
    [[.05, .3], [.36, .62], [.68, .94]].forEach(([a, b]) => pane(faceQ(sideK, sv, sp0 + (sp1 - sp0) * a, sp0 + (sp1 - sp0) * b, 33, 46)));
    const u0 = (along ? all.y0 : all.x0) + .07, u1 = (along ? all.y1 : all.x1) - .07; pane(faceQ(endK, ev, u0, u1, 31, 47));
  } else {
    const cb = M.bed ? Rc(M.c0 * L, M.c1 * L, -Wd * .9, Wd * .9) : Rc(M.c0 * L, M.c1 * L, -Wd * .88, Wd * .88), z0 = M.bed ? zh + 2 : zh, z1 = M.cz;
    bx(cb, z0, z1, roof);
    const sp0 = along ? cb.x0 : cb.y0, sp1 = along ? cb.x1 : cb.y1, sv = along ? cb.y1 : cb.x1, ev = along ? cb.x1 : cb.y1, sl = sp1 - sp0;
    [[.07, .47], [.55, .93]].forEach(([a, b]) => pane(faceQ(sideK, sv, sp0 + sl * a, sp0 + sl * b, z0 + 3, z1 - 3)));
    const u0 = (along ? cb.y0 : cb.x0) + .07, u1 = (along ? cb.y1 : cb.x1) - .07; pane(faceQ(endK, ev, u0, u1, z0 + 3, z1 - 3.5));
  }
  // frente / cola (la cara de ese extremo que se ve es la de coordenada mayor)
  const evv = along ? all.x1 : all.y1, isNose = f > 0, braking = car.brake > 0 || car.state === 'park';
  const lamp = (u, col) => { const a = (along ? y : x) + u * Wd - .09, b = (along ? y : x) + u * Wd + .09; isoPoly(c, faceQ(endK, evv, a, b, 14, 19.5)); c.fillStyle = col; c.fill(); c.lineWidth = 1; c.strokeStyle = P.ink; c.stroke(); };
  isoPoly(c, faceQ(endK, evv, (along ? y : x) - Wd + .02, (along ? y : x) + Wd - .02, ZB, 12.5)); c.fillStyle = '#2a2c35'; c.fill(); c.lineWidth = 1; c.strokeStyle = P.ink; c.stroke();     // defensa
  if (isNose) { const hl = lightsOn || nk > .5 ? '#fff6c0' : '#fffdf0'; lamp(-.62, hl); lamp(.62, hl); }
  else { const tl = braking ? '#ff3a3a' : '#b01822'; lamp(-.62, tl); lamp(.62, tl); }
  // brillo de los faros y de las luces de freno
  const glow = (t, u, col, r, a) => { const p = along ? S(x + t, y + u, 16) : S(x + u, y + t, 16); c.save(); c.globalCompositeOperation = 'lighter'; const g = c.createRadialGradient(p.x, p.y, 1, p.x, p.y, r); g.addColorStop(0, col.replace('A', a)); g.addColorStop(1, col.replace('A', 0)); c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, r, 0, 6.3); c.fill(); c.restore(); };
  if (isNose && lightsOn) { glow(nose, -Wd * .62, 'rgba(255,240,170,A)', 22, .55 * nk); glow(nose, Wd * .62, 'rgba(255,240,170,A)', 22, .55 * nk); }
  if (braking && nk > .05) { glow(-nose, -Wd * .62, 'rgba(255,50,50,A)', 18, .5 * nk); glow(-nose, Wd * .62, 'rgba(255,50,50,A)', 18, .5 * nk); }
}
function drawLotGround(c, lot, alpha, w) {                           // asfalto, carriles, líneas, topes y letrero
  const I = lotInfo(lot), a = lot.c, b = lot.r, N = 4;
  c.save(); c.globalAlpha = alpha == null ? 1 : alpha;
  groundQuad(c, -24, b, a + LOT_W, b + LOT_LANE); c.fillStyle = '#4a4c5c'; c.fill();                 // calle de acceso (viene de la izquierda): dos carriles
  groundQuad(c, a, b + LOT_LANE, a + LOT_W, b + LOT_H); c.fillStyle = '#54566a'; c.fill();           // cajones
  groundQuad(c, -24, b - .14, a + LOT_W, b); c.fillStyle = '#8d8779'; c.fill();                      // bordillo
  groundQuad(c, -24, b + LOT_LANE, a, b + LOT_LANE + .14); c.fillStyle = '#8d8779'; c.fill();
  c.fillStyle = '#f2d45c'; for (let x = -24; x < a + LOT_W; x += 1.6) { groundQuad(c, x, b + LOT_LANE / 2 - .03, x + .8, b + LOT_LANE / 2 + .03); c.fill(); }     // raya central
  c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 2; c.beginPath();
  for (let k = 0; k <= N; k++) { const p = S(a + k * BAY_W, b + LOT_LANE), q = S(a + k * BAY_W, b + LOT_H); c.moveTo(p.x, p.y); c.lineTo(q.x, q.y); }
  const p0 = S(a, b + LOT_H), p1 = S(a + LOT_W, b + LOT_H); c.moveTo(p0.x, p0.y); c.lineTo(p1.x, p1.y); c.stroke();
  c.fillStyle = '#9a9aa8'; for (let k = 0; k < N; k++) { groundQuad(c, a + k * BAY_W + .38, b + LOT_H - .3, a + k * BAY_W + .92, b + LOT_H - .18); c.fill(); }      // topes
  c.restore();
}
function drawLotSign(c, lot, w) {                                    // letrero azul con la P
  const p = S(lot.c + LOT_W + .15, lot.r + LOT_LANE * .9);
  c.save(); c.lineJoin = 'round'; c.lineWidth = 2; c.strokeStyle = P.ink;
  c.fillStyle = 'rgba(0,0,0,.2)'; c.beginPath(); c.ellipse(p.x, p.y + 2, 9, 3.5, 0, 0, 6.3); c.fill();
  c.fillStyle = '#6b7080'; c.fillRect(p.x - 1.5, p.y - 42, 3, 44); c.strokeRect(p.x - 1.5, p.y - 42, 3, 44);
  c.fillStyle = '#2f6fd0'; rr(c, p.x - 11, p.y - 62, 22, 22, 4); c.fill(); c.stroke();
  txt(c, 'P', p.x, p.y - 45, { font: `700 18px ${FONT_UI}`, align: 'center', color: '#fff' });
  c.restore();
}
/* ---------- Clientes en la máquina de garra ----------
   Al terminar de comer, algunos se acercan a la garra antes de irse (si ya la tienes colocada): normales ~14 %, en coche ~22 %, VIP ~55 %, los que regalan gemas ~70 %.
   Máximo CLAW_CUST_MAX jugadores por día. Cada uno deja una moneda de ≈ 22 % de lo que cuesta una jugada normal (ya descontados los premios que se llevan):
   VIP x2, visitantes de gemas x1.5 (y 0 a 2 gemas según quién sea). Así la máquina deja ≈ $200 al día en el nivel 20, nunca más del 15 % de las ventas. */
const CLAW_CUST_MAX = 4;
const CLAW_CUST_GEMS = { coleccionista: [1, 1], campeon: [0, 1], joyero: [1, 1], cronista: [0, 0], reina: [1, 2] };
function clawTrip(w, cu, seat) {
  const it = LAYOUT.claw;
  if (!it || w.level < CLAW_LEVEL || w.tut || w.clawCust >= CLAW_CUST_MAX || w.dayTime <= 20 || w.customers.some(q => q.state === 'claw')) return false;
  if (Math.random() >= (cu.vip ? .55 : cu.gd ? .7 : cu.car ? .22 : .14)) return false;
  const goals = neighborCells(it); if (!goals.length) return false;
  const cells = Grid.path({ c: seat.c, r: seat.r }, goals); if (!cells) return false;
  const mult = cu.vip ? 2 : cu.gd ? 1.5 : 1, gr = cu.gd ? (CLAW_CUST_GEMS[cu.gd.key] || [0, 0]) : [0, 0];
  cu.state = 'claw'; cu.moving = true; cu.speed = 1.9; cu.angry = false; cu.path = cells.map(n => Grid.pt(n.c, n.r));
  cu.cl = { ph: 0, t: 0, paid: false, v: Math.max(5, Math.round(clawCost(w, 0) * .22 * mult / 5) * 5), gems: Math.round(rand(gr[0], gr[1])), win: Math.random() < .35, plush: pick(['bear', 'frog', 'blob', 'luchador']) };
  w.clawCust++;
  return true;
}
function sendFromClaw(w, cu) {                                       // ya jugó: se va por la puerta
  const cells = Grid.path(Grid.cell(cu.x, cu.y), DOOR.cells) || [];
  cu.state = 'leave'; cu.moving = true; cu.speed = 1.9; cu.cl = null; cu.path = cells.map(n => Grid.pt(n.c, n.r)).concat(exitTail(cu));
}
function updateClawCust(w, cu, dt) {
  if (cu.cl && cu.cl.kind === 'mask') { updateMaskCust(w, cu, dt); return; }
  const K = cu.cl, it = LAYOUT.claw;
  if (!K || !it) { sendFromClaw(w, cu); return; }
  if (K.ph === 0) {
    if (step(cu, dt)) {                                              // llegó: se pone frente a la máquina y juega
      K.ph = 1; K.t = 0; cu.moving = false;
      const m = S(it.c + .5, it.r + .5), me = actorPos(cu); cu.dir = m.x >= me.x ? 1 : -1;
      sfx('arcadeCoin'); w.clawBusy = 3.8;
      addPart(w, { type: 'text', text: '¡A jugar!', x: me.x, y: me.y - 92, vy: -26, life: 1.4, color: '#ffe27a' });
    }
  } else {
    K.t += dt; w.clawBusy = Math.max(w.clawBusy, .6);
    const m = S(it.c + .5, it.r + .5, 70);
    if (Math.random() < dt * 9) addPart(w, { type: 'spark', x: m.x + rand(-16, 16), y: m.y + rand(-22, 10), vx: rand(-30, 30), vy: -rand(10, 50), life: .6 });
    if (K.t > 3 && !K.paid) {                                        // el resultado: la moneda sale de la máquina
      K.paid = true; const p = S(it.c + .5, it.r + 1.25);
      w.coins.push({ x: p.x, y: p.y + 4, v: K.v, t: 0, vip: false, xp: 0, gems: K.gems });
      sfx(K.win ? 'clawWin' : 'clawFail');
      addPart(w, { type: 'text', text: K.win ? '¡GANÓ UN PELUCHE!' : '¡Casi!', x: p.x, y: p.y - 70, vy: -24, life: 1.5, color: K.win ? '#9af0b8' : '#ffd0d0' });
    }
    if (K.t > 4.1) sendFromClaw(w, cu);
  }
}
function drawClawCust(c, cu, w) {                                    // el peluche (o la máscara) que se lleva, sobre su cabeza
  const K = cu.cl;
  if (K && K.kind === 'mask') { if (K.ph === 1 && K.t > 1.2) { const p = actorPos(cu); drawMask(c, p.x + 16 * (cu.dir || 1), p.y - 52 - Math.sin(w.t * 6) * 2, 8.5, MASKS[K.mk] || MASKS.ring); } return; }
  if (!K || K.ph !== 1 || !K.win || K.t < 3) return;
  const p = actorPos(cu); drawPlush(c, K.plush, p.x + 18 * (cu.dir || 1), p.y - 40 - Math.min(10, (K.t - 3) * 14), .62, Math.sin(w.t * 6) * .12, 1);
}
/* =========================================================
   SUBIDA DE NIVEL: ventana con animación de todo lo que se desbloquea en ese nivel
   Se arma sola con los datos del juego (recetas, mesas, sillas, decoración, ropa y funciones), así que cada nivel muestra lo suyo.
   Si en ese nivel no se desbloquea nada, se muestra la energía nueva y lo próximo que viene.
   ========================================================= */
const CARD_TAG = { dish: ['PLATILLO', '#ff8a3d'], drink: ['BEBIDA', '#5fd0ff'], furn: ['MUEBLE', '#2fbf71'], feat: ['NUEVO', '#ffc83d'], deco: ['DECORACIÓN', '#ff5fa2'], look: ['LOOK', '#b57cff'], staff: ['PERSONAL', '#17a2b0'], move: ['TÉCNICA', '#ff5fa2'], rival: ['RIVAL', '#e0364a'] };
function unlocksFor(L) {
  const out = [];
  if (L <= 1) return out;
  MENU.filter(k => RECIPES[k].level === L).forEach(k => {
    const r = RECIPES[k];
    out.push({ kind: r.drink ? 'drink' : 'dish', key: k, name: r.name, desc: `${r.drink ? 'Se prepara en el refri' : r.needs ? 'Se cocina en la parrilla' : 'Se cocina en el comal'}: cuesta ${pesos(r.cost)}, rinde ${r.yield} y se vende a ${pesos(r.price)} c/u` });
  });
  Object.keys(TABLES).forEach(k => { const T = TABLES[k]; if (!T.gems && T.level === L) out.push({ kind: 'furn', icon: k === 'mantel' ? 'table' : 'table_' + k, name: T.name, desc: T.desc }); });
  Object.keys(CHAIRS).forEach(k => { const C = CHAIRS[k]; if (!C.gems && C.level === L) out.push({ kind: 'furn', icon: 'chairs_' + k, name: C.name, desc: C.desc + ' (sillas de 2 en 2, en la tienda)' }); });
  const feat = (lv, name, desc, icon, kind = 'feat') => { if (lv === L) out.push({ kind, icon, name, desc }); };
  feat(2, 'Decorar el changarro', 'Pinta las paredes, cambia el piso y cuelga banderas y pósters desde la TIENDA', 'remodel');
  feat(GEM_LEVEL, 'Visitantes con gemas', 'Algunos días llega alguien que deja gemas: sirven para piezas exclusivas', 'gem');
  feat(BAR2_LEVEL, 'Barra de antojitos', 'Exhibe elotes, tostadas, pambazos y más antojitos mexicanos', 'bar2', 'furn');
  feat(SPOIL_LEVEL, '¡Ojo con las sobras!', `Desde hoy la comida que sobra al cerrar se echa a perder: el Refri de sobrantes guarda hasta ${STORAGE_CAP}`, 'storage', 'furn');
  feat(CARTEL_LEVEL, 'Cartel de tacos', 'Pon tu nombre con lucecitas afuera: brilla de noche y atrae clientes', 'cartel', 'furn');
  feat(CLAW_LEVEL, 'Máquina de garra', 'Juega por monedas, gemas, ropa y máscaras; a veces tus clientes también juegan', 'garra', 'furn');
  feat(REMODEL.level, 'Remodelar el changarro', 'El local se ensancha para tener más lugar para mesas', 'remodel');
  CLAW_TIERS.forEach((T, i) => { if (i && T.level === L) feat(L, 'Garra ' + T.name, 'Un precio más alto con mejores premios, más gemas y más ropa exclusiva', 'garra'); });
  feat(PARKING_LEVEL, 'Estacionamiento', 'Llegan coches con clientes: se compra en TIENDA › OBRAS y se coloca en el frente del local', 'parking', 'furn');
  HIRE_IDS.forEach(id => { if (STAFF[id].level === L) out.push({ kind: 'staff', icon: id, name: STAFF[id].name, desc: STAFF[id].desc + ' · ' + pesos(STAFF[id].price) }); });
  CHEF_IDS.forEach(id => { if (CHEFS[id].level === L) out.push({ kind: 'staff', icon: id, name: CHEFS[id].name, desc: CHEFS[id].desc.split(' · ')[0] + ' · ' + pesos(CHEFS[id].price) }); });
  GUARD_IDS.forEach(id => { if (GUARDS[id].level === L) out.push({ kind: 'staff', icon: id, name: GUARDS[id].name, desc: GUARDS[id].desc.split(' · ')[0] + ' · ' + pesos(GUARDS[id].price) }); });
  feat(MOVES_LEVEL, 'Técnicas de lucha', 'Aprende llaves y vuelos en la TIENDA › TÉCNICAS: sirven para atacar a los restaurantes rivales', 'mv_punetazo', 'move');
  MOVE_BUY.forEach(k => { const M = MOVES[k]; if (M.level === L && L !== MOVES_LEVEL) out.push({ kind: 'move', icon: 'mv_' + k, name: M.name, desc: M.desc + '. Daño ' + M.dmg + ', gasta ' + M.cost + ' de energía' }); });
  feat(EXPANDS[2].level, 'Ampliación II del local', 'El local se ensancha a 13 losetas: caben 2 mesas y 1 comal más. TIENDA › OBRAS', 'ext2');
  feat(EXPANDS[3].level, 'Ampliación III del local', 'El local se ensancha a 15 losetas: 2 mesas y 1 comal más. TIENDA › OBRAS', 'ext3');
  feat(TOWN_LEVEL, 'El pueblo', 'Pulsa PUEBLO (a la izquierda): cine, boutique, tienda de muebles, parque, canchas de fútbol y casas en venta', 'pueblo');
  Object.keys(HOUSES).forEach(id => { if (HOUSES[id].level === L) out.push({ kind: 'feat', icon: 'casa', name: HOUSES[id].name, desc: `Ya puedes comprar esta casa en el pueblo por ${pesos(HOUSES[id].price)}: ponle muebles y píntala` }); });
  feat(MASK_LEVEL, 'Vitrina de máscaras', 'Tus clientes compran máscaras al salir: te dejan monedas y a veces gemas. TIENDA › MUEBLES', 'vitrinam', 'furn');
  feat(PARRILLA_LEVEL, 'Parrilla de carne asada', 'Ocho lugares para asar a la vez, con tacos de carne asada: se compra en la TIENDA', 'parrilla', 'furn');
  feat(MAP_LEVEL, 'Mapa de rivales', 'Toca el botón del mapa (o la tecla M): ataca restaurantes rivales para robar estrellas, dinero y meseros', 'mapa');
  RIVALS.forEach(r => { if (r.level === L) out.push({ kind: 'rival', icon: 'rv_' + r.id, name: r.name, desc: r.sub + '. Ya puedes retarlo desde el MAPA si tienes sus técnicas' }); });
  feat(FAROL_TIERS[0].level, 'Faroles de calle', 'Compra faroles en TIENDA › OBRAS y plántalos en la calle: de noche alumbran el piso de verdad', 'farol');
  feat(FAROL_TIERS[3].level, 'Más faroles', 'Ya puedes poner más faroles en la calle (hasta ' + FAROL_MAX + ')', 'farol');
  HANDS.forEach((d, k) => { if (k && d.level === L) out.push({ kind: 'feat', icon: 'hand' + (k + 1), name: HAND_NAMES[k], desc: `Otro cuadro de carga abajo: lleva más pedidos a la vez. Se compra en TIENDA › OBRAS por ${pesos(d.price)}` }); });
  INV_TIERS.forEach(t => { if (t.level === L) out.push({ kind: 'furn', icon: 'inv', name: 'Cajita más grande', desc: `Ya puedes ampliar el inventario a ${t.cap} lugares (${pesos(t.price)})` }); });
  feat(ARENA.level, 'Mega Ampliación: Arena', 'Cuadrilátero central, hasta 6 mesas y 3 comales. Llegan VIPs nuevos', 'arena');
  const deco = [];                                                  // decoración: todo junto en una sola tarjeta
  Object.keys(PAINT_INFO).forEach(k => { if (PAINT_INFO[k][1] === L) deco.push('Pared ' + PAINTS[k][3]); });
  Object.keys(AWNING_INFO).forEach(k => { if (k && AWNING_INFO[k][1] === L) deco.push('Lona ' + AWNINGS[k].name); });
  Object.keys(FLOORS).forEach(k => { if (!FLOORS[k].gems && FLOORS[k].level === L) deco.push(FLOORS[k].name); });
  Object.keys(BUNTINGS).forEach(k => { if (!BUNTINGS[k].gems && BUNTINGS[k].level === L && k !== 'none' && k !== 'ev') deco.push(BUNTINGS[k].name); });
  Object.keys(WALLDECO).forEach(k => { if (!WALLDECO[k].gems && WALLDECO[k].level === L) deco.push(WALLDECO[k].name); });
  Object.keys(DECOR_FURN).forEach(k => { if (!DECOR_FURN[k].gems && DECOR_FURN[k].level === L) deco.push(FURN[k].name); });
  if (deco.length) out.push({ kind: 'deco', name: 'Decoración nueva', desc: deco.slice(0, 4).join(', ') + (deco.length > 4 ? ` y ${deco.length - 4} más` : '') + '. Todo en la TIENDA › DECORAR', items: deco });
  const looks = [];
  Object.keys(LOOK_OPTS).forEach(cat => LOOK_OPTS[cat].forEach(o => { if (!o.claw && !o.gems && o.level === L && o.price) looks.push({ cat, o }); }));
  if (looks.length) out.push({ kind: 'look', name: 'Look nuevo', desc: looks.slice(0, 3).map(q => q.o.name).join(', ') + (looks.length > 3 ? ` y ${looks.length - 3} más` : '') + '. Estréna lo en LUCHADOR', looks });
  return out;
}
function nextUnlock(L) { for (let q = L + 1; q <= L + 60; q++) { const u = unlocksFor(q); if (u.length) return { level: q, name: u[0].name }; } return null; }
function openLevelUp(w) {
  const L = w.pendingLv.shift();
  w.modal = 'lvl'; w.panel = false; w.lv = { level: L, items: unlocksFor(L), page: 0, t: 0, snd: {} };
  sfx('fanfare');
}
const LV = { x: 120, y: 66, w: 720, h: 468, per: 3, cw: 212, ch: 262 };
const lvBtn = k => k === 'ok' ? { x: LV.x + LV.w / 2 - 105, y: LV.y + LV.h - 58, w: 210, h: 46, label: 'CONTINUAR', size: 22, style: 'green' }
  : k === 'prev' ? { x: LV.x + 34, y: LV.y + LV.h - 54, w: 44, h: 38, label: '◀', size: 18, style: 'dark' } : { x: LV.x + LV.w - 78, y: LV.y + LV.h - 54, w: 44, h: 38, label: '▶', size: 18, style: 'dark' };
const lvPages = w => Math.max(1, Math.ceil(w.lv.items.length / LV.per));
function lvClose(w) { w.modal = null; w.lv = null; sfx('back'); }
function lvPointer(w, x, y) {
  const hit = b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h, pg = lvPages(w);
  if (w.lv.t < .5) return;
  if (pg > 1 && hit(lvBtn('prev'))) { w.lv.page = (w.lv.page + pg - 1) % pg; w.lv.pt = 0; sfx('click'); return; }
  if (pg > 1 && hit(lvBtn('next'))) { w.lv.page = (w.lv.page + 1) % pg; w.lv.pt = 0; sfx('click'); return; }
  if (hit(lvBtn('ok'))) lvClose(w);
}
function lvKey(w, e) {
  const pg = lvPages(w);
  if (e.key === 'ArrowLeft' && pg > 1) { w.lv.page = (w.lv.page + pg - 1) % pg; w.lv.pt = 0; sfx('click'); return true; }
  if (e.key === 'ArrowRight' && pg > 1) { w.lv.page = (w.lv.page + 1) % pg; w.lv.pt = 0; sfx('click'); return true; }
  if (w.lv.t > .5 && (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape')) { lvClose(w); return true; }
  return false;
}
function updateLevelUp(w, dt) {
  const V = w.lv; if (!V) return;
  V.t += dt; V.pt = (V.pt || 0) + dt; w.t += dt;
  const st = V.page * LV.per, n = Math.min(LV.per, V.items.length - st);
  for (let i = 0; i < n; i++) { const at = .35 + i * .28 + (V.page ? 0 : .3), k = V.page + ':' + i; if (V.pt >= at - (V.page ? .3 : 0) && !V.snd[k]) { V.snd[k] = 1; sfx(V.items[st + i].kind === 'dish' || V.items[st + i].kind === 'drink' ? 'ready' : 'ding'); } }
}
// ---------- dibujo de cada tarjeta ----------
function drawUnlockArt(c, it, cx, cy, t, w) {
  const bob = Math.sin(t * 2.6) * 3;
  c.save();
  if (it.kind === 'dish' || it.kind === 'drink') {
    const g = c.createRadialGradient(cx, cy, 6, cx, cy, 62); g.addColorStop(0, it.kind === 'dish' ? 'rgba(255,170,70,.45)' : 'rgba(95,208,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.beginPath(); c.arc(cx, cy, 62, 0, 6.3); c.fill();
    c.fillStyle = P.ink; c.beginPath(); c.arc(cx, cy + bob, 40, 0, 6.3); c.fill(); c.lineWidth = 3; c.strokeStyle = P.gold; c.stroke();
    drawDish(c, it.key, cx, cy + bob, 25 + Math.sin(t * 5) * 1.2);
    for (let k = 0; k < 4; k++) {                                   // vapor (comida) o burbujas de frío (bebida)
      const ph = (t * .7 + k * .25) % 1, x = cx - 24 + k * 16 + Math.sin(t * 3 + k) * 4, y = cy - 40 - ph * 36;
      c.globalAlpha = Math.sin(ph * Math.PI) * .7;
      if (it.kind === 'dish') { c.strokeStyle = '#fff'; c.lineWidth = 3; c.lineCap = 'round'; c.beginPath(); c.moveTo(x, y + 8); c.quadraticCurveTo(x + 6, y, x, y - 8); c.stroke(); }
      else { c.fillStyle = '#bfeaff'; c.beginPath(); c.arc(x, y, 3 + (k % 2) * 1.4, 0, 6.3); c.fill(); }
    }
    c.globalAlpha = 1;
  } else if (it.kind === 'deco') {
    const pal = it.items.length ? [P.red, P.teal, P.gold, P.green, '#ff5fa2'] : [];
    for (let k = 0; k < 5; k++) { const a = t * 1.2 + k * 1.256, x = cx + Math.cos(a) * 36, y = cy + Math.sin(a) * 22 + bob * .5; c.fillStyle = pal[k]; c.strokeStyle = P.ink; c.lineWidth = 2.4; rr(c, x - 12, y - 12, 24, 24, 6); c.fill(); c.stroke(); c.fillStyle = 'rgba(255,255,255,.4)'; c.fillRect(x - 8, y - 8, 16, 5); }
    c.save(); c.translate(cx + 2, cy + bob); c.rotate(-.5 + Math.sin(t * 3) * .12);                    // brocha
    c.fillStyle = '#c98b4e'; rr(c, -4, -2, 8, 36, 3); c.fill(); c.strokeStyle = P.ink; c.lineWidth = 2; c.stroke(); c.fillStyle = '#ff5fa2'; rr(c, -9, -22, 18, 22, 4); c.fill(); c.stroke(); c.restore();
  } else if (it.kind === 'look') {
    const q = it.looks[Math.floor(t * .9) % it.looks.length], look = Object.assign({}, playerLook(w));
    if (q.cat === 'mask') look.mask = q.o.k; else if (q.cat === 'hoodie') look.hoodie = q.o.k; else if (q.cat === 'shoes') look.shoes = q.o.k; else if (q.cat === 'skin') look.skin = q.o.k; else if (q.cat === 'pants') look.pants = q.o.k; else if (q.cat === 'label') look.label = LOOK_LABELS[q.o.k];
    drawLuchador(c, cx, cy + 46 + bob, Object.assign({}, look, { state: 'idle', t, dir: Math.sin(t * .8) > 0 ? 1 : -1, scale: 1.75 }));
  } else if (it.kind === 'move') {
    drawMoveScene(c, it.icon.slice(3), cx, cy, 192, 118, t);
  } else if (it.icon === 'gem') {
    c.save(); c.translate(cx, cy + bob); c.scale(Math.cos(t * 2.2), 1); drawGem(c, 0, 0, 32); c.restore();
    for (let k = 0; k < 5; k++) { const a = t * 2 + k * 1.26, r = 44 + 5 * Math.sin(t * 4 + k); c.fillStyle = '#fff3b0'; star(c, cx + Math.cos(a) * r, cy + Math.sin(a) * r * .7, 5, 2); c.fill(); }
  } else if (it.icon === 'garra') {                                  // la garra baja, agarra y sube
    const ph = (t * .45) % 1, dy = ph < .4 ? ph / .4 : ph < .55 ? 1 : 1 - (ph - .55) / .45;
    c.save(); c.translate(cx, cy); c.scale(2.2, 2.2); drawShopIcon(c, 'garra', 0, 0, w); c.restore();
    c.strokeStyle = '#d7dbe6'; c.lineWidth = 3; c.beginPath(); c.moveTo(cx, cy - 36); c.lineTo(cx, cy - 36 + dy * 40); c.stroke();
    c.beginPath(); c.moveTo(cx - 9, cy - 36 + dy * 40 + 10); c.lineTo(cx, cy - 36 + dy * 40); c.lineTo(cx + 9, cy - 36 + dy * 40 + 10); c.stroke();
  } else if (it.icon === 'parking') {                                // un cochecito que llega y se estaciona
    const k = smooth(clamp(((t * .5) % 1.6) / 1.1, 0, 1)), x = lerp(cx - 120, cx, k);
    c.save(); c.translate(0, 18); c.fillStyle = '#54566a'; rr(c, cx - 78, cy + 8, 156, 36, 6); c.fill(); c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 2; c.beginPath(); c.moveTo(cx - 40, cy + 8); c.lineTo(cx - 40, cy + 44); c.moveTo(cx + 40, cy + 8); c.lineTo(cx + 40, cy + 44); c.stroke();
    c.lineJoin = 'round'; c.lineWidth = 2.4; c.strokeStyle = P.ink; c.fillStyle = '#e0364a'; rr(c, x - 34, cy - 10, 68, 26, 8); c.fill(); c.stroke(); c.fillStyle = '#8fd0f0'; rr(c, x - 18, cy - 26, 36, 18, 6); c.fill(); c.stroke();
    c.fillStyle = '#1a191e'; [-20, 20].forEach(dx => { c.beginPath(); c.arc(x + dx, cy + 16, 7, 0, 6.3); c.fill(); c.stroke(); }); c.restore();
    c.fillStyle = '#2f6fd0'; rr(c, cx + 56, cy - 46, 28, 28, 5); c.fill(); c.strokeStyle = P.ink; c.lineWidth = 2.4; c.stroke(); txt(c, 'P', cx + 70, cy - 24, { font: `700 22px ${FONT_UI}`, align: 'center', color: '#fff' });
  } else {                                                           // cualquier mueble o personal con su ícono de la tienda
    const sc = 1.7 + Math.sin(t * 3) * .05; c.save(); c.translate(cx, cy + bob); c.scale(sc, sc);
    const sdef = STAFF[it.icon] || GUARDS[it.icon] || CHEFS[it.icon];
    if (sdef) drawLuchador(c, 0, 24, Object.assign({}, LUCHADORES[sdef.look], { state: Math.sin(t * 2) > 0 ? 'walk' : 'idle', t: t * 2, dir: 1, scale: CHEFS[it.icon] ? .8 : .95 })); else drawShopIcon(c, it.icon, 0, 0, w);
    c.restore();
    for (let k = 0; k < 4; k++) { const ph = (t * .8 + k * .25) % 1, a = k * 1.57 + t, r = 38 + ph * 14; c.globalAlpha = Math.sin(ph * Math.PI); c.fillStyle = '#fff3b0'; star(c, cx + Math.cos(a) * r, cy + Math.sin(a) * r * .75, 5 * (1 - ph * .4), 2); c.fill(); }
    c.globalAlpha = 1;
  }
  c.restore();
}
function drawLevelUp(c, w) {
  const V = w.lv; if (!V) return;
  c.fillStyle = 'rgba(12,11,15,.82)'; c.fillRect(-EX, -EY, CW, CH);
  c.save(); c.globalAlpha = Math.min(1, V.t * 2); drawSunburst(c, 480, 300, w.t); c.restore();
  const k = easeOutBack(clamp(V.t / .45, 0, 1)), cx = LV.x + LV.w / 2;
  c.save(); c.translate(480, 300); c.scale(k, k); c.translate(-480, -300);
  drawPanel(c, LV.x, LV.y, LV.w, LV.h, `¡NIVEL ${V.level}!`);
  const mx = maxStamina(w), pg = lvPages(w), st = V.page * LV.per, shown = V.items.slice(st, st + LV.per);
  txt(c, V.items.length ? (V.items.length === 1 ? 'Se desbloquea 1 cosa nueva' : `Se desbloquean ${V.items.length} cosas nuevas`) : 'Sigues creciendo', cx, LV.y + 62, { font: `700 22px ${FONT_UI}`, align: 'center', color: P.gold, ls: 1 });
  txt(c, `Energía máxima del Novato: ${mx} (+${STAM.perLevel})`, cx, LV.y + 86, { font: `600 15px ${FONT_UI}`, align: 'center', color: '#9af0b8' });
  const cw = LV.cw, gap = 14, tot = shown.length * cw + (shown.length - 1) * gap, x0 = cx - tot / 2, y0 = LV.y + 104;
  if (!shown.length) {                                              // nada nuevo: lo que viene
    const nx = nextUnlock(V.level);
    c.fillStyle = 'rgba(255,255,255,.06)'; rr(c, cx - 250, y0 + 20, 500, 190, 16); c.fill(); c.lineWidth = 2; c.strokeStyle = 'rgba(255,255,255,.22)'; c.stroke();
    c.save(); c.translate(cx, y0 + 80); c.rotate(Math.sin(w.t * 2) * .06); drawMask(c, 0, 0, 34, MASKS.ring); c.restore();
    txt(c, 'Este nivel no trae nada nuevo, pero tu taquería ya es más fuerte', cx, y0 + 146, { font: `600 17px ${FONT_UI}`, align: 'center', color: P.cream });
    if (nx) txt(c, `Lo próximo: ${nx.name} en el nivel ${nx.level}`, cx, y0 + 178, { font: `700 18px ${FONT_UI}`, align: 'center', color: P.gold });
  }
  shown.forEach((it, i) => {
    const x = x0 + i * (cw + gap), at = .25 + i * .28, a = clamp((V.pt - at) / .35, 0, 1), e = easeOutBack(a), tg = CARD_TAG[it.kind] || CARD_TAG.feat;
    c.save(); c.globalAlpha = a; c.translate(x + cw / 2, y0 + LV.ch / 2 + (1 - e) * 40); c.scale(.7 + .3 * e, .7 + .3 * e); c.translate(-(x + cw / 2), -(y0 + LV.ch / 2));
    rr(c, x, y0, cw, LV.ch, 14); const g = c.createLinearGradient(0, y0, 0, y0 + LV.ch); g.addColorStop(0, '#403c4c'); g.addColorStop(1, '#1f1d25'); c.fillStyle = g; c.fill(); c.lineWidth = 3; c.strokeStyle = tg[1]; c.stroke();
    c.save(); rr(c, x + 6, y0 + 6, cw - 12, 126, 10); c.clip(); c.fillStyle = 'rgba(0,0,0,.28)'; c.fillRect(x, y0, cw, 140); drawUnlockArt(c, it, x + cw / 2, y0 + 70, V.pt, w); c.restore();
    rr(c, x + cw / 2 - 52, y0 + 136, 104, 20, 10); c.fillStyle = tg[1]; c.fill(); c.lineWidth = 1.6; c.strokeStyle = P.ink; c.stroke();
    txt(c, tg[0], x + cw / 2, y0 + 151, { font: `700 13px ${FONT_UI}`, align: 'center', color: P.ink, ls: 1 });
    const fs = fitFont(c, it.name, cw - 20, 18, 700, 12);
    txt(c, it.name, x + cw / 2, y0 + 180, { font: `700 ${fs}px ${FONT_UI}`, align: 'center', color: P.white });
    wrapLines(c, it.desc, cw - 24, `600 13px ${FONT_UI}`).slice(0, 5).forEach((l, j) => txt(c, l, x + cw / 2, y0 + 202 + j * 15, { font: `600 13px ${FONT_UI}`, align: 'center', color: P.cream }));
    c.restore();
  });
  if (pg > 1) {
    drawButton(c, lvBtn('prev')); drawButton(c, lvBtn('next'));
    txt(c, `${V.page + 1} de ${pg}`, cx - 150, LV.y + LV.h - 29 + 6, { font: `700 15px ${FONT_UI}`, align: 'center', color: P.muted });
  }
  drawButton(c, lvBtn('ok'));
  c.restore();
}
/* ---------- Fila afuera: si no hay mesas libres, la gente espera en la banqueta ----------
   Cada quien tiene su barra de paciencia. Si se acaba, se enoja: si hay alguien junto a él se agarran a golpes (pelea con nubarrón y todo) y se van;
   los dos te quitan reputación (⅓ de máscara cada uno). Mientras haya tutorial, no hay fila. Al cerrar, la fila se dispersa sin castigo. */
const QY = -2.55, QMAX = w => Math.min(8, 4 + Math.floor(w.level / 10));
const qSpot = i => ({ x: DOOR.ix - 1.15 - .78 * i, y: QY });
const custPatience = w => Math.max(29, 50 - (w.day - 1) * 3);                  // v1.7: los clientes esperan ≈ 20 % más
const freeSeatsNow = () => SEATS.filter(s => !s.customer && !(s.tb.down > 0) && s.tb.chair);
function exitTail(cu) {                                            // de la puerta hacia afuera de la pantalla (o hasta su coche)
  return [{ x: DOOR.ix, y: -.3 }, { x: DOOR.ix, y: SIDE_Y }, { x: EXIT_X, y: SIDE_Y }].concat(cu.car ? carWalkBack(cu.car) : []);
}
function enqueueCustomer(w, src) {
  if (w.queue.length >= QMAX(w)) return false;
  const i = w.queue.length, sp = qSpot(i), qp = Math.max(48, custPatience(w) * 1.7);
  const cu = {
    x: src.x, y: src.y, path: (src.pre || []).concat([{ x: sp.x, y: SIDE_Y }, { x: sp.x, y: sp.y }]), speed: rand(1.6, 2.0), dir: -1, phase: rand(0, 6), moving: true, alpha: 1,
    state: 'qwalk', seat: null, look: randomLook(), off: rand(0, 6), seated: false, patience: qp, pmax: qp, timer: 0, bubbleT: 0, eatT: 0, angry: false,
    order: makeOrder(w), served: [], freeze: 0, vip: false, vd: null, gd: null, z: 0, spin: 0, car: src.car || null, qi: i
  };
  w.queue.push(cu); w.customers.push(cu);
  return true;
}
function leaveQueue(w, cu, angry) {                               // se va por la banqueta
  w.queue = w.queue.filter(q => q !== cu);
  cu.state = 'leave'; cu.angry = angry; cu.noPay = true; cu.speed = angry ? 2.7 : 1.9; cu.moving = true; cu.br = null;
  cu.path = [{ x: cu.x, y: SIDE_Y }, { x: EXIT_X, y: SIDE_Y }].concat(cu.car ? carWalkBack(cu.car) : []);
}
function startBrawl(w, a, b) {                                    // ¡a los golpes!
  w.queue = w.queue.filter(q => q !== a && q !== b);
  const lo = a.x <= b.x ? a : b, hi = lo === a ? b : a;
  hi.x = lo.x + .62; hi.y = lo.y;
  lo.state = hi.state = 'brawl'; lo.moving = hi.moving = false; lo.path = hi.path = []; lo.angry = hi.angry = true;
  lo.dir = 1; hi.dir = -1;
  lo.br = { t: 0, mate: hi, lead: true, k: 0, snd: 0 }; hi.br = { t: 0, mate: lo, lead: false, k: 2.1, snd: 0 };
  sfx('angry'); toast(w, '¡Se están peleando en la fila!');
  const p = actorPos(lo);
  addPart(w, { type: 'text', text: '¡TÚ LLEGASTE DESPUÉS!', x: p.x + 30, y: p.y - 100, vy: -22, life: 1.6, color: '#ff8fa0' });
}
function updateBrawl(w, cu, dt) {
  const R = cu.br; if (!R) return;
  R.t += dt;
  if (!R.lead) return;
  if ((R.snd -= dt) <= 0) { R.snd = .42; sfx(Math.random() < .7 ? 'pum' : 'angry'); w.shake = Math.max(w.shake, .12); }
  if (R.t >= 2.7) {                                               // cada quien se va por su lado, sin pagar, y la reputación lo resiente
    const b = R.mate;
    leaveQueue(w, cu, true); leaveQueue(w, b, true);
    loseRep(w, REP.lose * 2); w.dayAngry += 2;
    toast(w, '¡Pelea en la fila! Los dos se fueron enojados: pierdes ⅔ de máscara'); sfx('angry');
  }
}
function updateQueue(w, dt) {
  const q = w.queue;
  if (!q.length) return;
  if (w.dayTime <= 0 || !w.open) { q.slice().forEach(cu => leaveQueue(w, cu, false)); return; }          // cerramos: la fila se dispersa
  q.forEach((cu, i) => {                                           // cada quien avanza al lugar que le toca
    if (cu.qi === i) return;
    cu.qi = i; const sp = qSpot(i);
    cu.path = (cu.y < QY - .3 ? [{ x: sp.x, y: SIDE_Y }] : []).concat([{ x: sp.x, y: sp.y }]);
    cu.state = 'qwalk'; cu.moving = true;
  });
  // el primero en perder la paciencia hace el berrinche
  const a = q.find(cu => cu.state === 'queue' && cu.patience <= 0);
  if (a) {
    const j = q.indexOf(a), mate = [q[j + 1], q[j - 1]].find(m => m && m.state === 'queue');
    if (mate) startBrawl(w, a, mate);
    else {
      const p = actorPos(a);
      addPart(w, { type: 'text', text: '¡Ya me cansé!', x: p.x, y: p.y - 92, vy: -30, life: 1.6, color: '#ff8fa0' });
      leaveQueue(w, a, true); loseRep(w); w.dayAngry += 1; sfx('angry');
    }
  }
}
function promoteQueue(w) {                                         // cuando se libera una silla pasa el primero de la fila
  const head = w.queue[0];
  if (!head || head.state !== 'queue') return;
  const free = freeSeatsNow(); if (!free.length) return;
  const seat = pick(free), entry = DOOR.cells[0], cells = Grid.path(entry, [{ c: seat.c, r: seat.r }]);
  if (!cells) return;
  const pts = [{ x: DOOR.ix, y: QY }, { x: DOOR.ix, y: -.3 }, Grid.pt(entry.c, entry.r), ...cells.map(n => Grid.pt(n.c, n.r))];
  pts[pts.length - 1] = { x: seat.gx, y: seat.gy };
  w.queue.shift();
  Object.assign(head, { state: 'enter', seat, path: pts, moving: true, speed: rand(1.7, 2.1) });
  head.pmax = head.patience = custPatience(w) * (1 + .03 * comfortOf(seat.tb));
  seat.customer = head;
}
function drawQueueBar(c, cu, w) {                                  // barrita de paciencia sobre los que esperan afuera
  if (cu.state !== 'queue' && cu.state !== 'qwalk') return;
  const p = actorPos(cu), r = clamp(cu.patience / cu.pmax, 0, 1), bw = 36, x = p.x - bw / 2, y = p.y - 92, sh = r < .3 ? Math.sin(w.t * 40) * 1.2 : 0;
  c.save(); c.translate(sh, 0);
  c.fillStyle = 'rgba(17,16,20,.85)'; rr(c, x - 4, y - 4, bw + 8, 13, 6.5); c.fill(); c.lineWidth = 1.4; c.strokeStyle = r < .3 ? '#ff5a5a' : 'rgba(255,255,255,.4)'; c.stroke();
  c.fillStyle = '#2f2c37'; rr(c, x, y, bw, 5, 2.5); c.fill();
  c.fillStyle = r > .5 ? P.green : r > .25 ? P.gold : P.red; rr(c, x, y, Math.max(3, bw * r), 5, 2.5); c.fill();
  c.restore();
}
function drawQueueTag(c, w) {                                      // "FILA 3" sobre el primero de la fila
  const n = w.queue.length; if (!n) return;
  const q0 = qSpot(0), p = S(q0.x, q0.y), msg = `FILA ${n}`; c.save(); c.font = `700 13px ${FONT_UI}`;
  const tw = c.measureText(msg).width + 22; c.restore();
  c.fillStyle = 'rgba(17,16,20,.88)'; rr(c, p.x - tw / 2, p.y + 6, tw, 20, 10); c.fill(); c.lineWidth = 1.6; c.strokeStyle = n >= QMAX(w) ? '#ff5a5a' : P.gold; c.stroke();
  txt(c, msg, p.x, p.y + 20.5, { font: `700 13px ${FONT_UI}`, align: 'center', color: n >= QMAX(w) ? '#ff8fa0' : P.cream, ls: .8 });
}
function drawBrawlCloud(c, w, cu) {                                // el nubarrón de la pelea: puffs, puños y pies que salen, estrellas y palabras de historieta
  const R = cu.br, b = R.mate, pa = actorPos(cu), pb = actorPos(b), mx = (pa.x + pb.x) / 2, my = (pa.y + pb.y) / 2 - 30, t = R.t;
  c.save(); c.lineJoin = 'round'; c.lineWidth = 2.2; c.strokeStyle = P.ink;
  const cols = ['#f4eefc', '#e0d6f2', '#cfc4e6'];
  for (let k = 0; k < 9; k++) {                                    // nubarrón que se bambolea
    const an = k / 9 * 6.283 + t * 5, rad = 15 + 7 * Math.sin(t * 9 + k * 1.3), x = mx + Math.cos(an) * rad * 1.2, y = my + Math.sin(an) * rad * .9, r = 12 + 5 * Math.sin(t * 7 + k * 2.1);
    c.fillStyle = cols[k % 3]; c.beginPath(); c.arc(x, y, r, 0, 6.3); c.fill(); c.stroke();
  }
  c.fillStyle = cols[0]; c.beginPath(); c.arc(mx, my, 17, 0, 6.3); c.fill();
  const f = Math.floor(t * 9);                                     // extremidades que asoman (cambian de lugar cada fracción de segundo)
  for (let k = 0; k < 5; k++) {
    const an = hash(f * 7 + k * 3) * 6.283, d = 30 + hash(f * 5 + k) * 8, x = mx + Math.cos(an) * d * 1.15, y = my + Math.sin(an) * d * .85, fist = k % 2 === 0;
    c.strokeStyle = P.ink; c.lineWidth = 6.5; c.beginPath(); c.moveTo(mx + Math.cos(an) * 20, my + Math.sin(an) * 16); c.lineTo(x, y); c.stroke();
    c.strokeStyle = fist ? '#e0ac69' : '#7c3aed'; c.lineWidth = 3.8; c.beginPath(); c.moveTo(mx + Math.cos(an) * 20, my + Math.sin(an) * 16); c.lineTo(x, y); c.stroke();
    c.lineWidth = 2; c.strokeStyle = P.ink; c.fillStyle = fist ? '#f1c27d' : '#fff'; c.beginPath(); c.arc(x, y, fist ? 6 : 7, 0, 6.3); c.fill(); c.stroke();
  }
  c.fillStyle = '#ffe27a'; for (let k = 0; k < 4; k++) { const a = t * 7 + k * 1.57, r = 38 + 6 * Math.sin(t * 11 + k); star(c, mx + Math.cos(a) * r * 1.2, my + Math.sin(a) * r * .8 - 6, 6, 2.5); c.fill(); c.stroke(); }
  const word = ['¡PLAF!', '¡POW!', '¡ZAS!', '¡PUM!', '¡CATAPLÚN!'][Math.floor(t * 3.2) % 5], pop = 1 + .12 * Math.sin(t * 24);
  c.translate(mx, my - 56); c.rotate(Math.sin(t * 9) * .08); c.scale(pop, pop);
  txt(c, word, 0, 0, { font: `400 ${fitDisplay(c, word, 90, 24)}px ${FONT_DISPLAY}`, align: 'center', color: '#fff3b0', stroke: P.ink, sw: 6 });
  c.restore();
}
function spawnCustomer(w, vip = null, gem = null, src = null) {   // vip = definición de VIPS o null · gem = personaje que regala gemas · src = de dónde llega (por defecto, la banqueta de la derecha)
  if (!LAYOUT.comals.length && !LAYOUT.fridge) return false;                // sin nada que cocinar no llega nadie
  src = src || { x: SPAWN_X, y: SIDE_Y, pre: [], car: null };
  let free = freeSeatsNow();                                                 // sin las mesas volcadas ni las que no tienen sillas
  if (vip) { const alone = free.filter(s => s.tb.seats.every(x => !x.customer)); if (alone.length) free = alone; }   // el VIP prefiere una mesa para él solo
  if (!vip && !gem && !w.tut && SEATS.some(s => s.tb.chair) && (!free.length || w.queue.length)) return enqueueCustomer(w, src);      // sin mesa libre: a la fila de afuera
  if (!free.length) return false;
  const seat = pick(free);
  const entry = DOOR.cells[0];
  const cells = Grid.path(entry, [{ c: seat.c, r: seat.r }]);
  if (!cells) return false;
  const pts = [
    ...(src.pre || []),
    { x: DOOR.ix, y: SIDE_Y },                       // gira hacia la puerta desde la banqueta
    { x: DOOR.ix, y: -.3 },                          // marco de la puerta
    Grid.pt(entry.c, entry.r),                       // primera loseta del local
    ...cells.map(n => Grid.pt(n.c, n.r))
  ];
  pts[pts.length - 1] = { x: seat.gx, y: seat.gy };
  const pmax = (vip ? vip.patience : gem ? gem.patience : custPatience(w)) * (1 + .03 * comfortOf(seat.tb));       // sillas cómodas: clientes más pacientes
  const cu = {
    x: src.x, y: src.y, path: pts, speed: vip ? vip.speed : gem ? gem.speed : rand(1.6, 2.0), dir: -1, phase: rand(0, 6), moving: true, alpha: 1,
    state: 'enter', seat, look: vip ? VIP_LOOKS[vip.key] : gem ? gem.look : randomLook(), off: rand(0, 6), seated: false, patience: pmax, pmax, timer: 0, bubbleT: 0, eatT: 0, angry: false,
    order: vip ? vip.combo.map(k => ({ key: k, done: false })) : makeOrder(w), served: [], freeze: 0, vip: !!vip, vd: vip, gd: gem, z: 0, spin: 0, car: src.car || null
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
  cu.path = cells.map(n => Grid.pt(n.c, n.r)).concat(exitTail(cu));
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
  pts.push(...exitTail(cu));                                      // puerta → banqueta → se aleja (o a su coche)
  cu.path = pts;
  if (!angry && !clawTrip(w, cu, seat)) maskTrip(w, cu, seat);                                  // (a veces, antes de irse, pasa a jugar a la garra)
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
        if (cu.order.some(i => RECIPES[i.key].drink)) {           // la bebida los entretiene: la espera se congela un rato
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
        const total = orderTotal(cu) * (cu.vip ? cu.vd.mult : 1), tbl = cu.seat.tb, tip = Math.round(total * (.25 + (TABLES[tbl.style] || TABLES.mantel).tip + .01 * comfortOf(tbl) + (CUR_EVENT ? CUR_EVENT.tip : 0) + .03 * starBonus(w) + (perkOn(w, 'tip') ? .08 : 0)) * (cu.car ? 1.4 : 1) * clamp(cu.patience / cu.pmax, 0, 1));
        w.coins.push({ x: seat.plate.x + rand(-8, 8), y: seat.plate.y - 2 + rand(-3, 3), v: total + tip, t: 0, vip: !!cu.vip, xp: cu.vip ? cu.vd.xp : cu.gd ? (cu.gd.xp || 0) : 0,
          gems: cu.gd ? Math.round(rand(cu.gd.gems[0], cu.gd.gems[1])) : 0 });
        w.dayServed += 1; w.totalServed += 1;
        addRep(w, cu.vip ? REP.serve * 2 : REP.serve);                              // cada cliente bien atendido devuelve color a la máscara
        addPart(w, { type: 'text', text: cu.vip ? '¡LEGENDARIO!' : '¡Delicioso!', x: p.x, y: p.y - 92, vy: -26, life: 1.4, color: cu.vip ? P.gold : '#9af0b8' });
        if (cu.gd) { if (cu.gd.rep) addRep(w, cu.gd.rep); toast(w, `¡${cu.gd.name} quedó encantado! ${cu.gd.note || 'Cobra su moneda: trae gemas'}`); sfx('fanfare'); }
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
        cu.path = cells.map(c => Grid.pt(c.c, c.r)).concat(exitTail(cu));
        cu.state = 'leave'; cu.speed = 3.8; cu.moving = true; cu.noPay = true; cu.dazed = true; cu.dir = -n.dir;
        n.busy = false; n.furia = false; n.overwork = 0;
        setTask(w, { type: 'rest' });                            // desquitado, el Novato se va directo por su suero
      }
      break;
    }
    case 'qwalk':
      if (!w.tut) cu.patience -= dt * queueDrain(w);
      if (step(cu, dt)) { cu.state = 'queue'; cu.moving = false; cu.dir = -1; }
      break;
    case 'queue': if (!w.tut) cu.patience -= dt * queueDrain(w); break;                      // (el berrinche lo maneja updateQueue)
    case 'brawl': updateBrawl(w, cu, dt); break;
    case 'claw': updateClawCust(w, cu, dt); break;
    case 'rage': updateVipRage(w, cu, dt); break;
    case 'leave':
      if (cu.car) {                                                          // el que llegó en coche se va metiendo a su coche
        const last = cu.path[cu.path.length - 1];
        if (last && cu.path.length <= 1) cu.alpha = clamp(Math.hypot(cu.x - last.x, cu.y - last.y) / .7, 0, 1);
      } else if (cu.y < SIDE_Y + .4 && cu.x < DOOR.ix - .2) cu.alpha = clamp((cu.x - EXIT_X) / (DOOR.ix - EXIT_X), 0, 1);      // ya en la banqueta, al alejarse se va volviendo transparente
      if (step(cu, dt) || cu.alpha <= .02) { cu.dead = true; if (cu.car) carPassengerDone(cu.car, cu); }
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

/* =========================================================
   PELEAS CONTRA RESTAURANTES RIVALES (v1.4): animaciones de cada técnica, escenarios, iconos y mapa
   La pelea es por turnos: eliges una técnica, acomodas el golpe en la barra de tiempo y después responde el jefe del restaurante.
   Cada técnica y cada ataque del rival tienen su animación (función de u = 0..1) que mueve a los dos luchadores con el mismo muñeco de siempre.
   ========================================================= */
const F_FLOOR = 428, F_PX = 270, F_EX = 690, F_SC = 2.1;
const fseg = (u, a, b) => clamp((u - a) / (b - a), 0, 1);               // tramo de la animación: 0 antes de a, 1 después de b
const fsm = (u, a, b) => smooth(fseg(u, a, b));
const farc = (u, a, b, h) => Math.sin(Math.PI * fseg(u, a, b)) * h;     // salto: sube y baja entre a y b
const PI2 = Math.PI * 2;
// Animaciones de las técnicas del jugador (mira a la derecha). p = el jugador, e = el rival. x = desplazamiento, z = altura, rot = giro, pose = postura
const MOVE_ANIM = {
  golpe: u => ({ p: { x: 270 * fsm(u, .1, .42) - 270 * fsm(u, .62, 1), state: u > .08 && u < .3 || u > .66 ? 'walk' : 'idle', pose: u > .3 && u < .62 ? 'punch' : null },
    e: { x: 26 * Math.sin(Math.PI * fseg(u, .45, .85)), pose: u > .45 && u < .72 ? 'hit' : null } }),
  punetazo: u => ({ p: { x: 250 * fsm(u, .08, .3) - 250 * fsm(u, .78, 1), state: u > .06 && u < .28 || u > .8 ? 'walk' : 'idle', pose: (u > .28 && u < .46) || (u > .5 && u < .7) ? 'punch' : null },
    e: { x: 22 * Math.sin(Math.PI * fseg(u, .36, .5)) + 30 * Math.sin(Math.PI * fseg(u, .62, .9)), pose: u > .36 && u < .8 ? 'hit' : null } }),
  patada: u => ({ p: { x: 250 * fsm(u, .15, .5) - 250 * fsm(u, .72, 1), z: farc(u, .15, .75, 100), rot: -.35 * Math.sin(Math.PI * fseg(u, .25, .7)), pose: u > .35 && u < .72 ? 'kick' : null },
    e: { x: 60 * fsm(u, .55, .8) - 60 * fsm(u, .84, 1), rot: .22 * Math.sin(Math.PI * fseg(u, .55, .9)), pose: u > .55 && u < .85 ? 'hit' : null } }),
  tope: u => ({ p: { x: -50 * fsm(u, 0, .25) + 330 * fsm(u, .25, .6) - 280 * fsm(u, .8, 1), z: farc(u, .25, .6, 55), rot: 1.45 * fsm(u, .3, .42) - 1.45 * fsm(u, .65, .8), pose: u > .3 && u < .68 ? 'fly' : null, state: u < .25 ? 'walk' : 'idle' },
    e: { x: 130 * fsm(u, .6, .85) - 130 * fsm(u, .9, 1), rot: 1.3 * fsm(u, .6, .8) - 1.3 * fsm(u, .9, 1), pose: u > .6 && u < .9 ? 'down' : null } }),
  rana: u => ({ p: { x: 385 * fsm(u, .1, .4) - 385 * fsm(u, .8, 1), z: farc(u, .1, .4, 60) + 95 * fsm(u, .4, .46) * (1 - fsm(u, .66, .78)), rot: PI2 * fsm(u, .42, .64), pose: u > .1 && u < .4 ? 'fly' : u >= .4 && u < .7 ? 'flex' : null },
    e: { z: farc(u, .42, .64, 40), rot: -PI2 * fsm(u, .42, .64) + 1.55 * fsm(u, .64, .72) - 1.55 * fsm(u, .86, 1), pose: u > .42 && u < .64 ? 'hit' : u >= .72 && u < .88 ? 'down' : null } }),
  cangrejo: u => ({ p: { x: 330 * fsm(u, .1, .35) - 330 * fsm(u, .88, 1), rot: -.3 * fsm(u, .4, .5) + .3 * fsm(u, .85, .95) + (u > .45 && u < .85 ? Math.sin(u * 50) * .04 : 0), pose: u > .36 && u < .9 ? 'grab' : null, state: u > .08 && u < .36 || u > .9 ? 'walk' : 'idle' },
    e: { x: (u > .45 && u < .85 ? Math.sin(u * 70) * 2.5 : 0), rot: 1.5 * fsm(u, .3, .42) - 1.5 * fsm(u, .88, 1), pose: u > .36 && u < .9 ? 'down' : null } }),
  plancha: u => ({ p: { x: 20 * fsm(u, .08, .3) + 350 * fsm(u, .42, .66) - 370 * fsm(u, .84, 1), z: 160 * fsm(u, .08, .3) - 160 * fsm(u, .42, .66), rot: 1.45 * fsm(u, .46, .54) - 1.45 * fsm(u, .78, .88), pose: u > .26 && u < .42 ? 'flex' : u >= .42 && u < .8 ? 'fly' : null },
    e: { x: 20 * fsm(u, .66, .8) - 20 * fsm(u, .9, 1), rot: 1.5 * fsm(u, .66, .74) - 1.5 * fsm(u, .86, 1), pose: u > .66 && u < .9 ? 'down' : null } }),
  quebradora: u => ({ p: { x: 380 * fsm(u, .08, .3) - 380 * fsm(u, .86, 1), rot: u > .5 && u < .66 ? Math.sin(u * 40) * .1 : 0, pose: u > .32 && u < .86 ? 'grab' : null, state: u > .06 && u < .3 || u > .88 ? 'walk' : 'idle' },
    e: { x: -40 * fsm(u, .3, .5) + 40 * fsm(u, .86, 1), z: 125 * fsm(u, .3, .5) * (1 - fsm(u, .62, .7)), rot: 1.55 * fsm(u, .3, .5) - 1.55 * fsm(u, .86, 1), pose: u > .3 && u < .62 ? 'hit' : u >= .7 && u < .88 ? 'down' : null },
    props: u > .68 && u < .95 ? [{ k: 'crack', x: 650, y: F_FLOOR + 4, a: fseg(u, .68, .8), fade: 1 - fseg(u, .85, .95) }] : [] }),
  supermortal: u => ({ p: { x: -40 * fsm(u, .05, .3) + 440 * fsm(u, .32, .74) - 400 * fsm(u, .9, 1), z: 230 * fsm(u, .05, .3) - 160 * fsm(u, .32, .55) - 70 * fsm(u, .55, .74), rot: 2 * PI2 * fsm(u, .34, .66), pose: u > .28 && u < .34 ? 'flex' : u >= .34 && u < .74 ? 'fly' : null },
    e: { x: 210 * fsm(u, .74, .92) - 210 * fsm(u, .94, 1), z: farc(u, .74, .98, 110), rot: 2 * PI2 * fsm(u, .74, .9) + 1.5 * fsm(u, .9, .95) - 1.5 * fsm(u, .97, 1), pose: u > .74 && u < .9 ? 'hit' : u >= .9 && u < .97 ? 'down' : null },
    props: u > .3 && u < .74 ? [{ k: 'trail', x: F_PX + (-40 * fsm(u, .05, .3) + 440 * fsm(u, .32, .74)), y: F_FLOOR - (230 * fsm(u, .05, .3) - 160 * fsm(u, .32, .55) - 70 * fsm(u, .55, .74)) - 70, a: fseg(u, .3, .74) }] : [] })
};
// Animaciones de los ataques del rival (mira a la izquierda). Misma idea: e = el rival, p = el jugador
const ATK_ANIM = {
  punch: u => ({ e: { x: -250 * fsm(u, .1, .42) + 250 * fsm(u, .64, 1), state: u > .08 && u < .3 || u > .66 ? 'walk' : 'idle', pose: u > .3 && u < .64 ? 'punch' : null },
    p: { x: -26 * Math.sin(Math.PI * fseg(u, .46, .9)), pose: u > .46 && u < .74 ? 'hit' : null } }),
  kick: u => ({ e: { x: -250 * fsm(u, .15, .5) + 250 * fsm(u, .72, 1), z: farc(u, .15, .75, 90), rot: .35 * Math.sin(Math.PI * fseg(u, .25, .7)), pose: u > .35 && u < .72 ? 'kick' : null },
    p: { x: -60 * fsm(u, .52, .78) + 60 * fsm(u, .84, 1), rot: -.22 * Math.sin(Math.PI * fseg(u, .52, .9)), pose: u > .52 && u < .84 ? 'hit' : null } }),
  lasso: u => { const e = { pose: u > .12 && u < .62 ? 'throw' : null }, p = { x: 170 * fsm(u, .5, .72) - 170 * fsm(u, .8, 1), pose: u > .5 && u < .84 ? 'hit' : null };
    return { e, p, props: [{ k: 'lasso', ax: F_EX - 34, ay: F_FLOOR - 140, bx: F_PX + p.x + 6, by: F_FLOOR - 90, a: fseg(u, .15, .5), keep: u > .5 && u < .84, spin: u * 26 }] }; },
  smash: u => ({ e: { x: -270 * fsm(u, .08, .4) + 270 * fsm(u, .74, 1), state: u > .06 && u < .4 || u > .76 ? 'walk' : 'idle', pose: u > .4 && u < .52 ? 'throw' : u >= .52 && u < .72 ? 'punch' : null, hold: 'guitar', holdAng: u < .52 ? -.5 : 1.1 },
    p: { z: farc(u, .52, .66, 12), pose: u > .52 && u < .76 ? 'hit' : null, x: -18 * Math.sin(Math.PI * fseg(u, .52, .8)) } }),
  notes: u => ({ e: { pose: u > .1 && u < .7 ? 'throw' : null, angry: u > .12 && u < .72 },
    p: { x: -14 * Math.sin(Math.PI * fseg(u, .72, 1)), pose: u > .72 ? 'hit' : null },
    props: [0, 1, 2, 3].map(i => ({ k: 'note', x: lerp(F_EX - 40, F_PX + 30, fseg(u, .18 + i * .1, .72)), y: lerp(F_FLOOR - 140, F_FLOOR - 110, fseg(u, .18 + i * .1, .72)) + Math.sin(u * 16 + i * 1.7) * 14, a: fseg(u, .18 + i * .1, .72), col: ['#ffd23a', '#ff5fa2', '#5fe8ff', '#9af0b8'][i], flag: i % 2 })).filter(q => q.a > 0 && q.a < 1) }),
  disc: u => ({ e: { pose: u > .12 && u < .42 ? 'throw' : null },
    p: { x: -34 * Math.sin(Math.PI * fseg(u, .62, .9)), pose: u > .62 && u < .86 ? 'hit' : null },
    props: u > .36 && u < .64 ? [{ k: 'disc', x: lerp(F_EX - 40, F_PX + 26, fseg(u, .36, .62)), y: lerp(F_FLOOR - 140, F_FLOOR - 92, fseg(u, .36, .62)), spin: u * 40 }] : [] }),
  charge: u => ({ e: { x: 25 * fsm(u, 0, .3) - 365 * fsm(u, .3, .55) + 340 * fsm(u, .7, 1), rot: .25 * fsm(u, .3, .4) - .25 * fsm(u, .7, .8), pose: u > .3 && u < .7 ? 'guard' : null, state: u > .3 && u < .6 || u > .75 ? 'walk' : 'idle' },
    p: { x: -110 * fsm(u, .55, .8) + 110 * fsm(u, .86, 1), rot: -.5 * fsm(u, .55, .7) + .5 * fsm(u, .86, 1), pose: u > .55 && u < .88 ? 'hit' : null } }),
  throw: u => ({ e: { pose: u > .1 && u < .52 ? 'throw' : null },
    p: { x: -22 * Math.sin(Math.PI * fseg(u, .6, .9)), pose: u > .6 && u < .88 ? 'hit' : null },
    props: [0, 1, 2].map(i => ({ k: 'sushi', x: lerp(F_EX - 40, F_PX + 26, fseg(u, .14 + i * .12, .6)), y: lerp(F_FLOOR - 150, F_FLOOR - 96, fseg(u, .14 + i * .12, .6)) - farc(u, .14 + i * .12, .6, 34), a: fseg(u, .14 + i * .12, .6), spin: u * 30 + i })).filter(q => q.a > 0 && q.a < 1) }),
  chop: u => { const ex = -300 * fsm(u, .2, .46) + 300 * fsm(u, .7, 1);
    return { e: { x: ex, pose: u > .46 && u < .64 ? 'punch' : null, state: u > .2 && u < .46 ? 'walk' : 'idle' }, p: { x: -20 * Math.sin(Math.PI * fseg(u, .5, .85)), pose: u > .5 && u < .76 ? 'hit' : null },
      props: (u > .2 && u < .46 ? [1, 2, 3].map(i => ({ k: 'ghost', x: F_EX + ex + i * 36, a: i })) : []).concat(u > .46 && u < .7 ? [{ k: 'slash', x: F_PX + 40, y: F_FLOOR - 92, a: fseg(u, .46, .7) }] : []) }; }
};
const ATK_DUR = { punch: 1.15, kick: 1.2, lasso: 1.4, smash: 1.4, notes: 1.5, disc: 1.3, charge: 1.3, throw: 1.4, chop: 1.2 };
const ATK_HIT = { punch: .46, kick: .52, lasso: .5, smash: .54, notes: .72, disc: .62, charge: .56, throw: .6, chop: .5 };
const ATK_SND = { punch: 'pum', kick: 'pum', lasso: 'angry', smash: 'pum', notes: 'rage', disc: 'pum', charge: 'pum', throw: 'pum', chop: 'pum' };
const MOVE_FRAME = (key, u) => { const f = MOVE_ANIM[key](clamp(u, 0, 1)); f.p = f.p || {}; f.e = f.e || {}; f.props = f.props || []; return f; };
const ATK_FRAME = (kind, u) => { const f = ATK_ANIM[kind](clamp(u, 0, 1)); f.p = f.p || {}; f.e = f.e || {}; f.props = f.props || []; return f; };

/* ---------- dibujo de los luchadores, accesorios y efectos de la pelea ---------- */
function drawGuitar(c, ang) {                                       // guitarra de mariachi: se dibuja desde la mano
  c.save(); c.rotate(ang); c.lineJoin = 'round'; c.lineWidth = 1.6; c.strokeStyle = P.ink;
  c.fillStyle = '#b5482f'; c.beginPath(); c.ellipse(0, -10, 9, 11, 0, 0, 6.3); c.fill(); c.stroke();
  c.beginPath(); c.ellipse(0, -24, 7, 8, 0, 0, 6.3); c.fill(); c.stroke();
  c.fillStyle = '#2b1a0e'; c.beginPath(); c.arc(0, -17, 3.4, 0, 6.3); c.fill();
  c.fillStyle = '#5a3a1e'; c.fillRect(-2, -52, 4, 24); c.strokeRect(-2, -52, 4, 24);
  c.fillStyle = '#ffc83d'; c.fillRect(-4, -57, 8, 6); c.strokeRect(-4, -57, 8, 6);
  c.restore();
}
function drawFighter(c, F, w, who, fr) {
  const look = who === 'p' ? playerLook(w) : LUCHADORES[F.R.look];
  const sc = F_SC * (look.scale || 1), dir = who === 'p' ? 1 : -1, z = fr.z || 0, rot = fr.rot || 0, bx = (who === 'p' ? F_PX : F_EX) + (fr.x || 0);
  const sh = 1 - Math.min(.6, z / 260);
  c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(bx, F_FLOOR + 3, 46 * sh, 11 * sh, 0, 0, 6.3); c.fill();
  c.save(); c.translate(bx, F_FLOOR - z);
  if (rot) { c.translate(0, -34 * sc); c.rotate(rot); c.translate(0, 34 * sc); }
  const o = Object.assign({}, look, { state: fr.state || 'idle', t: fr.state === 'walk' ? F.t * 1.05 : F.t, dir, scale: sc, pose: fr.pose || null, angry: !!fr.angry });
  if (fr.hold === 'guitar') o.holdFn = (cc, aa) => { cc.rotate(-aa); drawGuitar(cc, fr.holdAng || 0); };
  drawLuchador(c, 0, 0, o);
  c.restore();
}
function drawProps(c, props, t) {                                   // lazo, notas, rin, sushi, tajo, grietas y estela
  for (const q of props) {
    c.save(); c.lineJoin = 'round'; c.lineCap = 'round';
    if (q.k === 'lasso') {                                          // cuerda del lazo: sale de la mano, el aro vuela y se cierra sobre el jugador
      const hx = q.ax, hy = q.ay, cx = lerp(hx, q.bx, q.a), cy = lerp(hy, q.by, q.a) - Math.sin(Math.PI * q.a) * 40, r = q.keep ? 22 : 12 + 14 * q.a;
      c.strokeStyle = P.ink; c.lineWidth = 6; c.beginPath(); c.moveTo(hx, hy); c.quadraticCurveTo((hx + cx) / 2, Math.max(hy, cy) + 24, cx, cy); c.stroke();
      c.strokeStyle = '#d9b370'; c.lineWidth = 3; c.stroke();
      c.save(); c.translate(cx, cy); c.rotate(q.spin); c.scale(1, .55); c.strokeStyle = P.ink; c.lineWidth = 7; c.beginPath(); c.arc(0, 0, r, 0, 6.3); c.stroke(); c.strokeStyle = '#d9b370'; c.lineWidth = 4; c.stroke(); c.restore();
    } else if (q.k === 'note') {                                    // nota musical
      c.globalAlpha = Math.sin(Math.PI * q.a) * 1.4 > 1 ? 1 : Math.sin(Math.PI * q.a) * 1.4;
      c.fillStyle = q.col; c.strokeStyle = P.ink; c.lineWidth = 2.4;
      c.beginPath(); c.ellipse(q.x, q.y, 8, 6, -.4, 0, 6.3); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(q.x + 6.5, q.y - 2); c.lineTo(q.x + 6.5, q.y - 30); c.stroke();
      if (q.flag) { c.beginPath(); c.moveTo(q.x + 6.5, q.y - 30); c.quadraticCurveTo(q.x + 20, q.y - 24, q.x + 14, q.y - 12); c.lineWidth = 3; c.stroke(); }
    } else if (q.k === 'disc') {                                    // rin cromado girando
      c.translate(q.x, q.y); c.rotate(q.spin); c.fillStyle = '#c9ceda'; c.strokeStyle = P.ink; c.lineWidth = 2.6; c.beginPath(); c.arc(0, 0, 19, 0, 6.3); c.fill(); c.stroke();
      c.fillStyle = '#8f96a8'; c.beginPath(); c.arc(0, 0, 8, 0, 6.3); c.fill(); c.lineWidth = 1.6; c.stroke();
      c.strokeStyle = '#7a8090'; c.lineWidth = 2; for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283; c.beginPath(); c.moveTo(Math.cos(a) * 8, Math.sin(a) * 8); c.lineTo(Math.cos(a) * 17, Math.sin(a) * 17); c.stroke(); }
    } else if (q.k === 'sushi') {                                   // nigiri volador: arroz con pescado y alga
      c.translate(q.x, q.y); c.rotate(q.spin); c.fillStyle = '#fff8ea'; c.strokeStyle = P.ink; c.lineWidth = 2.2; rr(c, -13, -4, 26, 14, 6); c.fill(); c.stroke();
      c.fillStyle = '#ff8a6a'; rr(c, -15, -11, 30, 10, 5); c.fill(); c.stroke(); c.fillStyle = '#1b1b22'; c.fillRect(-3, -11, 6, 21);
    } else if (q.k === 'slash') {                                   // tajo blanco
      c.globalAlpha = 1 - q.a * .6; c.strokeStyle = '#fff'; c.lineWidth = 7 * (1 - q.a * .5);
      c.beginPath(); c.arc(q.x - 20, q.y + 24, 78, -1.25, -1.25 + 1.9 * Math.min(1, q.a * 2.2)); c.stroke();
      c.strokeStyle = 'rgba(150,220,255,.9)'; c.lineWidth = 3; c.beginPath(); c.arc(q.x - 20, q.y + 24, 70, -1.25, -1.25 + 1.9 * Math.min(1, q.a * 2.2)); c.stroke();
    } else if (q.k === 'ghost') {                                   // imagen residual del dash
      c.globalAlpha = .22 / q.a; c.fillStyle = '#fff'; c.beginPath(); c.ellipse(q.x, F_FLOOR - 70, 28, 74, 0, 0, 6.3); c.fill();
    } else if (q.k === 'crack') {                                   // grietas en el piso
      c.globalAlpha = q.fade; c.strokeStyle = P.ink; c.lineWidth = 4;
      for (let i = 0; i < 7; i++) { const a = -3.14 + i * .52 - .1, L = (60 + (i % 3) * 26) * q.a; c.beginPath(); c.moveTo(q.x, q.y); c.lineTo(q.x + Math.cos(a) * L * .5 + (i % 2 ? 6 : -6), q.y + Math.sin(a) * L * .16); c.lineTo(q.x + Math.cos(a) * L, q.y + Math.sin(a) * L * .3); c.stroke(); }
    } else if (q.k === 'trail') {                                   // estela de estrellas del Súper Mortal
      for (let i = 0; i < 8; i++) { const k = i / 8; c.globalAlpha = (1 - k) * .8; c.fillStyle = RAINBOW[i % RAINBOW.length]; star(c, q.x - 60 * k * q.a * 3, q.y + 30 * k, 9 - k * 5, 3.5); c.fill(); }
    }
    c.restore();
  }
}
function fightBurst(F, x, y, big) {                                 // chispazo de impacto
  F.fx.push({ k: 'burst', x, y, t: 0, life: big ? .6 : .4, big: !!big });
  for (let i = 0; i < (big ? 14 : 7); i++) F.fx.push({ k: 'spark', x, y, vx: rand(-260, 260), vy: -rand(40, 280), t: 0, life: rand(.4, .8), col: pick(['#fff3b0', '#ffc83d', '#ff8a3d', '#fff']) });
}
function fightFloat(F, s, x, y, col, sz) { F.floats.push({ s, x, y, t: 0, life: 1.2, col, sz: sz || 26 }); }
function drawFightFx(c, F) {
  for (const f of F.fx) {
    const k = f.t / f.life;
    if (f.k === 'burst') {
      const r = (f.big ? 80 : 46) * (.4 + k * .9);
      c.save(); c.globalAlpha = 1 - k; c.fillStyle = '#fff3b0'; c.strokeStyle = P.ink; c.lineWidth = 3; star(c, f.x, f.y, r, r * .45, 9); c.fill(); c.stroke();
      c.fillStyle = '#ff8a3d'; star(c, f.x, f.y, r * .62, r * .28, 9); c.fill(); c.restore();
    } else if (f.k === 'spark') { c.fillStyle = f.col; c.globalAlpha = 1 - k; c.fillRect(f.x - 3, f.y - 3, 6, 6); c.globalAlpha = 1; }
  }
  for (const f of F.floats) {
    txt(c, f.s, f.x, f.y, { font: `400 ${f.sz}px ${FONT_DISPLAY}`, align: 'center', color: f.col, stroke: P.ink, sw: 6, alpha: clamp((1 - f.t / f.life) * 2.2, 0, 1) });
  }
}

/* ---------- escenarios de los cuatro restaurantes ---------- */
function poly(c, pts) { c.beginPath(); pts.forEach((p, i) => c[i ? 'lineTo' : 'moveTo'](p[0], p[1])); c.closePath(); }
function drawFightBack(c, R, t) {
  const L = -EX, T = -EY, Wd = CW, Fl = F_FLOOR - 36;                  // línea del piso al fondo
  c.save();
  if (R.id === 'coyote') {                                           // Viejo Oeste: atardecer, mesetas, cactus y cantina de madera
    let g = c.createLinearGradient(0, T, 0, Fl); g.addColorStop(0, '#ff9a4a'); g.addColorStop(.55, '#ffcf70'); g.addColorStop(1, '#ffe9a8'); c.fillStyle = g; c.fillRect(L, T, Wd, Fl - T);
    c.fillStyle = '#fff6c8'; c.beginPath(); c.arc(480, 250, 86, 0, 6.3); c.fill();
    c.fillStyle = '#b5532f'; poly(c, [[L, Fl], [L, 300], [90, 300], [120, 270], [250, 270], [280, 300], [330, 300], [350, 330], [330, Fl]]); c.fill();
    c.fillStyle = '#9a4326'; poly(c, [[560, Fl], [580, 320], [640, 320], [660, 290], [800, 290], [820, 330], [Wd + L, 330], [Wd + L, Fl]]); c.fill();
    c.fillStyle = '#6b3a1e'; c.strokeStyle = P.ink; c.lineWidth = 3; rr(c, 700, 238, 230, Fl - 238 + 20, 4); c.fill(); c.stroke();             // cantina
    c.fillStyle = '#8a5a2b'; poly(c, [[690, 238], [940, 238], [940, 205], [815, 190], [690, 205]]); c.fill(); c.stroke();
    c.fillStyle = '#17110c'; rr(c, 730, 270, 56, 90, 3); c.fill(); rr(c, 850, 270, 56, 90, 3); c.fill();
    c.fillStyle = '#c98b4e'; rr(c, 775, 215, 80, 22, 4); c.fill(); c.stroke(); txt(c, 'EL COYOTE', 815, 232, { font: `400 14px ${FONT_DISPLAY}`, align: 'center', color: '#fff3b0', maxW: 70 });
    c.fillStyle = '#c98b4e'; rr(c, 790, 300, 25, 60, 3); c.fill(); rr(c, 820, 300, 25, 60, 3); c.fill();                                          // puertas de batiente
    c.fillStyle = '#2f8f4e'; for (const cx of [90, 600]) { rr(c, cx - 9, Fl - 120, 18, 130, 9); c.fill(); c.stroke(); rr(c, cx - 36, Fl - 90, 14, 52, 7); c.fill(); c.stroke(); rr(c, cx + 22, Fl - 100, 14, 56, 7); c.fill(); c.stroke(); }
    g = c.createLinearGradient(0, Fl, 0, 600); g.addColorStop(0, '#e8c27a'); g.addColorStop(1, '#b8863e'); c.fillStyle = g; c.fillRect(L, Fl, Wd, 600 - Fl + EY);
    const tx = ((t * 70) % 1300) - 120; c.save(); c.translate(tx, Fl + 40); c.rotate(t * 5); c.strokeStyle = '#7a5a2a'; c.lineWidth = 2.4; c.beginPath(); c.arc(0, 0, 17, 0, 6.3); for (let i = 0; i < 5; i++) { c.moveTo(0, 0); c.lineTo(Math.cos(i * 1.26) * 17, Math.sin(i * 1.26) * 17); } c.stroke(); c.restore();
  } else if (R.id === 'gallos') {                                    // cantina de mariachi: pared turquesa, arcos, papel picado, piso de damero
    let g = c.createLinearGradient(0, T, 0, Fl); g.addColorStop(0, '#0e5a66'); g.addColorStop(1, '#17a2b0'); c.fillStyle = g; c.fillRect(L, T, Wd, Fl - T);
    c.fillStyle = 'rgba(0,0,0,.2)'; for (const ax of [150, 480, 810]) { c.beginPath(); c.moveTo(ax - 90, Fl); c.lineTo(ax - 90, 250); c.arc(ax, 250, 90, Math.PI, 0); c.lineTo(ax + 90, Fl); c.closePath(); c.fill(); }
    c.strokeStyle = P.ink; c.lineWidth = 3; for (const [y0, y1] of [[96, 120], [136, 160]]) { c.beginPath(); c.moveTo(L, y0); c.quadraticCurveTo(480, y1 + 30, Wd + L, y0); c.stroke(); }
    const cols = ['#e0364a', '#ffc83d', '#ff5fa2', '#2fbf71', '#ff8a3d', '#8b5cf6'];
    for (let i = 0; i < 22; i++) { const x = L + 20 + i * (Wd / 21.5), k = i / 21.5, y = 96 + Math.sin(k * Math.PI) * 38 + 4, sw = Math.sin(t * 2 + i) * 2; c.fillStyle = cols[i % cols.length]; c.strokeStyle = P.ink; c.lineWidth = 1.6; poly(c, [[x - 11, y], [x + 11, y], [x + 9 + sw, y + 26], [x + sw, y + 20], [x - 9 + sw, y + 26]]); c.fill(); c.stroke(); }
    c.fillStyle = '#17110c'; rr(c, 395, 200, 170, 44, 8); c.fill(); c.lineWidth = 3; c.strokeStyle = '#ff5fa2'; c.stroke(); txt(c, 'CANTINA', 480, 232, { font: `400 30px ${FONT_DISPLAY}`, align: 'center', color: '#ff9acb', maxW: 150 });
    c.fillStyle = '#e0364a'; c.strokeStyle = P.ink; c.lineWidth = 3; c.beginPath(); c.ellipse(70, 262, 56, 14, 0, 0, 6.3); c.fill(); c.stroke(); c.fillStyle = '#ffc83d'; c.beginPath(); c.ellipse(70, 252, 22, 18, 0, Math.PI, 0); c.fill(); c.stroke();    // sombrero en la pared
    for (let r = 0; r < 6; r++) for (let q = -1; q < 20; q++) { c.fillStyle = (q + r) % 2 ? '#e8d9b0' : '#b88a4a'; const y0 = Fl + r * r * 4 + r * 16, y1 = Fl + (r + 1) * (r + 1) * 4 + (r + 1) * 16, w0 = 52 + r * 8, w1 = 52 + (r + 1) * 8, x0 = 480 + (q - 9.5) * w0, x1 = 480 + (q - 9.5) * w1; poly(c, [[x0, y0], [x0 + w0, y0], [x1 + w1, y1], [x1, y1]]); c.fill(); }
    c.fillStyle = '#7a4a1e'; c.strokeStyle = P.ink; c.lineWidth = 3; for (const bx of [880, 100]) { rr(c, bx - 30, Fl - 40, 60, 66, 8); c.fill(); c.stroke(); c.strokeStyle = '#3a2410'; c.beginPath(); c.moveTo(bx - 30, Fl - 20); c.lineTo(bx + 30, Fl - 20); c.moveTo(bx - 30, Fl + 6); c.lineTo(bx + 30, Fl + 6); c.stroke(); c.strokeStyle = P.ink; }
  } else if (R.id === 'lowrider') {                                  // noche de barrio: ciudad, muro con grafiti, neón y un lowrider
    let g = c.createLinearGradient(0, T, 0, Fl); g.addColorStop(0, '#120a2a'); g.addColorStop(1, '#4a2060'); c.fillStyle = g; c.fillRect(L, T, Wd, Fl - T);
    c.fillStyle = '#fff6d0'; c.beginPath(); c.arc(820, 120, 40, 0, 6.3); c.fill(); c.fillStyle = '#4a2060'; c.beginPath(); c.arc(836, 112, 36, 0, 6.3); c.fill();
    c.fillStyle = '#1a1030'; for (let i = 0; i < 12; i++) { const bx = L + i * (Wd / 11) - 20, bh = 90 + (i * 37 % 70); c.fillRect(bx, Fl - 120 - bh + 40, 70, bh + 80); c.fillStyle = (i % 3) ? '#ffd23a' : '#5fe8ff'; for (let k = 0; k < 6; k++) if ((i * 7 + k * 3) % 5 > 1) c.fillRect(bx + 10 + (k % 3) * 20, Fl - 100 - bh + 40 + Math.floor(k / 3) * 26, 8, 12); c.fillStyle = '#1a1030'; }
    c.fillStyle = '#7a2f2f'; c.fillRect(L, 260, Wd, Fl - 260); c.strokeStyle = 'rgba(0,0,0,.28)'; c.lineWidth = 2; for (let y = 260; y < Fl; y += 22) { c.beginPath(); c.moveTo(L, y); c.lineTo(Wd + L, y); c.stroke(); for (let x = L + ((y / 22 | 0) % 2) * 28; x < Wd + L; x += 56) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 22); c.stroke(); } }
    c.lineWidth = 6; c.lineCap = 'round'; [['#5fe8ff', 120, 300, 90, 340], ['#ffd23a', 220, 330, 40, 300], ['#ff5fa2', 760, 310, 80, 360], ['#9af0b8', 860, 290, 60, 330]].forEach(([col, x, y, dx, dy]) => { c.strokeStyle = col; c.beginPath(); c.moveTo(x, y); c.bezierCurveTo(x + dx, y - 40, x - dx, y + 40, x + dx * 1.2, dy); c.stroke(); });
    const fl = .8 + .2 * Math.sin(t * 7); c.save(); c.shadowColor = '#ff3d8b'; c.shadowBlur = 16 * fl; c.fillStyle = '#17110c'; rr(c, 380, 268, 200, 52, 8); c.fill(); c.lineWidth = 4; c.strokeStyle = `rgba(255,95,162,${fl})`; c.stroke(); txt(c, 'EL FLACO', 480, 306, { font: `400 34px ${FONT_DISPLAY}`, align: 'center', color: `rgba(255,170,210,${fl})`, maxW: 180 }); c.restore();
    c.fillStyle = '#6a2fb8'; c.strokeStyle = P.ink; c.lineWidth = 3; rr(c, 20, Fl - 36, 190, 40, 14); c.fill(); c.stroke(); poly(c, [[60, Fl - 36], [84, Fl - 70], [150, Fl - 70], [176, Fl - 36]]); c.fill(); c.stroke();     // lowrider
    c.fillStyle = '#a8d8f0'; poly(c, [[90, Fl - 40], [102, Fl - 64], [146, Fl - 64], [160, Fl - 40]]); c.fill(); c.fillStyle = '#c9ceda'; for (const wx of [60, 170]) { c.beginPath(); c.arc(wx, Fl + 2, 15, 0, 6.3); c.fill(); c.stroke(); c.fillStyle = '#17171c'; c.beginPath(); c.arc(wx, Fl + 2, 7, 0, 6.3); c.fill(); c.fillStyle = '#c9ceda'; }
    c.fillStyle = 'rgba(255,95,162,.35)'; c.beginPath(); c.ellipse(115, Fl + 14, 100, 10, 0, 0, 6.3); c.fill();
    g = c.createLinearGradient(0, Fl, 0, 600); g.addColorStop(0, '#3a3a46'); g.addColorStop(1, '#202028'); c.fillStyle = g; c.fillRect(L, Fl, Wd, 600 - Fl + EY);
    c.fillStyle = '#ffd23a'; for (let x = L - 40 + ((t * 20) % 160); x < Wd + L; x += 160) c.fillRect(x, Fl + 78, 90, 7);
  } else {                                                           // dojo bajo los cerezos
    let g = c.createLinearGradient(0, T, 0, Fl); g.addColorStop(0, '#ffc9dd'); g.addColorStop(1, '#fff0e6'); c.fillStyle = g; c.fillRect(L, T, Wd, Fl - T);
    c.fillStyle = '#fff'; c.beginPath(); c.arc(480, 170, 62, 0, 6.3); c.fill(); c.fillStyle = 'rgba(224,54,74,.18)'; c.beginPath(); c.arc(480, 170, 62, 0, 6.3); c.fill();
    c.fillStyle = '#9a7ab0'; poly(c, [[300, Fl], [430, 190], [480, 160], [530, 190], [660, Fl]]); c.fill(); c.fillStyle = '#fff'; poly(c, [[440, 182], [480, 160], [520, 182], [500, 192], [480, 184], [460, 192]]); c.fill();
    c.fillStyle = '#f6ecd6'; c.strokeStyle = P.ink; c.lineWidth = 3; rr(c, 560, 200, 360, Fl - 200, 4); c.fill(); c.stroke();                                      // paredes de papel (shoji)
    c.strokeStyle = '#6b4423'; c.lineWidth = 3; for (let i = 1; i < 6; i++) { c.beginPath(); c.moveTo(560 + i * 60, 200); c.lineTo(560 + i * 60, Fl); c.stroke(); } for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(560, 200 + i * (Fl - 200) / 4); c.lineTo(920, 200 + i * (Fl - 200) / 4); c.stroke(); }
    c.fillStyle = '#b7233a'; poly(c, [[540, 206], [940, 206], [900, 176], [580, 176]]); c.fill(); c.strokeStyle = P.ink; c.stroke();
    c.fillStyle = '#e0364a'; c.fillRect(70, Fl - 190, 14, 190); c.fillRect(226, Fl - 190, 14, 190); c.fillRect(46, Fl - 200, 218, 16); c.fillRect(64, Fl - 168, 180, 10); c.strokeStyle = P.ink; c.lineWidth = 2; c.strokeRect(46, Fl - 200, 218, 16);      // torii
    c.fillStyle = '#6b4423'; c.fillRect(300, Fl - 150, 18, 150); c.fillStyle = '#ff9ac0'; for (const [x, y, r] of [[310, Fl - 190, 52], [270, Fl - 160, 38], [352, Fl - 160, 40], [310, Fl - 140, 34]]) { c.beginPath(); c.arc(x, y, r, 0, 6.3); c.fill(); }
    for (const x of [420, 940]) { c.strokeStyle = P.ink; c.lineWidth = 2; c.beginPath(); c.moveTo(x, 90); c.lineTo(x, 120); c.stroke(); c.fillStyle = '#e0364a'; c.beginPath(); c.ellipse(x, 140, 18, 24, 0, 0, 6.3); c.fill(); c.stroke(); c.fillStyle = '#ffd23a'; c.fillRect(x - 8, 130, 16, 3); }
    g = c.createLinearGradient(0, Fl, 0, 600); g.addColorStop(0, '#d8c28a'); g.addColorStop(1, '#a8935a'); c.fillStyle = g; c.fillRect(L, Fl, Wd, 600 - Fl + EY);
    c.strokeStyle = 'rgba(70,50,20,.5)'; c.lineWidth = 2; for (let r = 0; r < 5; r++) { const y = Fl + r * r * 5 + r * 14; c.beginPath(); c.moveTo(L, y); c.lineTo(Wd + L, y); c.stroke(); } for (let q = -12; q < 13; q++) { c.beginPath(); c.moveTo(480 + q * 40, Fl); c.lineTo(480 + q * 110, 600 + EY); c.stroke(); }
    for (let i = 0; i < 26; i++) { const sp = 24 + hash(i + 5) * 30, x = ((hash(i) * (Wd + 200) + t * sp * .6 + Math.sin(t + i) * 20) % (Wd + 100)) + L - 50, y = ((hash(i + 40) * 560 + t * sp) % 600); c.save(); c.translate(x, y); c.rotate(t * 2 + i); c.fillStyle = '#ffb3d1'; c.beginPath(); c.ellipse(0, 0, 6, 3.4, 0, 0, 6.3); c.fill(); c.restore(); }
  }
  c.restore();
}

/* ---------- iconos: técnica (animada), restaurante rival y mapa ---------- */
function drawMoveScene(c, key, x, y, bw, bh, t) {                 // la técnica en miniatura: los dos luchadores repiten su animación (de u = 0 a 1, con una pausa)
  const k = bw / 470, u = clamp(((t * .6) % 1.5) / 1.25, 0, 1), f = MOVE_FRAME(key, u), fy = y + bh * .36;
  c.save(); rr(c, x - bw / 2, y - bh / 2, bw, bh, 9); c.clip();
  const g = c.createLinearGradient(0, y - bh / 2, 0, y + bh / 2); g.addColorStop(0, '#3a3748'); g.addColorStop(1, '#1b1a24'); c.fillStyle = g; c.fillRect(x - bw / 2, y - bh / 2, bw, bh);
  c.fillStyle = '#5a5668'; c.fillRect(x - bw / 2, fy, bw, bh);
  const fig = (who, fr) => {
    const look = who === 'p' ? LUCHADORES.novato : LUCHADORES.sheriff, sc = F_SC * k, bx = x + ((who === 'p' ? F_PX : F_EX) + (fr.x || 0) - 480) * k, z = (fr.z || 0) * k;
    c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(bx, fy + 1, 22 * sc * .5, 5 * sc * .5, 0, 0, 6.3); c.fill();
    c.save(); c.translate(bx, fy - z); if (fr.rot) { c.translate(0, -34 * sc); c.rotate(fr.rot); c.translate(0, 34 * sc); }
    drawLuchador(c, 0, 0, Object.assign({}, look, { state: fr.state || 'idle', t: t * 3, dir: who === 'p' ? 1 : -1, scale: sc, pose: fr.pose || null })); c.restore();
  };
  fig('e', f.e); fig('p', f.p);
  c.restore();
}
function drawMoveIcon(c, key, x, y, w) {                            // ícono de la tienda: el luchador en la postura de la técnica, con un chispazo de impacto
  const M = MOVES[key], f = MOVE_FRAME(key, M.hits[0] + Math.sin(w.t * 5) * .03), fr = f.p, sc = .56;
  c.save(); rr(c, x - 29, y - 29, 58, 58, 11); c.clip();
  const g = c.createLinearGradient(0, y - 29, 0, y + 29); g.addColorStop(0, '#3a3748'); g.addColorStop(1, '#1b1a24'); c.fillStyle = g; c.fillRect(x - 30, y - 30, 60, 60);
  c.fillStyle = '#ffd23a'; c.strokeStyle = P.ink; c.lineWidth = 1.4; star(c, x + 17, y - 14, 10, 4.4, 7); c.fill(); c.stroke();
  c.save(); c.translate(x - 4, y + 22); if (fr.rot) { c.translate(0, -34 * sc); c.rotate(fr.rot); c.translate(0, 34 * sc); }
  drawLuchador(c, 0, fr.rot ? -10 : 0, Object.assign({}, LUCHADORES.novato, { state: 'idle', t: w.t, dir: 1, scale: sc, pose: fr.pose || 'punch' })); c.restore();
  c.restore();
  c.lineWidth = 2; c.strokeStyle = P.violet; rr(c, x - 30, y - 30, 60, 60, 12); c.stroke();
}
function drawRivalIcon(c, id, x, y, s) {                            // edificio de cada restaurante rival (60 x 60 a escala 1)
  c.save(); c.translate(x, y); c.scale(s, s); c.lineJoin = 'round'; c.lineWidth = 2; c.strokeStyle = P.ink;
  if (id === 'coyote') {                                            // cantina de madera con fachada falsa y cactus
    c.fillStyle = '#a8703a'; rr(c, -22, -6, 44, 28, 2); c.fill(); c.stroke(); c.fillStyle = '#c98b4e'; poly(c, [[-18, -6], [-18, -20], [0, -26], [18, -20], [18, -6]]); c.fill(); c.stroke();
    c.fillStyle = '#2b1a0e'; rr(c, -7, 6, 14, 16, 1); c.fill(); c.fillStyle = '#ffd23a'; star(c, 0, -14, 5, 2.2); c.fill(); c.stroke();
    c.fillStyle = '#2f8f4e'; rr(c, 22, -4, 7, 26, 3); c.fill(); c.stroke(); rr(c, 16, 4, 6, 10, 3); c.fill(); c.stroke();
  } else if (id === 'gallos') {                                     // cantina turquesa con arco, papel picado y sombrero
    c.fillStyle = '#17a2b0'; rr(c, -24, -8, 48, 30, 2); c.fill(); c.stroke(); c.fillStyle = '#2b1a0e'; c.beginPath(); c.moveTo(-8, 22); c.lineTo(-8, 6); c.arc(0, 6, 8, Math.PI, 0); c.lineTo(8, 22); c.closePath(); c.fill(); c.stroke();
    ['#e0364a', '#ffc83d', '#ff5fa2', '#2fbf71', '#ff8a3d'].forEach((col, i) => { c.fillStyle = col; poly(c, [[-24 + i * 10, -8], [-15 + i * 10, -8], [-19.5 + i * 10, 2]]); c.fill(); c.stroke(); });
    c.fillStyle = '#17171c'; c.beginPath(); c.ellipse(0, -14, 20, 5, 0, 0, 6.3); c.fill(); c.stroke(); c.beginPath(); c.ellipse(0, -19, 9, 8, 0, Math.PI, 0); c.fill(); c.stroke(); c.fillStyle = '#ffc83d'; c.fillRect(-9, -18, 18, 2.4);
  } else if (id === 'lowrider') {                                   // lowrider morado con rines y neón
    c.fillStyle = 'rgba(255,95,162,.4)'; c.beginPath(); c.ellipse(0, 24, 28, 5, 0, 0, 6.3); c.fill();
    c.fillStyle = '#6a2fb8'; rr(c, -27, 0, 54, 18, 7); c.fill(); c.stroke(); poly(c, [[-14, 0], [-8, -12], [10, -12], [18, 0]]); c.fill(); c.stroke();
    c.fillStyle = '#a8d8f0'; poly(c, [[-9, -1], [-5, -9], [8, -9], [13, -1]]); c.fill(); c.stroke();
    c.fillStyle = '#c9ceda'; for (const wx of [-15, 15]) { c.beginPath(); c.arc(wx, 18, 7, 0, 6.3); c.fill(); c.stroke(); c.fillStyle = '#17171c'; c.beginPath(); c.arc(wx, 18, 3, 0, 6.3); c.fill(); c.fillStyle = '#c9ceda'; }
    c.fillStyle = '#ffd23a'; c.fillRect(22, 4, 4, 4);
  } else {                                                          // pagoda de tres techos
    c.fillStyle = '#fff0d6'; rr(c, -14, 4, 28, 20, 1); c.fill(); c.stroke(); c.fillStyle = '#b7233a';
    poly(c, [[-26, 6], [26, 6], [18, -2], [-18, -2]]); c.fill(); c.stroke(); poly(c, [[-20, -4], [20, -4], [13, -12], [-13, -12]]); c.fill(); c.stroke(); poly(c, [[-14, -14], [14, -14], [0, -26]]); c.fill(); c.stroke();
    c.fillStyle = '#2b1a0e'; rr(c, -4, 12, 8, 12, 1); c.fill(); c.fillStyle = '#ff9ac0'; for (const [bx, by] of [[-24, 18], [-18, 10], [24, 20], [20, 12]]) { c.beginPath(); c.arc(bx, by, 4, 0, 6.3); c.fill(); }
  }
  c.restore();
}
function drawMapIcon(c, x, y, s) {                                  // pergamino con un camino punteado y una X roja
  c.save(); c.translate(x, y); c.scale(s, s); c.lineJoin = 'round'; c.lineWidth = 2; c.strokeStyle = P.ink;
  c.fillStyle = '#f0dca0'; poly(c, [[-22, -16], [-8, -20], [8, -15], [22, -19], [22, 17], [8, 21], [-8, 16], [-22, 20]]); c.fill(); c.stroke();
  c.strokeStyle = 'rgba(90,60,20,.45)'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(-8, -19); c.lineTo(-8, 16); c.moveTo(8, -15); c.lineTo(8, 21); c.stroke();
  c.strokeStyle = '#b5482f'; c.lineWidth = 2; c.setLineDash([3, 3]); c.beginPath(); c.moveTo(-15, 10); c.quadraticCurveTo(-4, -6, 6, 4); c.quadraticCurveTo(12, 8, 16, -6); c.stroke(); c.setLineDash([]);
  c.strokeStyle = '#e0364a'; c.lineWidth = 3.4; c.lineCap = 'round'; c.beginPath(); c.moveTo(12, -11); c.lineTo(20, -3); c.moveTo(20, -11); c.lineTo(12, -3); c.stroke();
  c.restore();
}
/* ---------- Lógica de la pelea ---------- */
function startFight(w, R) {
  const hp = fighterHp(w);
  w.modal = 'fight'; w.panel = false; w.map = null;
  w.fight = { id: R.id, R, t: 0, pt: 0, phase: 'intro', hp, hpMax: hp, ehp: R.hp, ehpMax: R.hp, en: FIGHT_EN.max, guard: false, stun: 0, weak: 0, serums: FIGHT_EN.serums, turn: 1,
    sel: null, tm: null, anim: null, fx: [], floats: [], shake: 0, result: null, msg: '', lastPick: -1 };
  sfx('bell');
}
const FB = { x0: 24, y0: 468, bw: 146, bh: 44, gx: 7, gy: 6, cols: 6 };
function fightActions(w, F) {                                      // técnicas que ya aprendiste + cubrirse + suero
  const acts = MOVE_IDS.filter(k => hasMove(w, k)).map(k => ({ id: k, kind: 'move', label: MOVES[k].name, sub: MOVES[k].cost ? `daño ${MOVES[k].dmg} · energía ${MOVES[k].cost}` : `daño ${MOVES[k].dmg} · gratis`, off: MOVES[k].cost > F.en, style: 'red' }));
  acts.push({ id: 'guard', kind: 'guard', label: 'CUBRIRSE', sub: `+${FIGHT_EN.guard} energía · golpe -60 %`, off: false, style: 'teal' });
  acts.push({ id: 'serum', kind: 'serum', label: 'SUERO', sub: `cura ${Math.round(FIGHT_EN.serum * 100)} % · quedan ${F.serums}`, off: F.serums <= 0 || F.hp >= F.hpMax, style: 'green' });
  return acts.map((a, i) => Object.assign(a, { x: FB.x0 + (i % FB.cols) * (FB.bw + FB.gx), y: FB.y0 + Math.floor(i / FB.cols) * (FB.bh + FB.gy), w: FB.bw, h: FB.bh, disabled: a.off }));
}
const FLEE_BTN = { x: 430, y: 58, w: 100, h: 28, label: 'HUIR', size: 14, style: 'dark' };
const TM_BAR = { x: 340, y: 336, w: 280, h: 28 };
function fightMarker(F) { const ph = (F.tm.t * F.tm.spd) % 2; return ph < 1 ? ph : 2 - ph; }
function fightPick(w, F, a) {
  if (a.kind === 'move') {
    const M = MOVES[a.id]; if (M.cost > F.en) { sfx('nope'); return; }
    F.en -= M.cost; F.sel = a.id; F.phase = 'timing'; F.pt = 0; F.tm = { t: 0, spd: .85 + F.R.diff * .06 + rand(0, .2), c: rand(.3, .7), max: 3.6 }; sfx('click');
  } else if (a.kind === 'guard') {
    F.guard = true; F.en = Math.min(FIGHT_EN.max, F.en + FIGHT_EN.guard); fightFloat(F, '¡CUBIERTO!', F_PX, F_FLOOR - 190, '#9ff0ff'); sfx('ready'); fightEnemyTurn(w, F);
  } else if (a.kind === 'serum') {
    if (F.serums <= 0 || F.hp >= F.hpMax) { sfx('nope'); return; }
    const heal = Math.min(F.hpMax - F.hp, Math.round(F.hpMax * FIGHT_EN.serum)); F.hp += heal; F.serums--; F.guard = false;
    fightFloat(F, `+${heal}`, F_PX, F_FLOOR - 190, '#9af0b8'); sfx('ready'); fightEnemyTurn(w, F);
  }
}
function fightResolve(w, F) {                                      // el jugador pulsó: ¿qué tan cerca del centro?
  const d = Math.abs(fightMarker(F) - F.tm.c), q = d <= .035 ? 'perfect' : d <= .11 ? 'good' : 'miss', M = MOVES[F.sel];
  const mult = q === 'perfect' ? 1.5 : q === 'good' ? 1 : .5, lvB = 1 + Math.max(0, w.level - M.level) * .012;
  F.tm.q = q; fightFloat(F, q === 'perfect' ? '¡PERFECTO!' : q === 'good' ? '¡BIEN!' : '¡FALLASTE!', F_PX + 20, F_FLOOR - 200, q === 'perfect' ? '#ffd23a' : q === 'good' ? '#9af0b8' : '#ff8fa0', 30);
  sfx(q === 'perfect' ? 'ding' : q === 'good' ? 'ready' : 'nope');
  const total = Math.max(1, Math.round(M.dmg * mult * lvB));
  F.anim = { who: 'p', key: F.sel, dur: M.dur, hits: M.hits, done: M.hits.map(() => false), total, left: total, t: 0 }; F.phase = 'pAnim'; F.pt = 0;
  sfx('whoosh');
}
function fightEnemyTurn(w, F) {
  if (F.stun > 0) { F.stun--; fightFloat(F, 'ATURDIDO', F_EX, F_FLOOR - 200, '#ffe27a', 24); F.phase = 'eWait'; F.pt = 0; F.anim = null; return; }
  const R = F.R, tot = R.atk.reduce((s, a) => s + a.w, 0); let r = Math.random() * tot, atk = R.atk[0];
  for (const a of R.atk) { r -= a.w; if (r <= 0) { atk = a; break; } }
  let dmg = atk.d * rand(.9, 1.1) * (F.weak > 0 ? .5 : 1) * (F.guard ? .4 : 1) * (1 + R.diff * 0); dmg = Math.max(1, Math.round(dmg));
  F.anim = { who: 'e', atk, kind: atk.k, dur: ATK_DUR[atk.k], dmg, done: false, t: 0 }; F.phase = 'eAnim'; F.pt = 0;
  fightFloat(F, atk.n.toUpperCase(), F_EX, F_FLOOR - 214, '#ff8fa0', 22); sfx('whoosh');
}
function fightAfterEnemy(w, F) {
  F.guard = false; F.turn++; F.en = Math.min(FIGHT_EN.max, F.en + FIGHT_EN.regen); F.phase = 'choose'; F.pt = 0; F.anim = null;
}
function fightWin(w, F) {                                          // ¡le ganaste al jefe!: estrellas, dinero, gemas y un mesero
  const R = F.R; F.phase = 'win'; F.pt = 0; F.anim = null;
  const before = starsOf(w), had = w.staff.some(m => m.id === R.waiter);
  w.conq[R.id] = true; w.stars = clamp(Math.round((before + R.stars) * 2) / 2, STAR_START, STAR_MAX);
  w.money += R.money; w.gems += R.gems; if (R.gems) w.gemsSeen = true;
  if (!had) w.staff.push(makeStaff(R.waiter, true, w.staff.length));
  F.result = { win: true, stars: w.stars - before, now: w.stars, money: R.money, gems: R.gems, waiter: had ? null : R.waiter };
  addXp(w, Math.round(R.money * .4));
  sfx('fanfare'); Game.save();
}
function fightLose(w, F) {
  F.phase = 'lose'; F.pt = 0; F.anim = null;
  const loss = Math.min(Math.round(w.money * .12), 2500); w.money -= loss; w.fightLock[F.R.id] = w.day; w.rep = clamp(w.rep - .5, 0, 5);
  F.result = { win: false, loss };
  sfx('over'); Game.save();
}
function fightClose(w, toMap) { w.fight = null; w.modal = null; if (toMap) openMap(w); }
function updateFight(w, dt) {
  const F = w.fight; if (!F) return;
  F.t += dt; F.pt += dt; if (F.shake > 0) F.shake = Math.max(0, F.shake - dt * 2.2);
  F.fx.forEach(f => { f.t += dt; if (f.k === 'spark') { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 700 * dt; } }); F.fx = F.fx.filter(f => f.t < f.life);
  F.floats.forEach(f => { f.t += dt; f.y -= 34 * dt; }); F.floats = F.floats.filter(f => f.t < f.life);
  if (F.phase === 'intro') { if (F.pt > 1.9) { F.phase = 'choose'; F.pt = 0; } }
  else if (F.phase === 'timing') { F.tm.t += dt; if (F.tm.t >= F.tm.max) { fightFloat(F, '¡Muy lento!', F_PX, F_FLOOR - 190, '#ff8fa0', 24); fightResolveMiss(w, F); } }
  else if (F.phase === 'pAnim') {
    const A = F.anim; A.t += dt; const u = A.t / A.dur, f = MOVE_FRAME(A.key, u);
    A.hits.forEach((h, i) => {
      if (A.done[i] || u < h) return; A.done[i] = true;
      const dmg = i === A.hits.length - 1 ? A.left : Math.round(A.total / A.hits.length); A.left -= dmg;
      F.ehp = Math.max(0, F.ehp - dmg); fightBurst(F, F_EX + (f.e.x || 0) - 30, F_FLOOR - (f.e.z || 0) - 90, A.key === 'supermortal' || A.key === 'quebradora');
      fightFloat(F, '-' + dmg, F_EX + (f.e.x || 0), F_FLOOR - (f.e.z || 0) - 150, '#fff3b0', 30); F.shake = Math.max(F.shake, A.key === 'golpe' ? .25 : .5); sfx('pum');
    });
    if (u >= 1) {
      const M = MOVES[A.key]; F.anim = null;
      if (F.ehp <= 0) { fightWin(w, F); return; }
      if (M.stun) { F.stun = Math.max(F.stun, M.stun); fightFloat(F, '¡ATURDIDO!', F_EX, F_FLOOR - 200, '#ffe27a', 28); }
      if (M.weak) { F.weak = Math.max(F.weak, M.weak); fightFloat(F, '¡DEBILITADO!', F_EX, F_FLOOR - 230, '#c4a2ff', 26); }
      fightEnemyTurn(w, F);
    }
  } else if (F.phase === 'eWait') { if (F.pt > .9) fightAfterEnemy(w, F); }
  else if (F.phase === 'eAnim') {
    const A = F.anim; A.t += dt; const u = A.t / A.dur, f = ATK_FRAME(A.kind, u);
    if (!A.done && u >= ATK_HIT[A.kind]) {
      A.done = true; F.hp = Math.max(0, F.hp - A.dmg); fightBurst(F, F_PX + (f.p.x || 0) + 30, F_FLOOR - (f.p.z || 0) - 90, false);
      fightFloat(F, (F.guard ? '(cubierto) -' : '-') + A.dmg, F_PX + (f.p.x || 0), F_FLOOR - (f.p.z || 0) - 150, F.guard ? '#9ff0ff' : '#ff6b6b', 28); F.shake = Math.max(F.shake, F.guard ? .2 : .45); sfx(ATK_SND[A.kind]);
    }
    if (u >= 1) { if (F.weak > 0) F.weak--; F.anim = null; if (F.hp <= 0) fightLose(w, F); else fightAfterEnemy(w, F); }
  } else if (F.phase === 'win' || F.phase === 'lose') { if (F.pt > 1.8) { F.phase = 'result'; F.pt = 0; } }
}
function fightResolveMiss(w, F) {                                  // se acabó el tiempo sin pulsar: el golpe sale flojo
  F.tm.q = 'miss'; const M = MOVES[F.sel], lvB = 1 + Math.max(0, w.level - M.level) * .012, total = Math.max(1, Math.round(M.dmg * .5 * lvB));
  F.anim = { who: 'p', key: F.sel, dur: M.dur, hits: M.hits, done: M.hits.map(() => false), total, left: total, t: 0 }; F.phase = 'pAnim'; F.pt = 0; sfx('whoosh');
}
function fightFrames(w, F) {                                       // dónde y cómo está cada luchador en este cuadro
  let fr = { p: {}, e: {}, props: [] };
  if (F.phase === 'intro') { const k = 1 - smooth(clamp(F.pt / 1.4, 0, 1)); fr.p = { x: -k * 440, state: k > 0 ? 'walk' : 'idle' }; fr.e = { x: k * 440, state: k > 0 ? 'walk' : 'idle' }; }
  else if (F.phase === 'pAnim') { const A = F.anim, f = MOVE_FRAME(A.key, A.t / A.dur); fr = f; }
  else if (F.phase === 'eAnim') { const A = F.anim, f = ATK_FRAME(A.kind, A.t / A.dur); fr = f; if (F.guard && fr.p.pose === 'hit') fr.p = Object.assign({}, fr.p, { pose: 'guard' }); }
  else if (F.phase === 'win' || F.phase === 'lose' || F.phase === 'result') {
    const win = F.result ? F.result.win : F.phase === 'win', jump = Math.abs(Math.sin(F.t * 6)) * 22;
    if (win) { fr.p = { pose: 'flex', z: jump }; fr.e = { pose: 'down', rot: 1.5, x: 40 }; } else { fr.e = { pose: 'flex', z: jump }; fr.p = { pose: 'down', rot: -1.5, x: -40 }; }
  } else {
    if (F.guard) fr.p.pose = 'guard';
    if (F.stun > 0) fr.e.pose = 'hit';
  }
  if (F.hp / F.hpMax < .3 && F.phase !== 'result' && F.phase !== 'lose' && !fr.p.pose) fr.p.angry = true;
  return fr;
}
/* ---------- Dibujo de la pelea ---------- */
function fightBar(c, x, y, wd, h, r, mirror, cols) {
  rr(c, x - 3, y - 3, wd + 6, h + 6, h / 2 + 3); c.fillStyle = P.ink; c.fill(); c.lineWidth = 2; c.strokeStyle = P.white; c.stroke();
  rr(c, x, y, wd, h, h / 2); c.fillStyle = '#2f2c37'; c.fill();
  if (r > 0) { const fw = Math.max(h, wd * r), fx = mirror ? x + wd - fw : x; rr(c, fx, y, fw, h, h / 2); const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, cols[0]); g.addColorStop(1, cols[1]); c.fillStyle = g; c.fill(); c.fillStyle = 'rgba(255,255,255,.28)'; rr(c, fx + 3, y + 2, fw - 6, h * .3, 3); c.fill(); }
}
function drawFight(c, w) {
  const F = w.fight; if (!F) return;
  const R = F.R, fr = fightFrames(w, F);
  c.fillStyle = P.night; c.fillRect(-EX, -EY, CW, CH);
  c.save();
  if (F.shake > 0) c.translate(rand(-1, 1) * F.shake * 14, rand(-1, 1) * F.shake * 14);
  drawFightBack(c, R, F.t);
  (F.anim && F.anim.who === 'e' ? ['p', 'e'] : ['e', 'p']).forEach(k => drawFighter(c, F, w, k, fr[k]));
  drawProps(c, fr.props, F.t);
  if (F.stun > 0 && F.phase !== 'result') { c.fillStyle = '#ffe27a'; c.strokeStyle = P.ink; c.lineWidth = 1.6; for (let k = 0; k < 4; k++) { const a = F.t * 5 + k * 1.57; star(c, F_EX + Math.cos(a) * 34, F_FLOOR - 205 * (R.look === 'sheriff' ? 1.06 : 1) + Math.sin(a) * 8, 8, 3.4); c.fill(); c.stroke(); } }
  drawFightFx(c, F);
  c.restore();
  // ----- tablero de arriba: vida de los dos, energía y turno -----
  c.fillStyle = 'rgba(8,8,12,.55)'; c.fillRect(-EX, -EY, CW, 96 + EY);
  txt(c, `EL NOVATO · NIV ${w.level}`, 24, 20, { font: `700 15px ${FONT_UI}`, color: P.white, stroke: P.ink, sw: 4, ls: 1, maxW: 260 });
  fightBar(c, 24, 28, 380, 20, F.hp / F.hpMax, false, F.hp / F.hpMax > .5 ? ['#5ef09a', '#1d9d57'] : F.hp / F.hpMax > .25 ? ['#ffe27a', '#e29a12'] : ['#ff7a8c', '#c4272f']);
  txt(c, `${Math.ceil(F.hp)} / ${F.hpMax}`, 214, 43.5, { font: `700 14px ${FONT_UI}`, align: 'center', color: P.white, stroke: P.ink, sw: 4 });
  txt(c, 'ENERGÍA', 24, 70, { font: `700 11px ${FONT_UI}`, color: '#9ff0ff', stroke: P.ink, sw: 3, ls: 1.5 });
  fightBar(c, 82, 59, 200, 12, F.en / FIGHT_EN.max, false, ['#7be8ff', '#2f8cff']);
  for (let i = 0; i < FIGHT_EN.serums; i++) { const x = 308 + i * 24, on = i < F.serums; c.save(); c.globalAlpha = on ? 1 : .28; c.fillStyle = '#2fbf71'; c.strokeStyle = P.ink; c.lineWidth = 1.6; c.beginPath(); c.arc(x, 65, 9, 0, 6.3); c.fill(); c.stroke(); c.fillStyle = P.white; c.fillRect(x - 5, 63.2, 10, 3.6); c.fillRect(x - 1.8, 59.6, 3.6, 10.8); c.restore(); }
  txt(c, 'SUERO', 331, 86, { font: `700 10px ${FONT_UI}`, align: 'center', color: '#9af0b8', stroke: P.ink, sw: 3, ls: 1 });
  txt(c, R.boss.toUpperCase(), 936, 20, { font: `700 15px ${FONT_UI}`, align: 'right', color: P.white, stroke: P.ink, sw: 4, ls: 1, maxW: 260 });
  fightBar(c, 556, 28, 380, 20, F.ehp / F.ehpMax, true, ['#ff8fa0', '#c4272f']);
  txt(c, `${Math.ceil(F.ehp)} / ${F.ehpMax}`, 746, 43.5, { font: `700 14px ${FONT_UI}`, align: 'center', color: P.white, stroke: P.ink, sw: 4 });
  txt(c, `TURNO ${F.turn}`, 480, 24, { font: `400 22px ${FONT_DISPLAY}`, align: 'center', color: P.white, stroke: P.ink, sw: 5, maxW: 120 });
  const chips = []; if (F.guard) chips.push(['CUBIERTO', '#9ff0ff']); if (F.stun > 0) chips.push(['RIVAL ATURDIDO', '#ffe27a']); if (F.weak > 0) chips.push(['RIVAL DÉBIL', '#c4a2ff']);
  chips.forEach((q, i) => txt(c, q[0], 936 - 0, 70 + i * 0, { font: `700 12px ${FONT_UI}`, align: 'right', color: q[1], stroke: P.ink, sw: 3, ls: 1 }));
  if (F.phase === 'choose' || F.phase === 'timing' || F.phase === 'pAnim' || F.phase === 'eAnim' || F.phase === 'eWait') {
    drawButton(c, Object.assign({}, FLEE_BTN, { disabled: F.phase !== 'choose' }));
    const acts = fightActions(w, F), on = F.phase === 'choose';
    const msg = F.phase === 'choose' ? '¡Elige tu técnica!' : F.phase === 'timing' ? '¡Pulsa en el momento justo!' : F.phase === 'eAnim' || F.phase === 'eWait' ? 'Turno del rival…' : '';
    if (msg) txt(c, msg, 480, 456, { font: `700 18px ${FONT_UI}`, align: 'center', color: P.white, stroke: P.ink, sw: 5, ls: 1.5 });
    acts.forEach((a, i) => drawButton(c, Object.assign({}, a, { disabled: a.disabled || !on }), UI.kb && on && i === F.cur));
    if (on) { const hv = acts.find(a => !a.disabled && UI.hit(a)); if (hv && hv.kind === 'move') txt(c, MOVES[hv.id].desc, 480, 100, { font: `600 15px ${FONT_UI}`, align: 'center', color: P.cream, stroke: P.ink, sw: 4, maxW: 420 }); }
  }
  if (F.phase === 'timing') drawTimingBar(c, F);
  if (F.phase === 'intro') {                                                       // cartel de entrada
    const a = clamp(F.pt / .4, 0, 1) * clamp((1.9 - F.pt) / .3, 0, 1), s0 = easeOutBack(clamp(F.pt / .5, 0, 1));
    c.save(); c.globalAlpha = a; c.translate(480, 240); c.scale(s0, s0);
    c.fillStyle = 'rgba(8,8,12,.78)'; c.fillRect(-EX - 480, -62, CW, 124); c.fillStyle = R.col; c.fillRect(-EX - 480, -66, CW, 5); c.fillRect(-EX - 480, 61, CW, 5);
    txt(c, '¡RETO EN', 0, -22, { font: `700 22px ${FONT_UI}`, align: 'center', color: P.cream, stroke: P.ink, sw: 5, ls: 4 });
    txt(c, R.name.toUpperCase() + '!', 0, 22, { font: `400 ${fitDisplay(c, R.name.toUpperCase() + '!', 800, 56)}px ${FONT_DISPLAY}`, align: 'center', color: P.white, stroke: P.ink, sw: 8 });
    txt(c, R.intro, 0, 50, { font: `600 18px ${FONT_UI}`, align: 'center', color: R.col, stroke: P.ink, sw: 4, maxW: 760 });
    c.restore();
  }
  if (F.phase === 'result') drawFightResult(c, w, F);
}
function drawTimingBar(c, F) {
  const B = TM_BAR, m = fightMarker(F), tm = F.tm, zw = B.w * .22, pw = B.w * .07;
  c.fillStyle = 'rgba(8,8,12,.78)'; rr(c, B.x - 18, B.y - 40, B.w + 36, 108, 14); c.fill(); c.lineWidth = 2.5; c.strokeStyle = P.white; c.stroke();
  txt(c, MOVES[F.sel].name.toUpperCase(), B.x + B.w / 2, B.y - 16, { font: `700 16px ${FONT_UI}`, align: 'center', color: P.gold, stroke: P.ink, sw: 4, ls: 2, maxW: B.w - 20 });
  rr(c, B.x, B.y, B.w, B.h, B.h / 2); c.fillStyle = '#2a2833'; c.fill(); c.lineWidth = 2; c.strokeStyle = 'rgba(255,255,255,.4)'; c.stroke();
  const cx = B.x + B.w * tm.c; c.save(); rr(c, B.x, B.y, B.w, B.h, B.h / 2); c.clip();
  c.fillStyle = '#2fbf71'; c.fillRect(cx - zw / 2, B.y, zw, B.h); c.fillStyle = '#ffd23a'; c.fillRect(cx - pw / 2, B.y, pw, B.h); c.restore();
  const mx = B.x + 6 + (B.w - 12) * m; c.fillStyle = P.white; c.strokeStyle = P.ink; c.lineWidth = 2.4; rr(c, mx - 4, B.y - 7, 8, B.h + 14, 3); c.fill(); c.stroke();
  txt(c, UI.touch ? 'Toca la pantalla' : 'Pulsa ESPACIO o haz clic', B.x + B.w / 2, B.y + 54, { font: `600 14px ${FONT_UI}`, align: 'center', color: P.cream, stroke: P.ink, sw: 4, maxW: B.w - 10 });
}
const FRES = { x: 230, y: 96, w: 500, h: 388 };
const FRES_BTN = { x: FRES.x + FRES.w / 2 - 110, y: FRES.y + FRES.h - 64, w: 220, h: 46, label: 'CONTINUAR', size: 22, style: 'green' };
function drawFightResult(c, w, F) {
  const R = F.R, Q = F.result, a = easeOutBack(clamp(F.pt / .4, 0, 1));
  c.fillStyle = 'rgba(8,8,12,.55)'; c.fillRect(-EX, -EY, CW, CH);
  c.save(); c.translate(480, 290); c.scale(a, a); c.translate(-480, -290);
  drawPanel(c, FRES.x, FRES.y, FRES.w, FRES.h, Q.win ? '¡VICTORIA!' : '¡DERROTA!');
  const cx = FRES.x + FRES.w / 2;
  if (Q.win) {
    txt(c, R.win, cx, FRES.y + 62, { font: `400 ${fitDisplay(c, R.win, 440, 22)}px ${FONT_DISPLAY}`, align: 'center', color: P.gold, stroke: P.ink, sw: 5 });
    const rows = [[`Estrellas de Sabor +${starTxt(Q.stars)}  →  ${starTxt(Q.now)} de 5`, P.gold], [`+${pesos(Q.money)} para tu caja`, '#9af0b8']];
    if (Q.gems) rows.push([`+${Q.gems} gemas`, '#9ff0ff']);
    rows.push(Q.waiter ? [`Se une a tu equipo: ${STAFF[Q.waiter].name}`, P.cream] : ['Ese mesero ya trabaja contigo', P.muted]);
    rows.forEach((q, i) => txt(c, q[0], FRES.x + 34, FRES.y + 112 + i * 34, { font: `700 21px ${FONT_UI}`, color: q[1], stroke: P.ink, sw: 4, maxW: 300 }));
    if (Q.waiter) { const L = LUCHADORES[STAFF[Q.waiter].look]; drawLuchador(c, FRES.x + FRES.w - 92, FRES.y + 232, Object.assign({}, L, { state: 'idle', t: w.t, dir: -1, scale: 1.9 })); txt(c, `Cobra ${pesos(STAFF[Q.waiter].wage)} por semana`, FRES.x + FRES.w - 92, FRES.y + 262, { font: `600 13px ${FONT_UI}`, align: 'center', color: P.muted, maxW: 150 }); }
    for (let i = 0; i < 5; i++) { const sx = cx - 100 + i * 50, f = clamp(Q.now - i, 0, 1); c.fillStyle = 'rgba(255,255,255,.14)'; star(c, sx, FRES.y + 300, 18, 8); c.fill(); if (f > 0) { c.save(); c.beginPath(); c.rect(sx - 20, FRES.y + 278, 40 * f, 44); c.clip(); c.fillStyle = P.gold; star(c, sx, FRES.y + 300, 18, 8); c.fill(); c.lineWidth = 2; c.strokeStyle = P.ink; c.stroke(); c.restore(); } }
  } else {
    txt(c, `${R.boss} te sacó del lugar`, cx, FRES.y + 70, { font: `400 ${fitDisplay(c, R.boss + ' te sacó del lugar', 440, 24)}px ${FONT_DISPLAY}`, align: 'center', color: '#ff8fa0', stroke: P.ink, sw: 5 });
    [[`Gastos médicos: -${pesos(Q.loss)}`, '#ff8fa0'], ['Tu reputación baja ½ máscara', '#ff8fa0'], ['Puedes reintentarlo mañana', P.cream], ['Tip: sube de nivel, compra más técnicas y usa SUERO y CUBRIRSE', P.muted]]
      .forEach((q, i) => txt(c, q[0], cx, FRES.y + 126 + i * 38, { font: `700 ${i === 3 ? 16 : 22}px ${FONT_UI}`, align: 'center', color: q[1], stroke: P.ink, sw: 4, maxW: 440 }));
  }
  drawButton(c, FRES_BTN);
  c.restore();
}
function fightPointer(w, x, y) {
  const F = w.fight; if (!F) return;
  UI.kb = false;
  if (F.phase === 'result') { if (UI.hit(FRES_BTN)) { sfx('click'); fightClose(w, true); } return; }
  if (F.phase === 'timing') { fightResolve(w, F); return; }
  if (F.phase !== 'choose') return;
  if (UI.hit(FLEE_BTN)) { sfx('back'); toast(w, 'Huiste del combate (sin castigo)'); fightClose(w, true); return; }
  const a = fightActions(w, F).find(q => UI.hit(q));
  if (a) { if (a.disabled) { sfx('nope'); if (a.kind === 'move') fightFloat(F, 'Sin energía', F_PX, F_FLOOR - 190, '#ff8fa0', 22); } else fightPick(w, F, a); }
}
function fightKey(w, e) {
  const F = w.fight; if (!F) return false;
  if (F.phase === 'result') { if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') { sfx('click'); fightClose(w, true); return true; } return false; }
  if (F.phase === 'timing') { if (e.key === ' ' || e.key === 'Enter') { fightResolve(w, F); return true; } return false; }
  if (F.phase !== 'choose') return false;
  if (e.key === 'Escape') { sfx('back'); toast(w, 'Huiste del combate (sin castigo)'); fightClose(w, true); return true; }
  const acts = fightActions(w, F), n = parseInt(e.key, 10), cnt = acts.length;
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    UI.kb = true; let k = (F.cur == null ? -1 : F.cur) + (e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowDown' ? FB.cols : -FB.cols);
    if (F.cur == null) k = 0; F.cur = clamp(k, 0, cnt - 1); sfx('click'); return true;
  }
  if ((e.key === 'Enter' || e.key === ' ') && UI.kb && F.cur != null) { const a = acts[clamp(F.cur, 0, cnt - 1)]; if (a.disabled) sfx('nope'); else fightPick(w, F, a); return true; }
  if (n >= 1 && n <= acts.length) { const a = acts[n - 1]; if (a.disabled) sfx('nope'); else fightPick(w, F, a); return true; }
  return false;
}

/* ---------- El mapa de rivales ---------- */
const MAPBOX = { x: 60, y: 58, w: 840, h: 492 };
const MAPREG = { x: MAPBOX.x + 24, y: MAPBOX.y + 58, w: 480, h: 336 };
const MAPNODE = [{ x: 84, y: 78 }, { x: 396, y: 78 }, { x: 84, y: 250 }, { x: 396, y: 250 }];       // posición de cada rival dentro de MAPREG
const MAPHOME = { x: 240, y: 166 };
const MAPDET = { x: MAPREG.x + MAPREG.w + 22, y: MAPREG.y, w: MAPBOX.x + MAPBOX.w - 24 - (MAPREG.x + MAPREG.w + 22) };
const MAPCLOSE = { x: MAPBOX.x + MAPBOX.w - 40, y: MAPBOX.y + 10, w: 30, h: 30 };
const MAPGO = { x: MAPDET.x, y: MAPDET.y + 332, w: MAPDET.w, h: 46, label: 'ATACAR', size: 24, style: 'red' };
const openBtn = () => ({ x: 12 - EX + SL, y: 68, w: 80, h: 30 });
const openAvail = w => w.loc === 'rest' && w.phase === 'play' && !w.tut && w.dayTime > 0 && !w.modal && !w.shop && !w.edit;
function toggleOpen(w) {
  w.open = !w.open; sfx(w.open ? 'door' : 'back');
  if (w.open) toast(w, '¡Abierto otra vez! Ya pueden llegar clientes');
  else toast(w, 'Cerraste el local: nadie nuevo entra. Los que ya están comen y se van');
  Game.save();
}
function drawOpenBtn(c, w) {
  const b = openBtn(), on = w.open, hov = UI.hit(b); if (hov) UI.cursor = true;
  c.save();
  rr(c, b.x, b.y, b.w, b.h, 10); c.fillStyle = on ? '#14633a' : '#7a1c28'; c.fill(); c.lineWidth = 2.6; c.strokeStyle = hov ? P.gold : P.white; c.stroke();
  c.fillStyle = on ? '#7bff9e' : '#ff6a78'; c.shadowColor = on ? '#7bff9e' : '#ff6a78'; c.shadowBlur = 6; c.beginPath(); c.arc(b.x + 13, b.y + b.h / 2, 4.6, 0, 6.3); c.fill(); c.shadowBlur = 0;
  txt(c, on ? 'ABIERTO' : 'CERRADO', b.x + 22 + (b.w - 28) / 2, b.y + 20.5, { font: `700 14px ${FONT_UI}`, align: 'center', color: P.white, ls: .6, maxW: b.w - 30 });
  c.restore();
  if (hov) drawTip(c, b.x + b.w + 10, b.y, [on ? 'Local abierto' : 'Local cerrado', on ? 'Toca para cerrar: ya no llegan clientes' : 'Toca para abrir y recibir clientes']);
}
const mapBtn = () => ({ x: 12 - EX + SL, y: 338, w: 38, h: 48 });
const mapAvail = w => w.loc === 'rest' && !w.tut && !w.edit && !w.shop && !w.modal && w.phase === 'play';
function openMap(w) { w.modal = 'map'; w.panel = false; w.map = { sel: Math.max(0, RIVALS.findIndex(r => rivalState(w, r) === 'ok')) }; sfx('click'); }
function mapClose(w) { w.modal = null; w.map = null; sfx('back'); }
function mapAttack(w) {
  const R = RIVALS[w.map.sel], st = rivalState(w, R);
  if (st === 'ok') { sfx('click'); startFight(w, R); return; }
  sfx('nope');
  toast(w, st === 'conq' ? `${R.name} ya es tuyo` : st === 'lvl' ? `Necesitas el nivel ${R.level} para atacar ${R.name}` : st === 'moves' ? `Te faltan técnicas: ${rivalNeed(w, R).map(k => MOVES[k].name).slice(0, 3).join(', ')}${rivalNeed(w, R).length > 3 ? '…' : ''}` : 'Perdiste hoy: puedes reintentarlo mañana');
}
function mapPointer(w, x, y) {
  const hit = b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
  if (hit(MAPCLOSE) || !hit(MAPBOX)) { mapClose(w); return; }
  for (let i = 0; i < RIVALS.length; i++) { const n = MAPNODE[i]; if (Math.hypot(x - (MAPREG.x + n.x), y - (MAPREG.y + n.y)) < 46) { if (w.map.sel !== i) { w.map.sel = i; sfx('click'); } return; } }
  if (hit(MAPGO)) mapAttack(w);
}
function mapKey(w, e) {
  if (e.key === 'Escape' || e.key === 'm' || e.key === 'M') { mapClose(w); return true; }
  const n = RIVALS.length, s = w.map.sel;
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { w.map.sel = (s + 1) % n; sfx('click'); return true; }
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { w.map.sel = (s + n - 1) % n; sfx('click'); return true; }
  if (e.key === 'Enter' || e.key === ' ') { mapAttack(w); return true; }
  return false;
}
function drawMapBtn(c, w) {
  const b = mapBtn(), hov = UI.hit(b), avail = RIVALS.some(r => rivalState(w, r) === 'ok'); if (hov) UI.cursor = true;
  c.save(); if (hov) c.translate(0, -2);
  c.fillStyle = 'rgba(0,0,0,.4)'; rr(c, b.x + 1, b.y + 4, b.w, b.h, 10); c.fill();
  rr(c, b.x, b.y, b.w, b.h, 10); const g = c.createLinearGradient(0, b.y, 0, b.y + b.h); g.addColorStop(0, '#6a6880'); g.addColorStop(1, '#26242f'); c.fillStyle = g; c.fill(); c.lineWidth = 2.6; c.strokeStyle = P.white; c.stroke();
  drawMapIcon(c, b.x + b.w / 2, b.y + 19, .6);
  txt(c, 'MAPA', b.x + b.w / 2, b.y + b.h - 6, { font: `700 10px ${FONT_UI}`, align: 'center', color: P.white, ls: .8, maxW: b.w - 6 });
  if (avail) { const p = 1 + .15 * Math.sin(w.t * 6); c.fillStyle = P.red; c.beginPath(); c.arc(b.x + b.w - 3, b.y + 4, 6 * p, 0, 6.3); c.fill(); c.lineWidth = 1.6; c.strokeStyle = P.white; c.stroke(); }
  c.restore();
}
function drawMapTerrain(c, R0, t) {                                  // pergamino con colinas, un río y las zonas de cada restaurante
  c.save(); rr(c, R0.x, R0.y, R0.w, R0.h, 14); c.clip();
  let g = c.createLinearGradient(0, R0.y, 0, R0.y + R0.h); g.addColorStop(0, '#f0dca0'); g.addColorStop(1, '#dcc080'); c.fillStyle = g; c.fillRect(R0.x, R0.y, R0.w, R0.h);
  const blob = (x, y, rx, ry, col) => { c.fillStyle = col; c.beginPath(); c.ellipse(R0.x + x, R0.y + y, rx, ry, 0, 0, 6.3); c.fill(); };
  blob(70, 80, 100, 70, '#e6b870'); blob(60, 70, 60, 40, '#dca458');             // desierto (el Rancho)
  blob(410, 90, 90, 64, '#8ed0c4'); blob(412, 96, 52, 34, '#7cc4b8');            // cantina
  blob(70, 270, 96, 64, '#b9a3d6'); blob(80, 272, 54, 36, '#a68ccb');            // barrio
  blob(414, 268, 92, 66, '#f6c2d6'); blob(416, 270, 54, 38, '#eeaac6');          // jardín de cerezos
  blob(240, 172, 76, 56, '#9ed48a'); blob(240, 176, 44, 30, '#8ac676');          // el centro, verde
  c.strokeStyle = '#6fb6e6'; c.lineWidth = 12; c.lineCap = 'round'; c.beginPath(); c.moveTo(R0.x + 150, R0.y - 6); c.bezierCurveTo(R0.x + 200, R0.y + 110, R0.x + 300, R0.y + 120, R0.x + 330, R0.y + R0.h + 6); c.stroke();
  c.strokeStyle = '#9fd4f4'; c.lineWidth = 5; c.stroke();
  c.strokeStyle = 'rgba(90,60,20,.28)'; c.lineWidth = 2; for (let i = 0; i < 6; i++) { const x = R0.x + 40 + i * 80, y = R0.y + R0.h - 20 - (i % 2) * 8; c.beginPath(); c.moveTo(x - 12, y); c.quadraticCurveTo(x, y - 14, x + 12, y); c.stroke(); }
  c.restore();
  c.lineWidth = 4; c.strokeStyle = P.ink; rr(c, R0.x, R0.y, R0.w, R0.h, 14); c.stroke(); c.lineWidth = 2; c.strokeStyle = '#b5782f'; rr(c, R0.x + 4, R0.y + 4, R0.w - 8, R0.h - 8, 11); c.stroke();
}
function drawMap(c, w) {
  const M = w.map; if (!M) return;
  c.fillStyle = 'rgba(8,8,12,.78)'; c.fillRect(-EX, -EY, CW, CH);
  drawPanel(c, MAPBOX.x, MAPBOX.y, MAPBOX.w, MAPBOX.h, 'MAPA DE RIVALES');
  const cl = MAPCLOSE, ch = UI.hit(cl); if (ch) UI.cursor = true;
  rr(c, cl.x, cl.y, cl.w, cl.h, 8); c.fillStyle = ch ? '#5a5668' : '#2a2833'; c.fill(); c.lineWidth = 1.6; c.strokeStyle = 'rgba(255,255,255,.4)'; c.stroke();
  c.strokeStyle = P.white; c.lineWidth = 2.4; c.lineCap = 'round'; c.beginPath(); c.moveTo(cl.x + 10, cl.y + 10); c.lineTo(cl.x + 20, cl.y + 20); c.moveTo(cl.x + 20, cl.y + 10); c.lineTo(cl.x + 10, cl.y + 20); c.stroke();
  drawMapTerrain(c, MAPREG, w.t);
  const hx = MAPREG.x + MAPHOME.x, hy = MAPREG.y + MAPHOME.y;
  c.lineCap = 'round'; c.setLineDash([8, 8]);                                               // caminos de tu taquería a cada rival
  RIVALS.forEach((r, i) => { const n = MAPNODE[i], st = rivalState(w, r); c.strokeStyle = P.ink; c.lineWidth = 7; c.beginPath(); c.moveTo(hx, hy); c.lineTo(MAPREG.x + n.x, MAPREG.y + n.y); c.stroke(); c.strokeStyle = st === 'conq' ? P.gold : '#b5482f'; c.lineWidth = 3.4; c.stroke(); });
  c.setLineDash([]);
  drawMask(c, hx, hy - 6, 22, MASKS.ring);                                                   // tu taquería
  rr(c, hx - 50, hy + 22, 100, 20, 8); c.fillStyle = P.ink; c.fill(); c.lineWidth = 2; c.strokeStyle = P.white; c.stroke();
  txt(c, 'TU TAQUERÍA', hx, hy + 36.5, { font: `700 12px ${FONT_UI}`, align: 'center', color: P.white, ls: .8, maxW: 90 });
  RIVALS.forEach((r, i) => {                                                                // los cuatro restaurantes rivales
    const n = MAPNODE[i], x = MAPREG.x + n.x, y = MAPREG.y + n.y, st = rivalState(w, r), sel = M.sel === i, lock = st === 'lvl';
    c.save();
    if (sel) { c.fillStyle = 'rgba(255,255,255,.45)'; c.beginPath(); c.arc(x, y, 46 + Math.sin(w.t * 5) * 2, 0, 6.3); c.fill(); c.lineWidth = 3; c.strokeStyle = P.white; c.stroke(); }
    c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.arc(x, y, 38, 0, 6.3); c.fill(); c.lineWidth = 3; c.strokeStyle = lock ? '#7a7788' : r.col; c.stroke();
    c.globalAlpha = lock ? .45 : 1; drawRivalIcon(c, r.id, x, y - 2, 1); c.globalAlpha = 1;
    if (lock) { c.fillStyle = 'rgba(30,28,38,.6)'; c.beginPath(); c.arc(x, y, 38, 0, 6.3); c.fill(); c.strokeStyle = '#d9d4e8'; c.lineWidth = 3; c.beginPath(); c.arc(x, y - 6, 7, Math.PI, 0); c.stroke(); c.fillStyle = '#d9d4e8'; rr(c, x - 10, y - 5, 20, 15, 3); c.fill(); }
    rr(c, x - 56, y + 40, 112, 20, 8); c.fillStyle = P.ink; c.fill(); c.lineWidth = 2; c.strokeStyle = lock ? '#7a7788' : r.col; c.stroke();
    txt(c, r.name, x, y + 54.5, { font: `700 12px ${FONT_UI}`, align: 'center', color: lock ? '#a8a4b8' : P.white, ls: .3, maxW: 104 });
    if (st === 'conq') { c.fillStyle = P.gold; c.strokeStyle = P.ink; c.lineWidth = 2; star(c, x + 30, y - 30, 13, 6); c.fill(); c.stroke(); }
    else if (st === 'ok') { const p = 1 + .12 * Math.sin(w.t * 7); c.fillStyle = P.red; c.beginPath(); c.arc(x + 30, y - 30, 11 * p, 0, 6.3); c.fill(); c.lineWidth = 2; c.strokeStyle = P.white; c.stroke(); txt(c, '!', x + 30, y - 24.5, { font: `400 17px ${FONT_DISPLAY}`, align: 'center', color: P.white }); }
    else if (lock) txt(c, `NIVEL ${r.level}`, x, y + 74, { font: `700 12px ${FONT_UI}`, align: 'center', color: '#ff9aa8', stroke: P.ink, sw: 3, ls: 1 });
    else if (st === 'moves') txt(c, 'FALTAN TÉCNICAS', x, y + 74, { font: `700 11px ${FONT_UI}`, align: 'center', color: '#ffb36a', stroke: P.ink, sw: 3, ls: .6, maxW: 110 });
    else if (st === 'lock') txt(c, 'REINTENTA MAÑANA', x, y + 74, { font: `700 11px ${FONT_UI}`, align: 'center', color: '#ff9aa8', stroke: P.ink, sw: 3, ls: .6, maxW: 110 });
    c.restore();
  });
  // tus Estrellas de Sabor
  const sy = MAPREG.y + MAPREG.h + 26;
  for (let i = 0; i < 5; i++) { const sx = MAPREG.x + MAPREG.w / 2 + (i - 2) * 34, f = clamp(starsOf(w) - i, 0, 1); c.fillStyle = 'rgba(255,255,255,.14)'; star(c, sx, sy, 14, 6.2); c.fill(); c.lineWidth = 1.4; c.strokeStyle = 'rgba(255,255,255,.4)'; c.stroke(); if (f > 0) { c.save(); c.beginPath(); c.rect(sx - 15, sy - 15, 30 * f, 30); c.clip(); c.fillStyle = P.gold; star(c, sx, sy, 14, 6.2); c.fill(); c.lineWidth = 1.6; c.strokeStyle = P.ink; c.stroke(); c.restore(); } }
  txt(c, `ESTRELLAS DE SABOR: ${starTxt(starsOf(w))} DE 5`, MAPREG.x + MAPREG.w / 2, sy + 32, { font: `700 15px ${FONT_UI}`, align: 'center', color: P.gold, ls: 1.5, maxW: 470 });
  txt(c, 'Con más estrellas llegan mejores clientes: más VIP, más propina y más gente', MAPREG.x + MAPREG.w / 2, sy + 52, { font: `600 13px ${FONT_UI}`, align: 'center', color: P.muted, maxW: 470 });
  drawMapDetail(c, w, RIVALS[M.sel]);
}
function drawMapDetail(c, w, R) {
  const D = MAPDET, st = rivalState(w, R), x = D.x, y = D.y;
  rr(c, x - 8, y, D.w + 16, 392, 12); c.fillStyle = 'rgba(255,255,255,.06)'; c.fill(); c.lineWidth = 2; c.strokeStyle = R.col; c.stroke();
  txt(c, R.name, x + D.w / 2, y + 28, { font: `400 ${fitDisplay(c, R.name, D.w, 24)}px ${FONT_DISPLAY}`, align: 'center', color: P.white, stroke: P.ink, sw: 5 });
  txt(c, R.sub, x + D.w / 2, y + 48, { font: `600 14px ${FONT_UI}`, align: 'center', color: R.col, maxW: D.w });
  drawLuchador(c, x + 38, y + 122, Object.assign({}, LUCHADORES[R.look], { state: 'idle', t: clock, dir: 1, scale: .95 }));
  txt(c, 'JEFE', x + 84, y + 78, { font: `700 11px ${FONT_UI}`, color: P.muted, ls: 2 });
  txt(c, R.boss, x + 84, y + 98, { font: `700 ${fitFont(c, R.boss, D.w - 84, 20, 700)}px ${FONT_UI}`, color: P.white });
  const okL = w.level >= R.level;
  txt(c, (okL ? '✓ ' : '× ') + `Nivel ${R.level}`, x + 84, y + 120, { font: `700 16px ${FONT_UI}`, color: okL ? '#9af0b8' : '#ff8fa0' });
  txt(c, 'DIFICULTAD', x + 84, y + 140, { font: `700 11px ${FONT_UI}`, color: P.muted, ls: 1.5 });
  for (let i = 0; i < 4; i++) { c.fillStyle = i < R.diff ? P.red : 'rgba(255,255,255,.18)'; c.strokeStyle = P.ink; c.lineWidth = 1.6; c.beginPath(); c.arc(x + 160 + i * 20, y + 136, 7, 0, 6.3); c.fill(); c.stroke(); }
  txt(c, 'TÉCNICAS NECESARIAS', x + D.w / 2, y + 168, { font: `700 12px ${FONT_UI}`, align: 'center', color: P.gold, ls: 1.5 });
  const cw = (D.w - 8) / 2;
  R.need.forEach((k, i) => { const cx = x + (i % 2) * (cw + 8), cy = y + 176 + Math.floor(i / 2) * 22, has = hasMove(w, k);
    rr(c, cx, cy, cw, 19, 7); c.fillStyle = has ? 'rgba(47,191,113,.28)' : 'rgba(224,54,74,.25)'; c.fill(); c.lineWidth = 1.4; c.strokeStyle = has ? '#2fbf71' : '#e0364a'; c.stroke();
    txt(c, (has ? '✓ ' : '× ') + MOVES[k].name, cx + cw / 2, cy + 14, { font: `700 12px ${FONT_UI}`, align: 'center', color: has ? '#c8ffdf' : '#ffc0c8', maxW: cw - 8 }); });
  const by = y + 272;
  txt(c, 'BOTÍN', x + D.w / 2, by, { font: `700 12px ${FONT_UI}`, align: 'center', color: P.gold, ls: 1.5 });
  star(c, x + 12, by + 16, 8, 3.6); c.fillStyle = P.gold; c.fill(); c.lineWidth = 1.4; c.strokeStyle = P.ink; c.stroke();
  txt(c, `+${starTxt(R.stars)} estrella${R.stars > 1 ? 's' : ''} · ${pesos(R.money)}${R.gems ? ' · ' + R.gems + ' gemas' : ''}`, x + 26, by + 21, { font: `700 15px ${FONT_UI}`, color: P.cream, maxW: D.w - 28 });
  txt(c, `Mesero: ${STAFF[R.waiter].name}`, x + 26, by + 40, { font: `600 14px ${FONT_UI}`, color: '#9ff0ff', maxW: D.w - 28 });
  const go = Object.assign({}, MAPGO, st === 'ok' ? {} : { disabled: true, label: st === 'conq' ? 'CONQUISTADO' : st === 'lvl' ? `NIVEL ${R.level}` : st === 'moves' ? 'FALTAN TÉCNICAS' : 'MAÑANA' });
  drawButton(c, go);
  if (st === 'ok') txt(c, `Vida ${R.hp} · ganas si lo dejas sin vida`, x + D.w / 2, MAPGO.y + MAPGO.h + 17, { font: `600 12px ${FONT_UI}`, align: 'center', color: P.muted, maxW: D.w });
}
/* ---------- Tienda: mobiliario, equipamiento y contratación ---------- */
// Lo que se compra llega al inventario (la "cajita"), que tiene lugares limitados; de ahí se coloca desde el modo EDITAR.
const countOf = (w, type) => w.furn.filter(f => f.type === type).length + w.inv.filter(f => f.type === type).length + (w.outs || []).filter(f => f.type === type).length + (w.lot && type === 'parking' ? 1 : 0) + (w.edit && w.edit.held && w.edit.held.it.type === type ? 1 : 0);
const nextInvTier = w => INV_TIERS.find(t => t.cap > w.invCap) || null;
const maxOf = (w, type) => type === 'table' ? (DECO.arena ? ARENA.maxTables : SHOP.maxTables) + 2 * Math.max(0, extOf(DECO) - 1) : type === 'comal' ? (DECO.arena ? ARENA.maxComals : SHOP.maxComals) + Math.max(0, extOf(DECO) - 1) : 1;
// Precios de lo nuevo (nivel mínimo y pesos). El resto de la economía sigue igual: ver PRICES, STAFF, REMODEL y ARENA
const PARRILLA_LEVEL = 18, PARRILLA_PRICE = 7500;
const CLAW_LEVEL = 13, CLAW_PRICE = 3000, CARTEL_LEVEL = 8, CARTEL_PRICE = 1200, BAR2_LEVEL = 5, BAR2_PRICE = 650, STORAGE_PRICE = 1600, DRINKS_PRICE = 120;
function shopItems(w) {
  const cnt = t => countOf(w, t), tier = nextInvTier(w), full = w.inv.length >= w.invCap;
  const fullMsg = full ? `Inventario lleno (${w.inv.length}/${w.invCap})` : null, lvl = n => w.level < n ? `Requiere nivel ${n}` : null;
  const comals = cnt('comal'), tables = cnt('table'), fridges = cnt('fridge'), mc = maxOf(w, 'comal'), mt = maxOf(w, 'table');
  const staff = id => { const d = STAFF[id], hired = w.staff.some(m => m.id === id); return { id, tab: d.tab, name: d.name, desc: d.desc, price: d.price, wage: d.wage || 0, done: hired && !d.wage, fire: hired && !!d.wage, need: w.level < d.level ? `Requiere nivel ${d.level}` : null }; };
  const guard = id => { const d = GUARDS[id], hired = w.guards.some(g => g.id === id); return { id, tab: 'staff', name: d.name, desc: d.desc, price: d.price, wage: d.wage, done: false, fire: hired, need: w.level < d.level ? `Requiere nivel ${d.level}` : null }; };
  const chef = id => { const d = CHEFS[id], hired = w.chefs.some(m => m.id === id); return { id, tab: 'staff', name: d.name, desc: d.desc, price: d.price, wage: d.wage, done: hired && !d.wage, fire: hired && !!d.wage, need: w.level < d.level ? `Requiere nivel ${d.level}` : null }; };
  const arenaNeed = !DECO.remodeled ? 'Primero remodela el changarro' : w.level < ARENA.level ? `Requiere nivel ${ARENA.level}` : null;
  const one = (id, name, desc, price, level, extra = {}) => Object.assign({ id, tab: 'furn', name, desc, price, done: cnt(id) >= 1, need: lvl(level) || fullMsg }, extra);
  const rows = [
    { id: 'comal', tab: 'furn', name: comals >= mc ? 'Comales' : comals === 0 ? 'Comal de lámina' : `${comals + 1}º Comal`, desc: comals === 0 ? 'Aquí se cocinan los tacos: 2 platillos a la vez. Tú lo colocas en el piso' : 'Otro fogón grande: 4 platillos distintos a la vez', price: priceOf('comal', comals), done: comals >= mc, need: fullMsg },
    { id: 'fridge', tab: 'furn', name: 'Refrigerador', desc: 'Prepara micheladas, aguas de sabores y cervezas bien frías', price: priceOf('fridge', fridges), done: fridges >= 1, need: fullMsg },
    { id: 'drinks', tab: 'furn', name: 'Mostrador de bebidas', desc: 'Aquí reposan las bebidas que salen del refri (caben seis tipos)', price: DRINKS_PRICE, done: cnt('drinks') >= 1, need: fridges < 1 ? 'Primero compra el refrigerador' : fullMsg },
    one('vitrinam', 'Vitrina de máscaras', 'Tus clientes compran máscaras de lucha al salir: te dejan monedas y, con suerte, gemas', MASK_PRICE, MASK_LEVEL),
    one('parrilla', 'Parrilla de carne asada', 'Ocho lugares para asar a la vez, con tacos de asada y arrachera. ¡Llama la atención!', PARRILLA_PRICE, PARRILLA_LEVEL),
    one('bar2', 'Barra de antojitos', 'Exhibe elotes, tostadas, pambazos, chilaquiles, cochinita y pozole', BAR2_PRICE, BAR2_LEVEL),
    one('storage', 'Refri de sobrantes', `Guarda hasta ${STORAGE_CAP} porciones al cerrar: lo demás se echa a perder`, STORAGE_PRICE, SPOIL_LEVEL),
    one('cartel', 'Cartel de tacos', 'Tu nombre con lucecitas, afuera en el pasto; brilla de noche y atrae más clientes', CARTEL_PRICE, CARTEL_LEVEL),
    one('garra', 'Máquina de garra', 'Prueba tu suerte: monedas, gemas, energía y fama como premio', CLAW_PRICE, CLAW_LEVEL),
  ];
  Object.keys(TABLES).forEach(k => {
    const T = TABLES[k];
    rows.push({ id: k === 'mantel' ? 'table' : 'table_' + k, tab: 'tables', name: T.name, desc: T.desc, price: T.gems ? 0 : tablePrice(k, tables), gems: T.gems || 0, done: false,
      need: tables >= mt ? `Ya tienes el máximo de mesas (${mt})` : lvl(T.level) || fullMsg });
  });
  Object.keys(CHAIRS).forEach(k => {
    const C = CHAIRS[k];
    rows.push({ id: 'chairs_' + k, tab: 'chairs', name: C.name, desc: C.desc + ' · juego de 2', price: C.gems ? 0 : C.price, gems: C.gems || 0, done: false, need: lvl(C.level) || fullMsg });
  });
  rows.push(staff('waiter1'), staff('waiter2'), staff('payaso'), guard('cadenero1'), guard('cadenero2'), chef('chef1'), chef('chef2'), chef('chef3'), staff('mistico'), staff('anil'),
    { id: 'inv', tab: 'works', hide: w.level < 5, name: 'Ampliar inventario', desc: tier ? `La cajita pasa de ${w.invCap} a ${tier.cap} lugares` : `Inventario al máximo (${w.invCap} lugares)`, price: tier ? tier.price : 0, done: !tier, need: tier && w.level < tier.level ? `Requiere nivel ${tier.level}` : null });
  HANDS.forEach((d, k) => { if (k) rows.push({ id: 'hand' + (k + 1), tab: 'works', name: HAND_NAMES[k], desc: k === 1 ? 'Un cuadro más abajo: carga otro platillo mientras atiendes (teclas 1 a 4)' : 'Otro cuadro de carga para tener más pedidos a la mano', price: d.price, done: w.nHands > k, need: lvl(d.level) || (w.nHands < k ? `Primero compra la ${HAND_NAMES[k - 1].toLowerCase()}` : null) }); });
  const fn = cnt('farol'), ft = FAROL_TIERS[Math.min(fn, FAROL_TIERS.length - 1)];
  rows.push({ id: 'farol', tab: 'works', name: 'Farol de calle', desc: `De noche deja un círculo de luz en el piso (${fn} de ${FAROL_MAX}). Va en la calle, junto a la banqueta`, price: ft.price, done: fn >= FAROL_MAX, need: fn >= FAROL_MAX ? null : (lvl(ft.level) || fullMsg) });
  rows.push(one('parking', 'Estacionamiento', `Coches con clientes llegan al frente del local (4 cajones). Moverlo después cuesta ${pesos(LOT_MOVE)}`, PARKING_PRICE, PARKING_LEVEL, { tab: 'works' }),
    { id: 'remodel', tab: 'works', name: 'Remodelar Changarro', desc: 'El local se ensancha (más lugar para mesas). Suma ½ máscara', price: REMODEL.price, done: !!DECO.remodeled, need: w.level < REMODEL.level ? `Requiere nivel ${REMODEL.level}` : null },
    { id: 'ext2', tab: 'works', name: 'Ampliación II del local', desc: 'El local pasa a 13 losetas de ancho: caben 2 mesas y 1 comal más. Suma ¼ de máscara', price: EXPANDS[2].price, done: extOf(DECO) >= 2, need: extOf(DECO) < 1 ? 'Primero remodela el changarro' : w.level < EXPANDS[2].level ? `Requiere nivel ${EXPANDS[2].level}` : null },
    { id: 'ext3', tab: 'works', name: 'Ampliación III del local', desc: 'El local pasa a 15 losetas de ancho: 2 mesas y 1 comal más. Suma ¼ de máscara', price: EXPANDS[3].price, done: extOf(DECO) >= 3, need: extOf(DECO) < 2 ? 'Primero la Ampliación II' : w.level < EXPANDS[3].level ? `Requiere nivel ${EXPANDS[3].level}` : null },
    { id: 'arena', tab: 'works', name: 'Mega Ampliación: Arena', desc: 'Cuadrilátero central, hasta 6 mesas y 3 comales. Llegan VIPs nuevos', price: ARENA.price, done: !!DECO.arena, need: arenaNeed });
  MOVE_BUY.forEach(k => { const M = MOVES[k]; rows.push({ id: 'mv_' + k, tab: 'moves', name: M.name, desc: `${M.desc} · daño ${M.dmg} · energía ${M.cost}`, price: M.price, done: hasMove(w, k), need: lvl(M.level) }); });
  return rows;
}
// Todas las pestañas se ven desde el inicio, pero se van desbloqueando con el nivel (candado hasta entonces). DECORAR y LUCHADOR abren su propia vista
const SHOP_TABS = [['furn', 'MUEBLES', 1], ['tables', 'MESAS', 1], ['chairs', 'SILLAS', 1], ['decor', 'DECORAR', 2], ['staff', 'PERSONAL', 10], ['moves', 'TÉCNICAS', MOVES_LEVEL], ['works', 'OBRAS', 4], ['legend', 'ESPECIALES', 30], ['look', 'LUCHADOR', 1]];
const tabLocked = (w, t) => w.level < t[2];
const shopTabs = w => SHOP_TABS;
const SHOP_PER = 5;
const shopRowsAll = w => shopItems(w).filter(i => i.tab === w.shopTab && !i.hide);
const shopPages = w => Math.max(1, Math.ceil(shopRowsAll(w).length / SHOP_PER));
const shopRows = w => { w.shopPage = clamp(w.shopPage || 0, 0, shopPages(w) - 1); return shopRowsAll(w).slice(w.shopPage * SHOP_PER, w.shopPage * SHOP_PER + SHOP_PER); };
const SHOPBOX = { x: 110, y: 84, w: 740, rowH: 60, top: 104 };
SHOPBOX.h = SHOPBOX.top + 5 * SHOPBOX.rowH + 46;                       // hasta cinco filas por página
const shopTabBtn = (w, i) => { const tb = shopTabs(w), t = tb[i], st = (SHOPBOX.w - 36) / tb.length; return { x: SHOPBOX.x + 18 + i * st, y: SHOPBOX.y + 38, w: st - 3, h: 30, label: t[1], key: t[0] }; };
const shopBtn = i => ({ x: SHOPBOX.x + SHOPBOX.w - 170, y: SHOPBOX.y + SHOPBOX.top + i * SHOPBOX.rowH + 7, w: 150, h: 38 });
const shopPrev = { x: SHOPBOX.x + 24, y: SHOPBOX.y + SHOPBOX.h - 40, w: 44, h: 28, label: '◀', size: 15, style: 'dark' };
const shopNext = { x: SHOPBOX.x + 120, y: SHOPBOX.y + SHOPBOX.h - 40, w: 44, h: 28, label: '▶', size: 15, style: 'dark' };
const shopClose = { x: SHOPBOX.x + SHOPBOX.w - 40, y: SHOPBOX.y + 10, w: 30, h: 30 };
function canBuy(w, it) {
  if (it.open || it.fire) return { ok: true };
  if (it.done) return { ok: false, why: 'Comprado' };
  if (it.need) return { ok: false, why: it.need };
  if (it.gems) return w.gems < it.gems ? { ok: false, why: `Faltan ${it.gems - w.gems} gemas` } : { ok: true };
  if (w.money < it.price) return { ok: false, why: `Faltan ${pesos(it.price - w.money)}` };
  return { ok: true };
}
function buy(w, id) {
  const it = shopItems(w).find(i => i.id === id), chk = canBuy(w, it);
  if (it && it.fire) { fireStaff(w, id); return true; }
  if (!chk.ok) { sfx('nope'); w.moneyFlash = .8; toast(w, chk.why === 'Comprado' ? 'Ya lo compraste' : chk.why); return false; }
  const tier = nextInvTier(w);
  if (it.gems) w.gems -= it.gems; else { w.money -= it.price; w.dayCost += it.price; }
  sfx('fanfare');
  if (id === 'remodel') doRemodel(w);
  else if (id === 'inv') { w.invCap = tier.cap; toast(w, `¡Inventario ampliado a ${tier.cap} lugares!`); }
  else if (/^hand\d$/.test(id)) { w.nHands = parseInt(id.slice(4), 10); toast(w, `¡${HAND_NAMES[w.nHands - 1]} lista! Cambia de mano con los cuadros de abajo o las teclas 1 a 4`); }
  else if (id === 'arena') doArena(w);
  else if (id === 'ext2' || id === 'ext3') doExpand(w, id === 'ext2' ? 2 : 3);
  else if (STAFF[id]) { const m = makeStaff(id, true, w.staff.length); w.staff.push(m); w.shop = false; toast(w, `¡Contrataste a ${STAFF[id].name}!${STAFF[id].wage ? ' Cobra ' + pesos(STAFF[id].wage) + ' por semana' : ''}`); }
  else if (CHEFS[id]) { w.chefs.push(makeChef(id, true, w.chefs.length)); w.shop = false; toast(w, `¡Contrataste a ${CHEFS[id].name}! ${CHEFS[id].wage ? 'Cobra ' + pesos(CHEFS[id].wage) + ' por semana' : 'Pago único: no cobra sueldo'}`); }
  else if (GUARDS[id]) { w.guards.push(makeGuard(id, true)); w.shop = false; toast(w, `¡Contrataste a ${GUARDS[id].name}! Cobra ${pesos(GUARDS[id].wage)} por semana`); }
  else if (id.startsWith('mv_')) { w.moves[id.slice(3)] = true; toast(w, `¡Aprendiste ${MOVES[id.slice(3)].name}! Ya puedes usarla en las peleas`); }
  else {                                                         // mueble nuevo: entra al inventario y se pasa directo a colocarlo
    let piece, msg = 'Toca una loseta del piso para colocarlo (o guárdalo en la cajita)';
    if (id === 'table' || id.startsWith('table_')) piece = makeFurn('table', 0, 0, 0, { style: id === 'table' ? 'mantel' : id.slice(6), chair: w.tut ? 'plastico' : null });   // en el tutorial la primera mesa ya trae sillas
    else if (id.startsWith('chairs_')) { piece = makeFurn('chairs', 0, 0, 0, { style: id.slice(7) }); msg = 'Toca la mesa a la que quieres ponerle estas sillas'; }
    else { piece = makeFurn(id, 0, 0, 0, id === 'comal' ? { cap: countOf(w, 'comal') === 0 ? 2 : 4 } : null); if (id === 'farol') msg = 'Toca la calle (la orilla junto a la banqueta) para instalar el farol'; else if (id === 'cartel') msg = 'Toca una loseta de pasto afuera del local para plantar el cartel'; else if (id === 'parking') msg = 'Toca el pasto del frente del local para poner el estacionamiento'; }
    w.inv.push(piece); w.shop = false; enterEdit(w); editPick(w, piece, 'inv');
    toast(w, msg);
  }
  Game.save();
  return true;
}
function fireStaff(w, id) {                                          // despedir: pide confirmación (se toca dos veces)
  const nm = chefDef(id).name;
  if (w.fireAsk && w.fireAsk.id === id && clock - w.fireAsk.at < 3.5) {
    if (GUARDS[id]) w.guards = w.guards.filter(g => g.id !== id);
    else if (CHEFS[id]) w.chefs = w.chefs.filter(m => m.id !== id);
    else { const m = w.staff.find(q => q.id === id); if (m) { if (m.carrying) w.stock[m.carrying]++; releaseBench(w, m); w.staff = w.staff.filter(q => q !== m); } }
    w.fireAsk = null; sfx('back'); toast(w, `Despediste a ${nm}`); Game.save();
  } else { w.fireAsk = { id, at: clock }; sfx('nope'); toast(w, `¿Despedir a ${nm}? Toca DESPEDIR otra vez para confirmar`); }
}
const shopCur = w => w.shopView && w.shopView !== 'main' ? w.shopView : w.shopTab;        // pestaña que se ve encendida
function shopChrome(w, hit) {                                    // cerrar y pestañas: iguales en la tienda y en "Luchador"
  if (hit(shopClose)) { w.shop = false; w.shopView = 'main'; sfx('back'); return true; }
  const tabs = shopTabs(w);
  for (let i = 0; i < tabs.length; i++) if (hit(shopTabBtn(w, i))) {
    if (w.loc !== 'rest' && tabs[i][0] !== 'look') return true;
    if (tabs[i][0] === 'decor' || tabs[i][0] === 'look') {
      if (tabLocked(w, tabs[i])) { sfx('nope'); toast(w, `${tabs[i][1]} se desbloquea en el nivel ${tabs[i][2]}`); }
      else { w.shopView = tabs[i][0]; w.decPage = 0; w.lookCat = w.lookCat || 'mask'; sfx('click'); }
    } else { if (w.shopTab !== tabs[i][0]) { w.shopTab = tabs[i][0]; w.shopPage = 0; sfx('click'); } w.shopView = 'main'; }
    return true;
  }
  return false;
}
function shopPointer(w, x, y) {
  const hit = b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
  if (w.shopView === 'decor') { decorPointer(w, x, y, hit); return; }
  if (shopChrome(w, hit)) return;
  if (w.shopView === 'look') { lookPointer(w, x, y, hit); if (!hit({ x: SHOPBOX.x, y: SHOPBOX.y, w: SHOPBOX.w, h: SHOPBOX.h })) { w.shop = false; w.shopView = 'main'; sfx('back'); } return; }
  const pages = shopPages(w);
  if (pages > 1) {
    if (hit(shopPrev)) { w.shopPage = (w.shopPage + pages - 1) % pages; sfx('click'); return; }
    if (hit(shopNext)) { w.shopPage = (w.shopPage + 1) % pages; sfx('click'); return; }
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
  w.deco.remodeled = true; w.deco.ext = Math.max(1, extOf(w.deco)); applyRemodel(extOf(w.deco)); rebuildLayout(w); fixOuts(w);
  LAYOUT.tables.forEach(placeSeats);                                  // los platos de cada mesa se reubican en el lienzo ensanchado
  addRep(w, REMODEL.bonus);
  planVips(w, hourOf(w));
  w.shop = false; w.shopView = 'main'; w.shake = .35;
  toast(w, '¡Remodelación lista! El local se ensanchó (+½ máscara). Decóralo desde la tienda');
}
function doExpand(w, n) {                                           // Ampliación II (13 de ancho) o III (15): caben más mesas y comales
  w.coins.forEach(co => collectCoin(w, co, true)); w.coins = [];
  w.deco.ext = n; applyRemodel(n); rebuildLayout(w); fixOuts(w);
  LAYOUT.tables.forEach(placeSeats);
  addRep(w, EXPANDS[n].bonus); planVips(w, hourOf(w));
  w.shop = false; w.shopView = 'main'; w.shake = .35;
  Cam.z = Math.min(Cam.z, (Cam.def || 1) * (n === 2 ? .9 : .8)); Cam.px = 0; Cam.py = 0; camClamp();
  toast(w, `¡Ampliación ${n === 2 ? 'II' : 'III'} lista! El local mide ${COLS} losetas de ancho: caben 2 mesas y 1 comal más`);
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
// Botones de zoom: pegados al borde izquierdo de la pantalla (con el lienzo ensanchado quedan fuera de la zona central)
const zoomBtns = () => UI.pad ? [] : [
  { x: 12 - EX + SL, y: 392, w: 38, h: 36, label: '+', size: 26, style: 'dark', fn: () => camZoomAt(1.3, CAMC.x, CAMC.y) },
  { x: 12 - EX + SL, y: 434, w: 38, h: 36, label: '−', size: 28, style: 'dark', fn: () => camZoomAt(1 / 1.3, CAMC.x, CAMC.y) },
  { x: 12 - EX + SL, y: 476, w: 38, h: 30, label: '1:1', size: 14, style: 'dark', fn: () => camReset() }
];
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
/* ---------- Afuera: el cartel se planta en el pasto (no en la banqueta, ni dentro del local, ni sobre un árbol o un farol) ---------- */
const outBox = o => { const p = S(o.c + .5, o.r + .5), wd = o.type === 'farol' ? 14 : 42; return { x0: p.x - wd, x1: p.x + wd, y0: p.y - FURN[o.type].h - (o.type === 'farol' ? 0 : 14), y1: p.y + 14 }; };
function outCanPlace(w, c, r, self) {
  if (self && self.type === 'farol') return farolCan(w, c, r, self);
  if (c >= 0 && c < COLS && r >= 0 && r < ROWS) return 'Eso es dentro del local: el cartel va afuera, en el pasto';
  const zone = (c >= COLS && c <= COLS + 5 && r >= -1 && r <= ROWS + 3) || (r >= ROWS && r <= ROWS + 4 && c >= -3 && c <= COLS + 5);
  if (!zone) return 'Ahí no hay pasto: usa la zona verde al frente o al costado';
  const p = S(c + .5, r + .5);
  if (p.x < 40 || p.x > W - 40 || p.y < HUD + 150 || p.y > H - 8) return 'Ahí se saldría de la pantalla';
  if (EXT_PROPS.some(q => Math.hypot(q.x - (c + .5), q.y - (r + .5)) < 1.05)) return 'Ahí estorba un árbol o un farol';
  if ((w.outs || []).some(o => o !== self && o.c === c && o.r === r)) return 'Ahí ya hay otro cartel';
  return null;
}
function fixOuts(w) {                                              // al ensanchar el local, lo que quedó adentro se pasa al pasto más cercano (o a la cajita)
  const keep = [];
  (w.outs || []).forEach(o => {
    if (!outCanPlace(w, o.c, o.r, o)) { keep.push(o); return; }
    let best = null, bd = 1e9;
    const oR = outRange(o.type); for (let r = oR.r0; r <= oR.r1; r++) for (let c = oR.c0; c <= oR.c1; c++) if (!outCanPlace(w, c, r, o) && !keep.some(k => k.c === c && k.r === r)) { const d = Math.abs(c - o.c) + Math.abs(r - o.r); if (d < bd) { bd = d; best = { c, r }; } }
    if (best) { o.c = best.c; o.r = best.r; keep.push(o); } else w.inv.push(makeFurn(o.type));
  });
  w.outs = keep;
  fixLot(w);
}
function reseat(tb) {                                              // los clientes de la mesa siguen en sus sillas, que cambiaron de lugar
  tb.seats.forEach(s => { const cu = s.customer; if (cu) { cu.held = false; if (cu.seated) { cu.x = s.gx; cu.y = s.gy; cu.dir = s.dir; } } });
}
function displaceActors(w) {                                       // quien haya quedado parado sobre una pieza recién colocada se pasa a la loseta libre más cercana
  const fix = e => {
    if (e.x < 0 || e.y < 0 || e.x >= COLS || e.y >= ROWS) return;
    const k = Grid.cell(e.x, e.y);
    if (Grid.blocked[k.r * COLS + k.c]) { const s = nearestFree(e.x, e.y); e.x = s.x; e.y = s.y; e.path = []; if ('task' in e) e.task = null; }
  };
  w.customers.forEach(cu => { if (!cu.seated && cu.state !== 'slam') fix(cu); });
  [w.novato].concat(w.staff).forEach(m => { if (m && !m.resting) fix(m); });
}
function editHover(w, x, y) {
  const e = w.edit; if (!e) return;
  if (x >= EDIT.x && x <= EDIT.x + EDIT.w && y >= EDIT.y && y <= EDIT.y + editH(w)) { e.hit = null; e.hitOut = null; e.hover = null; e.chairTo = null; return; }   // sobre el panel no se señala nada del local (antes un mueble escondido detrás, como la banca, "robaba" el botón GIRAR)
  if (zoomBtns().some(b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h)) { e.hit = null; e.hitOut = null; e.hover = null; e.chairTo = null; return; }
  const q = camWorld(x, y); x = q.x; y = q.y;                       // el cursor, ya en coordenadas del mundo (con zoom)
  const iso = screenToIso(x, y);
  e.hover = (iso.x >= 0 && iso.y >= 0 && iso.x < COLS && iso.y < ROWS) ? { c: Math.floor(iso.x), r: Math.floor(iso.y) } : null;
  e.hoverOut = { c: Math.floor(iso.x), r: Math.floor(iso.y) };      // (para lo que se planta afuera)
  e.hit = null; e.hitOut = null; e.chairTo = null;
  const depth = it => { const d = dimsOf(it); return it.c + it.r + d.fw + d.fh; };
  if (!e.held) {                                                   // el mueble más cercano a la cámara bajo el cursor
    e.hit = w.furn.filter(it => inBox(itemBox(it), x, y)).sort((a, b) => depth(b) - depth(a))[0] || null;
    if (e.hit) e.last = e.hit;                                     // el último mueble señalado: así el botón GIRAR sirve aunque el cursor ya esté en el panel
    else {
      e.hitOut = (w.outs || []).filter(o => inBox(outBox(o), x, y)).sort((a, b) => (b.c + b.r) - (a.c + a.r))[0] || null;
      if (!e.hitOut && w.lot && iso.x >= w.lot.c && iso.x <= w.lot.c + LOT_W && iso.y >= w.lot.r && iso.y <= w.lot.r + LOT_H) e.hitOut = w.lot;       // el estacionamiento
    }
  } else if (e.held.it.type === 'chairs') {                        // con sillas en la mano se señala la mesa que las recibe
    e.chairTo = w.furn.filter(it => it.type === 'table' && inBox(itemBox(it), x, y)).sort((a, b) => depth(b) - depth(a))[0] || null;
  }
}
const isOut = it => !!(it && FURN[it.type] && FURN[it.type].out);
const tapKey = (w, e) => {
  if (!e.held) return null;
  if (e.held.it.type === 'chairs') return e.chairTo ? 'ch' + e.chairTo.id : null;
  if (isOut(e.held.it)) return e.hoverOut ? 'o' + e.hoverOut.c + ',' + e.hoverOut.r : null;
  const a = e.hover ? anchorFor(e.held.it, e.hover) : null; return a ? a.c + ',' + a.r + ',' + (e.held.it.rot || 0) : null;
};
const rotTarget = w => { const e = w.edit; return e.hit || (e.last && w.furn.includes(e.last) ? e.last : null); };
const anchorFor = (it, hov) => { const d = dimsOf(it); return { c: hov.c - Math.floor((d.fw - 1) / 2), r: hov.r - Math.floor((d.fh - 1) / 2) }; };
// Gira la pieza 90° (largo a lo largo de isoX ↔ isoY). Con un mueble en la mano lo gira ahí; si no, gira el que está bajo el cursor si cabe.
function editRotate(w) {
  const e = w.edit; if (!e) return false;
  if (e.held) {
    if (e.held.it.type === 'chairs' || isOut(e.held.it)) { toast(w, e.held.it.type === 'chairs' ? 'Las sillas no se giran: tócalas sobre una mesa' : e.held.it.type === 'parking' ? 'El estacionamiento no se gira' : e.held.it.type === 'farol' ? 'El farol no se gira' : 'El cartel no se gira'); sfx('nope'); return false; }
    e.held.it.rot = e.held.it.rot ? 0 : 1; if (e.held.it.type === 'table') placeSeats(e.held.it);
    e.armed = null; toast(w, 'Girado: toca una loseta verde para soltarlo'); sfx('click'); return true;
  }
  const it = rotTarget(w);
  if (!it) { toast(w, 'Toca un mueble para levantarlo y luego gíralo con R o con GIRAR'); sfx('nope'); return false; }
  if (it.type === 'bench') w.bench.forEach(m => { if (m) standUp(w, m); });                   // quien descansa en la banca se levanta
  const before = it.rot || 0; it.rot = before ? 0 : 1;
  let spot = null;                                                  // intenta girar sobre su misma esquina; si no cabe, con el centro en el mismo sitio
  const d0 = FURN[it.type], cx = it.c + (before ? d0.fh : d0.fw) / 2, cy = it.r + (before ? d0.fw : d0.fh) / 2;
  for (const [c, r] of [[it.c, it.r], [Math.round(cx - dimsOf(it).fw / 2), Math.round(cy - dimsOf(it).fh / 2)]]) if (!spot && !canPlace(w, it, c, r)) spot = { c, r };
  if (spot) {
    it.c = spot.c; it.r = spot.r; if (it.type === 'table') { placeSeats(it); reseat(it); }
    rebuildLayout(w); displaceActors(w); repathAll(w); sfx('click'); Game.save();
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
    if (it.type === 'table') it.seats.forEach(s => { if (s.customer) s.customer.held = true; });     // sus clientes esperan: al soltarla la mesa se sientan en las mismas sillas
    if (it.type === 'bench') w.bench.forEach(m => { if (m) standUp(w, m); });                          // quien descansa en la banca se levanta
    w.furn = w.furn.filter(f => f !== it); rebuildLayout(w);
  } else if (from === 'out') { if (it.type === 'parking') { w.lot = null; clearCars(w); } else w.outs = w.outs.filter(o => o !== it); }
  else w.inv = w.inv.filter(f => f !== it);
  e.held = { it, from, origin: { c: it.c, r: it.r, rot: it.rot || 0 } }; e.hit = null; e.hitOut = null; e.armed = null; sfx('pickup');
  return true;
}
function editApplyChairs(w) {                                       // pone el juego de sillas que llevas en la mesa señalada (las anteriores vuelven a la cajita)
  const e = w.edit, h = e.held, tb = e.chairTo;
  if (!tb) { toast(w, 'Toca una mesa para ponerle las sillas'); sfx('nope'); return false; }
  const old = tb.chair, nu = h.it.style;
  tb.chair = nu; e.held = null; e.armed = null; sfx('serve');
  toast(w, `${CHAIRS[nu].name}: puestas en la mesa`);
  if (old && old !== nu) {
    if (w.inv.length < w.invCap) w.inv.push(makeFurn('chairs', 0, 0, 0, { style: old }));
    else { const C = CHAIRS[old]; if (C.gems) w.gems += Math.floor(C.gems / 2); else w.money += Math.round(C.price / 2); toast(w, `${CHAIRS[nu].name} puestas. Las anteriores se vendieron a la mitad (la cajita está llena)`); }
  }
  Game.save(); return true;
}
function editPlace(w) {
  const e = w.edit, h = e.held;
  if (!h) return false;
  if (h.it.type === 'chairs') return editApplyChairs(w);
  if (h.it.type === 'parking') {                                    // estacionamiento: gratis al ponerlo por primera vez, cuesta LOT_MOVE al cambiarlo de lugar
    const hv = e.hoverOut; if (!hv) return false;
    const a = { c: hv.c - 1, r: hv.r - 1 }, why = lotCan(w, a.c, a.r);
    if (why) { toast(w, why); sfx('nope'); return false; }
    const moved = h.from === 'out' && (a.c !== h.origin.c || a.r !== h.origin.r), fee = moved ? LOT_MOVE : 0;
    if (fee > w.money) { toast(w, `Mover el estacionamiento cuesta ${pesos(fee)}: te faltan ${pesos(fee - w.money)}`); sfx('nope'); w.moneyFlash = .8; return false; }
    if (fee) { w.money -= fee; w.dayCost += fee; }
    h.it.c = a.c; h.it.r = a.r; w.lot = h.it; clearCars(w); w.carT = rand(6, 12); e.held = null; e.armed = null; sfx('serve');
    toast(w, fee ? `Estacionamiento movido (-${pesos(fee)})` : '¡Estacionamiento listo! Los coches empezarán a llegar'); Game.save();
    return true;
  }
  if (isOut(h.it)) {                                                // afuera, en el pasto
    const hv = e.hoverOut; if (!hv) return false;
    const why = outCanPlace(w, hv.c, hv.r, h.it);
    if (why) { toast(w, why); sfx('nope'); return false; }
    h.it.c = hv.c; h.it.r = hv.r; w.outs.push(h.it); e.held = null; e.armed = null; sfx('serve'); toast(w, h.it.type === 'farol' ? '¡Farol instalado! De noche alumbra la calle' : '¡Cartel plantado! Tócalo (fuera del modo edición) para ponerle tu nombre'); Game.save();
    return true;
  }
  if (!e.hover) return false;
  const a = anchorFor(h.it, e.hover), why = canPlace(w, h.it, a.c, a.r);
  if (why) { toast(w, why); sfx('nope'); return false; }
  h.it.c = a.c; h.it.r = a.r; if (h.it.type === 'table') placeSeats(h.it);
  w.furn.push(h.it); rebuildLayout(w);
  if (h.it.type === 'table') reseat(h.it);
  displaceActors(w);
  e.held = null; e.armed = null; e.last = h.it; sfx('serve'); Game.save();      // (queda como "el último": GIRAR lo vuelve a girar)
  return true;
}
function editCancel(w) {                                          // suelta el mueble donde estaba (o de vuelta al inventario)
  const e = w.edit, h = e.held;
  if (!h) return;
  if (h.from === 'map') { h.it.c = h.origin.c; h.it.r = h.origin.r; h.it.rot = h.origin.rot; if (h.it.type === 'table') { placeSeats(h.it); reseat(h.it); } w.furn.push(h.it); rebuildLayout(w); displaceActors(w); }
  else if (h.from === 'out') { h.it.c = h.origin.c; h.it.r = h.origin.r; if (h.it.type === 'parking') w.lot = h.it; else w.outs.push(h.it); }
  else w.inv.push(h.it);
  e.held = null; sfx('back');
}
function editStore(w) {
  const e = w.edit, h = e.held;
  if (!h) { toast(w, 'Levanta un mueble para guardarlo'); sfx('nope'); return; }
  if (h.it.type === 'parking' && h.from === 'out') { toast(w, 'El estacionamiento no cabe en la cajita: suéltalo en otro lugar del frente'); sfx('nope'); return; }
  if (h.from !== 'inv' && w.inv.length >= w.invCap) { toast(w, `Inventario lleno (${w.inv.length}/${w.invCap})`); sfx('nope'); return; }
  if (h.it.type === 'table') h.it.seats.forEach(s => { const cu = s.customer; if (cu) { cu.held = false; leaveSeat(w, cu, false); toast(w, 'Los clientes de esa mesa se fueron'); } });    // la mesa guardada deja a sus clientes sin lugar
  w.inv.push(h.it); e.held = null; sfx('pickup'); toast(w, `${h.it.type === 'chairs' ? CHAIRS[h.it.style].name : FURN[h.it.type].name}: guardado en el inventario`);
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
  else if (e.hitOut) editPick(w, e.hitOut, 'out');
}
function repathAll(w) {                                           // tras mover muebles, los que caminan buscan un camino nuevo
  const entry = DOOR.cells[0], door = Grid.pt(entry.c, entry.r);
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
      cu.path = out.concat(inside || cu.y > -.35 ? exitTail(cu) : [{ x: DOOR.ix, y: SIDE_Y }, { x: EXIT_X, y: SIDE_Y }]);
    } else if (cu.state === 'claw') { sendFromClaw(w, cu);
    } else if (cu.state === 'leave' && cu.y >= .3) {
      const cells = Grid.path(Grid.cell(cu.x, cu.y), DOOR.cells) || [];
      cu.path = cells.map(n => Grid.pt(n.c, n.r)).concat(exitTail(cu));
    }
  }
  [w.novato].concat(w.staff).forEach(m => { if (m && !m.resting && !m.busy) { m.path = []; m.task = null; } });
}

/* ---------- Panel del comal: catálogo para cocinar ---------- */
const PANEL = { x: W - 14 - 324, y: 72, w: 324, top: 80, rowH: 60 };
const PORT_CHIPS = [1, 2, 3, 4, 5, 0];                                                       // 0 = tanda completa
const portChip = i => ({ x: PANEL.x + 84 + i * 37, y: PANEL.y + 44, w: 34, h: 26, label: PORT_CHIPS[i] ? String(PORT_CHIPS[i]) : 'MÁX', n: PORT_CHIPS[i] });
const panelClose = { x: PANEL.x + PANEL.w - 36, y: PANEL.y + 8, w: 28, h: 28 };
const panelBtn = i => ({ x: PANEL.x + PANEL.w - 98, y: PANEL.y + PANEL.top + i * PANEL.rowH + (PANEL.rowH - 34) / 2, w: 86, h: 34 });
// lugar libre de la estación abierta: en el comal, el del comal que se tocó; en el refrigerador, cualquiera de sus dos
const slotFor = (w, station) => station === 'fridge' ? w.dslots.find(s => s.state === 'empty') : ((LAYOUT.comals[w.panelIdx] && LAYOUT.comals[w.panelIdx].slots.find(s => s.state === 'empty')) || null);
const cookN = (w, r) => { const n = w.cookN || 0; return n ? clamp(n, 1, r.yield) : r.yield; };                            // porciones de esta tanda (0 = tanda completa)
const cookCost = (w, r) => { const n = cookN(w, r); return n >= r.yield ? r.cost : Math.max(1, Math.ceil(r.cost * n / r.yield)); };
const cookTime = (w, r) => { const n = cookN(w, r), k = perkOn(w, 'cook') ? .9 : 1; return Math.round((n >= r.yield ? r.time : r.time * (.4 + .6 * n / r.yield)) * k * 10) / 10; };
function canCook(w, key) {
  const r = RECIPES[key], cost = cookCost(w, r);
  if (r.level > w.level) return { ok: false, locked: true, why: `Nivel ${r.level}` };
  if (r.needs && !(LAYOUT.comals[w.panelIdx] && LAYOUT.comals[w.panelIdx].type === r.needs)) return { ok: false, grill: true, why: 'Solo parrilla' };
  if (w.money < cost) return { ok: false, why: `Faltan ${pesos(cost - w.money)}` };
  if (!slotFor(w, r.station)) return { ok: false, full: true, why: r.station === 'fridge' ? 'Refri ocupado' : 'Comal ocupado' };
  if (!shelfItem(key)) return { ok: false, shelf: true, why: r.shelf === 'bar2' ? 'Sin barra' : 'Sin mostrador', long: r.shelf === 'bar2' ? 'Falta la barra de antojitos' : 'Falta el mostrador de bebidas' };
  return { ok: true };
}
function startCook(w, key) {
  const chk = canCook(w, key), r = RECIPES[key];
  if (!chk.ok) {
    sfx('nope'); w.moneyFlash = chk.locked ? 0 : .8;
    toast(w, chk.grill ? 'Eso solo se cocina en la parrilla de carne asada' : chk.shelf ? `${chk.long}: cómprala en la TIENDA y colócala en el modo EDITAR` : chk.locked ? `${r.name} se desbloquea en el nivel ${r.level}` : chk.full ? (r.station === 'fridge' ? 'El refrigerador está ocupado: espera a que termine una tanda' : 'Este comal está lleno: espera a que termine una tanda o usa otro') : `No te alcanza para ${r.name}. ${chk.why}`);
    return false;
  }
  const slot = slotFor(w, r.station);
  const n = cookN(w, r), cost = cookCost(w, r);
  slot.state = 'cook'; slot.dish = key; slot.t = 0; slot.n = n; slot.dur = cookTime(w, r);
  w.money -= cost; w.dayCost += cost; spend(w, STAM.cook);
  const p = r.station === 'fridge' ? fridgeRingPos(0) : slotPos(w.slots.indexOf(slot));
  addPart(w, { type: 'text', text: '-' + pesos(cost), x: p.x, y: p.y - 30, vy: -34, life: 1.2, color: '#ff8fa0' });
  sfx(r.drink ? 'drinkStart' : 'cookStart');
  slot.snd = .5;
  return true;
}
// Lo que se ve en el panel: lo desbloqueado y el siguiente por desbloquear (así se ve qué sigue), en páginas de 7
const PANEL_PER = 7;
function panelPage(w) {
  const all = STATIONS[w.panel || 'comal'].items.filter(k => !RECIPES[k].needs || (w.panel === 'comal' && LAYOUT.comals[w.panelIdx] && LAYOUT.comals[w.panelIdx].type === RECIPES[k].needs)), unl = all.filter(k => RECIPES[k].level <= w.level), nxt = all.find(k => RECIPES[k].level > w.level);
  const list = nxt ? unl.concat([nxt]) : unl, pages = Math.max(1, Math.ceil(list.length / PANEL_PER));
  w.panelPage = clamp(w.panelPage || 0, 0, pages - 1);
  return { pages, rows: list.slice(w.panelPage * PANEL_PER, w.panelPage * PANEL_PER + PANEL_PER) };
}
// El panel se ajusta al alto del lienzo: con muchos platillos las filas se hacen un poco más bajas para que todo quepa
const fitPanel = w => { const n = panelPage(w).rows.length; PANEL.rowH = Math.min(60, Math.floor((H - 14 - PANEL.y - PANEL.top - 56) / Math.max(1, n))); };
const panelH = w => { fitPanel(w); const P_ = panelPage(w); return PANEL.top + P_.rows.length * PANEL.rowH + (P_.pages > 1 ? 56 : 28); };
const panelPrev = w => ({ x: PANEL.x + 14, y: PANEL.y + panelH(w) - 44, w: 44, h: 30, label: '◀', size: 16, style: 'dark' });
const panelNext = w => ({ x: PANEL.x + PANEL.w - 58, y: PANEL.y + panelH(w) - 44, w: 44, h: 30, label: '▶', size: 16, style: 'dark' });
function panelPointer(w, x, y) {
  const hit = b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
  if (hit(panelClose)) { w.panel = false; sfx('back'); return; }
  fitPanel(w);
  for (let i = 0; i < PORT_CHIPS.length; i++) if (hit(portChip(i))) { w.cookN = PORT_CHIPS[i]; sfx('click'); return; }
  const pg = panelPage(w);
  if (pg.pages > 1) {
    if (hit(panelPrev(w))) { w.panelPage = (w.panelPage + pg.pages - 1) % pg.pages; sfx('click'); return; }
    if (hit(panelNext(w))) { w.panelPage = (w.panelPage + 1) % pg.pages; sfx('click'); return; }
  }
  for (let i = 0; i < pg.rows.length; i++) if (hit(panelBtn(i))) { if (startCook(w, pg.rows[i])) w.panel = false; return; }
  if (!hit({ x: PANEL.x, y: PANEL.y, w: PANEL.w, h: panelH(w) })) { w.panel = false; sfx('back'); }     // clic fuera: cierra
}

function comalClick(w, i = 0) { w.panel = (w.panel === 'comal' && w.panelIdx === i) ? false : 'comal'; w.panelIdx = i; w.panelPage = 0; sfx('click'); }
function fridgeClick(w) { w.panel = w.panel === 'fridge' ? false : 'fridge'; w.panelPage = 0; sfx('click'); }
/* ---------- Manos: cuadros de carga ----------
   El Novato lleva un platillo por mano. La mano elegida vive en novato.carrying (así todo lo demás sigue igual);
   las otras quedan guardadas en w.hands. Cada cuadro extra se desbloquea con el nivel y se compra en TIENDA › OBRAS. */
const HANDS = [{ level: 1, price: 0 }, { level: 4, price: 400 }, { level: 12, price: 2000 }, { level: 22, price: 7000 }];
const HAND_NAMES = ['Primera mano', 'Segunda mano', 'Tercera mano', 'Cuarta mano'];
const heldList = w => { const out = []; for (let i = 0; i < w.nHands; i++) out.push(i === w.hand ? w.novato.carrying : w.hands[i]); return out; };
const heldCount = w => heldList(w).filter(Boolean).length;
function stockSaved(w) { const o = Object.assign({}, w.stock); heldList(w).forEach(k => { if (k && o[k] !== undefined) o[k]++; }); return o; }
function handsReset(w) { w.hands = [null, null, null, null]; w.hand = 0; }
function handSwitch(w, i, quiet) {
  const n = w.novato;
  if (i === w.hand || i < 0 || i >= w.nHands) return false;
  w.hands[w.hand] = n.carrying; n.carrying = w.hands[i]; w.hands[i] = null; w.hand = i;
  if (n.task && n.task.type !== 'rest') { n.task = null; n.path = []; }
  if (!quiet) sfx('click');
  return true;
}
function handClick(w, i) {
  const n = w.novato;
  if (i >= w.nHands) {
    const d = HANDS[i];
    if (w.level < d.level) { sfx('nope'); toast(w, `${HAND_NAMES[i]}: se desbloquea en el nivel ${d.level}`); }
    else { sfx('click'); w.panel = false; w.shop = true; w.shopView = 'main'; w.shopTab = 'works'; w.shopPage = 0; }
    return;
  }
  if (i !== w.hand) { handSwitch(w, i); return; }
  if (n.carrying) { sfx('click'); setTask(w, { type: 'return' }); toast(w, `Devolviendo ${RECIPES[n.carrying].name} a la barra`); }
  else { sfx('nope'); toast(w, 'Mano vacía: toca la barra para agarrar un platillo, o a un cliente para atenderlo'); }
}
function handKey(w, e) {
  if (e.key === 'Tab') { if (w.nHands > 1) handSwitch(w, (w.hand + 1) % w.nHands); else sfx('nope'); return true; }
  const i = parseInt(e.key, 10) - 1;
  if (e.key.length === 1 && i >= 0 && i < HANDS.length) { if (i < w.nHands) { if (i !== w.hand) handSwitch(w, i); } else handClick(w, i); return true; }
  return false;
}
const HAND = { sz: 50, gap: 8, y: 536 };
const handsOn = w => w.loc === 'rest' && w.phase === 'play' && !w.shop && !w.edit && !w.modal && !w.tut;
const handBtn = i => ({ x: W / 2 - (HANDS.length * HAND.sz + (HANDS.length - 1) * HAND.gap) / 2 + i * (HAND.sz + HAND.gap), y: HAND.y, w: HAND.sz, h: HAND.sz });
const handBar = () => { const a = handBtn(0), b = handBtn(HANDS.length - 1); return { x: a.x - 12, y: a.y - 9, w: b.x + b.w - a.x + 24, h: HAND.sz + 18 }; };
function drawHands(c, w) {
  const B = handBar(), held = heldList(w);
  c.save();
  c.fillStyle = 'rgba(17,16,20,.86)'; rr(c, B.x, B.y, B.w, B.h, 18); c.fill(); c.lineWidth = 2; c.strokeStyle = 'rgba(255,255,255,.55)'; c.stroke();
  for (let i = 0; i < HANDS.length; i++) {
    const b = handBtn(i), open = i < w.nHands, sel = open && i === w.hand, hov = UI.hit(b), cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    if (hov) UI.cursor = true;
    c.save();
    if (sel) { c.shadowColor = P.gold; c.shadowBlur = 9; }
    rr(c, b.x, b.y, b.w, b.h, 11); c.fillStyle = open ? (hov ? '#3b3748' : '#2a2733') : '#17161c'; c.fill();
    c.restore();
    rr(c, b.x, b.y, b.w, b.h, 11); c.lineWidth = sel ? 3.2 : 1.8; c.strokeStyle = sel ? P.gold : open ? 'rgba(255,255,255,.4)' : 'rgba(255,255,255,.16)'; c.stroke();
    if (open) {
      if (held[i]) drawPortionPlate(c, held[i], cx, cy + 4, 1.12, false, 0);
      else { c.setLineDash([4, 4]); c.lineWidth = 1.6; c.strokeStyle = 'rgba(255,255,255,.25)'; c.beginPath(); c.arc(cx, cy, 13, 0, 6.3); c.stroke(); c.setLineDash([]); }
      c.beginPath(); c.arc(b.x + 9, b.y + 9, 7.5, 0, 6.3); c.fillStyle = sel ? P.gold : '#0b0a10'; c.fill(); c.lineWidth = 1.4; c.strokeStyle = sel ? P.ink : 'rgba(255,255,255,.5)'; c.stroke();
      txt(c, String(i + 1), b.x + 9, b.y + 13, { font: `700 11px ${FONT_UI}`, align: 'center', color: sel ? P.ink : P.white });
    } else {
      const can = w.level >= HANDS[i].level, lx = cx, ly = cy - 6;                         // candado, y debajo el nivel o el precio
      c.strokeStyle = can ? P.gold : '#9d96b4'; c.lineWidth = 2; c.beginPath(); c.arc(lx, ly - 3, 4.4, Math.PI, 0); c.stroke();
      c.fillStyle = can ? P.gold : '#9d96b4'; rr(c, lx - 6.5, ly - 2, 13, 10, 2.5); c.fill();
      txt(c, can ? pesos(HANDS[i].price) : 'NIV ' + HANDS[i].level, cx, b.y + b.h - 7, { font: `700 11.5px ${FONT_UI}`, align: 'center', color: can ? P.gold : '#ff9aa8', maxW: b.w - 6 });
    }
  }
  c.restore();
}
function barClick(w, key) {
  const n = w.novato;
  sfx('click');
  if (n.carrying) {                                                // con una mano libre y platillo en la barra: lo agarra con esa otra mano
    const free = heldList(w).findIndex(k => !k);
    if (free >= 0 && w.stock[key] > 0) { handSwitch(w, free, true); setTask(w, { type: 'pickup', dish: key }); }
    else setTask(w, { type: 'return' });
  } else setTask(w, { type: 'pickup', dish: key });
}
function customerClick(w, cu) {
  const n = w.novato;
  if (cu.state !== 'wait') return false;
  if (w.staff.some(m => m.task && (m.task.cust === cu || m.task.then === cu)) && !n.furia) { sfx('nope'); toast(w, 'Tu personal ya va por ese pedido'); return true; }
  if (n.furia) { sfx('click'); setTask(w, { type: 'serve', cust: cu }); return true; }          // rabioso: va directo por el cliente
  const need = pending(cu), hl = heldList(w), want = hl.findIndex(k => k && need.some(i => i.key === k));
  if (want >= 0) {                                               // alguna de tus manos ya lleva lo que pidió: cambia a esa mano y se lo sirve
    handSwitch(w, want, true); sfx('click'); setTask(w, { type: 'serve', cust: cu }); return true;
  }
  const it = need.find(i => w.stock[i.key] > 0);                 // el Novato va por el pedido a la barra y lo lleva a la mesa
  if (n.carrying) {
    const free = hl.findIndex(k => !k);
    if (free < 0 || !it) {
      sfx('nope');
      if (free < 0) toast(w, w.nHands > 1 ? `Tienes las manos llenas; ese cliente pidió ${need.map(i => RECIPES[i.key].short).join(' y ')}. Devuelve algo a la barra` : `Llevas ${RECIPES[n.carrying].name}; ese cliente pidió ${need.map(i => RECIPES[i.key].short).join(' y ')}`);
      else toast(w, RECIPES[need[0].key].drink ? `No hay ${RECIPES[need[0].key].name} lista: prepárala en el refrigerador` : `No hay ${RECIPES[need[0].key].name} listo: cocínalo en el comal`);
      return true;
    }
    handSwitch(w, free, true);                                   // mano libre: va por el pedido sin soltar lo que lleva en la otra
  }
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
    const sp = camScreen(coin.x, coin.y);
    addPart(w, { type: 'fly', x: sp.x, y: sp.y, tx: 205, ty: 30, life: .6 });
    addPart(w, { type: 'text', text: `+${pesos(coin.v)}  +${gain} XP`, x: coin.x, y: coin.y - 12, vy: -40, life: 1.2, color: P.gold });
    addXp(w, gain);
    sfx('coin');
  } else addXp(w, gain);
}

// ¿El toque cayó sobre el escenario (y no sobre un botón o un panel)? Solo esos se esperan a que el dedo se levante para distinguirlos de un arrastre.
function clickDeferrable(w, x, y) {
  if (w.phase !== 'play' || w.shop || w.panel || w.modal || y < HUD) return false;
  if (w.tut && (TUT[w.tut.s] === 'intro' || TUT[w.tut.s] === 'outro' || UI.hit(tutBtnSkip))) return false;
  if (zoomBtns().some(b => UI.hit(b))) return false;
  if (mapAvail(w) && UI.hit(mapBtn())) return false;
  if (openAvail(w) && UI.hit(openBtn())) return false;
  if (townAvail(w) && UI.hit(townBtn())) return false;
  if (backAvail(w) && UI.hit(backBtn())) return false;
  if (w.hedit && x >= HEDIT.x && x <= HEDIT.x + HEDIT.w && y >= HEDIT.y && y <= HEDIT.y + hH()) return false;
  if (handsOn(w) && UI.hit(handBar())) return false;
  if (w.edit && x >= EDIT.x && x <= EDIT.x + EDIT.w && y >= EDIT.y && y <= EDIT.y + editH(w)) return false;
  return true;
}
function worldPointer(w, x, y) {
  // superposiciones (resumen / fin de partida)
  if (w.phase !== 'play') {
    const b = w.overlay.find(b => UI.hit(b));
    if (b) { sfx('click'); b.fn(); }
    return;
  }
  if (w.tut && tutPointer(w, x, y)) return;                        // ventanas del tutorial y botón de saltarlo
  if (w.modal === 'sign') { signPointer(w, x, y); return; }
  if (w.modal === 'claw') { clawPointer(w, x, y); return; }
  if (w.modal === 'cal') { calPointer(w, x, y); return; }
  if (w.modal === 'lvl') { lvPointer(w, x, y); return; }
  if (w.modal === 'map') { mapPointer(w, x, y); return; }
  if (w.modal === 'fight') { fightPointer(w, x, y); return; }
  if (w.modal === 'dlg') { dlgPointer(w, x, y); return; }
  if (w.modal === 'catalog') { catPointer(w, x, y); return; }
  if (w.modal === 'paint') { paintPointer(w, x, y); return; }
  if (w.modal === 'penal') { penalPointer(w, x, y); return; }
  if (w.shop) { shopPointer(w, x, y); return; }
  const zb = zoomBtns().find(b => UI.hit(b));                      // botones + − del zoom
  if (zb) { zb.fn(); sfx('click'); return; }
  if (mapAvail(w) && UI.hit(mapBtn())) { openMap(w); return; }
  if (openAvail(w) && UI.hit(openBtn())) { toggleOpen(w); return; }
  if (townAvail(w) && UI.hit(townBtn())) { sfx('click'); goTown(w); return; }
  if (backAvail(w) && UI.hit(backBtn())) { backClick(w); return; }
  if (handsOn(w) && UI.hit(handBar())) { const hi = HANDS.findIndex((_, i) => UI.hit(handBtn(i))); if (hi >= 0) handClick(w, hi); return; }
  if (w.edit) {                                                   // modo edición: solo el botón EDITAR (sale) y el panel/escenario
    const eb = w.btns.find(b => b.label === 'EDITAR');
    if (UI.hit(eb)) { exitEdit(w); return; }
    editPointer(w, x, y); return;
  }
  const hb = (w.loc === 'rest' ? w.btns : awayBtns(w)).find(b => UI.hit(b));
  if (hb) { hb.fn(); return; }
  if (UI.hit(CLOCKBTN)) { openCal(w); return; }
  if (w.loc !== 'rest') { awayPointer(w, x, y); return; }
  if (w.panel) { panelPointer(w, x, y); return; }
  const sy = y, q = camWorld(x, y); x = q.x; y = q.y;              // de aquí en adelante: puntos del mundo (con zoom y desplazamiento)
  for (let i = w.coins.length - 1; i >= 0; i--) {
    const c = w.coins[i];
    if (Math.hypot(x - c.x, y - (c.y - 4)) < 26) { w.coins.splice(i, 1); collectCoin(w, c); Game.save(); return; }
  }
  for (let i = LAYOUT.comals.length - 1; i >= 0; i--) if (comalHit(x, y, i)) { comalClick(w, i); return; }
  if (fridgeHit(x, y)) { fridgeClick(w); return; }
  if (restHit(x, y)) { restClick(w); return; }
  const sk = stockAt(w, x, y);                                    // pilas de la barra de comida lista y del mostrador de bebidas
  if (sk) { barClick(w, sk); return; }
  if ((w.outs || []).some(o => o.type === 'cartel' && inBox(outBox(o), x, y))) { openSign(w); return; }               // el cartel: se le pone nombre
  if (LAYOUT.claw && inBox(itemBox(LAYOUT.claw, 16), x, y)) { openClaw(w); return; }          // la máquina de garra
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
  if (sy > HUD && iso.x >= 0 && iso.y >= 0 && iso.x < COLS && iso.y < ROWS) {
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
    w.customers.forEach(cu => {                                                  // red de seguridad: nadie se queda atado a una mesa que ya no está en el local
      if (cu.held && !(w.edit && w.edit.held && cu.seat && w.edit.held.it === cu.seat.tb)) cu.held = false;
      if (cu.seat && !w.furn.includes(cu.seat.tb) && !(w.edit && w.edit.held && w.edit.held.it === cu.seat.tb)) leaveSeat(w, cu, false);
    });
    if (w.dayTime > 0 && w.open) promoteQueue(w);
    updateQueue(w, dt);
    updateCars(w, dt);
    if (w.clawBusy > 0) w.clawBusy -= dt;
    if (w.repTemp > 0) w.repTemp = Math.max(0, w.repTemp - dt / 60);          // la máscara perdida por el sillazo se recupera en un minuto
    for (const it of w.furn) if (it.type === 'table' && it.down > 0) {         // mesas volcadas: el personal las vuelve a poner
      it.downT += dt; it.down -= dt;
      if (it.down <= 0) { it.down = 0; sfx('ready'); const tm = tableMid(it), mp = S(tm[0], tm[1]); addPart(w, { type: 'text', text: '¡Mesa lista otra vez!', x: mp.x, y: mp.y - 40, vy: -24, life: 1.5, color: '#9af0b8' }); }
    }
    if (w.dayTime > 0 && w.open && !w.customers.some(cu => cu.vip || cu.gd)) {                   // llegada de los VIP y de los que regalan gemas, de uno en uno (si el local aún cumple los requisitos)
      const v = w.vips.find(q => !q.done && hourOf(w) >= q.at);
      if (v && GEMMERS[v.k]) { if (spawnGemmer(w, GEMMERS[v.k])) v.done = true; }
      else if (v) { const def = VIPS[v.k]; if (!vipEligible(w, def)) v.done = true; else if (spawnVip(w, def)) v.done = true; }
    }
    // reloj del día y llegada de clientes
    if (w.dayTime > 0) {
      w.dayTime = Math.max(0, w.dayTime - dt);
      w.spawnT -= dt;
      if (w.spawnT <= 0) {
        const h = hourOf(w), rush = h >= 13 && h < 15.5 ? .6 : h < 9 ? 1.35 : h >= 18 && h < 21 ? .85 : h >= 21 ? 1.3 : 1;      // hora de la comida: más gente; temprano y de noche, menos
        const base = arrivalGap(w) * rush * ((w.outs || []).some(o => o.type === 'cartel') ? .94 : 1) / (1 + .025 * starBonus(w));       // el cartel de afuera atrae ~6 % más clientes
        w.spawnT = w.open ? (spawnCustomer(w) ? rand(base * .7, base * 1.3) : 1) : 1.5;       // cerrado: nadie llega
      }
    } else if (!w.closedWarned) { w.closedWarned = true; toast(w, '¡Son las 11:00 PM! Cerramos: atiende a los últimos clientes'); sfx('door'); }
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
      if ((s.snd = (s.snd || 0) - dt) <= 0) {                      // se oye cómo se cocina: chisporroteo y espátula (comal) o hielo y chorros (bebidas)
        if (station === 'fridge') { sfx(pick(['ice', 'shaker', 'glug', 'fizz', 'squeeze'])); s.snd = rand(.7, 1.3); }
        else { sfx(pick(['crackle', 'crackle', 'spatula', 'chop', 'sizzle2'])); s.snd = rand(.4, .9); }
      }
      if (s.t >= (s.dur || r.time)) {                              // tanda lista: las porciones pasan a la barra (comida) o al mostrador de bebidas
        const got = s.n || r.yield;
        s.state = 'empty'; w.stock[s.dish] += got; sfx(r.drink ? 'ding' : 'ready');
        const bp = stockPos(s.dish) || sp;                          // (si el mostrador no está colocado, se avisa donde se cocinó)
        addPart(w, { type: 'text', text: `+${got} ${r.short}`, x: bp.x, y: bp.y - 34, vy: -26, life: 1.5, color: P.gold });
        for (let k = 0; k < 6; k++) addPart(w, { type: 'spark', x: bp.x, y: bp.y - 10, vx: rand(-40, 40), vy: -rand(20, 60), life: .6 });
        s.dish = null; s.n = 0; s.dur = 0;
      }
    }));
    // fondo de emergencia: si no hay dinero, ni comida, ni nada en preparación, un compadre presta para reabrir la cocina
    const broke = w.money < 10 && stockTotal(w) === 0 && !allSlots(w).some(s => s.state === 'cook') && !w.coins.length && !heldCount(w);
    if (broke && !w.staff.some(m => m.carrying)) { w.loanT += dt; if (w.loanT > 3) { w.loanT = 0; w.money += 30; toast(w, '¡Un compadre te presta $30 para seguir cocinando!'); sfx('coin'); } } else w.loanT = 0;
    if (w.moneyFlash > 0) w.moneyFlash -= dt;
    w.customers.forEach(cu => updateCustomer(w, cu, dt));
    w.customers = w.customers.filter(cu => !cu.dead);
    w.queue = w.queue.filter(cu => !cu.dead && (cu.state === 'qwalk' || cu.state === 'queue'));

    // novato
    const n = w.novato;
    if (w.loc !== 'rest') { n.path = []; n.task = null; n.moving = false; }                    // el jugador anda en el pueblo
    else if (n.stun > 0) { n.stun -= dt; n.moving = false; n.path = []; n.task = null; }              // un sillazo lo deja aturdido un momento
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
    updateGuards(w, dt);
    updateChefs(w, dt);

    // monedas
    w.coins.forEach(c => c.t += dt);

    // fin del día / fin de partida
    if (w.overT > 0) { w.overT += dt; if (w.overT > 1.4) endGame(w); }
    else if (w.dayTime <= 0 && w.customers.length === 0 && !w.cars.length) { w.endT += dt; if (w.endT > 1) finishDay(w); }
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

// Lo que se guarda en el refri de sobrantes (los envases cerrados, como la cerveza, no se echan a perder)
const perishable = k => !RECIPES[k].keep;
const storedCount = w => MENU.reduce((n, k) => n + (perishable(k) ? w.stock[k] : 0), 0);
function spoilStock(w) {                                              // al cerrar: lo que no cabe en el refri de sobrantes se tira. Primero se guarda lo más caro
  const out = { kept: 0, lost: 0, loss: 0, active: w.level >= SPOIL_LEVEL, fridge: !!LAYOUT.storage };
  if (!out.active) return out;
  let room = LAYOUT.storage ? STORAGE_CAP : 0;
  MENU.filter(k => perishable(k) && w.stock[k] > 0).sort((a, b) => RECIPES[b].price - RECIPES[a].price).forEach(k => {
    const n = w.stock[k], keep = Math.min(n, room), r = RECIPES[k];
    room -= keep; out.kept += keep; out.lost += n - keep; out.loss += (n - keep) * r.cost / r.yield; w.stock[k] = keep;
  });
  out.loss = Math.round(out.loss);
  return out;
}
function finishDay(w) {
  w.coins.forEach(c => collectCoin(w, c, true)); w.coins = [];
  w.open = true;
  if (w.dayAngry === 0 && w.rep < 5) { w.rep = Math.min(5, w.rep + 1); w.perfect = true; }
  w.spoil = spoilStock(w);
  w.pay = payDay(w.day) ? payCrew(w) : null;                                 // al terminar la semana se paga el sueldo del personal nuevo
  w.phase = 'summary';
  Game.save();
  sfx('fanfare');
  w.overlay = [
    { label: 'Siguiente día', x: 262, y: 492, w: 210, h: 52, style: 'green', size: 24, fn: () => { w.day += 1; startDay(w); Game.save(); } },
    { label: 'Guardar y salir', x: 488, y: 492, w: 210, h: 52, style: 'dark', size: 24, fn: () => setState('MENU') }
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
  c.fillStyle = g; c.fillRect(-1500, -1000, 4000, 2800);                      // enorme: con el zoom alejado se ve más mundo
  c.strokeStyle = 'rgba(25,80,40,.35)'; c.lineWidth = 1.4; c.beginPath();
  for (let i = 0; i < 260; i++) { const x = -330 + hash(i) * (W + 660), y = HUD - 150 + hash(i + 400) * (H - HUD + 300); c.moveTo(x, y); c.lineTo(x - 2, y - 5); c.moveTo(x, y); c.lineTo(x + 2, y - 5); }
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
  const p = S(x, y), nk = Game.w ? nightK(Game.w) : 0;
  c.fillStyle = 'rgba(0,0,0,.2)'; c.beginPath(); c.ellipse(p.x, p.y + 2, 12, 4.5, 0, 0, 6.3); c.fill();
  c.lineWidth = 2; c.strokeStyle = P.ink; c.fillStyle = '#2b2540';
  rr(c, p.x - 2.5, p.y - 78, 5, 80, 2); c.fill(); c.stroke();
  rr(c, p.x - 7, p.y - 4, 14, 6, 2); c.fill(); c.stroke();
  c.fillStyle = nk > .1 ? '#fff6c8' : '#ffe58a'; rr(c, p.x - 7, p.y - 90, 14, 12, 4); c.fill(); c.stroke();
  c.fillStyle = '#2b2540'; rr(c, p.x - 9, p.y - 94, 18, 5, 2); c.fill(); c.stroke();                  // sombrerito del foco
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
  c.lineWidth = 1; c.strokeStyle = 'rgba(28,26,33,.22)';
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
  c.fillStyle = 'rgba(28,26,33,.35)'; c.fillRect(u0, H - 8, u1 - u0, 1.2);
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
  c.fillStyle = '#121015'; c.fillRect(u, w, pw, ph); c.lineWidth = 2; c.strokeStyle = `rgba(95,232,255,${fl})`; c.strokeRect(u + 1.2, w + 1.2, pw - 2.4, ph - 2.4);
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
  txt(c, l1, u + pw / 2, w + 9, { font: `700 6.6px ${FONT_UI}`, align: 'center', color: '#fff0cc', ls: .3, maxW: pw - 8 });
  txt(c, l2, u + pw / 2, w + 16, { font: `700 6.6px ${FONT_UI}`, align: 'center', color: P.gold, ls: .3, maxW: pw - 8 });
  drawMask(c, u + pw / 2, w + ph / 2 + 6, ph * .17, th);
  txt(c, foot, u + pw / 2, w + ph - 4, { font: `700 5.4px ${FONT_UI}`, align: 'center', color: P.ink, ls: .4, maxW: pw - 6 });
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
  const shut = w.dayTime <= 0 || !w.open, nc = shut ? '255,90,90' : '90,255,150';                              // CERRADO a las 8 PM, ABIERTO el resto del día
  c.save(); c.shadowColor = shut ? '#ff3b3b' : '#3bff8a'; c.shadowBlur = 8 * fl;
  c.fillStyle = '#16141b'; rr(c, du0 + 6, 3, du1 - du0 - 12, 13, 3); c.fill(); c.lineWidth = 1.4; c.strokeStyle = `rgba(${nc},${shut ? .9 : fl})`; c.stroke();
  txt(c, shut ? 'CERRADO' : 'ABIERTO', (du0 + du1) / 2, 13, { font: `700 10px ${FONT_UI}`, align: 'center', color: `rgba(${shut ? '255,150,150' : '160,255,200'},${shut ? .9 : fl})`, ls: 1.5, maxW: du1 - du0 - 24 });
  c.restore();
  const lona = !!(AWNINGS[DECO.awning] || AWNINGS['']).colors;
  if (!lona && DECO.bunting !== 'none') drawBunting(c, [[0, du0 - 8], [du1 + 8, LR]], t, DECO.bunting);     // con lona en la fachada se quitan los banderines
  if (w.event) { c.save(); c.translate(0, lona ? 6 : 15); drawBunting(c, [[0, du0 - 8], [du1 + 8, LR]], t + .6, 'ev'); c.restore(); }          // banderines de la fecha especial
  if (DECO.on.p_camp) drawPoster(c, 'p_camp', 2.35 * U, 34, 46, 52);
  if (DECO.on.p_copa) drawPoster(c, 'p_copa', (DECO.remodeled ? COLS - 1.5 : .45) * U, 34, 46, 52);
  if (DECO.on.g_mask) drawNeonMask(c, 3.62 * U, 28, t);
  if (DECO.on.neon) {                                                                                // letrero de neón
    const ny = lona ? 24 : 10;
    c.save(); c.shadowColor = '#ff3d8b'; c.shadowBlur = 10 * fl;
    c.fillStyle = '#16141b'; rr(c, 6.5 * U, ny, 84, 38, 6); c.fill(); c.lineWidth = 2; c.strokeStyle = `rgba(255,95,162,${fl})`; c.stroke();
    const sg = signOf(), n1 = (sg.t1 || '').toUpperCase(), n2 = (sg.t2 || '').toUpperCase();
    txt(c, n1, 6.5 * U + 42, ny + 17, { font: `400 ${fitDisplay(c, n1, 76, 15)}px ${FONT_DISPLAY}`, align: 'center', color: `rgba(255,170,210,${fl})` });
    txt(c, n2, 6.5 * U + 42, ny + 32, { font: `400 ${fitDisplay(c, n2, 76, 14)}px ${FONT_DISPLAY}`, align: 'center', color: `rgba(255,220,120,${fl})` });
    c.restore();
  }
  drawStarPlaque(c, w, 6.7 * U, -45, 88, 34);                  // letrero de Estrellas de Sabor: parado sobre el borde del muro
  c.restore();

  // ----- pared izquierda (plano isoX = 0): u crece hacia el vértice central -----
  const o2 = S(0, ROWS, H);
  c.save(); c.translate(o2.x, o2.y); c.transform(1, -.5, 0, 1, 0, 0);
  paintWall(c, 0, LL, 0, H, LL);
  c.fillStyle = 'rgba(50,10,30,.12)'; c.fillRect(0, 0, LL, H);
  c.lineWidth = 1.6; c.strokeStyle = P.ink; c.strokeRect(0, 0, LL, H);
  if (DECO.bunting !== 'none') drawBunting(c, [[0, LL]], t + 1.3, DECO.bunting);
  if (w.event) { c.save(); c.translate(0, DECO.bunting !== 'none' ? 15 : 0); drawBunting(c, [[0, LL]], t + 2.1, 'ev'); c.restore(); }
  const up = (ROWS - 3) * U;                                       // altura del comal sobre la pared (iy = 3)
  if (DECO.on.menu) {
    c.fillStyle = P.ink; rr(c, up - 52, 30, 104, 16, 4); c.fill(); c.lineWidth = 1.4; c.strokeStyle = P.gold; c.stroke();
    txt(c, 'MENÚ CALLEJERO', up, 42, { font: `700 10px ${FONT_UI}`, align: 'center', color: P.gold, ls: .8, maxW: 92 });
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

/* Comales y parrilla (v1.7): cada pieza tiene varios lugares de cocción (it.slots).
   El primer comal tiene 2, los comales que se compran tienen 4 y la parrilla de carne asada tiene 8. w.slots junta todos (en orden) y LAYOUT.slotItem / slotK dicen de quién es cada uno. */
function drawComalItem(c, w, it) {
  if (it.type === 'parrilla') { drawParrillaItem(c, w, it); return; }
  const t = w.t, i = LAYOUT.comals.indexOf(it), cap = it.cap || 2;
  const x0 = it.c + .04, x1 = it.c + 1.96, y1 = it.r + .92;
  counterBox(c, it, { top: '#3a3d48', left: '#2f323c', right: '#262830' });                                  // fogón
  isoPoly(c, [S(x0 + .2, y1, 5), S(x1 - .2, y1, 5), S(x1 - .2, y1, 22), S(x0 + .2, y1, 22)]); c.fillStyle = '#150806'; c.fill();
  for (let k = 0; k < 5; k++) { const f = S(x0 + .32 + k * .32, y1, 5); flame(c, f.x, f.y, 8 + Math.sin(t * 9 + k * 1.7 + (i < 0 ? 0 : i) * 2) * 3); }
  const rad = cap <= 2 ? .44 : .27, rx = rad * TW * .7071, ry = rad * TH * .7071, rg = cap <= 2 ? 11 : 9, up = cap <= 2 ? 19 : 15;
  it.slots.forEach((s, k) => {
    const p = slotPosOf(it, k);
    if (s.state === 'cook') { c.fillStyle = 'rgba(255,140,60,.2)'; c.beginPath(); c.ellipse(p.x, p.y + 3, rx + 8, ry + 5, 0, 0, 6.3); c.fill(); }
    c.lineWidth = 2; c.strokeStyle = P.ink;
    c.fillStyle = '#23252c'; c.fillRect(p.x - rx, p.y, rx * 2, 3); c.beginPath(); c.ellipse(p.x, p.y + 3, rx, ry, 0, 0, Math.PI); c.fill();
    const g = c.createLinearGradient(p.x - rx, p.y - ry, p.x + rx, p.y + ry);
    g.addColorStop(0, '#8b909e'); g.addColorStop(.5, '#4b4f5c'); g.addColorStop(1, '#2f323c');
    c.beginPath(); c.ellipse(p.x, p.y, rx, ry, 0, 0, 6.3); c.fillStyle = g; c.fill(); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.3)'; c.lineWidth = 1.4; c.beginPath(); c.ellipse(p.x, p.y, rx - 4, ry - 2.4, 0, Math.PI * 1.05, Math.PI * 1.55); c.stroke();
    if (s.state === 'empty') {
      c.strokeStyle = 'rgba(255,255,255,.2)'; c.lineWidth = 1.2; c.setLineDash([3, 3]);
      c.beginPath(); c.ellipse(p.x, p.y, rx * .55, ry * .55, 0, 0, 6.3); c.stroke(); c.setLineDash([]);
    } else {                                                   // en cocción: el platillo sobre el comal + anillo de progreso
      const rec = RECIPES[s.dish], n = Math.min(s.n || rec.yield, cap <= 2 ? 5 : 3);
      for (let q = 0; q < n; q++) {
        const ang = q / n * 6.283 + t * .3, ox = Math.cos(ang) * rx * .62, oy = Math.sin(ang) * ry * .62;
        c.fillStyle = '#e7c46a'; c.strokeStyle = P.ink; c.lineWidth = 1; c.beginPath(); c.ellipse(p.x + ox, p.y + oy, cap <= 2 ? 5.5 : 3.8, cap <= 2 ? 3 : 2.2, 0, 0, 6.3); c.fill(); c.stroke();
      }
      const pr = s.t / (s.dur || rec.time), ry2 = p.y - up;
      c.fillStyle = 'rgba(28,26,33,.78)'; c.beginPath(); c.arc(p.x, ry2, rg + 1.5, 0, 6.3); c.fill();
      drawDish(c, s.dish, p.x, ry2, rg * .47);
      c.lineWidth = 2.6; c.strokeStyle = 'rgba(255,255,255,.2)'; c.beginPath(); c.arc(p.x, ry2, rg, 0, 6.3); c.stroke();
      c.strokeStyle = P.gold; c.beginPath(); c.arc(p.x, ry2, rg, -Math.PI / 2, -Math.PI / 2 + pr * 6.283); c.stroke();
    }
  });
  if (LAYOUT.comals.length > 1 && i >= 0) { const q = TS(it, 1, .52, 36); txt(c, String(i + 1), q.x, q.y + 4, { font: `700 12px ${FONT_UI}`, align: 'center', color: 'rgba(255,255,255,.4)' }); }
}
function drawParrillaItem(c, w, it) {                                // parrilla de carne asada: cuerpo rojo con franja cromada, brasas, rejilla y campana
  const t = w.t, x0 = it.c + .04, x1 = it.c + 2.96, y0 = it.r + .08, y1 = it.r + .92, H = 38;
  isoBox(c, x0, y0, x1, y1, 0, H, { top: '#24252c', left: '#d62f3a', right: '#8f1c26' });
  isoPoly(c, [S(x0, y1, 27), S(x1, y1, 27), S(x1, y1, 30.5), S(x0, y1, 30.5)]); c.fillStyle = '#dfe3ee'; c.fill(); c.lineWidth = 1.2; c.strokeStyle = P.ink; c.stroke();
  for (let k = 0; k < 4; k++) {                                       // cuatro bocas con brasas y flamas
    const xa = x0 + .2 + k * .7, xb = xa + .5;
    isoPoly(c, [S(xa, y1, 4), S(xb, y1, 4), S(xb, y1, 21), S(xa, y1, 21)]); c.fillStyle = '#130706'; c.fill(); c.lineWidth = 1.2; c.strokeStyle = P.ink; c.stroke();
    const gl = S((xa + xb) / 2, y1, 7); c.save(); c.globalCompositeOperation = 'lighter'; const g = c.createRadialGradient(gl.x, gl.y, 1, gl.x, gl.y, 16); g.addColorStop(0, `rgba(255,120,30,${.55 + .15 * Math.sin(t * 7 + k)})`); g.addColorStop(1, 'rgba(255,90,20,0)'); c.fillStyle = g; c.beginPath(); c.arc(gl.x, gl.y, 16, 0, 6.3); c.fill(); c.restore();
    for (const dx of [.14, .32]) { const f = S(xa + dx, y1, 4); flame(c, f.x, f.y, 6 + Math.sin(t * 9 + k * 1.3 + dx * 9) * 2.4); }
  }
  // rejilla encima, con brasas entre las barras
  const tp0 = S(x0 + .08, y0 + .06, H), tp1 = S(x1 - .08, y0 + .06, H), tp2 = S(x1 - .08, y1 - .05, H), tp3 = S(x0 + .08, y1 - .05, H);
  c.fillStyle = '#2d1008'; c.beginPath(); c.moveTo(tp0.x, tp0.y); c.lineTo(tp1.x, tp1.y); c.lineTo(tp2.x, tp2.y); c.lineTo(tp3.x, tp3.y); c.closePath(); c.fill();
  c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = `rgba(255,110,30,${.34 + .08 * Math.sin(t * 5)})`; c.beginPath(); c.moveTo(tp0.x, tp0.y); c.lineTo(tp1.x, tp1.y); c.lineTo(tp2.x, tp2.y); c.lineTo(tp3.x, tp3.y); c.closePath(); c.fill(); c.restore();
  c.strokeStyle = '#aab0bf'; c.lineWidth = 1.4; c.beginPath();
  for (let k = 0; k <= 12; k++) { const a = S(x0 + .08 + (x1 - x0 - .16) * k / 12, y0 + .06, H + .6), b = S(x0 + .08 + (x1 - x0 - .16) * k / 12, y1 - .05, H + .6); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); }
  c.stroke();
  c.lineWidth = 2; c.strokeStyle = P.ink; c.beginPath(); c.moveTo(tp0.x, tp0.y); c.lineTo(tp1.x, tp1.y); c.lineTo(tp2.x, tp2.y); c.lineTo(tp3.x, tp3.y); c.closePath(); c.stroke();
  // chimenea y humo
  isoBox(c, x1 - .5, y0 + .06, x1 - .2, y0 + .34, H, H + 40, { top: '#9a9aa8', left: '#707080', right: '#54545f' }, 1.4);
  const sm = S(x1 - .35, y0 + .2, H + 44);
  for (let k = 0; k < 3; k++) { const ph = (t * .5 + k / 3) % 1; c.fillStyle = `rgba(210,210,220,${.34 * (1 - ph)})`; c.beginPath(); c.arc(sm.x + Math.sin(ph * 6 + k) * 7, sm.y - ph * 26, 4 + ph * 7, 0, 6.3); c.fill(); }
  // letrero
  const o = S(x0, y1, 38); c.save(); c.translate(o.x, o.y); c.transform(1, .5, 0, 1, 0, 0);
  { const fw = (x1 - x0) * U; c.fillStyle = '#14100e'; rr(c, 14, 6, fw - 28, 13, 4); c.fill(); c.lineWidth = 1.4; c.strokeStyle = P.gold; c.stroke(); txt(c, 'CARNE ASADA', fw / 2, 16, { font: `700 9.5px ${FONT_UI}`, align: 'center', color: P.gold, ls: 1, maxW: fw - 40 }); }
  c.restore();
  // los 8 lugares
  it.slots.forEach((s, k) => {
    const p = slotPosOf(it, k);
    if (s.state === 'empty') { c.strokeStyle = 'rgba(255,255,255,.22)'; c.lineWidth = 1.1; c.setLineDash([2.5, 2.5]); c.beginPath(); c.ellipse(p.x, p.y + 1, 9.5, 4.8, 0, 0, 6.3); c.stroke(); c.setLineDash([]); return; }
    const rec = RECIPES[s.dish], pr = s.t / (s.dur || rec.time), ry2 = p.y - 15;
    c.fillStyle = '#8a4326'; c.strokeStyle = P.ink; c.lineWidth = 1.2; c.beginPath(); c.ellipse(p.x, p.y + 1, 10, 5, 0, 0, 6.3); c.fill(); c.stroke();
    c.strokeStyle = 'rgba(30,12,6,.8)'; c.lineWidth = 1.1; c.beginPath(); for (const dx of [-5, -1.5, 2, 5.5]) { c.moveTo(p.x + dx - 2, p.y - 2.2); c.lineTo(p.x + dx + 2, p.y + 4); } c.stroke();
    c.fillStyle = 'rgba(28,26,33,.8)'; c.beginPath(); c.arc(p.x, ry2, 9.4, 0, 6.3); c.fill();
    drawDish(c, s.dish, p.x, ry2, 4.4);
    c.lineWidth = 2.2; c.strokeStyle = 'rgba(255,255,255,.2)'; c.beginPath(); c.arc(p.x, ry2, 8.4, 0, 6.3); c.stroke();
    c.strokeStyle = P.gold; c.beginPath(); c.arc(p.x, ry2, 8.4, -Math.PI / 2, -Math.PI / 2 + pr * 6.283); c.stroke();
  });
}

// Barra de comida lista (y barra de antojitos): una pila por platillo
const CT_BAR2 = { top: '#e0b070', left: '#1f8f94', right: '#17707a' };
function drawBarItem(c, w, it) {
  counterBox(c, it, it.type === 'bar2' ? CT_BAR2 : CT_WOOD);
  const o = S(it.c + .04, it.r + .92, 34); c.save(); c.translate(o.x, o.y); c.transform(1, .5, 0, 1, 0, 0);
  { const fw = (FURN[it.type].fw - .08) * U; txt(c, it.type === 'bar2' ? 'ANTOJITOS' : 'COMIDA LISTA', fw / 2, 21, { font: `700 9px ${FONT_UI}`, align: 'center', color: 'rgba(255,240,210,.8)', ls: 1, maxW: fw - 18 }); }      // centrado en la cara del mostrador
  c.restore();
  SHELF_KEYS[it.type].forEach((k, i) => {
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
  txt(c, 'BEBIDAS', uw / 2, H - 6, { font: `700 6px ${FONT_UI}`, align: 'center', color: P.white, ls: .6, maxW: uw - 8 });
  c.restore();
  // rótulo y estado de preparación sobre el refrigerador (aquí se hacen las micheladas)
  const tag = S(it.c + .51, it.r + .4, H + 11);
  c.fillStyle = P.ink; rr(c, tag.x - 29, tag.y - 7, 58, 14, 5); c.fill(); c.lineWidth = 1.3; c.strokeStyle = '#5fd0ff'; c.stroke();
  txt(c, 'MICHELADAS', tag.x, tag.y + 3.5, { font: `700 9.5px ${FONT_UI}`, align: 'center', color: '#bfeaff', ls: .6, maxW: 50 });
  if (LAYOUT.fridge === it && !LAYOUT.drinks) {                      // sin mostrador de bebidas: las micheladas listas quedan al pie del refri
    const dp = S(it.c + .5, it.r + .9, 6), n = w.stock.michelada;
    if (n > 0) drawStack(c, 'michelada', n, dp.x, dp.y);
  }
  const rp = S(it.c + .5, it.r + .45, H + 34);
  it.slots.forEach((s, i) => {
    if (s.state !== 'cook') return;
    const sp = { x: rp.x + (i ? 15 : -15), y: rp.y }, pr = s.t / (s.dur || RECIPES[s.dish].time);
    c.fillStyle = 'rgba(28,26,33,.8)'; c.beginPath(); c.arc(sp.x, sp.y, 12.5, 0, 6.3); c.fill();
    drawDish(c, s.dish, sp.x, sp.y, 5.2);
    c.lineWidth = 3; c.strokeStyle = 'rgba(255,255,255,.2)'; c.beginPath(); c.arc(sp.x, sp.y, 11, 0, 6.3); c.stroke();
    c.strokeStyle = '#5fd0ff'; c.beginPath(); c.arc(sp.x, sp.y, 11, -Math.PI / 2, -Math.PI / 2 + pr * 6.283); c.stroke();
  });
}

// Una bebida lista: un vaso con su contador (en el mostrador caben seis tipos)
function drawDrinkStack(c, key, count, x, y) {
  drawDish(c, key, x - 3, y - 9, 6.6);
  const bx = x + 8, by = y - 15;
  c.fillStyle = P.ink; c.beginPath(); c.arc(bx, by, 7.4, 0, 6.3); c.fill(); c.lineWidth = 1.4; c.strokeStyle = '#5fd0ff'; c.stroke();
  txt(c, String(count), bx, by + 4.2, { font: `700 11px ${FONT_UI}`, align: 'center', color: '#bfeaff' });
}
// Mostrador de bebidas: aquí quedan listas las micheladas, las aguas de sabores y las cervezas
function drawDrinks(c, w, it) {
  isoBox(c, it.c + .08, it.r + .1, it.c + 1.92, it.r + .86, 0, 34, { top: '#c98b4e', left: '#2a62c9', right: '#1f4a9c' });
  const o = S(it.c + .08, it.r + .86, 34); c.save(); c.translate(o.x, o.y); c.transform(1, .5, 0, 1, 0, 0);
  { const fw = 1.84 * U; txt(c, 'BEBIDAS LISTAS', fw / 2, 20.5, { font: `700 8px ${FONT_UI}`, align: 'center', color: 'rgba(220,240,255,.85)', ls: 1, maxW: fw - 16 }); }      // el mostrador mide 1.84 losetas de ancho: el centro es la mitad
  c.restore();
  SHELF_KEYS.drinks.forEach((k, i) => {
    const q = drinkSlot(i), p = S(it.c + q[0], it.r + q[1], 34), n = w.stock[k];
    if (RECIPES[k].level > w.level && n === 0) return;
    if (n > 0) drawDrinkStack(c, k, n, p.x, p.y);
    else {
      c.strokeStyle = 'rgba(255,255,255,.3)'; c.lineWidth = 1.2; c.setLineDash([3, 3]);
      c.beginPath(); c.ellipse(p.x, p.y, 10, 5, 0, 0, 6.3); c.stroke(); c.setLineDash([]);
      c.save(); c.globalAlpha = .3; drawDish(c, k, p.x, p.y - 5, 5.2); c.restore();
    }
  });
}
// Refri de sobrantes (nivel 5): lo que no se vende en el día se guarda aquí; sin él, la comida que sobra se echa a perder al cerrar
function drawStorageItem(c, w, it) {
  const x0 = it.c + .1, x1 = it.c + .9, y0 = it.r + .08, y1 = it.r + .74, H = FURN.storage.h;
  isoBox(c, x0, y0, x1, y1, 0, H, { top: '#eef4fa', left: '#b9c9d8', right: '#8fa3b8' });
  const o = S(x0, y1, H), uw = (x1 - x0) * U;
  c.save(); c.translate(o.x, o.y); c.transform(1, .5, 0, 1, 0, 0);
  c.lineWidth = 1.4; c.strokeStyle = P.ink; c.fillStyle = '#dfeaf4'; rr(c, 3, 5, uw - 6, H * .46, 3); c.fill(); c.stroke(); rr(c, 3, H * .52, uw - 6, H * .42, 3); c.fill(); c.stroke();
  c.fillStyle = '#6b7f95'; c.fillRect(uw - 8, 14, 2.2, 12); c.fillRect(uw - 8, H * .6, 2.2, 12);                         // manijas
  c.strokeStyle = '#5fb0ff'; c.lineWidth = 1.4; c.lineCap = 'round';                                                      // copo de nieve
  for (let k = 0; k < 3; k++) { const a = k * Math.PI / 3, cx = uw / 2 - 2, cy = H * .26; c.beginPath(); c.moveTo(cx + Math.cos(a) * 6, cy + Math.sin(a) * 6); c.lineTo(cx - Math.cos(a) * 6, cy - Math.sin(a) * 6); c.stroke(); }
  txt(c, 'SOBRAS', uw / 2, H - 7, { font: `700 6.4px ${FONT_UI}`, align: 'center', color: '#355a82', ls: .3, maxW: uw - 8 });
  c.restore();
  const n = storedCount(w), tag = S(it.c + .5, it.r + .4, H + 11);                                                          // rótulo con lo que cabe
  c.fillStyle = P.ink; rr(c, tag.x - 25, tag.y - 7, 50, 14, 5); c.fill(); c.lineWidth = 1.3; c.strokeStyle = n >= STORAGE_CAP ? '#ff8fa0' : '#5fd0ff'; c.stroke();
  txt(c, `${n} / ${STORAGE_CAP}`, tag.x, tag.y + 3.6, { font: `700 10px ${FONT_UI}`, align: 'center', color: '#bfeaff', ls: .5, maxW: 42 });
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
  c.fillStyle = '#16141b'; rr(c, 14, -1, 1.8 * U - 28, 11, 3); c.fill(); c.lineWidth = 1.1; c.strokeStyle = '#5fd0ff'; c.stroke();
  txt(c, 'SUERO', .9 * U, 7.5, { font: `700 7.5px ${FONT_UI}`, align: 'center', color: '#bfeaff', ls: .8, maxW: 1.8 * U - 36 });
  c.restore();
  const nv = w.novato;                                                                              // aviso: botella saltarina cuando alguien anda cansado
  if (LAYOUT.bench === it && !nv.resting && (nv.stamina < maxStamina(w) * .35 || nv.furia)) {
    const p = S(it.c + 1, it.r + .4, 84), b = Math.sin(w.t * 6) * 3;
    c.fillStyle = 'rgba(17,16,20,.85)'; rr(c, p.x - 16, p.y - 14 + b, 32, 28, 8); c.fill(); c.lineWidth = 1.6; c.strokeStyle = '#5fd0ff'; c.stroke();
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
const MASK_LEVEL = 12, MASK_PRICE = 2400, MASK_MAX = 5;
const MASK_KEYS = ['ring', 'blue', 'black', 'pink', 'novato'];
const maskPrice = w => Math.round((20 + 1.6 * Math.min(w.level, 70)) / 5) * 5;                // lo que paga cada cliente por una máscara (L12 ≈ $40, L30 ≈ $70, L70 ≈ $130)
function drawMaskCase(c, w, it) {                                    // vitrina de vidrio con tres repisas llenas de máscaras de lucha
  isoBox(c, it.c + .08, it.r + .08, it.c + .92, it.r + .92, 0, 16, { top: '#8a5a32', left: '#5a331c', right: '#44261a' }, 1.6);
  const gl = a => `rgba(${a},.26)`;
  for (let k = 0; k < 3; k++) {                                       // repisas con máscaras
    const z = 24 + k * 17;
    isoBox(c, it.c + .14, it.r + .14, it.c + .86, it.r + .86, z - 1.5, z, { top: '#c9a35e', left: '#8f6a30', right: '#6d4f22' }, 1);
    [[.34, .5], [.66, .5]].forEach(([u, v], j) => { const p = S(it.c + u, it.r + v + (k % 2 ? .02 : 0), z + 6); drawMask(c, p.x, p.y, 6.6, MASKS[MASK_KEYS[(k * 2 + j) % MASK_KEYS.length]]); });
  }
  isoBox(c, it.c + .1, it.r + .1, it.c + .9, it.r + .9, 16, 66, { top: gl('215,240,255'), left: gl('150,205,245'), right: gl('110,170,225') }, 1.4);
  isoBox(c, it.c + .06, it.r + .06, it.c + .94, it.r + .94, 66, 72, { top: '#ffd24a', left: '#c99a1c', right: '#9a7414' }, 1.4);
  const tg = S(it.c + .5, it.r + .5, 80);
  c.fillStyle = P.ink; rr(c, tg.x - 28, tg.y - 7, 56, 14, 5); c.fill(); c.lineWidth = 1.3; c.strokeStyle = P.gold; c.stroke();
  txt(c, 'MÁSCARAS', tg.x, tg.y + 3.5, { font: `700 9.5px ${FONT_UI}`, align: 'center', color: P.gold, ls: .7, maxW: 50 });
  const sh = (Math.sin(w.t * 1.6) + 1) / 2;
  c.strokeStyle = `rgba(255,255,255,${.22 + .3 * sh})`; c.lineWidth = 2; const a = S(it.c + .2, it.r + .9, 20), b = S(it.c + .2, it.r + .9, 60);
  c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
}
function maskTrip(w, cu, seat) {                                     // antes de irse, a veces pasa a comprar una máscara
  const it = LAYOUT.mask;
  if (!it || w.level < MASK_LEVEL || w.tut || w.maskCust >= MASK_MAX || w.dayTime <= 15 || w.customers.some(q => q.state === 'claw' && q.cl && q.cl.kind === 'mask')) return false;
  if (Math.random() >= (cu.vip ? .6 : cu.gd ? .45 : cu.car ? .22 : .13)) return false;
  const goals = neighborCells(it); if (!goals.length) return false;
  const cells = Grid.path({ c: seat.c, r: seat.r }, goals); if (!cells) return false;
  const mult = cu.vip ? 1.8 : cu.gd ? 1.4 : 1;
  cu.state = 'claw'; cu.moving = true; cu.speed = 1.9; cu.angry = false; cu.path = cells.map(n => Grid.pt(n.c, n.r));
  cu.cl = { kind: 'mask', ph: 0, t: 0, paid: false, v: Math.max(5, Math.round(maskPrice(w) * mult / 5) * 5), gems: Math.random() < (cu.vip ? .3 : cu.gd ? .18 : .08) ? 1 : 0, mk: MASK_KEYS[Math.floor(Math.random() * MASK_KEYS.length)] };
  w.maskCust++;
  return true;
}
function updateMaskCust(w, cu, dt) {
  const K = cu.cl, it = LAYOUT.mask;
  if (!K || !it) { sendFromClaw(w, cu); return; }
  if (K.ph === 0) {
    if (step(cu, dt)) {                                              // llegó: se pone frente a la vitrina y escoge
      K.ph = 1; K.t = 0; cu.moving = false;
      const m = S(it.c + .5, it.r + .5), me = actorPos(cu); cu.dir = m.x >= me.x ? 1 : -1;
      sfx('click'); addPart(w, { type: 'text', text: '¡Qué buena máscara!', x: me.x, y: me.y - 92, vy: -26, life: 1.4, color: '#ffe27a' });
    }
  } else {
    K.t += dt;
    if (K.t > 1.6 && !K.paid) {                                      // paga: sale la moneda
      K.paid = true; const p = S(it.c + .5, it.r + 1.25);
      w.coins.push({ x: p.x, y: p.y + 4, v: K.v, t: 0, vip: false, xp: 0, gems: K.gems });
      sfx('coin'); addPart(w, { type: 'text', text: K.gems ? '¡Máscara vendida + gema!' : '¡Máscara vendida!', x: p.x, y: p.y - 70, vy: -24, life: 1.5, color: '#9af0b8' });
    }
    if (K.t > 2.6) sendFromClaw(w, cu);
  }
}
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
  const tb = s.tb, key = tb && tb.chair; if (!key || !CHAIRS[key]) return;                  // mesa sin sillas: no hay nada que dibujar
  const C = CHAIRS[key], cx = s.gx, cy = s.gy, stool = !!C.stool, legH = stool ? 20 : 14, z0 = stool ? 19 : 13, z1 = stool ? 24 : 17;
  const seat = () => isoBox(c, cx - .26, cy - .26, cx + .26, cy + .26, z0, z1, C.seat);
  c.fillStyle = 'rgba(0,0,0,.18)'; isoEllipse(c, cx, cy, 0, .4); c.fill();
  c.strokeStyle = C.leg; c.lineWidth = stool ? 3.4 : 3; c.lineCap = 'round';
  [[-.2, -.2], [.2, -.2], [-.2, .2], [.2, .2]].forEach(([dx, dy]) => { const a = S(cx + dx, cy + dy, 0), b = S(cx + dx, cy + dy, legH); c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); });
  if (stool) { seat(); const t = S(cx, cy, z1); c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1.4; c.beginPath(); c.ellipse(t.x, t.y, 10, 5, 0, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); return; }
  const bo = s.outer < 0 ? -.3 : .3, rot = tb.rot, bh = C.tall || 46;
  const back = () => {
    if (rot) isoBox(c, cx - .24, cy + bo - .04, cx + .24, cy + bo + .04, z1, bh, C.back); else isoBox(c, cx + bo - .04, cy - .24, cx + bo + .04, cy + .24, z1, bh, C.back);
    const fx = rot ? cx : cx + bo + .04, fy = rot ? cy + bo + .04 : cy, zm = (z1 + bh) / 2, m = S(fx, fy, zm);
    const line = z => { const p = rot ? S(cx - .24, fy, z) : S(fx, cy - .24, z), q = rot ? S(cx + .24, fy, z) : S(fx, cy + .24, z); c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(q.x, q.y); c.stroke(); };
    if (C.slats) { c.strokeStyle = 'rgba(60,35,15,.55)'; c.lineWidth = 1.4; line(z1 + (bh - z1) * .35); line(z1 + (bh - z1) * .68); }
    if (C.emblem) { c.save(); c.translate(m.x, m.y); c.scale(1, .9); drawMask(c, 0, 0, 6.5, MASKS.blue); c.restore(); }
    if (C.tiles) { c.fillStyle = '#f4f6fb'; c.strokeStyle = P.ink; c.lineWidth = 1; for (const k of [-1, 1]) { c.beginPath(); c.arc(m.x + k * 4.5, m.y, 2.2, 0, 6.3); c.fill(); c.stroke(); } c.fillStyle = '#e0364a'; c.beginPath(); c.arc(m.x, m.y - 5, 1.6, 0, 6.3); c.fill(); }
    if (C.gem) { drawGem(c, m.x, m.y, 5); const tp = S(fx, fy, bh); c.fillStyle = '#ffe27a'; c.strokeStyle = P.ink; c.lineWidth = 1; star(c, tp.x, tp.y - 5, 5, 2.2); c.fill(); c.stroke(); }
    if (key === 'acolchada') { c.fillStyle = 'rgba(255,255,255,.25)'; c.beginPath(); c.arc(m.x - 3, m.y - 3, 1.7, 0, 6.3); c.arc(m.x + 3, m.y + 3, 1.7, 0, 6.3); c.fill(); }
  };
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
  const T = tb.style || 'mantel', tc = tb.c + 1, x0 = tc + .08, x1 = tc + 1.92, y0 = tb.r + .1, y1 = tb.r + .9, z = 30;
  c.fillStyle = 'rgba(0,0,0,.2)'; isoPoly(c, [S(x0 - .1, y0 + .1, 0), S(x1 + .18, y0 + .1, 0), S(x1 + .18, y1 + .2, 0), S(x0 - .1, y1 + .2, 0)]); c.fill();
  const legs = (col, h, lw = 3) => { c.strokeStyle = col; c.lineWidth = lw; c.lineCap = 'round'; [[x0 + .2, y0 + .15], [x1 - .2, y0 + .15], [x0 + .2, y1 - .15], [x1 - .2, y1 - .15]].forEach(([lx, ly]) => { const a = S(lx, ly, 0), b = S(lx, ly, h); c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); }); };
  const topPlane = fn => { const o = S(x0, y0, z); c.save(); c.translate(o.x, o.y); c.transform(TW / 2, TH / 2, -TW / 2, TH / 2, 0, 0); fn(x1 - x0, y1 - y0); c.restore(); };
  const outline = () => { isoPoly(c, [S(x0, y0, z), S(x1, y0, z), S(x1, y1, z), S(x0, y1, z)]); c.lineWidth = 2; c.strokeStyle = P.ink; c.stroke(); };
  if (T === 'madera') {
    legs('#4a2e16', 24, 4.2);
    isoBox(c, x0, y0, x1, y1, 23, z, { top: '#d9a066', left: '#b07a40', right: '#8a5a2c' }, 2);
    c.strokeStyle = 'rgba(80,45,15,.45)'; c.lineWidth = 1.2;
    for (const f of [.33, .66]) { const a = S(x0, lerp(y0, y1, f), z), b = S(x1, lerp(y0, y1, f), z); c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); }
    c.fillStyle = 'rgba(80,45,15,.35)'; for (const [kx, ky] of [[.3, .2], [.7, .55], [.5, .85]]) { const p = S(lerp(x0, x1, kx), lerp(y0, y1, ky), z); c.beginPath(); c.ellipse(p.x, p.y, 3, 1.5, 0, 0, 6.3); c.fill(); }
    outline();
  } else if (T === 'barril') {
    isoBox(c, x0 + .08, y0, x1 - .08, y1, 0, 28, { top: '#c98b4e', left: '#7a4a2a', right: '#5e3820' }, 2);
    c.strokeStyle = '#aab3c2'; c.lineWidth = 2.6; c.lineCap = 'butt';
    for (const zk of [6, 14, 22]) { const a = S(x0 + .08, y1, zk), b = S(x1 - .08, y1, zk), d = S(x1 - .08, y0, zk); c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.lineTo(d.x, d.y); c.stroke(); }
    c.strokeStyle = 'rgba(40,20,8,.5)'; c.lineWidth = 1.1;
    for (let k = 1; k < 7; k++) { const a = S(lerp(x0 + .08, x1 - .08, k / 7), y1, 1), b = S(lerp(x0 + .08, x1 - .08, k / 7), y1, 27); c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); }
    c.strokeStyle = 'rgba(80,45,15,.4)'; for (const f of [.33, .66]) { const a = S(x0 + .08, lerp(y0, y1, f), 28), b = S(x1 - .08, lerp(y0, y1, f), 28); c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); }
  } else if (T === 'talavera') {
    legs('#2a4a9a', 24, 4);
    isoBox(c, x0, y0, x1, y1, 23, z, { top: '#f4f6fb', left: '#3f66c9', right: '#2a4a9a' }, 2);
    topPlane((wd, ht) => {
      for (let i = 0; i < 6; i++) for (let j = 0; j < 2; j++) {
        const px = i * wd / 6, py = j * ht / 2, cw = wd / 6, ch = ht / 2; c.fillStyle = (i + j) & 1 ? '#3f66c9' : '#f4f6fb'; c.fillRect(px, py, cw, ch);
        c.fillStyle = (i + j) & 1 ? '#f4f6fb' : '#3f66c9'; c.beginPath(); c.arc(px + cw / 2, py + ch / 2, Math.min(cw, ch) * .22, 0, 6.3); c.fill();
      }
    });
    outline();
  } else if (T === 'ring' || T === 'oro') {
    const gold = T === 'oro';
    legs(gold ? '#8a6a1a' : '#2b2540', 8, 3);
    isoBox(c, x0, y0, x1, y1, 8, z, gold ? { top: '#ffe27a', left: '#e3b53a', right: '#b88a1f' } : { top: '#2f56c9', left: '#c4272f', right: '#8f1c26' }, 2);
    c.strokeStyle = gold ? 'rgba(255,255,255,.55)' : '#fff'; c.lineWidth = 2.4;
    for (const zk of [14, 20]) { const a = S(x0, y1, zk), b = S(x1, y1, zk), d = S(x1, y0, zk); c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.lineTo(d.x, d.y); c.stroke(); }
    topPlane((wd, ht) => { c.strokeStyle = gold ? '#fff6c8' : '#ffffff'; c.lineWidth = .05; c.strokeRect(.12, .1, wd - .24, ht - .2); c.fillStyle = gold ? 'rgba(255,255,255,.2)' : 'rgba(255,200,61,.9)'; c.beginPath(); c.ellipse(wd / 2, ht / 2, .5, .27, 0, 0, 6.3); c.fill(); });
    const m = S((x0 + x1) / 2, (y0 + y1) / 2, z); c.save(); c.translate(m.x, m.y); c.scale(1, .5); drawMask(c, 0, 0, 12, gold ? MASKS.ring : MASKS.blue); c.restore();
    if (gold) { c.fillStyle = '#fff'; for (let k = 0; k < 3; k++) { const a2 = Math.max(0, Math.sin(clock * 2.6 + k * 2.1)), p = S(lerp(x0, x1, .2 + k * .3), lerp(y0, y1, .3 + (k % 2) * .4), z); star(c, p.x, p.y, 1.5 + 3 * a2, 1, 4); c.globalAlpha = a2; c.fill(); c.globalAlpha = 1; } }
    outline();
  } else {                                                          // mantel de plástico a cuadros
    legs('#4a3320', 8);
    isoBox(c, x0, y0, x1, y1, 8, z, { top: '#fff4e6', left: '#d9374a', right: '#a92a3a' }, 2);       // mantel de plástico colgante
    c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 2;
    for (let x = x0 + .15; x < x1; x += .3) { const a = S(x, y1, 11), b = S(x, y1, z - 2); c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); }
    const o = S(x0, y0, z);                                          // gingham sobre la cubierta (plano de losetas)
    c.save(); c.translate(o.x, o.y); c.transform(TW / 2, TH / 2, -TW / 2, TH / 2, 0, 0);
    const wd = x1 - x0, ht = y1 - y0;
    c.fillStyle = 'rgba(224,54,74,.55)';
    for (let i = 0; i * .2 < wd; i += 2) c.fillRect(i * .2, 0, Math.min(.2, wd - i * .2), ht);
    for (let j = 0; j * .2 < ht; j += 2) c.fillRect(0, j * .2, wd, Math.min(.2, ht - j * .2));
    c.restore();
    c.fillStyle = 'rgba(255,255,255,.3)'; isoPoly(c, [S(x0 + .15, y0 + .05, z), S(x0 + .55, y0 + .05, z), S(x0 + .35, y1 - .05, z), S(x0 + .05, y1 - .05, z)]); c.fill();
    outline();
  }
  // servilletero y salsa
  isoBox(c, tc + .92, tb.r + .38, tc + 1.08, tb.r + .58, z, z + 8, { top: '#dfe2ea', left: '#c9ccd6', right: '#a9acb8' }, 1.2);
  const sb = S(tc + 1.2, tb.r + .5, z); c.fillStyle = '#c4272f'; rr(c, sb.x - 3, sb.y - 14, 6, 14, 2.5); c.fill(); c.lineWidth = 1.3; c.strokeStyle = P.ink; c.stroke();
}

// Dibuja una pieza (las mesas se reparten en tres entradas para ordenar las sillas por profundidad)
function drawFurn(c, w, it) {
  withMirror(c, it, () => {
    switch (it.type) {
      case 'comal': case 'parrilla': drawComalItem(c, w, it); break;
      case 'bar': case 'bar2': drawBarItem(c, w, it); break;
      case 'storage': drawStorageItem(c, w, it); break;
      case 'garra': drawClawItem(c, w, it); break;
      case 'fridge': drawFridge(c, w, it); break;
      case 'drinks': drawDrinks(c, w, it); break;
      case 'bench': drawBench(c, w, it); break;
      case 'plant': drawPlant(c, it); break;
      case 'trompo': drawTrompoItem(c, w, it); break;
      case 'caja': drawCajaItem(c, it); break;
      case 'estatua': drawStatueItem(c, w, it); break;
      case 'vitrina': drawVitrinaItem(c, w, it); break;
      case 'vitrinam': drawMaskCase(c, w, it); break;
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
    c.strokeStyle = 'rgba(28,26,33,.5)'; c.lineWidth = 1.4;
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
  if (cu.state === 'brawl') { const k = cu.br ? cu.br.k : 0; p.x += Math.sin(clock * 38 + k) * 2.6; p.y -= Math.abs(Math.sin(clock * 17 + k)) * 5; }
  if (cu.z > 1) { c.fillStyle = 'rgba(0,0,0,.22)'; const g0 = actorPos(cu); c.beginPath(); c.ellipse(g0.x, g0.y + 2, 18 * Math.max(.5, 1 - cu.z / 160), 6, 0, 0, 6.3); c.fill(); }
  c.save(); c.globalAlpha = cu.alpha;
  if (slam) { c.translate(p.x, p.y); c.rotate(sp.rot); c.translate(-p.x, -p.y); }                 // levantado y azotado
  else if (cu.spin) { c.translate(p.x, p.y - 30); c.rotate(cu.spin); c.translate(-p.x, -(p.y - 30)); }
  const opts = Object.assign({}, cu.look, {
    state: slam ? (sp.air ? 'walk' : 'idle') : eating ? 'eat' : cu.moving || cu.state === 'brawl' ? 'walk' : 'idle',
    t: slam ? cu.slamT * 1.6 : eating ? cu.eatT : cu.state === 'brawl' ? w.t * 2.6 + cu.off : cu.moving ? cu.phase : w.t + cu.off,
    dir: cu.dir, seated: cu.seated, scale: sc,
    tacosLeft: 3 - Math.floor(cu.eatT / EAT_TIME * 3), eatKey: cu.served[0],
    angry: cu.angry || cu.state === 'brawl' || ((cu.state === 'wait' || cu.state === 'queue' || cu.state === 'qwalk') && cu.patience / cu.pmax < .3)
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
    c.fillStyle = 'rgba(28,26,33,.92)'; rr(c, p.x - tw / 2, ty - 8, tw, 17, 8); c.fill(); c.lineWidth = 1.6; c.strokeStyle = cu.vip ? P.gold : '#5fe8ff'; c.stroke();
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
function drawNovatoActor(c, w, nv = w.novato, look = nv === w.novato ? playerLook(w) : LUCHADORES.novato) {                 // sirve para el Novato y para el mesero contratado
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
  c.fillStyle = 'rgba(17,16,20,.85)'; rr(c, x - 12, y - 4, bw + 18, 14, 7); c.fill(); c.lineWidth = 1.6; c.strokeStyle = nv.furia ? '#ff5a5a' : nv.resting ? '#5fd0ff' : 'rgba(255,255,255,.4)'; c.stroke();
  c.fillStyle = '#2f2c37'; rr(c, x, y, bw, 6, 3); c.fill();
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
function drawDong(c, w) {                                                    // ¡DONG!: llega un VIP (campana de ring con aros de sonido), en coordenadas de pantalla
  for (const f of w.fx) {
    if (f.type !== 'dong') continue;
    const k = f.t / f.life, pop = easeOutBack(clamp(f.t / .25, 0, 1)), a = k > .8 ? (1 - k) / .2 : 1;
    const shake = f.t < .6 ? Math.sin(f.t * 70) * 3 : 0;
    c.save(); c.globalAlpha = clamp(a, 0, 1);
    c.translate(480 + shake * 2, 128); c.scale(pop, pop); c.rotate(Math.sin(f.t * 22) * Math.max(0, .16 - f.t * .1));
    for (let k2 = 0; k2 < 3; k2++) { c.strokeStyle = `rgba(255,214,90,${.5 - k2 * .14})`; c.lineWidth = 4; c.beginPath(); c.arc(0, -4, 44 + k2 * 14 + f.t * 24, -2.5, -.64); c.stroke(); c.beginPath(); c.arc(0, -4, 44 + k2 * 14 + f.t * 24, 3.78, 5.64); c.stroke(); }
    c.lineJoin = 'round'; c.lineWidth = 3; c.strokeStyle = P.ink; c.fillStyle = '#ffc83d';
    c.beginPath(); c.moveTo(-26, 24); c.quadraticCurveTo(-30, -22, 0, -30); c.quadraticCurveTo(30, -22, 26, 24); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#e0a300'; c.fillRect(-30, 24, 60, 7); c.strokeRect(-30, 24, 60, 7);
    c.fillStyle = '#7a4a1e'; c.beginPath(); c.arc(0, 38, 7, 0, 6.3); c.fill(); c.stroke();
    txt(c, '¡DONG!', 0, 76, { font: `400 40px ${FONT_DISPLAY}`, align: 'center', color: '#fff3b0', stroke: P.ink, sw: 8 });
    c.restore();
  }
}
function drawFx(c, w) {
  for (const f of w.fx) {
    const k = f.t / f.life, pop = easeOutBack(clamp(f.t / .25, 0, 1)), a = k > .8 ? (1 - k) / .2 : 1;
    const shake = f.t < .6 ? Math.sin(f.t * 70) * 3 : 0;
    if (f.type === 'dong') continue;                                          // la campana va aparte (en coordenadas de pantalla)
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
    txt(c, nm, ix, -12.5, { font: `700 ${nm.length > 8 ? 9.5 : 10.5}px ${FONT_UI}`, align: 'center', color: frozen ? '#2a6f94' : '#4b4853' });
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
  const st = STATIONS[w.panel], list = w.panel === 'fridge' ? w.dslots : ((LAYOUT.comals[w.panelIdx] || { slots: [] }).slots), Q = Object.assign({}, PANEL, { h: panelH(w) }), used = list.filter(s => s.state === 'cook').length, pg = panelPage(w);
  const it0 = LAYOUT.comals[w.panelIdx], title = w.panel === 'comal' && it0 ? (it0.type === 'parrilla' ? 'PARRILLA' : LAYOUT.comals.filter(x => x.type === 'comal').length > 1 ? `COMAL ${LAYOUT.comals.filter(x => x.type === 'comal').indexOf(it0) + 1}` : st.title) : st.title;
  const accent = w.panel === 'fridge' ? '#5fd0ff' : P.gold;
  c.save();
  c.fillStyle = 'rgba(0,0,0,.45)'; rr(c, Q.x + 4, Q.y + 8, Q.w, Q.h, 16); c.fill();
  const g = c.createLinearGradient(0, Q.y, 0, Q.y + Q.h); g.addColorStop(0, w.panel === 'fridge' ? '#1c3a6e' : '#33303e'); g.addColorStop(1, '#1f1d25');
  rr(c, Q.x, Q.y, Q.w, Q.h, 16); c.fillStyle = g; c.fill(); c.lineWidth = 3.5; c.strokeStyle = accent; c.stroke();
  const tw = (c.font = `400 ${w.panel === 'fridge' ? 19 : 24}px ${FONT_DISPLAY}`, c.measureText(title).width);
  txt(c, title, Q.x + 16, Q.y + 30, { font: `400 ${w.panel === 'fridge' ? 19 : 24}px ${FONT_DISPLAY}`, color: accent, stroke: P.ink, sw: 4 });
  txt(c, `En uso ${used} de ${list.length}`, Q.x + 28 + tw, Q.y + 29, { font: `600 14px ${FONT_UI}`, color: P.muted, ls: .5 });
  const cl = panelClose, ch = UI.hit(cl); if (ch) UI.cursor = true;
  rr(c, cl.x, cl.y, cl.w, cl.h, 8); c.fillStyle = ch ? '#5a3a8a' : '#2f2c37'; c.fill(); c.lineWidth = 1.6; c.strokeStyle = 'rgba(255,255,255,.35)'; c.stroke();
  c.strokeStyle = P.white; c.lineWidth = 2.4; c.lineCap = 'round'; c.beginPath();
  c.moveTo(cl.x + 9, cl.y + 9); c.lineTo(cl.x + 19, cl.y + 19); c.moveTo(cl.x + 19, cl.y + 9); c.lineTo(cl.x + 9, cl.y + 19); c.stroke();
  txt(c, 'Porciones', Q.x + 16, Q.y + 62, { font: `700 14px ${FONT_UI}`, color: P.cream, ls: .4 });     // cuántas porciones cocinar en esta tanda
  PORT_CHIPS.forEach((n, i) => {
    const b = portChip(i), sel = (w.cookN || 0) === n, hov = UI.hit(b); if (hov) UI.cursor = true;
    rr(c, b.x, b.y, b.w, b.h, 7); c.fillStyle = sel ? accent : hov ? '#4a2f80' : '#23212a'; c.fill(); c.lineWidth = sel ? 2.4 : 1.4; c.strokeStyle = sel ? P.white : 'rgba(255,255,255,.3)'; c.stroke();
    txt(c, b.label, b.x + b.w / 2, b.y + b.h / 2 + 5, { font: `700 ${n ? 15 : 12}px ${FONT_UI}`, align: 'center', color: sel ? P.ink : P.cream });
  });
  const k = Q.rowH / 60;                                              // escala de la fila (1 = 60 px)
  pg.rows.forEach((key, i) => {
    const r = RECIPES[key], y = Q.y + Q.top + i * Q.rowH, chk = canCook(w, key), b = panelBtn(i);
    if (i % 2 === 0) { c.fillStyle = 'rgba(255,255,255,.05)'; c.fillRect(Q.x + 6, y, Q.w - 12, Q.rowH); }
    c.fillStyle = P.ink; c.beginPath(); c.arc(Q.x + 34, y + Q.rowH / 2, 22 * k, 0, 6.3); c.fill(); c.lineWidth = 2; c.strokeStyle = chk.ok ? P.violet : '#4a4560'; c.stroke();
    c.save(); c.globalAlpha = chk.ok ? 1 : .55; drawDish(c, key, Q.x + 34, y + Q.rowH / 2 - 1, 12 * k); c.restore();
    txt(c, r.name, Q.x + 64, y + 22 * k, { font: `700 ${r.name.length > 22 ? 14.5 : 16}px ${FONT_UI}`, color: chk.ok ? P.cream : '#9d96b4' });
    txt(c, `Cuesta ${pesos(cookCost(w, r))} · ${cookTime(w, r)} seg`, Q.x + 64, y + 38 * k, { font: `600 13px ${FONT_UI}`, color: P.muted });
    txt(c, `Rinde ${cookN(w, r)} ${r.unit} · venta ${pesos(dishPrice(key))}${isFav(key) ? ' ★' : ''} c/u`, Q.x + 64, y + 53 * k, { font: `600 13px ${FONT_UI}`, color: chk.ok ? P.gold : '#8a7a50' });
    drawButton(c, Object.assign({ label: chk.locked ? `NIVEL ${r.level}` : 'COCINAR', style: 'green', size: 15 }, b, { disabled: !chk.ok }));
    if (!chk.ok && !chk.locked) txt(c, chk.why.toUpperCase(), b.x + b.w / 2, b.y + b.h + 9, { font: `700 10.5px ${FONT_UI}`, align: 'center', color: '#ff8fa0', ls: .6 });
  });
  if (pg.pages > 1) {
    drawButton(c, panelPrev(w)); drawButton(c, panelNext(w));
    txt(c, `Página ${w.panelPage + 1} de ${pg.pages}`, Q.x + Q.w / 2, Q.y + Q.h - 23, { font: `700 14px ${FONT_UI}`, align: 'center', color: P.cream, ls: .5 });
    txt(c, 'Toca fuera para cerrar', Q.x + Q.w / 2, Q.y + Q.h - 8, { font: `600 11px ${FONT_UI}`, align: 'center', color: P.muted, ls: .5 });
  } else txt(c, 'Toca fuera del panel para cerrar', Q.x + Q.w / 2, Q.y + Q.h - 9, { font: `600 12px ${FONT_UI}`, align: 'center', color: P.muted, ls: .5 });
  c.restore();
}
/* ---------- Tienda ---------- */
function drawShopIcon(c, id, x, y, w) {
  c.save();
  c.fillStyle = '#16151b'; rr(c, x - 30, y - 30, 60, 60, 12); c.fill(); c.lineWidth = 2; c.strokeStyle = P.violet; c.stroke();
  c.lineJoin = 'round'; c.strokeStyle = P.ink; c.lineWidth = 1.8;
  if (id.startsWith('mv_')) drawMoveIcon(c, id.slice(3), x, y, w);
  else if (id.startsWith('rv_')) drawRivalIcon(c, id.slice(3), x, y, .9);
  else if (id === 'mapa') drawMapIcon(c, x, y, 1.05);
  else if (/^hand\d$/.test(id)) {                               // cuadros de carga: los que ya tienes y el nuevo (dorado, con platillo)
    const n = parseInt(id.slice(4), 10), q = n === 2 ? 20 : n === 3 ? 15 : 18, cols = n === 4 ? 2 : n, rows = n === 4 ? 2 : 1, gap = 3;
    const x0 = x - (cols * q + (cols - 1) * gap) / 2, y0 = y - (rows * q + (rows - 1) * gap) / 2;
    for (let k = 0; k < n; k++) {
      const bx = x0 + (k % cols) * (q + gap), by = y0 + Math.floor(k / cols) * (q + gap), last = k === n - 1;
      rr(c, bx, by, q, q, 4); c.fillStyle = last ? '#4a3a12' : '#2a2733'; c.fill(); c.lineWidth = last ? 2.2 : 1.4; c.strokeStyle = last ? P.gold : 'rgba(255,255,255,.45)'; c.stroke();
      if (last) drawPortionPlate(c, 'pastor', bx + q / 2, by + q / 2 + 2, q / 28, false, 0);
    }
  }
  else if (id === 'comal') {
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
  } else if (STAFF[id] || GUARDS[id] || CHEFS[id]) {
    drawLuchador(c, x, y + (CHEFS[id] ? 25 : 26), Object.assign({}, LUCHADORES[chefDef(id).look], { state: 'idle', t: w.t, dir: 1, scale: CHEFS[id] ? .5 : .62 }));
  } else if (id === 'arena') {                                  // cuadrilátero con sus cuatro postes y cuerdas
    c.beginPath(); c.moveTo(x - 24, y + 4); c.lineTo(x, y - 8); c.lineTo(x + 24, y + 4); c.lineTo(x, y + 16); c.closePath(); c.fillStyle = '#2f56c9'; c.fill(); c.stroke();
    c.beginPath(); c.moveTo(x - 24, y + 4); c.lineTo(x, y + 16); c.lineTo(x, y + 21); c.lineTo(x - 24, y + 9); c.closePath(); c.fillStyle = '#c4272f'; c.fill(); c.stroke();
    c.beginPath(); c.moveTo(x + 24, y + 4); c.lineTo(x, y + 16); c.lineTo(x, y + 21); c.lineTo(x + 24, y + 9); c.closePath(); c.fillStyle = '#8f1c26'; c.fill(); c.stroke();
    c.strokeStyle = '#fff'; c.lineWidth = 2;
    for (const [px, py] of [[x - 24, y + 4], [x, y - 8], [x + 24, y + 4], [x, y + 16]]) { c.beginPath(); c.moveTo(px, py); c.lineTo(px, py - 17); c.stroke(); }
    c.beginPath(); c.moveTo(x - 24, y - 13); c.lineTo(x, y - 25); c.lineTo(x + 24, y - 13); c.lineTo(x, y - 1); c.closePath(); c.strokeStyle = '#ff6a78'; c.stroke();
  } else if (id === 'bar2') {                                   // barra de antojitos: mostrador turquesa con elote y tostada
    c.beginPath(); c.moveTo(x - 22, y - 2); c.lineTo(x, y - 12); c.lineTo(x + 22, y - 2); c.lineTo(x, y + 8); c.closePath(); c.fillStyle = '#e0b070'; c.fill(); c.stroke();
    c.beginPath(); c.moveTo(x - 22, y - 2); c.lineTo(x, y + 8); c.lineTo(x, y + 20); c.lineTo(x - 22, y + 10); c.closePath(); c.fillStyle = '#1f8f94'; c.fill(); c.stroke();
    c.beginPath(); c.moveTo(x + 22, y - 2); c.lineTo(x, y + 8); c.lineTo(x, y + 20); c.lineTo(x + 22, y + 10); c.closePath(); c.fillStyle = '#17707a'; c.fill(); c.stroke();
    drawDish(c, 'elote', x - 8, y - 9, 6.5); drawDish(c, 'tostada', x + 8, y - 6, 6.5);
  } else if (id === 'storage') {                                 // refri de sobrantes: plateado con copo de nieve
    c.beginPath(); c.moveTo(x - 12, y + 14); c.lineTo(x - 12, y - 18); c.lineTo(x + 12, y - 18); c.lineTo(x + 12, y + 14); c.closePath(); c.fillStyle = '#b9c9d8'; c.fill(); c.stroke();
    c.fillStyle = '#eef4fa'; rr(c, x - 9, y - 15, 18, 13, 2); c.fill(); c.stroke(); rr(c, x - 9, y + 1, 18, 11, 2); c.fill(); c.stroke();
    c.strokeStyle = '#3d94f0'; c.lineWidth = 1.5; c.lineCap = 'round';
    for (let k = 0; k < 3; k++) { const a = k * Math.PI / 3; c.beginPath(); c.moveTo(x + Math.cos(a) * 5, y - 8.5 + Math.sin(a) * 5); c.lineTo(x - Math.cos(a) * 5, y - 8.5 - Math.sin(a) * 5); c.stroke(); }
  } else if (id === 'garra') {                                   // máquina de garra: cabina azul, marquesina amarilla y base roja
    c.fillStyle = '#2f6fd0'; rr(c, x - 14, y - 22, 28, 40, 3); c.fill(); c.stroke();
    c.fillStyle = '#ffd23a'; rr(c, x - 14, y - 26, 28, 9, 3); c.fill(); c.stroke();
    c.fillStyle = '#bfe3ff'; rr(c, x - 10, y - 14, 20, 18, 2); c.fill(); c.stroke();
    ['#ff7ab8', '#7bd957', '#c98b4e'].forEach((col, k) => { c.fillStyle = col; c.beginPath(); c.arc(x - 6 + k * 6, y, 3.2, 0, 6.3); c.fill(); });
    c.strokeStyle = '#555b6b'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(x, y - 14); c.lineTo(x, y - 7); c.moveTo(x - 3, y - 4); c.lineTo(x, y - 7); c.lineTo(x + 3, y - 4); c.stroke(); c.strokeStyle = P.ink;
    c.fillStyle = '#c4272f'; rr(c, x - 14, y + 6, 28, 12, 3); c.fill(); c.lineWidth = 1.8; c.stroke();
  } else if (id === 'parking') {                                // estacionamiento: asfalto con rayas, letrero P y un cochecito
    c.beginPath(); c.moveTo(x - 24, y + 2); c.lineTo(x, y - 10); c.lineTo(x + 24, y + 2); c.lineTo(x, y + 14); c.closePath(); c.fillStyle = '#54566a'; c.fill(); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 1.6; c.beginPath(); for (let k = -1; k <= 1; k++) { c.moveTo(x + k * 10 - 6, y - 2 - k * 5 + 3); c.lineTo(x + k * 10 + 1, y + 2 - k * 5 + 7); } c.stroke(); c.strokeStyle = P.ink; c.lineWidth = 1.6;
    c.fillStyle = '#e0364a'; rr(c, x - 10, y - 8, 20, 10, 3); c.fill(); c.stroke(); c.fillStyle = '#8fd0f0'; rr(c, x - 5, y - 13, 10, 6, 2); c.fill(); c.stroke();
    c.fillStyle = '#2f6fd0'; rr(c, x + 12, y - 24, 12, 12, 2.5); c.fill(); c.stroke(); txt(c, 'P', x + 18, y - 14.5, { font: `700 11px ${FONT_UI}`, align: 'center', color: '#fff' });
  } else if (id === 'ext2' || id === 'ext3') {                   // el local con una ala nueva y flechas de ampliación
    const n = id === 'ext2' ? 2 : 3;
    c.beginPath(); c.moveTo(x - 20, y + 14); c.lineTo(x - 20, y - 2); c.lineTo(x - 4, y - 12); c.lineTo(x - 4, y + 14); c.closePath(); c.fillStyle = '#dcaa50'; c.fill(); c.stroke();
    c.beginPath(); c.moveTo(x - 4, y + 14); c.lineTo(x - 4, y - 12); c.lineTo(x + 20, y - 2); c.lineTo(x + 20, y + 14); c.closePath(); c.fillStyle = '#c4274a'; c.fill(); c.stroke();
    c.fillStyle = '#fff4e6'; c.fillRect(x + 4, y + 1, 7, 6); c.strokeRect(x + 4, y + 1, 7, 6);
    c.strokeStyle = P.gold; c.lineWidth = 2.4; c.beginPath(); c.moveTo(x - 22, y - 20); c.lineTo(x + 22, y - 20); c.moveTo(x + 16, y - 25); c.lineTo(x + 22, y - 20); c.lineTo(x + 16, y - 15); c.moveTo(x - 16, y - 25); c.lineTo(x - 22, y - 20); c.lineTo(x - 16, y - 15); c.stroke();
    txt(c, n === 2 ? 'II' : 'III', x, y + 10, { font: `400 14px ${FONT_DISPLAY}`, align: 'center', color: P.gold, stroke: P.ink, sw: 3 });
  } else if (id === 'pueblo' || id === 'casa') {                 // el pueblo: casita con techo y camino
    c.fillStyle = '#7bbf6a'; c.beginPath(); c.moveTo(x - 24, y + 4); c.lineTo(x, y - 8); c.lineTo(x + 24, y + 4); c.lineTo(x, y + 16); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#f1e6d0'; c.fillRect(x - 11, y - 10, 22, 16); c.strokeRect(x - 11, y - 10, 22, 16); c.fillStyle = '#b5482f'; c.beginPath(); c.moveTo(x - 14, y - 10); c.lineTo(x, y - 22); c.lineTo(x + 14, y - 10); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#7a4d28'; c.fillRect(x - 3, y - 2, 6, 8); c.strokeRect(x - 3, y - 2, 6, 8);
  } else if (id === 'vitrinam') {                                // vitrina con máscaras
    c.fillStyle = '#8a5a32'; rr(c, x - 14, y + 8, 28, 10, 3); c.fill(); c.stroke();
    c.fillStyle = 'rgba(190,225,250,.45)'; rr(c, x - 14, y - 20, 28, 30, 3); c.fill(); c.stroke();
    drawMask(c, x - 5, y - 11, 5.2, MASKS.ring); drawMask(c, x + 6, y - 11, 5.2, MASKS.blue); drawMask(c, x, y + 1, 5.2, MASKS.pink);
    c.fillStyle = '#ffd24a'; rr(c, x - 15, y - 25, 30, 6, 2); c.fill(); c.stroke();
  } else if (id === 'parrilla') {                                // parrilla roja con rejilla y brasas
    c.beginPath(); c.moveTo(x - 24, y - 2); c.lineTo(x, y - 14); c.lineTo(x + 24, y - 2); c.lineTo(x, y + 10); c.closePath(); c.fillStyle = '#24252c'; c.fill(); c.stroke();
    c.beginPath(); c.moveTo(x - 24, y - 2); c.lineTo(x, y + 10); c.lineTo(x, y + 22); c.lineTo(x - 24, y + 10); c.closePath(); c.fillStyle = '#d62f3a'; c.fill(); c.stroke();
    c.beginPath(); c.moveTo(x + 24, y - 2); c.lineTo(x, y + 10); c.lineTo(x, y + 22); c.lineTo(x + 24, y + 10); c.closePath(); c.fillStyle = '#8f1c26'; c.fill(); c.stroke();
    c.strokeStyle = '#aab0bf'; c.lineWidth = 1.2; c.beginPath(); for (let k = -2; k <= 2; k++) { c.moveTo(x + k * 7 - 7, y - 8 + Math.abs(k) * 1.2 + k * 1.5); c.lineTo(x + k * 7 + 7, y - 3 + k * 1.5); } c.stroke(); c.strokeStyle = P.ink; c.lineWidth = 1.8;
    flame(c, x - 8, y - 1, 8); flame(c, x + 6, y - 5, 7);
  } else if (id === 'farol') {                                   // poste con foco y su círculo de luz
    c.fillStyle = 'rgba(255,226,140,.3)'; c.beginPath(); c.ellipse(x, y + 17, 22, 8, 0, 0, 6.3); c.fill();
    c.fillStyle = '#2b2540'; rr(c, x - 2, y - 18, 4, 36, 1.5); c.fill(); c.stroke(); rr(c, x - 6, y + 14, 12, 5, 2); c.fill(); c.stroke();
    c.fillStyle = '#ffe58a'; rr(c, x - 6, y - 26, 12, 10, 3); c.fill(); c.stroke();
    c.fillStyle = '#2b2540'; rr(c, x - 8, y - 29, 16, 4, 2); c.fill(); c.stroke();
  } else if (id === 'cartel') {                                  // cartel de tacos: poste, tablero y aro con máscara de neón
    c.strokeStyle = '#6b7080'; c.lineWidth = 3; c.beginPath(); c.moveTo(x, y + 20); c.lineTo(x, y - 6); c.stroke(); c.strokeStyle = P.ink; c.lineWidth = 1.6;
    c.fillStyle = '#1d3b3a'; rr(c, x - 21, y - 14, 42, 17, 4); c.fill(); c.stroke();
    ['#ff3d3d', '#ffc83d', '#3ddc84', '#ff8a3d', '#5fd0ff'].forEach((col, k) => { c.fillStyle = col; c.fillRect(x - 17 + k * 7, y - 9, 5, 8); });
    c.fillStyle = '#2a2733'; c.beginPath(); c.arc(x, y - 21, 8, 0, 6.3); c.fill(); c.strokeStyle = '#ff5fa2'; c.lineWidth = 2; c.stroke();
    c.fillStyle = '#5fe8ff'; c.beginPath(); c.arc(x - 2.4, y - 22, 1.5, 0, 6.3); c.arc(x + 2.4, y - 22, 1.5, 0, 6.3); c.fill();
  } else if (id.startsWith('chairs_')) {                         // dos sillas del estilo elegido
    const C = CHAIRS[id.slice(7)];
    [-11, 11].forEach((dx, k) => {
      c.strokeStyle = C.leg; c.lineWidth = 2.4; c.beginPath(); c.moveTo(x + dx - 6, y + 16); c.lineTo(x + dx - 6, y + 6); c.moveTo(x + dx + 6, y + 16); c.lineTo(x + dx + 6, y + 6); c.stroke();
      c.strokeStyle = P.ink; c.lineWidth = 1.6;
      if (!C.stool) { c.fillStyle = C.back.left; rr(c, x + dx - 6, y - 15, 12, 20, 3); c.fill(); c.stroke(); }
      c.fillStyle = C.seat.top; c.beginPath(); c.moveTo(x + dx - 9, y + 5); c.lineTo(x + dx + 9, y + 5); c.lineTo(x + dx + 7, y + 10); c.lineTo(x + dx - 7, y + 10); c.closePath(); c.fill(); c.stroke();
      if (C.emblem) drawMask(c, x + dx, y - 6, 3.6, MASKS.blue);
      if (C.gem) drawGem(c, x + dx, y - 6, 3.4);
    });
  } else if (id.startsWith('table_')) {                          // mesa con el color del estilo
    const T = id.slice(6), col = { madera: ['#d9a066', '#b07a40', '#8a5a2c'], barril: ['#c98b4e', '#7a4a2a', '#5e3820'], talavera: ['#f4f6fb', '#3f66c9', '#2a4a9a'], ring: ['#2f56c9', '#c4272f', '#8f1c26'], oro: ['#ffe27a', '#e3b53a', '#b88a1f'] }[T];
    c.beginPath(); c.moveTo(x - 25, y - 2); c.lineTo(x, y - 15); c.lineTo(x + 25, y - 2); c.lineTo(x, y + 11); c.closePath(); c.fillStyle = col[0]; c.fill(); c.stroke();
    if (T === 'talavera') { c.fillStyle = '#3f66c9'; for (let k = -2; k <= 2; k++) { c.beginPath(); c.arc(x + k * 8, y - 2 + Math.abs(k) * 3.4, 2.2, 0, 6.3); c.fill(); } }
    if (T === 'ring' || T === 'oro') { c.save(); c.translate(x, y - 2); c.scale(1, .5); drawMask(c, 0, 0, 8, T === 'oro' ? MASKS.ring : MASKS.blue); c.restore(); }
    if (T === 'madera' || T === 'barril') { c.strokeStyle = 'rgba(60,35,15,.5)'; c.lineWidth = 1.2; for (const k of [-6, 4]) { c.beginPath(); c.moveTo(x - 18 + k, y - 5 + k * .2); c.lineTo(x + 8 + k, y - 12 + k * .2); c.stroke(); } c.strokeStyle = P.ink; c.lineWidth = 1.8; }
    c.beginPath(); c.moveTo(x - 25, y - 2); c.lineTo(x, y + 11); c.lineTo(x, y + 20); c.lineTo(x - 25, y + 7); c.closePath(); c.fillStyle = col[1]; c.fill(); c.stroke();
    c.beginPath(); c.moveTo(x + 25, y - 2); c.lineTo(x, y + 11); c.lineTo(x, y + 20); c.lineTo(x + 25, y + 7); c.closePath(); c.fillStyle = col[2]; c.fill(); c.stroke();
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
  c.fillStyle = '#16151b'; c.fillRect(x, y, w, h);
  if (it.kind === 'floor') {
    const F = FLOORS[it.key], hw = 16, hh = 8, ox = cx, oy = cy - 22;
    c.lineWidth = 1; c.strokeStyle = 'rgba(28,26,33,.3)';
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
      c.fillStyle = '#16141b'; rr(c, cx - 42, cy - 19, 84, 38, 6); c.fill(); c.lineWidth = 2; c.strokeStyle = `rgba(255,95,162,${fl})`; c.stroke();
      txt(c, 'TAQUERÍA', cx, cy - 2, { font: `400 ${fitDisplay(c, 'TAQUERÍA', 74, 15)}px ${FONT_DISPLAY}`, align: 'center', color: `rgba(255,170,210,${fl})` });
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
  c.fillStyle = 'rgba(12,11,15,.74)'; c.fillRect(-EX, HUD, CW, CH - EY - HUD);
  drawPanel(c, B.x, B.y, B.w, B.h, 'DECORAR');
  const cl = decClose, ch = UI.hit(cl); if (ch) UI.cursor = true;
  rr(c, cl.x, cl.y, cl.w, cl.h, 8); c.fillStyle = ch ? '#5a3a8a' : '#2f2c37'; c.fill(); c.lineWidth = 1.6; c.strokeStyle = 'rgba(255,255,255,.35)'; c.stroke();
  c.strokeStyle = P.white; c.lineWidth = 2.4; c.lineCap = 'round'; c.beginPath();
  c.moveTo(cl.x + 10, cl.y + 10); c.lineTo(cl.x + 20, cl.y + 20); c.moveTo(cl.x + 20, cl.y + 10); c.lineTo(cl.x + 10, cl.y + 20); c.stroke();
  DEC_CATS.forEach((cat, i) => {                                      // pestañas de categoría
    const q = decTab(i), on = w.decCat === cat[0], hov = UI.hit(q), gem = cat[0] === 'gem';
    if (hov) UI.cursor = true;
    rr(c, q.x, q.y, q.w, q.h, 9); c.fillStyle = on ? (gem ? '#1b8fb0' : '#e29a12') : hov ? '#4a2c80' : '#27252f'; c.fill(); c.lineWidth = on ? 3 : 1.6; c.strokeStyle = on ? (gem ? '#9ff0ff' : P.gold) : gem ? 'rgba(95,232,255,.55)' : 'rgba(255,255,255,.3)'; c.stroke();
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
    gem: 'Solo con gemas: las regalan visitantes especiales; con más máscaras de reputación llegan más seguido' }[w.decCat];
  txt(c, blurb, B.x + B.w / 2, B.y + B.h - 8, { font: `600 13px ${FONT_UI}`, align: 'center', color: P.muted });
  drawButton(c, decBack);
  drawCoin(c, B.x + B.w - 250, B.y + 394, 11, 0);
  txt(c, pesos(w.shownMoney), B.x + B.w - 234, B.y + 402, { font: `700 22px ${FONT_UI}`, color: w.moneyFlash > 0 ? '#ff7a8c' : P.white, stroke: P.ink, sw: 4 });
  drawGem(c, B.x + B.w - 120, B.y + 393, 10);
  txt(c, String(w.gems), B.x + B.w - 104, B.y + 402, { font: `700 22px ${FONT_UI}`, color: '#9ff0ff', stroke: P.ink, sw: 4 });
}
// tamaño de letra que hace caber un texto en un ancho dado (nunca baja de minSize)
function fitDisplay(c, s, maxW, size) { c.save(); c.font = `400 ${size}px ${FONT_DISPLAY}`; const wd = c.measureText(s).width; c.restore(); return wd > maxW ? Math.max(8, Math.floor(size * maxW / wd * 10) / 10) : size; }
function fitFont(c, s, maxW, size, weight = 600, minSize = 10) {
  c.save(); c.font = `${weight} ${size}px ${FONT_UI}`; const wd = c.measureText(s).width; c.restore();
  return wd > maxW ? Math.max(minSize, Math.floor(size * maxW / wd * 10) / 10) : size;
}
function drawShopChrome(c, w) {                                  // fondo, título, cerrar, pestañas, dinero y gemas
  const B = SHOPBOX, cur = shopCur(w);
  c.fillStyle = 'rgba(12,11,15,.74)'; c.fillRect(-EX, HUD, CW, CH - EY - HUD);
  drawPanel(c, B.x, B.y, B.w, B.h, 'TIENDA');
  const cl = shopClose, ch = UI.hit(cl); if (ch) UI.cursor = true;
  rr(c, cl.x, cl.y, cl.w, cl.h, 8); c.fillStyle = ch ? '#5a3a8a' : '#2f2c37'; c.fill(); c.lineWidth = 1.6; c.strokeStyle = 'rgba(255,255,255,.35)'; c.stroke();
  c.strokeStyle = P.white; c.lineWidth = 2.4; c.lineCap = 'round'; c.beginPath();
  c.moveTo(cl.x + 10, cl.y + 10); c.lineTo(cl.x + 20, cl.y + 20); c.moveTo(cl.x + 20, cl.y + 10); c.lineTo(cl.x + 10, cl.y + 20); c.stroke();
  shopTabs(w).forEach((tb, i) => {                                                   // pestañas: se desbloquean con el nivel
    if (w.loc !== 'rest' && tb[0] !== 'look') return;
    const q = shopTabBtn(w, i), on = cur === tb[0], hov = UI.hit(q), sub = tb[0] === 'decor' || tb[0] === 'look', lock = tabLocked(w, tb);
    if (hov) UI.cursor = true;
    rr(c, q.x, q.y, q.w, q.h, 9); c.fillStyle = on ? '#e29a12' : lock ? '#1c1a21' : hov ? '#4a2c80' : sub ? '#1b5a6a' : '#27252f'; c.fill(); c.lineWidth = on ? 3 : 1.6; c.strokeStyle = on ? P.gold : lock ? 'rgba(255,255,255,.18)' : sub ? '#5fe8ff' : 'rgba(255,255,255,.3)'; c.stroke();
    if (lock) {                                                                       // candado + nivel que lo abre
      const lx = q.x + 9, ly = q.y + 15;
      c.strokeStyle = '#9d96b4'; c.lineWidth = 1.8; c.beginPath(); c.arc(lx, ly - 2, 3.4, Math.PI, 0); c.stroke();
      c.fillStyle = '#9d96b4'; rr(c, lx - 5, ly - 1, 10, 8, 2); c.fill();
      txt(c, q.label, q.x + q.w / 2 + 6, q.y + 15, { font: `700 11.5px ${FONT_UI}`, align: 'center', color: on ? '#3a2408' : '#8f89a6', ls: .3 });
      txt(c, `NIVEL ${tb[2]}`, q.x + q.w / 2 + 6, q.y + 26, { font: `700 9px ${FONT_UI}`, align: 'center', color: on ? '#8a1c2c' : '#ff9aa8', ls: .6 });
    } else txt(c, q.label, q.x + q.w / 2, q.y + 20, { font: `700 ${fitFont(c, q.label, q.w - 8, 13.5, 700)}px ${FONT_UI}`, align: 'center', color: on ? P.ink : P.cream, ls: .5 });
  });
  drawCoin(c, B.x + 36, B.y + 20, 10, 0);                                             // dinero y gemas arriba, a los lados del título
  txt(c, pesos(w.shownMoney), B.x + 52, B.y + 28, { font: `700 22px ${FONT_UI}`, color: w.moneyFlash > 0 ? '#ff7a8c' : P.white, stroke: P.ink, sw: 4 });
  if (w.gemsSeen || w.gems > 0) { drawGem(c, B.x + B.w - 150, B.y + 20, 8); txt(c, String(w.gems), B.x + B.w - 136, B.y + 27, { font: `700 20px ${FONT_UI}`, color: '#9ff0ff', stroke: P.ink, sw: 3 }); }
}
function drawShop(c, w) {
  if (w.shopView === 'decor') { drawDecor(c, w); return; }
  if (w.shopView === 'look') { drawLook(c, w); return; }
  const B = SHOPBOX, items = shopRows(w), pages = shopPages(w);
  drawShopChrome(c, w);
  items.forEach((it, i) => {
    const y = B.y + B.top + i * B.rowH, chk = canBuy(w, it), b = shopBtn(i);
    if (i % 2 === 0) { c.fillStyle = 'rgba(255,255,255,.05)'; c.fillRect(B.x + 8, y, B.w - 16, B.rowH); }
    drawShopIcon(c, it.id, B.x + 52, y + B.rowH / 2, w);
    const dim = !chk.ok && !it.done, tw = B.w - 170 - 106 - 14;
    txt(c, it.name, B.x + 96, y + 21, { font: `700 ${fitFont(c, it.name, tw, 21, 700)}px ${FONT_UI}`, color: dim ? '#9d96b4' : P.cream });
    txt(c, it.desc, B.x + 96, y + 37, { font: `600 ${fitFont(c, it.desc, tw, 13.5)}px ${FONT_UI}`, color: P.muted });
    if (it.fire) txt(c, `Contratado · cobra ${pesos(it.wage)} por semana`, B.x + 96, y + 54, { font: `700 17px ${FONT_UI}`, color: '#9af0b8', ls: .5, maxW: tw });
    else if (it.open || it.done) txt(c, it.open ? 'Ya remodelado' : it.id === 'inv' ? 'Al máximo' : /^hand\d$/.test(it.id) ? 'Desbloqueada' : it.id === 'farol' ? 'Todos los faroles puestos' : it.id.startsWith('mv_') ? 'Aprendida' : (STAFF[it.id] || CHEFS[it.id]) ? 'Contratado' : it.id === 'arena' ? 'Construida' : (it.id === 'ext2' || it.id === 'ext3') ? 'Ya ampliado' : it.id === 'remodel' ? 'Ya remodelado' : 'En tu taquería', B.x + 96, y + 54, { font: `700 17px ${FONT_UI}`, color: '#9af0b8', ls: .5 });
    else if (it.gems) { drawGem(c, B.x + 106, y + 49, 7); txt(c, `${it.gems} gemas`, B.x + 118, y + 55, { font: `700 17px ${FONT_UI}`, color: w.gems >= it.gems ? '#9ff0ff' : '#ff8fa0', ls: .5 }); }
    else txt(c, pesos(it.price) + (it.wage ? ` · ${pesos(it.wage)} por semana` : ''), B.x + 96, y + 54, { font: `700 17px ${FONT_UI}`, color: dim ? '#8a7a50' : P.gold, ls: .5, maxW: tw });
    drawButton(c, Object.assign({ label: it.fire ? 'DESPEDIR' : it.open ? 'DECORAR' : it.done ? (it.id.startsWith('mv_') ? 'APRENDIDA' : 'COMPRADO') : it.need ? 'BLOQUEADO' : 'COMPRAR', style: it.fire ? 'red' : it.open ? 'teal' : 'green', size: 18 }, b, { disabled: !chk.ok }));
    if (!chk.ok && !it.done) txt(c, chk.why.toUpperCase(), b.x + b.w / 2, b.y + b.h + 11, { font: `700 ${fitFont(c, chk.why.toUpperCase(), 200, 10.5, 700, 8)}px ${FONT_UI}`, align: 'center', color: '#ff8fa0', ls: .5 });
  });
  if (pages > 1) { drawButton(c, shopPrev); drawButton(c, shopNext); txt(c, `${w.shopPage + 1} / ${pages}`, B.x + 94, B.y + B.h - 21, { font: `700 15px ${FONT_UI}`, align: 'center', color: P.cream }); }
  txt(c, 'El juego queda en pausa mientras compras', B.x + B.w / 2 + 30, B.y + B.h - 16, { font: `600 13px ${FONT_UI}`, align: 'center', color: P.muted, ls: 1 });
}
/* ---------- Mi luchador: personalización del personaje principal ---------- */
const LOOK_DEFAULT = { mask: 'novato', hoodie: '#eeeadf', shoes: 'novato', skin: '#e8b98a', pants: '#23232b', label: 0 };
const LOOK_LABELS = [['EL', 'NOVATO'], ['EL', 'CHEF'], ['TACO', 'MASTER'], ['EL', 'PATRÓN'], ['LUCHA', 'CAFÉ'], ['MI', 'TAQUERÍA'], ['LA', 'JEFA'], ['EL', 'CAMPEÓN'], ['REY', 'DEL RING'], ['MASK', 'KING'], ['TACO', 'MACHO']];
const LOOK_CATS = [['mask', 'MÁSCARA'], ['hoodie', 'SUDADERA'], ['shoes', 'TENIS'], ['skin', 'PIEL'], ['pants', 'PANTALÓN'], ['label', 'ESTAMPADO']];
// Cada opción: k = valor guardado, name, price (pesos), gems (solo con gemas) y level. Lo que cuesta 0 ya es tuyo
const LOOK_OPTS = {
  mask:   [{ k: 'novato', name: 'Verde Novato', price: 0, level: 1 }, { k: 'rosa', name: 'Rosa mexicano', price: 200, level: 3 }, { k: 'turquesa', name: 'Turquesa', price: 200, level: 3 }, { k: 'rayo', name: 'Rayo azul', price: 350, level: 5 },
           { k: 'noche', name: 'Noche negra', price: 350, level: 5 }, { k: 'michelada', name: 'Michelada', price: 600, level: 8 }, { k: 'oro', name: 'Oro de campeón', gems: 12, level: 1 },
           { k: 'carnaval', name: 'Carnaval', claw: true, level: 1 }, { k: 'jade', name: 'Jade', claw: true, level: 1 }, { k: 'tigre', name: 'Tigre', claw: true, level: 1 }],
  hoodie: [['#eeeadf', 'Blanco hueso', 0, 1], ['#17171c', 'Negro', 60, 2], ['#3b5bdb', 'Azul rey', 60, 2], ['#7c3aed', 'Morado', 80, 3], ['#d6342c', 'Rojo lucha', 80, 3], ['#ffb21e', 'Amarillo', 80, 4], ['#14a38b', 'Turquesa', 100, 5], ['#e8509a', 'Rosa', 100, 5], ['#2b3a67', 'Marino', 100, 6]]
    .map(a => ({ k: a[0], name: a[1], price: a[2], level: a[3] })),
  shoes:  [['novato', 'Verde Novato', 0, 1], ['blanco', 'Blancos', 40, 2], ['rojo', 'Rojos', 40, 2], ['azul', 'Azules', 40, 2], ['amarillo', 'Amarillos', 40, 3], ['camo', 'Camuflaje', 80, 4]].map(a => ({ k: a[0], name: a[1], price: a[2], level: a[3] })),
  skin:   [['#e8b98a', 'Clara', 0, 1], ['#f1c27d', 'Dorada', 0, 1], ['#e0ac69', 'Trigueña', 0, 1], ['#c68642', 'Morena', 0, 1], ['#8d5524', 'Canela oscura', 0, 1]].map(a => ({ k: a[0], name: a[1], price: a[2], level: a[3] })),
  pants:  [['#23232b', 'Negro', 0, 1], ['#2d3550', 'Mezclilla', 40, 2], ['#3a3a44', 'Gris', 40, 2], ['#4a3b2c', 'Café', 40, 3], ['#6b1d4a', 'Vino', 80, 5], ['#1f5a3a', 'Verde bosque', 80, 5]].map(a => ({ k: a[0], name: a[1], price: a[2], level: a[3] })),
  label:  [[0, 0, 1], [1, 50, 2], [2, 80, 3], [3, 120, 5], [4, 100, 4], [5, 100, 4], [6, 80, 3], [7, 150, 8]].map(a => ({ k: a[0], name: LOOK_LABELS[a[0]].join(' '), price: a[1], level: a[2] }))
};
LOOK_OPTS.mask.push({ k: 'catrina', name: 'Catrina', price: 1200, level: 8, town: true }, { k: 'azteca', name: 'Azteca', price: 1500, level: 12, town: true }, { k: 'cosmos', name: 'Cosmos', price: 2200, level: 18, town: true }, { k: 'fuego', name: 'Fuego', price: 3000, level: 24, town: true }, { k: 'plata', name: 'Plata', gems: 30, level: 1, town: true }, { k: 'arcoiris', name: 'Arcoíris', gems: 45, level: 1, town: true });
LOOK_OPTS.hoodie.push({ k: '#0e7c86', name: 'Turquesa océano', price: 400, level: 6, town: true }, { k: '#6b1d4a', name: 'Vino charro', price: 400, level: 6, town: true }, { k: '#ff8a3d', name: 'Naranja fuego', price: 500, level: 10, town: true }, { k: '#c0c8d8', name: 'Plata brillante', gems: 20, level: 1, town: true });
LOOK_OPTS.shoes.push({ k: 'galaxia', name: 'Galaxia', price: 700, level: 8, town: true }, { k: 'lava', name: 'Lava', price: 700, level: 12, town: true }, { k: 'plata', name: 'Plata', gems: 15, level: 1, town: true });
LOOK_OPTS.pants.push({ k: '#e0a42a', name: 'Dorado', price: 500, level: 10, town: true }, { k: '#7c3aed', name: 'Morado rey', price: 500, level: 10, town: true });
LOOK_OPTS.label.push({ k: 8, name: 'REY DEL RING', price: 300, level: 6, town: true }, { k: 9, name: 'MASK KING', price: 300, level: 6, town: true }, { k: 10, name: 'TACO MACHO', price: 300, level: 8, town: true });
LOOK_OPTS.hoodie.push({ k: '#ff5fd2', name: 'Rosa neón', claw: true, level: 1 }, { k: '#7cf0a8', name: 'Verde menta', claw: true, level: 1 }, { k: '#c9a227', name: 'Dorado campeón', claw: true, level: 1 });
LOOK_OPTS.shoes.push({ k: 'neon', name: 'Neón', claw: true, level: 1 }, { k: 'oro', name: 'Doradas', claw: true, level: 1 });
const playerLook = w => { const l = Object.assign({}, LOOK_DEFAULT, w.char && w.char.look); return { hoodie: l.hoodie, mask: l.mask, shoes: l.shoes, skin: l.skin, pants: l.pants, label: LOOK_LABELS[l.label] || LOOK_LABELS[0] }; };
const lookOwn = (w, cat, o) => (!o.price && !o.gems && !o.claw) || !!(w.char && w.char.own[cat + ':' + o.k]);
const LOOKBOX = { x: SHOPBOX.x + 270, y: SHOPBOX.y + 84, w: 446 };
const lookChip = i => ({ x: LOOKBOX.x + i * 75, y: LOOKBOX.y, w: 71, h: 28, key: LOOK_CATS[i][0], label: LOOK_CATS[i][1] });
const LOOK_PER = 12;
const lookCard = i => ({ x: LOOKBOX.x + (i % 4) * 113, y: LOOKBOX.y + 38 + Math.floor((i % LOOK_PER) / 4) * 104, w: 107, h: 98 });
const lookPageBtn = k => ({ x: LOOKBOX.x + (k ? 372 : 0), y: LOOKBOX.y + 38 + 3 * 104 - 2, w: 70, h: 24, label: k ? '▶' : '◀', size: 14, style: 'dark' });
function lookPointer(w, x, y, hit) {
  for (let i = 0; i < LOOK_CATS.length; i++) if (hit(lookChip(i))) { if (w.lookCat !== LOOK_CATS[i][0]) { w.lookCat = LOOK_CATS[i][0]; w.lookPage = 0; sfx('click'); } return; }
  const cat = w.lookCat || 'mask', opts = LOOK_OPTS[cat], pages = Math.ceil(opts.length / LOOK_PER); w.lookPage = clamp(w.lookPage || 0, 0, pages - 1);
  if (pages > 1 && hit(lookPageBtn(0))) { w.lookPage = (w.lookPage + pages - 1) % pages; sfx('click'); return; }
  if (pages > 1 && hit(lookPageBtn(1))) { w.lookPage = (w.lookPage + 1) % pages; sfx('click'); return; }
  for (let i = w.lookPage * LOOK_PER; i < Math.min(opts.length, (w.lookPage + 1) * LOOK_PER); i++) if (hit(lookCard(i))) { lookPick(w, cat, opts[i]); return; }
}
function lookPick(w, cat, o) {
  const ch = w.char, key = cat + ':' + o.k;
  if (o.town && !lookOwn(w, cat, o) && w.loc !== 'in') { sfx('nope'); toast(w, `${o.name}: solo se compra en la boutique del pueblo`); return; }
  if (w.level < o.level) { sfx('nope'); toast(w, `${o.name}: se desbloquea en el nivel ${o.level}`); return; }
  if (!lookOwn(w, cat, o)) {
    if (o.claw) { sfx('nope'); toast(w, `${o.name}: solo se gana en la máquina de garra`); return; }
    if (o.gems) { if (w.gems < o.gems) { sfx('nope'); toast(w, `Faltan ${o.gems - w.gems} gemas`); return; } w.gems -= o.gems; }
    else { if (w.money < o.price) { sfx('nope'); w.moneyFlash = .8; toast(w, `Faltan ${pesos(o.price - w.money)}`); return; } w.money -= o.price; w.dayCost += o.price; }
    ch.own[key] = true; sfx(o.gems ? 'fanfare' : 'coin'); toast(w, `¡Nuevo look: ${o.name}!`);
  } else sfx('click');
  ch.look[cat] = o.k; Game.save();
}
// Muestra de cada opción dentro de su tarjeta
function drawLookSwatch(c, cat, o, cx, cy, w, t) {
  if (cat === 'mask') { c.save(); drawFace(c, cx, cy + 2, 17, MASK_STYLES[o.k], { look: 0, angry: false, blink: false, open: 0 }); c.restore(); }
  else if (cat === 'hoodie' || cat === 'skin' || cat === 'pants') { c.fillStyle = o.k; c.strokeStyle = P.ink; c.lineWidth = 2.5; c.beginPath(); c.arc(cx, cy, 17, 0, 6.3); c.fill(); c.stroke(); c.fillStyle = 'rgba(255,255,255,.3)'; c.beginPath(); c.arc(cx - 6, cy - 6, 5, 0, 6.3); c.fill(); }
  else if (cat === 'shoes') { const S_ = SHOES[o.k]; c.save(); c.translate(cx, cy + 2); c.lineJoin = 'round'; c.lineWidth = 2; c.strokeStyle = P.ink; c.fillStyle = S_.sole; rr(c, -20, 2, 40, 9, 4); c.fill(); c.stroke(); c.fillStyle = S_.upper; c.beginPath(); c.moveTo(-18, 3); c.lineTo(-16, -12); c.lineTo(-2, -12); c.lineTo(20, 2); c.closePath(); c.fill(); c.stroke(); c.fillStyle = S_.accent; c.fillRect(-12, -6, 10, 3); c.restore(); }
  else { const lb = LOOK_LABELS[o.k]; c.fillStyle = '#17171c'; rr(c, cx - 30, cy - 17, 60, 36, 7); c.fill(); c.lineWidth = 2; c.strokeStyle = P.ink; c.stroke(); txt(c, lb[0], cx, cy - 2, { font: `700 12px ${FONT_UI}`, align: 'center', color: '#e0603f', ls: .5 }); txt(c, lb[1], cx, cy + 13, { font: `700 ${lb[1].length > 7 ? 11 : 13}px ${FONT_UI}`, align: 'center', color: '#e0603f', ls: .3 }); }
}
function drawLook(c, w) {
  const B = SHOPBOX, cat = w.lookCat || 'mask', opts = LOOK_OPTS[cat], ch = w.char, cur = ch.look[cat];
  drawShopChrome(c, w);
  // vista previa a la izquierda: el luchador gira un poco y respira
  const px = B.x + 24, py = B.y + 84, pw = 232, ph = 330;
  c.save(); rr(c, px, py, pw, ph, 14); c.clip();
  const g = c.createLinearGradient(0, py, 0, py + ph); g.addColorStop(0, '#2d2a36'); g.addColorStop(1, '#4a1a3a'); c.fillStyle = g; c.fillRect(px, py, pw, ph);
  c.fillStyle = 'rgba(255,214,90,.12)'; c.beginPath(); c.moveTo(px + pw / 2 - 18, py); c.lineTo(px + pw / 2 + 18, py); c.lineTo(px + pw / 2 + 96, py + ph); c.lineTo(px + pw / 2 - 96, py + ph); c.closePath(); c.fill();
  c.fillStyle = '#8f1d33'; c.fillRect(px, py + ph - 70, pw, 70); c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(px + pw / 2, py + ph - 52, 62, 12, 0, 0, 6.3); c.fill();
  drawLuchador(c, px + pw / 2, py + ph - 50, Object.assign({}, playerLook(w), { state: Math.floor(w.t / 4) % 2 ? 'idle' : 'idle', t: w.t, dir: Math.sin(w.t * .7) > 0 ? 1 : -1, scale: 3.1 }));
  c.restore(); rr(c, px, py, pw, ph, 14); c.lineWidth = 3; c.strokeStyle = P.gold; c.stroke();
  txt(c, 'TU LUCHADOR', px + pw / 2, py + 28, { font: `400 20px ${FONT_DISPLAY}`, align: 'center', color: P.gold, stroke: P.ink, sw: 4 });
  // categorías
  LOOK_CATS.forEach((ct, i) => {
    const q = lookChip(i), on = cat === ct[0], hov = UI.hit(q); if (hov) UI.cursor = true;
    rr(c, q.x, q.y, q.w, q.h, 8); c.fillStyle = on ? '#e29a12' : hov ? '#4a2c80' : '#27252f'; c.fill(); c.lineWidth = on ? 3 : 1.6; c.strokeStyle = on ? P.gold : 'rgba(255,255,255,.3)'; c.stroke();
    txt(c, q.label, q.x + q.w / 2, q.y + 19, { font: `700 ${fitFont(c, q.label, q.w - 6, 12.5, 700)}px ${FONT_UI}`, align: 'center', color: on ? P.ink : P.cream, ls: .3 });
  });
  const lpages = Math.ceil(opts.length / LOOK_PER); w.lookPage = clamp(w.lookPage || 0, 0, lpages - 1);
  if (lpages > 1) { drawButton(c, lookPageBtn(0)); drawButton(c, lookPageBtn(1)); txt(c, `${w.lookPage + 1} / ${lpages}`, LOOKBOX.x + 223, LOOKBOX.y + 38 + 3 * 104 + 15, { font: `700 14px ${FONT_UI}`, align: 'center', color: P.cream }); }
  opts.forEach((o, i) => {
    if (Math.floor(i / LOOK_PER) !== w.lookPage) return;
    const q = lookCard(i), sel = String(cur) === String(o.k), own = lookOwn(w, cat, o), locked = w.level < o.level, hov = UI.hit(q) && !locked; if (UI.hit(q)) UI.cursor = true;
    rr(c, q.x, q.y, q.w, q.h, 12); c.fillStyle = hov ? 'rgba(255,255,255,.13)' : 'rgba(255,255,255,.06)'; c.fill();
    c.lineWidth = sel ? 3.5 : 2; c.strokeStyle = sel ? '#9af0b8' : o.town ? 'rgba(255,200,90,.8)' : o.claw ? 'rgba(255,150,230,.75)' : o.gems ? 'rgba(95,232,255,.7)' : hov ? P.gold : 'rgba(255,255,255,.22)'; c.stroke();
    c.save(); c.globalAlpha = locked ? .35 : 1; drawLookSwatch(c, cat, o, q.x + q.w / 2, q.y + 36, w, w.t); c.restore();
    txt(c, o.name, q.x + q.w / 2, q.y + 70, { font: `700 ${fitFont(c, o.name, q.w - 10, 13.5, 700, 9)}px ${FONT_UI}`, align: 'center', color: locked ? '#9d96b4' : P.cream });
    if (locked) txt(c, `NIVEL ${o.level}`, q.x + q.w / 2, q.y + 89, { font: `700 12px ${FONT_UI}`, align: 'center', color: '#ff8fa0', ls: .4 });
    else if (sel) txt(c, '✓ PUESTO', q.x + q.w / 2, q.y + 89, { font: `700 12.5px ${FONT_UI}`, align: 'center', color: '#9af0b8', ls: .4 });
    else if (own) txt(c, 'TUYO · PONER', q.x + q.w / 2, q.y + 89, { font: `700 12px ${FONT_UI}`, align: 'center', color: P.muted, ls: .3 });
    else if (o.claw) txt(c, 'PREMIO DE GARRA', q.x + q.w / 2, q.y + 90, { font: `700 ${fitFont(c, 'PREMIO DE GARRA', q.w - 8, 12, 700)}px ${FONT_UI}`, align: 'center', color: '#ffb3e8', ls: .2 });
    else if (o.gems) { drawGem(c, q.x + q.w / 2 - 14, q.y + 85, 6); txt(c, String(o.gems), q.x + q.w / 2 - 5, q.y + 91, { font: `700 15px ${FONT_UI}`, color: w.gems >= o.gems ? '#9ff0ff' : '#ff8fa0' }); }
    else txt(c, pesos(o.price), q.x + q.w / 2, q.y + 91, { font: `700 15px ${FONT_UI}`, align: 'center', color: w.money >= o.price ? P.gold : '#ff8fa0' });
  });
  txt(c, 'Tu luchador se ve así en el changarro. Lo básico es gratis; lo demás se compra con monedas o gemas', B.x + B.w / 2, B.y + B.h - 14, { font: `600 13px ${FONT_UI}`, align: 'center', color: P.muted });
}
function drawTip(c, x, y, lines) {
  c.save(); c.font = `700 15px ${FONT_UI}`;
  const w = Math.max(...lines.map(l => c.measureText(l).width)) + 20, h = 8 + lines.length * 18;
  const tx = clamp(x, 8, W - w - 8), ty = clamp(y, HUD + 6, H - h - 6);
  c.fillStyle = 'rgba(17,16,20,.92)'; rr(c, tx, ty, w, h, 8); c.fill(); c.lineWidth = 1.6; c.strokeStyle = P.gold; c.stroke();
  lines.forEach((l, i) => txt(c, l, tx + 10, ty + 19 + i * 18, { font: `700 15px ${FONT_UI}`, color: i ? P.muted : P.cream }));
  c.restore();
}
function drawTooltips(c, w) {
  if (UI.mx > 430 && UI.mx < 585 && UI.my < HUD) {                    // explicación de la reputación al pasar el cursor por las máscaras
    const er = effRep(w);
    drawTip(c, 300, HUD + 8, ['Reputación en máscaras', 'Cliente enojado: la máscara se desvanece 1/3 (con 3 se pierde)', 'Cliente bien atendido: recupera 1/4',
      `Con ${er.toFixed(1)} máscaras: ${Math.round(gemChance(w) * 100)} % de que hoy lleguen visitantes con gemas`, 'Más máscaras: más gemas, más VIPs y personajes famosos (La Reina del Ring con 3, El Cronista con 2)',
      `Estrellas de Sabor: ${starTxt(starsOf(w))} de 5 · más estrellas = mejores clientes y más propina (ataca rivales en el MAPA)`]);
    return;
  }
  if (w.panel) return;
  const m = camWorld(UI.mx, UI.my), mx = m.x, my = m.y;                   // el cursor en coordenadas del mundo (con zoom)
  const tip = (x, y, lines) => { const q = camScreen(x, y); drawTip(c, q.x, q.y, lines); };
  const sk = stockAt(w, mx, my);                              // pilas de la barra y del mostrador de bebidas
  if (sk) { const p = stockPos(sk); UI.cursor = true; tip(p.x + 26, p.y - 58, [RECIPES[sk].name, `${w.stock[sk]} listas · venta ${pesos(dishPrice(sk))}${isFav(sk) ? ' (fecha especial)' : ''} c/u`]); return; }
  for (const cu of w.customers) {                                  // qué pidió cada cliente
    if (cu.state !== 'wait') continue;
    const p = actorPos(cu, true);
    if (mx > p.x - 25 && mx < p.x + 25 && my > p.y - 80 && my < p.y + 12) {
      UI.cursor = true;
      const bits = cu.order.map(i => (i.done ? '✓ ' : '') + RECIPES[i.key].name);
      tip(p.x + 30, p.y - 118, ['Pidió:', ...bits].concat(cu.freeze > 0 ? [`Espera congelada ${Math.ceil(cu.freeze)} s`] : [])); return;
    }
  }
  const nv = w.novato, np = actorPos(nv, nv.resting);
  if (mx > np.x - 25 && mx < np.x + 25 && my > np.y - 80 && my < np.y + 12) {
    UI.cursor = true;
    tip(np.x + 30, np.y - 120, [`El Novato · Nivel ${w.level}`, `Energía ${Math.round(nv.stamina)} de ${maxStamina(w)}`, nv.resting ? 'Toca para que vuelva al trabajo' : 'Toca para que vaya a descansar']); return;
  }
  for (const wt of w.staff) {
    if (wt.entering) continue;
    const wp = actorPos(wt, wt.resting);
    if (mx > wp.x - 25 && mx < wp.x + 25 && my > wp.y - 80 && my < wp.y + 12) {
      tip(wp.x + 30, wp.y - 120, [STAFF[wt.id].name, `Energía ${Math.round(wt.stamina)} de 100`, wt.stun > 0 ? '¡Fuera de combate!' : wt.resting ? 'Descansando en la banca' : STAFF[wt.id].desc]); return;
    }
  }
  for (const g of w.guards) {
    const gp = S(g.x, g.y), D = GUARDS[g.id];
    if (!g.path.length && mx > gp.x - 25 && mx < gp.x + 25 && my > gp.y - 90 && my < gp.y + 12) {
      UI.cursor = true; tip(gp.x - 150, gp.y - 100, [D.name, `La fila espera ${(1 / D.drain).toFixed(1).replace('.0', '')} veces más`, `Cobra ${pesos(D.wage)} por semana`]); return;
    }
  }
  for (const ch of w.chefs) {
    const cp2 = S(ch.x, ch.y), D = CHEFS[ch.id];
    if (!ch.entering && mx > cp2.x - 25 && mx < cp2.x + 25 && my > cp2.y - 100 && my < cp2.y + 12) {
      UI.cursor = true; tip(cp2.x + 30, cp2.y - 130, [D.name, ch.job ? 'Preparando ' + RECIPES[ch.job.key].name : 'Cocina solo lo que falta', D.wage ? `Cobra ${pesos(D.wage)} por semana` : 'Pago único: no cobra sueldo']); return;
    }
  }
  if (restHit(mx, my)) { UI.cursor = true; const bp = TS(LAYOUT.bench, 1, .4, 70); tip(bp.x - 150, bp.y - 20, ['Vestidor con suero', 'Banca de dos lugares: toca para que el Novato descanse']); return; }
  const cp = comalPos();
  const hov = LAYOUT.comals.findIndex((_, i) => comalHit(mx, my, i));
  if (hov >= 0) { UI.cursor = true; const hp = comalPos(hov), hi = LAYOUT.comals[hov]; tip(hp.x + 70, hp.y - 40, [hi.type === 'parrilla' ? 'Parrilla de carne asada' : LAYOUT.comals.length > 1 ? `Comal ${hov + 1}` : 'Comal', `${hi.slots.filter(q => q.state === 'cook').length} de ${hi.slots.length} lugares en uso`, 'Toca para elegir qué cocinar']); }
  else if (fridgeHit(mx, my)) { UI.cursor = true; const fp = fridgeRingPos(0); tip(fp.x + 30, fp.y - 20, ['Refrigerador', 'Micheladas: toca para prepararlas']); }
}

/* =========================================================
   CARTEL DE TACOS (afuera, en el pasto): poste con aro de neón, tablero con el nombre del negocio, chiles y papel picado.
   Se edita tocándolo; tiene lucecitas que parpadean y por la noche brilla.
   ========================================================= */
const SIGN_STYLES = [
  { name: 'Arcoíris',       letters: ['#ff3d3d', '#ffc83d', '#3ddc84', '#ff8a3d', '#5fd0ff', '#ff5fa2', '#b57cff'], board: '#1d3b3a', frame: '#e0364a', neon: '#ff5a3a', ring: '#e0364a', halo: '255,150,80' },
  { name: 'Neón rosa',      letters: ['#ff7ab8', '#ffb3d9'], board: '#1f1d25', frame: '#ff3d8b', neon: '#5fe8ff', ring: '#ff3d8b', halo: '255,90,170' },
  { name: 'Dorado',         letters: ['#ffe27a', '#ffc83d', '#ffb21e'], board: '#2a2733', frame: '#ffc83d', neon: '#ff8a3d', ring: '#ffc83d', halo: '255,200,90' },
  { name: 'Tricolor',       letters: ['#3ddc84', '#fff4e6', '#ff4d5e'], board: '#1b2a3a', frame: '#2fbf71', neon: '#ff4d5e', ring: '#2fbf71', halo: '120,255,170' },
  { name: 'Azul eléctrico', letters: ['#5fd0ff', '#ffffff', '#8fb0ff'], board: '#0d1b3a', frame: '#3b82f6', neon: '#ffd23a', ring: '#3b82f6', halo: '110,170,255' }
];
const signOf = () => Object.assign({ t1: 'ENMASCARADOS', t2: 'TACOS', st: 0, li: true }, DECO && DECO.sign);
// Dibuja el cartel con el poste apoyado en (px, py). t = reloj (para los parpadeos)
function drawCartelAt(c, px, py, t, glow = 0) {
  const D = signOf(), ST = SIGN_STYLES[D.st] || SIGN_STYLES[0], ink = P.ink;
  c.save(); c.translate(px, py); c.lineJoin = 'round'; c.lineCap = 'round';
  c.fillStyle = 'rgba(0,0,0,.22)'; c.beginPath(); c.ellipse(4, 3, 34, 11, 0, 0, 6.3); c.fill();
  c.fillStyle = '#3a3e4a'; c.strokeStyle = ink; c.lineWidth = 2;                                       // base de concreto
  c.beginPath(); c.moveTo(-18, 0); c.lineTo(0, -9); c.lineTo(18, 0); c.lineTo(0, 9); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#555b6b'; c.beginPath(); c.moveTo(-18, 0); c.lineTo(0, 9); c.lineTo(0, 15); c.lineTo(-18, 6); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#434858'; c.beginPath(); c.moveTo(18, 0); c.lineTo(0, 9); c.lineTo(0, 15); c.lineTo(18, 6); c.closePath(); c.fill(); c.stroke();
  const pg = c.createLinearGradient(-5, 0, 5, 0); pg.addColorStop(0, '#8a8f9e'); pg.addColorStop(.5, '#b0b5c2'); pg.addColorStop(1, '#5b6070');       // poste oxidado
  c.fillStyle = pg; c.lineWidth = 2; rr(c, -5, -158, 10, 154, 3); c.fill(); c.stroke();
  c.fillStyle = 'rgba(160,90,40,.45)'; for (let k = 0; k < 7; k++) c.fillRect(-4 + (k % 2) * 4, -140 + k * 20, 3, 6);
  // papel picado colgando del poste hacia la izquierda y debajo del tablero
  const flags = (x0, y0, x1, y1, n, sag, off) => {
    c.strokeStyle = ink; c.lineWidth = 1.3; c.beginPath();
    for (let i = 0; i <= 20; i++) { const f = i / 20; c[i ? 'lineTo' : 'moveTo'](lerp(x0, x1, f), lerp(y0, y1, f) + Math.sin(f * Math.PI) * sag); } c.stroke();
    const cols = ['#e0364a', '#ffc83d', '#17a2b0', '#2fbf71', '#ff5fa2', '#ff8a3d', '#b57cff'];
    for (let i = 1; i < n; i++) { const f = i / n, x = lerp(x0, x1, f), y = lerp(y0, y1, f) + Math.sin(f * Math.PI) * sag, sw = Math.sin(t * 1.8 + i * 1.3 + off) * 2;
      c.fillStyle = cols[(i + off) % cols.length]; c.beginPath(); c.moveTo(x - 6, y); c.lineTo(x + 6, y); c.lineTo(x + sw, y + 13); c.closePath(); c.fill(); c.lineWidth = 1; c.stroke();
      c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.arc(x + sw * .3, y + 4, 1.3, 0, 6.3); c.fill(); }
  };
  flags(-3, -150, -92, -108, 7, 10, 0);
  flags(3, -60, 78, -88, 6, 9, 3);
  // tablero con el nombre: curvo, con marco de color
  const board = () => { c.beginPath(); c.moveTo(-70, -116); c.quadraticCurveTo(0, -156, 70, -116); c.lineTo(70, -86); c.quadraticCurveTo(0, -118, -70, -86); c.closePath(); };
  c.lineWidth = 7; c.strokeStyle = ink; board(); c.stroke();
  board(); c.fillStyle = ST.board; c.fill(); c.lineWidth = 4; c.strokeStyle = ST.frame; c.stroke();
  const arc = f => ({ x: lerp(-60, 60, f), y: -101 + Math.sin(f * Math.PI) * -17.5 });                   // línea central del tablero
  // línea 1: cada letra de un color, siguiendo la curva del tablero
  { const s1 = (D.t1 || '').toUpperCase(), n = s1.length || 1; let fs = 20; c.font = `400 ${fs}px ${FONT_DISPLAY}`; const full = c.measureText(s1).width; if (full > 108) fs = Math.max(11, Math.floor(fs * 108 / full)); c.font = `400 ${fs}px ${FONT_DISPLAY}`;
    const ws = [...s1].map(ch => c.measureText(ch).width), tot = ws.reduce((a, b) => a + b, 0); let acc = 0;
    [...s1].forEach((ch, i) => { const f = clamp((acc + ws[i] / 2) / tot, .02, .98), p = arc(f), q = arc(f + .02), ang = Math.atan2(q.y - p.y, q.x - p.x) * .9;
      c.save(); c.translate(lerp(-54, 54, f), p.y + fs * .08); c.rotate(ang); c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 4; c.strokeStyle = ink; c.strokeText(ch, 0, 0); c.fillStyle = ST.letters[i % ST.letters.length]; c.fillText(ch, 0, 0); c.restore(); acc += ws[i]; }); }
  // línea 2: tablero de neón
  const fl = .8 + .2 * Math.sin(t * 7) * Math.sin(t * 2.3);
  c.fillStyle = '#16141b'; rr(c, -46, -86, 92, 28, 7); c.fill(); c.lineWidth = 3; c.strokeStyle = ink; c.stroke(); c.lineWidth = 2; c.strokeStyle = ST.neon; c.globalAlpha = fl; rr(c, -43, -83, 86, 22, 5); c.stroke(); c.globalAlpha = 1;
  { const s2 = (D.t2 || '').toUpperCase(); let fs = 21; c.font = `400 ${fs}px ${FONT_DISPLAY}`; const wd = c.measureText(s2).width; if (wd > 78) fs = Math.max(10, Math.floor(fs * 78 / wd)); c.font = `400 ${fs}px ${FONT_DISPLAY}`;
    c.save(); c.shadowColor = ST.neon; c.shadowBlur = 8 * fl; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = ST.neon; c.globalAlpha = fl; c.fillText(s2, 0, -71); c.fillStyle = '#fff4e6'; c.globalAlpha = .45 * fl; c.fillText(s2, 0, -71.5); c.restore(); }
  // aro superior con máscara de neón
  c.lineWidth = 7; c.strokeStyle = ink; c.beginPath(); c.arc(0, -178, 31, 0, 6.3); c.stroke();
  c.fillStyle = '#1f1d26'; c.beginPath(); c.arc(0, -178, 28, 0, 6.3); c.fill(); c.lineWidth = 5; c.strokeStyle = ST.ring; c.stroke();
  c.lineWidth = 1.6; c.strokeStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.arc(0, -178, 25, 3.6, 5.2); c.stroke();
  c.save(); c.translate(0, -178); c.scale(16, 16); maskPath(c); c.lineWidth = .12; c.strokeStyle = `rgba(95,232,255,${fl})`; c.shadowColor = '#5fe8ff'; c.shadowBlur = 8; c.stroke();
  c.fillStyle = `rgba(255,95,162,${fl * .85})`; for (const m of [-1, 1]) { eyePath(c, m); c.fill(); }
  star(c, 0, -.66, .24, .1); c.fillStyle = `rgba(255,226,122,${fl})`; c.fill(); c.restore();
  // chiles que cuelgan del tablero
  const chile = (x, y, col, rot) => { c.save(); c.translate(x, y); c.rotate(rot); c.strokeStyle = '#2f8f4e'; c.lineWidth = 1.3; c.beginPath(); c.moveTo(0, -12); c.lineTo(0, -6); c.stroke();
    c.fillStyle = col; c.strokeStyle = ink; c.lineWidth = 1.4; c.beginPath(); c.moveTo(-3.4, -6); c.quadraticCurveTo(-4, 8, 1, 17); c.quadraticCurveTo(3.6, 8, 3.4, -6); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#2f8f4e'; c.beginPath(); c.arc(0, -6, 3.6, Math.PI, 0); c.closePath(); c.fill(); c.stroke(); c.restore(); };
  chile(-66, -96, '#e0364a', .15); chile(-72, -92, '#3fb04f', -.1); chile(66, -96, '#3fb04f', -.15); chile(72, -92, '#e0364a', .1);
  // lucecitas: alrededor del aro y del tablero (parpadean; con "luces: no" quedan apagadas)
  if (D.li) {
    const bulbs = [];
    for (let i = 0; i < 14; i++) { const a = i / 14 * 6.283 + .2; bulbs.push([Math.cos(a) * 31, -178 + Math.sin(a) * 31]); }
    for (let i = 0; i < 12; i++) { const f = i / 11, p = arc(f); bulbs.push([lerp(-66, 66, f), p.y - 19 + Math.pow(Math.abs(f - .5) * 2, 2) * 3]); }
    for (let i = 0; i < 7; i++) bulbs.push([lerp(-46, 46, i / 6), -57]);
    const bc = ['#ff5a5a', '#ffd23a', '#5fe8ff', '#7cf07c', '#ff8afc'];
    bulbs.forEach(([bx, by], i) => { const on = (Math.sin(t * 5 + i * 1.7) + 1) / 2, col = bc[i % bc.length];
      c.fillStyle = col; c.globalAlpha = .22 + .3 * on + glow * .3; c.beginPath(); c.arc(bx, by, 6.5, 0, 6.3); c.fill();
      c.globalAlpha = 1; c.fillStyle = col; c.beginPath(); c.arc(bx, by, 2.5, 0, 6.3); c.globalAlpha = .55 + .45 * on; c.fill(); c.globalAlpha = 1; c.lineWidth = .9; c.strokeStyle = ink; c.stroke(); });
  }
  c.restore();
}
function drawCartel(c, w, gx, gy) { const p = S(gx + .5, gy + .5); drawCartelAt(c, p.x, p.y, clock, nightGlow(w)); }
const nightGlow = w => clamp((hourOf(w) - 17.2) / 2.2, 0, 1);

/* ---------- Editor del letrero: nombre del negocio con teclado en pantalla (también se puede escribir con el teclado) ---------- */
const SIGN_ROWS = ['1234567890', 'QWERTYUIOP', 'ASDFGHJKLÑ', 'ZXCVBNM', 'ÁÉÍÓÚÜ&!.-'];
const SIGN_MAX = [14, 10];
const SIGNBOX = { x: 120, y: 70, w: 720, h: 476 };
const signField = i => ({ x: SIGNBOX.x + 372, y: SIGNBOX.y + 44 + i * 58, w: 328, h: 40 });
const signStyleBtn = i => ({ x: SIGNBOX.x + 372 + i * 66, y: SIGNBOX.y + 172, w: 62, h: 30 });
const signLightBtn = { x: SIGNBOX.x + 372, y: SIGNBOX.y + 212, w: 150, h: 32, size: 15 };
function signKeys() {
  const out = [], kx = SIGNBOX.x + 372, ky = SIGNBOX.y + 256, kw = 31, gap = 3.2, rp = 36, kh = 32;
  SIGN_ROWS.forEach((row, ri) => [...row].forEach((ch, i) => out.push({ x: kx + i * (kw + gap), y: ky + ri * rp, w: kw, h: kh, ch })));
  out.push({ x: kx + 7 * (kw + gap), y: ky + 3 * rp, w: kw * 3 + gap * 2, h: kh, act: 'back', label: '⌫' });
  out.push({ x: kx, y: ky + 5 * rp, w: kw * 6 + gap * 5, h: kh, ch: ' ', label: 'ESPACIO' });
  out.push({ x: kx + 6 * (kw + gap) + 4, y: ky + 5 * rp, w: kw * 4 + gap * 3 - 4, h: kh, act: 'clear', label: 'BORRAR' });
  return out;
}
function signType(w, ch) {
  const D = DECO.sign, k = w.signField ? 't2' : 't1', mx = SIGN_MAX[w.signField || 0];
  if ((D[k] || '').length >= mx) { sfx('nope'); return; }
  D[k] = (D[k] || '') + ch; sfx('type');
}
function signKey(w, e) {
  const D = DECO.sign, k = w.signField ? 't2' : 't1';
  if (e.key === 'Escape' || e.key === 'Enter') { closeSign(w); return true; }
  if (e.key === 'Tab') { w.signField = w.signField ? 0 : 1; sfx('click'); return true; }
  if (e.key === 'Backspace') { D[k] = (D[k] || '').slice(0, -1); sfx('back'); return true; }
  if (e.key && e.key.length === 1 && !e.ctrlKey && !e.metaKey) { const ch = e.key.toUpperCase(); if (/^[A-ZÑÁÉÍÓÚÜ0-9 &!.\-]$/.test(ch)) { signType(w, ch); return true; } }
  return false;
}
function closeSign(w) { w.modal = null; if (!(DECO.sign.t1 || '').trim()) DECO.sign.t1 = 'ENMASCARADOS'; if (!(DECO.sign.t2 || '').trim()) DECO.sign.t2 = 'TACOS'; sfx('back'); toast(w, '¡Letrero guardado!'); Game.save(); }
function openSign(w) { DECO.sign = Object.assign({ t1: 'ENMASCARADOS', t2: 'TACOS', st: 0, li: true }, DECO.sign); w.modal = 'sign'; w.signField = 0; w.panel = false; sfx('click'); }
function signPointer(w, x, y) {
  const hit = b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h, D = DECO.sign;
  if (hit(signDoneBtn())) { closeSign(w); return; }
  for (let i = 0; i < 2; i++) if (hit(signField(i))) { w.signField = i; sfx('click'); return; }
  for (let i = 0; i < SIGN_STYLES.length; i++) if (hit(signStyleBtn(i))) { D.st = i; sfx('click'); return; }
  if (hit(signLightBtn)) { D.li = !D.li; sfx('click'); return; }
  const k = w.signField ? 't2' : 't1';
  for (const key of signKeys()) if (hit(key)) {
    if (key.act === 'back') { D[k] = (D[k] || '').slice(0, -1); sfx('back'); } else if (key.act === 'clear') { D[k] = ''; sfx('back'); } else signType(w, key.ch);
    return;
  }
  if (!hit(SIGNBOX)) closeSign(w);
}
const signDoneBtn = () => ({ x: SIGNBOX.x + 40, y: SIGNBOX.y + SIGNBOX.h - 62, w: 250, h: 46, label: 'LISTO', size: 24, style: 'green' });
function drawSignEditor(c, w) {
  const B = SIGNBOX, D = DECO.sign, t = w.t;
  c.fillStyle = 'rgba(12,11,15,.8)'; c.fillRect(-EX, -EY, CW, CH);
  drawPanel(c, B.x, B.y, B.w, B.h, 'TU LETRERO');
  // vista previa: de noche, para que se vea cómo brilla
  c.save(); rr(c, B.x + 24, B.y + 28, 322, 364, 14); c.clip();
  const g = c.createLinearGradient(0, B.y + 28, 0, B.y + 392); g.addColorStop(0, '#121116'); g.addColorStop(1, '#16311f'); c.fillStyle = g; c.fillRect(B.x + 24, B.y + 28, 322, 364);
  const ST = SIGN_STYLES[D.st] || SIGN_STYLES[0], px = B.x + 185, py = B.y + 340;
  c.save(); c.globalCompositeOperation = 'lighter';
  for (const [hx, hy, hr] of [[0, -178, 90], [0, -100, 110]]) { const rg = c.createRadialGradient(px + hx, py + hy, 4, px + hx, py + hy, hr); rg.addColorStop(0, `rgba(${ST.halo},.5)`); rg.addColorStop(1, `rgba(${ST.halo},0)`); c.fillStyle = rg; c.beginPath(); c.arc(px + hx, py + hy, hr, 0, 6.3); c.fill(); }
  c.restore();
  drawCartelAt(c, px, py, t, 1);
  c.restore(); rr(c, B.x + 24, B.y + 28, 322, 364, 14); c.lineWidth = 3; c.strokeStyle = P.gold; c.stroke();
  txt(c, 'Así se ve de noche', B.x + 185, B.y + 50, { font: `600 14px ${FONT_UI}`, align: 'center', color: 'rgba(255,248,234,.7)', ls: 1 });
  // campos de texto
  ['Nombre de tu negocio', 'Segunda línea'].forEach((lab, i) => {
    const q = signField(i), on = (w.signField || 0) === i, k = i ? 't2' : 't1';
    txt(c, lab, q.x, q.y - 4, { font: `700 13px ${FONT_UI}`, color: P.muted, ls: 1 });
    rr(c, q.x, q.y, q.w, q.h, 9); c.fillStyle = '#16151b'; c.fill(); c.lineWidth = on ? 3.5 : 1.8; c.strokeStyle = on ? P.gold : P.violet; c.stroke();
    const val = (D[k] || '').toUpperCase(), caret = on && Math.floor(t * 2) % 2 === 0 ? '▍' : '';
    txt(c, val + caret, q.x + 12, q.y + 28, { font: `400 22px ${FONT_DISPLAY}`, color: P.cream });
    txt(c, `${val.length}/${SIGN_MAX[i]}`, q.x + q.w - 10, q.y + 26, { font: `700 13px ${FONT_UI}`, align: 'right', color: val.length >= SIGN_MAX[i] ? '#ff8fa0' : P.muted });
    if (UI.hit(q)) UI.cursor = true;
  });
  txt(c, 'Colores', B.x + 372, B.y + 164, { font: `700 13px ${FONT_UI}`, color: P.muted, ls: 1 });
  SIGN_STYLES.forEach((S2, i) => {
    const q = signStyleBtn(i), on = D.st === i; if (UI.hit(q)) UI.cursor = true;
    rr(c, q.x, q.y, q.w, q.h, 8); c.fillStyle = S2.board; c.fill(); c.lineWidth = on ? 3.5 : 1.8; c.strokeStyle = on ? P.gold : S2.frame; c.stroke();
    S2.letters.slice(0, 4).forEach((col, k, arr) => { c.fillStyle = col; c.beginPath(); c.arc(q.x + q.w / 2 + (k - (arr.length - 1) / 2) * 11, q.y + q.h / 2, 4.2, 0, 6.3); c.fill(); });
  });
  drawButton(c, Object.assign({}, signLightBtn, { label: D.li ? 'LUCES: SÍ' : 'LUCES: NO', style: D.li ? 'gold' : 'dark' }));
  txt(c, 'Las lucecitas parpadean y de noche el cartel brilla', B.x + 536, B.y + 233, { font: `600 12.5px ${FONT_UI}`, color: P.muted });
  signKeys().forEach(k => {
    const hov = UI.hit(k); if (hov) UI.cursor = true;
    rr(c, k.x, k.y, k.w, k.h, 6); c.fillStyle = k.act ? '#4a2c80' : hov ? '#4a2c80' : '#27252f'; c.fill(); c.lineWidth = 1.5; c.strokeStyle = hov ? P.gold : 'rgba(255,255,255,.28)'; c.stroke();
    txt(c, k.label || k.ch, k.x + k.w / 2, k.y + 22, { font: `700 ${k.label && k.label.length > 1 ? 13 : 18}px ${FONT_UI}`, align: 'center', color: P.cream });
  });
  drawButton(c, signDoneBtn());
  txt(c, 'También puedes escribir con el teclado · Tab cambia de línea', B.x + B.w / 2, B.y + B.h - 8, { font: `600 12px ${FONT_UI}`, align: 'center', color: P.muted });
}
/* =========================================================
   MÁQUINA DE GARRA (nivel 13, $3,000): al tocarla se juega una escena animada como la del video de referencia
   (la cabina se acerca, la garra se desliza, baja, agarra un peluche luchador y lo lleva a la salida).
   Cuesta jugar; los premios son al azar y el costo sube un poco con el nivel (así el premio en monedas rinde ≈ 80 % de lo que pagas, más gemas, energía o fama).
   ========================================================= */
const CLAW_MAX = 5;                                                  // jugadas por día
/* Tres precios: más caro = más premios buenos (el dinero que devuelve rinde ≈ 74 % / 80 % / 86 % de lo que pagas, siempre menos de lo que pones;
   lo demás son gemas, energía, fama, y ropa y máscaras que solo se ganan aquí). SUPER se abre en el nivel 18 y ULTRA en el 25. */
const CLAW_BASE = w => Math.round((120 + 6 * w.level) / 5) * 5;
const CLAW_TIERS = [
  { k: 'n', name: 'NORMAL', m: 1,   level: 1,  style: 'green',  w: { miss: 22, osito: 27, rana: 14, energia: 9, gema: 8,  fama: 6,  mega: 5, ropa: 6,  mask: 3 } },
  { k: 's', name: 'SUPER',  m: 2.5, level: 18, style: 'violet', w: { miss: 10, osito: 20, rana: 16, energia: 9, gema: 13, fama: 10, mega: 7, ropa: 9,  mask: 6 } },
  { k: 'u', name: 'ULTRA',  m: 6,   level: 25, style: 'gold',   w: { miss: 3,  osito: 12, rana: 18, energia: 8, gema: 18, fama: 14, mega: 9, ropa: 11, mask: 7 } }
];
const clawCost = (w, tier = 0) => Math.round(CLAW_BASE(w) * CLAW_TIERS[tier].m / 5) * 5;
const CLAW_PRIZES = [
  { id: 'miss',    plush: 'bear',      fail: true,        name: '¡Se resbaló!',           note: 'La garra soltó el peluche. Te llevas XP de consuelo' },
  { id: 'osito',   plush: 'bear',      money: [120, 170], name: 'Peluche de osito',       note: 'Se lo vendes a un coleccionista' },
  { id: 'rana',    plush: 'frog',      money: [200, 280], name: 'Rana luchadora',         note: 'Un cliente te la compra encantado' },
  { id: 'energia', plush: 'blob',      stamina: true,     name: 'Bebida energética',      note: 'El Novato recupera toda su energía' },
  { id: 'gema',    plush: 'gemblob',   gems: [1, 2],      name: 'Peluche con gema',       note: 'Traía una gema escondida en la panza' },
  { id: 'fama',    plush: 'luchador',  rep: .34,          name: 'Peluche del Campeón',    note: 'Tu fama sube: +⅓ de máscara' },
  { id: 'mega',    plush: 'luchadorOro', money: [600, 900], gems: [1, 1], name: '¡PREMIO MAYOR!', note: 'El peluche dorado vale oro (y una gema)' },
  { id: 'ropa',    plush: 'luchador',  look: 'clothes',    name: '¡ROPA DE CAMPEÓN!',      note: 'Una prenda que no se vende en ningún lado' },
  { id: 'mask',    plush: 'luchadorOro', look: 'mask',     name: '¡MÁSCARA EXCLUSIVA!',    note: 'Solo la ganas en la garra' }
];
const CLAW_LOOKS = { clothes: [['hoodie', '#ff5fd2'], ['hoodie', '#7cf0a8'], ['hoodie', '#c9a227'], ['shoes', 'neon'], ['shoes', 'oro']], mask: [['mask', 'carnaval'], ['mask', 'jade'], ['mask', 'tigre']] };
function pickClawPrize(tier = 0) {
  const W = CLAW_TIERS[tier].w; let r = Math.random() * CLAW_PRIZES.reduce((s, p) => s + (W[p.id] || 0), 0);
  for (const p of CLAW_PRIZES) { if ((r -= (W[p.id] || 0)) < 0) return p; }
  return CLAW_PRIZES[1];
}
const clawLeft = w => CLAW_MAX - (w.clawDay === w.day ? w.clawN : 0);
function openClaw(w) { w.modal = 'claw'; w.panel = false; w.claw = { phase: 'menu', t: 0 }; sfx('click'); }
function clawPlay(w, tier = null) {
  tier = clamp(tier == null ? (w.clawTier | 0) : tier | 0, 0, CLAW_TIERS.length - 1);
  const T = CLAW_TIERS[tier], cost = clawCost(w, tier);
  if (w.level < T.level) { sfx('nope'); toast(w, `${T.name} se abre en el nivel ${T.level}`); return; }
  if (clawLeft(w) <= 0) { sfx('nope'); toast(w, 'La máquina ya no tiene más jugadas por hoy'); return; }
  if (w.money < cost) { sfx('nope'); w.moneyFlash = .8; toast(w, `Faltan ${pesos(cost - w.money)}`); return; }
  w.money -= cost; w.dayCost += cost; if (w.clawDay !== w.day) { w.clawDay = w.day; w.clawN = 0; } w.clawN++; w.clawTier = tier;
  const prize = pickClawPrize(tier), m = cost / 150;
  w.claw = { phase: 'play', t: 0, prize, cost, tier, mult: m, tx: rand(430, 600), snd: {}, got: null, seed: Math.floor(Math.random() * 999) };
  sfx('arcadeCoin'); Game.save();
}
function clawApply(w) {                                              // se entrega el premio cuando termina la animación (o si la saltas)
  const C = w.claw, p = C.prize, n = w.novato; if (C.got) return;
  const got = { lines: [] };
  if (p.fail) { const xp = Math.max(12, Math.min(150, Math.round(C.cost / 10))); addXp(w, xp); got.lines.push('+' + xp + ' XP'); }
  if (p.money) { const v = Math.round(rand(p.money[0], p.money[1]) * C.mult / 5) * 5; w.money += v; got.lines.push('+' + pesos(v)); got.money = v; }
  if (p.gems) { const g = Math.round(rand(p.gems[0], p.gems[1])); w.gems += g; w.gemsSeen = true; got.lines.push(`+${g} ${g === 1 ? 'gema' : 'gemas'}`); }
  if (p.stamina) { n.stamina = maxStamina(w); n.furia = false; n.overwork = 0; n.zeroWarned = false; got.lines.push('Energía al 100 %'); }
  if (p.rep) { addRep(w, p.rep); got.lines.push('+⅓ de máscara'); }
  if (p.look) {                                                      // ropa o máscara exclusiva para el luchador (si ya las tienes todas, te dan dinero)
    const pool = CLAW_LOOKS[p.look].filter(([cat, k]) => !w.char.own[cat + ':' + k]);
    if (pool.length) { const [cat, k] = pick(pool); w.char.own[cat + ':' + k] = true; const o = LOOK_OPTS[cat].find(q => String(q.k) === String(k)); got.lines.push('¡' + o.name + '!'); got.lines.push('Pruébala en LUCHADOR (tienda)'); got.look = true; }
    else { const v = Math.round(C.cost * 1.3 / 5) * 5; w.money += v; got.lines.push('Ya tenías todo: +' + pesos(v)); got.money = v; }
  }
  C.got = got; C.phase = 'result'; C.rt = 0; sfx(p.fail ? 'clawFail' : 'clawWin'); Game.save();
}
const CLAW_END = 8.4;
function updateClaw(w, dt) {
  const C = w.claw; if (!C) return;
  C.t += dt; if (C.rt != null) C.rt += dt;
  if (C.phase !== 'play') return;
  const T = C.t, once = (k, at, snd) => { if (T >= at && !C.snd[k]) { C.snd[k] = 1; sfx(snd); } };
  once('mv', 1.4, 'clawMove'); once('dn', 2.8, 'clawDown'); once('gr', 4.15, 'clawGrab'); once('up', 4.7, 'clawUp'); once('mv2', 6.0, 'clawMove'); once('dp', 7.3, 'clawDrop');
  if (T >= CLAW_END) clawApply(w);
}
function clawPointer(w, x, y) {
  const C = w.claw, hit = b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
  if (C.phase === 'menu') {
    for (let i = 0; i < CLAW_TIERS.length; i++) if (hit(clawTierBtn(i))) { clawPlay(w, i); return; }
    if (hit(clawBtn('close')) || !hit(CLAWBOX)) { w.modal = null; sfx('back'); }
  } else if (C.phase === 'play') { if (C.t > .6) { C.t = CLAW_END; clawApply(w); } }                      // tocar salta la animación
  else if (C.phase === 'result') {
    if (hit(clawBtn('again')) && clawLeft(w) > 0) { clawPlay(w, C.tier); return; }
    if (hit(clawBtn('done')) || hit(clawBtn('again'))) { w.modal = null; sfx('back'); }
  }
}
const CLAWBOX = { x: 250, y: 100, w: 460, h: 400 };
const clawTierBtn = i => ({ x: CLAWBOX.x + 17 + i * 146, y: CLAWBOX.y + 272, w: 134, h: 64, size: 22 });
function clawBtn(k) {
  if (k === 'close') return { x: CLAWBOX.x + CLAWBOX.w / 2 - 70, y: CLAWBOX.y + CLAWBOX.h - 52, w: 140, h: 38, size: 18, style: 'dark', label: 'SALIR' };
  if (k === 'again') return { x: 300, y: 508, w: 200, h: 54, size: 22, style: 'green', label: 'OTRA VEZ' };
  return { x: 520, y: 508, w: 160, h: 54, size: 22, style: 'gold', label: 'LISTO' };
}

/* ---------- peluches ---------- */
const PLUSH_COLS = [['#c98b4e', '#e8c08a'], ['#ff7ab8', '#ffc4de'], ['#b57cff', '#dcc4ff'], ['#5fd0ff', '#bfeaff'], ['#ffc83d', '#fff0b0'], ['#7bd957', '#d6f5b0']];
function drawPlush(c, kind, x, y, s = 1, tilt = 0, pal = 0) {                       // (x, y) = centro de la cabeza
  c.save(); c.translate(x, y); c.rotate(tilt); c.scale(s, s); c.lineJoin = 'round'; c.lineCap = 'round'; c.lineWidth = 2; c.strokeStyle = P.ink;
  const [a, b] = PLUSH_COLS[pal % PLUSH_COLS.length], eyes = (dx, dy) => { c.fillStyle = P.ink; c.beginPath(); c.arc(-dx, dy, 1.9, 0, 6.3); c.arc(dx, dy, 1.9, 0, 6.3); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(-dx - .6, dy - .7, .7, 0, 6.3); c.arc(dx - .6, dy - .7, .7, 0, 6.3); c.fill(); };
  if (kind === 'bear') {
    c.fillStyle = a; c.beginPath(); c.ellipse(0, 20, 17, 15, 0, 0, 6.3); c.fill(); c.stroke();
    for (const sx of [-1, 1]) { c.fillStyle = a; c.beginPath(); c.arc(sx * 12, -11, 6.5, 0, 6.3); c.fill(); c.stroke(); c.fillStyle = b; c.beginPath(); c.arc(sx * 12, -11, 3.2, 0, 6.3); c.fill(); }
    c.fillStyle = a; c.beginPath(); c.arc(0, 0, 15, 0, 6.3); c.fill(); c.stroke();
    c.fillStyle = b; c.beginPath(); c.ellipse(0, 5, 7.5, 5.5, 0, 0, 6.3); c.fill(); c.stroke(); eyes(5.5, -3);
    c.fillStyle = P.ink; c.beginPath(); c.ellipse(0, 2.6, 2.6, 1.8, 0, 0, 6.3); c.fill();
  } else if (kind === 'frog') {
    c.fillStyle = '#4fbf3f'; c.beginPath(); c.ellipse(0, 19, 17, 14, 0, 0, 6.3); c.fill(); c.stroke();
    c.beginPath(); c.ellipse(0, 3, 18, 14, 0, 0, 6.3); c.fill(); c.stroke();
    for (const sx of [-1, 1]) { c.fillStyle = '#4fbf3f'; c.beginPath(); c.arc(sx * 10, -10, 7, 0, 6.3); c.fill(); c.stroke(); c.fillStyle = '#fff'; c.beginPath(); c.arc(sx * 10, -10, 4.6, 0, 6.3); c.fill(); c.fillStyle = P.ink; c.beginPath(); c.arc(sx * 10 + 1, -9.5, 2.2, 0, 6.3); c.fill(); }
    c.strokeStyle = P.ink; c.lineWidth = 1.8; c.beginPath(); c.arc(0, 4, 8.5, .15, Math.PI - .15); c.stroke();
    c.fillStyle = '#ff7a8a'; c.beginPath(); c.arc(-11, 6, 2.6, 0, 6.3); c.arc(11, 6, 2.6, 0, 6.3); c.fill();
    c.fillStyle = '#e0364a'; c.strokeStyle = P.ink; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-9, -3); c.lineTo(9, -3); c.lineTo(8, -1); c.lineTo(-8, -1); c.closePath(); c.fill();     // antifaz
  } else if (kind === 'blob' || kind === 'gemblob') {
    c.fillStyle = kind === 'gemblob' ? '#35c9f0' : a; c.beginPath(); c.ellipse(0, 9, 18, 19, 0, 0, 6.3); c.fill(); c.stroke();
    c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(-7, -1, 4.5, 7, .4, 0, 6.3); c.fill(); eyes(6, 3);
    c.strokeStyle = P.ink; c.lineWidth = 1.8; c.beginPath(); c.arc(0, 8, 4.5, .2, Math.PI - .2); c.stroke();
    if (kind === 'gemblob') drawGem(c, 0, 20, 6);
    else { c.fillStyle = '#ffd23a'; c.strokeStyle = P.ink; c.lineWidth = 1.2; c.beginPath(); c.moveTo(3, 13); c.lineTo(-3, 20); c.lineTo(0, 20); c.lineTo(-2, 27); c.lineTo(5, 18); c.lineTo(1, 18); c.closePath(); c.fill(); c.stroke(); }
  } else {                                                                            // luchador (o dorado)
    const gold = kind === 'luchadorOro';
    c.fillStyle = gold ? '#e3b53a' : '#3b5bdb'; c.beginPath(); c.moveTo(-13, 10); c.lineTo(13, 10); c.lineTo(16, 34); c.lineTo(-16, 34); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = gold ? '#fff0b0' : '#ffd23a'; c.fillRect(-4, 16, 8, 3);
    c.beginPath(); c.arc(0, 0, 16, 0, 6.3); c.fillStyle = gold ? '#ffe27a' : '#f1c27d'; c.fill(); c.stroke();
    drawMask(c, 0, .5, 12.5, gold ? MASKS.ring : MASKS.novato);
    if (gold) { c.fillStyle = '#fff'; star(c, 14, -14, 4, 1.6, 4); c.fill(); }
  }
  c.restore();
}

/* ---------- la cabina (se usa en la escena y, más chica, como mueble del local) ---------- */
function drawClawCabinet(c, t, zoom) {
  const X = 250, Y = 24, Wd = 460, Hh = 556;
  // cuerpo azul
  let g = c.createLinearGradient(X, 0, X + Wd, 0); g.addColorStop(0, '#16409a'); g.addColorStop(.5, '#2d6fe0'); g.addColorStop(1, '#16409a');
  c.lineJoin = 'round'; c.lineWidth = 5; c.strokeStyle = P.ink; rr(c, X, Y + 70, Wd, Hh - 70, 14); c.fillStyle = g; c.fill(); c.stroke();
  // marquesina
  const mg = c.createLinearGradient(0, Y, 0, Y + 100); mg.addColorStop(0, '#1b3f9c'); mg.addColorStop(1, '#0d2260');
  c.lineWidth = 5; rr(c, X - 12, Y + 4, Wd + 24, 98, 14); c.fillStyle = mg; c.fill(); c.stroke(); c.lineWidth = 4; c.strokeStyle = '#e0364a'; rr(c, X - 4, Y + 12, Wd + 8, 82, 10); c.stroke();
  const titleG = c.createLinearGradient(0, Y + 24, 0, Y + 86); titleG.addColorStop(0, '#fff6b8'); titleG.addColorStop(.5, '#ffc83d'); titleG.addColorStop(1, '#ff8a3d');
  c.save(); c.font = `400 56px ${FONT_DISPLAY}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 9; c.strokeStyle = P.ink; c.strokeText('¡LA GARRA!', X + Wd / 2, Y + 58); c.fillStyle = titleG; c.fillText('¡LA GARRA!', X + Wd / 2, Y + 58); c.restore();
  drawMask(c, X + Wd / 2, Y - 4, 17, MASKS.ring);                                                  // máscara de luchador sobre la marquesina
  for (let i = 0; i < 18; i++) { const bx = X + 8 + i * (Wd - 16) / 17, on = Math.sin(t * 6 + i * .9) > 0; c.fillStyle = on ? '#fff3b0' : '#c9a23a'; c.beginPath(); c.arc(bx, Y + 14, 3.4, 0, 6.3); c.fill(); c.beginPath(); c.arc(bx, Y + 92, 3.4, 0, 6.3); c.fillStyle = on ? '#c9a23a' : '#fff3b0'; c.fill(); }
  for (const sx of [X + 28, X + Wd - 28]) { c.fillStyle = '#ffd23a'; c.strokeStyle = P.ink; c.lineWidth = 2; star(c, sx, Y + 58, 13, 5.5); c.fill(); c.stroke(); }
  // vitrina: marco claro
  c.lineWidth = 5; c.strokeStyle = P.ink; rr(c, X + 18, Y + 108, Wd - 36, 312, 8); c.fillStyle = '#0a1a40'; c.fill(); c.stroke();
  c.lineWidth = 3; c.strokeStyle = '#7cc4ff'; rr(c, X + 22, Y + 112, Wd - 44, 304, 6); c.stroke();
  // base roja con tablero de control
  g = c.createLinearGradient(0, Y + 430, 0, Y + Hh); g.addColorStop(0, '#e0364a'); g.addColorStop(1, '#a01c30');
  c.lineWidth = 5; c.strokeStyle = P.ink; rr(c, X, Y + 426, Wd, Hh - 426, 10); c.fillStyle = g; c.fill(); c.stroke();
  c.fillStyle = '#ffd23a'; c.fillRect(X + 6, Y + 480, Wd - 12, 7);
  c.fillStyle = '#2a2d3a'; c.beginPath(); c.moveTo(X + 120, Y + 440); c.lineTo(X + 340, Y + 440); c.lineTo(X + 362, Y + 482); c.lineTo(X + 98, Y + 482); c.closePath(); c.fill(); c.lineWidth = 3; c.stroke();     // tablero
  c.strokeStyle = '#8a8f9e'; c.lineWidth = 5; c.beginPath(); c.moveTo(X + 160, Y + 462); c.lineTo(X + 160, Y + 446); c.stroke(); c.fillStyle = '#e0364a'; c.beginPath(); c.arc(X + 160, Y + 442, 10, 0, 6.3); c.fill(); c.lineWidth = 2; c.strokeStyle = P.ink; c.stroke();   // palanca
  for (const [bx, col] of [[X + 230, '#7c3aed'], [X + 280, '#2fbf71']]) { c.fillStyle = col; c.beginPath(); c.ellipse(bx, Y + 462, 14, 9, 0, 0, 6.3); c.fill(); c.stroke(); c.fillStyle = 'rgba(255,255,255,.4)'; c.beginPath(); c.ellipse(bx - 3, Y + 459, 6, 3, 0, 0, 6.3); c.fill(); }
  c.fillStyle = '#c9ccd6'; rr(c, X + Wd - 62, Y + 500, 28, 40, 4); c.fill(); c.stroke(); c.fillStyle = P.ink; c.fillRect(X + Wd - 52, Y + 508, 8, 20); txt(c, '$', X + Wd - 48, Y + 538, { font: `700 12px ${FONT_UI}`, align: 'center', color: P.ink });         // ranura
  c.fillStyle = '#16141b'; rr(c, X + 34, Y + 494, 118, 56, 8); c.fill(); c.lineWidth = 3; c.strokeStyle = P.ink; c.stroke(); txt(c, 'PREMIO', X + 93, Y + 546, { font: `700 11px ${FONT_UI}`, align: 'center', color: '#9aa0b8', ls: 1.5 });  // bandeja de premios
  for (const [sx, sy, col] of [[X + 192, Y + 512, '#7bd957'], [X + 240, Y + 530, '#ffd23a']]) { c.fillStyle = col; c.beginPath(); c.arc(sx, sy, 9, 0, 6.3); c.fill(); c.strokeStyle = P.ink; c.lineWidth = 2; c.stroke(); drawMask(c, sx, sy, 5.5, MASKS.novato); }              // calcomanías
}
function plushPile(seed) {                                           // el montón de peluches (un cerrito): posiciones fijas para que no brinquen
  const out = [], kinds = ['bear', 'frog', 'blob', 'luchador', 'bear', 'blob', 'frog'];
  [[372, 7], [396, 6], [420, 5], [444, 4]].forEach(([x0, n], r) => {
    for (let i = 0; i < n; i++) {
      const h = Math.abs(Math.sin((i * 7 + r * 13 + seed) * .73)), x = x0 + i * 46 + (h - .5) * 9;
      out.push({ x, y: 408 - r * 27 + (h - .5) * 6, k: kinds[Math.floor(h * 97 + i + r) % kinds.length], pal: Math.floor(h * 53 + i) % PLUSH_COLS.length, tilt: (h - .5) * .6, r, s: 1.15 + h * .25 });
    }
  });
  return out;
}
function drawClawArm(c, x, y, open) {                                // garra: cabezal y tres dedos (se ven dos); open 0..1
  const a = lerp(.2, 1.0, open);
  c.lineJoin = 'round'; c.lineCap = 'round';
  for (const sg of [-1, 1]) {
    c.save(); c.translate(x + sg * 9, y + 10); c.rotate(sg * a);
    for (const [w1, col] of [[9, P.ink], [5.4, '#aab0bf']]) { c.strokeStyle = col; c.lineWidth = w1; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 22); c.stroke(); c.save(); c.translate(0, 22); c.rotate(-sg * (a * 1.25 + .15)); c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 24); c.stroke(); c.restore(); }
    c.restore();
  }
  c.fillStyle = '#bfc4d2'; c.strokeStyle = P.ink; c.lineWidth = 2.6; rr(c, x - 17, y - 8, 34, 24, 7); c.fill(); c.stroke();
  c.fillStyle = '#e0364a'; c.beginPath(); c.arc(x, y + 3, 3.2, 0, 6.3); c.fill(); c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(x - 13, y - 5, 5, 12);
}
function drawClawScene(c, w) {
  const C = w.claw, T = C.t, P_ = C.prize, ph = (a, b) => smooth(clamp((T - a) / (b - a), 0, 1));
  const zoom = ph(0, 1.3), sc = lerp(.6, 1, zoom), ox = 480, oy = lerp(250, 300, zoom);
  // fondo: salón de videojuegos, oscuro y con neón
  const bg = c.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#121015'); bg.addColorStop(.7, '#22202a'); bg.addColorStop(1, '#2a2733'); c.fillStyle = bg; c.fillRect(-EX, -EY, CW, CH);
  c.save(); c.translate(480, 300); c.scale(lerp(1, 1.5, zoom), lerp(1, 1.5, zoom)); c.translate(-480, -300);
  for (const [bx, col] of [[-110, '#ff3d8b'], [90, '#5fe8ff'], [820, '#ffc83d'], [1020, '#b57cff']]) {
    const r = 130 + 20 * Math.sin(w.t + bx); const rg = c.createRadialGradient(bx, 260, 4, bx, 260, r); rg.addColorStop(0, col + '88'); rg.addColorStop(1, col + '00'); c.fillStyle = rg; c.beginPath(); c.arc(bx, 260, r, 0, 6.3); c.fill();
    c.fillStyle = '#18161d'; c.fillRect(bx - 56, 150, 112, 450); c.fillStyle = col; c.globalAlpha = .55 + .25 * Math.sin(w.t * 3 + bx); c.fillRect(bx - 44, 180, 88, 70); c.globalAlpha = 1;
  }
  c.restore();
  c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(480, 590, 300 * sc, 22 * sc, 0, 0, 6.3); c.fill();
  c.save(); c.translate(ox, oy); c.scale(sc, sc); c.translate(-480, -300);
  drawClawCabinet(c, w.t, zoom);
  // interior
  const GL = { x: 276, y: 136, w: 408, h: 288 };
  c.save(); rr(c, GL.x, GL.y, GL.w, GL.h, 5); c.clip();
  const ig = c.createLinearGradient(0, GL.y, 0, GL.y + GL.h); ig.addColorStop(0, '#1d4fa8'); ig.addColorStop(1, '#0f2a66'); c.fillStyle = ig; c.fillRect(GL.x, GL.y, GL.w, GL.h);
  c.save(); c.translate(GL.x + GL.w / 2, GL.y + 140); c.fillStyle = 'rgba(255,214,90,.18)';                       // rayos de fondo
  for (let i = 0; i < 12; i++) { c.rotate(Math.PI / 6); c.beginPath(); c.moveTo(0, 0); c.lineTo(300, -26); c.lineTo(300, 26); c.closePath(); c.fill(); } c.restore();
  const pile = plushPile(C.seed); let tIdx = 0, bd = 1e9; pile.forEach((p, i) => { if (p.r >= 2) { const d = Math.abs(p.x - C.tx); if (d < bd) { bd = d; tIdx = i; } } }); const tgt = pile[tIdx];
  // camino de la garra
  const railY = GL.y + 22, startX = 620, chuteX = 322, topY = railY + 30, hitY = tgt.y - 26;
  let cx = startX, cy = topY, open = .75, carry = false, drop = null;
  if (T >= 1.3) cx = lerp(startX, tgt.x, ph(1.3, 2.7));
  if (T >= 2.8) cy = lerp(topY, hitY, ph(2.8, 4.1));
  if (T >= 4.1) open = lerp(.75, .12, ph(4.1, 4.6));
  const ok = !P_.fail;
  if (T >= 4.7) cy = lerp(hitY, topY, ph(4.7, 5.9));
  if (ok) carry = T >= 4.5 && T < 7.4;
  else { carry = T >= 4.5 && T < 5.35; if (T >= 5.35 && T < 5.8) drop = { x: tgt.x, y: lerp(hitY + 14, tgt.y, ((T - 5.35) / .45) ** 2) }; open = T >= 5.35 && T < 5.9 ? .6 : open; }
  if (T >= 6.0) cx = lerp(tgt.x, chuteX, ph(6.0, 7.2));
  if (ok && T >= 7.3) { open = lerp(.12, .8, ph(7.3, 7.5)); }
  if (!ok && T >= 7.3) open = lerp(.12, .8, ph(7.3, 7.5));
  const fall = ok && T >= 7.3 ? { x: chuteX, y: lerp(cy + 40, GL.y + GL.h - 18, ph(7.3, 7.9) ** 1.6) } : null;
  // peluches (el premio se saca del montón mientras la garra lo carga)
  pile.forEach((p, i) => { if (i === tIdx && (carry || fall || (ok && T >= 4.5))) return; if (i === tIdx && drop) return; const jig = i === tIdx && T > 4.1 && T < 4.7 ? Math.sin(T * 40) * 1.2 : 0; drawPlush(c, p.k, p.x + jig, p.y, p.s, p.tilt, p.pal); });
  if (drop) drawPlush(c, P_.plush, drop.x, drop.y, tgt.s, .4, 1);
  else if (!carry && !fall && !ok && T >= 5.8) drawPlush(c, P_.plush, tgt.x, tgt.y, tgt.s, .1, 1);
  // foco sobre el premio
  if (T < 4.3) { const a = .3 + .12 * Math.sin(w.t * 6); c.fillStyle = `rgba(255,240,150,${a})`; c.beginPath(); c.ellipse(tgt.x, tgt.y + 14, 34, 11, 0, 0, 6.3); c.fill(); }
  // el hueco de salida (izquierda, al fondo)
  c.fillStyle = '#05030f'; c.beginPath(); c.ellipse(chuteX, GL.y + GL.h - 8, 44, 12, 0, 0, 6.3); c.fill(); c.lineWidth = 3; c.strokeStyle = '#ffd23a'; c.stroke();
  if (carry && ok) drawPlush(c, P_.plush, cx, cy + 62, 1.2, Math.sin(T * 5) * .08, 1);
  else if (carry && !ok) drawPlush(c, P_.plush, cx, cy + 62, 1.2, Math.sin(T * 9) * .12, 1);
  if (fall) drawPlush(c, P_.plush, fall.x, fall.y, 1.2, T * 4, 1);
  // riel, carro, cable y garra
  const rg2 = c.createLinearGradient(0, railY - 7, 0, railY + 7); rg2.addColorStop(0, '#dfe3ee'); rg2.addColorStop(1, '#7c8396'); c.fillStyle = rg2; c.fillRect(GL.x, railY - 7, GL.w, 14); c.strokeStyle = P.ink; c.lineWidth = 2; c.strokeRect(GL.x, railY - 7, GL.w, 14);
  c.fillStyle = '#4a4f60'; rr(c, cx - 22, railY - 11, 44, 22, 5); c.fill(); c.stroke();
  c.strokeStyle = '#1b1b24'; c.lineWidth = 4; c.beginPath(); const coil = 7; for (let y = railY + 10; y < cy - 8; y += coil) { c.moveTo(cx - 5, y); c.lineTo(cx + 5, y + coil / 2); } c.stroke();
  c.strokeStyle = '#6b7080'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(cx, railY + 10); c.lineTo(cx, cy - 8); c.stroke();
  drawClawArm(c, cx, cy, open);
  c.restore();                                                                                            // fin del recorte de la vitrina
  // reflejos del cristal
  c.fillStyle = 'rgba(255,255,255,.07)'; c.beginPath(); c.moveTo(GL.x + 40, GL.y); c.lineTo(GL.x + 130, GL.y); c.lineTo(GL.x + 40, GL.y + GL.h); c.lineTo(GL.x - 10, GL.y + GL.h); c.closePath(); c.fill();
  c.fillStyle = 'rgba(255,255,255,.05)'; c.beginPath(); c.moveTo(GL.x + 180, GL.y); c.lineTo(GL.x + 215, GL.y); c.lineTo(GL.x + 120, GL.y + GL.h); c.lineTo(GL.x + 85, GL.y + GL.h); c.closePath(); c.fill();
  // el premio cae a la bandeja
  if (ok && T >= 7.9) { const k = clamp((T - 7.9) / .5, 0, 1), bounce = Math.abs(Math.sin(k * Math.PI * 1.5)) * 18 * (1 - k); drawPlush(c, P_.plush, 343, 538 - bounce - 14, .7, 0, 1); }
  c.restore();
  // textos de la escena
  const msg = T < 1.4 ? '¡Una moneda y a jugar!' : T < 2.8 ? 'La garra va por un peluche…' : T < 4.2 ? 'Bajando…' : T < 4.7 ? '¡Agarró!' : T < 7.2 ? (ok ? 'Se lo lleva a la salida…' : '¡Se le está resbalando!') : (ok ? '¡Cayó el premio!' : '¡Casi!');
  txt(c, msg, 480, 576, { font: `700 22px ${FONT_UI}`, align: 'center', color: P.cream, stroke: P.ink, sw: 5, ls: 1 });
  if (T > .6) txt(c, 'Toca para saltar', W - 16, 24, { font: `600 13px ${FONT_UI}`, align: 'right', color: 'rgba(255,248,234,.55)', ls: 1 });
}
function drawClaw(c, w) {
  const C = w.claw; if (!C) return;
  if (C.phase === 'menu') {
    c.fillStyle = 'rgba(12,11,15,.78)'; c.fillRect(-EX, -EY, CW, CH);
    const B = CLAWBOX; drawPanel(c, B.x, B.y, B.w, B.h, '¡LA GARRA!');
    c.save(); c.translate(B.x + 66, B.y + 24); c.scale(.25, .25); c.translate(-250, -24); drawClawCabinet(c, w.t, 1); c.restore();
    const left = clawLeft(w);
    txt(c, 'Prueba tu suerte', B.x + 262, B.y + 66, { font: `400 22px ${FONT_DISPLAY}`, align: 'center', color: P.gold, stroke: P.ink, sw: 4 });
    [['Peluches que se revenden por monedas', '#9af0b8'], ['Bebida energética, gemas y fama', '#9ff0ff'], ['Ropa y máscaras que solo se ganan aquí', '#ffb3e8'], ['¡Premio mayor: monedas y una gema!', '#ffb06a']].forEach((l, i) => txt(c, '• ' + l[0], B.x + 176, B.y + 112 + i * 24, { font: `600 15.5px ${FONT_UI}`, color: l[1] }));
    txt(c, 'Cuanto más pagas, más premios buenos salen', B.x + B.w / 2, B.y + 232, { font: `600 14px ${FONT_UI}`, align: 'center', color: P.muted });
    txt(c, `Jugadas que quedan hoy: ${left} de ${CLAW_MAX}`, B.x + 24, B.y + 258, { font: `700 16px ${FONT_UI}`, color: left ? P.cream : '#ff8fa0' });
    txt(c, 'Caja ' + pesos(w.shownMoney), B.x + B.w - 24, B.y + 258, { font: `700 16px ${FONT_UI}`, align: 'right', color: P.gold });
    CLAW_TIERS.forEach((T, i) => {
      const b = clawTierBtn(i), cost = clawCost(w, i), lock = w.level < T.level, ok = !lock && left > 0 && w.money >= cost;
      drawButton(c, Object.assign({}, b, { label: lock ? 'NIVEL ' + T.level : pesos(cost), sub: T.name, style: T.style, disabled: !ok }));
    });
    drawButton(c, clawBtn('close'));
    return;
  }
  c.fillStyle = '#05030f'; c.fillRect(-EX, -EY, CW, CH);
  drawClawScene(c, w);
  if (C.phase === 'result') {
    const k = easeOutBack(clamp(C.rt / .45, 0, 1)), p = C.prize, got = C.got;
    c.fillStyle = `rgba(12,11,15,${.55 * Math.min(1, C.rt * 3)})`; c.fillRect(-EX, -EY, CW, CH);
    c.save(); c.translate(480, 290); c.scale(k, k);
    drawPanel(c, -230, -170, 460, 330, p.fail ? '¡CASI!' : '¡GANASTE!');
    for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283 + C.rt, r = 150 + 18 * Math.sin(C.rt * 6 + i); c.fillStyle = ['#ffd23a', '#ff3d8b', '#5fe8ff', '#7bd957'][i % 4]; c.globalAlpha = p.fail ? 0 : .8; c.beginPath(); c.arc(Math.cos(a) * r * 1.4, Math.sin(a) * r * .55 - 30, 4, 0, 6.3); c.fill(); c.globalAlpha = 1; }
    drawPlush(c, p.plush, 0, -86, 1.7, Math.sin(C.rt * 4) * .08, 1);
    txt(c, p.name, 0, 18, { font: `400 26px ${FONT_DISPLAY}`, align: 'center', color: P.gold, stroke: P.ink, sw: 5 });
    txt(c, p.note, 0, 46, { font: `600 16px ${FONT_UI}`, align: 'center', color: P.cream });
    got.lines.forEach((l, i) => txt(c, l, 0, 84 + i * 28, { font: `700 24px ${FONT_UI}`, align: 'center', color: l.includes('gema') ? '#9ff0ff' : P.gold, stroke: P.ink, sw: 4 }));
    c.restore();
    const ab = clawBtn('again'); drawButton(c, Object.assign({ label: clawLeft(w) > 0 ? `OTRA VEZ · ${pesos(C.cost)}` : 'SIN MÁS JUGADAS', size: 18 }, ab, { disabled: clawLeft(w) <= 0 || w.money < C.cost })); drawButton(c, clawBtn('done'));
  }
}
// La máquina como mueble del local: cabina azul con vitrina, marquesina amarilla y base roja
function drawClawItem(c, w, it) {
  const x0 = it.c + .1, x1 = it.c + .9, y0 = it.r + .1, y1 = it.r + .9, Hh = FURN.garra.h, t = w.t;
  isoBox(c, x0, y0, x1, y1, 0, 46, { top: '#a01c30', left: '#e0364a', right: '#a01c30' }, 1.8);                 // base roja
  isoBox(c, x0, y0, x1, y1, 46, Hh - 18, { top: '#7cc4ff', left: 'rgba(120,190,255,.55)', right: 'rgba(60,120,220,.6)' }, 1.8);   // vitrina
  const fo = S(x0, y1, 50), fw = (x1 - x0) * U;                                                              // frente de la vitrina: peluches
  c.save(); c.translate(fo.x, fo.y); c.transform(1, .5, 0, 1, 0, 0);
  c.fillStyle = '#12357a'; c.fillRect(2, 0, fw - 4, Hh - 70);
  [['#ff7ab8', 8], ['#7bd957', 20], ['#c98b4e', 31], ['#5fd0ff', 14], ['#ffc83d', 26]].forEach(([col, px], i) => { c.fillStyle = col; c.strokeStyle = P.ink; c.lineWidth = 1.2; c.beginPath(); c.arc(px, Hh - 70 - 7 - (i % 2) * 8, 6.2, 0, 6.3); c.fill(); c.stroke(); });
  const gx = 18 + Math.sin(t * .9) * 8; c.strokeStyle = '#aab0bf'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(gx, 0); c.lineTo(gx, 20 + 8 * Math.sin(t * 1.3)); c.stroke(); c.fillStyle = '#bfc4d2'; c.fillRect(gx - 3, 20 + 8 * Math.sin(t * 1.3), 6, 5);
  c.restore();
  isoBox(c, x0 - .03, y0 - .03, x1 + .03, y1 + .03, Hh - 18, Hh, { top: '#ffd23a', left: '#1b3f9c', right: '#0d2260' }, 1.8);             // marquesina
  const ms = S(x0, y1 + .03, Hh - 9); c.save(); c.translate(ms.x, ms.y); c.transform(1, .5, 0, 1, 0, 0);
  txt(c, 'GARRA', fw / 2, 4, { font: `400 ${fitDisplay(c, 'GARRA', fw - 6, 10)}px ${FONT_DISPLAY}`, align: 'center', color: '#ffd23a' });
  c.restore();
  const busy = w.clawBusy > 0;
  for (let k = 0; k < 4; k++) { const p = S(x0 + (x1 - x0) * (k + .5) / 4, y1 + .03, Hh - 17), on = Math.sin(t * (busy ? 16 : 6) + k * 1.4) > 0; c.fillStyle = on ? '#fff3b0' : '#c9a23a'; c.beginPath(); c.arc(p.x, p.y, 1.6, 0, 6.3); c.fill(); }
  const mk = S((x0 + x1) / 2, (y0 + y1) / 2, Hh + 6); drawMask(c, mk.x, mk.y, 8, MASKS.ring);                                              // máscara arriba
  const cp = S(x0 + .12, y1, 30); c.fillStyle = '#e0364a'; c.beginPath(); c.arc(cp.x + 4, cp.y, 2.4, 0, 6.3); c.fill(); c.fillStyle = '#7c3aed'; c.beginPath(); c.arc(cp.x + 12, cp.y + 4, 2.4, 0, 6.3); c.fill();
}

/* ---------- Faroles y luces de la calle (v1.5) ----------
   De noche cada farol deja un círculo de luz de verdad sobre el piso (banqueta, calle y quien camine por ahí, incluidos los clientes y los coches del estacionamiento),
   con un cono de luz que baja desde el foco. Los tres de siempre vienen con la calle; los demás se compran en TIENDA › OBRAS y se plantan en la calle.
   El estacionamiento trae sus propios postes. */
const FAROL_MAX = 6, FAROL_R = 2.45;
const FAROL_TIERS = [{ level: 6, price: 300 }, { level: 6, price: 450 }, { level: 6, price: 650 }, { level: 16, price: 900 }, { level: 16, price: 1300 }, { level: 16, price: 1800 }];
function farolCan(w, c, r, self) {
  if (r < -6 || r > -5 || c < -6 || c > COLS + 9) return 'Los faroles van en la calle, junto a la banqueta';
  const p = S(c + .5, r + .5);
  if (p.x < -60 || p.x > W + 250 || p.y < HUD - 10) return 'Ahí queda demasiado lejos (se vería solo alejando la cámara)';
  const cx = c + .5, cy = r + .5;
  if (EXT_PROPS.some(q => Math.hypot(q.x - cx, q.y - cy) < (q.draw === drawLamp ? 1.9 : 1.05))) return 'Ahí ya hay un farol o un árbol';
  if ((w.outs || []).some(o => o !== self && o.type === 'farol' && Math.hypot(o.c - c, o.r - r) < 1.9)) return 'Muy cerca de otro farol: deja una loseta libre entre ellos';
  return null;
}
const outRange = type => type === 'farol' ? { r0: -7, r1: -4, c0: -6, c1: COLS + 9 } : { r0: -1, r1: ROWS + 4, c0: -3, c1: COLS + 5 };
const lotLamps = lot => [{ x: lot.c - .5, y: lot.r + LOT_H - .4 }, { x: lot.c + LOT_W + .5, y: lot.r + .5 }, { x: lot.c + LOT_W + .5, y: lot.r + LOT_H - .4 }];
function lampSpots(w) {                                              // dónde hay luz: los postes de la calle, los faroles comprados y los del estacionamiento
  const out = [];
  EXT_PROPS.forEach(p => {
    if (p.draw !== drawLamp) return;
    if (w.lot && p.x >= w.lot.c - .6 && p.x <= w.lot.c + LOT_W + .6 && p.y >= w.lot.r - .6 && p.y <= w.lot.r + LOT_H + .6) return;
    out.push({ x: p.x, y: p.y });
  });
  (w.outs || []).forEach(o => { if (o.type === 'farol') out.push({ x: o.c + .5, y: o.r + .5 }); });
  if (w.lot) lotLamps(w.lot).forEach(q => out.push(q));
  return out;
}
function drawLights(c, w) {                                          // se dibuja al final de todo, para que alumbre también a la gente y a los coches
  const nk = nightK(w); if (nk < .04) return;
  const spots = lampSpots(w); if (!spots.length) return;
  c.save();
  c.beginPath(); c.rect(-1500, -1000, 4000, 2800);                    // el interior del local y sus paredes ya tienen su propia luz
  polyPath(c, [S(0, 0, 0), S(COLS, 0, 0), S(COLS, ROWS, 0), S(0, ROWS, 0)]);
  polyPath(c, [S(0, 0, 0), S(COLS, 0, 0), S(COLS, 0, WALL_H), S(0, 0, WALL_H)]);
  polyPath(c, [S(0, 0, 0), S(0, ROWS, 0), S(0, ROWS, WALL_H), S(0, 0, WALL_H)]);
  polyPath(c, [S(COLS, 0, 0), S(COLS, ROWS, 0), S(COLS, ROWS, -16), S(COLS, 0, -16)]);
  polyPath(c, [S(0, ROWS, 0), S(COLS, ROWS, 0), S(COLS, ROWS, -16), S(0, ROWS, -16)]);
  c.clip('evenodd');
  c.globalCompositeOperation = 'lighter';
  const R = FAROL_R * TW * .7071;
  spots.forEach(sp => {
    const q = S(sp.x, sp.y), hx = q.x, hy = q.y - 84;
    const cg = c.createLinearGradient(hx, hy, hx, q.y);                 // cono de luz del foco al piso
    cg.addColorStop(0, `rgba(255,240,170,${.26 * nk})`); cg.addColorStop(1, `rgba(255,224,130,${.08 * nk})`);
    c.fillStyle = cg; c.beginPath(); c.moveTo(hx - 5, hy); c.lineTo(hx + 5, hy); c.lineTo(q.x + R * .6, q.y); c.ellipse(q.x, q.y, R * .6, R * .3, 0, 0, Math.PI, false); c.closePath(); c.fill();
    c.save(); c.translate(q.x, q.y); c.scale(1, .5);                     // círculo de luz sobre el piso (la elipse isométrica)
    const g = c.createRadialGradient(0, 0, 0, 0, 0, R);
    g.addColorStop(0, `rgba(255,228,150,${.5 * nk})`); g.addColorStop(.5, `rgba(255,216,124,${.36 * nk})`); g.addColorStop(.84, `rgba(255,202,104,${.17 * nk})`); g.addColorStop(1, 'rgba(255,200,100,0)');
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, R, 0, 6.3); c.fill();
    c.lineWidth = 3; c.strokeStyle = `rgba(255,232,170,${.13 * nk})`; c.beginPath(); c.arc(0, 0, R * .88, 0, 6.3); c.stroke();
    c.restore();
    const hg = c.createRadialGradient(hx, hy + 4, 1, hx, hy + 4, 30);   // el foco
    hg.addColorStop(0, `rgba(255,244,190,${.6 * nk})`); hg.addColorStop(1, 'rgba(255,230,150,0)');
    c.fillStyle = hg; c.beginPath(); c.arc(hx, hy + 4, 30, 0, 6.3); c.fill();
  });
  c.restore();
}
/* ---------- De día a noche: la calle se va oscureciendo ---------- */
function skyTint(h) {                                           // [hora, r, g, b, alfa]
  const K = [[8, 255, 190, 110, .14], [10, 255, 230, 170, 0], [16.5, 255, 230, 170, 0], [18, 255, 130, 70, .22], [19, 90, 50, 120, .46], [20.5, 14, 14, 62, .64], [23, 6, 8, 40, .72]];
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
    c.beginPath(); c.rect(-1500, -1000, 4000, 2800);
    polyPath(c, [S(0, 0, 0), S(COLS, 0, 0), S(COLS, ROWS, 0), S(0, ROWS, 0)]);
    polyPath(c, [S(COLS, 0, 0), S(COLS, ROWS, 0), S(COLS, ROWS, -16), S(COLS, 0, -16)]);
    polyPath(c, [S(0, ROWS, 0), S(COLS, ROWS, 0), S(COLS, ROWS, -16), S(0, ROWS, -16)]);
    c.fillStyle = `rgba(${Math.round(k[1])},${Math.round(k[2])},${Math.round(k[3])},${k[4].toFixed(3)})`; c.fill('evenodd');
    c.restore();
  }
  if (false) {                                                  // (las luces de los faroles ahora se dibujan en drawLights, al final)
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
  const gl = nightGlow(w);                                          // el cartel de afuera brilla más de noche
  (w.outs || []).filter(o => o.type === 'cartel').forEach(o => {
    const ST = SIGN_STYLES[signOf().st] || SIGN_STYLES[0], p = S(o.c + .5, o.r + .5), k = .18 + .82 * gl;
    c.save(); c.globalCompositeOperation = 'lighter';
    for (const [hx, hy, hr, ha] of [[0, -178, 78, .55], [0, -100, 105, .42], [0, 0, 80, .18]]) { const rg = c.createRadialGradient(p.x + hx, p.y + hy, 3, p.x + hx, p.y + hy, hr); rg.addColorStop(0, `rgba(${ST.halo},${ha * k})`); rg.addColorStop(1, `rgba(${ST.halo},0)`); c.fillStyle = rg; c.beginPath(); c.arc(p.x + hx, p.y + hy, hr, 0, 6.3); c.fill(); }
    c.restore();
  });
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
  if (e.hitOut) { const lw = e.hitOut.type === 'parking' ? LOT_W : 1, lh = e.hitOut.type === 'parking' ? LOT_H : 1; groundQuad(c, e.hitOut.c, e.hitOut.r, e.hitOut.c + lw, e.hitOut.r + lh); c.fillStyle = 'rgba(255,200,61,.5)'; c.fill(); UI.cursor = true; }
  e.why = null;
  if (held && held.it.type === 'chairs') {                                         // sillas en la mano: se resaltan las mesas
    w.furn.filter(it => it.type === 'table').forEach(tb => footprint(tb).forEach(([a, b]) => { groundQuad(c, a, b, a + 1, b + 1); c.fillStyle = tb === e.chairTo ? 'rgba(80,230,140,.55)' : 'rgba(255,200,61,.22)'; c.fill(); }));
    UI.cursor = true;
  } else if (held && held.it.type === 'parking') {                                  // estacionamiento en la mano: se marcan los lugares donde sí cabe
    for (let r = ROWS; r <= ROWS + 8; r++) for (let cc = -8; cc <= COLS + 6; cc++) if (!lotCan(w, cc, r)) { groundQuad(c, cc, r, cc + LOT_W, r + LOT_H); c.fillStyle = 'rgba(80,230,140,.08)'; c.fill(); }
    if (e.hoverOut) { const a = { c: e.hoverOut.c - 1, r: e.hoverOut.r - 1 }, why = lotCan(w, a.c, a.r); e.why = why; groundQuad(c, a.c, a.r, a.c + LOT_W, a.r + LOT_H); c.fillStyle = why ? 'rgba(255,70,90,.42)' : 'rgba(80,230,140,.5)'; c.fill(); c.lineWidth = 2; c.strokeStyle = why ? '#ff8fa0' : '#9af0b8'; c.stroke(); }
    UI.cursor = true;
  } else if (held && isOut(held.it)) {                                              // cartel en la mano: se marca el pasto donde sí cabe
    const oR = outRange(held.it.type); for (let r = oR.r0; r <= oR.r1; r++) for (let cc = oR.c0; cc <= oR.c1; cc++) if (!outCanPlace(w, cc, r, held.it)) { groundQuad(c, cc, r, cc + 1, r + 1); c.fillStyle = 'rgba(80,230,140,.2)'; c.fill(); c.strokeStyle = 'rgba(150,255,190,.45)'; c.stroke(); }
    if (e.hoverOut) { const why = outCanPlace(w, e.hoverOut.c, e.hoverOut.r, held.it); e.why = why; groundQuad(c, e.hoverOut.c, e.hoverOut.r, e.hoverOut.c + 1, e.hoverOut.r + 1); c.fillStyle = why ? 'rgba(255,70,90,.5)' : 'rgba(80,230,140,.6)'; c.fill(); }
    UI.cursor = true;
  } else if (held && e.hover) {
    const a = anchorFor(held.it, e.hover), why = canPlace(w, held.it, a.c, a.r);
    e.why = why;
    footprint({ type: held.it.type, c: a.c, r: a.r, rot: held.it.rot || 0 }).forEach(([x, y]) => {
      if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return;
      groundQuad(c, x, y, x + 1, y + 1); c.fillStyle = why ? 'rgba(255,70,90,.5)' : 'rgba(80,230,140,.5)'; c.fill();
    });
    UI.cursor = true;
  }
}
function drawEditGhost(c, w) {                                      // lo que llevas, semitransparente donde lo soltarías
  const e = w.edit; if (!e || !e.held) return; const h = e.held;
  if (h.it.type === 'chairs') {
    if (e.chairTo) { const tb = e.chairTo, g = { type: 'table', c: tb.c, r: tb.r, rot: tb.rot || 0, style: tb.style, chair: h.it.style }; g.seats = tb.seats.map(s => Object.assign({}, s, { customer: null, tb: g })); placeSeats(g); c.save(); c.globalAlpha = .85; drawChair(c, g.seats[0]); drawChair(c, g.seats[1]); c.restore(); }
    return;
  }
  if (h.it.type === 'parking') { if (e.hoverOut) { const a = { c: e.hoverOut.c - 1, r: e.hoverOut.r - 1 }; if (!lotCan(w, a.c, a.r)) { c.save(); c.globalAlpha = .8; drawLotGround(c, a, 1, w); drawLotSign(c, a, w); c.restore(); } } return; }
  if (isOut(h.it)) { if (e.hoverOut) { c.save(); c.globalAlpha = .78; if (h.it.type === 'farol') drawLamp(c, e.hoverOut.c + .5, e.hoverOut.r + .5, w.t); else drawCartel(c, w, e.hoverOut.c, e.hoverOut.r); c.restore(); } return; }
  if (e.hover) { const a = anchorFor(h.it, e.hover); c.save(); c.globalAlpha = .72; drawGhost(c, w, h.it, a.c, a.r); c.restore(); }
}
function drawGhost(c, w, it, cc, rr_) {
  if (it.type === 'table') {
    const g = { type: 'table', c: cc, r: rr_, rot: it.rot || 0, style: it.style, chair: it.chair };
    g.seats = it.seats.map(s => Object.assign({}, s, { customer: null, tb: g }));
    placeSeats(g);
    drawChair(c, g.seats[0]); drawTable(c, g, w); drawChair(c, g.seats[1]);
  } else drawFurn(c, w, Object.assign({}, it, { c: cc, r: rr_ }));
}
const ICON_COL = {
  table: ['#fff4e6', '#d9374a', '#a92a3a', 'Mesa'], comal: ['#4b4f5c', '#3a3d48', '#2a2c35', 'Comal'], fridge: ['#5d8be6', '#2a62c9', '#1f4a9c', 'Refri'],
  drinks: ['#c98b4e', '#2a62c9', '#1f4a9c', 'Bebidas'], bar: ['#c98b4e', '#b5482f', '#8f3624', 'Barra'], bench: ['#c98b4e', '#8f5a2c', '#6e4220', 'Banca'],
  plant: ['#c4492a', '#2f8f4e', '#2a7d44', 'Planta'], trompo: ['#b23d1f', '#d2602d', '#a63a1f', 'Trompo'], caja: ['#e8dcc0', '#cdbf9c', '#a99a78', 'Caja'],
  estatua: ['#ffe27a', '#e3b53a', '#b88a1f', 'Estatua'], vitrina: ['#d7f0ff', '#6ea6d6', '#4d82b0', 'Vitrina'],
  bar2: ['#e0b070', '#1f8f94', '#17707a', 'Antojos'], storage: ['#eef4fa', '#b9c9d8', '#8fa3b8', 'Sobrantes'], garra: ['#ffd23a', '#2f6fd0', '#c4272f', 'Garra'], parrilla: ['#24252c', '#d62f3a', '#8f1c26', 'Parrilla'], vitrinam: ['#d7f0ff', '#7a4a2a', '#5a331c', 'Máscaras'],
  chairs: ['#ffc43a', '#ffb21e', '#d98f00', 'Sillas'], cartel: ['#ff7ab8', '#7c3aed', '#2a2733', 'Cartel'], farol: ['#ffe58a', '#2b2540', '#1a1730', 'Farol'], parking: ['#6b6d80', '#4a4c5c', '#34364a', 'Estac.']
};
function drawFurnIcon(c, type, x, y) {                           // cubito isométrico con el color de cada pieza
  const k = ICON_COL[type];
  c.save(); c.lineJoin = 'round'; c.lineWidth = 1.6; c.strokeStyle = P.ink;
  const tall = ['fridge', 'plant', 'trompo', 'estatua', 'vitrina', 'storage', 'garra', 'cartel', 'farol', 'vitrinam'].includes(type) ? 8 : 0;
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
  const g = c.createLinearGradient(0, Q.y, 0, Q.y + h); g.addColorStop(0, '#12476a'); g.addColorStop(1, '#1f1d25');
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
    const ht = e.held.it, lines = [`Llevas: ${ht.type === 'chairs' ? CHAIRS[ht.style].name : FURN[ht.type].name}`], target = ht.type === 'chairs' ? e.chairTo : isOut(ht) ? e.hoverOut : e.hover;
    if (e.why) lines.push(e.why);
    else if (ht.type === 'chairs' && !e.chairTo) lines.push('Toca la mesa que las recibe');
    else if (target) lines.push(UI.touch ? (e.armed ? 'Toca otra vez para soltarlo aquí' : 'Toca para ver dónde queda') : 'Toca para soltarlo aquí');
    drawTip(c, clamp(UI.mx + 18, 8, Q.x - 220), UI.my + 8, lines);
  } else if (tip) drawTip(c, UI.mx - 230, UI.my + 6, tip);
  else if (e.hit) drawTip(c, UI.mx + 18, UI.my + 8, [FURN[e.hit.type].name, 'Toca para levantarlo']);
  else if (e.hitOut) drawTip(c, UI.mx + 18, UI.my + 8, [FURN[e.hitOut.type].name, 'Toca para levantarlo']);
}

/* =========================================================
   PUEBLO (v1.8)
   Un botón del local te saca al pueblo: una avenida, una calle y los edificios (cine, boutique, tienda de muebles, casas), un parque y las canchas.
   Los edificios se ven cerrados desde la calle; al entrar se ve su interior (como el local). Mientras no estás, tu personal sigue atendiendo.
   w.loc: 'rest' (la taquería) · 'town' (la calle) · 'in' (dentro de un edificio: w.inId). El mapa usa sus propios ejes isométricos.
   ========================================================= */
const TOWN_X0 = -8, TOWN_Y0 = -2, TOWN_NX = 50, TOWN_NY = 42;          // el mapa va de x -8 a 42 y de y -2 a 40
const AVE = { y0: 14, y1: 18 }, CRS = { x0: 22, x1: 26 };               // la avenida (de este a oeste) y la calle que la cruza (de norte a sur)
const BLD = [
  { id: 'taq',    kind: 'taq',    name: 'Tacos Enmascarados',   x0: 1,    y0: 4.8,  x1: 8.6,  y1: 12, h: 98,  door: { f: 'y', t: 4.8 } },
  { id: 'cine',   kind: 'cine',   name: 'Cine',                 x0: 9.4,  y0: 3.8,  x1: 16.4, y1: 12, h: 122, door: { f: 'y', t: 12.9 } },
  { id: 'bou',    kind: 'bou',    name: 'Boutique Enmascarada', x0: 17.2, y0: 6,    x1: 20,   y1: 12, h: 102, door: { f: 'y', t: 18.6 } },
  { id: 'tienda', kind: 'tienda', name: 'Tienda de muebles',    x0: 27.8, y0: 4.2,  x1: 37.4, y1: 12, h: 108, door: { f: 'y', t: 32.6 } },
  { id: 'casa1',  kind: 'casa',   name: 'Casita del Barrio',    x0: 13.8, y0: 20,   x1: 20,   y1: 24.2, h: 70,  door: { f: 'x', t: 22.1 } },
  { id: 'casa2',  kind: 'casa',   name: 'Casa Familiar',        x0: 12.8, y0: 25,   x1: 20,   y1: 29.6, h: 76,  door: { f: 'x', t: 27.3 } },
  { id: 'casa3',  kind: 'casa',   name: 'Casona del Campeón',   x0: 11.4, y0: 30.4, x1: 20,   y1: 35.6, h: 84,  door: { f: 'x', t: 33 } }
];
const BLDG = {}; BLD.forEach(b => { BLDG[b.id] = b; });
const HOUSES = {
  casa1: { name: 'Casita del Barrio',  price: 9000,  level: 8,  cols: 6,  rows: 6, doorC: 4 },
  casa2: { name: 'Casa Familiar',      price: 26000, level: 16, cols: 8,  rows: 7, doorC: 6 },
  casa3: { name: 'Casona del Campeón', price: 70000, level: 26, cols: 10, rows: 8, doorC: 8 }
};
const PARK = { x0: 28, y0: 20, x1: 38, y1: 28 };
const FIELDS = [{ id: 'f1', x0: 28.2, y0: 29, x1: 32.8, y1: 38 }, { id: 'f2', x0: 33.2, y0: 29, x1: 37.8, y1: 38 }];
const BENCHES = [{ x: 30, y: 21.6, f: 'y' }, { x: 36, y: 21.6, f: 'y' }, { x: 30, y: 26.2, f: 'x' }, { x: 36, y: 26.2, f: 'x' }, { x: 33, y: 26.3, f: 'y' }];
const FOUNTAIN = { x: 33, y: 23.8, r: 1.5 };
const TREES = [[-6, 4], [-4, 8], [-5, 10.5], [0, 2], [3, 2.2], [8, 2], [16.8, 2.4], [21, 3], [24.4, 3.4], [26.4, 6], [-5, 21.6], [-3, 25], [-6, 29], [-4, 33], [0, 22], [3, 26], [1, 31], [5, 23], [8, 28], [6, 34], [9, 37], [11, 22], [10, 21], [-2, 21], [39, 8], [39.4, 13], [40, 22], [39.4, 30], [40, 36], [28.6, 21], [37.4, 21], [28.6, 26.8], [37.4, 26.8], [24, 38], [-2, 38], [39, 4], [23.2, 1], [31, 1.4]];
const TLAMPS = [[-6, 13.7], [-2, 13.7], [1.4, 13.7], [8, 13.7], [15, 13.7], [21, 13.7], [29, 13.7], [36, 13.7], [40.6, 13.7], [-4, 18.3], [3, 18.3], [10, 18.3], [17, 18.3], [29.6, 18.3], [37, 18.3], [20.5, 24.6], [20.5, 30], [20.5, 8], [20.5, 3], [27.5, 6], [27.5, 21], [27.5, 30], [27.5, 36]];
const TDEF = { wall: '#f1e6d0', floor: 'madera', fachada: '#e9d8bd', roof: '#b5482f', cuadros: true };
const houseOf = (w, id) => w.town.houses[id] || (w.town.houses[id] = { own: false, wall: TDEF.wall, floor: TDEF.floor, fachada: id === 'casa2' ? '#c9e6b3' : id === 'casa3' ? '#a9d3e8' : TDEF.fachada, roof: id === 'casa2' ? '#3b5bdb' : id === 'casa3' ? '#2b2b33' : TDEF.roof, cuadros: true, furn: [] });

// ---- mapa de choques: edificios, árboles, faroles, la fuente y la cerca del parque (con sus puertas)
const TOWN_BLOCK = new Uint8Array(TOWN_NX * TOWN_NY);
const tnIdx = (c, r) => (r - TOWN_Y0) * TOWN_NX + (c - TOWN_X0);
const tnIn = (c, r) => c >= TOWN_X0 && c < TOWN_X0 + TOWN_NX && r >= TOWN_Y0 && r < TOWN_Y0 + TOWN_NY;
const tnBlocked = (c, r) => !tnIn(c, r) || TOWN_BLOCK[tnIdx(c, r)] === 1;
(function buildTownBlock() {
  const set = (c, r) => { if (tnIn(c, r)) TOWN_BLOCK[tnIdx(c, r)] = 1; };
  const blk = (x0, y0, x1, y1) => { for (let r = Math.floor(y0); r < Math.ceil(y1); r++) for (let c = Math.floor(x0); c < Math.ceil(x1); c++) set(c, r); };
  BLD.forEach(b => blk(b.x0, b.y0, b.x1, b.y1));
  TREES.forEach(([x, y]) => blk(x - .3, y - .3, x + .3, y + .3));
  TLAMPS.forEach(([x, y]) => blk(x - .15, y - .15, x + .15, y + .15));
  blk(FOUNTAIN.x - FOUNTAIN.r, FOUNTAIN.y - FOUNTAIN.r, FOUNTAIN.x + FOUNTAIN.r, FOUNTAIN.y + FOUNTAIN.r);
  const gate = (c, r) => (r === 20 || r === 27) ? (c >= 31 && c < 35) : (c === 28 ? (r >= 22 && r < 25) : false);        // puertas del parque: arriba y abajo (x 31 a 35) y a la izquierda (y 22 a 25)
  for (let c = 28; c <= 37; c++) for (const r of [20, 27]) if (!gate(c, r)) set(c, r);
  for (let r = 20; r <= 27; r++) for (const c of [28, 37]) if (!gate(c, r)) set(c, r);
})();
const sidewalkCells = (() => {                                          // dónde caminan los peatones (las banquetas)
  const out = [];
  for (let r = TOWN_Y0; r < TOWN_Y0 + TOWN_NY; r++) for (let c = TOWN_X0; c < TOWN_X0 + TOWN_NX; c++) {
    if (TOWN_BLOCK[tnIdx(c, r)]) continue;
    const nA = (r >= 12 && r < 14) || (r >= 18 && r < 20), nB = (c >= 20 && c < 22) || (c >= 26 && c < 28);
    if ((nA && c < 42) || (nB && r < 40)) out.push([c, r]);
  }
  return out;
})();

// ---- búsqueda de camino en una cuadrícula cualquiera (el pueblo o el interior de un edificio)
function bfsPath(nx, ny, blocked, sx, sy, goals, ox = 0, oy = 0) {   // blocked(c, r) · goals = lista de [c, r] · devuelve las losetas desde la siguiente a la de inicio hasta la meta (o null)
  const key = (c, r) => (r - oy) * nx + (c - ox), inb = (c, r) => c >= ox && c < ox + nx && r >= oy && r < oy + ny;
  const gset = new Set(goals.filter(g => inb(g[0], g[1])).map(g => key(g[0], g[1])));
  if (!gset.size) return null;
  const s0 = [Math.floor(sx), Math.floor(sy)];
  if (!inb(s0[0], s0[1])) return null;
  if (gset.has(key(s0[0], s0[1]))) return [];
  const prev = new Map(); prev.set(key(s0[0], s0[1]), -1);
  const q = [s0]; let qi = 0, found = -1;
  while (qi < q.length && found < 0) {
    const [c, r] = q[qi++];
    for (const [dc, dr] of DIRS) {
      const nc = c + dc, nr = r + dr;
      if (!inb(nc, nr)) continue;
      const k = key(nc, nr); if (prev.has(k) || blocked(nc, nr)) continue;
      prev.set(k, key(c, r)); if (gset.has(k)) { found = k; break; } q.push([nc, nr]);
    }
  }
  if (found < 0) return null;
  const out = []; let k = found;
  while (k !== -1 && k !== key(s0[0], s0[1])) { out.push({ c: (k % nx) + ox, r: Math.floor(k / nx) + oy }); k = prev.get(k); }
  return out.reverse();
}
const townPathTo = (T, goals) => bfsPath(TOWN_NX, TOWN_NY, tnBlocked, T.x, T.y, goals, TOWN_X0, TOWN_Y0);
function nearFreeCell(c, r, blocked, rad = 4) {                        // la loseta libre más cercana a (c, r)
  if (!blocked(c, r)) return [c, r];
  for (let d = 1; d <= rad; d++) for (let dr = -d; dr <= d; dr++) for (let dc = -d; dc <= d; dc++) if (Math.max(Math.abs(dc), Math.abs(dr)) === d && !blocked(c + dc, r + dr)) return [c + dc, r + dr];
  return null;
}
const doorSpot = b => b.door.f === 'y' ? { x: b.door.t, y: b.y1 + .8 } : { x: b.x1 + .8, y: b.door.t };

// ---- estado del pueblo (se guarda lo de las casas y los muebles de la casa)
function townInit(w, save) {
  const sv = (save && save.town) || {};
  w.town = { x: 5, y: 13.4, dir: 1, phase: 0, moving: false, speed: 4.2, path: [], intent: null, npcs: [], cars: [], npcT: 0, carT: 2, cx: null, cy: null, sit: null, t: 0, seen: false,
    houses: {}, hinv: Array.isArray(sv.hinv) ? sv.hinv.filter(t => HF[t]) : [], hasTicket: false, movie: 0, movies: 0, penalDay: 0, penalN: 0, bedDay: 0 };
  Object.keys(sv.houses || {}).forEach(id => {
    if (!HOUSES[id]) return; const h = sv.houses[id], d = houseOf(w, id);
    d.own = !!h.own; if (HOME_WALLS.includes(h.wall)) d.wall = h.wall; if (HOME_FLOORS[h.floor]) d.floor = h.floor; if (HOME_FACHADA.includes(h.fachada)) d.fachada = h.fachada; if (HOME_ROOF.includes(h.roof)) d.roof = h.roof; d.cuadros = h.cuadros !== false;
    d.furn = (h.furn || []).filter(f => HF[f.t] && Number.isFinite(f.c) && Number.isFinite(f.r)).map(f => ({ t: f.t, c: f.c | 0, r: f.r | 0, rot: f.rot ? 1 : 0 }));
  });
  w.loc = 'rest'; w.inId = null; w.inn = null; w.fade = null; w.hedit = null; w.novato.away = false;
}
const townPersist = w => ({ hinv: w.town.hinv.slice(), houses: Object.fromEntries(Object.keys(w.town.houses).filter(id => w.town.houses[id]).map(id => { const h = w.town.houses[id]; return [id, { own: h.own, wall: h.wall, floor: h.floor, fachada: h.fachada, roof: h.roof, cuadros: h.cuadros, furn: h.furn.map(f => ({ t: f.t, c: f.c, r: f.r, rot: f.rot })) }]; })) });

// ---- de qué hora depende cuánta gente hay en la calle (de 0 a 1)
const TDENS = [[8, .35], [9, .6], [11, .85], [13, 1], [15.5, .9], [18, .65], [20, .4], [22, .22], [23, .12]];
function townDensity(h) {
  if (h <= TDENS[0][0]) return TDENS[0][1];
  for (let i = 1; i < TDENS.length; i++) if (h <= TDENS[i][0]) { const a = TDENS[i - 1], b = TDENS[i]; return lerp(a[1], b[1], (h - a[0]) / (b[0] - a[0])); }
  return TDENS[TDENS.length - 1][1];
}
const TNPC_MAX = 16, TCAR_MAX = 5;
function spawnTownNpc(T) {
  const edges = [[-7, 13], [41, 13], [-7, 19], [41, 19], [21, -1], [27, -1], [21, 39], [27, 39]], e = pick(edges), cell = nearFreeCell(e[0], e[1], tnBlocked, 3); if (!cell) return;
  const n = { x: cell[0] + .5, y: cell[1] + .5, dir: 1, phase: rand(0, 6), moving: false, speed: rand(1.3, 2), path: [], look: randomLook(), wait: 0, leaving: false, dead: false, t: rand(0, 6) };
  T.npcs.push(n); npcNewGoal(n);
}
function npcNewGoal(n) {
  const g = pick(sidewalkCells), p = bfsPath(TOWN_NX, TOWN_NY, tnBlocked, n.x, n.y, [g], TOWN_X0, TOWN_Y0);
  n.path = p ? p.map(q => ({ x: q.c + .5, y: q.r + .5 })) : [];
}
function npcLeave(n) {
  const exits = [[-7, 13], [41, 13], [21, -1], [27, 39]], e = exits.sort((a, b) => Math.hypot(a[0] - n.x, a[1] - n.y) - Math.hypot(b[0] - n.x, b[1] - n.y))[0];
  const p = bfsPath(TOWN_NX, TOWN_NY, tnBlocked, n.x, n.y, [e], TOWN_X0, TOWN_Y0); n.path = p ? p.map(q => ({ x: q.c + .5, y: q.r + .5 })) : []; n.leaving = true; if (!n.path.length) n.dead = true;
}
const TLANES = [{ o: 'x', fix: 15.1, dir: -1, a: 43, b: -10 }, { o: 'x', fix: 16.9, dir: 1, a: -10, b: 43 }, { o: 'y', fix: 23.1, dir: 1, a: -3, b: 41 }, { o: 'y', fix: 24.9, dir: -1, a: 41, b: -3 }];
function spawnTownCar(T) {
  const L = pick(TLANES), busy = T.cars.some(q => q.lane === L && Math.abs((L.o === 'x' ? q.x : q.y) - L.a) < 7); if (busy) return;
  T.cars.push({ lane: L, x: L.o === 'x' ? L.a : L.fix, y: L.o === 'y' ? L.a : L.fix, o: L.o, fx: L.o === 'x' ? L.dir : 0, fy: L.o === 'y' ? L.dir : 0, model: pick(CAR_KEYS), col: Math.floor(Math.random() * CAR_COLS.length), state: 'out', brake: 0, t: 0, speed: rand(3, 4.2), moving: true });
}
function updateTownLife(w, dt) {
  const T = w.town, h = hourOf(w), dens = townDensity(h), tn = Math.round(dens * TNPC_MAX), tc = Math.round(dens * TCAR_MAX);
  T.npcT -= dt; if (T.npcs.length < tn && T.npcT <= 0) { T.npcT = rand(.8, 2.4); spawnTownNpc(T); }
  if (!T.seen) { T.seen = true; for (let i = 0; i < tn; i++) spawnTownNpc(T); T.npcs.forEach(n => { const g = pick(sidewalkCells); n.x = g[0] + .5; n.y = g[1] + .5; npcNewGoal(n); }); }
  for (const n of T.npcs) {
    n.t += dt; step(n, dt);
    if (n.wait > 0) { n.wait -= dt; continue; }
    if (!n.path.length) { if (n.leaving) n.dead = true; else if (Math.random() < .45) n.wait = rand(1, 4); else npcNewGoal(n); }
  }
  if (T.npcs.length > tn + 1) { const far = T.npcs.filter(n => !n.leaving && Math.hypot(n.x - T.x, n.y - T.y) > 12)[0]; if (far) npcLeave(far); }
  T.npcs = T.npcs.filter(n => !n.dead);
  T.carT -= dt; if (T.cars.length < tc && T.carT <= 0) { T.carT = rand(2.5, 6); spawnTownCar(T); }
  for (const cr of T.cars) {
    cr.t += dt; const ahead = T.cars.some(q => q !== cr && q.lane === cr.lane && ((cr.o === 'x' ? q.x - cr.x : q.y - cr.y) * cr.lane.dir) > 0 && ((cr.o === 'x' ? q.x - cr.x : q.y - cr.y) * cr.lane.dir) < 3.6);
    cr.brake = ahead ? .2 : 0; const sp = ahead ? 0 : cr.speed; if (cr.o === 'x') cr.x += cr.lane.dir * sp * dt; else cr.y += cr.lane.dir * sp * dt;
    cr.dead = cr.o === 'x' ? (cr.lane.dir > 0 ? cr.x > cr.lane.b : cr.x < cr.lane.b) : (cr.lane.dir > 0 ? cr.y > cr.lane.b : cr.y < cr.lane.b);
  }
  T.cars = T.cars.filter(q => !q.dead);
}

// ---- pasar de un lugar a otro (con un fundido a negro)
function fadeTo(w, fn) { if (w.fade) return; w.fade = { t: 0, dur: .55, fn, done: false }; }
function updateFade(w, dt) {
  const f = w.fade; if (!f) return;
  f.t += dt; if (!f.done && f.t >= f.dur / 2) { f.done = true; try { f.fn(); } catch (e) { console.error('Tacos Enmascarados: fundido', e); } }
  if (f.t >= f.dur) w.fade = null;
}
function goTown(w) {                                                    // salir de la taquería al pueblo
  if (w.loc !== 'rest' || w.tut || w.phase !== 'play' || w.fade) return;
  const waiting = w.customers.some(c => c.state === 'wait' || c.state === 'eat') || w.queue.length > 0;
  if (waiting && w.open) { w.dlg = { title: '¿Salir al pueblo?', lines: ['Hay clientes en el local y está abierto.', 'Tu personal seguirá atendiendo, pero tú no.', 'Puedes cerrar el local primero.'], ok: 'SALIR', no: 'QUEDARME', fn: () => doGoTown(w) }; w.modal = 'dlg'; sfx('click'); return; }
  doGoTown(w);
}
function doGoTown(w) {
  const n = w.novato; w.modal = null; w.panel = false;
  handsRelease(w); n.path = []; n.task = null; n.moving = false; if (n.resting) standUp(w, n);
  sfx('door');
  fadeTo(w, () => {
    const T = w.town, b = BLDG.taq, sp = doorSpot(b); T.x = sp.x; T.y = sp.y; T.path = []; T.intent = null; T.moving = false; T.sit = null; T.cx = null;
    w.loc = 'town'; n.away = true; camReset(); toast(w, 'Estás en el pueblo. Toca un edificio para entrar o la taquería para volver');
  });
}
function handsRelease(w) { const hl = heldList(w); hl.forEach(k => { if (k && w.stock[k] !== undefined) w.stock[k]++; }); w.novato.carrying = null; handsReset(w); }
function returnToRest(w) {
  sfx('door');
  fadeTo(w, () => {
    w.loc = 'rest'; w.inId = null; w.inn = null; w.hedit = null; w.modal = null; w.novato.away = false; camReset();
    const ns = nearestFree(2.5, 2.5), n = w.novato; n.x = ns.x; n.y = ns.y; n.path = []; n.task = null;
    toast(w, '¡De vuelta en la taquería!');
  });
}
function enterBuilding(w, id) {
  const b = BLDG[id]; if (!b || w.fade) return;
  if (id === 'taq') { returnToRest(w); return; }
  if (b.kind === 'casa' && !houseOf(w, id).own) { openBuyHouse(w, id); return; }
  sfx('door');
  fadeTo(w, () => { w.loc = 'in'; w.inId = id; w.inn = newRoom(w, id); w.town.path = []; camReset(); w.modal = null; });
}
function exitBuilding(w) {
  if (w.loc !== 'in' || w.fade) return;
  sfx('door');
  fadeTo(w, () => { const T = w.town, b = BLDG[w.inId], sp = doorSpot(b); T.x = sp.x; T.y = sp.y; T.path = []; T.intent = null; T.cx = null; w.loc = 'town'; w.inId = null; w.inn = null; w.hedit = null; w.modal = null; camReset(); });
}

// ---- clic en el pueblo
const tS = (x, y) => ({ x: (x - y) * (TW / 2), y: (x + y) * (TH / 2) });          // posición en pantalla con el origen del pueblo (0, 0)
const tnView = w => { const T = w.town, p = tS(T.x, T.y); return { sx: T.cx == null ? p.x : T.cx, sy: T.cy == null ? p.y : T.cy }; };
function withTownOrigin(fn) { const a = OX, b = OY; OX = 0; OY = 0; try { return fn(); } finally { OX = a; OY = b; } }
function townWorldAt(w, x, y) {                                        // de un punto de la pantalla a la loseta (con zoom y desplazamiento)
  const q = camWorld(x, y), v = tnView(w);
  return withTownOrigin(() => screenToIso(q.x - 480 + v.sx, q.y - 330 + v.sy));
}
function townGoTo(w, x, y, intent) {
  const T = w.town, cell = nearFreeCell(Math.floor(x), Math.floor(y), tnBlocked, 3); if (!cell) { sfx('nope'); return false; }
  const p = townPathTo(T, [cell]); if (!p) { sfx('nope'); return false; }
  T.path = p.map(q => ({ x: q.c + .5, y: q.r + .5 })); if (!T.path.length || Math.hypot(T.path[T.path.length - 1].x - (cell[0] + .5), T.path[T.path.length - 1].y - (cell[1] + .5)) > .01) T.path.push({ x: cell[0] + .5, y: cell[1] + .5 });
  T.intent = intent || null; T.sit = null; sfx('click'); return true;
}
function buildingAt(x, y) { return BLD.find(b => x >= b.x0 - .05 && x <= b.x1 + .05 && y >= b.y0 - .05 && y <= b.y1 + .05) || null; }
function townPointer(w, x, y) {
  const T = w.town, q = townWorldAt(w, x, y);
  const bd = townHitBuilding(w, x, y);
  if (bd) { const sp = doorSpot(bd); if (Math.hypot(T.x - sp.x, T.y - sp.y) < .75) { enterBuilding(w, bd.id); return; } townGoTo(w, sp.x, sp.y, { type: 'enter', id: bd.id }); return; }
  const bn = BENCHES.findIndex(b => Math.hypot(b.x - q.x, b.y - q.y) < .9);
  if (bn >= 0) { const b = BENCHES[bn], st = b.f === 'y' ? { x: b.x, y: b.y + .9 } : { x: b.x + .9, y: b.y }; townGoTo(w, st.x, st.y, { type: 'bench', i: bn }); return; }
  const fl = FIELDS.find(f => q.x >= f.x0 && q.x <= f.x1 && q.y >= f.y0 && q.y <= f.y1);
  if (fl) { townGoTo(w, (fl.x0 + fl.x1) / 2, fl.y0 + 1.2, { type: 'field', id: fl.id }); return; }
  townGoTo(w, q.x, q.y, null);
}
function updateTown(w, dt) {                                           // el personaje del jugador en la calle
  const T = w.town; T.t += dt;
  const p = tS(T.x, T.y); if (T.cx == null) { T.cx = p.x; T.cy = p.y; } else { T.cx += (p.x - T.cx) * Math.min(1, dt * 5); T.cy += (p.y - T.cy) * Math.min(1, dt * 5); }
  if (T.sit) { T.moving = false; T.path = []; T.sit.t += dt; const n = w.novato, mx = maxStamina(w); n.stamina = Math.min(mx, n.stamina + STAM.regen * 1.4 * dt); if (n.stamina >= mx && T.sit.t > 3) { T.sit = null; toast(w, 'Descansaste en la banca: ¡energía completa!'); sfx('ready'); } return; }
  const wasMoving = T.path.length > 0; step(T, dt);
  if (wasMoving && !T.path.length) {
    const it = T.intent; T.intent = null;
    if (it && it.type === 'enter') enterBuilding(w, it.id);
    else if (it && it.type === 'bench') { const b = BENCHES[it.i]; T.sit = { i: it.i, t: 0 }; T.dir = b.f === 'y' ? -1 : 1; sfx('pickup'); toast(w, 'Descansas en la banca: tu energía sube poco a poco'); }
    else if (it && it.type === 'field') openPenal(w, it.id);
  }
}
function townHint(w) {
  const T = w.town;
  if (w.loc === 'in') return w.inn && w.inn.hint ? w.inn.hint : 'Toca la puerta para salir';
  if (T.sit) return 'Descansando en la banca… toca el piso para levantarte';
  return 'Toca un edificio para entrar · el cartel SE VENDE es una casa que puedes comprar · la taquería está a la izquierda';
}

/* ---------- Dibujo del pueblo: calles, edificios cerrados por fuera, parque y canchas ---------- */
const fq = (kind, v, a0, a1, z0, z1) => kind === 'y' ? [S(a0, v, z0), S(a1, v, z0), S(a1, v, z1), S(a0, v, z1)] : [S(v, a0, z0), S(v, a1, z0), S(v, a1, z1), S(v, a0, z1)];
function polyFS(c, pts, fill, stroke, lw = 1.3) { isoPoly(c, pts); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.lineWidth = lw; c.strokeStyle = stroke; c.stroke(); } }
function onFace(c, kind, v, a, z, fn) {                                // dibuja texto o dibujos "pegados" a una pared (kind 'y': frente izquierdo, que se lee hacia +x · 'x': frente derecho, que se lee hacia -y)
  const o = S(kind === 'y' ? a : v, kind === 'y' ? v : a, z); c.save(); c.translate(o.x, o.y); c.transform(1, kind === 'y' ? .5 : -.5, 0, 1, 0, 0); fn(); c.restore();
}
function drawTownGround(c, w) {
  const x0 = TOWN_X0 - 8, x1 = TOWN_X0 + TOWN_NX + 8, y0 = TOWN_Y0 - 8, y1 = TOWN_Y0 + TOWN_NY + 8;
  const g = c.createLinearGradient(0, -400, 0, 1500); g.addColorStop(0, '#5aa65a'); g.addColorStop(1, '#3f8a49');
  c.fillStyle = g; c.fillRect(-4000, -2000, 9000, 6000);
  const band = (a, b, cc, d, col) => { groundQuad(c, a, b, cc, d); c.fillStyle = col; c.fill(); };
  band(x0, 12, x1, 14, '#d0cabb'); band(x0, 18, x1, 20, '#d0cabb'); band(20, y0, 22, y1, '#d0cabb'); band(26, y0, 28, y1, '#d0cabb');            // banquetas
  band(x0, AVE.y0, x1, AVE.y1, '#4a4c5c'); band(CRS.x0, y0, CRS.x1, y1, '#4a4c5c');                                                              // la avenida y la calle
  band(x0, 13.8, x1, 14, '#8d8779'); band(x0, 18, x1, 18.2, '#8d8779'); band(19.8, y0, 20, y1, '#8d8779'); band(22, y0, 22.2, y1, '#8d8779'); band(25.8, y0, 26, y1, '#8d8779'); band(26, y0, 26.2, y1, '#8d8779');
  c.strokeStyle = 'rgba(70,55,40,.28)'; c.lineWidth = 1.1; c.beginPath();                                                                           // juntas de la banqueta
  for (let x = x0; x < x1; x += 1.5) for (const [ya, yb] of [[12, 14], [18, 20]]) { const a = S(x, ya), b = S(x, yb); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); }
  for (let y = y0; y < y1; y += 1.5) for (const [xa, xb] of [[20, 22], [26, 28]]) { const a = S(xa, y), b = S(xb, y); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); }
  c.stroke();
  c.fillStyle = '#f2d45c';
  for (let x = x0; x < x1; x += 1.6) if (x < 21.2 || x > 26.6) { groundQuad(c, x, 15.94, x + .8, 16.06); c.fill(); }
  for (let y = y0; y < y1; y += 1.6) if (y < 13 || y > 19) { groundQuad(c, 23.94, y, 24.06, y + .8); c.fill(); }
  c.fillStyle = 'rgba(255,255,255,.88)';                                                                                                          // pasos de cebra en las cuatro esquinas del cruce
  for (let k = 0; k < 6; k++) { const o = 22.3 + k * .6; groundQuad(c, o, 18.2, o + .34, 19.8); c.fill(); groundQuad(c, o, 12.2, o + .34, 13.8); c.fill(); }
  for (let k = 0; k < 6; k++) { const o = 14.3 + k * .6; groundQuad(c, 20.2, o, 21.8, o + .34); c.fill(); groundQuad(c, 26.2, o, 27.8, o + .34); c.fill(); }
  // el parque y las canchas
  const P0 = PARK;
  band(P0.x0, P0.y0, P0.x1, P0.y1, '#62b85c');
  band(32, P0.y0, 34, P0.y1, '#e6dcc3'); band(P0.x0, 22.6, 33, 24.4, '#e6dcc3'); band(33, 22.6, P0.x1, 24.4, '#e6dcc3');
  FIELDS.forEach(f => {
    band(f.x0, f.y0, f.x1, f.y1, '#3f9a4a');
    for (let y = f.y0, k = 0; y < f.y1; y += 1.5, k++) if (k & 1) band(f.x0, y, f.x1, Math.min(f.y1, y + 1.5), '#47a653');
    c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 2; c.beginPath();
    const R = (a, b, cc, d) => { const p = [S(a, b), S(cc, b), S(cc, d), S(a, d)]; c.moveTo(p[0].x, p[0].y); p.slice(1).forEach(q => c.lineTo(q.x, q.y)); c.closePath(); };
    const xm = (f.x0 + f.x1) / 2, ym = (f.y0 + f.y1) / 2;
    R(f.x0 + .25, f.y0 + .25, f.x1 - .25, f.y1 - .25); R(xm - 1.4, f.y0 + .25, xm + 1.4, f.y0 + 1.5); R(xm - 1.4, f.y1 - 1.5, xm + 1.4, f.y1 - .25);
    const a = S(f.x0 + .25, ym), b = S(f.x1 - .25, ym); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y);
    c.stroke(); isoEllipse(c, xm, ym, 0, 1.1); c.stroke();
  });
}
function drawFence(c) {                                                // cerca blanca del parque, con sus puertas
  const P0 = PARK;
  const post = (x, y) => isoBox(c, x - .05, y - .05, x + .05, y + .05, 0, 12, { top: '#ffffff', left: '#eeeef4', right: '#cfd0dc' }, 1);
  const rail = (a, b, cc, d) => isoBox(c, a, b, cc, d, 6, 8.5, { top: '#fff', left: '#e7e7ee', right: '#c9cad6' }, .9);
  for (let cx = 28; cx <= 37; cx++) for (const r of [20, 27]) if (!(cx >= 31 && cx < 35)) { rail(cx, r + .5 - .03, cx + 1, r + .5 + .03); post(cx + .5, r + .5); }
  for (let r = 20; r <= 27; r++) for (const cx of [28, 37]) if (!(cx === 28 && r >= 22 && r < 25)) { rail(cx + .5 - .03, r, cx + .5 + .03, r + 1); post(cx + .5, r + .5); }
}
function drawTownBench(c, b) {
  const p = S(b.x, b.y);
  c.fillStyle = 'rgba(0,0,0,.2)'; c.beginPath(); c.ellipse(p.x, p.y + 3, 22, 8, 0, 0, 6.3); c.fill();
  if (b.f === 'y') { isoBox(c, b.x - .6, b.y - .2, b.x + .6, b.y + .2, 6, 12, { top: '#c98b4e', left: '#a8703a', right: '#8f5a2c' }, 1.2); isoBox(c, b.x - .6, b.y - .26, b.x + .6, b.y - .18, 12, 24, { top: '#d9a066', left: '#a8703a', right: '#8f5a2c' }, 1.2); for (const dx of [-.5, .5]) isoBox(c, b.x + dx - .04, b.y - .12, b.x + dx + .04, b.y + .12, 0, 6, { top: '#444', left: '#333', right: '#222' }, 1); }
  else { isoBox(c, b.x - .2, b.y - .6, b.x + .2, b.y + .6, 6, 12, { top: '#c98b4e', left: '#a8703a', right: '#8f5a2c' }, 1.2); isoBox(c, b.x - .26, b.y - .6, b.x - .18, b.y + .6, 12, 24, { top: '#d9a066', left: '#a8703a', right: '#8f5a2c' }, 1.2); for (const dy of [-.5, .5]) isoBox(c, b.x - .12, b.y + dy - .04, b.x + .12, b.y + dy + .04, 0, 6, { top: '#444', left: '#333', right: '#222' }, 1); }
}
function drawFountain(c, w) {
  const F = FOUNTAIN, p = S(F.x, F.y), t = w.t;
  c.fillStyle = 'rgba(0,0,0,.18)'; c.beginPath(); c.ellipse(p.x, p.y + 4, F.r * 63, F.r * 33, 0, 0, 6.3); c.fill();
  c.lineWidth = 2; c.strokeStyle = P.ink;
  c.fillStyle = '#9aa0b4'; isoEllipse(c, F.x, F.y, 0, F.r); c.fill(); c.stroke(); c.fillStyle = '#b9bfd3'; isoEllipse(c, F.x, F.y, 10, F.r); c.fill(); c.stroke();
  c.fillStyle = '#5fc3e8'; isoEllipse(c, F.x, F.y, 10, F.r - .22); c.fill();
  for (let k = 0; k < 3; k++) { const ph = (t * .6 + k / 3) % 1; c.strokeStyle = `rgba(255,255,255,${.6 * (1 - ph)})`; c.lineWidth = 1.6; isoEllipse(c, F.x, F.y, 10, .25 + ph * (F.r - .4)); c.stroke(); }
  c.lineWidth = 2; c.strokeStyle = P.ink; c.fillStyle = '#b9bfd3'; rr(c, p.x - 5, p.y - 36, 10, 30, 3); c.fill(); c.stroke(); c.fillStyle = '#9aa0b4'; c.beginPath(); c.ellipse(p.x, p.y - 36, 13, 5, 0, 0, 6.3); c.fill(); c.stroke();
  c.strokeStyle = 'rgba(190,235,255,.85)'; c.lineWidth = 2.4; c.lineCap = 'round';
  for (let k = -1; k <= 1; k++) { c.beginPath(); c.moveTo(p.x, p.y - 38); c.quadraticCurveTo(p.x + k * 12, p.y - 58 - Math.sin(t * 4 + k) * 3, p.x + k * 22, p.y - 28); c.stroke(); }
}
function drawSwing(c, x, y) {
  const a = S(x - .8, y), b = S(x + .8, y), top = S(x, y, 46);
  c.lineWidth = 3; c.strokeStyle = '#d6342c'; c.lineCap = 'round'; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(top.x - 2, top.y); c.moveTo(b.x, b.y); c.lineTo(top.x + 2, top.y); c.moveTo(top.x - 2, top.y); c.lineTo(top.x + 2, top.y); c.stroke();
  const sw = Math.sin(Game.w.t * 2) * 6; c.lineWidth = 1.2; c.strokeStyle = '#555'; c.beginPath(); c.moveTo(top.x - 8, top.y); c.lineTo(top.x - 8 + sw, top.y + 30); c.moveTo(top.x + 8, top.y); c.lineTo(top.x + 8 + sw, top.y + 30); c.stroke();
  c.fillStyle = '#ffb21e'; c.lineWidth = 1.5; c.strokeStyle = P.ink; rr(c, top.x - 11 + sw, top.y + 29, 22, 5, 2); c.fill(); c.stroke();
}
function drawGoal(c, cx, y, face, z) {                                // portería sobre una línea de gol (face -1 mira al norte, 1 al sur)
  const w2 = 1.2, h = 22, d = .5 * face;
  c.save();
  c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 1; c.beginPath();
  for (let k = 0; k <= 8; k++) { const a = S(cx - w2 + k * w2 / 4, y + d, 0), b = S(cx - w2 + k * w2 / 4, y + d, h); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); }
  for (let k = 0; k <= 4; k++) { const a = S(cx - w2, y + d, k * h / 4), b = S(cx + w2, y + d, k * h / 4); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); }
  c.stroke();
  for (const dx of [-w2, w2]) { const a = S(cx + dx, y, 0), b = S(cx + dx, y, h), e = S(cx + dx, y + d, h); c.strokeStyle = '#fff'; c.lineWidth = 3.2; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(b.x, b.y); c.lineTo(e.x, e.y); c.stroke(); }
  const l = S(cx - w2, y, h), r = S(cx + w2, y, h); c.strokeStyle = '#fff'; c.lineWidth = 3.2; c.beginPath(); c.moveTo(l.x, l.y); c.lineTo(r.x, r.y); c.stroke();
  c.restore();
}

// ---- edificios (por fuera están cerrados: no se ve nada de su interior)
const WIN_G = '#8ccbe8';
function glassWin(c, kind, v, a0, a1, z0, z1, night, warm) {
  polyFS(c, fq(kind, v, a0, a1, z0, z1), night ? (warm || '#ffd58a') : WIN_G, P.ink, 1.3);
  const q = fq(kind, v, a0, a1, z0, z1); c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(q[3].x + (q[2].x - q[3].x) * .12, q[3].y + (q[2].y - q[3].y) * .12 + 3); c.lineTo(q[3].x + (q[2].x - q[3].x) * .4, q[3].y + (q[2].y - q[3].y) * .4 + 3); c.stroke();
}
function drawBuildingDoor(c, b, night) {
  const f = b.door.f, v = f === 'y' ? b.y1 : b.x1, t = b.door.t, a0 = t - .75, a1 = t + .75;
  polyFS(c, fq(f, v, a0 - .1, a1 + .1, 0, 70), '#e9e2d2', P.ink, 1.4);                                    // marco
  polyFS(c, fq(f, v, a0, t, 0, 66), '#6d4423', P.ink, 1.3); polyFS(c, fq(f, v, t, a1, 0, 66), '#7a4d28', P.ink, 1.3);        // las dos hojas
  const g1 = fq(f, v, a0 + .12, t - .1, 24, 56), g2 = fq(f, v, t + .1, a1 - .12, 24, 56); polyFS(c, g1, night ? '#ffd58a' : '#a9d9ee', P.ink, 1); polyFS(c, g2, night ? '#ffd58a' : '#a9d9ee', P.ink, 1);
  const hd = S(f === 'y' ? t - .12 : v, f === 'y' ? v : t + .12, 32); c.fillStyle = '#ffd24a'; c.beginPath(); c.arc(hd.x, hd.y, 2, 0, 6.3); c.fill(); const hd2 = S(f === 'y' ? t + .12 : v, f === 'y' ? v : t - .12, 32); c.beginPath(); c.arc(hd2.x, hd2.y, 2, 0, 6.3); c.fill();
}
function awning(c, kind, v, a0, a1, z, depth, cols) {                    // toldo de rayas sobre la puerta o las ventanas
  const n = Math.max(2, Math.round((a1 - a0) / .55)), dz = 14;
  for (let k = 0; k < n; k++) {
    const x0 = a0 + (a1 - a0) * k / n, x1 = a0 + (a1 - a0) * (k + 1) / n;
    const pts = kind === 'y' ? [S(x0, v, z), S(x1, v, z), S(x1, v + depth, z - dz), S(x0, v + depth, z - dz)] : [S(v, x0, z), S(v, x1, z), S(v + depth, x1, z - dz), S(v + depth, x0, z - dz)];
    polyFS(c, pts, cols[k % cols.length], P.ink, 1);
  }
}
function drawBuilding(c, w, b) {
  const night = nightK(w) > .35, f = b.door.f, H = b.h, t = b.door.t, kx = (b.x0 + b.x1) / 2;
  const sh = S((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2); c.fillStyle = 'rgba(0,0,0,.16)'; groundQuad(c, b.x0 + .25, b.y0 + .25, b.x1 + .6, b.y1 + .6); c.fill();
  const WALL = { taq: ['#fff8ea', '#ebe2d0', '#d7ccb4'], cine: ['#3a3047', '#2b2433', '#20192a'], bou: ['#fbdcea', '#f1bfd5', '#e1a6c1'], tienda: ['#d6b185', '#bf9566', '#a37c50'] };
  if (b.kind === 'casa') { drawHouse(c, w, b); return; }
  const col = WALL[b.kind], body = { top: col[0], left: col[1], right: col[2] };
  isoBox(c, b.x0, b.y0, b.x1, b.y1, 0, H, body, 1.8);
  isoBox(c, b.x0 - .08, b.y0 - .08, b.x1 + .08, b.y1 + .08, H, H + 6, { top: b.kind === 'cine' ? '#4a3d5e' : '#fff', left: '#cfc7b6', right: '#a69e8c' }, 1.5);                  // cornisa
  isoBox(c, b.x0 - .02, b.y0 - .02, b.x1 + .02, b.y1 + .02, 0, 8, { top: '#8d8779', left: '#7c7668', right: '#5f5a50' }, 1.2);                                          // zócalo
  { const rt = col[0]; polyFS(c, [S(b.x0 + .35, b.y0 + .35, H + 6), S(b.x1 - .35, b.y0 + .35, H + 6), S(b.x1 - .35, b.y1 - .35, H + 6), S(b.x0 + .35, b.y1 - .35, H + 6)], shade(rt, -.1), null);       // la azotea: un poco más oscura y con sus aparatos
    const ac = (x, y) => isoBox(c, x, y, x + .9, y + .7, H + 6, H + 17, { top: '#d7dbe6', left: '#aeb4c2', right: '#8a909e' }, 1.2);
    ac(b.x0 + 1.1, b.y0 + .9); ac(b.x1 - 2.4, b.y0 + 1.5);
    const vp = S(b.x0 + 2.6, b.y0 + 2.2, H + 6); c.fillStyle = '#8a909e'; c.strokeStyle = P.ink; c.lineWidth = 1.2; c.beginPath(); c.ellipse(vp.x, vp.y, 6, 3, 0, 0, 6.3); c.fill(); c.stroke(); c.fillStyle = '#6e7480'; c.fillRect(vp.x - 3, vp.y - 9, 6, 9); c.strokeRect(vp.x - 3, vp.y - 9, 6, 9); }
  const a0 = b.x0 + .5, a1 = b.x1 - .5;
  if (b.kind === 'taq') {
    for (let k = 0; k < Math.floor(b.x1 - b.x0); k++) polyFS(c, fq('y', b.y1, b.x0 + k, b.x0 + k + 1, H - 16, H - 11), RAINBOW[k % RAINBOW.length], null);     // la tira de colores del logotipo
    for (let k = 0; k < Math.floor(b.y1 - b.y0); k++) polyFS(c, fq('x', b.x1, b.y0 + k, b.y0 + k + 1, H - 16, H - 11), RAINBOW[(k + 3) % RAINBOW.length], null);
    [[b.x0 + .6, t - 1.2], [t + 1.2, b.x1 - .6]].forEach(([p, q]) => { glassWin(c, 'y', b.y1, p, q, 22, 62, night); });
    glassWin(c, 'x', b.x1, b.y0 + 1, b.y0 + 3, 22, 62, night); glassWin(c, 'x', b.x1, b.y0 + 4.2, b.y0 + 6.4, 22, 62, night);
    awning(c, 'y', b.y1, t - 1.2, t + 1.2, 78, .7, ['#e0364a', '#fff8ea']);
    onFace(c, 'y', b.y1, t - 1.1, 78, () => { txt(c, 'ABIERTO', 1.1 * U, -3, { font: `700 9px ${FONT_UI}`, align: 'center', color: night ? '#7bff9e' : '#2fbf71', ls: .5 }); });
  } else if (b.kind === 'cine') {
    for (const [p, q] of [[b.x0 + .5, t - 1.9], [t + 1.9, b.x1 - .5]]) { const m = (p + q) / 2, wd = (q - p) / 2; polyFS(c, fq('y', b.y1, m - wd + .1, m + wd - .1, 20, 66), '#17121f', P.ink, 1.4); [0, 1].forEach(i => { const u0 = m - wd + .2 + i * (wd * 2 - .4) / 2, u1 = u0 + (wd * 2 - .6) / 2; polyFS(c, fq('y', b.y1, u0, u1, 28, 60), ['#d6342c', '#2b6cd9', '#ffb21e', '#7c3aed'][(i + Math.round(p)) % 4], P.ink, 1); }); }
    glassWin(c, 'x', b.x1, b.y0 + 1, b.y0 + 3.4, 24, 64, false, '#3b2e58'); glassWin(c, 'x', b.x1, b.y0 + 4.6, b.y0 + 7, 24, 64, false, '#3b2e58');
    isoBox(c, t - 2.4, b.y1, t + 2.4, b.y1 + 1, 66, 80, { top: '#e0364a', left: '#c4272f', right: '#8f1c26' }, 1.5);                                                      // marquesina
    for (let k = 0; k < 10; k++) { const u = t - 2.2 + k * .49, p = S(u, b.y1 + 1, 73); c.fillStyle = (k + Math.floor(w.t * 3)) % 2 ? '#fff6b0' : '#ffb21e'; c.beginPath(); c.arc(p.x, p.y, 2.3, 0, 6.3); c.fill(); }
    isoBox(c, t - 2.8, b.y1 - .5, t + 2.8, b.y1 - .3, H + 6, H + 44, { top: '#17121f', left: '#17121f', right: '#0e0a14' }, 1.5);                                    // letrero de neón en el techo
    onFace(c, 'y', b.y1 - .3, t - 2.8, H + 6, () => { c.save(); c.shadowColor = '#ff4fa3'; c.shadowBlur = 14; txt(c, 'CINE', 2.8 * U, -9, { font: `400 34px ${FONT_DISPLAY}`, align: 'center', color: '#ff7ac0', stroke: '#fff', sw: 2.2 }); c.restore(); });
  } else if (b.kind === 'bou') {
    glassWin(c, 'y', b.y1, b.x0 + .3, t - 1.1, 20, 66, night); glassWin(c, 'y', b.y1, t + 1.1, b.x1 - .3, 20, 66, night);
    { const m1 = S((b.x0 + .3 + t - 1.1) / 2, b.y1, 26); c.fillStyle = '#f4e9cf'; c.lineWidth = 1.6; c.strokeStyle = P.ink; c.beginPath(); c.moveTo(m1.x - 8, m1.y + 18); c.lineTo(m1.x - 5, m1.y - 14); c.lineTo(m1.x + 5, m1.y - 14); c.lineTo(m1.x + 8, m1.y + 18); c.closePath(); c.fill(); c.stroke(); drawMask(c, m1.x, m1.y - 22, 8, MASKS.pink);
      const m2 = S((t + 1.1 + b.x1 - .3) / 2, b.y1, 28); drawMask(c, m2.x - 8, m2.y - 4, 7, MASKS.ring); drawMask(c, m2.x + 8, m2.y - 4, 7, MASKS.blue); drawMask(c, m2.x, m2.y + 10, 7, MASKS.black); }
    glassWin(c, 'x', b.x1, b.y0 + .8, b.y0 + 2.6, 22, 62, night); glassWin(c, 'x', b.x1, b.y0 + 3.4, b.y0 + 5.2, 22, 62, night);
    awning(c, 'y', b.y1, b.x0 + .2, b.x1 - .2, 74, .6, ['#ff5fa2', '#fff8ea']);
    isoBox(c, t - 1.5, b.y1 - .4, t + 1.5, b.y1 - .2, H + 6, H + 26, { top: '#ffe0ee', left: '#fff', right: '#e1a6c1' }, 1.5);
    onFace(c, 'y', b.y1 - .2, t - 1.5, H + 6, () => { txt(c, 'BOUTIQUE', 1.5 * U, -6, { font: `400 ${fitDisplay(c, 'BOUTIQUE', 2.7 * U, 20)}px ${FONT_DISPLAY}`, align: 'center', color: '#c4274a', stroke: '#fff', sw: 3 }); });
  } else if (b.kind === 'tienda') {
    c.strokeStyle = 'rgba(90,55,25,.4)'; c.lineWidth = 1; c.beginPath(); for (let z = 14; z < H; z += 10) { const a = S(b.x0, b.y1, z), q = S(b.x1, b.y1, z); c.moveTo(a.x, a.y); c.lineTo(q.x, q.y); const a2 = S(b.x1, b.y1, z), q2 = S(b.x1, b.y0, z); c.moveTo(a2.x, a2.y); c.lineTo(q2.x, q2.y); } c.stroke();
    glassWin(c, 'y', b.y1, b.x0 + .6, t - 1.4, 18, 64, night); glassWin(c, 'y', b.y1, t + 1.4, b.x1 - .6, 18, 64, night);
    { const s1 = S((b.x0 + .6 + t - 1.4) / 2, b.y1, 20); c.fillStyle = '#6b7aa8'; c.lineWidth = 1.6; c.strokeStyle = P.ink; rr(c, s1.x - 17, s1.y - 16, 34, 16, 4); c.fill(); c.stroke(); rr(c, s1.x - 20, s1.y - 10, 7, 12, 3); c.fill(); c.stroke(); rr(c, s1.x + 13, s1.y - 10, 7, 12, 3); c.fill(); c.stroke();
      const s2 = S((t + 1.4 + b.x1 - .6) / 2, b.y1, 20); c.fillStyle = '#d9a066'; rr(c, s2.x - 18, s2.y - 14, 36, 14, 3); c.fill(); c.stroke(); c.fillStyle = '#fff'; rr(c, s2.x - 16, s2.y - 22, 14, 8, 3); c.fill(); c.stroke(); }
    glassWin(c, 'x', b.x1, b.y0 + 1, b.y0 + 3.2, 24, 64, night); glassWin(c, 'x', b.x1, b.y0 + 4.4, b.y0 + 6.6, 24, 64, night);
    awning(c, 'y', b.y1, t - 1.3, t + 1.3, 76, .7, ['#2f8f4e', '#fff8ea']);
    isoBox(c, t - 2.3, b.y1 - .5, t + 2.3, b.y1 - .3, H + 6, H + 40, { top: '#8a5a32', left: '#a8703a', right: '#6d4220' }, 1.5);
    onFace(c, 'y', b.y1 - .3, t - 2.3, H + 6, () => { txt(c, 'MUEBLES', 2.3 * U, -8, { font: `400 ${fitDisplay(c, 'MUEBLES', 4.2 * U, 28)}px ${FONT_DISPLAY}`, align: 'center', color: '#fff3d6', stroke: P.ink, sw: 5 }); txt(c, 'TIENDA', 2.3 * U, -27, { font: `400 12px ${FONT_DISPLAY}`, align: 'center', color: '#ffd24a', stroke: P.ink, sw: 3 }); });
  }
  drawBuildingDoor(c, b, night);
  if (b.kind === 'taq') {                                              // letrero grande sobre el techo con la máscara del logotipo
    isoBox(c, t - 3, b.y1 - .5, t + 3, b.y1 - .3, H + 6, H + 40, { top: '#17171c', left: '#17171c', right: '#0b0a10' }, 1.6);
    onFace(c, 'y', b.y1 - .3, t - 3, H + 6, () => { txt(c, 'TACOS ENMASCARADOS', 3 * U + 10, -11, { font: `400 ${fitDisplay(c, 'TACOS ENMASCARADOS', 5.1 * U, 22)}px ${FONT_DISPLAY}`, align: 'center', color: '#fff8ea', stroke: P.ink, sw: 4 }); for (let k = 0; k < 8; k++) { c.fillStyle = RAINBOW[k]; c.fillRect(3 * U - 3.8 * U + k * .95 * U, -31, .95 * U + .5, 3); } });
    drawMask(c, S(t - 2.6, b.y1 - .3, H + 24).x, S(t - 2.6, b.y1 - .3, H + 24).y, 10, MASKS.ring);
  }
  // flecha dorada que rebota sobre la puerta: ahí se entra
  const dp = S(f === 'y' ? t : b.x1, f === 'y' ? b.y1 : t, 84 + Math.sin(w.t * 5) * 3); c.fillStyle = P.gold; c.strokeStyle = P.ink; c.lineWidth = 2; c.beginPath(); c.moveTo(dp.x - 7, dp.y - 5); c.lineTo(dp.x + 7, dp.y - 5); c.lineTo(dp.x, dp.y + 5); c.closePath(); c.fill(); c.stroke();
}
function drawHouse(c, w, b) {
  const D = houseOf(w, b.id), HH = b.h, ym = (b.y0 + b.y1) / 2, xm = (b.x0 + b.x1) / 2, night = nightK(w) > .35, t = b.door.t, RH = HH + 34;
  const wall = D.fachada, body = { top: wall, left: shade(wall, -.08), right: shade(wall, -.16) };
  isoBox(c, b.x0, b.y0, b.x1, b.y1, 0, HH, body, 1.8);
  isoBox(c, b.x0 - .02, b.y0 - .02, b.x1 + .02, b.y1 + .02, 0, 7, { top: '#8d8779', left: '#7c7668', right: '#5f5a50' }, 1.2);
  glassWin(c, 'x', b.x1, b.y0 + .7, b.y0 + 2.2, 22, 52, night); glassWin(c, 'x', b.x1, b.y1 - 2.2, b.y1 - .7, 22, 52, night);
  glassWin(c, 'y', b.y1, b.x0 + 1, b.x0 + 2.5, 22, 52, night); glassWin(c, 'y', b.y1, xm + .3, xm + 1.8, 22, 52, night);
  for (const [kind, v, a0, a1] of [['x', b.x1, b.y0 + .7, b.y0 + 2.2], ['x', b.x1, b.y1 - 2.2, b.y1 - .7], ['y', b.y1, b.x0 + 1, b.x0 + 2.5]]) { isoBox(c, kind === 'x' ? v : a0 - .05, kind === 'x' ? a0 - .05 : v, kind === 'x' ? v + .12 : a1 + .05, kind === 'x' ? a1 + .05 : v + .12, 16, 21, { top: '#8b5a2b', left: '#6d4423', right: '#54351a' }, 1); }      // jardineras
  // puerta del frente (cara +x) con escalón
  const dv = b.x1, a0 = t - .65, a1 = t + .65;
  isoBox(c, dv, a0 - .2, dv + .5, a1 + .2, 0, 4, { top: '#cfc7b6', left: '#a69e8c', right: '#8d8779' }, 1);
  polyFS(c, fq('x', dv, a0 - .1, a1 + .1, 4, 66), '#f4efe2', P.ink, 1.3); polyFS(c, fq('x', dv, a0, a1, 4, 62), '#8a5a2b', P.ink, 1.4); polyFS(c, fq('x', dv, a0 + .15, a1 - .15, 36, 56), night ? '#ffd58a' : '#a9d9ee', P.ink, 1);
  { const kn = S(dv, t + .38, 30); c.fillStyle = '#ffd24a'; c.beginPath(); c.arc(kn.x, kn.y, 2, 0, 6.3); c.fill(); }
  // techo a dos aguas
  const ov = .45, xo0 = b.x0 - ov, xo1 = b.x1 + ov, yo0 = b.y0 - ov, yo1 = b.y1 + ov;
  polyFS(c, [S(b.x0, b.y1 + .05, HH), S(b.x1, b.y1 + .05, HH), S(xm, b.y1 + .05, RH)], shade(wall, -.04), P.ink, 1.6);               // el triángulo del frente izquierdo
  polyFS(c, [S(xo1, yo0, HH - 4), S(xo1, yo1, HH - 4), S(xm, yo1, RH), S(xm, yo0, RH)], D.roof, P.ink, 1.8);                              // la vertiente que se ve
  polyFS(c, [S(xo1, yo1, HH - 4), S(xm, yo1, RH), S(xm, yo1 + .08, RH + 2), S(xo1, yo1 + .08, HH - 2)], shade(D.roof, -.25), P.ink, 1.2);
  c.strokeStyle = 'rgba(0,0,0,.22)'; c.lineWidth = 1; c.beginPath(); for (let k = 1; k < 5; k++) { const a = S(lerp(xo1, xm, k / 5), yo0, lerp(HH - 4, RH, k / 5)), q = S(lerp(xo1, xm, k / 5), yo1, lerp(HH - 4, RH, k / 5)); c.moveTo(a.x, a.y); c.lineTo(q.x, q.y); } c.stroke();
  isoBox(c, b.x0 + 1.1, b.y0 + .8, b.x0 + 1.7, b.y0 + 1.4, HH + 8, HH + 34, { top: '#8f6a4a', left: '#7c5a3c', right: '#5f4630' }, 1.4);          // chimenea
  // letrero del frente: SE VENDE o MI CASA
  onFace(c, 'x', dv, b.y1 - .5, 82, () => {
    const own = D.own; c.fillStyle = own ? '#14633a' : '#c4272f'; rr(c, 6, -2, 76, 22, 5); c.fill(); c.lineWidth = 2; c.strokeStyle = '#fff'; c.stroke();
    txt(c, own ? 'MI CASA' : 'SE VENDE', 44, 13, { font: `700 14px ${FONT_UI}`, align: 'center', color: '#fff', ls: .8, maxW: 68 });
  });
  if (!D.own) { const pp = S(dv + .5, b.y1 - 1.2, 20); c.fillStyle = '#ffe58a'; c.strokeStyle = P.ink; c.lineWidth = 1.6; rr(c, pp.x - 30, pp.y - 11, 60, 18, 5); c.fill(); c.stroke(); txt(c, pesos(HOUSES[b.id].price), pp.x, pp.y + 2.5, { font: `700 13px ${FONT_UI}`, align: 'center', color: P.ink, maxW: 56 }); }
  const dp = S(dv, t, 78 + Math.sin(w.t * 5) * 3 + 16); c.fillStyle = P.gold; c.strokeStyle = P.ink; c.lineWidth = 2; c.beginPath(); c.moveTo(dp.x - 7, dp.y - 5); c.lineTo(dp.x + 7, dp.y - 5); c.lineTo(dp.x, dp.y + 5); c.closePath(); c.fill(); c.stroke();
}
function drawTownActor(c, w, o, isPlayer) {
  const p = S(o.x, o.y), look = isPlayer ? playerLook(w) : o.look;
  const opts = Object.assign({}, look, { state: o.moving || (o.path && o.path.length) ? 'walk' : 'idle', t: (o.path && o.path.length) ? o.phase : (o.t || w.t), dir: o.dir, scale: isPlayer ? 1.04 : 1 });
  if (isPlayer && w.town.sit) { opts.state = 'eat'; opts.seated = true; opts.tacosLeft = 0; opts.t = w.t; }
  c.fillStyle = 'rgba(0,0,0,.2)'; c.beginPath(); c.ellipse(p.x, p.y + 2, 15, 5, 0, 0, 6.3); c.fill();
  drawLuchador(c, p.x, p.y - (isPlayer && w.town.sit ? 8 : 0), opts);
}
function townSpots() { return TLAMPS.map(([x, y]) => ({ x, y })); }
function drawTown(c, w) {
  const T = w.town, v = tnView(w), nk = nightK(w), h = hourOf(w);
  withTownOrigin(() => {
    c.save(); camApply(c); c.translate(480 - v.sx, 330 - v.sy);
    drawTownGround(c, w); drawFence(c);
    // lista con profundidad: edificios, árboles, faroles, bancas, personas
    const L = [];
    BLD.forEach(b => L.push({ d: b.door.f === 'y' ? (b.x0 + b.x1) / 2 + b.y1 : b.x1 + (b.y0 + b.y1) / 2, draw: () => drawBuilding(c, w, b) }));
    TREES.forEach(([x, y]) => L.push({ d: x + y, draw: () => drawTree(c, x, y) }));
    TLAMPS.forEach(([x, y]) => L.push({ d: x + y, draw: () => drawLamp(c, x, y, w.t) }));
    BENCHES.forEach(b => L.push({ d: b.x + b.y, draw: () => drawTownBench(c, b) }));
    L.push({ d: FOUNTAIN.x + FOUNTAIN.y, draw: () => drawFountain(c, w) }); L.push({ d: 36.4 + 25.4, draw: () => drawSwing(c, 36.4, 25.4) });
    FIELDS.forEach(f => { L.push({ d: f.x0 + f.y0 + 2, draw: () => drawGoal(c, (f.x0 + f.x1) / 2, f.y0 + .25, -1) }); L.push({ d: f.x1 + f.y1 + 2, draw: () => drawGoal(c, (f.x0 + f.x1) / 2, f.y1 - .25, 1) }); });
    T.npcs.forEach(n => L.push({ d: n.x + n.y, draw: () => drawTownActor(c, w, n, false) }));
    L.push({ d: T.x + T.y + .02, draw: () => drawTownActor(c, w, T, true) });
    L.sort((a, b) => a.d - b.d).forEach(i => i.draw());
    if (nk > .02) {                                                    // de noche: todo se oscurece
      const k = skyTint(h); c.fillStyle = `rgba(${Math.round(k[1])},${Math.round(k[2])},${Math.round(k[3])},${(k[4] * .9).toFixed(3)})`; c.fillRect(-4000, -2000, 9000, 6000);
    }
    T.cars.forEach(cr => drawCar(c, cr, w));
    if (nk > .05) townNightLights(c, w, nk);
    drawTownHover(c, w);
    c.restore();
  });
}
function townNightLights(c, w, nk) {
  c.save(); c.globalCompositeOperation = 'lighter';
  BLD.forEach(b => {                                                   // ventanas encendidas
    if (b.kind === 'casa' && !houseOf(w, b.id).own) return;
    const f = b.door.f, v = f === 'y' ? b.y1 : b.x1, a = f === 'y' ? (b.x0 + b.x1) / 2 : (b.y0 + b.y1) / 2, p = S(f === 'y' ? a : v, f === 'y' ? v : a, 40), g = c.createRadialGradient(p.x, p.y, 2, p.x, p.y, 70); g.addColorStop(0, `rgba(255,210,120,${.2 * nk})`); g.addColorStop(1, 'rgba(255,210,120,0)'); c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, 70, 0, 6.3); c.fill();
  });
  const R = 2.6 * TW * .7071;
  townSpots().forEach(sp => {
    const q = S(sp.x, sp.y), hx = q.x, hy = q.y - 84;
    const cg = c.createLinearGradient(hx, hy, hx, q.y); cg.addColorStop(0, `rgba(255,240,170,${.26 * nk})`); cg.addColorStop(1, `rgba(255,224,130,${.08 * nk})`);
    c.fillStyle = cg; c.beginPath(); c.moveTo(hx - 5, hy); c.lineTo(hx + 5, hy); c.lineTo(q.x + R * .6, q.y); c.ellipse(q.x, q.y, R * .6, R * .3, 0, 0, Math.PI, false); c.closePath(); c.fill();
    c.save(); c.translate(q.x, q.y); c.scale(1, .5); const g = c.createRadialGradient(0, 0, 0, 0, 0, R);
    g.addColorStop(0, `rgba(255,228,150,${.5 * nk})`); g.addColorStop(.5, `rgba(255,216,124,${.36 * nk})`); g.addColorStop(.84, `rgba(255,202,104,${.17 * nk})`); g.addColorStop(1, 'rgba(255,200,100,0)');
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, R, 0, 6.3); c.fill(); c.restore();
    const hg = c.createRadialGradient(hx, hy + 4, 1, hx, hy + 4, 30); hg.addColorStop(0, `rgba(255,244,190,${.6 * nk})`); hg.addColorStop(1, 'rgba(255,230,150,0)'); c.fillStyle = hg; c.beginPath(); c.arc(hx, hy + 4, 30, 0, 6.3); c.fill();
  });
  c.restore();
}
const inPoly = (pts, x, y) => { let r = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const a = pts[i], b = pts[j]; if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) r = !r; } return r; };
function townHitBuilding(w, x, y) {                                    // ¿el clic cayó sobre un edificio? (su silueta con la altura del techo y del letrero), del más cercano al más lejano
  const q = camWorld(x, y), v = tnView(w), px = q.x - 480 + v.sx, py = q.y - 330 + v.sy;
  return withTownOrigin(() => {
    const list = BLD.slice().sort((a, b) => (b.x1 + b.y1) - (a.x1 + a.y1));
    for (const b of list) {
      const hh = b.h + (b.kind === 'casa' ? 34 : 44), poly = [S(b.x0, b.y1, 0), S(b.x1, b.y1, 0), S(b.x1, b.y0, 0), S(b.x1, b.y0, hh), S(b.x0, b.y0, hh), S(b.x0, b.y1, hh)];
      if (inPoly(poly, px, py)) return b;
    }
    return null;
  });
}
function drawTownHover(c, w) {
  if (w.modal || w.fade) return;
  const b = townHitBuilding(w, UI.mx, UI.my); if (!b) return;
  UI.cursor = true;
  c.save(); c.lineWidth = 3; c.strokeStyle = 'rgba(255,214,90,.95)'; c.lineJoin = 'round';
  polyFS(c, [S(b.x0, b.y0), S(b.x1, b.y0), S(b.x1, b.y1), S(b.x0, b.y1)], 'rgba(255,214,90,.14)', 'rgba(255,214,90,.95)', 3);
  const tp = S((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, b.h + (b.kind === 'casa' ? 60 : 70)), nm = b.kind === 'casa' && !houseOf(w, b.id).own ? `${b.name} · ${pesos(HOUSES[b.id].price)}` : b.name;
  c.font = `700 15px ${FONT_UI}`; const tw = c.measureText(nm).width + 22;
  c.fillStyle = 'rgba(17,16,20,.9)'; rr(c, tp.x - tw / 2, tp.y - 16, tw, 24, 12); c.fill(); c.lineWidth = 2; c.strokeStyle = P.gold; c.stroke();
  txt(c, nm, tp.x, tp.y + 1, { font: `700 15px ${FONT_UI}`, align: 'center', color: P.cream });
  c.restore();
}

/* ---------- Muebles de las casas (se compran en la tienda de muebles del pueblo) ----------
   fw x fh = losetas que ocupa con rot 0 (con rot 1 se intercambian). El frente de la pieza mira a +y (rot 0) o a +x (rot 1): así siempre se ve por delante.
   use: lo que pasa al tocarla dentro de la casa (sleep = dormir · sit = sentarse a descansar · tv = ver la tele). solid: false = se camina encima (tapetes). */
const HCATS = [['dorm', 'DORMITORIO'], ['sala', 'SALA'], ['cocina', 'COCINA'], ['comedor', 'COMEDOR'], ['oficina', 'OFICINA'], ['deco', 'DECORACIÓN']];
const HF = {
  cama1:   { name: 'Cama individual',    cat: 'dorm',    price: 450,  fw: 1, fh: 2, h: 26, use: 'sleep', desc: 'Para una siesta' },
  cama2:   { name: 'Cama matrimonial',   cat: 'dorm',    price: 1200, fw: 2, fh: 3, h: 34, use: 'sleep', desc: 'Con dos almohadas' },
  buro:    { name: 'Buró con lámpara',   cat: 'dorm',    price: 150,  fw: 1, fh: 1, h: 40, desc: 'Junto a la cama' },
  ropero:  { name: 'Ropero',             cat: 'dorm',    price: 650,  fw: 2, fh: 1, h: 84, desc: 'Dos puertas de madera' },
  sofa2:   { name: 'Sillón de 2 plazas', cat: 'sala',    price: 750,  fw: 2, fh: 1, h: 36, use: 'sit', desc: 'Para descansar' },
  sofa3:   { name: 'Sillón de 3 plazas', cat: 'sala',    price: 1100, fw: 3, fh: 1, h: 36, use: 'sit', desc: 'Para toda la familia' },
  sillon:  { name: 'Sillón individual',  cat: 'sala',    price: 380,  fw: 1, fh: 1, h: 38, use: 'sit', desc: 'Cómodo y chiquito' },
  mesaC:   { name: 'Mesa de centro',     cat: 'sala',    price: 220,  fw: 2, fh: 1, h: 18, desc: 'Para tus revistas' },
  tv:      { name: 'Televisión con mueble', cat: 'sala', price: 900,  fw: 2, fh: 1, h: 52, use: 'tv', desc: 'Pantalla grande: ¡a descansar!' },
  refri:   { name: 'Refrigerador',       cat: 'cocina',  price: 1000, fw: 1, fh: 1, h: 76, desc: 'Blanco, de dos puertas' },
  cocina:  { name: 'Estufa con horno',   cat: 'cocina',  price: 850,  fw: 2, fh: 1, h: 40, desc: 'Cuatro quemadores' },
  fregadero: { name: 'Fregadero',        cat: 'cocina',  price: 600,  fw: 2, fh: 1, h: 40, desc: 'Con llave y gabinetes' },
  lavadora: { name: 'Lavadora',          cat: 'cocina',  price: 750,  fw: 1, fh: 1, h: 42, desc: 'Ropa limpia' },
  comedor: { name: 'Mesa de comedor',    cat: 'comedor', price: 700,  fw: 2, fh: 2, h: 28, desc: 'Cabe toda la familia' },
  silla:   { name: 'Silla de madera',    cat: 'comedor', price: 90,   fw: 1, fh: 1, h: 38, use: 'sit', desc: 'Una silla' },
  escritorio: { name: 'Escritorio con computadora', cat: 'oficina', price: 800, fw: 2, fh: 1, h: 52, desc: 'Para trabajar' },
  librero: { name: 'Librero',            cat: 'oficina', price: 420,  fw: 2, fh: 1, h: 76, desc: 'Lleno de libros' },
  planta:  { name: 'Planta de interior', cat: 'deco',    price: 80,   fw: 1, fh: 1, h: 52, desc: 'Da vida al cuarto' },
  lampara: { name: 'Lámpara de pie',     cat: 'deco',    price: 130,  fw: 1, fh: 1, h: 76, desc: 'Luz cálida' },
  tapete:  { name: 'Tapete de colores',  cat: 'deco',    price: 260,  fw: 3, fh: 2, h: 1,  solid: false, desc: 'Se camina encima' },
  perrera: { name: 'Cama para mascota',  cat: 'deco',    price: 110,  fw: 1, fh: 1, h: 14, desc: 'Para el perrito' },
  acuario: { name: 'Acuario',            cat: 'deco',    price: 1400, fw: 2, fh: 1, h: 56, desc: 'Con peces nadando' }
};
const HOME_WALLS = ['#f1e6d0', '#ffffff', '#cfe3f2', '#cdebd8', '#f6cfdc', '#dcd0f0', '#f7e29a', '#e2b49a', '#b9c9a8', '#c9cdd6', '#3a4a70', '#2b2b33'];
const HOME_FLOORS = {
  madera:  { name: 'Madera naranja', c0: '#c9833f', c1: '#bb7633', plank: true },
  maderaO: { name: 'Madera oscura',  c0: '#7a4a2c', c1: '#6c3f24', plank: true },
  claro:   { name: 'Madera clara',   c0: '#e0c28a', c1: '#d6b57a', plank: true },
  damero:  { name: 'Damero',         c0: '#efe2bf', c1: '#7aa896' },
  baldosa: { name: 'Baldosa gris',   c0: '#c9ccd6', c1: '#b7bbc8' },
  verde:   { name: 'Alfombra verde', c0: '#7bb26a', c1: '#6da45c' }
};
const HOME_FACHADA = ['#e9d8bd', '#ffffff', '#f4c3a1', '#a9d3e8', '#c9e6b3', '#f2b8c9', '#f7e29a', '#c9a27a', '#b7a3d6', '#e9e9ef'];
const HOME_ROOF = ['#b5482f', '#3b5bdb', '#2b2b33', '#2f8f4e', '#e0a42a', '#8b5cf6', '#7a4a2c', '#c4272f'];
const INTER = {
  cine:   { name: 'Cine',                cols: 10, rows: 8, doorC: 8, floor: 'cine',  wall: '#2b2433', trim: '#3d3347' },
  tienda: { name: 'Tienda de muebles',   cols: 11, rows: 8, doorC: 9, floor: 'madera', wall: '#efe3cf', trim: '#ffffff' },
  bou:    { name: 'Boutique Enmascarada', cols: 8, rows: 7, doorC: 6, floor: 'rosa',  wall: '#f6d9e6', trim: '#ffffff' }
};
const roomDef = id => HOUSES[id] || INTER[id];
function roomSetOrigin(R) { OX = 480 - (R.cols - R.rows) * 21; OY = 372 - (R.cols + R.rows) * 10.5; }
function withRoom(w, fn) { const a = OX, b = OY, R = roomDef(w.inId); roomSetOrigin(R); try { return fn(R); } finally { OX = a; OY = b; } }
const cb = col => ({ top: shade(col, .12), left: col, right: shade(col, -.18) });
const bxf = (c, x0, y0, x1, y1, z0, z1, col, lw = 1.3) => isoBox(c, x0, y0, x1, y1, z0, z1, typeof col === 'string' ? cb(col) : col, lw);

/* Cada pieza se dibuja en la caja (x0, y0)-(x1, y1) (ya girada). rot 0: el frente mira a +y; rot 1: mira a +x. */
function drawHF(c, t, x0, y0, x1, y1, rot, w) {
  const f = rot ? 'x' : 'y', front = f === 'y' ? y1 : x1, mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  const tm = w ? w.t : 0;
  switch (t) {
    case 'cama1': case 'cama2': {
      const big = t === 'cama2', col = big ? '#e0527f' : '#4aa3c9', hd = rot ? [x0, y0, x0 + .22, y1] : [x0, y0, x1, y0 + .22];
      bxf(c, x0 + .04, y0 + .04, x1 - .04, y1 - .04, 0, 9, '#8b5a2b');
      bxf(c, hd[0], hd[1], hd[2], hd[3], 0, big ? 40 : 34, '#a8703a');
      bxf(c, x0 + .1, y0 + .1, x1 - .1, y1 - .1, 9, 17, '#f4f1e8');
      const bl = rot ? [x0 + .55, y0 + .1, x1 - .1, y1 - .1] : [x0 + .1, y0 + .55, x1 - .1, y1 - .1];
      bxf(c, bl[0], bl[1], bl[2], bl[3], 17, 22, col);
      const pw = big ? 2 : 1;
      for (let k = 0; k < pw; k++) { const u = (big ? .3 + k * ((rot ? y1 - y0 : x1 - x0) / 2) : .15); const pb = rot ? [x0 + .26, y0 + u, x0 + .52, y0 + u + (big ? .8 : (y1 - y0) - .3)] : [x0 + u, y0 + .26, x0 + u + (big ? .8 : (x1 - x0) - .3), y0 + .52]; bxf(c, pb[0], pb[1], pb[2], pb[3], 17, 23, '#ffffff', 1); }
      break; }
    case 'buro': {
      bxf(c, x0 + .18, y0 + .18, x1 - .18, y1 - .18, 0, 24, '#8b5a2b');
      const p = S(mx, my, 26); c.fillStyle = '#f7e29a'; c.strokeStyle = P.ink; c.lineWidth = 1.4; c.beginPath(); c.moveTo(p.x - 6, p.y); c.lineTo(p.x - 9, p.y - 14); c.lineTo(p.x + 9, p.y - 14); c.lineTo(p.x + 6, p.y); c.closePath(); c.fill(); c.stroke();
      c.save(); c.globalCompositeOperation = 'lighter'; const g = c.createRadialGradient(p.x, p.y - 8, 1, p.x, p.y - 8, 26); g.addColorStop(0, 'rgba(255,230,150,.35)'); g.addColorStop(1, 'rgba(255,230,150,0)'); c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y - 8, 26, 0, 6.3); c.fill(); c.restore();
      break; }
    case 'ropero': {
      bxf(c, x0 + .06, y0 + .06, x1 - .06, y1 - .06, 0, 84, '#8b5a2b');
      const L = rot ? y1 - y0 : x1 - x0, a = rot ? y0 : x0;
      [0, 1].forEach(k => polyFS(c, fq(f, front, a + .08 + k * (L / 2), a + (k + 1) * (L / 2) - .08, 8, 78), '#a8703a', P.ink, 1.2));
      [[.42], [.58]].forEach(([u]) => { const q = S(f === 'y' ? a + L * u : front, f === 'y' ? front : a + L * u + (f === 'x' ? 0 : 0), 44); c.fillStyle = '#ffd24a'; c.beginPath(); c.arc(q.x, q.y, 1.8, 0, 6.3); c.fill(); });
      break; }
    case 'sofa2': case 'sofa3': case 'sillon': {
      const col = t === 'sofa3' ? '#8f9aa6' : t === 'sofa2' ? '#b08a6a' : '#c0586b', back = rot ? [x0, y0, x0 + .3, y1] : [x0, y0, x1, y0 + .3];
      bxf(c, x0 + .04, y0 + .04, x1 - .04, y1 - .04, 0, 14, shade(col, -.18));
      bxf(c, back[0], back[1], back[2], back[3], 14, 36, col);
      const n = t === 'sofa3' ? 3 : t === 'sofa2' ? 2 : 1;
      for (let k = 0; k < n; k++) { const L = rot ? y1 - y0 : x1 - x0, a = rot ? y0 : x0, u0 = a + .22 + k * (L - .44) / n + .03, u1 = a + .22 + (k + 1) * (L - .44) / n - .03; const cu = rot ? [x0 + .3, u0, x1 - .08, u1] : [u0, y0 + .3, u1, y1 - .08]; bxf(c, cu[0], cu[1], cu[2], cu[3], 14, 22, shade(col, .06)); }
      const arm = rot ? [[x0 + .04, y0 + .04, x1 - .04, y0 + .22], [x0 + .04, y1 - .22, x1 - .04, y1 - .04]] : [[x0 + .04, y0 + .04, x0 + .22, y1 - .04], [x1 - .22, y0 + .04, x1 - .04, y1 - .04]];
      arm.forEach(a => bxf(c, a[0], a[1], a[2], a[3], 14, 26, shade(col, -.06)));
      break; }
    case 'mesaC': { bxf(c, x0 + .12, y0 + .16, x1 - .12, y1 - .16, 10, 17, '#a8703a'); for (const [px, py] of [[x0 + .18, y0 + .2], [x1 - .22, y0 + .2], [x0 + .18, y1 - .24], [x1 - .22, y1 - .24]]) bxf(c, px, py, px + .08, py + .08, 0, 10, '#6d4423', 1);
      const p = S(mx - .2, my, 18); c.fillStyle = '#e0364a'; c.strokeStyle = P.ink; c.lineWidth = 1.2; rr(c, p.x - 8, p.y - 3, 16, 5, 1); c.fill(); c.stroke(); c.fillStyle = '#3b82f6'; rr(c, p.x - 4, p.y - 6, 14, 5, 1); c.fill(); c.stroke(); break; }
    case 'tv': {
      bxf(c, x0 + .06, y0 + .1, x1 - .06, y1 - .1, 0, 22, '#6d4423');
      const sc = rot ? [x0 + .16, y0 + .2, x0 + .34, y1 - .2] : [x0 + .2, y0 + .16, x1 - .2, y0 + .34];
      bxf(c, sc[0], sc[1], sc[2], sc[3], 22, 52, '#17171c');
      const q = rot ? fq('x', sc[2], sc[1] + .05, sc[3] - .05, 26, 48) : fq('y', sc[3], sc[0] + .05, sc[2] - .05, 26, 48);
      const k = Math.floor(tm * 1.5) % 4; isoPoly(c, q); c.fillStyle = ['#3b82f6', '#7c3aed', '#14a38b', '#e0527f'][k]; c.fill(); c.strokeStyle = P.ink; c.lineWidth = 1; c.stroke();
      c.save(); c.globalCompositeOperation = 'lighter'; const g0 = q[0], g1 = q[2]; c.fillStyle = 'rgba(255,255,255,.18)'; c.beginPath(); c.moveTo(q[0].x, q[0].y); c.lineTo(q[1].x, q[1].y); c.lineTo(q[2].x, q[2].y); c.closePath(); c.fill(); c.restore();
      break; }
    case 'refri': {
      bxf(c, x0 + .1, y0 + .1, x1 - .1, y1 - .1, 0, 76, '#e8ecf2');
      const a = rot ? y0 + .1 : x0 + .1, b2 = rot ? y1 - .1 : x1 - .1;
      polyFS(c, fq(f, front - .1, a + .04, b2 - .04, 44, 74), '#f4f6fa', P.ink, 1); polyFS(c, fq(f, front - .1, a + .04, b2 - .04, 6, 42), '#f4f6fa', P.ink, 1);
      const hd = S(f === 'y' ? b2 - .12 : front - .1, f === 'y' ? front - .1 : a + .12, 56); c.strokeStyle = '#8a92a4'; c.lineWidth = 2.4; c.lineCap = 'round'; c.beginPath(); c.moveTo(hd.x, hd.y - 8); c.lineTo(hd.x, hd.y + 8); c.stroke();
      const h2 = S(f === 'y' ? b2 - .12 : front - .1, f === 'y' ? front - .1 : a + .12, 24); c.beginPath(); c.moveTo(h2.x, h2.y - 8); c.lineTo(h2.x, h2.y + 8); c.stroke();
      break; }
    case 'cocina': case 'fregadero': {
      bxf(c, x0 + .04, y0 + .06, x1 - .04, y1 - .06, 0, 40, t === 'cocina' ? '#cfd3dc' : '#b7794b');
      const a = rot ? y0 : x0, L = rot ? y1 - y0 : x1 - x0;
      if (t === 'cocina') {
        for (const [u, v] of [[.3, .3], [.7, .3], [.3, .7], [.7, .7]]) { const p = S(rot ? x0 + .5 + (v - .5) * .6 : x0 + L * u, rot ? y0 + L * u : y0 + .5 + (v - .5) * .6, 41); c.fillStyle = '#2b2d36'; c.strokeStyle = P.ink; c.lineWidth = 1.2; c.beginPath(); c.ellipse(p.x, p.y, 7, 3.5, 0, 0, 6.3); c.fill(); c.stroke(); c.strokeStyle = '#ff6a2a'; c.beginPath(); c.ellipse(p.x, p.y, 4.5, 2.2, 0, 0, 6.3); c.stroke(); }
        polyFS(c, fq(f, front - .06, a + .14, a + L - .14, 6, 26), '#2b2d36', P.ink, 1.2); polyFS(c, fq(f, front - .06, a + .22, a + L - .22, 12, 22), 'rgba(255,200,120,.45)', null);
      } else {
        const p = S(rot ? x0 + .5 : x0 + L * .5, rot ? y0 + L * .5 : y0 + .5, 41); c.fillStyle = '#9ac3dc'; c.strokeStyle = P.ink; c.lineWidth = 1.4; c.beginPath(); c.ellipse(p.x, p.y, 13, 6, 0, 0, 6.3); c.fill(); c.stroke();
        c.strokeStyle = '#aab0bf'; c.lineWidth = 3; c.lineCap = 'round'; c.beginPath(); c.moveTo(p.x + 12, p.y - 4); c.lineTo(p.x + 12, p.y - 16); c.lineTo(p.x + 6, p.y - 18); c.stroke();
        [0, 1].forEach(k => polyFS(c, fq(f, front - .06, a + .1 + k * L / 2, a + (k + 1) * L / 2 - .1, 6, 36), '#c98b4e', P.ink, 1));
      }
      bxf(c, x0 + .02, y0 + .04, x1 - .02, y1 - .04, 40, 43, '#f4f1e8', 1.2);
      break; }
    case 'lavadora': { bxf(c, x0 + .1, y0 + .1, x1 - .1, y1 - .1, 0, 42, '#f0f2f6'); const p = S(f === 'y' ? mx : front - .1, f === 'y' ? front - .1 : my, 22); c.fillStyle = '#7fb8d9'; c.strokeStyle = P.ink; c.lineWidth = 1.6; c.beginPath(); c.ellipse(p.x, p.y, 9, 9, 0, 0, 6.3); c.fill(); c.stroke(); c.fillStyle = 'rgba(255,255,255,.6)'; c.beginPath(); c.arc(p.x - 3, p.y - 3, 2.4, 0, 6.3); c.fill(); break; }
    case 'comedor': { bxf(c, x0 + .1, y0 + .1, x1 - .1, y1 - .1, 22, 28, '#d9a066'); bxf(c, x0 + .3, y0 + .3, x1 - .3, y1 - .3, 28, 28.5, '#fff4e6', .8); for (const [px, py] of [[x0 + .16, y0 + .16], [x1 - .26, y0 + .16], [x0 + .16, y1 - .26], [x1 - .26, y1 - .26]]) bxf(c, px, py, px + .1, py + .1, 0, 22, '#8b5a2b', 1); const p = S(mx, my, 29); c.fillStyle = '#e0364a'; c.beginPath(); c.arc(p.x, p.y - 4, 4, 0, 6.3); c.fill(); c.fillStyle = '#2fbf71'; c.beginPath(); c.arc(p.x - 3, p.y - 7, 3, 0, 6.3); c.fill(); break; }
    case 'silla': { const bk = rot ? [x0 + .16, y0 + .2, x0 + .26, y1 - .2] : [x0 + .2, y0 + .16, x1 - .2, y0 + .26]; bxf(c, x0 + .2, y0 + .2, x1 - .2, y1 - .2, 12, 18, '#d9a066'); bxf(c, bk[0], bk[1], bk[2], bk[3], 18, 40, '#a8703a'); for (const [px, py] of [[x0 + .22, y0 + .22], [x1 - .3, y0 + .22], [x0 + .22, y1 - .3], [x1 - .3, y1 - .3]]) bxf(c, px, py, px + .08, py + .08, 0, 12, '#6d4423', 1); break; }
    case 'escritorio': {
      bxf(c, x0 + .06, y0 + .1, x1 - .06, y1 - .1, 18, 24, '#b7794b'); for (const [px, py] of [[x0 + .1, y0 + .14], [x1 - .18, y0 + .14], [x0 + .1, y1 - .22], [x1 - .18, y1 - .22]]) bxf(c, px, py, px + .08, py + .08, 0, 18, '#8b5a2b', 1);
      const L = rot ? y1 - y0 : x1 - x0, mb = rot ? [x0 + .16, y0 + L * .3, x0 + .3, y0 + L * .7] : [x0 + L * .3, y0 + .16, x0 + L * .7, y0 + .3];
      bxf(c, mb[0], mb[1], mb[2], mb[3], 24, 44, '#23252c'); const q = rot ? fq('x', mb[2], mb[1] + .03, mb[3] - .03, 28, 42) : fq('y', mb[3], mb[0] + .03, mb[2] - .03, 28, 42); polyFS(c, q, '#5fb0e8', P.ink, 1);
      const kb = rot ? [x0 + .5, y0 + L * .34, x0 + .78, y0 + L * .66] : [x0 + L * .34, y0 + .5, x0 + L * .66, y0 + .78]; bxf(c, kb[0], kb[1], kb[2], kb[3], 24, 26, '#d7dbe6', 1);
      break; }
    case 'librero': {
      bxf(c, x0 + .06, y0 + .06, x1 - .06, y1 - .06, 0, 76, '#8b5a2b'); const a = rot ? y0 : x0, L = rot ? y1 - y0 : x1 - x0;
      for (let k = 0; k < 4; k++) { const z0 = 6 + k * 17; polyFS(c, fq(f, front - .04, a + .1, a + L - .1, z0, z0 + 14), '#4a2f18', null); const n = 9; for (let b = 0; b < n; b++) { const u0 = a + .12 + b * (L - .24) / n; polyFS(c, fq(f, front - .04, u0, u0 + (L - .24) / n - .02, z0, z0 + 8 + (b * 7 % 5)), ['#e0364a', '#3b82f6', '#ffc83d', '#2fbf71', '#8b5cf6', '#ff8a3d'][(b + k * 2) % 6], P.ink, .6); } }
      break; }
    case 'planta': { bxf(c, x0 + .3, y0 + .3, x1 - .3, y1 - .3, 0, 14, '#c4492a'); const p = S(mx, my, 14); c.lineWidth = 1.6; c.strokeStyle = P.ink; [[0, -26, 12, '#2f8f4e'], [-9, -18, 10, '#3aa35a'], [9, -17, 10, '#2a7d44'], [2, -34, 8, '#46b868']].forEach(([dx, dy, r, col]) => { c.fillStyle = col; c.beginPath(); c.arc(p.x + dx, p.y + dy, r, 0, 6.3); c.fill(); c.stroke(); }); break; }
    case 'lampara': { bxf(c, x0 + .36, y0 + .36, x1 - .36, y1 - .36, 0, 5, '#3a3a44'); const p = S(mx, my, 5), top = S(mx, my, 62); c.strokeStyle = '#3a3a44'; c.lineWidth = 3; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(top.x, top.y); c.stroke(); c.fillStyle = '#ffe58a'; c.strokeStyle = P.ink; c.lineWidth = 1.6; c.beginPath(); c.moveTo(top.x - 7, top.y); c.lineTo(top.x - 12, top.y - 16); c.lineTo(top.x + 12, top.y - 16); c.lineTo(top.x + 7, top.y); c.closePath(); c.fill(); c.stroke();
      c.save(); c.globalCompositeOperation = 'lighter'; const g = c.createRadialGradient(top.x, top.y - 8, 1, top.x, top.y - 8, 44); g.addColorStop(0, 'rgba(255,230,150,.4)'); g.addColorStop(1, 'rgba(255,230,150,0)'); c.fillStyle = g; c.beginPath(); c.arc(top.x, top.y - 8, 44, 0, 6.3); c.fill(); c.restore(); break; }
    case 'tapete': { polyFS(c, [S(x0 + .05, y0 + .05, 1), S(x1 - .05, y0 + .05, 1), S(x1 - .05, y1 - .05, 1), S(x0 + .05, y1 - .05, 1)], '#b8324a', P.ink, 1.4); polyFS(c, [S(x0 + .25, y0 + .25, 1.2), S(x1 - .25, y0 + .25, 1.2), S(x1 - .25, y1 - .25, 1.2), S(x0 + .25, y1 - .25, 1.2)], '#f4e3b8', 'rgba(60,30,20,.5)', 1); const p = S(mx, my, 1.6); c.save(); c.translate(p.x, p.y); c.scale(1, .5); drawMask(c, 0, 0, 16, MASKS.ring); c.restore(); break; }
    case 'perrera': { const p = S(mx, my, 3); c.fillStyle = '#9a6a45'; c.strokeStyle = P.ink; c.lineWidth = 1.6; c.beginPath(); c.ellipse(p.x, p.y + 4, 19, 9, 0, 0, 6.3); c.fill(); c.stroke(); c.fillStyle = '#d9b48a'; c.beginPath(); c.ellipse(p.x, p.y, 14, 6.5, 0, 0, 6.3); c.fill(); c.stroke(); c.fillStyle = '#7a5a3a'; c.beginPath(); c.ellipse(p.x + 3, p.y - 3, 5, 3, 0, 0, 6.3); c.fill(); break; }
    case 'acuario': {
      bxf(c, x0 + .06, y0 + .12, x1 - .06, y1 - .12, 0, 20, '#3a3a44');
      isoBox(c, x0 + .1, y0 + .16, x1 - .1, y1 - .16, 20, 54, { top: 'rgba(160,220,250,.35)', left: 'rgba(110,190,235,.5)', right: 'rgba(80,160,215,.5)' }, 1.4);
      for (let k = 0; k < 3; k++) { const ph = (tm * .35 + k * .33) % 1, fx = lerp(x0 + .25, x1 - .25, rot ? .5 : ph), fy = lerp(y0 + .25, y1 - .25, rot ? ph : .5), p = S(fx, fy, 30 + k * 6); c.fillStyle = ['#ff8a3d', '#ffd23a', '#ff5fa2'][k]; c.strokeStyle = P.ink; c.lineWidth = 1; c.beginPath(); c.ellipse(p.x, p.y, 5, 3, 0, 0, 6.3); c.fill(); c.stroke(); c.beginPath(); c.moveTo(p.x - 5, p.y); c.lineTo(p.x - 9, p.y - 3); c.lineTo(p.x - 9, p.y + 3); c.closePath(); c.fill(); c.stroke(); }
      bxf(c, x0 + .1, y0 + .16, x1 - .1, y1 - .16, 54, 58, '#3a3a44');
      break; }
  }
}
const hfBox = (it, d) => { const D = HF[it.t], fw = it.rot ? D.fh : D.fw, fh = it.rot ? D.fw : D.fh; return { x0: it.c, y0: it.r, x1: it.c + fw, y1: it.r + fh, h: D.h }; };
function drawFurnPreview(c, t, cx, cy, sc, w) {                         // el mueble chiquito para las listas
  const D = HF[t], a = OX, b = OY; OX = 0; OY = 0;
  c.save(); c.translate(cx, cy + 14); c.scale(sc, sc); const q = S(D.fw / 2, D.fh / 2); c.translate(-q.x, -q.y);
  try { c.lineJoin = 'round'; drawHF(c, t, 0, 0, D.fw, D.fh, 0, w); } finally { c.restore(); OX = a; OY = b; }
}

/* ---------- Interiores: el cuarto se ve como un diorama, con sus dos paredes y el piso (igual que el local) ---------- */
const HFLOOR_EXTRA = { cine: { c0: '#4f3223', c1: '#5a3a28', plank: true }, rosa: { c0: '#f3c9dd', c1: '#ecbcd2' } };
function floorDefOf(w, id) { if (HOUSES[id]) return HOME_FLOORS[houseOf(w, id).floor] || HOME_FLOORS.madera; const f = INTER[id].floor; return HOME_FLOORS[f] || HFLOOR_EXTRA[f] || HOME_FLOORS.madera; }
const wallOf = (w, id) => HOUSES[id] ? houseOf(w, id).wall : INTER[id].wall;
const CASH_LOOKS = {
  cine:   { casual: true, gender: 'f', hairStyle: 'pony', hairColor: '#2b1a10', hoodie: '#c4272f', pants: '#17171c', shoes: 'negro', skin: '#e0ac69', hat: 'cocinera', hatCol: '#c4272f', label: ['CINE', 'ENMASC.'] },
  tienda: { casual: true, gender: 'm', hairStyle: 'crop', hairColor: '#2b2018', hoodie: '#d94a3a', pants: '#2d3550', shoes: 'negro', skin: '#c68642', stache: true, label: ['TIENDA', 'MUEBLES'] },
  bou:    { casual: true, gender: 'f', hairStyle: 'long', hairColor: '#6b3a1f', hoodie: '#e8509a', pants: '#2d3550', shoes: 'blanco', skin: '#f1c27d', label: ['BOUTIQUE', 'ENM.'] }
};
const ROOM_CACHE = {};
function roomStatic(id) {                                              // lo que hay fijo en cada edificio (no cambia nunca)
  if (ROOM_CACHE[id]) return ROOM_CACHE[id];
  const it = [], add = o => { it.push(o); return o; };
  const counter = (x0, x1, label, act) => add({ k: 'counter', x0, y0: .15, x1, y1: 1.25, h: 38, solid: true, act, stand: [[Math.floor((x0 + x1) / 2), 2]], draw: (c, w) => {
    bxf(c, x0, .15, x1, 1.25, 0, 38, { top: '#e8d9b0', left: '#7a4a2a', right: '#5a331c' }, 1.6);
    polyFS(c, fq('y', 1.25, x0 + .15, x1 - .15, 6, 26), '#4a2a16', P.ink, 1.2); polyFS(c, fq('y', 1.25, x0 + .15, x1 - .15, 30, 33), '#ffc83d', P.ink, 1);
    const rg = S((x0 + x1) / 2 + .6, .55, 40); c.fillStyle = '#2b2d36'; c.strokeStyle = P.ink; c.lineWidth = 1.4; rr(c, rg.x - 11, rg.y - 12, 22, 11, 2); c.fill(); c.stroke(); c.fillStyle = '#7bff9e'; c.fillRect(rg.x - 8, rg.y - 10, 12, 4); } });
  const person = (x, y, look) => add({ k: 'person', x, y, look, draw: null });
  if (id === 'cine') {
    counter(4.3, 7.7, 'TAQUILLA', { type: 'ticket' }); person(6, .62, CASH_LOOKS.cine);
    add({ k: 'popcorn', x0: 2.9, y0: .2, x1: 4.0, y1: 1.1, h: 60, solid: true, act: { type: 'popcorn' }, stand: [[3, 2]], draw: (c, w) => {
      bxf(c, 2.9, .2, 4.0, 1.1, 0, 26, '#c4272f'); bxf(c, 3.0, .26, 3.9, 1.04, 26, 30, '#ffd23a');
      isoBox(c, 3.0, .26, 3.9, 1.04, 30, 62, { top: 'rgba(255,255,255,.35)', left: 'rgba(255,240,200,.45)', right: 'rgba(255,220,150,.45)' }, 1.4);
      for (let k = 0; k < 14; k++) { const p = S(3.1 + (k % 5) * .17, .34 + Math.floor(k / 5) * .22, 34 + (k * 7 % 18)); c.fillStyle = '#fff6d0'; c.strokeStyle = P.ink; c.lineWidth = .8; c.beginPath(); c.arc(p.x, p.y, 3.4, 0, 6.3); c.fill(); c.stroke(); } } });
    for (let rw = 0; rw < 3; rw++) for (let k = 0; k < 5; k++) add({ k: 'seat', c: 3 + rw * 2, r: 3 + k, x0: 3 + rw * 2, y0: 3 + k, x1: 4 + rw * 2, y1: 4 + k, h: 36, solid: false, act: { type: 'seat' }, stand: [[3 + rw * 2, 3 + k]], draw: (c, w, o) => {
      bxf(c, o.x0 + .12, o.y0 + .12, o.x1 - .12, o.y1 - .12, 0, 12, '#7a1a22'); bxf(c, o.x0 + .12, o.y0 + .12, o.x0 + .34, o.y1 - .12, 12, 38, '#b8242e');
      bxf(c, o.x0 + .34, o.y0 + .06, o.x1 - .12, o.y0 + .2, 12, 22, '#8f1c26'); bxf(c, o.x0 + .34, o.y1 - .2, o.x1 - .12, o.y1 - .06, 12, 22, '#8f1c26'); } });
    [3, 7, 11, 12].forEach((s, i) => { const rw = Math.floor(s / 5), k = s % 5; person(3 + rw * 2 + .5, 3 + k + .5, Object.assign(randomLookSeed(i + 5), {}), true).seated = true; });
  } else if (id === 'tienda') {
    counter(5.2, 8.6, 'CAJA', { type: 'catalog' }); person(6.9, .62, CASH_LOOKS.tienda);
    [[1.2, 3.4], [3.9, 6.1]].forEach(([a, b], i) => add({ k: 'shelf', x0: .15, y0: a, x1: .95, y1: b, h: 64, solid: true, act: { type: 'catalog' }, stand: [[1, Math.floor((a + b) / 2)]], draw: (c, w, o) => {
      bxf(c, o.x0, o.y0, o.x1, o.y1, 0, 64, '#c8ced8'); for (let z = 14; z < 60; z += 15) polyFS(c, fq('y', o.y1, o.x0 + .06, o.x1 - .06, z, z + 2), '#8d95a4', null);
      [['#e0527f', 20], ['#4a90d9', 35], ['#ffc83d', 50]].forEach(([col, z], j) => { const p = S(o.x0 + .5, o.y1, z); c.fillStyle = col; c.strokeStyle = P.ink; c.lineWidth = 1.2; rr(c, p.x - 9 + j * 3, p.y - 9, 16, 9, 2); c.fill(); c.stroke(); });
      const lp = S(o.x0 + .4, o.y0 + .5, 66); c.fillStyle = '#ffd24a'; c.strokeStyle = P.ink; c.beginPath(); c.moveTo(lp.x - 5, lp.y); c.lineTo(lp.x - 8, lp.y - 9); c.lineTo(lp.x + 8, lp.y - 9); c.lineTo(lp.x + 5, lp.y); c.closePath(); c.fill(); c.stroke(); } }));
    [['cama2', 2, 4, 0], ['sofa3', 5, 3, 0], ['tapete', 5, 4, 0], ['mesaC', 6, 4, 0], ['comedor', 8, 5, 0], ['planta', 10, 6, 0], ['planta', 1, 7, 0], ['lampara', 4, 2, 0], ['silla', 7, 6, 0]].forEach(([t, c0, r0, rot]) => { const D = HF[t]; add({ k: 'display', t, x0: c0, y0: r0, x1: c0 + D.fw, y1: r0 + D.fh, h: D.h, solid: D.solid !== false, act: { type: 'catalog' }, stand: [], draw: (c, w, o) => drawHF(c, t, o.x0, o.y0, o.x1, o.y1, rot, w) }); });
  } else if (id === 'bou') {
    counter(2.4, 5.4, 'CAJA', { type: 'boutique' }); person(3.9, .62, CASH_LOOKS.bou);
    [[2.4, 4.4], [5, 7]].forEach(([a, b]) => add({ k: 'rack', x0: .3, y0: a, x1: .9, y1: b, h: 64, solid: true, act: { type: 'boutique' }, stand: [[1, Math.floor((a + b) / 2)]], draw: (c, w, o) => {
      const l1 = S(o.x0 + .3, o.y0 + .1, 0), l2 = S(o.x0 + .3, o.y1 - .1, 0), t1 = S(o.x0 + .3, o.y0 + .1, 60), t2 = S(o.x0 + .3, o.y1 - .1, 60);
      c.strokeStyle = '#c9ced8'; c.lineWidth = 3; c.lineCap = 'round'; c.beginPath(); c.moveTo(l1.x, l1.y); c.lineTo(t1.x, t1.y); c.moveTo(l2.x, l2.y); c.lineTo(t2.x, t2.y); c.moveTo(t1.x, t1.y); c.lineTo(t2.x, t2.y); c.stroke();
      ['#d6342c', '#3b5bdb', '#ffb21e', '#7c3aed', '#14a38b', '#e8509a'].forEach((col, j) => { const q = S(o.x0 + .3, o.y0 + .3 + j * ((o.y1 - o.y0 - .6) / 5), 60); c.fillStyle = col; c.strokeStyle = P.ink; c.lineWidth = 1.3; c.beginPath(); c.moveTo(q.x - 4, q.y); c.lineTo(q.x + 4, q.y); c.lineTo(q.x + 7, q.y + 24); c.lineTo(q.x - 7, q.y + 24); c.closePath(); c.fill(); c.stroke(); }); } }));
    [[4.2, 3.9, 'ring', '#3b5bdb'], [5.9, 4.7, 'pink', '#ffb21e']].forEach(([x, y, mk, hd]) => add({ k: 'mannequin', x0: x - .3, y0: y - .3, x1: x + .3, y1: y + .3, h: 82, solid: true, act: { type: 'boutique' }, stand: [], draw: (c, w, o) => {
      const p = S(x, y, 0); c.fillStyle = '#6b6580'; c.strokeStyle = P.ink; c.lineWidth = 1.6; c.beginPath(); c.ellipse(p.x, p.y, 15, 6, 0, 0, 6.3); c.fill(); c.stroke();
      const b = S(x, y, 4); c.strokeStyle = '#8f89a6'; c.lineWidth = 3; c.beginPath(); c.moveTo(b.x, b.y); c.lineTo(b.x, b.y - 24); c.stroke();
      c.fillStyle = hd; rr(c, b.x - 13, b.y - 54, 26, 32, 8); c.fill(); c.lineWidth = 1.8; c.strokeStyle = P.ink; c.stroke(); drawMask(c, b.x, b.y - 66, 11, MASKS[mk]); } }));
  }
  ROOM_CACHE[id] = it; return it;
}
function randomLookSeed(i) { const st = Math.random; let s = (i * 7919 + 13) >>> 0; Math.random = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; try { return randomLook(); } finally { Math.random = st; } }
function roomItems(w, id) {                                            // fijo + lo que el jugador puso (en las casas)
  const base = roomStatic(id).filter(o => o.k !== 'person');
  if (!HOUSES[id]) return base;
  const D = houseOf(w, id), out = [];
  D.furn.forEach((f, i) => { const b = hfBox(f), H = HF[f.t]; out.push({ k: 'hf', f, i, t: f.t, x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1, h: H.h, solid: H.solid !== false, act: H.use ? { type: 'use', use: H.use } : null, stand: null, draw: (c, ww) => drawHF(c, f.t, b.x0, b.y0, b.x1, b.y1, f.rot, ww) }); });
  return out;
}
const rbox = o => ({ x0: S(o.x0, o.y1).x - 3, x1: S(o.x1, o.y0).x + 3, y0: S(o.x0, o.y0, o.h + 8).y - 3, y1: S(o.x1, o.y1).y + 3 });
function roomBlocked(w, c, r) {
  const R = roomDef(w.inId); if (c < 0 || r < 0 || c >= R.cols || r >= R.rows) return true;
  return roomItems(w, w.inId).some(o => o.solid && c + .5 > o.x0 && c + .5 < o.x1 && r + .5 > o.y0 && r + .5 < o.y1);
}
const roomStands = (w, o) => {                                         // desde dónde se usa una pieza: las losetas libres que la rodean
  if (o.stand && o.stand.length) return o.stand.filter(s => !roomBlocked(w, s[0], s[1]) || (o.k === 'seat'));
  const out = [], x0 = Math.floor(o.x0), x1 = Math.ceil(o.x1), y0 = Math.floor(o.y0), y1 = Math.ceil(o.y1);
  for (let c = x0 - 1; c <= x1; c++) for (let r = y0 - 1; r <= y1; r++) { const inside = c >= x0 && c < x1 && r >= y0 && r < y1; const adj = (c >= x0 && c < x1) !== (r >= y0 && r < y1); if (!inside && adj && !roomBlocked(w, c, r)) out.push([c, r]); }
  return out;
};
function newRoom(w, id) {
  const R = roomDef(id);
  return { id, x: R.doorC + .5, y: 1.5, dir: -1, phase: 0, moving: false, speed: 3.8, path: [], intent: null, seat: null, anim: null, t: 0, hint: '', ticket: false, popcorn: false, viewers: [] };
}
function roomPathTo(w, goals) { const I = w.inn, R = roomDef(w.inId); return bfsPath(R.cols, R.rows, (c, r) => roomBlocked(w, c, r), I.x, I.y, goals); }
function roomGoTo(w, cell, intent) {
  const I = w.inn, p = roomPathTo(w, [cell]); if (!p) { sfx('nope'); return false; }
  I.path = p.map(q => ({ x: q.c + .5, y: q.r + .5 })); I.intent = intent || null; I.seat = null; if (I.anim && I.anim.cancel !== false) I.anim = null; sfx('click'); return true;
}

// ---- dibujo del cuarto
function drawRoomShell(c, w, id) {
  const R = roomDef(id), cols = R.cols, rows = R.rows, WH = 108, F = floorDefOf(w, id), wall = wallOf(w, id), trim = R.trim || '#ffffff', dark = shade(wall, -.12), isH = !!HOUSES[id], D = isH ? houseOf(w, id) : null;
  polyFS(c, [S(cols, 0, 0), S(cols, rows, 0), S(cols, rows, -16), S(cols, 0, -16)], '#54382a', P.ink, 2); polyFS(c, [S(0, rows, 0), S(cols, rows, 0), S(cols, rows, -16), S(0, rows, -16)], '#76503a', P.ink, 2);
  c.lineJoin = 'round'; c.lineWidth = 1; c.strokeStyle = 'rgba(40,24,12,.35)';
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const p = [S(i, j), S(i + 1, j), S(i + 1, j + 1), S(i, j + 1)]; isoPoly(c, p); c.fillStyle = (i + j) & 1 ? F.c1 : F.c0; c.fill(); c.stroke();
    if (F.plank) { c.strokeStyle = 'rgba(60,30,10,.28)'; c.beginPath(); for (const v of [.34, .67]) { const a = { x: p[0].x + (p[3].x - p[0].x) * v, y: p[0].y + (p[3].y - p[0].y) * v }, b = { x: p[1].x + (p[2].x - p[1].x) * v, y: p[1].y + (p[2].y - p[1].y) * v }; c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); } c.stroke(); c.strokeStyle = 'rgba(40,24,12,.35)'; }
  }
  if (id === 'cine') { polyFS(c, [S(2.2, 2.4), S(9.8, 2.4), S(9.8, 8), S(2.2, 8)], 'rgba(150,20,35,.28)', null); }
  // paredes: la derecha (y = 0) y la izquierda (x = 0), con su grosor y moldura blanca
  polyFS(c, [S(0, 0, 0), S(cols, 0, 0), S(cols, 0, WH), S(0, 0, WH)], wall, P.ink, 2); polyFS(c, [S(0, 0, 0), S(0, rows, 0), S(0, rows, WH), S(0, 0, WH)], dark, P.ink, 2);
  polyFS(c, [S(0, 0, 0), S(cols, 0, 0), S(cols, 0, 9), S(0, 0, 9)], shade(wall, -.22), null); polyFS(c, [S(0, 0, 0), S(0, rows, 0), S(0, rows, 9), S(0, 0, 9)], shade(dark, -.2), null);
  if (id === 'cine') { c.save(); c.globalCompositeOperation = 'lighter'; c.lineWidth = 4; c.strokeStyle = 'rgba(255,79,163,.85)'; c.beginPath(); const a = S(0, 0, 10), b = S(cols, 0, 10); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); c.strokeStyle = 'rgba(95,232,255,.85)'; c.beginPath(); const d = S(0, rows, 10); c.moveTo(a.x, a.y); c.lineTo(d.x, d.y); c.stroke(); c.restore(); }
  isoBox(c, 0, -.22, cols, 0, WH - 5, WH, { top: trim, left: shade(trim, -.08), right: shade(trim, -.18) }, 1.6); isoBox(c, -.22, 0, 0, rows, WH - 5, WH, { top: trim, left: shade(trim, -.08), right: shade(trim, -.18) }, 1.6); isoBox(c, -.22, -.22, 0, 0, 0, WH, { top: trim, left: shade(trim, -.08), right: shade(trim, -.18) }, 1.6);
  // la puerta (en la pared derecha)
  const d0 = R.doorC, d1 = d0 + 1.4;
  polyFS(c, fq('y', 0, d0 - .08, d1 + .08, 0, 92), '#f4efe2', P.ink, 1.6); polyFS(c, fq('y', 0, d0, d0 + .7, 0, 88), '#7a4d28', P.ink, 1.4); polyFS(c, fq('y', 0, d0 + .7, d1, 0, 88), '#8a5a2b', P.ink, 1.4);
  polyFS(c, fq('y', 0, d0 + .12, d0 + .58, 44, 80), '#a9d9ee', P.ink, 1); polyFS(c, fq('y', 0, d0 + .82, d1 - .12, 44, 80), '#a9d9ee', P.ink, 1);
  { const hd = S(d0 + .6, 0, 40); c.fillStyle = '#ffd24a'; c.beginPath(); c.arc(hd.x, hd.y, 2.2, 0, 6.3); c.fill(); }
  onFace(c, 'y', 0, d0 - .15, 106, () => { c.fillStyle = '#14633a'; rr(c, 0, -6, 1.7 * U, 17, 4); c.fill(); c.lineWidth = 1.6; c.strokeStyle = '#fff'; c.stroke(); txt(c, isH ? 'CASA' : 'SALIDA', .85 * U, 6.5, { font: `700 11px ${FONT_UI}`, align: 'center', color: '#fff', ls: 1 }); });
  // lo que cuelga de las paredes
  if (isH) {
    if (D.cuadros) {
      [[1.4, 2.8], [cols - 3.4, cols - 2]].forEach(([a, b]) => { if (b < d0 - .2 || a > d1 + .2) { polyFS(c, fq('y', 0, a - .1, b + .1, 46, 82), '#7a4a2a', P.ink, 1.3); polyFS(c, fq('y', 0, a, b, 50, 78), '#9ad0e8', null); const q = fq('y', 0, a, b, 50, 66); polyFS(c, [q[0], q[1], S((a + b) / 2 + .2, 0, 62), S(a + .2, 0, 60)], '#5aa65a', null); } });
      polyFS(c, fq('x', 0, 1.2, 2.6, 46, 82), '#7a4a2a', P.ink, 1.3); polyFS(c, fq('x', 0, 1.3, 2.5, 50, 78), '#f4c26b', null); { const q = fq('x', 0, 1.3, 2.5, 50, 64); polyFS(c, q, '#e0527f', null); }
    }
    polyFS(c, fq('x', 0, rows - 2.4, rows - .9, 36, 88), '#f4efe2', P.ink, 1.5); polyFS(c, fq('x', 0, rows - 2.3, rows - 1, 40, 84), '#9ad0e8', P.ink, 1); polyFS(c, fq('x', 0, rows - 2.3, rows - 1.65, 40, 84), 'rgba(255,255,255,.25)', null);       // ventana
  } else if (id === 'cine') {
    for (const [a, b] of [[1.1, 2.6], [3.2, 4.7], [8.6, 9.7].map(v => v)]) { /* pósters de la pared derecha (no tapan la puerta) */ }
    [[.5, 1.7], [1.9, 3.1]].forEach(([a, b], i) => { polyFS(c, fq('y', 0, a, b, 36, 90), '#17121f', P.ink, 1.4); polyFS(c, fq('y', 0, a + .08, b - .08, 42, 84), ['#c4272f', '#2b6cd9'][i], null); polyFS(c, fq('y', 0, a + .2, b - .2, 52, 74), ['#ffd24a', '#7cf0ff'][i], null); });
    polyFS(c, fq('y', 0, 7.2, 8.0, 36, 90), '#17121f', P.ink, 1.4); polyFS(c, fq('y', 0, 7.28, 7.92, 42, 84), '#7c3aed', null);
    const sc = fq('x', 0, 1.2, 6.8, 26, 96), k = Math.floor(w.t * .8) % 4;                       // la pantalla grande en la pared izquierda
    polyFS(c, sc, '#e9eef7', P.ink, 2); const pr = w.inn && w.inn.anim && w.inn.anim.type === 'movie';
    const cols2 = pr ? [['#7cf0ff', '#2b6cd9'], ['#ffd24a', '#e0527f'], ['#9af0b8', '#14a38b'], ['#ffb21e', '#c4272f']][k] : ['#f4f7fb', '#dfe6f3'];
    const g = c.createLinearGradient(sc[3].x, sc[3].y, sc[1].x, sc[1].y); g.addColorStop(0, cols2[0]); g.addColorStop(1, cols2[1]); isoPoly(c, fq('x', 0, 1.35, 6.65, 31, 91)); c.fillStyle = g; c.fill();
    if (pr) { c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = `rgba(255,255,255,${.1 + .08 * Math.sin(w.t * 12)})`; isoPoly(c, fq('x', 0, 1.35, 6.65, 31, 91)); c.fill(); c.restore(); }
    for (const [a, b] of [[.9, 1.35], [6.65, 7.1]]) polyFS(c, fq('x', 0, a, b, 20, 100), '#b8242e', P.ink, 1.6);                                                                      // cortinas
    onFace(c, 'x', 0, 6.5, 100, () => { txt(c, pr ? 'EN CARTELERA' : 'PRÓXIMAMENTE', 2.3 * U, -4, { font: `700 12px ${FONT_UI}`, align: 'center', color: '#ffd24a', ls: 1.5 }); });
  } else if (id === 'tienda') {
    onFace(c, 'x', 0, 6.7, 92, () => { c.fillStyle = '#8a5a32'; rr(c, 0, -22, 3.9 * U, 36, 5); c.fill(); c.lineWidth = 2; c.strokeStyle = P.ink; c.stroke(); txt(c, 'TIENDA', 1.95 * U, 5, { font: `400 ${fitDisplay(c, 'TIENDA', 3.4 * U, 28)}px ${FONT_DISPLAY}`, align: 'center', color: '#fff3d6', stroke: P.ink, sw: 5 }); });
    onFace(c, 'y', 0, 1.1, 104, () => { c.fillStyle = '#8a5a32'; rr(c, 0, -20, 4.4 * U, 40, 6); c.fill(); c.lineWidth = 2; c.strokeStyle = P.ink; c.stroke(); txt(c, 'MUEBLES', 2.2 * U, 8, { font: `400 ${fitDisplay(c, 'MUEBLES', 3.9 * U, 32)}px ${FONT_DISPLAY}`, align: 'center', color: '#fff3d6', stroke: P.ink, sw: 5 }); });
    polyFS(c, fq('y', 0, 9.3, 10.4, 40, 80), '#a9d9ee', P.ink, 1);
  } else if (id === 'bou') {
    polyFS(c, fq('x', 0, .6, 6.4, 40, 92), '#ffe0ee', P.ink, 1.6);                                  // pared de máscaras
    ['ring', 'blue', 'black', 'pink', 'novato', 'gray'].forEach((mk, i) => { const col = i % 3, row = Math.floor(i / 3), p = S(0, 1.4 + col * 1.9, 50 + row * 24); drawMask(c, p.x, p.y, 8.5, MASKS[mk]); });
    onFace(c, 'y', 0, .6, 96, () => { txt(c, 'BOUTIQUE ENMASCARADA', 2.6 * U, 6, { font: `400 ${fitDisplay(c, 'BOUTIQUE ENMASCARADA', 4.8 * U, 20)}px ${FONT_DISPLAY}`, align: 'center', color: '#c4274a', stroke: '#fff', sw: 4 }); });
    polyFS(c, fq('y', 0, 5.2, 6.3, 34, 84), '#cfe9f5', P.ink, 1.6);                                                                         // espejo
  }
}
function drawRoomScene(c, w) {
  const I = w.inn, id = w.inId, R = roomDef(id);
  c.save(); c.fillStyle = '#12111a'; c.fillRect(-EX, -EY, CW, CH);
  withRoom(w, () => {
    c.save(); camApply(c);
    drawGround(c);                                                     // el jardín y la calle detrás del diorama
    drawRoomShell(c, w, id);
    const L = [], items = roomItems(w, id), edit = w.hedit;
    items.forEach(o => L.push({ d: (o.x0 + o.x1) / 2 + (o.y0 + o.y1) / 2 + (o.k === 'seat' ? -.3 : 0), draw: () => { if (o.draw) o.draw(c, w, o); } }));
    roomStatic(id).filter(o => o.k === 'person').forEach(o => L.push({ d: o.x + o.y + .1, draw: () => drawRoomPerson(c, w, o) }));
    const p = S(I.x, I.y); L.push({ d: I.x + I.y + .05, draw: () => drawRoomActor(c, w, I) });
    L.sort((a, b) => a.d - b.d).forEach(i => i.draw());
    if (edit) drawHomeEditFloor(c, w);
    if (nightK(w) > .4 && !HOUSES[id]) { /* los interiores siempre están iluminados */ }
    c.restore();
  });
  c.restore();
}
function drawRoomPerson(c, w, o) {
  const p = S(o.x, o.y + (o.seated ? .0 : 0)), look = o.look;
  c.fillStyle = 'rgba(0,0,0,.2)'; c.beginPath(); c.ellipse(p.x, p.y + 2, 14, 5, 0, 0, 6.3); c.fill();
  if (o.seated) drawLuchador(c, p.x, p.y - 8, Object.assign({}, look, { state: 'eat', seated: true, tacosLeft: 0, t: w.t + o.x, dir: -1, scale: 1, eatKey: 'elote' }));
  else drawLuchador(c, p.x, p.y, Object.assign({}, look, { state: 'idle', t: w.t + o.x, dir: 1, scale: 1.02 }));
}
function drawRoomActor(c, w, I) {
  const p = S(I.x, I.y), a = I.anim;
  c.fillStyle = 'rgba(0,0,0,.2)'; c.beginPath(); c.ellipse(p.x, p.y + 2, 15, 5, 0, 0, 6.3); c.fill();
  const o = Object.assign({}, playerLook(w), { state: I.moving || I.path.length ? 'walk' : 'idle', t: I.path.length ? I.phase : w.t, dir: I.dir, scale: 1.04 });
  if (I.seat) { o.state = 'eat'; o.seated = true; o.tacosLeft = I.popcorn ? 3 : 0; o.eatKey = I.popcorn ? 'elote' : 'suero'; o.t = w.t; o.dir = I.seat.dir || -1; drawLuchador(c, p.x, p.y - 8, o); }
  else if (a && a.type === 'sleep') { c.save(); c.translate(p.x, p.y - 20); c.rotate(-.12); drawLuchador(c, 0, 20, Object.assign(o, { state: 'idle', dir: 1, t: w.t * .3 })); c.restore(); txt(c, 'Z', p.x + 18 + Math.sin(w.t * 2) * 3, p.y - 62 - (w.t * 14) % 24, { font: `700 18px ${FONT_UI}`, align: 'center', color: '#bfeaff', stroke: P.ink, sw: 3 }); }
  else drawLuchador(c, p.x, p.y, o);
  if (a && a.type === 'tv') txt(c, '📺', p.x, p.y - 84, { font: `16px ${FONT_UI}`, align: 'center', color: P.white });
}

/* ---------- Dentro de los edificios: caminar, usar las cosas, comprar ---------- */
const MOVIES = ['El Gran Luchador', 'Máscaras de Medianoche', 'Taco Cósmico', 'La Venganza del Pastor', 'Cuatro Esquinas'];
const ticketPrice = w => 30 + 2 * Math.min(w.level, 60);
function updateRoom(w, dt) {
  const I = w.inn; if (!I) return; I.t += dt;
  const a = I.anim, n = w.novato, mx = maxStamina(w);
  if (a) {
    a.t += dt;
    if (a.type === 'movie' && a.t >= a.dur) endMovie(w);
    else if (a.type === 'sleep') { n.stamina = Math.min(mx, lerp(a.s0, mx, clamp(a.t / a.dur, 0, 1))); if (a.t >= a.dur) { I.anim = null; I.x = a.back.x; I.y = a.back.y; w.dayTime = Math.max(6, w.dayTime - 12); sfx('ready'); toast(w, '¡Qué buena siesta! Energía completa (pasó un rato)'); } }
    else if (a.type === 'rest' || a.type === 'tv') { n.stamina = Math.min(mx, n.stamina + STAM.regen * 1.4 * dt); if (a.t >= (a.dur || 8) && a.type === 'tv' || (n.stamina >= mx && a.t > 2.5)) { I.anim = null; I.seat = null; if (a.back) { I.x = a.back.x; I.y = a.back.y; } sfx('ready'); toast(w, 'Descansaste: ¡energía recuperada!'); } }
    return;
  }
  const was = I.path.length > 0; step(I, dt);
  if (was && !I.path.length) {
    const it = I.intent; I.intent = null;
    if (it && it.type === 'exit') exitBuilding(w);
    else if (it && it.type === 'act') roomAct(w, it.o);
  }
}
function endMovie(w) {
  const I = w.inn, n = w.novato, mx = maxStamina(w); I.anim = null; I.popcorn = false;
  n.stamina = Math.min(mx, n.stamina + mx * .6); const xp = 20 + 2 * w.level; addXp(w, xp); w.town.movies++;
  let msg = `¡Qué película! +${xp} XP y energía`; if (Math.random() < .12) { w.gems++; w.gemsSeen = true; msg += ' · +1 gema'; }
  toast(w, msg); sfx('fanfare');
}
function roomHitItem(w, q) {                                           // qué pieza del cuarto quedó bajo el clic (la más cercana a la cámara primero)
  const L = roomItems(w, w.inId), st = roomStatic(w.inId);
  for (const o of st.filter(o => o.k === 'person')) { const p = S(o.x, o.y); if (q.x > p.x - 24 && q.x < p.x + 24 && q.y > p.y - 84 && q.y < p.y + 10 && !o.seated) { const c0 = L.find(z => z.k === 'counter'); if (c0) return c0; } }
  const hits = L.filter(o => o.act && (o.k !== 'seat' || true)).filter(o => { const b = rbox(o); return q.x >= b.x0 && q.x <= b.x1 && q.y >= b.y0 && q.y <= b.y1; });
  hits.sort((a, b) => (b.x1 + b.y1) - (a.x1 + a.y1));
  return hits[0] || null;
}
function roomPointer(w, x, y) {
  const I = w.inn; if (!I || w.fade) return;
  if (w.hedit) { homeEditPointer(w, x, y); return; }
  withRoom(w, () => {
    const R = roomDef(w.inId), q = camWorld(x, y), iso = screenToIso(q.x, q.y);
    if (I.seat && (!I.anim || I.anim.type !== 'movie')) { I.seat = null; I.anim = null; }
    const db = { x0: S(R.doorC, 0).x - 6, x1: S(R.doorC + 1.4, 0).x + 6, y0: S(R.doorC, 0, 100).y, y1: S(R.doorC, 0, 0).y + 14 };
    if (q.x >= db.x0 && q.x <= db.x1 && q.y >= db.y0 && q.y <= db.y1) { roomGoTo(w, [R.doorC, 0], { type: 'exit' }) || roomGoTo(w, [R.doorC, 1], { type: 'exit' }); return; }
    const o = roomHitItem(w, q);
    if (o && o.act) {
      if (o.act.type === 'seat') { if (!I.ticket) { toast(w, 'Primero compra tu boleto en la taquilla'); sfx('nope'); return; } roomGoTo(w, [o.c, o.r], { type: 'act', o }); return; }
      const sts = roomStands(w, o);
      if (!sts.length) { roomAct(w, o); return; }
      if (sts.some(s => Math.floor(I.x) === s[0] && Math.floor(I.y) === s[1])) { roomAct(w, o); return; }
      const p = roomPathTo(w, sts); if (!p) { sfx('nope'); return; }
      I.path = p.map(z => ({ x: z.c + .5, y: z.r + .5 })); I.intent = { type: 'act', o }; sfx('click'); return;
    }
    const cell = nearFreeCell(Math.floor(iso.x), Math.floor(iso.y), (c, r) => roomBlocked(w, c, r), 2);
    if (cell) roomGoTo(w, cell, null); else sfx('nope');
  });
}
function roomAct(w, o) {
  const I = w.inn, a = o.act; if (!a) return;
  if (a.type === 'ticket') {
    if (w.town.movies >= 3) { toast(w, 'Hoy ya viste tres películas: ¡mañana hay más!'); sfx('nope'); return; }
    if (I.ticket) { toast(w, 'Ya tienes boleto: elige un asiento'); sfx('nope'); return; }
    const pr = ticketPrice(w), mv = MOVIES[(w.day + w.town.movies) % MOVIES.length];
    w.dlg = { title: 'TAQUILLA', lines: [`Hoy: «${mv}»`, `Boleto: ${pesos(pr)}`, 'Te deja descansar, da experiencia y a veces gemas'], ok: `COMPRAR ${pesos(pr)}`, no: 'NO, GRACIAS', fn: () => { if (w.money < pr) { sfx('nope'); w.moneyFlash = .8; toast(w, `Faltan ${pesos(pr - w.money)}`); return; } w.money -= pr; I.ticket = true; w.modal = null; sfx('coin'); toast(w, 'Boleto comprado: toca un asiento rojo'); } }; w.modal = 'dlg'; sfx('click');
  } else if (a.type === 'popcorn') {
    if (I.popcorn) { toast(w, 'Ya tienes tus palomitas'); sfx('nope'); return; }
    w.dlg = { title: 'PALOMITAS', lines: ['Un bote grande de palomitas', 'Te dan un poco de energía'], ok: 'COMPRAR $30', no: 'NO', fn: () => { if (w.money < 30) { sfx('nope'); toast(w, `Faltan ${pesos(30 - w.money)}`); return; } w.money -= 30; I.popcorn = true; w.novato.stamina = Math.min(maxStamina(w), w.novato.stamina + 8); w.modal = null; sfx('coin'); toast(w, '¡Palomitas!'); } }; w.modal = 'dlg'; sfx('click');
  } else if (a.type === 'seat') {
    I.seat = { c: o.c, r: o.r, dir: -1 }; I.x = o.c + .5; I.y = o.r + .5; I.dir = -1; I.path = [];
    if (I.ticket) { I.ticket = false; I.anim = { type: 'movie', t: 0, dur: 16, cancel: true }; sfx('door'); toast(w, 'Comienza la película…'); } else { I.seat = null; }
  } else if (a.type === 'catalog') { w.modal = 'catalog'; w.catCat = w.catCat || 'dorm'; sfx('click'); }
  else if (a.type === 'boutique') { w.shop = true; w.shopView = 'look'; w.lookCat = w.lookCat || 'mask'; w.lookPage = 0; sfx('click'); }
  else if (a.type === 'use') {
    const n = w.novato, mx = maxStamina(w), b = { x: Math.floor(I.x) + .5, y: Math.floor(I.y) + .5 };
    if (a.use === 'sleep') { if (n.stamina >= mx - 1) { toast(w, 'No tienes sueño: tu energía está completa'); sfx('nope'); return; } const cx = (o.x0 + o.x1) / 2, cy = (o.y0 + o.y1) / 2; I.anim = { type: 'sleep', t: 0, dur: 3.6, s0: n.stamina, back: b, cancel: true }; I.x = cx; I.y = cy; I.path = []; sfx('pour'); }
    else if (a.use === 'sit') { if (n.stamina >= mx - 1) { toast(w, 'Te sientas un rato… tu energía ya está completa'); } I.seat = { dir: o.f && o.f.rot ? 1 : -1 }; I.anim = { type: 'rest', t: 0, back: b, cancel: true }; I.x = (o.x0 + o.x1) / 2; I.y = (o.y0 + o.y1) / 2; I.path = []; sfx('pickup'); }
    else if (a.use === 'tv') { const sofa = roomItems(w, w.inId).find(z => z.act && z.act.use === 'sit'); if (sofa) { I.seat = { dir: -1 }; I.anim = { type: 'tv', t: 0, dur: 9, back: b, cancel: true }; I.x = (sofa.x0 + sofa.x1) / 2; I.y = (sofa.y0 + sofa.y1) / 2; I.path = []; } else { I.anim = { type: 'tv', t: 0, dur: 6, back: b, cancel: true }; toast(w, 'Con un sillón verías la tele sentado'); } sfx('click'); }
  }
}

/* ---------- Ventanas: confirmar, tienda de muebles y pintura de la casa ---------- */
const DLG = { x: 270, y: 190, w: 420, h: 230 };
const dlgBtn = k => ({ x: DLG.x + (k ? 218 : 24), y: DLG.y + DLG.h - 68, w: 178, h: 48 });
function drawDialog(c, w) {
  const D = w.dlg; if (!D) return;
  c.fillStyle = 'rgba(12,11,15,.7)'; c.fillRect(-EX, -EY, CW, CH);
  drawPanel(c, DLG.x, DLG.y, DLG.w, DLG.h, D.title);
  D.lines.forEach((l, i) => txt(c, l, DLG.x + DLG.w / 2, DLG.y + 66 + i * 26, { font: `${i ? 600 : 700} ${i ? 16 : 19}px ${FONT_UI}`, align: 'center', color: i ? P.cream : P.gold, maxW: DLG.w - 40 }));
  drawButton(c, Object.assign({ label: D.ok, style: 'green', size: 18 }, dlgBtn(0))); drawButton(c, Object.assign({ label: D.no, style: 'dark', size: 18 }, dlgBtn(1)));
}
function dlgPointer(w, x, y) {
  const hit = b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h, D = w.dlg;
  if (!D) { w.modal = null; return; }
  if (hit(dlgBtn(0))) { sfx('click'); const f = D.fn; w.dlg = null; if (w.modal === 'dlg') w.modal = null; f && f(); return; }
  if (hit(dlgBtn(1)) || !hit(DLG)) { sfx('back'); w.dlg = null; w.modal = null; }
}
function dlgKey(w, e) {
  if (e.key === 'Escape') { sfx('back'); w.dlg = null; w.modal = null; return true; }
  if (e.key === 'Enter' || e.key === ' ') { dlgPointer(w, dlgBtn(0).x + 5, dlgBtn(0).y + 5); return true; }
  return false;
}
function openBuyHouse(w, id) {
  const H = HOUSES[id];
  w.dlg = { title: 'SE VENDE', lines: [H.name, `Precio: ${pesos(H.price)}`, w.level < H.level ? `Pide el nivel ${H.level}` : 'Descansa, ponle muebles y píntala a tu gusto'], ok: `COMPRAR ${pesos(H.price)}`, no: 'NO POR AHORA', fn: () => buyHouse(w, id) };
  w.modal = 'dlg'; sfx('click');
}
function buyHouse(w, id) {
  const H = HOUSES[id], D = houseOf(w, id);
  if (w.level < H.level) { sfx('nope'); toast(w, `${H.name} se desbloquea en el nivel ${H.level}`); return; }
  if (w.money < H.price) { sfx('nope'); w.moneyFlash = .8; toast(w, `Faltan ${pesos(H.price - w.money)}`); return; }
  w.money -= H.price; D.own = true; sfx('fanfare'); w.shake = .3; toast(w, `¡${H.name} es tuya! Entra, ponle muebles y píntala`); Game.save();
  enterBuilding(w, id);
}
// ---- tienda de muebles
const CATBOX = { x: 110, y: 78, w: 740, h: 452 };
const catChip = i => ({ x: CATBOX.x + 20 + i * 117, y: CATBOX.y + 42, w: 113, h: 30, key: HCATS[i][0], label: HCATS[i][1] });
const catRow = i => ({ x: CATBOX.x + CATBOX.w - 170, y: CATBOX.y + 86 + i * 64 + 8, w: 150, h: 40 });
const catClose = { x: CATBOX.x + CATBOX.w - 40, y: CATBOX.y + 8, w: 30, h: 30 };
const catItems = w => Object.keys(HF).filter(k => HF[k].cat === (w.catCat || 'dorm'));
const ownedHF = (w, t) => w.town.hinv.filter(x => x === t).length + Object.keys(w.town.houses).reduce((s, id) => s + w.town.houses[id].furn.filter(f => f.t === t).length, 0) + (w.hedit && w.hedit.held && w.hedit.held.t === t ? 1 : 0);
function drawCatalog(c, w) {
  const B = CATBOX; c.fillStyle = 'rgba(12,11,15,.74)'; c.fillRect(-EX, -EY, CW, CH);
  drawPanel(c, B.x, B.y, B.w, B.h, 'TIENDA DE MUEBLES');
  const cl = catClose, ch = UI.hit(cl); if (ch) UI.cursor = true;
  rr(c, cl.x, cl.y, cl.w, cl.h, 8); c.fillStyle = ch ? '#5a3a8a' : '#2f2c37'; c.fill(); c.lineWidth = 1.6; c.strokeStyle = 'rgba(255,255,255,.35)'; c.stroke();
  c.strokeStyle = P.white; c.lineWidth = 2.4; c.lineCap = 'round'; c.beginPath(); c.moveTo(cl.x + 10, cl.y + 10); c.lineTo(cl.x + 20, cl.y + 20); c.moveTo(cl.x + 20, cl.y + 10); c.lineTo(cl.x + 10, cl.y + 20); c.stroke();
  drawCoin(c, B.x + 36, B.y + 20, 10, 0); txt(c, pesos(w.shownMoney), B.x + 52, B.y + 28, { font: `700 22px ${FONT_UI}`, color: w.moneyFlash > 0 ? '#ff7a8c' : P.white, stroke: P.ink, sw: 4 });
  HCATS.forEach((ct, i) => { const q = catChip(i), on = (w.catCat || 'dorm') === ct[0], hov = UI.hit(q); if (hov) UI.cursor = true; rr(c, q.x, q.y, q.w, q.h, 9); c.fillStyle = on ? '#e29a12' : hov ? '#4a2c80' : '#27252f'; c.fill(); c.lineWidth = on ? 3 : 1.6; c.strokeStyle = on ? P.gold : 'rgba(255,255,255,.3)'; c.stroke(); txt(c, q.label, q.x + q.w / 2, q.y + 20, { font: `700 ${fitFont(c, q.label, q.w - 8, 14, 700)}px ${FONT_UI}`, align: 'center', color: on ? P.ink : P.cream, ls: .4 }); });
  catItems(w).forEach((t, i) => {
    const D = HF[t], y = B.y + 86 + i * 64, b = catRow(i), ok = w.money >= D.price;
    if (i % 2 === 0) { c.fillStyle = 'rgba(255,255,255,.05)'; c.fillRect(B.x + 8, y, B.w - 16, 64); }
    c.fillStyle = '#16151b'; rr(c, B.x + 22, y + 4, 84, 56, 12); c.fill(); c.lineWidth = 2; c.strokeStyle = P.violet; c.stroke();
    c.save(); rr(c, B.x + 22, y + 4, 84, 56, 12); c.clip(); drawFurnPreview(c, t, B.x + 64, y + 28, D.fw + D.fh >= 5 ? .5 : .68, w); c.restore();
    txt(c, D.name, B.x + 122, y + 24, { font: `700 ${fitFont(c, D.name, 330, 21, 700)}px ${FONT_UI}`, color: P.cream });
    txt(c, `${D.desc} · ${D.fw} x ${D.fh} losetas`, B.x + 122, y + 42, { font: `600 14px ${FONT_UI}`, color: P.muted, maxW: 340 });
    const own = ownedHF(w, t); txt(c, own ? `Tienes ${own}` : 'No tienes ninguno', B.x + 122, y + 58, { font: `700 13px ${FONT_UI}`, color: own ? '#9af0b8' : '#8a7a50' });
    txt(c, pesos(D.price), b.x - 14, y + 38, { font: `700 20px ${FONT_UI}`, align: 'right', color: ok ? P.gold : '#ff8fa0' });
    drawButton(c, Object.assign({ label: 'COMPRAR', style: ok ? 'green' : 'dark', size: 17 }, b, { disabled: false }));
  });
  txt(c, 'Lo que compras va a tu inventario de casa: entra a tu casa y pulsa EDITAR para ponerlo donde quieras', B.x + B.w / 2, B.y + B.h - 14, { font: `600 13px ${FONT_UI}`, align: 'center', color: P.muted });
}
function catPointer(w, x, y) {
  const hit = b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
  if (hit(catClose) || !hit(CATBOX)) { w.modal = null; sfx('back'); return; }
  for (let i = 0; i < HCATS.length; i++) if (hit(catChip(i))) { if (w.catCat !== HCATS[i][0]) { w.catCat = HCATS[i][0]; sfx('click'); } return; }
  const its = catItems(w);
  for (let i = 0; i < its.length; i++) if (hit(catRow(i))) {
    const D = HF[its[i]]; if (w.money < D.price) { sfx('nope'); w.moneyFlash = .8; toast(w, `Faltan ${pesos(D.price - w.money)}`); return; }
    w.money -= D.price; w.town.hinv.push(its[i]); sfx('coin'); toast(w, `${D.name}: ¡a tu inventario de casa!`); Game.save(); return;
  }
}
// ---- pintar la casa (solo se abre dentro de una casa tuya)
const PBOX = { x: 556, y: 84, w: 384, h: 430 };
const PCATS = [['wall', 'PAREDES'], ['floor', 'PISO'], ['fachada', 'FACHADA'], ['roof', 'TECHO']];
const pChip = i => ({ x: PBOX.x + 14 + i * 90, y: PBOX.y + 40, w: 86, h: 30 });
const pSwatch = (i, n) => { const cols = n > 8 ? 4 : 3, sw = (PBOX.w - 28 - (cols - 1) * 10) / cols; return { x: PBOX.x + 14 + (i % cols) * (sw + 10), y: PBOX.y + 112 + Math.floor(i / cols) * 66, w: sw, h: 56 }; };
const pClose = { x: PBOX.x + PBOX.w - 40, y: PBOX.y + 8, w: 30, h: 30 };
const pCuadros = { x: PBOX.x + 14, y: PBOX.y + PBOX.h - 52, w: PBOX.w - 28, h: 38 };
function paintOptions(cat) { return cat === 'wall' ? HOME_WALLS : cat === 'floor' ? Object.keys(HOME_FLOORS) : cat === 'fachada' ? HOME_FACHADA : HOME_ROOF; }
function openPaint(w) {
  if (w.loc !== 'in' || !HOUSES[w.inId] || !houseOf(w, w.inId).own) { toast(w, 'Solo puedes pintar dentro de tu casa'); sfx('nope'); return; }
  w.hedit = null; w.modal = 'paint'; w.paintCat = w.paintCat || 'wall'; sfx('click');
}
function drawPaint(c, w) {
  const B = PBOX, D = houseOf(w, w.inId), cat = w.paintCat || 'wall', opts = paintOptions(cat);
  drawPanel(c, B.x, B.y, B.w, B.h, 'PINTAR LA CASA');
  const cl = pClose, ch = UI.hit(cl); if (ch) UI.cursor = true;
  rr(c, cl.x, cl.y, cl.w, cl.h, 8); c.fillStyle = ch ? '#5a3a8a' : '#2f2c37'; c.fill(); c.lineWidth = 1.6; c.strokeStyle = 'rgba(255,255,255,.35)'; c.stroke();
  c.strokeStyle = P.white; c.lineWidth = 2.4; c.lineCap = 'round'; c.beginPath(); c.moveTo(cl.x + 10, cl.y + 10); c.lineTo(cl.x + 20, cl.y + 20); c.moveTo(cl.x + 20, cl.y + 10); c.lineTo(cl.x + 10, cl.y + 20); c.stroke();
  PCATS.forEach((ct, i) => { const q = pChip(i), on = cat === ct[0], hov = UI.hit(q); if (hov) UI.cursor = true; rr(c, q.x, q.y, q.w, q.h, 8); c.fillStyle = on ? '#e29a12' : hov ? '#4a2c80' : '#27252f'; c.fill(); c.lineWidth = on ? 3 : 1.6; c.strokeStyle = on ? P.gold : 'rgba(255,255,255,.3)'; c.stroke(); txt(c, ct[1], q.x + q.w / 2, q.y + 20, { font: `700 ${fitFont(c, ct[1], q.w - 6, 14, 700)}px ${FONT_UI}`, align: 'center', color: on ? P.ink : P.cream }); });
  txt(c, cat === 'wall' ? 'Color de las paredes de adentro' : cat === 'floor' ? 'El piso de adentro' : cat === 'fachada' ? 'Color de afuera, en el pueblo' : 'Color del techo, en el pueblo', B.x + B.w / 2, B.y + 96, { font: `600 14px ${FONT_UI}`, align: 'center', color: P.muted });
  const cur = cat === 'wall' ? D.wall : cat === 'floor' ? D.floor : cat === 'fachada' ? D.fachada : D.roof;
  opts.forEach((o, i) => {
    const q = pSwatch(i, opts.length), hov = UI.hit(q), sel = o === cur; if (hov) UI.cursor = true;
    rr(c, q.x, q.y, q.w, q.h, 10);
    if (cat === 'floor') { const F = HOME_FLOORS[o]; const g = c.createLinearGradient(q.x, q.y, q.x + q.w, q.y + q.h); g.addColorStop(0, F.c0); g.addColorStop(.5, F.c1); g.addColorStop(1, F.c0); c.fillStyle = g; } else c.fillStyle = o; c.fill();
    c.lineWidth = sel ? 4 : hov ? 3 : 2; c.strokeStyle = sel ? '#9af0b8' : hov ? P.gold : 'rgba(255,255,255,.35)'; c.stroke();
    if (cat === 'floor') txt(c, HOME_FLOORS[o].name, q.x + q.w / 2, q.y + q.h / 2 + 5, { font: `700 ${fitFont(c, HOME_FLOORS[o].name, q.w - 8, 14, 700)}px ${FONT_UI}`, align: 'center', color: P.ink, stroke: 'rgba(255,255,255,.7)', sw: 3 });
    if (sel) txt(c, '✓', q.x + q.w - 12, q.y + 16, { font: `700 18px ${FONT_UI}`, align: 'center', color: P.ink, stroke: '#fff', sw: 3 });
  });
  const cq = pCuadros, chv = UI.hit(cq); if (chv) UI.cursor = true;
  rr(c, cq.x, cq.y, cq.w, cq.h, 10); c.fillStyle = chv ? '#4a2c80' : '#27252f'; c.fill(); c.lineWidth = 1.8; c.strokeStyle = 'rgba(255,255,255,.35)'; c.stroke();
  txt(c, D.cuadros ? '✓ Cuadros en las paredes' : 'Poner cuadros en las paredes', cq.x + cq.w / 2, cq.y + 25, { font: `700 16px ${FONT_UI}`, align: 'center', color: D.cuadros ? '#9af0b8' : P.cream });
}
function paintPointer(w, x, y) {
  const hit = b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h, D = houseOf(w, w.inId);
  if (hit(pClose)) { w.modal = null; sfx('back'); Game.save(); return; }
  for (let i = 0; i < PCATS.length; i++) if (hit(pChip(i))) { w.paintCat = PCATS[i][0]; sfx('click'); return; }
  const cat = w.paintCat || 'wall', opts = paintOptions(cat);
  for (let i = 0; i < opts.length; i++) if (hit(pSwatch(i, opts.length))) { if (cat === 'wall') D.wall = opts[i]; else if (cat === 'floor') D.floor = opts[i]; else if (cat === 'fachada') D.fachada = opts[i]; else D.roof = opts[i]; sfx('pour'); return; }
  if (hit(pCuadros)) { D.cuadros = !D.cuadros; sfx('click'); return; }
  if (!hit(PBOX)) { w.modal = null; sfx('back'); Game.save(); }
}

/* ---------- Editar los muebles de la casa ---------- */
const HEDIT = { x: W - 14 - 256, y: 72, w: 256, cols: 4, cell: 52, top: 54, per: 16 };
const hSlot = i => ({ x: HEDIT.x + 14 + (i % HEDIT.cols) * (HEDIT.cell + 4), y: HEDIT.y + HEDIT.top + Math.floor(i / HEDIT.cols) * (HEDIT.cell + 4), w: HEDIT.cell, h: HEDIT.cell });
const hH = () => HEDIT.top + 4 * (HEDIT.cell + 4) + 150;
const hBtns = () => { const y = HEDIT.y + HEDIT.top + 4 * (HEDIT.cell + 4) + 8, x = HEDIT.x + 14, bw = (HEDIT.w - 36) / 2; return { rot: { x, y, w: bw, h: 38, label: 'GIRAR', style: 'violet', size: 17 }, store: { x: x + bw + 8, y, w: bw, h: 38, label: 'GUARDAR', style: 'gold', size: 17 }, done: { x, y: y + 48, w: HEDIT.w - 28, h: 44, label: 'LISTO', style: 'green', size: 20 }, prev: { x, y: y + 100, w: 44, h: 28, label: '◀', size: 15, style: 'dark' }, next: { x: x + HEDIT.w - 28 - 44, y: y + 100, w: 44, h: 28, label: '▶', size: 15, style: 'dark' } }; };
function toggleHomeEdit(w) {
  if (w.loc !== 'in' || !HOUSES[w.inId]) return;
  if (w.hedit) { homeEditDone(w); return; }
  w.hedit = { held: null, hover: null, armed: null, page: 0 }; w.inn.path = []; w.inn.intent = null; sfx('click'); toast(w, 'Toca un mueble de la lista y luego una loseta del piso');
}
function homeEditDone(w) { const e = w.hedit; if (!e) return; if (e.held) homeStore(w); w.hedit = null; sfx('back'); Game.save(); }
function homeStore(w) { const e = w.hedit; if (!e || !e.held) { sfx('nope'); return; } w.town.hinv.push(e.held.t); toast(w, `${HF[e.held.t].name}: guardado`); e.held = null; e.armed = null; sfx('pickup'); }
function homeRotate(w) { const e = w.hedit; if (!e || !e.held) return; e.held.rot = e.held.rot ? 0 : 1; sfx('click'); }
function homeSize(h) { const D = HF[h.t]; return h.rot ? { fw: D.fh, fh: D.fw } : { fw: D.fw, fh: D.fh }; }
function homeAnchor(h, iso) { const s = homeSize(h); return { c: Math.floor(iso.x) - Math.floor((s.fw - 1) / 2), r: Math.floor(iso.y) - Math.floor((s.fh - 1) / 2) }; }
function homeCan(w, h, c, r) {                                         // null si se puede poner ahí, o el motivo
  const R = roomDef(w.inId), s = homeSize(h), D = HF[h.t];
  if (c < 0 || r < 0 || c + s.fw > R.cols || r + s.fh > R.rows) return 'Se sale del cuarto';
  if (c < R.doorC + 2 && c + s.fw > R.doorC - 1 && r < 2 && D.solid !== false) return 'Eso tapa la puerta';
  if (D.solid !== false) for (const o of roomItems(w, w.inId)) { if (!o.solid) continue; if (c < o.x1 && c + s.fw > o.x0 && r < o.y1 && r + s.fh > o.y0) return 'Ahí ya hay otro mueble'; }
  return null;
}
function homePlace(w, c, r) {
  const e = w.hedit, h = e.held, why = homeCan(w, h, c, r); if (why) { toast(w, why); sfx('nope'); return false; }
  houseOf(w, w.inId).furn.push({ t: h.t, c, r, rot: h.rot ? 1 : 0 }); e.held = null; e.armed = null; sfx('serve'); return true;
}
function homeEditPointer(w, x, y) {
  const e = w.hedit, hit = b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h, B = hBtns(), D = houseOf(w, w.inId);
  if (hit(B.done)) { homeEditDone(w); return; }
  if (hit(B.rot)) { homeRotate(w); return; }
  if (hit(B.store)) { homeStore(w); return; }
  const pages = Math.max(1, Math.ceil(w.town.hinv.length / HEDIT.per));
  if (hit(B.prev)) { e.page = (e.page + pages - 1) % pages; sfx('click'); return; }
  if (hit(B.next)) { e.page = (e.page + 1) % pages; sfx('click'); return; }
  const base = e.page * HEDIT.per;
  for (let i = 0; i < HEDIT.per; i++) if (hit(hSlot(i)) && w.town.hinv[base + i] !== undefined) { if (e.held) { sfx('nope'); toast(w, 'Ya llevas un mueble: suéltalo o guárdalo'); return; } e.held = { t: w.town.hinv.splice(base + i, 1)[0], rot: 0 }; sfx('pickup'); return; }
  if (hit({ x: HEDIT.x, y: HEDIT.y, w: HEDIT.w, h: hH() })) return;
  withRoom(w, () => {
    const q = camWorld(x, y), iso = screenToIso(q.x, q.y);
    if (e.held) {
      const a = homeAnchor(e.held, iso), key = a.c + ',' + a.r + ',' + (e.held.rot || 0);
      e.hover = a;
      if (UI.touch && e.armed !== key) { e.armed = key; sfx('click'); return; }
      homePlace(w, a.c, a.r); return;
    }
    const tgt = D.furn.map((f, i) => ({ f, i, b: hfBox(f) })).filter(o => q.x >= rbox(Object.assign({}, o.b)).x0 && q.x <= rbox(o.b).x1 && q.y >= rbox(o.b).y0 && q.y <= rbox(o.b).y1).sort((a, b) => (b.b.x1 + b.b.y1) - (a.b.x1 + a.b.y1))[0];
    if (tgt) { D.furn.splice(tgt.i, 1); e.held = { t: tgt.f.t, rot: tgt.f.rot }; sfx('pickup'); return; }
    sfx('nope');
  });
}
function homeEditHover(w, x, y) { const e = w.hedit; if (!e || !e.held || w.modal) return; withRoom(w, () => { const q = camWorld(x, y), iso = screenToIso(q.x, q.y); e.hover = homeAnchor(e.held, iso); }); }
function drawHomeEditFloor(c, w) {
  const e = w.hedit, R = roomDef(w.inId);
  c.lineWidth = 1; c.strokeStyle = 'rgba(255,255,255,.35)';
  for (let i = 0; i < R.cols; i++) for (let j = 0; j < R.rows; j++) { groundQuad(c, i, j, i + 1, j + 1); c.stroke(); }
  groundQuad(c, R.doorC, 0, R.doorC + 1.4, 1); c.fillStyle = 'rgba(255,200,61,.35)'; c.fill();
  if (e.held && e.hover) { const s = homeSize(e.held), why = homeCan(w, e.held, e.hover.c, e.hover.r); e.why = why; groundQuad(c, e.hover.c, e.hover.r, e.hover.c + s.fw, e.hover.r + s.fh); c.fillStyle = why ? 'rgba(255,70,90,.45)' : 'rgba(80,230,140,.45)'; c.fill(); c.save(); c.globalAlpha = .78; drawHF(c, e.held.t, e.hover.c, e.hover.r, e.hover.c + s.fw, e.hover.r + s.fh, e.held.rot, w); c.restore(); }
}
function drawHomeEditPanel(c, w) {
  const e = w.hedit, Q = HEDIT, h = hH(), B = hBtns(), pages = Math.max(1, Math.ceil(w.town.hinv.length / Q.per)), base = e.page * Q.per;
  c.save(); c.fillStyle = 'rgba(0,0,0,.45)'; rr(c, Q.x + 4, Q.y + 8, Q.w, h, 16); c.fill();
  const g = c.createLinearGradient(0, Q.y, 0, Q.y + h); g.addColorStop(0, '#12476a'); g.addColorStop(1, '#1f1d25'); rr(c, Q.x, Q.y, Q.w, h, 16); c.fillStyle = g; c.fill(); c.lineWidth = 3.5; c.strokeStyle = '#5fd0ff'; c.stroke();
  txt(c, 'MUEBLES', Q.x + 16, Q.y + 30, { font: `400 21px ${FONT_DISPLAY}`, color: '#bfeaff', stroke: P.ink, sw: 4 });
  txt(c, `En inventario: ${w.town.hinv.length}`, Q.x + Q.w - 16, Q.y + 30, { font: `700 15px ${FONT_UI}`, align: 'right', color: P.cream });
  txt(c, w.town.hinv.length ? 'Toca un mueble para tomarlo' : 'Compra muebles en la tienda del pueblo', Q.x + 16, Q.y + 46, { font: `600 12px ${FONT_UI}`, color: P.muted, maxW: Q.w - 30 });
  let tip = null;
  for (let i = 0; i < Q.per; i++) {
    const s = hSlot(i), t = w.town.hinv[base + i], hov = UI.hit(s) && !!t;
    rr(c, s.x, s.y, s.w, s.h, 8); c.fillStyle = hov ? 'rgba(95,208,255,.28)' : 'rgba(255,255,255,.07)'; c.fill(); c.lineWidth = 1.6; c.strokeStyle = t ? '#5fd0ff' : 'rgba(255,255,255,.22)'; if (!t) c.setLineDash([4, 3]); c.stroke(); c.setLineDash([]);
    if (t) { c.save(); rr(c, s.x, s.y, s.w, s.h, 8); c.clip(); drawFurnPreview(c, t, s.x + s.w / 2, s.y + 24, HF[t].fw + HF[t].fh >= 5 ? .42 : .55, w); c.restore(); if (hov) { UI.cursor = true; tip = [HF[t].name, 'Toca para tomarlo y ponerlo']; } }
  }
  drawButton(c, Object.assign({}, B.rot, { disabled: !e.held })); drawButton(c, Object.assign({}, B.store, { disabled: !e.held })); drawButton(c, B.done);
  if (pages > 1) { drawButton(c, B.prev); drawButton(c, B.next); txt(c, `${e.page + 1} / ${pages}`, Q.x + Q.w / 2, B.prev.y + 20, { font: `700 15px ${FONT_UI}`, align: 'center', color: P.cream }); }
  txt(c, UI.touch ? 'Toca un mueble, GIRAR, toca la loseta dos veces' : 'R o GIRAR: gira · toca un mueble puesto para moverlo', Q.x + Q.w / 2, h + Q.y - 12, { font: `600 11.5px ${FONT_UI}`, align: 'center', color: P.muted, maxW: Q.w - 20 });
  c.restore();
  if (e.held) drawTip(c, clamp(UI.mx + 18, 8, Q.x - 220), UI.my + 8, [`Llevas: ${HF[e.held.t].name}`, e.why || (UI.touch ? 'Toca la loseta (otra vez para soltar)' : 'Toca una loseta para soltarlo')]);
  else if (tip) drawTip(c, UI.mx - 230, UI.my + 6, tip);
}

/* ---------- Penales en las canchas de fútbol ----------
   Cinco tiros por tanda y hasta tres tandas al día. Tocas la portería para tirar; el portero se lanza a una de las seis zonas (izquierda, centro o derecha, arriba o abajo).
   Cada gol paga (10 + tu nivel) monedas y 6 de experiencia; con los 5 goles ganas además una gema. */
const PBX = { x: 100, y: 74, w: 760, h: 456 };
const GOAL = { x: 250, y: 150, w: 460, h: 200 };
const KEEPER_LOOK = { casual: true, gender: 'm', hairStyle: 'crop', hairColor: '#2b2018', hoodie: '#ffb21e', pants: '#17171c', shoes: 'blanco', skin: '#c68642', stache: true, label: ['EL', 'PULPO'] };
const penalClose = { x: PBX.x + PBX.w - 40, y: PBX.y + 8, w: 30, h: 30 };
const zoneOf = (x, y) => Math.min(2, Math.max(0, Math.floor((x - GOAL.x) / (GOAL.w / 3)))) + 3 * (y < GOAL.y + GOAL.h * .5 ? 0 : 1);
const zoneXY = z => ({ x: GOAL.x + ((z % 3) + .5) * GOAL.w / 3, y: GOAL.y + (z < 3 ? .3 : .72) * GOAL.h });
function openPenal(w, fid) {
  const T = w.town;
  if (T.penalN >= 3) { toast(w, 'Hoy ya jugaste tus tres tandas de penales: ¡mañana hay más!'); sfx('nope'); return; }
  w.penal = { state: 'aim', shot: 0, goals: 0, t: 0, tx: 0, ty: 0, kz: 1, sz: 1, res: '', fid, played: false };
  w.modal = 'penal'; sfx('bell');
}
function penalShoot(w, x, y) {
  const P_ = w.penal; if (!P_ || P_.state !== 'aim') return;
  const inside = x >= GOAL.x && x <= GOAL.x + GOAL.w && y >= GOAL.y && y <= GOAL.y + GOAL.h, out = !inside;
  const edge = inside && (x < GOAL.x + 26 || x > GOAL.x + GOAL.w - 26 || y < GOAL.y + 22);
  P_.tx = clamp(x, GOAL.x - 70, GOAL.x + GOAL.w + 70); P_.ty = clamp(y, GOAL.y - 50, GOAL.y + GOAL.h + 20); P_.sz = zoneOf(x, y);
  const w6 = [1, 1.2, 1, 1.1, .9, 1.1].map((v, i) => v), tot = w6.reduce((a, b) => a + b, 0); let r = Math.random() * tot, kz = 0; for (let i = 0; i < 6; i++) { r -= w6[i]; if (r <= 0) { kz = i; break; } }
  P_.kz = kz; P_.post = inside && edge && Math.random() < .3;
  P_.res = out ? 'out' : P_.post ? 'post' : kz === P_.sz ? 'save' : 'goal';
  P_.state = 'fly'; P_.t = 0; P_.played = true; sfx('click');
}
function updatePenal(w, dt) {
  const P_ = w.penal; if (!P_) return; P_.t += dt;
  if (P_.state === 'fly' && P_.t >= .62) {
    P_.state = 'res'; P_.t = 0; P_.shot++;
    if (P_.res === 'goal') { P_.goals++; sfx('fanfare'); } else sfx(P_.res === 'save' ? 'nope' : 'back');
  } else if (P_.state === 'res' && P_.t >= 1.15) {
    if (P_.shot >= 5) { P_.state = 'end'; P_.t = 0; penalPay(w); } else { P_.state = 'aim'; P_.t = 0; }
  }
}
function penalPay(w) {
  const P_ = w.penal, T = w.town, per = 10 + w.level, coins = P_.goals * per, xp = P_.goals * 6; P_.coins = coins; P_.xp = xp; P_.gem = P_.goals === 5;
  w.money += coins; if (xp) addXp(w, xp); if (P_.gem) { w.gems++; w.gemsSeen = true; } T.penalN++;
}
function penalClosePanel(w) { const P_ = w.penal; if (P_ && P_.played && P_.state !== 'end') { w.town.penalN++; toast(w, 'Dejaste la tanda a medias: no hay premio'); } w.penal = null; w.modal = null; sfx('back'); }
function penalPointer(w, x, y) {
  const P_ = w.penal, hit = b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
  if (!P_) { w.modal = null; return; }
  if (hit(penalClose)) { penalClosePanel(w); return; }
  if (P_.state === 'end') { if (hit({ x: PBX.x + PBX.w / 2 - 110, y: PBX.y + PBX.h - 78, w: 220, h: 52 })) { w.penal = null; w.modal = null; sfx('click'); Game.save(); } return; }
  if (P_.state === 'aim' && hit(PBX)) penalShoot(w, x, y);
}
function drawPenal(c, w) {
  const P_ = w.penal; if (!P_) return; const B = PBX, t = P_.t;
  c.fillStyle = 'rgba(12,11,15,.8)'; c.fillRect(-EX, -EY, CW, CH);
  drawPanel(c, B.x, B.y, B.w, B.h, 'PENALES');
  c.save(); rr(c, B.x + 12, B.y + 44, B.w - 24, B.h - 56, 14); c.clip();
  const sky = c.createLinearGradient(0, B.y + 44, 0, B.y + 210); sky.addColorStop(0, '#3b7fd6'); sky.addColorStop(1, '#a9d9ee'); c.fillStyle = sky; c.fillRect(B.x, B.y + 44, B.w, 170);
  for (let i = 0; i < 40; i++) { const px = B.x + 20 + i * 18.6, py = B.y + 140 + (i * 13 % 18); c.fillStyle = ['#e0364a', '#ffc83d', '#3b5bdb', '#fff8ea', '#2fbf71'][i % 5]; c.beginPath(); c.arc(px, py, 6.5, 0, 6.3); c.fill(); }           // la tribuna
  c.fillStyle = '#2f7a3a'; c.fillRect(B.x, B.y + 168, B.w, B.h); for (let k = 0; k < 8; k++) { c.fillStyle = k & 1 ? '#378a44' : '#2f7a3a'; c.fillRect(B.x, B.y + 168 + k * 36, B.w, 36); }
  c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(GOAL.x, GOAL.y, GOAL.w, GOAL.h);
  c.strokeStyle = 'rgba(255,255,255,.4)'; c.lineWidth = 1; c.beginPath(); for (let k = 1; k < 12; k++) { c.moveTo(GOAL.x + k * GOAL.w / 12, GOAL.y); c.lineTo(GOAL.x + k * GOAL.w / 12, GOAL.y + GOAL.h); } for (let k = 1; k < 7; k++) { c.moveTo(GOAL.x, GOAL.y + k * GOAL.h / 7); c.lineTo(GOAL.x + GOAL.w, GOAL.y + k * GOAL.h / 7); } c.stroke();
  // la zona que se señala
  if (P_.state === 'aim') { const z = zoneOf(UI.mx, UI.my), inside = UI.mx >= GOAL.x && UI.mx <= GOAL.x + GOAL.w && UI.my >= GOAL.y && UI.my <= GOAL.y + GOAL.h; if (inside) { UI.cursor = true; const zc = zoneXY(z); c.fillStyle = 'rgba(255,214,90,.2)'; c.fillRect(GOAL.x + (z % 3) * GOAL.w / 3, GOAL.y + (z < 3 ? 0 : GOAL.h / 2), GOAL.w / 3, GOAL.h / 2); c.strokeStyle = P.gold; c.lineWidth = 2; c.strokeRect(GOAL.x + (z % 3) * GOAL.w / 3, GOAL.y + (z < 3 ? 0 : GOAL.h / 2), GOAL.w / 3, GOAL.h / 2); } }
  // el portero
  const kzp = zoneXY(P_.kz), dive = P_.state === 'fly' ? clamp(t / .4, 0, 1) : P_.state === 'res' ? 1 : 0, kx = lerp(GOAL.x + GOAL.w / 2, kzp.x, dive), ky = lerp(GOAL.y + GOAL.h - 8, kzp.y + 50, dive) + (P_.state === 'aim' ? Math.sin(w.t * 5) * 2 : 0);
  c.save(); c.translate(kx, ky); c.rotate((kzp.x - (GOAL.x + GOAL.w / 2)) / GOAL.w * 1.6 * dive); drawLuchador(c, 0, 0, Object.assign({}, KEEPER_LOOK, { state: 'idle', t: w.t, dir: 1, scale: 2.3, pose: dive > .1 ? 'fly' : 'guard' })); c.restore();
  // marco de la portería
  c.strokeStyle = '#ffffff'; c.lineWidth = 7; c.lineCap = 'round'; c.beginPath(); c.moveTo(GOAL.x, GOAL.y + GOAL.h); c.lineTo(GOAL.x, GOAL.y); c.lineTo(GOAL.x + GOAL.w, GOAL.y); c.lineTo(GOAL.x + GOAL.w, GOAL.y + GOAL.h); c.stroke();
  // el balón
  const bx0 = B.x + B.w / 2, by0 = B.y + B.h - 62; let bx = bx0, by = by0, bs = 1;
  if (P_.state === 'fly') { const k = clamp(t / .62, 0, 1); bx = lerp(bx0, P_.tx, k); by = lerp(by0, P_.ty, k) - Math.sin(k * Math.PI) * 60; bs = 1 - k * .55; } else if (P_.state === 'res') { bx = P_.tx; by = P_.ty; bs = .45; }
  c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(bx, by0 + 14 - (P_.state === 'aim' ? 0 : 0), 22 * bs, 7 * bs, 0, 0, 6.3); c.fill();
  c.save(); c.translate(bx, by); c.scale(bs, bs); c.rotate(t * 14); c.fillStyle = '#fff'; c.strokeStyle = P.ink; c.lineWidth = 2.4; c.beginPath(); c.arc(0, 0, 22, 0, 6.3); c.fill(); c.stroke(); c.fillStyle = '#17171c'; c.beginPath(); for (let k = 0; k < 5; k++) { const a = k * 1.2566 - 1.57; c.lineTo(Math.cos(a) * 9, Math.sin(a) * 9); } c.closePath(); c.fill(); for (let k = 0; k < 5; k++) { const a = k * 1.2566 - 1.57; c.beginPath(); c.moveTo(Math.cos(a) * 9, Math.sin(a) * 9); c.lineTo(Math.cos(a) * 20, Math.sin(a) * 20); c.stroke(); } c.restore();
  c.restore();
  txt(c, `GOLES ${P_.goals}`, B.x + 28, B.y + 72, { font: `400 26px ${FONT_DISPLAY}`, color: P.gold, stroke: P.ink, sw: 5 });
  txt(c, `TIRO ${Math.min(5, P_.shot + (P_.state === 'aim' || P_.state === 'fly' ? 1 : 0))} DE 5`, B.x + B.w - 70, B.y + 72, { font: `400 22px ${FONT_DISPLAY}`, align: 'right', color: P.white, stroke: P.ink, sw: 5 });
  const cl = penalClose, ch = UI.hit(cl); if (ch) UI.cursor = true; rr(c, cl.x, cl.y, cl.w, cl.h, 8); c.fillStyle = ch ? '#5a3a8a' : '#2f2c37'; c.fill(); c.lineWidth = 1.6; c.strokeStyle = 'rgba(255,255,255,.35)'; c.stroke();
  c.strokeStyle = P.white; c.lineWidth = 2.4; c.lineCap = 'round'; c.beginPath(); c.moveTo(cl.x + 10, cl.y + 10); c.lineTo(cl.x + 20, cl.y + 20); c.moveTo(cl.x + 20, cl.y + 10); c.lineTo(cl.x + 10, cl.y + 20); c.stroke();
  if (P_.state === 'aim') txt(c, 'Toca una parte de la portería para tirar', B.x + B.w / 2, B.y + B.h - 14, { font: `700 17px ${FONT_UI}`, align: 'center', color: P.cream, stroke: P.ink, sw: 4 });
  if (P_.state === 'res') { const m = { goal: ['¡GOOOL!', '#9af0b8'], save: ['¡LO ATAJÓ!', '#ff8fa0'], post: ['¡AL POSTE!', '#ffd24a'], out: ['¡FUERA!', '#ff8fa0'] }[P_.res]; txt(c, m[0], B.x + B.w / 2, B.y + 300, { font: `400 ${52 + Math.sin(P_.t * 9) * 3}px ${FONT_DISPLAY}`, align: 'center', color: m[1], stroke: P.ink, sw: 8 }); }
  if (P_.state === 'end') {
    c.fillStyle = 'rgba(12,11,15,.78)'; rr(c, B.x + 120, B.y + 120, B.w - 240, 240, 18); c.fill(); c.lineWidth = 3; c.strokeStyle = P.gold; c.stroke();
    txt(c, P_.goals === 5 ? '¡TANDA PERFECTA!' : P_.goals >= 3 ? '¡BUENA TANDA!' : 'SE ACABÓ LA TANDA', B.x + B.w / 2, B.y + 176, { font: `400 34px ${FONT_DISPLAY}`, align: 'center', color: P.gold, stroke: P.ink, sw: 6 });
    txt(c, `${P_.goals} gol${P_.goals === 1 ? '' : 'es'} de 5`, B.x + B.w / 2, B.y + 214, { font: `700 22px ${FONT_UI}`, align: 'center', color: P.white });
    txt(c, P_.coins ? `+${pesos(P_.coins)} · +${P_.xp} XP${P_.gem ? ' · +1 gema' : ''}` : 'Sin premio esta vez', B.x + B.w / 2, B.y + 248, { font: `700 22px ${FONT_UI}`, align: 'center', color: P_.coins ? '#9af0b8' : P.muted });
    drawButton(c, { x: B.x + B.w / 2 - 110, y: B.y + B.h - 78, w: 220, h: 52, label: 'LISTO', style: 'green', size: 24 });
  }
}

/* ---------- Botones y enlaces del pueblo con el resto del juego ---------- */
const TOWN_LEVEL = 4;
const townBtn = () => ({ x: 12 - EX + SL, y: 104, w: 80, h: 30 });
const townAvail = w => w.loc === 'rest' && w.phase === 'play' && !w.tut && w.level >= TOWN_LEVEL && !w.modal && !w.shop && !w.edit && !w.fade;
const backBtn = () => ({ x: 12 - EX + SL, y: 68, w: 118, h: 30 });
const backAvail = w => w.loc !== 'rest' && w.phase === 'play' && !w.modal && !w.shop && !w.fade && !w.hedit;
function drawPillBtn(c, b, label, fill, icon, tip) {
  const hov = UI.hit(b); if (hov) UI.cursor = true;
  c.save(); rr(c, b.x, b.y, b.w, b.h, 10); c.fillStyle = fill; c.fill(); c.lineWidth = 2.6; c.strokeStyle = hov ? P.gold : P.white; c.stroke();
  icon(b.x + 14, b.y + b.h / 2);
  txt(c, label, b.x + 24 + (b.w - 30) / 2, b.y + 20.5, { font: `700 14px ${FONT_UI}`, align: 'center', color: P.white, ls: .6, maxW: b.w - 32 }); c.restore();
  if (hov && tip) drawTip(c, b.x + b.w + 10, b.y, tip);
}
function drawTownBtn(c, w) { const c2 = c; drawPillBtn(c, townBtn(), 'PUEBLO', '#1e4f8a', (x, y) => { c2.fillStyle = '#ffd24a'; c2.strokeStyle = P.ink; c2.lineWidth = 1.3; c2.fillRect(x - 1.5, y - 8, 3, 16); c2.strokeRect(x - 1.5, y - 8, 3, 16); c2.beginPath(); c2.moveTo(x - 7, y - 7); c2.lineTo(x + 6, y - 7); c2.lineTo(x + 9, y - 3.5); c2.lineTo(x + 6, y); c2.lineTo(x - 7, y); c2.closePath(); c2.fill(); c2.stroke(); }, ['El pueblo', 'Cine, boutique, tienda de muebles, casas,', 'parque y canchas de fútbol']); }
function drawBackBtn(c, w) { drawPillBtn(c, backBtn(), w.loc === 'town' ? 'A LA TAQUERÍA' : 'SALIR', '#7a1c28', (x, y) => { c.fillStyle = P.white; c.strokeStyle = P.ink; c.lineWidth = 1.3; c.beginPath(); c.moveTo(x + 6, y - 6); c.lineTo(x - 6, y); c.lineTo(x + 6, y + 6); c.closePath(); c.fill(); c.stroke(); }, null); }
function backClick(w) {
  if (w.loc === 'town') { const sp = doorSpot(BLDG.taq), T = w.town; if (Math.hypot(T.x - sp.x, T.y - sp.y) < .8) enterBuilding(w, 'taq'); else townGoTo(w, sp.x, sp.y, { type: 'enter', id: 'taq' }); }
  else exitBuilding(w);
}
function awayBtns(w) {                                                 // los botones de arriba a la derecha cuando no estás en la taquería
  const find = l => w.btns.find(b => b.label === l), cp = (b, o) => { if (b.x0 === undefined) b.x0 = b.x; return Object.assign({}, b, o); };
  const out = [];
  if (w.loc === 'in' && HOUSES[w.inId] && houseOf(w, w.inId).own) {
    out.push(cp(find('EDITAR'), { label: w.hedit ? 'LISTO' : 'EDITAR', style: w.hedit ? 'green' : 'teal', fn: () => toggleHomeEdit(w) }), cp(find('TIENDA'), { label: 'PINTAR', style: 'gold', fn: () => openPaint(w) }));
  }
  out.push(find('AJUSTES'), find('MENÚ'));
  return out;
}
function awayPointer(w, x, y) {
  if (w.loc === 'town') townPointer(w, x, y); else if (w.loc === 'in') roomPointer(w, x, y);
}
function updateAway(w, dt) {
  if (w.loc === 'town') { updateTownLife(w, dt); updateTown(w, dt); } else if (w.loc === 'in') updateRoom(w, dt);
}
function drawAway(c, w) { if (w.loc === 'town') drawTown(c, w); else drawRoomScene(c, w); }
function drawFadeOverlay(c, w) {
  const f = w.fade; if (!f) return; const k = f.t / f.dur, a = k < .5 ? k * 2 : (1 - k) * 2;
  c.fillStyle = `rgba(6,5,10,${clamp(a, 0, 1).toFixed(3)})`; c.fillRect(-EX, -EY, CW, CH);
}

/* ---------- Escena completa ---------- */
function drawWorld(c, w) {
  if (w.loc !== 'rest') drawAway(c, w); else drawRestScene(c, w);
  drawWorldOverlays(c, w);
}
function drawRestScene(c, w) {
  c.save(); camApply(c);                                          // zoom y desplazamiento: solo el escenario (la interfaz queda fija)
  c.save();                                                       // el temblor de la quebradora sacude el escenario (no la interfaz)
  if (w.shake > 0) { const m = w.shake / .5 * 5; c.translate(rand(-m, m), rand(-m, m)); }
  drawGround(c);
  drawFloor(c);
  if (w.lot) drawLotGround(c, w.lot, 1, w);
  if (w.edit) drawEditFloor(c, w);

  // Y-sort: cada elemento entra a una lista con su profundidad (isoX + isoY) y se ordena antes de dibujar.
  // Los actores que aún están fuera del muro (isoY < .15) se dibujan antes que la pared; los de adentro, después.
  const outside = [], inside = [];
  EXT_PROPS.forEach(p => { if (!w.lot || p.x < w.lot.c - .6 || p.x > w.lot.c + LOT_W + .6 || p.y < w.lot.r - .6 || p.y > w.lot.r + LOT_H + .6) outside.push({ d: p.x + p.y, draw: () => p.draw(c, p.x, p.y, w.t) }); });          // (lo que estorbaría en el estacionamiento no se dibuja)
  if (w.lot) inside.push({ d: w.lot.c + LOT_W + w.lot.r + 1.5, draw: () => drawLotSign(c, w.lot, w) });
  (w.cars || []).forEach(car => inside.push({ d: car.x + car.y + .35, draw: () => drawCar(c, car, w) }));
  if (w.event) EV_PROPS.forEach(([x, y]) => outside.push({ d: x + y, draw: () => drawEventProp(c, w.event.deco, x, y, w.t) }));

  w.furn.forEach(it => {                                          // todo el mobiliario colocado entra a la lista con su profundidad
    if (it.type === 'table') {
      const tm = tableMid(it), td = tm[0] + tm[1];
      inside.push({ d: td, draw: () => drawTable(c, it, w) });
      it.seats.forEach(s => inside.push({ d: s.outer < 0 ? td - .6 : s.gx + s.gy, draw: () => drawChair(c, s) }));
    } else inside.push({ d: furnDepth(it), draw: () => drawFurn(c, w, it) });
  });
  inside.push({ d: DOOR.ix + .3, draw: () => drawDoorLeaves(c, w.doorA) });
  (w.outs || []).forEach(o => { if (o.type === 'farol') outside.push({ d: o.c + o.r + .5, draw: () => drawLamp(c, o.c + .5, o.r + .5, w.t) }); else inside.push({ d: o.c + o.r + 1.2, draw: () => drawCartel(c, w, o.c, o.r) }); });
  if (w.lot) lotLamps(w.lot).forEach(q => inside.push({ d: q.x + q.y, draw: () => drawLamp(c, q.x, q.y, w.t) }));
  w.customers.forEach(cu => {
    if (cu.held) return;                                            // su mesa está en la mano del jugador
    let d = cu.x + cu.y;
    if (cu.seated) { const s = cu.seat, tm = tableMid(s.tb), td = tm[0] + tm[1]; d = s.outer < 0 ? td + .1 : s.gx + s.gy + .05; }
    if (cu.state === 'slam') d = w.novato.x + w.novato.y + .3;
    const behind = cu.y < .15 || (cu.x < -.2 && cu.y < ROWS);                      // (quien camina por detrás del local queda tapado por la pared)
    (behind ? outside : inside).push({ d, draw: () => drawCustomer(c, cu, w) });
    if (cu.state === 'brawl' && cu.br && cu.br.lead) (behind ? outside : inside).push({ d: d + .7, draw: () => drawBrawlCloud(c, w, cu) });
    if (cu.state === 'claw') inside.push({ d: d + .5, draw: () => drawClawCust(c, cu, w) });
  });
  const nv = w.novato;
  inside.push({ d: nv.resting ? nv.x + nv.y + .15 : nv.x + nv.y, draw: () => drawNovatoActor(c, w) });
  w.staff.forEach(wt => (wt.y < .15 && !wt.resting ? outside : inside).push({ d: wt.resting ? wt.x + wt.y + .15 : wt.x + wt.y, draw: () => drawNovatoActor(c, w, wt, LUCHADORES[wt.look]) }));
  w.guards.forEach(g => outside.push({ d: g.x + g.y, draw: () => drawGuard(c, w, g) }));
  w.chefs.forEach(ch => (ch.y < .15 ? outside : inside).push({ d: ch.x + ch.y, draw: () => drawChef(c, w, ch) }));
  if (DECO.arena) { const g = ARENA.ring; inside.push({ d: g.c + g.w / 2 + g.r + g.h / 2 - .2, draw: () => drawRing(c, w) }); }

  outside.sort((a, b) => a.d - b.d).forEach(i => i.draw());
  drawNight(c, w);                                                 // la calle se oscurece con la hora (el local sigue iluminado)
  drawEventSky(c, w);
  drawWalls(c, w);
  inside.sort((a, b) => a.d - b.d).forEach(i => i.draw());
  drawLights(c, w);                                                // las luces de los faroles, sobre el piso y la gente
  drawEditGhost(c, w);

  // globos de pedido, estamina y carteles
  w.customers.forEach(cu => { if (cu.state === 'wait' && !cu.held) drawBubble(c, cu, w.t); });
  w.queue.forEach(cu => drawQueueBar(c, cu, w)); drawQueueTag(c, w);
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
  }
  c.restore();                                                    // fin de la cámara
  for (const p of w.parts) if (p.type === 'fly') drawCoin(c, p.cx, p.cy, 9, w.t * 3);          // la moneda que vuela al HUD va en coordenadas de pantalla
  drawDong(c, w);
}
function drawWorldOverlays(c, w) {
  drawHud(c, w);
  if (w.phase === 'play' && !w.shop && !w.modal && !(w.tut && (TUT[w.tut.s] === 'intro' || TUT[w.tut.s] === 'outro'))) zoomBtns().forEach(b => drawButton(c, b));
  if (mapAvail(w)) drawMapBtn(c, w);
  if (openAvail(w)) drawOpenBtn(c, w);
  if (townAvail(w)) drawTownBtn(c, w);
  if (backAvail(w)) drawBackBtn(c, w);
  if (handsOn(w)) drawHands(c, w);
  if (w.phase === 'play') {
    if (!w.shop && !w.edit && w.loc === 'rest') drawTooltips(c, w);
    if (w.panel && !w.shop && !w.edit) drawCookPanel(c, w);
    if (w.shop) drawShop(c, w);
    if (w.edit) drawEditPanel(c, w);
    if (w.hedit) drawHomeEditPanel(c, w);
    if (w.modal === 'sign') drawSignEditor(c, w); else if (w.modal === 'claw') drawClaw(c, w); else if (w.modal === 'cal') drawCalendar(c, w); else if (w.modal === 'lvl') drawLevelUp(c, w); else if (w.modal === 'map') drawMap(c, w); else if (w.modal === 'fight') drawFight(c, w); else if (w.modal === 'dlg') drawDialog(c, w); else if (w.modal === 'catalog') drawCatalog(c, w); else if (w.modal === 'paint') drawPaint(c, w); else if (w.modal === 'penal') drawPenal(c, w);
  }

  // pistas y avisos (con el tutorial en curso, la guía es el cuadro del tutorial)
  if (w.tut && w.phase === 'play') drawTutorial(c, w);
  const clawScene = (w.modal === 'claw' && w.claw && w.claw.phase !== 'menu') || w.modal === 'lvl' || w.modal === 'cal' || w.modal === 'map' || w.modal === 'fight' || w.modal === 'dlg' || w.modal === 'catalog' || w.modal === 'paint' || w.modal === 'penal';      // (sin pistas ni avisos encima de esas ventanas)
  const hint = w.tut || clawScene || w.shop ? null : getHint(w);
  // los textos largos se encogen para caber en el lienzo; el aviso sube sobre la pista para que nunca se tapen
  const fitSize = (s, weight, size, room = 56) => { c.font = `${weight} ${size}px ${FONT_UI}`; const mw = c.measureText(s).width; return mw > W - room ? Math.max(11, Math.floor(size * (W - room) / mw * 10) / 10) : size; };
  const hon = handsOn(w), hy = hon ? 494 : 558, hx = hon ? 62 : 14;            // con la barra de manos abajo, la pista y los avisos suben (y la pista deja libres los botones de zoom)
  if (hint) {
    const fs = fitSize(hint, 600, 18, hx + 42); c.font = `600 ${fs}px ${FONT_UI}`;
    const tw = c.measureText(hint).width + 28;
    c.fillStyle = 'rgba(17,16,20,.82)'; rr(c, hx, hy, tw, 28, 14); c.fill();
    c.strokeStyle = 'rgba(255,200,61,.6)'; c.lineWidth = 1.5; c.stroke();
    txt(c, hint, hx + 14, hy + 19, { font: `600 ${fs}px ${FONT_UI}`, color: P.cream });
  }
  if (w.toasts.length && !clawScene) {
    const t = w.toasts[0], fs = fitSize(t.msg, 700, 18), ty = hint ? hy - 34 : hy;
    c.font = `700 ${fs}px ${FONT_UI}`;
    const tw = c.measureText(t.msg).width + 28;
    c.save(); c.globalAlpha = clamp(t.t, 0, 1);
    const tx = (w.panel || w.edit || w.shop) ? 14 : W - 14 - tw;                // con un panel abierto a la derecha, el aviso sale a la izquierda para no taparlo
    c.fillStyle = P.red; rr(c, tx, ty, tw, 28, 14); c.fill(); c.strokeStyle = P.gold; c.lineWidth = 2; c.stroke();
    txt(c, t.msg, tx + tw / 2, ty + 20, { font: `700 ${fs}px ${FONT_UI}`, align: 'center', color: P.white });
    c.restore();
  }
  if (w.banner > 0 && w.phase === 'play' && !w.modal) {
    const a = clamp(w.banner, 0, 1), ev = w.event, by = ev ? 232 : 250;
    c.save(); c.globalAlpha = a;
    c.fillStyle = 'rgba(17,16,20,.7)'; c.fillRect(-EX, by, CW, ev ? 132 : 100);
    txt(c, `DÍA ${w.day}`, 480, by + 56, { font: `400 54px ${FONT_DISPLAY}`, align: 'center', color: P.gold, stroke: P.ink, sw: 8 });
    txt(c, `${fmtDate(w.day)} · 8:00 AM · ¡Abre la taquería!`, 480, by + 85, { font: `700 24px ${FONT_UI}`, align: 'center', color: P.cream, ls: 2 });
    if (ev) txt(c, ev.name.toUpperCase(), 480, by + 118, { font: `400 ${fitDisplay(c, ev.name.toUpperCase(), 760, 28)}px ${FONT_DISPLAY}`, align: 'center', color: ev.col, stroke: P.ink, sw: 5 });
    c.restore();
  }

  if (w.phase === 'summary') drawSummary(c, w);
  if (w.phase === 'over') drawOver(c, w);
  drawFadeOverlay(c, w);
}

function drawHud(c, w) {
  let g = c.createLinearGradient(0, 0, 0, HUD);
  g.addColorStop(0, '#2b2935'); g.addColorStop(1, '#100f11');
  c.fillStyle = g; c.fillRect(-EX, -EY, CW, HUD + EY);
  { const n = RAINBOW.length, sw = CW / n; for (let i = 0; i < n; i++) { c.fillStyle = RAINBOW[i]; c.fillRect(-EX + i * sw, HUD - 4, sw + 1, 4); } }       // tira de colores del logotipo
  c.save(); c.translate(-GL, 0);                                                       // grupo izquierdo del HUD: pegado al borde seguro izquierdo
  txt(c, 'DÍA ' + w.day, 18, 29, { font: `400 22px ${FONT_DISPLAY}`, color: P.gold, stroke: P.ink, sw: 4 });
  // nivel y experiencia
  const need = xpNeed(w.level), xr = clamp(w.xp / need, 0, 1), lf = w.levelFlash > 0;
  c.save();
  if (lf) { c.shadowColor = '#7cf0a8'; c.shadowBlur = 10 + Math.sin(w.t * 14) * 4; }
  rr(c, 18, 36, 150, 17, 8.5); c.fillStyle = '#16151b'; c.fill(); c.lineWidth = 2; c.strokeStyle = lf ? '#9af0b8' : P.violet; c.stroke();
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
  c.restore();
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
  const ch = UI.hit(CLOCKBTN); if (ch) { UI.cursor = true; rr(c, CLOCKBTN.x, CLOCKBTN.y, CLOCKBTN.w, CLOCKBTN.h, 8); c.fillStyle = 'rgba(255,255,255,.1)'; c.fill(); }
  txt(c, closed ? 'CERRADO' : fmtDate(w.day), 612, 17, { font: `700 11px ${FONT_UI}`, color: closed ? '#ff8fa0' : w.event ? w.event.col : P.muted, ls: 1.5 });
  { const ix = 672, iy = 8;                                                    // iconito de calendario
    rr(c, ix, iy, 13, 12, 2.5); c.fillStyle = P.white; c.fill(); c.lineWidth = 1.2; c.strokeStyle = P.ink; c.stroke();
    c.fillStyle = w.event ? w.event.col : P.red; c.fillRect(ix, iy, 13, 4);
    if (w.event) { c.fillStyle = P.gold; star(c, ix + 11, iy - 1, 4.5, 2); c.fill(); c.lineWidth = 1; c.stroke(); } }
  if (night || closed) {                                                       // luna
    c.fillStyle = '#e8eefc'; c.beginPath(); c.arc(598, 34, 7.5, 0, 6.3); c.fill();
    c.fillStyle = '#26124a'; c.beginPath(); c.arc(602, 31.5, 6.4, 0, 6.3); c.fill();
  } else {                                                                     // sol
    c.strokeStyle = '#ffd23a'; c.lineWidth = 1.8; c.lineCap = 'round'; c.beginPath();
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; c.moveTo(598 + Math.cos(a) * 8.5, 34 + Math.sin(a) * 8.5); c.lineTo(598 + Math.cos(a) * 11.5, 34 + Math.sin(a) * 11.5); }
    c.stroke(); c.fillStyle = '#ffc83d'; c.beginPath(); c.arc(598, 34, 6, 0, 6.3); c.fill();
  }
  txt(c, fmtHour(hr), 612, 40, { font: `700 20px ${FONT_UI}`, color: closed ? '#ff8fa0' : P.white, stroke: P.ink, sw: 4 });
  rr(c, 612, 46, 68, 6, 3); c.fillStyle = '#16151b'; c.fill();
  rr(c, 612, 46, Math.max(5, 68 * prog), 6, 3); c.fillStyle = night ? '#7b6cff' : '#ffc83d'; c.fill();
  (w.loc === 'rest' ? w.btns : awayBtns(w)).forEach(b => { if (b.x0 === undefined) b.x0 = b.x; b.x = b.x0 + GR; drawButton(c, b); });       // botones: pegados al borde seguro derecho
}

function getHint(w) {
  if (w.phase !== 'play') return null;
  if (w.loc !== 'rest') return townHint(w);
  const n = w.novato, waiting = w.customers.filter(cu => cu.state === 'wait');
  if (w.panel) return w.panel === 'fridge' ? 'Prepara micheladas aquí: cada tanda cuesta y rinde tarros' : 'Elige qué cocinar y cuántas porciones: una tanda chica cuesta menos y no desperdicias';
  if (w.shop) return 'Tienda: compra mobiliario, equipamiento y personal';
  if (w.edit) return w.edit.held ? (UI.touch ? 'Toca una loseta verde (otra vez para soltar) · GIRAR · SOLTAR devuelve' : 'Loseta verde: soltar · R o GIRAR: girar · SOLTAR o Esc: devolverlo')
    : (UI.touch ? 'Modo edición: toca un mueble para levantarlo, o saca uno del inventario' : 'Modo edición: toca un mueble para levantarlo (R lo gira), o saca uno del inventario');
  if (!LAYOUT.comals.length) return 'Abre la TIENDA y compra un comal para empezar a cocinar';
  if (!SEATS.length) return 'Compra una mesa en la TIENDA para que lleguen clientes';
  if (!SEATS.some(s => s.tb.chair)) return 'Tus mesas no tienen sillas: compra un juego en la TIENDA (pestaña SILLAS) y ponlo en EDITAR';
  if (n.busy) return '¡QUEBRADORA!';
  if (n.furia) return '¡Rabioso! Tócalo para que vaya al vestidor antes de que azote a un cliente';
  if (n.resting) return 'Tomando suero: recupera energía poco a poco (tócalo para volver al trabajo)';
  if (n.stamina <= 0) return 'Sin energía: tócalo para que tome suero o se pondrá rabioso';
  if (n.stamina < maxStamina(w) * .25) return 'El Novato está cansado: tócalo para que vaya a tomar suero';
  if (w.coins.length) return '¡Pulsa las monedas de la mesa para cobrar!';
  if (w.queue && w.queue.length >= 2) return GUARD_IDS.some(id => w.level >= GUARDS[id].level && !w.guards.some(g => g.id === id) && w.money >= GUARDS[id].price) ? 'Hay fila afuera: contrata un CADENERO en la TIENDA (pestaña PERSONAL) para que la gente espere más' : 'Hay fila afuera: si esperan mucho se pelean y pierdes máscaras. ¡Atiende rápido o compra más mesas!';
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
  const hire = HIRE_IDS.find(id => w.level >= STAFF[id].level && !w.staff.some(m => m.id === id) && w.money >= STAFF[id].price);
  if (hire) return `Ya puedes contratar a ${STAFF[hire].name} en la TIENDA (${pesos(STAFF[hire].price)})`;
  { const rv = RIVALS.find(r => rivalState(w, r) === 'ok'); if (rv && !w.tut) return `Ya puedes atacar ${rv.name}: abre el MAPA (botón de la izquierda o tecla M)`; }
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
    const tabs = shopTabs(w), tab = type === 'table' ? 'tables' : 'furn';
    if (w.shopTab !== tab) return { rect: shopTabBtn(w, tabs.findIndex(x => x[0] === tab)) };
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
      'Algunos visitantes especiales regalan GEMAS para decoración exclusiva (con más máscaras de reputación llegan más seguido). Si el Novato se cansa, tócalo para que descanse en la banca.',
      'Para ver mejor el local: rueda del ratón, botones + − o pellizca con dos dedos; arrastra para moverlo.'];
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
    c.fillStyle = 'rgba(12,11,15,.7)'; c.fillRect(-EX, HUD, CW, CH - EY - HUD);
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
    else if (g.circle) { camApply(c); c.beginPath(); c.arc(g.circle.x, g.circle.y, g.circle.r + 4 * k, 0, 6.3); c.stroke(); }          // (círculos y losetas son del mundo: siguen al zoom)
    else if (g.tiles) { camApply(c); g.tiles.forEach(([a, b]) => { groundQuad(c, a, b, a + 1, b + 1); c.fillStyle = `rgba(255,214,90,${.25 + .3 * k})`; c.fill(); c.stroke(); }); }
    c.restore();
  }
  const PW = 520, lines = tx.slice(1).flatMap(s => wrapLines(c, s, PW - 36, `600 16px ${FONT_UI}`)), PH = 40 + lines.length * 19, px = 14, py = 70;
  c.save(); c.fillStyle = 'rgba(0,0,0,.4)'; rr(c, px + 3, py + 5, PW, PH, 14); c.fill();
  c.fillStyle = 'rgba(31,29,37,.96)'; rr(c, px, py, PW, PH, 14); c.fill(); c.lineWidth = 3; c.strokeStyle = P.gold; c.stroke();
  txt(c, tx[0], px + 16, py + 24, { font: `700 18px ${FONT_UI}`, color: P.gold, ls: .5 });
  lines.forEach((l, i) => txt(c, l, px + 16, py + 44 + i * 19, { font: `600 16px ${FONT_UI}`, color: P.cream }));
  c.restore();
  drawButton(c, tutBtnSkip);
}

function drawSummary(c, w) {
  const pay = w.pay, crew = weeklyWage(w), PY = 86, PH = 470;
  c.fillStyle = 'rgba(8,8,12,.75)'; c.fillRect(-EX, 60, CW, CH - EY - 60);
  drawPanel(c, 240, PY, 480, PH, `DÍA ${w.day} COMPLETADO`);
  const rows = [['Clientes servidos', String(w.dayServed), P.gold], ['Ventas del día', pesos(w.dayEarned), P.gold], ['Gastos en ingredientes', '-' + pesos(w.dayCost), '#ff8fa0']];
  if (pay && pay.total) rows.push(['Sueldos de la semana', '-' + pesos(pay.total), '#ff8fa0']);
  rows.push(['Caja total', pesos(w.money), P.gold]);
  rows.forEach((r, i) => {
    const y = PY + 76 + i * 30;
    txt(c, r[0], 282, y, { font: `600 22px ${FONT_UI}`, color: P.cream, maxW: 260 });
    txt(c, r[1], 678, y, { font: `700 26px ${FONT_UI}`, align: 'right', color: r[2], stroke: P.ink, sw: 4, maxW: 150 });
    c.strokeStyle = 'rgba(255,255,255,.14)'; c.lineWidth = 1; c.beginPath(); c.moveTo(282, y + 9); c.lineTo(678, y + 9); c.stroke();
  });
  const ry = PY + 76 + rows.length * 30 + 4;
  txt(c, 'Reputación', 282, ry, { font: `600 22px ${FONT_UI}`, color: P.cream });
  for (let i = 0; i < 5; i++) {
    const x = 604 + i * 15 - 30, steps = Math.ceil(clamp(w.rep - i, 0, 1) * 3 - 1e-6);
    c.save(); c.globalAlpha = .3; drawMask(c, x, ry - 8, 7, MASKS.gray); c.restore();
    if (steps > 0) { c.save(); c.globalAlpha = [0, .38, .68, 1][steps]; drawMask(c, x, ry - 8, 7, MASKS.ring); c.restore(); }
  }
  let y = ry + 28;
  txt(c, w.perfect ? '¡Día perfecto! Sin clientes enojados: +1 máscara' : (w.dayAngry ? `${w.dayAngry} cliente(s) se fueron enojados` : 'Todos los clientes quedaron contentos'),
    480, y, { font: `600 18px ${FONT_UI}`, align: 'center', color: w.perfect ? '#9af0b8' : P.muted, maxW: 430 });
  const line = (s2, col) => { y += 24; txt(c, s2, 480, y, { font: `600 17px ${FONT_UI}`, align: 'center', color: col, maxW: 430 }); };
  const sp = w.spoil;
  if (sp && sp.active) {                                                                                   // sobrantes: guardados en el refri o echados a perder
    if (sp.kept + sp.lost === 0) line('No sobró comida: ¡todo se vendió!', '#9af0b8');
    else {
      if (sp.kept) line(`Guardado en el refri de sobrantes: ${sp.kept} porciones`, '#9ff0ff');
      if (sp.lost) line(sp.fridge ? `No cupo: ${sp.lost} porciones echadas a perder (-${pesos(sp.loss)})` : `Sin refri de sobrantes: ${sp.lost} porciones echadas a perder (-${pesos(sp.loss)})`, '#ff8fa0');
    }
  }
  if (pay && pay.quit.length) line(`Se fue por falta de pago: ${pay.quit.join(', ')}`, '#ff8fa0');
  else if (pay && pay.total) line(`Nómina pagada a ${pay.paid.length} persona(s): ${pesos(pay.total)}`, '#ffd9a0');
  if (crew > 0) { const k = daysToPay(w.day + 1); line(k === 0 ? `Mañana se paga la nómina: ${pesos(crew)}` : `Próxima nómina en ${k + 1} días de juego: ${pesos(crew)}`, k === 0 ? '#ffc83d' : P.muted); }
  { const nx = eventFor(w.day + 1), tm = `Mañana: ${fmtDate(w.day + 1)}${nx ? ' — ' + nx.name : ''}`;
    txt(c, w.event ? `${fmtDate(w.day)} · ${w.event.name}` : fmtDate(w.day), 480, PY + 48, { font: `700 16px ${FONT_UI}`, align: 'center', color: w.event ? w.event.col : P.muted, ls: 1, maxW: 430 });
    txt(c, `Partida guardada · ${tm}`, 480, PY + PH - 78, { font: `600 14px ${FONT_UI}`, align: 'center', color: nx ? nx.col : P.muted, ls: .5, maxW: 430 }); }
  w.overlay.forEach(b => drawButton(c, b));
}
function drawOver(c, w) {
  c.fillStyle = 'rgba(15,14,18,.8)'; c.fillRect(-EX, 60, CW, CH - EY - 60);
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
const scenes = { INTRO: IntroScene, MENU: Menu, JUGANDO: Game, AJUSTES: SettingsScene, PARTIDAS: PartidasScene, SALIR: ByeScene };
let state = 'INTRO', clock = 0;
function setState(name, arg) {
  state = name;
  Music.want = name === 'INTRO' ? null : name === 'JUGANDO' || (name === 'AJUSTES' && arg && arg.from === 'JUGANDO') ? 'juego' : 'menu';     // cada escena tiene su canción
  const s = scenes[name];
  if (s.enter) s.enter(arg);
}

function toLocal(e) {                                                 // de la pantalla al diseño de 960 x 600 (el lienzo ensanchado se centra: se resta EX)
  const r = canvas.getBoundingClientRect();
  UI.mx = (e.clientX - r.left) * CW / r.width - EX;
  UI.my = (e.clientY - r.top) * CH / r.height - EY;
}
/* =========================================================
   ENTRADAS UNIFICADAS: táctil, teclado + ratón y mando (Xbox / PlayStation / genéricos con mapeo estándar)
   El esquema activo (Input.mode) cambia solo en cuanto se usa otro dispositivo:
     'touch' = dedo o lápiz (botones con margen extra, edición con dos toques, botones de zoom en pantalla)
     'mouse' = teclado y ratón (rueda = zoom, arrastrar = mover la cámara, R = girar, F = pantalla completa, Esc = ajustes)
     'pad'   = mando: stick izquierdo = cursor, A = tocar, B / Start = atrás, X = girar, LB / RB (o gatillos) = zoom, stick derecho = mover la cámara,
               cruceta = moverse por los menús, R3 = zoom 1:1. El cursor se dibuja en pantalla y los botones táctiles de zoom se ocultan.
   Todo se traduce a las mismas funciones que ya usa el puntero (pointerDown / pointerMove / pointerUp / key): la lógica del juego no sabe qué aparato se usa.
   ========================================================= */
const Input = {
  mode: 'mouse', pad: false, hint: 0, prev: [], cx: W / 2, cy: H / 2, hold: false, rep: 0, repKey: '',
  setMode(m) {
    if (this.mode === m) return;
    this.mode = m; UI.touch = m === 'touch'; UI.pad = m === 'pad';
    if (m === 'pad') { UI.kb = false; this.cx = clamp(UI.mx > -90 ? UI.mx : W / 2, -EX + 6, CW - EX - 6); this.cy = clamp(UI.my > -90 ? UI.my : H / 2, -EY + 6, CH - EY - 6); }
    else if (this.hold) { this.hold = false; UI.down = false; }
    try { document.documentElement.classList.toggle('nocursor', m === 'pad'); } catch (e) {}
  },
  key(k, repeat) {                                                 // una tecla "virtual" para la escena activa
    const sc = scenes[state];
    return sc.key ? sc.key({ key: k, code: k, repeat: !!repeat, altKey: false, ctrlKey: false, shiftKey: false, preventDefault() {} }) : false;
  },
  canPlay() { const w = Game.w; return state === 'JUGANDO' && w && w.phase === 'play' && !w.shop && !w.modal && !(w.tut && (TUT[w.tut.s] === 'intro' || TUT[w.tut.s] === 'outro')); },
  poll(dt) {
    if (this.hint > 0) this.hint -= dt;
    let gp = null;
    try { const l = navigator.getGamepads ? navigator.getGamepads() : []; for (let i = 0; i < l.length; i++) if (l[i] && l[i].connected) { gp = l[i]; break; } } catch (e) {}
    if (!gp) { if (this.pad) { this.pad = false; this.prev = []; if (this.mode === 'pad') this.setMode('mouse'); } return; }
    if (!this.pad) { this.pad = true; this.hint = 8; }
    const cur = [], dz = v => Math.abs(v || 0) < .2 ? 0 : v;
    for (let i = 0; i < 17; i++) cur[i] = !!(gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > .6));
    const down = i => cur[i] && !this.prev[i], up = i => !cur[i] && this.prev[i];
    const lx = dz(gp.axes[0]), ly = dz(gp.axes[1]), rx = dz(gp.axes[2]), ry = dz(gp.axes[3]);
    const act = cur.some((v, i) => v && !this.prev[i]) || Math.hypot(lx, ly) > .45 || Math.hypot(rx, ry) > .45;     // el "drift" leve de un stick no cuenta como uso
    if (act) this.setMode('pad');
    if (this.mode !== 'pad') { this.prev = cur; return; }
    const sc = scenes[state], playing = this.canPlay();
    // cursor con el stick izquierdo (más rápido cuanto más se inclina)
    const m = Math.hypot(lx, ly);
    let moved = false;
    if (m > 0) {
      const sp = (UI.small ? 420 : 560) * Math.pow(Math.min(1, m), 1.7);
      this.cx = clamp(this.cx + lx / m * sp * dt, -EX + 4, CW - EX - 4); this.cy = clamp(this.cy + ly / m * sp * dt, -EY + 4, CH - EY - 4); moved = true;
    }
    // cámara: stick derecho = mover, LB / RB / gatillos = zoom, R3 = 1:1
    if (playing) {
      const rm = Math.hypot(rx, ry);
      if (rm > 0) { Cam.px -= rx * 420 * dt; Cam.py -= ry * 420 * dt; camClamp(); moved = true; }
      const z = ((cur[5] || cur[7]) ? 1 : 0) - ((cur[4] || cur[6]) ? 1 : 0);
      if (z) { camZoomAt(Math.exp(z * 1.15 * dt), CAMC.x, CAMC.y); moved = true; }
      if (down(11)) camReset();
    }
    if (moved) { UI.mx = this.cx; UI.my = this.cy; if (m > 0) UI.kb = false; sc.pointerMove(this.cx, this.cy); }
    else if (UI.mx !== this.cx || UI.my !== this.cy) { UI.mx = this.cx; UI.my = this.cy; }
    // A = tocar (si la última acción fue con la cruceta, A equivale a Enter)
    if (down(0)) {
      Sfx.unlock();
      if (UI.kb) this.key('Enter'); else { this.hold = true; UI.down = true; UI.mx = this.cx; UI.my = this.cy; sc.pointerDown(this.cx, this.cy); }
    }
    if (up(0) && this.hold) { this.hold = false; UI.down = false; sc.pointerUp(this.cx, this.cy); }
    if (down(1) || down(9)) this.key('Escape');                     // B o Start
    if (down(2)) this.key('r');                                     // X = girar el mueble
    if (down(3) && playing) this.key('Tab');                        // Y = cambiar de mano
    if (down(8)) { if (playing) camReset(); }                       // Select = 1:1
    // cruceta = flechas (con repetición al mantener)
    const dir = cur[12] ? 'ArrowUp' : cur[13] ? 'ArrowDown' : cur[14] ? 'ArrowLeft' : cur[15] ? 'ArrowRight' : '';
    if (dir) {
      if (dir !== this.repKey) { this.repKey = dir; this.rep = .38; this.key(dir); }
      else if ((this.rep -= dt) <= 0) { this.rep = .12; this.key(dir, true); }
    } else this.repKey = '';
    this.prev = cur;
  },
  draw(c) {                                                         // cursor del mando y chuleta de botones
    if (this.hint > 0 && (this.pad || this.mode === 'pad')) {
      const a = Math.min(1, this.hint), msg = 'MANDO · Stick izq.: cursor · A: tocar · B: atrás · X: girar · Y: mano · LB / RB: zoom · Stick der.: mover cámara';
      c.save(); c.globalAlpha = a; c.font = `600 15px ${FONT_UI}`;
      const w = Math.min(CW - 24, c.measureText(msg).width + 34), x = W / 2 - w / 2, y = HUD + 10;
      c.fillStyle = 'rgba(15,14,18,.88)'; rr(c, x, y, w, 28, 14); c.fill(); c.lineWidth = 2; c.strokeStyle = P.gold; c.stroke();
      txt(c, msg, W / 2, y + 7, { font: `600 15px ${FONT_UI}`, align: 'center', color: P.cream });
      c.restore();
    }
    if (this.mode !== 'pad') return;
    c.save(); c.translate(this.cx, this.cy);
    c.lineWidth = 5; c.strokeStyle = P.ink; c.beginPath(); c.arc(0, 0, UI.down ? 8 : 11, 0, 6.3); c.stroke();
    c.lineWidth = 2.5; c.strokeStyle = UI.down ? P.gold : P.cream; c.beginPath(); c.arc(0, 0, UI.down ? 8 : 11, 0, 6.3); c.stroke();
    c.fillStyle = P.ink; c.beginPath(); c.arc(0, 0, 4.5, 0, 6.3); c.fill(); c.fillStyle = P.gold; c.beginPath(); c.arc(0, 0, 2.6, 0, 6.3); c.fill();
    c.restore();
  }
};
window.addEventListener('gamepadconnected', () => { Input.hint = 8; });
window.addEventListener('gamepaddisconnected', () => { Input.hint = 0; });
// Botón / gesto "atrás" de Android (lo llama la parte nativa): Esc en el juego. Devuelve false en el menú principal para que la app se cierre.
window.__onBack = () => { try { return !!Input.key('Escape'); } catch (e) { return false; } };

// Pellizco con dos dedos: zoom y desplazamiento del local (solo mientras se juega)
const Ptr = new Map(), Pinch = { active: false, d0: 1, z0: 1, wp: null };
function pinchStart() {
  const a = [...Ptr.values()];
  Pinch.active = true; Pinch.d0 = Math.max(20, Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y)); Pinch.z0 = Cam.z;
  Pinch.wp = camWorld((a[0].x + a[1].x) / 2, (a[0].y + a[1].y) / 2);
  Game.pend = null;
}
function pinchMove() {
  const a = [...Ptr.values()]; if (a.length < 2) return;
  const d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y), mx = (a[0].x + a[1].x) / 2, my = (a[0].y + a[1].y) / 2;
  Cam.z = clamp(Pinch.z0 * d / Pinch.d0, Cam.MIN, Cam.MAX);
  Cam.px = mx - CAMC.x - (Pinch.wp.x - CAMC.x) * Cam.z; Cam.py = my - CAMC.y - (Pinch.wp.y - CAMC.y) * Cam.z; camClamp();
}
canvas.addEventListener('pointerdown', e => {
  Input.setMode(e.pointerType === 'touch' || e.pointerType === 'pen' ? 'touch' : 'mouse');
  try { canvas.focus({ preventScroll: true }); } catch (err) {}      // para que el teclado (R, Esc) llegue siempre al juego
  toLocal(e); UI.down = true; Sfx.unlock();
  Ptr.set(e.pointerId, { x: UI.mx, y: UI.my });
  try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
  e.preventDefault();
  if (Ptr.size === 2 && state === 'JUGANDO') { pinchStart(); return; }
  if (Ptr.size > 1) return;
  scenes[state].pointerDown(UI.mx, UI.my);
});
canvas.addEventListener('pointermove', e => {
  if (Input.mode === 'pad') { if (e.pointerType !== 'mouse' || Math.abs(e.movementX) + Math.abs(e.movementY) < 2) return; Input.setMode('mouse'); }
  else if (e.pointerType === 'mouse' && Input.mode !== 'mouse') Input.setMode('mouse');
  toLocal(e);
  if (Ptr.has(e.pointerId)) Ptr.set(e.pointerId, { x: UI.mx, y: UI.my });
  if (Pinch.active) { pinchMove(); return; }
  scenes[state].pointerMove(UI.mx, UI.my);
});
canvas.addEventListener('wheel', e => {                              // rueda del ratón (o pellizco del trackpad): zoom hacia el cursor
  if (state !== 'JUGANDO') return;
  const w = Game.w; if (!w || w.phase !== 'play' || w.shop || w.modal) return;
  e.preventDefault(); toLocal(e);
  camZoomAt(Math.exp(-clamp(e.deltaY, -120, 120) * (e.ctrlKey ? .012 : .0016)), UI.mx, UI.my);
}, { passive: false });
const release = e => {
  toLocal(e); Ptr.delete(e.pointerId);
  if (Ptr.size < 2) Pinch.active = false;
  if (Ptr.size > 0) return;                                          // todavía queda otro dedo apoyado
  UI.down = false; scenes[state].pointerUp(UI.mx, UI.my);
};
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);
canvas.addEventListener('contextmenu', e => { e.preventDefault(); const s = scenes[state]; if (s.rightClick) s.rightClick(); });
canvas.addEventListener('pointerleave', () => { UI.mx = UI.my = -99; });
window.addEventListener('keydown', e => {
  Sfx.unlock();
  if (Input.mode !== 'mouse') Input.setMode('mouse');                // se tocó el teclado: esquema teclado + ratón
  if (e.altKey && e.key === 'Enter') { e.preventDefault(); toggleFullscreen(); return; }
  const s = scenes[state];
  if (s.key && s.key(e)) { e.preventDefault(); return; }
  if ((e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey && !e.altKey && canFullscreen() && !IS_NATIVE) { e.preventDefault(); toggleFullscreen(); }      // F = pantalla completa
});

// iOS: sin zoom por pellizco, sin rebote de pantalla ni selección. (Los toques ya llegan al instante como "pointer events": con touch-action: none no hay retraso de 300 ms.)
['gesturestart', 'gesturechange', 'gestureend'].forEach(n => window.addEventListener(n, e => e.preventDefault()));
['touchstart', 'touchmove'].forEach(n => canvas.addEventListener(n, e => { if (e.cancelable) e.preventDefault(); }, { passive: false }));
window.addEventListener('touchmove', e => { if (e.cancelable && (e.touches.length > 1 || e.target === canvas)) e.preventDefault(); }, { passive: false });
// iPhone y iPad solo dejan activar el audio dentro de un toque terminado (touchend/click): se reintenta hasta que suene
['touchend', 'pointerup', 'click'].forEach(n => window.addEventListener(n, () => { if (!Sfx.ctx || Sfx.ctx.state !== 'running') Sfx.unlock(); }, { passive: true }));
// Guardado al salir: cerrar la pestaña, cambiar de pestaña o esconder la página guarda la partida en curso
const flushSave = () => { try { if (state === 'JUGANDO' || state === 'AJUSTES') Game.save(); } catch (e) {} };
window.addEventListener('blur', () => { Ptr.clear(); Pinch.active = false; });
window.addEventListener('pagehide', flushSave);
window.addEventListener('beforeunload', flushSave);
try { if (document.addEventListener) document.addEventListener('visibilitychange', () => { if (document.hidden) flushSave(); }); } catch (e) {}

// Red de seguridad: si algo falla al dibujar o actualizar, el juego sigue (no se congela); si una ventana falla muchos cuadros seguidos, se cierra sola
const FRAME_ERR = { n: 0, shown: 0, total: 0 };
function frameFail(e) {
  FRAME_ERR.n++; FRAME_ERR.total++;
  if (FRAME_ERR.shown < 4) { FRAME_ERR.shown++; try { console.error('Tacos Enmascarados:', e); } catch (x) {} }
  if (FRAME_ERR.n === 20 && state === 'JUGANDO' && Game.w) { const w = Game.w; w.modal = null; w.fight = null; w.map = null; w.shop = false; w.edit = null; w.panel = false; }
}
let last = performance.now(), due = 0;
function frame(now) {
  const cap = Settings.fps === '30' ? 30 : Settings.fps === '60' ? 60 : 0;      // AUTO = al ritmo de la pantalla (60 / 90 / 120 / 144 Hz…)
  if (cap) {
    const step = 1000 / cap;
    if (now + 1.5 < due) { requestAnimationFrame(frame); return; }
    due = now - due > step ? now + step : due + step;
  }
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now; clock += dt;
  fit();
  Gfx.tick(Math.min(dt * (Settings.fps === '30' ? .66 : 1), .1));
  UI.cursor = false;
  const s = scenes[state];
  let away = false; try { away = !!(window.matchMedia && window.matchMedia('(orientation: portrait) and (max-width: 600px)').matches); } catch (e) {}
  Music.update();
  Input.poll(dt);
  let bad = null;
  try { if (!away) s.update(dt); } catch (e) { bad = e; }          // celular en vertical (se pide girarlo): el juego se queda en pausa
  ctx.setTransform(K, 0, 0, K, 0, 0);
  ctx.clearRect(0, 0, CW, CH);
  ctx.translate(EX, EY);                                             // zona central de 960 de ancho; los fondos se extienden hasta los bordes
  try { s.draw(ctx); Input.draw(ctx); } catch (e) { bad = bad || e; try { canvas.width = canvas.width; } catch (e2) {} }
  if (bad) frameFail(bad); else FRAME_ERR.n = 0;
  canvas.style.cursor = UI.cursor ? 'pointer' : 'default';
  requestAnimationFrame(frame);
}

try { ['400 24px "Luckiest Guy"', '500 18px "Barlow Condensed"', '600 18px "Barlow Condensed"', '700 18px "Barlow Condensed"', '300 20px "Outfit"', '500 20px "Outfit"', '800 20px "Outfit"', '400 20px "Syncopate"', '700 20px "Syncopate"', '700 112px "Unbounded"', '300 26px "Unbounded"'].forEach(f => document.fonts.load(f)); } catch (e) {}      // tipografías listas desde el primer cuadro
fit();
Game.newGame(null);                // mundo base listo (se reemplaza al elegir Nuevo Juego o Cargar)
setState('INTRO');
requestAnimationFrame(frame);

})();
