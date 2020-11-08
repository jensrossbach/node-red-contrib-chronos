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
    function ChronosFilterNode(settings)
    {
        const chronos = require("./common/chronos.js");

        let node = this;
        RED.nodes.createNode(this, settings);

        node.config = RED.nodes.getNode(settings.config);

        if (!node.config)
        {
            node.status({fill: "red", shape: "dot", text: "node-red-contrib-chronos/chronos-config:common.status.noConfig"});
            node.error(RED._("node-red-contrib-chronos/chronos-config:common.error.noConfig"));
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
            chronos.init(RED, node.config.latitude, node.config.longitude, node.config.sunPositions);

            node.baseTime = settings.baseTime;
            node.baseTimeType = settings.baseTimeType;
            node.conditions = settings.conditions;
            node.allMustMatch = settings.allMustMatch;
            node.annotateOnly = settings.annotateOnly;

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
                    let cond = node.conditions[i];

                    // check for valid user time
                    if ((cond.operator == "before") || (cond.operator == "after"))
                    {
                        if ((cond.operands.type == "time") && !chronos.isValidUserTime(cond.operands.value))
                        {
                            valid = false;
                            break;
                        }
                    }
                    else if ((cond.operator == "between") || (cond.operator == "outside"))
                    {
                        if ((cond.operands[0].type == "time") && !chronos.isValidUserTime(cond.operands[0].value))
                        {
                            valid = false;
                            break;
                        }
                        if ((cond.operands[1].type == "time") && !chronos.isValidUserTime(cond.operands[1].value))
                        {
                            valid = false;
                            break;
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
                                args.push(msg);
                                node.error.apply(node, args);
                            };
                        }

                        let baseTime = getBaseTime(msg);
                        if (baseTime)
                        {
                            node.debug("Base time: " + baseTime.format("YYYY-MM-DD HH:mm:ss"));

                            let result = false;
                            let evaluation = [];

                            for (let i=0; i<node.conditions.length; ++i)
                            {
                                try
                                {
                                    let cond = node.conditions[i];

                                    if ((cond.operator == "before") || (cond.operator == "after"))
                                    {
                                        let targetTime = chronos.getTime(baseTime.clone(), cond.operands.type, cond.operands.value);

                                        if (cond.operands.offset != 0)
                                        {
                                            let offset = cond.operands.random ? Math.round(Math.random() * cond.operands.offset) : cond.operands.offset;
                                            targetTime.add(offset, "minutes");
                                        }

                                        node.debug("Check if " + cond.operator + " " + targetTime.format("YYYY-MM-DD HH:mm:ss"));
                                        result = (((cond.operator == "before") && baseTime.isBefore(targetTime)) ||
                                                ((cond.operator == "after") && baseTime.isSameOrAfter(targetTime)));
                                    }
                                    else if ((cond.operator == "between") || (cond.operator == "outside"))
                                    {
                                        let time1 = chronos.getTime(baseTime.clone(), cond.operands[0].type, cond.operands[0].value);
                                        let time2 = chronos.getTime(baseTime.clone(), cond.operands[1].type, cond.operands[1].value);

                                        if (cond.operands[0].offset != 0)
                                        {
                                            let offset = cond.operands[0].random ? Math.round(Math.random() * cond.operands[0].offset) : cond.operands[0].offset;
                                            time1.add(offset, "minutes");
                                        }
                                        if (cond.operands[1].offset != 0)
                                        {
                                            let offset = cond.operands[1].random ? Math.round(Math.random() * cond.operands[1].offset) : cond.operands[1].offset;
                                            time2.add(offset, "minutes");
                                        }

                                        if (time2.isSameOrBefore(time1))
                                        {
                                            if (cond.operands[1].type == "time")
                                            {
                                                time2.add(1, "days");
                                            }
                                            else
                                            {
                                                time2 = chronos.getTime(time2.add(1, "day"), cond.operands[1].type, cond.operands[1].value);
                                            }
                                        }

                                        node.debug("Check if " + cond.operator + " " + time1.format("YYYY-MM-DD HH:mm:ss") + " and " + time2.format("YYYY-MM-DD HH:mm:ss"));
                                        result = (((cond.operator == "between") && (baseTime.isSameOrAfter(time1) && baseTime.isSameOrBefore(time2))) ||
                                                ((cond.operator == "outside") && (baseTime.isBefore(time1) || baseTime.isAfter(time2))));
                                    }
                                    else if ((cond.operator == "weekdays"))
                                    {
                                        result = cond.operands[baseTime.day()];
                                    }
                                    else if ((cond.operator == "months"))
                                    {
                                        result = cond.operands[baseTime.month()];
                                    }
                                    else
                                    {
                                        result = false;
                                    }
                                }
                                catch (e)
                                {
                                    if (e instanceof chronos.TimeError)
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

                                    // if time cannot be calculated, the condition counts as not fulfilled
                                    result = false;
                                }

                                if (node.annotateOnly)
                                {
                                    evaluation.push(result);
                                }
                                else if ((node.allMustMatch && !result) ||
                                        (!node.allMustMatch && result))
                                {
                                    break;
                                }
                            }

                            if (node.annotateOnly)
                            {
                                if ("evaluation" in msg)
                                {
                                    msg._evaluation = msg.evaluation;
                                }
                                msg.evaluation = evaluation;

                                node.send(msg);
                            }
                            else if (result)
                            {
                                node.send(msg);
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

                            node.error(RED._("node-red-contrib-chronos/chronos-config:common.error.invalidBaseTime", {baseTime: node.baseTimeType + "." + variable}), msg);
                        }
                    }

                    done();
                });
            }
        }

        function getBaseTime(msg)
        {
            let ret = null;

            if (node.baseTimeType == "msgIngress")
            {
                ret = chronos.getCurrentTime();
            }
            else
            {
                let value = null;
                switch (node.baseTimeType)
                {
                    case "global":
                    case "flow":
                    {
                        let ctx = RED.util.parseContextStore(node.baseTime);
                        value = node.context()[node.baseTimeType].get(ctx.key, ctx.store);
                        break;
                    }
                    case "msg":
                    {
                        value = msg[node.baseTime];
                        break;
                    }
                }

                if (typeof value == "number")
                {
                    ret = chronos.getTimeFrom(value);
                }
            }

            return ret ? (ret.isValid() ? ret : null) : null;
        }
    }

    RED.nodes.registerType("chronos-filter", ChronosFilterNode);
};
