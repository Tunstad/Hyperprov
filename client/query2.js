'use strict';
/*
* Copyright IBM Corp All Rights Reserved
*
* SPDX-License-Identifier: Apache-2.0
*/
/*
 * Chaincode query
 */

var Fabric_Client = require('fabric-client');
var path = require('path');
var util = require('util');
var os = require('os');

var client = Fabric_Client.loadFromConfig('mynetwork.yaml');

client.initCredentialStores()
.then((nothing) => {


var channel = client.getChannel("mychannel")
.then((nothing) => {

const request = {
	//targets : --- letting this default to the peers assigned to the channel
	chaincodeId: 'mycc',
	fcn: 'query',
	args: ['a']
};

// send the query proposal to the peer
var resp = channel.queryByChaincode(request)
.then((nothing) =>{
	console.log(response)
}
)})})

//console.log(resp)

//let tx_id = client.newTransactionID(true);

//let request = {
 //   config: config,
//    signatures : signatures,
//    name : "channel_name",
//    orderer : 'orderer.ptunstad.no',
///    txId  : tx_id
//};

//return client.createChannel(request);
//}).then((result) => {