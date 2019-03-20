import matplotlib.pyplot as plt
##import matplotlib.ticker as ticker
from matplotlib import rcParams
import numpy as np
import json
f = open('measurement.json', 'r')
data = f.read()
print(data)

myjson = json.loads(data)
print (myjson)
print(type(myjson))
print(type(myjson["x"]))
##myarray = np.asarray(myjson["x"])
##print(myarray)

x = []
for xval in myjson["x"]:
    print(xval)
    x.append(float(xval))
y = []
for yval in myjson["y"]:
    print(xval)
    y.append(float(yval))
sd = []
for sdval in myjson["sd"]:
    print(sdval)
    sd.append(float(sdval))


rcParams.update({'figure.autolayout': True})
print("asdf")
plt.style.use('fivethirtyeight')
fig, ax = plt.subplots()
plt.xticks(y)
ax.grid()
ax.errorbar(y, x) #, yerr=sd
plt.xlabel("Size [$ 5 * 10^{x}]$")
plt.ylabel("T/min")

##ax.xaxis.set_major_formatter(ticker.FuncFormatter())
plt.show()
 
#plt.subplot("212")
#plt.plot(x, x.map(Math.sin).map((t, i) => t * i), 'color=b', 'label=x * sin(x)', 'marker=o', 'linestyle=None')
#plt.legend()
#plt.ylim(-100, 100)
 
plt.show()
#plt.savefig('plot.png')

#plt.plot(myjson["x"])
#plt.ylabel('some numbers')
#plt.show()
#plt.savefig('plot.png')