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
    function ChronosSchedulerNode(settings)
    {
        const chronos = require("./common/chronos.js");
        const cronosjs = require("cronosjs");

        let node = this;
        RED.nodes.createNode(node, settings);

        node.name = settings.name;
        node.config = RED.nodes.getNode(settings.config);
        node.locale = require("os-locale").sync();

        node.initializing = true;
        node.eventTimesPending = false;

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
        else if (settings.schedule.length == 0)
        {
            node.status({fill: "red", shape: "dot", text: "scheduler.status.noSchedule"});
            node.error(RED._("scheduler.error.noSchedule"));
        }
        else
        {
            chronos.printNodeInfo(node);
            node.status({});

            node.disabledSchedule = (typeof settings.disabled == "undefined") ? false : settings.disabled;

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

            if (settings.multiPort)
            {
                node.ports = [];

                for (let i=0; i<settings.outputs; ++i)
                {
                    node.ports.push(null);
                }
            }

            if (settings.nextEventPort)
            {
                node.nextEventMsg = {payload: undefined};
                node.nextEventMsg.events = Array(node.schedule.length).fill(undefined);
            }

            let valid = true;
            for (let i=0; i<node.schedule.length; ++i)
            {
                let data = node.schedule[i];

                // check for presence of variable name
                if (((data.config.trigger.type == "global") || (data.config.trigger.type == "flow")) && !data.config.trigger.value)
                {
                    valid = false;
                    break;
                }

                // check for valid user time
                if ((data.config.trigger.type == "time") && !chronos.isValidUserTime(data.config.trigger.value))
                {
                    valid = false;
                    break;
                }

                if ((data.config.trigger.type == "crontab") && !cronosjs.validate(data.config.trigger.value, {strict: true}))
                {
                    valid = false;
                    break;
                }

                if ("type" in data.config.output)  // backward compatibility, v1.8.x configurations have empty output or only port property under output
                {
                    // check for valid output and convert according to type
                    if (data.config.output.type == "fullMsg")
                    {
                        if (data.config.output.contentType === "jsonata")
                        {
                            try
                            {
                                data.expression = chronos.getJSONataExpression(RED, node, data.config.output.value);
                            }
                            catch (e)
                            {
                                node.error(e.message);
                                node.debug("JSONata code: " + e.code + "  position: " + e.position + "  token: " + e.token + "  value: " + e.value);

                                valid = false;
                                break;
                            }
                        }
                        else
                        {
                            try
                            {
                                data.config.output.value = JSON.parse(data.config.output.value);
                            }
                            catch (e)
                            {
                                valid = false;
                                break;
                            }

                            if (typeof data.config.output.value != "object")
                            {
                                valid = false;
                                break;
                            }
                        }
                    }
                    else
                    {
                        if (!data.config.output.property.name)
                        {
                            valid = false;
                            break;
                        }

                        if (data.config.output.property.type == "num")
                        {
                            if (+data.config.output.property.value === +data.config.output.property.value)
                            {
                                data.config.output.property.value = +data.config.output.property.value;
                            }
                            else
                            {
                                valid = false;
                                break;
                            }
                        }
                        else if (data.config.output.property.type == "bool")
                        {
                            if (/^(true|false)$/.test(data.config.output.property.value))
                            {
                                data.config.output.property.value = (data.config.output.property.value == "true");
                            }
                            else
                            {
                                valid = false;
                                break;
                            }
                        }
                        else if (data.config.output.property.type == "json")
                        {
                            try
                            {
                                data.config.output.property.value = JSON.parse(data.config.output.property.value);
                            }
                            catch (e)
                            {
                                valid = false;
                                break;
                            }
                        }
                        else if (data.config.output.property.type == "jsonata")
                        {
                            try
                            {
                                data.expression = chronos.getJSONataExpression(RED, node, data.config.output.property.value);
                            }
                            catch (e)
                            {
                                node.error(e.message);
                                node.debug("JSONata code: " + e.code + "  position: " + e.position + "  token: " + e.token + "  value: " + e.value);

                                valid = false;
                                break;
                            }
                        }
                        else if (data.config.output.property.type == "bin")
                        {
                            try
                            {
                                data.config.output.property.value = Buffer.from(JSON.parse(data.config.output.property.value));
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

                let lazyInit = null;
                if (settings.nextEventPort)
                {
                    lazyInit = () =>
                    {
                        if (node.eventTimesPending)
                        {
                            notifyEventTimes();
                            node.eventTimesPending = false;
                        }

                        node.initializing = false;

                        if (lazyInit)
                        {
                            RED.events.removeListener("flows:started", lazyInit);
                            lazyInit = null;
                        }
                    };

                    RED.events.on("flows:started", lazyInit);
                }
                else
                {
                    node.initializing = false;
                }

                node.on("close", () =>
                {
                    stopTimers();

                    if (lazyInit)
                    {
                        RED.events.removeListener("flows:started", lazyInit);
                        lazyInit = null;
                    }
                });

                node.on("input", (msg, send, done) =>
                {
                    if (!send || !done)  // Node-RED 0.x not supported anymore
                    {
                        return;
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

                        updateStatus();
                        done();
                    }
                    else if (typeof msg.payload == "string")
                    {
                        if (msg.payload == "toggle")
                        {
                            toggleTimers();
                        }
                        else if (msg.payload == "reload")
                        {
                            resetNextEventMsg();
                            reloadTimers();
                        }
                        else if (msg.payload == "trigger")
                        {
                            triggerEvents(false);
                        }
                        else if (msg.payload == "trigger:forced")
                        {
                            triggerEvents(true);
                        }

                        updateStatus();
                        done();
                    }
                    else if (Array.isArray(msg.payload))
                    {
                        let numDisabled = 0;
                        for (let i=0; (i<msg.payload.length) && (i<node.schedule.length); ++i)
                        {
                            if (typeof msg.payload[i] == "boolean")
                            {
                                if (msg.payload[i])
                                {
                                    startTimer(node.schedule[i]);
                                }
                                else
                                {
                                    stopTimer(node.schedule[i]);
                                }
                            }
                            else if (typeof msg.payload[i] == "string")
                            {
                                if (msg.payload[i] == "toggle")
                                {
                                    toggleTimer(node.schedule[i]);
                                }
                                else if (msg.payload[i] == "reload")
                                {
                                    resetNextEventMsg(i);
                                    reloadTimer(node.schedule[i]);
                                }
                                else if (msg.payload[i] == "trigger")
                                {
                                    triggerEvent(node.schedule[i], false);
                                }
                                else if (msg.payload[i] == "trigger:forced")
                                {
                                    triggerEvent(node.schedule[i], true);
                                }
                            }
                            else if ((typeof msg.payload[i] == "object") && (msg.payload[i] != null))
                            {
                                let data = node.schedule[i];

                                if (validateExtendedContextData(msg.payload[i]))
                                {
                                    data.orig = {trigger: data.config.trigger, output: data.config.output};
                                    data.config.trigger = msg.payload[i].trigger;
                                    data.config.output = msg.payload[i].output;

                                    startTimer(data, true);
                                }
                                else if (validateContextData(msg.payload[i]))
                                {
                                    data.orig = {trigger: data.config.trigger};
                                    data.config.trigger = msg.payload[i];

                                    startTimer(data, true);
                                }
                                else
                                {
                                    node.error(RED._("scheduler.error.invalidMsgEvent", {event: "msg.payload[" + i + "]"}), msg);
                                }
                            }

                            if (!("timer" in node.schedule[i]))
                            {
                                numDisabled++;
                            }
                        }

                        node.disabledSchedule = (numDisabled == node.schedule.length);

                        updateStatus();
                        done();
                    }
                    else
                    {
                        updateStatus();
                        done(RED._("scheduler.error.invalidInput"));
                    }
                });

                if (!node.disabledSchedule)
                {
                    startTimers();
                    updateStatus();
                }
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

        function toggleTimers()
        {
            node.debug("Toggling timers");

            let numDisabled = 0;
            node.schedule.forEach(data =>
            {
                toggleTimer(data);

                if (!("timer" in data))
                {
                    numDisabled++;
                }
            });

            node.disabledSchedule = (numDisabled == node.schedule.length);
        }

        function reloadTimers()
        {
            node.debug("Rescheduling timers");

            node.schedule.forEach(data =>
            {
                reloadTimer(data);
            });
        }

        function triggerEvents(forced)
        {
            node.debug("Triggering events" + (forced ? " (forced)" : ""));

            node.schedule.forEach(data =>
            {
                triggerEvent(data, forced);
            });
        }

        function startTimer(data, keepOrig = false)
        {
            stopTimer(data, keepOrig);

            if ((data.config.trigger.type == "global") || (data.config.trigger.type == "flow"))
            {
                let ctx = RED.util.parseContextStore(data.config.trigger.value);
                node.debug("[Timer:" + data.id + "] Load trigger from context variable " + data.config.trigger.type + "." + ctx.key + (ctx.store ? " (" + ctx.store + ")" : ""));

                let ctxData = node.context()[data.config.trigger.type].get(ctx.key, ctx.store);

                if (validateExtendedContextData(ctxData))
                {
                    data.orig = {trigger: data.config.trigger, output: data.config.output};
                    data.config.trigger = ctxData.trigger;
                    data.config.output = ctxData.output;
                }
                else if (("type" in data.config.output)  // backward compatibility, v1.8.x configurations have empty output or only port property under output
                            && validateContextData(ctxData))
                {
                    data.orig = {trigger: data.config.trigger};
                    data.config.trigger = ctxData;
                }
                else
                {
                    node.error(RED._("scheduler.error.invalidCtxEvent", {event: data.config.trigger.type + "." + ctx.key + (ctx.store ? " (" + ctx.store + ")" : "")}), {});
                    return;
                }
            }

            setUpTimer(data, false);
        }

        function stopTimer(data, keepOrig = false)
        {
            if (("orig" in data) && (!keepOrig))
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

        function toggleTimer(data)
        {
            if ("timer" in data)
            {
                stopTimer(data);
            }
            else
            {
                startTimer(data);
            }
        }

        function reloadTimer(data)
        {
            if ("timer" in data)
            {
                startTimer(data);
            }
        }

        function triggerEvent(data, forced)
        {
            if (("timer" in data) || forced)
            {
                handleTimeout(data, false);
            }
        }

        function setUpTimer(data, repeat)
        {
            try
            {
                node.debug("[Timer:" + data.id + "] Set up timer" + (repeat ? " (repeating)" : ""));
                node.trace("[Timer:" + data.id + "] Timer specification: " + JSON.stringify(data.config));

                if (data.config.trigger.type == "crontab")
                {
                    const expression = cronosjs.CronosExpression.parse(data.config.trigger.value);
                    let firstTrigger = expression.nextDate();

                    if (firstTrigger)
                    {
                        data.triggerTime = chronos.getTimeFrom(node, firstTrigger);
                        data.timer = new cronosjs.CronosTask(expression);

                        data.timer.on("run", () =>
                        {
                            handleTimeout(data, false);

                            let nextTrigger = expression.nextDate();
                            if (nextTrigger)
                            {
                                data.triggerTime = chronos.getTimeFrom(node, nextTrigger);
                            }
                            else
                            {
                                delete data.triggerTime;
                            }

                            updateStatus();
                        });

                        data.timer.start();
                    }
                }
                else
                {
                    const now = chronos.getCurrentTime(node);
                    data.triggerTime = chronos.getTime(RED, node, repeat ? now.clone().add(1, "days") : now.clone(), data.config.trigger.type, data.config.trigger.value);

                    if ((typeof data.config.trigger.offset == "number") && (data.config.trigger.offset != 0))
                    {
                        let offset = (data.config.trigger.random === true) ? Math.round(Math.random() * data.config.trigger.offset) : data.config.trigger.offset;
                        data.triggerTime.add(offset, "minutes");
                    }

                    if (data.triggerTime.isBefore(now))
                    {
                        node.debug("[Timer:" + data.id + "] Trigger time before current time, adding one day");

                        if (data.config.trigger.type == "time")
                        {
                            data.triggerTime.add(1, "days");
                        }
                        else
                        {
                            data.triggerTime = chronos.getTime(RED, node, data.triggerTime.add(1, "days"), data.config.trigger.type, data.config.trigger.value);

                            if ((typeof data.config.trigger.offset == "number") && (data.config.trigger.offset != 0))
                            {
                                let offset = (data.config.trigger.random === true) ? Math.round(Math.random() * data.config.trigger.offset) : data.config.trigger.offset;
                                data.triggerTime.add(offset, "minutes");
                            }
                        }
                    }

                    node.debug("[Timer:" + data.id + "] Starting timer for trigger at " + data.triggerTime.format("YYYY-MM-DD HH:mm:ss (Z)"));
                    data.timer = setTimeout(handleTimeout, data.triggerTime.diff(now), data, true);
                }

                if (repeat)
                {
                    updateStatus();
                }
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

                delete data.triggerTime;
            }
        }

        function tearDownTimer(data)
        {
            node.debug("[Timer:" + data.id + "] Tear down timer");

            if (data.timer instanceof cronosjs.CronosTask)
            {
                data.timer.stop();
            }
            else
            {
                clearTimeout(data.timer);
            }

            delete data.timer;
            delete data.triggerTime;
        }

        function handleTimeout(data, restartTimer)
        {
            node.debug("[Timer:" + data.id + "] Timer expired");

            if (restartTimer)
            {
                delete data.timer;
            }

            try
            {
                if ((data.config.output.type == "global") || (data.config.output.type == "flow"))
                {
                    let value = null;

                    if (data.config.output.property.type === "jsonata")
                    {
                        value = getJSONataValue(data.expression, data.id, data.config.output.property.value);
                    }
                    else
                    {
                        value = data.config.output.property.value;
                    }

                    let ctx = RED.util.parseContextStore(data.config.output.property.name);
                    node.context()[data.config.output.type].set(ctx.key, value, ctx.store);
                }
                else if (data.config.output.type == "msg")
                {
                    let msg = {};
                    if (data.config.output.property.type === "date")
                    {
                        RED.util.setMessageProperty(msg, data.config.output.property.name, Date.now(), true);
                    }
                    else if (data.config.output.property.type === "jsonata")
                    {
                        let value = getJSONataValue(data.expression, data.id, data.config.output.property.value);
                        RED.util.setMessageProperty(msg, data.config.output.property.name, value, true);
                    }
                    else
                    {
                        RED.util.setMessageProperty(msg, data.config.output.property.name, data.config.output.property.value, true);
                    }

                    sendMessage(data, msg);
                }
                else if (data.config.output.type == "fullMsg")
                {
                    let msg = null;

                    if (data.config.output.contentType === "jsonata")
                    {
                        msg = getJSONataValue(data.expression, data.id, data.config.output.value);
                        if (typeof msg != "object")
                        {
                            const details = {event: data.id, expression: data.config.output.value, result: msg};
                            throw new chronos.TimeError(RED._("scheduler.error.notObject"), details);
                        }
                    }
                    else
                    {
                        msg = data.config.output.value;
                    }

                    sendMessage(data, msg);
                }
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

            if (restartTimer)
            {
                setUpTimer(data, true);
            }
        }

        function getJSONataValue(expression, id, source)
        {
            try
            {
                return RED.util.evaluateJSONataExpression(
                                    expression, {
                                        name: node.name,
                                        config: {
                                            name: node.config.name,
                                            latitude: node.config.latitude,
                                            longitude: node.config.longitude}});
            }
            catch (e)
            {
                const details = {event: id, expression: source, code: e.code, description: e.message, position: e.position, token: e.token};
                throw new chronos.TimeError(RED._("node-red-contrib-chronos/chronos-config:common.error.evaluationFailed"), details);
            }
        }

        function sendMessage(data, msg)
        {
            if (msg)
            {
                if (settings.multiPort)
                {
                    node.ports[data.port] = msg;
                    node.send(node.ports);
                    node.ports[data.port] = null;
                }
                else if (settings.nextEventPort)
                {
                    node.send([msg, null]);
                }
                else
                {
                    node.send(msg);
                }
            }
        }

        function validateContextData(data)
        {
            if ((typeof data != "object") || !data)
            {
                return false;
            }

            if ((typeof data.type != "string") || !/^(time|sun|moon|custom|crontab)$/.test(data.type))
            {
                return false;
            }

            if (((typeof data.value != "string") && (typeof data.value != "number")) ||
                ((data.type == "time") && !chronos.isValidUserTime(data.value)) ||
                ((data.type == "sun") && !/^(sunrise|sunriseEnd|sunsetStart|sunset|goldenHour|goldenHourEnd|night|nightEnd|dawn|nauticalDawn|dusk|nauticalDusk|solarNoon|nadir)$/.test(data.value)) ||
                ((data.type == "moon") && !/^(rise|set)$/.test(data.value)) ||
                ((data.type == "crontab") && !cronosjs.validate(data.value, {strict: true})))
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

            if ((data.output.type == "fullMsg") && (typeof data.output.contentType != "undefined"))
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

                if ((typeof data.output.property.type != "undefined") && (data.output.property.type !== "date"))
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

        function resetNextEventMsg(index)
        {
            if (settings.nextEventPort)
            {
                if (typeof index == "number")
                {
                    node.nextEventMsg.events[index] = undefined;
                }
                else
                {
                    node.nextEventMsg.payload = undefined;
                    node.nextEventMsg.events.fill(undefined);
                }
            }
        }

        function updateStatus()
        {
            if (node.disabledSchedule)
            {
                node.status({fill: "grey", shape: "dot", text: "scheduler.status.disabledSchedule"});
                resetNextEventMsg();
            }
            else
            {
                let nextTrigger = null;
                node.schedule.forEach(data =>
                {
                    if (data.triggerTime)
                    {
                        if (nextTrigger)
                        {
                            if (data.triggerTime.isBefore(nextTrigger))
                            {
                                nextTrigger = data.triggerTime;
                            }
                        }
                        else
                        {
                            nextTrigger = data.triggerTime;
                        }
                    }
                });

                if (nextTrigger)
                {
                    let when = nextTrigger.calendar(
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

                    node.status({fill: "green", shape: "dot", text: RED._("scheduler.status.nextEvent") + " " + when});

                    if (settings.nextEventPort)
                    {
                        let changed = false;

                        for (let i=0; i<node.schedule.length; ++i)
                        {
                            let data = node.schedule[i];

                            if (data.triggerTime)
                            {
                                let ts = data.triggerTime.valueOf();

                                if (node.nextEventMsg.events[i] !== ts)
                                {
                                    node.nextEventMsg.events[i] = ts;
                                    changed = true;
                                }
                            }
                            else if (node.nextEventMsg.events[i] !== null)
                            {
                                node.nextEventMsg.events[i] = null;
                                changed = true;
                            }
                        }

                        let ts = nextTrigger.valueOf();
                        if (node.nextEventMsg.payload !== ts)
                        {
                            node.nextEventMsg.payload = ts;
                            changed = true;
                        }

                        if (changed)
                        {
                            if (node.initializing)
                            {
                                node.eventTimesPending = true;
                            }
                            else
                            {
                                notifyEventTimes();
                            }
                        }
                    }
                }
                else
                {
                    node.status({fill: "yellow", shape: "dot", text: "scheduler.status.noTime"});
                    resetNextEventMsg();
                }
            }
        }

        function notifyEventTimes()
        {
            if (settings.multiPort)
            {
                node.ports[node.ports.length-1] = node.nextEventMsg;
                node.send(node.ports);
                node.ports[node.ports.length-1] = null;
            }
            else
            {
                node.send([null, node.nextEventMsg]);
            }
        }
    }

    RED.nodes.registerType("chronos-scheduler", ChronosSchedulerNode);
};
