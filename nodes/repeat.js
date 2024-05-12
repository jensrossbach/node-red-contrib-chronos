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

module.exports = function(RED)
{
    function ChronosRepeatNode(settings)
    {
        const MS_PER_SECOND = 1000;
        const MS_PER_WEEK   = MS_PER_SECOND * 60 * 60 * 24 * 7;

        const chronos = require("./common/chronos.js");
        const cronosjs = require("cronosjs");

        const node = this;
        RED.nodes.createNode(node, settings);

        node.name = settings.name;
        node.config = RED.nodes.getNode(settings.config);
        node.locale = ("lang" in RED.settings) ? RED.settings.lang : require("os-locale").sync();

        // backward compatibility to v1.14.x and earlier
        if (typeof settings.mode == "undefined")
        {
            settings.mode = "simple";
        }
        if (typeof settings.crontab == "undefined")
        {
            settings.crontab = "";
        }
        if (typeof settings.msgIngress == "undefined")
        {
            settings.msgIngress = "forward:forced";
        }

        // backward compatibility to v1.18.x and earlier
        if (typeof settings.customRepetitionType == "undefined")
        {
            settings.customRepetitionType = "jsonata";
        }
        if (typeof settings.customRepetitionValue == "undefined")
        {
            if (typeof settings.expression != "undefined")
            {
                settings.customRepetitionValue = settings.expression;
            }
            else
            {
                settings.customRepetitionValue = "";
            }
        }

        if (!node.config)
        {
            node.status({fill: "red", shape: "dot", text: "node-red-contrib-chronos/chronos-config:common.status.noConfig"});
            node.error(RED._("node-red-contrib-chronos/chronos-config:common.error.noConfig"));
        }
        else if (Number.isNaN(node.config.latitude) || Number.isNaN(node.config.longitude))
        {
            node.status({fill: "red", shape: "dot", text: "node-red-contrib-chronos/chronos-config:common.status.invalidConfig"});
            node.error(RED._("node-red-contrib-chronos/chronos-config:common.error.invalidConfig"));
        }
        else if (!chronos.validateTimeZone(node))
        {
            node.status({fill: "red", shape: "dot", text: "node-red-contrib-chronos/chronos-config:common.status.invalidConfig"});
            node.error(RED._("node-red-contrib-chronos/chronos-config:common.error.invalidConfig"));
        }
        else if ((settings.mode == "advanced") && !cronosjs.validate(settings.crontab))
        {
            node.status({fill: "red", shape: "dot", text: "node-red-contrib-chronos/chronos-config:common.status.invalidConfig"});
            node.error(RED._("node-red-contrib-chronos/chronos-config:common.error.invalidConfig"));
        }
        else
        {
            chronos.printNodeInfo(node);
            node.status({});

            node.mode = settings.mode;
            node.interval = settings.interval;
            node.intervalUnit = settings.intervalUnit;
            node.crontab = settings.crontab;
            node.customRepetitionType = settings.customRepetitionType;
            node.customRepetitionValue = settings.customRepetitionValue;
            node.untilType = settings.untilType;
            node.untilValue = settings.untilValue;
            node.untilDate = settings.untilDate;
            node.untilOffset = settings.untilOffset;
            node.untilRandom = settings.untilRandom;
            node.msgIngress = settings.msgIngress;
            node.preserveCtrlProps = settings.preserveCtrlProps;
            node.ignoreCtrlProps = settings.ignoreCtrlProps;

            node.sendTime = null;

            let valid = true;
            if ((node.mode == "custom") && (node.customRepetitionType == "jsonata"))
            {
                try
                {
                    node.expression = chronos.getJSONataExpression(RED, node, node.customRepetitionValue);
                }
                catch(e)
                {
                    node.error(e.message);
                    node.debug("JSONata code: " + e.code + "  position: " + e.position + "  token: " + e.token + "  value: " + e.value);

                    valid = false;
                }
            }

            if (valid && (node.untilType == "jsonata"))
            {
                try
                {
                    node.untilExpression = chronos.getJSONataExpression(RED, node, node.untilValue);
                }
                catch(e)
                {
                    node.error(e.message);
                    node.debug("JSONata code: " + e.code + "  position: " + e.position + "  token: " + e.token + "  value: " + e.value);

                    valid = false;
                }
            }

            if (!valid)
            {
                node.status({fill: "red", shape: "dot", text: "node-red-contrib-chronos/chronos-config:common.status.invalidConfig"});
                node.error(RED._("node-red-contrib-chronos/chronos-config:common.error.invalidConfig"));
            }
            else if ((node.untilType == "time") && !chronos.isValidUserTime(node.untilValue))
            {
                node.status({fill: "red", shape: "dot", text: "node-red-contrib-chronos/chronos-config:common.status.invalidConfig"});
                node.error(RED._("node-red-contrib-chronos/chronos-config:common.error.invalidConfig"));
            }
            else
            {
                node.on("close", () =>
                {
                    tearDownRepeatTimer();
                });

                node.on("input", async(msg, send, done) =>
                {
                    if (msg)
                    {
                        if (!send || !done)  // Node-RED 0.x not supported anymore
                        {
                            return;
                        }

                        tearDownRepeatTimer();

                        if (!node.ignoreCtrlProps && ("stop" in msg))
                        {
                            updateStatus();
                            done();
                        }
                        else
                        {
                            try
                            {
                                if (await scheduleMessage(msg))
                                {
                                    send(node.message);
                                }

                                done();
                            }
                            catch (e)
                            {
                                if (e instanceof chronos.TimeError)
                                {
                                    if (e.details)
                                    {
                                        if ("errorDetails" in msg)
                                        {
                                            msg._errorDetails = msg.errorDetails;
                                        }
                                        msg.errorDetails = e.details;
                                    }

                                    done(e.message);
                                }
                                else
                                {
                                    node.error(e.message);
                                    node.debug(e.stack);
                                    done();
                                }
                            }

                        }
                    }
                });
            }
        }

        async function scheduleMessage(msg)
        {
            const now = chronos.getCurrentTime(node);

            let mode = node.mode;
            let interval = node.interval;
            let intervalUnit = node.intervalUnit;
            let crontab = node.crontab;
            let untilType = node.untilType;
            let untilValue = node.untilValue;
            let untilDate = node.untilDate;
            let untilOffset = node.untilOffset;
            let untilRandom = node.untilRandom;
            let msgIngress = node.msgIngress;

            if (node.ignoreCtrlProps)
            {
                node.debug("Ignoring control properties");
            }
            else
            {
                if (isValidInterval(msg.interval))
                {
                    node.debug("Input message has override property for interval");

                    mode = "simple";
                    interval = msg.interval.value;
                    intervalUnit = msg.interval.unit;

                    if (!node.preserveCtrlProps)
                    {
                        delete msg.interval;
                    }
                }

                if (isValidCrontab(msg.crontab))
                {
                    node.debug("Input message has override property for cron table");

                    mode = "advanced";
                    crontab = msg.crontab;

                    if (!node.preserveCtrlProps)
                    {
                        delete msg.crontab;
                    }
                }

                if (isValidStructuredUntilTime(msg.until))
                {
                    node.debug("Input message has override property for until time");

                    if (msg.until)
                    {
                        untilType = msg.until.type;
                        untilValue = msg.until.value;
                        untilDate = msg.until.date;
                        untilOffset = (typeof msg.until.offset == "number") ? msg.until.offset : 0;
                        untilRandom = (msg.until.random === true);
                    }
                    else
                    {
                        untilType = "nextMsg";
                        untilValue = "";
                        untilDate = null;
                        untilOffset = 0;
                        untilRandom = false;
                    }

                    if (!node.preserveCtrlProps)
                    {
                        delete msg.until;
                    }
                }

                if (hasIngressOverride(msg.ingress))
                {
                    node.debug("Input message has override property for ingress behavior '" + msg.ingress + "'");

                    msgIngress = msg.ingress;

                    if (!node.preserveCtrlProps)
                    {
                        delete msg.ingress;
                    }
                }
            }

            node.message = msg;

            if ((mode == "custom") && (node.customRepetitionType != "jsonata"))
            {
                let ctxData = undefined;
                let errorDetails = undefined;

                if (node.customRepetitionType == "env")
                {
                    if (typeof node.customRepetitionValue == "string")
                    {
                        ctxData = RED.util.evaluateNodeProperty(
                                                node.customRepetitionValue,
                                                node.customRepetitionType,
                                                node);
                    }
                    else
                    {
                        ctxData = node.customRepetitionValue;
                    }

                    errorDetails = {variable: "${" + node.customRepetitionValue + "}"};
                }
                else
                {
                    const ctx = RED.util.parseContextStore(node.customRepetitionValue);

                    ctxData = node.context()[node.customRepetitionType].get(ctx.key, ctx.store);
                    errorDetails = {store: ctx.store, key: ctx.key, value: ctxData};
                }

                if (isValidInterval(ctxData))
                {
                    mode = "simple";
                    interval = ctxData.value;
                    intervalUnit = ctxData.unit;
                }
                else if (isValidCrontab(ctxData))
                {
                    mode = "advanced";
                    crontab = ctxData;
                }
                else
                {
                    throw new chronos.TimeError(
                                RED._("node-red-contrib-chronos/chronos-config:common.error.invalidContext"),
                                errorDetails);
                }
            }

            const untilTime = getUntilTime(
                                now,
                                untilDate,
                                untilType,
                                untilValue,
                                untilOffset,
                                untilRandom);

            if (mode == "simple")
            {
                await setupSimpleRepeatTimer(now, interval, intervalUnit, untilTime);
            }
            else if (mode == "advanced")
            {
                await setupAdvancedRepeatTimer(crontab, untilTime);
            }
            else
            {
                await setupCustomRepeatTimer(now, untilTime);
            }

            return (((msgIngress == "forward") && !await untilTime.isExceededAt(now)) ||
                    (msgIngress == "forward:forced"));
        }

        function getUntilTime(now, date, type, value, offset, random)
        {
            let ret = {};

            if ((type == "env") || (type == "global") || (type == "flow") || (type == "msg"))
            {
                let ctxData = undefined;

                if (type == "env")
                {
                    if (typeof value == "string")
                    {
                        ctxData = RED.util.evaluateNodeProperty(
                                                value,
                                                type,
                                                node);
                        if (!ctxData)
                        {
                            ctxData = value;
                        }
                    }
                    else
                    {
                        ctxData = value;
                    }
                }
                else if ((type == "global") || (type == "flow"))
                {
                    const ctx = RED.util.parseContextStore(value);
                    ctxData = node.context()[type].get(ctx.key, ctx.store);
                }
                else
                {
                    ctxData = RED.util.getMessageProperty(node.message, value);
                }

                if (isValidFlatUntilTime(ctxData))
                {
                    return getUntilTime(
                                now,
                                date,
                                "auto",
                                ctxData,
                                offset,
                                random);
                }
                else if (isValidStructuredUntilTime(ctxData))
                {
                    if (ctxData)
                    {
                        return getUntilTime(
                                    now,
                                    ctxData.date,
                                    ctxData.type,
                                    ctxData.value,
                                    (typeof ctxData.offset == "number")
                                        ? ctxData.offset
                                        : 0,
                                    ctxData.random === true);
                    }
                    else
                    {
                        return getUntilTime(now, null, "nextMsg", "", 0, false);
                    }
                }
                else
                {
                    throw new chronos.TimeError(
                                RED._("node-red-contrib-chronos/chronos-config:common.error.invalidContext"),
                                {type: type, value: ctxData});
                }
            }
            else if (type == "jsonata")
            {
                ret.expression = node.untilExpression;

                ret.isExceededAt = async function(next)
                {
                    let result = false;

                    try
                    {
                        this.expression.assign("next", next.valueOf());
                        result = await chronos.evaluateJSONataExpression(RED, this.expression, node.message);
                    }
                    catch(e)
                    {
                        const details =
                        {
                            expression: value,
                            code: e.code,
                            description: e.message,
                            position: e.position,
                            token: e.token
                        };

                        if (e.value)
                        {
                            details.value = e.value;
                        }

                        throw new chronos.TimeError(
                                    RED._("node-red-contrib-chronos/chronos-config:common.error.evaluationFailed"),
                                    details);
                    }

                    if (typeof result != "boolean")
                    {
                        throw new chronos.TimeError(
                                    RED._("node-red-contrib-chronos/chronos-config:common.error.notBoolean"),
                                    {expression: value, result: result});
                    }

                    return result;
                };

                ret.print = function()
                {
                    return "ending expression evaluates to true";
                };
            }
            else if (type == "nextMsg")
            {
                ret.isExceededAt = async function()
                {
                    return false;
                };

                ret.print = function()
                {
                    return "next message";
                };
            }
            else
            {
                const base = date ? chronos.getUserDate(RED, node, date) : now.clone();
                ret.time = chronos.getTime(RED, node, base, type, value);

                if (offset != 0)
                {
                    ret.time.add(random ? Math.round(Math.random() * offset) : offset, "minutes");
                }

                if (!date && !ret.time.hasUserDate() && ret.time.isBefore(now))
                {
                    ret.time.add(1, "days");
                }

                ret.isExceededAt = async function(next)
                {
                    return next.isAfter(this.time);
                };

                ret.print = function()
                {
                    return this.time.format("YYYY-MM-DD HH:mm:ss (Z)");
                };
            }

            return ret;
        }

        async function setupSimpleRepeatTimer(now, interval, intervalUnit, untilTime)
        {
            node.debug("Set up timer for interval " + interval + " " + intervalUnit + " until " + untilTime.print());
            node.sendTime = now.clone().add(interval, intervalUnit);

            if (!await untilTime.isExceededAt(node.sendTime))
            {
                node.debug("Starting timer for repeated message at " + node.sendTime.format("YYYY-MM-DD HH:mm:ss (Z)"));
                node.repeatTimer = setTimeout(() =>
                {
                    delete node.repeatTimer;

                    node.send(RED.util.cloneMessage(node.message));
                    setupSimpleRepeatTimer(chronos.getCurrentTime(node), interval, intervalUnit, untilTime);
                }, node.sendTime.diff(now));
            }
            else
            {
                node.sendTime = null;
            }

            updateStatus();
        }

        async function setupAdvancedRepeatTimer(crontab, untilTime)
        {
            node.debug("Set up timer for cron table '" + crontab + "' until " + untilTime.print());

            const expression = cronosjs.CronosExpression.parse(crontab);
            let firstTrigger = expression.nextDate();

            if (firstTrigger)
            {
                node.sendTime = chronos.getTimeFrom(node, firstTrigger);

                if (!await untilTime.isExceededAt(node.sendTime))
                {
                    node.repeatTimer = new cronosjs.CronosTask(expression);

                    node.repeatTimer.on("run", async() =>
                    {
                        node.send(RED.util.cloneMessage(node.message));

                        let nextTrigger = expression.nextDate();
                        if (nextTrigger)
                        {
                            node.sendTime = chronos.getTimeFrom(node, nextTrigger);
                            if (await untilTime.isExceededAt(node.sendTime))
                            {
                                node.repeatTimer.stop();

                                delete node.repeatTimer;
                                node.sendTime = null;
                            }
                        }
                        else
                        {
                            delete node.repeatTimer;
                            node.sendTime = null;
                        }

                        updateStatus();
                    });

                    node.repeatTimer.start();
                }
                else
                {
                    node.sendTime = null;
                }
            }

            updateStatus();
        }

        async function setupCustomRepeatTimer(now, untilTime)
        {
            node.debug("Set up timer for trigger expression until " + untilTime.print());

            let result = null;

            try
            {
                result = await chronos.evaluateJSONataExpression(RED, node.expression, node.message);
            }
            catch(e)
            {
                const details = {expression: node.customRepetitionValue, code: e.code, description: e.message, position: e.position, token: e.token};
                if (e.value)
                {
                    details.value = e.value;
                }

                throw new chronos.TimeError(
                            RED._("node-red-contrib-chronos/chronos-config:common.error.evaluationFailed"),
                            details);
            }

            if ((typeof result != "number") && (typeof result != "string"))
            {
                throw new chronos.TimeError(
                            RED._("node-red-contrib-chronos/chronos-config:common.error.notTime"),
                            {expression: node.customRepetitionValue, result: result});
            }

            if ((typeof result == "string") || (result >= (now.valueOf() + MS_PER_SECOND)))  // assumed to be absolute time of next trigger
            {
                node.sendTime = chronos.getTimeFrom(node, result);
            }
            else if ((result >= MS_PER_SECOND) && (result <= MS_PER_WEEK))  // assumed to be a relative interval time
            {
                node.sendTime = now.clone().add(result, "milliseconds");
            }
            else
            {
                throw new chronos.TimeError(
                            RED._("node-red-contrib-chronos/chronos-config:common.error.intervalOutOfRange"),
                            {expression: node.customRepetitionValue, result: result});
            }

            if (!node.sendTime.isValid())
            {
                node.sendTime = null;
                throw new chronos.TimeError(
                            RED._("node-red-contrib-chronos/chronos-config:common.error.notTime"),
                            {expression: node.customRepetitionValue, result: result});
            }
            if ((node.sendTime.diff(now) < MS_PER_SECOND) || (node.sendTime.diff(now) > MS_PER_WEEK))
            {
                node.sendTime = null;
                throw new chronos.TimeError(
                            RED._("node-red-contrib-chronos/chronos-config:common.error.intervalOutOfRange"),
                            {expression: node.customRepetitionValue, result: result});
            }

            if (!await untilTime.isExceededAt(node.sendTime))
            {
                node.debug("Starting timer for repeated message at " + node.sendTime.format("YYYY-MM-DD HH:mm:ss (Z)"));
                node.repeatTimer = setTimeout(() =>
                {
                    delete node.repeatTimer;

                    node.send(RED.util.cloneMessage(node.message));
                    setupCustomRepeatTimer(chronos.getCurrentTime(node), untilTime);
                }, node.sendTime.diff(now));
            }
            else
            {
                node.sendTime = null;
            }

            updateStatus();
        }

        function tearDownRepeatTimer()
        {
            if (node.repeatTimer)
            {
                node.debug("Tear down timer");

                if (node.repeatTimer instanceof cronosjs.CronosTask)
                {
                    node.repeatTimer.stop();
                }
                else
                {
                    clearTimeout(node.repeatTimer);
                }

                delete node.repeatTimer;
                node.sendTime = null;
            }
        }

        function isValidInterval(data)
        {
            if ((typeof data != "object") || !data)
            {
                return false;
            }

            if (!/^(seconds|minutes|hours)$/.test(data.unit))
            {
                return false;
            }

            if ((typeof data.value != "number") ||
                (((data.unit == "seconds") || (data.unit == "minutes")) && ((data.value < 1) || (data.value > 59))) ||
                ((data.unit == "hours") && ((data.value < 1) || (data.value > 24))))
            {
                return false;
            }

            return true;
        }

        function isValidCrontab(data)
        {
            if ((typeof data != "string") || !data)
            {
                return false;
            }

            if (!cronosjs.validate(data))
            {
                return false;
            }

            return true;
        }

        function isValidFlatUntilTime(data)
        {
            if ((typeof data != "string") && (typeof data != "number"))
            {
                return false;
            }

            // datetime strings can be quite complex, so don't try to validate them here
            if ((typeof data == "string") && !data)
            {
                return false;
            }

            if ((typeof data == "number") && (data < 0))
            {
                return false;
            }

            return true;
        }

        function isValidStructuredUntilTime(data)
        {
            if (typeof data != "object")
            {
                return false;
            }

            if (data)
            {
                if (!/^(time|sun|moon|custom)$/.test(data.type))
                {
                    return false;
                }

                if (((typeof data.value != "string") && (typeof data.value != "number")) ||
                    ((data.type == "time") && !chronos.isValidUserTime(data.value)) ||
                    ((data.type == "sun") && !chronos.PATTERN_SUNTIME.test(data.value)) ||
                    ((data.type == "moon") && !chronos.PATTERN_MOONTIME.test(data.value)))
                {
                    return false;
                }

                if ((typeof data.date != "undefined") && (typeof data.date != "string"))
                {
                    return false;
                }

                if ((typeof data.date == "string") && !chronos.isValidUserDate(data.date))
                {
                    return false;
                }

                if ((typeof data.offset != "undefined") && (typeof data.offset != "number"))
                {
                    return false;
                }

                if ((typeof data.offset == "number") && ((data.offset < -300) || (data.offset > 300)))
                {
                    return false;
                }

                if ((typeof data.random != "undefined") && (typeof data.random != "boolean"))
                {
                    return false;
                }
            }

            return true;
        }

        function hasIngressOverride(data)
        {
            if ((typeof data != "string")  || !data)
            {
                return false;
            }

            if (!/^(noop|forward|forward:forced)$/.test(data))
            {
                return false;
            }

            return true;
        }

        function updateStatus()
        {
            if (node.sendTime)
            {
                let when = node.sendTime.calendar(
                {
                    sameDay: function()
                    {
                        return "LT" + ((this.second() > 0) ? "S" : "");
                    },
                    nextDay: function()
                    {
                        return "l LT" + ((this.second() > 0) ? "S" : "");
                    }
                });

                node.status({fill: "blue", shape: "dot", text: RED._("repeat.status.next") + " " + when});
            }
            else
            {
                node.status({});
            }
        }
    }

    RED.nodes.registerType("chronos-repeat", ChronosRepeatNode);
};
