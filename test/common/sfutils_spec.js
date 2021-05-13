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


const sinon = require("sinon");
const sfutils = require("../../nodes/common/sfutils.js");
const moment = require("moment");

require("should-sinon");

describe("switch/filter utilities", function()
{
    const RED = {"_": () => "", util: {}};
    const node = {chronos: require("../../nodes/common/chronos.js"), debug: function() {}};

    afterEach(function()
    {
        sinon.restore();
    });

    context("validateCondition", function()
    {
        it("should return true for valid condition", function()
        {
            sfutils.validateCondition(node, {operator: "context", context: {type: "flow", value: "myVariable"}}).should.be.true();
            sfutils.validateCondition(node, {operator: "before", operands: {type: "time", value: "12:00"}}).should.be.true();
            sfutils.validateCondition(node, {operator: "after", operands: {type: "time", value: "12:00"}}).should.be.true();
            sfutils.validateCondition(node, {operator: "between", operands: [{type: "time", value: "12:00"}, {type: "time", value: "16:00"}]}).should.be.true();
            sfutils.validateCondition(node, {operator: "outside", operands: [{type: "time", value: "12:00"}, {type: "time", value: "16:00"}]}).should.be.true();
        });

        it("should return false for invalid condition", function()
        {
            sfutils.validateCondition(node, {operator: "context", context: {type: "flow", value: ""}}).should.be.false();
            sfutils.validateCondition(node, {operator: "before", operands: {type: "time", value: "12-00"}}).should.be.false();
            sfutils.validateCondition(node, {operator: "after", operands: {type: "time", value: "12/00"}}).should.be.false();
            sfutils.validateCondition(node, {operator: "between", operands: [{type: "time", value: "12.00"}, {type: "time", value: "16:00"}]}).should.be.false();
            sfutils.validateCondition(node, {operator: "between", operands: [{type: "time", value: "12:00"}, {type: "time", value: "16.00"}]}).should.be.false();
            sfutils.validateCondition(node, {operator: "outside", operands: [{type: "time", value: "12.00"}, {type: "time", value: "16:00"}]}).should.be.false();
            sfutils.validateCondition(node, {operator: "outside", operands: [{type: "time", value: "12:00"}, {type: "time", value: "16.00"}]}).should.be.false();
        });
    });

    context("evaluateCondition", function()
    {
        it("should parse context-based condition", function()
        {
            RED.util.parseContextStore = sinon.stub().returns({key: "testKey", store: "testStore"});
            const ctx = {flow: {}};
            ctx.flow.get = sinon.stub();
            node.context = sinon.stub().returns(ctx);

            const condition = {operator: "context", context: {type: "flow", value: "testVariable"}};
            const baseTime = moment("2021-03-15T10:00:00.000Z");

            ctx.flow.get.returns({operator: "before", operands: {type: "time", value: "12:00", offset: 0, random: false}});
            sfutils.evaluateCondition(RED, node, baseTime, condition).should.be.true();
            RED.util.parseContextStore.should.be.calledOnce().and.calledWith("testVariable");
            ctx.flow.get.should.be.calledOnce().and.calledWith("testKey", "testStore");

            ctx.flow.get.returns({operator: "weekdays", operands: {monday: true, wednesday: true, thursday: false}});
            sfutils.evaluateCondition(RED, node, baseTime, condition).should.be.true();

            ctx.flow.get.returns({operator: "months", operands: {january: true, march: true, july: false}});
            sfutils.evaluateCondition(RED, node, baseTime, condition).should.be.true();

            delete RED.util.parseContextStore;
        });

        it("should fail due to unavailable context variable", function()
        {
            RED.util.parseContextStore = sinon.stub().returns({key: "testKey", store: "testStore"});
            const ctx = {flow: {}};
            ctx.flow.get = sinon.stub().returns(null);
            node.context = sinon.stub().returns(ctx);

            const condition = {operator: "context", context: {type: "flow", value: "testVariable"}};
            const baseTime = moment("2000-01-01T10:00:00.000Z");

            (() => sfutils.evaluateCondition(RED, node, baseTime, condition)).should.throw(node.chronos.TimeError);
            RED.util.parseContextStore.should.be.calledOnce().and.calledWith("testVariable");
            ctx.flow.get.should.be.calledOnce().and.calledWith("testKey", "testStore");

            delete RED.util.parseContextStore;
        });

        it("should fail due to invalid context variable", function()
        {
            RED.util.parseContextStore = sinon.stub().returns({key: "testKey", store: "testStore"});
            const ctx = {flow: {}};
            ctx.flow.get = sinon.stub();
            node.context = sinon.stub().returns(ctx);

            const condition = {operator: "context", context: {type: "flow", value: "testVariable"}};
            const baseTime = moment("2000-01-01T10:00:00.000Z");

            ctx.flow.get.returns("invalid");
            (() => sfutils.evaluateCondition(RED, node, baseTime, condition)).should.throw(node.chronos.TimeError);

            ctx.flow.get.returns({operator: 5});
            (() => sfutils.evaluateCondition(RED, node, baseTime, condition)).should.throw(node.chronos.TimeError);

            ctx.flow.get.returns({operator: "invalidOp"});
            (() => sfutils.evaluateCondition(RED, node, baseTime, condition)).should.throw(node.chronos.TimeError);

            ctx.flow.get.returns({operator: "before", operands: null});
            (() => sfutils.evaluateCondition(RED, node, baseTime, condition)).should.throw(node.chronos.TimeError);

            ctx.flow.get.returns({operator: "before", operands: "invalid"});
            (() => sfutils.evaluateCondition(RED, node, baseTime, condition)).should.throw(node.chronos.TimeError);

            ctx.flow.get.returns({operator: "before", operands: {type: 5}});
            (() => sfutils.evaluateCondition(RED, node, baseTime, condition)).should.throw(node.chronos.TimeError);

            ctx.flow.get.returns({operator: "before", operands: {type: "invalid"}});
            (() => sfutils.evaluateCondition(RED, node, baseTime, condition)).should.throw(node.chronos.TimeError);

            ctx.flow.get.returns({operator: "before", operands: {type: "time", value: "12_00"}});
            (() => sfutils.evaluateCondition(RED, node, baseTime, condition)).should.throw(node.chronos.TimeError);

            ctx.flow.get.returns({operator: "before", operands: {type: "sun", value: "invalid"}});
            (() => sfutils.evaluateCondition(RED, node, baseTime, condition)).should.throw(node.chronos.TimeError);

            ctx.flow.get.returns({operator: "before", operands: {type: "moon", value: "invalid"}});
            (() => sfutils.evaluateCondition(RED, node, baseTime, condition)).should.throw(node.chronos.TimeError);

            ctx.flow.get.returns({operator: "before", operands: {type: "time", value: "12:00", offset: "invalid"}});
            (() => sfutils.evaluateCondition(RED, node, baseTime, condition)).should.throw(node.chronos.TimeError);

            ctx.flow.get.returns({operator: "before", operands: {type: "time", value: "12:00", offset: 301}});
            (() => sfutils.evaluateCondition(RED, node, baseTime, condition)).should.throw(node.chronos.TimeError);

            ctx.flow.get.returns({operator: "before", operands: {type: "time", value: "12:00", offset: -301}});
            (() => sfutils.evaluateCondition(RED, node, baseTime, condition)).should.throw(node.chronos.TimeError);

            ctx.flow.get.returns({operator: "before", operands: {type: "time", value: "12:00", offset: 0, random: "invalid"}});
            (() => sfutils.evaluateCondition(RED, node, baseTime, condition)).should.throw(node.chronos.TimeError);

            ctx.flow.get.returns({operator: "between", operands: null});
            (() => sfutils.evaluateCondition(RED, node, baseTime, condition)).should.throw(node.chronos.TimeError);

            ctx.flow.get.returns({operator: "between", operands: "invalid"});
            (() => sfutils.evaluateCondition(RED, node, baseTime, condition)).should.throw(node.chronos.TimeError);

            ctx.flow.get.returns({operator: "between", operands: {}});
            (() => sfutils.evaluateCondition(RED, node, baseTime, condition)).should.throw(node.chronos.TimeError);

            ctx.flow.get.returns({operator: "between", operands: []});
            (() => sfutils.evaluateCondition(RED, node, baseTime, condition)).should.throw(node.chronos.TimeError);

            ctx.flow.get.returns({operator: "between", operands: [null, {type: "time", value: "12:00", offset: 0, random: false}]});
            (() => sfutils.evaluateCondition(RED, node, baseTime, condition)).should.throw(node.chronos.TimeError);

            ctx.flow.get.returns({operator: "between", operands: [{type: "time", value: "12:00", offset: 0, random: false}, null]});
            (() => sfutils.evaluateCondition(RED, node, baseTime, condition)).should.throw(node.chronos.TimeError);

            ctx.flow.get.returns({operator: "weekdays", operands: null});
            (() => sfutils.evaluateCondition(RED, node, baseTime, condition)).should.throw(node.chronos.TimeError);

            ctx.flow.get.returns({operator: "weekdays", operands: "invalid"});
            (() => sfutils.evaluateCondition(RED, node, baseTime, condition)).should.throw(node.chronos.TimeError);

            ctx.flow.get.returns({operator: "weekdays", operands: {monday: 5}});
            (() => sfutils.evaluateCondition(RED, node, baseTime, condition)).should.throw(node.chronos.TimeError);

            ctx.flow.get.returns({operator: "weekdays", operands: {tuesday: 5}});
            (() => sfutils.evaluateCondition(RED, node, baseTime, condition)).should.throw(node.chronos.TimeError);

            ctx.flow.get.returns({operator: "weekdays", operands: {wednesday: 5}});
            (() => sfutils.evaluateCondition(RED, node, baseTime, condition)).should.throw(node.chronos.TimeError);

            ctx.flow.get.returns({operator: "weekdays", operands: {thursday: 5}});
            (() => sfutils.evaluateCondition(RED, node, baseTime, condition)).should.throw(node.chronos.TimeError);

            ctx.flow.get.returns({operator: "weekdays", operands: {friday: 5}});
            (() => sfutils.evaluateCondition(RED, node, baseTime, condition)).should.throw(node.chronos.TimeError);

            ctx.flow.get.returns({operator: "weekdays", operands: {saturday: 5}});
            (() => sfutils.evaluateCondition(RED, node, baseTime, condition)).should.throw(node.chronos.TimeError);

            ctx.flow.get.returns({operator: "weekdays", operands: {sunday: 5}});
            (() => sfutils.evaluateCondition(RED, node, baseTime, condition)).should.throw(node.chronos.TimeError);

            ctx.flow.get.returns({operator: "months", operands: null});
            (() => sfutils.evaluateCondition(RED, node, baseTime, condition)).should.throw(node.chronos.TimeError);

            ctx.flow.get.returns({operator: "months", operands: "invalid"});
            (() => sfutils.evaluateCondition(RED, node, baseTime, condition)).should.throw(node.chronos.TimeError);

            ctx.flow.get.returns({operator: "months", operands: {january: 5}});
            (() => sfutils.evaluateCondition(RED, node, baseTime, condition)).should.throw(node.chronos.TimeError);

            ctx.flow.get.returns({operator: "months", operands: {february: 5}});
            (() => sfutils.evaluateCondition(RED, node, baseTime, condition)).should.throw(node.chronos.TimeError);

            ctx.flow.get.returns({operator: "months", operands: {march: 5}});
            (() => sfutils.evaluateCondition(RED, node, baseTime, condition)).should.throw(node.chronos.TimeError);

            ctx.flow.get.returns({operator: "months", operands: {april: 5}});
            (() => sfutils.evaluateCondition(RED, node, baseTime, condition)).should.throw(node.chronos.TimeError);

            ctx.flow.get.returns({operator: "months", operands: {may: 5}});
            (() => sfutils.evaluateCondition(RED, node, baseTime, condition)).should.throw(node.chronos.TimeError);

            ctx.flow.get.returns({operator: "months", operands: {june: 5}});
            (() => sfutils.evaluateCondition(RED, node, baseTime, condition)).should.throw(node.chronos.TimeError);

            ctx.flow.get.returns({operator: "months", operands: {july: 5}});
            (() => sfutils.evaluateCondition(RED, node, baseTime, condition)).should.throw(node.chronos.TimeError);

            ctx.flow.get.returns({operator: "months", operands: {august: 5}});
            (() => sfutils.evaluateCondition(RED, node, baseTime, condition)).should.throw(node.chronos.TimeError);

            ctx.flow.get.returns({operator: "months", operands: {september: 5}});
            (() => sfutils.evaluateCondition(RED, node, baseTime, condition)).should.throw(node.chronos.TimeError);

            ctx.flow.get.returns({operator: "months", operands: {october: 5}});
            (() => sfutils.evaluateCondition(RED, node, baseTime, condition)).should.throw(node.chronos.TimeError);

            ctx.flow.get.returns({operator: "months", operands: {november: 5}});
            (() => sfutils.evaluateCondition(RED, node, baseTime, condition)).should.throw(node.chronos.TimeError);

            ctx.flow.get.returns({operator: "months", operands: {december: 5}});
            (() => sfutils.evaluateCondition(RED, node, baseTime, condition)).should.throw(node.chronos.TimeError);

            delete RED.util.parseContextStore;
        });

        it("should return true", function()
        {
            const baseTime = moment("2021-03-15T10:00:00.000Z").utc();  // Monday, March

            let condition = {operator: "before", operands: {type: "time", value: "12:00", offset: 0, random: false}};
            sfutils.evaluateCondition(RED, node, baseTime, condition).should.be.true();

            condition = {operator: "before", operands: {type: "time", value: "9:45", offset: 30, random: false}};
            sfutils.evaluateCondition(RED, node, baseTime, condition).should.be.true();

            let roundStub = sinon.stub(Math, "round").returnsArg(0);
            let randomStub = sinon.stub(Math, "random").returns(10);

            condition = {operator: "before", operands: {type: "time", value: "9:45", offset: 3, random: true}};
            sfutils.evaluateCondition(RED, node, baseTime, condition).should.be.true();

            sinon.restore();

            condition = {operator: "after", operands: {type: "time", value: "8:00", offset: 0, random: false}};
            sfutils.evaluateCondition(RED, node, baseTime, condition).should.be.true();

            condition = {operator: "between", operands: [{type: "time", value: "8:00", offset: 0, random: false}, {type: "time", value: "12:00", offset: 0, random: false}]};
            sfutils.evaluateCondition(RED, node, baseTime, condition).should.be.true();

            condition = {operator: "between", operands: [{type: "time", value: "23:00", offset: 0, random: false}, {type: "time", value: "12:00", offset: 0, random: false}]};
            sfutils.evaluateCondition(RED, node, baseTime, condition).should.be.true();

            condition = {operator: "between", operands: [{type: "time", value: "10:15", offset: -30, random: false}, {type: "time", value: "9:45", offset: 30, random: false}]};
            sfutils.evaluateCondition(RED, node, baseTime, condition).should.be.true();

            roundStub = sinon.stub(Math, "round").returnsArg(0);
            randomStub = sinon.stub(Math, "random").returns(10);

            condition = {operator: "between", operands: [{type: "time", value: "10:15", offset: -3, random: true}, {type: "time", value: "9:45", offset: 3, random: true}]};
            sfutils.evaluateCondition(RED, node, baseTime, condition).should.be.true();

            sinon.restore();

            condition = {operator: "outside", operands: [{type: "time", value: "12:00", offset: 0, random: false}, {type: "time", value: "14:00", offset: 0, random: false}]};
            sfutils.evaluateCondition(RED, node, baseTime, condition).should.be.true();

            condition = {operator: "outside", operands: [{type: "time", value: "5:00", offset: 0, random: false}, {type: "time", value: "6:00", offset: 0, random: false}]};
            sfutils.evaluateCondition(RED, node, baseTime, condition).should.be.true();

            condition = {operator: "outside", operands: [{type: "time", value: "23:00", offset: 0, random: false}, {type: "time", value: "4:00", offset: 0, random: false}]};
            sfutils.evaluateCondition(RED, node, baseTime, condition).should.be.true();

            condition = {operator: "weekdays", operands: [false, true, false, false, false, false, false]};
            sfutils.evaluateCondition(RED, node, baseTime, condition).should.be.true();

            condition = {operator: "months", operands: [false, false, true, false, false, false, false, false, false, false, false, false]};
            sfutils.evaluateCondition(RED, node, baseTime, condition).should.be.true();
        });

        it("should return false", function()
        {
            const baseTime = moment("2021-03-15T10:00:00.000Z").utc();  // Monday, March

            let condition = {operator: "before", operands: {type: "time", value: "8:00", offset: 0, random: false}};
            sfutils.evaluateCondition(RED, node, baseTime, condition).should.be.false();

            condition = {operator: "after", operands: {type: "time", value: "12:00", offset: 0, random: false}};
            sfutils.evaluateCondition(RED, node, baseTime, condition).should.be.false();

            condition = {operator: "between", operands: [{type: "time", value: "4:00", offset: 0, random: false}, {type: "time", value: "6:00", offset: 0, random: false}]};
            sfutils.evaluateCondition(RED, node, baseTime, condition).should.be.false();

            condition = {operator: "between", operands: [{type: "time", value: "12:00", offset: 0, random: false}, {type: "time", value: "16:00", offset: 0, random: false}]};
            sfutils.evaluateCondition(RED, node, baseTime, condition).should.be.false();

            condition = {operator: "between", operands: [{type: "time", value: "23:00", offset: 0, random: false}, {type: "time", value: "8:00", offset: 0, random: false}]};
            sfutils.evaluateCondition(RED, node, baseTime, condition).should.be.false();

            condition = {operator: "outside", operands: [{type: "time", value: "8:00", offset: 0, random: false}, {type: "time", value: "12:00", offset: 0, random: false}]};
            sfutils.evaluateCondition(RED, node, baseTime, condition).should.be.false();

            condition = {operator: "weekdays", operands: [true, false, false, false, false, false, false]};
            sfutils.evaluateCondition(RED, node, baseTime, condition).should.be.false();

            condition = {operator: "months", operands: [false, true, false, false, false, false, false, false, false, false, false, false]};
            sfutils.evaluateCondition(RED, node, baseTime, condition).should.be.false();
        });
    });

    context("getBaseTime", function()
    {
        it("should return message ingress time", function()
        {
            sinon.stub(node.chronos, "getCurrentTime").returns(moment("2000-01-01T16:20:00.000Z").utc());
            node.baseTimeType = "msgIngress";

            const res = sfutils.getBaseTime(RED, node, {});
            node.chronos.getCurrentTime.should.be.calledWith(node);
            res.year().should.equal(2000);
            res.month().should.equal(0);
            res.date().should.equal(1);
            res.hour().should.equal(16);
            res.minute().should.equal(20);
            res.second().should.equal(0);

            delete node.baseTimeType;
        });

        it("should return time from context variable", function()
        {
            RED.util.parseContextStore = sinon.stub().returns({key: "testKey", store: "testStore"});
            const ctx = {flow: {}, global: {}};
            ctx.flow.get = sinon.stub().returns(1000);
            ctx.global.get = sinon.stub().returns(2000);
            node.context = sinon.stub().returns(ctx);
            sinon.stub(node.chronos, "getTimeFrom").returns(moment("2000-01-01T16:20:00.000Z").utc());

            node.baseTimeType = "flow";
            node.baseTime = "test";
            let res = sfutils.getBaseTime(RED, node, {});
            RED.util.parseContextStore.should.be.calledWith("test");
            node.chronos.getTimeFrom.should.be.calledWith(node, 1000);
            res.year().should.equal(2000);
            res.month().should.equal(0);
            res.date().should.equal(1);
            res.hour().should.equal(16);
            res.minute().should.equal(20);
            res.second().should.equal(0);

            node.baseTimeType = "global";
            node.baseTime = "test";
            res = sfutils.getBaseTime(RED, node, {});
            RED.util.parseContextStore.should.be.calledWith("test");
            node.chronos.getTimeFrom.should.be.calledWith(node, 2000);
            res.year().should.equal(2000);
            res.month().should.equal(0);
            res.date().should.equal(1);
            res.hour().should.equal(16);
            res.minute().should.equal(20);
            res.second().should.equal(0);

            delete RED.util.parseContextStore;
            delete node.baseTimeType;
            delete node.baseTime;
        });
    });

    it("should return time from message property", function()
    {
        RED.util.getMessageProperty = sinon.stub().returns(1000);
        sinon.stub(node.chronos, "getTimeFrom").returns(moment("2000-01-01T16:20:00.000Z").utc());

        node.baseTimeType = "msg";
        node.baseTime = "test";
        let res = sfutils.getBaseTime(RED, node, {});
        RED.util.getMessageProperty.should.be.calledWith({}, "test");
        node.chronos.getTimeFrom.should.be.calledWith(node, 1000);
        res.year().should.equal(2000);
        res.month().should.equal(0);
        res.date().should.equal(1);
        res.hour().should.equal(16);
        res.minute().should.equal(20);
        res.second().should.equal(0);

        delete RED.util.getMessageProperty;
        delete node.baseTimeType;
        delete node.baseTime;
    });

    it("should not return time due to invalid message property", function()
    {
        RED.util.getMessageProperty = sinon.stub().returns("invalid");

        node.baseTimeType = "msg";
        node.baseTime = "test";
        let res = sfutils.getBaseTime(RED, node, {});
        RED.util.getMessageProperty.should.be.calledWith({}, "test");
        (res === null).should.be.true();

        delete RED.util.getMessageProperty;
        delete node.baseTimeType;
        delete node.baseTime;
    });
});
