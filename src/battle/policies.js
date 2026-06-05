// Políticas de decisión del critter en el campo (a quién apunta y cómo se mueve).
// Personalizables por instancia; por defecto se derivan del rol.
export const POLICIES = ['agresiva', 'cazador', 'defensiva', 'guardian'];

export const POLICY_INFO = {
  agresiva:  { es: 'Agresiva',  en: 'Aggressive', d: { es: 'Avanza hacia el enemigo más cercano y ataca.', en: 'Advances to the nearest enemy and attacks.' } },
  cazador:   { es: 'Cazador',   en: 'Hunter',     d: { es: 'Va por el enemigo más débil (menos vida).', en: 'Goes for the weakest enemy (lowest HP).' } },
  defensiva: { es: 'Defensiva', en: 'Defensive',  d: { es: 'Aguanta su posición; solo ataca lo que entra en rango.', en: 'Holds position; only attacks what comes in range.' } },
  guardian:  { es: 'Guardián',  en: 'Guardian',   d: { es: 'Se queda al frente protegiendo; avanza poco.', en: 'Stays at the front guarding; advances little.' } },
};

export function defaultPolicy (role) {
  if (role === 'dps' || role === 'peleador') return 'agresiva';
  if (role === 'distancia' || role === 'control') return 'cazador';
  return 'defensiva'; // tanque, soporte
}
