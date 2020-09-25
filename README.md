# node-red-contrib-chronos

A collection of Node-RED nodes for dealing with fixed and sun or moon position based times.

Each node supports the input of fixed times in the form of `hh:mm:ss` (seconds optional, 12h and 24h format possible) as well as the selection of sun (sunrise, sunset, dusk, dawn, ...) or moon events (moonrise, moonset).

#### Scheduler
Schedules the transmission of messages or setting of global/flow variables at specific times.

![Scheduler](images/scheduler.png)

#### Delay Until
Delays each message passing through the node until a specific time is reached.

![Delay Until](images/delay.png)

#### Time Switch
Routes messages based on their ingress time and date.

![Time Switch](images/switch.png)

#### Time Filter
Filters messages based on their ingress time and date.

![Timer Filter](images/filter.png)

## Documentation
The detailed documentation of each node will soon be available in the wiki of the GitHub repository.

**&rarr; [Documentation](https://github.com/jensrossbach/node-red-contrib-chronos/wiki)**

## License
Copyright (c) 2020 Jens-Uwe Rossbach

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
The following icons have been used from Flaticon:
* Hour glass icon made by <a href="https://www.flaticon.com/authors/freepik" title="Freepik">Freepik</a> from <a href="https://www.flaticon.com/" title="Flaticon"> www.flaticon.com</a>
* Funnel icon made by <a href="https://www.flaticon.com/free-icon/funnel_843709?term=filter&page=1&position=13" title="Kiranshastry">Kiranshastry</a> from <a href="https://www.flaticon.com/" title="Flaticon"> www.flaticon.com</a>

For the calculation of sun and moon position based times, the nodes make use of the great Node.js library [SunCalc](https://www.npmjs.com/package/suncalc) from [Vladimir Agafonkin](https://www.npmjs.com/~mourner).
