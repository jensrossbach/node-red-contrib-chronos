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
    function ChronosSchedulerNode(settings)
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
        else if (settings.schedule.length == 0)
        {
            node.status({fill: "red", shape: "dot", text: "scheduler.status.noSchedule"});
            node.error(RED._("scheduler.error.noSchedule"));
        }
        else
        {
            node.debug("Starting node with configuration '" + node.config.name + "' (latitude " + node.config.latitude + ", longitude " + node.config.longitude + ")");
            node.status({});

            node.multiPort = settings.multiPort;
            node.disabledSchedule = false;

            node.schedule = [];
            for (let i=0; i<settings.schedule.length; ++i)
            {
                node.schedule.push({id: i+1, config: {trigger: settings.schedule[i].trigger, output: settings.schedule[i].output}});

                if ("port" in settings.schedule[i])
                {
                    node.schedule[i].port = settings.schedule[i].port;
                }
                else if ("port" in settings.schedule[i].output)  // backward compatibility to v1.8.1 and below
                {
                    node.schedule[i].port = settings.schedule[i].output.port;
                }
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

                // check for presence of variable name
                if (((event.trigger.type == "global") || (event.trigger.type == "flow")) && !event.trigger.value)
                {
                    valid = false;
                    break;
                }

                // check for valid user time
                if ((event.trigger.type == "time") && !chronos.isValidUserTime(event.trigger.value))
                {
                    valid = false;
                    break;
                }

                if ("type" in event.output)  // backward compatibility, v1.8.x configurations have empty output or only port property under output
                {
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

                        if (typeof event.output.value != "object")
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
                node.debug("[Timer:" + data.id + "] Load trigger from context variable " + data.config.trigger.type + "." + ctx.key + (ctx.store ? " (" + ctx.store + ")" : ""));

                let ctxData = node.context()[data.config.trigger.type].get(ctx.key, ctx.store);

                if (validateExtendedContextData(ctxData))
                {
                    node.debug("[Timer:" + data.id + "] Detected extended context variable format, overriding configured output");

                    data.orig = {trigger: data.config.trigger, output: data.config.output};
                    data.config.trigger = ctxData.trigger;
                    data.config.output = ctxData.output;
                }
                else if (("type" in data.config.output) &&  // backward compatibility, v1.8.x configurations have empty output or only port property under output
                         validateContextData(ctxData))
                {
                    data.orig = {trigger: data.config.trigger};
                    data.config.trigger = ctxData;
                }
                else
                {
                    node.error(RED._("scheduler.error.invalidEvent", {event: data.config.trigger.type + "." + ctx.key + (ctx.store ? " (" + ctx.store + ")" : "")}), {});
                    return;
                }
            }

            setUpTimer(data, false);
        }

        function stopTimer(data)
        {
            if ("orig" in data)
            {
                if ("trigger" in data.orig)
                {
                    data.config.trigger = data.orig.trigger;
                }

                if ("output" in data.orig)
                {
                    data.config.output = data.orig.output;
                }

                delete data.orig;
            }

            if ("timer" in data)
            {
                tearDownTimer(data);
            }
        }

        function setUpTimer(data, repeat)
        {
            try
            {
                node.debug("[Timer:" + data.id + "] Set up timer" + (repeat ? " (repeating)" : ""));
                node.trace("[Timer:" + data.id + "] Timer specification: " + JSON.stringify(data.config));

                const now = chronos.getCurrentTime(node);
                let triggerTime = chronos.getTime(RED, node, repeat ? now.clone().add(1, "days") : now.clone(), data.config.trigger.type, data.config.trigger.value);

                if (data.config.trigger.offset != 0)
                {
                    let offset = data.config.trigger.random ? Math.round(Math.random() * data.config.trigger.offset) : data.config.trigger.offset;
                    triggerTime.add(offset, "minutes");
                }

                if (triggerTime.isBefore(now))
                {
                    node.debug("[Timer:" + data.id + "] Trigger time before current time, adding one day");

                    if (data.config.trigger.type == "time")
                    {
                        triggerTime.add(1, "days");
                    }
                    else
                    {
                        triggerTime = chronos.getTime(RED, node, triggerTime.add(1, "days"), data.config.trigger.type, data.config.trigger.value);
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

            if ((data.config.output.type == "global") || (data.config.output.type == "flow"))
            {
                let ctx = RED.util.parseContextStore(data.config.output.property.name);
                node.context()[data.config.output.type].set(ctx.key, data.config.output.property.value, ctx.store);
            }
            else if (data.config.output.type == "msg")
            {
                let msg = {};
                if (data.config.output.property.type === "date")
                {
                    RED.util.setMessageProperty(msg, data.config.output.property.name, Date.now(), true);
                }
                else
                {
                    RED.util.setMessageProperty(msg, data.config.output.property.name, data.config.output.property.value, true);
                }

                sendMessage(data, msg);
            }
            else if (data.config.output.type == "fullMsg")
            {
                sendMessage(data, data.config.output.value);
            }

            setUpTimer(data, true);
        }

        function sendMessage(data, msg)
        {
            if (node.multiPort)
            {
                node.ports[data.port] = msg;
                node.send(node.ports);
                node.ports[data.port] = null;
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

            if ((typeof data.type != "string") || !/^(time|sun|moon|custom)$/.test(data.type))
            {
                return false;
            }

            if ((typeof data.value != "string") ||
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

        function validateExtendedContextData(data)
        {
            if ((typeof data != "object") || !data)
            {
                return false;
            }

            if (!validateContextData(data.trigger))
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
