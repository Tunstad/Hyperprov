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
//var Fabric_CA_Client = require('fabric-ca-client');
var path = require('path');
var util = require('util');
//var os = require('os');
var fs = require("fs")

//Inquirer used to supply the CLI
const inquirer = require('inquirer')

//The time a benchmark is set to run
var totaltime_seconds = 5;        //3600 = 1h, 600 = 10m

//var bm_datalength = 1000000; // MAX == 1398101 characters/bytes

//The user to interact with blockchain as, theese are found in hfc-key-store and generated 
//by having enrollAdmin.js and registerUser.js interact with a fabric CA server
var currentUser = 'Node3'

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
var store_path = path.join(__dirname, 'hfc-key-store');

// setup the fabric network mychannel
var channel = fabric_client.newChannel('mychannel');

//Set the peer to recieve operations and add it to the channel object
var peer = fabric_client.newPeer('grpc://node1.ptunstad.no:7051');
channel.addPeer(peer);

//Set the orderer to be used by the set-functionality in the blockchain.
var order = fabric_client.newOrderer('grpc://node3.ptunstad.no:7050')
channel.addOrderer(order);


//Begin CLI to retrieve user input of application. This could for other use-cases be
//changed to something more along the lines of a REST API if outside access is needed or
//a local API available only to another application for our use case.
var myfunction = ""
var myarguments = ""
var questions = [{
    type: 'input',
    name: 'inputfunc',
    message: "What function do you want to invoke? (Example: 'getbyrange')",
},{
    type: 'input',
    name: 'inputargs',
    message: "List you arguments. (Example:'a, d')",
}]

//Select the command specified and call the correct subfunction with the 
//appropriate arguments.
inquirer.prompt(questions).then(answers => {
    myfunction = answers['inputfunc']
    myarguments = answers['inputargs']
    var myargumentslist = myarguments.split(", ")
    console.log(myargumentslist)
    if(myfunction == "set"){
        ccSet(myargumentslist);
    }else if(myfunction == "bms"){
        numbenchmarks = parseInt(myargumentslist[1])
        benchmarkSet(numbenchmarks, parseInt(myargumentslist[0]))
    }else if(myfunction == "sendfile"){
        storeFile(myargumentslist)
    }else if(myfunction == "getfile"){
        retrieveFile(myargumentslist)
    }else{
        ccFunc(myfunction, myargumentslist, getCallback);
    }
})

//Function to set chaincode based on arguments. For myccds it expects argument to be of type
//key, value. This is the only way to change values.
function ccSet(ccargs, callback, callback2){
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
        //Be sure to change the http to https when the CA is running TLS enabled
        //Not neccesary.
        //fabric_ca_client = new Fabric_CA_Client('http://agc.ptunstad.no:7054', null , '', crypto_suite);
    
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
            let event_hub = fabric_client.newEventHub();
            event_hub.setPeerAddr('grpc://node2.ptunstad.no:7053');
    
            // using resolve the promise so that result status may be processed
            // under the then clause rather than having the catch clause process
            // the status
            let txPromise = new Promise((resolve, reject) => {
                let handle = setTimeout(() => {
                    event_hub.disconnect();
                    resolve({event_status : 'TIMEOUT'}); //we could use reject(new Error('Trnasaction did not complete within 30 seconds'));
                }, 30000);
                event_hub.connect();
                event_hub.registerTxEvent(transaction_id_string, (tx, code) => {
                    // this is the callback for transaction event status
                    // first some clean up of event listener
                    clearTimeout(handle);
                    event_hub.unregisterTxEvent(transaction_id_string);
                    event_hub.disconnect();
    
                    // now let the application know what happened
                    var return_status = {event_status : code, tx_id : transaction_id_string};
                    if (code !== 'VALID') {
                        console.error('The transaction was invalid, code = ' + code);
                        resolve(return_status); // we could use reject(new Error('Problem with the tranaction, event status ::'+code));
                    } else {
                        console.log('The transaction has been committed on peer ' + event_hub._ep._endpoint.addr);
                        resolve(return_status);
                    }
                }, (err) => {
                    //this is the callback if something goes wrong with the event registration or processing
                    reject(new Error('There was a problem with the eventhub ::'+err));
                });
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
            console.error('Failed to order the transaction. Error code: ' + response.status);
        }
    
        if(results && results[1] && results[1].event_status === 'VALID') {
            console.log('Successfully committed the change to the ledger by the peer');
            //Callback function used to measure time-to-commit.
            //This functionality is only used for measurements and can be disabled otherwise.
            if (typeof callback === "function") {
                callback()
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
function getCallback(result){
    console.log("Result is : " + result)
}

//Functionality to call chaincode to retrieve some sort of data from the blockchain.
//Some supported ccfuncs are 'get', 'getkeyhistory' and 'getbyrange'.
//Takes in as aruments as a key string and callback-function only prints result to console.
function ccFunc(ccfunc, ccargs, callback){
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
        //fabric_ca_client = new Fabric_CA_Client('http://agc.ptunstad.no:7054', null , '', crypto_suite);
    
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
        } else {
            //Use callback function provided to send result of query to.
            //Currently prints the string to console.
            if (typeof callback === "function") {
                callback(query_responses[0].toString())
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
function benchmarkSetCallback(){
    currentbenchmarks += 1;
    console.log("Finished set number " + currentbenchmarks.toString())
    if(currentbenchmarks >= numbenchmarks){
        console.log("Finished, printing time...")
        console.timeEnd('benchmarkset')
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
async function benchmarkSet(numitems, datalength){
    console.time('benchmarkset');
    console.time("proposalok")
    for(var i=0; i < numitems; i++){    
        var key = i.toString();
        var value = [...Array(datalength)].map(i=>(~~(Math.random()*36)).toString(36)).join('')
        console.log(value.length)
        console.log(Buffer.byteLength(value))
        var args = [key, value]
        
        console.log("Sending transaction " + String(i))
        ccSet(args, benchmarkSetCallback, proposalOkCallback)
        await sleep((totaltime_seconds/numbenchmarks)*1000)
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
function storeFile(arglist){
    if(arglist.length < 2){
        console.log("Need two arguments to store file. Usage: key, file.jpg")
    }
    var key = arglist[0]
    var value = base64fromFile(arglist[1])
    var args = [key, value]
    ccSet(args)
}

//Functionality for storing a file as a base64 encoded key,value entry in the blockchain.
function retrieveFile(arglist){
    if(arglist.length < 2){
        console.log("Need two arguments to retrieve file. Usage: key, newfile.jpg")
    }
    var key = [arglist[0]]
    ccFunc('get', key, function(result)  {
        filefromBase64(result, arglist[1])
    })
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