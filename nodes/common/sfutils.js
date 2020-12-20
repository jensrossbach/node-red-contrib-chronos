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


function validateConditions(node, cond)
{
    let valid = true;

    // check for valid user time
    if ((cond.operator == "before") || (cond.operator == "after"))
    {
        if ((cond.operands.type == "time") && !node.chronos.isValidUserTime(cond.operands.value))
        {
            valid = false;
        }
    }
    else if ((cond.operator == "between") || (cond.operator == "outside"))
    {
        if ((cond.operands[0].type == "time") && !node.chronos.isValidUserTime(cond.operands[0].value))
        {
            valid = false;
        }

        if (valid && (cond.operands[1].type == "time") && !node.chronos.isValidUserTime(cond.operands[1].value))
        {
            valid = false;
        }
    }

    return valid;
}

function evaluateConditions(node, baseTime, cond)
{
    let result = false;

    if ((cond.operator == "before") || (cond.operator == "after"))
    {
        let targetTime = node.chronos.getTime(baseTime.clone(), cond.operands.type, cond.operands.value);

        if (cond.operands.offset != 0)
        {
            let offset = cond.operands.random ? Math.round(Math.random() * cond.operands.offset) : cond.operands.offset;
            targetTime.add(offset, "minutes");
        }

        node.debug("Check if " + cond.operator + " " + targetTime.format("HH:mm:ss"));
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

        node.debug("Check if " + cond.operator + " " + time1.format("HH:mm:ss") + " and " + time2.format("HH:mm:ss"));
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
        result = cond.operands[baseTime.day()];
    }
    else if ((cond.operator == "months"))
    {
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
    validateConditions: validateConditions,
    evaluateConditions: evaluateConditions,
    getBaseTime: getBaseTime
};
