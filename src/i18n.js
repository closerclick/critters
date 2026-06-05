// i18n reactivo (es/en). Las etiquetas de elementos/roles/rarezas viven en sus
// propios módulos (types/roles/forge) con campos es/en.
import { reactive } from 'vue';

const LANG_KEY = 'critters_lang';

export const i18n = reactive({
  lang: (() => { const s = localStorage.getItem(LANG_KEY); if (s === 'es' || s === 'en') return s; return (navigator.language || 'es').toLowerCase().startsWith('en') ? 'en' : 'es'; })(),
});

export function setLang (l) { i18n.lang = l; try { localStorage.setItem(LANG_KEY, l); } catch {} document.documentElement.lang = l; }
export function toggleLang () { setLang(i18n.lang === 'es' ? 'en' : 'es'); }

const STR = {
  es: {
    campana: 'Campaña', coleccion: 'Colección', equipo: 'Equipo', invocar: 'Invocar',
    monedas: 'Monedas', frags: 'Fragmentos', nivel: 'Nivel', nv: 'Nv',
    pelear: 'Pelear', volver: 'Volver', cerrar: 'Cerrar',
    invocarBtn: 'Invocar', invocarHint: 'Gasta monedas y consigue una criatura nueva (única por su semilla).',
    sinMonedas: 'No te alcanzan las monedas', sinFrags: 'No tienes fragmentos',
    alimentar: 'Alimentar', alimentarHint: 'Gasta fragmentos para dar XP.',
    equipoVacio: 'Coloca al menos una criatura en la rejilla para pelear.',
    equipoLleno: 'Equipo completo (máx. 5).',
    elegiSlot: 'Arrastra una criatura del banco a una casilla; arrástrala entre casillas para reordenar (suéltala fuera para quitarla). La columna central es la más protegida.',
    quitar: 'Quitar', colocar: 'Colocar', seleccionada: 'Seleccionada',
    nivelBloq: 'Bloqueado', recompensa: 'Recompensa', capturaste: '¡Capturaste a',
    victoria: '¡Victoria!', derrota: 'Derrota', empate: 'Empate',
    rondas: 'rondas', ciclos: 'ciclos', tuEquipo: 'Tu equipo', rival: 'Rival',
    repetir: 'Repetir', siguiente: 'Siguiente', verBatalla: 'Ver batalla',
    statHP: 'VIDA', statATK: 'ATQ', statDEF: 'DEF', statSPD: 'VEL',
    pasiva: 'Pasiva', activa: 'Activa', tipo: 'Tipo', rol: 'Rol', rareza: 'Rareza',
    colVacia: 'Aún no tienes criaturas. Invoca una o gana niveles para capturarlas.',
    nuevaCriatura: '¡Nueva criatura!',
    politica: 'Movimiento',
    objetivo: 'Objetivo',
    rango: 'Rango',
    borrarTitulo: 'Borrar datos del juego',
    borrarWarn: 'Se borrará tu colección, equipo, monedas y progreso de campaña. Esta acción no se puede deshacer.',
    borrar: 'Borrar todo', cancelar: 'Cancelar',
    eligeInicial: 'Elige tu primera criatura',
    eligeInicialHint: 'Empiezas con una. Gana batallas para conseguir más (capturas, monedas e invocaciones).',
    elegir: 'Elegir',
  },
  en: {
    campana: 'Campaign', coleccion: 'Collection', equipo: 'Team', invocar: 'Summon',
    monedas: 'Coins', frags: 'Fragments', nivel: 'Level', nv: 'Lv',
    pelear: 'Fight', volver: 'Back', cerrar: 'Close',
    invocarBtn: 'Summon', invocarHint: 'Spend coins to get a brand-new critter (unique by its seed).',
    sinMonedas: 'Not enough coins', sinFrags: 'No fragments',
    alimentar: 'Feed', alimentarHint: 'Spend fragments to grant XP.',
    equipoVacio: 'Place at least one critter on the grid to fight.',
    equipoLleno: 'Team full (max 5).',
    elegiSlot: 'Drag a critter from the bench onto a cell; drag between cells to reorder (drop outside to remove). The center column is the most protected.',
    quitar: 'Remove', colocar: 'Place', seleccionada: 'Selected',
    nivelBloq: 'Locked', recompensa: 'Reward', capturaste: 'You captured',
    victoria: 'Victory!', derrota: 'Defeat', empate: 'Draw',
    rondas: 'rounds', ciclos: 'cycles', tuEquipo: 'Your team', rival: 'Enemy',
    repetir: 'Replay', siguiente: 'Next', verBatalla: 'Watch battle',
    statHP: 'HP', statATK: 'ATK', statDEF: 'DEF', statSPD: 'SPD',
    pasiva: 'Passive', activa: 'Active', tipo: 'Type', rol: 'Role', rareza: 'Rarity',
    colVacia: 'No critters yet. Summon one or win levels to capture them.',
    nuevaCriatura: 'New critter!',
    politica: 'Movement',
    objetivo: 'Target',
    rango: 'Range',
    borrarTitulo: 'Delete game data',
    borrarWarn: 'This wipes your collection, team, coins and campaign progress. This cannot be undone.',
    borrar: 'Delete all', cancelar: 'Cancel',
    eligeInicial: 'Choose your first critter',
    eligeInicialHint: 'You start with one. Win battles to get more (captures, coins and summons).',
    elegir: 'Choose',
  },
};

export function t (k) { return (STR[i18n.lang] || STR.es)[k] ?? STR.es[k] ?? k; }
/** Texto localizado de un objeto {es,en}. */
export function loc (obj) { if (!obj) return ''; return obj[i18n.lang] || obj.es || obj.en || ''; }
