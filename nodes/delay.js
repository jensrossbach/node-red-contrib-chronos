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

module.exports = function(RED)
{
    function ChronosDelayNode(settings)
    {
        const chronos = require("./common/chronos.js");

        let node = this;
        RED.nodes.createNode(node, settings);

        node.config = RED.nodes.getNode(settings.config);
        node.locale = require("os-locale").sync();

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
        else
        {
            node.debug("Starting node with configuration '" + node.config.name + "' (latitude " + node.config.latitude + ", longitude " + node.config.longitude + ")");
            node.status({});

            node.whenType = settings.whenType;
            node.whenValue = settings.whenValue;
            node.offset = settings.offset;
            node.random = settings.random;
            node.preserveCtrlProps = settings.preserveCtrlProps;
            node.ignoreCtrlProps = settings.ignoreCtrlProps;

            node.sendTime = null;

            if ((node.whenType == "time") && !chronos.isValidUserTime(node.whenValue))
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

                node.on("input", (msg, send, done) =>
                {
                    if (msg)
                    {
                        if (!send || !done)  // Node-RED 0.x not supported anymore
                        {
                            return;
                        }

                        if (!node.ignoreCtrlProps && ("drop" in msg))
                        {
                            tearDownDelayTimer();
                            dropQueue();

                            if ("enqueue" in msg)
                            {
                                if (!node.preserveCtrlProps)
                                {
                                    delete msg.drop;
                                    delete msg.enqueue;
                                }

                                enqueueMessage(msg, done);
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

                                enqueueMessage(msg, done);
                            }
                            else
                            {
                                // we're done with the message as it gets discarded
                                done();
                            }
                        }
                        else
                        {
                            enqueueMessage(msg, done);
                        }
                    }
                });
            }
        }

        function enqueueMessage(msg, done)
        {
            try
            {
                if (!node.ignoreCtrlProps && hasOverride(msg.when))
                {
                    node.debug("Input message has override property");

                    tearDownDelayTimer();
                    setupDelayTimer(msg.when.type, msg.when.value, msg.when.offset, msg.when.random);

                    if (!node.preserveCtrlProps)
                    {
                        delete msg.when;
                    }
                }
                else if (!node.delayTimer)
                {
                    setupDelayTimer();
                }

                node.msgQueue.push({msg: msg, done: done});
                updateStatus();
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

        function dropQueue()
        {
            node.debug("Drop all enqueued messages");

            while (node.msgQueue.length > 0)
            {
                let item = node.msgQueue.shift();
                item.done();
            }

            updateStatus();
        }

        function flushQueue()
        {
            node.debug("Flush all enqueued messages");

            while (node.msgQueue.length > 0)
            {
                let item = node.msgQueue.shift();

                node.send(item.msg);
                item.done();
            }

            updateStatus();
        }

        function setupDelayTimer(type = node.whenType, value = node.whenValue, offset = node.offset, random = node.random)
        {
            node.debug("Set up timer for type '" + type + "', value '" + value + "'");

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
                }
            }

            node.debug("Starting timer for delayed message at " + node.sendTime.format("YYYY-MM-DD HH:mm:ss"));
            node.delayTimer = setTimeout(() =>
            {
                delete node.delayTimer;
                flushQueue();
            }, node.sendTime.diff(now));
        }

        function tearDownDelayTimer()
        {
            if (node.delayTimer)
            {
                node.debug("Tear down timer");

                clearTimeout(node.delayTimer);
                delete node.delayTimer;

                node.sendTime = null;
            }
        }

        function hasOverride(data)
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

            return true;
        }

        function updateStatus()
        {
            if ((node.msgQueue.length > 0) && node.sendTime)
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

                node.status({fill: "blue", shape: "dot", text: node.msgQueue.length + " " + RED._("delay.status.queued") + " " + when});
            }
            else
            {
                node.status({});
            }
        }
    }

    RED.nodes.registerType("chronos-delay", ChronosDelayNode);
};
