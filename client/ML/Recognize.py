from imageai.Prediction.Custom import CustomImagePrediction
import os
import sys

if (len(sys.argv) < 2):
    print ("Missing argument: Need to input a file to recognize")
    exit()

execution_path = os.getcwd()

prediction = CustomImagePrediction()
prediction.setModelTypeAsResNet()
prediction.setModelPath("idenprof/models/model_ex-001_acc-0.162000.h5")
prediction.setJsonPath("idenprof/json/model_class.json")
prediction.loadModel(num_objects=10)

predictions, probabilities = prediction.predictImage(sys.argv[1], result_count=3)

for eachPrediction, eachProbability in zip(predictions, probabilities):
    print(eachPrediction , " : " , eachProbability)