# How to run the training example for making image recognition models used in the Hyperprov example
This is a simple guide how to create the model files used in the Hyperprov Machine learning case study example.
Thanks to Moses Olafenwa for his easy to use library [ImageAI](https://github.com/OlafenwaMoses/ImageAI).

### Install required dependencies

`sudo apt-get install python3 python3-pip` to install python3 and pip3 if not already present on your system.

`sudo pip install tensorflow` to install tensorflow for CPU or if you have a Nvidia GPU you can `sudo pip install tensorflow-gpu` for greatly accelerated training. Keep in mind that tensorflow-gpu has some dependencies such as CUDA-toolkit and cuDNN SDK, see [this page](https://www.tensorflow.org/install/gpu) for instructions on that.

`sudo pip3 install numpy scipy opencv-python pillow matplotlib h5py keras https://github.com/OlafenwaMoses/ImageAI/releases/download/2.0.2/imageai-2.0.2-py3-none-any.whl` to install additional required python libraries. 

#### Download dataset
The dataset is available from the repository [Identprof](https://github.com/OlafenwaMoses/IdenProf) and can be downloaded with `wget https://github.com/OlafenwaMoses/IdenProf/releases/download/v1.0/idenprof-jpg.zip`.
Next extract the dataset in the current folder `unzip idenprof-jpg.zip`.

### Training Models
To train models simly run `python TrainModels.py` and your models will be put into the folder idenprof/models after every epoch. To change the number of models to train you can edit the field `num_experiments`.

If you run out of memory running the training, especially on older GPU's try decreasing the `batch_size` down from 32. For an older laptop GPU i had to go as low as 2 for it to succesfully run without errors. Decreasing the batch_size however will significantly reduce the speed of the training.

### Using the models for recognition
First you will most likely need to change the variable prediction.setModelPath to one of your modelnames in idenprof/models. If you decided training takes too long and just want to test the recognition you can download [this model](https://github.com/OlafenwaMoses/IdenProf/releases/download/v1.0/idenprof_061-0.7933.h5) which is pre-trained and has pretty good accuracy.

To run the recognition you do `python Recognize.py image.jpg` to recognize what image.jpg is of. Keep in mind that it will only classify based on the 10 classes in indenprof/json/model_class.json.
