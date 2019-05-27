#!/bin/bash
#Bash script used to generate CPU/Memory graphs using psrecord
psrecord $(pgrep peer) --interval 1 --duration 600 --plot peer10m.png &
P1=$!
psrecord $(pgrep node) --interval 1 --duration 600 --plot node10m.png &
P2=$!
wait $P1 $P2
echo 'Done'
