package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/hyperledger/fabric/core/chaincode/shim"
	"github.com/hyperledger/fabric/core/chaincode/shim/ext/cid"
	pb "github.com/hyperledger/fabric/protos/peer"
)

type SimpleAsset struct {
}

type operation struct {
	Hash         string `json:"hash"`     // The checksum of the data stored by the operation
	Location     string `json:"location"` // Location 1 of the data stored in off chain storage, typically something like "/data/storage/" or "sshfs1://"
	Pointer      string `json:"pointer"`  // Location 2 of the data stored in off chain storage, could be the full file path or file name
	TxID         string `json:"txid"`     // The transactionID used to uniquely identify this exact operation
	Certificate  string `json:"cert"`     // ID from certificate can safely idenitfy the userID uniquely registered to this certificate by the CA
	Type         string `json:"type"`     // Type of operation made, used to indicate if it is just recorded data or data transformed as a result of other data.
	Description  string `json:"desc"`     // A "anything goes" metadata field to describe the data, could e.g hold a json struct of additional metadata
	Dependencies string `json:"depends"`  // A list of the TxID´s for data used to create the data of this operation
}

//Object used to return specific fields from operation struct in get-function
type GetObject struct {
	Hash     string `json:"hash"`
	Location string `json:"location"`
	Pointer  string `json:"pointer"`
	TxID     string `json:"txid"`
}

//Init function  used when chaincode need to instatiate or upgrade, should perform any initialization of application state if needed.
//In our case we do not need any initialized application state so Init just stores an operation similar to set.
func (t *SimpleAsset) Init(stub shim.ChaincodeStubInterface) pb.Response {
	indexName := "txID~key"

	// Get the args from the transaction proposal
	args := stub.GetStringArgs()
	if len(args) != 4 {
		return shim.Error("Incorrect arguments. Expecting a key, value, location and pointer")
	}

	// Set up any variables or assets here by calling stub.PutState()
	txid := stub.GetTxID()
	operation := &operation{args[1], args[2], args[3], txid, "null", "Init", "Init operation", ""}
	operationJSONasBytes, err := json.Marshal(operation)
	if err != nil {
		return shim.Error(fmt.Sprintf("Failed to marshal JSON: %s", string(operationJSONasBytes)))
	}

	// Create composite key of key-field and txid, so when we query only txid we can get the original key
	keyTxIDKey, err := stub.CreateCompositeKey(indexName, []string{stub.GetTxID(), args[0]})
	if err != nil {
		return shim.Error(err.Error())
	}

	// Add key and value to the state, currently double stored to be able to query on both key and txid
	err = stub.PutState(args[0], operationJSONasBytes)
	if err != nil {
		return shim.Error(fmt.Sprintf("Failed to set asset: %s", args[0]))
	}
	err = stub.PutState(keyTxIDKey, operationJSONasBytes)
	if err != nil {
		return shim.Error(fmt.Sprintf("Failed to set TXasset: %s", args[0]))
	}
	return shim.Success(nil)
}

//Invoke is the method called on all invoke transactions and is where functions are separated based on the first field "function"
func (t *SimpleAsset) Invoke(stub shim.ChaincodeStubInterface) pb.Response {

	// Extract the function and args from the transaction proposal
	fn, args := stub.GetFunctionAndParameters()

	var result string
	var err error

	//Switch based on which function is specified in the call
	if fn == "set" {
		result, err = set(stub, args)
	} else if fn == "get" {
		arg := strings.Join(args, "")
		result, err = get(stub, arg)
	} else if fn == "checkhash" {
		arg := strings.Join(args, "")
		result, err = checkhash(stub, arg)
		/*}else if fn == "getwithid" {
		arg := strings.Join(args,"")
		result, err = getWithID(stub, arg)*/
	} else if fn == "getfromid" {
		arg := strings.Join(args, "")
		result, err = getFromID(stub, arg)
	} else if fn == "getdependencies" {
		result, err = getdependencies(stub, args)
	} else if fn == "getkeyhistory" {
		arg := strings.Join(args, "")
		result, err = getkeyhistory(stub, arg)
	} else if fn == "getbyrange" {
		result, err = getbyrange(stub, args)
	}

	//Return if error or empty response
	if err != nil {
		return shim.Error(err.Error())
	}
	if result == "" {
		return shim.Error(err.Error())
	}

	// Return the result as success payload
	return shim.Success([]byte(result))
}

// Set stores the asset (both key and value) on the ledger. If the key exists,
// it will override the value with the new one. The history is still stored in the ledger.
// Getcreator is used to store the creator/updater of a change in terms of provenance.
// This stores the certificate used to perform the change as part of the value and
// will be parsed away for all other operations than getkeyhistory which
// returns this certificate to indicate who performed the change.
func set(stub shim.ChaincodeStubInterface, args []string) (string, error) {
	indexName := "txID~key"

	//Check number of arguments
	if (len(args) != 4) && (len(args) != 5) && (len(args) != 6) {
		return "", fmt.Errorf("Incorrect arguments. Expecting a key, value, pointer, location, and potentially description and dependencies. Args=  " + strconv.Itoa(len(args)))
	}

	//Get userID specified in certificate by the CA
	id, ok, err := cid.GetAttributeValue(stub, "hf.EnrollmentID")
	if err != nil {
		return "", fmt.Errorf("Failed to get ID. %s", string(args[0]))
	}
	if !ok {
		id = "null"
		// The client identity does not possess the attribute
	}

	//Set description if specified
	desc := ""
	if len(args) >= 5 {
		desc = args[4]
	}

	//Set dependecies list if specified
	dependecies := ""
	optype := "Record"
	if len(args) >= 6 {
		//creator, _ := stub.GetCreator()
		dependecies = args[5]
		optype = "Transformation"
	}

	//Get transactionID for this exact operation
	txid := stub.GetTxID()

	// Create operation struct to store as value
	operation := &operation{args[1], args[2], args[3], txid, id, optype, desc, dependecies}
	operationJSONasBytes, err := json.Marshal(operation)
	if err != nil {
		return "", fmt.Errorf("Failed to marshal JSON. %s", string(args[0]))
	}

	// Create composite key of key-field and txid, so when we query only txid we can get the original key
	keyTxIDKey, err := stub.CreateCompositeKey(indexName, []string{stub.GetTxID(), args[0]})
	if err != nil {
		return "", fmt.Errorf(err.Error())
	}

	// Add key and value to the state, currently double stored to be able to query on both key and txid
	err = stub.PutState(args[0], operationJSONasBytes)
	if err != nil {
		return "", fmt.Errorf("Failed to set asset: %s", args[0])
	}
	err = stub.PutState(keyTxIDKey, operationJSONasBytes)
	if err != nil {
		return "", fmt.Errorf("Failed to set TXasset: %s", args[0])
	}
	//Return transaction ID of this operaton to indicate OK
	return txid, nil
}

// Get returns the current value of the specified asset key,
// the value consists of Hash(Checksum), Location/Pointer and its unique transactionID
func get(stub shim.ChaincodeStubInterface, arg string) (string, error) {
	var valueJSON operation

	// If no key is specified, return error
	if arg == "" {
		return "", fmt.Errorf("Incorrect arguments. Expecting a key")
	}

	// Get the last recorded operation on the specified key
	value, err := stub.GetState(arg)
	if err != nil {
		return "", fmt.Errorf("Failed to get asset: %s with error: %s", arg, err)
	}
	if value == nil {
		return "", fmt.Errorf("Asset not found: %s", arg)
	}

	// Unpack the json operation object
	err = json.Unmarshal([]byte(value), &valueJSON)
	if err != nil {
		jsonResp := "{\"Error\":\"Failed to decode JSON of: " + arg + "\"}"
		return "", fmt.Errorf(jsonResp)
	}

	// Create new object to return as response consisting of the fields specified in GetObject
	retobj := GetObject{valueJSON.Hash, valueJSON.Location, valueJSON.Pointer, valueJSON.TxID}
	jsonobj, err := json.Marshal(retobj)

	// Return json-GetObject as response
	return string(jsonobj), nil
}

// Get returns the latest Hash(Checksum) of the specified key
func checkhash(stub shim.ChaincodeStubInterface, arg string) (string, error) {
	var valueJSON operation

	// If no key is specified, return error
	if arg == "" {
		return "", fmt.Errorf("Incorrect arguments. Expecting a key")
	}

	// Get the last recorded operation on the specified key
	value, err := stub.GetState(arg)
	if err != nil {
		return "", fmt.Errorf("Failed to get asset: %s with error: %s", arg, err)
	}
	if value == nil {
		return "", fmt.Errorf("Asset not found: %s", arg)
	}

	// Unpack the json operation object
	err = json.Unmarshal([]byte(value), &valueJSON)
	if err != nil {
		jsonResp := "{\"Error\":\"Failed to decode JSON of: " + arg + "\"}"
		return "", fmt.Errorf(jsonResp)
	}

	// Return hash(checksum) as a response
	return string(valueJSON.Hash), nil
}

// Query a specific operation based on the specified TxID.
func getFromID(stub shim.ChaincodeStubInterface, arg string) (string, error) {
	indexName := "txID~key"
	var valueJSON operation

	// If no TxID is specified, return error
	if arg == "" {
		return "", fmt.Errorf("Incorrect arguments. Expecting a txid")
	}
	txID := arg

	// Use composite key query to find key stored
	it, _ := stub.GetStateByPartialCompositeKey(indexName, []string{txID})
	//Get result, TxID should be unique so no need to iterate
	keyTxIDRange, err := it.Next()
	if err != nil {
		return "", fmt.Errorf(err.Error())
	}

	_, keyParts, _ := stub.SplitCompositeKey(keyTxIDRange.Key)
	key := keyParts[1]
	fmt.Printf("key affected by txID %s is %s\n", txID, key)
	txIDValue := keyTxIDRange.Value

	err = json.Unmarshal(txIDValue, &valueJSON)
	if err != nil {
		jsonResp := "{\"Error\":\"Failed to decode JSON of: " + arg + "\"}"
		return "", fmt.Errorf(jsonResp)
	}

	// buffer is a JSON array containing historic values
	var buffer bytes.Buffer
	//buffer.WriteString("[")
	bArrayMemberAlreadyWritten := false
	if err != nil {
		return "", fmt.Errorf(err.Error())
	}
	// Add a comma before array members, suppress it for the first array member
	if bArrayMemberAlreadyWritten == true {
		buffer.WriteString(",")
	}

	buffer.WriteString("{\"Type\":")
	buffer.WriteString("\"")
	buffer.WriteString(valueJSON.Type)
	buffer.WriteString("\"")

	buffer.WriteString(", \"Hash\":")
	buffer.WriteString("\"")
	buffer.WriteString(valueJSON.Hash)
	buffer.WriteString("\"")

	buffer.WriteString(", \"Location\":")
	buffer.WriteString("\"")
	buffer.WriteString(valueJSON.Location)
	buffer.WriteString("\"")

	buffer.WriteString(", \"Pointer\":")
	buffer.WriteString("\"")
	buffer.WriteString(valueJSON.Pointer)
	buffer.WriteString("\"")

	buffer.WriteString(", \"Description\":")
	buffer.WriteString("\"")
	buffer.WriteString(valueJSON.Description)
	buffer.WriteString("\"")
	/*
		buffer.WriteString(", \"Timestamp\":")
		buffer.WriteString("\"")
		buffer.WriteString(time.Unix(keyTxIDRange.Timestamp.Seconds, int64(keyTxIDRange.Timestamp.Nanos)).String())
		buffer.WriteString("\"")*/
	/*
		buffer.WriteString(", \"Certificate\":")
		buffer.WriteString("\"")
		buffer.WriteString(valueJSON.Certificate)
		buffer.WriteString("\"")*/

	buffer.WriteString(", \"Dependencies\":")
	buffer.WriteString("\"")
	buffer.WriteString(valueJSON.Dependencies)
	buffer.WriteString("\"")

	buffer.WriteString(", \"Key\":")
	buffer.WriteString("\"")
	buffer.WriteString(key)
	buffer.WriteString("\"")

	buffer.WriteString("}")
	bArrayMemberAlreadyWritten = true
	//buffer.WriteString("]")
	/*
		sId := &msp.SerializedIdentity{}
		err = proto.Unmarshal(txIDCreator, sId)
		if err != nil {
			return "", fmt.Errorf("Could not deserialize a SerializedIdentity, err %s", err)
		}

		bl, _ := pem.Decode(sId.IdBytes)
		if bl == nil {
			return shim.Error(fmt.Sprintf("Could not decode the PEM structure"))
		}
		cert, err := x509.ParseCertificate(bl.Bytes)
		if err != nil {
			return shim.Error(fmt.Sprintf("ParseCertificate failed %s", err))
		}

		fmt.Printf("Certificate of txID %s creator is %s", txID, cert)*/
	//}
	return string(buffer.Bytes()), nil
}

//Recursively retrieve the lineage of an item stored. Lineage is tracked by adding txID's to the
//'dependenceis' field of a record, delimited by :
//If dependencies are properly supplied on item creation, this function should be able to return
//the full lineage of an item in the form of the returned JSON structure.
//This function requires two arguments, a txID and a number indication the requested max depth
//of recursive queries.
func getdependencies(stub shim.ChaincodeStubInterface, args []string) (string, error) {

	// Get maximum recursive count
	count, err := strconv.Atoi(args[1])
	if err != nil {
		errorResp := "{\"Error\":\"Failed to retrieve recursive count}"
		return "", fmt.Errorf(errorResp)
	}

	// Start recursive call for dependency lineage
	retval, err := recursivedependencies(stub, args[0], count)
	if err != nil {
		errorResp := "{\"Error\":\"Failed to recursively get dependencies}: " + err.Error()
		return "", fmt.Errorf(errorResp)
	}

	// Create buffer and write result to it for valid JSON.
	var buffer bytes.Buffer
	buffer.WriteString("{")
	buffer.WriteString("\"Dependencies\": ")
	buffer.WriteString(retval)
	buffer.WriteString("}")

	return string(buffer.Bytes()), nil
}

// The recursive call used to retrieve dependencies in the 'getdependencies' function above.
func recursivedependencies(stub shim.ChaincodeStubInterface, txid string, count int) (string, error) {

	// If count reaches max, return the string "count 0" to indicate why no more results are returned.
	if count == 0 {
		return "count 0", nil
	}

	indexName := "txID~key"
	var valueJSON operation
	txID := txid

	//Retrireve key from partial composite key stored from the txID supplied.
	it, err := stub.GetStateByPartialCompositeKey(indexName, []string{txID})
	if err != nil {
		return "", fmt.Errorf(err.Error())
	}

	//Get state of first item returned by query. As txID is unique, this should always be a single item.
	keyTxIDRange, err := it.Next()
	if err != nil {
		return "", fmt.Errorf(err.Error() + ":-:" + txid)
	}

	//Parse composite to get key and value.
	//_, keyParts, _ := stub.SplitCompositeKey(keyTxIDRange.Key)
	//key := keyParts[1]
	txIDValue := keyTxIDRange.Value

	//Unpack value stored to JSON
	err = json.Unmarshal(txIDValue, &valueJSON)
	if err != nil {
		jsonResp := "{\"Error\":\"Failed to decode JSON of: " + txID + "\"}"
		return "", fmt.Errorf(jsonResp)
	}

	//Create buffer for the response of this call
	var buffer bytes.Buffer
	buffer.WriteString("[")

	//If this item has any dependencies of its own, do an additional recursive call
	if valueJSON.Dependencies != "" {

		//Split dependencies on : delimeter
		i := strings.Split(valueJSON.Dependencies, ":")

		//Do a call for all dependencies of this item to get full lineage
		for nr, element := range i {

			//For every dependency but first, delimit with ,
			if nr != 0 {
				buffer.WriteString(", ")
			}

			//Print item and its dependencies
			buffer.WriteString("{\"TxID\":")
			buffer.WriteString("\"")
			buffer.WriteString(element)
			buffer.WriteString("\", ")

			buffer.WriteString(" \"Depending\": ")
			//Recursive call to get dependencies of every dependency osv.
			retstring, reterror := recursivedependencies(stub, element, count-1)
			if reterror != nil {
				buffer.WriteString(reterror.Error())
			} else {
				buffer.WriteString(retstring)
			}
			buffer.WriteString("}")
		}
	}
	buffer.WriteString("]")

	//All dependencies of this item has been accounted for, returning result..
	return string(buffer.Bytes()), nil
}

// Gets the full history of a key, The historic values are coupled with the timestamp of change.
// This as opposed to dependencies/lineage, will only return the history of values on the same key.
// This function includes a timestamp, the new changed value and all other data included in the record.
func getkeyhistory(stub shim.ChaincodeStubInterface, arg string) (string, error) {
	var valueJSON operation

	//Check number of arguments
	if arg == "" {
		return "", fmt.Errorf("Incorrect arguments. Expecting a txid")
	}

	//Call built in chaincode operator from shim to retrieve all values for this key
	iterator, err := stub.GetHistoryForKey(arg)
	if err != nil {
		return "", fmt.Errorf("Failed to get asset: %s with error: %s", arg, err)
	}
	if iterator == nil {
		return "", fmt.Errorf("Asset not found: %s", arg)
	}
	defer iterator.Close()

	// buffer is a JSON array containing historic values
	var buffer bytes.Buffer
	buffer.WriteString("[")
	bArrayMemberAlreadyWritten := false

	//Iterate all historic values for this key and print their data to result buffer.
	for iterator.HasNext() {
		response, err := iterator.Next()
		if err != nil {
			return "", fmt.Errorf(err.Error())
		}

		// Add a comma before array members, suppress it for the first array member
		if bArrayMemberAlreadyWritten == true {
			buffer.WriteString(",")
		}

		//Unpack JSON
		err = json.Unmarshal(response.Value, &valueJSON)
		if err != nil {
			jsonResp := "{\"Error\":\"Failed to decode JSON of: " + arg + "\"}"
			return "", fmt.Errorf(jsonResp)
		}

		//Write all fields in the desired return format for getkeyhistory
		buffer.WriteString("{\"Type\":")
		buffer.WriteString("\"")
		buffer.WriteString(valueJSON.Type)
		buffer.WriteString("\"")

		buffer.WriteString(", \"Hash\":")
		buffer.WriteString("\"")
		buffer.WriteString(valueJSON.Hash)
		buffer.WriteString("\"")

		buffer.WriteString(", \"Location\":")
		buffer.WriteString("\"")
		buffer.WriteString(valueJSON.Location)
		buffer.WriteString("\"")

		buffer.WriteString(", \"Pointer\":")
		buffer.WriteString("\"")
		buffer.WriteString(valueJSON.Pointer)
		buffer.WriteString("\"")

		buffer.WriteString(", \"Description\":")
		buffer.WriteString("\"")
		buffer.WriteString(valueJSON.Description)
		buffer.WriteString("\"")

		buffer.WriteString(", \"Timestamp\":")
		buffer.WriteString("\"")
		buffer.WriteString(time.Unix(response.Timestamp.Seconds, int64(response.Timestamp.Nanos)).String())
		buffer.WriteString("\"")

		buffer.WriteString(", \"Certificate\":")
		buffer.WriteString("\"")
		buffer.WriteString(valueJSON.Certificate)
		buffer.WriteString("\"")

		buffer.WriteString(", \"Dependencies\":")
		buffer.WriteString("\"")
		buffer.WriteString(valueJSON.Dependencies)
		buffer.WriteString("\"")

		buffer.WriteString("}")
		bArrayMemberAlreadyWritten = true
	}
	buffer.WriteString("]")

	return string(buffer.Bytes()), nil
}

// Gets the KV-pairs within a range of keys. The range specified is not specified on the range of
// strings but rather the value of theese strings. This means that searching for keys between eg.
// key123 and key133352 might not returnt only those named key between key123 and key133352.
func getbyrange(stub shim.ChaincodeStubInterface, args []string) (string, error) {
	var valueJSON operation

	//Check number of arguments
	if len(args) != 2 {
		return "", fmt.Errorf("Incorrect arguments. Expecting a start-key and end-key")
	}

	//Use built in shim operator, getstatebyrange to retrieve all records within startkey - endkey.
	value, err := stub.GetStateByRange(args[0], args[1])
	if err != nil {
		return "", fmt.Errorf("Failed to get asset: %s with error: %s", args[0], err)
	}
	if value == nil {
		return "", fmt.Errorf("No assset found: %s", args[0])
	}
	defer value.Close()

	// buffer is a JSON array containing values
	var buffer bytes.Buffer
	buffer.WriteString("[")
	bArrayMemberAlreadyWritten := false

	//Iterate all values for this key range and print their data to result buffer.
	for value.HasNext() {
		response, err := value.Next()
		if err != nil {
			return "", fmt.Errorf(err.Error())
		}
		// Add a comma before array members, suppress it for the first array member
		if bArrayMemberAlreadyWritten == true {
			buffer.WriteString(",")
		}

		// Unpack JSON
		err = json.Unmarshal(response.Value, &valueJSON)
		if err != nil {
			jsonResp := "{\"Error\":\"Failed to decode JSON of: " + args[0] + "\"}"
			return "", fmt.Errorf(jsonResp)
		}

		//Write all fields in the desired return format for getbyrange
		buffer.WriteString("{\"Key\":")
		buffer.WriteString("\"")
		buffer.WriteString(response.Key)
		buffer.WriteString("\"")

		buffer.WriteString("\"Hash\":")
		buffer.WriteString("\"")
		buffer.WriteString(valueJSON.Hash)
		buffer.WriteString("\"")

		buffer.WriteString("\"Location\":")
		buffer.WriteString("\"")
		buffer.WriteString(valueJSON.Location)
		buffer.WriteString("\"")

		buffer.WriteString("\"Pointer\":")
		buffer.WriteString("\"")
		buffer.WriteString(valueJSON.Pointer)
		buffer.WriteString("\"")

		buffer.WriteString("{\"Description\":")
		buffer.WriteString("\"")
		buffer.WriteString(valueJSON.Description)
		buffer.WriteString("\"")

		// buffer.WriteString(", \"Timestamp\":")
		// buffer.WriteString("\"")
		// buffer.WriteString(time.Unix(response.Timestamp.Seconds, int64(response.Timestamp.Nanos)).String())
		// buffer.WriteString("\"")

		// buffer.WriteString(", \"Certificate\":")
		// buffer.WriteString("\"")
		// buffer.WriteString(strconv.FormatBool(response.Certificate))
		// buffer.WriteString("\"")

		buffer.WriteString("}")
		bArrayMemberAlreadyWritten = true
	}
	buffer.WriteString("]")

	return string(buffer.Bytes()), nil
}

/*
// Returns the TXid of the current version of the key, along with checksum
func getWithID(stub shim.ChaincodeStubInterface, arg string) (string, error) {
	var valueJSON operation

	// If no key is specified, return error
	if arg == "" {
		return "", fmt.Errorf("Incorrect arguments. Expecting a txid")
	}

	value, err := stub.GetState(arg)
	if err != nil {
		return "", fmt.Errorf("Failed to get asset: %s with error: %s", arg, err)
	}
	if value == nil {
		return "", fmt.Errorf("Asset not found: %s", arg)
	}

	err = json.Unmarshal([]byte(value), &valueJSON)
	if err != nil {
		jsonResp := "{\"Error\":\"Failed to decode JSON of: " + arg + "\"}"
		return "", fmt.Errorf(jsonResp)
	}

	return string(valueJSON.TxID) + " |-|-| " + string(valueJSON.Hash), nil
}*/

func main() {
	err := shim.Start(new(SimpleAsset))
	if err != nil {
		fmt.Printf("Error starting Simple chaincode: %s", err)
	}
}
