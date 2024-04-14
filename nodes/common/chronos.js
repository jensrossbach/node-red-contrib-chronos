/*
 * Copyright (c) 2024 Jens-Uwe Rossbach
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


const PATTERN_TIME     = /^(\d|0\d|1\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?\s*(a|am|A|AM|p|pm|P|PM)?$/;
const PATTERN_DATE     = /^([2-9]\d\d\d)-([1-9]|0[1-9]|1[0-2])-([1-9]|0[1-9]|[12]\d|3[01])$/;

const PATTERN_SUNTIME  = /^(sunrise|sunriseEnd|sunsetStart|sunset|goldenHour|goldenHourEnd|night|nightEnd|dawn|nauticalDawn|dusk|nauticalDusk|solarNoon|nadir)$/;
const PATTERN_MOONTIME = /^(rise|set)$/;
const PATTERN_AUTOTIME = /^(?:([0-9/.\-\s\u200F]+)\s)?(?:(sunrise|sunriseEnd|sunsetStart|sunset|goldenHour|goldenHourEnd|night|nightEnd|dawn|nauticalDawn|dusk|nauticalDusk|solarNoon|nadir)|(rise|set)|(?:custom:([0-9a-zA-Z_]+)))$/;

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
    const args = Array.prototype.slice.call(arguments, 1);
    let ret = null;

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
    times.forEach(time =>
    {
        sunCalc.addTime(time.angle, "__cust_" + time.riseName, "__cust_" + time.setName);
    });
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
    const ret = getMoment(node);
    ret.locale(node.locale);

    return ret;
}

function getTimeFrom(node, source)
{
    let ret = undefined;

    if (typeof source == "string")
    {
        ret = getMoment(
                node,
                source, [
                    "H:mm",      "HH:mm",       // 24-hour format
                    "H:mm:ss",   "HH:mm:ss",    // 24-hour format (incl. seconds)
                    "h:mm a",    "hh:mm a",     // 12-hour format
                    "h:mm:ss a", "hh:mm:ss a",  // 12-hour format (incl. seconds)
                    "L LT",                     // locale-specific date and time
                    "L LTS",                    // locale-specific date and time (incl. seconds)
                    moment.ISO_8601],           // ISO 8601 datetime
                node.locale,
                true);
    }

    if (!ret || !ret.isValid())
    {
        ret = getMoment(node, source);

        if ((typeof source == "number") && (source < 86400000))  // value is interpreted as number of milliseconds since midnight
        {
            const now = getMoment(node);
            ret = ret.year(now.year()).month(now.month()).date(now.date());
        }
    }

    ret.locale(node.locale);

    return ret;
}

function getUserTime(RED, node, day, value)
{
    let ret = undefined;

    if (typeof value == "string")
    {
        // first, try time-only strings
        ret = getMoment(
                node,
                value, [
                    "H:mm",      "HH:mm",        // 24-hour format
                    "H:mm:ss",   "HH:mm:ss",     // 24-hour format (incl. seconds)
                    "h:mm a",    "hh:mm a",      // 12-hour format
                    "h:mm:ss a", "hh:mm:ss a"],  // 12-hour format (incl. seconds)
                true);

        if (ret.isValid())
        {
            // and override the date with the given one
            ret = ret.year(day.year()).month(day.month()).date(day.date());
        }
        else
        {
            // if not time-only, try strings containing date and time
            ret = getMoment(
                    node,
                    value, [
                        "L LT",            // locale-specific date and time
                        "L LTS",           // locale-specific date and time (incl. seconds)
                        moment.ISO_8601],  // ISO 8601 datetime
                    node.locale,
                    true);
        }
    }
    else if (typeof value == "number")
    {
        if (value < 86400000)  // value is interpreted as number of milliseconds since midnight
        {
            const time = moment.utc(value);
            ret = day.hour(time.hour()).minute(time.minute()).second(time.second()).millisecond(time.millisecond());
        }
        else
        {
            ret = getMoment(node, value);
        }
    }

    if (!ret || !ret.isValid())
    {
        throw new TimeError(RED._("node-red-contrib-chronos/chronos-config:common.error.invalidTime"), {type: "time", value: value});
    }

    return ret;
}

function getUserDate(RED, node, value)
{
    let ret = undefined;

    if (PATTERN_DATE.test(value))
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

function isValidUserTime(value, timeOnly = true)
{
    return ((typeof value == "string") && ((timeOnly && PATTERN_TIME.test(value)) || (!timeOnly && value))) ||
           ((typeof value == "number") && (value >= 0) && ((value < (24 * 60 * 60 * 1000)) || !timeOnly));
}

function isValidUserDate(value)
{
    return PATTERN_DATE.test(value);
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
                ret.tz(node.config.timezone);
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
                ret.tz(node.config.timezone);
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
    let ret = undefined;

    if (type == "time")
    {
        ret = getUserTime(RED, node, day, value);
    }
    else if ((type == "sun") || (type == "custom"))
    {
        ret = getSunTime(RED, node, day.set({"hour": 12, "minute": 0, "second": 0, "millisecond": 0}), (type == "custom") ? "__cust_" + value : value);
    }
    else if (type == "moon")
    {
        ret = getMoonTime(RED, node, day.set({"hour": 12, "minute": 0, "second": 0, "millisecond": 0}), value);
    }
    else if (type == "auto")
    {
        let matches = value.match(PATTERN_AUTOTIME);
        if (matches)
        {
            let date = undefined;

            if (matches[1])  // date part
            {
                date = getMoment(
                        node,
                        matches[1], [
                            "L",            // locale-specific date
                            "YYYY-MM-DD"],  // ISO 8601 date
                        node.locale,
                        true);
            }

            if (!date)
            {
                date = day;
            }

            if (matches[2])  // time part (sun time)
            {
                ret = getSunTime(RED, node, date.set({"hour": 12, "minute": 0, "second": 0, "millisecond": 0}), matches[2]);
            }
            else if (matches[3])  // time part (moon time)
            {
                ret = getMoonTime(RED, node, date.set({"hour": 12, "minute": 0, "second": 0, "millisecond": 0}), matches[2]);
            }
            else if (matches[4])  // time part (custom sun time)
            {
                ret = getSunTime(RED, node, date.set({"hour": 12, "minute": 0, "second": 0, "millisecond": 0}), "__cust_" + matches[4]);
            }
        }
        else
        {
            ret = getUserTime(RED, node, day, value);
        }
    }

    return ret;
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

function evaluateJSONataExpression(RED, expr, msg)
{
    return new Promise((resolve, reject) =>
    {
        RED.util.evaluateJSONataExpression(expr, msg, (error, result) =>
        {
            if (error)
            {
                reject(error);
            }
            else
            {
                resolve(result);
            }
        });
    });
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
    evaluateJSONataExpression: evaluateJSONataExpression,
    TimeError: TimeError,
    PATTERN_SUNTIME: PATTERN_SUNTIME,
    PATTERN_MOONTIME: PATTERN_MOONTIME
};
