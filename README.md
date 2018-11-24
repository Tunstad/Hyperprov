# HLv1_RPiDS - Build Your First Network (BYFN)

For use with the Hyperledger Fabric v1.0 on a Raspberry Pi Docker Swarm series written by Joe Motacek.
http://www.joemotacek.com/hyperledger-fabric-v1-0-on-a-raspberry-pi-docker-swarm-part-4/

Please see the above article for his details on this repos use.

# My personal notes after working with this
## Quick start
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

### Starting the CA server
To run the CA server you need Go 1.9 installed, GOPATH set correctly and have `sudo apt install libtool libltdl-dev` installed.
Then run the command `go get -u github.com/hyperledger/fabric-ca/cmd/...` to install fabric-ca server to GOPATH/bin.
Then to start it move to `/fabric-ca` and run `docker-compose up -d`. This will start the CA server by default on port 7054 and allow it to respond to requests. The scripts responsible for interacting with the CA-server is `client/enrollAdmin.js` and `client/registerUser.js`, where the latter can have the variable username modified to represent the user you wish to register and retrieve certificates for. After the certificates have been retrieved the CA-server is not required to be up and can be shut down with `docker-compose down` in the `/fabric-ca` folder.