
var fs = require("fs")
var path = require('path');
var hyperprovclient = require("hyperprov-client")


var keypath = path.join(__dirname, 'hfc-key-store')
hyperprovclient.ccInit('Peer2', keypath, 'mychannel', 'myccds', 'mc.ptunstad.no:7051', 'agc.ptunstad.no:7050');
hyperprovclient.InitFileStore("file:///mnt/hlfshared")
var modelFolder = "./ML/idenprof/models"
var Key = "imageML_node3"
var logfile = "ml_model_log"
StoreModels()

async function StoreModels(){
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
            console.log(Key)
            console.log(file)
            console.log(model)
            hyperprovclient.StoreDataFS(model, Key, file).then((r) => {
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
