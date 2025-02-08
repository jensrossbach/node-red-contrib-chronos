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
    function ChronosDelayNode(settings)
    {
        const DAYS_PER_WEEK      =    7;
        const HOURS_PER_DAY      =   24;
        const MINUTES_PER_HOUR   =   60;
        const SECONDS_PER_MINUTE =   60;
        const MS_PER_SECOND      = 1000;

        const MS_PER_MINUTE      = MS_PER_SECOND * SECONDS_PER_MINUTE;
        const MS_PER_HOUR        = MS_PER_MINUTE * MINUTES_PER_HOUR;
        const MS_PER_DAY         = MS_PER_HOUR   * HOURS_PER_DAY;
        const MS_PER_WEEK        = MS_PER_DAY    * DAYS_PER_WEEK;

        const chronos = require("./common/chronos.js");

        let node = this;
        RED.nodes.createNode(node, settings);

        node.name = settings.name;
        node.config = RED.nodes.getNode(settings.config);
        node.locale = ("lang" in RED.settings) ? RED.settings.lang : require("os-locale").sync();

        // backward compatibility to v1.17.x and earlier
        if (typeof settings.delayType == "undefined")
        {
            settings.delayType = "pointInTime";
        }
        if (typeof settings.fixedDuration == "undefined")
        {
            settings.fixedDuration = 1;
        }
        if (typeof settings.randomDuration1 == "undefined")
        {
            settings.randomDuration1 = 1;
        }
        if (typeof settings.randomDuration2 == "undefined")
        {
            settings.randomDuration2 = 5;
        }
        if (typeof settings.fixedDurationUnit == "undefined")
        {
            settings.fixedDurationUnit = "seconds";
        }
        if (typeof settings.randomDurationUnit == "undefined")
        {
            settings.randomDurationUnit = "seconds";
        }
        if (typeof settings.randomizerMillis == "undefined")
        {
            settings.randomizerMillis = false;
        }

        // backward compatibility to v1.18.x and earlier
        if (typeof settings.customDelayType == "undefined")
        {
            settings.customDelayType = "jsonata";
        }
        if (typeof settings.customDelayValue == "undefined")
        {
            if (typeof settings.expression != "undefined")
            {
                settings.customDelayValue = settings.expression;
            }
            else
            {
                settings.customDelayValue = "";
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
        else
        {
            chronos.printNodeInfo(node);
            node.status({});

            node.delayType = settings.delayType;
            node.fixedDuration = parseInt(settings.fixedDuration);
            node.randomDuration1 = parseInt(settings.randomDuration1);
            node.randomDuration2 = parseInt(settings.randomDuration2);
            node.fixedDurationUnit = settings.fixedDurationUnit;
            node.randomDurationUnit = settings.randomDurationUnit;
            node.randomizerMillis = settings.randomizerMillis;
            node.whenType = settings.whenType;
            node.whenValue = settings.whenValue;
            node.offset = parseInt(settings.offset);
            node.random = settings.random;
            node.customDelayType = settings.customDelayType;
            node.customDelayValue = settings.customDelayValue;
            node.queueLimit =
                (settings.limitQueue === true)
                    ? parseInt(settings.queueLimit)
                    : 0;
            node.msgIngress = (typeof settings.msgIngress == "undefined") ? "drop:incoming" : settings.msgIngress;
            node.preserveCtrlProps = settings.preserveCtrlProps;
            node.ignoreCtrlProps = settings.ignoreCtrlProps;

            node.queueDuration = -1;
            node.sendTime = null;

            let valid = true;
            if ((node.delayType == "custom") && (node.customDelayType == "jsonata"))
            {
                try
                {
                    node.expression = chronos.getJSONataExpression(RED, node, node.customDelayValue);
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
            else if ((node.delayType == "pointInTime") && (node.whenType == "time") && !chronos.isValidUserTime(node.whenValue))
            {
                node.status({fill: "red", shape: "dot", text: "node-red-contrib-chronos/chronos-config:common.status.invalidConfig"});
                node.error(RED._("node-red-contrib-chronos/chronos-config:common.error.invalidConfig"));
            }
            else
            {
                node.msgQueue = [];

                node.on("close", () =>
                {
                    tearDownDelayTimer();
                });

                node.on("input", async(msg, send, done) =>
                {
                    if (msg)
                    {
                        if (!send || !done)  // Node-RED 0.x not supported anymore
                        {
                            return;
                        }

                        try
                        {
                            if (!node.ignoreCtrlProps && ("drop" in msg))
                            {
                                tearDownDelayTimer();

                                node.debug("Drop all enqueued messages");
                                dropQueue();

                                if ("enqueue" in msg)
                                {
                                    if (!node.preserveCtrlProps)
                                    {
                                        delete msg.drop;
                                        delete msg.enqueue;
                                    }

                                    await enqueueMessage(msg, done);
                                }
                                else
                                {
                                    // we're done with the message as it gets discarded
                                    done();
                                }
                            }
                            else if (!node.ignoreCtrlProps && ("flush" in msg))
                            {
                                tearDownDelayTimer();
                                flushQueue();

                                if ("enqueue" in msg)
                                {
                                    if (!node.preserveCtrlProps)
                                    {
                                        delete msg.flush;
                                        delete msg.enqueue;
                                    }

                                    await enqueueMessage(msg, done);
                                }
                                else
                                {
                                    // we're done with the message as it gets discarded
                                    done();
                                }
                            }
                            else
                            {
                                await enqueueMessage(msg, done);
                            }
                        }
                        catch (e)
                        {
                            if (e instanceof chronos.TimeError)
                            {
                                node.error(e.message, {errorDetails: e.details});
                                node.status({fill: "red", shape: "dot", text: "delay.status.error"});
                            }
                            else
                            {
                                node.error(e.message);
                                node.debug(e.stack);
                            }

                            // we're done with the message as we do not enqueue it
                            done();
                        }
                    }
                });
            }
        }

        async function enqueueMessage(msg, done)
        {
            let delayType = node.delayType;
            let fixedDuration = node.fixedDuration;
            let fixedDurationUnit = node.fixedDurationUnit;
            let randomDuration1 = node.randomDuration1;
            let randomDuration2 = node.randomDuration2;
            let randomDurationUnit = node.randomDurationUnit;
            let randomizerMillis = node.randomizerMillis;
            let whenType = node.whenType;
            let whenValue = node.whenValue;
            let whenOffset = node.offset;
            let whenRandom = node.random;

            if ((node.queueLimit > 0) && (node.msgQueue.length >= node.queueLimit))
            {
                if (node.msgIngress == "drop:incoming")
                {
                    node.debug("Queue is full - drop incoming message");

                    done();
                    return;
                }

                if (node.msgIngress == "drop:oldest")
                {
                    node.debug("Queue is full - drop oldest message");
                    dropOldestItem();
                }
                else
                {
                    node.debug("Queue is full - flush oldest message");
                    flushOldestItem();
                }
            }

            if (node.ignoreCtrlProps)
            {
                node.debug("Ignoring control properties");
            }
            else
            {
                if (isValidFixedDuration(msg.fixedDuration))
                {
                    node.debug("Input message has override property for fixed duration");

                    tearDownDelayTimer();

                    delayType = "fixedDuration";
                    fixedDuration = msg.fixedDuration.value;
                    fixedDurationUnit = msg.fixedDuration.unit;

                    if (!node.preserveCtrlProps)
                    {
                        delete msg.fixedDuration;
                    }
                }

                if (isValidRandomDuration(msg.randomDuration))
                {
                    node.debug("Input message has override property for random duration");

                    tearDownDelayTimer();

                    delayType = "randomDuration";
                    randomDuration1 = msg.randomDuration.value1;
                    randomDuration2 = msg.randomDuration.value2;
                    randomDurationUnit = msg.randomDuration.unit;
                    randomizerMillis = (msg.randomDuration.randomizerMillis === true);

                    if (!node.preserveCtrlProps)
                    {
                        delete msg.randomDuration;
                    }
                }

                if (isValidWhenTime(msg.when))
                {
                    node.debug("Input message has override property for point in time");

                    tearDownDelayTimer();

                    delayType = "pointInTime";
                    whenType = msg.when.type;
                    whenValue = msg.when.value;
                    whenOffset = (typeof msg.when.offset == "number") ? msg.when.offset : 0;
                    whenRandom = (msg.when.random === true);

                    if (!node.preserveCtrlProps)
                    {
                        delete msg.when;
                    }
                }
            }

            if (!node.delayTimer)
            {
                if ((delayType == "custom") && (node.customDelayType != "jsonata"))
                {
                    let ctxData = undefined;

                    if (node.customDelayType == "env")
                    {
                        if (typeof node.customDelayValue == "string")
                        {
                            ctxData = RED.util.evaluateNodeProperty(
                                                    node.customDelayValue,
                                                    node.customDelayType,
                                                    node);
                            if (!ctxData)
                            {
                                ctxData = node.customDelayValue;
                            }
                        }
                        else
                        {
                            ctxData = node.customDelayValue;
                        }
                    }
                    else if ((node.customDelayType == "global") || (node.customDelayType == "flow"))
                    {
                        const ctx = RED.util.parseContextStore(node.customDelayValue);
                        ctxData = node.context()[node.customDelayType].get(ctx.key, ctx.store);
                    }
                    else
                    {
                        ctxData = RED.util.getMessageProperty(msg, node.customDelayValue);
                    }

                    if (isValidFixedDuration(ctxData))
                    {
                        delayType = "fixedDuration";
                        fixedDuration = ctxData.value;
                        fixedDurationUnit = ctxData.unit;
                    }
                    else if (isValidRandomDuration(ctxData))
                    {
                        delayType = "randomDuration";
                        randomDuration1 = ctxData.value1;
                        randomDuration2 = ctxData.value2;
                        randomDurationUnit = ctxData.unit;
                        randomizerMillis = (ctxData.randomizerMillis === true);
                    }
                    else if (isValidWhenTime(ctxData))
                    {
                        delayType = "pointInTime";
                        whenType = ctxData.type;
                        whenValue = ctxData.value;
                        whenOffset = (typeof ctxData.offset == "number") ? ctxData.offset : 0;
                        whenRandom = (ctxData.random === true);
                    }
                    else
                    {
                        throw new chronos.TimeError(
                                    RED._("node-red-contrib-chronos/chronos-config:common.error.invalidContext"),
                                    {type: node.customDelayType, value: ctxData});
                    }
                }

                if (delayType == "fixedDuration")
                {
                    setupFixedDurationDelayTimer(fixedDuration, fixedDurationUnit);
                }
                else if (delayType == "randomDuration")
                {
                    setupRandomDurationDelayTimer(randomDuration1, randomDuration2, randomDurationUnit, randomizerMillis);
                }
                else if (delayType == "pointInTime")
                {
                    setupTimePointDelayTimer(whenType, whenValue, whenOffset, whenRandom);
                }
                else
                {
                    await setupCustomDelayTimer(msg);
                }
            }

            node.msgQueue.push({msg: msg, done: done});
            updateStatus();
        }

        function dropOldestItem()
        {
            const item = node.msgQueue.shift();
            item.done();
        }

        function flushOldestItem()
        {
            const item = node.msgQueue.shift();

            node.send(item.msg);
            item.done();
        }

        function dropQueue()
        {
            for (const item of node.msgQueue)
            {
                item.done();
            }

            node.msgQueue = [];
            updateStatus();
        }

        function flushQueue()
        {
            node.debug("Flush all enqueued messages");

            const msgs = [];
            for (const item of node.msgQueue)
            {
                msgs.push(item.msg);
            }

            node.send([msgs]);
            dropQueue();
        }

        function setupFixedDurationDelayTimer(value, unit)
        {
            node.debug("Set up fixed duration timer for value " + value + ", unit " + unit);

            node.queueDuration = getDurationMillis(value, unit);

            node.debug("Starting timer for delayed message in " + node.queueDuration + " milliseconds");
            node.delayTimer = setTimeout(() =>
            {
                delete node.delayTimer;
                flushQueue();
            }, node.queueDuration);
        }

        function setupRandomDurationDelayTimer(value1, value2, unit, randomizerMillis)
        {
            node.debug("Set up random duration timer for first value " + value1 + ", second value " + value2 + ", unit " + unit);

            if (value1 == value2)
            {
                node.queueDuration = getDurationMillis(value1, unit);
            }
            else if (randomizerMillis)
            {
                const duration1 = getDurationMillis(value1, unit);
                const duration2 = getDurationMillis(value2, unit);

                if (duration2 > duration1)
                {
                    node.queueDuration = Math.round(Math.random() * (duration2 - duration1)) + duration1;
                }
                else
                {
                    node.queueDuration = Math.round(Math.random() * (duration1 - duration2)) + duration2;
                }
            }
            else if (value2 > value1)
            {
                node.queueDuration = getDurationMillis(Math.round(Math.random() * (value2 - value1)) + value1, unit);
            }
            else
            {
                node.queueDuration = getDurationMillis(Math.round(Math.random() * (value1 - value2)) + value2, unit);
            }

            node.debug("Starting timer for delayed message in " + node.queueDuration + " milliseconds");
            node.delayTimer = setTimeout(() =>
            {
                delete node.delayTimer;
                flushQueue();
            }, node.queueDuration);
        }

        function setupTimePointDelayTimer(type, value, offset, random)
        {
            node.debug("Set up time point timer for type '" + type + "', value '" + value + "'");

            const now = chronos.getCurrentTime(node);
            node.sendTime = chronos.getTime(RED, node, now.clone(), type, value);

            if (offset != 0)
            {
                node.sendTime.add(random ? Math.round(Math.random() * offset) : offset, "minutes");
            }

            if (node.sendTime.isBefore(now))
            {
                node.debug("Send time before current time, adding one day");

                if (type == "time")
                {
                    node.sendTime.add(1, "days");
                }
                else
                {
                    node.sendTime = chronos.getTime(RED, node, node.sendTime.add(1, "days"), type, value);

                    if (offset != 0)
                    {
                        node.sendTime.add(random ? Math.round(Math.random() * offset) : offset, "minutes");
                    }
                }
            }

            node.debug("Starting timer for delayed message at " + node.sendTime.format("YYYY-MM-DD HH:mm:ss (Z)"));
            node.delayTimer = setTimeout(() =>
            {
                delete node.delayTimer;
                flushQueue();
            }, node.sendTime.diff(chronos.getCurrentTime(node)));
        }

        async function setupCustomDelayTimer(msg)
        {
            node.debug("Set up custom timer for delayed message with expression " + node.customDelayValue);

            const now = chronos.getCurrentTime(node);
            let result = null;

            try
            {
                result = await chronos.evaluateJSONataExpression(RED, node.expression, msg);
            }
            catch(e)
            {
                const details = {expression: node.customDelayValue, code: e.code, description: e.message, position: e.position, token: e.token};
                if (e.value)
                {
                    details.value = e.value;
                }

                throw new chronos.TimeError(RED._("node-red-contrib-chronos/chronos-config:common.error.evaluationFailed"), details);
            }

            if ((typeof result != "number") && (typeof result != "string"))
            {
                throw new chronos.TimeError(RED._("node-red-contrib-chronos/chronos-config:common.error.notTime"),
                                            {expression: node.customDelayValue, result: result});
            }

            if ((typeof result == "string") || (result > now.valueOf()))  // assumed to be absolute send time
            {
                node.sendTime = chronos.getTimeFrom(node, result);
            }
            else if ((result >= 1) && (result <= MS_PER_WEEK))  // assumed to be a relative queueing duration
            {
                node.queueDuration = result;
            }
            else
            {
                throw new chronos.TimeError(RED._("node-red-contrib-chronos/chronos-config:common.error.intervalOutOfRange"),
                                            {expression: node.customDelayValue, result: result});
            }

            if (node.queueDuration >= 0)
            {
                node.debug("Starting timer for delayed message in " + node.queueDuration + " milliseconds");
                node.delayTimer = setTimeout(() =>
                {
                    delete node.delayTimer;
                    flushQueue();
                }, node.queueDuration);
            }
            else if (node.sendTime)
            {
                if (!node.sendTime.isValid())
                {
                    node.sendTime = null;
                    throw new chronos.TimeError(RED._("node-red-contrib-chronos/chronos-config:common.error.notTime"),
                                                {expression: node.customDelayValue, result: result});
                }
                if ((node.sendTime.diff(now) < 1) || (node.sendTime.diff(now) > MS_PER_WEEK))
                {
                    node.sendTime = null;
                    throw new chronos.TimeError(RED._("node-red-contrib-chronos/chronos-config:common.error.intervalOutOfRange"),
                                                {expression: node.customDelayValue, result: result});
                }

                node.debug("Starting timer for delayed message at " + node.sendTime.format("YYYY-MM-DD HH:mm:ss (Z)"));
                node.delayTimer = setTimeout(() =>
                {
                    delete node.delayTimer;
                    flushQueue();
                }, node.sendTime.diff(now));
            }

            updateStatus();
        }

        function tearDownDelayTimer()
        {
            if (node.delayTimer)
            {
                node.debug("Tear down timer");

                clearTimeout(node.delayTimer);
                delete node.delayTimer;

                node.queueDuration = -1;
                node.sendTime = null;
            }
        }

        function getDurationMillis(value, unit)
        {
            const UNIT_MULTIPLIER =
            {
                "milliseconds": 1,
                "seconds":      MS_PER_SECOND,
                "minutes":      MS_PER_MINUTE,
                "hours":        MS_PER_HOUR,
                "days":         MS_PER_DAY
            };

            return value * UNIT_MULTIPLIER[unit];
        }

        function isValidFixedDuration(data)
        {
            if ((typeof data != "object") || !data)
            {
                return false;
            }

            if ((typeof data.value != "number") || (data.value <= 0))
            {
                return false;
            }

            if ((typeof data.unit != "string") || !/^(days|hours|minutes|seconds|milliseconds)$/.test(data.unit))
            {
                return false;
            }

            return true;
        }

        function isValidRandomDuration(data)
        {
            if ((typeof data != "object") || !data)
            {
                return false;
            }

            if ((typeof data.value1 != "number") || (data.value1 <= 0) ||
                (typeof data.value2 != "number") || (data.value2 <= 0))
            {
                return false;
            }

            if ((typeof data.unit != "string") || !/^(days|hours|minutes|seconds|milliseconds)$/.test(data.unit))
            {
                return false;
            }

            if ((typeof data.randomizerMillis != "undefined") && (typeof data.randomizerMillis != "boolean"))
            {
                return false;
            }

            return true;
        }

        function isValidWhenTime(data)
        {
            if ((typeof data != "object") || !data)
            {
                return false;
            }

            if ((typeof data.type != "string") || !/^(time|sun|moon|custom)$/.test(data.type))
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

            return true;
        }

        function updateStatus()
        {
            if (node.msgQueue.length > 0)
            {
                if (node.queueDuration >= 0)
                {
                    let statusText = node.msgQueue.length + " " + RED._("delay.status.queuedFor") + " ";

                    // days
                    let value = Math.floor(node.queueDuration / MS_PER_DAY);
                    if (value > 0)
                    {
                        statusText += value + "d ";
                    }

                    // hours
                    value = Math.floor((node.queueDuration / MS_PER_HOUR) % HOURS_PER_DAY);
                    if (value > 0)
                    {
                        statusText += value + "h ";
                    }

                    // minutes
                    value = Math.floor((node.queueDuration / MS_PER_MINUTE) % MINUTES_PER_HOUR);
                    if (value > 0)
                    {
                        statusText += value + "m ";
                    }

                    // seconds
                    value = Math.floor((node.queueDuration / MS_PER_SECOND) % SECONDS_PER_MINUTE);
                    if (value > 0)
                    {
                        statusText += value + "s ";
                    }

                    // milliseconds
                    value = Math.floor(node.queueDuration % MS_PER_SECOND);
                    if (value > 0)
                    {
                        statusText += value + "ms ";
                    }

                    node.status({fill: "blue", shape: "dot", text: statusText});
                }
                else if (node.sendTime)
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

                    node.status({fill: "blue", shape: "dot", text: node.msgQueue.length + " " + RED._("delay.status.queuedUntil") + " " + when});
                }
            }
            else
            {
                node.status({});
            }
        }
    }

    RED.nodes.registerType("chronos-delay", ChronosDelayNode);
};
