package main

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/hyperledger/fabric/core/chaincode/shim"
	pb "github.com/hyperledger/fabric/protos/peer"
)

type SimpleAsset struct {
}

func (t *SimpleAsset) Init(stub shim.ChaincodeStubInterface) pb.Response {

	// Get the args from the transaction proposal
	args := stub.GetStringArgs()
	if len(args) != 2 {
		return shim.Error("Incorrect arguments. Expecting a key and a value")
	}

	// Set up any variables or assets here by calling stub.PutState()

	// We store the creator data, key and the value on the ledger
	err := stub.PutState(args[0], []byte(args[1])...)
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
func set(stub shim.ChaincodeStubInterface, args []string) (string, error) {
	if len(args) != 2 {
		return "", fmt.Errorf("Incorrect arguments. Expecting a key and a value")
	}

	// id, err := cid.GetID(stub)
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

	val, cerr := stub.GetCreator()
	if cerr != nil {
		return "", fmt.Errorf("Failed to get creator of asset: %s", args[0])
	}

	err := stub.PutState(args[0], append([]byte(val), []byte(args[1])...))
	if err != nil {
		return "", fmt.Errorf("Failed to set asset: %s", args[0])
	}
	return args[1], nil
}

// Get returns the current value of the specified asset key.
func get(stub shim.ChaincodeStubInterface, args []string) (string, error) {
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
	var retval string
	if strings.Contains(value, "-----BEGIN CERTIFICATE-----") {
		valueSlice := strings.Split(string(value), "-----END CERTIFICATE-----")
		retval = strings.TrimLeft(valueSlice[1], "\n")
	} else {
		retval = string(value)
	}

	return retval, nil
}

// Gets the full history of a key, The historic values are coupled with the timestamp of change.
// TODO: This function should evertually include a point for each historic value of which client
// or the credentials used to make the change.
// Example format of returned value is [ 12341251234: firstvalue, 12341235235: secondvalue]
func getkeyhistory(stub shim.ChaincodeStubInterface, args []string) (string, error) {
	if len(args) != 1 {
		return "", fmt.Errorf("Incorrect arguments. Expecting a key")
	}

	value, err := stub.GetHistoryForKey(args[0])
	if err != nil {
		return "", fmt.Errorf("Failed to get asset: %s with error: %s", args[0], err)
	}
	if value == nil {
		return "", fmt.Errorf("Asset not found: %s", args[0])
	}

	var retval string
	var certificate string
	result := "["
	for value.HasNext() {
		kvpair, _ := value.Next()
		if strings.Contains(string(kvpair.Value), "-----BEGIN CERTIFICATE-----") {
			valueSlice := strings.Split(string(kvpair.Value), "-----END CERTIFICATE-----")
			retval = strings.TrimLeft(valueSlice[1], "\n")
			firstcertSlice := strings.Split(string(kvpair.Value), "-----BEGIN CERTIFICATE-----")
			finalCertSlice := strings.Split(string(firstcertSlice[1]), "-----END CERTIFICATE-----")
			certificate = finalCertSlice[0]
		} else {
			retval = string(kvpair.Value)
			certificate = "null"
		}
		result = result + strconv.FormatInt(kvpair.Timestamp.GetSeconds(), 10) + ": " + retval + " certificate: " + certificate
		if value.HasNext() {
			result = result + ", "
		}
	}
	return result + "]", nil
}

// Gets the KV-pairs within a range of keys. The range specified is not specified on the range of
// strings but rather the value of theese strings. This means that searching for keys between eg.
// key123 and key133352 might not returnt only those named key between key123 and key133352.
func getbyrange(stub shim.ChaincodeStubInterface, args []string) (string, error) {
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

	result := "["
	var retval string
	for value.HasNext() {
		kvpair, _ := value.Next()
		if strings.Contains(string(kvpair.Value), "-----BEGIN CERTIFICATE-----") {
			valueSlice := strings.Split(string(kvpair.Value), "-----END CERTIFICATE-----")
			retval := strings.TrimLeft(valueSlice[1], "\n")
		} else {
			retval := string(kvpair.Value)
		}
		result = result + string(kvpair.Key) + ": " + retval
		if value.HasNext() {
			result = result + ", "
		}
	}
	return result + "]", nil
}

func main() {
	err := shim.Start(new(SimpleAsset))
	if err != nil {
		fmt.Printf("Error starting Simple chaincode: %s", err)
	}
}
