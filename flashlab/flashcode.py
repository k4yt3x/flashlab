#!/usr/bin/python
# -*- coding: utf-8 -*-
import json
import pathlib
import re

from .flashcode_mapping import FlashcodeMapping

OLD_FLASHCODE_PATTERN = (
    r"^[0-9A-Za-z#(+$)&%]{6}-[0-9A-Za-z#(+$)&%]{6}-[0-9A-Za-z#(+$)&%]{1}$"
)
FLASHCODE_PATTERN = (
    r"^[0-9A-Za-z#(+$)&%]{6}-[0-9A-Za-z#(+$)&%]{6}-[0-9A-Za-z#(+$)&%]{1}"
    "-[0-9A-Za-z#(+$)&%]{6}-[0-9A-Za-z#(+$)&%]{6}$"
)


class InvalidFlashcodeError(Exception):
    pass


class OptionNotFoundError(Exception):
    pass


class Flashcode:
    def __init__(
        self,
        flashcode: str = "000000-000000-0-000000-000000",
        options_file_path: pathlib.Path = pathlib.Path(__file__).parent
        / "options.json",
    ):
        self.flashcode_bytearray = self.flashcode_to_bytearray(flashcode)
        self.options_file_path = options_file_path
        self.load_options()

    def __str__(self):
        return self.bytearray_to_flashcode(self.flashcode_bytearray)

    def as_bytearray(self):
        return self.flashcode_bytearray

    def as_str(self):
        return str(self)

    def as_bits_str(self):
        characters = []
        for index, character in enumerate(self.as_str()):
            if character == "-":
                characters.append("- ")
            else:
                characters.append(
                    f"{FlashcodeMapping.get_flashcode_int_value(character):08b}"[::-1]
                )
                if index < len(self.as_str()):
                    characters.append(" ")
        return "".join(characters)

    def load_options(self):
        with self.options_file_path.open("r") as options_file:
            self.options = json.load(options_file)
            self.options = dict(
                sorted(
                    self.options.items(),
                    key=lambda item: (
                        item[1]["byte_offset"],
                        item[1]["bit_offset"],
                        item[1]["bit_size"],
                    ),
                )
            )

    @staticmethod
    def flashcode_to_bytearray(flashcode: str) -> bytearray:
        if len(flashcode) != 15 and len(flashcode) != 29:
            raise InvalidFlashcodeError(f"invalid FLASHcode length ({len(flashcode)})")

        if re.match(FLASHCODE_PATTERN, flashcode) is None:
            if re.match(OLD_FLASHCODE_PATTERN, flashcode) is not None:
                flashcode += "-000000-000000"
            else:
                raise InvalidFlashcodeError("invalid FLASHcode")

        byte_array = bytearray()

        for index, character in enumerate(flashcode):
            if character == "-" or index == 14:
                continue
            byte_array.append(FlashcodeMapping.get_flashcode_int_value(character))
        return byte_array

    @staticmethod
    def bytearray_to_flashcode(byte_array: bytearray) -> str:
        segments = [
            byte_array[0:6],
            byte_array[6:12],
            byte_array[12:18],
            byte_array[18:24],
        ]
        segments_characters = []

        for segment in segments:
            characters = []
            for integer in segment:
                characters.append(FlashcodeMapping.get_flashcode_char_value(integer))
            segments_characters.append("".join(characters))

        return "{}-{}-{}-{}-{}".format(
            segments_characters[0],
            segments_characters[1],
            Flashcode.calculate_flash_code_check_digit(byte_array + bytearray(b"\x00")),
            segments_characters[2],
            segments_characters[3],
        )

    @staticmethod
    def calculate_flash_code_check_digit(flashcode_bytes: bytes):
        if flashcode_bytes is None:
            return -1

        result = 0
        for index, byte in enumerate(flashcode_bytes):
            if index >= 24:
                break

            doubled = byte * 2
            temp_sum = (
                doubled // 100 + (doubled % 100) // 10 + (doubled % 100) % 10
                if index % 2 == 0
                else byte // 10 + byte % 10
            )
            result += temp_sum

        remainder = result % 10
        return 10 - remainder if remainder > 0 else remainder

    def set_bits(self, byte_offset: int, bit_offset: int, bit_size: int):
        byte_offset -= 1

        if byte_offset < 0 or bit_offset < 0 or bit_size < 1:
            raise ValueError("Invalid byte_offset, bit_offset, or bit_size")

        if byte_offset >= len(self.flashcode_bytearray):
            raise IndexError("Byte index out of range")

        for bit in range(bit_offset - bit_size + 1, bit_offset + 1):
            bitmask = 1 << bit
            self.flashcode_bytearray[byte_offset] |= bitmask

    def unset_bits(self, byte_offset: int, bit_offset: int, bit_size: int):
        byte_offset -= 1

        if byte_offset < 0 or bit_offset < 0 or bit_size < 1:
            raise ValueError("Invalid byte_offset, bit_offset, or bit_size")

        if byte_offset >= len(self.flashcode_bytearray):
            raise IndexError("Byte index out of range")

        bitmask = 0xFF
        for bit in range(bit_offset - bit_size + 1, bit_offset + 1):
            bitmask &= ~(1 << bit)

        self.flashcode_bytearray[byte_offset] &= bitmask

    def check_bits(self, byte_offset: int, bit_offset: int, bit_size: int) -> bool:
        byte_offset -= 1

        if byte_offset < 0 or bit_offset < 0 or bit_size < 1:
            raise ValueError("Invalid byte_offset, bit_offset, or bit_size")

        if byte_offset >= len(self.flashcode_bytearray):
            raise IndexError("Byte index out of range")

        bitmask = 0
        for bit in range(bit_offset - bit_size + 1, bit_offset + 1):
            bitmask |= 1 << bit

        return (self.flashcode_bytearray[byte_offset] & bitmask) == bitmask

    def add_option(self, option_name: str):
        if self.options.get(option_name) is None:
            raise OptionNotFoundError(f"option {option_name} not found")

        self.set_bits(
            self.options[option_name]["byte_offset"],
            self.options[option_name]["bit_offset"],
            self.options[option_name]["bit_size"],
        )

    def remove_option(self, option_name: str):
        if self.options.get(option_name) is None:
            raise OptionNotFoundError(f"option {option_name} not found")

        self.unset_bits(
            self.options[option_name]["byte_offset"],
            self.options[option_name]["bit_offset"],
            self.options[option_name]["bit_size"],
        )

    def get_enabled_options(self):
        enabled = []
        for option in self.options:
            if (
                self.check_bits(
                    self.options[option]["byte_offset"],
                    self.options[option]["bit_offset"],
                    self.options[option]["bit_size"],
                )
                is True
            ):
                enabled.append(option)
        return enabled

    def get_available_options(self):
        return set(self.options) - set(self.get_enabled_options())
