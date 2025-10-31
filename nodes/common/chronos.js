/*
 * Copyright (c) 2020 - 2025 Jens-Uwe Rossbach
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


const PATTERN_TIME          = /^(\d|0\d|1\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?\s*(a|am|A|AM|p|pm|P|PM)?$/;
const PATTERN_DATE          = /^([2-9]\d\d\d)-([1-9]|0[1-9]|1[0-2])-([1-9]|0[1-9]|[12]\d|3[01])$/;

const PATTERN_SUNTIME       = /^sunrise|sunriseEnd|sunsetStart|sunset|goldenHour|goldenHourEnd|night|nightEnd|dawn|nauticalDawn|dusk|nauticalDusk|solarNoon|nadir$/;
const PATTERN_MOONTIME      = /^rise|set$/;
const PATTERN_AUTO_TIME     = /^(?:((?:\d|0\d|1\d|2[0-3]):(?:[0-5]\d)(?::(?:[0-5]\d))?\s*(?:a|am|A|AM|p|pm|P|PM)?)|(sunrise|sunriseEnd|sunsetStart|sunset|goldenHour|goldenHourEnd|night|nightEnd|dawn|nauticalDawn|dusk|nauticalDusk|solarNoon|nadir)|(rise|set)|(?:custom:([0-9a-zA-Z_]+)))$/;
const PATTERN_AUTO_DATETIME = /^(?:([0-9/.\-\s\u200F]+)\s)?(?:(sunrise|sunriseEnd|sunsetStart|sunset|goldenHour|goldenHourEnd|night|nightEnd|dawn|nauticalDawn|dusk|nauticalDusk|solarNoon|nadir)|(rise|set)|(?:custom:([0-9a-zA-Z_]+)))$/;

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
const sunCalc = require("suncalc2");

require("./moment_locales.js");

function getMoment()
{
    const node = arguments[0];
    const args = Array.prototype.slice.call(arguments, 1);
    let ret = undefined;

    try
    {
        const tz = getTimeZone(node);
        if (tz)
        {
            args.push(tz);
            ret = moment.tz.apply(null, args);
        }
        else
        {
            ret = moment.apply(null, args);
        }
    }
    catch
    {
        ret = moment.invalid();
    }

    ret._hasUserDate = false;
    ret.hasUserDate = function(flag)
    {
        if (flag === undefined)
        {
            return this._hasUserDate;
        }
        else
        {
            this._hasUserDate = flag;
        }
    };

    ret.locale(node.config.locale);

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
    if (node.config.tzFromContext)
    {
        // only check for non-empty key in case of context variable
        const ctx = node.RED.util.parseContextStore(node.config.timezone);
        if (!ctx.key)
        {
            return false;
        }

        return true;
    }

    if (node.config.timezone)
    {
        return (moment.tz.zone(node.config.timezone) != null);
    }

    return true;
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
                node.config.locale,
                true);
    }
    else if ((typeof source == "number") && (source >= 0))
    {
        if (source < 86400000)  // value is interpreted as number of milliseconds since midnight
        {
            const time = moment.utc(source);
            ret = getMoment(node).hour(time.hour()).minute(time.minute()).second(time.second()).millisecond(time.millisecond());
        }
        else
        {
            ret = getMoment(node, source);
        }
    }
    else if ((typeof source == "object") && (source instanceof Date))
    {
        ret = getMoment(node, source);
    }

    if (!ret)
    {
        // fallback to have at least "something"
        ret = moment.invalid();
    }

    return ret;
}

function getUserTime(node, day, value, timeOnly = false)
{
    let ret = undefined;

    if (typeof value == "string")
    {
        if (PATTERN_TIME.test(value))
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
        }
        else if (!timeOnly)
        {
            // if not time-only, try strings containing date and time
            ret = getMoment(
                    node,
                    value, [
                        "L LT",            // locale-specific date and time
                        "L LTS",           // locale-specific date and time (incl. seconds)
                        moment.ISO_8601],  // ISO 8601 datetime
                    node.config.locale,
                    true);
            ret.hasUserDate(true);
        }
    }
    else if ((typeof value == "number") && (value >= 0))
    {
        if (value < 86400000)  // value is interpreted as number of milliseconds since midnight
        {
            const time = moment.utc(value);
            ret = day.hour(time.hour()).minute(time.minute()).second(time.second()).millisecond(time.millisecond());
        }
        else if (!timeOnly)
        {
            ret = getMoment(node, value);
            ret.hasUserDate(true);
        }
    }

    if (!ret || !ret.isValid())
    {
        throw new TimeError(node.RED._("node-red-contrib-chronos/chronos-config:common.error.invalidTime"), {type: "time", value: value});
    }

    return ret;
}

function getUserDate(node, value)
{
    let ret = undefined;

    if (PATTERN_DATE.test(value))
    {
        ret = getMoment(node, value, "YYYY-MM-DD");
    }

    if (!ret || !ret.isValid())
    {
        throw new TimeError(node.RED._("node-red-contrib-chronos/chronos-config:common.error.invalidDate"), {type: "date", value: value});
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

function getSunTime(node, day, type)
{
    let sunTimes = sunCalc.getTimes(day.toDate(), getLatitude(node), getLongitude(node));

    if (!(type in sunTimes))
    {
        throw new TimeError(node.RED._("node-red-contrib-chronos/chronos-config:common.error.invalidName"), {type: "sun", value: type});
    }

    let ret = null;
    if (sunTimes[type])
    {
        ret = getMoment(node, sunTimes[type]);
        if (!ret.isValid())
        {
            ret = null;
        }
    }

    if (!ret)
    {
        throw new TimeError(node.RED._("node-red-contrib-chronos/chronos-config:common.error.unavailableTime"), {type: "sun", value: type});
    }

    return ret;
}

function getMoonTime(node, day, type)
{
    let moonTimes = sunCalc.getMoonTimes(day.toDate(), getLatitude(node), getLongitude(node));

    let ret = null;
    if (moonTimes[type])
    {
        ret = getMoment(node, moonTimes[type]);
        if (!ret.isValid())
        {
            ret = null;
        }
    }

    if (!ret)
    {
        throw new TimeError(node.RED._("node-red-contrib-chronos/chronos-config:common.error.unavailableTime"), {type: "moon", value: type, alwaysUp: moonTimes.alwaysUp, alwaysDown: moonTimes.alwaysDown});
    }

    return ret;
}

function getTime(node, day, type, value)
{
    let ret = undefined;

    if (type == "time")
    {
        ret = getUserTime(node, day, value);
    }
    else if ((type == "sun") || (type == "custom"))
    {
        ret = getSunTime(node, day.set({"hour": 12, "minute": 0, "second": 0, "millisecond": 0}), (type == "custom") ? "__cust_" + value : value);
    }
    else if (type == "moon")
    {
        ret = getMoonTime(node, day.set({"hour": 12, "minute": 0, "second": 0, "millisecond": 0}), value);
    }
    else if (type == "auto")
    {
        if (typeof value == "string")
        {
            let matches = value.match(PATTERN_AUTO_DATETIME);
            if (matches)
            {
                let hasUserDate = false;
                let date = undefined;

                if (matches[1])  // date part
                {
                    date = getMoment(
                            node,
                            matches[1], [
                                "L",            // locale-specific date
                                "YYYY-MM-DD"],  // ISO 8601 date
                            node.config.locale,
                            true);
                }

                if (!date)
                {
                    date = day;
                }
                else
                {
                    hasUserDate = true;
                }

                if (matches[2])  // time part (sun time)
                {
                    ret = getSunTime(node, date.set({"hour": 12, "minute": 0, "second": 0, "millisecond": 0}), matches[2]);
                }
                else if (matches[3])  // time part (moon time)
                {
                    ret = getMoonTime(node, date.set({"hour": 12, "minute": 0, "second": 0, "millisecond": 0}), matches[2]);
                }
                else if (matches[4])  // time part (custom sun time)
                {
                    ret = getSunTime(node, date.set({"hour": 12, "minute": 0, "second": 0, "millisecond": 0}), "__cust_" + matches[4]);
                }

                ret.hasUserDate(hasUserDate);
            }
            else
            {
                ret = getUserTime(node, day, value);
            }
        }
        else
        {
            ret = getUserTime(node, day, value);
        }
    }
    else if (type == "auto:time")
    {
        if (typeof value == "string")
        {
            let matches = value.match(PATTERN_AUTO_TIME);
            if (matches)
            {
                if (matches[1])  // specific time
                {
                    ret = getUserTime(node, day, value, true);
                }
                else if (matches[2])  // sun time
                {
                    ret = getSunTime(node, day.set({"hour": 12, "minute": 0, "second": 0, "millisecond": 0}), matches[2]);
                }
                else if (matches[3])  // moon time
                {
                    ret = getMoonTime(node, day.set({"hour": 12, "minute": 0, "second": 0, "millisecond": 0}), matches[2]);
                }
                else if (matches[4])  // custom sun time
                {
                    ret = getSunTime(node, day.set({"hour": 12, "minute": 0, "second": 0, "millisecond": 0}), "__cust_" + matches[4]);
                }
            }
            else
            {
                throw new TimeError(node.RED._("node-red-contrib-chronos/chronos-config:common.error.invalidTime"), {type: "time", value: value});
            }
        }
        else
        {
            ret = getUserTime(node, day, value, true);
        }
    }

    return ret;
}

function retrieveTime(node, msg, baseTime, type, value)
{
    let ret = undefined;

    if ((type == "env") || (type == "global") || (type == "flow") || (type == "msg"))
    {
        let ctxValue = undefined;

        if (type == "env")
        {
            ctxValue = node.RED.util.evaluateNodeProperty(value, type, node);
            if (!ctxValue)
            {
                ctxValue = value;
            }
        }
        else if ((type == "global") || (type == "flow"))
        {
            const ctx = node.RED.util.parseContextStore(value);
            ctxValue = node.context()[type].get(ctx.key, ctx.store);
        }
        else
        {
            ctxValue = node.RED.util.getMessageProperty(msg, value);
        }

        if (!ctxValue || ((typeof ctxValue != "number") && (typeof ctxValue != "string")))
        {
            throw new TimeError(
                        node.RED._("node-red-contrib-chronos/chronos-config:common.error.invalidTime"),
                        {type: type, value: ctxValue});
        }

        ret = getTime(
                node,
                baseTime,
                "auto",
                ctxValue);

        if (!ret.isValid())
        {
            throw new TimeError(
                        node.RED._("node-red-contrib-chronos/chronos-config:common.error.invalidTime"),
                        {type: type, value: ctxValue});
        }
    }
    else
    {
        ret = getTime(
                node,
                baseTime,
                type,
                value);
    }

    return ret;
}

function getDuration(node, input, unit)
{
    const ret = moment.duration(input, unit);
    ret.locale(node.config.locale);

    return ret;
}

function getLatitude(node)
{
    let ret = undefined;

    if (typeof node.config.latitude == "number")
    {
        ret = node.config.latitude;
    }
    else
    {
        ret = getCoordinateFromContext(node, node.config.latitude, -90, 90);
    }

    return ret;
}

function getLongitude(node)
{
    let ret = undefined;

    if (typeof node.config.longitude == "number")
    {
        ret = node.config.longitude;
    }
    else
    {
        ret = getCoordinateFromContext(node, node.config.longitude, -180, 180);
    }

    return ret;
}

function getCoordinateFromContext(node, variable, min, max)
{
    const ctx = node.RED.util.parseContextStore(variable);
    const value = node.context().global.get(ctx.key, ctx.store);
    let ret = undefined;

    if (typeof value == "number")
    {
        ret = value;
    }
    else if (typeof value == "string")
    {
        ret = parseFloat(value);
    }

    if ((ret === undefined) || Number.isNaN(ret) || (ret < min) || (ret > max))
    {
        throw new TimeError(
            node.RED._("node-red-contrib-chronos/chronos-config:common.error.invalidCoordinate"),
            {variable: ctx.key, value: value});
    }

    return ret;
}

function getTimeZone(node)
{
    let ret = undefined;

    if (node.config.tzFromContext)
    {
        const ctx = node.RED.util.parseContextStore(node.config.timezone);
        ret = node.context().global.get(ctx.key, ctx.store);

        if (typeof ret != "string")
        {
            throw new TimeError(
                node.RED._("node-red-contrib-chronos/chronos-config:common.error.invalidTimeZone"),
                {variable: ctx.key, value: ret});
        }
    }
    else
    {
        ret = node.config.timezone;
    }

    return ret;
}

function applyOffset(time, offset, random)
{
    return time.add(getRandomizedOffset(offset, random), "minutes");
}

function getJSONataExpression(node, expr)
{
    const expression = node.RED.util.prepareJSONataExpression(expr, node);

    expression.assign("node", node.name || "");
    expression.assign(
        "config", {
            name: node.config.name,
            latitude: (typeof node.config.latitude == "number") ? node.config.latitude : null,
            longitude: (typeof node.config.longitude == "number") ? node.config.longitude : null,
            timezone: node.config.tzFromContext ? null : node.config.timezone,
            locale: node.config.locale});

    expression.registerFunction("getLatitude", () => { return getLatitude(node); }, "<:n>");
    expression.registerFunction("getLongitude", () => { return getLongitude(node); }, "<:n>");
    expression.registerFunction("getTimeZone", () => { return getTimeZone(node); }, "<:s>");
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
    expression.registerFunction("time", (ts, time, offset, random) => { return applyOffset(getTime(node, getMoment(node, ts), "time", time), offset, random).valueOf(); }, "<(sn)(sn)n?(nb)?:n>");
    expression.registerFunction("sunTime", (ts, pos, offset, random) => { return applyOffset(getTime(node, getMoment(node, ts), "sun", pos), offset, random).valueOf(); }, "<(sn)sn?(nb)?:n>");
    expression.registerFunction("moonTime", (ts, pos, offset, random) => { return applyOffset(getTime(node, getMoment(node, ts), "moon", pos), offset, random).valueOf(); }, "<(sn)sn?(nb)?:n>");

    return expression;
}

function evaluateJSONataExpression(RED, expr, msg)
{
    return new Promise((resolve, reject) =>
    {
        RED.util.evaluateJSONataExpression(expr, msg, (err, res) =>
        {
            if (err)
            {
                reject(err);
            }
            else
            {
                resolve(res);
            }
        });
    });
}

function evaluateNodeProperty(node, value, type, msg)
{
    return new Promise((resolve, reject) =>
    {
        node.RED.util.evaluateNodeProperty(value, type, node, msg, (err, val) =>
        {
            if (err)
            {
                reject(err);
            }
            else
            {
                resolve(val);
            }
        });
    });
}

function getRandomizedOffset(offset, random)
{
    let ret = (typeof offset == "number") ? offset : 0;

    if (random === true)  // backward compatibility to v1.26.1 and below
    {
        ret = Math.round(Math.random() * offset);
    }
    else if ((typeof random == "number") && (random > 0))
    {
        ret = Math.round(offset - (random / 2) + (Math.random() * random));
    }

    return ret;
}

function validateConfiguration(node)
{
    if (((typeof node.config.latitude != "number") && (typeof node.config.latitude != "string")) ||
        ((typeof node.config.latitude == "number") && (Number.isNaN(node.config.latitude) || (node.config.latitude < -90) || (node.config.latitude > 90))) ||
        ((typeof node.config.latitude == "string") && !node.config.latitude))
    {
        return false;
    }

    if (((typeof node.config.longitude != "number") && (typeof node.config.longitude != "string")) ||
        ((typeof node.config.longitude == "number") && (Number.isNaN(node.config.longitude) || (node.config.longitude < -180) || (node.config.longitude > 180))) ||
        ((typeof node.config.longitude == "string") && !node.config.longitude))
    {
        return false;
    }

    if (!validateTimeZone(node))
    {
        return false;
    }

    return true;
}

function validateOffset(data)
{
    if ((typeof data.offset != "undefined") && (typeof data.offset != "number"))
    {
        return false;
    }

    if ((typeof data.offset == "number") && ((data.offset < -300) || (data.offset > 300)))
    {
        return false;
    }

    if ((typeof data.random != "undefined") &&
        (typeof data.random != "boolean") &&
        (typeof data.random != "number"))
    {
        return false;
    }

    if ((typeof data.random == "number") && ((data.random < 0) || (data.random > 300)))
    {
        return false;
    }

    return true;
}

module.exports =
{
    // functions
    evaluateJSONataExpression: evaluateJSONataExpression,
    evaluateNodeProperty:      evaluateNodeProperty,
    initCustomTimes:           initCustomTimes,
    isValidUserTime:           isValidUserTime,
    isValidUserDate:           isValidUserDate,
    getCurrentTime:            getCurrentTime,
    getDuration:               getDuration,
    getJSONataExpression:      getJSONataExpression,
    getMoonTime:               getMoonTime,
    getRandomizedOffset:       getRandomizedOffset,
    getSunTime:                getSunTime,
    getTime:                   getTime,
    getTimeFrom:               getTimeFrom,
    getUserDate:               getUserDate,
    getUserTime:               getUserTime,
    printNodeInfo:             printNodeInfo,
    retrieveTime:              retrieveTime,
    validateConfiguration:     validateConfiguration,
    validateOffset:            validateOffset,

    // classes
    TimeError:                 TimeError,

    // constants
    PATTERN_AUTO_DATETIME:     PATTERN_AUTO_DATETIME,
    PATTERN_AUTO_TIME:         PATTERN_AUTO_TIME,
    PATTERN_MOONTIME:          PATTERN_MOONTIME,
    PATTERN_SUNTIME:           PATTERN_SUNTIME
};
