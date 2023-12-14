#!/usr/bin/python
# -*- coding: utf-8 -*-
import sys

from PyQt6.QtCore import QSize, Qt
from PyQt6.QtGui import QKeySequence, QShortcut
from PyQt6.QtWidgets import (
    QApplication,
    QDialog,
    QHBoxLayout,
    QLineEdit,
    QListWidget,
    QListWidgetItem,
    QMainWindow,
    QMessageBox,
    QPushButton,
    QTextEdit,
    QVBoxLayout,
    QWidget,
)

from .flashcode import Flashcode, InvalidFlashcodeError


class FlashLabWindow(QMainWindow):
    """Main window for the FLASHlab GUI"""

    def __init__(self):
        self.flashcode = Flashcode()
        super().__init__()
        self.setWindowTitle("FLASHlab")
        self.init_ui()

    def init_ui(self):
        main_widget = QWidget(self)
        main_layout = QVBoxLayout(main_widget)
        self.setCentralWidget(main_widget)

        QMainWindow.resize(self, QSize(800, 1100))

        QShortcut(QKeySequence("Ctrl+Q"), self, QApplication.quit)
        QShortcut(QKeySequence("Ctrl+W"), self, QApplication.quit)

        # create menu bar
        menu_bar = self.menuBar()

        # file menu
        file_menu = menu_bar.addMenu("&File")
        exit_action = file_menu.addAction("E&xit")
        exit_action.triggered.connect(QApplication.quit)

        # FLASHcode menu
        flashcode_menu = menu_bar.addMenu("FLASH&code")
        load_action = flashcode_menu.addAction("&Load")
        load_action.triggered.connect(self.load_options)
        update_action = flashcode_menu.addAction("&Update")
        update_action.triggered.connect(self.update_options)
        create_action = flashcode_menu.addAction("&Create")
        create_action.triggered.connect(self.create_options)
        clear_action = flashcode_menu.addAction("&Clear")
        clear_action.triggered.connect(self.clear_options)
        show_bits_action = flashcode_menu.addAction("Show &Bits")
        show_bits_action.triggered.connect(self.show_bits)

        # about menu
        help_menu = menu_bar.addMenu("&Help")
        about_action = help_menu.addAction("&About")
        about_action.triggered.connect(self.show_about_dialog)

        # top input field and buttons
        top_layout = QHBoxLayout()
        self.flashcode_field = QLineEdit(self)
        load_button = QPushButton("Load", self)
        update_button = QPushButton("Update", self)
        create_button = QPushButton("Create", self)
        clear_button = QPushButton("Clear", self)
        show_bits_button = QPushButton("Show Bits", self)

        load_button.clicked.connect(self.load_options)
        update_button.clicked.connect(self.update_options)
        create_button.clicked.connect(self.create_options)
        clear_button.clicked.connect(self.clear_options)
        show_bits_button.clicked.connect(self.show_bits)

        top_layout.addWidget(self.flashcode_field)
        top_layout.addWidget(load_button)
        top_layout.addWidget(update_button)
        top_layout.addWidget(create_button)
        top_layout.addWidget(clear_button)
        top_layout.addWidget(show_bits_button)

        # scrollable list for options
        self.option_items_list = QListWidget(self)

        # add all options
        for option in self.flashcode.options:
            item = QListWidgetItem(f"{option}", self.option_items_list)
            item.setFlags(item.flags() | Qt.ItemFlag.ItemIsUserCheckable)
            item.setCheckState(Qt.CheckState.Unchecked)

        # add top layout and options list to main layout
        main_layout.addLayout(top_layout)
        main_layout.addWidget(self.option_items_list)

        # set example text to the text field
        self.flashcode_field.setText(str(self.flashcode))

    def show_about_dialog(self):
        message_box = QMessageBox()
        message_box.setWindowTitle("About FLASHlab")
        message_box.setText("FLASHlab\nCopyright (C) 2023 K4YT3X")
        message_box.exec()

    def load_options(self):
        try:
            self.flashcode = Flashcode(self.flashcode_field.text())
        except InvalidFlashcodeError as error:
            message_box = QMessageBox()
            message_box.setWindowTitle("Load FLASHcode error")
            message_box.setText(f"Unable to load FLASHcode:\n{str(error)}")
            message_box.exec()
            return

        for index in range(self.option_items_list.count()):
            item = self.option_items_list.item(index)
            for option in self.flashcode.get_enabled_options():
                if item.text() in option:
                    item.setCheckState(Qt.CheckState.Checked)
                    break
            else:
                item.setCheckState(Qt.CheckState.Unchecked)

    @staticmethod
    def get_checked_items(list_widget):
        for i in range(list_widget.count()):
            item = list_widget.item(i)
            if item.checkState() == Qt.CheckState.Checked:
                yield item

    def update_options(self):
        selected_options = [
            item.text() for item in self.get_checked_items(self.option_items_list)
        ]

        previous_flashcode = self.flashcode

        for option in selected_options:
            if option not in self.flashcode.get_enabled_options():
                self.flashcode.add_option(option)

        for option in list(previous_flashcode.get_enabled_options()):
            if option not in selected_options:
                self.flashcode.remove_option(option)

        self.flashcode_field.setText(str(self.flashcode))

    def create_options(self):
        selected_options = [
            item.text() for item in self.get_checked_items(self.option_items_list)
        ]
        self.flashcode = Flashcode()
        for option in selected_options:
            self.flashcode.add_option(option)
        self.flashcode_field.setText(str(self.flashcode))

    def clear_options(self):
        self.flashcode = Flashcode()
        self.flashcode_field.setText(str(self.flashcode))
        self.load_options()

    def show_bits(self):
        dialog = QDialog()
        dialog.setWindowTitle("FLASHcode bits")
        layout = QVBoxLayout(dialog)
        text_edit = QTextEdit()
        text_edit.setReadOnly(True)
        text_edit.setText(self.flashcode.as_bits_str())
        layout.addWidget(text_edit)
        close_button = QPushButton("Close", dialog)
        close_button.clicked.connect(dialog.close)
        layout.addWidget(close_button)
        dialog.exec()


def start_gui():
    app = QApplication(sys.argv)
    main_win = FlashLabWindow()
    main_win.show()
    return app.exec()
