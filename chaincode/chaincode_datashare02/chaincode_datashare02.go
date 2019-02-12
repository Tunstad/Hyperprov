package main

import (
	"fmt"
	"encoding/json"
	"bytes"
	"time"

	"github.com/hyperledger/fabric/core/chaincode/shim"
	"github.com/hyperledger/fabric/core/chaincode/shim/ext/cid"
	"github.com/hyperledger/fabric/core/chaincode/lib/cid"
	pb "github.com/hyperledger/fabric/protos/peer"
	
)
//"github.com/hyperledger/fabric/core/chaincode/shim/ext/cid"

type SimpleAsset struct {
}

type operation struct {
	Hash string `json:"hash"` 
	Certificate       string `json:"cert"`    
	Type      string `json:"type"`
	Numreads       int    `json:"reads"`
	Description      string `json:"desc"`
	ID string `json:"id"` 
	MSPID string `json:"mspid"` 
	IDAttr string `json:"idattr"` 
}
func (t *SimpleAsset) Init(stub shim.ChaincodeStubInterface) pb.Response {

	// Get the args from the transaction proposal
	args := stub.GetStringArgs()
	if len(args) != 2 {
		return shim.Error("Incorrect arguments. Expecting a key and a value")
	}

	// Set up any variables or assets here by calling stub.PutState()
	operation := &operation{args[1], "null", "Create", 0, "Init operation", "", "", ""}
	operationJSONasBytes, err := json.Marshal(operation)
	if err != nil {
		return shim.Error(fmt.Sprintf("Failed to marshal JSON: %s", string(operationJSONasBytes)))
	}
		

	// We store the creator data, key and the value on the ledger
	err = stub.PutState(args[0], operationJSONasBytes)
	if err != nil {
		return shim.Error(fmt.Sprintf("Failed to create asset: %s", args[0]))
	}
	return shim.Success(nil)
}

func (t *SimpleAsset) Invoke(stub shim.ChaincodeStubInterface) pb.Response {
	// Extract the function and args from the transaction proposal
	fn, args := stub.GetFunctionAndParameters()

	var result string
	var err error
	//Switch on functionality specified in the transaction.
	if fn == "set" {
		result, err = set(stub, args)
	} else if fn == "get" {
		result, err = get(stub, args)
	} else if fn == "getkeyhistory" {
		result, err = getkeyhistory(stub, args)
	} else if fn == "getbyrange" {
		result, err = getbyrange(stub, args)
	}
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
	if len(args) != 2 {
		return "", fmt.Errorf("Incorrect arguments. Expecting a key and a value")
	}

	// Potential code for additional identity functionality added in HLF v1.1
	//id, err := cid.GetID(stub)
	// if err != nil {
	// 	return "", fmt.Errorf("Failed to get id for asset: %s", args[0])
	// }
	// fmt.Println(id)
	// mspid, err := cid.GetMSPID(stub)
	// if err != nil {
	// 	return "", fmt.Errorf("Failed to get mspid for asset: %s", args[0])
	// }
	// fmt.Println(mspid)
	// val, ok, err := cid.GetAttributeValue(stub, "name")
	// if err != nil {
	// 	return "", fmt.Errorf("Failed to get attribute name for asset: %s", args[0])
	// 	// There was an error trying to retrieve the attribute
	// }
	// if !ok {
	// 	return "", fmt.Errorf("Identity does not posess the attribute name: %s", args[0])
	// 	// The client identity does not possess the attribute
	// }
	// Do something with the value of 'val'

	id, err := cid.GetID(stub)
	if err != nil {
		return "", fmt.Errorf("Failed to get ID. %s", string(args[0]))
	}
	/*
	mspid, err := cid.GetMSPID(stub)
	if err != nil {
		return "", fmt.Errorf("Failed to get MSPID. %s", string(args[0]))
	}

	attr, ok, err := cid.GetAttributeValue(stub, "attr1")
	if err != nil {
		return "", fmt.Errorf("Failed to get attribute. %s", string(args[0]))
	// There was an error trying to retrieve the attribute
	}
	if !ok {
		fmt.Printf("The client does not posess an attribute")
	// The client identity does not possess the attribute
	}else{

	}
	// Do something with the value of 'val'
	*/

	usercert, cerr := stub.GetCreator()
	if cerr != nil {
		return "", fmt.Errorf("Failed to get creator of asset: %s", args[0])
	}

	// Set up any variables or assets here by calling stub.PutState()
	operation := &operation{args[1], string(usercert), "Modify", 0, "", id, "mspid", "attr"}
	operationJSONasBytes, err := json.Marshal(operation)
	if err != nil {
		return "", fmt.Errorf("Failed to marshal JSON. %s", string(args[0]))
	}
		

	err = stub.PutState(args[0], operationJSONasBytes)
	if err != nil {
		return "", fmt.Errorf("Failed to set asset: %s", args[0])
	}
	return args[1], nil
}

// Get returns the current value of the specified asset key.
func get(stub shim.ChaincodeStubInterface, args []string) (string, error) {
	var valueJSON operation
	if len(args) != 1 {
		return "", fmt.Errorf("Incorrect arguments. Expecting a key")
	}

	value, err := stub.GetState(args[0])
	if err != nil {
		return "", fmt.Errorf("Failed to get asset: %s with error: %s", args[0], err)
	}
	if value == nil {
		return "", fmt.Errorf("Asset not found: %s", args[0])
	}

	err = json.Unmarshal([]byte(value), &valueJSON)
	if err != nil {
		jsonResp := "{\"Error\":\"Failed to decode JSON of: " + args[0] + "\"}"
		return "", fmt.Errorf(jsonResp)
	}

	/*
	var retval string
	if strings.Contains(string(value), "----BEGIN -----") {
		valueSlice := strings.Split(string(value), "-----END -----")
		retval = strings.TrimLeft(valueSlice[1], "\n")
	} else if strings.Contains(string(value), "----BEGIN CERTIFICATE-----") {
		valueSlice := strings.Split(string(value), "-----END CERTIFICATE-----")
		retval = strings.TrimLeft(valueSlice[1], "\n")
	} else {
		retval = string(value)
	}*/

	return string(valueJSON.Hash), nil
}

// Gets the full history of a key, The historic values are coupled with the timestamp of change.
// This function includes a timestamp, the new changed value and the certficiates used to perform the change.
// The certificates used are stored unencrypted in the value variable but are only acccessable trough this function.
// This is a potential security issue and may later require this function to be role-gated, certificates to be encrypted or used for encrypting a shared variable as proof.
// Example format of returned value is [ timestamp: 12341251234: value: firstvalue certificate: A4FC32XyCdfEa... , timestamp: 12341251239: value: secondvalue certificate: B4fVyC32XyCdfEa... ]
func getkeyhistory(stub shim.ChaincodeStubInterface, args []string) (string, error) {
	var valueJSON operation
	if len(args) != 1 {
		return "", fmt.Errorf("Incorrect arguments. Expecting a key")
	}

	iterator, err := stub.GetHistoryForKey(args[0])
	if err != nil {
		return "", fmt.Errorf("Failed to get asset: %s with error: %s", args[0], err)
	}
	if iterator == nil {
		return "", fmt.Errorf("Asset not found: %s", args[0])
	}
	defer iterator.Close()

	// buffer is a JSON array containing historic values
	var buffer bytes.Buffer
	buffer.WriteString("[")

	bArrayMemberAlreadyWritten := false
	for iterator.HasNext() {
		response, err := iterator.Next()
		if err != nil {
			return "", fmt.Errorf(err.Error())
		}
		// Add a comma before array members, suppress it for the first array member
		if bArrayMemberAlreadyWritten == true {
			buffer.WriteString(",")
		}

		err = json.Unmarshal(response.Value, &valueJSON)
		if err != nil {
			jsonResp := "{\"Error\":\"Failed to decode JSON of: " + args[0] + "\"}"
			return "", fmt.Errorf(jsonResp)
		}

		buffer.WriteString("{\"Type\":")
		buffer.WriteString("\"")
		buffer.WriteString(valueJSON.Type)
		buffer.WriteString("\"")

		buffer.WriteString("{\"Hash\":")
		buffer.WriteString("\"")
		buffer.WriteString(valueJSON.Hash)
		buffer.WriteString("\"")

		buffer.WriteString("{\"Description\":")
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

		buffer.WriteString(", \"ID\":")
		buffer.WriteString("\"")
		buffer.WriteString(valueJSON.ID)
		buffer.WriteString("\"")

		buffer.WriteString(", \"MSPID\":")
		buffer.WriteString("\"")
		buffer.WriteString(valueJSON.MSPID)
		buffer.WriteString("\"")

		buffer.WriteString(", \"Attribute\":")
		buffer.WriteString("\"")
		buffer.WriteString(valueJSON.IDAttr)
		buffer.WriteString("\"")

		buffer.WriteString("}")
		bArrayMemberAlreadyWritten = true
	}
	buffer.WriteString("]")

	fmt.Printf("- getHistoryForKey returning:\n%s\n", buffer.String())

	return string(buffer.Bytes()), nil

	/*
	var retval string
	var certificate string
	result := "["
	for value.HasNext() {
		kvpair, _ := value.Next()
		if strings.Contains(string(kvpair.Value), "----BEGIN -----") {
			valueSlice := strings.Split(string(kvpair.Value), "-----END -----")
			retval = strings.TrimLeft(valueSlice[1], "\n")
			firstcertSlice := strings.Split(string(kvpair.Value), "----BEGIN -----")
			finalCertSlice := strings.Split(string(firstcertSlice[1]), "-----END -----")
			certificate = finalCertSlice[0]
		} else if strings.Contains(string(kvpair.Value), "----BEGIN CERTIFICATE-----") {
			valueSlice := strings.Split(string(kvpair.Value), "-----END CERTIFICATE-----")
			retval = strings.TrimLeft(valueSlice[1], "\n")
			firstcertSlice := strings.Split(string(kvpair.Value), "----BEGIN CERTIFICATE-----")
			finalCertSlice := strings.Split(string(firstcertSlice[1]), "-----END CERTIFICATE-----")
			certificate = finalCertSlice[0]
		} else {
			retval = string(kvpair.Value)
			certificate = "null"
		}
		result = result + "timestamp: " + strconv.FormatInt(kvpair.Timestamp.GetSeconds(), 10) + " value: " + retval + " certificate: " + certificate
		if value.HasNext() {
			result = result + ", "
		}
	}
	return result + "]", nil*/
	//return , nil
}

// Gets the KV-pairs within a range of keys. The range specified is not specified on the range of
// strings but rather the value of theese strings. This means that searching for keys between eg.
// key123 and key133352 might not returnt only those named key between key123 and key133352.
func getbyrange(stub shim.ChaincodeStubInterface, args []string) (string, error) {
	var valueJSON operation
	if len(args) != 2 {
		return "", fmt.Errorf("Incorrect arguments. Expecting a start-key and end-key")
	}

	value, err := stub.GetStateByRange(args[0], args[1])
	if err != nil {
		return "", fmt.Errorf("Failed to get asset: %s with error: %s", args[0], err)
	}
	if value == nil {
		return "", fmt.Errorf("No assset found: %s", args[0])
	}
	defer value.Close()

	// buffer is a JSON array containing historic values
	var buffer bytes.Buffer
	buffer.WriteString("[")

	bArrayMemberAlreadyWritten := false
	for value.HasNext() {
		response, err := value.Next()
		if err != nil {
			return "", fmt.Errorf(err.Error())
		}
		// Add a comma before array members, suppress it for the first array member
		if bArrayMemberAlreadyWritten == true {
			buffer.WriteString(",")
		}
		// buffer.WriteString("{\"Type\":")
		// buffer.WriteString("\"")
		// buffer.WriteString(response.Type)
		// buffer.WriteString("\"")

		err = json.Unmarshal(response.Value, &valueJSON)
		if err != nil {
			jsonResp := "{\"Error\":\"Failed to decode JSON of: " + args[0] + "\"}"
			return "", fmt.Errorf(jsonResp)
		}

		buffer.WriteString("{\"Key\":")
		buffer.WriteString("\"")
		buffer.WriteString(response.Key)
		buffer.WriteString("\"")

		buffer.WriteString("\"Hash\":")
		buffer.WriteString("\"")
		buffer.WriteString(valueJSON.Hash)
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

	fmt.Printf("- getKeysInRange returning:\n%s\n", buffer.String())

	return string(buffer.Bytes()), nil
/*
	result := "["
	var retval string
	for value.HasNext() {
		kvpair, _ := value.Next()
		if strings.Contains(string(kvpair.Value), "----BEGIN -----") {
			valueSlice := strings.Split(string(kvpair.Value), "-----END -----")
			retval = strings.TrimLeft(valueSlice[1], "\n")
		} else if strings.Contains(string(kvpair.Value), "----BEGIN CERTIFICATE-----") {
			valueSlice := strings.Split(string(kvpair.Value), "-----END CERTIFICATE-----")
			retval = strings.TrimLeft(valueSlice[1], "\n")
		} else {
			retval = string(kvpair.Value)
		}
		result = result + string(kvpair.Key) + ": " + retval
		if value.HasNext() {
			result = result + ", "
		}
	}
	return result + "]", nil*/
}

func main() {
	err := shim.Start(new(SimpleAsset))
	if err != nil {
		fmt.Printf("Error starting Simple chaincode: %s", err)
	}
}
