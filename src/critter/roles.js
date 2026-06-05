// Roles: definen cómo se reparte el presupuesto de stats y de qué pools salen las
// habilidades. 'distancia' es a distancia (ignora el bloqueo posicional).
export const ROLES = ['tanque', 'peleador', 'dps', 'distancia', 'soporte', 'control'];

export const ROLE_INFO = {
  tanque:    { es: 'Tanque',     en: 'Tank' },
  peleador:  { es: 'Peleador',   en: 'Bruiser' },
  dps:       { es: 'DPS',        en: 'DPS' },
  distancia: { es: 'Distancia',  en: 'Ranged' },
  soporte:   { es: 'Soporte',    en: 'Support' },
  control:   { es: 'Control',    en: 'Control' },
};

// Pesos de reparto del presupuesto entre HP/ATK/DEF/SPD (suman ~1).
export const ROLE_WEIGHTS = {
  tanque:    { HP: 0.40, ATK: 0.15, DEF: 0.35, SPD: 0.10 },
  peleador:  { HP: 0.30, ATK: 0.30, DEF: 0.25, SPD: 0.15 },
  dps:       { HP: 0.20, ATK: 0.45, DEF: 0.10, SPD: 0.25 },
  distancia: { HP: 0.18, ATK: 0.42, DEF: 0.12, SPD: 0.28 },
  soporte:   { HP: 0.30, ATK: 0.16, DEF: 0.24, SPD: 0.30 },
  control:   { HP: 0.26, ATK: 0.26, DEF: 0.20, SPD: 0.28 },
};

// Roles que atacan a distancia: ignoran la protección (pegan al fondo enemigo).
export const RANGED_ROLES = new Set(['distancia']);
