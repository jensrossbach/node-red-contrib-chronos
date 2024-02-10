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


const sinon = require("sinon");

const helper = require("node-red-node-test-helper");
const configNode = require("../nodes/config.js");
const changeNode = require("../nodes/change.js");
const chronos = require("../nodes/common/chronos.js");
const moment = require("moment");
const { getTimeFrom } = require("../nodes/common/chronos.js");
const { mock } = require("sinon");

require("should-sinon");

const cfgNode = {id: "cn1", type: "chronos-config", name: "config"};
const cfgNodeInvalidTZ = {id: "cn1", type: "chronos-config", name: "config", timezone: "invalid"};
const hlpNode = {id: "hn1", type: "helper"};
const credentials = {"cn1": {latitude: "50", longitude: "10"}};

describe("time change node", function()
{
    before(function(done)
    {
        helper.startServer(done);
    });

    after(function(done)
    {
        helper.stopServer(done);
    });

    context("node initialization", function()
    {
        afterEach(function()
        {
            helper.unload();
            sinon.restore();
        });

        it("should load correctly", async function()
        {
            const flow = [{id: "chn1", type: "chronos-change", name: "change", config: "cn1", rules: [{action: "set", target: {type: "msg", name: "payload"}, type: "now"}]}, cfgNode];

            await helper.load([configNode, changeNode], flow, credentials);
            const chn1 = helper.getNode("chn1");
            chn1.should.have.property("name", "change");
            chn1.should.have.property("rules").which.is.an.Array();
        });

        it("should fail due to missing configuration", async function()
        {
            const flow = [{id: "chn1", type: "chronos-change", name: "change"}];

            await helper.load(changeNode, flow, {});
            const chn1 = helper.getNode("chn1");
            chn1.status.should.be.calledOnce();
            chn1.error.should.be.calledOnce().and.calledWith("node-red-contrib-chronos/chronos-config:common.error.noConfig");
        });

        it("should fail due to invalid latitude", async function()
        {
            const flow = [{id: "chn1", type: "chronos-change", name: "change", config: "cn1"}, cfgNode];
            const invalidCredentials = {"cn1": {latitude: "", longitude: "10"}};

            await helper.load([configNode, changeNode], flow, invalidCredentials);
            const chn1 = helper.getNode("chn1");
            chn1.status.should.be.calledOnce();
            chn1.error.should.be.calledOnce().and.calledWith("node-red-contrib-chronos/chronos-config:common.error.invalidConfig");
        });

        it("should fail due to invalid longitude", async function()
        {
            const flow = [{id: "chn1", type: "chronos-change", name: "change", config: "cn1"}, cfgNode];
            const invalidCredentials = {"cn1": {latitude: "50", longitude: ""}};

            await helper.load([configNode, changeNode], flow, invalidCredentials);
            const chn1 = helper.getNode("chn1");
            chn1.status.should.be.calledOnce();
            chn1.error.should.be.calledOnce().and.calledWith("node-red-contrib-chronos/chronos-config:common.error.invalidConfig");
        });

        it("should fail due to invalid time zone", async function()
        {
            const flow = [{id: "chn1", type: "chronos-change", name: "change", config: "cn1"}, cfgNodeInvalidTZ];

            await helper.load([configNode, changeNode], flow, credentials);
            const chn1 = helper.getNode("chn1");
            chn1.status.should.be.calledOnce();
            chn1.error.should.be.calledOnce().and.calledWith("node-red-contrib-chronos/chronos-config:common.error.invalidConfig");
        });

        function testInvalidRules(title, flow, exp)
        {
            it("should fail due to " + title, async function()
            {
                await helper.load([configNode, changeNode], flow, credentials);
                const chn1 = helper.getNode("chn1");
                chn1.status.should.be.called();
                chn1.error.should.be.calledOnce().and.calledWith(exp);
            });
        }

        const invalidConfig = "node-red-contrib-chronos/chronos-config:common.error.invalidConfig";
        testInvalidRules("missing rules", [{id: "chn1", type: "chronos-change", name: "change", config: "cn1", rules: []}, cfgNode], "change.error.noRules");
        testInvalidRules("invalid date", [{id: "chn1", type: "chronos-change", name: "change", config: "cn1", rules: [{action: "set", target: {type: "msg", name: "payload"}, type: "date", date: "invalid", time: {type: "time", value: "10:00"}}]}, cfgNode], invalidConfig);
        testInvalidRules("invalid time", [{id: "chn1", type: "chronos-change", name: "change", config: "cn1", rules: [{action: "set", target: {type: "msg", name: "payload"}, type: "date", date: "2000-01-01", time: {type: "time", value: "10_00"}}]}, cfgNode], invalidConfig);
        testInvalidRules("empty to-string format", [{id: "chn1", type: "chronos-change", name: "change", config: "cn1", rules: [{action: "change", target: {type: "msg", name: "payload"}, type: "toString", format: ""}]}, cfgNode], invalidConfig);
    });

    context("error handling", function()
    {
        beforeEach(function()
        {
            sinon.useFakeTimers({toFake: ["Date"]});
        });

        afterEach(function()
        {
            helper.unload();
            sinon.restore();
        });

        it("should handle time error during rule evaluation", async function()
        {
            const flow = [{id: "chn1", type: "chronos-change", name: "change", config: "cn1", rules: [{action: "set", target: {type: "msg", name: "payload"}, type: "date", date: "2000-01-01", time: {type: "time", value: "18:00"}}]}, cfgNode];
            sinon.stub(chronos, "getTime").throws(function() { return new chronos.TimeError("time error", {type: "sun", value: "sunset"}); });

            await helper.load([configNode, changeNode], flow, credentials);
            const chn1 = helper.getNode("chn1");

            chn1.receive({payload: "test"});
            chn1.error.should.be.calledWith("time error", {_msgid: sinon.match.any, payload: "test", errorDetails: {type: "sun", value: "sunset"}});
        });

        it("should handle time error during rule evaluation (rename errorDetails)", async function()
        {
            const flow = [{id: "chn1", type: "chronos-change", name: "change", config: "cn1", rules: [{action: "set", target: {type: "msg", name: "payload"}, type: "date", date: "2000-01-01", time: {type: "time", value: "18:00"}}]}, cfgNode];
            sinon.stub(chronos, "getTime").throws(function() { return new chronos.TimeError("time error", {type: "sun", value: "sunset"}); });

            await helper.load([configNode, changeNode], flow, credentials);
            const chn1 = helper.getNode("chn1");

            chn1.receive({payload: "test", errorDetails: "details"});
            chn1.error.should.be.calledWith("time error", {_msgid: sinon.match.any, payload: "test", _errorDetails: "details", errorDetails: {type: "sun", value: "sunset"}});
        });

        it("should handle other error during rule evaluation", async function()
        {
            const flow = [{id: "chn1", type: "chronos-change", name: "change", config: "cn1", rules: [{action: "set", target: {type: "msg", name: "payload"}, type: "date", date: "2000-01-01", time: {type: "time", value: "18:00"}}]}, cfgNode];
            sinon.stub(chronos, "getTime").throws("error", "error message");

            await helper.load([configNode, changeNode], flow, credentials);
            const chn1 = helper.getNode("chn1");

            chn1.receive({payload: "test"});
            chn1.error.should.be.calledWith("error message");
        });

        it("should fail due to invalid expression (syntax error)", async function()
        {
            const flow = [{id: "chn1", type: "chronos-change", name: "change", config: "cn1", rules: [{action: "set", target: {type: "msg", name: "payload"}, type: "jsonata", expression: "my expression"}]}, cfgNode];

            sinon.stub(chronos, "getJSONataExpression").throws(function()
            {
                let e = new Error("some error");
                e.code = 42;
                e.position = "abc";
                e.token = "xyz";
                e.value = "val123";
                return e;
            });
            sinon.spy(helper._RED.util, "evaluateJSONataExpression");

            await helper.load([configNode, changeNode], flow, credentials);
            const chn1 = helper.getNode("chn1");

            chn1.receive({payload: "test"});
            chn1.error.should.be.calledWith("node-red-contrib-chronos/chronos-config:common.error.evaluationFailed", {_msgid: sinon.match.any, payload: "test", errorDetails: {rule: 1, expression: "my expression", code: 42, description: "some error", position: "abc", token: "xyz", value: "val123"}});
            chronos.getJSONataExpression.should.be.calledWith(sinon.match.any, sinon.match.any, "my expression");
            helper._RED.util.evaluateJSONataExpression.should.not.be.called();
        });

        it("should fail due to invalid expression (evaluation error)", function(done)
        {
            const flow = [{id: "chn1", type: "chronos-change", name: "change", config: "cn1", rules: [{action: "set", target: {type: "msg", name: "payload"}, type: "jsonata", expression: "my expression"}]}, cfgNode];

            let assign = sinon.spy();
            let registerFunction = sinon.spy();
            sinon.stub(chronos, "getJSONataExpression").returns({assign: assign, registerFunction: registerFunction});
            sinon.stub(chronos, "evaluateJSONataExpression").throws(function()
            {
                let e = new Error("some error");
                e.code = 42;
                e.position = "abc";
                e.token = "xyz";
                return e;
            });

            helper.load([configNode, changeNode], flow, credentials, function()
            {
                const chn1 = helper.getNode("chn1");

                chn1.receive({payload: "test"});
                chn1.on("call:error", error =>
                {
                    try
                    {
                        error.should.be.calledWith("node-red-contrib-chronos/chronos-config:common.error.evaluationFailed", {_msgid: sinon.match.any, payload: "test", errorDetails: {rule: 1, expression: "my expression", code: 42, description: "some error", position: "abc", token: "xyz"}});
                        chronos.getJSONataExpression.should.be.calledWith(sinon.match.any, sinon.match.any, "my expression");
                        assign.should.be.calledWith("target", "test");
                        registerFunction.should.have.callCount(5);
                        chronos.evaluateJSONataExpression.should.be.calledWith(sinon.match.any, sinon.match.any, {_msgid: sinon.match.any, payload: "test"});
                        done();
                    }
                    catch (e)
                    {
                        done(e);
                    }
                });
            });
        });

        it("should fail due to invalid expression (not integer or string result)", function(done)
        {
            const flow = [{id: "chn1", type: "chronos-change", name: "change", config: "cn1", rules: [{action: "set", target: {type: "msg", name: "payload"}, type: "jsonata", expression: "my expression"}]}, cfgNode];

            let assign = sinon.spy();
            let registerFunction = sinon.spy();
            sinon.stub(chronos, "getJSONataExpression").returns({assign: assign, registerFunction: registerFunction});
            sinon.stub(chronos, "evaluateJSONataExpression").returns(true);

            helper.load([configNode, changeNode], flow, credentials, function()
            {
                const chn1 = helper.getNode("chn1");

                chn1.receive({payload: "test"});
                chn1.on("call:error", error =>
                {
                    try
                    {
                        error.should.be.calledWith("node-red-contrib-chronos/chronos-config:common.error.notTime", {_msgid: sinon.match.any, payload: "test", errorDetails: {rule: 1, expression: "my expression", result: true}});
                        chronos.getJSONataExpression.should.be.calledWith(sinon.match.any, sinon.match.any, "my expression");
                        assign.should.be.calledWith("target", "test");
                        registerFunction.should.have.callCount(5);
                        chronos.evaluateJSONataExpression.should.be.calledWith(sinon.match.any, sinon.match.any, {_msgid: sinon.match.any, payload: "test"});
                        done();
                    }
                    catch (e)
                    {
                        done(e);
                    }
                });
            });
        });
    });

    context("set action", function()
    {
        beforeEach(function()
        {
            sinon.useFakeTimers({toFake: ["Date"]});
        });

        afterEach(function()
        {
            helper.unload();
            sinon.restore();
        });

        it("should set message property to current time", function(done)
        {
            const flow = [{id: "chn1", type: "chronos-change", name: "change", config: "cn1", wires: [["hn1"]], rules: [{action: "set", target: {type: "msg", name: "payload"}, type: "now"}]}, hlpNode, cfgNode];

            helper.load([configNode, changeNode], flow, credentials, function()
            {
                try
                {
                    const chn1 = helper.getNode("chn1");
                    const hn1 = helper.getNode("hn1");

                    hn1.on("input", function(msg)
                    {
                        try
                        {
                            msg.should.have.property("payload", 0);
                            done();
                        }
                        catch (e)
                        {
                            done(e);
                        }
                    });

                    chn1.receive({payload: "test"});
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should set flow variable to current time", async function()
        {
            const flow = [{id: "chn1", type: "chronos-change", name: "change", config: "cn1", rules: [{action: "set", target: {type: "flow", name: "testVariable"}, type: "now"}]}, cfgNode];
            const ctx = {flow: {}};
            sinon.stub(helper._RED.util, "parseContextStore").returns({key: "testKey", store: "testStore"});

            await helper.load([configNode, changeNode], flow, credentials);
            const chn1 = helper.getNode("chn1");

            sinon.stub(chn1, "context").returns(ctx);
            ctx.flow.set = sinon.spy();

            chn1.receive({payload: "test"});
            helper._RED.util.parseContextStore.should.be.calledWith("testVariable");
            chn1.context.should.be.calledOnce();
            ctx.flow.set.should.be.calledWith("testKey", 0, "testStore");
        });

        it("should set global variable to current time", async function()
        {
            const flow = [{id: "chn1", type: "chronos-change", name: "change", config: "cn1", rules: [{action: "set", target: {type: "global", name: "testVariable"}, type: "now"}]}, cfgNode];
            const ctx = {global: {}};
            sinon.stub(helper._RED.util, "parseContextStore").returns({key: "testKey", store: "testStore"});

            await helper.load([configNode, changeNode], flow, credentials);
            const chn1 = helper.getNode("chn1");

            sinon.stub(chn1, "context").returns(ctx);
            ctx.global.set = sinon.spy();

            chn1.receive({payload: "test"});
            helper._RED.util.parseContextStore.should.be.calledWith("testVariable");
            chn1.context.should.be.calledOnce();
            ctx.global.set.should.be.calledWith("testKey", 0, "testStore");
        });

        it("should set message property to specific date and time", function(done)
        {
            const flow = [{id: "chn1", type: "chronos-change", name: "change", config: "cn1", wires: [["hn1"]], rules: [{action: "set", target: {type: "msg", name: "payload"}, type: "date", date: "2000-01-01", time: {type: "time", value: "18:00"}}]}, hlpNode, cfgNode];
            sinon.stub(chronos, "getTime").returns(moment.utc(946749600000));
            sinon.spy(chronos, "getUserDate");

            helper.load([configNode, changeNode], flow, credentials, function()
            {
                try
                {
                    const chn1 = helper.getNode("chn1");
                    const hn1 = helper.getNode("hn1");

                    hn1.on("input", function(msg)
                    {
                        try
                        {
                            chronos.getUserDate.should.be.calledWith(sinon.match.any, sinon.match.any, "2000-01-01");
                            chronos.getTime.should.be.calledWith(sinon.match.any, sinon.match.any, sinon.match.any, "time", "18:00");
                            msg.should.have.property("payload", 946749600000);
                            done();
                        }
                        catch (e)
                        {
                            done(e);
                        }
                    });

                    chn1.receive({payload: "test"});
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should set message property to expression result", function(done)
        {
            const flow = [{id: "chn1", type: "chronos-change", name: "change", config: "cn1", wires: [["hn1"]], rules: [{action: "set", target: {type: "msg", name: "payload"}, type: "jsonata", expression: "my expression"}]}, hlpNode, cfgNode];
            let assign = sinon.spy();
            let registerFunction = sinon.spy();
            const mock = sinon.mock(chronos);  // need to use a mock instead of a stub as the expected argument mutates
            mock.expects("getJSONataExpression").returns({assign: assign, registerFunction: registerFunction})
                .withArgs(sinon.match.any, sinon.match.any, "my expression");

            helper.load([configNode, changeNode], flow, credentials, function()
            {
                try
                {
                    const chn1 = helper.getNode("chn1");
                    const hn1 = helper.getNode("hn1");

                    hn1.on("input", function(msg)
                    {
                        try
                        {
                            msg.should.have.property("payload", 1638444720000);
                            done();
                        }
                        catch (e)
                        {
                            done(e);
                        }
                    });

                    mock.expects("evaluateJSONataExpression").returns(1638444720000)
                        .withArgs(sinon.match.any, sinon.match.any, {payload: "test", _msgid: sinon.match.any});

                    chn1.receive({payload: "test"});
                    mock.verify();
                    assign.should.be.calledWith("target", "test");
                    registerFunction.should.have.callCount(5);
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should handle undefined target correctly", function(done)
        {
            const flow = [{id: "chn1", type: "chronos-change", name: "change", config: "cn1", wires: [["hn1"]], rules: [{action: "set", target: {type: "msg", name: "non.existing"}, type: "jsonata", expression: "$exists($target) ? 0 : 1"}]}, hlpNode, cfgNode];

            helper.load([configNode, changeNode], flow, credentials, function()
            {
                try
                {
                    const chn1 = helper.getNode("chn1");
                    const hn1 = helper.getNode("hn1");

                    hn1.on("input", function(msg)
                    {
                        try
                        {
                            msg.should.have.property("non");
                            msg.non.should.have.property("existing", 1);
                            done();
                        }
                        catch (e)
                        {
                            done(e);
                        }
                    });

                    chn1.receive({payload: "test"});
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should call expression function", function(done)
        {
            const flow = [{id: "chn1", type: "chronos-change", name: "change", config: "cn1", wires: [["hn1"]], rules:
                            [
                                {action: "set", target: {type: "msg", name: "payload"}, type: "jsonata", expression: "$set($target, 'year', 2022)"},
                                {action: "set", target: {type: "msg", name: "payload"}, type: "jsonata", expression: "$add($target, 2, 'day')"},
                                {action: "set", target: {type: "msg", name: "payload"}, type: "jsonata", expression: "$subtract($target, 1, 'month')"},
                                {action: "set", target: {type: "msg", name: "payload"}, type: "jsonata", expression: "$startOf($target, 'hour')"},
                                {action: "set", target: {type: "msg", name: "payload"}, type: "jsonata", expression: "$endOf($target, 'minute')"}
                            ]}, hlpNode, cfgNode];

            helper.load([configNode, changeNode], flow, credentials, function()
            {
                try
                {
                    const chn1 = helper.getNode("chn1");
                    const hn1 = helper.getNode("hn1");

                    hn1.on("input", function(msg)
                    {
                        try
                        {
                            msg.should.have.property("payload", 1649415659999);
                            done();
                        }
                        catch (e)
                        {
                            done(e);
                        }
                    });

                    chn1.receive({payload: "2020-05-06T11:22:33.444Z"});
                }
                catch (e)
                {
                    done(e);
                }
            });
        });
    });

    context("change action", function()
    {
        let fakeMoment = null;

        beforeEach(function()
        {
            fakeMoment =
            {
                valueOf: sinon.stub().returns("super!")
            };

            sinon.stub(chronos, "getTimeFrom").returns(fakeMoment);
        });

        afterEach(function()
        {
            helper.unload();
            sinon.restore();
        });

        it("should handle message property of wrong type", async function()
        {
            const flow = [{id: "chn1", type: "chronos-change", name: "change", config: "cn1", rules: [{action: "change", target: {type: "msg", name: "payload"}, type: "set", part: "year", value: 2021}]}, cfgNode];

            await helper.load([configNode, changeNode], flow, credentials);
            const chn1 = helper.getNode("chn1");

            chn1.receive({payload: true});
            chn1.error.should.be.calledWith("change.error.invalidProperty", {_msgid: sinon.match.any, payload: true});
        });

        it("should handle invalid message property", async function()
        {
            const flow = [{id: "chn1", type: "chronos-change", name: "change", config: "cn1", rules: [{action: "change", target: {type: "msg", name: "payload"}, type: "set", part: "year", value: 2021}]}, cfgNode];
            fakeMoment.isValid = sinon.stub().returns(false);

            await helper.load([configNode, changeNode], flow, credentials);
            const chn1 = helper.getNode("chn1");

            chn1.receive({payload: "test"});
            chronos.getTimeFrom.should.be.calledWith(sinon.match.any, "test");
            chn1.error.should.be.calledWith("change.error.invalidProperty", {_msgid: sinon.match.any, payload: "test"});
        });

        it("should handle invalid flow variable", async function()
        {
            const flow = [{id: "chn1", type: "chronos-change", name: "change", config: "cn1", rules: [{action: "change", target: {type: "flow", name: "testVariable"}, type: "set", part: "year", value: 2021}]}, cfgNode];
            const ctx = {flow: {}};

            fakeMoment.isValid = sinon.stub().returns(false);
            sinon.stub(helper._RED.util, "parseContextStore").returns({key: "testKey", store: "testStore"});

            await helper.load([configNode, changeNode], flow, credentials);
            const chn1 = helper.getNode("chn1");

            sinon.stub(chn1, "context").returns(ctx);
            ctx.flow.get = sinon.stub().returns("test");

            chn1.receive({payload: null});
            helper._RED.util.parseContextStore.should.be.calledTwice().and.be.calledWith("testVariable");
            chn1.context.should.be.calledOnce();
            ctx.flow.get.should.be.calledWith("testKey", "testStore");
            chronos.getTimeFrom.should.be.calledWith(sinon.match.any, "test");
            chn1.error.should.be.calledWith("change.error.invalidProperty", {_msgid: sinon.match.any, payload: null});
        });

        it("should handle invalid global variable", async function()
        {
            const flow = [{id: "chn1", type: "chronos-change", name: "change", config: "cn1", rules: [{action: "change", target: {type: "global", name: "testVariable"}, type: "set", part: "year", value: 2021}]}, cfgNode];
            const ctx = {global: {}};

            fakeMoment.isValid = sinon.stub().returns(false);
            sinon.stub(helper._RED.util, "parseContextStore").returns({key: "testKey", store: "testStore"});

            await helper.load([configNode, changeNode], flow, credentials);
            const chn1 = helper.getNode("chn1");

            sinon.stub(chn1, "context").returns(ctx);
            ctx.global.get = sinon.stub().returns("test");

            chn1.receive({payload: null});
            helper._RED.util.parseContextStore.should.be.calledTwice().and.be.calledWith("testVariable");
            chn1.context.should.be.calledOnce();
            ctx.global.get.should.be.calledWith("testKey", "testStore");
            chronos.getTimeFrom.should.be.calledWith(sinon.match.any, "test");
            chn1.error.should.be.calledWith("change.error.invalidProperty", {_msgid: sinon.match.any, payload: null});
        });

        function testChangeSet(part, value, fake, input)
        {
            it("should change " + part + " to " + value, function(done)
            {
                const flow = [{id: "chn1", type: "chronos-change", name: "change", config: "cn1", wires: [["hn1"]], rules: [{action: "change", target: {type: "msg", name: "payload"}, type: "set", part: part, value: value}]}, hlpNode, cfgNode];
                fakeMoment[fake] = sinon.spy();
                fakeMoment.isValid = sinon.stub().returns(true);

                helper.load([configNode, changeNode], flow, credentials, function()
                {
                    try
                    {
                        const chn1 = helper.getNode("chn1");
                        const hn1 = helper.getNode("hn1");

                        hn1.on("input", function(msg)
                        {
                            try
                            {
                                chronos.getTimeFrom.should.be.calledWith(sinon.match.any, "test");
                                fakeMoment[fake].should.be.calledWith(input);
                                msg.should.have.property("payload", "super!");
                                done();
                            }
                            catch (e)
                            {
                                done(e);
                            }
                        });

                        chn1.receive({payload: "test"});
                    }
                    catch (e)
                    {
                        done(e);
                    }
                });
            });
        }

        testChangeSet("year", 2021, "year", 2021);
        testChangeSet("quarter", 1, "quarter", 1);
        testChangeSet("month", 12, "month", 11);
        testChangeSet("week", 10, "week", 10);
        testChangeSet("weekday", 1, "weekday", 0);
        testChangeSet("day", 20, "date", 20);
        testChangeSet("hour", 12, "hour", 12);
        testChangeSet("minute", 30, "minute", 30);
        testChangeSet("second", 40, "second", 40);
        testChangeSet("millisecond", 500, "millisecond", 500);

        function testChangeAddSub(type, value, unit)
        {
            it("should " + type + " " + value + " " + unit, function(done)
            {
                const flow = [{id: "chn1", type: "chronos-change", name: "change", config: "cn1", wires: [["hn1"]], rules: [{action: "change", target: {type: "msg", name: "payload"}, type: type, unit: unit, value: value}]}, hlpNode, cfgNode];
                fakeMoment[type] = sinon.spy();
                fakeMoment.isValid = sinon.stub().returns(true);

                helper.load([configNode, changeNode], flow, credentials, function()
                {
                    try
                    {
                        const chn1 = helper.getNode("chn1");
                        const hn1 = helper.getNode("hn1");

                        hn1.on("input", function(msg)
                        {
                            try
                            {
                                chronos.getTimeFrom.should.be.calledWith(sinon.match.any, "test");
                                fakeMoment[type].should.be.calledWith(value);
                                msg.should.have.property("payload", "super!");
                                done();
                            }
                            catch (e)
                            {
                                done(e);
                            }
                        });

                        chn1.receive({payload: "test"});
                    }
                    catch (e)
                    {
                        done(e);
                    }
                });
            });
        }

        testChangeAddSub("add", 5, "months");
        testChangeAddSub("subtract", 3, "years");

        function testChangeStartEndOf(type, value)
        {
            it("should change to " + type + " " + value, function(done)
            {
                const flow = [{id: "chn1", type: "chronos-change", name: "change", config: "cn1", wires: [["hn1"]], rules: [{action: "change", target: {type: "msg", name: "payload"}, type: type, arg: value}]}, hlpNode, cfgNode];
                fakeMoment[type] = sinon.spy();
                fakeMoment.isValid = sinon.stub().returns(true);

                helper.load([configNode, changeNode], flow, credentials, function()
                {
                    try
                    {
                        const chn1 = helper.getNode("chn1");
                        const hn1 = helper.getNode("hn1");

                        hn1.on("input", function(msg)
                        {
                            try
                            {
                                chronos.getTimeFrom.should.be.calledWith(sinon.match.any, "test");
                                fakeMoment[type].should.be.calledWith(value);
                                msg.should.have.property("payload", "super!");
                                done();
                            }
                            catch (e)
                            {
                                done(e);
                            }
                        });

                        chn1.receive({payload: "test"});
                    }
                    catch (e)
                    {
                        done(e);
                    }
                });
            });
        }

        testChangeStartEndOf("startOf", "day");
        testChangeStartEndOf("endOf", "month");

        it("should convert to string", function(done)
        {
            const flow = [{id: "chn1", type: "chronos-change", name: "change", config: "cn1", wires: [["hn1"]], rules: [{action: "change", target: {type: "msg", name: "payload"}, type: "toString", format: "my format"}]}, hlpNode, cfgNode];
            fakeMoment.format = sinon.stub().returns("super!");
            fakeMoment.isValid = sinon.stub().returns(true);

            helper.load([configNode, changeNode], flow, credentials, function()
            {
                try
                {
                    const chn1 = helper.getNode("chn1");
                    const hn1 = helper.getNode("hn1");

                    hn1.on("input", function(msg)
                    {
                        try
                        {
                            chronos.getTimeFrom.should.be.calledWith(sinon.match.any, "test");
                            fakeMoment.format.should.be.calledWith("my format");
                            msg.should.have.property("payload", "super!");
                            done();
                        }
                        catch (e)
                        {
                            done(e);
                        }
                    });

                    chn1.receive({payload: "test"});
                }
                catch (e)
                {
                    done(e);
                }
            });
        });
    });
});
