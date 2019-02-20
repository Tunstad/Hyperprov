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

//The time a benchmark is set to run
var totaltime_seconds = 1;        //3600 = 1h, 600 = 10m

//var bm_datalength = 1000000; // MAX == 1398101 characters/bytes

//The user to interact with blockchain as, theese are found in hfc-key-store and generated 
//by having enrollAdmin.js and registerUser.js interact with a fabric CA server
var currentUser = ''

//The global variables for number of benchmarks to be run, and the 
//current number of benchmarks that have been run. Numbenchmarks is 
//set by the inquirer-prompt.
var numbenchmarks = 0;
var currentbenchmarks = 0;

var fabric_client = new Fabric_Client();

//User variables stored here if needed, but getUserContext is sufficient to set user for fabric_client
var admin_user = null;
var member_user = null;

var tx_id = null;
var store_path = ''

// setup the fabric network mychannel
var channel

//Set the peer to recieve operations and add it to the channel object
var peer

//Set the orderer to be used by the set-functionality in the blockchain.
var order

exports.ccInit = function (cccurrentUser, ccpath, ccchannel, ccpeer, ccorderer){
    store_path = ccpath;
    currentUser = cccurrentUser
    channel = fabric_client.newChannel(ccchannel);
    peer = fabric_client.newPeer('grpc://'+ccpeer);
    channel.addPeer(peer);
    order = fabric_client.newOrderer('grpc://'+ccorderer)
    channel.addOrderer(order);
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
    
        // must send the proposal to endorsing peers
        var request = {
            //targets: let default to the peer assigned to the client
            chaincodeId: 'myccds',
            fcn: 'set',
            args: ccargs,
            chainId: 'mychannel',
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
            chaincodeId: 'myccds',
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