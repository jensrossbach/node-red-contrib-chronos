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
    function ChronosSwitchNode(settings)
    {
        const sfUtils = require("./common/sfutils.js");

        let node = this;
        RED.nodes.createNode(this, settings);

        node.chronos = require("./common/chronos.js");
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
        else if (!node.chronos.validateTimeZone(node))
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
            node.chronos.printNodeInfo(node);
            node.status({});

            node.baseTime = settings.baseTime;
            node.baseTimeType = settings.baseTimeType;
            node.conditions = settings.conditions;
            node.stopOnFirstMatch = settings.stopOnFirstMatch;

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
                let otherwise = false;
                for (let i=0; i<node.conditions.length; ++i)
                {
                    let cond = node.conditions[i];

                    if (cond.operator == "otherwise")
                    {
                        // only one otherwise condition is allowed
                        if (otherwise)
                        {
                            valid = false;
                            break;
                        }

                        otherwise = true;
                    }
                    else if (!sfUtils.validateCondition(node, cond))
                    {
                        valid = false;
                        break;
                    }
                }

                // otherwise condition must not be the only one
                if ((node.conditions.length == 1) && otherwise)
                {
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
                node.on("input", async(msg, send, done) =>
                {
                    if (msg)
                    {
                        if (!send || !done)  // Node-RED 0.x not supported anymore
                        {
                            return;
                        }

                        let baseTime = sfUtils.getBaseTime(RED, node, msg);
                        if (baseTime)
                        {
                            node.debug("Base time: " + baseTime.format("YYYY-MM-DD HH:mm:ss (Z)"));

                            let ports = [];

                            for (let i=0; i<node.conditions.length; ++i)
                            {
                                ports.push(null);
                            }

                            let numMatches = 0;
                            let otherwiseIndex = -1;
                            for (let i=0; i<node.conditions.length; ++i)
                            {
                                try
                                {
                                    let cond = node.conditions[i];

                                    if (cond.operator == "otherwise")
                                    {
                                        node.debug("[Condition:" + (i+1) + "] Otherwise");
                                        otherwiseIndex = i;
                                    }
                                    else if (await sfUtils.evaluateCondition(RED, node, msg, baseTime, cond, i+1))
                                    {
                                        ports[i] = true;
                                        numMatches++;
                                    }

                                    if (ports[i] && node.stopOnFirstMatch)
                                    {
                                        break;
                                    }
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
                                }
                            }

                            if ((numMatches == 0) && (otherwiseIndex >= 0))
                            {
                                ports[otherwiseIndex] = msg;
                            }
                            else if (numMatches > 0)
                            {
                                let firstPort = true;
                                for (let i=0; i<node.conditions.length; ++i)
                                {
                                    if (ports[i])
                                    {
                                        ports[i] = firstPort ? msg : RED.util.cloneMessage(msg);
                                        firstPort = false;
                                    }
                                }
                            }

                            send(ports);
                            done();
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

    RED.nodes.registerType("chronos-switch", ChronosSwitchNode);
};
