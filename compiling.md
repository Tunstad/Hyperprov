# Compiling Hyperledger Fabric v.1.4 for Raspberry Pi on ARM64

The base operating system used to compile the images is Debian "buster" aarch64 64-bit operating system, this is only supported on Raspberry3. The source image used can be downloaded from the official Debian page on [RPI3](https://wiki.debian.org/RaspberryPi3). The kernel used during the initial builds were *4.18.0-3-arm64*.

## Dependencies
The dependenices for building are similar to those required to run the system and guides for installing on Rasbperry Pi can be found in the Quick Install section of the [Readme](https://github.com/Tunstad/hyperledger-pi-composer/blob/rpi/README.md). Your will need docker, docker-compose and Golang should be version 1.11.1 for Fabric v1.4. To compile the javaenv repository you will also need to install Gradle.
```
sudo apt-get install git curl gcc libc6-dev libltdl3-dev python-setuptools -y
```

Set Gopath ```export GOPATH=~/golang``` and make link as some of the files use another path ```ln -s ~/golang ~/go```.

Then you can start downloading repositories to ~/golang/src/github.com/hyperledger/
```
git clone https://github.com/hyperledger/fabric-baseimage
```
```
git clone https://github.com/hyperledger/fabric
```
```
git clone https://github.com/hyperledger/fabric-chaincode-java
```

## Building Baseimages
Before you can build baseimages you need to add the line ```DOCKER_BASE_arm64=aarch64/ubuntu:xenial``` to the Makefile. Then you can make with ```make -f Makefile``` or `make docker` to build baseimage, basejvm and baseos images. To build third party images like kafka, zookeeper and couchdb you can run ```make dependent-images```.
##### CouchDB error
CouchDB may return an error when built, the solution is to edit the file fabric-baseimage/images/couchdb/Dockerfile.in to find the line `&& ./configure --disable-docs \` and add the following lines after it 

```
&& chmod +w bin/rebar \
&& mv bin/rebar bin/rebar-orig \
&& cd bin \
&& curl -fSL https://github.com/rebar/rebar/wiki/rebar --output rebar \
&& chmod +x rebar \
&& cd .. \
``` 
[Thanks to Sasha Pesic and YR Sang for solving this.](https://jira.hyperledger.org/browse/FAB-11912)


## Building Fabric Images
For the resulting images such as peer, orderer, tools and ccenv we need to go to the fabric folder cloned with `git clone https://github.com/hyperledger/fabric`. Here we need to make a few modifications as pointed out in [this thread](https://stackoverflow.com/questions/45800167/hyperledger-fabric-on-raspberry-pi-3). The main changes are in the core.yaml files, in HLFv1.4 there exist two versions of this, you can find them using ```find . -name core.yaml```. I elected to edit both, altough it might not be neccecsary. The patch code is 

	     # Gossip related configuration
	     gossip:
	-        bootstrap: 127.0.0.1:7051
	         # Use automatically chosen peer (high avalibility) to distribute blocks in channel or static one
	         # Setting this true and orgLeader true cause panic exit
	         useLeaderElection: false
	@@ -280,7 +279,7 @@ vm:
	                 Config:
	                     max-size: "50m"
	                     max-file: "5"
	-            Memory: 2147483648
	+            Memory: 16777216

The other modification mentioned in dockerutil.go is not present in HLFv1.4 so it might not be required any more.
Further if the variable BASEIMAGE_RELEASE in Makefile does not match the baseimage built in the above step, change it accordingly.
Now to build you can run `make docker` to hopefully compile all images, or build them individually with `make peer peer-docker` `make orderer orderer-docker` `make tools-docker` `make buildenv` `make ccenv`.

### Bulding binary executables
Now we will build the binary executables like peer, orderer, configtxgen, cryptogen and more. Move to the fabric folder and run `make native`. The images will appear in .build/bin and can then be copied to the /bin folder of your Hyperledger Fabric project repository.

### Building Javaenv
The image 'fabric-javaenv' is required to run java chaincode in Hyperledger Fabric. It was in version 1.1 separated from the other fabric build projects into a separate project which can be cloned with `git clone https://github.com/hyperledger/fabric-chaincode-java`. You may have to install Gradle locally aswell with `apt-get install gradle`. 
I have not yet had success with building this image on the arm64 architecture, but i believe the suggested way to build it is to do the following:

```
cd fabric-chaincode-docker &&
mkdir build &&
mkdir build/dependencies &&
cp ./{start, build.gradle, build.sh} build/dependencies &&
docker build . --no-cache
```
An error occurs later with the packages `com.google.protobuf` and `protoc-gen-grpc-java` not beeing available for arm64/aarch64. The former can potentially be changed to another version that actually is available, 3.5.1 i think, in the file fabric-chaincode-protos/build.gradle. The latter i believe may need to be compiled manually from the repositories [https://github.com/grpc/grpc-java](https://github.com/grpc/grpc-java) and [https://github.com/protocolbuffers/protobuf](https://github.com/protocolbuffers/protobuf) to create `protoc-gen-grpc-java-linux-aarch_64.exe (io.grpc:protoc-gen-grpc-java:1.9.0)`, but several errors occured in my instance during the gradle build processes to which point this have been put on hold. As my project does not deploy any chaincode in java, only in golang, this image may not be worth the trouble of building for the time being. 
#### (Update 24.04.19) Javaenv guide
Thanks to [AbelPelser](https://github.com/AbelPelser) for writing these steps! The prebuilt image can be downloaded with `docker pull apelser/fabric-javaenv:arm64-1.4.1`.

Install dependencies:
- [ ] `sudo apt-get install autoconf automake libtool curl make g++ unzip maven ninja-build cmake perl libssl-dev libapr1-dev tar git openjdk-8-jdk -y`
Compile netty-tcnative:
- [ ] `git clone https://github.com/netty/netty-tcnative.git`
- [ ] `cd netty-tcnative`
- [ ] `git checkout netty-tcnative-parent-2.0.7.Final`
Apply [this patch](https://github.com/Tunstad/Hyperprov/files/3107297/netty-tcnative-fixes.patch.txt) (remove the .txt at the end)
- [ ] `git apply netty-tcnative-fixes.patch`
The CXFLAGS are only necessary certain versions of GCC
- [ ] `CXFLAGS="Wno-error=misleading-indentation" mvn clean install`
The jar we need is now at /path/to/netty-tcnative/boringssl-static/target/netty-tcnative-boringssl-static-2.0.7.Final-linux-aarch_64.jar

Compile protobuf:
- [ ] `git clone https://github.com/protocolbuffers/protobuf.git`
- [ ] `cd protobuf`
- [ ] `git checkout v3.0.0`
- [ ] `git submodule update --init --recursive`
Modify autogen.sh, change:
    `curl $curlopts -O https://googlemock.googlecode.com/files/gmock-1.7.0.zip`
    into:
    `curl $curlopts -O https://src.fedoraproject.org/repo/pkgs/gmock/gmock-1.7.0.zip/073b984d8798ea1594f5e44d85b20d66/gmock-1.7.0.zip`
- [ ] `./autogen.sh`
- [ ] `./configure --disable-shared`
On a Pi, ensure your memory/swap file is large enough before proceeding
- [ ] `make`
Recommended, but very (!) time-consuming on a Raspberry Pi 3B+ :
- [ ] `make check`
- [ ] `sudo make install`
Compile protoc-gen-grpc-java:
- [ ] `git clone https://github.com/grpc/grpc-java.git`
- [ ] `cd grpc-java`
- [ ] `git checkout v1.9.0`
- [ ] `cd compiler`
- [ ] `../gradlew java_pluginExecutable`
The executable can now be found under /path/to/grpc-java/compiler/build/exe/java_plugin/protoc-gen-grpc-java
Finally, to compile the docker image itself:
- [ ] `git clone https://github.com/hyperledger/fabric-chaincode-java.git`
- [ ] `cd fabric-chaincode-java`
- [ ] `git checkout v1.4.1`
Apply [this patch](https://github.com/Tunstad/Hyperprov/files/3111188/fabric-chaincode-java-fixes.patch.txt) (remove the .txt at the end)
- [ ] `git apply fabric-chaincode-java-fixes.patch`
Copy the aforementioned jar and `protoc-gen-grpc-java` to fabric-chaincode-java/fabric-chaincode-docker
- [ ] `cd fabric-chaincode-docker`
- [ ] `mkdir -p build/distributions/chaincode-java/shim-src`
- [ ] `mkdir -p build/distributions/chaincode-java/example-src/`
This `libs` directory is only used to store our jar and protoc-gen-grpc-java plugin
- [ ] `mkdir -p build/distributions/chaincode-java/libs/`
- [ ] `cp build.gradle build/distributions/chaincode-java/`
- [ ] `cp build.sh build/distributions/chaincode-java/`
- [ ] `cp start build/distributions/chaincode-java/`
- [ ] `cp protoc-gen-grpc-java build/distributions/chaincode-java/libs/`
- [ ] `cp netty-tcnative-boringssl-static-2.0.7.Final-linux-aarch_64.jar build/distributions/chaincode-java/libs/`
- [ ] `cp ../build.gradle build/distributions/chaincode-java/shim-src/`
- [ ] `cp ../settings.gradle build/distributions/chaincode-java/shim-src/`
- [ ] `cp ../gradlew build/distributions/chaincode-java/shim-src/`
- [ ] `cp ../gradlew.bat build/distributions/chaincode-java/shim-src/`
- [ ] `cp -r ../gradle build/distributions/chaincode-java/shim-src/`
- [ ] `cp -r ../fabric-chaincode-shim build/distributions/chaincode-java/shim-src/`
- [ ] `cp -r ../fabric-chaincode-protos build/distributions/chaincode-java/shim-src/`
- [ ] `cp ../build.gradle build/distributions/chaincode-java/example-src/`
- [ ] `cp ../settings.gradle build/distributions/chaincode-java/example-src/`
- [ ] `cp ../gradlew build/distributions/chaincode-java/example-src/`
- [ ] `cp ../gradlew.bat build/distributions/chaincode-java/example-src/`
- [ ] `cp -r ../gradle build/distributions/chaincode-java/example-src/`
- [ ] `cp -r ../fabric-chaincode-example-gradle build/distributions/chaincode-java/example-src/`
- [ ] `cp -r ../fabric-chaincode-example-maven build/distributions/chaincode-java/example-src/`
- [ ] `docker build . --no-cache`
The final output line of the docker build command will give you the identifier of the resulting docker image.
- [ ] `docker tag <identifier> hyperledger/fabric-javaenv:arm64-1.4.1`
