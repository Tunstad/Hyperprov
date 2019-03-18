var hyperprovclient = require("hyperprov-client")
var path = require('path');
var fs = require('fs');

var keypath = path.join(__dirname, 'hfc-key-store')
hyperprovclient.ccInit('Peer2', keypath, 'mychannel', 'myccds', 'mc.ptunstad.no:7051', 'agc.ptunstad.no:7050');

hyperprovclient.InitFileStore("file:///mnt/hlfshared")
var bdatalength = 5000

var btotalnumber = 10
multibenchmark()


async function multibenchmark(){
    var measurements = []
    for(var i = 0; i < 10; i++){
        for(var j = 0; j < 3; j++){
        var r = await benchmark(btotalnumber+(i*10), bdatalength)
        measurements.push(r)
        //console.log("Measurement: " + String(r))
        }
    }
    console.log(measurements)
}

async function benchmark(totalnumber, datalength){
    var count = 0
    var failed = 0
    //console.time("createdata") 
    var value = [...Array(datalength)].map(i=>(~~(Math.random()*36)).toString(36)).join('')
    //console.timeEnd("createdata")
    //console.time("totaltime") 
    var begin=Date.now();
    //console.time("firstpropose")
    for (i = 0; i < totalnumber; i++){
        hyperprovclient.StoreDataFS(new Buffer(value), "asdfasdf"+String(i)).then((res) => {
            //console.timeEnd("firstpropose")
            if(res == "Transaction failed to be committed to the ledger due to ::TIMEOUT" || res == "Failed to invoke successfully :: Error: No identity has been assigned to this client"){
                failed += 1
            }
            count += 1
            //console.log("Count: " + String(count))
            //console.log(res)
        })
        await sleep(randomIntFromInterval(20, 100))
    }

    while (count != totalnumber){
        await sleep(100)
    }
    var end= Date.now();
    //console.log("Time used "+ (end-begin) +"ms")
    //console.timeEnd("totaltime")
    //console.log("Failed transactions: " + String(failed))
    return [(end-begin) +"ms", failed, totalnumber, datalength]
}


//Subfunction used to await sleep in benchmarking function
function sleep(ms){
    return new Promise(resolve=>{
        setTimeout(resolve,ms)
    })
}
function randomIntFromInterval(min,max) // min and max included
{
    return Math.floor(Math.random()*(max-min+1)+min);
}