#!/bin/bash
psrecord $(pgrep peer) --interval 1 --duration 6 --plot peer10m.png &
P1=$!
#psrecord $(pgrep node) --interval 1 --duration 6 --plot node10m.png &
#P2=$!
wait $P1 #$P2
echo 'Done'
