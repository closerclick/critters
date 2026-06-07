# Construye un CRITTER en 3D desde su spec (apariencia + colores del juego) y lo renderiza.
# Uso:  blender --background --python critter3d.py -- <spec.json> <out.png>
# El spec lo genera el juego: node tools/critter_spec.mjs <preset> spec.json  (misma anatomía).
import bpy, bmesh, json, sys, math, random
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
spec_path = argv[0] if len(argv) > 0 else "/tmp/critter_spec.json"
out_path  = argv[1] if len(argv) > 1 else "/tmp/critter3d.png"
spec = json.load(open(spec_path))
A, C = spec["appearance"], spec["colors"]

SEGS = []   # geometría de cada segmento del cuerpo (para el detallado mecánico aditivo/booleano)
def h32(s):  # hash estable (djb2) → detalle DETERMINISTA por genoma
    h = 5381
    for ch in str(s): h = ((h * 33) ^ ord(ch)) & 0xffffffff
    return h
RNG = random.Random(h32(spec.get("id", "critter")))

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
    for k, v in (("Metallic", 0.0), ("Roughness", 0.97)):   # casi mate total (ajustado a mano en el blend)
        if k in b.inputs: b.inputs[k].default_value = v
    for k in ("Coat Weight", "Clearcoat", "Coat"):
        if k in b.inputs: b.inputs[k].default_value = 0.1; break
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

def mat_plate():   # placas/acoples/remaches: más oscuro y metálico (lee como pieza mecánica)
    m = bpy.data.materials.get("plate")
    if m: return m
    m = bpy.data.materials.new("plate"); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (CHITIN[0]*0.55, CHITIN[1]*0.55, CHITIN[2]*0.55, 1)
    for k, v in (("Metallic", 0.7), ("Roughness", 0.42)):
        if k in b.inputs: b.inputs[k].default_value = v
    return m

def shade_smooth(me):
    for p in me.polygons: p.use_smooth = True
    if hasattr(me, "use_auto_smooth"):
        me.use_auto_smooth = True; me.auto_smooth_angle = math.radians(40)

def add_prism(name, pts_sv, z0, height, taper, mat, bevel=0.02, down=0.0, grooves=()):
    # GEMA simétrica en el plano horizontal: anillo medio ANCHO y anillos inf/sup ESTRECHOS
    # (espejo arriba/abajo) → sin base plana, lee como 3D desde cualquier ángulo.
    # Si down>0 → gema vertical alta: girdle ANCHO en z0, punta ARRIBA (z0+height) y punta ABAJO (z0-down).
    P = [P2(x, y) for (x, y) in pts_sv]
    cx = sum(p[0] for p in P)/len(P); cy = sum(p[1] for p in P)/len(P)
    rx = max(abs(p[0]-cx) for p in P); ry = max(abs(p[1]-cy) for p in P)   # radio del girdle (mundo)
    if down > 0: zg, ztop, zbot = z0, z0 + height, z0 - down
    else:        zg, ztop, zbot = z0 + height/3, z0 + height, z0
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
    # COSTURAS booleanas: tallar surcos anulares en la malla base (antes del subsurf, que los suaviza)
    for gt in grooves:
        sc = 1 + (gt if gt >= 0 else -gt)*(taper - 1)
        gz = zg + (gt*(ztop - zg) if gt >= 0 else (-gt)*(zbot - zg))
        cutter = make_torus_obj(name+"_cut", cx, cy, gz, rx*sc, ry*sc, 0.12)
        cutter.hide_render = True
        md = ob.modifiers.new("groove", "BOOLEAN"); md.operation = 'DIFFERENCE'
        try: md.solver = 'EXACT'
        except Exception: pass
        md.object = cutter
        try:
            for o in bpy.context.selected_objects: o.select_set(False)
            bpy.context.view_layer.objects.active = ob; ob.select_set(True)
            bpy.ops.object.modifier_apply(modifier=md.name)
        except Exception as e:
            print("GROOVE FAIL", name, e, flush=True)
            if md.name in [m.name for m in ob.modifiers]: ob.modifiers.remove(md)
        bpy.data.objects.remove(cutter, do_unlink=True)
    if bevel > 0:
        bv = ob.modifiers.new("bevel", "BEVEL"); bv.width = bevel; bv.segments = 2
    ss = ob.modifiers.new("subsurf", "SUBSURF"); ss.levels = 2; ss.render_levels = 2   # suaviza el cuerpo
    shade_smooth(me)
    SEGS.append({"name": name, "cx": cx, "cy": cy, "zg": zg, "ztop": ztop, "zbot": zbot,
                 "rx": rx, "ry": ry, "taper": taper})
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

def add_box(name, loc, size, mat, rot=None, bevel=0.012):
    me = bpy.data.meshes.new(name); ob = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(ob)
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts: v.co.x *= size[0]; v.co.y *= size[1]; v.co.z *= size[2]
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:]); bm.to_mesh(me); bm.free()
    ob.location = loc
    if rot is not None: ob.rotation_euler = rot
    ob.data.materials.append(mat)
    if bevel > 0:
        bv = ob.modifiers.new("bevel", "BEVEL"); bv.width = bevel; bv.segments = 2
    return ob

def add_ring(name, cx, cy, z, rx, ry, radius, mat, nseg=56):   # anillo (acople) como curva cíclica
    cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '3D'
    sp = cu.splines.new('POLY'); sp.points.add(nseg - 1)
    for i in range(nseg):
        a = 2*math.pi*i/nseg
        sp.points[i].co = (cx + rx*math.cos(a), cy + ry*math.sin(a), z, 1)
    sp.use_cyclic_u = True
    cu.bevel_depth = radius; cu.bevel_resolution = 2; cu.fill_mode = 'FULL'
    ob = bpy.data.objects.new(name, cu); bpy.context.collection.objects.link(ob)
    ob.data.materials.append(mat); return ob

def make_torus_obj(name, cx, cy, z, rx, ry, r, smaj=48, smin=8):   # toro elíptico (cutter de surcos)
    me = bpy.data.meshes.new(name); ob = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(ob)
    bm = bmesh.new(); rings = []
    for i in range(smaj):
        a = 2*math.pi*i/smaj
        ctr = Vector((rx*math.cos(a), ry*math.sin(a), 0))
        nrm = Vector((math.cos(a)/max(rx, 1e-4), math.sin(a)/max(ry, 1e-4), 0)); nrm.normalize()
        ring = []
        for j in range(smin):
            b = 2*math.pi*j/smin
            p = ctr + nrm*(r*math.cos(b)) + Vector((0, 0, r*math.sin(b)))
            ring.append(bm.verts.new((cx + p.x, cy + p.y, z + p.z)))
        rings.append(ring)
    for i in range(smaj):
        r1 = rings[i]; r2 = rings[(i+1) % smaj]
        for j in range(smin):
            bm.faces.new([r1[j], r2[j], r2[(j+1) % smin], r1[(j+1) % smin]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:]); bm.to_mesh(me); bm.free()
    return ob

def seg_surface(seg, theta, t):   # punto + normal sobre la superficie del segmento (t: >0 hacia el tope, <0 hacia abajo)
    if t >= 0: sc = 1 + t*(seg["taper"]-1); z = seg["zg"] + t*(seg["ztop"]-seg["zg"]); span = seg["ztop"]-seg["zg"]
    else:      sc = 1 + (-t)*(seg["taper"]-1); z = seg["zg"] + (-t)*(seg["zbot"]-seg["zg"]); span = seg["zg"]-seg["zbot"]
    x = seg["cx"] + seg["rx"]*sc*math.cos(theta); y = seg["cy"] + seg["ry"]*sc*math.sin(theta)
    nz = (seg["rx"]*(1-seg["taper"])) / max(0.06, abs(span))
    if t < 0: nz = -nz
    n = Vector((math.cos(theta), math.sin(theta), nz)); n.normalize()
    return Vector((x, y, z)), n

def ring_at(seg, t):   # (cx,cy,z,rx,ry) del segmento a la altura t
    sc = 1 + (t if t >= 0 else -t)*(seg["taper"]-1)
    z = seg["zg"] + (t*(seg["ztop"]-seg["zg"]) if t >= 0 else (-t)*(seg["zbot"]-seg["zg"]))
    return seg["cx"], seg["cy"], z, seg["rx"]*sc, seg["ry"]*sc

def add_shell_plate(name, seg, th0, th1, t0, t1, lift, thick, flare, mat, nu=14, nv=4, bevel=0.02, smooth=True):
    # PLACA-CORAZA curva: sigue la superficie del segmento entre [th0,th1]x[t0,t1], levantada 'lift'
    # hacia afuera y con el BORDE INFERIOR saliente ('flare') → labio que sobresale (rompe el monolito).
    bm = bmesh.new()
    O = [[None]*(nv+1) for _ in range(nu+1)]; I = [[None]*(nv+1) for _ in range(nu+1)]
    for iu in range(nu+1):
        th = th0 + (th1-th0)*iu/nu
        for iv in range(nv+1):
            f = iv/nv; t = t0 + (t1-t0)*f
            loc, nrm = seg_surface(seg, th, t)
            lf = lift + flare*(1-f)                       # más saliente abajo (en t0)
            o = loc + nrm*lf; inn = loc + nrm*(lf - thick)
            O[iu][iv] = bm.verts.new((o.x, o.y, o.z)); I[iu][iv] = bm.verts.new((inn.x, inn.y, inn.z))
    def F(a, b, c, d): bm.faces.new([a, b, c, d])
    for iu in range(nu):
        for iv in range(nv):
            F(O[iu][iv], O[iu+1][iv], O[iu+1][iv+1], O[iu][iv+1])
            F(I[iu][iv], I[iu][iv+1], I[iu+1][iv+1], I[iu+1][iv])
    for iu in range(nu):
        F(O[iu][0], I[iu][0], I[iu+1][0], O[iu+1][0]); F(O[iu][nv], O[iu+1][nv], I[iu+1][nv], I[iu][nv])
    for iv in range(nv):
        F(O[0][iv], O[0][iv+1], I[0][iv+1], I[0][iv]); F(O[nu][iv], I[nu][iv], I[nu][iv+1], O[nu][iv+1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    me = bpy.data.meshes.new(name); ob = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(ob)
    bm.to_mesh(me); bm.free(); ob.data.materials.append(mat)
    if bevel > 0:
        bv = ob.modifiers.new("bevel", "BEVEL"); bv.width = bevel; bv.segments = 2
    shade_smooth(me); return ob

def add_spike(name, base, direction, length, width, mat):
    # PÚA piramidal de 4 caras orientada hacia 'direction' (cresta / espinas grandes).
    up = Vector(direction); up.normalize()
    ref = Vector((0, 0, 1)) if abs(up.z) < 0.9 else Vector((1, 0, 0))
    ax = up.cross(ref); ax.normalize(); ay = up.cross(ax); ay.normalize()
    b = Vector(base); w = width
    bm = bmesh.new()
    quad = [b+ax*w+ay*w, b+ax*w-ay*w, b-ax*w-ay*w, b-ax*w+ay*w]
    bv = [bm.verts.new((p.x, p.y, p.z)) for p in quad]
    tip = bm.verts.new((*(b+up*length),))
    bm.faces.new(bv[::-1])
    for i in range(4): bm.faces.new([bv[i], bv[(i+1) % 4], tip])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    me = bpy.data.meshes.new(name); ob = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(ob)
    bm.to_mesh(me); bm.free(); ob.data.materials.append(mat)
    bvm = ob.modifiers.new("bevel", "BEVEL"); bvm.width = 0.01; bvm.segments = 2
    shade_smooth(me); return ob

def add_organic(name, cx, cy, zmid, rx, ry, hz, mat, taper_y=0.0, drop=0.0, flat=0.18, sub=3):
    # CUERPO ORGÁNICO: elipsoide suave (NO gema). taper_y!=0 afina una punta hacia +Y(>0)/-Y(<0)=lágrima.
    me = bpy.data.meshes.new(name); ob = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(ob)
    bm = bmesh.new()
    try: bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=1.0)
    except TypeError: bmesh.ops.create_icosphere(bm, subdivisions=sub, diameter=2.0)
    sgn = 1.0 if taper_y >= 0 else -1.0
    for v in bm.verts:
        x, y, z = v.co
        wx, wy, wz = x*rx, y*ry, z*hz
        if taper_y != 0:
            f = max(0.0, y*sgn); k = f**1.4     # 0..1 hacia la punta (lágrima)
            wx *= (1 - 0.82*k); wy *= (1 + 0.20*f); wz = wz*(1 - 0.4*k) - drop*k
        if z < 0: wz *= (1 - flat*(-z))         # base un poco aplanada (orgánico)
        v.co = (cx+wx, cy+wy, zmid+wz)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:]); bm.to_mesh(me); bm.free()
    ob.data.materials.append(mat)
    ss = ob.modifiers.new("subsurf", "SUBSURF"); ss.levels = 1; ss.render_levels = 1
    shade_smooth(me)
    SEGS.append({"name": name, "cx": cx, "cy": cy, "zg": zmid, "ztop": zmid+hz, "zbot": zmid-hz,
                 "rx": rx, "ry": ry, "taper": 0.5})
    return ob

# ---------- construir el critter ----------
chit = mat_chitin(); glow = mat_glow(9); eye_mat = mat_eye()
plate = mat_plate(); glowB = mat_glow(15)   # piezas mecánicas + tiritas/energía brillantes
xC, y0, y1, y2 = 50, 24, 50, 76
rowY = [y0, y1, y2]
hasTh = A.get("thorax", -1) >= 0
hasAb = A.get("abdomen", -1) >= 0
legs_n = max(0, min(6, int(A.get("legs", 0))))
seg_z0 = 0.42 if legs_n > 0 else 0.14
# === CUERPO ORGÁNICO (elipsoides / lágrimas suaves, NO gemas) ===
zb = seg_z0 + 0.50                       # centro vertical del cuerpo
hcx, hcy = P2(xC, y0); tcx, tcy = P2(xC, y1); acx, acy = P2(xC, y2)

# CABEZA redonda (head 1 = hocico al frente, head 3 = más ancha)
hrx, hry, hhz = 1.18, 1.28, 0.70
if A.get("head") == 3: hrx, hry = 1.45, 1.15
htap = 1.0 if A.get("head") == 1 else 0.0          # punta al FRENTE (+Y)
head_cz = zb + 0.05
add_organic("head", hcx, hcy, head_cz, hrx, hry, hhz, chit, taper_y=htap, drop=0.05)
topz = head_cz + hhz

# MANDÍBULAS (head 2): al frente, a media altura de la cabeza, punta en pinza
if A.get("head") == 2:
    for s in (-1, 1):
        m0 = (*P2(xC + s*3, y0-1),  head_cz)
        m1 = (*P2(xC + s*6, y0-13), head_cz + 0.02)
        m2 = (*P2(xC + s*4, y0-22), head_cz + 0.04)
        add_tube("mand%d" % s, [m0, m1, m2], 0.05, chit)

# TÓRAX (elipsoide)
if hasTh: add_organic("thorax", tcx, tcy, zb, 1.16, 1.22, 0.62, chit)

# ABDOMEN / gáster: LÁGRIMA apuntando hacia ATRÁS (-Y) y cayendo
if hasAb:
    atap = -1.0 if A.get("abdomen") == 1 else -0.6
    add_organic("abdomen", acx, acy, zb + 0.02, 1.5, 1.78, 0.74, chit, taper_y=atap, drop=0.30)

# conectores (cuello/cintura) — rellenan donde los elipsoides no se solapan
midz = zb
if hasTh: add_tube("neck", [(*P2(xC, y0+9), midz), (*P2(xC, y1-9), midz)], 0.10, chit)
if hasTh and hasAb: add_tube("waist", [(*P2(xC, y1+9), midz), (*P2(xC, y2-13), midz)], 0.11, chit)

# patas
LEG_CELLS = [(0, -1), (0, 1), (1, -1), (1, 1), (2, -1), (2, 1)]
for i in range(legs_n):
    r, side = LEG_CELLS[i]; yy = rowY[r]
    ax = xC + side*8; kx = xC + side*20; fx = xC + side*31
    knee_up = 0.55 if A.get("legStyle") == 1 else 0.35   # el codo dobla HACIA ARRIBA (Z), no al frente
    pa = (*P2(ax, yy), seg_z0 + 0.10); pk = (*P2(kx, yy), seg_z0 + knee_up); pf = (*P2(fx, yy + 4), 0.0)
    add_tube("leg%d" % i, [pa, pk, pf], 0.06, chit)
    add_sphere("hip%d" % i, pa, 0.10, plate)        # acople de cadera (pieza)
    add_sphere("knee%d" % i, pk, 0.07, glowB)       # junta ILUMINADA en el codo
    add_diamond("foot%d" % i, (pf[0], pf[1], 0.03), 0.108, glow)   # pies 20% más grandes

# antenas: la BASE va EMBEBIDA dentro de la cabeza (atrás hacia el centro y abajo, donde la
# sección es ancha) → el tubo atraviesa la superficie y queda enchufado, no flotando.
if A.get("antennae"):
    for s in (-1, 1):
        p0 = (*P2(xC + s*3, y0+1),  head_cz + hhz*0.2)   # raíz DENTRO de la cabeza
        p1 = (*P2(xC + s*5, y0-7),  topz*0.98)           # sale por arriba
        p2 = (*P2(xC + s*8, y0-16), topz+0.4); p3 = (*P2(xC + s*6, y0-24), topz+0.78)
        add_tube("ant%d" % s, [p0, p1, p2, p3], 0.035, chit)
        add_diamond("anttip%d" % s, p3, 0.06, glow)

# ojos: frente-superior de la cabeza orgánica
eyeY = y0 - 7 if A.get("head") == 3 else y0 - 8
eyexs = [xC-4.8, xC+4.8] + ([xC] if A.get("head") == 3 else [])
eye_z = head_cz + hhz*0.32
for j, ex in enumerate(eyexs):
    e = P2(ex, eyeY); add_sphere("eye%d" % j, (e[0], e[1], eye_z), 0.18, eye_mat)   # ojos ESFÉRICOS negros

# ---------- DETALLADO mecánico (aditivo): acoples, remaches, tiritas iluminadas, placas, energía ----------
def detail_segment(seg):
    nm = seg["name"]; is_head = (nm == "head"); front = math.pi/2   # +Y = frente
    # ===== GEOMETRÍA GRANDE: bandas de ARMADURA apiladas que envuelven el cuerpo =====
    # (en la cabeza dejan libre el frente: cara/ojos/mandíbulas). Cada banda tiene labio saliente.
    a0, a1 = (front+0.95, front+2*math.pi-0.95) if is_head else (front+0.45, front+2*math.pi-0.45)
    nb = 3
    for bi in range(nb):
        t0 = -0.15 + bi*0.30; t1 = t0 + 0.34
        lift = 0.05 + bi*0.022
        add_shell_plate("arm_%s_%d" % (nm, bi), seg, a0, a1, t0, t1, lift, 0.055, 0.13, plate, nu=16, nv=4)
        lip = []                                  # tirita glow en el labio inferior de la banda
        for k in range(13):
            th = a0 + (a1-a0)*k/12; loc, n = seg_surface(seg, th, t0); o = loc + n*(lift+0.13)
            lip.append((o.x, o.y, o.z))
        add_tube("armlip_%s_%d" % (nm, bi), lip, 0.02, glowB)
    # ===== PLACAS DORSALES grandes e inclinadas: facetan el lomo (rompen el blob liso) =====
    d0, d1 = (front+1.2, front+2*math.pi-1.2) if is_head else (0.0, 2*math.pi)
    nbig = RNG.randint(4, 6)
    for i in range(nbig):
        th = d0 + (d1-d0)*(i+0.5)/nbig + RNG.uniform(-0.15, 0.15)
        t = RNG.uniform(0.35, 0.62)
        loc, n = seg_surface(seg, th, t)
        # inclinar la placa: normal mezclada con una tangente → cara facetada que sobresale por un borde
        tang = Vector((-math.sin(th), math.cos(th), 0))
        d = n + tang*RNG.uniform(-0.5, 0.5) + Vector((0, 0, RNG.uniform(0.1, 0.4)))
        rot = d.to_track_quat('Z', 'Y').to_euler()
        w = RNG.uniform(0.34, 0.52); h = RNG.uniform(0.3, 0.5); thick = RNG.uniform(0.05, 0.09)
        c = loc + n*RNG.uniform(0.03, 0.09)
        add_box("big_%s_%d" % (nm, i), (c.x, c.y, c.z), (w, h, thick), plate, rot=rot, bevel=0.02)
    # ===== CRESTA de PÚAS que se ABREN hacia afuera (frill) en la corona =====
    c0, c1 = (front+1.5, front+2*math.pi-1.5) if is_head else (0.0, 2*math.pi)
    ncrest = RNG.randint(5, 7)
    for i in range(ncrest):
        th = c0 + (c1-c0)*(i+0.5)/ncrest
        loc, n = seg_surface(seg, th, 0.62)
        d = n*1.4 + Vector((0, 0, 0.55))   # se abren hacia afuera → visibles en silueta
        add_spike("crest_%s_%d" % (nm, i), (loc.x, loc.y, loc.z), (d.x, d.y, d.z),
                  RNG.uniform(0.34, 0.58), RNG.uniform(0.07, 0.11), plate)
    # ===== ACOPLES (anillos) en girdle y base =====
    for k, t in enumerate((0.0, -0.45)):
        cx, cy, z, rx, ry = ring_at(seg, t)
        add_ring("acpl_%s_%d" % (nm, k), cx, cy, z, rx*1.02, ry*1.02, 0.045 if t == 0 else 0.03, plate)
    # ===== DETALLE FINO: remaches + piezas de energía =====
    for i in range(RNG.randint(6, 9)):
        loc, n = seg_surface(seg, 2*math.pi*i/8 + RNG.uniform(-0.1, 0.1), 0.0)
        add_sphere("stud_%s_%d" % (nm, i), (loc.x, loc.y, loc.z), RNG.uniform(0.035, 0.055), plate)
    for i in range(RNG.randint(4, 7)):
        loc, n = seg_surface(seg, RNG.uniform(0, 2*math.pi), RNG.uniform(0.1, 0.7))
        add_sphere("gpx_%s_%d" % (nm, i), (loc.x, loc.y, loc.z), RNG.uniform(0.03, 0.05), glowB)

DETAIL = False   # primero la FORMA orgánica limpia; el detallado se re-activa luego
if DETAIL:
    for _seg in list(SEGS): detail_segment(_seg)

# ---------- escena ----------
def add_area(name, loc, energy, size, color=(1, 1, 1), rot=None):
    l = bpy.data.lights.new(name, 'AREA'); l.energy = energy; l.size = size; l.color = color
    o = bpy.data.objects.new(name, l); o.location = loc; bpy.context.collection.objects.link(o)
    if rot is not None: o.rotation_euler = rot
    else: o.rotation_euler = (Vector((0, 0, 0.4)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
add_area("key", (3.5, 4.5, 5.5), 350, 4)        # frente (+Y, lado de la cara)
add_area("fill", (-4.5, 3, 3), 110, 5)
add_area("rim", (-2.5, -5.5, 3.5), 600, 4, (1.0, 0.55, 0.35))   # atrás (-Y), rim cálido
# rim2: área cálido extra por DEBAJO y al FRENTE (ajustado a mano en el blend, rotación propia)
add_area("rim2", (4.2555, 7.1332, -2.0159), 600, 4, (1.0, 0.55, 0.35),
         rot=(math.radians(-35.37), math.radians(4.91), math.radians(-8.21)))

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
