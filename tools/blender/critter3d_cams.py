# Camaras COMPARTIDAS por los 3 estilos: encuadre AUTOMATICO al bounding box de la criatura
# (nunca se cortan las patas; una criatura con menos partes sale centrada) y render MULTI-VISTA:
#   <out>.png        vista 3/4 "beauty" (fondo negro)
#   <out>_top.png    VISTA SUPERIOR ortografica, cabeza (+Y) hacia ARRIBA de la imagen,
#                    fondo TRANSPARENTE -> lista para usar en el juego (misma vista que el SVG 2D)
#   <out>_side.png   perfil lateral, cabeza hacia la derecha (fondo negro)
# El .blend editable se guarda con las 3 camaras (la activa es la beauty).
import bpy, math
from mathutils import Vector

def _coords():
    # esquinas de bbox por objeto, EVALUADAS (con bevel/subsurf aplicados) y en mundo
    dg = bpy.context.evaluated_depsgraph_get()
    out = []
    for ob in bpy.context.scene.objects:
        if ob.type not in ('MESH', 'CURVE'): continue
        eo = ob.evaluated_get(dg)
        mw = eo.matrix_world
        out += [mw @ Vector(c) for c in eo.bound_box]
    return out

def _make_cam(name, rot, lens=60.0, ortho=False):
    d = bpy.data.cameras.new(name)
    if ortho: d.type = 'ORTHO'
    else: d.lens = lens
    d.clip_end = 200
    ob = bpy.data.objects.new(name, d); bpy.context.scene.collection.objects.link(ob)
    ob.rotation_euler = rot
    return ob

def _fit(cam, coords, margin):
    # camera_fit_coords RESPETA la rotacion de la camara y devuelve la posicion (y la escala
    # ortografica) de encuadre exacto; el margen deja aire alrededor de la silueta.
    dg = bpy.context.evaluated_depsgraph_get()
    flat = [f for v in coords for f in v]
    loc, scale = cam.camera_fit_coords(dg, flat)
    cam.location = loc
    if cam.data.type == 'ORTHO':
        cam.data.ortho_scale = scale * margin
    else:
        ctr = sum(coords, Vector()) / len(coords)
        cam.location = ctr + (loc - ctr) * margin

def render_views(out_path, name, lens=60.0):
    sc = bpy.context.scene
    coords = _coords()
    base = out_path.rsplit('.', 1)[0]
    beauty = _make_cam("cam", (math.radians(77.36), 0.0, math.radians(152.54)), lens=lens)
    top    = _make_cam("camTop", (0.0, 0.0, 0.0), ortho=True)            # cenital exacta, +Y arriba
    side   = _make_cam("camSide", (math.radians(82.0), 0.0, math.radians(90.0)), lens=lens)
    _fit(beauty, coords, 1.09); _fit(top, coords, 1.06); _fit(side, coords, 1.09)
    sc.camera = beauty
    blend_path = base + '.blend'
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    print("SAVED BLEND", blend_path, flush=True)
    for cam, path, transparent in ((beauty, out_path, False),
                                   (top, base + '_top.png', True),
                                   (side, base + '_side.png', False)):
        sc.camera = cam; sc.render.film_transparent = transparent; sc.render.filepath = path
        print("RENDERING", name, cam.name, "->", path, flush=True)
        bpy.ops.render.render(write_still=True)
    print("DONE", flush=True)
