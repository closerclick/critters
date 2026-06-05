// Selección de objetivos y bloqueo posicional en la rejilla 3×3 (fila 0 = frente).
// Una unidad está PROTEGIDA si tiene una aliada viva adyacente (Chebyshev 1) más
// adelantada (fila menor). Las de fila 0 nunca están protegidas. El centro toca
// más vecinas → protege más y es la clave para romper la formación.

export function isProtected (unit, team) {
  return team.some(v => v.alive && v !== unit && v.row < unit.row &&
    Math.abs(v.row - unit.row) <= 1 && Math.abs(v.col - unit.col) <= 1);
}

/** Enemigos atacables por un básico (respetando bloqueo, salvo ignoreProtect). */
export function attackableEnemies (enemyTeam, opts = {}) {
  const alive = enemyTeam.filter(e => e.alive);
  if (opts.ignoreProtect) return alive;
  const free = alive.filter(e => !isProtected(e, enemyTeam));
  return free.length ? free : alive;
}

/** Objetivo: el de menor HP actual; desempate frente→col cercana→slot. */
export function chooseTarget (attacker, candidates) {
  let best = null;
  for (const e of candidates) {
    if (!best) { best = e; continue; }
    if (e.hp < best.hp) { best = e; continue; }
    if (e.hp > best.hp) continue;
    if (e.row < best.row) { best = e; continue; }
    if (e.row > best.row) continue;
    const da = Math.abs(e.col - attacker.col), db = Math.abs(best.col - attacker.col);
    if (da < db) { best = e; continue; }
    if (da === db && e.slot < best.slot) best = e;
  }
  return best;
}

/** Enemigo del fondo (mayor fila); desempate por slot. */
export function backmost (enemyTeam) {
  let best = null;
  for (const e of enemyTeam) {
    if (!e.alive) continue;
    if (!best || e.row > best.row || (e.row === best.row && e.slot < best.slot)) best = e;
  }
  return best;
}
