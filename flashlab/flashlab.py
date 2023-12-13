#!/usr/bin/python
# -*- coding: utf-8 -*-
import argparse

from .flashlab_qt6 import start_gui
from .flashlab_shell import FlashcodeShell


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="flashlab",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "interface",
        help="interface type",
        nargs="?",
        choices=["cli", "gui"],
        default="gui",
    )
    return parser.parse_args()


def main():
    args = parse_arguments()

    if args.interface == "cli":
        try:
            FlashcodeShell().cmdloop()
        except KeyboardInterrupt:
            return 2

    else:
        return start_gui()

    return 0
