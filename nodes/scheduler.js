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
    function ChronosSchedulerNode(settings)
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
        else if (settings.schedule.length == 0)
        {
            node.status({fill: "red", shape: "dot", text: "scheduler.status.noSchedule"});
            node.error(RED._("scheduler.error.noSchedule"));
        }
        else
        {
            node.debug("Starting node with configuration '" + node.config.name + "' (latitude " + node.config.latitude + ", longitude " + node.config.longitude + ")");

            node.status({});
            chronos.init(RED, node.config.latitude, node.config.longitude, node.config.sunPositions);

            node.schedule = settings.schedule;
            node.multiPort = settings.multiPort;

            node.ports = [];
            if (node.multiPort)
            {
                for (let i=0; i<settings.outputs; ++i)
                {
                    node.ports.push(null);
                }
            }

            let valid = true;
            for (let i=0; i<node.schedule.length; ++i)
            {
                let data = node.schedule[i];

                // check for valid user time
                if ((data.trigger.type == "time") && !chronos.isValidUserTime(data.trigger.value))
                {
                    valid = false;
                    break;
                }

                // check for valid output and convert according to type
                if (data.output.type == "fullMsg")
                {
                    try
                    {
                        data.output.value = JSON.parse(data.output.value);
                    }
                    catch (e)
                    {
                        valid = false;
                        break;
                    }
                }
                else
                {
                    if (!data.output.property.name)
                    {
                        valid = false;
                        break;
                    }

                    if (data.output.property.type == "num")
                    {
                        if (+data.output.property.value === +data.output.property.value)
                        {
                            data.output.property.value = +data.output.property.value;
                        }
                        else
                        {
                            valid = false;
                            break;
                        }
                    }
                    else if (data.output.property.type == "bool")
                    {
                        if (/^(true|false)$/.test(data.output.property.value))
                        {
                            data.output.property.value = (data.output.property.value == "true");
                        }
                        else
                        {
                            valid = false;
                            break;
                        }
                    }
                    else if (data.output.property.type == "json")
                    {
                        try
                        {
                            data.output.property.value = JSON.parse(data.output.property.value);
                        }
                        catch (e)
                        {
                            valid = false;
                            break;
                        }
                    }
                    else if (data.output.property.type == "bin")
                    {
                        try
                        {
                            data.output.property.value = Buffer.from(JSON.parse(data.output.property.value));
                        }
                        catch (e)
                        {
                            valid = false;
                            break;
                        }
                    }
                }
            }

            if (!valid)
            {
                node.status({fill: "red", shape: "dot", text: "node-red-contrib-chronos/chronos-config:common.status.invalidConfig"});
                node.error(RED._("node-red-contrib-chronos/chronos-config:common.error.invalidConfig"));
            }
            else
            {
                node.on("close", () =>
                {
                    stopTimers();
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

                    if (typeof msg.payload == "boolean")
                    {
                        stopTimers();

                        if (msg.payload)
                        {
                            startTimers();
                        }

                        done();
                    }
                    else if (Array.isArray(msg.payload))
                    {
                        for (let i=0; (i<msg.payload.length) && (i<node.schedule.length); ++i)
                        {
                            if (msg.payload[i] && !node.schedule[i].timer)
                            {
                                setUpTimer(node.schedule[i], false);
                            }
                            else if (!msg.payload[i] && node.schedule[i].timer)
                            {
                                tearDownTimer(node.schedule[i]);
                            }
                        }

                        done();
                    }
                    else
                    {
                        done(RED._("scheduler.error.invalidInput"));
                    }
                });

                startTimers();
            }
        }

        function startTimers()
        {
            node.debug("Starting timers");

            node.schedule.forEach(data =>
            {
                setUpTimer(data, false);
            });
        }

        function stopTimers()
        {
            node.debug("Stopping timers");

            node.schedule.forEach(data =>
            {
                if ("timer" in data)
                {
                    tearDownTimer(data);
                }
            });
        }

        function setUpTimer(data, repeat)
        {
            try
            {
                node.debug("Set up timer for type '" + data.trigger.type + "', value '" + data.trigger.value + (repeat ? "' (repeating)" : "'"));

                const now = chronos.getCurrentTime();
                let triggerTime = chronos.getTime(repeat ? now.clone().add(1, "days") : now.clone(), data.trigger.type, data.trigger.value);

                if (data.trigger.offset != 0)
                {
                    let offset = data.trigger.random ? Math.round(Math.random() * data.trigger.offset) : data.trigger.offset;
                    triggerTime.add(offset, "minutes");
                }

                if (triggerTime.isBefore(now))
                {
                    node.debug("Trigger time before current time, adding one day");

                    if (data.trigger.type == "time")
                    {
                        triggerTime.add(1, "days");
                    }
                    else
                    {
                        triggerTime = chronos.getTime(triggerTime.add(1, "days"), data.trigger.type, data.trigger.value);
                    }
                }

                node.debug("Starting timer for trigger at " + triggerTime.format("YYYY-MM-DD HH:mm:ss"));
                data.timer = setTimeout(handleTimeout, triggerTime.diff(now), data);
            }
            catch (e)
            {
                if (e instanceof chronos.TimeError)
                {
                    node.error(e.message, {errorDetails: e.details});
                }
                else
                {
                    node.error(e.message);
                    node.debug(e.stack);
                }
            }
        }

        function tearDownTimer(data)
        {
            node.debug("Tear down timer for type '" + data.trigger.type + "', value '" + data.trigger.value + "'");

            clearTimeout(data.timer);
            delete data.timer;
        }

        function handleTimeout(data)
        {
            delete data.timer;

            if ((data.output.type == "global") || (data.output.type == "flow"))
            {
                let ctx = RED.util.parseContextStore(data.output.property.name);
                node.context()[data.output.type].set(ctx.key, data.output.property.value, ctx.store);
            }
            else if (data.output.type == "msg")
            {
                let msg = {};
                if (data.output.property.type == "date")
                {
                    msg[data.output.property.name] = Date.now();
                }
                else
                {
                    msg[data.output.property.name] = data.output.property.value;
                }

                sendMessage(data, msg);
            }
            else if (data.output.type == "fullMsg")
            {
                sendMessage(data, data.output.value);
            }

            setUpTimer(data, true);
        }

        function sendMessage(data, msg)
        {
            if (node.multiPort)
            {
                node.ports[data.output.port] = msg;
                node.send(node.ports);
                node.ports[data.output.port] = null;
            }
            else
            {
                node.send(msg);
            }
        }
    }

    RED.nodes.registerType("chronos-scheduler", ChronosSchedulerNode);
};
