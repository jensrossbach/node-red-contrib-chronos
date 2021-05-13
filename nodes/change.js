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
    function ChronosChangeNode(settings)
    {
        let node = this;
        RED.nodes.createNode(this, settings);

        node.chronos = require("./common/chronos.js");
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
        else if (settings.rules.length == 0)
        {
            node.status({fill: "red", shape: "dot", text: "change.status.noRules"});
            node.error(RED._("change.error.noRules"));
        }
        else
        {
            node.debug("Starting node with configuration '" + node.config.name + "' (latitude " + node.config.latitude + ", longitude " + node.config.longitude + ")");
            node.status({});

            node.rules = settings.rules;

            let valid = true;
            for (let i=0; i<node.rules.length; ++i)
            {
                let rule = node.rules[i];

                if ((rule.action == "set") && (rule.type == "date"))
                {
                    if (!node.chronos.isValidUserDate(rule.date))
                    {
                        valid = false;
                        break;
                    }
                    if ((rule.time.type == "time") && !node.chronos.isValidUserTime(rule.time.value))
                    {
                        valid = false;
                        break;
                    }
                }
                else if ((rule.action == "change") && (rule.type == "toString") && !rule.format)
                {
                    valid = false;
                    break;
                }
            }

            if (!valid)
            {
                node.status({fill: "red", shape: "dot", text: "node-red-contrib-chronos/chronos-config:common.status.invalidConfig"});
                node.error(RED._("node-red-contrib-chronos/chronos-config:common.error.invalidConfig"));
            }
            else
            {
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

                        for (let i=0; i<node.rules.length; ++i)
                        {
                            try
                            {
                                let rule = node.rules[i];

                                if (rule.action == "set")
                                {
                                    switch (rule.type)
                                    {
                                        case "now":
                                        {
                                            setTarget(msg, rule.target, Date.now());
                                            break;
                                        }
                                        case "date":
                                        {
                                            setTarget(msg, rule.target, node.chronos.getTime(RED, node, node.chronos.getUserDate(RED, node, rule.date), rule.time.type, rule.time.value).valueOf());
                                            break;
                                        }
                                    }
                                }
                                else if (rule.action == "change")
                                {
                                    let input = null;
                                    let property = getTarget(msg, rule.target);

                                    if (property && ((typeof property == "number") || (typeof property == "string")))
                                    {
                                        input = node.chronos.getTimeFrom(node, property);
                                        if (!input.isValid())
                                        {
                                            input = null;
                                        }
                                    }

                                    if (input)
                                    {
                                        let output = null;

                                        switch (rule.type)
                                        {
                                            case "set":
                                            {
                                                switch (rule.part)
                                                {
                                                    case "year":
                                                    {
                                                        input.year(rule.value);
                                                        break;
                                                    }
                                                    case "quarter":
                                                    {
                                                        input.quarter(rule.value);
                                                        break;
                                                    }
                                                    case "month":
                                                    {
                                                        input.month(rule.value - 1);
                                                        break;
                                                    }
                                                    case "week":
                                                    {
                                                        input.week(rule.value);
                                                        break;
                                                    }
                                                    case "weekday":
                                                    {
                                                        input.weekday(rule.value - 1);
                                                        break;
                                                    }
                                                    case "day":
                                                    {
                                                        input.date(rule.value);
                                                        break;
                                                    }
                                                    case "hour":
                                                    {
                                                        input.hour(rule.value);
                                                        break;
                                                    }
                                                    case "minute":
                                                    {
                                                        input.minute(rule.value);
                                                        break;
                                                    }
                                                    case "second":
                                                    {
                                                        input.second(rule.value);
                                                        break;
                                                    }
                                                    case "millisecond":
                                                    {
                                                        input.millisecond(rule.value);
                                                        break;
                                                    }
                                                }

                                                output = input.valueOf();
                                                break;
                                            }
                                            case "add":
                                            {
                                                input.add(rule.value, rule.unit);
                                                output = input.valueOf();
                                                break;
                                            }
                                            case "subtract":
                                            {
                                                input.subtract(rule.value, rule.unit);
                                                output = input.valueOf();
                                                break;
                                            }
                                            case "startOf":
                                            {
                                                input.startOf(rule.arg);
                                                output = input.valueOf();
                                                break;
                                            }
                                            case "endOf":
                                            {
                                                input.endOf(rule.arg);
                                                output = input.valueOf();
                                                break;
                                            }
                                            case "toString":
                                            {
                                                output = input.format(rule.format);
                                                break;
                                            }
                                        }

                                        setTarget(msg, rule.target, output);
                                    }
                                    else
                                    {
                                        let prop = rule.target.name;
                                        if ((rule.target.type == "global") || (rule.target.type == "flow"))
                                        {
                                            let ctx = RED.util.parseContextStore(rule.target.name);
                                            prop = ctx.key + (ctx.store ? " (" + ctx.store + ")" : "");
                                        }

                                        node.error(RED._("change.error.invalidProperty", {property: rule.target.type + "." + prop}), msg);
                                    }
                                }
                            }
                            catch (e)
                            {
                                if (e instanceof node.chronos.TimeError)
                                {
                                    let errMsg = RED.util.cloneMessage(msg);

                                    if ("errorDetails" in errMsg)
                                    {
                                        errMsg._errorDetails = errMsg.errorDetails;
                                    }
                                    errMsg.errorDetails = e.details;

                                    node.error(e.message, errMsg);
                                }
                                else
                                {
                                    node.error(e.message);
                                    node.debug(e.stack);
                                }
                            }
                        }

                        node.send(msg);
                    }

                    done();
                });
            }
        }

        function getTarget(msg, target)
        {
            let value = null;
            switch (target.type)
            {
                case "global":
                case "flow":
                {
                    let ctx = RED.util.parseContextStore(target.name);
                    value = node.context()[target.type].get(ctx.key, ctx.store);
                    break;
                }
                case "msg":
                {
                    value = RED.util.getMessageProperty(msg, target.name);
                    break;
                }
            }

            return value;
        }

        function setTarget(msg, target, value)
        {
            switch (target.type)
            {
                case "global":
                case "flow":
                {
                    let ctx = RED.util.parseContextStore(target.name);
                    node.context()[target.type].set(ctx.key, value, ctx.store);
                    break;
                }
                case "msg":
                {
                    RED.util.setMessageProperty(msg, target.name, value, true);
                    break;
                }
            }
        }
    }

    RED.nodes.registerType("chronos-change", ChronosChangeNode);
};
