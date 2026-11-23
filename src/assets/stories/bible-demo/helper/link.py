# Minimal COFF(i386) -> PE32 linker: one object, imports by __imp__ symbols, no relocations kept.
import struct, sys
obj=open(sys.argv[1],'rb').read(); out=sys.argv[2]
DLLS={'kernel32.dll':['CreateFileA','ReadFile','CloseHandle','WriteFile','GetLastError','Sleep','WinExec'],
      'user32.dll':['GetForegroundWindow','GetWindowThreadProcessId','GetGUIThreadInfo','PostMessageW','FindWindowA','IsWindowVisible','MoveWindow','GetSystemMetrics']}
mach,nsec,_,symoff,nsym,opt,_=struct.unpack('<HHIIIHH',obj[:20])
strtab=symoff+18*nsym
def name(raw):
    if raw[:4]==b'\0\0\0\0': o=struct.unpack('<I',raw[4:])[0]; return obj[strtab+o:obj.index(b'\0',strtab+o)].decode()
    return raw.rstrip(b'\0').decode()
secs=[]
for i in range(nsec):
    h=obj[20+opt+40*i:20+opt+40*i+40]
    nm=name(h[:8]); vs,va,rs,rp,relp,_,nrel,_,ch=struct.unpack('<IIIIIIHHI',h[8:])
    secs.append(dict(name=nm,size=rs,ptr=rp,relp=relp,nrel=nrel,ch=ch))
BASE=0x400000; RVA=0x1000
img=bytearray()
for s in secs:
    s['keep']=not (s['ch']&0x800 or s['ch']&0x2000000 or s['name'].startswith(('.drectve','.debug','.llvm')))
    if not s['keep']: continue
    while len(img)%16: img.append(0)
    s['off']=len(img)
    img+= bytes(s['size']) if s['ch']&0x80 else obj[s['ptr']:s['ptr']+s['size']]
while len(img)%16: img.append(0)
# import tables
iat={}; desc=[]
names=bytearray(); 
layout=[]  # build: descriptors, then per dll ILT, IAT, then hint/names
ndll=len(DLLS); desc_off=len(img); img+=bytes(20*(ndll+1))
tabs={}
for dll,fns in DLLS.items():
    ilt=len(img); img+=bytes(4*(len(fns)+1)); ia=len(img); img+=bytes(4*(len(fns)+1)); tabs[dll]=(ilt,ia)
for k,(dll,fns) in enumerate(DLLS.items()):
    ilt,ia=tabs[dll]
    for j,fn in enumerate(fns):
        hn=len(img); img+=b'\0\0'+fn.encode()+b'\0'
        if len(img)%2: img.append(0)
        struct.pack_into('<I',img,ilt+4*j,RVA+hn); struct.pack_into('<I',img,ia+4*j,RVA+hn)
        iat[fn]=BASE+RVA+ia+4*j
    dn=len(img); img+=dll.encode()+b'\0'
    if len(img)%2: img.append(0)
    struct.pack_into('<IIIII',img,desc_off+20*k,RVA+ilt,0,0,RVA+dn,RVA+ia)
# symbols
syms=[]; i=0
while i<nsym:
    r=obj[symoff+18*i:symoff+18*i+18]; nm=name(r[:8]); val,sec,typ,cls,aux=struct.unpack('<IhHBB',r[8:])
    syms.append((nm,val,sec,cls)); 
    for _ in range(aux): syms.append(None)
    i+=1+aux
def addr(idx):
    nm,val,sec,cls=syms[idx]
    if sec>0:
        s=secs[sec-1]; assert s['keep'],nm; return BASE+RVA+s['off']+val
    if nm.startswith('__imp__'):
        return iat[nm[7:].split('@')[0]]
    raise SystemExit('unresolved '+nm)
for s in secs:
    if not s['keep']: continue
    for j in range(s['nrel']):
        va,si,ty=struct.unpack('<IIH',obj[s['relp']+10*j:s['relp']+10*j+10])
        p=s['off']+va; cur=struct.unpack_from('<I',img,p)[0]; a=addr(si)
        if ty==6: v=(cur+a)&0xffffffff
        elif ty==0x14: v=(cur+a-(BASE+RVA+p+4))&0xffffffff
        else: raise SystemExit('reloc type %x'%ty)
        struct.pack_into('<I',img,p,v)
entry=[k for k,s in enumerate(syms) if s and s[0]=='_entry'][0]
entry_rva=addr(entry)-BASE
vsize=len(img); rawsize=(vsize+0x1ff)&~0x1ff
pe=bytearray(0x200)
pe[0:2]=b'MZ'; struct.pack_into('<I',pe,0x3c,0x40)
o=0x40; pe[o:o+4]=b'PE\0\0'
struct.pack_into('<HHIIIHH',pe,o+4,0x14c,1,0,0,0,0xE0,0x0103)  # relocs stripped, executable, 32bit
oh=o+24
struct.pack_into('<HBBIIIIII',pe,oh,0x10b,6,0,rawsize,0,0,entry_rva,RVA,RVA)
struct.pack_into('<IIIHHHHHHIIIIHHIIIIII',pe,oh+28,BASE,0x1000,0x200,4,0,0,0,4,0,0,RVA+((vsize+0xfff)&~0xfff),0x200,0,2,0,0x100000,0x10000,0x100000,0x1000,0,16)
struct.pack_into('<II',pe,oh+96+8,RVA+desc_off,20*(ndll+1))   # import dir
sh=oh+0xE0
pe[sh:sh+8]=b'.all\0\0\0\0'
struct.pack_into('<IIIIIIHHI',pe,sh+8,vsize,RVA,rawsize,0x200,0,0,0,0,0xE0000060)
open(out,'wb').write(bytes(pe)+bytes(img)+bytes(rawsize-vsize))
print('ok',out,len(pe)+rawsize,'entry rva',hex(entry_rva),[ (s['name'],s['size']) for s in secs if s['keep']])
