#!/usr/bin/python
# -*- coding: utf-8 -*-
import contextlib
import json
import re

options = {}

# SpecialFeatures.Flashport.FlashRadio.FlashcodeTable
with open("data/FlashcodeTable.cs", "r", encoding="utf-8") as file:
    for line in file:
        if match := re.search(r"new \w+FieldLayout\(([^)]+)\)", line):
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
            name = name.replace("_", " ")

            options[name.strip()] = {
                "byte_offset": int(arguments[1]),
                "bit_offset": int(arguments[2]),
                "bit_size": int(arguments[3] if len(arguments) >= 4 else "1"),
            }

options["APX XE"] = {
    "byte_offset": 1,
    "bit_offset": 2,
    "bit_size": 1,
}

with open("flashlab/options.json", "w") as options_file:
    options_file.write(json.dumps(options, indent=2))
