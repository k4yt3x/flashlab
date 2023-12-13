#!/usr/bin/python
# -*- coding: utf-8 -*-
import cmd

from .flashcode import Flashcode


class FlashcodeShell(cmd.Cmd):
    """Simple shell for creating and editing FLASHcodes"""

    intro = "Welcome to FLASHlab. Type help or ? to list commands."
    prompt = "\n[FLASHcode]> "
    file = None
    flashcode = Flashcode()

    def do_load(self, arg: str):
        "Load an existing FLASHcode: LOAD [FLASHCODE]"
        self.flashcode = Flashcode(arg.strip())

    def do_new(self, arg: str):
        "Create a new blank FLASHcode: NEW"
        self.flashcode = Flashcode()

    def do_list(self, arg: str):
        "List all available options: LIST"
        for option in self.flashcode.options:
            print(
                "{}: D{} B{} S{}".format(
                    option,
                    self.flashcode.options[option]["byte_offset"],
                    self.flashcode.options[option]["bit_offset"],
                    self.flashcode.options[option]["bit_size"],
                )
            )

    def do_print(self, arg: str):
        "Print the FLASHcode: PRINT"
        print(self.flashcode.as_str())

    def do_bits(self, arg: str):
        "Print the FLASHcode as bits: BITS"
        print(self.flashcode.as_bits_str())

    def do_add(self, arg: str):
        "Add an option: ADD [OPTION]"
        self.flashcode.add_option(arg.strip())

    def do_remove(self, arg: str):
        "Remove an option: REMOVE [OPTION]"
        self.flashcode.remove_option(arg.strip())

    def do_enabled(self, arg: str):
        "Show enabled options: ENABLED"
        for option in self.flashcode.get_enabled_options():
            print(option)

    def do_available(self, arg: str):
        "Show available options: AVAILABLE"
        for option in self.flashcode.get_available_options():
            print(option)
