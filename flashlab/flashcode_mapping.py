#!/usr/bin/python
# -*- coding: utf-8 -*-


class FlashcodeMapping:
    # fmt: off
    chars = [
        '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
        'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K',
        'L', 'M', 'N', 'P', 'Q', 'R', 'S', 'T', 'U', 'V',
        'W', 'X', 'Y', 'Z', 'a', 'b', 'c', 'd', 'e', 'f',
        'g', 'h', 'j', 'k', 'm', 'n', 'p', 'q', 'r', 's',
        't', 'u', 'v', 'w', 'x', 'y', 'z', '#', '(', '+',
        '$', ')', '&', '%'
    ]
    # fmt: on

    @staticmethod
    def is_char_in_flashcode_map(character: str):
        return character in FlashcodeMapping.chars

    @staticmethod
    def get_flashcode_int_value(character: str):
        return (
            FlashcodeMapping.chars.index(character)
            if character in FlashcodeMapping.chars
            else -1
        )

    @staticmethod
    def get_flashcode_char_value(integer: int):
        return (
            FlashcodeMapping.chars[integer]
            if integer < len(FlashcodeMapping.chars)
            else None
        )
