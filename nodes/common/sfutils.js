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


function validateCondition(node, cond)
{
    if ((cond.operator == "context") && !cond.context.value)
    {
        return false;
    }

    if ((cond.operator == "before") || (cond.operator == "after"))
    {
        if ((cond.operands.type == "time") && !node.chronos.isValidUserTime(cond.operands.value))
        {
            return false;
        }
    }

    if ((cond.operator == "between") || (cond.operator == "outside"))
    {
        if ((cond.operands[0].type == "time") && !node.chronos.isValidUserTime(cond.operands[0].value))
        {
            return false;
        }

        if ((cond.operands[1].type == "time") && !node.chronos.isValidUserTime(cond.operands[1].value))
        {
            return false;
        }
    }

    return true;
}

function convertCondition(node, cond)
{
    if ((typeof cond != "object") || !cond)
    {
        return null;
    }

    if ((typeof cond.operator != "string") || !/^(before|after|between|outside|weekdays|months|otherwise)$/.test(cond.operator))
    {
        return null;
    }

    if ((cond.operator == "before") || (cond.operator == "after"))
    {
        if ((typeof cond.operands != "object") || !cond.operands)
        {
            return null;
        }

        if (!validateOperand(node, cond.operands))
        {
            return null;
        }
    }

    if ((cond.operator == "between") || (cond.operator == "outside"))
    {
        if (!cond.operands || !Array.isArray(cond.operands) || (cond.operands.length != 2))
        {
            return null;
        }

        if (!validateOperand(node, cond.operands[0]) || !validateOperand(node, cond.operands[1]))
        {
            return null;
        }
    }

    if (cond.operator == "weekdays")
    {
        if ((typeof cond.operands != "object") || !cond.operands)
        {
            return null;
        }

        if ((("sunday" in cond.operands) && (typeof cond.operands.sunday != "boolean")) ||
            (("monday" in cond.operands) && (typeof cond.operands.monday != "boolean")) ||
            (("tuesday" in cond.operands) && (typeof cond.operands.tuesday != "boolean")) ||
            (("wednesday" in cond.operands) && (typeof cond.operands.wednesday != "boolean")) ||
            (("thursday" in cond.operands) && (typeof cond.operands.thursday != "boolean")) ||
            (("friday" in cond.operands) && (typeof cond.operands.friday != "boolean")) ||
            (("saturday" in cond.operands) && (typeof cond.operands.saturday != "boolean")))
        {
            return null;
        }
    }

    if (cond.operator == "months")
    {
        if ((typeof cond.operands != "object") || !cond.operands)
        {
            return null;
        }

        if ((("january" in cond.operands) && (typeof cond.operands.january != "boolean")) ||
            (("february" in cond.operands) && (typeof cond.operands.february != "boolean")) ||
            (("march" in cond.operands) && (typeof cond.operands.march != "boolean")) ||
            (("april" in cond.operands) && (typeof cond.operands.april != "boolean")) ||
            (("may" in cond.operands) && (typeof cond.operands.may != "boolean")) ||
            (("june" in cond.operands) && (typeof cond.operands.june != "boolean")) ||
            (("july" in cond.operands) && (typeof cond.operands.july != "boolean")) ||
            (("august" in cond.operands) && (typeof cond.operands.august != "boolean")) ||
            (("september" in cond.operands) && (typeof cond.operands.september != "boolean")) ||
            (("october" in cond.operands) && (typeof cond.operands.october != "boolean")) ||
            (("november" in cond.operands) && (typeof cond.operands.november != "boolean")) ||
            (("december" in cond.operands) && (typeof cond.operands.december != "boolean")))
        {
            return null;
        }
    }

    let convCond = {operator: cond.operator};

    if ((convCond.operator == "before") || (convCond.operator == "after") ||
        (convCond.operator == "between") || (convCond.operator == "outside"))
    {
        convCond.operands = cond.operands;
    }
    else if (convCond.operator == "weekdays")
    {
        convCond.operands = [false, false, false, false, false, false, false];

        convCond.operands[0] = (cond.operands.sunday === true);
        convCond.operands[1] = (cond.operands.monday === true);
        convCond.operands[2] = (cond.operands.tuesday === true);
        convCond.operands[3] = (cond.operands.wednesday === true);
        convCond.operands[4] = (cond.operands.thursday === true);
        convCond.operands[5] = (cond.operands.friday === true);
        convCond.operands[6] = (cond.operands.saturday === true);
    }
    else if (convCond.operator == "months")
    {
        convCond.operands = [false, false, false, false, false, false, false, false, false, false, false, false];

        convCond.operands[0]  = (cond.operands.january === true);
        convCond.operands[1]  = (cond.operands.february === true);
        convCond.operands[2]  = (cond.operands.march === true);
        convCond.operands[3]  = (cond.operands.april === true);
        convCond.operands[4]  = (cond.operands.may === true);
        convCond.operands[5]  = (cond.operands.june === true);
        convCond.operands[6]  = (cond.operands.july === true);
        convCond.operands[7]  = (cond.operands.august === true);
        convCond.operands[8]  = (cond.operands.september === true);
        convCond.operands[9]  = (cond.operands.october === true);
        convCond.operands[10] = (cond.operands.november === true);
        convCond.operands[11] = (cond.operands.december === true);
    }

    return convCond;
}

function validateOperand(node, operand)
{
    if ((typeof operand != "object") || !operand)
    {
        return false;
    }

    if ((typeof operand.type != "string") || !/^(time|sun|moon|custom)$/.test(operand.type))
    {
        return false;
    }

    if ((typeof operand.value != "string") ||
        ((operand.type == "time") && !node.chronos.isValidUserTime(operand.value)) ||
        ((operand.type == "sun") && !/^(sunrise|sunriseEnd|sunsetStart|sunset|goldenHour|goldenHourEnd|night|nightEnd|dawn|nauticalDawn|dusk|nauticalDusk|solarNoon|nadir)$/.test(operand.value)) ||
        ((operand.type == "moon") && !/^(rise|set)$/.test(operand.value)))
    {
        return false;
    }

    if ((typeof operand.offset != "number") || (operand.offset < -300) || (operand.offset > 300))
    {
        return false;
    }

    if (typeof operand.random != "boolean")
    {
        return false;
    }

    return true;
}

function evaluateCondition(RED, node, baseTime, cond, id)
{
    let result = false;

    if (cond.operator == "context")
    {
        let ctx = RED.util.parseContextStore(cond.context.value);
        node.debug("[Condition:" + id + "] Load from context variable " + cond.context.type + "." + ctx.key + (ctx.store ? " (" + ctx.store + ")" : ""));

        let ctxCond = convertCondition(node, node.context()[cond.context.type].get(ctx.key, ctx.store));
        if (!ctxCond)
        {
            throw new node.chronos.TimeError(RED._("node-red-contrib-chronos/chronos-config:common.error.invalidCondition", {condition: cond.context.type + "." + ctx.key + (ctx.store ? " (" + ctx.store + ")" : "")}), null);
        }

        result = evaluateCondition(RED, node, baseTime, ctxCond, id);
    }
    else if ((cond.operator == "before") || (cond.operator == "after"))
    {
        let targetTime = node.chronos.getTime(baseTime.clone(), cond.operands.type, cond.operands.value);

        if (cond.operands.offset != 0)
        {
            let offset = cond.operands.random ? Math.round(Math.random() * cond.operands.offset) : cond.operands.offset;
            targetTime.add(offset, "minutes");
        }

        node.debug("[Condition:" + id + "] Check if " + cond.operator + " " + targetTime.format("HH:mm:ss"));
        result = (((cond.operator == "before") && baseTime.isBefore(targetTime)) ||
                  ((cond.operator == "after") && baseTime.isSameOrAfter(targetTime)));
    }
    else if ((cond.operator == "between") || (cond.operator == "outside"))
    {
        let time1 = node.chronos.getTime(baseTime.clone(), cond.operands[0].type, cond.operands[0].value);
        let time2 = node.chronos.getTime(baseTime.clone(), cond.operands[1].type, cond.operands[1].value);

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

        node.debug("[Condition:" + id + "] Check if " + cond.operator + " " + time1.format("HH:mm:ss") + " and " + time2.format("HH:mm:ss"));
        if (time2.isSameOrBefore(time1))
        {
            result = (((cond.operator == "between") && (baseTime.isSameOrAfter(time1) || baseTime.isSameOrBefore(time2))) ||
                      ((cond.operator == "outside") && (baseTime.isBefore(time1) && baseTime.isAfter(time2))));
        }
        else
        {
            result = (((cond.operator == "between") && (baseTime.isSameOrAfter(time1) && baseTime.isSameOrBefore(time2))) ||
                      ((cond.operator == "outside") && (baseTime.isBefore(time1) || baseTime.isAfter(time2))));
        }
    }
    else if ((cond.operator == "weekdays"))
    {
        const WEEKDAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
        let weekdays = "";

        for (let i=0; i<7; ++i)
        {
            if (cond.operands[i])
            {
                weekdays += " " + WEEKDAYS[i];
            }
        }

        node.debug("[Condition:" + id + "] Check if within" + weekdays);
        result = cond.operands[baseTime.day()];
    }
    else if ((cond.operator == "months"))
    {
        const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
        let months = "";

        for (let i=0; i<12; ++i)
        {
            if (cond.operands[i])
            {
                months += " " + MONTHS[i];
            }
        }

        node.debug("[Condition:" + id + "] Check if within" + months);
        result = cond.operands[baseTime.month()];
    }

    return result;
}

function getBaseTime(RED, node, msg)
{
    let ret = null;

    if (node.baseTimeType == "msgIngress")
    {
        ret = node.chronos.getCurrentTime();
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
                value = RED.util.getMessageProperty(msg, node.baseTime);
                break;
            }
        }

        if (typeof value == "number")
        {
            ret = node.chronos.getTimeFrom(value);
        }
    }

    return ret ? (ret.isValid() ? ret : null) : null;
}

module.exports =
{
    validateCondition: validateCondition,
    evaluateCondition: evaluateCondition,
    getBaseTime: getBaseTime
};
