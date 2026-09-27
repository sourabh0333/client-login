"""Generates the park's characters with MPFB (MakeHuman for Blender) and exports rigged GLBs.

Run from the project root:
  tools/blender-4.5.14-windows-x64/blender.exe --background --python scripts/make_humans.py

Every asset used here (base mesh, skins, hair, clothes) is CC0.
MakeHuman age macro: 0.0 = 1 year, 0.1875 = 11 years, 0.5 = 25 years, 1.0 = 90 years.
"""

import os
import sys
import bpy

from bl_ext.user_default.mpfb.services.humanservice import HumanService
from bl_ext.user_default.mpfb.services.targetservice import TargetService

OUT = os.path.join(os.getcwd(), "assets-src", "humans")
os.makedirs(OUT, exist_ok=True)


def years(y):
    if y <= 11:
        return (y - 1) / 10 * 0.1875
    return 0.1875 + (y - 11) / 14 * (0.5 - 0.1875)


def race(african=0.0, asian=0.0, caucasian=0.0):
    return {"african": african, "asian": asian, "caucasian": caucasian}


CAST = [
    {
        "name": "artist",
        # Seen close up: smoother (subdivided) body and clothes.
        "subdiv": 1,
        "phenotype": {"gender": 0.0, "age": years(8), "muscle": 0.45, "weight": 0.5, "height": 0.5, "race": race(caucasian=0.8, asian=0.2)},
        "hair": "ponytail01/ponytail01.mhclo",
        "eyebrows": "eyebrow010/eyebrow010.mhclo",
        "skin": "young_caucasian_female/young_caucasian_female.mhmat",
        "eyes": "brown",
        "clothes": [
            "toigo_camisole_dress_with_full_skirt/toigo_camisole_dress_with_full_skirt.mhclo",
            "toigo_ballet_flats_with_bows/toigo_ballet_flats_with_bows.mhclo",
        ],
    },
    {
        "name": "swinger",
        "phenotype": {"gender": 0.0, "age": years(7), "muscle": 0.45, "weight": 0.55, "height": 0.45, "race": race(african=1.0)},
        "hair": "braid01/braid01.mhclo",
        "eyebrows": "eyebrow008/eyebrow008.mhclo",
        "skin": "young_african_female/young_african_female.mhmat",
        "eyes": "brown",
        "clothes": [
            "toigo_fisherman_sweater/toigo_fisherman_sweater.mhclo",
            "cortu_jeans_shorts/cortu_jeans_shorts.mhclo",
            "toigo_mj_cloth_shoes/toigo_mj_cloth_shoes.mhclo",
        ],
    },
    {
        "name": "thrower_a",
        "phenotype": {"gender": 1.0, "age": years(9), "muscle": 0.5, "weight": 0.5, "height": 0.55, "race": race(asian=1.0)},
        "hair": "short02/short02.mhclo",
        "eyebrows": "eyebrow001/eyebrow001.mhclo",
        "skin": "young_asian_male/young_asian_male.mhmat",
        "eyes": "brown",
        "clothes": [
            "elvs_crude_t-shirt_male/elvs_crude_t-shirt_male.mhclo",
            "cortu_cargo_pants/cortu_cargo_pants.mhclo",
            "toigo_mj_cloth_shoes/toigo_mj_cloth_shoes.mhclo",
        ],
    },
    {
        "name": "thrower_b",
        "phenotype": {"gender": 1.0, "age": years(8), "muscle": 0.5, "weight": 0.45, "height": 0.5, "race": race(caucasian=1.0)},
        "hair": "short04/short04.mhclo",
        "eyebrows": "eyebrow002/eyebrow002.mhclo",
        "skin": "young_caucasian_male/young_caucasian_male.mhmat",
        "eyes": "blue",
        "clothes": [
            "namuhekam_male_polo_shirt/namuhekam_male_polo_shirt.mhclo",
            "cortu_jeans_shorts/cortu_jeans_shorts.mhclo",
            "toigo_mj_cloth_shoes/toigo_mj_cloth_shoes.mhclo",
        ],
    },
    {
        "name": "runner_a",
        "phenotype": {"gender": 0.0, "age": years(8), "muscle": 0.5, "weight": 0.45, "height": 0.5, "race": race(asian=0.7, caucasian=0.3)},
        "hair": "bob02/bob02.mhclo",
        "eyebrows": "eyebrow009/eyebrow009.mhclo",
        "skin": "young_asian_female/young_asian_female.mhmat",
        "eyes": "brown",
        "clothes": [
            "toigo_basic_tucked_t-shirt/toigo_basic_tucked_t-shirt.mhclo",
            "toigo_wool_pants/toigo_wool_pants.mhclo",
            "toigo_mj_cloth_shoes/toigo_mj_cloth_shoes.mhclo",
        ],
    },
    {
        "name": "runner_b",
        "phenotype": {"gender": 1.0, "age": years(7), "muscle": 0.5, "weight": 0.5, "height": 0.45, "race": race(african=0.9, caucasian=0.1)},
        "hair": "short01/short01.mhclo",
        "eyebrows": "eyebrow001/eyebrow001.mhclo",
        "skin": "young_african_male/young_african_male.mhmat",
        "eyes": "brown",
        "clothes": [
            "elvs_crude_t-shirt_male/elvs_crude_t-shirt_male.mhclo",
            "cortu_jeans_shorts/cortu_jeans_shorts.mhclo",
            "toigo_mj_cloth_shoes/toigo_mj_cloth_shoes.mhclo",
        ],
    },
    {
        "name": "parent",
        "phenotype": {"gender": 0.0, "age": years(34), "muscle": 0.5, "weight": 0.55, "height": 0.5, "cupsize": 0.5, "race": race(caucasian=0.6, african=0.4)},
        "hair": "long01/long01.mhclo",
        "eyebrows": "eyebrow009/eyebrow009.mhclo",
        "skin": "young_caucasian_female/young_caucasian_female.mhmat",
        "eyes": "brownlight",
        "clothes": [
            "toigo_shift_dress/toigo_shift_dress.mhclo",
            "toigo_ankle_boots_female/toigo_ankle_boots_female.mhclo",
        ],
    },
]

only = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def clear_scene():
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.armatures, bpy.data.materials, bpy.data.images, bpy.data.node_groups):
        for block in list(coll):
            if block.users == 0:
                coll.remove(block)


def bake_shape_keys(obj):
    if obj.type != "MESH" or not obj.data.shape_keys:
        return
    obj.shape_key_add(name="__baked", from_mix=True)
    for key in list(obj.data.shape_keys.key_blocks):
        if key.name != "__baked":
            obj.shape_key_remove(key)
    obj.shape_key_remove(obj.data.shape_keys.key_blocks["__baked"])


def build(spec):
    clear_scene()
    phenotype = TargetService.get_default_macro_info_dict()
    for key, value in spec["phenotype"].items():
        phenotype[key] = value

    info = HumanService._create_default_human_info_dict()
    info.update(
        {
            "name": spec["name"],
            "phenotype": phenotype,
            "rig": "game_engine",
            "eyes": "high-poly/high-poly.mhclo" if spec.get("hi_eyes") else "low-poly/low-poly.mhclo",
            "eyebrows": spec["eyebrows"],
            "eyelashes": "eyelashes02/eyelashes02.mhclo" if spec.get("hi_eyes") else "eyelashes01/eyelashes01.mhclo",
            "teeth": "",
            "tongue": "",
            "hair": spec["hair"],
            "clothes": spec["clothes"],
            "skin_mhmat": spec["skin"],
            "skin_material_type": "GAMEENGINE",
            "eyes_material_type": "MAKESKIN",
            "clothes_material_type": "MAKESKIN",
        }
    )
    settings = HumanService.get_default_deserialization_settings()
    subdiv = spec.get("subdiv", 0)
    settings["subdiv_levels"] = subdiv
    basemesh = HumanService.deserialize_from_dict(info, settings)

    rig = basemesh.parent
    objects = [rig] + list(rig.children_recursive)
    for obj in objects:
        bake_shape_keys(obj)
        for mod in list(getattr(obj, "modifiers", [])):
            if mod.type == "SUBSURF":
                if subdiv:
                    # MPFB only subdivides at render time; the exporter uses the viewport level.
                    mod.levels = subdiv
                else:
                    obj.modifiers.remove(mod)

    # Match the animation library's bone names.
    for bone in rig.data.bones:
        if bone.name == "Root":
            bone.name = "root"
        elif bone.name == "head":
            bone.name = "Head"

    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.hide_set(False)
        obj.select_set(True)
    bpy.context.view_layer.objects.active = rig

    path = os.path.join(OUT, spec["name"] + ".glb")
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_animations=False,
        export_morph=False,
        export_skins=True,
        export_def_bones=True,
        export_yup=True,
    )
    print("EXPORTED", path, os.path.getsize(path))


for spec in CAST:
    if only and spec["name"] not in only:
        continue
    build(spec)
