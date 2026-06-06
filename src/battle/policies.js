// Comportamiento del critter en el campo, en dos ejes editables por instancia:
//  - POLÍTICA de movimiento: cómo se desplaza (avanzar / aguantar).
//  - PRIORIDAD de objetivo: una LISTA ORDENADA de criterios. El critter ataca al
//    primero de la lista que tenga un objetivo válido (p. ej. "soporte → a distancia
//    → débil": si no hay soporte enemigo, prueba a distancia, y si no, remata al débil).

// ROL: lista de PRIORIDAD ordenable (atacante/defensa/soporte). Cada turno el critter usa
// el PRIMER rol aplicable: soporte solo si puede curar y NO lo están atacando; defensa si lo
// atacan o está herido; atacante siempre (fallback). Reemplaza a la vieja "política".
export const ROL_KEYS = ['atacante', 'defensa', 'soporte'];
export const ROL_INFO = {
  atacante: { es: 'Atacante', en: 'Attacker', d: { es: 'Avanza y ataca al enemigo.', en: 'Advances and attacks.' } },
  defensa:  { es: 'Defensa',  en: 'Defense',  d: { es: 'Aguanta; se defiende cuando lo atacan o está herido.', en: 'Holds; defends when attacked or hurt.' } },
  soporte:  { es: 'Soporte',  en: 'Support',  d: { es: 'Cura/buffa si hay a quién y no lo atacan; si no, pasa al siguiente rol.', en: 'Heals/buffs when possible and safe; else next role.' } },
};
export function defaultRol (role) {
  if (role === 'soporte') return ['soporte', 'defensa', 'atacante'];
  if (role === 'tanque') return ['defensa', 'atacante', 'soporte'];
  return ['atacante', 'defensa', 'soporte'];
}
// Permutación completa y válida de ROL_KEYS (tolera legacy/parcial/vacío).
export function normalizeRol (rol, role) {
  const base = defaultRol(role);
  if (typeof rol === 'string') rol = [rol];
  if (!Array.isArray(rol) || !rol.length) return base.slice();
  const seen = new Set(), out = [];
  for (const k of rol) if (ROL_KEYS.includes(k) && !seen.has(k)) { seen.add(k); out.push(k); }
  for (const k of base) if (!seen.has(k)) out.push(k);
  return out;
}

export const POLICIES = ['agresiva', 'defensiva'];
export const POLICY_INFO = {
  agresiva:  { es: 'Agresiva',  en: 'Aggressive', d: { es: 'Avanza, flanquea y ataca al enemigo.', en: 'Advances, flanks and attacks.' } },
  defensiva: { es: 'Defensiva', en: 'Defensive',  d: { es: 'Aguanta su posición; solo ataca lo que entra en rango.', en: 'Holds position; only attacks what comes in range.' } },
  // (legacy) 'guardian'/'cazador' se tratan como 'agresiva' en el motor.
};
// Por defecto TODAS avanzan/flanquean; la defensiva es opt-in del jugador.
export function defaultPolicy (role) { return 'agresiva'; }

// Criterios de objetivo (la prioridad es una permutación de TODOS estos):
//  - filtros por rol/tipo (pueden quedar vacíos → se cae al siguiente):
//      soporte (sanadores/buffers), rango (enemigos a distancia)
//  - selectores que SIEMPRE resuelven (terminan la cadena):
//      debil (menos vida), fuerte (más poder), cercano (más cerca)
export const TARGET_KEYS = ['soporte', 'rango', 'debil', 'fuerte', 'cercano'];
export const TARGET_INFO = {
  soporte: { es: 'Soporte',     en: 'Support',   d: { es: 'Sanadores y buffs primero.', en: 'Healers/buffers first.' } },
  rango:   { es: 'A distancia', en: 'Ranged',    d: { es: 'Enemigos a distancia primero.', en: 'Ranged enemies first.' } },
  debil:   { es: 'Más débil',   en: 'Weakest',   d: { es: 'El de menos vida (rematar).', en: 'Lowest-HP enemy (finish off).' } },
  fuerte:  { es: 'Más fuerte',  en: 'Strongest', d: { es: 'El de más poder (vida+ataque).', en: 'Highest-power enemy.' } },
  cercano: { es: 'Más cercano', en: 'Nearest',   d: { es: 'El enemigo más cercano.', en: 'Nearest enemy.' } },
};

export function defaultTarget (role) {
  if (role === 'dps') return ['debil', 'cercano', 'fuerte', 'rango', 'soporte'];
  if (role === 'distancia') return ['soporte', 'rango', 'debil', 'cercano', 'fuerte'];
  if (role === 'control') return ['soporte', 'rango', 'debil', 'cercano', 'fuerte'];
  if (role === 'soporte') return ['cercano', 'debil', 'fuerte', 'rango', 'soporte'];
  return ['cercano', 'fuerte', 'debil', 'rango', 'soporte'];   // tanque / peleador
}

// Devuelve SIEMPRE una permutación completa y válida de TARGET_KEYS:
// tolera legacy (string), arrays parciales o con claves desconocidas, y vacío.
export function normalizeTarget (target, role) {
  return normPerm(target, defaultTarget(role));
}
function normPerm (target, base, keys = TARGET_KEYS) {
  if (typeof target === 'string') target = [target];
  if (!Array.isArray(target) || !target.length) return base.slice();
  const seen = new Set(), out = [];
  for (const k of target) if (keys.includes(k) && !seen.has(k)) { seen.add(k); out.push(k); }
  for (const k of base) if (!seen.has(k)) out.push(k);   // completa lo que falte
  return out;
}

// Criterios de objetivo del SOPORTE: sobre los ALIADOS (a quién ayudar), no enemigos.
export const ALLY_KEYS = ['herido', 'vida', 'frente', 'mismo'];
export const ALLY_INFO = {
  herido: { es: 'Más herido (%)', en: 'Most wounded (%)', d: { es: 'El aliado con menor % de vida.', en: 'Ally with lowest HP %.' } },
  vida:   { es: 'Menos vida',     en: 'Lowest HP',        d: { es: 'El aliado con menos vida absoluta.', en: 'Ally with lowest raw HP.' } },
  frente: { es: 'Del frente',     en: 'Frontline',        d: { es: 'El aliado más adelantado (recibe el daño).', en: 'Most advanced ally (takes the hits).' } },
  mismo:  { es: 'Sí mismo',       en: 'Self',             d: { es: 'Se cura/buffa a sí mismo.', en: 'Heals/buffs itself.' } },
};
export const defaultAlly = () => ['herido', 'vida', 'frente', 'mismo'];

// PRIORIDAD de objetivo POR ROL. atacante/defensa = ENEMIGOS; soporte = ALIADOS (ayuda).
export function defaultTargetForRol (rolKey) {
  if (rolKey === 'defensa') return ['cercano', 'fuerte', 'debil', 'rango', 'soporte'];
  return ['debil', 'cercano', 'fuerte', 'rango', 'soporte'];   // atacante
}
// Claves válidas según el rol (soporte → aliados).
export const keysForRol = (rolKey) => (rolKey === 'soporte' ? ALLY_KEYS : TARGET_KEYS);
// Devuelve { atacante:[enemigos], defensa:[enemigos], soporte:[ALIADOS] }.
export function normalizeTargets (target) {
  const legacy = Array.isArray(target) ? target : null;
  return {
    atacante: normPerm(legacy || (target && target.atacante), defaultTargetForRol('atacante')),
    defensa: normPerm(legacy || (target && target.defensa), defaultTargetForRol('defensa')),
    soporte: normPerm(target && target.soporte, defaultAlly(), ALLY_KEYS),
  };
}
