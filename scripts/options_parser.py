#!/usr/bin/python
# -*- coding: utf-8 -*-
import contextlib
import json
import re

options = {}

with open("data/local/hoptions.json", "r") as hoptions_file:
    hoptions = json.load(hoptions_file)

with open("data/translation.json", "r") as translations_file:
    translations = json.load(translations_file)

# SpecialFeatures.Flashport.FlashRadio.FlashcodeTable
with open("data/local/FlashcodeTable.cs", "r", encoding="utf-8") as file:
    for line in file:
        if match := re.search(r"new \w+(?<!Int)FieldLayout\(([^)]+)\)", line):
            arguments = (
                match.group(1)
                .strip()
                .replace("AcgResources.", "")
                .replace("AppResources.", "")
                .split(", ")
            )
            with contextlib.suppress(ValueError):
                arguments.remove("TypeCode.Byte")

            # skip invalid instances
            if len(arguments) < 3:
                continue

            name = arguments[0]
            name = name[1:] if name.startswith("_") else name
            name = re.sub(r"(?<=\d)_(?=\d)", "/", name)
            name = re.sub(r"(?<=Rx)_(?=Tx)", "/", name)
            name = name.replace("_", " ")

            translated = None

            for hoption in hoptions["data"]:
                if hoption["title"].upper() == name.upper():
                    translated = hoption["title"]
                    break
            else:
                if translations.get(arguments[0]) is None:
                    print(f"Untranslated name: '{arguments[0]}' ")
                    translated = name

            if translations.get(arguments[0]) is not None:
                translated = translations.get(arguments[0])

            if translated not in options:
                options[translated] = {
                    "byte_offset": int(arguments[1]),
                    "bit_offset": int(arguments[2]),
                    "bit_size": int(arguments[3] if len(arguments) >= 4 else "1"),
                }
            else:
                print(f"Duplicate option: {translated}")

options["APX XE"] = {
    "byte_offset": 1,
    "bit_offset": 2,
    "bit_size": 1,
}

with open("flashlab/options.json", "w") as options_file:
    options_file.write(json.dumps(options, indent=2))
