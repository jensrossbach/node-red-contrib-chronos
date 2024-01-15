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
const schedulerNode = require("../nodes/scheduler.js");
const chronos = require("../nodes/common/chronos.js");
const moment = require("moment");
const cronosjs = require("cronosjs");

require("should-sinon");

const cfgNode = {id: "cn1", type: "chronos-config", name: "config"};
const cfgNodeInvalidTZ = {id: "cn1", type: "chronos-config", name: "config", timezone: "invalid"};
const hlpNode = {id: "hn1", type: "helper"};
const credentials = {"cn1": {latitude: "50", longitude: "10"}};

describe("scheduler node", function()
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
        beforeEach(function()
        {
            sinon.useFakeTimers({toFake: ["Date", "setTimeout", "clearTimeout"]});
        });

        afterEach(function()
        {
            helper.unload();
            sinon.restore();
        });

        it("should correctly convert schedule number property", async function()
        {
            const flow = [{id: "sn1", type: "chronos-scheduler", name: "scheduler", config: "cn1", schedule: [{trigger: {type: "time", value: "12:00", offset: 0, random: false}, output: {type: "msg", property: {name: "my_property", type: "num", value: "5.6"}}}]}, cfgNode];

            await helper.load([configNode, schedulerNode], flow, credentials);
            const sn1 = helper.getNode("sn1");
            should.strictEqual(sn1.schedule[0].config.output.property.value, 5.6);
        });

        it("should correctly convert schedule boolean property", async function()
        {
            const flow = [{id: "sn1", type: "chronos-scheduler", name: "scheduler", config: "cn1", schedule: [{trigger: {type: "time", value: "12:00", offset: 0, random: false}, output: {type: "msg", property: {name: "my_property", type: "bool", value: "true"}}}]}, cfgNode];

            await helper.load([configNode, schedulerNode], flow, credentials);
            const sn1 = helper.getNode("sn1");
            should.strictEqual(sn1.schedule[0].config.output.property.value, true);
        });

        it("should load ports", async function()
        {
            const flow = [{id: "sn1", type: "chronos-scheduler", name: "scheduler", config: "cn1", schedule: [{trigger: {type: "time", value: "12:00", offset: 0, random: false}, output: {type: "msg", property: {name: "my_property", type: "string", value: "test"}}, port: 0}]}, cfgNode];

            await helper.load([configNode, schedulerNode], flow, credentials);
            const sn1 = helper.getNode("sn1");
            should.strictEqual(sn1.schedule[0].port, 0);
        });

        it("should load ports (backward compatibility mode)", async function()
        {
            const flow = [{id: "sn1", type: "chronos-scheduler", name: "scheduler", config: "cn1", schedule: [{trigger: {type: "time", value: "12:00", offset: 0, random: false}, output: {type: "msg", property: {name: "my_property", type: "string", value: "test"}, port: 0}}]}, cfgNode];

            await helper.load([configNode, schedulerNode], flow, credentials);
            const sn1 = helper.getNode("sn1");
            should.strictEqual(sn1.schedule[0].port, 0);
        });

        it("should setup multiple ports", async function()
        {
            const flow = [{id: "sn1", type: "chronos-scheduler", name: "scheduler", config: "cn1", schedule: [{trigger: {type: "time", value: "12:00", offset: 0, random: false}, output: {type: "msg", property: {name: "my_property", type: "string", value: "test"}}, port: 0}], multiPort: true, outputs: 1}, cfgNode];

            await helper.load([configNode, schedulerNode], flow, credentials);
            const sn1 = helper.getNode("sn1");
            sn1.should.have.ownProperty("ports").which.is.an.Array().and.has.length(1);
        });

        it("should fail due to missing configuration", async function()
        {
            const flow = [{id: "sn1", type: "chronos-scheduler", name: "scheduler"}];

            await helper.load(schedulerNode, flow, {});
            const sn1 = helper.getNode("sn1");
            sn1.status.should.be.calledOnce();
            sn1.error.should.be.calledOnce().and.calledWith("node-red-contrib-chronos/chronos-config:common.error.noConfig");
        });

        it("should fail due to invalid latitude", async function()
        {
            const flow = [{id: "sn1", type: "chronos-scheduler", name: "scheduler", config: "cn1"}, cfgNode];
            const invalidCredentials = {"cn1": {latitude: "", longitude: "10"}};

            await helper.load([configNode, schedulerNode], flow, invalidCredentials);
            const sn1 = helper.getNode("sn1");
            sn1.status.should.be.calledOnce();
            sn1.error.should.be.calledOnce().and.calledWith("node-red-contrib-chronos/chronos-config:common.error.invalidConfig");
        });

        it("should fail due to invalid longitude", async function()
        {
            const flow = [{id: "sn1", type: "chronos-scheduler", name: "scheduler", config: "cn1"}, cfgNode];
            const invalidCredentials = {"cn1": {latitude: "50", longitude: ""}};

            await helper.load([configNode, schedulerNode], flow, invalidCredentials);
            const sn1 = helper.getNode("sn1");
            sn1.status.should.be.calledOnce();
            sn1.error.should.be.calledOnce().and.calledWith("node-red-contrib-chronos/chronos-config:common.error.invalidConfig");
        });

        it("should fail due to invalid time zone", async function()
        {
            const flow = [{id: "sn1", type: "chronos-scheduler", name: "scheduler", config: "cn1"}, cfgNodeInvalidTZ];

            await helper.load([configNode, schedulerNode], flow, credentials);
            const sn1 = helper.getNode("sn1");
            sn1.status.should.be.calledOnce();
            sn1.error.should.be.calledOnce().and.calledWith("node-red-contrib-chronos/chronos-config:common.error.invalidConfig");
        });

        function testInvalidSchedule(title, flow, numCalls, exp)
        {
            it("should fail due to " + title, async function()
            {
                await helper.load([configNode, schedulerNode], flow, credentials);
                const sn1 = helper.getNode("sn1");
                sn1.status.should.be.called();
                sn1.error.should.have.callCount(numCalls)
                sn1.error.getCall(numCalls-1).calledWith(exp);
            });
        }

        const invalidConfig = "node-red-contrib-chronos/chronos-config:common.error.invalidConfig";
        testInvalidSchedule("missing schedule", [{id: "sn1", type: "chronos-scheduler", name: "scheduler", config: "cn1", schedule: []}, cfgNode], 1, "scheduler.error.noSchedule");
        testInvalidSchedule("invalid schedule user time", [{id: "sn1", type: "chronos-scheduler", name: "scheduler", config: "cn1", schedule: [{trigger: {type: "time", value: "", offset: 0, random: false}, output: {}}]}, cfgNode], 1, invalidConfig);
        testInvalidSchedule("invalid schedule cron table", [{id: "sn1", type: "chronos-scheduler", name: "scheduler", config: "cn1", schedule: [{trigger: {type: "crontab", value: "invalid", offset: 0, random: false}, output: {}}]}, cfgNode], 1, invalidConfig);
        testInvalidSchedule("invalid schedule context variable", [{id: "sn1", type: "chronos-scheduler", name: "scheduler", config: "cn1", schedule: [{trigger: {type: "flow", value: ""}, output: {}}]}, cfgNode], 1, invalidConfig);
        testInvalidSchedule("invalid schedule old config full message", [{id: "sn1", type: "chronos-scheduler", name: "scheduler", config: "cn1", schedule: [{trigger: {type: "time", value: "12:00", offset: 0, random: false}, output: {type: "fullMsg", value: "["}}]}, cfgNode], 1, invalidConfig);
        testInvalidSchedule("invalid schedule old config full message (no object)", [{id: "sn1", type: "chronos-scheduler", name: "scheduler", config: "cn1", schedule: [{trigger: {type: "time", value: "12:00", offset: 0, random: false}, output: {type: "fullMsg", value: "true"}}]}, cfgNode], 1, invalidConfig);
        testInvalidSchedule("invalid schedule JSON full message", [{id: "sn1", type: "chronos-scheduler", name: "scheduler", config: "cn1", schedule: [{trigger: {type: "time", value: "12:00", offset: 0, random: false}, output: {type: "fullMsg", contentType: "json", value: "["}}]}, cfgNode], 1, invalidConfig);
        testInvalidSchedule("invalid schedule JSON full message (no object)", [{id: "sn1", type: "chronos-scheduler", name: "scheduler", config: "cn1", schedule: [{trigger: {type: "time", value: "12:00", offset: 0, random: false}, output: {type: "fullMsg", contentType: "json", value: "true"}}]}, cfgNode], 1, invalidConfig);
        testInvalidSchedule("invalid schedule JSONata full message", [{id: "sn1", type: "chronos-scheduler", name: "scheduler", config: "cn1", schedule: [{trigger: {type: "time", value: "12:00", offset: 0, random: false}, output: {type: "fullMsg", contentType: "jsonata", value: "["}}]}, cfgNode], 2, invalidConfig);
        testInvalidSchedule("empty schedule property name", [{id: "sn1", type: "chronos-scheduler", name: "scheduler", config: "cn1", schedule: [{trigger: {type: "time", value: "12:00", offset: 0, random: false}, output: {type: "msg", property: {name: ""}}}]}, cfgNode], 1, invalidConfig);
        testInvalidSchedule("invalid schedule number property", [{id: "sn1", type: "chronos-scheduler", name: "scheduler", config: "cn1", schedule: [{trigger: {type: "time", value: "12:00", offset: 0, random: false}, output: {type: "msg", property: {name: "my_property", type: "num", value: "invalid"}}}]}, cfgNode], 1, invalidConfig);
        testInvalidSchedule("invalid schedule boolean property", [{id: "sn1", type: "chronos-scheduler", name: "scheduler", config: "cn1", schedule: [{trigger: {type: "time", value: "12:00", offset: 0, random: false}, output: {type: "msg", property: {name: "my_property", type: "bool", value: "invalid"}}}]}, cfgNode], 1, invalidConfig);
        testInvalidSchedule("invalid schedule JSON property", [{id: "sn1", type: "chronos-scheduler", name: "scheduler", config: "cn1", schedule: [{trigger: {type: "time", value: "12:00", offset: 0, random: false}, output: {type: "msg", property: {name: "my_property", type: "json", value: "invalid"}}}]}, cfgNode], 1, invalidConfig);
        testInvalidSchedule("invalid schedule JSONata property", [{id: "sn1", type: "chronos-scheduler", name: "scheduler", config: "cn1", schedule: [{trigger: {type: "time", value: "12:00", offset: 0, random: false}, output: {type: "msg", property: {name: "my_property", type: "jsonata", value: "["}}}]}, cfgNode], 2, invalidConfig);
        testInvalidSchedule("invalid schedule binary buffer property", [{id: "sn1", type: "chronos-scheduler", name: "scheduler", config: "cn1", schedule: [{trigger: {type: "time", value: "12:00", offset: 0, random: false}, output: {type: "msg", property: {name: "my_property", type: "bin", value: "invalid"}}}]}, cfgNode], 1, invalidConfig);
    });

    context("node timers (part 1)", function()
    {
        let clock = null;

        beforeEach(function()
        {
            clock = sinon.useFakeTimers({toFake: ["Date", "setTimeout", "clearTimeout"]});
            sinon.stub(chronos, "getCurrentTime").returns(moment().utc());
            sinon.stub(cronosjs.CronosExpression, "parse").callsFake(function(crontab)
            {
                return cronosjs.CronosExpression.parse.wrappedMethod.apply(this, [crontab, {timezone: "UTC"}]);
            });
        });

        afterEach(function()
        {
            helper.unload();
            sinon.restore();
        });

        function testTriggerAtTime(title, output, propName, propVal)
        {
            it("should trigger at specified time: " + title, function(done)
            {
                const flow = [{id: "sn1", type: "chronos-scheduler", name: "scheduler", config: "cn1", wires: [["hn1"]], schedule: [{trigger: {type: "time", value: "00:01", offset: 0, random: false}, output: output}], outputs: 1}, hlpNode, cfgNode];

                helper.load([configNode, schedulerNode], flow, credentials, function()
                {
                    try
                    {
                        const hn1 = helper.getNode("hn1");

                        hn1.on("input", function(msg)
                        {
                            try
                            {
                                msg.should.have.property(propName, propVal);
                                done();
                            }
                            catch (e)
                            {
                                done(e);
                            }
                        });

                        clock.tick(60000);  // advance clock by 1 min
                    }
                    catch (e)
                    {
                        done(e);
                    }
                });
            });
        }

        testTriggerAtTime("message property", {type: "msg", property: {name: "payload", type: "string", value: "test"}}, "payload", "test");
        testTriggerAtTime("message JSONata property", {type: "msg", property: {name: "payload", type: "jsonata", value: "name & \" fired with config \" & config.name & \" (@\" & config.latitude & \"|\" & config.longitude & \")\""}}, "payload", "scheduler fired with config config (@50|10)");
        testTriggerAtTime("message timestamp property", {type: "msg", property: {name: "payload", type: "date"}}, "payload", 60000);
        testTriggerAtTime("full message (JSON)", {type: "fullMsg", contentType: "json", value: "{\"payload\": \"test\"}"}, "payload", "test");
        testTriggerAtTime("full message (JSONata)", {type: "fullMsg", contentType: "jsonata", value: "{\"payload\": name & \" fired with config \" & config.name & \" (@\" & config.latitude & \"|\" & config.longitude & \")\"}"}, "payload", "scheduler fired with config config (@50|10)");

        it("should trigger at specified time: to context variable", async function()
        {
            const flow = [{id: "sn1", type: "chronos-scheduler", name: "scheduler", config: "cn1", wires: [["hn1"]], schedule: [{trigger: {type: "time", value: "00:01", offset: 0, random: false}, output: {type: "flow", property: {name: "testVariable", type: "string", value: "test"}}}], disabled: true, outputs: 1}, hlpNode, cfgNode];
            const ctx = {flow: {}, global: {}};

            sinon.spy(clock, "setTimeout");
            sinon.stub(helper._RED.util, "parseContextStore").returns({key: "testKey", store: "testStore"});

            await helper.load([configNode, schedulerNode], flow, credentials);
            const sn1 = helper.getNode("sn1");

            sinon.stub(sn1, "context").returns(ctx);
            ctx.flow.set = sinon.spy();
            ctx.global.set = sinon.spy();

            sn1.receive({payload: true});
            clock.tick(60000);  // advance clock by 1 min

            helper._RED.util.parseContextStore.should.be.calledWith("testVariable");
            sn1.context.should.be.calledOnce();
            ctx.flow.set.should.be.calledWith("testKey", "test", "testStore");
        });

        it("should trigger at specified time: to context variable (JSONata expression)", async function()
        {
            const flow = [{id: "sn1", type: "chronos-scheduler", name: "scheduler", config: "cn1", wires: [["hn1"]], schedule: [{trigger: {type: "time", value: "00:01", offset: 0, random: false}, output: {type: "global", property: {name: "testVariable", type: "jsonata", value: "name & \" fired with config \" & config.name & \" (@\" & config.latitude & \"|\" & config.longitude & \")\""}}}], outputs: 1}, hlpNode, cfgNode];
            const ctx = {flow: {}, global: {}};

            sinon.spy(clock, "setTimeout");
            sinon.stub(helper._RED.util, "parseContextStore").returns({key: "testKey", store: "testStore"});

            await helper.load([configNode, schedulerNode], flow, credentials);
            const sn1 = helper.getNode("sn1");

            sinon.stub(sn1, "context").returns(ctx);
            ctx.flow.set = sinon.spy();
            ctx.global.set = sinon.spy();

            sn1.receive({payload: true});
            clock.tick(60000);  // advance clock by 1 min

            helper._RED.util.parseContextStore.should.be.calledWith("testVariable");
            sn1.context.should.be.calledOnce();
            ctx.global.set.should.be.calledWith("testKey", "scheduler fired with config config (@50|10)", "testStore");
        });

        it("should trigger at specified time with offset", function(done)
        {
            const flow = [{id: "sn1", type: "chronos-scheduler", name: "scheduler", config: "cn1", wires: [["hn1"]], schedule: [{trigger: {type: "time", value: "00:01", offset: 1, random: false}, output: {type: "msg", property: {name: "payload", type: "string", value: "test"}}}], outputs: 1}, hlpNode, cfgNode];

            helper.load([configNode, schedulerNode], flow, credentials, function()
            {
                try
                {
                    const hn1 = helper.getNode("hn1");

                    hn1.on("input", function(msg)
                    {
                        try
                        {
                            msg.should.have.property("payload", "test");
                            done();
                        }
                        catch (e)
                        {
                            done(e);
                        }
                    });

                    clock.tick(120000);  // advance clock by 2 mins
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should trigger at specified time with random offset", function(done)
        {
            const flow = [{id: "sn1", type: "chronos-scheduler", name: "scheduler", config: "cn1", wires: [["hn1"]], schedule: [{trigger: {type: "time", value: "00:01", offset: 2, random: true}, output: {type: "msg", property: {name: "payload", type: "string", value: "test"}}}], outputs: 1}, hlpNode, cfgNode];
            sinon.stub(Math, "random").returns(0.5);

            helper.load([configNode, schedulerNode], flow, credentials, function()
            {
                try
                {
                    const hn1 = helper.getNode("hn1");

                    hn1.on("input", function(msg)
                    {
                        try
                        {
                            msg.should.have.property("payload", "test");
                            done();
                        }
                        catch (e)
                        {
                            done(e);
                        }
                    });

                    clock.tick(120000);  // advance clock by 2 mins
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should trigger multiple ports", function(done)
        {
            const flow = [{id: "sn1", type: "chronos-scheduler", name: "scheduler", config: "cn1", wires: [["hn1"], ["hn2"]], schedule: [{trigger: {type: "time", value: "00:01", offset: 0, random: false}, output: {type: "msg", property: {name: "payload", type: "string", value: "port1"}}, port: 0}, {trigger: {type: "time", value: "00:02", offset: 0, random: false}, output: {type: "msg", property: {name: "payload", type: "string", value: "port2"}}, port: 1}], multiPort: true, outputs: 2}, hlpNode, {id: "hn2", type: "helper"}, cfgNode];

            helper.load([configNode, schedulerNode], flow, credentials, function()
            {
                try
                {
                    const hn1 = helper.getNode("hn1");
                    const hn2 = helper.getNode("hn2");

                    hn1.on("input", function(msg)
                    {
                        try
                        {
                            msg.should.have.property("payload", "port1");
                        }
                        catch (e)
                        {
                            done(e);
                        }
                    });

                    hn2.on("input", function(msg)
                    {
                        try
                        {
                            msg.should.have.property("payload", "port2");
                            done();
                        }
                        catch (e)
                        {
                            done(e);
                        }
                    });

                    clock.tick(60000);  // advance clock by 1 min
                    clock.tick(60000);  // advance clock by 1 min
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should schedule a cron table", function(done)
        {
            const flow = [{id: "sn1", type: "chronos-scheduler", name: "scheduler", config: "cn1", wires: [["hn1"]], schedule: [{trigger: {type: "crontab", value: "0 * * * * *", offset: 0, random: false}, output: {type: "msg", property: {name: "payload", type: "string", value: "test"}}}], disabled: false, outputs: 1}, hlpNode, cfgNode];

            helper.load([configNode, schedulerNode], flow, credentials, function()
            {
                try
                {
                    const hn1 = helper.getNode("hn1");

                    hn1.on("input", function(msg)
                    {
                        try
                        {
                            msg.should.have.property("payload", "test");
                            done();
                        }
                        catch (e)
                        {
                            done(e);
                        }
                    });

                    cronosjs.CronosExpression.parse.should.be.calledWith("0 * * * * *");
                    clock.tick(60000);  // advance clock by 1 min
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should not schedule a cron job due to no first trigger", function(done)
        {
            const flow = [{id: "sn1", type: "chronos-scheduler", name: "scheduler", config: "cn1", wires: [["hn1"]], schedule: [{trigger: {type: "crontab", value: "*/2 * * * * *", offset: 0, random: false}, output: {type: "msg", property: {name: "payload", type: "string", value: "test"}}}], disabled: false, outputs: 1}, hlpNode, cfgNode];

            cronosjs.CronosExpression.parse.restore();
            sinon.stub(cronosjs.CronosExpression, "parse").returns({nextDate: () => null});

            helper.load([configNode, schedulerNode], flow, credentials, function()
            {
                try
                {
                    const sn1 = helper.getNode("sn1");
                    const hn1 = helper.getNode("hn1");

                    hn1.on("input", function(msg)
                    {
                        done("unexpected message received");
                    });

                    clock.tick(2000);
                    should(sn1.schedule[0].triggerTime).be.undefined();
                    should(sn1.schedule[0].timer).be.undefined();
                    done();
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should not reschedule a cron job due to no second trigger", function(done)
        {
            const flow = [{id: "sn1", type: "chronos-scheduler", name: "scheduler", config: "cn1", wires: [["hn1"]], schedule: [{trigger: {type: "crontab", value: "0 0 0 1 12 * 1970", offset: 0, random: false}, output: {type: "msg", property: {name: "payload", type: "string", value: "test"}}}], disabled: false, outputs: 1}, hlpNode, cfgNode];

            helper.load([configNode, schedulerNode], flow, credentials, function()
            {
                try
                {
                    const sn1 = helper.getNode("sn1");
                    const hn1 = helper.getNode("hn1");

                    hn1.on("input", function(msg)
                    {
                        try
                        {
                            msg.should.have.property("payload", "test");
                            done();
                        }
                        catch (e)
                        {
                            done(e);
                        }
                    });

                    clock.tick(28857600000);
                    should(sn1.schedule[0].triggerTime).be.undefined();
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should handle time error during setup of timer", async function()
        {
            const flow = [{id: "sn1", type: "chronos-scheduler", name: "scheduler", config: "cn1", schedule: [{trigger: {type: "sun", value: "sunset", offset: 0, random: false}, output: {type: "msg", property: {name: "payload", type: "string", value: "test"}}}], outputs: 1}, cfgNode];

            sinon.stub(chronos, "getTime").throws(function() { return new chronos.TimeError("time error", {type: "sun", value: "sunset"}); });
            await helper.load([configNode, schedulerNode], flow, credentials);
            const sn1 = helper.getNode("sn1");
            sn1.error.should.be.calledWith("time error", {errorDetails: {type: "sun", value: "sunset"}});
        });

        it("should handle other error during setup of timer", async function()
        {
            const flow = [{id: "sn1", type: "chronos-scheduler", name: "scheduler", config: "cn1", schedule: [{trigger: {type: "sun", value: "sunset", offset: 0, random: false}, output: {type: "msg", property: {name: "payload", type: "string", value: "test"}}}], outputs: 1}, cfgNode];

            sinon.stub(chronos, "getTime").throws("error", "error message");
            await helper.load([configNode, schedulerNode], flow, credentials);
            const sn1 = helper.getNode("sn1");
            sn1.error.should.be.calledWith("error message");
        });

        it("should handle time error during timeout handling (invalid JSONata expression)", async function()
        {
            const flow = [{id: "sn1", type: "chronos-scheduler", name: "scheduler", config: "cn1", schedule: [{trigger: {type: "time", value: "00:01", offset: 0, random: false}, output: {type: "msg", property: {name: "payload", type: "jsonata", value: "$invalFunc()"}}}], outputs: 1}, cfgNode];

            await helper.load([configNode, schedulerNode], flow, credentials);
            const sn1 = helper.getNode("sn1");
            clock.tick(60000);  // advance clock by 1 min
            sn1.error.should.be.calledWith("node-red-contrib-chronos/chronos-config:common.error.evaluationFailed", {errorDetails: {event: 1, expression: "$invalFunc()", code: sinon.match.any, description: sinon.match.any, position: sinon.match.any, token: sinon.match.any}});
        });

        it("should handle time error during timeout handling (no object for full message)", async function()
        {
            const flow = [{id: "sn1", type: "chronos-scheduler", name: "scheduler", config: "cn1", schedule: [{trigger: {type: "time", value: "00:01", offset: 0, random: false}, output: {type: "fullMsg", contentType: "jsonata", value: "42"}}], outputs: 1}, cfgNode];

            await helper.load([configNode, schedulerNode], flow, credentials);
            const sn1 = helper.getNode("sn1");
            clock.tick(60000);  // advance clock by 1 min
            sn1.error.should.be.calledWith("scheduler.error.notObject", {errorDetails: {event: 1, expression: "42", result: 42}});
        });

        it("should handle other error during timeout handling", async function()
        {
            const flow = [{id: "sn1", type: "chronos-scheduler", name: "scheduler", config: "cn1", schedule: [{trigger: {type: "time", value: "00:01", offset: 0, random: false}, output: {type: "msg", property: {name: "payload", type: "string", value: "test"}}}], outputs: 1}, cfgNode];

            sinon.stub(helper._RED.util, "setMessageProperty").throws("error", "error message");
            await helper.load([configNode, schedulerNode], flow, credentials);
            const sn1 = helper.getNode("sn1");

            clock.tick(60000);  // advance clock by 1 min
            sn1.error.should.be.calledWith("error message");
        });

        function testValidContextVariable(title, ctxVar)
        {
            it("should trigger from context variable: " + title, async function()
            {
                const flow = [{id: "sn1", type: "chronos-scheduler", name: "scheduler", config: "cn1", wires: [["hn1"]], schedule: [{trigger: {type: "flow", value: "testVariable"}, output: {type: "msg", property: {name: "payload", type: "string", value: "test"}}}], disabled: true, outputs: 1}, hlpNode, cfgNode];
                const ctx = {flow: {}, global: {}};

                sinon.spy(clock, "setTimeout");
                sinon.stub(helper._RED.util, "parseContextStore").returns({key: "testKey", store: "testStore"});

                await helper.load([configNode, schedulerNode], flow, credentials);
                const sn1 = helper.getNode("sn1");

                sinon.stub(sn1, "context").returns(ctx);
                ctx.flow.get = sinon.fake.returns(ctxVar);
                ctx.global.get = sinon.fake.returns(ctxVar);

                sn1.receive({payload: true});

                helper._RED.util.parseContextStore.should.be.calledWith("testVariable");
                sn1.context.should.be.calledOnce();
                ctx.flow.get.should.be.calledWith("testKey", "testStore");
                clock.setTimeout.should.be.calledWith(sinon.match.any, 60000);
            });
        }

        testValidContextVariable("normal", {type: "time", value: "00:01", offset: 0, random: false});
        testValidContextVariable("extended", {trigger: {type: "time", value: "00:01", offset: 0, random: false}, output: {type: "msg", property: {name: "payload", value: "test"}}});

        function testInvalidContextVariable(title, ctxVar)
        {
            it("should fail due to invalid context variable: " + title, async function()
            {
                const flow = [{id: "sn1", type: "chronos-scheduler", name: "scheduler", config: "cn1", wires: [["hn1"]], schedule: [{trigger: {type: "flow", value: "testVariable"}, output: {type: "msg", property: {name: "payload", type: "string", value: "test"}}}], disabled: true, outputs: 1}, hlpNode, cfgNode];
                const ctx = {flow: {}, global: {}};

                sinon.spy(clock, "setTimeout");
                sinon.stub(helper._RED.util, "parseContextStore").returns({key: "testKey", store: "testStore"});

                await helper.load([configNode, schedulerNode], flow, credentials);
                const sn1 = helper.getNode("sn1");

                sinon.stub(sn1, "context").returns(ctx);
                ctx.flow.get = sinon.fake.returns(ctxVar);
                ctx.global.get = sinon.fake.returns(ctxVar);

                sn1.receive({payload: true});

                helper._RED.util.parseContextStore.should.be.calledWith("testVariable");
                sn1.context.should.be.calledOnce();
                ctx.flow.get.should.be.calledWith("testKey", "testStore");
                sn1.error.should.be.calledOnce().and.calledWith("scheduler.error.invalidCtxEvent");
                clock.setTimeout.should.not.be.called();
            });
        }

        testInvalidContextVariable("invalid extended variable", "invalid");
        testInvalidContextVariable("null extended variable", null);
        testInvalidContextVariable("invalid trigger part", {trigger: "invalid"});
        testInvalidContextVariable("null trigger part", {trigger: null});
        testInvalidContextVariable("invalid output part", {trigger: {type: "time", value: "00:01", offset: 0, random: false}, output: "invalid"});
        testInvalidContextVariable("null output part", {trigger: {type: "time", value: "00:01", offset: 0, random: false}, output: null});

        testInvalidContextVariable("trigger type no string", {type: 5, value: "00:01", offset: 0, random: false});
        testInvalidContextVariable("trigger type wrong string", {type: "invalid", value: "00:01", offset: 0, random: false});
        testInvalidContextVariable("trigger value wrong type", {type: "time", value: null, offset: 0, random: false});
        testInvalidContextVariable("trigger value invalid time", {type: "time", value: "12_14", offset: 0, random: false});
        testInvalidContextVariable("trigger value invalid sun position", {type: "sun", value: "invalid", offset: 0, random: false});
        testInvalidContextVariable("trigger value invalid moon position", {type: "moon", value: "invalid", offset: 0, random: false});
        testInvalidContextVariable("trigger value invalid crontab", {type: "crontab", value: "invalid", offset: 0, random: false});
        testInvalidContextVariable("trigger offset wrong type", {type: "time", value: "00:01", offset: "invalid", random: false});
        testInvalidContextVariable("trigger offset too small", {type: "time", value: "00:01", offset: -301, random: false});
        testInvalidContextVariable("trigger offset too large", {type: "time", value: "00:01", offset: 301, random: false});
        testInvalidContextVariable("trigger random wrong type", {type: "time", value: "00:01", offset: 0, random: "invalid"});

        testInvalidContextVariable("output type no string", {trigger: {type: "time", value: "00:01", offset: 0, random: false}, output: {type: 5, property: {name: "payload", value: "test"}}});
        testInvalidContextVariable("output type wrong string", {trigger: {type: "time", value: "00:01", offset: 0, random: false}, output: {type: "invalid", property: {name: "payload", value: "test"}}});
        testInvalidContextVariable("output property invalid type", {trigger: {type: "time", value: "00:01", offset: 0, random: false}, output: {type: "msg", property: "invalid"}});
        testInvalidContextVariable("output property null", {trigger: {type: "time", value: "00:01", offset: 0, random: false}, output: {type: "msg", property: null}});
        testInvalidContextVariable("output property name invalid type", {trigger: {type: "time", value: "00:01", offset: 0, random: false}, output: {type: "msg", property: {name: 5, value: "test"}}});
        testInvalidContextVariable("output property value missing", {trigger: {type: "time", value: "00:01", offset: 0, random: false}, output: {type: "msg", property: {name: "payload"}}});
        testInvalidContextVariable("output property type no date", {trigger: {type: "time", value: "00:01", offset: 0, random: false}, output: {type: "msg", property: {name: "payload", type: "string", value: "test"}}});
        testInvalidContextVariable("output full message invalid type", {trigger: {type: "time", value: "00:01", offset: 0, random: false}, output: {type: "fullMsg", value: "invalid"}});
        testInvalidContextVariable("output full message with content type", {trigger: {type: "time", value: "00:01", offset: 0, random: false}, output: {type: "fullMsg", contentType: "jsonata", value: {payload: "test"}}});
        testInvalidContextVariable("output full message null", {trigger: {type: "time", value: "00:01", offset: 0, random: false}, output: {type: "fullMsg", value: null}});
    });

    context("node timers (part 2)", function()
    {
        let clock = null;

        beforeEach(function()
        {
            clock = sinon.useFakeTimers({now: 3600000, toFake: ["Date", "setTimeout", "clearTimeout"]});
            sinon.stub(chronos, "getCurrentTime").returns(moment().utc());
        });

        afterEach(function()
        {
            helper.unload();
            sinon.restore();
        });

        it("should trigger at specified time on next day", function(done)
        {
            const flow = [{id: "sn1", type: "chronos-scheduler", name: "scheduler", config: "cn1", wires: [["hn1"]], schedule: [{trigger: {type: "time", value: "00:30", offset: 0, random: false}, output: {type: "msg", property: {name: "payload", type: "string", value: "test"}}}], outputs: 1}, hlpNode, cfgNode];

            helper.load([configNode, schedulerNode], flow, credentials, function()
            {
                try
                {
                    const hn1 = helper.getNode("hn1");

                    hn1.on("input", function(msg)
                    {
                        try
                        {
                            msg.should.have.property("payload", "test");
                            done();
                        }
                        catch (e)
                        {
                            done(e);
                        }
                    });

                    clock.tick(84600000);  // advance clock by 23h and 30 mins
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should trigger at specified sun time on next day", function(done)
        {
            const flow = [{id: "sn1", type: "chronos-scheduler", name: "scheduler", config: "cn1", wires: [["hn1"]], schedule: [{trigger: {type: "sun", value: "sunrise", offset: 0, random: false}, output: {type: "msg", property: {name: "payload", type: "string", value: "test"}}}], outputs: 1}, hlpNode, cfgNode];

            sinon.stub(chronos, "getTime")
                        .onFirstCall()
                        .returns(moment.utc(1800000))
                        .onSecondCall()
                        .returns(moment.utc(88200000));

            helper.load([configNode, schedulerNode], flow, credentials, function()
            {
                try
                {
                    const hn1 = helper.getNode("hn1");

                    hn1.on("input", function(msg)
                    {
                        try
                        {
                            msg.should.have.property("payload", "test");
                            done();
                        }
                        catch (e)
                        {
                            done(e);
                        }
                    });

                    clock.tick(84600000);  // advance clock by 23h and 30 mins
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should trigger at specified sun time on next day with offset", function(done)
        {
            const flow = [{id: "sn1", type: "chronos-scheduler", name: "scheduler", config: "cn1", wires: [["hn1"]], schedule: [{trigger: {type: "sun", value: "sunrise", offset: 10, random: false}, output: {type: "msg", property: {name: "payload", type: "string", value: "test"}}}], outputs: 1}, hlpNode, cfgNode];

            sinon.stub(chronos, "getTime")
                        .onFirstCall()
                        .returns(moment.utc(1800000))
                        .onSecondCall()
                        .returns(moment.utc(88200000));

            helper.load([configNode, schedulerNode], flow, credentials, function()
            {
                try
                {
                    const hn1 = helper.getNode("hn1");

                    hn1.on("input", function(msg)
                    {
                        try
                        {
                            msg.should.have.property("payload", "test");
                            done();
                        }
                        catch (e)
                        {
                            done(e);
                        }
                    });

                    clock.tick(85200000);  // advance clock by 23h and 40 mins
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should trigger at specified sun time on next day with random offset", function(done)
        {
            const flow = [{id: "sn1", type: "chronos-scheduler", name: "scheduler", config: "cn1", wires: [["hn1"]], schedule: [{trigger: {type: "sun", value: "sunrise", offset: 20, random: true}, output: {type: "msg", property: {name: "payload", type: "string", value: "test"}}}], outputs: 1}, hlpNode, cfgNode];

            sinon.stub(chronos, "getTime")
                        .onFirstCall()
                        .returns(moment.utc(1800000))
                        .onSecondCall()
                        .returns(moment.utc(88200000));
            sinon.stub(Math, "random").returns(0.5);

            helper.load([configNode, schedulerNode], flow, credentials, function()
            {
                try
                {
                    const hn1 = helper.getNode("hn1");

                    hn1.on("input", function(msg)
                    {
                        try
                        {
                            msg.should.have.property("payload", "test");
                            done();
                        }
                        catch (e)
                        {
                            done(e);
                        }
                    });

                    clock.tick(85200000);  // advance clock by 23h and 40 mins
                }
                catch (e)
                {
                    done(e);
                }
            });
        });
    });

    context("next event port", function()
    {
        let clock = null;
        let curTime = 0;

        beforeEach(function()
        {
            curTime = 0;
            clock = sinon.useFakeTimers({toFake: ["setTimeout", "clearTimeout"]});
            sinon.stub(chronos, "getCurrentTime").callsFake(function() { return moment.utc(curTime); });
        });

        afterEach(function()
        {
            helper.unload();
            sinon.restore();
        });

        it("should emit message on next event port", function(done)
        {
            const flow = [{id: "sn1", type: "chronos-scheduler", name: "scheduler", config: "cn1", wires: [[], ["hn1"]], schedule: [{trigger: {type: "time", value: "00:30", offset: 0, random: false}, output: {type: "msg", property: {name: "payload", type: "string", value: "test"}}}, {trigger: {type: "time", value: "01:30", offset: 0, random: false}, output: {type: "msg", property: {name: "payload", type: "string", value: "test"}}}], nextEventPort: true, outputs: 2}, hlpNode, cfgNode];

            helper.load([configNode, schedulerNode], flow, credentials, function()
            {
                try
                {
                    const hn1 = helper.getNode("hn1");

                    hn1.on("input", function(msg)
                    {
                        try
                        {
                            msg.should.have.property("payload", 1800000);
                            msg.should.have.property("events");
                            msg.events.should.be.an.Array().and.have.length(2);
                            msg.events[0].should.equal(1800000);
                            msg.events[1].should.equal(5400000);

                            done();
                        }
                        catch (e)
                        {
                            done(e);
                        }
                    });
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should emit message on next event port with unavailable trigger time", function(done)
        {
            const flow = [{id: "sn1", type: "chronos-scheduler", name: "scheduler", config: "cn1", wires: [[], ["hn1"]], schedule: [{trigger: {type: "time", value: "00:30", offset: 0, random: false}, output: {type: "msg", property: {name: "payload", type: "string", value: "test"}}}, {trigger: {type: "crontab", value: "* * * * * * 1960"}, output: {type: "msg", property: {name: "payload", type: "string", value: "test"}}}], nextEventPort: true, outputs: 2}, hlpNode, cfgNode];

            helper.load([configNode, schedulerNode], flow, credentials, function()
            {
                try
                {
                    const hn1 = helper.getNode("hn1");

                    hn1.on("input", function(msg)
                    {
                        try
                        {
                            msg.should.have.property("payload", 1800000);
                            msg.should.have.property("events");
                            msg.events.should.be.an.Array().and.have.length(2);
                            msg.events[0].should.equal(1800000);
                            should(msg.events[1]).be.null();

                            done();
                        }
                        catch (e)
                        {
                            done(e);
                        }
                    });
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should emit message on next event port after reset", function(done)
        {
            const flow = [{id: "sn1", type: "chronos-scheduler", name: "scheduler", config: "cn1", wires: [[], ["hn1"]], schedule: [{trigger: {type: "time", value: "00:30", offset: 0, random: false}, output: {type: "msg", property: {name: "payload", type: "string", value: "test"}}}, {trigger: {type: "time", value: "01:30", offset: 0, random: false}, output: {type: "msg", property: {name: "payload", type: "string", value: "test"}}}], nextEventPort: true, outputs: 2}, hlpNode, cfgNode];

            helper.load([configNode, schedulerNode], flow, credentials, function()
            {
                try
                {
                    const sn1 = helper.getNode("sn1");
                    const hn1 = helper.getNode("hn1");
                    numReceived = 0;

                    hn1.on("input", function(msg)
                    {
                        try
                        {
                            msg.should.have.property("payload", 1800000);
                            msg.should.have.property("events");
                            msg.events.should.be.an.Array().and.have.length(2);
                            msg.events[0].should.equal(1800000);
                            msg.events[1].should.equal(5400000);
                            ++numReceived;

                            if (numReceived == 1)
                            {
                                sn1.receive({payload: "reload"});
                            }
                            else if (numReceived == 2)
                            {
                                sn1.receive({payload: ["reload", "reload"]});
                            }
                            else if (numReceived == 3)
                            {
                                done();
                            }
                        }
                        catch (e)
                        {
                            done(e);
                        }
                    });
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should emit message scheduled message and information on next event port", function(done)
        {
            const flow = [{id: "sn1", type: "chronos-scheduler", name: "scheduler", config: "cn1", wires: [["hn1"], ["hn2"]], schedule: [{trigger: {type: "time", value: "00:30", offset: 0, random: false}, output: {type: "msg", property: {name: "payload", type: "string", value: "test1"}}}, {trigger: {type: "time", value: "01:30", offset: 0, random: false}, output: {type: "msg", property: {name: "payload", type: "string", value: "test2"}}}], nextEventPort: true, outputs: 2}, hlpNode, {id: "hn2", type: "helper"}, cfgNode];

            helper.load([configNode, schedulerNode], flow, credentials, function()
            {
                try
                {
                    const hn1 = helper.getNode("hn1");
                    const hn2 = helper.getNode("hn2");
                    numReceived = 0;

                    hn1.on("input", function(msg)
                    {
                        try
                        {
                            msg.should.have.property("payload", "test1");
                            ++numReceived;
                        }
                        catch (e)
                        {
                            done(e);
                        }
                    });

                    hn2.on("input", function(msg)
                    {
                        try
                        {
                            if (numReceived == 0)
                            {
                                msg.should.have.property("payload", 1800000);
                                msg.should.have.property("events");
                                msg.events.should.be.an.Array().and.have.length(2);
                                msg.events[0].should.equal(1800000);
                                msg.events[1].should.equal(5400000);
                                ++numReceived;

                                curTime += 1800000;
                                clock.tick(1800000);  // advance clock by 30 mins
                            }
                            else
                            {
                                msg.should.have.property("payload", 5400000);
                                msg.should.have.property("events");
                                msg.events.should.be.an.Array().and.have.length(2);
                                msg.events[0].should.equal(88200000);
                                msg.events[1].should.equal(5400000);
                                ++numReceived;

                                numReceived.should.equal(3);
                                done();
                            }
                        }
                        catch (e)
                        {
                            done(e);
                        }
                    });
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should emit message scheduled message and information on next event port (multi port)", function(done)
        {
            const flow = [{id: "sn1", type: "chronos-scheduler", name: "scheduler", config: "cn1", wires: [["hn1"], ["hn2"], ["hn3"]], schedule: [{trigger: {type: "time", value: "00:30", offset: 0, random: false}, output: {type: "msg", property: {name: "payload", type: "string", value: "test1"}}, port: 0}, {trigger: {type: "time", value: "01:30", offset: 0, random: false}, output: {type: "msg", property: {name: "payload", type: "string", value: "test2"}}, port: 1}], multiPort: true, nextEventPort: true, outputs: 3}, hlpNode, {id: "hn2", type: "helper"}, {id: "hn3", type: "helper"}, cfgNode];

            helper.load([configNode, schedulerNode], flow, credentials, function()
            {
                try
                {
                    const hn1 = helper.getNode("hn1");
                    const hn2 = helper.getNode("hn2");
                    const hn3 = helper.getNode("hn3");
                    numReceived = 0;

                    hn1.on("input", function(msg)
                    {
                        try
                        {
                            msg.should.have.property("payload", "test1");
                            ++numReceived;
                        }
                        catch (e)
                        {
                            done(e);
                        }
                    });

                    hn2.on("input", function(msg)
                    {
                        try
                        {
                            msg.should.have.property("payload", "test2");
                            ++numReceived;
                        }
                        catch (e)
                        {
                            done(e);
                        }
                    });

                    hn3.on("input", function(msg)
                    {
                        try
                        {
                            if (numReceived == 0)
                            {
                                msg.should.have.property("payload", 1800000);
                                msg.should.have.property("events");
                                msg.events.should.be.an.Array().and.have.length(2);
                                msg.events[0].should.equal(1800000);
                                msg.events[1].should.equal(5400000);
                                ++numReceived;

                                curTime += 1800000;
                                clock.tick(1800000);  // advance clock by 30 mins
                            }
                            else if (numReceived == 2)
                            {
                                msg.should.have.property("payload", 5400000);
                                msg.should.have.property("events");
                                msg.events.should.be.an.Array().and.have.length(2);
                                msg.events[0].should.equal(88200000);
                                msg.events[1].should.equal(5400000);
                                ++numReceived;

                                curTime += 3600000;
                                clock.tick(3600000);  // advance clock by 1 hour
                            }
                            else if (numReceived == 4)
                            {
                                msg.should.have.property("payload", 88200000);
                                msg.should.have.property("events");
                                msg.events.should.be.an.Array().and.have.length(2);
                                msg.events[0].should.equal(88200000);
                                msg.events[1].should.equal(91800000);
                                ++numReceived;

                                numReceived.should.equal(5);
                                done();
                            }
                        }
                        catch (e)
                        {
                            done(e);
                        }
                    });
                }
                catch (e)
                {
                    done(e);
                }
            });
        });
    });

    context("node input", function()
    {
        let clock = null;

        beforeEach(function()
        {
            clock = sinon.useFakeTimers({toFake: ["Date", "setTimeout", "clearTimeout"]});
        });

        afterEach(function()
        {
            helper.unload();
            sinon.restore();
        });

        it("should switch on schedule", async function()
        {
            const flow = [{id: "sn1", type: "chronos-scheduler", name: "scheduler", config: "cn1", schedule: [{trigger: {type: "time", value: "00:01", offset: 0, random: false}, output: {type: "msg", property: {name: "payload", type: "string", value: "test ni"}}}], disabled: true, outputs: 1}, cfgNode];

            await helper.load([configNode, schedulerNode], flow, credentials);
            const sn1 = helper.getNode("sn1");
            sinon.spy(clock, "setTimeout");

            sn1.disabledSchedule.should.be.true();
            sn1.receive({payload: true});
            sn1.disabledSchedule.should.be.false();
            clock.setTimeout.should.be.calledOnce();
        });

        it("should switch off schedule", async function()
        {
            const flow = [{id: "sn1", type: "chronos-scheduler", name: "scheduler", config: "cn1", schedule: [{trigger: {type: "time", value: "00:01", offset: 0, random: false}, output: {type: "msg", property: {name: "payload", type: "string", value: "test"}}}], outputs: 1}, cfgNode];

            await helper.load([configNode, schedulerNode], flow, credentials);
            const sn1 = helper.getNode("sn1");
            sinon.spy(clock, "clearTimeout");

            sn1.disabledSchedule.should.be.false();
            sn1.receive({payload: false});
            sn1.disabledSchedule.should.be.true();
            clock.clearTimeout.should.be.calledOnce();
        });

        it("should switch on schedule partly", async function()
        {
            const flow = [{id: "sn1", type: "chronos-scheduler", name: "scheduler", config: "cn1", schedule: [{trigger: {type: "time", value: "00:01", offset: 0, random: false}, output: {type: "msg", property: {name: "payload", type: "string", value: "test"}}}, {trigger: {type: "time", value: "00:01", offset: 0, random: false}, output: {type: "msg", property: {name: "payload", type: "string", value: "test"}}}], disabled: true, outputs: 1}, cfgNode];

            await helper.load([configNode, schedulerNode], flow, credentials)
            const sn1 = helper.getNode("sn1");
            sinon.spy(clock, "setTimeout");

            sn1.disabledSchedule.should.be.true();
            sn1.receive({payload: [false, true]});
            sn1.disabledSchedule.should.be.false();
            clock.setTimeout.should.be.calledOnce();
        });

        it("should switch on schedule fully", async function()
        {
            const flow = [{id: "sn1", type: "chronos-scheduler", name: "scheduler", config: "cn1", schedule: [{trigger: {type: "time", value: "00:01", offset: 0, random: false}, output: {type: "msg", property: {name: "payload", type: "string", value: "test"}}}, {trigger: {type: "time", value: "00:01", offset: 0, random: false}, output: {type: "msg", property: {name: "payload", type: "string", value: "test"}}}], disabled: true, outputs: 1}, cfgNode];

            await helper.load([configNode, schedulerNode], flow, credentials);
            const sn1 = helper.getNode("sn1");
            sinon.spy(clock, "setTimeout");

            sn1.disabledSchedule.should.be.true();
            sn1.receive({payload: [true, true]});
            sn1.disabledSchedule.should.be.false();
            clock.setTimeout.should.be.calledTwice();
        });

        it("should switch off schedule partly", async function()
        {
            const flow = [{id: "sn1", type: "chronos-scheduler", name: "scheduler", config: "cn1", schedule: [{trigger: {type: "time", value: "00:01", offset: 0, random: false}, output: {type: "msg", property: {name: "payload", type: "string", value: "test"}}}, {trigger: {type: "time", value: "00:01", offset: 0, random: false}, output: {type: "msg", property: {name: "payload", type: "string", value: "test"}}}], outputs: 1}, cfgNode];

            await helper.load([configNode, schedulerNode], flow, credentials);
            const sn1 = helper.getNode("sn1");
            sinon.spy(clock, "clearTimeout");

            sn1.disabledSchedule.should.be.false();
            sn1.receive({payload: [false, true]});
            sn1.disabledSchedule.should.be.false();
            clock.clearTimeout.should.be.calledTwice();
        });

        it("should switch off schedule fully", async function()
        {
            const flow = [{id: "sn1", type: "chronos-scheduler", name: "scheduler", config: "cn1", schedule: [{trigger: {type: "time", value: "00:01", offset: 0, random: false}, output: {type: "msg", property: {name: "payload", type: "string", value: "test"}}}, {trigger: {type: "time", value: "00:01", offset: 0, random: false}, output: {type: "msg", property: {name: "payload", type: "string", value: "test"}}}], outputs: 1}, cfgNode];

            await helper.load([configNode, schedulerNode], flow, credentials);
            const sn1 = helper.getNode("sn1");
            sinon.spy(clock, "clearTimeout");

            sn1.disabledSchedule.should.be.false();
            sn1.receive({payload: [false, false]});
            sn1.disabledSchedule.should.be.true();
            clock.clearTimeout.should.be.calledTwice();
        });

        it("should switch off schedule correctly", async function()
        {
            const flow = [{id: "sn1", type: "chronos-scheduler", name: "scheduler", config: "cn1", schedule: [{trigger: {type: "time", value: "00:01", offset: 0, random: false}, output: {type: "msg", property: {name: "payload", type: "string", value: "test"}}}, {trigger: {type: "crontab", value: "0 * * * *", offset: 0, random: false}, output: {type: "msg", property: {name: "payload", type: "string", value: "test"}}}], outputs: 1}, cfgNode];

            await helper.load([configNode, schedulerNode], flow, credentials);
            const sn1 = helper.getNode("sn1");
            const clr = sinon.spy(clock, "clearTimeout");
            const ctstop = sinon.spy(sn1.schedule[1].timer, "stop");
            const tmr = sn1.schedule[0].timer;

            sn1.receive({payload: [false, null]});
            clr.should.be.calledWith(tmr);
            ctstop.should.not.be.called();

            clr.resetHistory();
            sn1.receive({payload: [null, false]});
            clr.should.not.be.calledWith(tmr);
            ctstop.should.be.called();
        });

        it("should toggle schedule (to on)", async function()
        {
            const flow = [{id: "sn1", type: "chronos-scheduler", name: "scheduler", config: "cn1", schedule: [{trigger: {type: "time", value: "00:01", offset: 0, random: false}, output: {type: "msg", property: {name: "payload", type: "string", value: "test"}}}, {trigger: {type: "time", value: "00:01", offset: 0, random: false}, output: {type: "msg", property: {name: "payload", type: "string", value: "test"}}}], outputs: 1}, cfgNode];

            await helper.load([configNode, schedulerNode], flow, credentials);
            const sn1 = helper.getNode("sn1");
            sinon.spy(clock, "clearTimeout");

            sn1.disabledSchedule.should.be.false();
            sn1.receive({payload: "toggle"});
            sn1.disabledSchedule.should.be.true();
            clock.clearTimeout.should.be.calledTwice();
        });

        it("should toggle schedule (to off)", async function()
        {
            const flow = [{id: "sn1", type: "chronos-scheduler", name: "scheduler", config: "cn1", schedule: [{trigger: {type: "time", value: "00:01", offset: 0, random: false}, output: {type: "msg", property: {name: "payload", type: "string", value: "test"}}}, {trigger: {type: "time", value: "00:01", offset: 0, random: false}, output: {type: "msg", property: {name: "payload", type: "string", value: "test"}}}], disabled: true, outputs: 1}, cfgNode];

            await helper.load([configNode, schedulerNode], flow, credentials);
            const sn1 = helper.getNode("sn1");
            sinon.spy(clock, "setTimeout");

            sn1.disabledSchedule.should.be.true();
            sn1.receive({payload: "toggle"});
            sn1.disabledSchedule.should.be.false();
            clock.setTimeout.should.be.calledTwice();
        });

        it("should toggle schedule event (to off)", async function()
        {
            const flow = [{id: "sn1", type: "chronos-scheduler", name: "scheduler", config: "cn1", schedule: [{trigger: {type: "time", value: "00:01", offset: 0, random: false}, output: {type: "msg", property: {name: "payload", type: "string", value: "test"}}}, {trigger: {type: "time", value: "00:01", offset: 0, random: false}, output: {type: "msg", property: {name: "payload", type: "string", value: "test"}}}], outputs: 1}, cfgNode];

            await helper.load([configNode, schedulerNode], flow, credentials);
            const sn1 = helper.getNode("sn1");
            sinon.spy(clock, "clearTimeout");

            sn1.disabledSchedule.should.be.false();
            sn1.receive({payload: ["toggle", null]});
            sn1.disabledSchedule.should.be.false();
            clock.clearTimeout.should.be.calledOnce();
        });

        it("should toggle schedule event (to on)", async function()
        {
            const flow = [{id: "sn1", type: "chronos-scheduler", name: "scheduler", config: "cn1", schedule: [{trigger: {type: "time", value: "00:01", offset: 0, random: false}, output: {type: "msg", property: {name: "payload", type: "string", value: "test"}}}, {trigger: {type: "time", value: "00:01", offset: 0, random: false}, output: {type: "msg", property: {name: "payload", type: "string", value: "test"}}}], disabled: true, outputs: 1}, cfgNode];

            await helper.load([configNode, schedulerNode], flow, credentials);
            const sn1 = helper.getNode("sn1");
            sinon.spy(clock, "setTimeout");

            sn1.disabledSchedule.should.be.true();
            sn1.receive({payload: [null, "toggle"]});
            sn1.disabledSchedule.should.be.false();
            clock.setTimeout.should.be.calledOnce();
        });

        it("should reload schedule", async function()
        {
            const flow = [{id: "sn1", type: "chronos-scheduler", name: "scheduler", config: "cn1", schedule: [{trigger: {type: "time", value: "00:01", offset: 0, random: false}, output: {type: "msg", property: {name: "payload", type: "string", value: "test"}}}, {trigger: {type: "time", value: "00:01", offset: 0, random: false}, output: {type: "msg", property: {name: "payload", type: "string", value: "test"}}}], outputs: 1}, cfgNode];

            await helper.load([configNode, schedulerNode], flow, credentials);
            const sn1 = helper.getNode("sn1");
            sinon.spy(clock, "setTimeout");
            sinon.spy(clock, "clearTimeout");

            sn1.disabledSchedule.should.be.false();
            sn1.receive({payload: "reload"});
            sn1.disabledSchedule.should.be.false();
            clock.clearTimeout.should.be.calledTwice();
            clock.setTimeout.should.be.calledTwice();
        });

        it("should not reload schedule", async function()
        {
            const flow = [{id: "sn1", type: "chronos-scheduler", name: "scheduler", config: "cn1", schedule: [{trigger: {type: "time", value: "00:01", offset: 0, random: false}, output: {type: "msg", property: {name: "payload", type: "string", value: "test"}}}, {trigger: {type: "time", value: "00:01", offset: 0, random: false}, output: {type: "msg", property: {name: "payload", type: "string", value: "test"}}}], disabled: true, outputs: 1}, cfgNode];

            await helper.load([configNode, schedulerNode], flow, credentials);
            const sn1 = helper.getNode("sn1");
            sinon.spy(clock, "setTimeout");
            sinon.spy(clock, "clearTimeout");

            sn1.disabledSchedule.should.be.true();
            sn1.receive({payload: "reload"});
            sn1.disabledSchedule.should.be.true();
            clock.clearTimeout.should.not.be.called();
            clock.setTimeout.should.not.be.called();
        });

        it("should reload schedule event", async function()
        {
            const flow = [{id: "sn1", type: "chronos-scheduler", name: "scheduler", config: "cn1", schedule: [{trigger: {type: "time", value: "00:01", offset: 0, random: false}, output: {type: "msg", property: {name: "payload", type: "string", value: "test"}}}, {trigger: {type: "time", value: "00:01", offset: 0, random: false}, output: {type: "msg", property: {name: "payload", type: "string", value: "test"}}}], outputs: 1}, cfgNode];

            await helper.load([configNode, schedulerNode], flow, credentials);
            const sn1 = helper.getNode("sn1");
            sinon.spy(clock, "setTimeout");
            sinon.spy(clock, "clearTimeout");

            sn1.disabledSchedule.should.be.false();
            sn1.receive({payload: ["reload", null]});
            sn1.disabledSchedule.should.be.false();
            clock.clearTimeout.should.be.calledOnce();
            clock.setTimeout.should.be.calledOnce();
        });

        it("should trigger schedule", function(done)
        {
            const flow = [{id: "sn1", type: "chronos-scheduler", name: "scheduler", config: "cn1", wires: [["hn1"]], schedule: [{trigger: {type: "time", value: "00:01", offset: 0, random: false}, output: {type: "msg", property: {name: "payload", type: "string", value: "test1"}}}, {trigger: {type: "time", value: "00:01", offset: 0, random: false}, output: {type: "msg", property: {name: "payload", type: "string", value: "test2"}}}], outputs: 1}, hlpNode, cfgNode];

            helper.load([configNode, schedulerNode], flow, credentials, function()
            {
                try
                {
                    const sn1 = helper.getNode("sn1");
                    const hn1 = helper.getNode("hn1");
                    let count = 0;

                    hn1.on("input", function(msg)
                    {
                        try
                        {
                            count++;
                            msg.should.have.property("payload", "test" + count);
                            if (count == 2)
                            {
                                done();
                            }
                        }
                        catch (e)
                        {
                            done(e);
                        }
                    });

                    sn1.receive({payload: "trigger"});
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should not trigger disabled schedule", function(done)
        {
            const flow = [{id: "sn1", type: "chronos-scheduler", name: "scheduler", config: "cn1", wires: [["hn1"]], schedule: [{trigger: {type: "time", value: "00:01", offset: 0, random: false}, output: {type: "msg", property: {name: "payload", type: "string", value: "test1"}}}, {trigger: {type: "time", value: "00:01", offset: 0, random: false}, output: {type: "msg", property: {name: "payload", type: "string", value: "test2"}}}], disabled: true, outputs: 1}, hlpNode, cfgNode];

            helper.load([configNode, schedulerNode], flow, credentials, function()
            {
                try
                {
                    const sn1 = helper.getNode("sn1");
                    const hn1 = helper.getNode("hn1");

                    hn1.on("input", function(msg)
                    {
                        done("unexpected message received");
                    });

                    sn1.receive({payload: "trigger"});
                    done();
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should force trigger disabled schedule", function(done)
        {
            const flow = [{id: "sn1", type: "chronos-scheduler", name: "scheduler", config: "cn1", wires: [["hn1"]], schedule: [{trigger: {type: "time", value: "00:01", offset: 0, random: false}, output: {type: "msg", property: {name: "payload", type: "string", value: "test1"}}}, {trigger: {type: "time", value: "00:01", offset: 0, random: false}, output: {type: "msg", property: {name: "payload", type: "string", value: "test2"}}}], disabled: true, outputs: 1}, hlpNode, cfgNode];

            helper.load([configNode, schedulerNode], flow, credentials, function()
            {
                try
                {
                    const sn1 = helper.getNode("sn1");
                    const hn1 = helper.getNode("hn1");
                    let count = 0;

                    hn1.on("input", function(msg)
                    {
                        try
                        {
                            count++;
                            msg.should.have.property("payload", "test" + count);
                            if (count == 2)
                            {
                                done();
                            }
                        }
                        catch (e)
                        {
                            done(e);
                        }
                    });

                    sn1.receive({payload: "trigger:forced"});
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should trigger schedule event", function(done)
        {
            const flow = [{id: "sn1", type: "chronos-scheduler", name: "scheduler", config: "cn1", wires: [["hn1"]], schedule: [{trigger: {type: "time", value: "00:01", offset: 0, random: false}, output: {type: "msg", property: {name: "payload", type: "string", value: "test1"}}}, {trigger: {type: "time", value: "00:01", offset: 0, random: false}, output: {type: "msg", property: {name: "payload", type: "string", value: "test2"}}}], outputs: 1}, hlpNode, cfgNode];

            helper.load([configNode, schedulerNode], flow, credentials, function()
            {
                try
                {
                    const sn1 = helper.getNode("sn1");
                    const hn1 = helper.getNode("hn1");
                    let count = 0;

                    hn1.on("input", function(msg)
                    {
                        try
                        {
                            count++;
                            if (count == 1)
                            {
                                msg.should.have.property("payload", "test1");
                            }
                            else if (count > 1)
                            {
                                done("unexpected message received");
                            }
                        }
                        catch (e)
                        {
                            done(e);
                        }
                    });

                    sn1.receive({payload: ["trigger", null]});
                    done();
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should not trigger disabled schedule events", function(done)
        {
            const flow = [{id: "sn1", type: "chronos-scheduler", name: "scheduler", config: "cn1", wires: [["hn1"]], schedule: [{trigger: {type: "time", value: "00:01", offset: 0, random: false}, output: {type: "msg", property: {name: "payload", type: "string", value: "test1"}}}, {trigger: {type: "time", value: "00:01", offset: 0, random: false}, output: {type: "msg", property: {name: "payload", type: "string", value: "test2"}}}], disabled: true, outputs: 1}, hlpNode, cfgNode];

            helper.load([configNode, schedulerNode], flow, credentials, function()
            {
                try
                {
                    const sn1 = helper.getNode("sn1");
                    const hn1 = helper.getNode("hn1");

                    hn1.on("input", function(msg)
                    {
                        done("unexpected message received");
                    });

                    sn1.receive({payload: ["trigger", null]});
                    done();
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should force trigger disabled schedule event", function(done)
        {
            const flow = [{id: "sn1", type: "chronos-scheduler", name: "scheduler", config: "cn1", wires: [["hn1"]], schedule: [{trigger: {type: "time", value: "00:01", offset: 0, random: false}, output: {type: "msg", property: {name: "payload", type: "string", value: "test1"}}}, {trigger: {type: "time", value: "00:01", offset: 0, random: false}, output: {type: "msg", property: {name: "payload", type: "string", value: "test2"}}}], disabled: true, outputs: 1}, hlpNode, cfgNode];

            helper.load([configNode, schedulerNode], flow, credentials, function()
            {
                try
                {
                    const sn1 = helper.getNode("sn1");
                    const hn1 = helper.getNode("hn1");
                    let count = 0;

                    hn1.on("input", function(msg)
                    {
                        try
                        {
                            count++;
                            if (count == 1)
                            {
                                msg.should.have.property("payload", "test1");
                            }
                            else if (count > 1)
                            {
                                done("unexpected message received");
                            }
                        }
                        catch (e)
                        {
                            done(e);
                        }
                    });

                    sn1.receive({payload: ["trigger:forced", null]});
                    done();
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should override schedule event (trigger only)", async function()
        {
            const orig = {type: "time", value: "00:01", offset: 0, random: false};
            const override = {type: "time", value: "11:11", offset: 11, random: true};
            const flow = [{id: "sn1", type: "chronos-scheduler", name: "scheduler", config: "cn1", schedule: [{trigger: orig, output: {type: "msg", property: {name: "payload", type: "string", value: "test"}}}, {trigger: {type: "time", value: "00:01", offset: 0, random: false}, output: {type: "msg", property: {name: "payload", type: "string", value: "test"}}}], outputs: 1}, cfgNode];

            await helper.load([configNode, schedulerNode], flow, credentials);
            const sn1 = helper.getNode("sn1");
            sinon.spy(clock, "setTimeout");
            sinon.spy(clock, "clearTimeout");

            sn1.disabledSchedule.should.be.false();
            sn1.receive({payload: [override, null]});

            sn1.schedule[0].config.trigger.should.be.eql(override);
            clock.clearTimeout.should.be.calledOnce();
            clock.setTimeout.should.be.calledOnce();

            clock.clearTimeout.resetHistory();
            clock.setTimeout.resetHistory();
            sn1.receive({payload: ["reload", null]});

            sn1.schedule[0].config.trigger.should.be.eql(orig);
            clock.clearTimeout.should.be.calledOnce();
            clock.setTimeout.should.be.calledOnce();
        });

        it("should override schedule event (trigger and output)", async function()
        {
            const orig = {trigger: {type: "time", value: "00:01", offset: 0, random: false}, output: {type: "msg", property: {name: "payload", type: "string", value: "test"}}};
            const override = {trigger: {type: "time", value: "11:11", offset: 11, random: true}, output: {type: "flow", property: {name: "var1", value: "overridden"}}};
            const flow = [{id: "sn1", type: "chronos-scheduler", name: "scheduler", config: "cn1", schedule: [orig, {trigger: {type: "time", value: "00:01", offset: 0, random: false}, output: {type: "msg", property: {name: "payload", type: "string", value: "test"}}}], outputs: 1}, cfgNode];

            await helper.load([configNode, schedulerNode], flow, credentials);
            const sn1 = helper.getNode("sn1");
            sinon.spy(clock, "setTimeout");
            sinon.spy(clock, "clearTimeout");

            sn1.disabledSchedule.should.be.false();
            sn1.receive({payload: [override, null]});

            sn1.schedule[0].config.should.be.eql(override);
            clock.clearTimeout.should.be.calledOnce();
            clock.setTimeout.should.be.calledOnce();

            clock.clearTimeout.resetHistory();
            clock.setTimeout.resetHistory();
            sn1.receive({payload: ["reload", null]});

            sn1.schedule[0].config.should.be.eql(orig);
            clock.clearTimeout.should.be.calledOnce();
            clock.setTimeout.should.be.calledOnce();
        });

        it("should handle invalid schedule event override", async function()
        {
            const flow = [{id: "sn1", type: "chronos-scheduler", name: "scheduler", config: "cn1", schedule: [{trigger: {type: "time", value: "00:01", offset: 0, random: false}, output: {type: "msg", property: {name: "payload", type: "string", value: "test"}}}, {trigger: {type: "time", value: "00:01", offset: 0, random: false}, output: {type: "msg", property: {name: "payload", type: "string", value: "test"}}}], outputs: 1}, cfgNode];

            await helper.load([configNode, schedulerNode], flow, credentials);
            const sn1 = helper.getNode("sn1");
            sinon.spy(clock, "setTimeout");
            sinon.spy(clock, "clearTimeout");

            sn1.disabledSchedule.should.be.false();
            sn1.receive({payload: [{}, null]});

            sn1.error.should.be.calledOnce().and.calledWith("scheduler.error.invalidMsgEvent");
            clock.setTimeout.should.not.be.called();
            clock.clearTimeout.should.not.be.called();
        });

        it("should handle invalid input message", async function()
        {
            const flow = [{id: "sn1", type: "chronos-scheduler", name: "scheduler", config: "cn1", schedule: [{trigger: {type: "time", value: "00:01", offset: 0, random: false}, output: {type: "msg", property: {name: "payload", type: "string", value: "test"}}}, {trigger: {type: "time", value: "00:01", offset: 0, random: false}, output: {type: "msg", property: {name: "payload", type: "string", value: "test"}}}], disabled: true, outputs: 1}, cfgNode];

            await helper.load([configNode, schedulerNode], flow, credentials);
            const sn1 = helper.getNode("sn1");
            sinon.spy(clock, "setTimeout");
            sinon.spy(clock, "clearTimeout");

            sn1.receive({payload: null});
            clock.setTimeout.should.not.be.called();
            clock.clearTimeout.should.not.be.called();
        });
    });
});
