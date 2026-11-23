#!/bin/sh
# Builds rbkbd.exe (32-bit Windows) with the system clang and the minimal linker in link.py.
set -e
cd "$(dirname "$0")"
clang -target i686-pc-windows-msvc -Os -mno-sse -ffreestanding -fno-builtin -fno-stack-protector -mno-stack-arg-probe -c rbkbd.c -o rbkbd.obj
python3 link.py rbkbd.obj rbkbd.exe
