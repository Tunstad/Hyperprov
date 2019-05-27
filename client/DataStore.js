var hyperprovclient = require("hyperprov-client")
var path = require('path');
var fs = require('fs');

//Setup for Hyperprov, specify where to find keys, what key to use, channel, chaincode and peer/orderer addresses.
var keypath = path.join(__dirname, 'hfc-key-store')
hyperprovclient.ccInit('Peer2', keypath, 'mychannel', 'myccds', 'mc.ptunstad.no:7051', 'agc.ptunstad.no:7050');

//Initialize file store used for StoreDataFS and GetDataFS off-chain storage operators.
hyperprovclient.InitFileStore("file:///mnt/hlfshared")

//Simple functionality to show how you can simply store and retrieve files and provenance using Hyperprov.
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
