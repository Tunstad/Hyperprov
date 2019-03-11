var hyperprovclient = require("hyperprov-client")
var path = require('path');
var fs = require('fs');

//Switch to enable REST-api access or disable for CLI
var RESTAPI = true;

//Answer only local or external accesses to REST api
var localONLY = true;
var keypath = path.join(__dirname, 'hfc-key-store')
hyperprovclient.ccInit('Peer2', keypath, 'mychannel', 'myccds', 'mc.ptunstad.no:7051', 'agc.ptunstad.no:7050');


hyperprovclient.InitFileStore("file:///mnt/hlfshared")


// var fileobj = fs.readFileSync("car.jpg")
// hyperprovclient.StoreDataFS(fileobj, "mycarimage").then((res) => {
//     console.log(res)
// })

hyperprovclient.GetDataFS("mycarimage").then((res) => {
    console.log("TxID: "+ res[1])
    fs.writeFileSync("retrievedimage.jpg", res[0])
    console.log("Wrote image to file")

})

/*
console.log("Starting in REST-api mode..")
var express = require('express');
var bodyParser = require('body-parser');
var app = express();
var fs = require("fs");
var listenaddress = '0.0.0.0'
if (localONLY == true){
    listenaddress = '127.0.0.1'
}

app.use(bodyParser.urlencoded({ extended: true }));

app.post('/set', function (req, res) {
    var requestarguments = req.get('arguments').toString().split(", ")
    if (requestarguments.length < 2){
        res.end("Too few arguments, requres a Key and Value")
    }
    if (requestarguments.length < 3){
        //No argument for description, put ""
        requestarguments[2] = ""
    }


    var dependencies = req.get('dependencies').toString().split(", ")
    if(dependencies.length > 0){
        var concated = ""
        for (var d = 0; d < dependencies.length; d++) {
            console.log(dependencies[d])
            if (d != 0) {
                concated = concated.concat(":");
            }
            concated = concated.concat(dependencies[d]);
        }
        console.log(concated)
        requestarguments[3] = concated
        console.log(requestarguments)
    }
    
    hyperprovclient.ccPost(requestarguments, restCallback, null, res)
})
app.get('/get', function (req, res) {
    console.log("Request GET")
    var requestarguments = req.get('arguments').toString()
    hyperprovclient.ccGet('get', requestarguments, restCallback, res)
})
app.get('/getwithid', function (req, res) {
    console.log("Request GET")
    var requestarguments = req.get('arguments').toString()
    hyperprovclient.ccGet('getwithid', requestarguments, restCallback, res)
})
app.get('/getfromid', function (req, res) {
    console.log("Request GET")
    var requestarguments = req.get('arguments').toString()
    hyperprovclient.ccGet('getfromid', requestarguments, restCallback, res)
})
app.get('/getkeyhistory', function (req, res) {
    console.log("Request GET")
    var requestarguments = req.get('arguments').toString()
    hyperprovclient.ccGet('getkeyhistory', requestarguments, restCallback, res)
})
app.get('/getdependencies', function (req, res) {
    console.log("Request GET")
    var requestarguments = req.get('arguments').toString().split(", ")
    hyperprovclient.ccGet('getdependencies', requestarguments, restCallback, res)
})
app.get('/getbyrange', function (req, res) {
    console.log("Request GET")
    var requestarguments = req.get('arguments').toString().split(", ")
    hyperprovclient.ccGet('getbyrange', requestarguments, restCallback, res)
})
app.post('/sendfile', function (req, res) {
    var requestarguments = req.get('arguments').toString()
    hyperprovclient.storeFile(requestarguments, res, req.body)
})
app.get('/getfile', function (req, res) {
    var requestarguments = req.get('arguments').toString()
    hyperprovclient.retrieveFile(requestarguments, res)
})

var server = app.listen(8080, listenaddress, function () {
var host = server.address().address
var port = server.address().port
console.log("Example app listening at http://%s:%s", host, port)
})


function restCallback(result, res){
    console.log("Result is : " + result)
    if (res){
        res.end(result)
    }
}*/
