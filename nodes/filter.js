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
        const moment = require("moment");
        const time = require("./common/time.js");

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
            time.init(RED, node.config.latitude, node.config.longitude);

            node.conditions = settings.conditions;
            node.allMustMatch = settings.allMustMatch;

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

                    let now = moment();
                    let result = false;

                    for (let i=0; i<node.conditions.length; ++i)
                    {
                        try
                        {
                            let cond = node.conditions[i];

                            if ((cond.operator == "before") || (cond.operator == "after"))
                            {
                                let targetTime = getTime(now.clone(), cond.operands);

                                node.debug("Check if " + cond.operator + " " + targetTime.format("YYYY-MM-DD HH:mm:ss"));
                                result = (((cond.operator == "before") && now.isBefore(targetTime)) ||
                                          ((cond.operator == "after") && now.isAfter(targetTime)));
                            }
                            else if ((cond.operator == "between") || (cond.operator == "outside"))
                            {
                                let time1 = getTime(now.clone(), cond.operands[0]);
                                let time2 = getTime(now.clone(), cond.operands[1]);

                                if (time2.isBefore(time1))
                                {
                                    if (cond.operands[1].type == "time")
                                    {
                                        time2.add(1, "days");
                                    }
                                    else
                                    {
                                        time2 = getTime(time2.add(1, "day"), cond.operands[1]);
                                    }
                                }

                                node.debug("Check if " + cond.operator + " " + time1.format("YYYY-MM-DD HH:mm:ss") + " and " + time2.format("YYYY-MM-DD HH:mm:ss"));
                                result = (((cond.operator == "between") && (now.isSameOrAfter(time1) && now.isSameOrBefore(time2))) ||
                                          ((cond.operator == "outside") && (now.isBefore(time1) || now.isAfter(time2))));
                            }
                            else if ((cond.operator == "weekdays"))
                            {
                                result = cond.operands[now.day()];
                            }
                            else if ((cond.operator == "months"))
                            {
                                result = cond.operands[now.month()];
                            }
                        }
                        catch (e)
                        {
                            if (e instanceof time.TimeError)
                            {
                                let errMsg = RED.util.cloneMessage(msg);
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

                        if ((node.allMustMatch && !result) ||
                            (!node.allMustMatch && result))
                        {
                            break;
                        }
                    }

                    if (result)
                    {
                        node.send(msg);
                    }
                }

                done();
            });
        }

        function getTime(day, operands)
        {
            if (operands.type == "time")
            {
                return time.getUserTime(day, operands.value);
            }
            else if (operands.type == "sun")
            {
                return time.getSunTime(day.set({"hour": 12, "minute": 0, "second": 0, "millisecond": 0}), operands.value);
            }
            else if (operands.type == "moon")
            {
                return time.getMoonTime(day.set({"hour": 12, "minute": 0, "second": 0, "millisecond": 0}), operands.value);
            }
        }
    }

    RED.nodes.registerType("chronos-filter", ChronosFilterNode);
};
