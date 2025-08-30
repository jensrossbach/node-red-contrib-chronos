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

module.exports = function(RED)
{
    function ChronosChangeNode(settings)
    {
        const TOKENIZER_PATTERN = /(\[[^[]*\])|(y|M|w|d|hh?|mm?|ss?|SS?S?|.)/g;

        const node = this;
        RED.nodes.createNode(this, settings);

        node.RED = RED;
        node.chronos = require("./common/chronos.js");
        node.name = settings.name;
        node.config = RED.nodes.getNode(settings.config);
        node.locale = ("lang" in RED.settings) ? RED.settings.lang : require("os-locale").sync();

        if (!node.config)
        {
            node.status({fill: "red", shape: "dot", text: "node-red-contrib-chronos/chronos-config:common.status.noConfig"});
            node.error(RED._("node-red-contrib-chronos/chronos-config:common.error.noConfig"));

            return;
        }

        if (!node.chronos.validateConfiguration(node))
        {
            node.status({fill: "red", shape: "dot", text: "node-red-contrib-chronos/chronos-config:common.status.invalidConfig"});
            node.error(RED._("node-red-contrib-chronos/chronos-config:common.error.invalidConfig"));

            return;
        }

        if (settings.rules.length == 0)
        {
            node.status({fill: "red", shape: "dot", text: "change.status.noRules"});
            node.error(RED._("change.error.noRules"));

            return;
        }

        node.chronos.printNodeInfo(node);
        node.status({});

        node.mode = (typeof settings.mode == "undefined") ? "moment" : settings.mode;
        node.rules = settings.rules;

        let valid = true;
        for (let i=0; i<node.rules.length; ++i)
        {
            const rule = node.rules[i];

            if (node.mode == "moment")
            {
                // backward compatibility to 1.24.0 and below
                if (rule.action == "change")
                {
                    if (rule.type == "toString")
                    {
                        rule.action = "convert";
                        delete rule.type;

                        // backward compatibility to v1.19.1 and below
                        if (!rule.formatType)
                        {
                            rule.formatType = "custom";
                        }

                        // backward compatibility to v1.21.0 and below
                        if (rule.formatType == "relative")
                        {
                            rule.formatType = "predefined";
                            rule.format = "relative";
                        }
                        else if (rule.formatType == "calendar")
                        {
                            rule.formatType = "predefined";
                            rule.format = "calendar";
                        }
                        else if (rule.formatType == "iso8601")
                        {
                            rule.formatType = "predefined";
                            rule.format = "iso8601";
                        }
                        else if (rule.formatType == "iso8601utc")
                        {
                            rule.formatType = "predefined";
                            rule.format = "iso8601utc";
                        }

                        if (typeof rule.tzType == "undefined")
                        {
                            rule.tzType = "current";
                            rule.tzValue = "";
                        }
                    }
                    else if ((rule.type == "set") || (rule.type == "add") || (rule.type == "subtract"))
                    {
                        if (typeof rule.valueType == "undefined")
                        {
                            rule.valueType = "num";
                        }
                    }
                }

                if ((rule.action == "set") && (rule.type == "date"))
                {
                    if (!node.chronos.isValidUserDate(rule.date))
                    {
                        valid = false;
                        break;
                    }
                    if ((rule.time.type == "time") && !node.chronos.isValidUserTime(rule.time.value))
                    {
                        valid = false;
                        break;
                    }
                }
                else if (
                    (rule.action == "convert") &&
                    (rule.formatType == "custom") &&
                    !rule.format)
                {
                    valid = false;
                    break;
                }
            }
            else if (rule.action == "set")
            {
                if ((rule.time1.type == "time") && !node.chronos.isValidUserTime(rule.time1.value, false))
                {
                    valid = false;
                    break;
                }

                if ((rule.time2.type == "time") && !node.chronos.isValidUserTime(rule.time2.value, false))
                {
                    valid = false;
                    break;
                }
            }
        }

        if (!valid)
        {
            node.status({fill: "red", shape: "dot", text: "node-red-contrib-chronos/chronos-config:common.status.invalidConfig"});
            node.error(RED._("node-red-contrib-chronos/chronos-config:common.error.invalidConfig"));

            return;
        }

        node.on("input", async(msg, send, done) =>
        {
            if (msg)
            {
                if (!send || !done)  // Node-RED 0.x not supported anymore
                {
                    return;
                }

                for (let i=0; i<node.rules.length; ++i)
                {
                    try
                    {
                        let rule = node.rules[i];

                        if (node.mode == "moment")
                        {
                            if (rule.action == "set")
                            {
                                switch (rule.type)
                                {
                                    case "now":
                                    {
                                        setTarget(msg, rule.target, Date.now());
                                        break;
                                    }
                                    case "date":
                                    {
                                        setTarget(
                                            msg,
                                            rule.target,
                                            node.chronos.getTime(
                                                    node,
                                                    node.chronos.getUserDate(
                                                            node,
                                                            rule.date),
                                                    rule.time.type,
                                                    rule.time.value).valueOf());
                                        break;
                                    }
                                    case "jsonata":
                                    {
                                        let expression = null;
                                        let result = null;

                                        try
                                        {
                                            expression = node.chronos.getJSONataExpression(node, rule.expression);

                                            // time change node specific JSONata extensions
                                            expression.assign("target", getValue(msg, rule.target.name, rule.target.type));

                                            expression.registerFunction("set", (ts, part, value) =>
                                            {
                                                return setPart(node.chronos.getTimeFrom(node, ts), part, value);
                                            }, "<(sn)sn:n>");

                                            expression.registerFunction("add", (ts, value, unit) =>
                                            {
                                                return node.chronos.getTimeFrom(node, ts).add(value, unit).valueOf();
                                            }, "<(sn)ns:n>");

                                            expression.registerFunction("subtract", (ts, value, unit) =>
                                            {
                                                return node.chronos.getTimeFrom(node, ts).subtract(value, unit).valueOf();
                                            }, "<(sn)ns:n>");

                                            expression.registerFunction("startOf", (ts, arg) =>
                                            {
                                                return node.chronos.getTimeFrom(node, ts).startOf(arg).valueOf();
                                            }, "<(sn)s:n>");

                                            expression.registerFunction("endOf", (ts, arg) =>
                                            {
                                                return node.chronos.getTimeFrom(node, ts).endOf(arg).valueOf();
                                            }, "<(sn)s:n>");

                                            result = await node.chronos.evaluateJSONataExpression(RED, expression, msg);
                                        }
                                        catch (e)
                                        {
                                            if (e instanceof node.chronos.TimeError)
                                            {
                                                throw e;
                                            }
                                            else
                                            {
                                                const details = {rule: i+1, expression: rule.expression, code: e.code, description: e.message, position: e.position, token: e.token};
                                                if (e.value)
                                                {
                                                    details.value = e.value;
                                                }

                                                throw new node.chronos.TimeError(
                                                            RED._("node-red-contrib-chronos/chronos-config:common.error.evaluationFailed"),
                                                            details);
                                            }
                                        }

                                        if ((typeof result != "number") && (typeof result != "string"))
                                        {
                                            throw new node.chronos.TimeError(
                                                        RED._("node-red-contrib-chronos/chronos-config:common.error.notTime"),
                                                        {rule: i+1, expression: rule.expression, result: result});
                                        }

                                        setTarget(msg, rule.target, result);
                                        break;
                                    }
                                }
                            }
                            else if ((rule.action == "change") || (rule.action == "convert"))
                            {
                                let input = undefined;
                                let property = getValue(msg, rule.target.name, rule.target.type);

                                if ((typeof property == "number") || (typeof property == "string"))
                                {
                                    input = node.chronos.getTime(
                                                            node,
                                                            node.chronos.getCurrentTime(node),
                                                            (typeof property == "number")
                                                                ? "time"
                                                                : "auto",
                                                            property);
                                }

                                if (input)
                                {
                                    let output = undefined;

                                    if (rule.action == "change")
                                    {
                                        switch (rule.type)
                                        {
                                            case "set":
                                            {
                                                output = setPart(
                                                            input,
                                                            rule.part,
                                                            getNumber(
                                                                getValue(
                                                                    msg,
                                                                    rule.value,
                                                                    rule.valueType)));
                                                break;
                                            }
                                            case "add":
                                            {
                                                output = addTime(
                                                            input,
                                                            getValue(
                                                                msg,
                                                                rule.value,
                                                                rule.valueType),
                                                            rule.unit).valueOf();
                                                break;
                                            }
                                            case "subtract":
                                            {
                                                output = subtractTime(
                                                            input,
                                                            getValue(
                                                                msg,
                                                                rule.value,
                                                                rule.valueType),
                                                            rule.unit).valueOf();
                                                break;
                                            }
                                            case "startOf":
                                            {
                                                input.startOf(rule.arg);
                                                output = input.valueOf();

                                                break;
                                            }
                                            case "endOf":
                                            {
                                                input.endOf(rule.arg);
                                                output = input.valueOf();

                                                break;
                                            }
                                        }
                                    }
                                    else if (rule.action == "convert")
                                    {
                                        if (rule.tzType == "timeZone")
                                        {
                                            input.tz(rule.tzValue);
                                        }
                                        else if (rule.tzType == "utcOffset")
                                        {
                                            // if it's a number, convert it to a number
                                            if (+rule.tzValue === +rule.tzValue)
                                            {
                                                rule.tzValue = +rule.tzValue;
                                            }

                                            input.utcOffset(rule.tzValue);
                                        }

                                        if (rule.formatType == "custom")
                                        {
                                            output = input.format(rule.format);
                                        }
                                        else if (rule.formatType == "predefined")
                                        {
                                            if (rule.format == "calendar")
                                            {
                                                output = input.calendar();
                                            }
                                            else if (rule.format == "relative")
                                            {
                                                output = input.fromNow();
                                            }
                                            else if (rule.format == "regional")
                                            {
                                                output = input.format("L LTS");
                                            }
                                            else if (rule.format == "regionalDate")
                                            {
                                                output = input.format("L");
                                            }
                                            else if (rule.format == "regionalTime")
                                            {
                                                output = input.format("LTS");
                                            }
                                            else if (rule.format == "iso8601")
                                            {
                                                output = input.toISOString(true);
                                            }
                                            else if (rule.format == "iso8601utc")
                                            {
                                                output = input.toISOString();
                                            }
                                        }
                                    }

                                    setTarget(msg, rule.target, output);
                                }
                                else
                                {
                                    let prop = rule.target.name;
                                    if ((rule.target.type == "global") || (rule.target.type == "flow"))
                                    {
                                        let ctx = RED.util.parseContextStore(rule.target.name);
                                        prop = ctx.key + (ctx.store ? " (" + ctx.store + ")" : "");
                                    }

                                    node.error(RED._("change.error.invalidProperty", {property: rule.target.type + "." + prop}), msg);
                                }
                            }
                        }
                        else if (rule.action == "set")
                        {
                            const now = node.chronos.getCurrentTime(node);
                            let time1 =
                                    (rule.time1.type == "now")
                                        ? now
                                        : node.chronos.retrieveTime(
                                            node,
                                            msg,
                                            now.clone(),
                                            rule.time1.type,
                                            rule.time1.value);
                            let time2 =
                                    (rule.time2.type == "now")
                                        ? now
                                        : node.chronos.retrieveTime(
                                            node,
                                            msg,
                                            now.clone(),
                                            rule.time2.type,
                                            rule.time2.value);

                            if (time1.isAfter(time2))
                            {
                                if (time1.isSame(time2, "day"))
                                {
                                    if (rule.time2.type == "now")
                                    {
                                        // shift time1 one day into the past
                                        time1 = node.chronos.retrieveTime(
                                                                node,
                                                                msg,
                                                                now.clone().subtract(1, "day"),
                                                                rule.time1.type,
                                                                rule.time1.value);
                                    }
                                    else
                                    {
                                        // shift time2 one day into the future
                                        time2 = node.chronos.retrieveTime(
                                                                node,
                                                                msg,
                                                                now.clone().add(1, "day"),
                                                                rule.time2.type,
                                                                rule.time2.value);
                                    }
                                }
                                else
                                {
                                    // flip the two times
                                    const time = time2;

                                    time2 = time1;
                                    time1 = time;
                                }
                            }

                            setTarget(
                                msg,
                                rule.target,
                                time2.diff(time1));
                        }
                        else if ((rule.action == "change") || (rule.action == "convert"))
                        {
                            let input = undefined;
                            let property = getValue(msg, rule.target.name, rule.target.type);

                            if ((typeof property == "number") || (typeof property == "string"))
                            {
                                input = ((rule.action == "change") && (rule.type == "numval"))
                                    ? property : node.chronos.getDuration(node, property);
                            }

                            if (input)
                            {
                                let output = undefined;

                                if (rule.action == "change")
                                {
                                    switch (rule.type)
                                    {
                                        case "add":
                                        {
                                            output = addTime(
                                                        input,
                                                        getValue(
                                                            msg,
                                                            rule.value,
                                                            rule.valueType),
                                                        (rule.unit == "milliseconds")
                                                            ? undefined
                                                            : rule.unit).asMilliseconds();
                                            break;
                                        }
                                        case "subtract":
                                        {
                                            output = subtractTime(
                                                        input,
                                                        getValue(
                                                            msg,
                                                            rule.value,
                                                            rule.valueType),
                                                        (rule.unit == "milliseconds")
                                                            ? undefined
                                                            : rule.unit).asMilliseconds();
                                            break;
                                        }
                                    }
                                }
                                else if (rule.action == "convert")
                                {
                                    if (rule.formatType == "custom")
                                    {
                                        output = formatCustomString(input, rule.format);
                                    }
                                    else if (rule.formatType == "string")
                                    {
                                        switch (rule.format)
                                        {
                                            case "timespan":
                                            {
                                                output = formatTimespanString(input, 1);
                                                break;
                                            }
                                            case "timespan10th":
                                            {
                                                output = formatTimespanString(input, 10);
                                                break;
                                            }
                                            case "timespan100th":
                                            {
                                                output = formatTimespanString(input, 100);
                                                break;
                                            }
                                            case "timespanMillis":
                                            {
                                                output = formatTimespanString(input, 1000);
                                                break;
                                            }
                                            case "textualTimespan":
                                            {
                                                output = input.humanize();
                                                break;
                                            }
                                            case "iso8601":
                                            {
                                                output = formatISOString(input);
                                                break;
                                            }
                                        }
                                    }
                                    else
                                    {
                                        output = input.as(rule.format);

                                        if (rule.precisionType == "int")
                                        {
                                            switch (rule.precision)
                                            {
                                                case "round":
                                                {
                                                    output = Math.round(output);
                                                    break;
                                                }
                                                case "floor":
                                                {
                                                    output = Math.floor(output);
                                                    break;
                                                }
                                                case "ceil":
                                                {
                                                    output = Math.ceil(output);
                                                    break;
                                                }
                                            }
                                        }
                                        else if ((rule.precisionType == "float") && (rule.precision > 0))
                                        {
                                            const exp = Math.pow(10, rule.precision);
                                            output = Math.round(output * exp) / exp;
                                        }
                                    }
                                }

                                setTarget(msg, rule.target, output);
                            }
                            else
                            {
                                let prop = rule.target.name;
                                if ((rule.target.type == "global") || (rule.target.type == "flow"))
                                {
                                    let ctx = RED.util.parseContextStore(rule.target.name);
                                    prop = ctx.key + (ctx.store ? " (" + ctx.store + ")" : "");
                                }

                                node.error(RED._("change.error.invalidProperty", {property: rule.target.type + "." + prop}), msg);
                            }
                        }
                    }
                    catch (e)
                    {
                        if (e instanceof node.chronos.TimeError)
                        {
                            let errMsg = RED.util.cloneMessage(msg);

                            if ("errorDetails" in errMsg)
                            {
                                errMsg._errorDetails = errMsg.errorDetails;
                            }
                            errMsg.errorDetails = e.details;

                            node.error(e.message, errMsg);
                        }
                        else
                        {
                            throw e;
                        }
                    }
                }

                node.send(msg);
                done();
            }
        });

        function setPart(input, part, value)
        {
            switch (part)
            {
                case "year":
                {
                    input.year(value);
                    break;
                }
                case "quarter":
                {
                    input.quarter(value);
                    break;
                }
                case "month":
                {
                    input.month(value - 1);
                    break;
                }
                case "week":
                {
                    input.week(value);
                    break;
                }
                case "weekday":
                {
                    input.weekday(value - 1);
                    break;
                }
                case "day":
                {
                    input.date(value);
                    break;
                }
                case "hour":
                {
                    input.hour(value);
                    break;
                }
                case "minute":
                {
                    input.minute(value);
                    break;
                }
                case "second":
                {
                    input.second(value);
                    break;
                }
                case "millisecond":
                {
                    input.millisecond(value);
                    break;
                }
            }

            return input.valueOf();
        }

        function addTime(input, value, unit)
        {
            return input.add(getNumber(value), unit);
        }

        function subtractTime(input, value, unit)
        {
            return input.subtract(getNumber(value), unit);
        }

        function getNumber(value)
        {
            node.debug("val: " + value + " type: " + (typeof value));
            if ((typeof value != "number") && (typeof value != "string"))
            {
                throw new node.chronos.TimeError(RED._("change.error.invalidNumber"), {value: value});
            }

            if (typeof value == "string")
            {
                if ((value.length > 0) && (+value === +value))
                {
                    value = +value;
                }
                else
                {
                    throw new node.chronos.TimeError(RED._("change.error.invalidNumber"), {value: value});
                }
            }

            node.debug("val: " + value + " type: " + (typeof value));
            return value;
        }

        function getValue(msg, value, type)
        {
            let ret = undefined;

            if (type == "env")
            {
                if (typeof value == "string")
                {
                    ret = RED.util.evaluateNodeProperty(value, type, node);
                }

                if ((typeof ret == "undefined") || ((typeof ret == "string") && (ret.length == 0)))
                {
                    ret = value;
                }
            }
            else if ((type == "global") || (type == "flow"))
            {
                const ctx = RED.util.parseContextStore(value);
                ret = node.context()[type].get(ctx.key, ctx.store);
            }
            else if (type == "msg")
            {
                ret = RED.util.getMessageProperty(msg, value);
            }
            else
            {
                ret = value;
            }

            return ret;
        }

        function setTarget(msg, target, value)
        {
            if ((target.type == "global") || (target.type == "flow"))
            {
                const ctx = RED.util.parseContextStore(target.name);
                node.context()[target.type].set(ctx.key, value, ctx.store);
            }
            else if (target.type == "msg")
            {
                RED.util.setMessageProperty(msg, target.name, value, true);
            }
        }

        function formatTimespanString(input, precision)
        {
            let ret = "";

            const days = Math.floor(input.asDays());
            if (days > 0)
            {
                ret += days + ".";
            }

            const hours = input.hours();
            if (hours > 0)
            {
                ret += String(hours).padStart(2, "0") + ":";
            }
            else if (ret.length > 0)
            {
                ret += "00:";
            }

            const minutes = input.minutes();
            if (minutes > 0)
            {
                ret += String(minutes).padStart(2, "0") + ":";
            }
            else if (ret.length > 0)
            {
                ret += "00:";
            }

            const seconds = input.seconds();
            if (seconds > 0)
            {
                ret += String(seconds).padStart(2, "0");
            }
            else if (ret.length > 0)
            {
                ret += "00:";
            }

            if (precision != 1)
            {
                if (ret.length > 0)
                {
                    ret += ".";
                }

                const milliseconds = input.milliseconds();
                if (milliseconds > 0)
                {
                    switch (precision)
                    {
                        case 10:
                        {
                            ret += Math.floor(milliseconds/100);
                            break;
                        }
                        case 100:
                        {
                            ret += Math.floor(milliseconds/10);
                            break;
                        }
                        case 1000:
                        {
                            ret += milliseconds;
                            break;
                        }
                    }
                }
            }

            return ret;
        }

        function formatISOString(input)
        {
            let ret = "P";

            const years = input.years();
            if (years > 0)
            {
                ret += years + "Y";
            }

            const months = input.months();
            if (months > 0)
            {
                ret += months + "M";
            }

            const days = input.days();
            if (days > 0)
            {
                ret += days + "D";
            }

            let time = "T";

            const hours = input.hours();
            if (hours > 0)
            {
                time += hours + "H";
            }

            const minutes = input.minutes();
            if (minutes > 0)
            {
                time += minutes + "M";
            }

            const seconds = input.seconds();
            if (seconds > 0)
            {
                time += seconds;

                const milliseconds = input.milliseconds();
                if (milliseconds > 0)
                {
                    time += "." + String(milliseconds).padStart(3, "0");
                }

                time += "S";
            }

            if (time != "T")
            {
                ret += time;
            }

            if (ret == "P")
            {
                ret += "T0S";
            }

            return ret;
        }

        function formatCustomString(input, format)
        {
            let ret = "";

            const tokens = format.match(TOKENIZER_PATTERN);
            if (tokens)
            {
                for (const token of tokens)
                {
                    if (token == "y")
                    {
                        ret += input.years();
                    }
                    else if (token == "M")
                    {
                        ret += input.months();
                    }
                    else if (token == "w")
                    {
                        ret += input.weeks();
                    }
                    else if (token == "d")
                    {
                        ret += input.days();
                    }
                    else if (token == "h")
                    {
                        ret += input.hours();
                    }
                    else if (token == "hh")
                    {
                        ret += String(input.hours()).padStart(2, "0");
                    }
                    else if (token == "m")
                    {
                        ret += input.minutes();
                    }
                    else if (token == "mm")
                    {
                        ret += String(input.minutes()).padStart(2, "0");
                    }
                    else if (token == "s")
                    {
                        ret += input.seconds();
                    }
                    else if (token == "ss")
                    {
                        ret += String(input.seconds()).padStart(2, "0");
                    }
                    else if (token == "S")
                    {
                        ret += Math.floor(input.milliseconds() / 100);
                    }
                    else if (token == "SS")
                    {
                        ret += String(Math.floor(input.milliseconds() / 10)).padStart(2, "0");
                    }
                    else if (token == "SSS")
                    {
                        ret += String(input.milliseconds()).padStart(3, "0");
                    }
                    else if (token.startsWith("["))
                    {
                        ret += token.substring(1, token.length-1);
                    }
                    else
                    {
                        ret += token;
                    }
                }

                return ret;
            }
        }
    }

    RED.nodes.registerType("chronos-change", ChronosChangeNode);
};
