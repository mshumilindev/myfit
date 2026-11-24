#!/bin/bash
# usage: frames.sh start end
for i in $(seq $1 $2); do
  if [ $i -le 15 ]; then L=$(python3 -c "print(round($i/15*4,3))"); P=0; else L=4; P=$(python3 -c "print([0.5,1.0,0.5][$i-16])"); fi
  FR_LEVEL=$L FR_PULSE=$P SIZE=320 SAMPLES=40 python3 gen.py out s12 fatigue-readiness >/dev/null 2>&1 && mv out/fatigue-readiness.png out/f$(printf %02d $i).png
done
