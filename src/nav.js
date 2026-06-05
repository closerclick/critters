// Navegación "volver" unificada del ecosistema (registra <closer-click-back> y
// captura el botón físico de Android / gesto de iOS / atrás del navegador).
// Instancia única compartida (App abre "capas" para modales/batalla).
import { createBackNav } from '@closerclick/closer-click-nav';

export const nav = createBackNav();
