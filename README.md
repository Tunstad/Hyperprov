# Technical guidelines
The docker compose setup for Raspberry Pi is based on the [repository](https://github.com/Cleanshooter/hyperledger-pi-composer) and [guide](https://www.joemotacek.com/hyperledger-fabric-v1-0-on-a-raspberry-pi-docker-swarm-part-1/) by Joe Motacek. The chaincode, client and CA-server implementation is built on top of examples from the official hyperledger [fabric samples](https://github.com/hyperledger/fabric-samples). The guidelines assumes you have access to multiple devices, in our case we used four Raspberry Pi 3 B+.

## Quick install
### Operating System
The experiments were run on Raspberry Pi 3 using the Raspbian 3 Stretch OS which you can download from [here](https://www.raspberrypi.org/downloads/raspbian/).

### Installing Go
The version of Go used for this project was Go 1.7.5, installing it on RPI can be done by

```
wget https://dl.google.com/go/go1.7.5.linux-armv6l.tar.gz
sudo tar -C /usr/local -xzf go1.7.5.linux-armv6l.tar.gz
sudo echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.profile 
sudo echo 'export GOPATH=$HOME/go' >> ~/.profile
```
To verify run `go version ` and `echo $GOPATH` to verify its /home/pi/go.
### Install Docker and Docker Compose
```
curl -sSL https://get.docker.com | sh
curl -s https://packagecloud.io/install/repositories/Hypriot/Schatzkiste/script.deb.sh | sudo bash
```
#### If you get a problem with docker compose
Run next step first then run `sudo pip install --trusted-host pypi.org docker-compose`

### Other/python libraries
```
sudo apt-get install git python-pip python-dev docker-compose build-essential libtool libltdl-dev libssl-dev libevent-dev libffi-dev
sudo pip install --upgrade pip
sudo pip install --upgrade setuptools
sudo pip install behave nose docker-compose
sudo pip install -I flask==0.10.1 python-dateutil==2.2 pytz==2014.3 pyyaml==3.10 couchdb==1.0 flask-cors==2.0.1 requests==2.4.3 pyOpenSSL==16.2.0 pysha3==1.0b1 grpcio==1.0.4
```
After installing dependencies it may be neccesary to do a reboot for changes to take into effect.
### Install NodeJS
```
curl -sL https://deb.nodesource.com/setup_8.x | sudo -E bash -
sudo apt-get install -y nodejs
```
### Pull Pre-Built docker images
You can compile your own images, but to pull the pre-built HLF V1 images by Joe Motacek run:

```
docker pull jmotacek/fabric-baseos:armv7l-0.3.2 &&
docker pull jmotacek/fabric-basejvm:armv7l-0.3.2 &&
docker pull jmotacek/fabric-baseimage:armv7l-0.3.2 &&
docker pull jmotacek/fabric-ccenv:armv7l-1.0.7 &&
docker pull jmotacek/fabric-javaenv:armv7l-1.0.7 &&
docker pull jmotacek/fabric-peer:armv7l-1.0.7 &&
docker pull jmotacek/fabric-orderer:armv7l-1.0.7 &&
docker pull jmotacek/fabric-buildenv:armv7l-1.0.7 &&
docker pull jmotacek/fabric-testenv:armv7l-1.0.7 &&
docker pull jmotacek/fabric-zookeeper:armv7l-1.0.7 &&
docker pull jmotacek/fabric-kafka:armv7l-1.0.7 &&
docker pull jmotacek/fabric-couchdb:armv7l-1.0.7 &&
docker pull jmotacek/fabric-tools:armv7l-1.0.7
```
This will take a while to complete as the images are quite large.

## Quick start
### Setup Docker Swarm
The solution uses Docker Swarm for easy management and communication between nodes. To start a swarm run `docker swarm init` on one of your nodes. This will be the same node you use to start and shut down the network. This will return a command along the lines of `docker swarm join --token SWMTKN-1-xxxxxxxx 192.168.1.xxx:2377` which you need to call on all your other nodes to join the network. You can verify that all nodes have been joined by running `docker node ls` on the initial node. The initial node should also initialize an overlay network by running `docker network create -d overlay --attachable hyperledger-fabric`.
### Start network
With all prerequisites installed and docker images in place run:
`docker node ls` to see that all nodes in swarm is up and running.
`docker network create -d overlay --attachable hyperledger-fabric ` to create overlay network if not already present.

Check that hostnames and volume paths to git directory is correct in `docker-compose-cli.yaml`. Volume paths to git directory is currently set to `/home/pi/hlf_multihost/hyperledger-pi-composer/`.  

To run do `docker stack deploy --compose-file docker-compose-cli.yaml HLFv1_RPiDS && docker ps` on master to start up the nodes. 

Then to follow BYFN-print output, get the id of CLI-container from `docker ps` that uses fabric-tools and run `docker logs -f 6e4c43c974e7` where `6e4c43c974e7` is the Container ID. You can also follow on peer nodes with `tail ./hyperledger-pi-composer/logs/peer1org2log.txt -f` and so on.

If you encounter any problems run `docker stack ps HLFv1_RPiDS --no-trunc` on master to see useful error messages.  

Shutting down can be done with `docker stack rm HLFv1_RPiDS`.

## Querying from CLI after instantiation
### Default value transferring chaincode
Go to master node and write `docker ps` to show active containers. Find the CLI that uses the fabric-tools image and copy the Container ID. Then start the CLI by running `docker exec -it 6e4c43c974e7 bash` where `6e4c43c974e7` is the Container ID.  

In the CLI run the following commands to prepare for querying:
`export CHANNEL_NAME=mychannel` to export channel name
`peer chaincode install -n mycc -v 1.0 -p github.com/hyperledger/fabric/examples/chaincode/go/chaincode_example02 >&log.txt` to instantiate chaincode.

Set some required global variables required since we have TLS enabled: `CORE_PEER_TLS_ENABLED="true"`, `CHANNEL_NAME="mychannel"` and `ORDERER_CA=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/ptunstad.no/orderers/orderer.ptunstad.no/msp/tlscacerts/tlsca.ptunstad.no-cert.pem`

Now to get the value of a, run: `peer chaincode query -C $CHANNEL_NAME -n mycc -c '{"Args":["query","a"]}'`.
To transfer 20 credits from a to b, run: `peer chaincode invoke -o orderer.ptunstad.no:7050  --tls $CORE_PEER_TLS_ENABLED --cafile $ORDERER_CA -C $CHANNEL_NAME -n mycc -c '{"Args":["invoke","a","b","20"]}'`
You can now run `peer chaincode query -C $CHANNEL_NAME -n mycc -c '{"Args":["query","a"]}'` again to see that it changed. Keep in mind that this could take some seconds depending on the batch settings configuration of orderer set in `configtx.yaml` and the time it uses to complete a block. 

### Querying the datashare chaincode from Docker CLI
To use the modified chaincode for data sharing you similarly need to run `docker ps` to find the CLI, and launch it with `docker exec -it 6e4c43c974e7 bash` where `6e4c43c974e7` is the Container ID. Then define variables `CHANNEL_NAME=mychannel`, `ORDERER_CA=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/ptunstad.no/orderers/orderer.ptunstad.no/msp/tlscacerts/tlsca.ptunstad.no-cert.pem` and `CORE_PEER_TLS_ENABLED="true"`.
To install the chaincode if not already performed by `docker-compose-cli.yaml` referencing `script_ds.sh`, you need to run `peer chaincode install -n myccds -v 1.0 -p github.com/hyperledger/fabric/examples/chaincode/go/chaincode_datashare >&log.txt`.  
To instantiate chaincode run something along the lines of `peer chaincode instantiate -o orderer.ptunstad.no:7050 --tls $CORE_PEER_TLS_ENABLED --cafile $ORDERER_CA -C $CHANNEL_NAME -n myccds -v 1.0 -c '{"Args":["c","asdf"]}' -P "OR('Org1MSP.member','Org2MSP.member')" >&log.txt`.  
To then query that the value c was stored as asdf run `peer chaincode query -C $CHANNEL_NAME -n myccds -c '{"Args":["get","c"]}' >&log.txt`.  
And to further change the value of c run `peer chaincode invoke -o orderer.ptunstad.no:7050 --tls $CORE_PEER_TLS_ENABLED --cafile $ORDERER_CA -C $CHANNEL_NAME -n myccds -c '{"Args":["set","c","wasda"]}'`.   

### Using the CLI Client to interact with the chaincode.
To use the CLI Client to interact with the chaincode move to the folder `\client` and run `npm install`, this will install the required node dependencies. Then run the client with `node cli_client.js` and you will be prompted with the question of what function you want to invoke. The options available at this point is `get`, `set`, `getkeyhistory`, `getbyrange`, `sendfile` and `getfile`. Get takes in a single argument: `key`. Set takes two arguments: `key, value`. Getkeyhistory also takes in just a single argument: `key`, and returns the change history of the key with matching timestamps of the changes. Getbyrange takes in two arguments: `startkey, endkey` and returns all kv-pairs within that specified range, based on key values not strings. Sendfile takes in two arguments: `key, path/to/file.jpg`and stores the file in the blockchain. Currently there is a limit of 1,39MB from the grpc protocol in node. Getfile similarly takes two arguments: `key, path/to/file.jpg` and retrieves the file from the blockchain before storing it at the specified path.

#### Client with REST-api
To enable the client to use REST-api instead of command-line input change to `var RESTAPI = true` in `client/cli-client.js` and run the program.
The API will accept all requests on port 8080. Below is documentation for the current version of the API:


| URL            | HTTP METHOD | 'arguments'-header | POST BODY           | RESULT                                                                                                                         |
|----------------|-------------|--------------------|---------------------|--------------------------------------------------------------------------------------------------------------------------------|
| /set           | POST        | key, value         |                     | Successfully committed the change to the ledger by the peer or error message                                                   |
| /get           | GET         | key                |                     | value                                                                                                                          |
| /getkeyhistory | GET         | key                |                     | [timestamp: timestamp1 value: value2 certificate: certificate1, timestamp: timestamp2 value: value2 certificate: certificate2] |
| /getbyrange    | GET         | startkey, endkey   |                     | [key1: value1, key2: value2]                                                                                                   |
| /sendfile      | POST        | key                | BASE64-encoded file | Successfully committed the change to the ledger by the peer or error message                                                   |
| /getfile       | GET         | key                |                     | BASE64-encoded file string                                                                                                     |

#### Get certificates from CA server with client
The client comes with two scripts `enrollAdmin.js` and `registerUser.js` that have functionality for first retrieving an admin certificate from the CA server and then using it to generate user certificates for each device. For the current version of certificates, four user certificates for each node is already stored in `hfc-key-store`. The used certificate is specified in the client application by the line `var currentUser = 'Node3'`. 

## Certificates and Chaincode changes

### Updaing the Chaincode
Updates to the chaincode is not issued if it detects already running chaincode with the same version number. To delete current chaincode this need to be performed on all nodes: `docker stop $(docker ps -aq) && docker rm -f $(docker ps -aq) && docker images` then do `docker rmi xxxxxxxxxxx` replacing the x's with the image id of running chaincode images.

### Regenerating Certificates
If you need to make any changes to either `crypto-config.yaml` or `configtx.yaml` you may need to regenerate the certificates for your network. To do this first delete the folder `/crypto-config` and `/channel-artifacts`. Then run `export PATH=<replace this with your path>/bin:$PATH` with the full path to your bin folder.  
To generate network entities such as peers, organizations and genesisblock run the following 

```
bin/cryptogen generate --config=./crypto-config.yaml
export FABRIC_CFG_PATH=$PWD
bin/configtxgen -profile TwoOrgsOrdererGenesis -outputBlock ./channel-artifacts/genesis.block
```
Then to generate a channel for our peers to interact on run 

```
export CHANNEL_NAME=mychannel  && bin/configtxgen -profile TwoOrgsChannel -outputCreateChannelTx ./channel-artifacts/channel.tx -channelID $CHANNEL_NAME
bin/configtxgen -profile TwoOrgsChannel -outputAnchorPeersUpdate ./channel-artifacts/Org1MSPanchors.tx -channelID $CHANNEL_NAME -asOrg Org1MSP
```
### Starting the CA server
To run the CA server you need Go 1.9 installed, GOPATH set correctly and have `sudo apt install libtool libltdl-dev` installed.
Then run the command `go get -u github.com/hyperledger/fabric-ca/cmd/...` to install fabric-ca server to GOPATH/bin.
Then to start it move to `/fabric-ca` and run `docker-compose up -d`. This will start the CA server by default on port 7054 and allow it to respond to requests. The scripts responsible for interacting with the CA-server is `client/enrollAdmin.js` and `client/registerUser.js`, where the latter can have the variable username modified to represent the user you wish to register and retrieve certificates for. After the certificates have been retrieved the CA-server is not required to be up and can be shut down with `docker-compose down` in the `/fabric-ca` folder.

## Measurements
Measurements on throughput was performed with the benchmarking functionality added to the client application. To test, run client in CLI mode(`var RESTAPI  ̄ false`) and set `var totaltime_seconds  = 600` for 10 minute benchmarks. Then to run the benchmarkingsolution do `node cli_client.js` with function `bms` and parameters e.g `100000, 60` to run 60 transactions of 100KB over 10 minutes. The result time ttc is printed as `benchmarkset` and ttp for the first transaction can be seen as `proposalok`. Energy was measured simultaneously with a manual power meter, specifically an ODROID Power Meter V3.
CPU and Memory measurements were performed using the python tool psrecord. you can instal it using:

```
sudo pip install psrecord
sudo apt-get install python-matplotlib python-tk
```
For a single 1 minute measurement you can run:
`psrecord $(pgrep peer) --interval 1 --duration 60 --plot peer1m.png`
and for measuring both peer and client simultaneously for 10 minutes run the shell script:

```
#!/bin/bash
psrecord $(pgrep peer) --interval 1 --duration 600 --plot peer10m.png &
P1=$!
psrecord $(pgrep node) --interval 1 --duration 600 --plot node10m.png &
P2=$!
wait $P1 $P2
echo 'Done'
```