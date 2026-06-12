# Camaras COMPARTIDAS por los 3 estilos: encuadre AUTOMATICO al bounding box de la criatura
# (nunca se cortan las patas; una criatura con menos partes sale centrada) y render MULTI-VISTA:
#   <out>.png        vista 3/4 "beauty" (fondo negro)
#   <out>_top.png    VISTA SUPERIOR ortografica, cabeza (+Y) hacia ARRIBA de la imagen,
#                    fondo TRANSPARENTE -> lista para usar en el juego (misma vista que el SVG 2D)
#   <out>_side.png   perfil lateral, cabeza hacia la derecha (fondo negro)
# El .blend editable se guarda con las 3 camaras (la activa es la beauty).
import bpy, math
from mathutils import Vector, Matrix

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

# --- Animacion de patas (2 frames) -------------------------------------------------
# Marcha INTERCALADA: las patas se posan girando como bloque sobre el eje Z en el centro
# del cuerpo; por geometria las del lado +X van hacia +Y (adelante) y las del lado -X hacia
# atras, asi que alternar el signo del angulo entre el frame "1" y el "2" da el paso. Solo
# se mueven los objetos taggeados con ["leg"] por cada estilo (NO la hombrera/faldon del
# panzer, que estan anclados al cuerpo). El framerate (cada cuanto alterna 1<->2) lo decide
# el juego segun la velocidad de batalla.
SWING = math.radians(18.0)

def _leg_objs():
    return [o for o in bpy.context.scene.objects if o.type in ('MESH', 'CURVE') and o.get("leg")]

def _pose_legs(legs, base_mw, pivot, theta):
    if theta == 0.0:
        for o in legs: o.matrix_world = base_mw[o.name]
    else:
        M = Matrix.Translation(pivot) @ Matrix.Rotation(theta, 4, 'Z') @ Matrix.Translation(-pivot)
        for o in legs: o.matrix_world = M @ base_mw[o.name]
    bpy.context.view_layer.update()

def _fit_top(cam, coords, margin):
    # VISTA SUPERIOR: centrar SOLO en vertical (centro del bbox en Y); en horizontal se
    # fija al eje del cuerpo (X=0, la línea de simetría) en vez del centro del bbox. Así el
    # cuerpo no se corre de lado por asimetrías (antenas/mandíbulas) ni "salta" entre los
    # frames de la animación: solo se mueven las patas.
    xs = [c.x for c in coords]; ys = [c.y for c in coords]
    halfx = max(abs(min(xs)), abs(max(xs)))      # medio ancho simétrico respecto a X=0
    ymin, ymax = min(ys), max(ys)
    cy = (ymin + ymax) / 2.0
    zmax = max(c.z for c in coords)
    cam.location = Vector((0.0, cy, zmax + 50.0))
    cam.data.ortho_scale = max(2.0 * halfx, ymax - ymin) * margin

def render_views(out_path, name, lens=60.0, views=None):
    import os
    sc = bpy.context.scene
    coords = _coords()
    base = out_path.rsplit('.', 1)[0]
    beauty = _make_cam("cam", (math.radians(77.36), 0.0, math.radians(152.54)), lens=lens)
    top    = _make_cam("camTop", (0.0, 0.0, 0.0), ortho=True)            # cenital exacta, +Y arriba
    side   = _make_cam("camSide", (math.radians(82.0), 0.0, math.radians(90.0)), lens=lens)
    _fit(beauty, coords, 1.09); _fit_top(top, coords, 1.12); _fit(side, coords, 1.09)
    sc.camera = beauty
    blend_path = base + '.blend'
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    print("SAVED BLEND", blend_path, flush=True)

    # Catalogo de vistas: clave -> (camara, fondo_transparente, archivo, angulo_de_patas).
    # Las "1"/"2" son los dos frames de la animacion (patas adelante/atras intercaladas).
    JOBS = {
        'beauty':  (beauty, True,  out_path,            0.0),
        'top':     (top,    True,  base + '_top.png',   0.0),
        'side':    (side,   False, base + '_side.png',  0.0),
        'top1':    (top,    True,  base + '_top1.png',  +SWING),
        'top2':    (top,    True,  base + '_top2.png',  -SWING),
        'beauty1': (beauty, True,  base + '_b1.png',    +SWING),
        'beauty2': (beauty, True,  base + '_b2.png',    -SWING),
    }
    if views is None:
        views = (os.environ.get("CRITTER_VIEWS", "").split(",") if os.environ.get("CRITTER_VIEWS")
                 else ['beauty', 'top', 'side'])
    views = [v for v in views if v in JOBS]
    if not views: views = ['beauty', 'top', 'side']

    legs = _leg_objs()
    base_mw = {o.name: o.matrix_world.copy() for o in legs}
    ctr = sum(coords, Vector()) / len(coords)
    pivot = Vector((ctr.x, ctr.y, 0.0))   # eje vertical por el centro del cuerpo
    print("LEGS", len(legs), "pivot", tuple(round(v, 2) for v in pivot), flush=True)

    cur = None
    for v in views:
        cam, transparent, path, theta = JOBS[v]
        if legs and theta != cur:
            _pose_legs(legs, base_mw, pivot, theta); cur = theta
        sc.camera = cam; sc.render.film_transparent = transparent; sc.render.filepath = path
        print("RENDERING", name, v, cam.name, "theta", round(math.degrees(theta), 1), "->", path, flush=True)
        bpy.ops.render.render(write_still=True)
    if legs and cur != 0.0: _pose_legs(legs, base_mw, pivot, 0.0)
    print("DONE", flush=True)
