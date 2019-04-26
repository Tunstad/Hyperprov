var hyperprovclient = require("hyperprov-client")
var path = require('path');
var fs = require('fs');
const {exec} = require("child_process")

var keypath = path.join(__dirname, 'hfc-key-store')
hyperprovclient.ccInit('Peer2', keypath, 'mychannel', 'myccds', 'node3.ptunstad.no:7051', 'node1.ptunstad.no:7050');

hyperprovclient.InitFileStore("file:///mnt/hlfshared")
var bdatalength = 1000
//var bdatalengths = [ 1000, 10000, 100000, 500000, 1000000, 5000000, 10000000, 25000000, 50000000, 100000000]
var btotalnumber = 10


loadTest(600, 4000, 100)
//benchmark(2, 5000, false)
//multibenchmark()





async function multibenchmark(){
    console.time('TotalTime');
    var measurements = []
    var benchmarks = 50
    var samples = 3
    var length = bdatalength
    var number = btotalnumber

    for(var i = 0; i < benchmarks; i++){
        console.log("Starting round " + i + " of benchmarks..")
        length = Math.round(length + length/10)
        //number = Math.round(number + number/2)
        for(var j = 0; j < samples; j++){
        var r = await benchmark(number, length , true, false) // *(Math.pow(10, i)) , Math.round(btotalnumber + (i*10))
        measurements.push(r)
        console.log("Sample nr " + j + " completed.")
        //console.log("Measurement: " + String(r))
        }
    }

    var count = 0
    var results = []
    for(var i = 0; i < benchmarks; i++){
        var avgtime = []
        var respavg = []
        var respstd = []
        var failures = 0
        for(var j = 0; j < samples; j++){
            var timestring = measurements[count][0].toString().replace('ms', '')
            if (measurements[count][1] != 0){
                console.log("Excluding measurement due to errors")
                failures += measurements[count][1]
            }else{
                avgtime.push(parseInt(timestring))
                respavg.push(measurements[count][4])
                respstd.push(measurements[count][5])
            }
            count += 1
        }
        var totalstdDev = standardDeviation(avgtime).toFixed(2)
        var totalavg = average(avgtime).toFixed(2)

        var responsesaveraged = average(respavg).toFixed(2)
        var responsestdsaveraged = average(respstd).toFixed(2)
        //console.log("Average time: " + avg + " Standard Deviation: " + stdDev)
        //console.log(avgtime)
        var TperMin = ((measurements[count-1][2] / (totalavg/1000))*60).toFixed(2) 
        //console.log(TperMin + "T/min")
        results.push([totalavg, totalstdDev, TperMin, responsesaveraged, responsestdsaveraged, failures, measurements[count-1][2], measurements[count-1][3], samples])
    }
    console.log(results)
    console.timeEnd('TotalTime')
    savejson(results)
}

async function benchmark(totalnumber, datalength, OCS=true, BCS =true){
    var count = 0
    var failed = 0
    
    //console.time("createdata") 
    var value = [...Array(datalength)].map(i=>(~~(Math.random()*36)).toString(36)).join('')
    //console.timeEnd("createdata")
    //console.time("totaltime") 
    var starttimes = []
    var responsetimes = []
    var sendDone = false

    function checkIfSendDone(){
        sendDone = true
    }

    var begin=Date.now();
    //console.time("firstpropose")
    for (i = 0; i < totalnumber; i++){
        starttimes[i] = Date.now()
        if(OCS){
            var HLargs = await hyperprovclient.StoreDataFS(new Buffer(value), String(i))
        }else{
            var HLargs = [ String(i),
            'eb2227ce2958d6dcc93f00b82c498b75',
            'file:///mnt/hlfshared',
            'c0f2f9ac997af0bd1db035e4445f50ba6e4ec24b',
            '',
            '' ]
        }

        if(BCS){
        hyperprovclient.StoreDataHL(HLargs, checkIfSendDone).then((res) => {
            //console.timeEnd("firstpropose")
            if(res[0] == "Transaction failed to be committed to the ledger due to ::TIMEOUT" || res == "Failed to invoke successfully :: Error: No identity has been assigned to this client"){
                failed += 1
            }
            var key = res[1]
            responsetimes[key] = Date.now()-starttimes[key]

            count += 1
            //console.log("Count: " + String(count))
            //console.log(res)
        })
        while (sendDone != true){
            await sleep(10)
        }
        sendDone = false
        }else{
            count += 1
        }
    }

    while (count != totalnumber){
        await sleep(100)
    }
    var end= Date.now();
    var avgresponsetime = average(responsetimes)
    var stdresponetime = standardDeviation(responsetimes)
    //console.log("Time used "+ (end-begin) +"ms")
    //console.timeEnd("totaltime")
    //console.log("Failed transactions: " + String(failed))
    return [(end-begin) +"ms", failed, totalnumber, datalength, avgresponsetime, stdresponetime]
}

async function loadTest(totaltime_seconds, totalnumber, datalength, OCS=true){
    var value = [...Array(datalength)].map(i=>(~~(Math.random()*36)).toString(36)).join('')
    var count = 0
    var failed = 0
    var starttimes = []
    var responsetimes = []
    var begin=Date.now();

    var sendDone = false
    function checkIfSendDone(){
        sendDone = true
    }



    for(var i=0; i < totalnumber; i++){

        var starttime = Date.now()
        starttimes[i] = Date.now()
        if(OCS){
            var HLargs = await hyperprovclient.StoreDataFS(new Buffer(value), String(i))
        }else{
            var HLargs = [ String(i),
            'eb2227ce2958d6dcc93f00b82c498b75',
            'file:///mnt/hlfshared',
            'c0f2f9ac997af0bd1db035e4445f50ba6e4ec24b',
            '',
            '' ]
        }

        hyperprovclient.StoreDataHL(HLargs, checkIfSendDone).then((res) => {
            if(res[0] == "Transaction failed to be committed to the ledger due to ::TIMEOUT" || res == "Failed to invoke successfully :: Error: No identity has been assigned to this client"){
                failed += 1
            }
                var key = res[1]
                responsetimes[key] = Date.now()-starttimes[key]

            count += 1
        })
        while (sendDone != true){
            await sleep(10)
        }
        sendDone = false
        var donetime = (Date.now() - starttime)
        console.log(donetime)
        var sleeptime = ((totaltime_seconds/totalnumber)*1000) - donetime
        console.log(sleeptime)
        if(sleeptime > 0){
            await sleep(sleeptime)
        }
        

    }
    while (count != totalnumber){
        await sleep(100)
    }
    var end= Date.now();
    var avgresponsetime = average(responsetimes)
    var stdresponetime = standardDeviation(responsetimes)

    console.log("Total time: " + (end-begin).toString() +"ms" + " Avg response time: " + avgresponsetime.toString() + "ms StdResponsetime: " + stdresponetime.toString() +"ms Failures: " + failed.toString())
}


function savejson(results){
    var tavg = []
    var tsd = []
    var tmin = []
    var respavg = []
    var respsd = []
    var fails = []
    var tnum = []
    var tsize = []
    var samples = []

    for (let result of results){
        console.log(result)
        tavg.push(result[0])
        tsd.push(result[1])
        tmin.push(result[2])
        respavg.push(result[3])
        respsd.push(result[4])
        fails.push(result[5])
        tnum.push(result[6])
        tsize.push(result[7])
        samples.push(result[8])
    }
    var o = {}
    o["tavg"] = tavg
    o["tsd"] = tsd
    o["tmin"]= tmin
    o["respavg"]= respavg
    o["respsd"]= respsd
    o["fails"]= fails
    o["tnum"]= tnum
    o["tsize"]= tsize
    o["samples"]= samples

    var json = JSON.stringify(o);
    fs.writeFileSync("measurement.json", json)

    exec('python plot.py').unref()
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

// Helper function used to calculate average and standardDeviation 
// from an array of values, found on derickbailey.com
function standardDeviation(array){
    var avg = average(array);
    
    var squareDiffs = array.map(function(value){
      var diff = value - avg;
      var sqrDiff = diff * diff;
      return sqrDiff;
    });
    
    var avgSquareDiff = average(squareDiffs);

    var stdDev = Math.sqrt(avgSquareDiff);
    return stdDev;
  }
  
  function average(array){
    var sum = array.reduce(function(sum, value){
      return sum + value;
    }, 0);
  
    var avg = sum / array.length;
    return avg;
  }