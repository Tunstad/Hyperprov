
var fs = require("fs")
var path = require('path');
var hyperprovclient = require("hyperprov-client")
var glob = require("glob")


var keypath = path.join(__dirname, 'hfc-key-store')
hyperprovclient.ccInit('Peer2', keypath, 'mychannel', 'myccds', 'mc.ptunstad.no:7051', 'agc.ptunstad.no:7050');
hyperprovclient.InitFileStore("file:///mnt/hlfshared")
var modelFolder = "./ML/idenprof/models"
var ModelKey = "imageML_node3"

var TestKey = "imageML_node3_test"
var TestFolder = "./ML/idenprof/test"

var TrainKey = "imageML_node3_train"
var TrainFolder = "./ML/idenprof/train"

var logfile = "ml_model_log"

StoreModels()

async function StoreModels(){

    var Traintxid = await CheckData(TrainKey, TrainFolder)
    var Testtxid = await CheckData(TestKey, TestFolder)

    var stored_files = []
    if (!fs.existsSync(logfile)){
        console.log("File list does not already exist, creating..")
        fs.writeFile(logfile, "")
    }else{
        model_log = fs.readFileSync(logfile)
        var stored_files = JSON.parse(model_log)
    }

    files = fs.readdirSync(modelFolder)

    for (let file of files){
        if(stored_files.indexOf(file) > -1){
            console.log("File: \"" + file+"\" already stored in Hyperprov")
        }else{
            var response = null
            var model = await fs.readFileSync(modelFolder + "/" + file);
            console.log(ModelKey)
            console.log(file)
            console.log(model)
            hyperprovclient.StoreDataFS(model, ModelKey, file, Traintxid+":"+Testtxid).then((r) => {
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
            await waitForComplete(120000)
            console.log("After wait!!")
            stored_files.push(file)
        }
    }
    fs.writeFile(logfile, JSON.stringify(stored_files))
}


async function CheckData(key, folder){
    var txid = null

    var currentdata= await hyperprovclient.GetDataFS(key)
    console.log(currentdata)
    if(currentdata[1] == null){
        console.log("Getting directories, test data not found..")
        getDirectories(folder, function (err, res) {
            //console.log(typeof res.toString())
            hyperprovclient.StoreDataFS(res.toString(), key).then((r) => {
                response = r
                console.log("R:" + r)
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
        var fileobjcurrent = currentdata[0]
        getDirectories(folder, function (err, res) {
            if (res == fileobjcurrent.toString()){
                console.log("Test data in Hyperprov same as current data")
                txid = currentdata[1]
            }else{
                console.log("New data in testset, pushing update to Hyperprov..")
                hyperprovclient.StoreDataFS(res.toString(), key, dependencies=currentdata[1]).then((r) => {
                    response = r
                    console.log("R:" + r)
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
    await waitForComplete(120000)
    return txid
}

var getDirectories = function (src, callback) {
    glob(src + '/**/*', callback);
  };
