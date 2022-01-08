/*
 * Copyright (c) 2022 Jens-Uwe Rossbach
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


const sinon = require("sinon");
const chronos = require("../../nodes/common/chronos.js");
const moment = require("moment");
const sunCalc = require("suncalc");
const jsonata = require("jsonata");

require("should-sinon");


describe("chronos", function()
{
    afterEach(function()
    {
        sinon.restore();
    });

    context("initCustomTimes", function()
    {
        it("should call sunCalc.addTime", function()
        {
            const sunPositions =
            [
                {
                    angle: 5,
                    riseName: "testRise1",
                    setName: "testSet1"
                },
                {
                    angle: -3,
                    riseName: "testRise2",
                    setName: "testSet2"
                }
            ];

            sinon.spy(sunCalc, "addTime");
            chronos.initCustomTimes(sunPositions);

            sunCalc.addTime.should.be.calledWith(5, "__cust_testRise1", "__cust_testSet1");
            sunCalc.addTime.should.be.calledWith(-3, "__cust_testRise2", "__cust_testSet2");
        });
    });

    context("getCurrentTime", function()
    {
        it("should return current time", function()
        {
            // fake current time to be deterministic
            sinon.stub(Date, "now").returns(new Date("2000-01-01T00:00:00.000Z"));

            const node = {locale: "en-US"};
            const res = chronos.getCurrentTime(node);

            res.valueOf().should.equal(946684800000);
        });
    });

    context("getTimeFrom", function()
    {
        it("should return time from string", function()
        {
            const node = {locale: "en-US"};
            const res = chronos.getTimeFrom(node, "2000-01-01T00:00:00.000Z");

            res.valueOf().should.equal(946684800000);
        });

        it("should return time from Unix epoch", function()
        {
            const node = {locale: "en-US"};
            const res = chronos.getTimeFrom(node, 946684800000);

            res.valueOf().should.equal(946684800000);
        });
    });

    context("getUserDate", function()
    {
        it("should return date from string", function()
        {
            const RED = {"_": () => ""};
            const node = {locale: "en-US"};
            const res = chronos.getUserDate(RED, node, "2000-01-01");

            res.year().should.equal(2000);
            res.month().should.equal(0);
            res.date().should.equal(1);
        });

        it("should fail due to invalid date string", function()
        {
            const RED = {"_": () => ""};
            const node = {locale: "en-US"};

            (() => chronos.getUserDate(RED, node, "2000/01-01")).should.throw(chronos.TimeError);
        });
    });

    context("isValidUserTime", function()
    {
        it("should return true for valid time", function()
        {
            chronos.isValidUserTime("8:10").should.be.true();
            chronos.isValidUserTime("08:10").should.be.true();
            chronos.isValidUserTime("5:37:12").should.be.true();
            chronos.isValidUserTime("16:23:12").should.be.true();
            chronos.isValidUserTime("8:10 AM").should.be.true();
            chronos.isValidUserTime("9:12 PM").should.be.true();
            chronos.isValidUserTime("7:23:12 AM").should.be.true();
            chronos.isValidUserTime("7:23:12 am").should.be.true();
            chronos.isValidUserTime("7:23:12 PM").should.be.true();
            chronos.isValidUserTime("7:23:12 pm").should.be.true();
            chronos.isValidUserTime(0).should.be.true();
            chronos.isValidUserTime(100000).should.be.true();
            chronos.isValidUserTime((24*60*60*1000)-1).should.be.true();
        });

        it("should return false for invalid time", function()
        {
            chronos.isValidUserTime("invalid").should.be.false();
            chronos.isValidUserTime("8:87").should.be.false();
            chronos.isValidUserTime("25:17:12").should.be.false();
            chronos.isValidUserTime("16.23:12").should.be.false();
            chronos.isValidUserTime("7:65 am").should.be.false();
            chronos.isValidUserTime("56:56:12 am").should.be.false();
            chronos.isValidUserTime("7:23:12 xm").should.be.false();
            chronos.isValidUserTime(-1).should.be.false();
            chronos.isValidUserTime(24*60*60*1000).should.be.false();
            chronos.isValidUserTime(true).should.be.false();
            chronos.isValidUserTime({a: "b"}).should.be.false();
            chronos.isValidUserTime([1,2,3]).should.be.false();
        });
    });

    context("isValidUserDate", function()
    {
        it("should return true for valid date", function()
        {
            chronos.isValidUserDate("2021-03-07").should.be.true();
            chronos.isValidUserDate("2000-4-3").should.be.true();
        });

        it("should return false for invalid date", function()
        {
            chronos.isValidUserDate("2020/4/3").should.be.false();
            chronos.isValidUserDate("27.10.2018").should.be.false();
            chronos.isValidUserDate("100-03-03").should.be.false();
            chronos.isValidUserDate("2016-25-14").should.be.false();
            chronos.isValidUserDate("2010-06-45").should.be.false();
        });
    });

    context("getTime", function()
    {
        it("should return user time", function()
        {
            // fake current time to be deterministic
            sinon.stub(Date, "now").returns(new Date("2000-01-01T11:22:33.444Z"));

            const RED = {"_": () => ""};
            const node = {};

            let res = chronos.getTime(RED, node, moment(), "time", "16:20");
            res.year().should.equal(2000);
            res.month().should.equal(0);
            res.date().should.equal(1);
            res.hour().should.equal(16);
            res.minute().should.equal(20);
            res.second().should.equal(0);
            res.millisecond().should.equal(0);

            res = chronos.getTime(RED, node, moment(), "time", "8:15:30");
            res.year().should.equal(2000);
            res.month().should.equal(0);
            res.date().should.equal(1);
            res.hour().should.equal(8);
            res.minute().should.equal(15);
            res.second().should.equal(30);
            res.millisecond().should.equal(0);

            res = chronos.getTime(RED, node, moment(), "time", "8:20 AM");
            res.year().should.equal(2000);
            res.month().should.equal(0);
            res.date().should.equal(1);
            res.hour().should.equal(8);
            res.minute().should.equal(20);
            res.second().should.equal(0);
            res.millisecond().should.equal(0);

            res = chronos.getTime(RED, node, moment(), "time", "14:20 AM");
            res.year().should.equal(2000);
            res.month().should.equal(0);
            res.date().should.equal(1);
            res.hour().should.equal(2);
            res.minute().should.equal(20);
            res.second().should.equal(0);
            res.millisecond().should.equal(0);

            res = chronos.getTime(RED, node, moment(), "time", "9:30 PM");
            res.year().should.equal(2000);
            res.month().should.equal(0);
            res.date().should.equal(1);
            res.hour().should.equal(21);
            res.minute().should.equal(30);
            res.second().should.equal(0);
            res.millisecond().should.equal(0);

            res = chronos.getTime(RED, node, moment(), "time", "15:30 PM");
            res.year().should.equal(2000);
            res.month().should.equal(0);
            res.date().should.equal(1);
            res.hour().should.equal(15);
            res.minute().should.equal(30);
            res.second().should.equal(0);
            res.millisecond().should.equal(0);

            res = chronos.getTime(RED, node, moment(), "time", 59100000);
            res.year().should.equal(2000);
            res.month().should.equal(0);
            res.date().should.equal(1);
            res.hour().should.equal(16);
            res.minute().should.equal(25);
            res.second().should.equal(0);
            res.millisecond().should.equal(0);
        });

        it("should fail due to invalid user time", function()
        {
            // fake current time to be deterministic
            sinon.stub(Date, "now").returns(new Date("2000-01-01T00:00:00.000Z"));

            const RED = {"_": () => ""};
            const node = {};

            (() => chronos.getTime(RED, node, moment(), "time", "25:20")).should.throw(chronos.TimeError);
            (() => chronos.getTime(RED, node, moment(), "time", "12.20:10")).should.throw(chronos.TimeError);
            (() => chronos.getTime(RED, node, moment(), "time", true)).should.throw(chronos.TimeError);
        });

        it("should return sun time", function()
        {
            const RED = {"_": () => ""};
            const node = {locale: "en-US", config: {latitude: 0, longitude: 0}};
            sinon.stub(sunCalc, "getTimes").returns({"sunrise": new Date("2000-01-01T08:00:00.000Z")});

            let res = chronos.getTime(RED, node, moment(), "sun", "sunrise");
            res.utc().year().should.equal(2000);
            res.utc().month().should.equal(0);
            res.utc().date().should.equal(1);
            res.utc().hour().should.equal(8);
            res.utc().minute().should.equal(0);
            res.utc().second().should.equal(0);
        });

        it("should return custom sun time", function()
        {
            const RED = {"_": () => ""};
            const node = {locale: "en-US", config: {latitude: 0, longitude: 0}};
            sinon.stub(sunCalc, "getTimes").returns({"__cust_test": new Date("2000-01-01T08:00:00.000Z")});

            let res = chronos.getTime(RED, node, moment(), "custom", "test");
            res.utc().year().should.equal(2000);
            res.utc().month().should.equal(0);
            res.utc().date().should.equal(1);
            res.utc().hour().should.equal(8);
            res.utc().minute().should.equal(0);
            res.utc().second().should.equal(0);
        });

        it("should fail due to invalid sun time", function()
        {
            const RED = {"_": () => ""};
            const node = {locale: "en-US", config: {latitude: 0, longitude: 0}};
            sinon.stub(sunCalc, "getTimes")
                    .onFirstCall()
                    .returns({"sunrise": new Date("2000-01-01T08:00:00.000Z")})
                    .onSecondCall()
                    .returns({"sunrise": [2010, 12]});

            (() => chronos.getTime(RED, node, moment(), "sun", "invalid")).should.throw(chronos.TimeError);
            (() => chronos.getTime(RED, node, moment(), "sun", "sunrise")).should.throw(chronos.TimeError);
        });

        it("should fail due to unavailable sun time", function()
        {
            const RED = {"_": () => ""};
            const node = {locale: "en-US", config: {latitude: 0, longitude: 0}};
            sinon.stub(sunCalc, "getTimes").returns({"sunrise": null});

            (() => chronos.getTime(RED, node, moment(), "sun", "sunrise")).should.throw(chronos.TimeError);
        });

        it("should return moon time", function()
        {
            const RED = {"_": () => ""};
            const node = {locale: "en-US", config: {latitude: 0, longitude: 0}};
            sinon.stub(sunCalc, "getMoonTimes").returns({"rise": new Date("2000-01-01T22:00:00.000Z")});

            let res = chronos.getTime(RED, node, moment(), "moon", "rise");
            res.utc().year().should.equal(2000);
            res.utc().month().should.equal(0);
            res.utc().date().should.equal(1);
            res.utc().hour().should.equal(22);
            res.utc().minute().should.equal(0);
            res.utc().second().should.equal(0);
        });

        it("should fail due to invalid moon time", function()
        {
            const RED = {"_": () => ""};
            const node = {locale: "en-US", config: {latitude: 0, longitude: 0}};
            sinon.stub(sunCalc, "getMoonTimes")
                    .onFirstCall()
                    .returns({"rise": new Date("2000-01-01T22:00:00.000Z")})
                    .onSecondCall()
                    .returns({"rise": [2010, 12]});

            (() => chronos.getTime(RED, node, moment(), "moon", "invalid")).should.throw(chronos.TimeError);
            (() => chronos.getTime(RED, node, moment(), "moon", "rise")).should.throw(chronos.TimeError);
        });

        it("should fail due to unavailable moon time", function()
        {
            const RED = {"_": () => ""};
            const node = {locale: "en-US", config: {latitude: 0, longitude: 0}};
            sinon.stub(sunCalc, "getMoonTimes").returns({"rise": null, alwaysUp: false, alwaysDown: true});

            (() => chronos.getTime(RED, node, moment(), "moon", "rise")).should.throw(chronos.TimeError);
        });

        it("should do nothing due to invalid type", function()
        {
            const RED = {"_": () => ""};
            const node = {locale: "en-US", config: {latitude: 0, longitude: 0}};

            chronos.getTime(RED, node, moment(), "invalid", "abc");

            // TODO: how to validate best?
        });
    });

    context("getJSONataExpression", function()
    {
        it("should return expression", function()
        {
            const jsnExpr = {testToken: "chronos", registerFunction: sinon.stub()};
            const RED = {util: {prepareJSONataExpression: sinon.stub().returns(jsnExpr)}};
            const node = "fake";

            let expr = chronos.getJSONataExpression(RED, node, "my expression");
            expr.should.have.property("testToken", "chronos");
            RED.util.prepareJSONataExpression.should.be.calledWith("my expression", node);
            jsnExpr.registerFunction.should.have.callCount(14);
        });

        it("should register functions", function()
        {
            const RED = {"_": () => "", util: {prepareJSONataExpression: function(expr, node)
            {
                return jsonata(expr);
            }}};
            const node = {locale: "en-US", config: {latitude: 0, longitude: 0}};
            const ts = chronos.getTimeFrom(node, "2021-12-02T12:34:56.789").valueOf();

            let expr = chronos.getJSONataExpression(RED, node, "$millisecond($ts)");
            expr.assign("ts", ts);
            let result = expr.evaluate({});
            result.should.equal(789);

            expr = chronos.getJSONataExpression(RED, node, "$second($ts)");
            expr.assign("ts", ts);
            result = expr.evaluate({});
            result.should.equal(56);

            expr = chronos.getJSONataExpression(RED, node, "$minute($ts)");
            expr.assign("ts", ts);
            result = expr.evaluate({});
            result.should.equal(34);

            expr = chronos.getJSONataExpression(RED, node, "$hour($ts)");
            expr.assign("ts", ts);
            result = expr.evaluate({});
            result.should.equal(12);

            expr = chronos.getJSONataExpression(RED, node, "$day($ts)");
            expr.assign("ts", ts);
            result = expr.evaluate({});
            result.should.equal(2);

            expr = chronos.getJSONataExpression(RED, node, "$dayOfWeek($ts)");
            expr.assign("ts", ts);
            result = expr.evaluate({});
            result.should.equal(5);

            expr = chronos.getJSONataExpression(RED, node, "$dayOfYear($ts)");
            expr.assign("ts", ts);
            result = expr.evaluate({});
            result.should.equal(336);

            expr = chronos.getJSONataExpression(RED, node, "$week($ts)");
            expr.assign("ts", ts);
            result = expr.evaluate({});
            result.should.equal(49);

            expr = chronos.getJSONataExpression(RED, node, "$month($ts)");
            expr.assign("ts", ts);
            result = expr.evaluate({});
            result.should.equal(12);

            expr = chronos.getJSONataExpression(RED, node, "$quarter($ts)");
            expr.assign("ts", ts);
            result = expr.evaluate({});
            result.should.equal(4);

            expr = chronos.getJSONataExpression(RED, node, "$year($ts)");
            expr.assign("ts", ts);
            result = expr.evaluate({});
            result.should.equal(2021);

            expr = chronos.getJSONataExpression(RED, node, "$time($ts, '11:22')");
            expr.assign("ts", ts);
            result = moment(expr.evaluate({}));
            result.add(result.utcOffset(), "minutes");
            result.valueOf().should.equal(1638444120000);

            expr = chronos.getJSONataExpression(RED, node, "$time($ts, '11:22', 0, false)");
            expr.assign("ts", ts);
            result = moment(expr.evaluate({}));
            result.add(result.utcOffset(), "minutes");
            result.valueOf().should.equal(1638444120000);

            expr = chronos.getJSONataExpression(RED, node, "$time($ts, '11:22', 10, false)");
            expr.assign("ts", ts);
            result = moment(expr.evaluate({}));
            result.add(result.utcOffset(), "minutes");
            result.valueOf().should.equal(1638444720000);

            sinon.stub(Math, "random").returns(0.5);
            expr = chronos.getJSONataExpression(RED, node, "$time($ts, '11:22', 20, true)");
            expr.assign("ts", ts);
            result = moment(expr.evaluate({}));
            result.add(result.utcOffset(), "minutes");
            result.valueOf().should.equal(1638444720000);

            sinon.stub(sunCalc, "getTimes").returns({"sunset": new Date("2000-01-01T11:22:33.444Z")});
            expr = chronos.getJSONataExpression(RED, node, "$sunTime($ts, 'sunset', 0, false)");
            expr.assign("ts", ts);
            result = expr.evaluate({});
            sunCalc.getTimes.should.be.calledOnce();
            result.should.equal(946725753444);

            sunCalc.getTimes.resetHistory();
            expr = chronos.getJSONataExpression(RED, node, "$sunTime($ts, 'sunset')");
            expr.assign("ts", ts);
            result = expr.evaluate({});
            sunCalc.getTimes.should.be.calledOnce();
            result.should.equal(946725753444);

            sinon.stub(sunCalc, "getMoonTimes").returns({"rise": new Date("2000-01-01T11:22:33.444Z")});
            expr = chronos.getJSONataExpression(RED, node, "$moonTime($ts, 'rise', 0, false)");
            expr.assign("ts", ts);
            result = expr.evaluate({});
            sunCalc.getTimes.should.be.calledOnce();
            result.should.equal(946725753444);

            sunCalc.getMoonTimes.resetHistory();
            expr = chronos.getJSONataExpression(RED, node, "$moonTime($ts, 'rise')");
            expr.assign("ts", ts);
            result = expr.evaluate({});
            sunCalc.getTimes.should.be.calledOnce();
            result.should.equal(946725753444);
        });
    });
});
