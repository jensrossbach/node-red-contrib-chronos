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
    function ChronosFilterNode(settings)
    {
        const sfUtils = require("./common/sfutils.js");

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
        else if (settings.conditions.length == 0)
        {
            node.status({fill: "red", shape: "dot", text: "node-red-contrib-chronos/chronos-config:common.status.noConditions"});
            node.error(RED._("node-red-contrib-chronos/chronos-config:common.error.noConditions"));
        }
        else
        {
            node.debug("Starting node with configuration '" + node.config.name + "' (latitude " + node.config.latitude + ", longitude " + node.config.longitude + ")");
            node.status({});

            node.baseTime = settings.baseTime;
            node.baseTimeType = settings.baseTimeType;
            node.conditions = settings.conditions;

            node.evaluation = (typeof settings.evaluation != "undefined") ? settings.evaluation : "";
            if (typeof settings.evaluationType == "undefined")
            {
                if (settings.annotateOnly)
                {
                    node.evaluationType = "annotation";
                }
                else if (settings.allMustMatch)
                {
                    node.evaluationType = "and";
                }
                else
                {
                    node.evaluationType = "or";
                }
            }
            else
            {
                node.evaluationType = settings.evaluationType;
            }

            // backward compatibility to v1.5.0
            if (!node.baseTimeType)
            {
                node.baseTimeType = "msgIngress";
            }

            let valid = true;
            if ((node.baseTimeType != "msgIngress") && !node.baseTime)
            {
                valid = false;
            }
            else
            {
                for (let i=0; i<node.conditions.length; ++i)
                {
                    if (!sfUtils.validateCondition(node, node.conditions[i]))
                    {
                        valid = false;
                        break;
                    }
                }
            }

            if (valid && (node.evaluationType == "jsonata"))
            {
                try
                {
                    node.expression = RED.util.prepareJSONataExpression(node.evaluation, node);
                }
                catch (e)
                {
                    node.debug(e.code + ": " + e.message);
                    node.debug(e.stack);
                    node.debug("Position: " + e.position + "  Token: " + e.token + "  Value: " + e.value);

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

                        let baseTime = sfUtils.getBaseTime(RED, node, msg);
                        if (baseTime)
                        {
                            node.debug("Base time: " + baseTime.format("YYYY-MM-DD HH:mm:ss"));

                            let result = false;
                            let condResults = [];

                            for (let i=0; i<node.conditions.length; ++i)
                            {
                                try
                                {
                                    result = sfUtils.evaluateCondition(RED, node, baseTime, node.conditions[i], i+1);
                                }
                                catch (e)
                                {
                                    if (e instanceof node.chronos.TimeError)
                                    {
                                        let errMsg = RED.util.cloneMessage(msg);

                                        if (e.details)
                                        {
                                            if ("errorDetails" in errMsg)
                                            {
                                                errMsg._errorDetails = errMsg.errorDetails;
                                            }
                                            errMsg.errorDetails = e.details;
                                        }

                                        node.error(e.message, errMsg);
                                    }
                                    else
                                    {
                                        node.error(e.message);
                                        node.debug(e.stack);
                                    }

                                    // if time cannot be calculated, the condition counts as not fulfilled
                                    result = false;
                                }

                                if ((node.evaluationType == "annotation") || (node.evaluationType == "jsonata"))
                                {
                                    condResults.push(result);
                                }
                                else if (((node.evaluationType == "and") && !result) ||
                                         ((node.evaluationType == "or") && result))
                                {
                                    break;
                                }
                            }

                            if (node.evaluationType == "annotation")
                            {
                                if ("evaluation" in msg)
                                {
                                    msg._evaluation = msg.evaluation;
                                }
                                msg.evaluation = condResults;

                                send(msg);
                                done();
                            }
                            else if (node.evaluationType == "jsonata")
                            {
                                let inputMsg = RED.util.cloneMessage(msg);
                                if ("condition" in inputMsg)
                                {
                                    inputMsg._condition = inputMsg.condition;
                                }
                                inputMsg.condition = condResults;

                                node.debug("Evaluating: " + node.evaluation + " -> " + JSON.stringify(inputMsg));
                                RED.util.evaluateJSONataExpression(node.expression, inputMsg, (err, value) =>
                                {
                                    if (err)
                                    {
                                        node.debug(err.code + ": " + err.message);
                                        node.debug(err.stack);
                                        node.debug("Position: " + err.position + "  Token: " + err.token);

                                        done(RED._("filter.error.evaluationFailed"));
                                    }
                                    else if (typeof value != "boolean")
                                    {
                                        done(RED._("filter.error.notBoolean"));
                                    }
                                    else if (value)
                                    {
                                        send(msg);
                                        done();
                                    }
                                    else
                                    {
                                        done();
                                    }
                                });
                            }
                            else if (result)
                            {
                                send(msg);
                                done();
                            }
                            else
                            {
                                done();
                            }
                        }
                        else
                        {
                            let variable = node.baseTime;
                            if ((node.baseTimeType == "global") || (node.baseTimeType == "flow"))
                            {
                                let ctx = RED.util.parseContextStore(node.baseTime);
                                variable = ctx.key + (ctx.store ? " (" + ctx.store + ")" : "");
                            }

                            done(RED._("node-red-contrib-chronos/chronos-config:common.error.invalidBaseTime", {baseTime: node.baseTimeType + "." + variable}));
                        }
                    }
                });
            }
        }
    }

    RED.nodes.registerType("chronos-filter", ChronosFilterNode);
};
