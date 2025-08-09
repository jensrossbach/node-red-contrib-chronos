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
    function ChronosSchedulerNode(settings)
    {
        const chronos = require("./common/chronos.js");
        const cronosjs = require("cronosjs");

        const node = this;
        RED.nodes.createNode(node, settings);

        node.RED = RED;
        node.name = settings.name;
        node.config = RED.nodes.getNode(settings.config);
        node.locale = ("lang" in RED.settings) ? RED.settings.lang : require("os-locale").sync();

        node.initializing = true;
        node.eventTimesPending = false;

        if (!node.config)
        {
            node.status({fill: "red", shape: "dot", text: "node-red-contrib-chronos/chronos-config:common.status.noConfig"});
            node.error(RED._("node-red-contrib-chronos/chronos-config:common.error.noConfig"));

            return;
        }

        if (!chronos.validateConfiguration(node))
        {
            node.status({fill: "red", shape: "dot", text: "node-red-contrib-chronos/chronos-config:common.status.invalidConfig"});
            node.error(RED._("node-red-contrib-chronos/chronos-config:common.error.invalidConfig"));

            return;
        }

        if (settings.schedule.length == 0)
        {
            node.status({fill: "red", shape: "dot", text: "scheduler.status.noSchedule"});
            node.error(RED._("scheduler.error.noSchedule"));

            return;
        }

        chronos.printNodeInfo(node);
        node.status({});

        node.disabledSchedule = (typeof settings.disabled == "undefined") ? false : settings.disabled;
        node.delayMessages = (typeof settings.delayOnStart == "undefined") ? true : settings.delayOnStart;

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
            else
            {
                node.schedule[i].port = 0;
            }
        }

        node.ports = [];
        for (let i=0; i<settings.outputs; ++i)
        {
            node.ports.push(null);
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
            if (((data.config.trigger.type == "env") || (data.config.trigger.type == "global") || (data.config.trigger.type == "flow"))
                    && !data.config.trigger.value)
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
                if (data.config.output.type == "fullMsg")
                {
                    if (data.config.output.contentType === "jsonata")
                    {
                        try
                        {
                            data.expression = chronos.getJSONataExpression(node, data.config.output.value);
                        }
                        catch (e)
                        {
                            node.error(e.message);
                            node.debug("JSONata code: " + e.code + "  position: " + e.position + "  token: " + e.token + "  value: " + e.value);

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

                    if ((data.config.output.property.type == "num") &&
                        (+data.config.output.property.value !== +data.config.output.property.value))
                    {
                        valid = false;
                        break;
                    }

                    if (data.config.output.property.type == "jsonata")
                    {
                        try
                        {
                            data.expression = chronos.getJSONataExpression(node, data.config.output.property.value);
                        }
                        catch (e)
                        {
                            node.error(e.message);
                            node.debug("JSONata code: " + e.code + "  position: " + e.position + "  token: " + e.token + "  value: " + e.value);

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

            return;
        }

        updateStatus();

        node.on("close", () =>
        {
            stopEvents();
        });

        node.on("input", async(msg, send, done) =>
        {
            if (!send || !done)  // Node-RED 0.x not supported anymore
            {
                return;
            }

            if (typeof msg.payload == "boolean")
            {
                if (msg.payload)
                {
                    node.disabledSchedule = false;
                    startEvents();
                }
                else
                {
                    stopEvents();
                    node.disabledSchedule = true;
                }

                updateStatus();
                done();
            }
            else if (typeof msg.payload == "string")
            {
                if (msg.payload == "toggle")
                {
                    toggleEvents();
                }
                else if (msg.payload == "reload")
                {
                    resetNextEventMsg();
                    reloadEvents();
                }
                else if (msg.payload == "trigger")
                {
                    await triggerEvents(false);
                }
                else if (msg.payload == "trigger:forced")
                {
                    await triggerEvents(true);
                }
                else if (msg.payload == "trigger:next")
                {
                    let nextEvent = getNextEvent();
                    if (nextEvent)
                    {
                        await triggerEvent(nextEvent, false);
                    }
                }

                updateStatus();
                done();
            }
            else if (Array.isArray(msg.payload))
            {
                let numEnabled = 0;
                for (let i=0; (i<msg.payload.length) && (i<node.schedule.length); ++i)
                {
                    if (typeof msg.payload[i] == "boolean")
                    {
                        if (msg.payload[i])
                        {
                            startEvent(node.schedule[i]);
                        }
                        else
                        {
                            stopEvent(node.schedule[i]);
                        }
                    }
                    else if (typeof msg.payload[i] == "string")
                    {
                        if (msg.payload[i] == "toggle")
                        {
                            toggleEvent(node.schedule[i]);
                        }
                        else if (msg.payload[i] == "reload")
                        {
                            resetNextEventMsg(i);
                            reloadEvent(node.schedule[i]);
                        }
                        else if (msg.payload[i] == "trigger")
                        {
                            await triggerEvent(node.schedule[i], false);
                        }
                        else if (msg.payload[i] == "trigger:forced")
                        {
                            await triggerEvent(node.schedule[i], true);
                        }
                    }
                    else if ((typeof msg.payload[i] == "object") && (msg.payload[i] != null))
                    {
                        let data = node.schedule[i];

                        if (validateFullStructuredContextData(msg.payload[i]))
                        {
                            data.orig = {trigger: data.config.trigger, output: data.config.output};
                            data.config.trigger = msg.payload[i].trigger;
                            data.config.output = msg.payload[i].output;

                            startEvent(data, true);
                        }
                        else if (validateStructuredContextData(msg.payload[i]))
                        {
                            data.orig = {trigger: data.config.trigger};
                            data.config.trigger = msg.payload[i];

                            startEvent(data, true);
                        }
                        else
                        {
                            msg.errorDetails = {property: "msg.payload[" + i + "]"};
                            node.error(RED._("scheduler.error.invalidMsgEvent"), msg);
                        }
                    }

                    if ("triggerTime" in node.schedule[i])
                    {
                        numEnabled++;
                    }
                }

                node.disabledSchedule = (numEnabled == 0);
                startTimer();

                updateStatus();
                done();
            }
            else
            {
                updateStatus();
                done(RED._("node-red-contrib-chronos/chronos-config:common.error.invalidInput"));
            }
        });

        if (node.delayMessages)
        {
            setTimeout(() =>
            {
                node.delayMessages = false;

                if (node.startQueue)
                {
                    for (let entry of node.startQueue)
                    {
                        sendMessage(entry);
                    }

                    delete node.startQueue;
                }
            }, (settings.onStartDelay || 0.1) * 1000);
        }

        if (!node.disabledSchedule)
        {
            startEvents();
            updateStatus();
        }

        function startEvents()
        {
            node.debug("Starting events");

            for (let data of node.schedule)
            {
                startEvent(data);
            }

            startTimer();
        }

        function stopEvents()
        {
            node.debug("Stopping events");

            for (let data of node.schedule)
            {
                stopEvent(data);
            }

            stopTimer();
        }

        function toggleEvents()
        {
            node.debug("Toggling events");

            let enabled = true;
            for (let data of node.schedule)
            {
                toggleEvent(data);

                if ("triggerTime" in data)
                {
                    enabled = false;
                }
            }

            node.disabledSchedule = enabled;
            startTimer();
        }

        function reloadEvents()
        {
            node.debug("Rescheduling events");

            for (let data of node.schedule)
            {
                reloadEvent(data);
            }

            startTimer();
        }

        async function triggerEvents(forced)
        {
            node.debug("Triggering events" + (forced ? " (forced)" : ""));

            for (let data of node.schedule)
            {
                await triggerEvent(data, forced);
            }
        }

        function startEvent(data, keepOrig = false)
        {
            stopEvent(data, keepOrig);

            if ((data.config.trigger.type == "env") ||
                (data.config.trigger.type == "global") ||
                (data.config.trigger.type == "flow"))
            {
                let ctxData = undefined;

                if (data.config.trigger.type == "env")
                {
                    if (typeof data.config.trigger.value == "string")
                    {
                        ctxData = RED.util.evaluateNodeProperty(
                                                data.config.trigger.value,
                                                data.config.trigger.type,
                                                node);
                        if (!ctxData)
                        {
                            ctxData = data.config.trigger.value;
                        }
                    }
                    else
                    {
                        ctxData = data.config.trigger.value;
                    }
                }
                else
                {
                    const ctx = RED.util.parseContextStore(data.config.trigger.value);
                    ctxData = node.context()[data.config.trigger.type].get(ctx.key, ctx.store);
                }

                if (validateFlatContextData(ctxData))
                {
                    data.orig = {trigger: data.config.trigger};
                    data.config.trigger = {type: "auto:time", value: ctxData};
                }
                else if (validateFullStructuredContextData(ctxData))
                {
                    data.orig = {trigger: data.config.trigger, output: data.config.output};
                    data.config.trigger = ctxData.trigger;
                    data.config.output = ctxData.output;
                }
                else if (("type" in data.config.output)  // backward compatibility, v1.8.x configurations have empty output or only port property under output
                            && validateStructuredContextData(ctxData))
                {
                    data.orig = {trigger: data.config.trigger};
                    data.config.trigger = ctxData;
                }
                else
                {
                    node.error(RED._("scheduler.error.invalidCtxEvent"), {errorDetails: {event: data.id, type: data.config.trigger.type, value: ctxData}});
                    return;
                }
            }

            setUpEvent(data);
        }

        function stopEvent(data, keepOrig = false)
        {
            if (("orig" in data) && !keepOrig)
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

            if ("task" in data)
            {
                node.debug("[Event:" + data.id + "] Stopping cron task");

                data.task.stop();
                delete data.task;
            }

            delete data.triggerTime;
        }

        function toggleEvent(data)
        {
            if ("triggerTime" in data)
            {
                stopEvent(data);
            }
            else
            {
                startEvent(data);
            }
        }

        function reloadEvent(data)
        {
            if ("triggerTime" in data)
            {
                startEvent(data);
            }
        }

        async function triggerEvent(data, forced)
        {
            if (("triggerTime" in data) || forced)
            {
                await produceOutput(data, false);
            }
        }

        function setUpEvent(data, prevTriggerTime = undefined)
        {
            try
            {
                node.trace("[Event:" + data.id + "] Event specification: " + JSON.stringify(data.config));

                if (data.config.trigger.type == "crontab")
                {
                    const expression = cronosjs.CronosExpression.parse(data.config.trigger.value);
                    let firstTrigger = expression.nextDate();

                    if (firstTrigger)
                    {
                        data.triggerTime = chronos.getTimeFrom(node, firstTrigger);
                        data.task = new cronosjs.CronosTask(expression);

                        data.task.on("run", async() =>
                        {
                            node.trace("[Event:" + data.id + "] Cron task expired");
                            await produceOutput(data, false);

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

                        node.debug("[Event:" + data.id + "] Starting cron task with first trigger at " + data.triggerTime.format("YYYY-MM-DD HH:mm:ss (Z)"));
                        data.task.start();
                    }
                }
                else
                {
                    const now = chronos.getCurrentTime(node);
                    data.triggerTime = chronos.getTime(node, prevTriggerTime ? prevTriggerTime.clone().add(1, "days") : now.clone(), data.config.trigger.type, data.config.trigger.value);

                    if (typeof data.config.trigger.offset == "number")
                    {
                        const offset = chronos.getRandomizedOffset(data.config.trigger.offset, data.config.trigger.random);
                        data.triggerTime.add(offset, "minutes");
                    }

                    if (data.triggerTime.isBefore(now))
                    {
                        node.trace("[Event:" + data.id + "] Trigger time before current time, adding one day");

                        if (data.config.trigger.type == "time")
                        {
                            data.triggerTime.add(1, "days");
                        }
                        else
                        {
                            data.triggerTime = chronos.getTime(node, data.triggerTime.add(1, "days"), data.config.trigger.type, data.config.trigger.value);

                            if (typeof data.config.trigger.offset == "number")
                            {
                                const offset = chronos.getRandomizedOffset(data.config.trigger.offset, data.config.trigger.random);
                                data.triggerTime.add(offset, "minutes");
                            }
                        }
                    }

                    node.debug("[Event:" + data.id + "] Event triggers at " + data.triggerTime.format("YYYY-MM-DD HH:mm:ss.SSS (Z)"));
                }

                if (prevTriggerTime)
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

                // set to null in order distinguish from disabled / not started state
                data.triggerTime = null;
            }
        }

        function startTimer()
        {
            let next = undefined;
            let events = undefined;

            stopTimer();

            if (!node.disabledSchedule)
            {
                for (let data of node.schedule)
                {
                    if ((data.config.trigger.type != "crontab") && data.triggerTime)
                    {
                        if (next)
                        {
                            if (data.triggerTime.isBefore(next, "second"))
                            {
                                next = data.triggerTime;
                                events = [data];
                            }
                            else if (data.triggerTime.isSame(next, "second"))
                            {
                                // group all events that trigger within one second
                                events.push(data);
                            }
                        }
                        else
                        {
                            next = data.triggerTime;
                            events = [data];
                        }
                    }
                }

                if (next)
                {
                    if (events.length > 1)
                    {
                        // align trigger time to full seconds if multiple events are grouped
                        next.milliseconds(0);
                    }

                    node.debug("Starting timer for trigger at " + next.format("YYYY-MM-DD HH:mm:ss.SSS (Z)"));

                    const sched = chronos.getCurrentTime(node);
                    const delay = next.diff(sched);

                    node.timer = setTimeout(async() =>
                    {
                        node.debug("Timer with ID " + node.timer + " expired");

                        const now = chronos.getCurrentTime(node);
                        if (now.isBefore(next))
                        {
                            // when running is a docker environment, it can happen that timers
                            // run too fast and therefore expire too early
                            node.debug("Timer expired too early, ignoring");
                        }
                        else
                        {
                            for (let data of events)
                            {
                                await produceOutput(data);
                                setUpEvent(data, next);
                            }
                        }

                        startTimer();
                    }, (delay > 0) ? delay : 0);

                    node.debug("Successfully started timer with ID " + node.timer + " at " + sched.format("YYYY-MM-DD HH:mm:ss.SSS (Z)") + " waiting " + delay + " milliseconds");
                }
            }
        }

        function stopTimer()
        {
            if (node.timer)
            {
                node.debug("Stopping timer with ID " + node.timer);

                clearTimeout(node.timer);
                delete node.timer;
            }
        }

        async function produceOutput(data)
        {
            try
            {
                if ((data.config.output.type == "global") || (data.config.output.type == "flow"))
                {
                    let value = undefined;
                    if (data.config.output.property.type === "jsonata")
                    {
                        value = await getJSONataValue(data.expression, data.id, data.config.trigger, data.config.output.property.value);
                    }
                    else
                    {
                        value = await getOutputValue(data.config.output.property.value, data.config.output.property.type);
                    }

                    const ctx = RED.util.parseContextStore(data.config.output.property.name);
                    node.context()[data.config.output.type].set(ctx.key, value, ctx.store);
                }
                else if (data.config.output.type == "msg")
                {
                    const msg = {};
                    if (data.config.output.property.type === "jsonata")
                    {
                        const value = await getJSONataValue(data.expression, data.id, data.config.trigger, data.config.output.property.value);
                        RED.util.setMessageProperty(msg, data.config.output.property.name, value, true);
                    }
                    else
                    {
                        const value = await getOutputValue(data.config.output.property.value, data.config.output.property.type);
                        RED.util.setMessageProperty(msg, data.config.output.property.name, value, true);
                    }

                    sendOrQueue(msg, data.port, false);
                }
                else if (data.config.output.type == "fullMsg")
                {
                    let msg = undefined;
                    if (data.config.output.contentType === "jsonata")
                    {
                        msg = await getJSONataValue(data.expression, data.id, data.config.trigger, data.config.output.value);
                    }
                    else
                    {
                        msg = await getOutputValue(data.config.output.value, data.config.output.contentType);
                    }

                    if (typeof msg != "object")
                    {
                        const details = {event: data.id, result: msg};
                        throw new chronos.TimeError(RED._("node-red-contrib-chronos/chronos-config:common.error.notObject"), details);
                    }

                    sendOrQueue(msg, data.port, false);
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
                    node.error(e.message, {errorDetails: {event: data.id}});
                }
            }
        }

        async function getOutputValue(value, type)
        {
            let ret = undefined;

            if (type)
            {
                ret = await chronos.evaluateNodeProperty(node, value, type, {});
            }
            else
            {
                ret = value;
            }

            return ret;
        }

        async function getJSONataValue(expression, id, trigger, source)
        {
            try
            {
                expression.assign(
                            "event", {
                                id: id,
                                trigger: trigger});

                return await chronos.evaluateJSONataExpression(RED, expression, {});
            }
            catch (e)
            {
                const details = {event: id, expression: source, code: e.code, description: e.message, position: e.position, token: e.token};
                throw new chronos.TimeError(RED._("node-red-contrib-chronos/chronos-config:common.error.evaluationFailed"), details);
            }
        }

        function sendOrQueue(msg, port, notification)
        {
            if (msg)
            {
                const entry = {msg: msg, port: port, notification: notification};

                if (node.delayMessages)
                {
                    if (node.startQueue)
                    {
                        node.startQueue.push(entry);
                    }
                    else
                    {
                        node.startQueue = [entry];
                    }
                }
                else
                {
                    sendMessage(entry);
                }
            }
        }

        function sendMessage(entry)
        {
            if (node.ports.length > 1)
            {
                node.ports[entry.port] = entry.msg;
                node.send(node.ports);
                node.ports[entry.port] = null;
            }
            else
            {
                node.send(entry.msg);
            }
        }

        function validateFlatContextData(data)
        {
            if ((typeof data != "string") && (typeof data != "number"))
            {
                return false;
            }

            if ((typeof data == "string") && !data)
            {
                return false;
            }

            if ((typeof data == "string") && !chronos.PATTERN_AUTO_TIME.test(data))
            {
                return false;
            }

            if ((typeof data == "number") && ((data < 0) || (data >= 86400000)))
            {
                return false;
            }

            return true;
        }

        function validateStructuredContextData(data)
        {
            if ((typeof data != "object") || !data)
            {
                return false;
            }

            if ((typeof data.type != "string") || !/^time|sun|moon|custom|crontab$/.test(data.type))
            {
                return false;
            }

            if (((typeof data.value != "string") && (typeof data.value != "number")) ||
                ((data.type == "time") && !chronos.isValidUserTime(data.value)) ||
                ((data.type == "sun") && !chronos.PATTERN_SUNTIME.test(data.value)) ||
                ((data.type == "moon") && !chronos.PATTERN_MOONTIME.test(data.value)) ||
                ((data.type == "crontab") && !cronosjs.validate(data.value, {strict: true})))
            {
                return false;
            }

            if (!chronos.validateOffset(data))
            {
                return false;
            }

            return true;
        }

        function validateFullStructuredContextData(data)
        {
            if ((typeof data != "object") || !data)
            {
                return false;
            }

            if (!validateStructuredContextData(data.trigger))
            {
                return false;
            }

            if ((typeof data.output != "object") || !data.output)
            {
                return false;
            }

            if ((typeof data.output.type != "string") || !/^global|flow|msg|fullMsg$/.test(data.output.type))
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

                if ((data.output.property.type === "date") &&
                    !((typeof data.output.property.value == "undefined") || /^iso|object$/.test(data.output.property.value)))
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

        function getNextEvent()
        {
            let nextEvent = undefined;

            node.schedule.forEach(data =>
            {
                if (data.triggerTime)
                {
                    if (nextEvent)
                    {
                        if (data.triggerTime.isBefore(nextEvent.triggerTime))
                        {
                            nextEvent = data;
                        }
                    }
                    else
                    {
                        nextEvent = data;
                    }
                }
            });

            return nextEvent;
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
                let nextEvent = getNextEvent();
                if (nextEvent)
                {
                    node.status({
                            fill: "green",
                            shape: "dot",
                            text: RED._("scheduler.status.nextEvent") + " " + nextEvent.triggerTime.calendar()});

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

                        let ts = nextEvent.triggerTime.valueOf();
                        if (node.nextEventMsg.payload !== ts)
                        {
                            node.nextEventMsg.payload = ts;
                            changed = true;
                        }

                        if (changed)
                        {
                            sendOrQueue(node.nextEventMsg, node.ports.length - 1, true);
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
    }

    RED.nodes.registerType("chronos-scheduler", ChronosSchedulerNode);
};
