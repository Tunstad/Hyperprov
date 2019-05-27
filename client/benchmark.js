var hyperprovclient = require("hyperprov-client")
var path = require('path');
var fs = require('fs');
const {exec} = require("child_process")

//Setup for Hyperprov, specify where to find keys, what key to use, channel, chaincode and peer/orderer addresses.
var keypath = path.join(__dirname, 'hfc-key-store')
hyperprovclient.ccInit('Peer2', keypath, 'mychannel', 'myccds', 'agc-rpi6.cs.uit.no:7051', 'agc-rpi4.cs.uit.no:7050');

//Initialize file store used for StoreDataFS and GetDataFS off-chain storage operators.
hyperprovclient.InitFileStore("file:///mnt/hlfshared")

//The size of files generated and stored in this benchmark
var bdatalength = 1000

//Batch size, number of transactions sent at once to blockchain before waiting for all to complete
var btotalnumber = 10



//##//##// We have three types of benchmarks to run //##//##//

// Single transaction benchmark
//Input: Number of transactions, size in bytes of files, off chain storage enabled, blockchain storage enabled.
//benchmark(2, 5000, false, true)

// Multiple transaction benchmark, used to measure performance for varying levels of file and batch sizes.
//multibenchmark()

// Test with a specific level of load
//Input: seconds to run, number of transactions to send across test, size in bytes of files
loadTest(600, 4000, 100)

// Multiple transaction benchmark, used to measure performance for varying levels of file and batch sizes.
async function multibenchmark(){

    //Start tracking totaltime to print in console
    console.time('TotalTime');
    var measurements = []

    //The number of mesurement iterations of varying parameters to be run
    var benchmarks = 50

    //The number of samples used each iteration, averages are calucalted and returned at the end
    var samples = 3

    //Set data length and batch size to the variables specified at top.
    var length = bdatalength
    var number = btotalnumber

    //Run the benchmark iterations.
    for(var i = 0; i < benchmarks; i++){
        console.log("Starting round " + i + " of benchmarks..")

        //Increase data size but 1/10 for each iteration
        length = Math.round(length + length/10)

        //Increase batch size by 1/3 by each iteration
        //number = Math.round(number + number/3)

        //Run this iteration for the set number of samples
        for(var j = 0; j < samples; j++){
        
        //Specify if off-chain storage and blockchain is used in argument 3 and 4 here.
        var r = await benchmark(number, length , true, true) // *(Math.pow(10, i)) , Math.round(btotalnumber + (i*10))

        //Push results form this sample
        measurements.push(r)
        console.log("Sample nr " + j + " completed.")
        }
    }

    var count = 0
    var results = []

    //Iterate measurements and calulate statistics.
    for(var i = 0; i < benchmarks; i++){
        var avgtime = []
        var respavg = []
        var respstd = []
        var failures = 0
        //Iterate sample measurements
        for(var j = 0; j < samples; j++){
            //Parse ms from time average time measurement
            var timestring = measurements[count][0].toString().replace('ms', '')
            //If measurement had errors it should be excluded from averages, record error in failures.
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
        //Calulate total time and standard deviation from all samples.
        var totalstdDev = standardDeviation(avgtime).toFixed(2)
        var totalavg = average(avgtime).toFixed(2)

        //Calculate average response time from all samples.
        var responsesaveraged = average(respavg).toFixed(2)
        var responsestdsaveraged = average(respstd).toFixed(2)

        //Use average time and the number of measurements to calculate transactions per minute
        var TperMin = ((measurements[count-1][2] / (totalavg/1000))*60).toFixed(2) 
        
        //Push results for this iteration
        results.push([totalavg, totalstdDev, TperMin, responsesaveraged, responsestdsaveraged, failures, measurements[count-1][2], measurements[count-1][3], samples])
    }
    //Print total time for all measurements in console
    console.timeEnd('TotalTime')

    //Save results to JSON with helper function, see below.
    savejson(results)
}

// Single transaction benchmark, used in multibenchmark
//Input: Number of transactions, size in bytes of files, off chain storage enabled, blockchain storage enabled.
async function benchmark(totalnumber, datalength, OCS=true, BCS =true){
    var count = 0
    var failed = 0
    
    //Generate data "file" that should be stored.
    var value = [...Array(datalength)].map(i=>(~~(Math.random()*36)).toString(36)).join('')

    var starttimes = []
    var responsetimes = []
    var sendDone = false

    //Declare helper function for async operation
    function checkIfSendDone(){
        sendDone = true
    }

    //Get start time for total
    var begin=Date.now();
    
    //Iterate and push all transactions
    for (i = 0; i < totalnumber; i++){
        //Get starttime for this individual transaction
        starttimes[i] = Date.now()

        //If Off-chain storage is enabled, store with complete function
        //Otherwise, statically generate arguments used to store in blockchain.
        //For multiple concurrent clients, String(i) should be "a"+String(i) and "b"+String(i) etc.
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

        //If blockchain storage is enabled, which it should be, call operations to store data in Hyperledger Fabric.
        if(BCS){
        hyperprovclient.StoreDataHL(HLargs, checkIfSendDone).then((res) => {
            //If something went wrong, record as failed.
            if(res[0] == "Transaction failed to be committed to the ledger due to ::TIMEOUT" || res == "Failed to invoke successfully :: Error: No identity has been assigned to this client"){
                failed += 1
            }

            //Store time to completion(TTC) once callback returns
            var key = res[1]
            responsetimes[key] = Date.now()-starttimes[key]

            //Record that one more transaction has completed.
            count += 1
        })

        //Sleep until send callback has returned, indication that time to proposal(TTP) has been reached.
        while (sendDone != true){
            await sleep(10)
        }
        sendDone = false
        }else{
            //If no hlf used, simply count as completed.
            count += 1
        }
    }

    //Sleep here untill all transactions have completed.
    while (count != totalnumber){
        await sleep(100)
    }

    //Get time for total, calculate average and standard deviation of response times.
    var end= Date.now();
    var avgresponsetime = average(responsetimes)
    var stdresponetime = standardDeviation(responsetimes)

    return [(end-begin) +"ms", failed, totalnumber, datalength, avgresponsetime, stdresponetime]
}


// Test with a specific level of load
//Input: seconds to run, number of transactions to send across test, size in bytes of files
async function loadTest(totaltime_seconds, totalnumber, datalength, OCS=true){
    var count = 0
    var failed = 0
    var starttimes = []
    var responsetimes = []

    //Generate data "file" that should be stored.
    var value = [...Array(datalength)].map(i=>(~~(Math.random()*36)).toString(36)).join('')

    //Get start time for total
    var begin=Date.now();

    //Declare helper function for async operation
    var sendDone = false
    function checkIfSendDone(){
        sendDone = true
    }

    //Iterate and push all transactions
    for(var i=0; i < totalnumber; i++){
         //Get starttime for this individual transaction
        var starttime = Date.now()
        starttimes[i] = Date.now()

        //If Off-chain storage is enabled, store with complete function
        //Otherwise, statically generate arguments used to store in blockchain.
        //For multiple concurrent clients, String(i) should be "a"+String(i) and "b"+String(i) etc.
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
            //If something went wrong, record as failed.
            if(res[0] == "Transaction failed to be committed to the ledger due to ::TIMEOUT" || res == "Failed to invoke successfully :: Error: No identity has been assigned to this client"){
                failed += 1
            }

            //Store time to completion(TTC) once callback returns
            var key = res[1]
            responsetimes[key] = Date.now()-starttimes[key]
            //Record that one more transaction has completed.
            count += 1
        })

        //Sleep until send callback has returned, indication that time to proposal(TTP) has been reached.
        while (sendDone != true){
            await sleep(10)
        }
        sendDone = false

        //Sleep a certain amount of time based on time left, and time allocated for each transaction over total time.
        var donetime = (Date.now() - starttime)
        console.log(donetime)
        var sleeptime = ((totaltime_seconds/totalnumber)*1000) - donetime
        console.log(sleeptime)
        if(sleeptime > 0){
            await sleep(sleeptime)
        }
    }

    //Sleep untill all operations have completed
    while (count != totalnumber){
        await sleep(100)
    }

    //Get time for total, calculate average and standard deviation of response times.
    var end= Date.now();
    var avgresponsetime = average(responsetimes)
    var stdresponetime = standardDeviation(responsetimes)

    console.log("Total time: " + (end-begin).toString() +"ms" + " Avg response time: " + avgresponsetime.toString() + "ms StdResponsetime: " + stdresponetime.toString() +"ms Failures: " + failed.toString())
}

// Function to save response from multibenchmark to JSON file
function savejson(results){

    //Create lists for all types of data recorded by this benchmark
    var tavg = []
    var tsd = []
    var tmin = []
    var respavg = []
    var respsd = []
    var fails = []
    var tnum = []
    var tsize = []
    var samples = []

    //For all types of data recorded, append the value of each record.
    for (let result of results){
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

    //Create JSON object
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


    //Store results in JSON file.
    fs.writeFileSync("measurement.json", json)

    //Automatically start pyplot to plot information.
    exec('python plot.py').unref()
}

//Subfunction used to await sleep in benchmarking function
function sleep(ms){
    return new Promise(resolve=>{
        setTimeout(resolve,ms)
    })
}
//Subfunction to generate random integer between min and max.
function randomIntFromInterval(min,max) // min and max are included.
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
