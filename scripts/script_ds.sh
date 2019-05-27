#!/bin/bash

echo
echo " ____    _____      _      ____    _____ "
echo "/ ___|  |_   _|    / \    |  _ \  |_   _|"
echo "\___ \    | |     / _ \   | |_) |   | |  "
echo " ___) |   | |    / ___ \  |  _ <    | |  "
echo "|____/    |_|   /_/   \_\ |_| \_\   |_|  "
echo
echo "Build your first network (BYFN) end-to-end test"
echo
CHANNEL_NAME="$1"
DELAY="$2"
LANGUAGE="$3"
TIMEOUT="$4"
VERBOSE="$5"
: ${CHANNEL_NAME:="mychannel"}
: ${DELAY:="3"}
: ${LANGUAGE:="golang"}
: ${TIMEOUT:="1500"}
: ${VERBOSE:="false"}
LANGUAGE=`echo "$LANGUAGE" | tr [:upper:] [:lower:]`
COUNTER=1
MAX_RETRY=5
ORDERER_CA=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/ptunstad.no/orderers/orderer.ptunstad.no/msp/tlscacerts/tlsca.ptunstad.no-cert.pem
PEER0_ORG1_CA=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org1.ptunstad.no/peers/peer0.org1.ptunstad.no/tls/ca.crt

CC_SRC_PATH="github.com/hyperledger/fabric/core/chaincode//chaincode_hyperprov"
#if [ "$LANGUAGE" = "node" ]; then
#	CC_SRC_PATH="/opt/gopath/src/github.com/chaincode/chaincode_example02/node/"
#fi

#if [ "$LANGUAGE" = "java" ]; then
#	CC_SRC_PATH="/opt/gopath/src/github.com/chaincode/chaincode_example02/java/"
#fi

echo "Channel name : "$CHANNEL_NAME

#Custom config vars
#Prevents "Minimum memory limit allowed is 4MB" error on low RAM devices (like RasPi)
CORE_VM_DOCKER_HOSTCONFIG_MEMORY=536870912
# Sets the default images to use my build for the ARM architecture
CORE_CHAINCODE_BUILDER=ptunstad/fabric-ccenv:arm64-1.4.1 
CORE_CHAINCODE_GOLANG=ptunstad/fabric-baseos:arm64-0.4.15 
CORE_CHAINCODE_CAR=ptunstad/fabric-baseos:arm64-0.4.15 
#CORE_CHAINCODE_JAVA=apelser/fabric-javaenv:arm64-1.4.1

echo "Channel name : "$CHANNEL_NAME

# import utils
. scripts/utils.sh

# verify the result of the end-to-end test
# verifyResult () {
# 	if [ $1 -ne 0 ] ; then
# 		echo "!!!!!!!!!!!!!!! "$2" !!!!!!!!!!!!!!!!"
#     echo "========= ERROR !!! FAILED to execute End-2-End Scenario ==========="
# 		echo
#    		exit 1
# 	fi
# }

# setGlobals () {
# 	CORE_PEER_LOCALMSPID="Org1MSP"
# 	CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org1.ptunstad.no/peers/peer0.org1.ptunstad.no/tls/ca.crt
# 	CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org1.ptunstad.no/users/Admin@org1.ptunstad.no/msp
# 	if [ $1 -eq 0 -o $1 -eq 1 ] ; then
		
# 		if [ $1 -eq 0 ]; then
# 			CORE_PEER_TLS_CERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org1.ptunstad.no/peers/peer0.org1.ptunstad.no/tls/server.crt
#     		CORE_PEER_TLS_KEY_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org1.ptunstad.no/peers/peer0.org1.ptunstad.no/tls/server.key
# 			CORE_PEER_ADDRESS=peer0.org1.ptunstad.no:7051
# 		else
# 			CORE_PEER_TLS_CERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org1.ptunstad.no/peers/peer1.org1.ptunstad.no/tls/server.crt
#     		CORE_PEER_TLS_KEY_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org1.ptunstad.no/peers/peer1.org1.ptunstad.no/tls/server.key
# 			CORE_PEER_ADDRESS=peer1.org1.ptunstad.no:7051
# 		fi
# 	else
# 		if [ $1 -eq 2 ]; then
# 		    CORE_PEER_TLS_CERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org1.ptunstad.no/peers/peer2.org1.ptunstad.no/tls/server.crt
#     		CORE_PEER_TLS_KEY_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org1.ptunstad.no/peers/peer2.org1.ptunstad.no/tls/server.key
# 			CORE_PEER_ADDRESS=peer2.org1.ptunstad.no:7051
# 		else
# 		    CORE_PEER_TLS_CERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org1.ptunstad.no/peers/peer3.org1.ptunstad.no/tls/server.crt
#     		CORE_PEER_TLS_KEY_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org1.ptunstad.no/peers/peer3.org1.ptunstad.no/tls/server.key
# 			CORE_PEER_ADDRESS=peer3.org1.ptunstad.no:7051
# 		fi
# 	fi

# 	env |grep CORE
# }

createChannel() {
# 	setGlobals 0

#   if [ -z "$CORE_PEER_TLS_ENABLED" -o "$CORE_PEER_TLS_ENABLED" = "false" ]; then
# 		peer channel create -t 10 -o orderer.ptunstad.no:7050 -c $CHANNEL_NAME -f ./channel-artifacts/channel.tx >&log.txt
# 	else
# 		peer channel create -t 10 -o orderer.ptunstad.no:7050 -c $CHANNEL_NAME -f ./channel-artifacts/channel.tx --tls $CORE_PEER_TLS_ENABLED --cafile $ORDERER_CA >&log.txt
# 	fi
# 	res=$?
	setGlobals 0 1

	if [ -z "$CORE_PEER_TLS_ENABLED" -o "$CORE_PEER_TLS_ENABLED" = "false" ]; then
                set -x
		peer channel create -o orderer.ptunstad.no:7050 -c $CHANNEL_NAME -f ./channel-artifacts/channel.tx >&log.txt
		res=$?
                set +x
	else
				set -x
		peer channel create -o orderer.ptunstad.no:7050 -c $CHANNEL_NAME -f ./channel-artifacts/channel.tx --tls $CORE_PEER_TLS_ENABLED --cafile $ORDERER_CA >&log.txt
		res=$?
				set +x
	fi

	cat log.txt
	verifyResult $res "Channel creation failed"
	echo "===================== Channel \"$CHANNEL_NAME\" is created successfully ===================== "
	echo
}

# updateAnchorPeers() {
#   PEER=$1
#   setGlobals $PEER

#   if [ -z "$CORE_PEER_TLS_ENABLED" -o "$CORE_PEER_TLS_ENABLED" = "false" ]; then
# 		peer channel update -o orderer.ptunstad.no:7050 -c $CHANNEL_NAME -f ./channel-artifacts/${CORE_PEER_LOCALMSPID}anchors.tx >&log.txt
# 	else
# 		peer channel update -o orderer.ptunstad.no:7050 -c $CHANNEL_NAME -f ./channel-artifacts/${CORE_PEER_LOCALMSPID}anchors.tx --tls $CORE_PEER_TLS_ENABLED --cafile $ORDERER_CA >&log.txt
# 	fi
# 	res=$?
# 	cat log.txt
# 	verifyResult $res "Anchor peer update failed"
# 	echo "===================== Anchor peers for org \"$CORE_PEER_LOCALMSPID\" on \"$CHANNEL_NAME\" is updated successfully ===================== "
# 	echo
# }

# ## Sometimes Join takes time hence RETRY atleast for 5 times
# joinWithRetry () {
# 	peer channel join -b $CHANNEL_NAME.block  >&log.txt
# 	res=$?
# 	cat log.txt
# 	if [ $res -ne 0 -a $COUNTER -lt $MAX_RETRY ]; then
# 		COUNTER=` expr $COUNTER + 1`
# 		echo "PEER$1 failed to join the channel, Retry after 2 seconds"
# 		sleep 10
# 		joinWithRetry $1
# 	else
# 		COUNTER=1
# 	fi
#   verifyResult $res "After $MAX_RETRY attempts, PEER$ch has failed to Join the Channel"
# }

joinChannel () {
	# for ch in 0 1 2 3; do
	# 	setGlobals $ch
	# 	joinWithRetry $ch
	# 	echo "===================== PEER$ch joined on the channel \"$CHANNEL_NAME\" ===================== "
	# 	sleep 10
	# 	echo
	# done
	for org in 1; do
	    for peer in 0 1 2 3; do
		joinChannelWithRetry $peer $org
		echo "===================== peer${peer}.org${org} joined on the channel \"$CHANNEL_NAME\" ===================== "
		sleep $DELAY
		echo
	    done
	done
}

# installChaincode () {
# 	PEER=$1
# 	setGlobals $PEER
# 	peer chaincode install -n myccds -v 1.2 -p github.com/hyperledger/fabric/core/chaincode//chaincode_hyperprov >&log.txt
# 	res=$?
# 	cat log.txt
#         verifyResult $res "Chaincode2 installation on remote peer PEER$PEER has Failed"
# 	echo "===================== Chaincode2 is installed on remote peer PEER$PEER ===================== "
# 	echo
# }

# instantiateChaincode () {
# 	PEER=$1
# 	setGlobals $PEER
# 	# while 'peer chaincode' command can get the orderer endpoint from the peer (if join was successful),
# 	# lets supply it directly as we know it using the "-o" option
# 	if [ -z "$CORE_PEER_TLS_ENABLED" -o "$CORE_PEER_TLS_ENABLED" = "false" ]; then
# 		peer chaincode instantiate -o orderer.ptunstad.no:7050 -C $CHANNEL_NAME -n myccds -v 1.2 -c '{"Args":["c","51"]}' -P "OR('Org1MSP.member','Org1MSP.member')" >&log.txt
# 	else
# 		peer chaincode instantiate -o orderer.ptunstad.no:7050 --tls $CORE_PEER_TLS_ENABLED --cafile $ORDERER_CA -C $CHANNEL_NAME -n myccds -v 1.2 -c '{"Args":["c","51"]}' -P "OR('Org1MSP.member','Org1MSP.member')" >&log.txt
# 	fi
# 	res=$?
# 	cat log.txt
# 	verifyResult $res "Chaincode2 instantiation on PEER$PEER on channel '$CHANNEL_NAME' failed"
# 	echo "===================== Chaincode2 Instantiation on PEER$PEER on channel '$CHANNEL_NAME' is successful ===================== "
# 	echo
# }

# chaincodeQuery () {
#   PEER=$1
#   echo "===================== Querying2 on PEER$PEER on channel '$CHANNEL_NAME'... ===================== "
#   setGlobals $PEER
#   local rc=1
#   local starttime=$(date +%s)

#   # continue to poll
#   # we either get a successful response, or reach TIMEOUT
#   while test "$(($(date +%s)-starttime))" -lt "$TIMEOUT" -a $rc -ne 0
#   do
#      sleep 3
#      echo "Attempting to Query2 PEER$PEER ...$(($(date +%s)-starttime)) secs"
#      peer chaincode query -C $CHANNEL_NAME -n myccds -c '{"Args":["get","c"]}' >&log.txt
#      test $? -eq 0 && VALUE=$(cat log.txt | awk '/Query Result/ {print $NF}')
#      test "$VALUE" = "$2" && let rc=0
#   done
#   echo
#   cat log.txt
#   if test $rc -eq 0 ; then
# 	echo "===================== Query2 on PEER$PEER on channel '$CHANNEL_NAME' is successful ===================== "
#   else
# 	echo "!!!!!!!!!!!!!!! Query2 result on PEER$PEER is INVALID !!!!!!!!!!!!!!!!"
#         echo "================== ERROR !!! FAILED to execute End-2-End Scenario =================="
# 	echo
# 	exit 1
#   fi
# }

chaincodeInvoke () {
	PEER=$1
	setGlobals $PEER
	# while 'peer chaincode' command can get the orderer endpoint from the peer (if join was successful),
	# lets supply it directly as we know it using the "-o" option
	if [ -z "$CORE_PEER_TLS_ENABLED" -o "$CORE_PEER_TLS_ENABLED" = "false" ]; then
		peer chaincode invoke -o orderer.ptunstad.no:7050 -C $CHANNEL_NAME -n myccds -c '{"Args":["set","c","77", "file://mnt/hlfshared", "cfile"]}' >&log.txt
	else
		peer chaincode invoke -o orderer.ptunstad.no:7050 --tls $CORE_PEER_TLS_ENABLED --cafile $ORDERER_CA -C $CHANNEL_NAME -n myccds -c '{"Args":["set","c","77"]}'
	fi
	res=$?
	cat log.txt
	verifyResult $res "Invoke2 execution on PEER$PEER failed "
	echo "===================== Invoke2 transaction on PEER$PEER on channel '$CHANNEL_NAME' is successful ===================== "
	echo
}

## Create channel
echo "Creating channel..."
createChannel

## Join all the peers to the channel
echo "Having all peers join the channel..."
joinChannel

## Set the anchor peers for each org in the channel
echo "Updating anchor peers for org1..."
sleep 10
updateAnchorPeers 0 1

## Install chaincode on Peer0/Org1 and Peer2/org1
echo "Installing chaincode on org1/peer0..."
sleep 10
installChaincode 0 1 1.2
echo "Install chaincode on org1/peer2..."
sleep 10
installChaincode 2 1 1.2
echo "Install chaincode on org1/peer1..."
sleep 10
installChaincode 1 1 1.2

#Instantiate chaincode on Peer2/org1
echo "Instantiating chaincode on org1/peer2..."
sleep 10
instantiateChaincode 2 1 1.2

#Query on chaincode on Peer0/Org1
echo "Querying chaincode on org1/peer0..."
sleep 10
chaincodeQuery 0 1 51

#Invoke on chaincode on Peer0/Org1
echo "Sending invoke transaction on org1/peer0..."
sleep 10
chaincodeInvoke 0 1

## Install chaincode on Peer3/org1
echo "Installing chaincode on org1/peer3..."
sleep 10
installChaincode 3 1 1.2

#Query on chaincode on Peer3/org1, check if the result is 90
echo "Querying chaincode on org1/peer3..."
sleep 10
chaincodeQuery 3 1 77

echo
echo "========= All GOOD, BYFN execution completed =========== "
echo

echo
echo " _____   _   _   ____   "
echo "| ____| | \ | | |  _ \  "
echo "|  _|   |  \| | | | | | "
echo "| |___  | |\  | | |_| | "
echo "|_____| |_| \_| |____/  "
echo

exit 0