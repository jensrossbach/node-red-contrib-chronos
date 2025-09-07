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
    function ChronosFilterNode(settings)
    {
        const sfUtils = require("./common/sfutils.js");

        let node = this;
        RED.nodes.createNode(this, settings);

        node.RED = RED;
        node.chronos = require("./common/chronos.js");
        node.name = settings.name;
        node.config = RED.nodes.getNode(settings.config);

        if (!node.config)
        {
            node.status({fill: "red", shape: "dot", text: "node-red-contrib-chronos/chronos-config:common.status.noConfig"});
            node.error(RED._("node-red-contrib-chronos/chronos-config:common.error.noConfig"));

            return;
        }

        if (!node.chronos.validateConfiguration(node))
        {
            node.status({fill: "red", shape: "dot", text: "node-red-contrib-chronos/chronos-config:common.status.invalidConfig"});
            node.error(RED._("node-red-contrib-chronos/chronos-config:common.error.invalidConfig"));

            return;
        }

        if (settings.conditions.length == 0)
        {
            node.status({fill: "red", shape: "dot", text: "node-red-contrib-chronos/chronos-config:common.status.noConditions"});
            node.error(RED._("node-red-contrib-chronos/chronos-config:common.error.noConditions"));

            return;
        }

        node.chronos.printNodeInfo(node);
        node.status({});

        node.reference = settings.reference || "";
        node.referenceType = settings.referenceType || "absTime";
        node.baseTime = settings.baseTime || "";
        node.baseTimeType = settings.baseTimeType || "msgIngress";
        node.conditions = settings.conditions;

        node.evaluation = (typeof settings.evaluation != "undefined") ? settings.evaluation : "";
        if (typeof settings.evaluationType == "undefined")  // backward compatibility to v1.11.1
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

        let valid = true;
        if ((node.baseTimeType != "msgIngress") && !node.baseTime)
        {
            valid = false;
        }
        else
        {
            for (let i=0; i<node.conditions.length; ++i)
            {
                if (!sfUtils.validateCondition(node, node.conditions[i], node.referenceType == "absTime"))
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
                node.error(e.message);
                node.debug("JSONata code: " + e.code + "  position: " + e.position + "  token: " + e.token + "  value: " + e.value);

                valid = false;
            }
        }

        if (!valid)
        {
            node.status({fill: "red", shape: "dot", text: "node-red-contrib-chronos/chronos-config:common.status.invalidConfig"});
            node.error(RED._("node-red-contrib-chronos/chronos-config:common.error.invalidConfig"));

            return;
        }

        node.on("input", async(msg, send, done) =>
        {
            if (msg)
            {
                if (!send || !done)  // Node-RED 0.x not supported anymore
                {
                    return;
                }

                try
                {
                    const reference = sfUtils.getReference(node, msg);
                    if (reference)
                    {
                        if (reference == "absTime")
                        {
                            node.debug("Absolute time reference");
                        }
                        else
                        {
                            node.debug("Reference time: " + reference.format("YYYY-MM-DD HH:mm:ss (Z)"));
                        }

                        const baseTime = sfUtils.getBaseTime(node, msg);
                        if (baseTime)
                        {
                            node.debug("Base time: " + baseTime.format("YYYY-MM-DD HH:mm:ss (Z)"));

                            let result = false;
                            const condResults = [];

                            for (let i=0; i<node.conditions.length; ++i)
                            {
                                try
                                {
                                    result = await sfUtils.evaluateCondition(node, msg, reference, baseTime, node.conditions[i], i+1);
                                }
                                catch (e)
                                {
                                    if (e instanceof node.chronos.TimeError)
                                    {
                                        const errMsg = RED.util.cloneMessage(msg);

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
                                        throw e;
                                    }

                                    // if time cannot be calculated, the condition counts as not fulfilled
                                    result = false;
                                }

                                if ((node.evaluationType == "annotation") || (node.evaluationType == "jsonata"))
                                {
                                    condResults.push(result);
                                }
                                else if (((node.evaluationType == "and") && !result)
                                            || ((node.evaluationType == "or") && result))
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
                                node.expression.assign("condition", condResults);

                                node.debug("Evaluating: " + node.evaluation + " -> " + JSON.stringify(condResults));
                                RED.util.evaluateJSONataExpression(node.expression, msg, (err, value) =>
                                {
                                    if (err)
                                    {
                                        node.error(err.message);
                                        node.debug("JSONata code: " + err.code + "  position: " + err.position + "  token: " + err.token);

                                        done(RED._("node-red-contrib-chronos/chronos-config:common.error.evaluationFailed"));
                                    }
                                    else if (typeof value != "boolean")
                                    {
                                        done(RED._("node-red-contrib-chronos/chronos-config:common.error.notBoolean"));
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
                    else
                    {
                        let variable = node.reference;
                        if ((node.referenceType == "global") || (node.referenceType == "flow"))
                        {
                            let ctx = RED.util.parseContextStore(node.reference);
                            variable = ctx.key + (ctx.store ? " (" + ctx.store + ")" : "");
                        }

                        done(RED._("node-red-contrib-chronos/chronos-config:common.error.invalidReference", {reference: node.referenceType + "." + variable}));
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

                        done(e.message, errMsg);
                    }
                    else
                    {
                        throw e;
                    }
                }
            }
        });
    }

    RED.nodes.registerType("chronos-filter", ChronosFilterNode);
};
