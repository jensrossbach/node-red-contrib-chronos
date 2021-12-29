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

function convertCondition(RED, node, cond, num)
{
    if ((typeof cond != "object") || !cond)
    {
        throw new node.chronos.TimeError(RED._("node-red-contrib-chronos/chronos-config:common.error.invalidCondition"), {condition: num, error: "Condition: Not an object or null"});
    }

    if (!/^(before|after|between|outside|days|weekdays|months|otherwise)$/.test(cond.operator))
    {
        throw new node.chronos.TimeError(RED._("node-red-contrib-chronos/chronos-config:common.error.invalidCondition"), {condition: num, error: "Operator: Invalid value", value: cond.operator});
    }

    if ((cond.operator == "before") || (cond.operator == "after"))
    {
        validateOperand(RED, node, cond.operands, num);
    }

    if ((cond.operator == "between") || (cond.operator == "outside"))
    {
        if (!cond.operands || !Array.isArray(cond.operands) || (cond.operands.length != 2))
        {
            throw new node.chronos.TimeError(RED._("node-red-contrib-chronos/chronos-config:common.error.invalidCondition"), {condition: num, error: "Operand: Not an array, invalid number of elements or null"});
        }

        validateOperand(RED, node, cond.operands[0], num);
        validateOperand(RED, node, cond.operands[1], num);
    }

    if (cond.operator == "days")
    {
        if ((typeof cond.operands != "object") || !cond.operands)
        {
            throw new node.chronos.TimeError(RED._("node-red-contrib-chronos/chronos-config:common.error.invalidCondition"), {condition: num, error: "Operand: Not an object or null"});
        }

        if (!/^(first|second|third|fourth|fifth|last|even|specific)$/.test(cond.operands.type))
        {
            throw new node.chronos.TimeError(RED._("node-red-contrib-chronos/chronos-config:common.error.invalidCondition"), {condition: num, error: "Operand: Invalid type", value: cond.operands.type});
        }

        if (((cond.operands.type == "first") || (cond.operands.type == "last")) &&
            !/^(monday|tuesday|wednesday|thursday|friday|saturday|sunday|day|workday|weekend)$/.test(cond.operands.day))
        {
            throw new node.chronos.TimeError(RED._("node-red-contrib-chronos/chronos-config:common.error.invalidCondition"), {condition: num, error: "Operand: Invalid day", value: cond.operands.day});
        }

        if (((cond.operands.type == "second") || (cond.operands.type == "third") || (cond.operands.type == "fourth") || (cond.operands.type == "fifth")) &&
            !/^(monday|tuesday|wednesday|thursday|friday|saturday|sunday|day)$/.test(cond.operands.day))
        {
            throw new node.chronos.TimeError(RED._("node-red-contrib-chronos/chronos-config:common.error.invalidCondition"), {condition: num, error: "Operand: Invalid day", value: cond.operands.day});
        }

        if ((cond.operands.type == "specific") &&
            ((typeof cond.operands.day != "number") || (cond.operands.day < 1) || (cond.operands.day > 31) ||
             ((typeof cond.operands.month != "undefined") && (typeof cond.operands.month != "number") &&
              !/^(january|february|march|april|may|june|july|august|september|october|november|december)$/.test(cond.operands.month))))
        {
            throw new node.chronos.TimeError(RED._("node-red-contrib-chronos/chronos-config:common.error.invalidCondition"), {condition: num, error: "Operand: Invalid day or month"});
        }

        if (typeof cond.operands.exclude != "boolean")
        {
            throw new node.chronos.TimeError(RED._("node-red-contrib-chronos/chronos-config:common.error.invalidCondition"), {condition: num, error: "Operand: Invalid exclude", value: cond.operands.exclude});
        }
    }

    if (cond.operator == "weekdays")
    {
        if ((typeof cond.operands != "object") || !cond.operands)
        {
            throw new node.chronos.TimeError(RED._("node-red-contrib-chronos/chronos-config:common.error.invalidCondition"), {condition: num, error: "Operand: Not an object or null"});
        }

        if ((("sunday" in cond.operands) && (typeof cond.operands.sunday != "boolean")) ||
            (("monday" in cond.operands) && (typeof cond.operands.monday != "boolean")) ||
            (("tuesday" in cond.operands) && (typeof cond.operands.tuesday != "boolean")) ||
            (("wednesday" in cond.operands) && (typeof cond.operands.wednesday != "boolean")) ||
            (("thursday" in cond.operands) && (typeof cond.operands.thursday != "boolean")) ||
            (("friday" in cond.operands) && (typeof cond.operands.friday != "boolean")) ||
            (("saturday" in cond.operands) && (typeof cond.operands.saturday != "boolean")))
        {
            throw new node.chronos.TimeError(RED._("node-red-contrib-chronos/chronos-config:common.error.invalidCondition"), {condition: num, error: "Operand: Invalid weekday property", value: cond.operands});
        }
    }

    if (cond.operator == "months")
    {
        if ((typeof cond.operands != "object") || !cond.operands)
        {
            throw new node.chronos.TimeError(RED._("node-red-contrib-chronos/chronos-config:common.error.invalidCondition"), {condition: num, error: "Operand: Not an object or null"});
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
            throw new node.chronos.TimeError(RED._("node-red-contrib-chronos/chronos-config:common.error.invalidCondition"), {condition: num, error: "Operand: Invalid month property", value: cond.operands});
        }
    }

    let convCond = {operator: cond.operator};

    if ((convCond.operator == "before") || (convCond.operator == "after") ||
        (convCond.operator == "between") || (convCond.operator == "outside"))
    {
        convCond.operands = cond.operands;
    }
    else if (convCond.operator == "days")
    {
        convCond.operands = {};
        convCond.operands.type = cond.operands.type;
        convCond.operands.exclude = cond.operands.exclude;

        if (cond.operands.type != "even")
        {
            convCond.operands.day = cond.operands.day;
        }

        if (cond.operands.type == "specific")
        {
            convCond.operands.month = cond.operands.month ? cond.operands.month : "any";
        }
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

function validateOperand(RED, node, operand, num)
{
    if ((typeof operand != "object") || !operand)
    {
        throw new node.chronos.TimeError(RED._("node-red-contrib-chronos/chronos-config:common.error.invalidCondition"), {condition: num, error: "Operand: Not an object or null"});
    }

    if (!/^(time|sun|moon|custom)$/.test(operand.type))
    {
        throw new node.chronos.TimeError(RED._("node-red-contrib-chronos/chronos-config:common.error.invalidCondition"), {condition: num, error: "Operand: Invalid type", value: operand.type});
    }

    if ((typeof operand.value != "string") ||
        ((operand.type == "time") && !node.chronos.isValidUserTime(operand.value)) ||
        ((operand.type == "sun") && !/^(sunrise|sunriseEnd|sunsetStart|sunset|goldenHour|goldenHourEnd|night|nightEnd|dawn|nauticalDawn|dusk|nauticalDusk|solarNoon|nadir)$/.test(operand.value)) ||
        ((operand.type == "moon") && !/^(rise|set)$/.test(operand.value)))
    {
        throw new node.chronos.TimeError(RED._("node-red-contrib-chronos/chronos-config:common.error.invalidCondition"), {condition: num, error: "Operand: Invalid value", value: operand.value});
    }

    if ((typeof operand.offset != "number") || (operand.offset < -300) || (operand.offset > 300))
    {
        throw new node.chronos.TimeError(RED._("node-red-contrib-chronos/chronos-config:common.error.invalidCondition"), {condition: num, error: "Operand: Invalid offset", value: operand.offset});
    }

    if (typeof operand.random != "boolean")
    {
        throw new node.chronos.TimeError(RED._("node-red-contrib-chronos/chronos-config:common.error.invalidCondition"), {condition: num, error: "Operand: Invalid random flag", value: operand.random});
    }
}

function evaluateCondition(RED, node, msg, baseTime, cond, id)
{
    let result = false;

    if (cond.operator == "context")
    {
        let ctx = RED.util.parseContextStore(cond.context.value);
        node.debug("[Condition:" + id + "] Load from context variable " + cond.context.type + "." + ctx.key + (ctx.store ? " (" + ctx.store + ")" : ""));

        result = evaluateCondition(RED, node, msg, baseTime, convertCondition(RED, node, node.context()[cond.context.type].get(ctx.key, ctx.store), id), id);
    }
    else if (cond.operator == "expression")
    {
        let expression = null;

        try
        {
            expression = node.chronos.getJSONataExpression(RED, node, cond.expression);

            // time switch/filter node specific JSONata extensions
            expression.assign("baseTime", baseTime.valueOf());

            expression.registerFunction("isBefore", (ts, type, value, offset, random) =>
            {
                return evaluateCondition(RED, node, msg, node.chronos.getTimeFrom(node, ts),
                                         convertCondition(RED, node, {operator: "before", operands: {type: type,
                                                          value: value, offset: (typeof offset != "undefined") ? offset : 0,
                                                          random: (typeof random != "undefined") ? random : false}}, id), id);
            }, "<(sn)ssn?b?:b>");

            expression.registerFunction("isAfter", (ts, type, value, offset, random) =>
            {
                return evaluateCondition(RED, node, msg, node.chronos.getTimeFrom(node, ts),
                                         convertCondition(RED, node, {operator: "after", operands: {type: type,
                                                          value: value, offset: (typeof offset != "undefined") ? offset : 0,
                                                          random: (typeof random != "undefined") ? random : false}}, id), id);
            }, "<(sn)ssn?b?:b>");

            expression.registerFunction("isBetween", (ts, type1, value1, offset1, random1, type2, value2, offset2, random2) =>
            {
                return evaluateCondition(RED, node, msg, node.chronos.getTimeFrom(node, ts),
                                         convertCondition(RED, node, {operator: "between", operands: [{type: type1,
                                                          value: value1, offset: offset1, random: random1},{type: type2,
                                                          value: value2, offset: offset2, random: random2}]}, id), id);
            }, "<(sn)ssnbssnb:b>");

            expression.registerFunction("isOutside", (ts, type1, value1, offset1, random1, type2, value2, offset2, random2) =>
            {
                return evaluateCondition(RED, node, msg, node.chronos.getTimeFrom(node, ts),
                                         convertCondition(RED, node, {operator: "outside", operands: [{type: type1,
                                                          value: value1, offset: offset1, random: random1},{type: type2,
                                                          value: value2, offset: offset2, random: random2}]}, id), id);
            }, "<(sn)ssnbssnb:b>");

            expression.registerFunction("isFirstDay", (ts, day) =>
            {
                return evaluateCondition(RED, node, msg, node.chronos.getTimeFrom(node, ts),
                                         convertCondition(RED, node, {operator: "days", operands: {type: "first",
                                                          day: day ? day : "day", exclude: false}}, id), id);
            }, "<(sn)s?:b>");

            expression.registerFunction("isSecondDay", (ts, day) =>
            {
                return evaluateCondition(RED, node, msg, node.chronos.getTimeFrom(node, ts),
                                         convertCondition(RED, node, {operator: "days", operands: {type: "second",
                                                          day: day ? day : "day", exclude: false}}, id), id);
            }, "<(sn)s?:b>");

            expression.registerFunction("isThirdDay", (ts, day) =>
            {
                return evaluateCondition(RED, node, msg, node.chronos.getTimeFrom(node, ts),
                                         convertCondition(RED, node, {operator: "days", operands: {type: "third",
                                                          day: day ? day : "day", exclude: false}}, id), id);
            }, "<(sn)s?:b>");

            expression.registerFunction("isFourthDay", (ts, day) =>
            {
                return evaluateCondition(RED, node, msg, node.chronos.getTimeFrom(node, ts),
                                         convertCondition(RED, node, {operator: "days", operands: {type: "fourth",
                                                          day: day ? day : "day", exclude: false}}, id), id);
            }, "<(sn)s?:b>");

            expression.registerFunction("isFifthDay", (ts, day) =>
            {
                return evaluateCondition(RED, node, msg, node.chronos.getTimeFrom(node, ts),
                                         convertCondition(RED, node, {operator: "days", operands: {type: "fifth",
                                                          day: day ? day : "day", exclude: false}}, id), id);
            }, "<(sn)s?:b>");

            expression.registerFunction("isLastDay", (ts, day) =>
            {
                return evaluateCondition(RED, node, msg, node.chronos.getTimeFrom(node, ts),
                                         convertCondition(RED, node, {operator: "days", operands: {type: "last",
                                                          day: day ? day : "day", exclude: false}}, id), id);
            }, "<(sn)s?:b>");

            expression.registerFunction("isEvenDay", (ts) =>
            {
                return evaluateCondition(RED, node, msg, node.chronos.getTimeFrom(node, ts),
                                         convertCondition(RED, node, {operator: "days", operands: {type: "even",
                                                          exclude: false}}, id), id);
            }, "<(sn):b>");

            expression.registerFunction("isSpecificDay", (ts, day, month) =>
            {
                return evaluateCondition(RED, node, msg, node.chronos.getTimeFrom(node, ts),
                                         convertCondition(RED, node, {operator: "days", operands: {type: "specific",
                                                          day: day, month: month, exclude: false}}, id), id);
            }, "<(sn)n(sn)?:b>");

            expression.registerFunction("matchesWeekdays", (ts, days) =>
            {
                return evaluateCondition(RED, node, msg, node.chronos.getTimeFrom(node, ts),
                                         convertCondition(RED, node, {operator: "weekdays", operands: days}, id), id);
            }, "<(sn)o:b>");

            expression.registerFunction("matchesMonths", (ts, months) =>
            {
                return evaluateCondition(RED, node, msg, node.chronos.getTimeFrom(node, ts),
                                         convertCondition(RED, node, {operator: "months", operands: months}, id), id);
            }, "<(sn)o:b>");

            expression.registerFunction("evaluateCondition", (ts, condition) =>
            {
                return evaluateCondition(RED, node, msg, node.chronos.getTimeFrom(node, ts),
                                         convertCondition(RED, node, condition, id), id);
            }, "<(sn)o:b>");

            node.debug("[Condition:" + id + "] Check if '" + cond.expression + "' evaluates to true");
            result = RED.util.evaluateJSONataExpression(expression, msg);
        }
        catch (e)
        {
            if (e instanceof node.chronos.TimeError)
            {
                throw e;
            }
            else
            {
                const details = {condition: id, expression: cond.expression, code: e.code, description: e.message, position: e.position, token: e.token};
                if (e.value)
                {
                    details.value = e.value;
                }

                throw new node.chronos.TimeError(RED._("node-red-contrib-chronos/chronos-config:common.error.evaluationFailed"), details);
            }
        }

        if (typeof result != "boolean")
        {
            throw new node.chronos.TimeError(RED._("node-red-contrib-chronos/chronos-config:common.error.notBoolean"),
                                             {condition: id, expression: cond.expression, result: result});
        }
    }
    else if ((cond.operator == "before") || (cond.operator == "after"))
    {
        let targetTime = node.chronos.getTime(RED, node, baseTime.clone(), cond.operands.type, cond.operands.value);

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
        let time1 = node.chronos.getTime(RED, node, baseTime.clone(), cond.operands[0].type, cond.operands[0].value);
        let time2 = node.chronos.getTime(RED, node, baseTime.clone(), cond.operands[1].type, cond.operands[1].value);

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
    else if ((cond.operator == "days"))
    {
        if (cond.operands.type == "specific")
        {
            const MONTHS = {january: 0, february: 1, march: 2, april: 3, may: 4, june: 5, july: 6, august: 7, september: 8, october: 9, november: 10, december: 11};

            node.debug("[Condition:" + id + "] Check if " + (cond.operands.exclude ? "not " : "") + cond.operands.day + ". of " + ((cond.operands.month == "any") ? "any month" : cond.operands.month));
            result = ((baseTime.date() == cond.operands.day) && ((cond.operands.month == "any") || (baseTime.month() == ((typeof cond.operands.month == "string") ? MONTHS[cond.operands.month] : cond.operands.month - 1))));
        }
        else if (cond.operands.type == "even")
        {
            node.debug("[Condition:" + id + "] Check if " + (cond.operands.exclude ? "not " : "") + cond.operands.type);
            result = ((baseTime.date() % 2) == 0);
        }
        else
        {
            const WEEKDAYS = {sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6};

            node.debug("[Condition:" + id + "] Check if " + (cond.operands.exclude ? "not " : "") + cond.operands.type + " " + cond.operands.day + " of month");
            if (cond.operands.type == "last")
            {
                let lastDay = baseTime.clone().endOf("month");

                switch (cond.operands.day)
                {
                    case "sunday":
                    case "monday":
                    case "tuesday":
                    case "wednesday":
                    case "thursday":
                    case "friday":
                    case "saturday":
                    {
                        let diff = lastDay.day() - WEEKDAYS[cond.operands.day];
                        if (diff < 0)
                        {
                            diff += 7;
                        }

                        lastDay.subtract(diff, "days");
                        result = (baseTime.date() == lastDay.date());

                        break;
                    }
                    case "day":
                    {
                        result = (baseTime.date() == lastDay.date());
                        break;
                    }
                    case "workday":
                    {
                        if (lastDay.day() == 6)  // Saturday
                        {
                            lastDay.subtract(1, "days");
                        }
                        else if (lastDay.day() == 0)  // Sunday
                        {
                            lastDay.subtract(2, "days");
                        }

                        result = (baseTime.date() == lastDay.date());
                        break;
                    }
                    case "weekend":
                    {
                        let day = lastDay.day();
                        if ((day >= 1) && (day <= 5))  // Monday .. Friday
                        {
                            lastDay.subtract(day, "days");
                        }

                        result = (baseTime.date() == lastDay.date());
                        break;
                    }
                }
            }
            else
            {
                const ORDINALS = {first: 0, second: 1, third: 2, fourth: 3, fifth: 4};
                let firstDay = baseTime.clone().startOf("month");

                switch (cond.operands.day)
                {
                    case "sunday":
                    case "monday":
                    case "tuesday":
                    case "wednesday":
                    case "thursday":
                    case "friday":
                    case "saturday":
                    {
                        let diff = WEEKDAYS[cond.operands.day] - firstDay.day();
                        if (diff < 0)
                        {
                            diff += 7;
                        }

                        firstDay.add(diff + (7 * ORDINALS[cond.operands.type]), "days");
                        result = ((baseTime.date() == firstDay.date()) && (baseTime.month() == firstDay.month()));

                        break;
                    }
                    case "day":
                    {
                        result = (baseTime.date() == (ORDINALS[cond.operands.type] + 1));
                        break;
                    }
                    case "workday":
                    {
                        if (firstDay.day() == 6)  // Saturday
                        {
                            firstDay.add(2, "days");
                        }
                        else if (firstDay.day() == 0)  // Sunday
                        {
                            firstDay.add(1, "days");
                        }

                        result = (baseTime.date() == firstDay.date());
                        break;
                    }
                    case "weekend":
                    {
                        let day = firstDay.day();
                        if ((day >= 1) && (day <= 5))  // Monday .. Friday
                        {
                            firstDay.add(6 - day, "days");
                        }

                        result = (baseTime.date() == firstDay.date());
                        break;
                    }
                }
            }
        }

        if (cond.operands.exclude)
        {
            result = !result;
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
        ret = node.chronos.getCurrentTime(node);
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
            ret = node.chronos.getTimeFrom(node, value);
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
