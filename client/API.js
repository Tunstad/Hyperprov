var hyperprovclient = require("hyperprov-client")
var path = require('path');

//Switch to enable REST-api access or disable for CLI
var RESTAPI = true;

//Answer only local or external accesses to REST api
var localONLY = true;
var keypath = path.join(__dirname, 'hfc-key-store')
hyperprovclient.ccInit('Peer2', keypath, 'mychannel', 'mc.ptunstad.no:7051', 'agc.ptunstad.no:7050');

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
    hyperprovclient.ccSet(requestarguments, SetCallback, null, res)
})
app.get('/get', function (req, res) {
    console.log("Request GET")
    var requestarguments = req.get('arguments').toString()
    hyperprovclient.ccFunc('get', requestarguments, getCallback, res)
})
app.get('/getkeyhistory', function (req, res) {
    console.log("Request GET")
    var requestarguments = req.get('arguments').toString()
    hyperprovclient.ccFunc('getkeyhistory', requestarguments, getCallback, res)
})
app.get('/getbyrange', function (req, res) {
    console.log("Request GET")
    var requestarguments = req.get('arguments').toString().split(", ")
    hyperprovclient.ccFunc('getbyrange', requestarguments, getCallback, res)
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


//For benchmarking use a custom callbackfunction for each completed SET action
//For every completed action increment the counter, and once all operations have
//been completed, print the time it took to perform all operations.
function SetCallback(result, res){
    if(res){
        res.end(result)
    }else{
    currentbenchmarks += 1;
    console.log(result)
    console.log("Finished set number " + currentbenchmarks.toString())
        if(currentbenchmarks >= numbenchmarks){
            console.log("Finished, printing time...")
            console.timeEnd('benchmarkset')
        }      
    }
}

//Callback function used in get-function. 
//Currently not neccesary and only prints result.
function getCallback(result, resp){
    console.log("Result is : " + result)
    if (resp){
        resp.end(result)
    }
    
}