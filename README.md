# Hyperprov - Blockchain based data provenance using Hyperledger Fabric
Hyperprov is a general purpose provenance framework for data provenance based on the permissioned blockchain Hyperledger Fabric. The system have been run for experiments and evaluation on both commodity desktop hardware and Raspberry Pi devices.

A thesis related to this project can be found [here](https://munin.uit.no/handle/10037/15780).

## Getting started
Before getting started make sure you have the required depdencies. We recommend Go version 1.11.1, Docker 18.09.1, Docker-compose 1.22.0, and NodeJS v8.15.0. For installation help see the install section below. 
### Set up Docker Compose
To start off we need to configure the docker-compose file `docker-compose-cli.yaml` to orchestrate the devices and paths. The most important are to change paths to this directory, as all devices need to have the `Hyperprov` directory cloned and available. By default it is `/data/Hyperprov` but if you have it elsewere, simply do a find and replace for the path in `docker-compose-cli.yaml`. 

The devices used need to be specified in the docker-compose file to match the containers running on them. There are six containers for this here four node setup, whereas your head-node should run both peer, orderer and fabric-tools. To specify device hostnames change the six `node.hostname == ` entries to match your device(s). 

Lastly the docker image pointers of each service must be set to match the devices architecture eg. `ptunstad/fabric-ccenv:arm64-1.4.1` or `hyperledger/fabric-ccenv:amd64-1.4.0`.

#### Docker Swarm
The solution uses Docker Swarm to manage multiple nodes from a single device for easy management. To start a swarm run `docker swarm init` on your "main" node. This will be the same node you use to start and shut down the network. This will return a command along the lines of `docker swarm join --token SWMTKN-1-xxxxxxxx 192.168.1.xxx:2377` which you need to call on all your other nodes to join the network. You can verify that all nodes have been joined by running `docker node ls` on the initial node. The initial node should also initialize an overlay network by running `docker network create -d overlay --attachable hyperledger-fabric`.

### Start the network
Before you actually run a network you should regenerate your certificates and genesis block, but for a quick up and running test you can use the block and certificates provided in this repository. See the section below on how to regenerate this.

Assuming all prerequisites are installed and docker images are downloaded, run:
`docker node ls` to check that all nodes in swarm is up and running.  

To start the network run the command `docker stack deploy --compose-file docker-compose-cli.yaml Hyperprov && docker ps` on your "main" swarm node. 

This will start all containers and run a setup script `script_ds.sh` and `utils.sh` to create channel, join peers, install chaincode and do some tests on query and invoke.To follow the output of this script, get the id of CLI-container from `docker ps` that uses fabric-tools and run `docker logs -f 6e4c43c974e7` where `6e4c43c974e7` is the id of CLI-container.

If you encounter any problems run `docker stack ps Hyperprov --no-trunc` on main swarm node to see useful error messages.  

Shutting down can be done with `docker stack rm Hyperprov ` on main swarm node, this will shut down all nodes in the network and cause it to lose its state.

### The Hyperprov Client Library
The Hyperprov client library is used to interact with the Hyperledger Fabric instances running your provenance ledger. It is published to npm and can be downloaded with `npm i hyperprov-client`. The library is also locally configured in this respository `client/hyperprov-client` to easily experiment with modifications. The client library should be used to build an application that needs to interact with the ledger/chaincode. The table below show the functionality currently present in the client library, whereas for simply interacting with the chaincode you could get by with only ccInit, ccPost and ccGet.

| Function      | Required Input                                                | Expected output       |
|---------------|---------------------------------------------------------------|-----------------------|
| registerAdmin | Keystore, CA-url, CA-name, Adminuname, Adminpw, MSPID         | eCert in Keystore     |
| registerUser  | Keystore, Username, Affiliation, Role, CA-url, CA-name, MSPID | eCert in Keystore     |
| ccInit        | Certificate, Channel+ChaincodeID, Peer+Orderer URL            | Success               |
| ccPost        | Key, Checksum, Path, Dependency List, Custom Provenance Data  | txID                  |
| ccGet         | Getfunction, Key/txID/Startkey-Endkey                         | Query Result          |
| storeFile     | File, Key, Dependency List, Custom Provenance Data            |                       |
| retrieveFile  | Key, File-path                                                |                       |
| InitFileStore | FileStorePath                                                 | Success               |
| StoreData     | File, Key, Dependency List, Custom Provenance Data            | txID                  |
| StoreDataFS   | File, Key, Dependency List, Custom Provenance Data            | Input for StoreDataHL |
| StoreDataHL   | Key, Checksum, Path, Dependency List, Custom Provenance Data  | txID                  |
| GetDataFS     | Key                                                           | File, txID            |


## Chaincode and Certificates
### Hyperprov Chaincode
 The chaincode supports multiple operations related to data provenance. The operations are: storing provenance data of an item, retrieving the last provenance information on an item, requesting the checksum of an item, getting an item with its corresponding transaction ID, getting a specific version of an item from transaction ID, recursively getting all items listed as lineage of a certain item, getting the history of a single item and retrieving a list of items with a key-range query.
The current chaincode can be found in `/chaincode/chaincode_hyperprov/chaincode_hyperprov.go`.
For the chaincode to implement the desired data provenance functionality it has the following type of data on a stored data item:

| Field        | Description                                        |
|--------------|----------------------------------------------------|
| txID         | Unique transaction id for each operation           |
| Hash         | Checksum of the stored data                        |
| Location     | First part of data path                            |
| Pointer      | Second part of data path                           |
| Certificate  | CA issued unique ID linked to certificate (CID-CC) |
| Type         | Type of operation                                  |
| Description  | Additional metadata, eg. on the process            |
| Dependencies | All txID that form the lineage of this item        |

The operations used to implement proveneance for storage and retrieval of data items is the following:

| CC operation    | Input            | Expected output                                     |
|-----------------|------------------|-----------------------------------------------------|
| set             | item data        | txID                                                |
| get             | key              | JSON with item data of current version of key       |
| checkhash       | key              | Only checksum of current version of key             |
| getfromid       | txID             | JSON with specific item data for txID               |
| getdependencies | txID, depth      | JSON of txID lineage of item, specified by depth    |
| getkeyhistory   | key              | JSON with item data for all updates on key          |
| getbyrange      | start, end       | JSON with item data for all keys in range start-end |


### Issue chaincode changes
Updates to the chaincode is not issued if it detects already running chaincode with the same version number. To change the version number you need to specify it when it is instantiated in `utils.sh`. Instead you can delete and overwrite the current chaincode. To delete current chaincode this need to be performed on all nodes after a shutdown: `docker stop $(docker ps -aq) && docker rm -f $(docker ps -aq)` Then do `docker images` to find the chaincode container ID, usually the image is named something like `dev-peer0.org1.ptunstad.no-myccds-1.2-97ed6ab7c0e9eda2b3d967ab471b3691e7eb90fd2b84c0fc33f5c2588b170e4f`. Then do `docker rmi xxxxxxxxxxx` replacing the x's with the container ID of running chaincode images to delete them. Now you can start the network with your updated chaincode, just make sure to have it updated on all nodes.

### Genesis block and certificates regeneration
Before running a new network you should always regenerate the genesis block and following certificates. Aslo if you need to make any changes to either `crypto-config.yaml` or `configtx.yaml` you may need to regenerate the certificates for your network anyway. To do this first delete the folder `/crypto-config` and `/channel-artifacts`. Then run `export PATH=<replace this with your path>/bin:$PATH` with the full path to your bin folder.  
To generate network entities such as peers, organizations and genesisblock run the following: 

```
bin/cryptogen generate --config=./crypto-config.yaml
export FABRIC_CFG_PATH=$PWD
bin/configtxgen -profile TwoOrgsOrdererGenesis -outputBlock ./channel-artifacts/genesis.block
```
Then to generate a channel for our peers to interact on run: 

```
export CHANNEL_NAME=mychannel  && bin/configtxgen -profile TwoOrgsChannel -outputCreateChannelTx ./channel-artifacts/channel.tx -channelID $CHANNEL_NAME
bin/configtxgen -profile TwoOrgsChannel -outputAnchorPeersUpdate ./channel-artifacts/Org1MSPanchors.tx -channelID $CHANNEL_NAME -asOrg Org1MSP
```
This should have generated new crypto material and your new network should be able to deploy. The previous eCerts will no longer work for accessing the network so you will also have to generate new 
### eCerts and the CA server
To access the network you need eCerts issued by a certificate authority. For this we use Hyperledger Farbrics own fabric CA image which can be retrieved with `docker pull hyperledger/fabric-ca`.

The CA server requires to have Golang installed and to have `sudo apt install libtool libltdl-dev` installed.
Then to start it move to `/fabric-ca` and run `docker-compose up -d`. This will start the CA server by default on port 7054 and allow it to respond to requests. You create certificates by first generating an admin certificate using the Hyperprov-client function registerAdmin with the username and password set in the `fabric-ca/docker-compose.yml` file. Once this admin certificate is generated, you can use it to register multiple certificates using the registerUser functionality of the Hyperprov-client. After all certificates are generates the CA server docker container can be shut down again with `docker-compose down`. If any data need to be read, like who owns or registered a certificate, you can access the fabric-ca database in `fabric-ca/fabric-ca-server/fabric-ca-server.db` with sqlite. 

##Example applications
To show how the system is used and to evaluate its usability we have created a series of applications built on top of the Hyperprov client library.
### Benchmark
The benchmark application found in `client\benchmark.js` is used to benchmark the peformance of the system. This supports three differnet types of benchmarks. These are: 
* Single benchmark - Runs a single round on benchmark of a specified number of transactions and data size.
* Multi benchmark - Runs a collection of single benchmarks for varying load/data size, calulating average response time, total time and transactions/min from multiple samples.
* Load test - runs a specific level of load over a set time. This means that over 10 minutes we can send 3000 transactions of size 4KB and this benchmark will manage the amount of sleep neccecary between each transaction for an even load.
### IoT
The IoT application in `client/iot.js` shows how the system can be used to send a collection of small data and track lineage. It parses the dataset [GSOD dataset](https://data.noaa.gov/dataset/dataset/global-surface-summary-of-the-day-gsod) downloaded using [NOAA-GSOD-GET](https://github.com/BStudent/NOAA-GSOD-GET). This dataset is then parsed into records for a few select station, and stored onto the ledger in batches of 30 records. Every 90 records a data item and the previous "analysed" record is concatinated to mimic analysing data, where the goal is to store the concatinated items as a dependency recorded for the newly created item. This allows us to use the `getdependencies` chaincode functionality to get the full lineage of all "analysed" records.

### ML
The machine learning model management example in `client/ml.js` uses models from the [IdenProf dataset](https://github.com/OlafenwaMoses/IdenProf) and models generated by [ImageAI](https://github.com/OlafenwaMoses/ImageAI) and stores its provenance. The simple code used to train and recognize based on models can also be found in the `client/ML` folder. Our example application tracks models, testdata and training data. We track the full model files and store in off chain storage, while for testdata and training data we only store file lists. This is done by checking what files are present in specified folders and comparing against records stored in the ledger for differences. If differences are found, the records are updated. When we store models, we list the training dataset and testdata set-lists as dependencies so the metadata includes what test and training data was used to produce the model. We can queue the full history of a single model using `getkeyhistory` or the datasets used to produce it with `getdependencies` chaincode.

### REST
The REST-client in `client/API.js` is a simple rest-api client built on the express web framework to allow external access to interact with the blockchain trough http-requests. The application supports direct access to chaincode functionality such as `/set`, `/get` , `/getfromid`, `/getkeyhistory`,`/getdependencies`, `/getbyrange`, `/sendfile` and `/getfile`. The client can also be only listen to localhost for only internal access from other appliactions on the same device.

### Datastore
The application in `client/DataStore.js` is the most baseline appliaction, showing the minimal required code for storing a file in off chain storage and on the ledger, then retrieving it again.

### Latency
The latency application in `client/latency.js` is a simple example of sending 100 transactions with five seconds of sleep used to measure latency of transactions. The application measures individual times of all 100 transactions and then exports it as .csv format.

## Measurements
For measurements on how the system performs we often couple the load test benchmark mode with resource monitoring tools, some of which are listed below.

### CPU/Memory
To measure CPU and memory consumption we used the [psrecord](https://github.com/astrofrog/psrecord) utility built on psutil. Make sure the measuring node has python, psutil and matplotlib installed. To measure we start off with installing dependencies. These are installed by running `./client/cpu_mem_setup.sh` and possibly also `export DISPLAY=:8` again to fully set up Xvfb which is needed for plotting on headless devices. Then to run measurements edit `client/cpu_mem.sh` with your desired process names, interval, duration and output figures. You can add and remove to record only one or maybe four processes simoultaneously.

### Network
To capture network usage we used `iftop` and the monitoring tool [speedometer 2.8](http://excess.org/speedometer/). To measure with speedometer you can run `speedometer -r eno1 -t eno1` to capture all recieved and transferred network traffic on the network interface `eno1`.

### NodeJS Profiler
To profile the client you can use the built in node profiler by appending the `--prof` flag when running an application. This will output a file named something like `isolate-xxxxxxxx-v8.log`. Then run `node --prof-process isolate-xxxxxxxx-v8.log` to process and output results about the profiling. Here you can explore the number of ticks and percentages occupied the runtime of the profiled process.


## Dependencies
### Operating System
The experiments were run on Raspberry Pi 3 b+ using the Raspbian 3 Debian Buster 64-bit OS which you can download from [here](https://wiki.debian.org/RaspberryPi3). 64-bit OS will only run on Raspberry Pi 3 and is currently required as HLF only supports 64 bit.
This guide targets Raspberry Pi because they are most difficult to set up, but most of this applies to Ubuntu 16.04 by replacing `arm64` with `amd64` and pulling docker images directly from the `hyperledger/` repo. 

Start by making sure your system is up to date and have some important dependencies used in the following steps: `apt-get update && apt-get install curl wget sudo`.
### Docker and Docker Compose
Start off by installing Docker and Docker compose. We have tested only with Docker 18.09.1 and Docker compose 1.22.0, so if problems arise revert to these versions.
```
curl -sSL https://get.docker.com | sh
curl -s https://packagecloud.io/install/repositories/Hypriot/Schatzkiste/script.deb.sh | bash
apt-get install docker-compose
```
To check if you installed them correctly run `docker --version && docker-compose --version` if it does not work, a reboot will usually solve this problem.

### Docker images
Because no HLF docker images are officially available from Hyperledger Fabric, i have compiled my own images for [HLF v1.4 on ARM64](https://hub.docker.com/r/ptunstad/). 
If you want to compile your own images see [compiling.md](https://github.com/Tunstad/Hyperprov/blob/master/compiling.md)

```
docker pull ptunstad/fabric-baseos:arm64-0.4.15 &&
docker pull ptunstad/fabric-basejvm:arm64-0.4.15 &&
docker pull ptunstad/fabric-baseimage:arm64-0.4.15 &&
docker pull ptunstad/fabric-ccenv:arm64-1.4.1 &&
docker pull ptunstad/fabric-peer:arm64-1.4.1 &&
docker pull ptunstad/fabric-orderer:arm64-1.4.1 &&
docker pull ptunstad/fabric-zookeeper:arm64-1.4.1 &&
docker pull ptunstad/fabric-kafka:arm64-1.4.1 &&
docker pull ptunstad/fabric-couchdb:arm64-1.4.1 &&
docker pull ptunstad/fabric-tools:arm64-1.4.1 &&
docker pull apelser/fabric-javaenv:arm64-1.4.1
```

### Golang
The version of Golang used for Hyperledger Fabric v1.4.1 is Go 1.11.1, installing it on RPI can be done by:

```
wget https://dl.google.com/go/go1.11.1.linux-arm64.tar.gz
tar -C /usr/local -xzf go1.11.1.linux-arm64.tar.gz
echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.profile 
echo 'export GOPATH=$HOME/go' >> ~/.profile
```
To verify run `go version ` and `echo $GOPATH` to verify its /home/pi/go.
### Node
To run the applications you need NodeJS and npm installed. We encountered some errors with newer versions of node and therefore encourage you to downgrade to version 8 to avoid problems for now.

```
curl -sL https://deb.nodesource.com/setup_8.x | -E bash -
sudo apt-get install -y nodejs
```
### Other
If you get a problem installing the dependencies above, some of these dependencies can maybe be of help:

```
apt-get install git python-pip python-dev docker-compose build-essential libtool libltdl-dev libssl-dev libevent-dev libffi-dev
pip install --upgrade pip
pip install --upgrade setuptools
pip install behave nose docker-compose
pip install -I flask==0.10.1 python-dateutil==2.2 pytz==2014.3 pyyaml==3.10 couchdb==1.0 flask-cors==2.0.1 requests==2.4.3 pyOpenSSL==16.2.0 pysha3==1.0b1 grpcio==1.0.4
pip install --trusted-host pypi.org docker-compose
```

### Clone repository to /data folder
The docker compose file currenty relies on the code being placed in /data/Hyperprov. To clone this repository there do the following:

```
sudo mkdir /data && sudo chmod -R ugo+rw /data
git clone -b "master" https://github.com/Tunstad/Hyperprov.git
```
Otherwise you can edit the path in `docker-compose-cli.yaml`.

### Swap Partition
The Raspberry Pi devices may run out of memory during execution or start up, which will cause a crash. You especially need to do this if you want to build your own docker images. To avoid running out of memory i suggest setting up a swap partition if not already present. You can check for existing swap either with `top` or `swapon --show`. 
1GB of swap should be more than enough, to create perform the following actions:

```
sudo fallocate -l 1G /swapfile
sudo dd if=/dev/zero of=/swapfile bs=1024 count=1048576
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
sudo echo '/swapfile swap swap defaults 0 0' >> /etc/fstab
```
