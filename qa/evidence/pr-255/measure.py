import subprocess, re, math, sys
IMG='full-1920.png'
def region(x,y,w,h):
    out=subprocess.run(['convert',IMG,'-crop',f'{w}x{h}+{x}+{y}','+repage','-depth','8','txt:-'],capture_output=True,text=True).stdout
    px={}
    for m in re.finditer(r'^(\d+),(\d+): \((\d+),(\d+),(\d+)',out,re.M):
        px[(int(m[1])+x,int(m[2])+y)]=(int(m[3]),int(m[4]),int(m[5]))
    return px
def cyan(p):  # cyan-ish line signal: blue+green above red
    r,g,b=p; return max(0,(g+b)/2-r)
# ---- (c) wall band along four rays, green cell centre (1155,540)
# The wall band is the only cyan feature outside the body, so it is found from the cyan signal
# alone: sub-pixel half-max edges around the cyan peak, and the light hairline as the luma peak
# inside the band (parabolic on its neighbours). Everything printed in px needs no radius.
# The radius is then ANCHORED on the spec: the band's inner edge is CELL_WALL_INNER_RADII 1.05 r
# (cell-shape.ts), so R = inner / 1.05. That anchor is assumed, not measured, so the "/R" columns
# test the band's THICKNESS and the hairline's place inside it, never the 1.05 itself. The
# independent cross-check is R_edge, the cell body's own outer edge (the half-max of the rim-light
# fall-off against the floor of the gap between the body and the band); it reads a little inside R
# because the outline's antialiased skirt is counted as body.
# The spec, mirroring constants/cell-shape.ts: the base band is 1.05 -> 1.095 with the hairline at
# 1.075, and the thickness and the hairline offset scale per tier off the inner edge.
CELL_WALL_INNER_RADII = 1.05
CELL_WALL_BASE_OUTER_RADII = 1.095
CELL_WALL_BASE_HAIRLINE_RADII = 1.075
CELL_WALL_TIER_I_SCALE = 1.5  # CELL_WALL_SCALE_BY_TIER[0]
EDGE_WINDOW = 12  # px inward from the band for the body-edge cross-check

def tierOne(baseRadii):
    """A base band radius read at tier I: the inner edge plus its scaled offset from it."""
    return CELL_WALL_INNER_RADII + (baseRadii - CELL_WALL_INNER_RADII) * CELL_WALL_TIER_I_SCALE

CELL_WALL_OUTER_RADII = tierOne(CELL_WALL_BASE_OUTER_RADII)
CELL_WALL_HAIRLINE_RADII = tierOne(CELL_WALL_BASE_HAIRLINE_RADII)

def crossing(profile, index, value):
    """The sub-pixel d where `profile` crosses `value` between samples `index` and `index + 1`."""
    (d0, v0), (d1, v1) = profile[index], profile[index + 1]
    return d0 if v1 == v0 else d0 + (value - v0) * (d1 - d0) / (v1 - v0)

def peak_at(profile, index):
    """The sub-pixel abscissa of a maximum at `index`, by a parabola through its two neighbours."""
    if index == 0 or index + 1 == len(profile): return profile[index][0]
    (_, left), (d, mid), (_, right) = profile[index - 1], profile[index], profile[index + 1]
    curve = left - 2 * mid + right
    return d if curve == 0 else d + 0.5 * (left - right) / curve

cx, cy = 1155, 540
px = region(cx - 130, cy - 130, 261, 261)
print('WALL BAND (protocell + cell_wall tier I). Band edges and hairline in px, then against the radius')
print(f'  anchored on the spec inner edge {CELL_WALL_INNER_RADII} r; spec: band -> {CELL_WALL_OUTER_RADII:.4f} r, hairline {CELL_WALL_HAIRLINE_RADII:.4f} r')
for deg in (0, 90, 180, 270):
    a = math.radians(deg)
    prof = []
    for d in range(40, 120):
        x = round(cx + d * math.cos(a)); y = round(cy + d * math.sin(a)); p = px[(x, y)]
        prof.append((d, p, cyan(p), sum(p) / 3))
    cyanProfile = [(q[0], q[2]) for q in prof]
    lumaProfile = [(q[0], q[3]) for q in prof]
    top = max(range(len(prof)), key=lambda i: prof[i][2])
    floor = sorted(q[2] for q in prof)[len(prof) // 2]
    half = (prof[top][2] + floor) / 2
    first = top
    while first > 0 and prof[first - 1][2] >= half: first -= 1
    last = top
    while last + 1 < len(prof) and prof[last + 1][2] >= half: last += 1
    inner = crossing(cyanProfile, first - 1, half)
    outer = crossing(cyanProfile, last, half)
    bright = max(range(first, last + 1), key=lambda i: prof[i][3])
    hairline = peak_at(lumaProfile, bright)
    radius = inner / CELL_WALL_INNER_RADII
    # Cross-check: the body's outer edge, from the rim light down to the floor of the gap.
    gap = [q for q in prof if inner - 5 <= q[0] <= inner]
    edgeFloor = min(q[3] for q in gap)
    window = [i for i, q in enumerate(prof) if inner - EDGE_WINDOW <= q[0] <= inner]
    edgeHalf = (max(prof[i][3] for i in window) + edgeFloor) / 2
    fall = max(i for i in window if prof[i][3] >= edgeHalf)
    edgeRadius = crossing(lumaProfile, fall, edgeHalf)
    print(
        f'  ray {deg:3d}: band {inner:.2f}..{outer:.2f} px ({outer - inner:.2f} px thick), hairline {hairline:.2f} px'
        f'  |  R={radius:.1f} px -> band {inner / radius:.3f}..{outer / radius:.3f} R, hairline {hairline / radius:.3f} R'
        f'  |  R_edge={edgeRadius:.1f} px ({edgeRadius / radius - 1:+.1%})'
    )
# ---- (b) filament width around the purple cell's nucleus
ncx,ncy=1345-6,540-6
px=region(ncx-70,ncy-70,141,141)
print('FILAMENTS (cytoskeleton tier I): FWHM of each spoke on a circle 48 px from the nucleus centre (arc px)')
rad=48; samples=[]
steps=1440
for i in range(steps):
    a=2*math.pi*i/steps; x=round(ncx+rad*math.cos(a)); y=round(ncy+rad*math.sin(a)); samples.append(cyan(px[(x,y)]))
base=sorted(samples)[len(samples)//2]; peakv=max(samples)
thr=base+(peakv-base)/2
arcpx=2*math.pi*rad/steps
widths=[]; i=0
while i<steps:
    if samples[i]>thr:
        j=i
        while j<steps and samples[j]>thr: j+=1
        widths.append((j-i)*arcpx); i=j
    else: i+=1
print(f'  spokes found: {len(widths)}  widths px: {[round(w,2) for w in widths]}  mean {sum(widths)/len(widths):.2f} px  (baseline {base:.0f}, peak {peakv:.0f})')
# ---- (a) speckle lattices of the two avatar-0 cells
def dots(cx,cy):
    px=region(cx-70,cy-70,141,141); pts=set()
    for (x,y),p in px.items():
        d=math.hypot(x-cx,y-cy)
        if 38<=d<=66 and p[2]>140 and p[1]>130 and p[0]<170: pts.add((x-cx,y-cy))
    # cluster into dots
    pts=sorted(pts); dots=[]
    while pts:
        seed=pts.pop(0); comp=[seed]; k=0
        while k<len(comp):
            q=comp[k]; k+=1
            for r in list(pts):
                if abs(r[0]-q[0])<=1 and abs(r[1]-q[1])<=1: comp.append(r); pts.remove(r)
        dots.append((sum(c[0] for c in comp)/len(comp),sum(c[1] for c in comp)/len(comp)))
    return dots
A=dots(571,540); C=dots(960,540)
match=sum(1 for a in A if any(math.hypot(a[0]-c[0],a[1]-c[1])<2.5 for c in C))
print(f'SPECKLE: avatar-0 cell A dots={len(A)}, avatar-0 own cell C dots={len(C)}, A dots within 2.5 px of a C dot (same cell-frame offset) = {match}')
