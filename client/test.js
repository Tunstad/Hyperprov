/*var size = 10000

for ( var i = 0; i < 23; i++){
    size = Math.round(size + size/2)
    console.log(size)
}
*/
var fs = require("fs")
var path = require('path');
var hyperprovclient = require("hyperprov-client")


var keypath = path.join(__dirname, 'hfc-key-store')
hyperprovclient.ccInit('Peer2', keypath, 'mychannel', 'myccds', 'mc.ptunstad.no:7051', 'agc.ptunstad.no:7050');
hyperprovclient.InitFileStore("file:///mnt/hlfshared")

test()

async function test(){
    var resultlist = []
for (var i = 0; i < 100; i++){

var requestarguments = ["asdf" + String(i), "1234asdfdsfa", "/mnt/hlfshared", "adsfasdfa.jpg", "Json:{lol}", "3187130962b4f4a3c1d66437caf274b66110e5573d21105066f799e6ee5fea6c"]
var starttime = Date.now()
hyperprovclient.ccPost('set', requestarguments).then((r) => {
    var donetime = (Date.now() - starttime)
    resultlist.push(donetime)
    console.log(donetime)
})

await sleep(5000)
}
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