// Test Node (sin navegador) del núcleo determinista: forge, svg y motor de batalla.
import assert from 'node:assert';
import { makeCritter, statsAtLevel, power, pointsTotal, pointsFree, partsOf, rarityIndexFromParts, genomeId, mixFactor } from '../src/critter/forge.js';
import { critterSvg } from '../src/critter/svg.js';
import { typeMultiplier, mixElements, elementInfo } from '../src/critter/types.js';
import { simulate, battleSeed } from '../src/battle/engine.js';
import { normalizeTarget } from '../src/battle/policies.js';
import { canFuse, fuse } from '../src/game/fusion.js';

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
  assert.equal(typeMultiplier('fuego', 'fuego'), 1);   // mismo elemento → neutral
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

ok('puntos asignables: alloc suma stats; pointsFree correcto', () => {
  const c = makeCritter('alpha');
  const s0 = statsAtLevel(c, 5);
  const s1 = statsAtLevel(c, 5, { ATK: 3 });
  assert.equal(s1.ATK - s0.ATK, 3 * 3);     // POINT_VALUE.ATK = 3
  assert.equal(pointsTotal(5), 8);          // (5-1) * 2 por nivel
  assert.equal(pointsFree(5, { ATK: 3 }), 5);
  assert.equal(pointsTotal(1), 0);          // nivel 1 sin puntos
});

ok('normalizeTarget: permutación completa y válida (tolera legacy/parcial/vacío)', () => {
  const full = normalizeTarget(['soporte'], 'dps');
  assert.equal(full.length, 5);
  assert.equal(new Set(full).size, 5);
  assert.equal(full[0], 'soporte');                              // respeta lo pedido primero
  assert.deepEqual([...full].sort(), ['cercano', 'debil', 'fuerte', 'rango', 'soporte']);
  assert.equal(normalizeTarget('debil', 'tanque')[0], 'debil');  // legacy string → array
  assert.equal(normalizeTarget(null, 'dps').length, 5);          // vacío → default por rol
});

ok('terreno: opts.terrain afecta la simulación y sigue determinista', () => {
  const el = makeCritter('a1').element;
  const r0 = simulate(teamA, teamB, seed);
  const r1 = simulate(teamA, teamB, seed, { terrain: el });
  const r1b = simulate(teamA, teamB, seed, { terrain: el });
  assert.equal(JSON.stringify(r1.log), JSON.stringify(r1b.log));    // determinista con terreno
  assert.notEqual(JSON.stringify(r0.log), JSON.stringify(r1.log));  // el terreno cambia el combate
});

ok('rareza por partes: salvajes 0/1 (≤4 partes); 9 = legendaria', () => {
  for (let k = 0; k < 80; k++) { const c = makeCritter('wild' + k); assert.ok(c.rarityIndex <= 1, 'salvaje rareza ≤1'); assert.ok(partsOf(c.appearance) <= 4); assert.ok(partsOf(c.appearance) >= 1); }
  assert.equal(rarityIndexFromParts(1), 0);
  assert.equal(rarityIndexFromParts(4), 1);
  assert.equal(rarityIndexFromParts(5), 2);
  assert.equal(rarityIndexFromParts(9), 4);
});

ok('genoma-id: makeCritter reconstruye exacto y determinista', () => {
  const id = genomeId({ element: 'fuego', role: 'dps', appearance: { head: 1, thorax: 0, abdomen: 2, legs: 3, legStyle: 1, antennae: true, hue: 5, pattern: 1 } });
  const c1 = makeCritter(id), c2 = makeCritter(id);
  assert.deepEqual(c1, c2);
  assert.equal(c1.element, 'fuego'); assert.equal(c1.role, 'dps');
  assert.equal(partsOf(c1.appearance), 6);   // 1+1+1+3
  assert.equal(c1.rarityIndex, 2);           // raro
});

ok('fusión: difieren en una pieza → hija con +1 parte (sube rareza); subelemento', () => {
  const base = { head: 0, thorax: -1, abdomen: -1, legStyle: 0, antennae: false, hue: 0, pattern: 0 };
  const A = makeCritter(genomeId({ element: 'fuego', role: 'dps', appearance: { ...base, legs: 2 } }));   // 3 partes
  const B = makeCritter(genomeId({ element: 'agua', role: 'dps', appearance: { ...base, legs: 3 } }));    // 4 partes (A + 1 pata)
  assert.ok(canFuse(A, B));
  const child = fuse(A, B);
  assert.ok(child);
  assert.equal(partsOf(child.appearance), partsOf(B.appearance) + 1);   // 5
  assert.ok(child.rarityIndex > A.rarityIndex);                         // sube de rareza
  assert.equal(child.element, 'agua+fuego');                            // subelemento canónico
  assert.deepEqual(fuse(A, B), child);                                  // determinista
  const C = makeCritter(genomeId({ element: 'fuego', role: 'dps', appearance: { ...base, legs: 2, hue: 9 } })); // misma estructura
  assert.ok(!canFuse(A, C));                                            // 0 piezas de diferencia → no
});

ok('subelemento: ventajas de ambos, sin sumar debilidades', () => {
  assert.equal(mixElements('fuego', 'agua'), 'agua+fuego');
  assert.equal(mixElements('fuego', 'fuego'), 'fuego+fuego');                          // acumula con multiplicidad
  assert.equal(mixElements('agua+fuego', 'planta'), 'agua+fuego+planta');              // dual + base → triple
  assert.equal(mixElements('agua+fuego+planta', 'agua'), 'agua+agua+fuego+planta');    // en profundidad SIGUE acumulando
  assert.equal(typeMultiplier('agua+fuego', 'planta'), 1.25);   // atacando: toma la ventaja (agua)
  assert.equal(typeMultiplier('fuego', 'agua+fuego'), 1);       // el dual resiste/neutraliza por sus ingredientes
});

ok('impuesto de mezcla: pura 100%, mezclada nace débil y se recupera a legendaria', () => {
  assert.equal(mixFactor('fuego', 0), 1);                                  // pura sin impuesto (cualquier rareza)
  assert.equal(mixFactor('fuego', 4), 1);
  assert.equal(Math.round(mixFactor('agua+fuego', 0) * 100), 80);          // dual común −20%
  assert.equal(mixFactor('agua+fuego', 4), 1);                             // dual legendaria 100%
  assert.equal(Math.round(mixFactor('agua+fuego+planta', 0) * 100), 60);   // triple común −40% (héroe débil)
  assert.equal(mixFactor('agua+fuego+planta', 4), 1);                      // triple legendaria 100% en todo
});

ok('catálogo de 36 nombres: combinación + intensidad por acumulación', () => {
  assert.equal(elementInfo('fuego').es, 'Brasa');                    // base, intensidad 0
  assert.equal(elementInfo('fuego+fuego').es, 'Llama');             // fuego acumulado
  assert.equal(elementInfo('agua+fuego').es, 'Vaho');              // subelemento mínimo
  assert.equal(elementInfo('agua+fuego+fuego').es, 'Vapor');       // subelemento acumulado
  assert.equal(elementInfo('agua+fuego+planta').es, 'Amalgama');   // triple (ápice, sin Prisma)
  assert.equal(elementInfo('agua+agua+fuego+planta').es, 'Quimera'); // triple acumulado
  assert.equal(typeMultiplier('agua+agua+fuego+planta', 'planta'), 1.25); // combate por ingredientes (no por nombre)
});

// Muestra: imprime un resumen de una batalla para inspección manual.
const demo = simulate(teamA, teamB, seed);
console.log(`\n  demo: ganador=${demo.winner} ciclos=${demo.cycles} eventos=${demo.log.length}`);

console.log(failed ? `\n${failed} fallo(s)` : '\nOK');
process.exit(failed ? 1 : 0);
