"""Generate self-contained, locally served glTF 2.0 machine study models.

Run with `python3 scripts/build-machine-assets.py`. No Blender or network needed.
All dimensions are in the inspector's scene units so existing hazard pins align.
These are illustrative training assets, not engineering drawings.
"""
import json
import math
import struct
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / 'public' / 'models'

PALETTE = {
    'frame': ('#39434a', .68, .68), 'steel': ('#777f81', .72, .42),
    'edge': ('#20282c', .5, .7), 'rubber': ('#171b1d', .02, .94),
    'belt': ('#25292a', .04, .86), 'yellow': ('#dca72a', .45, .49),
    'amber': ('#f2bd41', .35, .43), 'orange': ('#d46b25', .36, .57),
    'red': ('#bc3830', .32, .52), 'blue': ('#326487', .45, .49),
    'glass': ('#598b96', .22, .22), 'darkglass': ('#26434c', .18, .28),
    'chrome': ('#afb8b6', .85, .24), 'coal': ('#272b29', .07, .99),
    'dust': ('#77746b', .04, .98), 'guard': ('#9d7e32', .35, .67),
    'light': ('#e5ded0', .08, .38), 'white': ('#d5d3c5', .12, .72),
}

def sub(a, b): return tuple(x-y for x,y in zip(a,b))
def add(a, b): return tuple(x+y for x,y in zip(a,b))
def mul(a, k): return tuple(x*k for x in a)
def cross(a, b): return (a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0])
def unit(a):
    n=math.sqrt(sum(x*x for x in a))
    return tuple(x/n for x in a) if n else (0,1,0)

class Model:
    def __init__(self, title):
        self.title=title; self.parts=[]

    def mesh(self, name, mat, verts, faces):
        # Flat face normals reveal edges on cast and machined metal.
        v=[]; normals=[]; idx=[]
        for face in faces:
            a,b,c=[verts[i] for i in face[:3]]
            normal=unit(cross(sub(b,a),sub(c,a)))
            start=len(v)
            for i in face:
                v.append(verts[i]); normals.append(normal)
            for k in range(1,len(face)-1): idx.extend((start,start+k,start+k+1))
        self.parts.append((name,mat,v,normals,idx))

    def box(self, name, mat, xyz, size):
        x,y,z=xyz; a,b,c=[k/2 for k in size]
        v=[(x+dx*a,y+dy*b,z+dz*c) for dx,dy,dz in
           [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]]
        self.mesh(name,mat,v,[(0,3,2,1),(4,5,6,7),(0,4,7,3),(1,2,6,5),(3,7,6,2),(0,1,5,4)])

    def tube(self,name,mat,start,end,radius,segments=10,radius_end=None):
        d=unit(sub(end,start)); u=unit(cross(d,(0,0,1) if abs(d[2])<.92 else (0,1,0))); w=cross(d,u)
        r2=radius if radius_end is None else radius_end
        v=[]
        for p,r in ((start,radius),(end,r2)):
            v.extend(add(p,add(mul(u,math.cos(i*2*math.pi/segments)*r),mul(w,math.sin(i*2*math.pi/segments)*r))) for i in range(segments))
        f=[tuple(range(segments-1,-1,-1)),tuple(range(segments,2*segments))]
        f += [(i,(i+1)%segments,(i+1)%segments+segments,i+segments) for i in range(segments)]
        self.mesh(name,mat,v,f)

    def beam(self,name,mat,a,b,width,depth=None):
        depth=depth or width
        d=unit(sub(b,a)); u=unit(cross(d,(0,0,1) if abs(d[2])<.9 else (0,1,0))); w=cross(d,u)
        center=mul(add(a,b),.5); length=math.sqrt(sum(x*x for x in sub(b,a)))
        v=[add(center,add(mul(d,i*length/2),add(mul(u,j*width/2),mul(w,k*depth/2))))
           for i,j,k in [(-1,-1,-1),(-1,1,-1),(-1,1,1),(-1,-1,1),(1,-1,-1),(1,1,-1),(1,1,1),(1,-1,1)]]
        self.mesh(name,mat,v,[(0,3,2,1),(4,5,6,7),(0,4,7,3),(1,2,6,5),(3,7,6,2),(0,1,5,4)])

    def path(self,name,mat,points,radius=.02):
        for i,(a,b) in enumerate(zip(points,points[1:])): self.tube(f'{name} {i+1}',mat,a,b,radius,8)

    def rock(self,name,center,scale,mat='coal'):
        x,y,z=center; sx,sy,sz=scale
        v=[(x-sx,y,z),(x+sx,y,z),(x,y-sy,z-sz),(x,y-sy,z+sz),
           (x,y+sy,z-sz*.7),(x,y+sy,z+sz*.8),(x+sx*.65,y+sy*.45,z),(x-sx*.65,y+sy*.6,z)]
        self.mesh(name,mat,v,[(0,2,3),(1,3,2),(0,4,2),(1,2,4),(0,3,5),(1,5,3),
                              (0,5,7,4),(1,4,6,5)])

    def save(self, file):
        data=bytearray(); views=[]; accessors=[]; meshes=[]; nodes=[]
        def attr(values,kind):
            while len(data)%4: data.append(0)
            off=len(data)
            if kind=='index':
                data.extend(struct.pack('<%dI'%len(values),*values)); component=5125; typ='SCALAR'; count=len(values)
            else:
                flat=[k for row in values for k in row]
                data.extend(struct.pack('<%df'%len(flat),*flat)); component=5126; typ='VEC3'; count=len(values)
            view=len(views); views.append({'buffer':0,'byteOffset':off,'byteLength':len(data)-off})
            acc={'bufferView':view,'componentType':component,'count':count,'type':typ}
            if kind=='position':
                acc['min']=[min(row[i] for row in values) for i in range(3)]
                acc['max']=[max(row[i] for row in values) for i in range(3)]
            accessors.append(acc); return len(accessors)-1
        keys=list(PALETTE)
        materials=[]
        for key in keys:
            color,metal,rough=PALETTE[key]
            rgb=[int(color[i:i+2],16)/255 for i in (1,3,5)]
            materials.append({'name':key,'pbrMetallicRoughness':{'baseColorFactor':rgb+[1],
                 'metallicFactor':metal,'roughnessFactor':rough},'doubleSided':True})
        for name,mat,v,n,indices in self.parts:
            p=attr(v,'position'); normal=attr(n,'normal'); ind=attr(indices,'index')
            meshes.append({'name':name,'primitives':[{'attributes':{'POSITION':p,'NORMAL':normal},
                           'indices':ind,'material':keys.index(mat)}]})
            nodes.append({'name':name,'mesh':len(meshes)-1})
        gltf={'asset':{'version':'2.0','generator':'KHATRA local machine asset generator'},
              'scene':0,'scenes':[{'nodes':list(range(len(nodes)))}],
              'nodes':nodes,'meshes':meshes,'materials':materials,'accessors':accessors,
              'bufferViews':views,'buffers':[{'byteLength':len(data)}]}
        j=json.dumps(gltf,separators=(',',':')).encode()
        j+=b' ' * ((-len(j))%4)
        data.extend(b'\0' * ((-len(data))%4))
        glb=struct.pack('<III',0x46546c67,2,12+8+len(j)+8+len(data))
        glb+=struct.pack('<I4s',len(j),b'JSON')+j
        glb+=struct.pack('<I4s',len(data),b'BIN\0')+data
        OUT.mkdir(parents=True,exist_ok=True); (OUT/file).write_bytes(glb)
        print(f'{file}: {len(self.parts)} named parts, {len(glb)//1024} KiB')

def bolt_rows(m,name,xs,ys,z,mat='chrome'):
    for ix,x in enumerate(xs):
        for iy,y in enumerate(ys): m.tube(f'{name} bolt {ix}-{iy}',mat,(x,y,z),(x,y,z+.045),.025,6)

def tracks(m):
    for side in (-1,1):
        x=side*1.17
        m.box('Crawler track rubber belt','rubber',(x,-.57,0),(.63,.47,2.65))
        m.box('Crawler track steel insert','frame',(x,-.39,0),(.34,.10,2.38))
        for i in range(13):
            z=-1.22+i*.203
            m.box(f'Track shoe {side} {i}','edge',(x,-.77,z),(.7,.10,.125))
            m.box(f'Track raised cleat {side} {i}','steel',(x,-.83,z),(.57,.055,.07))
        for z in (-1.06,-.53,0,.53,1.06):
            m.tube('Track road wheel','steel',(x-.33,-.5,z),(x+.33,-.5,z),.19,14)
            m.tube('Track wheel hub','edge',(x-.38,-.5,z),(x-.34,-.5,z),.08,12)

def cab(m,x,y,z,scale=1):
    m.box('Operator cab steel shell','yellow',(x,y,z),(.98*scale,1.18*scale,1.15*scale))
    m.box('Front windshield gasket','rubber',(x,y+.14*scale,z+.585*scale),(.84*scale,.68*scale,.035))
    m.box('Tinted laminated windshield','darkglass',(x,y+.14*scale,z+.609*scale),(.76*scale,.59*scale,.023))
    for side in (-1,1):
        m.box('Cab side window','glass',(x+side*.506*scale,y+.18*scale,z+.14*scale),(.02,.54*scale,.67*scale))
        m.box('Cab door seam','edge',(x+side*.518*scale,y-.32*scale,z+.06*scale),(.021,.025,.8*scale))
        m.tube('Cab grab handle','chrome',(x+side*.54*scale,y-.25*scale,z+.36*scale),
               (x+side*.54*scale,y-.08*scale,z+.36*scale),.018,8)
    m.box('Roof mounted work lamp','light',(x,y+.62*scale,z+.45*scale),(.25,.09,.1))

def motor(m,x,y,z):
    m.tube('TEFC electric drive housing','blue',(x-.42,y,z),(x+.42,y,z),.27,20)
    for i in range(11):
        xx=x-.37+i*.074
        m.tube(f'Drive cooling fin {i}','steel',(xx-.023,y,z),(xx+.023,y,z),.29,16)
    m.box('Terminal connection box','blue',(x,y+.32,z),(.37,.22,.35))
    m.tube('Motor fan cowling','frame',(x+.42,y,z),(x+.55,y,z),.30,18)
    m.tube('Motor output coupling','chrome',(x-.57,y,z),(x-.43,y,z),.09,12)

def conveyor():
    m=Model('Belt conveyor with head drive, guards and trip wire')
    for z in (-.67,.67):
        m.box('Longitudinal channel frame','frame',(0,-.02,z),(4.08,.20,.14))
        for x in (-1.77,-.85,.2,1.65):
            m.box('Bolted support leg','steel',(x,-.55,z),(.12,1.02,.12))
            m.box('Leg foot plate','edge',(x,-1.02,z),(.34,.06,.31))
    for x in (-1.75,-1.15,-.55,.05,.65,1.25,1.75):
        m.box('Cross frame','steel',(x,-.07,0),(.075,.13,1.36))
        m.tube('Return idler','steel',(x,.18,-.61),(x,.18,.61),.095,16)
        m.tube('Carry idler left','edge',(x,.42,-.65),(x,.38,0),.086,14)
        m.tube('Carry idler right','edge',(x,.38,0),(x,.42,.65),.086,14)
    for x in (-1.87,1.87):
        m.tube('Head or tail pulley','frame',(x,.49,-.66),(x,.49,.66),.33,24)
        m.tube('Drive shaft stub','chrome',(x,.49,.66),(x,.49,.82),.08,12)
    m.box('Textured rubber carry belt','belt',(0,.67,0),(3.78,.10,1.30))
    m.box('Return belt','rubber',(0,.19,0),(3.78,.065,1.28))
    for x in (-1.49,-.9,-.25,.35,1.01,1.53):
        m.box('Belt edge anti-slip cleat','edge',(x,.725,0),(.035,.025,1.25))
    for i in range(34):
        x=-1.45+(i*37%32)*.092; z=-.51+(i*17%29)*.036
        m.rock('Irregular coal ore on belt',(x,.80,z),(.055+(i%3)*.013,.035,.05),'coal' if i%4 else 'dust')
    m.box('Drive motor mounting skid','frame',(-1.5,-.52,1.22),(1.12,.14,.74))
    motor(m,-1.48,-.12,1.2)
    m.box('Reduction gearbox housing','steel',(-1.83,.43,.94),(.58,.52,.48))
    m.tube('Reducer output','chrome',(-1.87,.49,.67),(-1.87,.49,.89),.12,14)
    for i in range(13):
        x=-1.58+i*.24
        m.tube('Mesh guard uprights','guard',(x,.15,.78),(x,1.06,.78),.018,6)
    for y in (.18,.40,.62,.84,1.06):
        m.tube('Mesh guard horizontals','guard',(-1.62,y,.78),(1.56,y,.78),.015,6)
    for x in (-1.65,1.62): m.box('Guard mounting bracket','amber',(x,.46,.78),(.085,.9,.06))
    m.box('E stop pull cord housing','red',(1.28,.91,.80),(.30,.24,.18))
    m.tube('Emergency trip cable','red',(-1.60,1.11,.86),(1.28,1.11,.86),.013,8)
    m.box('Lockable local isolator','yellow',(1.2,-.08,-.94),(.48,.64,.22))
    m.box('Isolator door','edge',(1.2,-.08,-.814),(.41,.52,.02))
    m.box('Rotary isolator handle','red',(1.2,-.03,-.78),(.20,.07,.07))
    m.path('Conduit','rubber',[(1.2,-.37,-.94),(.8,-.66,-.94),(-1.4,-.66,-.94)],.025)
    m.tube('Belt tensioner rod','chrome',(-1.44,-.2,.83),(-.82,-.2,.83),.055,12)
    m.tube('Tensioner pneumatic cylinder','blue',(-1.31,-.2,.83),(-.95,-.2,.83),.105,14)
    m.save('conveyor.glb')

def drill():
    m=Model('Underground tracked hydraulic drill rig')
    tracks(m)
    m.box('Low articulated chassis','frame',(0,-.13,0),(2.85,.38,2.05))
    m.box('Diesel power pack enclosure','orange',(-.63,.45,-.4),(1.2,.9,1.12))
    for i in range(9): m.box('Engine ventilation grille','edge',(-1.246,.37,-.86+i*.102),(.018,.55,.038))
    cab(m,1.02,.66,-.18,.87)
    m.tube('Rotary pedestal bearing','steel',(0,.04,.52),(0,.34,.52),.42,20)
    for x in (-.36,.36):
        m.beam('Reinforced drill feed rail','steel',(x,.36,.55),(x,3.03,.55),.11,.18)
        m.box('Mast slider guide','frame',(x,1.66,.55),(.19,.48,.24))
    for y in (.46,1.15,2.15,3.06): m.beam('Mast tie plate','frame',(-.41,y,.55),(.41,y,.55),.105,.19)
    m.box('Rotary percussive drill head','amber',(0,1.73,.72),(.69,.58,.59))
    m.tube('Hydraulic drill spindle','chrome',(0,1.49,.98),(0,.49,1.42),.095,16)
    m.tube('Hardened drill bit','steel',(0,.51,1.43),(0,.25,1.54),.13,10,.055)
    m.tube('Hydraulic feed actuator','blue',(-.28,.8,.22),(-.28,2.52,.22),.093,14)
    m.tube('Feed actuator piston','chrome',(-.28,2.12,.22),(-.28,2.9,.22),.043,12)
    for x in (-.48,-.42):
        m.path('Hydraulic pressure hose','rubber',[(x,.42,-.45),(x,1.18,-.20),(x,1.98,.17),(x,2.23,.51)],.035)
    m.box('Control station','yellow',(1.22,.29,.91),(.47,.59,.32))
    for x in (1.10,1.31):
        for y in (.25,.46): m.tube('Control pushbutton','red' if y>.4 else 'edge',(x,y,1.08),(x,y,1.13),.043,12)
    m.box('Emergency stop mushroom','red',(1.33,.61,1.1),(.16,.07,.15))
    m.tube('Service lamp','light',(-.45,2.75,.77),(-.45,2.75,.88),.09,12)
    m.save('drill-rig.glb')

def crusher():
    m=Model('Industrial primary jaw crusher with drive and elevated hopper')
    for x in (-1.27,1.27):
        for z in (-.86,.86): m.box('Crusher heavy mounting foot','frame',(x,-.77,z),(.28,.48,.28))
    m.box('Casting main crusher frame','frame',(0,.05,0),(2.85,1.25,2.01))
    m.box('Bolted side liner','steel',(0,.22,1.04),(2.46,.90,.09))
    bolt_rows(m,'Liner',(-1.02,-.51,0,.51,1.02),(-.1,.48),1.1)
    m.box('Discharge apron','edge',(0,-.69,.50),(2.60,.11,1.21))
    # Open flared trapezoidal steel hopper, its open mouth is visible from above.
    m.mesh('Feed hopper left wall','orange',
           [(-.78,.59,-.72),(-1.45,2.0,-1.23),(-1.45,2.0,1.30),(-.78,.59,.72)],[(0,1,2,3)])
    m.mesh('Feed hopper right wall','orange',
           [(.78,.59,.72),(1.45,2.0,1.30),(1.45,2.0,-1.23),(.78,.59,-.72)],[(0,1,2,3)])
    m.mesh('Feed hopper rear wall','frame',
           [(-.78,.59,-.72),(.78,.59,-.72),(1.45,2,-1.23),(-1.45,2,-1.23)],[(0,1,2,3)])
    for z in (-1.23,1.30): m.box('Rim reinforcement','guard',(0,2.01,z),(2.95,.09,.08))
    for x in (-1.45,1.45): m.box('Hopper rim beam','guard',(x,2.01,.035),(.09,.09,2.58))
    for i in range(14):
        x=-.55+(i*7%13)*.09; z=-.53+(i*11%13)*.095
        m.rock('Feed aggregate',(x,.78+(i%3)*.08,z),(.14,.11,.13),'dust')
    for x in (-1.53,1.53):
        m.tube('Counterweighted crusher flywheel','steel',(x-.13,.45,0),(x+.13,.45,0),.64,24)
        m.tube('Flywheel hub','chrome',(x-.19,.45,0),(x+.19,.45,0),.16,16)
        for a in range(8):
            y=.45+.45*math.cos(a*math.pi/4); z=.45*math.sin(a*math.pi/4)
            m.tube('Flywheel spoke','frame',(x+.15,.45,0),(x+.15,y,z),.06,8)
    m.box('Flywheel guard screen','guard',(1.70,.45,.03),(.055,1.37,1.36))
    for y in (-.12,.16,.44,.72,1.):
        m.tube('Guard bar','edge',(1.75,y,-.62),(1.75,y,.68),.016,8)
    motor(m,-1.6,-.36,-1.35)
    m.box('Drive motor plinth','frame',(-1.53,-.8,-1.35),(1.4,.2,.82))
    m.box('Operator grated platform','steel',(0,.7,1.38),(2.93,.11,.56))
    for x in (-1.30,0,1.30): m.tube('Platform handrail post','yellow',(x,.70,1.68),(x,1.68,1.68),.028,10)
    m.tube('Top handrail','yellow',(-1.36,1.68,1.68),(1.36,1.68,1.68),.034,12)
    m.tube('Knee handrail','yellow',(-1.36,1.19,1.68),(1.36,1.19,1.68),.022,10)
    m.box('Control and isolation box','yellow',(.95,.98,-1.19),(.41,.61,.23))
    m.box('Crusher emergency stop','red',(.95,1.06,-1.05),(.16,.12,.09))
    m.save('crusher.glb')

def excavator():
    m=Model('Hydraulic mining excavator with articulated boom and bucket')
    tracks(m)
    m.box('Undercarriage steel chassis','frame',(0,-.15,0),(2.9,.36,2.2))
    m.tube('Slew ring','steel',(0,.01,0),(0,.25,0),.79,24)
    m.box('Machinery house side panels','yellow',(-.43,.71,-.46),(1.95,1.10,1.67))
    m.box('Ventilation panel','edge',(-1.44,.77,-.56),(.032,.56,1.12))
    for i in range(9): m.box('Vented horizontal slat','steel',(-1.47,.51+i*.062,-.59),(.035,.023,.96))
    m.box('Rear counterweight','frame',(-.31,.55,-1.46),(2.50,.84,.68))
    cab(m,1.02,1.02,.20,.94)
    m.box('Travel light','light',(.45,.90,1.09),(.19,.14,.09))
    pivot=(-.50,1.07,.42); elbow=(-.47,2.37,1.79); wrist=(-.47,1.18,2.75)
    for x in (-.78,-.22):
        a=(x,pivot[1],pivot[2]); b=(x,elbow[1],elbow[2]); c=(x,wrist[1],wrist[2])
        m.beam('Welded tapered lifting boom','yellow',a,b,.25,.29)
        m.beam('Stick and dipper arm','yellow',b,c,.19,.25)
    for p,name in ((pivot,'Boom'),(elbow,'Stick'),(wrist,'Bucket')):
        m.tube(f'{name} hardened pivot pin','chrome',(-.86,p[1],p[2]),(-.14,p[1],p[2]),.10,16)
    m.tube('Boom hydraulic actuator body','blue',(-.50,1.05,.51),(-.50,1.56,.96),.12,14)
    m.tube('Boom polished ram','chrome',(-.50,1.49,.90),(-.50,2.17,1.55),.063,12)
    m.tube('Stick hydraulic actuator body','blue',(-.49,2.36,1.68),(-.49,1.85,2.15),.105,14)
    m.tube('Stick polished ram','chrome',(-.49,1.92,2.08),(-.49,1.36,2.58),.051,12)
    m.path('High pressure line left','rubber',[(-.85,1.15,.55),(-.85,1.95,1.22),(-.76,2.34,1.77),(-.75,1.46,2.55)],.027)
    m.path('High pressure line right','rubber',[(-.11,1.15,.55),(-.11,1.95,1.22),(-.19,2.34,1.77),(-.19,1.46,2.55)],.027)
    # Open steel scoop with lip; no solid cube over the cargo.
    m.mesh('Rock bucket curved back','frame',
           [(-1.07,1.19,2.72),(.13,1.19,2.72),(.13,.36,3.20),(-1.07,.36,3.20)],[(0,1,2,3)])
    m.mesh('Rock bucket floor','steel',
           [(-1.07,.36,3.20),(.13,.36,3.20),(.13,.25,3.48),(-1.07,.25,3.48)],[(0,1,2,3)])
    for x in (-1.04,.1):
        m.beam('Bucket sidewall','frame',(x,1.19,2.72),(x,.29,3.41),.055,.24)
    m.beam('Cutting edge','chrome',(-1.08,.25,3.46),(.14,.25,3.46),.065,.08)
    for x in (-.92,-.61,-.30,.01):
        m.tube('Replaceable hardened bucket tooth','steel',(x,.24,3.45),(x,.08,3.72),.07,8,.012)
    m.box('Fire extinguisher compartment','red',(-1.48,.69,-.72),(.13,.37,.18))
    m.save('excavator.glb')

if __name__=='__main__':
    conveyor();drill();crusher();excavator()
