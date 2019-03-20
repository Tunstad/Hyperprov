var hyperprovclient = require("hyperprov-client")
var path = require('path');
var fs = require('fs');

var keypath = path.join(__dirname, 'hfc-key-store')
hyperprovclient.ccInit('Peer2', keypath, 'mychannel', 'myccds', 'mc.ptunstad.no:7051', 'agc.ptunstad.no:7050');

hyperprovclient.InitFileStore("file:///mnt/hlfshared")


var store = true

if(store){

    //Store data in off chain storage and the ledger

    var fileobj = fs.readFileSync("input.jpg")
    hyperprovclient.StoreDataFS(fileobj, "mycarimage").then((res) => {
        console.log(res)
    })
}else{

    //Retrieve data from the ledger and then off chain storage


    hyperprovclient.GetDataFS("mycarimage").then((res) => {
        fs.writeFileSync("output.jpg", res[0])
        console.log("Wrote image to file output.jpg")
    })
}
