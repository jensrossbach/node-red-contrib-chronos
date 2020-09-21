/*
 * Copyright (c) 2020 Jens-Uwe Rossbach
 *
 * This code is licensed under the MIT License.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */


class TimeError extends Error
{
    constructor(message, details)
    {
        super(message);

        this.name = "TimeError";
        this.details = details;
    }
}

var RED;

var latitude = 0;
var longitude = 0;

var moment;
var sunCalc;


function init(_RED, _latitude, _longitude)
{
    RED = _RED;

    latitude = _latitude;
    longitude = _longitude;

    moment = require("moment");
    sunCalc = require("suncalc");
}

function getUserTime(day, value)
{
    let ret = null;

    let matches = value.match(/^(\d|0\d|1\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?\s*(am|AM|pm|PM)?$/);
    if (matches)
    {
        let hour = matches[1];
        let min = matches[2];
        let sec = matches[3];
        let ampm = matches[4];

        if (ampm)
        {
            switch (ampm.toUpperCase())
            {
                case "AM":
                {
                    if (hour >= 12)
                    {
                        hour = 0;
                    }

                    break;
                }
                case "PM":
                {
                    if (hour < 12)
                    {
                        hour += 12;
                    }

                    break;
                }
            }
        }

        ret = day.hour(hour).minute(min).second(sec ? sec : 0);
    }

    if (!ret)
    {
        throw new TimeError(RED._("node-red-contrib-chronos/chronos-config:common.error.invalidTime"), {payload: {trigger: "time", value: value}});
    }

    return ret;
}

function getSunTime(day, type)
{
    let sunTimes = sunCalc.getTimes(day.toDate(), latitude, longitude);

    let ret = null;
    if (sunTimes[type])
    {
        ret = moment(sunTimes[type]);
        if (!ret.isValid())
        {
            ret = null;
        }
    }

    if (!ret)
    {
        throw new TimeError(RED._("node-red-contrib-chronos/chronos-config:common.error.unavailableTime"), {payload: {trigger: "sun", value: type}});
    }

    return ret;
}

function getMoonTime(day, type)
{
    let moonTimes = sunCalc.getMoonTimes(day.toDate(), latitude, longitude);

    let ret = null;
    if (moonTimes[type])
    {
        ret = moment(moonTimes[type]);
        if (!ret.isValid())
        {
            ret = null;
        }
    }

    if (!ret)
    {
        throw new TimeError(RED._("node-red-contrib-chronos/chronos-config:common.error.unavailableTime"), {payload: {trigger: "moon", value: type, alwaysUp: moonTimes.alwaysUp, alwaysDown: moonTimes.alwaysDown}});
    }

    return ret;
}


module.exports =
{
    init: init,
    getUserTime: getUserTime,
    getSunTime: getSunTime,
    getMoonTime: getMoonTime,
    TimeError: TimeError
};
