import argparse
import json
import math
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any

import bpy
from mathutils import Quaternion, Vector

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / 'dist/assets/exercise-posters'
PROGRESS = {
    'bench-press': .35, 'goblet-squat': .8, 'dumbbell-row': .8,
    'shoulder-press': .65, 'romanian-deadlift': .8, 'reverse-lunge': .8,
    'bicep-curl': .7, 'push-up': .65, 'lateral-raise': .85,
    'hammer-curl': .7, 'chest-fly': .7, 'bodyweight-calf-raise': 1,
    'bodyweight-squat': .75, 'dumbbell-front-raise': .8, 'dumbbell-shrug': 1,
    'dumbbell-triceps-kickback': .8, 'dumbbell-reverse-fly': .8,
    'dumbbell-reverse-lunge': .7,
}
TARGETS = {
    'bench-press': ['pectoralis major'],
    'goblet-squat': ['vastus', 'rectus femoris', 'gluteus maximus'],
    'dumbbell-row': ['latissimus', 'teres major'],
    'shoulder-press': ['deltoid'],
    'romanian-deadlift': ['biceps femoris', 'semitendinosus', 'semimembranosus', 'gluteus maximus'],
    'reverse-lunge': ['vastus', 'rectus femoris', 'gluteus maximus'],
    'bicep-curl': ['biceps brachii', 'brachialis'],
    'push-up': ['pectoralis major', 'triceps brachii'],
    'lateral-raise': ['acromial part of deltoid'],
    'hammer-curl': ['brachialis', 'brachioradialis', 'biceps brachii'],
    'chest-fly': ['pectoralis major'],
    'bodyweight-calf-raise': ['gastrocnemius', 'soleus'],
    'bodyweight-squat': ['vastus', 'rectus femoris', 'gluteus maximus'],
    'dumbbell-front-raise': ['clavicular part of deltoid'],
    'dumbbell-shrug': ['descending part of trapezius'],
    'dumbbell-triceps-kickback': ['triceps brachii'],
    'dumbbell-reverse-fly': ['spinal part of deltoid', 'transverse part of trapezius'],
    'dumbbell-reverse-lunge': ['vastus', 'rectus femoris', 'gluteus maximus'],
}


def material(name: str, color: tuple[float, float, float], metallic: float = 0, roughness: float = .58) -> Any:
    result = bpy.data.materials.new(name)
    result.diffuse_color = (*color, 1)
    result.use_nodes = True
    shader = result.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Metallic'].default_value = metallic
    shader.inputs['Roughness'].default_value = roughness
    return result


def box(name: str, location: tuple | Vector, dimensions: tuple | list, mat: Any, bevel: float = .01) -> Any:
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    if bevel:
        modifier = obj.modifiers.new('Rounded edges', 'BEVEL')
        modifier.width = bevel
        modifier.segments = 3
        obj.modifiers.new('Corner normals', 'WEIGHTED_NORMAL')
    return obj


def convert(point: list) -> Vector:
    return Vector((point[0], -point[2], point[1]))


def add_equipment(pose: dict, mats: dict) -> list:
    objects = []
    for index, dumbbell in enumerate(pose['dumbbells']):
        position = convert(dumbbell['position'])
        x, y, z, w = dumbbell['quaternion']
        rotation = Quaternion((w, x, -z, y))
        for side in [-1, 1]:
            bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=.074, depth=.075)
            obj = bpy.context.object
            obj.name = f'Dumbbell {index + 1} rubber head'
            obj.location = position + rotation @ Vector((side * .11, 0, 0))
            obj.rotation_mode = 'QUATERNION'
            obj.rotation_quaternion = rotation @ Quaternion(Vector((0, 1, 0)), math.pi / 2)
            obj.data.materials.append(mats['iron'])
            edge = obj.modifiers.new('Rubber edges', 'BEVEL')
            edge.width = .006
            edge.segments = 3
            obj.modifiers.new('Head normals', 'WEIGHTED_NORMAL')
            objects.append(obj)
        bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=.013, depth=.17)
        obj = bpy.context.object
        obj.name = f'Dumbbell {index + 1} steel grip'
        obj.location = position
        obj.rotation_mode = 'QUATERNION'
        obj.rotation_quaternion = rotation @ Quaternion(Vector((0, 1, 0)), math.pi / 2)
        obj.data.materials.append(mats['steel'])
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
        objects.append(obj)
    if pose['bench']:
        position = convert(pose['bench']['position'])
        width, height, length = pose['bench']['size']
        objects.append(box('Bench pad', position, (width, length, height), mats['pad'], .025))
        objects.append(box('Bench frame', position - Vector((0, 0, height / 2 + .03)), (.07, length * .9, .06), mats['iron']))
        leg_height = position.z - height / 2 - .04
        for side in [-1, 1]:
            y = position.y + side * length * .33
            objects.append(box('Bench upright', (position.x, y, leg_height / 2 + .04), (.06, .06, leg_height), mats['steel']))
            objects.append(box('Bench foot', (position.x, y, .022), (.48, .09, .044), mats['iron']))
    return objects


def add_light(name: str, position: tuple, power: float, size: float, color: tuple, target: Vector) -> None:
    data = bpy.data.lights.new(name, 'AREA')
    data.energy = power
    data.shape = 'DISK'
    data.size = size
    data.color = color
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = position
    obj.rotation_euler = (target - obj.location).to_track_quat('-Z', 'Y').to_euler()


def render_poster(exercise_id: str, samples: int) -> None:
    node = shutil.which('node')
    if not node:
        raise RuntimeError('Node.js is required to evaluate the app exercise poses.')
    with tempfile.TemporaryDirectory(prefix='cant-pin-me-pose-') as directory:
        path = Path(directory) / 'pose.json'
        subprocess.run([node, str(ROOT / 'scripts/export-exercise-pose.mjs'), exercise_id, str(path), str(PROGRESS[exercise_id])], check=True)
        data = json.loads(path.read_text())
    bpy.ops.wm.read_factory_settings(use_empty=True)
    mats = {
        'muscle': material('Neutral muscle', (.39, .43, .46), roughness=.63),
        'bone': material('Bone', (.52, .55, .55), roughness=.7),
        'target': material('Primary muscles', (.8, .19, .12), roughness=.54),
        'iron': material('Rubber and coated steel', (.035, .045, .055), metallic=.23, roughness=.4),
        'steel': material('Brushed steel', (.32, .38, .42), metallic=.78, roughness=.3),
        'pad': material('Bench upholstery', (.045, .06, .07), roughness=.78),
        'floor': material('Studio floor', (.024, .034, .046), roughness=.75),
    }
    objects = []
    for source in data['meshes']:
        mesh = bpy.data.meshes.new(source['name'])
        indices = source['indices']
        mesh.from_pydata(source['vertices'], [], [indices[i:i + 3] for i in range(0, len(indices), 3)])
        mesh.update()
        obj = bpy.data.objects.new(source['name'], mesh)
        bpy.context.scene.collection.objects.link(obj)
        mesh.materials.append(mats['bone'] if source['tissue'] == 'bone' else mats['muscle'])
        mesh.materials.append(mats['target'])
        for polygon in mesh.polygons:
            polygon.use_smooth = True
        for part in source['ranges']:
            name = part['name'].lower()
            target = source['tissue'] != 'bone' and any(token in name for token in TARGETS[exercise_id])
            if exercise_id == 'romanian-deadlift' and 'short head of biceps femoris' in name:
                target = False
            if target:
                for polygon in mesh.polygons[part['start']:part['start'] + part['count']]:
                    polygon.material_index = 1
        objects.append(obj)
    objects.extend(add_equipment(data['pose'], mats))
    bpy.context.view_layer.update()
    points = [obj.matrix_world @ Vector(corner) for obj in objects for corner in obj.bound_box]
    low = Vector(tuple(min(point[i] for point in points) for i in range(3)))
    high = Vector(tuple(max(point[i] for point in points) for i in range(3)))
    target = (low + high) / 2
    camera_data = bpy.data.cameras.new('Exercise camera')
    camera = bpy.data.objects.new('Exercise camera', camera_data)
    bpy.context.scene.collection.objects.link(camera)
    direction = Vector((2.8, -3.6, 1.5)).normalized()
    if exercise_id in ['bench-press', 'chest-fly', 'push-up', 'dumbbell-triceps-kickback']:
        direction = Vector((3.5, -2.7, 2.2)).normalized()
    elif exercise_id in ['dumbbell-row', 'dumbbell-reverse-fly', 'romanian-deadlift', 'dumbbell-shrug', 'bodyweight-calf-raise']:
        direction = Vector((-3.2, 2.7, 1.7)).normalized()
    elif exercise_id == 'dumbbell-front-raise':
        direction = Vector((3.8, -1.2, 1.4)).normalized()
    camera.location = target + direction * 5
    camera.rotation_euler = (target - camera.location).to_track_quat('-Z', 'Y').to_euler()
    camera_data.type = 'ORTHO'
    rotation = camera.rotation_euler.to_quaternion().inverted()
    projected = [rotation @ (point - target) for point in points]
    width = max(point.x for point in projected) - min(point.x for point in projected)
    height = max(point.y for point in projected) - min(point.y for point in projected)
    camera_data.ortho_scale = max(width, height * 4 / 3) * 1.14
    scene = bpy.context.scene
    scene.camera = camera
    box('Ground', (0, 0, -.055), (200, 200, .1), mats['floor'], 0)
    add_light('Large key', (2.5, -3, 4.5), 500, 3, (1, .91, .82), target)
    add_light('Fill', (-3, -1, 2.6), 300, 3, (.69, .82, 1), target)
    add_light('Rim', (.7, 3, 3.3), 600, 2.5, (.79, .88, 1), target)
    scene.world = bpy.data.worlds.new('Dark studio')
    scene.world.use_nodes = True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.075, .09, .12, 1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value = .4
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 640
    scene.render.resolution_y = 480
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'WEBP'
    scene.render.image_settings.quality = 88
    scene.render.image_settings.color_mode = 'RGB'
    scene.view_settings.view_transform = 'AgX'
    scene.render.filepath = str(OUTPUT / f'{exercise_id}.webp')
    bpy.ops.render.render(write_still=True)
    print(f'POSTER {exercise_id}: {scene.render.filepath}', flush=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('exercises', nargs='*', choices=list(PROGRESS))
    parser.add_argument('--samples', type=int, default=32)
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for exercise_id in args.exercises or PROGRESS:
        render_poster(exercise_id, args.samples)


if __name__ == '__main__':
    main()
