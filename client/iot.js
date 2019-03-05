var fs = require("fs")

var array = fs.readFileSync('TROMSO2016.op').toString().split("\n");
for(i in array) {
    //console.log(i)
    //console.log(array[i]);
    if(array[i] != ""){

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

        console.log("YMD: " + ymd)
        console.log("T: " + temp)
        console.log("MaxT: " + maxtemp)
        console.log("MaxT: " + mintemp)
        console.log("Wind: " + wdsp)
        console.log("Max Wind: " + maxwdsp)
        console.log("\n")

    }
    
    
    
}