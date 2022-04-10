/*
 * Copyright (c) 2022 Jens-Uwe Rossbach
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


const moment = require("moment-timezone");
const sunCalc = require("suncalc");


function getMoment()
{
    let ret = null;
    let args = Array.prototype.slice.call(arguments, 1);

    if (arguments[0].config.timezone)
    {
        args.push(arguments[0].config.timezone);
        ret = moment.tz.apply(null, args);
    }
    else
    {
        ret = moment.apply(null, args);
    }

    return ret;
}

function initCustomTimes(times)
{
    if (times)
    {
        times.forEach(time =>
        {
            sunCalc.addTime(time.angle, "__cust_" + time.riseName, "__cust_" + time.setName);
        });
    }
}

function validateTimeZone(node)
{
    if (node.config.timezone)
    {
        return (moment.tz.zone(node.config.timezone) != null);
    }
    else
    {
        return true;
    }
}

function printNodeInfo(node)
{
    node.debug(
            "Starting node with configuration '"
            + node.config.name + "' (latitude " + node.config.latitude + ", longitude " + node.config.longitude
            + (node.config.timezone ? ", timezone " + node.config.timezone + ")" : ")"));
}

function getCurrentTime(node)
{
    let ret = getMoment(node);
    ret.locale(node.locale);

    return ret;
}

function getTimeFrom(node, source)
{
    let ret = getMoment(node, source);
    ret.locale(node.locale);

    return ret;
}

function getUserTime(RED, day, value)
{
    let ret = null;

    if (typeof value == "string")
    {
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
                            hour -= 12;
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

            ret = day.hour(hour).minute(min).second(sec ? sec : 0).millisecond(0);
        }
    }
    else if (typeof value == "number")
    {
        let time = moment.utc(value);
        ret = day.hour(time.hour()).minute(time.minute()).second(time.second()).millisecond(time.millisecond());
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
        ret = getMoment(node, value, "YYYY-MM-DD");
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
    return ((typeof value == "string") && TIME_REGEX.test(value)) ||
           ((typeof value == "number") && (value >= 0) && (value < (24 * 60 * 60 * 1000)));
}

function isValidUserDate(value)
{
    return DATE_REGEX.test(value);
}

function getSunTime(RED, node, day, type)
{
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
            if (node.config.timezone)
            {
                ret.tz(node.config.timezone, true);
            }

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
            if (node.config.timezone)
            {
                ret.tz(node.config.timezone, true);
            }

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

function applyOffset(time, offset, random)
{
    if (offset)
    {
        time.add(random ? Math.round(Math.random() * offset) : offset, "minutes");
    }

    return time;
}

function getJSONataExpression(RED, node, expr)
{
    const expression = RED.util.prepareJSONataExpression(expr, node);

    expression.registerFunction("millisecond", ts => { return getMoment(node, ts).millisecond(); }, "<(sn):n>");
    expression.registerFunction("second", ts => { return getMoment(node, ts).second(); }, "<(sn):n>");
    expression.registerFunction("minute", ts => { return getMoment(node, ts).minute(); }, "<(sn):n>");
    expression.registerFunction("hour", ts => { return getMoment(node, ts).hour(); }, "<(sn):n>");
    expression.registerFunction("day", ts => { return getMoment(node, ts).date(); }, "<(sn):n>");
    expression.registerFunction("dayOfWeek", ts => { return getMoment(node, ts).weekday() + 1; }, "<(sn):n>");
    expression.registerFunction("dayOfYear", ts => { return getMoment(node, ts).dayOfYear(); }, "<(sn):n>");
    expression.registerFunction("week", ts => { return getMoment(node, ts).week(); }, "<(sn):n>");
    expression.registerFunction("month", ts => { return getMoment(node, ts).month() + 1; }, "<(sn):n>");
    expression.registerFunction("quarter", ts => { return getMoment(node, ts).quarter(); }, "<(sn):n>");
    expression.registerFunction("year", ts => { return getMoment(node, ts).year(); }, "<(sn):n>");
    expression.registerFunction("time", (ts, time, offset, random) => { return applyOffset(getTime(RED, node, getMoment(node, ts), "time", time), offset, random).valueOf(); }, "<(sn)(sn)n?b?:n>");
    expression.registerFunction("sunTime", (ts, pos, offset, random) => { return applyOffset(getTime(RED, node, getMoment(node, ts), "sun", pos), offset, random).valueOf(); }, "<(sn)sn?b?:n>");
    expression.registerFunction("moonTime", (ts, pos, offset, random) => { return applyOffset(getTime(RED, node, getMoment(node, ts), "moon", pos), offset, random).valueOf(); }, "<(sn)sn?b?:n>");

    return expression;
}


module.exports =
{
    initCustomTimes: initCustomTimes,
    validateTimeZone: validateTimeZone,
    printNodeInfo: printNodeInfo,
    getCurrentTime: getCurrentTime,
    getTimeFrom: getTimeFrom,
    getUserTime: getUserTime,
    getSunTime: getSunTime,
    getMoonTime: getMoonTime,
    getTime: getTime,
    getUserDate: getUserDate,
    isValidUserTime: isValidUserTime,
    isValidUserDate: isValidUserDate,
    getJSONataExpression: getJSONataExpression,
    TimeError: TimeError
};
