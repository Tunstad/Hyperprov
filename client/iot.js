var fs = require("fs")
var path = require('path');
var hyperprovclient = require("hyperprov-client")

//Setup for Hyperprov, specify where to find keys, what key to use, channel, chaincode and peer/orderer addresses.
var keypath = path.join(__dirname, 'hfc-key-store')
hyperprovclient.ccInit('Peer2', keypath, 'mychannel', 'myccds', 'mc.ptunstad.no:7051', 'agc.ptunstad.no:7050');

//Initialize file store used for StoreDataFS and GetDataFS off-chain storage operators.
hyperprovclient.InitFileStore("file:///mnt/hlfshared")

//Call the function to parse and send IoT data
sendData()

//This function assumes the presence of the gsod dataset in the location specified by 'path', currently /data/gsod6
//The gsod data set can be retrieved from ftp.ncdc.noaa.gov/pub/data/gsod but we suggest using a 
//script like https://github.com/BStudent/NOAA-GSOD-GET to retrieve it.
async function sendData(){

    var response = null
    var newbatch = true
    var year;
    count = 0
    submitted = 0
    var dependencydepth = 0
    var dependencylist = []

    //Go trough all records for every year and store them
    for (year = 1974; year <= 2017; year++) {
        //Path to where gsod data is located
        var path = "/data/gsod6"
        
        //Station list ftp://ftp.ncdc.noaa.gov/pub/data/noaa/isd-history.txt
        // Example stations:
        // 010250 TROMSO // 011510 MOIRANA // 010080 LONGYEARBYEN // 038650 SOUTHHAMPTON // EAST LONDON 688580 // 688160 CAPE TOWN

        //Set the station/stations to store data from
        stations = ["010250"]//, "011510", "010080", "038650", "688580", "688160"]

        //Store data from stations in list
        for (let station of stations) {

        //First entry of a station has no previously analyzed data to depend on.
        var firstofstation = true

        //Set filename for current station and current year
        filename = station+'-99999-' + year.toString() +'.op'
        file = path + '/' + filename

        
        //Check that file exists
        if (!fs.existsSync(file)){
            console.log("File does not exist in off chain storage: " + file)
        }else{
            // Read a file for data
            var array = fs.readFileSync(file).toString().split("\n");
            for(i in array) {

                //Every 90 records, create an "analysed" record dependant on previous "analysed" and last item
                if (i % 90 == 0 && i != 0){
                    response = null
                    //Get current data item
                    var currentdata= await hyperprovclient.GetDataFS(station)
                    var fileobjcurrent = currentdata[0]
                    var fctxid = currentdata[1]

                    //Get previous analysed record on this station
                    if (!firstofstation){
                    var prevdata = await hyperprovclient.GetDataFS(station + "_analysed")
                    var prevobj = prevdata[0]
                    var prevtxid = prevdata[1]
                    }

                    //Concatinate these data items, this is our makeshift process of "analysing".
                    //The importance is that these items have dependency links to test lineage functionality.
                    if(!firstofstation){
                        fileobjcurrent = Buffer.concat([prevobj, fileobjcurrent]);
                        var depend = fctxid + ":" + prevtxid
                    }else{
                        var depend = fctxid
                    }

                    //Track depth of dependencies recorded
                    dependencydepth += 1

                    //Store analysed data with dependency links.
                    hyperprovclient.StoreData(fileobjcurrent, station+"_analysed", "Modification on " + station, depend).then((r) => {
                        //Once data has been properly stored, do a check with getdependencies to track performance
                        //of the increased depth.
                        response = r
                        var requestarguments = []
                        requestarguments[0] = r
                        requestarguments[1] = "1000"
                        var starttime = Date.now()
                        hyperprovclient.ccGet('getdependencies', requestarguments).then((r) => {
                            var donetime = (Date.now() - starttime)
                            dependencylist.push(donetime)
                            console.log("Time taken to fetch dependencies of depth " + String(dependencydepth) + " is " + String(donetime) + " ms")
                        })
                    })

                    await waitForComplete(120000)
                    firstofstation = false
                }
                //Check that line is not empty, last line always empty
                //If not, record data entry..
                if(array[i] != "" && i != 0){
                
                    response = null
                    //Get the year, month and day
                    var ymd = array[i].substr(14, 8)
                    //Get avg temperature
                    var temp = array[i].substr(25, 5)
                    //Get maximum temperature
                    var maxtemp = array[i].substr(103, 5)
                    //Get maximum temperature
                    var mintemp = array[i].substr(111, 5) 
                    //Get avg wind speed
                    var wdsp = array[i].substr(79, 4)
                    //Get avg wind speed
                    var maxwdsp = array[i].substr(89, 4)
                    count += 1

                    //Create record to hold measured data
                    var measurement = ("YMD: " + ymd + "  T: " + temp + "  MaxT: " + maxtemp + "  MinT: " + mintemp + "  Wind: " + wdsp + "  MaxWind: " + maxwdsp)
                    batchsize = array[i].length  + "\n".length

                    //Every 30 measurements store a batch of 30 records
                    if(i % 30 != 0){
                        if(newbatch){
                            var batchbuf = Buffer.alloc(batchsize * 30);
                            newbatch = false
                        }
                        batchbuf.fill(array[i] + "\n", batchsize*(i%30), batchsize*(i%30) + batchsize)
                    }else {
                        //Batch is full
                        batchbuf.fill(array[i] + "\n", batchsize*(i%30), batchsize*(i%30) + batchsize)

                        //Store data to Hyperprov
                        hyperprovclient.StoreData(batchbuf, station, measurement).then((r) => {
                            response = r
                        })

                        var waitForComplete = timeoutms => new Promise((r, j)=>{
                            var check = () => {
                            if(response != null ){
                                //console.log("Response set!") 
                                r()
                            }else if((timeoutms -= 100) < 0)
                                j('ccGet timed out..')
                            else
                                setTimeout(check, 100)
                            }
                            setTimeout(check, 100)
                        })

                        //Helper function used to wait for completion of append before continuing.
                        await waitForComplete(120000)

                        newbatch = true
                        
                }                
                }  
            
            }
        }

    }
    }
    console.log(count)

    //At the end, store file with times taken to retrieve dependencies.
    fs.writeFile(
        stations+".json",
        JSON.stringify(dependencylist),
        function (err) {
            if (err) {
                console.error('Something went wrong');
            }
        }
    );
}


