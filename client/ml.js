
var fs = require("fs")
var path = require('path');
var hyperprovclient = require("hyperprov-client")
var glob = require("glob")

//Setup for Hyperprov, specify where to find keys, what key to use, channel, chaincode and peer/orderer addresses.
var keypath = path.join(__dirname, 'hfc-key-store')
hyperprovclient.ccInit('Peer2', keypath, 'mychannel', 'myccds', 'mc.ptunstad.no:7051', 'agc.ptunstad.no:7050');

//Initialize file store used for StoreDataFS and GetDataFS off-chain storage operators.
hyperprovclient.InitFileStore("file:///mnt/hlfshared")

//Set folders used to track created models, test data and training data
//along with the corresponding keys used to track them in the ledger.
var modelFolder = "./ML/idenprof/models"
var ModelKey = "imageML_node3"

var TestKey = "imageML_node3_test54"
var TestFolder = "./ML/idenprof/test"

var TrainKey = "imageML_node3_train54"
var TrainFolder = "./ML/idenprof/train"

//Logfile is used for persistant tracking of which models have been
//stored if this application is run as a periodic process
var logfile = "ml_model_log"


//Call the function to collect and store model data
StoreModels()


//This function assumes the presence of training data, test data and model files.
//Theese can be any files for testing but we used files from the ML/ folder retrieved
//and generated from https://github.com/OlafenwaMoses/ImageAI
async function StoreModels(){

    //Check that the current version of test/training data matches the last stored one, 
    //and retrieve their txID to link as dependency. 
    //We only store a list of test and training data files, not the actual files.
    var Traintxid = await CheckData(TrainKey, TrainFolder)
    var Testtxid = await CheckData(TestKey, TestFolder)

    //Check model log file for already stored models
    var stored_files = []
    if (!fs.existsSync(logfile)){
        console.log("File list does not already exist, creating..")
        fs.writeFile(logfile, "")
    }else{
        model_log = fs.readFileSync(logfile)
        var stored_files = JSON.parse(model_log)
    }

    //Get a list of all models present in model folder
    files = fs.readdirSync(modelFolder)

    //Loop all model files
    for (let file of files){
        //Check if file is already stored based on modellog
        if(stored_files.indexOf(file) > -1){
            console.log("File: \"" + file+"\" already stored in Hyperprov")
        }else{

            //File not stored, read file and store using Hyperprov
            var response = null
            var model = await fs.readFileSync(modelFolder + "/" + file);
            console.log(ModelKey)
            console.log(file)
            console.log(model)
            hyperprovclient.StoreData(model, ModelKey, file, Traintxid+":"+Testtxid).then((r) => {
                response = r
                console.log("R:" + r)
            })
    
            var waitForComplete = timeoutms => new Promise((r, j)=>{
                var check = () => {
                if(response != null ){
                    console.log("Response set!") 
                    r()
                }else if((timeoutms -= 100) < 0)
                    j('ccGet timed out..')
                else
                    setTimeout(check, 100)
                }
                setTimeout(check, 100)
            })

            //Wait for file to be stored in ledger
            await waitForComplete(120000)

            //Push file to stored log
            stored_files.push(file)
        }
    }
    //Update stored log once all files are stored
    fs.writeFile(logfile, JSON.stringify(stored_files))
}

//Check the presence of model/training data in blockchain, and store/update if not present
async function CheckData(key, folder){
    var txid = null

    //Check if data is stored on supplied key
    var currentdata= await hyperprovclient.GetDataFS(key)

    //Data was not found, retrieve file list and store to blockchain.
    if(currentdata[1] == null){
        console.log("Getting directories, test data not found..")
        getDirectories(folder, function (err, res) {
            //console.log(typeof res.toString())
            hyperprovclient.StoreData(res.toString(), key).then((r) => {
                response = r
                hyperprovclient.GetDataFS(key).then((currentdata) =>{
                    if(currentdata[1] != null){
                        console.log("Set txid of recently added data..")
                        txid = currentdata[1]
                    }else{
                        console.log(currentdata)
                        console.log("Something went wrong retrieving TestData from Hyperprov")
                        throw Error
                    }
                })
            })
          });

    }else{
        //Some data was found, checking if it needs to be updated
        var fileobjcurrent = currentdata[0]
        getDirectories(folder, function (err, res) {
            if (res == fileobjcurrent.toString()){
                console.log("Test data in Hyperprov same as current data")
                txid = currentdata[1]
            }else{

                //Data was not the same as previously stored, updating record.
                console.log("New data in testset, pushing update to Hyperprov..")
                hyperprovclient.StoreData(res.toString(), key, dependencies=currentdata[1]).then((r) => {
                    response = r
                    hyperprovclient.GetDataFS(key).then((currentdata) =>{
                        if(currentdata[1] != null){
                            console.log("Set txid of recently added data..")
                            txid = currentdata[1]
                        }else{
                            console.log(currentdata)
                            console.log("Something went wrong retrieving TestData from Hyperprov")
                            throw Error
                        }
                    })
                })
            }
        });
    }

    var waitForComplete = timeoutms => new Promise((r, j)=>{
        var check = () => {
        if(txid != null ){
            console.log("Response set!") 
            r()
        }else if((timeoutms -= 100) < 0)
            j('ccGet timed out..')
        else
            setTimeout(check, 100)
        }
        setTimeout(check, 100)
    })
    // Operation completed, data should now be stored, returning current txID.
    await waitForComplete(120000)
    return txid
}

var getDirectories = function (src, callback) {
    glob(src + '/**/*', callback);
  };
