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

            node.multiPort = settings.multiPort;
            node.disabledSchedule = false;

            node.schedule = [];
            for (let i=0; i<settings.schedule.length; ++i)
            {
                node.schedule.push({id: i+1, config: settings.schedule[i]});
            }

            if (node.multiPort)
            {
                node.ports = [];

                for (let i=0; i<settings.outputs; ++i)
                {
                    node.ports.push(null);
                }
            }

            let valid = true;
            for (let i=0; i<node.schedule.length; ++i)
            {
                let event = node.schedule[i].config;

                if ((event.trigger.type == "global") || (event.trigger.type == "flow"))
                {
                    if (!event.trigger.value)
                    {
                        valid = false;
                        break;
                    }
                }
                else
                {
                    // check for valid user time
                    if ((event.trigger.type == "time") && !chronos.isValidUserTime(event.trigger.value))
                    {
                        valid = false;
                        break;
                    }

                    // check for valid output and convert according to type
                    if (event.output.type == "fullMsg")
                    {
                        try
                        {
                            event.output.value = JSON.parse(event.output.value);
                        }
                        catch (e)
                        {
                            valid = false;
                            break;
                        }
                    }
                    else
                    {
                        if (!event.output.property.name)
                        {
                            valid = false;
                            break;
                        }

                        if (event.output.property.type == "num")
                        {
                            if (+event.output.property.value === +event.output.property.value)
                            {
                                event.output.property.value = +event.output.property.value;
                            }
                            else
                            {
                                valid = false;
                                break;
                            }
                        }
                        else if (event.output.property.type == "bool")
                        {
                            if (/^(true|false)$/.test(event.output.property.value))
                            {
                                event.output.property.value = (event.output.property.value == "true");
                            }
                            else
                            {
                                valid = false;
                                break;
                            }
                        }
                        else if (event.output.property.type == "json")
                        {
                            try
                            {
                                event.output.property.value = JSON.parse(event.output.property.value);
                            }
                            catch (e)
                            {
                                valid = false;
                                break;
                            }
                        }
                        else if (event.output.property.type == "bin")
                        {
                            try
                            {
                                event.output.property.value = Buffer.from(JSON.parse(event.output.property.value));
                            }
                            catch (e)
                            {
                                valid = false;
                                break;
                            }
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
                updateStatus();

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
                        if (msg.payload)
                        {
                            startTimers();
                            node.disabledSchedule = false;
                        }
                        else
                        {
                            stopTimers();
                            node.disabledSchedule = true;
                        }

                        done();
                    }
                    else if (Array.isArray(msg.payload))
                    {
                        let numDisabled = 0;
                        for (let i=0; (i<msg.payload.length) && (i<node.schedule.length); ++i)
                        {
                            if (msg.payload[i])
                            {
                                startTimer(node.schedule[i]);
                            }
                            else
                            {
                                stopTimer(node.schedule[i]);
                            }

                            if (!msg.payload[i])
                            {
                                numDisabled++;
                            }
                        }

                        node.disabledSchedule = (numDisabled == node.schedule.length);
                        done();
                    }
                    else
                    {
                        done(RED._("scheduler.error.invalidInput"));
                    }

                    updateStatus();
                });

                startTimers();
            }
        }

        function startTimers()
        {
            node.debug("Starting timers");

            node.schedule.forEach(data =>
            {
                startTimer(data);
            });
        }

        function stopTimers()
        {
            node.debug("Stopping timers");

            node.schedule.forEach(data =>
            {
                stopTimer(data);
            });
        }

        function startTimer(data)
        {
            stopTimer(data);

            if ((data.config.trigger.type == "global") || (data.config.trigger.type == "flow"))
            {
                let ctx = RED.util.parseContextStore(data.config.trigger.value);
                node.debug("[Timer:" + data.id + "] Load from context variable " + data.config.trigger.type + "." + ctx.key + (ctx.store ? " (" + ctx.store + ")" : ""));

                let ctxData = node.context()[data.config.trigger.type].get(ctx.key, ctx.store);
                if(!validateContextData(ctxData))
                {
                    node.error(RED._("scheduler.error.invalidEvent", {event: data.config.trigger.type + "." + ctx.key + (ctx.store ? " (" + ctx.store + ")" : "")}), {});
                    return;
                }

                data.context = ctxData;
            }

            setUpTimer(data, false);
        }

        function stopTimer(data)
        {
            if ("timer" in data)
            {
                tearDownTimer(data);

                if ("context" in data)
                {
                    delete data.context;
                }
            }
        }

        function setUpTimer(data, repeat)
        {
            try
            {
                node.debug("[Timer:" + data.id + "] Set up timer" + (repeat ? " (repeating)" : ""));

                let event = ("context" in data) ? data.context : data.config;
                node.trace("[Timer:" + data.id + "] Timer specification: " + JSON.stringify(event));

                const now = chronos.getCurrentTime();
                let triggerTime = chronos.getTime(repeat ? now.clone().add(1, "days") : now.clone(), event.trigger.type, event.trigger.value);

                if (event.trigger.offset != 0)
                {
                    let offset = event.trigger.random ? Math.round(Math.random() * event.trigger.offset) : event.trigger.offset;
                    triggerTime.add(offset, "minutes");
                }

                if (triggerTime.isBefore(now))
                {
                    node.debug("[Timer:" + data.id + "] Trigger time before current time, adding one day");

                    if (event.trigger.type == "time")
                    {
                        triggerTime.add(1, "days");
                    }
                    else
                    {
                        triggerTime = chronos.getTime(triggerTime.add(1, "days"), event.trigger.type, event.trigger.value);
                    }
                }

                node.debug("[Timer:" + data.id + "] Starting timer for trigger at " + triggerTime.format("YYYY-MM-DD HH:mm:ss"));
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
            node.debug("[Timer:" + data.id + "] Tear down timer");

            clearTimeout(data.timer);
            delete data.timer;
        }

        function handleTimeout(data)
        {
            delete data.timer;

            let event = ("context" in data) ? data.context : data.config;
            if ((event.output.type == "global") || (event.output.type == "flow"))
            {
                let ctx = RED.util.parseContextStore(event.output.property.name);
                node.context()[event.output.type].set(ctx.key, event.output.property.value, ctx.store);
            }
            else if (event.output.type == "msg")
            {
                let msg = {};
                if (event.output.property.type === "date")
                {
                    RED.util.setMessageProperty(msg, event.output.property.name, Date.now(), true);
                }
                else
                {
                    RED.util.setMessageProperty(msg, event.output.property.name, event.output.property.value, true);
                }

                sendMessage(data, msg);
            }
            else if (event.output.type == "fullMsg")
            {
                sendMessage(data, event.output.value);
            }

            setUpTimer(data, true);
        }

        function sendMessage(data, msg)
        {
            if (node.multiPort)
            {
                node.ports[data.config.output.port] = msg;
                node.send(node.ports);
                node.ports[data.config.output.port] = null;
            }
            else
            {
                node.send(msg);
            }
        }

        function validateContextData(data)
        {
            if ((typeof data != "object") || !data)
            {
                return false;
            }

            if ((typeof data.trigger != "object") || !data.trigger)
            {
                return false;
            }

            if ((typeof data.trigger.type != "string") || !/^(time|sun|moon|custom)$/.test(data.trigger.type))
            {
                return false;
            }

            if ((typeof data.trigger.value != "string") ||
                ((data.trigger.type == "time") && !chronos.isValidUserTime(data.trigger.value)) ||
                ((data.trigger.type == "sun") && !/^(sunrise|sunriseEnd|sunsetStart|sunset|goldenHour|goldenHourEnd|night|nightEnd|dawn|nauticalDawn|dusk|nauticalDusk|solarNoon|nadir)$/.test(data.trigger.value)) ||
                ((data.trigger.type == "moon") && !/^(rise|set)$/.test(data.trigger.value)))
            {
                return false;
            }

            if ((typeof data.trigger.offset != "number") || (data.trigger.offset < -300) || (data.trigger.offset > 300))
            {
                return false;
            }

            if (typeof data.trigger.random != "boolean")
            {
                return false;
            }

            if ((typeof data.output != "object") || !data.output)
            {
                return false;
            }

            if ((typeof data.output.type != "string") || !/^(global|flow|msg|fullMsg)$/.test(data.output.type))
            {
                return false;
            }

            if ((data.output.type == "fullMsg") && ((typeof data.output.value != "object") || !data.output.value))
            {
                return false;
            }

            if (data.output.type != "fullMsg")
            {
                if ((typeof data.output.property != "object") || !data.output.property)
                {
                    return false;
                }

                if ((typeof data.output.property.name != "string") || !data.output.property.name)
                {
                    return false;
                }

                if ((data.output.property.type !== "date") && (typeof data.output.property.value == "undefined"))
                {
                    return false;
                }
            }

            return true;
        }

        function updateStatus()
        {
            if (node.disabledSchedule)
            {
                node.status({fill: "grey", shape: "dot", text: "scheduler.status.disabledSchedule"});
            }
            else
            {
                node.status({fill: "green", shape: "dot", text: "scheduler.status.enabledSchedule"});
            }
        }
    }

    RED.nodes.registerType("chronos-scheduler", ChronosSchedulerNode);
};
