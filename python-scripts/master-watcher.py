#!/usr/bin/python
import time
import RPi.GPIO as GPIO
import subprocess
import select

print("Preparing to tail log with subprocess..")
f = subprocess.Popen(['tail','-F',"/home/jmotacek/hyperledger-pi-composer/logs/peer0org1log.txt"],\
    stdout=subprocess.PIPE,stderr=subprocess.PIPE)
p = select.poll()
p.register(f.stdout)

print("Setting up GPIO...")
GPIO.setmode(GPIO.BCM)
GPIO.setwarnings(False)
GPIO.setup(18,GPIO.OUT) # Peer 0 Green - Working
GPIO.setup(17,GPIO.OUT) # Peer 0 Amber - Chaincode installed
GPIO.setup(27,GPIO.OUT) # Peer 0 Red - Anchor peer established

#Diagnostic LED test
GPIO.output(18,GPIO.HIGH)
GPIO.output(17,GPIO.HIGH)
GPIO.output(27,GPIO.HIGH)
time.sleep(1)
GPIO.output(18,GPIO.LOW)
GPIO.output(17,GPIO.LOW)
GPIO.output(27,GPIO.LOW)

def blink1():
    GPIO.output(18,GPIO.HIGH)
    time.sleep(0.005)
    GPIO.output(18,GPIO.LOW)

print("Starting aync loop...")
# Catch keyboard exists and kill the lights
try:
    while True:
        if p.poll(1):
            line = f.stdout.readline()
            try:
                line = line.decode()
                if not 'Message GossipMessage: tag:EMPTY alive_msg' in line:
                    # print("Peer0Org1: "+line)
                    blink1()
                    # Flip Amber light on when chain code is installed
                    if 'chaincode canonical name: mycc:1.0' in line:
                        GPIO.output(17,GPIO.HIGH)
                    # Flip red on when identified as an anchor peer
                    if 'Anchor peers for org Org1MSP are anchor_peers:<host:"peer0.org1.example.com"' in line:
                        GPIO.output(27,GPIO.HIGH)
            except UnicodeDecodeError:
                # Do nothing with it... you lose sir, good day.... I SAID GOOD DAY SIR!
                pass

except KeyboardInterrupt:
    pass
    print("Stopping")
    GPIO.output(18,GPIO.LOW)
    GPIO.output(17,GPIO.LOW)
    GPIO.output(27,GPIO.LOW)
    GPIO.output(5,GPIO.LOW)
    GPIO.output(6,GPIO.LOW)
