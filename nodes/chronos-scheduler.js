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
        const moment = require("moment");
        const sunCalc = require("suncalc");

        let node = this;
        RED.nodes.createNode(node, settings);

        node.config = RED.nodes.getNode(settings.config);

        if (node.config)
        {
            node.status({});
            node.triggers = settings.triggers;

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
                        args.push(msg);
                        node.error.apply(node, args);
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
                else
                {
                    done(RED._("scheduler.error.invalidInput"));
                }
            });

            node.debug("Starting node with configuration '" + node.config.name + "' (latitude " + node.config.latitude + ", longitude " + node.config.longitude + ")");
            if (node.triggers.length == 0)
            {
                node.status({fill: "red", shape: "dot", text: "scheduler.status.noTriggers"});
                node.error(RED._("scheduler.error.noTriggers"));
            }
            else
            {
                startTimers();
            }
        }
        else
        {
            node.status({fill: "red", shape: "dot", text: "node-red-contrib-chronos/chronos-config:common.status.noConfig"});
            node.error(RED._("node-red-contrib-chronos/chronos-config:common.error.noConfig"));
        }

        function startTimers()
        {
            node.debug("Starting timers");

            node.triggers.forEach(data =>
            {
                setupTimer(data, false);
            });
        }

        function stopTimers()
        {
            node.debug("Stopping timers");

            node.triggers.forEach(data =>
            {
                if ("timer" in data)
                {
                    node.debug("Tear down timer for trigger type '" + data.trigger.type + "'");

                    clearTimeout(data.timer);
                    delete data.timer;
                }
            });
        }

        function setupTimer(data, repeat)
        {
            try
            {
                const now = moment();
                let triggerTime = null;

                node.debug("Set up timer for trigger type '" + data.trigger.type + "', value '" + data.trigger.value + (repeat ? "' (repeating)" : "'"));

                if (data.trigger.type == "time")
                {
                    triggerTime = getUserTime(repeat ? now.clone().add(1, "days") : now.clone(), data.trigger.value);
                }
                else if (data.trigger.type == "sun")
                {
                    triggerTime = getSunTime(repeat ? now.clone().hour(12).add(1, "days") : now.clone().hour(12), data.trigger.value);
                }
                else if (data.trigger.type == "moon")
                {
                    triggerTime = getMoonTime(repeat ? now.clone().hour(12).add(1, "days") : now.clone().hour(12), data.trigger.value);
                }

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
                    else if (data.trigger.type == "sun")
                    {
                        triggerTime = getSunTime(now.clone().hour(12).add(1, "days"), data.trigger.value);
                    }
                    else if (data.trigger.type == "moon")
                    {
                        triggerTime = getMoonTime(now.clone().hour(12).add(1, "days"), data.trigger.value);
                    }
                }

                node.debug("Starting timer for trigger at " + triggerTime.format("YYYY-MM-DD HH:mm:ss"));
                data.timer = setTimeout(handleTimeout, triggerTime.diff(now), data);
            }
            catch (e)
            {
                if (e instanceof TimeError)
                {
                    node.error(e.message, e.details);
                }
                else
                {
                    node.error(e.message);
                    node.debug(e.stack);
                }
            }
        }

        function handleTimeout(data)
        {
            delete data.timer;

            if (data.output.type == "global")
            {
                node.context().global.set(data.output.property.name, data.output.property.value);
            }
            else if (data.output.type == "flow")
            {
                node.context().flow.set(data.output.property.name, data.output.property.value);
            }
            else if (data.output.type == "msg")
            {
                let msg = {};
                msg[data.output.property.name] = data.output.property.value;

                node.send(msg);
            }
            else if (data.output.type == "fullMsg")
            {
                node.send(JSON.parse(data.output.value));
            }

            setupTimer(data, true);
        }

        function getUserTime(day, value)
        {
            let ret = null;

            let matches = value.match(/^(\d|0\d|1\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?\s*(am|AM|pm|PM)?$/);
            if (matches)
            {
                let hour = matches[1];
                let min = matches[2];
                let sec = matches[3];
                let ampm = matches[4];

                if (ampm)
                {
                    switch (ampm.toUpperCase())
                    {
                        case "AM":
                        {
                            if (hour >= 12)
                            {
                                hour = 0;
                            }

                            break;
                        }
                        case "PM":
                        {
                            if (hour < 12)
                            {
                                hour += 12;
                            }

                            break;
                        }
                    }
                }

                ret = day.hour(hour).minute(min).second(sec ? sec : 0);
            }

            if (!ret)
            {
                throw new TimeError(RED._("scheduler.error.invalidTime"), {payload: {trigger: "time", value: value}});
            }

            return ret;
        }

        function getSunTime(day, type)
        {
            let sunTimes = sunCalc.getTimes(day.toDate(), node.config.latitude, node.config.longitude);

            let ret = moment(sunTimes[type]);
            if (!ret.isValid())
            {
                throw new TimeError(RED._("scheduler.error.unavailableTime"), {payload: {trigger: "sun", value: type}});
            }

            return ret;
        }

        function getMoonTime(day, type)
        {
            let moonTimes = sunCalc.getMoonTimes(day.toDate(), node.config.latitude, node.config.longitude);

            let ret = moment(moonTimes[type]);
            if (!ret.isValid())
            {
                throw new TimeError(RED._("scheduler.error.unavailableTime"), {payload: {trigger: "moon", value: type, alwaysUp: moonTimes.alwaysUp, alwaysDown: moonTimes.alwaysDown}});
            }

            return ret;
        }
    }

    class TimeError extends Error
    {
        constructor(message, details)
        {
            super(message);

            this.name = "TimeError";
            this.details = details;
        }
    }

    RED.nodes.registerType("chronos-scheduler", ChronosSchedulerNode);
};
