import bpy
import json
import math
import re
import struct
import os
from pathlib import Path
from mathutils import Vector, Matrix

SOURCE = Path(os.environ.get('ANATOMY_SOURCE_DIR', '/tmp/cant-pin-me-anatomy'))
OUTPUT = Path(__file__).resolve().parent.parent/'dist/assets/anatomy'
OUTPUT.mkdir(parents=True, exist_ok=True)

# The source model uses metres, Z up, and -Y anterior.
J = {
    'hips': ([0, .027, .87], [0, .03, .97], None),
    'spine': ([0, .03, .97], [0, .03, 1.22], 'hips'),
    'chest': ([0, .03, 1.22], [0, .033, 1.43], 'spine'),
    'neck': ([0, .033, 1.43], [0, .017, 1.53], 'chest'),
    'head': ([0, .017, 1.53], [0, .017, 1.65], 'neck'),
}
for side, sign in [('L', 1), ('R', -1)]:
    J.update({
        f'clavicle_{side}': ([sign*.01, .033, 1.41], [sign*.1646, .0223, 1.3898], 'chest'),
        f'upper_arm_{side}': ([sign*.1646, .0223, 1.3898], [sign*.2167, .032, 1.1011], f'clavicle_{side}'),
        f'forearm_{side}': ([sign*.2167, .032, 1.1011], [sign*.2618, -.0151, .8632], f'upper_arm_{side}'),
        f'hand_{side}': ([sign*.2618, -.0151, .8632], [sign*.274, -.028, .745], f'forearm_{side}'),
        f'thigh_{side}': ([sign*.0831, .0044, .8614], [sign*.0811, .02, .445], 'hips'),
        f'shin_{side}': ([sign*.0811, .02, .445], [sign*.0811, -.0233, .0766], f'thigh_{side}'),
        f'foot_{side}': ([sign*.0811, -.0233, .0766], [sign*.0811, -.15, .03], f'shin_{side}'),
    })

def gltf(v):
    return [round(v[0], 6), round(v[2], 6), round(-v[1], 6)]

# Save the contract before the heavier mesh conversion so the viewer can develop against it.
rig_data = {
    'coordinateSystem': 'right-handed, metres, +Y up, +Z anterior, +X anatomical left',
    'heightMeters': 1.70,
    'bones': [{'name': name, 'canonicalName': re.sub(r'_([LR])$', r'.\1', name), 'parent': parent, 'head': gltf(head), 'tail': gltf(tail)} for name, (head, tail, parent) in J.items()],
    'limitations': 'Source anatomical geometry is static. Skin weights and exercise poses are approximations, not a validated musculoskeletal simulation or measured muscle strain.',
}
if not (OUTPUT/'rig.json').exists():(OUTPUT/'rig.json').write_text(json.dumps(rig_data, indent=2)+'\n')

if not (SOURCE/'anatomy-static.blend').exists():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for filename in ['MuscularSystem100.fbx','SkeletalSystem100.fbx']:
        bpy.ops.import_scene.fbx(filepath=str(SOURCE/filename))
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'anatomy-static.blend'))
else:
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE/'anatomy-static.blend'), load_ui=False, use_scripts=False)

EXCLUDE = ['fascia', 'bursa', 'retinacul', 'sheath', 'aponeuro', 'intermuscular sept', 'tendinous ring', 'sinus', 'cells of ethmoid', 'anal', 'urethr', 'cavernos', 'spongios', 'bulbo', 'perine', 'cremaster', 'dartos', 'puborect', 'levator ani', 'diaphragm', 'thyro', 'arytenoid', 'pharynge', 'palatogloss', 'stylogloss', 'geniogloss', 'hyogloss', 'tongue', 'internal intercostal', 'innermost intercostal', 'transversus thoracis', 'malleus', 'incus', 'stapes', 'cochlea', 'labyrinth', 'semicircular', 'vestibul', 'inner ear', 'inferior tarsus', 'superior tarsus', 'trochlea of superior oblique']
PRESERVE = ['pectoralis major', 'deltoid', 'biceps brachii', 'triceps brachii', 'brachialis', 'brachioradialis', 'latissimus', 'serratus anterior', 'trapezius', 'rectus abdominis', 'external abdominal oblique', 'sternocleidomastoid', 'gluteus maximus', 'gluteus medius', 'rectus femoris', 'vastus', 'biceps femoris', 'semitendinosus', 'semimembranosus', 'sartorius', 'adductor longus', 'adductor magnus', 'gracilis', 'gastrocnemius', 'soleus', 'tibialis anterior', 'infraspinatus', 'supraspinatus', 'teres major', 'teres minor', 'tensor fasciae']


def ancestors(obj):
    names=[]
    current=obj
    while current:
        names.append(current.name.lower())
        current=current.parent
    return ' / '.join(names)


def clamp(v):
    return max(0, min(1, v))


def smooth(v):
    v=clamp(v)
    return v*v*(3-2*v)


def blend(a,b,t):
    t=clamp(t)
    return {a: 1-t, b:t}


def weights(name, tissue, p, side):
    x,y,z=p
    n=name.lower()
    s=side if side in ['L','R'] else ('L' if x>=0 else 'R')
    ax=abs(x)
    if tissue=='bone':
        if 'clavicle' in n or 'scapula' in n:return {f'clavicle_{s}':1}
        if 'humerus' in n:return {f'upper_arm_{s}':1}
        if n.startswith('radius') or n.startswith('ulna'):return {f'forearm_{s}':1}
        if 'femur' in n:return {f'thigh_{s}':1}
        if n.startswith('tibia') or n.startswith('fibula') or 'patella' in n:return {f'shin_{s}':1}
        if 'hip bone' in n or 'sacrum' in n or 'coccyx' in n:return {'hips':1}
        if z<.15:return {f'foot_{s}':1}
        if ax>.19 and z<.91:return {f'hand_{s}':1}
        if z>1.50:return {'head':1}
        if z>1.43:return {'neck':1}
        if z<1.02:return {'hips':1}
        if z<1.19:return {'spine':1}
        return {'chest':1}
    if 'pectoralis major' in n:
        return blend('chest',f'upper_arm_{s}',smooth((ax-.065)/.12)*.94)
    if 'deltoid' in n:
        return blend(f'upper_arm_{s}',f'clavicle_{s}',smooth((z-1.33)/.08)*.82)
    if 'latissimus' in n:
        arm=smooth((ax-.105)/.08)*smooth((z-1.23)/.1)
        trunk=blend('spine','chest',smooth((z-1.03)/.21))
        return {**{key:value*(1-arm) for key,value in trunk.items()},f'upper_arm_{s}':arm}
    if 'trapezius' in n:
        if z>1.43:return blend('chest','neck',smooth((z-1.43)/.10))
        return blend('chest',f'clavicle_{s}',smooth((ax-.055)/.1)*smooth((z-1.21)/.18))
    if 'sternocleidomastoid' in n:return blend('neck','head',smooth((z-1.47)/.1))
    if 'gluteus' in n:return blend(f'thigh_{s}','hips',smooth((z-.76)/.12))
    if 'biceps brachii' in n or 'triceps brachii' in n or 'brachialis' in n:
        return blend(f'forearm_{s}',f'upper_arm_{s}',smooth((z-1.075)/.075))
    if any(k in n for k in ['infraspinatus','supraspinatus','teres major','teres minor','subscapularis']):
        return blend(f'clavicle_{s}',f'upper_arm_{s}',smooth((ax-.13)/.07)*.85)
    if ax>.175 and z>1.02:
        return blend(f'forearm_{s}',f'upper_arm_{s}',smooth((z-1.08)/.07))
    if ax>.19 and z>.70:
        return blend(f'hand_{s}',f'forearm_{s}',smooth((z-.84)/.055))
    if z<.17:return {f'foot_{s}':1}
    if z<.50:
        if z<.12:return blend(f'foot_{s}',f'shin_{s}',smooth((z-.08)/.06))
        return blend(f'shin_{s}',f'thigh_{s}',smooth((z-.405)/.085))
    if z<.91:
        return blend(f'thigh_{s}','hips',smooth((z-.81)/.13))
    if z<1.20:return blend('spine','chest',smooth((z-1.06)/.16))
    if z<1.43:return {'chest':1}
    if z<1.54:return blend('neck','head',smooth((z-1.49)/.06))
    return {'head':1}

selected=[]
for obj in list(bpy.data.objects):
    if obj.type!='MESH' or not obj.data.vertices or len(obj.data.polygons)<12:continue
    n=obj.name.lower()
    if not (re.search(r'\.[lr]$',n) or '.' not in n):continue
    if any(word in n for word in EXCLUDE):continue
    chain=ancestors(obj)
    tissue='muscle' if any(k in chain for k in ['muscular','muscles','muscle']) else 'bone'
    # Connective structures are neither muscle volumes nor bones.
    if tissue=='muscle' and any(k in n for k in ['tract','tendon','ligament','linea alba','cartilage']):continue
    side='L' if n.endswith('.l') else 'R' if n.endswith('.r') else 'midline'
    selected.append((obj,obj.name,tissue,side))

world_matrices={o.name:o.matrix_world.copy() for o,_,_,_ in selected}
keep={o for o,_,_,_ in selected}
for obj in list(bpy.data.objects):
    if obj not in keep:bpy.data.objects.remove(obj, do_unlink=True)

mat_muscle=bpy.data.materials.new('Neutral anatomical muscle')
mat_muscle.use_nodes=True
bsdf=mat_muscle.node_tree.nodes.get('Principled BSDF');bsdf.inputs['Base Color'].default_value=(.26,.29,.32,1);bsdf.inputs['Roughness'].default_value=.5
mat_muscle.diffuse_color=(.26,.29,.32,1)
mat_bone=bpy.data.materials.new('Anatomical bone')
mat_bone.use_nodes=True
bsdf=mat_bone.node_tree.nodes.get('Principled BSDF');bsdf.inputs['Base Color'].default_value=(.70,.72,.67,1);bsdf.inputs['Roughness'].default_value=.64
mat_bone.diffuse_color=(.70,.72,.67,1)

arm_data=bpy.data.armatures.new('AnatomicalRig')
arm=bpy.data.objects.new('AnatomicalRig',arm_data)
bpy.context.scene.collection.objects.link(arm)
bpy.context.view_layer.objects.active=arm
arm.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
for name,(head,tail,parent) in J.items():
    b=arm_data.edit_bones.new(name);b.head=head;b.tail=tail
    if parent:b.parent=arm_data.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT');arm.select_set(False)

buckets={}
source_records=[]
for index,(obj,original_name,tissue,side) in enumerate(selected):
    world=world_matrices[original_name]
    obj.data=obj.data.copy()
    obj.parent=None
    obj.matrix_world=Matrix.Identity(4)
    obj.data.transform(world)
    obj.data.update()
    bpy.context.view_layer.objects.active=obj
    for other in bpy.context.selected_objects:other.select_set(False)
    obj.select_set(True)
    # Cap each anatomical part independently to preserve small muscle heads.
    count=len(obj.data.polygons)
    prominent=any(k in original_name.lower() for k in PRESERVE)
    target=1600 if prominent else 450 if tissue=='bone' else 550
    if 'latissimus' in original_name.lower() or 'abdominal' in original_name.lower():target=2400
    if count>target:
        modifier=obj.modifiers.new('Web geometry reduction','DECIMATE');modifier.ratio=target/count
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    modifier=obj.modifiers.new('Stable picking triangles','TRIANGULATE')
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    face_ids=obj.data.attributes.new('anatomical_part_id','INT','FACE')
    face_ids.data.foreach_set('value',[len(source_records)]*len(obj.data.polygons))
    for poly in obj.data.polygons:poly.use_smooth=True
    obj.data.materials.clear();obj.data.materials.append(mat_muscle if tissue=='muscle' else mat_bone)
    groups={name:obj.vertex_groups.new(name=name) for name in J}
    # Bone geometry must remain rigid. Select its governing joint at its centroid.
    center=sum((v.co for v in obj.data.vertices),Vector())/len(obj.data.vertices)
    rigid=weights(original_name,tissue,center,side) if tissue=='bone' else None
    for vertex in obj.data.vertices:
        w=rigid if rigid is not None else weights(original_name,tissue,vertex.co,side)
        total=sum(w.values()) or 1
        for key,value in w.items():
            if value>.0001:groups[key].add([vertex.index],value/total,'REPLACE')
    if tissue=='bone':
        segment=next(iter(rigid));bucket=f'Skeleton_{segment}'
    elif prominent:bucket=original_name
    else:
        dominant=max(weights(original_name,tissue,center,side).items(),key=lambda item:item[1])[0]
        bucket=f'Other muscles_{dominant}'
    buckets.setdefault(bucket,[]).append(obj)
    source_records.append({'name':original_name,'tissue':tissue,'side':side,'node':bucket,'triangles':sum(len(p.vertices)-2 for p in obj.data.polygons)})
    obj.select_set(False)
    if index%100==0:print('Prepared',index,'of',len(selected),flush=True)

final=[]
for bucket,objects in buckets.items():
    for obj in objects:obj.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    if len(objects)>1:bpy.ops.object.join()
    obj=objects[0];obj.name=bucket
    records=[r for r in source_records if r['node']==bucket]
    obj['anatomicalName']=bucket.replace('Skeleton_','Skeleton: ').replace('Other muscles_','Muscles: ')
    obj['tissue']=records[0]['tissue'];obj['anatomicalSide']=records[0]['side']
    obj['source']='Z-Anatomy / BodyParts3D'
    face_ranges=[]
    face_ids=obj.data.attributes['anatomical_part_id']
    for face in obj.data.polygons:
        part_id=face_ids.data[face.index].value
        record=source_records[part_id]
        if face_ranges and face_ranges[-1]['name']==record['name']:
            face_ranges[-1]['count']+=1
        else:
            face_ranges.append({'start':face.index,'count':1,'name':record['name'],'side':record['side'],'tissue':record['tissue']})
    obj['faceRanges']=face_ranges
    modifier=obj.modifiers.new('Anatomical joint skin','ARMATURE');modifier.object=arm
    obj.parent=arm
    obj.matrix_parent_inverse=Matrix.Identity(4)
    obj.select_set(False)
    final.append(obj)

if bpy.context.scene.world is None:bpy.context.scene.world=bpy.data.worlds.new('World')
bpy.context.scene.world.color=(.05,.05,.05)
for obj in final+[arm]:obj.select_set(True)
bpy.context.view_layer.objects.active=arm
bpy.ops.export_scene.gltf(filepath=str(OUTPUT/'anatomy.next.glb'),export_format='GLB',use_selection=True,export_yup=True,export_animations=False,export_skins=True,export_extras=True,export_materials='EXPORT',export_normals=True,export_texcoords=False,export_tangents=False)
# glTF removes degenerate triangles, so derive picking ranges from the exported indices.
encoded=(OUTPUT/'anatomy.next.glb').read_bytes()
json_size=struct.unpack_from('<I',encoded,12)[0]
gltf_data=json.loads(encoded[20:20+json_size])
blob=encoded[28+json_size:]

def read_accessor(index):
    a=gltf_data['accessors'][index]
    view=gltf_data['bufferViews'][a['bufferView']]
    fmt={5121:'B',5123:'H',5125:'I',5126:'f'}[a['componentType']]
    components={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']]
    offset=a.get('byteOffset',0)+view.get('byteOffset',0)
    stride=view.get('byteStride',components*struct.calcsize(fmt))
    return [struct.unpack_from('<'+fmt*components,blob,offset+i*stride) for i in range(a['count'])]

verified_triangles=0
for node in gltf_data['nodes']:
    if 'mesh' not in node:continue
    obj=bpy.data.objects[node['name']]
    part_ids=obj.data.attributes['anatomical_part_id']
    source_faces={}
    for poly in obj.data.polygons:
        key=tuple(sorted(tuple(round(x,7) for x in (obj.data.vertices[k].co.x,obj.data.vertices[k].co.z,-obj.data.vertices[k].co.y)) for k in poly.vertices))
        part_id=part_ids.data[poly.index].value
        source_faces.setdefault(key,[]).append(part_id)
    primitives=gltf_data['meshes'][node['mesh']]['primitives']
    if len(primitives)!=1:raise ValueError('Picking requires one material per mesh')
    primitive=primitives[0]
    vertices=read_accessor(primitive['attributes']['POSITION'])
    indices=[v[0] for v in read_accessor(primitive['indices'])]
    ranges=[]
    for face_index in range(len(indices)//3):
        key=tuple(sorted(tuple(round(x,7) for x in vertices[k]) for k in indices[face_index*3:face_index*3+3]))
        if key not in source_faces:raise ValueError('Exported triangle does not match source: '+node['name'])
        part_candidates=source_faces[key]
        if not part_candidates:raise ValueError('Export duplicated an anatomical triangle')
        record=source_records[part_candidates.pop(0)]
        if ranges and ranges[-1]['name']==record['name']:
            ranges[-1]['count']+=1
        else:
            ranges.append({'start':face_index,'count':1,'name':record['name'],'side':record['side'],'tissue':record['tissue']})
    node['extras']['faceRanges']=ranges
    obj['faceRanges']=ranges
    verified_triangles+=len(indices)//3
json_bytes=json.dumps(gltf_data,separators=(',',':'),ensure_ascii=False).encode('utf-8')
json_bytes+=b' '*((-len(json_bytes))%4)
result=struct.pack('<4sII',b'glTF',2,28+len(json_bytes)+len(blob))+struct.pack('<I4s',len(json_bytes),b'JSON')+json_bytes+struct.pack('<I4s',len(blob),b'BIN\x00')+blob
(OUTPUT/'anatomy.next.glb').write_bytes(result)
(OUTPUT/'anatomy.next.glb').replace(OUTPUT/'anatomy.glb')
print('Verified picking triangle identities:',verified_triangles,flush=True)
rig_data['picking']={'property':'mesh.userData.faceRanges','index':'THREE.Raycaster intersection.faceIndex, zero based triangles','range':'start <= faceIndex < start + count'}
rig_data['meshCount']=len(final)
rig_data['triangles']=sum(sum(len(poly.vertices)-2 for poly in obj.data.polygons) for obj in final)
rig_data['sourceParts']=source_records
(OUTPUT/'rig.json').write_text(json.dumps(rig_data,indent=2)+'\n')
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'anatomy-rigged.blend'))
print('EXPORTED',rig_data['meshCount'],rig_data['triangles'],(OUTPUT/'anatomy.glb').stat().st_size,flush=True)
