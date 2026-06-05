// Comportamiento del critter en el campo, en dos ejes editables por instancia:
//  - POLÍTICA de movimiento: cómo se desplaza (avanzar / aguantar / proteger).
//  - PREFERENCIA de objetivo: a quién apunta (cercano / débil / fuerte / ranged / soporte).

export const POLICIES = ['agresiva', 'defensiva', 'guardian'];
export const POLICY_INFO = {
  agresiva:  { es: 'Agresiva',  en: 'Aggressive', d: { es: 'Avanza hacia el enemigo y ataca.', en: 'Advances and attacks.' } },
  defensiva: { es: 'Defensiva', en: 'Defensive',  d: { es: 'Aguanta su posición; ataca lo que entra en rango.', en: 'Holds; attacks what comes in range.' } },
  guardian:  { es: 'Guardián',  en: 'Guardian',   d: { es: 'Se queda al frente; avanza poco.', en: 'Stays at the front; advances little.' } },
  // (legacy) 'cazador' se trata como 'agresiva' en el motor.
};
export function defaultPolicy (role) {
  if (role === 'dps' || role === 'peleador') return 'agresiva';
  if (role === 'tanque' || role === 'soporte' || role === 'distancia') return 'defensiva';
  return 'guardian';
}

export const TARGET_PREFS = ['cercano', 'debil', 'fuerte', 'rango', 'soporte'];
export const TARGET_INFO = {
  cercano: { es: 'Más cercano', en: 'Nearest',  d: { es: 'Ataca al enemigo más cercano.', en: 'Hits the nearest enemy.' } },
  debil:   { es: 'Más débil',   en: 'Weakest',  d: { es: 'Ataca al de menos vida (rematar).', en: 'Hits the lowest-HP enemy.' } },
  fuerte:  { es: 'Más fuerte',  en: 'Strongest', d: { es: 'Ataca al de más poder (vida+ataque).', en: 'Hits the highest-power enemy.' } },
  rango:   { es: 'A distancia', en: 'Ranged',   d: { es: 'Prioriza enemigos a distancia.', en: 'Prioritizes ranged enemies.' } },
  soporte: { es: 'Soporte',     en: 'Support',  d: { es: 'Prioriza soportes (sanadores).', en: 'Prioritizes support (healers).' } },
};
export function defaultTarget (role) {
  if (role === 'dps') return 'debil';
  if (role === 'distancia') return 'rango';
  if (role === 'control') return 'soporte';
  return 'cercano';
}
