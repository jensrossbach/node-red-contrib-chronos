/*
 * Copyright (c) 2021 Jens-Uwe Rossbach
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


const TIME_REGEX = /^(\d|0\d|1\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?\s*(am|AM|pm|PM)?$/;
const DATE_REGEX = /^([2-9]\d\d\d)-([1-9]|0[1-9]|1[0-2])-([1-9]|0[1-9]|[12]\d|3[01])$/;

class TimeError extends Error
{
    constructor(message, details)
    {
        super(message);

        this.name = "TimeError";
        this.details = details;
    }
}


const moment = require("moment");
const sunCalc = require("suncalc");


function initCustomTimes(times)
{
    if (times)
    {
        times.forEach(time =>
        {
            console.log("Adding custom time " + time.riseName + "/" + time.setName + "@" + time.angle);
            sunCalc.addTime(time.angle, "__cust_" + time.riseName, "__cust_" + time.setName);
        });
    }
}

function getCurrentTime(node)
{
    let ret = moment();
    ret.locale(node.locale);

    return ret;
}

function getTimeFrom(node, source)
{
    let ret = moment(source);
    ret.locale(node.locale);

    return ret;
}

function getUserTime(RED, day, value)
{
    let ret = null;

    let matches = value.match(TIME_REGEX);
    if (matches)
    {
        let hour = Number.parseInt(matches[1]);
        let min = Number.parseInt(matches[2]);
        let sec = Number.parseInt(matches[3]);
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
        throw new TimeError(RED._("node-red-contrib-chronos/chronos-config:common.error.invalidTime"), {type: "time", value: value});
    }

    return ret;
}

function getUserDate(RED, node, value)
{
    let ret = null;

    if (DATE_REGEX.test(value))
    {
        ret = moment(value, "YYYY-MM-DD");
        ret.locale(node.locale);
    }

    if (!ret || !ret.isValid())
    {
        throw new TimeError(RED._("node-red-contrib-chronos/chronos-config:common.error.invalidDate"), {type: "date", value: value});
    }

    return ret;
}

function isValidUserTime(value)
{
    return TIME_REGEX.test(value);
}

function isValidUserDate(value)
{
    return DATE_REGEX.test(value);
}

function getSunTime(RED, node, day, type)
{
    node.debug("Calculating sun time for " + type + " at location " + node.config.latitude + ", " + node.config.longitude);
    let sunTimes = sunCalc.getTimes(day.toDate(), node.config.latitude, node.config.longitude);

    if (!(type in sunTimes))
    {
        throw new TimeError(RED._("node-red-contrib-chronos/chronos-config:common.error.invalidName"), {type: "sun", value: type});
    }

    let ret = null;
    if (sunTimes[type])
    {
        ret = moment(sunTimes[type]);
        if (!ret.isValid())
        {
            ret = null;
        }
        else
        {
            ret.locale(node.locale);
        }
    }

    if (!ret)
    {
        throw new TimeError(RED._("node-red-contrib-chronos/chronos-config:common.error.unavailableTime"), {type: "sun", value: type});
    }

    return ret;
}

function getMoonTime(RED, node, day, type)
{
    node.debug("Calculating moon time for " + type + " at location " + node.config.latitude + ", " + node.config.longitude);
    let moonTimes = sunCalc.getMoonTimes(day.toDate(), node.config.latitude, node.config.longitude);

    let ret = null;
    if (moonTimes[type])
    {
        ret = moment(moonTimes[type]);
        if (!ret.isValid())
        {
            ret = null;
        }
        else
        {
            ret.locale(node.locale);
        }
    }

    if (!ret)
    {
        throw new TimeError(RED._("node-red-contrib-chronos/chronos-config:common.error.unavailableTime"), {type: "moon", value: type, alwaysUp: moonTimes.alwaysUp, alwaysDown: moonTimes.alwaysDown});
    }

    return ret;
}

function getTime(RED, node, day, type, value)
{
    if (type == "time")
    {
        return getUserTime(RED, day, value);
    }
    else if ((type == "sun") || (type == "custom"))
    {
        return getSunTime(RED, node, day.set({"hour": 12, "minute": 0, "second": 0, "millisecond": 0}), (type == "custom") ? "__cust_" + value : value);
    }
    else if (type == "moon")
    {
        return getMoonTime(RED, node, day.set({"hour": 12, "minute": 0, "second": 0, "millisecond": 0}), value);
    }
}


module.exports =
{
    initCustomTimes: initCustomTimes,
    getCurrentTime: getCurrentTime,
    getTimeFrom: getTimeFrom,
    getUserTime: getUserTime,
    getSunTime: getSunTime,
    getMoonTime: getMoonTime,
    getTime: getTime,
    getUserDate: getUserDate,
    isValidUserTime: isValidUserTime,
    isValidUserDate: isValidUserDate,
    TimeError: TimeError
};
