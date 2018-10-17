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

Set some required global variables required since we have TLS enabled: `CORE_PEER_TLS_ENABLED="true"`, `CHANNEL_NAME="mychannel"` and `ORDERER_CA=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem`

Now to get the value of a, run: `peer chaincode query -C $CHANNEL_NAME -n mycc -c '{"Args":["query","a"]}'`.
To transfer 20 credits from a to b, run: `peer chaincode invoke -o orderer.example.com:7050  --tls $CORE_PEER_TLS_ENABLED --cafile $ORDERER_CA -C $CHANNEL_NAME -n mycc -c '{"Args":["invoke","a","b","20"]}'`
You can now run `peer chaincode query -C $CHANNEL_NAME -n mycc -c '{"Args":["query","a"]}'` again to see that it changed. Keep in mind that this could take some seconds depending on the batch settings configuration of orderer set in `configtx.yaml` and the time it uses to complete a block. 

### Querying the datashare chaincode
To use the modified chaincode for data sharing you similarly need to run `docker ps` to find the CLI, and launch it with `docker exec -it 6e4c43c974e7 bash` where `6e4c43c974e7` is the Container ID. Then define variables `CHANNEL_NAME=mychannel`, `ORDERER_CA=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem` and `CORE_PEER_TLS_ENABLED="true"`.
To install the chaincode if not already performed by `docker-compose-cli.yaml` referencing `script_ds.sh`, you need to run `peer chaincode install -n myccds -v 1.0 -p github.com/hyperledger/fabric/examples/chaincode/go/chaincode_datashare >&log.txt`.  
To instantiate chaincode run something along the lines of `peer chaincode instantiate -o orderer.example.com:7050 --tls $CORE_PEER_TLS_ENABLED --cafile $ORDERER_CA -C $CHANNEL_NAME -n myccds -v 1.0 -c '{"Args":["c","asdf"]}' -P "OR('Org1MSP.member','Org2MSP.member')" >&log.txt`.  
To then query that the value c was stored as asdf run `peer chaincode query -C $CHANNEL_NAME -n myccds -c '{"Args":["get","c"]}' >&log.txt`.  
And to further change the value of c run `peer chaincode invoke -o orderer.example.com:7050 --tls $CORE_PEER_TLS_ENABLED --cafile $ORDERER_CA -C $CHANNEL_NAME -n myccds -c '{"Args":["set","c","wasda"]}'`.   