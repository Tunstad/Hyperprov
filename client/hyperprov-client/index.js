'use strict';


/*
* Based on code with 
* Copyright IBM Corp All Rights Reserved
* SPDX-License-Identifier: Apache-2.0
*/


var Fabric_Client = require('fabric-client');
//var Fabric_CA_Client = require('fabric-ca-client');
var path = require('path');
var util = require('util');
//var os = require('os');
var fs = require("fs")
var crypto = require("crypto");
//var joiner = require('./lib/join-channel.js');


var helper = require('./lib/helper.js');
var logger = helper.getLogger('Join-Channel');
//The time a benchmark is set to run
var totaltime_seconds = 1;        //3600 = 1h, 600 = 10m

//var bm_datalength = 1000000; // MAX == 1398101 characters/bytes



//The global variables for number of benchmarks to be run, and the 
//current number of benchmarks that have been run. Numbenchmarks is 
//set by the inquirer-prompt.
var numbenchmarks = 0;
var currentbenchmarks = 0;

//The user to interact with blockchain as, theese are found in hfc-key-store and generated 
//by having enrollAdmin.js and registerUser.js interact with a fabric CA server
var member_user = null
var tx_id = null;
var fabric_client = new Fabric_Client();
var currentUser, store_path, channelname, chaincodeId, channel, peer, orderer, file_store_path

exports.ccInit = function (setcurrentUser, setpath, setchannel, setchaincodeID, setpeer, setorderer){
    store_path = setpath;
    currentUser = setcurrentUser
    channelname = setchannel
    chaincodeId = setchaincodeID
    channel = fabric_client.newChannel(setchannel);
    peer = fabric_client.newPeer('grpc://'+setpeer);
    channel.addPeer(peer);
    orderer = fabric_client.newOrderer('grpc://'+setorderer)
    channel.addOrderer(orderer);
}

exports.ccJoin = function (){
  /*  // Retrieve genesis block from orderer
    tx_id = client.newTransactionID();
    let g_request = {
    txId :     tx_id
    };
    channel.getGenesisBlock(g_request).then((block) =>{
        genesis_block = block;
        tx_id = client.newTransactionID();
        let j_request = {
          //targets : targets,
          block : genesis_block,
          txId :     tx_id
        };


  return channel.joinChannel(j_request);
    }).then((results) =>{
    if(results && results.response && results.response.status == 200) {
    console.log("Join successful!")
    } else {
    console.log("Something went wrong with join: " + results.response)
    }*/
    //let message =  await joiner.joinChannel('mychannel', peer, "admin", "ptunstad.no");
    //console.log(message.message)
    var addedpeer = "peer0.org1.ptunstad.no:7051"

    //peer = fabric_client.newPeer('grpc://'+'peer4.ptunstad.no:7051')
    peer = fabric_client.newPeer('grpc://'+addedpeer);
    channel.addPeer(peer);
    joinChannel('mychannel', [addedpeer], "admin", "org1", fabric_client).then((result) =>{
        console.log(result.success)
        console.log("Message:" + result.message)
    })

}

//Function to set chaincode based on arguments. For myccds it expects argument to be of type
//key, value. This is the only way to change values.
exports.ccSet = function(ccargs, callback, callback2, resp){
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
    
        // first check to see if the admin is already enrolled
        return fabric_client.getUserContext(currentUser, true);
    }).then((user_from_store) => {
        if (user_from_store && user_from_store.isEnrolled()) {
            console.log('Successfully loaded user from persistence');
            member_user = user_from_store;
        } else {
            throw new Error('Failed to get user.... run enrollAdmin.js (and maybe RegisterUser)');
        }
    
        // get a transaction id object based on the current user assigned to fabric client
        tx_id = fabric_client.newTransactionID();
        console.log("Assigning transaction_id: ", tx_id._transaction_id);

        console.log(ccargs)
    
        // must send the proposal to endorsing peers
        var request = {
            //targets: let default to the peer assigned to the client
            chaincodeId: chaincodeId,
            fcn: 'set',
            args: ccargs,
            chainId: channelname,
            txId: tx_id
        };
    
        // send the transaction proposal to the peers
        return channel.sendTransactionProposal(request);
    }).then((results) => {
        var proposalResponses = results[0];
        var proposal = results[1];
        let isProposalGood = false;
        if (proposalResponses && proposalResponses[0].response &&
            proposalResponses[0].response.status === 200) {
                isProposalGood = true;
                console.log('Transaction proposal was good');
            } else {
                console.error('Transaction proposal was bad');
            }
        if (isProposalGood) {
            console.log(util.format(
                'Successfully sent Proposal and received ProposalResponse: Status - %s, message - "%s"',
                proposalResponses[0].response.status, proposalResponses[0].response.message));
    
            //Callback to print time to proposalresponse. Only neccesary for measurements
            //and can be disabled for runs with more than a sinlge transaction.
            if (typeof callback2 === "function") {
                callback2()
            }
            // build up the request for the orderer to have the transaction committed
            var request = {
                proposalResponses: proposalResponses,
                proposal: proposal
            };
    
            // set the transaction listener and set a timeout of 30 sec
            // if the transaction did not get committed within the timeout period,
            // report a TIMEOUT status
            var transaction_id_string = tx_id.getTransactionID(); //Get the transaction ID string to be used by the event processing
            var promises = [];
    
            var sendPromise = channel.sendTransaction(request);
            promises.push(sendPromise); //we want the send transaction first, so that we know where to check status
    
            // get an eventhub once the fabric client has a user assigned. The user
            // is required bacause the event registration must be signed
            // let event_hub = fabric_client.newEventHub();
            let event_hub = channel.newChannelEventHub(peer);

            // using resolve the promise so that result status may be processed
            // under the then clause rather than having the catch clause process
            // the status
            let txPromise = new Promise((resolve, reject) => {
                let handle = setTimeout(() => {
                    event_hub.unregisterTxEvent(transaction_id_string);
                    event_hub.disconnect();
                    resolve({event_status : 'TIMEOUT'}); //we could use reject(new Error('Trnasaction did not complete within 30 seconds'));
                }, 30000);
                event_hub.connect();
                event_hub.registerTxEvent(transaction_id_string, (tx, code) => {
                    // this is the callback for transaction event status
                    // first some clean up of event listener
                    clearTimeout(handle);
                    //event_hub.unregisterTxEvent(transaction_id_string);
                    //event_hub.disconnect();
    
                    // now let the application know what happened
                    var return_status = {event_status : code, tx_id : transaction_id_string};
                    if (code !== 'VALID') {
                        console.error('The transaction was invalid, code = ' + code);
                        resolve(return_status); // we could use reject(new Error('Problem with the tranaction, event status ::'+code));
                    } else {
                        console.log('The transaction has been committed on peer ' + event_hub.getPeerAddr());
                        resolve(return_status);
                    }
                }, (err) => {
                    //this is the callback if something goes wrong with the event registration or processing
                    reject(new Error('There was a problem with the eventhub ::'+err));
                },
                {disconnect: true} //disconnect when complete
                );
                event_hub.connect();
            });
            promises.push(txPromise);
    
            return Promise.all(promises);
        } else {
            console.error('Failed to send Proposal or receive valid response. Response null or status is not 200. exiting...');
            throw new Error('Failed to send Proposal or receive valid response. Response null or status is not 200. exiting...');
        }
    }).then((results) => {
        console.log('Send transaction promise and event listener promise have completed');
        // check the results in the order the promises were added to the promise all list
        if (results && results[0] && results[0].status === 'SUCCESS') {
            console.log('Successfully sent transaction to the orderer.');
        } else {
            console.error('Failed to order the transaction. Error code: ' + results[0].status);
        }
    
        if(results && results[1] && results[1].event_status === 'VALID') {
            //console.log('Successfully committed the change to the ledger by the peer');
            //Callback function used to measure time-to-commit.
            //This functionality is only used for measurements and can be disabled otherwise.
            if (typeof callback === "function") {
                if(resp){
                    callback('Successfully committed the change to the ledger by the peer', resp)
                }else{
                    callback('Successfully committed the change to the ledger by the peer')
                }
                
            }
        } else {
            console.log('Transaction failed to be committed to the ledger due to ::'+results[1].event_status);
        }
    }).catch((err) => {
        console.error('Failed to invoke successfully :: ' + err);
    });
}

//Callback function used in get-function. 
//Currently not neccesary and only prints result.
function getCallback(result, resp){
    console.log("Result is : " + result)
    if (resp){
        resp.end(result)
    }
    
}

//Functionality to call chaincode to retrieve some sort of data from the blockchain.
//Some supported ccfuncs are 'get', 'getkeyhistory' and 'getbyrange'.
//Takes in as aruments as a key string and callback-function only prints result to console.
exports.ccFunc = function(ccfunc, ccargs, callback, resp){
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
    
        // first check to see if the admin is already enrolled
        return fabric_client.getUserContext(currentUser, true);
    }).then((user_from_store) => {
        if (user_from_store && user_from_store.isEnrolled()) {
            console.log('Successfully loaded user from persistence');
            member_user = user_from_store;
        } else {
            throw new Error('Failed to get user.... run enrollAdmin.js (and maybe RegisterUser)');
        }
    
        const request = {
            //targets : --- letting this default to the peers assigned to the channel
            chaincodeId: chaincodeId,
            fcn: ccfunc,
            args: ccargs
        };
    
        // send the query proposal to the peer
        return channel.queryByChaincode(request)})
    .then((query_responses) => {
    console.log("Query has completed, checking results");
    // query_responses could have more than one  results if there multiple peers were used as targets
    if (query_responses && query_responses.length == 1) {
        if (query_responses[0] instanceof Error) {
            console.error("error from query = ", query_responses[0]);
            if (typeof callback === "function") {
                callback(query_responses[0].toString(), resp)
            }
        } else {
            //Use callback function provided to send result of query to.
            //Currently prints the string to console.
            if (typeof callback === "function") {
                callback(query_responses[0].toString(), resp)
            }
            //Function could also return the result
            //return query_responses[0].toString();
        }
    } else {
        console.log("No payloads were returned from query");
    }
    }).catch((err) => {
    console.error('Failed to query successfully :: ' + err);
    });
}

//For benchmarking use a custom callbackfunction for each completed SET action
//For every completed action increment the counter, and once all operations have
//been completed, print the time it took to perform all operations.
function SetCallback(result, res){
    if(res){
        res.end(result)
    }else{
    currentbenchmarks += 1;
    console.log(result)
    console.log("Finished set number " + currentbenchmarks.toString())
        if(currentbenchmarks >= numbenchmarks){
            console.log("Finished, printing time...")
            console.timeEnd('benchmarkset')
        }      
    }
}
//Custom callback used to measure the time required for a transaction to reach
//the point where a proposal is accepted.
function proposalOkCallback(){
        console.timeEnd('proposalok')
}


//Function used to benchmark by storing a specified number of data items of a
//certain datalength. Based on the totaltime_seconds variable set sleep for some 
//amount of time between transactions. The key is just incremented on count and 
//the value stored is a randomly generated string of the specified lenght.
exports.benchmarkSet = function(numitems, datalength){
    console.time('benchmarkset');
    console.time("proposalok")
    for(var i=0; i < numitems; i++){    
        var key = i.toString();
        var value = [...Array(datalength)].map(i=>(~~(Math.random()*36)).toString(36)).join('')
        console.log(value.length)
        console.log(Buffer.byteLength(value))
        var args = [key, value]
        
        console.log("Sending transaction " + String(i))
        ccSet(args, SetCallback, proposalOkCallback)
        //await sleep((totaltime_seconds/numbenchmarks)*1000)
    }
    console.log("Done sending operations!")
}

//Subfunction used to await sleep in benchmarking function
function sleep(ms){
    return new Promise(resolve=>{
        setTimeout(resolve,ms)
    })
}

//Functionality for storing a file as a key,value entry in the blockchain.
exports.storeFile= function(arglist, resp, body){
    if(resp){
        var key = arglist[0]
        var args = [key, body]
        ccSet(args, SetCallback, null, resp)

    }else{
        if(arglist.length < 2){
            console.log("Need two arguments to store file. Usage: key, file.jpg")
        }
        var key = arglist[0]
        var value = base64fromFile(arglist[1])
        var args = [key, value]
        ccSet(args)
    }
}

//Functionality for storing a file as a base64 encoded key,value entry in the blockchain.
exports.retrieveFile = function(arglist, resp){
    if(resp){
        var key = arglist[0]
        ccFunc('get', key, getCallback, resp)

    }else{
        if(arglist.length < 2){
            console.log("Need two arguments to retrieve file. Usage: key, newfile.jpg")
        }
        var key = [arglist[0]]
        ccFunc('get', key, function(result)  {
            filefromBase64(result, arglist[1])
        })
    }
}

//Subfunction used to generate a base64 string from a file object, used by storeFile.
function base64fromFile(inputfile){
    var file = fs.readFileSync(inputfile)
    return new Buffer(file).toString('base64');
}

//Subfunction used to generate a file based on a base64 string, used by retrieveFile.
function filefromBase64(inputstring, outputfile){
    var decoded = new Buffer(inputstring, 'base64')
    fs.writeFileSync(outputfile, decoded)
}

/*
 * Have an organization join a channel
 */
var joinChannel = async function(channel_name, peers, username, org_name) {
	logger.debug('\n\n============ Join Channel start ============\n')
	var error_message = null;
	var all_eventhubs = [];
	try {
		logger.info('Calling peers in organization "%s" to join the channel', org_name);

		// first setup the client for this org
		//var client = await helper.getClientForOrg(org_name, username);
		//logger.debug('Successfully got the fabric client for the organization "%s"', org_name);
		//var channel = client.getChannel(channel_name);
		if(!channel) {
			let message = util.format('Channel %s was not defined in the connection profile', channel_name);
			logger.error(message);
			throw new Error(message);
		}

	let state_store = await Fabric_Client.newDefaultKeyValueStore({path: store_path})
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
    
        // first check to see if the admin is already enrolled
        let user_from_store = await fabric_client.getUserContext(currentUser, true);
        if (user_from_store && user_from_store.isEnrolled()) {
            console.log('Successfully loaded user from persistence');
            member_user = user_from_store;
        } else {
            throw new Error('Failed to get user.... run enrollAdmin.js (and maybe RegisterUser)');
        }
    		// next step is to get the genesis_block from the orderer,
		// the starting point for the channel that we want to join
		let request = {
			txId : 	fabric_client.newTransactionID(true) //get an admin based transactionID
		};

		let genesis_block = await channel.getGenesisBlock(request);

		// tell each peer to join and wait 10 seconds
		// for the channel to be created on each peer
		var promises = [];
		promises.push(new Promise(resolve => setTimeout(resolve, 10000)));

		let join_request = {
			targets: peers, //using the peer names which only is allowed when a connection profile is loaded
			txId: fabric_client.newTransactionID(true), //get an admin based transactionID
			block: genesis_block
		};
		let join_promise = channel.joinChannel(join_request);
		promises.push(join_promise);
		let results = await Promise.all(promises);
		logger.debug(util.format('Join Channel R E S P O N S E : %j', results));

		// lets check the results of sending to the peers which is
		// last in the results array
		let peers_results = results.pop();
		// then each peer results
		for(let i in peers_results) {
			let peer_result = peers_results[i];
			if (peer_result instanceof Error) {
				error_message = util.format('Failed to join peer to the channel with error :: %s', peer_result.toString());
				logger.error(error_message);
			} else if(peer_result.response && peer_result.response.status == 200) {
				logger.info('Successfully joined peer to the channel %s',channel_name);
			} else {
				error_message = util.format('Failed to join peer to the channel %s',channel_name);
				logger.error(error_message);
			}
		}
	} catch(error) {
		logger.error('Failed to join channel due to error: ' + error.stack ? error.stack : error);
		error_message = error.toString();
	}

	// need to shutdown open event streams
	all_eventhubs.forEach((eh) => {
		eh.disconnect();
	});

	if (!error_message) {
		let message = util.format(
			'Successfully joined peers in organization %s to the channel:%s',
			org_name, channel_name);
		logger.info(message);
		// build a response to send back to the REST caller
		const response = {
			success: true,
			message: message
		};
		return response;
	} else {
		let message = util.format('Failed to join all peers to channel. cause:%s',error_message);
		logger.error(message);
		// build a response to send back to the REST caller
		const response = {
			success: false,
			message: message
		};
		return response;
	}
};
exports.joinChannel = joinChannel;



exports.InitFileStore= function(){
    file_store_path = "file:///mnt/hlfshared"
}

exports.StoreDataFS= function(file, key, description="", dependecies=""){
    var fileobj = fs.readFileSync(file)
    
    var pointer = crypto.randomBytes(20).toString('hex');

    path = file_store_path
    if (file_store_path.indexOf('file://') !== -1){
        path = file_store_path.replace("file://", "");
    }

    //Regenerate pointer if file exists
    while (fs.existsSync(path+ "/" +  pointer)){
        var pointer = crypto.randomBytes(20).toString('hex');
    }
    console.log(path+ "/" +  pointer)

    fs.writeFileSync(path+ "/" +  pointer, fileobj)

    console.log("File written" + key)



    var checksum = getchecksum(fileobj) // e53815e8c095e270c6560be1bb76a65d
    var args = [key, checksum, file_store_path, pointer, description, dependecies]
    return args
    // //Create md5 checksum of file
    // var hash = crypto.createHash('md5'),
    // stream = fs.createReadStream(file)

    // stream.on('data', function(data) {
    //     hash.update(data, 'utf8')
    // })

    // stream.on('end', function() {
    //     var checksum = hash.digest('hex')
    //     args = [key, checksum, file_store_path, pointer, description, dependecies]
    //     return args
    // })
}

function getchecksum(str, algorithm, encoding) {
    return crypto
      .createHash(algorithm || 'md5')
      .update(str, 'utf8')
      .digest(encoding || 'hex')
}
exports.GetDataFS= function(file, key){


    fs.writeFileSync(outputfile, decoded)
}