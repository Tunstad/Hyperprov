'use strict';
/*
* Hyperprov Client Library v0.6, Petter Tunstad
*
* Some functions derived from code in the Hyperledger Project with 
* Copyright IBM Corp All Rights Reserved
* SPDX-License-Identifier: Apache-2.0
*/

var Fabric_Client = require('fabric-client');
var path = require('path');
var util = require('util');
var fs = require("fs")
var crypto = require("crypto");
var helper = require('./lib/helper.js');
var logger = helper.getLogger('Hyperprov');
var enrollRegisterAdmin = require("./Enroll/enrollAdmin")
var enrollRegisterUser = require("./Enroll/registerUser")

//Debugging level
logger.level = "INFO"

//The time a benchmark is set to run
var totaltime_seconds = 1;        //3600 = 1h, 600 = 10m

//The global variables for number of benchmarks to be run, and the 
//current number of benchmarks that have been run. Numbenchmarks is 
//set by the inquirer-prompt.
var numbenchmarks = 0;
var currentbenchmarks = 0;
var default_timeout_ms = 120000

var tx_id = null;
var fabric_client = new Fabric_Client();
var currentUser, store_path, channelname, chaincodeId, channel, peer, orderer, file_store_path

//Set the user to interact with blockchain as, theese are found in hfc-key-store and generated 
//by having enrollAdmin and registerUser interact with a fabric CA server
//Also set the keystore path, channel to interact with, chaincode as well as address for peer and orderer nodes.
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

// Deprecated: Functionlaity for joining a network.
exports.ccJoin = function (){

    var addedpeer = "peer0.org1.ptunstad.no:7051"
    peer = fabric_client.newPeer('grpc://'+addedpeer);
    channel.addPeer(peer);
    joinChannel('mychannel', [addedpeer], "admin", "org1", fabric_client).then((result) =>{
        console.log(result.success)
        console.log("Message:" + result.message)
    })

}

// Regsiter an admin user with the CA server, used to register other users
exports.registerAdmin = function (store_path, caURL, caName, enrollmentID, enrollmentSecret, MSPid){
    //enrollRegisterAdmin.enrollAdmin("./hfc-key-store3", 'http://agc-lab2.cs.uit.no:7054','ca.ptunstad.no', 'admin', 'adminpw', 'Org1MSP')
    enrollRegisterAdmin.enrollAdmin(store_path, caURL, caName, enrollmentID, enrollmentSecret, MSPid)
}
//Register an user with the CA server, used to interact with the ledger. Users must have an unique username.
exports.registerUser = function (store_path, username, affiliation, role, caURL, caName, MSPid){
    //enrollRegisterUser.enrollUser("./hfc-key-store3", "peer1", "org1.department1", "client", 'http://agc-lab2.cs.uit.no:7054','ca.ptunstad.no', 'Org1MSP')
    enrollRegisterUser.enrollUser(store_path, username, affiliation, role, caURL, caName, MSPid)
}

//Function to post data via chaincode based on arguments, typically the set operation. 
//For myccds it expects argument to be of type key, value. callback/resp used for returning result, 
//timeout is the time used set before a transaction fails from no response.
//donefunc used to signal to benchmarking applications when time to proposal(ttp) is done, and a new 
//additional transaction can be issued, instead of waiting for time to commit.
var ccPost = exports.ccPost = async function(ccfunc, ccargs, timeout, donefunc){ 
    
    //Track time to post, printed in console
    console.time('PostTime');
    var member_user

    //If no timeout is specified set to default
    if (timeout === undefined) {
        timeout = default_timeout_ms;
    }

    var response = null
    var transaction_id_string = null
    var proposed_txid = null

    //Set up context using fabric-client SDK
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
    
        // first check to see if the user is already enrolled
        return fabric_client.getUserContext(currentUser, true);
    }).then((user_from_store) => {
        if (user_from_store && user_from_store.isEnrolled()) {
            logger.debug('Successfully loaded user from persistence');
            member_user = user_from_store;
        } else {
            throw new Error('Failed to get user.... run enrollAdmin.js (and maybe RegisterUser)');
        }
    
        // get a transaction id object based on the current user assigned to fabric client
        tx_id = fabric_client.newTransactionID();
        proposed_txid = tx_id._transaction_id
        logger.debug("Assigning transaction_id: ", tx_id._transaction_id);

    
        // must send the proposal to endorsing peers
        var request = {
            //targets: let default to the peer assigned to the client
            chaincodeId: chaincodeId,
            fcn: ccfunc,
            args: ccargs,
            chainId: channelname,
            txId: tx_id
        };
    
        // send the transaction proposal to the peers
        return channel.sendTransactionProposal(request);
    }).then((results) => {
        //Transaction proposal have completed.
        var proposalResponses = results[0];
        var proposal = results[1];
        let isProposalGood = false;
        if (proposalResponses && proposalResponses[0].response &&
            proposalResponses[0].response.status === 200) {
                isProposalGood = true;
                logger.debug('Transaction proposal was good');
            } else {
                console.error('Transaction proposal was bad');
            }
        if (isProposalGood) {
            logger.debug(util.format(
                'Successfully sent Proposal and received ProposalResponse: Status - %s, message - "%s"',
                proposalResponses[0].response.status, proposalResponses[0].response.message));
    
            //Callback to print time to proposalresponse. Only neccesary for measurements
            //and can be disabled for runs with more than a sinlge transaction.
            // if (typeof callback2 === "function") {
            //     callback2()
            // }
            // build up the request for the orderer to have the transaction committed
            var request = {
                proposalResponses: proposalResponses,
                proposal: proposal
            };
    
            // set the transaction listener and set a timeout of 30 sec
            // if the transaction did not get committed within the timeout period,
            // report a TIMEOUT status
            transaction_id_string = tx_id.getTransactionID(); //Get the transaction ID string to be used by the event processing
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
                        logger.debug('The transaction has been committed on peer ' + event_hub.getPeerAddr());
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
            ///Call donefunct to allow additional transactions in benchmarks, all that remains is to wait for commit response.
            if (donefunc){
                donefunc()
            }
            
            return Promise.all(promises);
        } else {
            console.error('Failed to send Proposal or receive valid response. Response null or status is not 200. exiting...');
            throw new Error('Failed to send Proposal or receive valid response. Response null or status is not 200. exiting...');
        }
    }).then((results) => {
        logger.debug('Send transaction promise and event listener promise have completed');
        // check the results in the order the promises were added to the promise all list
        if (results && results[0] && results[0].status === 'SUCCESS') {
            logger.debug('Successfully sent transaction to the orderer.');
        } else {
            console.error('Failed to order the transaction. Error code: ' + results[0].status);
        }
    
        if(results && results[1] && results[1].event_status === 'VALID') {
            //Deprecated: Callback function used to measure time-to-commit here.
            //This functionality is only used for measurements and can be disabled otherwise.
            
            response = proposed_txid

        } else {
            console.log('Transaction failed to be committed to the ledger due to ::'+results[1].event_status);
            response = 'Transaction failed to be committed to the ledger due to ::'+results[1].event_status
        }
    }).catch((err) => {
        console.error('Failed to invoke successfully :: ' + err);
        response = 'Failed to invoke successfully :: ' + err
    });

var waitForComplete = timeoutms => new Promise((r, j)=>{
    var check = () => {
        if(response != null){
        r()
        }else if((timeoutms -= 100) < 0)
        j('ccGet timed out..')
        else
        setTimeout(check, 100)
    }
    setTimeout(check, 100)
    })

    //Wait for completed call to HLF SDK to complete before returning response.
    await waitForComplete(timeout)
    return response
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
//Callback/resp used to return result back to caller.
var ccGet = exports.ccGet =  async function(ccfunc, ccargs, timeout){
    var member_user
    if (timeout === undefined) {
        timeout = default_timeout_ms;
    }
    var response = null
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
    
        // first check to see if the user is already enrolled
        return fabric_client.getUserContext(currentUser, true);
    }).then((user_from_store) => {
        if (user_from_store && user_from_store.isEnrolled()) {
            //console.log('Successfully loaded user from persistence');
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
    //console.log("Query has completed, checking results");
    // query_responses could have more than one  results if there multiple peers were used as targets
    if (query_responses && query_responses.length == 1) {
        if (query_responses[0] instanceof Error) {
            console.error("error from query = ", query_responses[0]);
            response = query_responses[0].toString()
        } else {
            //Currently prints the string to console.
            response = query_responses[0].toString()
        }
    } else {
        console.log("No payloads were returned from query");
        response = "No payloads were returned from query"
    }
    }).catch((err) => {
    console.error('Failed to query successfully :: ' + err);
    response = 'Failed to query successfully :: ' + err
    });

    var waitForComplete = timeoutms => new Promise((r, j)=>{
        var check = () => {
          if(response != null){
            r()
          }else if((timeoutms -= 100) < 0)
            j('ccGet timed out..')
          else
            setTimeout(check, 100)
        }
        setTimeout(check, 100)
      })

      //Helper function to wait for response variable to be set before returning.
      await waitForComplete(timeout)
      return response
}

//Subfunction used to await sleep in benchmarking function
function sleep(ms){
    return new Promise(resolve=>{
        setTimeout(resolve,ms)
    })
}

//Deprecated but working: Functionality for storing a file as a key,value entry in the blockchain.
exports.storeFile= function(arglist, resp, body){
    if(resp){
        var key = arglist[0]
        var args = [key, body]
        ccPost('set', args, SetCallback, null, resp)

    }else{
        if(arglist.length < 2){
            console.log("Need two arguments to store file. Usage: key, file.jpg")
        }
        var key = arglist[0]
        var value = base64fromFile(arglist[1])
        var args = [key, value]
        ccPost('set', args)
    }
}

//Deprecated but working: Functionality for storing a file as a base64 encoded key,value entry in the blockchain.
exports.retrieveFile = function(arglist, resp){
    if(resp){
        var key = arglist[0]
        ccGet('get', key, getCallback, resp)

    }else{
        if(arglist.length < 2){
            console.log("Need two arguments to retrieve file. Usage: key, newfile.jpg")
        }
        var key = [arglist[0]]
        ccGet('get', key, function(result)  {
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

// Initialize the path to where files are stored off chain.
//This could be path to local storage, distributedFS or modified for cloud like an S3 bucket.
//The current version only uses local storage, for evaluations shared with SSHFS between nodes.
exports.InitFileStore= function(FSpath){
    file_store_path = FSpath
    var path
    if (file_store_path.indexOf('file://') !== -1){
        path = file_store_path.replace("file://", "");
    }

    //Check that we have access to proposed off chain storage path
    if (fs.existsSync(path)){
        logger.info('FileStore present and succesfully init');
        return
    }else{
        var error_message = util.format('Unable to access filestore at path %s', path);
        logger.error(error_message);
        throw new Error(error_message);
    }
}

//StoreData version used for benchmarking to return both response and key used.
exports.StoreDataFSBM =  function(fileobj, key, description="", dependecies=""){
var response = StoreDataFS(fileobj, key)
return [response, key]
}

//Storedata responsible for both storing the file object in off chain storage and also taking output to store in HLF ledger.
exports.StoreData =  async function(fileobj, key, description="", dependecies="", donefunc){
    var HLargs = await StoreDataFS(fileobj,key, description, dependecies)
    var local_donefunc = null
    if(donefunc){
        local_donefunc = donefunc
    }
    var retval = await StoreDataHL(HLargs, local_donefunc)
    return retval
}

//Split up version of StoreData that only stores files to filestore and computes checksum.
var StoreDataFS = exports.StoreDataFS = function(fileobj, key, description="", dependecies=""){
    
    //Generate random 20 length pointer name
    var pointer = crypto.randomBytes(20).toString('hex');

    var path = file_store_path
    if (file_store_path.indexOf('file://') !== -1){
        path = file_store_path.replace("file://", "");
    }

    //Regenerate pointer if file exists
    while (fs.existsSync(path+ "/" +  pointer)){
        logger.debug("Pointer " + pointer + " already exists, regenerating..")
        var pointer = crypto.randomBytes(20).toString('hex');
    }

    //Write file to off chain storage
    fs.writeFileSync(path+ "/" +  pointer, fileobj)

    logger.debug("File written to off-chain storage at: " + path+ "/" +  pointer)


    //Calculate checksum of file
    var checksum = getchecksum(fileobj) // e53815e8c095e270c6560be1bb76a65d
    logger.debug("File checksum is : " + checksum)
    var args = [key, checksum, file_store_path, pointer, description, dependecies]
    return args
}
//Split up version of StoreData which only stores data in Hyperledger blockchain
var StoreDataHL = exports.StoreDataHL = async function(args, donefunc){
    var response = null
    var local_donefunc = null
    if(donefunc){
        local_donefunc = donefunc
    }

    //Store data in blockchain
    ccPost('set', args, default_timeout_ms, donefunc).then((r) => {
        response = r
    }).catch((err) => {
        console.error('Failed to store successfully in ledger :: ' + err);
        throw new Error('Failed to store successfully in ledger :: ' + err);
    });

    var waitForComplete = timeoutms => new Promise((r, j)=>{
        var check = () => {
          if(response != null){
            r()
          }else if((timeoutms -= 100) < 0)
            j('ccSet timed out..')
          else
            setTimeout(check, 100)
        }
        setTimeout(check, 100)
      })

    await waitForComplete(default_timeout_ms)
    return response
}

//Calculate checksum, by default md5 for efficieny over sha1
function getchecksum(str, algorithm, encoding) {
    return crypto
      .createHash(algorithm || 'md5')
      .update(str, 'utf8')
      .digest(encoding || 'hex')
}

//Get data from blockchain based on key, and retrieve from filestore based on location.
//Also checks the validity of data by matchin checksum with that stored in the ledger.
var GetDataFS = exports.GetDataFS =  async function(key){

    var args = key
    var getfunction = "get"
    var response = null
    var txidresp = null

    //If length is 64(the length of a txid) then use getfromid, not a futureproof soluton, this just for testing :)
    if(key.length == 64){
        getfunction = "getfromid"
    }

    //Get data from blockchain.
    ccGet(getfunction, args).then((result) => {
        if(result.indexOf('Error: Asset not found: ' + key) !== -1){
            console.log("Asset not found..")
            response = result
            return
        }

        //Parse JSON response
        var resultobj = JSON.parse(result)
        var path = resultobj.location
        var pointer = resultobj.pointer

        //Remove file:// if present
        if (file_store_path.indexOf('file://') !== -1){
            path = file_store_path.replace("file://", "");
        }

        //Check that file exists
        if (!fs.existsSync(path+ "/" +  pointer)){
            console.error("File does not exist in off chain storage: " + path+ "/" +  pointer)
            response =  "File does not exist in off chain storage: " + path+ "/" +  pointer
            return
        }

        //Read file
        var fileobj = fs.readFileSync(path+ "/" +  pointer)

        //Verify checksum
        var checksum = getchecksum(fileobj)
        if(checksum == resultobj.hash){
            logger.debug("Checksum correct!")
        }else{
            console.error("Incorrect checksum!")
            response =  "Incorrect checksum!"
        }

        //Set file object to be the response.
        
        txidresp = resultobj.txid
        response = fileobj
    }).catch((err) => {
        console.error('Failed to retrieve successfully from ledger :: ' + err);
        response = err
        return
    });

    var waitForComplete = timeoutms => new Promise((r, j)=>{
        var check = () => {
          if(response != null){
            //console.log(response)
            r()
          }else if((timeoutms -= 100) < 0)
            j('ccGet timed out..')
          else
            setTimeout(check, 100)
        }
        setTimeout(check, 100)
      })
    
    //Wait for response to be set
    await waitForComplete(default_timeout_ms)

    //Return both file object and txID of the current version.
    var retval = []
    retval[0] = response
    retval[1] = txidresp
    return retval
}
