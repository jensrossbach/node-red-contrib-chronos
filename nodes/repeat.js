/*
 * Copyright (c) 2023 Jens-Uwe Rossbach
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

        let node = this;
        RED.nodes.createNode(node, settings);

        node.config = RED.nodes.getNode(settings.config);
        node.locale = require("os-locale").sync();

        // backward compatibility to v1.14.x and earlier
        if (typeof settings.mode == "undefined")
        {
            settings.mode = "simple";
        }
        if (typeof settings.msgIngress == "undefined")
        {
            settings.msgIngress = "forward:forced";
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
            node.crontab = (typeof settings.crontab == "undefined") ? "" : settings.crontab;
            node.expression = (typeof settings.expression == "undefined") ? "" : settings.expression;
            node.untilType = settings.untilType;
            node.untilValue = settings.untilValue;
            node.untilDate = settings.untilDate;
            node.untilOffset = settings.untilOffset;
            node.untilRandom = settings.untilRandom;
            node.msgIngress = settings.msgIngress;
            node.preserveCtrlProps = settings.preserveCtrlProps;
            node.ignoreCtrlProps = settings.ignoreCtrlProps;

            node.sendTime = null;

            if ((node.untilType == "time") && !chronos.isValidUserTime(node.untilValue))
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

                node.on("input", (msg, send, done) =>
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
                                if (scheduleMessage(msg))
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

        function scheduleMessage(msg)
        {
            const now = chronos.getCurrentTime(node);

            let mode = node.mode;
            let interval = node.interval;
            let intervalUnit = node.intervalUnit;
            let crontab = node.crontab;
            let expression = node.expression;
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
                if (hasIntervalOverride(msg.interval))
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

                if (hasCrontabOverride(msg.crontab))
                {
                    node.debug("Input message has override property for cron table");

                    mode = "advanced";
                    crontab = msg.crontab;

                    if (!node.preserveCtrlProps)
                    {
                        delete msg.crontab;
                    }
                }

                if (hasExpressionOverride(msg.expression))
                {
                    node.debug("Input message has override property for expression");

                    mode = "custom";
                    expression = msg.expression;

                    if (!node.preserveCtrlProps)
                    {
                        delete msg.expression;
                    }
                }

                if (hasUntilOverride(msg.until))
                {
                    node.debug("Input message has override property for until time");

                    if (msg.until != null)
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
                    node.debug("Input message has override property for ingress behavior '" +  msg.ingress + "'");

                    msgIngress = msg.ingress;

                    if (!node.preserveCtrlProps)
                    {
                        delete msg.ingress;
                    }
                }
            }

            node.message = msg;

            const untilTime = getUntilTime(untilDate ? chronos.getUserDate(RED, node, untilDate) : now, untilType, untilValue, untilOffset, untilRandom);
            if (mode == "simple")
            {
                setupSimpleRepeatTimer(now, interval, intervalUnit, untilTime);
            }
            else if (mode == "advanced")
            {
                setupAdvancedRepeatTimer(crontab, untilTime);
            }
            else
            {
                setupCustomRepeatTimer(now, expression, untilTime);
            }

            return (((msgIngress == "forward") && !untilTime.isExceededAt(now)) ||
                    (msgIngress == "forward:forced"));
        }

        function getUntilTime(now, type, value, offset, random)
        {
            let ret = {};

            if (type == "jsonata")
            {
                ret.expression = value;

                ret.isExceededAt = function(next)
                {
                    let result = false;

                    try
                    {
                        let expression = chronos.getJSONataExpression(RED, node, this.expression);
                        expression.assign("next", next.valueOf());

                        result = RED.util.evaluateJSONataExpression(expression, node.message);
                    }
                    catch(e)
                    {
                        const details = {expression: this.expression, code: e.code, description: e.message, position: e.position, token: e.token};
                        if (e.value)
                        {
                            details.value = e.value;
                        }

                        throw new chronos.TimeError(RED._("node-red-contrib-chronos/chronos-config:common.error.evaluationFailed"), details);
                    }

                    if (typeof result != "boolean")
                    {
                        throw new chronos.TimeError(RED._("node-red-contrib-chronos/chronos-config:common.error.notBoolean"),
                                                    {expression: this.expression, result: result});
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
                ret.isExceededAt = function()
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
                ret.time = chronos.getTime(RED, node, now.clone(), type, value);

                if (offset != 0)
                {
                    ret.time.add(random ? Math.round(Math.random() * offset) : offset, "minutes");
                }

                ret.isExceededAt = function(next)
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

        function setupSimpleRepeatTimer(now, interval, intervalUnit, untilTime)
        {
            node.debug("Set up timer for interval " + interval + " " + intervalUnit + " until " + untilTime.print());
            node.sendTime = now.clone().add(interval, intervalUnit);

            if (!untilTime.isExceededAt(node.sendTime))
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

        function setupAdvancedRepeatTimer(crontab, untilTime)
        {
            node.debug("Set up timer for cron table '" + crontab + "' until " + untilTime.print());

            const expression = cronosjs.CronosExpression.parse(crontab);
            let firstTrigger = expression.nextDate();

            if (firstTrigger)
            {
                node.sendTime = chronos.getTimeFrom(node, firstTrigger);

                if (!untilTime.isExceededAt(node.sendTime))
                {
                    node.repeatTimer = new cronosjs.CronosTask(expression);

                    node.repeatTimer.on("run", () =>
                    {
                        node.send(RED.util.cloneMessage(node.message));

                        let nextTrigger = expression.nextDate();
                        if (nextTrigger)
                        {
                            node.sendTime = chronos.getTimeFrom(node, nextTrigger);
                            if (untilTime.isExceededAt(node.sendTime))
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

        function setupCustomRepeatTimer(now, expression, untilTime)
        {
            node.debug("Set up timer for trigger expression until " + untilTime.print());

            let result = null;

            try
            {
                let expr = chronos.getJSONataExpression(RED, node, expression);
                result = RED.util.evaluateJSONataExpression(expr, node.message);
            }
            catch(e)
            {
                const details = {expression: expression, code: e.code, description: e.message, position: e.position, token: e.token};
                if (e.value)
                {
                    details.value = e.value;
                }

                throw new chronos.TimeError(RED._("node-red-contrib-chronos/chronos-config:common.error.evaluationFailed"), details);
            }

            if ((typeof result != "number") && (typeof result != "string"))
            {
                throw new chronos.TimeError(RED._("node-red-contrib-chronos/chronos-config:common.error.notTime"),
                                            {expression: expression, result: result});
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
                throw new chronos.TimeError(RED._("node-red-contrib-chronos/chronos-config:common.error.intervalOutOfRange"),
                                            {expression: expression, result: result});
            }

            if (!node.sendTime.isValid())
            {
                node.sendTime = null;
                throw new chronos.TimeError(RED._("node-red-contrib-chronos/chronos-config:common.error.notTime"),
                                            {expression: expression, result: result});
            }
            if ((node.sendTime.diff(now) < MS_PER_SECOND) || (node.sendTime.diff(now) > MS_PER_WEEK))
            {
                node.sendTime = null;
                throw new chronos.TimeError(RED._("node-red-contrib-chronos/chronos-config:common.error.intervalOutOfRange"),
                                            {expression: expression, result: result});
            }

            if (!untilTime.isExceededAt(node.sendTime))
            {
                node.debug("Starting timer for repeated message at " + node.sendTime.format("YYYY-MM-DD HH:mm:ss (Z)"));
                node.repeatTimer = setTimeout(() =>
                {
                    delete node.repeatTimer;

                    node.send(RED.util.cloneMessage(node.message));
                    setupCustomRepeatTimer(chronos.getCurrentTime(node), expression, untilTime);
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

        function hasIntervalOverride(data)
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

        function hasCrontabOverride(data)
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

        function hasExpressionOverride(data)
        {
            if ((typeof data != "string") || !data)
            {
                return false;
            }

            return true;
        }

        function hasUntilOverride(data)
        {
            if (typeof data != "object")
            {
                return false;
            }

            if (data != null)
            {
                if (!/^(time|sun|moon|custom|jsonata)$/.test(data.type))
                {
                    return false;
                }

                if (((typeof data.value != "string") && (typeof data.value != "number")) ||
                    ((data.type == "time") && !chronos.isValidUserTime(data.value)) ||
                    ((data.type == "sun") && !/^(sunrise|sunriseEnd|sunsetStart|sunset|goldenHour|goldenHourEnd|night|nightEnd|dawn|nauticalDawn|dusk|nauticalDusk|solarNoon|nadir)$/.test(data.value)) ||
                    ((data.type == "moon") && !/^(rise|set)$/.test(data.value)))
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
