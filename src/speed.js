// Velocidad de reproducción de la batalla, compartida y persistida. Se elige ANTES
// de pelear (en el modal de encuentro) porque en pleno combate va muy rápido.
import { ref } from 'vue';

export const SPEEDS = [1, 2, 5, 10];
const load = () => { const v = Number(localStorage.getItem('critters_speed')); return SPEEDS.includes(v) ? v : 1; };
export const speed = ref(load());
export function setSpeed (s) { if (!SPEEDS.includes(s)) return; speed.value = s; try { localStorage.setItem('critters_speed', String(s)); } catch (_) {} }
