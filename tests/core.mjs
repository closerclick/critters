// Test Node (sin navegador) del núcleo determinista: forge, svg y motor de batalla.
import assert from 'node:assert';
import { makeCritter, statsAtLevel, power, pointsTotal, pointsFree, partsOf, rarityIndexFromParts, genomeId, elementMult, clampElement, capacityFor } from '../src/critter/forge.js';
import { critterSvg } from '../src/critter/svg.js';
import { typeMultiplier, mixElements, elementInfo } from '../src/critter/types.js';
import { simulate, battleSeed } from '../src/battle/engine.js';
import { normalizeTarget } from '../src/battle/policies.js';
import { canFuse, fuse, degrade } from '../src/game/fusion.js';

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

ok('rareza por partes: 9 rarezas (1 parte=índice 0 … 9=8); salvajes ≤4 partes', () => {
  for (let k = 0; k < 80; k++) { const c = makeCritter('wild' + k); assert.ok(c.rarityIndex <= 1, 'invocada rareza 0-1'); assert.ok(partsOf(c.appearance) <= 2 && partsOf(c.appearance) >= 1); }
  assert.equal(rarityIndexFromParts(1), 0);
  assert.equal(rarityIndexFromParts(4), 3);
  assert.equal(rarityIndexFromParts(5), 4);
  assert.equal(rarityIndexFromParts(9), 8);
});

ok('genoma-id: makeCritter reconstruye exacto y determinista', () => {
  const id = genomeId({ seed: 'sx', element: 'fuego', role: 'dps', appearance: { head: 1, thorax: 0, abdomen: 2, legs: 3, legStyle: 1, antennae: true, hue: 5, pattern: 1 } });
  const c1 = makeCritter(id), c2 = makeCritter(id);
  assert.deepEqual(c1, c2);
  assert.equal(c1.element, 'fuego'); assert.equal(c1.role, 'dps');
  assert.equal(partsOf(c1.appearance), 6);   // 1+1+1+3
  assert.equal(c1.rarityIndex, 5);           // 6 partes → índice 5 (Notable)
});

ok('fusión: SOLO 1-2 casillas de diferencia; hija con +1 parte (sube rareza); subelemento', () => {
  const base = { head: 0, thorax: -1, abdomen: -1, legStyle: 0, antennae: false, hue: 0, pattern: 0 };
  const A = makeCritter(genomeId({ seed: 'sa', element: 'fuego', role: 'dps', appearance: { ...base, legs: 2 } }));   // 3 partes
  const B = makeCritter(genomeId({ seed: 'sb', element: 'agua', role: 'dps', appearance: { ...base, legs: 3 } }));    // 4 (diff 1)
  assert.ok(canFuse(A, B));
  const child = fuse(A, B);
  assert.ok(child);
  assert.equal(partsOf(child.appearance), 5);                          // max(3,4)+1
  assert.ok(child.rarityIndex > A.rarityIndex);                        // sube de rareza
  assert.equal(child.element, 'agua+fuego');                           // subelemento canónico
  assert.deepEqual(fuse(A, B), child);                                 // determinista
  const C = makeCritter(genomeId({ seed: 'sc', element: 'fuego', role: 'dps', appearance: { ...base, legs: 2, hue: 9 } })); // igual estructura
  assert.ok(!canFuse(A, C)); assert.equal(fuse(A, C), null);           // 0 casillas → NO fusiona
  const D = makeCritter(genomeId({ seed: 'sd2', element: 'planta', role: 'dps', appearance: { ...base, legs: 4 } }));        // 5 (diff 2)
  assert.ok(canFuse(A, D));                                            // 2 casillas → sí
  const E = makeCritter(genomeId({ seed: 'se', element: 'agua', role: 'dps', appearance: { ...base, legs: 5 } }));           // 6 (diff 3)
  assert.ok(!canFuse(A, E)); assert.equal(fuse(A, E), null);           // >2 casillas → NO
  // Si la rareza NO permite un ingrediente nuevo, los ingredientes se ACUMULAN (no se pierden).
  const A0 = makeCritter(genomeId({ seed: 'sf0', element: 'fuego', role: 'dps', appearance: { ...base, legs: 0 } }));        // 1 parte
  const B0 = makeCritter(genomeId({ seed: 'sg0', element: 'agua', role: 'dps', appearance: { ...base, legs: 1 } }));         // 2 (diff 1)
  const ch0 = fuse(A0, B0);                                            // 3 partes → rareza 2 (cap 1)
  assert.equal(partsOf(ch0.appearance), 3);
  assert.equal(new Set(ch0.element.split('+')).size, 1);              // no cabe el subelemento (cap 1)
  assert.equal(ch0.element.split('+').length, 2);                     // pero ACUMULA (no pierde el ingrediente)
});

ok('subelemento: ventajas de ambos, sin sumar debilidades', () => {
  assert.equal(mixElements('fuego', 'agua'), 'agua+fuego');
  assert.equal(mixElements('fuego', 'fuego'), 'fuego+fuego');                          // acumula con multiplicidad
  assert.equal(mixElements('agua+fuego', 'planta'), 'agua+fuego+planta');              // dual + base → triple
  assert.equal(mixElements('agua+fuego+planta', 'agua'), 'agua+agua+fuego+planta');    // en profundidad SIGUE acumulando
  assert.equal(typeMultiplier('agua+fuego', 'planta'), 1.25);   // atacando: toma la ventaja (agua)
  assert.equal(typeMultiplier('fuego', 'agua+fuego'), 1);       // el dual resiste/neutraliza por sus ingredientes
});

ok('potencia: puro 1.0; subelemento/triple débiles al nacer y potentes al madurar (índice 8)', () => {
  assert.equal(elementMult('fuego', 0), 1);                                   // puro siempre 1.0
  assert.equal(elementMult('fuego', 8), 1);
  assert.ok(elementMult('agua+fuego', 0) < 0.7);                              // subelemento "cría" débil
  assert.equal(Math.round(elementMult('agua+fuego', 8) * 100), 150);          // subelemento legendaria ×1.5
  assert.equal(Math.round(elementMult('agua+fuego+planta', 8) * 100), 200);   // triple legendaria ×2.0
  assert.ok(elementMult('agua+fuego+planta', 0) < 0.7);                       // triple cría muy débil (héroe débil)
  // acumulación en gradiente: base convergente fuerte < sub convergente suave; triple lineal
  const baseAcc = elementMult('fuego+fuego', 8) - elementMult('fuego', 8);
  const subAcc = elementMult('agua+agua+fuego', 8) - elementMult('agua+fuego', 8);
  assert.ok(baseAcc > 0 && subAcc > baseAcc);                                 // sub MENOS convergente que base (rinde más)
  const t0 = elementMult('agua+fuego+planta', 8), t1 = elementMult('agua+agua+fuego+planta', 8), t2 = elementMult('agua+agua+agua+fuego+planta', 8);
  assert.ok((t1 - t0) > 0 && Math.abs((t1 - t0) - (t2 - t1)) < 1e-9);         // triple LINEAL (vale farmear leyendas)
});

ok('capacidad por rareza (de 3 en 3) + recorte determinista (degradado)', () => {
  assert.equal(capacityFor(0), 1); assert.equal(capacityFor(3), 2); assert.equal(capacityFor(6), 3);
  assert.equal(clampElement('agua+fuego', 3), 'agua+fuego');         // cap 2 → cabe el subelemento
  assert.equal(clampElement('agua+fuego', 0), 'fuego');              // cap 1 → recorta a 1 base (fuego < agua por orden)
  assert.equal(clampElement('agua+fuego+planta', 2), 'fuego');       // cap 1 (rareza 3) → recorta a 1
});

ok('degradar: -1 tramo por vez, recorta a la capacidad, conserva identidad (semilla)', () => {
  const leg = makeCritter(genomeId({ seed: 'sd', element: 'agua+fuego+planta', role: 'dps', appearance: { head: 0, thorax: 0, abdomen: 0, legs: 6, legStyle: 0, antennae: false, hue: 0, pattern: 0 } }));
  assert.equal(partsOf(leg.appearance), 9);
  assert.equal(leg.rarityIndex, 8);
  let c = degrade(leg);
  assert.equal(partsOf(c.appearance), 8); assert.equal(c.rarityIndex, 7);    // -1 parte = -1 rareza
  assert.equal(new Set(c.element.split('+')).size, 3);                        // 8 partes (cap 3) aún triple
  assert.equal(c.name, leg.name);                                            // identidad estable (semilla)
  while (c && partsOf(c.appearance) > 6) c = degrade(c);                     // bajar a 6 partes
  assert.equal(partsOf(c.appearance), 6); assert.equal(c.rarityIndex, 5);
  assert.equal(new Set(c.element.split('+')).size, 2);                        // 6 partes (cap 2) → subelemento
  assert.equal(c.name, leg.name);
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
