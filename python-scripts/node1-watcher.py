import time
import RPi.GPIO as GPIO
import subprocess
import select

print("Preparing to tail log with subprocess..")
f = subprocess.Popen(['tail','-F',"/home/jmotacek/hyperledger-pi-composer/logs/peer1org1log.txt"],\
    stdout=subprocess.PIPE,stderr=subprocess.PIPE)
p = select.poll()
p.register(f.stdout)

print("Setting up GPIO...")
GPIO.setmode(GPIO.BCM)
GPIO.setwarnings(False)
GPIO.setup(18,GPIO.OUT) # Peer 0 Green
GPIO.setup(17,GPIO.OUT) # Peer 0 Amber

#Diagnostic LED test
GPIO.output(18,GPIO.HIGH)
GPIO.output(17,GPIO.HIGH)
time.sleep(1)
GPIO.output(18,GPIO.LOW)
GPIO.output(17,GPIO.LOW)

def blink():
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
                    print("Peer1Org1: "+line)
                    blink()
                    # Flip Amber light on when chain code is installed
                    if 'chaincode canonical name: mycc:1.0' in line:
                        GPIO.output(17,GPIO.HIGH)
            except UnicodeDecodeError:
                # Do nothing with it... you lose sir, good day.... I SAID GOOD DAY SIR!
                pass

except KeyboardInterrupt:
    pass
    print("Stopping")
    GPIO.output(18,GPIO.LOW)
    GPIO.output(17,GPIO.LOW)
    GPIO.output(27,GPIO.LOW)
