# Construye un CRITTER en 3D desde su spec (apariencia + colores del juego) y lo renderiza.
# Uso:  blender --background --python critter3d.py -- <spec.json> <out.png>
# El spec lo genera el juego: node tools/critter_spec.mjs <preset> spec.json  (misma anatomía).
import bpy, bmesh, json, sys, math
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
spec_path = argv[0] if len(argv) > 0 else "/tmp/critter_spec.json"
out_path  = argv[1] if len(argv) > 1 else "/tmp/critter3d.png"
spec = json.load(open(spec_path))
A, C = spec["appearance"], spec["colors"]

bpy.ops.wm.read_factory_settings(use_empty=True)

S = 0.1
def P2(sx, sy): return ((sx - 50) * S, (50 - sy) * S)   # svg cenital -> mundo; cabeza al frente (+Y)
def hexpts(cx, cy, w, h): return [(cx, cy - h), (cx + w, cy - h*0.42), (cx + w, cy + h*0.42), (cx, cy + h), (cx - w, cy + h*0.42), (cx - w, cy - h*0.42)]
def hx(h): h = h.lstrip('#'); return tuple(int(h[i:i+2], 16)/255 for i in (0, 2, 4))
def srgb(c): return tuple((v/12.92 if v <= 0.04045 else ((v+0.055)/1.055)**2.4) for v in c)
CHITIN, EDGE, GLOW = srgb(hx(C["cBot"])), srgb(hx(C["edge"])), srgb(hx(C["glow"]))

def mat_chitin():
    m = bpy.data.materials.get("chitin")
    if m: return m
    m = bpy.data.materials.new("chitin"); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*CHITIN, 1)
    for k, v in (("Metallic", 0.15), ("Roughness", 0.50)):
        if k in b.inputs: b.inputs[k].default_value = v
    for k in ("Coat Weight", "Clearcoat", "Coat"):
        if k in b.inputs: b.inputs[k].default_value = 0.4; break
    return m

def mat_glow(strength=9.0):
    nm = "glow%d" % int(strength)
    m = bpy.data.materials.get(nm)
    if m: return m
    m = bpy.data.materials.new(nm); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    em = nt.nodes.new("ShaderNodeEmission"); em.inputs["Color"].default_value = (*GLOW, 1); em.inputs["Strength"].default_value = strength
    out = nt.nodes.new("ShaderNodeOutputMaterial"); nt.links.new(em.outputs[0], out.inputs[0])
    return m

def mat_eye():   # ojos NEGROS glossy (como los de una hormiga), no emisivos
    m = bpy.data.materials.get("eye")
    if m: return m
    m = bpy.data.materials.new("eye"); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (0.01, 0.01, 0.01, 1)
    for k, v in (("Metallic", 0.0), ("Roughness", 0.12)):
        if k in b.inputs: b.inputs[k].default_value = v
    return m

def shade_smooth(me):
    for p in me.polygons: p.use_smooth = True
    if hasattr(me, "use_auto_smooth"):
        me.use_auto_smooth = True; me.auto_smooth_angle = math.radians(40)

def add_prism(name, pts_sv, z0, height, taper, mat, bevel=0.02, down=0.0):
    # GEMA simétrica en el plano horizontal: anillo medio ANCHO y anillos inf/sup ESTRECHOS
    # (espejo arriba/abajo) → sin base plana, lee como 3D desde cualquier ángulo.
    # Si down>0 → gema vertical alta: girdle ANCHO en z0, punta ARRIBA (z0+height) y punta ABAJO (z0-down).
    P = [P2(x, y) for (x, y) in pts_sv]
    cx = sum(p[0] for p in P)/len(P); cy = sum(p[1] for p in P)/len(P)
    me = bpy.data.meshes.new(name); ob = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(ob)
    bm = bmesh.new()
    def loop(scale, z): return [bm.verts.new((cx + (x-cx)*scale, cy + (y-cy)*scale, z)) for (x, y) in P]
    if down > 0:                           # gema alta por arriba Y por abajo (girdle ancho en z0)
        bot = loop(taper, z0 - down)       # punta de abajo (estrecha)
        mid = loop(1.0, z0)                # girdle ancho a la altura del cuerpo
        top = loop(taper, z0 + height)     # punta de arriba (estrecha)
    else:
        bot = loop(taper, z0)                  # abajo (estrecho)
        mid = loop(1.0, z0 + height/3)         # ancho; el tramo de ABAJO (height/3) es la MITAD del de ARRIBA (2*height/3)
        top = loop(taper, z0 + height)         # arriba (estrecho)
    bm.faces.new(bot)            # cara inferior (anillo estrecho)
    bm.faces.new(top[::-1])      # cara superior
    n = len(P)
    for i in range(n):
        bm.faces.new([bot[i], bot[(i+1)%n], mid[(i+1)%n], mid[i]])
        bm.faces.new([mid[i], mid[(i+1)%n], top[(i+1)%n], top[i]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bm.to_mesh(me); bm.free()
    ob.data.materials.append(mat)
    if bevel > 0:
        bv = ob.modifiers.new("bevel", "BEVEL"); bv.width = bevel; bv.segments = 2
    ss = ob.modifiers.new("subsurf", "SUBSURF"); ss.levels = 2; ss.render_levels = 2   # suaviza el cuerpo
    shade_smooth(me)
    return ob

def add_tube(name, pts3d, radius, mat):
    cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '3D'
    sp = cu.splines.new('POLY'); sp.points.add(len(pts3d) - 1)
    for i, (x, y, z) in enumerate(pts3d): sp.points[i].co = (x, y, z, 1)
    cu.bevel_depth = radius; cu.bevel_resolution = 3; cu.fill_mode = 'FULL'
    ob = bpy.data.objects.new(name, cu); bpy.context.collection.objects.link(ob)
    ob.data.materials.append(mat); return ob

def add_diamond(name, loc, size, mat):
    me = bpy.data.meshes.new(name); ob = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(ob)
    bm = bmesh.new(); s = size
    top = bm.verts.new((0, 0, s)); bot = bm.verts.new((0, 0, -s))
    mid = [bm.verts.new((s, 0, 0)), bm.verts.new((0, s, 0)), bm.verts.new((-s, 0, 0)), bm.verts.new((0, -s, 0))]
    for i in range(4):
        bm.faces.new([top, mid[i], mid[(i+1)%4]]); bm.faces.new([bot, mid[(i+1)%4], mid[i]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bm.to_mesh(me); bm.free()
    ob.location = loc; ob.data.materials.append(mat); shade_smooth(me); return ob

def add_sphere(name, loc, radius, mat):
    me = bpy.data.meshes.new(name); ob = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(ob)
    bm = bmesh.new()
    try: bmesh.ops.create_icosphere(bm, subdivisions=2, radius=radius)
    except TypeError: bmesh.ops.create_icosphere(bm, subdivisions=2, diameter=radius * 2)
    bm.to_mesh(me); bm.free()
    ob.location = loc; ob.data.materials.append(mat); shade_smooth(me); return ob

# ---------- construir el critter ----------
chit = mat_chitin(); glow = mat_glow(9); eye_mat = mat_eye()
xC, y0, y1, y2 = 50, 24, 50, 76
rowY = [y0, y1, y2]
hasTh = A.get("thorax", -1) >= 0
hasAb = A.get("abdomen", -1) >= 0
legs_n = max(0, min(6, int(A.get("legs", 0))))
seg_z0 = 0.42 if legs_n > 0 else 0.14
seg_h = 0.62
# Gemas verticales: cara de la base = cara de encima (mismo tamaño), pero la cara de ABAJO
# queda CERCA del anillo del medio → su distancia al girdle es la MITAD que la de arriba.
head_up = seg_h * 1.5                            # cara de arriba: lejos del girdle (cabeza alta)
head_dn = head_up / 2                            # cara de abajo: cerca del girdle (la mitad)
ab_up   = head_up / 2                            # abdomen la MITAD de alto que la cabeza
ab_dn   = head_dn / 2
zg_head = seg_z0 + seg_h * 0.75                  # girdle (parte ancha) del cuerpo
zg_ab   = seg_z0 + seg_h * 0.45
topz = zg_head + head_up   # tope REAL de la cabeza → antenas/ojos/mandíbulas se anclan ahí

# cabeza
if A.get("head") == 1:      headpts = [(xC, y0-15), (xC+11, y0+7), (xC-11, y0+7)]
elif A.get("head") == 3:    headpts = [(xC-15, y0+8), (xC-10, y0-11), (xC+10, y0-11), (xC+15, y0+8)]
else:                       headpts = hexpts(xC, y0, 12, 13)
add_prism("head", headpts, zg_head, head_up, 0.6, chit, down=head_dn)   # cabeza: gema alta por arriba Y por abajo
if A.get("head") == 2:      # mandíbulas
    for s in (-1, 1):
        a1 = P2(xC + s*5, y0-11); a2 = P2(xC + s*9, y0-19)
        add_tube("mand%d" % s, [(*a1, topz*0.9), (*a2, topz*0.95)], 0.05, chit)

if hasTh: add_prism("thorax", hexpts(xC, y1, 12, 12), seg_z0, seg_h*0.92, 0.6, chit)
if hasAb:
    if A.get("abdomen") == 1: abpts = [(xC, y2-13), (xC+13, y2-2), (xC, y2+15), (xC-13, y2-2)]
    else: abpts = hexpts(xC, y2, 15, 17)
    add_prism("abdomen", abpts, zg_ab, ab_up, 0.62, chit, down=ab_dn)   # cola (abdomen): la MITAD de alto que la cabeza

# conectores (cintura)
midz = seg_z0 + seg_h*0.5
if hasTh: add_tube("neck", [(*P2(xC, y0+9), midz), (*P2(xC, y1-9), midz)], 0.07, chit)
if hasTh and hasAb: add_tube("waist", [(*P2(xC, y1+9), midz), (*P2(xC, y2-13), midz)], 0.07, chit)

# patas
LEG_CELLS = [(0, -1), (0, 1), (1, -1), (1, 1), (2, -1), (2, 1)]
for i in range(legs_n):
    r, side = LEG_CELLS[i]; yy = rowY[r]
    ax = xC + side*8; kx = xC + side*20; fx = xC + side*31
    knee_up = 0.55 if A.get("legStyle") == 1 else 0.35   # el codo dobla HACIA ARRIBA (Z), no al frente
    pa = (*P2(ax, yy), seg_z0 + 0.10); pk = (*P2(kx, yy), seg_z0 + knee_up); pf = (*P2(fx, yy + 4), 0.0)
    add_tube("leg%d" % i, [pa, pk, pf], 0.06, chit)
    add_diamond("foot%d" % i, (pf[0], pf[1], 0.03), 0.108, glow)   # pies 20% más grandes

# antenas
if A.get("antennae"):
    for s in (-1, 1):
        p1 = (*P2(xC + s*3, y0-11), topz*0.95); p2 = (*P2(xC + s*8, y0-18), topz+0.35); p3 = (*P2(xC + s*6, y0-24), topz+0.7)
        add_tube("ant%d" % s, [p1, p2, p3], 0.035, chit)
        add_diamond("anttip%d" % s, p3, 0.06, glow)

# ojos
eyeY = y0 - 7 if A.get("head") == 3 else y0 - 8
eyexs = [xC-4.5, xC+4.5] + ([xC] if A.get("head") == 3 else [])
for j, ex in enumerate(eyexs):
    e = P2(ex, eyeY); add_sphere("eye%d" % j, (e[0], e[1], topz*0.98), 0.18, eye_mat)   # ojos ESFÉRICOS negros

# ---------- escena ----------
def add_area(name, loc, energy, size, color=(1, 1, 1)):
    l = bpy.data.lights.new(name, 'AREA'); l.energy = energy; l.size = size; l.color = color
    o = bpy.data.objects.new(name, l); o.location = loc; bpy.context.collection.objects.link(o)
    d = Vector((0, 0, 0.4)) - Vector(loc); o.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
add_area("key", (3.5, 4.5, 5.5), 350, 4)        # frente (+Y, lado de la cara)
add_area("fill", (-4.5, 3, 3), 110, 5)
add_area("rim", (-2.5, -5.5, 3.5), 600, 4, (1.0, 0.55, 0.35))   # atrás (-Y), rim cálido

# CÁMARA: posición fijada a mano en la GUI (registrada con dump_blend.py, 2026-06-06).
cam_d = bpy.data.cameras.new("cam"); cam = bpy.data.objects.new("cam", cam_d); bpy.context.collection.objects.link(cam)
cam_d.lens = 60.0
cam.location = (6.6532, 12.8566, 3.6338)
cam.rotation_euler = (math.radians(77.36), math.radians(0.0), math.radians(152.54))
bpy.context.scene.camera = cam

w = bpy.data.worlds.new("w"); bpy.context.scene.world = w; w.use_nodes = True
bg = w.node_tree.nodes["Background"]; bg.inputs[0].default_value = (0, 0, 0, 1); bg.inputs[1].default_value = 1.0

sc = bpy.context.scene
sc.render.engine = 'CYCLES'
sc.cycles.samples = 320
try: sc.cycles.use_denoising = False   # este build no trae OpenImageDenoiser
except Exception: pass
try:
    prefs = bpy.context.preferences.addons['cycles'].preferences
    for ctype in ('OPTIX', 'CUDA'):
        try:
            prefs.compute_device_type = ctype; prefs.get_devices()
            for dev in prefs.devices: dev.use = True
            sc.cycles.device = 'GPU'; break
        except Exception: pass
except Exception: pass
sc.render.resolution_x = 1024; sc.render.resolution_y = 1024
sc.render.image_settings.file_format = 'PNG'
sc.render.filepath = out_path
# Guarda también el .blend editable (mismo nombre, extensión .blend) para que lo retoques en la GUI.
blend_path = out_path.rsplit('.', 1)[0] + '.blend'
bpy.ops.wm.save_as_mainfile(filepath=blend_path)
print("SAVED BLEND", blend_path, flush=True)
print("RENDERING", spec.get("name"), "->", out_path, flush=True)
bpy.ops.render.render(write_still=True)
print("DONE", flush=True)
