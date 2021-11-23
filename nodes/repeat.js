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

module.exports = function(RED)
{
    function ChronosRepeatNode(settings)
    {
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
        else if ((settings.mode == "advanced") && !cronosjs.validate(settings.crontab))
        {
            node.status({fill: "red", shape: "dot", text: "node-red-contrib-chronos/chronos-config:common.status.invalidConfig"});
            node.error(RED._("node-red-contrib-chronos/chronos-config:common.error.invalidConfig"));
        }
        else
        {
            node.debug("Starting node with configuration '" + node.config.name + "' (latitude " + node.config.latitude + ", longitude " + node.config.longitude + ")");
            node.status({});

            node.mode = settings.mode;
            node.interval = settings.interval;
            node.intervalUnit = settings.intervalUnit;
            node.crontab = (typeof settings.crontab == "undefined") ? "" : settings.crontab;
            node.untilType = settings.untilType;
            node.untilValue = settings.untilValue;
            node.untilOffset = settings.untilOffset;
            node.untilRandom = settings.untilRandom;
            node.preserveCtrlProps = settings.preserveCtrlProps;

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
                        if (!send)  // Node-RED 0.x backward compatibility
                        {
                            send = () =>
                            {
                                node.send.apply(node, arguments);
                            };
                        }

                        if (!done)  // Node-RED 0.x backward compatibility
                        {
                            done = () =>
                            {
                                var args = [...arguments];
                                if (args.length > 0)
                                {
                                    args.push(msg);
                                    node.error.apply(node, args);
                                }
                            };
                        }

                        tearDownRepeatTimer();

                        if ("stop" in msg)
                        {
                            updateStatus();
                            done();
                        }
                        else
                        {
                            scheduleMessage(msg);

                            send(RED.util.cloneMessage(node.message));
                            done();
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
            let untilType = node.untilType;
            let untilValue = node.untilValue;
            let untilOffset = node.untilOffset;
            let untilRandom = node.untilRandom;

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

            if (hasUntilOverride(msg.until))
            {
                node.debug("Input message has override property for until time");

                if (msg.until != null)
                {
                    untilType = msg.until.type;
                    untilValue = msg.until.value;
                    untilOffset = msg.until.offset;
                    untilRandom = msg.until.random;
                }
                else
                {
                    untilType = "nextMsg";
                    untilValue = "";
                    untilOffset = 0;
                    untilRandom = false;
                }

                if (!node.preserveCtrlProps)
                {
                    delete msg.until;
                }
            }

            node.message = msg;

            if (mode == "simple")
            {
                setupSimpleRepeatTimer(now, interval, intervalUnit, getUntilTime(now, untilType, untilValue, untilOffset, untilRandom));
            }
            else
            {
                setupAdvancedRepeatTimer(crontab, getUntilTime(now, untilType, untilValue, untilOffset, untilRandom));
            }
        }

        function getUntilTime(now, type, value, offset, random)
        {
            let ret = null;

            if (type != "nextMsg")
            {
                ret = chronos.getTime(RED, node, now.clone(), type, value);

                if (offset != 0)
                {
                    ret.add(random ? Math.round(Math.random() * offset) : offset, "minutes");
                }
            }

            return ret;
        }

        function setupSimpleRepeatTimer(now, interval, intervalUnit, untilTime)
        {
            node.debug("Set up timer for interval " + interval + " " + intervalUnit + " until " + (untilTime ? untilTime.format("YYYY-MM-DD HH:mm:ss") : "next message"));
            node.sendTime = now.clone().add(interval, intervalUnit);

            if (!untilTime || node.sendTime.isSameOrBefore(untilTime))
            {
                node.debug("Starting timer for repeated message at " + node.sendTime.format("YYYY-MM-DD HH:mm:ss"));
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
            node.debug("Set up timer for cron table '" + crontab + "' until " + (untilTime ? untilTime.format("YYYY-MM-DD HH:mm:ss") : "next message"));

            const expression = cronosjs.CronosExpression.parse(crontab);
            let firstTrigger = expression.nextDate();

            if (firstTrigger)
            {
                node.sendTime = chronos.getTimeFrom(node, firstTrigger);

                if (!untilTime || node.sendTime.isSameOrBefore(untilTime))
                {
                    node.repeatTimer = new cronosjs.CronosTask(expression);

                    node.repeatTimer.on("run", () =>
                    {
                        node.send(RED.util.cloneMessage(node.message));

                        let nextTrigger = expression.nextDate();
                        if (nextTrigger)
                        {
                            node.sendTime = chronos.getTimeFrom(node, nextTrigger);
                            if (untilTime && node.sendTime.isAfter(untilTime))
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
                ((data.unit == "hours") && ((data.value < 1) || (data.value > 23))))
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

        function hasUntilOverride(data)
        {
            if (typeof data != "object")
            {
                return false;
            }

            if (data != null)
            {
                if (!/^(time|sun|moon|custom)$/.test(data.type))
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

                if ((typeof data.offset != "number") || (data.offset < -300) || (data.offset > 300))
                {
                    return false;
                }

                if (typeof data.random != "boolean")
                {
                    return false;
                }
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
