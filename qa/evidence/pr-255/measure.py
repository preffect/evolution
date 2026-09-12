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
cx,cy=1155,540
px=region(cx-110,cy-110,221,221)
print('WALL BAND (protocell + cell_wall tier I), per ray: outline radius R px, wall band edges / R, hairline / R')
for deg in (0,90,180,270):
    a=math.radians(deg); prof=[]
    for d in range(40,110):
        x=round(cx+d*math.cos(a)); y=round(cy+d*math.sin(a)); p=px[(x,y)]; prof.append((d,p,cyan(p),sum(p)/3))
    # outline: darkest pixel between 55 and 95 px
    seg=[q for q in prof if 55<=q[0]<=95]
    R=min(seg,key=lambda q:q[3])[0]
    band=[q for q in prof if q[0]>R]
    peak=max(q[2] for q in band); half=peak/2
    on=[q[0] for q in band if q[2]>=half]
    hair=max(band,key=lambda q:q[3])[0]
    print(f'  ray {deg:3d}: R={R} px  band {on[0]}..{on[-1]} px = {on[0]/R:.3f}..{(on[-1]+1)/R:.3f} R  brightest (hairline) at {hair/R:.3f} R  peak cyan {peak:.0f}')
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
