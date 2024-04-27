/*
 * Copyright (c) 2024 Jens-Uwe Rossbach
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
    function ChronosStateNode(settings)
    {
        const chronos = require("./common/chronos.js");
        const sfUtils = require("./common/sfutils.js");

        const node = this;
        RED.nodes.createNode(node, settings);

        node.name = settings.name;
        node.config = RED.nodes.getNode(settings.config);
        node.locale = ("lang" in RED.settings) ? RED.settings.lang : require("os-locale").sync();

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
        else if ((settings.outputType != "fullMsg") && !settings.outputValue)
        {
            node.status({fill: "red", shape: "dot", text: "node-red-contrib-chronos/chronos-config:common.status.invalidConfig"});
            node.error(RED._("node-red-contrib-chronos/chronos-config:common.error.invalidConfig"));
        }
        else if (settings.states.length == 0)
        {
            node.status({fill: "red", shape: "dot", text: "state.status.noStates"});
            node.error(RED._("state.error.noStates"));
        }
        else
        {
            chronos.printNodeInfo(node);
            node.status({});

            let valid = true;
            node.states = [];

            for (let i=0; i<settings.states.length; ++i)
            {
                let data = undefined;

                const trigger = loadTrigger(settings.states[i].trigger);
                if (trigger)
                {
                    data = {id: i+1, trigger: trigger, state: settings.states[i].state, triggerConfig: settings.states[i].trigger};
                }
                else
                {
                    valid = false;
                    break;
                }

                // check for valid state and convert according to type
                if (data.state.type == "num")
                {
                    if (+data.state.value === +data.state.value)
                    {
                        data.state.value = +data.state.value;
                    }
                    else
                    {
                        valid = false;
                        break;
                    }
                }
                else if (data.state.type == "bool")
                {
                    if (/^(true|false)$/.test(data.state.value))
                    {
                        data.state.value = (data.state.value == "true");
                    }
                    else
                    {
                        valid = false;
                        break;
                    }
                }
                else if (data.state.type == "json")
                {
                    try
                    {
                        data.state.value = JSON.parse(data.state.value);
                    }
                    catch (e)
                    {
                        valid = false;
                        break;
                    }
                }
                else if (data.state.type == "bin")
                {
                    try
                    {
                        data.state.value = Buffer.from(JSON.parse(data.state.value));
                    }
                    catch (e)
                    {
                        valid = false;
                        break;
                    }
                }
                else if (data.state.type == "env")
                {
                    if (data.state.value)
                    {
                        data.state.value = RED.util.evaluateNodeProperty(
                                                    data.state.value,
                                                    data.state.type,
                                                    node);
                    }
                    else
                    {
                        valid = false;
                        break;
                    }
                }

                node.states.push(data);
            }

            if (valid)
            {
                node.outputType = settings.outputType;

                if (settings.outputType == "fullMsg")
                {
                    try
                    {
                        node.outputValue = chronos.getJSONataExpression(RED, node, settings.outputValue);
                    }
                    catch (e)
                    {
                        node.error(e.message);
                        node.debug("JSONata code: " + e.code + "  position: " + e.position + "  token: " + e.token + "  value: " + e.value);

                        valid = false;
                    }
                }
                else
                {
                    node.outputValue = settings.outputValue;
                }
            }

            if (valid && (settings.evaluationType == "jsonata"))
            {
                try
                {
                    node.evaluationExpression = RED.util.prepareJSONataExpression(settings.evaluation, node);
                }
                catch (e)
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
            else
            {
                node.conditions = settings.conditions;
                node.evaluation = settings.evaluation;
                node.evaluationType = settings.evaluationType;
                node.passiveMode = settings.passiveMode;

                node.currentState = {};

                node.on("close", () =>
                {
                    cancelTimer();
                });

                restoreCurrentState(false).then(() =>
                {
                    node.on("input", async(msg, send, done) =>
                    {
                        if (!send || !done)  // Node-RED 0.x not supported anymore
                        {
                            return;
                        }

                        if (msg.topic == "trigger")
                        {
                            if (node.passiveMode)
                            {
                                const triggerTime = chronos.getCurrentTime(node);

                                if ((typeof msg.payload == "number") &&
                                    (msg.payload >= 1) &&
                                    (msg.payload <= node.states.length))
                                {
                                    const targetState = node.states[msg.payload-1];

                                    if ((!node.currentState.data || (node.currentState.data.id != targetState.id)) &&
                                        (await evalConditions(triggerTime)))
                                    {
                                        await switchState({data: targetState, triggerTime: triggerTime});

                                        outputCurrentState();
                                        updateStatus();

                                        done();
                                    }
                                }
                                else if (node.currentState.data)
                                {
                                    const targetState = getState(triggerTime, triggerTime, false, true);

                                    if (targetState &&
                                        (targetState.data.id != node.currentState.data.id) &&
                                        (await evalConditions(targetState.triggerTime)))
                                    {
                                        await switchState(targetState);

                                        outputCurrentState();
                                        updateStatus();

                                        done();
                                    }
                                }
                            }
                            else
                            {
                                done(RED._("state.error.commandNotAllowed"), RED.util.cloneMessage(msg));
                            }
                        }
                        else if (msg.topic === "get")
                        {
                            outputCurrentState();
                            done();
                        }
                        else if (msg.topic === "set")
                        {
                            if ((typeof msg.payload == "number") &&
                                (msg.payload >= 1) &&
                                (msg.payload <= node.states.length))
                            {
                                const targetState = node.states[msg.payload-1];

                                if (!node.currentState.data ||
                                    (node.currentState.data.id != targetState.id))
                                {
                                    if (node.currentState.data)
                                    {
                                        // reload trigger of old state before new state is activated
                                        reloadTrigger(node.currentState.data);
                                    }

                                    node.currentState.data = targetState;
                                    node.currentState.since = chronos.getCurrentTime(node);

                                    if ("timeout" in msg)
                                    {
                                        let timeout = 0;

                                        if (typeof msg.timeout == "number")
                                        {
                                            // msg.timeout number is interpreted as minutes
                                            timeout = msg.timeout * 60000;
                                        }
                                        else if (typeof msg.timeout == "object")
                                        {
                                            if (typeof msg.timeout.hours == "number")
                                            {
                                                timeout += msg.timeout.hours * 3600000;
                                            }

                                            if (typeof msg.timeout.minutes == "number")
                                            {
                                                timeout += msg.timeout.minutes * 60000;
                                            }

                                            if (typeof msg.timeout.seconds == "number")
                                            {
                                                timeout += msg.timeout.seconds * 1000;
                                            }
                                        }

                                        if ((timeout >= 1000) && (timeout <= 86400000))
                                        {
                                            cancelTimer();

                                            node.debug("[State:" + node.currentState.data.id + "] Starting timer for timeout of " + timeout + " milliseconds");
                                            node.currentState.timer = setTimeout(resetCurrentState, timeout);
                                            node.currentState.until = node.currentState.since.clone();
                                            node.currentState.until.add(timeout, "milliseconds");
                                        }
                                    }
                                    else
                                    {
                                        node.currentState.until = await getNextTrigger();
                                    }

                                    outputCurrentState();
                                    updateStatus();

                                    done();
                                }
                            }
                        }
                        else if (msg.topic === "reset")
                        {
                            resetCurrentState();
                            done();
                        }
                        else if (msg.topic === "reload")
                        {
                            reload();
                            done();
                        }
                        else if (msg.topic === "configure")
                        {
                            let reset = false;

                            if (msg.payload && (typeof msg.payload == "object"))
                            {
                                if ("states" in msg.payload)
                                {
                                    if (msg.payload.states && Array.isArray(msg.payload.states))
                                    {
                                        for (let i=0; (i<msg.payload.states.length) && (i<node.states.length); ++i)
                                        {
                                            if (msg.payload.states[i] && (typeof msg.payload.states[i] == "object"))
                                            {
                                                if (("trigger" in msg.payload.states[i]) && validateTriggerData(msg.payload.states[i].trigger))
                                                {
                                                    node.states[i].triggerConfig = msg.payload.states[i].trigger;
                                                    node.states[i].trigger = prepareTrigger(msg.payload.states[i].trigger);
                                                    reset = true;
                                                }

                                                if (("state" in msg.payload.states[i]) && validateStateData(msg.payload.states[i].state))
                                                {
                                                    node.states[i].state = msg.payload.states[i].state;
                                                    reset = true;
                                                }
                                            }
                                        }
                                    }
                                }

                                if ("conditions" in msg.payload)
                                {
                                    if (msg.payload.conditions && Array.isArray(msg.payload.conditions))
                                    {
                                        for (let i=0; (i<msg.payload.conditions.length) && (i<node.conditions.length); ++i)
                                        {
                                            try
                                            {
                                                node.conditions[i] = sfUtils.convertCondition(RED, node, msg.payload.conditions[i], i+1);
                                                reset = true;
                                            }
                                            catch (e)
                                            {
                                                if (e instanceof node.chronos.TimeError)
                                                {
                                                    const errMsg = RED.util.cloneMessage(msg);

                                                    if (e.details)
                                                    {
                                                        errMsg.errorDetails = e.details;
                                                    }

                                                    node.error(e.message, errMsg);
                                                }
                                                else
                                                {
                                                    node.error(e.message);
                                                    node.debug(e.stack);
                                                }
                                            }
                                        }
                                    }
                                }
                            }

                            if (reset)
                            {
                                resetCurrentState();
                            }

                            done();
                        }
                        else
                        {
                            done(RED._("node-red-contrib-chronos/chronos-config:common.error.invalidInput"));
                        }
                    });

                    setUpTimer();
                    updateStatus();

                    if (settings.outputOnStart)
                    {
                        setTimeout(() =>
                        {
                            node.receive({topic: "get"});
                        }, (settings.outputOnStartDelay || 0.1) * 1000);
                    }
                });
            }
        }

        function loadTrigger(source)
        {
            let trigger = undefined;

            if ((source.type == "env") ||
                (source.type == "global") ||
                (source.type == "flow"))
            {
                let ctxData = undefined;
                let ctxName = undefined;

                if (source.type == "env")
                {
                    if (typeof source.value == "string")
                    {
                        ctxData = RED.util.evaluateNodeProperty(
                                                source.value,
                                                source.type,
                                                node);
                    }
                    else
                    {
                        ctxData = source.value;
                    }

                    ctxName = "${" + source.value + "}";
                }
                else
                {
                    let ctx = RED.util.parseContextStore(source.value);

                    ctxData = node.context()[source.type].get(ctx.key, ctx.store);
                    ctxName = source.type + "." + ctx.key + (ctx.store ? " (" + ctx.store + ")" : "");
                }

                if (validateTriggerData(ctxData))
                {
                    trigger = prepareTrigger(ctxData);
                }
                else
                {
                    node.error(RED._("state.error.invalidCtxTrigger", {trigger: ctxName}));
                }
            }
            else if (validateTriggerData(source))
            {
                trigger = prepareTrigger(source);
            }

            return trigger;
        }

        function prepareTrigger(data)
        {
            const trigger = {};

            trigger.type = data.type;

            if (data.type != "manual")
            {
                trigger.value = data.value;
                trigger.offset = data.random
                    ? Math.round(data.offset * Math.random())
                    : data.offset;
                trigger.random = data.random;
            }

            return trigger;
        }

        function reload()
        {
            node.debug("Reloading states");

            node.states.forEach(data =>
            {
                reloadTrigger(data);
            });

            setUpTimer();
        }

        function reloadTrigger(data)
        {
            const trigger = loadTrigger(data.triggerConfig);
            if (trigger)
            {
                data.trigger = trigger;
            }
        }

        function resetCurrentState()
        {
            cancelTimer();

            restoreCurrentState(true, false).then(() =>
            {
                setUpTimer();
                updateStatus();
            });
        }

        async function restoreCurrentState(output, ignoreRandomOffset = true)
        {
            const now = chronos.getCurrentTime(node);
            const baseDate = await getApplicableDate(now.clone(), true);

            // always assume a random offset of 0 when restoring last state to avoid weird effects
            let restoredState = getState(baseDate, now, ignoreRandomOffset, true);
            if (!restoredState && baseDate && baseDate.isSame(now, "day"))
            {
                // all state triggers are in the future -> search for last state yesterday and earlier
                restoredState = getState(
                                    await getApplicableDate(
                                            baseDate.subtract(1, "days"),
                                            true),
                                    now, ignoreRandomOffset, true);
            }

            if (restoredState)
            {
                const prevState = node.currentState.data;

                node.currentState.data = restoredState.data;
                node.currentState.since = restoredState.triggerTime;
                node.currentState.until = await getNextTrigger();

                if (output && (!prevState || (prevState.id != node.currentState.data.id)))
                {
                    outputCurrentState();
                }
            }
        }

        async function outputCurrentState()
        {
            if (node.currentState.data)
            {
                await outputState();
            }
        }

        function getState(baseTime, today, ignoreRandomOffset, reverse, precision)
        {
            let stateTriggerTime = undefined;
            let stateData = undefined;

            if (baseTime)
            {
                const isSameDay = baseTime.isSame(today, "day");

                node.states.forEach(data =>
                {
                    if (data.trigger.type != "manual")  // ignore manual triggers
                    {
                        try
                        {
                            let triggerTime = chronos.getTime(RED, node, baseTime.clone(), data.trigger.type, data.trigger.value);

                            if ((data.trigger.offset != 0) && (!data.trigger.random || !ignoreRandomOffset))
                            {
                                triggerTime.add(data.trigger.offset, "minutes");
                            }

                            if (reverse)
                            {
                                if (stateTriggerTime)
                                {
                                    if ((!isSameDay || triggerTime.isSameOrBefore(baseTime, precision)) &&
                                        triggerTime.isAfter(stateTriggerTime, precision))
                                    {
                                        stateTriggerTime = triggerTime;
                                        stateData = data;
                                    }
                                }
                                else if (!isSameDay || triggerTime.isSameOrBefore(baseTime, precision))
                                {
                                    stateTriggerTime = triggerTime;
                                    stateData = data;
                                }
                            }
                            else if (stateTriggerTime)
                            {
                                if ((!isSameDay || triggerTime.isAfter(baseTime, precision)) &&
                                    triggerTime.isBefore(stateTriggerTime, precision))
                                {
                                    stateTriggerTime = triggerTime;
                                    stateData = data;
                                }
                            }
                            else if (!isSameDay || triggerTime.isAfter(baseTime, precision))
                            {
                                stateTriggerTime = triggerTime;
                                stateData = data;
                            }
                        }
                        catch(e)
                        {
                            if (e instanceof chronos.TimeError)
                            {
                                node.debug(e.message);
                            }
                            else
                            {
                                node.error(e.message);
                                node.debug(e.stack);
                            }
                        }
                    }
                });
            }

            return stateData ? {data: stateData, triggerTime: stateTriggerTime} : undefined;
        }

        async function getNextTrigger()
        {
            const now = chronos.getCurrentTime(node);
            const baseDate = await getApplicableDate(now.clone());

            let nextState = getState(baseDate, now, false, false);
            if (!nextState && baseDate && baseDate.isSame(now, "day"))
            {
                // all state triggers are in the past -> search for next state tomorrow and later
                nextState = getState(
                                await getApplicableDate(baseDate.add(1, "days")),
                                now, false, false);
            }

            return nextState.triggerTime;
        }

        function getNextState()
        {
            const now = chronos.getCurrentTime(node);

            let nextState = getState(now, now, false, false);
            if (!nextState)
            {
                // all state triggers are in the past -> search for next state tomorrow
                nextState = getState(now.clone().add(1, "days"), now, false, false);
            }

            return nextState;
        }

        async function getApplicableDate(baseDate, reverse = false)
        {
            let day = 0;

            while (day < 366)
            {
                if (await evalConditions(baseDate))
                {
                    break;
                }
                else if (reverse)
                {
                    baseDate.subtract(1, "days");
                }
                else
                {
                    baseDate.add(1, "days");
                }

                ++day;
            }

            return (day < 366) ? baseDate : undefined;
        }

        async function evalConditions(baseTime)
        {
            let result = true;
            const condResults = [];

            for (let i=0; i<node.conditions.length; ++i)
            {
                result = sfUtils.evaluateDateCondition(baseTime, node.conditions[i]);

                if (node.evaluationType == "jsonata")
                {
                    condResults.push(result);
                }
                else if (((node.evaluationType == "and") && !result)
                            || ((node.evaluationType == "or") && result))
                {
                    break;
                }
            }

            if ((condResults.length > 0) && (node.evaluationType == "jsonata"))
            {
                try
                {
                    node.evaluationExpression.assign("condition", condResults);

                    result = await chronos.evaluateJSONataExpression(RED, node.evaluationExpression, {});
                    if (typeof result != "boolean")
                    {
                        node.error(RED._("node-red-contrib-chronos/chronos-config:common.error.notBoolean"));
                        result = false;
                    }
                }
                catch (e)
                {
                    node.error(
                            RED._("node-red-contrib-chronos/chronos-config:common.error.evaluationFailed"), {
                                errorDetails: {
                                    code: e.code,
                                    description: e.message,
                                    position: e.position,
                                    token: e.token
                                }
                            });
                    result = false;
                }
            }

            return result;
        }

        async function switchState(targetState)
        {
            if (node.currentState.data)
            {
                // reload trigger of old state before new state is activated
                reloadTrigger(node.currentState.data);
            }

            node.currentState.data = targetState.data;
            node.currentState.since = targetState.triggerTime;
            node.currentState.until = await getNextTrigger();
        }

        function setUpTimer()
        {
            if (!node.passiveMode)
            {
                const state = getNextState();
                if (state)
                {
                    node.debug("[State:" + state.data.id + "] Set up timer");
                    node.trace("[State:" + state.data.id + "] Trigger configuration: " + JSON.stringify(state.data.triggerConfig));
                    node.trace("[State:" + state.data.id + "] Trigger specification: " + JSON.stringify(state.data.trigger));

                    cancelTimer();

                    node.debug("[State:" + state.data.id + "] Starting timer for trigger at " + state.triggerTime.format("YYYY-MM-DD HH:mm:ss (Z)"));
                    node.currentState.timer = setTimeout(async() =>
                    {
                        node.debug("[State:" + state.data.id + "] Timer expired");
                        delete node.currentState.timer;

                        if (await evalConditions(state.triggerTime))
                        {
                            await switchState(state);

                            if (node.currentState.timer)
                            {
                                clearTimeout(node.currentState.timer);
                                delete node.currentState.timer;
                            }

                            outputState();
                        }

                        setUpTimer();
                        updateStatus();
                    }, state.triggerTime.diff(chronos.getCurrentTime(node)));
                }
            }
        }

        function cancelTimer()
        {
            if (node.currentState.timer)
            {
                clearTimeout(node.currentState.timer);
                delete node.currentState.timer;
            }
        }

        async function outputState()
        {
            try
            {
                if ((node.outputType == "global") || (node.outputType == "flow"))
                {
                    let ctx = RED.util.parseContextStore(node.outputValue);
                    node.context()[node.outputType].set(ctx.key, node.currentState.data.state.value, ctx.store);
                }
                else if (node.outputType == "msg")
                {
                    const msg = {};
                    if (node.currentState.data.state.type === "date")
                    {
                        RED.util.setMessageProperty(msg, node.outputValue, Date.now(), true);
                    }
                    else
                    {
                        RED.util.setMessageProperty(msg, node.outputValue, node.currentState.data.state.value, true);
                    }

                    node.send(msg);
                }
                else if (node.outputType == "fullMsg")
                {
                    const msg = await getJSONataValue();
                    if (typeof msg != "object")
                    {
                        throw new chronos.TimeError(
                                    RED._("node-red-contrib-chronos/chronos-config:common.error.notObject"),
                                    {event: node.currentState.data.id, result: msg});
                    }

                    node.send(msg);
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
        }

        async function getJSONataValue()
        {
            try
            {
                node.outputValue.assign(
                                    "state", {
                                        id: node.currentState.data.id,
                                        trigger: node.currentState.data.trigger,
                                        value: (node.currentState.data.state.type === "date") ? Date.now() : node.currentState.data.state.value,
                                        since: node.currentState.since.valueOf(),
                                        until: node.currentState.until ? node.currentState.until.valueOf() : null});

                return await chronos.evaluateJSONataExpression(RED, node.outputValue, {});
            }
            catch (e)
            {
                throw new chronos.TimeError(
                            RED._("node-red-contrib-chronos/chronos-config:common.error.evaluationFailed"), {
                                event: node.currentState.data.id,
                                code: e.code,
                                description: e.message,
                                position: e.position,
                                token: e.token});
            }
        }

        function validateTriggerData(data)
        {
            if ((typeof data != "object") || !data)
            {
                return false;
            }

            if ((typeof data.type != "string") || !/^(time|sun|moon|custom|manual)$/.test(data.type))
            {
                return false;
            }

            if ((data.type != "manual") && (typeof data.value != "string") && (typeof data.value != "number"))
            {
                return false;
            }

            if (((data.type == "time") && !chronos.isValidUserTime(data.value)) ||
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

        function validateStateData(data)
        {
            if ((typeof data != "object") || !data)
            {
                return false;
            }

            if ((typeof data.type != "undefined") && (data.type !== "date"))
            {
                return false;
            }

            if ((data.type !== "date") && (typeof data.value == "undefined"))
            {
                return false;
            }

            return true;
        }

        async function updateStatus()
        {
            if (node.currentState.data)
            {
                let stateValue = undefined;

                if (typeof node.currentState.data.state.value == "object")
                {
                    stateValue = RED._("state.status.currentState");
                }
                else if (typeof node.currentState.data.state.value == "string")
                {
                    stateValue =
                        ((node.currentState.data.state.value.length > 10)
                            ? node.currentState.data.state.value.substr(0, 10) + "..."
                            : node.currentState.data.state.value);
                }
                else
                {
                    stateValue = node.currentState.data.state.value;
                }

                let when = (node.currentState.until) ? node.currentState.until.calendar() : undefined;

                if (when)
                {
                    node.status({fill: "green", shape: "dot", text: "»" + stateValue + "« " + RED._("state.status.until") + " " + when});
                }
                else
                {
                    node.status({fill: "green", shape: "dot", text: stateValue});
                }
            }
            else
            {
                node.status({fill: "yellow", shape: "dot", text: "state.status.noState"});
            }
        }
    }

    RED.nodes.registerType("chronos-state", ChronosStateNode);
};
