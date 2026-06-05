// Comportamiento del critter en el campo, en dos ejes editables por instancia:
//  - POLÍTICA de movimiento: cómo se desplaza (avanzar / aguantar).
//  - PRIORIDAD de objetivo: una LISTA ORDENADA de criterios. El critter ataca al
//    primero de la lista que tenga un objetivo válido (p. ej. "soporte → a distancia
//    → débil": si no hay soporte enemigo, prueba a distancia, y si no, remata al débil).

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
  const base = defaultTarget(role);
  if (typeof target === 'string') target = [target];
  if (!Array.isArray(target) || !target.length) return base.slice();
  const seen = new Set(), out = [];
  for (const k of target) if (TARGET_KEYS.includes(k) && !seen.has(k)) { seen.add(k); out.push(k); }
  for (const k of base) if (!seen.has(k)) out.push(k);   // completa lo que falte
  return out;
}
