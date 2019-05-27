var fs = require("fs")
var path = require('path');
var hyperprovclient = require("hyperprov-client")

//Setup for Hyperprov, specify where to find keys, what key to use, channel, chaincode and peer/orderer addresses.
var keypath = path.join(__dirname, 'hfc-key-store')
hyperprovclient.ccInit('Peer2', keypath, 'mychannel', 'myccds', 'mc.ptunstad.no:7051', 'agc.ptunstad.no:7050');

//Initialize file store used for StoreDataFS and GetDataFS off-chain storage operators.
hyperprovclient.InitFileStore("file:///mnt/hlfshared")

//Call the function to test sending 100 transactions
test()


//This function will send 100 transactions to Hyperprov with 5s delay and record the response time of each
async function test(){
    var resultlist = []

    //Do 100 transactions
    for (var i = 0; i < 100; i++){

    //Set some random data
    var requestarguments = ["asdf" + String(i), "1234asdfdsfa", "/mnt/hlfshared", "adsfasdfa.jpg", "Json:{lol}", "3187130962b4f4a3c1d66437caf274b66110e5573d21105066f799e6ee5fea6c"]
    
    //Measure time at transaction sending
    var starttime = Date.now()

    //Send transaction
    hyperprovclient.ccPost('set', requestarguments).then((r) => {

        //Push time for this transaction to resultlist and print
        var donetime = (Date.now() - starttime)
        resultlist.push(donetime)
        console.log(donetime)
    })

    //Wait 5 seconds between each transaction
    await sleep(5000)
    }

    //Write all transaction times in comma separated format for external handling.
    fs.writeFile(
        "writetimes"+".csv",
        JSON.stringify(resultlist),
        function (err) {
            if (err) {
                console.error('Something went wrong');
            }
        }
    );
}

//Subfunction used to await sleep in benchmarking function
function sleep(ms){
    return new Promise(resolve=>{
        setTimeout(resolve,ms)
    })
}