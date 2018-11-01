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
var Fabric_CA_Client = require('fabric-ca-client');
var path = require('path');
var util = require('util');
var os = require('os');
var fs = require("fs")
//
var fabric_client = new Fabric_Client();
var fabric_ca_client = null;
var admin_user = null;
var member_user = null;
var store_path = path.join(__dirname, 'hfc-key-store');
console.log(' Store path:'+store_path);

// setup the fabric network
var channel = fabric_client.newChannel('mychannel');

var peer = fabric_client.newPeer('grpc://node3.ptunstad.no:7051');
channel.addPeer(peer);
// create the key value store as defined in the fabric-client/config/default.json 'key-value-store' setting
Fabric_Client.newDefaultKeyValueStore({ path: store_path
}).then((state_store) => {
    // assign the store to the fabric client
    fabric_client.setStateStore(state_store);
    var crypto_suite = Fabric_Client.newCryptoSuite();
    // use the same location for the state store (where the users' certificate are kept)
    // and the crypto store (where the users' keys are kept)
    var crypto_store = Fabric_Client.newCryptoKeyStore({path: store_path});
    crypto_suite.setCryptoKeyStore(crypto_store);
    fabric_client.setCryptoSuite(crypto_suite);
    var	tlsOptions = {
    	trustedRoots: [],
    	verify: false
    };
    // be sure to change the http to https when the CA is running TLS enabled
    fabric_ca_client = new Fabric_CA_Client('http://agc.ptunstad.no:7054', null , '', crypto_suite);

    // first check to see if the admin is already enrolled
    return fabric_client.getUserContext('admin', true);
}).then((user_from_store) => {
    if (user_from_store && user_from_store.isEnrolled()) {
        console.log('Successfully loaded admin from persistence');
        admin_user = user_from_store;
    } else {
        throw new Error('Failed to get admin.... run enrollAdmin.js');
    }


	const request = {
		//targets : --- letting this default to the peers assigned to the channel
		chaincodeId: 'mycc',
		fcn: 'query',
		args: ['a']
	};

	// send the query proposal to the peer
	return channel.queryByChaincode(request)})
.then((query_responses) => {
console.log("Query has completed, checking results");
// query_responses could have more than one  results if there multiple peers were used as targets
if (query_responses && query_responses.length == 1) {
	if (query_responses[0] instanceof Error) {
		console.error("error from query = ", query_responses[0]);
	} else {
		console.log("Response is ", query_responses[0].toString());
	}
} else {
	console.log("No payloads were returned from query");
}
}).catch((err) => {
console.error('Failed to query successfully :: ' + err);
});