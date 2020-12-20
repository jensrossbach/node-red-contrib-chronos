/*
 * Copyright (c) 2020 Jens-Uwe Rossbach
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

        if (!node.config)
        {
            node.status({fill: "red", shape: "dot", text: "node-red-contrib-chronos/chronos-config:common.status.noConfig"});
            node.error(RED._("node-red-contrib-chronos/chronos-config:common.error.noConfig"));
        }
        else
        {
            node.debug("Starting node with configuration '" + node.config.name + "' (latitude " + node.config.latitude + ", longitude " + node.config.longitude + ")");

            node.status({});
            chronos.init(RED, node.config.latitude, node.config.longitude, node.config.sunPositions);

            node.whenType = settings.whenType;
            node.whenValue = settings.whenValue;
            node.offset = settings.offset;
            node.random = settings.random;

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

                    if ("drop" in msg)
                    {
                        tearDownDelayTimer();
                        dropQueue();

                        if ("enqueue" in msg)
                        {
                            delete msg.drop;
                            delete msg.enqueue;

                            enqueueMessage(msg, done);
                        }
                        else
                        {
                            // we're done with the message as it gets discarded
                            done();
                        }
                    }
                    else if ("flush" in msg)
                    {
                        tearDownDelayTimer();
                        flushQueue();

                        if ("enqueue" in msg)
                        {
                            delete msg.flush;
                            delete msg.enqueue;

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
                });
            }
        }

        function enqueueMessage(msg, done)
        {
            try
            {
                if (!node.delayTimer)
                {
                    setupDelayTimer();
                }

                node.msgQueue.push({msg: msg, done: done});
                node.status((node.msgQueue.length > 0) ? {fill: "blue", shape: "dot", text: node.msgQueue.length + " " + RED._("delay.status.queued")} : {});
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
            while (node.msgQueue.length > 0)
            {
                let item = node.msgQueue.shift();
                item.done();
            }

            node.status({});
        }

        function flushQueue()
        {
            while (node.msgQueue.length > 0)
            {
                let item = node.msgQueue.shift();

                node.send(item.msg);
                item.done();
            }

            node.status({});
        }

        function setupDelayTimer()
        {
            node.debug("Set up timer for type '" + node.whenType + "', value '" + node.whenValue + "'");

            const now = chronos.getCurrentTime();
            let sendTime = chronos.getTime(now.clone(), node.whenType, node.whenValue);

            if (node.offset != 0)
            {
                let offset = node.random ? Math.round(Math.random() * node.offset) : node.offset;
                sendTime.add(offset, "minutes");
            }

            if (sendTime.isBefore(now))
            {
                node.debug("Send time before current time, adding one day");

                if (node.whenType == "time")
                {
                    sendTime.add(1, "days");
                }
                else
                {
                    sendTime = chronos.getTime(sendTime.add(1, "days"), node.whenType, node.whenValue);
                }
            }

            node.debug("Starting timer for delayed message at " + sendTime.format("YYYY-MM-DD HH:mm:ss"));
            node.delayTimer = setTimeout(() =>
            {
                delete node.delayTimer;
                flushQueue();
            }, sendTime.diff(now));
        }

        function tearDownDelayTimer()
        {
            if (node.delayTimer)
            {
                node.debug("Tear down timer for type '" + node.whenType + "', value '" + node.whenValue + "'");

                clearTimeout(node.delayTimer);
                delete node.delayTimer;
            }
        }
    }

    RED.nodes.registerType("chronos-delay", ChronosDelayNode);
};
