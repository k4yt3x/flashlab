# FLASHlab

A simple tool to help creating and editing Motorola APX FLASHcodes.

The reason for the creation of this tool is to allow unlimited editing of FLASHcodes for experimental reasons. Most existing FLASHcode encoders will only allow you to first select a radio model, then edit options supported by that model. This tool allows you to add/remove any option to/from the FLASHcode. It also allows you to remove options from the FLASHcode without affecting any other unrelated bits.

If you're looking to create a normal FLASHcode for your radio, you may want to use one of these FLASHcode encoders instead:

- [FLASHcode Portal](https://flashcode.radiocentral.motorolasolutions.com/) (requires MSI account)
- [CS Flashcode Tool](https://communications.support/flashcode/encoder.php)
- [akardam.net Flashcode Encoder](https://www.akardam.net/r/m/tools/fencode.pl)

![screenshot](https://github.com/k4yt3x/flashlab/assets/21986859/c3b31116-e862-48ed-8604-e5286a196030)

## Usages

Install the program:

```shell
pip install git+https://github.com/k4yt3x/flashlab.git
```

This program can be launched in two modes: CLI and GUI:

```shell
# start in CLI mode
flashlab cli

# start in GUI mode
flashlab gui
```
