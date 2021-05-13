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

const helper = require("node-red-node-test-helper");
const configNode = require("../nodes/config.js");
const changeNode = require("../nodes/change.js");
const chronos = require("../nodes/common/chronos.js");
const moment = require("moment");
const { getTimeFrom } = require("../nodes/common/chronos.js");

require("should-sinon");

const cfgNode = {id: "cn1", type: "chronos-config", name: "config"};
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
            chn1.error.should.be.calledOnce();
        });

        it("should fail due to invalid latitude", async function()
        {
            const flow = [{id: "chn1", type: "chronos-change", name: "change", config: "cn1"}, cfgNode];
            const invalidCredentials = {"cn1": {latitude: "", longitude: "10"}};

            await helper.load([configNode, changeNode], flow, invalidCredentials);
            const chn1 = helper.getNode("chn1");
            chn1.status.should.be.calledOnce();
            chn1.error.should.be.calledOnce();
        });

        it("should fail due to invalid longitude", async function()
        {
            const flow = [{id: "chn1", type: "chronos-change", name: "change", config: "cn1"}, cfgNode];
            const invalidCredentials = {"cn1": {latitude: "50", longitude: ""}};

            await helper.load([configNode, changeNode], flow, invalidCredentials);
            const chn1 = helper.getNode("chn1");
            chn1.status.should.be.calledOnce();
            chn1.error.should.be.calledOnce();
        });

        function testInvalidRules(title, flow)
        {
            it("should fail due to " + title, async function()
            {
                await helper.load([configNode, changeNode], flow, credentials);
                const chn1 = helper.getNode("chn1");
                chn1.status.should.be.called();
                chn1.error.should.be.calledOnce();
            });
        }

        testInvalidRules("missing rules", [{id: "chn1", type: "chronos-change", name: "change", config: "cn1", rules: []}, cfgNode]);
        testInvalidRules("invalid date", [{id: "chn1", type: "chronos-change", name: "change", config: "cn1", rules: [{action: "set", target: {type: "msg", name: "payload"}, type: "date", date: "invalid", time: {type: "time", value: "10:00"}}]}, cfgNode]);
        testInvalidRules("invalid time", [{id: "chn1", type: "chronos-change", name: "change", config: "cn1", rules: [{action: "set", target: {type: "msg", name: "payload"}, type: "date", date: "2000-01-01", time: {type: "time", value: "10_00"}}]}, cfgNode]);
        testInvalidRules("empty to-string format", [{id: "chn1", type: "chronos-change", name: "change", config: "cn1", rules: [{action: "change", target: {type: "msg", name: "payload"}, type: "toString", format: ""}]}, cfgNode]);
    });

    context("time errors", function()
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

            await helper.load([configNode, changeNode], flow, credentials);
            const chn1 = helper.getNode("chn1");

            sinon.stub(helper._RED.util, "parseContextStore").returns({key: "testKey", store: "testStore"});
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

            await helper.load([configNode, changeNode], flow, credentials);
            const chn1 = helper.getNode("chn1");

            sinon.stub(helper._RED.util, "parseContextStore").returns({key: "testKey", store: "testStore"});
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
            chn1.error.should.be.calledWith(sinon.match.any, {_msgid: sinon.match.any, payload: true});
        });

        it("should handle invalid message property", async function()
        {
            const flow = [{id: "chn1", type: "chronos-change", name: "change", config: "cn1", rules: [{action: "change", target: {type: "msg", name: "payload"}, type: "set", part: "year", value: 2021}]}, cfgNode];
            fakeMoment.isValid = sinon.stub().returns(false);

            await helper.load([configNode, changeNode], flow, credentials);
            const chn1 = helper.getNode("chn1");

            chn1.receive({payload: "test"});
            chronos.getTimeFrom.should.be.calledWith(sinon.match.any, "test");
            chn1.error.should.be.calledWith(sinon.match.any, {_msgid: sinon.match.any, payload: "test"});
        });

        it("should handle invalid flow variable", async function()
        {
            const flow = [{id: "chn1", type: "chronos-change", name: "change", config: "cn1", rules: [{action: "change", target: {type: "flow", name: "testVariable"}, type: "set", part: "year", value: 2021}]}, cfgNode];
            const ctx = {flow: {}};

            fakeMoment.isValid = sinon.stub().returns(false);

            await helper.load([configNode, changeNode], flow, credentials);
            const chn1 = helper.getNode("chn1");

            sinon.stub(helper._RED.util, "parseContextStore").returns({key: "testKey", store: "testStore"});
            sinon.stub(chn1, "context").returns(ctx);
            ctx.flow.get = sinon.stub().returns("test");

            chn1.receive({payload: null});
            helper._RED.util.parseContextStore.should.be.calledTwice().and.be.calledWith("testVariable");
            chn1.context.should.be.calledOnce();
            ctx.flow.get.should.be.calledWith("testKey", "testStore");
            chronos.getTimeFrom.should.be.calledWith(sinon.match.any, "test");
            chn1.error.should.be.calledWith(sinon.match.any, {_msgid: sinon.match.any, payload: null});
        });

        it("should handle invalid global variable", async function()
        {
            const flow = [{id: "chn1", type: "chronos-change", name: "change", config: "cn1", rules: [{action: "change", target: {type: "global", name: "testVariable"}, type: "set", part: "year", value: 2021}]}, cfgNode];
            const ctx = {global: {}};

            fakeMoment.isValid = sinon.stub().returns(false);

            await helper.load([configNode, changeNode], flow, credentials);
            const chn1 = helper.getNode("chn1");

            sinon.stub(helper._RED.util, "parseContextStore").returns({key: "testKey", store: "testStore"});
            sinon.stub(chn1, "context").returns(ctx);
            ctx.global.get = sinon.stub().returns("test");

            chn1.receive({payload: null});
            helper._RED.util.parseContextStore.should.be.calledTwice().and.be.calledWith("testVariable");
            chn1.context.should.be.calledOnce();
            ctx.global.get.should.be.calledWith("testKey", "testStore");
            chronos.getTimeFrom.should.be.calledWith(sinon.match.any, "test");
            chn1.error.should.be.calledWith(sinon.match.any, {_msgid: sinon.match.any, payload: null});
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