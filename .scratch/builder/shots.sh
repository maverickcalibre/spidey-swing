#!/bin/bash
# Take every screenshot the SPEC asks for into .scratch/builder.
# The game runs in frame.html at exactly W x H; the PNG is cropped to W x H afterwards.
CH="/c/Program Files/Google/Chrome/Application/chrome.exe"
OUT="C:/code/spidey-swing/.scratch/builder"
shot() { # file shot w h
  local ww=$(( $3 < 520 ? 520 : $3 ))
  "$CH" --headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --hide-scrollbars \
    --user-data-dir='C:\code\spidey-swing\.scratch\builder\profile-shot' --virtual-time-budget=5000 \
    --window-size=$ww,$4 --screenshot="$OUT/$1.png" \
    "file:///C:/code/spidey-swing/.scratch/builder/frame.html?w=$3&h=$4&q=shot%3D$2" >/dev/null 2>&1
  python -c "from PIL import Image; im=Image.open('$OUT/$1.png'); im.crop((0,0,$3,$4)).save('$OUT/$1.png'); print('$1', im.size, '->', ($3,$4))"
}
if [ -n "$1" ]; then shot "$@"; exit; fi
for s in name play swing base; do
  shot "$s-pc" $s 1280 720
  shot "$s-phone" $s 390 844
done
shot play-landscape play 844 390
shot base-landscape base 844 390
shot swing-landscape swing 844 390
shot name-landscape name 844 390
