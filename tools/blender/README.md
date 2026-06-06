# Critters → 3D (Blender)

Pipeline procedural: construye el modelo 3D de un critter **desde su genoma** (misma anatomía
que `src/critter/svg.js`) y lo renderiza. Útil para arte de cartas, promo o assets (GLB).

## Uso
1) Sacar el spec del critter desde el juego:
   `node tools/blender/critter_spec.mjs <preset|g:...id> tools/blender/spec.json`
   presets: `fire_full · water · plant · min · nolegs`
2) Construir + renderizar (y guardar el .blend editable):
   `blender --background --python tools/blender/critter3d.py -- tools/blender/spec.json tools/blender/out.png`

## Editar en GUI y volver a código
- Abrí el `.blend` (mismo nombre que el PNG), tocá cámara/luces/materiales/modificadores y guardá.
- Para portar tus cambios al código, se inspecciona headless:
  `blender --background tools/blender/critter3d_fire.blend --python tools/blender/dump_blend.py`
  (vuelca cámara, luces, materiales, transforms y modificadores en JSON).

## Archivos
- `critter_spec.mjs` — vuelca el spec (apariencia + colores) del critter.
- `critter3d.py` — construye la malla 3D y renderiza (Cycles GPU, fondo negro).
- `dump_blend.py` — inspector para leer ediciones del .blend.
