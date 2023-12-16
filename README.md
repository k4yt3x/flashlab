# FLASHlab

A simple tool to help creating and editing Motorola APX FLASHcodes.

The reason for the creation of this tool is to allow unlimited editing of FLASHcodes for experimental reasons. Most existing FLASHcode encoders will only allow you to first select a radio model, then edit options supported by that model. This tool allows you to add/remove any option to/from the FLASHcode. It also allows you to remove options from the FLASHcode without affecting any other unrelated bits.

If you're looking to create a normal FLASHcode for your radio, you may want to use one of these FLASHcode encoders instead:

- [FLASHcode Portal](https://flashcode.radiocentral.motorolasolutions.com/) (requires MSI account)
- [CS Flashcode Tool](https://communications.support/flashcode/encoder.php)
- [akardam.net Flashcode Encoder](https://www.akardam.net/r/m/tools/fencode.pl)

![image](https://github.com/k4yt3x/flashlab/assets/21986859/dc1ce2d3-05e4-4a97-a61c-0d18c795b192)

## Usages

Install the program:

```shell
# install from PyPI
pip install flashlab

# install from Git repository
pip install git+https://github.com/k4yt3x/flashlab.git
```

This program can be launched in two modes: CLI and GUI:

```shell
# start in CLI mode
flashlab cli

# start in GUI mode
flashlab gui
```

If the above returns command not found, you can also do:

```shell
# start in CLI mode
python -m flashlab cli

# start in GUI mode
python -m flashlab gui
```
