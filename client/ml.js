
var fs = require("fs")
var path = require('path');
var hyperprovclient = require("hyperprov-client")


var keypath = path.join(__dirname, 'hfc-key-store')
hyperprovclient.ccInit('Peer2', keypath, 'mychannel', 'myccds', 'mc.ptunstad.no:7051', 'agc.ptunstad.no:7050');
var modelFolder = "./ML/idenprof/models"
var Key = "imageML_node3"
StoreModels()

async function StoreModels(){
    hyperprovclient.InitFileStore("file:///mnt/hlfshared")

    var stored_files = []
    if (!fs.existsSync("ML_model_log")){
        console.log("File llist does not already exist, creating..")
        fs.writeFile("ML_model_log", "")
    }else{
        model_log = fs.readFileSync("ML_model_log")
        var stored_files = JSON.parse(model_log)
    }



    files = fs.readdirSync(modelFolder)

    for (let file of files){
        if(stored_files.indexOf(file) > -1){
            console.log(file+" already stored in Hyperprov")
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
    fs.writeFile("ML_model_log", JSON.stringify(stored_files))
}
