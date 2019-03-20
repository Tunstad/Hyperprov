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

tavg = []
for tval in myjson["tavg"]:
    print(tval)
    tavg.append(float(tval))
tsd = []
for tsdval in myjson["tsd"]:
    print(tsdval)
    tsd.append(float(tsdval))
tmin = []
for tmval in myjson["tmin"]:
    print(tmval)
    tmin.append(float(tmval))
respavg = []
for raval in myjson["respavg"]:
    print(raval)
    respavg.append(float(raval))
respsd = []
for rsdval in myjson["respsd"]:
    print(rsdval)
    respsd.append(float(rsdval))
fails = []
for fval in myjson["fails"]:
    print(fval)
    fails.append(float(fval))
tnum = []
for tnval in myjson["tnum"]:
    print(tnval)
    tnum.append(float(tnval))
tsize = []
for tsval in myjson["tsize"]:
    print(tsval)
    tsize.append(float(tsval))
samples = []
for sval in myjson["samples"]:
    print(sval)
    samples.append(float(sval))

rcParams.update({'figure.autolayout': True})
print("asdf")
plt.style.use('fivethirtyeight')

fig, (ax0, ax1) = plt.subplots(nrows=2, sharex=True)
ax0.errorbar(tsize, tavg, yerr=tsd, fmt='-o')
ax0.set_title('Total time to complete')

ax1.errorbar(tsize, tnum, fmt='o')
ax1.set_title('Data sizes measured with')
##ax1.set_xscale('log')

plt.show()
# fig, ax = plt.subplots()
# plt.xticks(tsize)
# ax.grid()
# ax.errorbar(tsize, tavg, yerr=tsd)
# plt.xlabel("Size [$ 5 * 10^{x}]$")
# plt.ylabel("T/min")

##ax.xaxis.set_major_formatter(ticker.FuncFormatter())

 
#plt.subplot("212")
#plt.plot(x, x.map(Math.sin).map((t, i) => t * i), 'color=b', 'label=x * sin(x)', 'marker=o', 'linestyle=None')
#plt.legend()
#plt.ylim(-100, 100)
 
#plt.savefig('plot.png')

#plt.plot(myjson["x"])
#plt.ylabel('some numbers')
#plt.show()
#plt.savefig('plot.png')