# node-red-contrib-chronos

<a href="https://www.npmjs.com/package/node-red-contrib-chronos"><img title="npm version" src="https://badgen.net/npm/v/node-red-contrib-chronos"></a>
<a href="https://www.npmjs.com/package/node-red-contrib-chronos"><img title="npm downloads" src="https://badgen.net/npm/dt/node-red-contrib-chronos"></a>

A collection of Node-RED nodes for date and time based scheduling, queueing, routing, filtering and manipulating. Automatically calculated times from sun events (sunrise, sunset, dusk, dawn, ...) or moon events (moonrise, moonset) are supported as well.

If you would like to propose a new feature or any kind of improvement, please start a thread under the _Ideas_ category of the [discussion forum](https://github.com/jensrossbach/node-red-contrib-chronos/discussions/categories/ideas) on GitHub. If you encountered a bug or other misbehavior, don't hesitate to create a problem report using the [issue tracker](https://github.com/jensrossbach/node-red-contrib-chronos/issues) of the repository.

#### Scheduler
Schedules the transmission of messages or setting of global/flow variables at specific times.

![Scheduler](images/scheduler.png)

#### Delay Until
Delays each message passing through the node until a specific time is reached.

![Delay Until](images/delay.png)

#### Time Switch
Routes messages based on a specific time.

![Time Switch](images/switch.png)

#### Time Filter
Filters messages based on a specific time.

![Timer Filter](images/filter.png)

#### Time Change
Modifies time values in messages or context stores.

![Timer Change](images/change.png)

## Documentation
The detailed documentation of each node is available in the wiki of the GitHub repository.

**&rarr; [Documentation](https://github.com/jensrossbach/node-red-contrib-chronos/wiki)**

## License
Copyright (c) 2021 Jens-Uwe Rossbach

This code is licensed under the MIT License.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Attribution
The following icons have been taken from Node-RED provided nodes:
* Timer icon (Node-RED delay node)
* Switch icon (Node-RED switch node)
* Flip icon (Node-RED change node)

The following icons have been taken from Flaticon:
* Hour glass icon made by <a href="https://www.flaticon.com/authors/freepik" title="Freepik">Freepik</a> from <a href="https://www.flaticon.com/" title="Flaticon">www.flaticon.com</a>
* Funnel icon made by <a href="https://www.flaticon.com/free-icon/funnel_843709?term=filter&page=1&position=13" title="Kiranshastry">Kiranshastry</a> from <a href="https://www.flaticon.com/" title="Flaticon">www.flaticon.com</a>

For the calculation of sun and moon position based times, the nodes make use of the great Node.js library [SunCalc](https://www.npmjs.com/package/suncalc) from [Vladimir Agafonkin](https://www.npmjs.com/~mourner). Date and time algorithms are provided by the Node.js library [Moment.js](https://www.npmjs.com/package/moment).

The map for showing the location coordinates in the configuration node is provided by [OpenStreetMap](https://www.openstreetmap.org).