#!/bin/bash

sudo pip install psrecord
sudo apt-get install python-matplotlib python-tk

sudo apt-get install xvfb

disp=:8
screen=0
geom=640x480x24
exec Xvfb $disp -screen $screen $geom 2>/tmp/Xvfb.log &

export DISPLAY=:8
