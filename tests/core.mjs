// Test Node (sin navegador) del núcleo determinista: forge, svg y motor de batalla.
import assert from 'node:assert';
import { makeCritter, statsAtLevel, power } from '../src/critter/forge.js';
import { critterSvg } from '../src/critter/svg.js';
import { typeMultiplier } from '../src/critter/types.js';
import { simulate, battleSeed } from '../src/battle/engine.js';

let failed = 0;
const ok = (name, fn) => { try { fn(); console.log('  ✓', name); } catch (e) { failed++; console.error('  ✗', name, '\n   ', e.message); } };

ok('makeCritter es determinista por id', () => {
  const a = makeCritter('alpha'), b = makeCritter('alpha'), c = makeCritter('beta');
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
  assert.ok(a.name && a.element && a.role && a.rarity && a.base && a.active && a.passive);
});

ok('statsAtLevel crece con el nivel', () => {
  const c = makeCritter('alpha');
  const s1 = statsAtLevel(c, 1), s10 = statsAtLevel(c, 10);
  assert.ok(s10.HP > s1.HP && s10.ATK >= s1.ATK);
  assert.ok(power(c, 10) > power(c, 1));
});

ok('critterSvg devuelve SVG válido', () => {
  const svg = critterSvg(makeCritter('alpha'), 96);
  assert.ok(typeof svg === 'string' && svg.includes('<svg') && svg.includes('</svg>'));
});

ok('typeMultiplier: ventaja/neutral/desventaja', () => {
  assert.equal(typeMultiplier('fuego', 'agua'), 1.25);   // fuego le gana al siguiente (agua)
  assert.equal(typeMultiplier('agua', 'fuego'), 0.8);    // agua en desventaja contra el anterior
  assert.equal(typeMultiplier('fuego', 'fuego'), 1);
});

// Equipos de 5 en la 3×3 (slots 0..4: frente 0,1,2 / fondo 3,4).
const teamA = ['a1', 'a2', 'a3', 'a4', 'a5'].map((id, i) => ({ id, level: 5, slot: i }));
const teamB = ['b1', 'b2', 'b3', 'b4', 'b5'].map((id, i) => ({ id, level: 5, slot: i }));
const seed = battleSeed(teamA, teamB, 'm1');

ok('simulate es determinista (mismo seed → mismo resultado y log)', () => {
  const r1 = simulate(teamA, teamB, seed);
  const r2 = simulate(teamA, teamB, seed);
  assert.equal(r1.winner, r2.winner);
  assert.equal(JSON.stringify(r1.log), JSON.stringify(r2.log));
  assert.ok(['A', 'B', 'draw'].includes(r1.winner));
  assert.ok(r1.cycles >= 1 && r1.log.length > 0);
});

ok('batallas distintas con equipos distintos', () => {
  const r1 = simulate(teamA, teamB, seed);
  const teamC = ['c1', 'c2', 'c3', 'c4', 'c5'].map((id, i) => ({ id, level: 5, slot: i }));
  const r2 = simulate(teamA, teamC, battleSeed(teamA, teamC, 'm2'));
  assert.notEqual(JSON.stringify(r1.log), JSON.stringify(r2.log));
});

ok('dos equipos DEFENSIVOS no empatan eternamente (rompe el standoff)', () => {
  const A = ['da1', 'da2', 'da3'].map((id, i) => ({ id, level: 7, slot: i, policy: 'defensiva' }));
  const B = ['db1', 'db2', 'db3'].map((id, i) => ({ id, level: 4, slot: i, policy: 'defensiva' }));
  const r = simulate(A, B, battleSeed(A, B, 'standoff'));
  assert.notEqual(r.winner, 'draw');                 // alguien avanza y gana
  assert.ok(r.cycles < 2000, 'no se estanca hasta el tope');
  assert.ok(r.log.some(e => e.t === 'move'), 'hubo movimiento');
});

// Muestra: imprime un resumen de una batalla para inspección manual.
const demo = simulate(teamA, teamB, seed);
console.log(`\n  demo: ganador=${demo.winner} ciclos=${demo.cycles} eventos=${demo.log.length}`);

console.log(failed ? `\n${failed} fallo(s)` : '\nOK');
process.exit(failed ? 1 : 0);
