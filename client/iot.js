
var fs = require("fs")
var path = require('path');
var hyperprovclient = require("hyperprov-client")


var keypath = path.join(__dirname, 'hfc-key-store')
hyperprovclient.ccInit('Peer2', keypath, 'mychannel', 'myccds', 'mc.ptunstad.no:7051', 'agc.ptunstad.no:7050');
hyperprovclient.InitFileStore("file:///mnt/hlfshared")
sendData()


async function sendData(){
    var year;
    count = 0
    submitted = 0
    for (year = 1974; year <= 1974; year++) {
        var path = "/data/gsod/scp/NOAA-GSOD-GET"
        path = path + "/" + year.toString() 
        

        
        //Station list ftp://ftp.ncdc.noaa.gov/pub/data/noaa/isd-history.txt
        // 010250 TROMSO // 011510 MOIRANA // 010080 LONGYEARBYEN // 038650 SOUTHHAMPTON // EAST LONDON 688580 // 688160 CAPE TOWN
        stations = ["010250"]//, "011510", "010080", "038650", "688580", "688160"]
        for (let station of stations) {
        //station = "010250" // 010250 TROMSO // 011510 MOIRANA // 012770 STEINKJER // 014920 OSLO - BLINDERN // EAST LONDON 688580 // 688160 CAPE TOWN
        filename = station+'-99999-' + year.toString() +'.op'
        file = path + '/' + filename


        //Check that file exists
        if (!fs.existsSync(file)){
            console.log("File does not exist in off chain storage: " + file)
        }else{
            // Read a file for data
            var array = fs.readFileSync(file).toString().split("\n");
            for(i in array) {
                //Check that line is not empty, last line always empty
                if(array[i] != "" && i != 0){
                
                    

                    var response = null
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

                    var measurement = ("YMD: " + ymd + "  T: " + temp + "  MaxT: " + maxtemp + "  MinT: " + mintemp + "  Wind: " + wdsp + "  MaxWind: " + maxwdsp)
                    
                    var buf = Buffer.from(array[i], 'utf8');
                    hyperprovclient.StoreDataFS(buf, station, measurement).then((r) => {
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

                    console.log(count)
                    await waitForComplete(120000)
                    /*if(response != 'Successfully committed the change to the ledger by the peer'){
                        console.log("Something went wrong..")
                    }*/
                    console.log("After wait2\n\n\n\n")
                    
                    
                    //while (!r) {}
                
                }  
            
            }
        }
    }
    }
    console.log(count)
}


