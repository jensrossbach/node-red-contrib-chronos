/*
 * Copyright (c) 2023 Jens-Uwe Rossbach
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
const delayNode = require("../nodes/delay.js");
const chronos = require("../nodes/common/chronos.js");
const moment = require("moment");

require("should-sinon");

const cfgNode = {id: "cn1", type: "chronos-config", name: "config"};
const cfgNodeInvalidTZ = {id: "cn1", type: "chronos-config", name: "config", timezone: "invalid"};
const hlpNode = {id: "hn1", type: "helper"};
const credentials = {"cn1": {latitude: "50", longitude: "10"}};

describe("delay node", function()
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

        it("should correctly load", async function()
        {
            const flow = [{id: "dn1", type: "chronos-delay", name: "delay", config: "cn1", delayType: "randomDuration", fixedDuration: 13, randomDuration1: 42, randomDuration2: 76, fixedDurationUnit: "days", randomDurationUnit: "minutes", randomizerMillis: true, whenType: "time", whenValue: "12:00", offset: 0, random: false, expression: "myExpression", preserveCtrlProps: true, ignoreCtrlProps: true}, cfgNode];

            await helper.load([configNode, delayNode], flow, credentials);
            const dn1 = helper.getNode("dn1");
            dn1.status.should.be.calledOnce();
            dn1.should.have.property("name", "delay");
            dn1.should.have.property("delayType", "randomDuration");
            dn1.should.have.property("fixedDuration", 13);
            dn1.should.have.property("randomDuration1", 42);
            dn1.should.have.property("randomDuration2", 76);
            dn1.should.have.property("fixedDurationUnit", "days");
            dn1.should.have.property("randomDurationUnit", "minutes");
            dn1.should.have.property("randomizerMillis", true);
            dn1.should.have.property("whenType", "time");
            dn1.should.have.property("whenValue", "12:00");
            dn1.should.have.property("offset", 0);
            dn1.should.have.property("random", false);
            dn1.should.have.property("expression", "myExpression");
            dn1.should.have.property("preserveCtrlProps", true);
            dn1.should.have.property("ignoreCtrlProps", true);
        });

        it("should backward compatibly load", async function()
        {
            const flow = [{id: "dn1", type: "chronos-delay", name: "delay", config: "cn1", whenType: "time", whenValue: "12:00", offset: 0, random: false, preserveCtrlProps: true}, cfgNode];

            await helper.load([configNode, delayNode], flow, credentials);
            const dn1 = helper.getNode("dn1");
            dn1.status.should.be.calledOnce();
            dn1.should.have.property("name", "delay");
            dn1.should.have.property("delayType", "pointInTime");
            dn1.should.have.property("fixedDuration", 1);
            dn1.should.have.property("randomDuration1", 1);
            dn1.should.have.property("randomDuration2", 5);
            dn1.should.have.property("fixedDurationUnit", "seconds");
            dn1.should.have.property("randomDurationUnit", "seconds");
            dn1.should.have.property("randomizerMillis", false);
            dn1.should.have.property("whenType", "time");
            dn1.should.have.property("whenValue", "12:00");
            dn1.should.have.property("offset", 0);
            dn1.should.have.property("random", false);
            dn1.should.have.property("expression", "");
            dn1.should.have.property("preserveCtrlProps", true);
            dn1.should.have.property("ignoreCtrlProps", undefined);
        });

        it("should fail due to missing configuration", async function()
        {
            const flow = [{id: "dn1", type: "chronos-delay", name: "delay"}];

            await helper.load(delayNode, flow, {});
            const dn1 = helper.getNode("dn1");
            dn1.status.should.be.calledOnce();
            dn1.error.should.be.calledOnce().and.calledWith("node-red-contrib-chronos/chronos-config:common.error.noConfig");
        });

        it("should fail due to invalid latitude", async function()
        {
            const flow = [{id: "dn1", type: "chronos-delay", name: "delay", config: "cn1"}, cfgNode];
            const invalidCredentials = {"cn1": {latitude: "", longitude: "10"}};

            await helper.load([configNode, delayNode], flow, invalidCredentials);
            const dn1 = helper.getNode("dn1");
            dn1.status.should.be.calledOnce();
            dn1.error.should.be.calledOnce().and.calledWith("node-red-contrib-chronos/chronos-config:common.error.invalidConfig");
        });

        it("should fail due to invalid longitude", async function()
        {
            const flow = [{id: "dn1", type: "chronos-delay", name: "delay", config: "cn1"}, cfgNode];
            const invalidCredentials = {"cn1": {latitude: "50", longitude: ""}};

            await helper.load([configNode, delayNode], flow, invalidCredentials);
            const dn1 = helper.getNode("dn1");
            dn1.status.should.be.calledOnce();
            dn1.error.should.be.calledOnce().and.calledWith("node-red-contrib-chronos/chronos-config:common.error.invalidConfig");
        });

        it("should fail due to invalid time zone", async function()
        {
            const flow = [{id: "dn1", type: "chronos-delay", name: "delay", config: "cn1"}, cfgNodeInvalidTZ];

            await helper.load([configNode, delayNode], flow, credentials);
            const dn1 = helper.getNode("dn1");
            dn1.status.should.be.calledOnce();
            dn1.error.should.be.calledOnce().and.calledWith("node-red-contrib-chronos/chronos-config:common.error.invalidConfig");
        });

        it("should fail due to invalid when time", async function()
        {
            const flow = [{id: "dn1", type: "chronos-delay", name: "delay", config: "cn1", delayType: "pointInTime", whenType: "time", whenValue: "invalid", offset: 0, random: false, preserveCtrlProps: true}, cfgNode];

            await helper.load([configNode, delayNode], flow, credentials);
            const dn1 = helper.getNode("dn1");
            dn1.status.should.be.calledTwice();
            dn1.error.should.be.calledOnce().and.calledWith("node-red-contrib-chronos/chronos-config:common.error.invalidConfig");
        });
    });

    context("duration delay", function()
    {
        let clock = null;

        beforeEach(function()
        {
            clock = sinon.useFakeTimers({toFake: ["Date", "setTimeout", "clearTimeout"]});
            sinon.stub(chronos, "getCurrentTime").returns(moment().utc());
        });

        afterEach(function()
        {
            helper.unload();
            sinon.restore();
        });

        it("should delay message for fixed duration", function(done)
        {
            const flow = [{id: "dn1", type: "chronos-delay", name: "delay", config: "cn1", wires: [["hn1"]], delayType: "fixedDuration", fixedDuration: 3, fixedDurationUnit: "days", preserveCtrlProps: true}, hlpNode, cfgNode];
            sinon.spy(clock, "setTimeout");

            helper.load([configNode, delayNode], flow, credentials, function()
            {
                try
                {
                    const dn1 = helper.getNode("dn1");
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

                    dn1.receive({payload: "test"});
                    clock.setTimeout.should.be.calledWith(sinon.match.any, 259200000);
                    dn1.msgQueue.should.have.length(1);
                    clock.tick(259200000);  // advance clock by 3 days
                    dn1.msgQueue.should.have.length(0);
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should delay message for random duration", function(done)
        {
            const flow = [{id: "dn1", type: "chronos-delay", name: "delay", config: "cn1", wires: [["hn1"]], delayType: "randomDuration", randomDuration1: 1, randomDuration2: 6, randomDurationUnit: "seconds", randomizerMillis: false, preserveCtrlProps: true}, hlpNode, cfgNode];
            sinon.spy(clock, "setTimeout");
            sinon.stub(Math, "random").returns(0.5);

            helper.load([configNode, delayNode], flow, credentials, function()
            {
                try
                {
                    const dn1 = helper.getNode("dn1");
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

                    dn1.receive({payload: "test"});
                    clock.setTimeout.should.be.calledWith(sinon.match.any, 4000);
                    dn1.msgQueue.should.have.length(1);
                    clock.tick(4000);  // advance clock by 4 seconds
                    dn1.msgQueue.should.have.length(0);
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should delay message for random duration (flipped boundaries)", function(done)
        {
            const flow = [{id: "dn1", type: "chronos-delay", name: "delay", config: "cn1", wires: [["hn1"]], delayType: "randomDuration", randomDuration1: 6, randomDuration2: 1, randomDurationUnit: "minutes", randomizerMillis: false, preserveCtrlProps: true}, hlpNode, cfgNode];
            sinon.spy(clock, "setTimeout");
            sinon.stub(Math, "random").returns(0.5);

            helper.load([configNode, delayNode], flow, credentials, function()
            {
                try
                {
                    const dn1 = helper.getNode("dn1");
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

                    dn1.receive({payload: "test"});
                    clock.setTimeout.should.be.calledWith(sinon.match.any, 240000);
                    dn1.msgQueue.should.have.length(1);
                    clock.tick(240000);  // advance clock by 4 minutes
                    dn1.msgQueue.should.have.length(0);
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should delay message for random duration (equal boundaries)", function(done)
        {
            const flow = [{id: "dn1", type: "chronos-delay", name: "delay", config: "cn1", wires: [["hn1"]], delayType: "randomDuration", randomDuration1: 6, randomDuration2: 6, randomDurationUnit: "hours", randomizerMillis: false, preserveCtrlProps: true}, hlpNode, cfgNode];
            sinon.spy(clock, "setTimeout");
            sinon.stub(Math, "random").returns(0.5);

            helper.load([configNode, delayNode], flow, credentials, function()
            {
                try
                {
                    const dn1 = helper.getNode("dn1");
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

                    dn1.receive({payload: "test"});
                    clock.setTimeout.should.be.calledWith(sinon.match.any, 21600000);
                    dn1.msgQueue.should.have.length(1);
                    clock.tick(21600000);  // advance clock by 6 hours
                    dn1.msgQueue.should.have.length(0);
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should delay message for random duration (milli precision)", function(done)
        {
            const flow = [{id: "dn1", type: "chronos-delay", name: "delay", config: "cn1", wires: [["hn1"]], delayType: "randomDuration", randomDuration1: 1, randomDuration2: 6, randomDurationUnit: "seconds", randomizerMillis: true, preserveCtrlProps: true}, hlpNode, cfgNode];
            sinon.spy(clock, "setTimeout");
            sinon.stub(Math, "random").returns(0.5);

            helper.load([configNode, delayNode], flow, credentials, function()
            {
                try
                {
                    const dn1 = helper.getNode("dn1");
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

                    dn1.receive({payload: "test"});
                    clock.setTimeout.should.be.calledWith(sinon.match.any, 3500);
                    dn1.msgQueue.should.have.length(1);
                    clock.tick(3500);  // advance clock by 3500 milliseconds
                    dn1.msgQueue.should.have.length(0);
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should delay message for random duration (milli precision, flipped boundaries)", function(done)
        {
            const flow = [{id: "dn1", type: "chronos-delay", name: "delay", config: "cn1", wires: [["hn1"]], delayType: "randomDuration", randomDuration1: 6, randomDuration2: 1, randomDurationUnit: "seconds", randomizerMillis: true, preserveCtrlProps: true}, hlpNode, cfgNode];
            sinon.spy(clock, "setTimeout");
            sinon.stub(Math, "random").returns(0.5);

            helper.load([configNode, delayNode], flow, credentials, function()
            {
                try
                {
                    const dn1 = helper.getNode("dn1");
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

                    dn1.receive({payload: "test"});
                    clock.setTimeout.should.be.calledWith(sinon.match.any, 3500);
                    dn1.msgQueue.should.have.length(1);
                    clock.tick(3500);  // advance clock by 3500 milliseconds
                    dn1.msgQueue.should.have.length(0);
                }
                catch (e)
                {
                    done(e);
                }
            });
        });
    });

    context("time point delay (part 1)", function()
    {
        let clock = null;

        beforeEach(function()
        {
            clock = sinon.useFakeTimers({toFake: ["Date", "setTimeout", "clearTimeout"]});
            sinon.stub(chronos, "getCurrentTime").returns(moment().utc());
        });

        afterEach(function()
        {
            helper.unload();
            sinon.restore();
        });

        it("should delay message until specific time", function(done)
        {
            const flow = [{id: "dn1", type: "chronos-delay", name: "delay", config: "cn1", wires: [["hn1"]], delayType: "pointInTime", whenType: "time", whenValue: "00:01", offset: 0, random: false, preserveCtrlProps: true}, hlpNode, cfgNode];
            sinon.spy(clock, "setTimeout");

            helper.load([configNode, delayNode], flow, credentials, function()
            {
                try
                {
                    const dn1 = helper.getNode("dn1");
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

                    dn1.receive({payload: "test"});
                    clock.setTimeout.should.be.calledWith(sinon.match.any, 60000);
                    dn1.msgQueue.should.have.length(1);
                    clock.tick(60000);  // advance clock by 1 min
                    dn1.msgQueue.should.have.length(0);
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should trigger at specified time with offset", function(done)
        {
            const flow = [{id: "dn1", type: "chronos-delay", name: "delay", config: "cn1", wires: [["hn1"]], whenType: "time", delayType: "pointInTime", whenValue: "00:01", offset: 1, random: false, preserveCtrlProps: true}, hlpNode, cfgNode];
            sinon.spy(clock, "setTimeout");

            helper.load([configNode, delayNode], flow, credentials, function()
            {
                try
                {
                    const dn1 = helper.getNode("dn1");
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

                    dn1.receive({payload: "test"});
                    clock.setTimeout.should.be.calledWith(sinon.match.any, 120000);
                    dn1.msgQueue.should.have.length(1);
                    clock.tick(120000);  // advance clock by 2 mins
                    dn1.msgQueue.should.have.length(0);
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should trigger at specified time with random offset", function(done)
        {
            const flow = [{id: "dn1", type: "chronos-delay", name: "delay", config: "cn1", wires: [["hn1"]], whenType: "time", delayType: "pointInTime", whenValue: "00:01", offset: 2, random: true, preserveCtrlProps: true}, hlpNode, cfgNode];
            sinon.spy(clock, "setTimeout");
            sinon.stub(Math, "random").returns(0.5);

            helper.load([configNode, delayNode], flow, credentials, function()
            {
                try
                {
                    const dn1 = helper.getNode("dn1");
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

                    dn1.receive({payload: "test"});
                    clock.setTimeout.should.be.calledWith(sinon.match.any, 120000);
                    dn1.msgQueue.should.have.length(1);
                    clock.tick(120000);  // advance clock by 2 mins
                    dn1.msgQueue.should.have.length(0);
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should handle time error during setup of timer", async function()
        {
            const flow = [{id: "dn1", type: "chronos-delay", name: "delay", config: "cn1", delayType: "pointInTime", whenType: "sun", whenValue: "sunset", offset: 2, random: true, preserveCtrlProps: true}, cfgNode];

            sinon.stub(chronos, "getTime").throws(function() { return new chronos.TimeError("time error", {type: "sun", value: "sunset"}); });
            await helper.load([configNode, delayNode], flow, credentials);
            const dn1 = helper.getNode("dn1");
            dn1.receive({payload: "test"});
            dn1.error.should.be.calledWith("time error", {errorDetails: {type: "sun", value: "sunset"}});
            dn1.msgQueue.should.have.length(0);
        });

        it("should handle other error during setup of timer", async function()
        {
            const flow = [{id: "dn1", type: "chronos-delay", name: "delay", config: "cn1", delayType: "pointInTime", whenType: "sun", whenValue: "sunset", offset: 2, random: true, preserveCtrlProps: true}, cfgNode];

            sinon.stub(chronos, "getTime").throws("error", "error message");
            await helper.load([configNode, delayNode], flow, credentials);
            const dn1 = helper.getNode("dn1");
            dn1.receive({payload: "test"});
            dn1.error.should.be.calledWith("error message");
            dn1.msgQueue.should.have.length(0);
        });
    });

    context("time point delay (part 2)", function()
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
            const flow = [{id: "dn1", type: "chronos-delay", name: "delay", config: "cn1", wires: [["hn1"]], delayType: "pointInTime", whenType: "time", whenValue: "00:30", offset: 0, random: false, preserveCtrlProps: true}, hlpNode, cfgNode];
            sinon.spy(clock, "setTimeout");

            helper.load([configNode, delayNode], flow, credentials, function()
            {
                try
                {
                    const dn1 = helper.getNode("dn1");
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

                    dn1.receive({payload: "test"});
                    clock.setTimeout.should.be.calledWith(sinon.match.any, 84600000);
                    dn1.msgQueue.should.have.length(1);
                    clock.tick(84600000);  // advance clock by 23h and 30 mins
                    dn1.msgQueue.should.have.length(0);
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should trigger at specified sun time on next day", function(done)
        {
            const flow = [{id: "dn1", type: "chronos-delay", name: "delay", config: "cn1", wires: [["hn1"]], delayType: "pointInTime", whenType: "sun", whenValue: "sunrise", offset: 0, random: false, preserveCtrlProps: true}, hlpNode, cfgNode];
            sinon.stub(chronos, "getTime").returns(moment.utc(1800000));
            sinon.spy(clock, "setTimeout");

            helper.load([configNode, delayNode], flow, credentials, function()
            {
                try
                {
                    const dn1 = helper.getNode("dn1");
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

                    dn1.receive({payload: "test"});
                    clock.setTimeout.should.be.calledWith(sinon.match.any, 84600000);
                    dn1.msgQueue.should.have.length(1);
                    clock.tick(84600000);  // advance clock by 23h and 30 mins
                    dn1.msgQueue.should.have.length(0);
                }
                catch (e)
                {
                    done(e);
                }
            });
        });
    });

    context("custom delay", function()
    {
        let clock = null;

        beforeEach(function()
        {
            clock = sinon.useFakeTimers({now: 1000000000, toFake: ["Date", "setTimeout", "clearTimeout"]});
            sinon.stub(chronos, "getCurrentTime").returns(moment().utc());
            sinon.stub(chronos, "getTimeFrom").callsFake(function(node, source) { return moment.utc(source); });
        });

        afterEach(function()
        {
            helper.unload();
            sinon.restore();
        });

        it("should delay message for custom duration", function(done)
        {
            const flow = [{id: "dn1", type: "chronos-delay", name: "delay", config: "cn1", wires: [["hn1"]], delayType: "custom", expression: "3000", preserveCtrlProps: true}, hlpNode, cfgNode];
            sinon.spy(clock, "setTimeout");

            helper.load([configNode, delayNode], flow, credentials, function()
            {
                try
                {
                    const dn1 = helper.getNode("dn1");
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

                    dn1.receive({payload: "test"});
                    clock.setTimeout.should.be.calledWith(sinon.match.any, 3000);
                    dn1.msgQueue.should.have.length(1);
                    clock.tick(3000);  // advance clock by 3 seconds
                    dn1.msgQueue.should.have.length(0);
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should delay message until custom time point (numeric)", function(done)
        {
            const flow = [{id: "dn1", type: "chronos-delay", name: "delay", config: "cn1", wires: [["hn1"]], delayType: "custom", expression: "1000003000", preserveCtrlProps: true}, hlpNode, cfgNode];
            sinon.spy(clock, "setTimeout");

            helper.load([configNode, delayNode], flow, credentials, function()
            {
                try
                {
                    const dn1 = helper.getNode("dn1");
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

                    dn1.receive({payload: "test"});
                    clock.setTimeout.should.be.calledWith(sinon.match.any, 3000);
                    dn1.msgQueue.should.have.length(1);
                    clock.tick(3000);  // advance clock by 3 seconds
                    dn1.msgQueue.should.have.length(0);
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should delay message until custom time point (string)", function(done)
        {
            const flow = [{id: "dn1", type: "chronos-delay", name: "delay", config: "cn1", wires: [["hn1"]], delayType: "custom", expression: "'1970-01-12T13:46:43'", preserveCtrlProps: true}, hlpNode, cfgNode];
            sinon.spy(clock, "setTimeout");

            helper.load([configNode, delayNode], flow, credentials, function()
            {
                try
                {
                    const dn1 = helper.getNode("dn1");
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

                    dn1.receive({payload: "test"});
                    clock.setTimeout.should.be.calledWith(sinon.match.any, 3000);
                    dn1.msgQueue.should.have.length(1);
                    clock.tick(3000);  // advance clock by 3 seconds
                    dn1.msgQueue.should.have.length(0);
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should handle time error due to invalid expression (parsing)", async function()
        {
            const flow = [{id: "dn1", type: "chronos-delay", name: "delay", config: "cn1", delayType: "custom", expression: "[4}", preserveCtrlProps: true}, cfgNode];

            await helper.load([configNode, delayNode], flow, credentials);
            const dn1 = helper.getNode("dn1");
            dn1.receive({payload: "test"});
            dn1.error.should.be.calledWith("node-red-contrib-chronos/chronos-config:common.error.evaluationFailed", {errorDetails: {expression: "[4}", code: sinon.match.any, description: sinon.match.any, position: sinon.match.any, token: sinon.match.any, value: sinon.match.any}});
            dn1.msgQueue.should.have.length(0);
        });

        it("should handle time error due to invalid expression (evaluating)", async function()
        {
            const flow = [{id: "dn1", type: "chronos-delay", name: "delay", config: "cn1", delayType: "custom", expression: "$nonExistingFunc()", preserveCtrlProps: true}, cfgNode];

            await helper.load([configNode, delayNode], flow, credentials);
            const dn1 = helper.getNode("dn1");
            dn1.receive({payload: "test"});
            dn1.error.should.be.calledWith("node-red-contrib-chronos/chronos-config:common.error.evaluationFailed", {errorDetails: {expression: "$nonExistingFunc()", code: sinon.match.any, description: sinon.match.any, position: sinon.match.any, token: sinon.match.any}});
            dn1.msgQueue.should.have.length(0);
        });

        it("should handle time error due to invalid expression (evaluating)", async function()
        {
            const flow = [{id: "dn1", type: "chronos-delay", name: "delay", config: "cn1", delayType: "custom", expression: "true", preserveCtrlProps: true}, cfgNode];

            await helper.load([configNode, delayNode], flow, credentials);
            const dn1 = helper.getNode("dn1");
            dn1.receive({payload: "test"});
            dn1.error.should.be.calledWith("node-red-contrib-chronos/chronos-config:common.error.notTime", {errorDetails: {expression: "true", result: true}});
            dn1.msgQueue.should.have.length(0);
        });

        it("should handle time error due to invalid relative numeric time (< 1)", async function()
        {
            const flow = [{id: "dn1", type: "chronos-delay", name: "delay", config: "cn1", delayType: "custom", expression: "0", preserveCtrlProps: true}, cfgNode];

            await helper.load([configNode, delayNode], flow, credentials);
            const dn1 = helper.getNode("dn1");
            dn1.receive({payload: "test"});
            dn1.error.should.be.calledWith("node-red-contrib-chronos/chronos-config:common.error.intervalOutOfRange", {errorDetails: {expression: "0", result: 0}});
            dn1.msgQueue.should.have.length(0);
        });

        it("should handle time error due to invalid relative numeric time (> 604.800.000)", async function()
        {
            const flow = [{id: "dn1", type: "chronos-delay", name: "delay", config: "cn1", delayType: "custom", expression: "1604801000", preserveCtrlProps: true}, cfgNode];

            await helper.load([configNode, delayNode], flow, credentials);
            const dn1 = helper.getNode("dn1");
            dn1.receive({payload: "test"});
            dn1.error.should.be.calledWith("node-red-contrib-chronos/chronos-config:common.error.intervalOutOfRange", {errorDetails: {expression: "1604801000", result: 1604801000}});
            dn1.msgQueue.should.have.length(0);
        });

        it("should handle time error due to invalid absolute numeric time (diff < 1)", async function()
        {
            const flow = [{id: "dn1", type: "chronos-delay", name: "delay", config: "cn1", delayType: "custom", expression: "1000000000", preserveCtrlProps: true}, cfgNode];

            await helper.load([configNode, delayNode], flow, credentials);
            const dn1 = helper.getNode("dn1");
            dn1.receive({payload: "test"});
            dn1.error.should.be.calledWith("node-red-contrib-chronos/chronos-config:common.error.intervalOutOfRange", {errorDetails: {expression: "1000000000", result: 1000000000}});
            dn1.msgQueue.should.have.length(0);
        });

        it("should handle time error due to invalid absolute numeric time (diff > 604.800.000)", async function()
        {
            const flow = [{id: "dn1", type: "chronos-delay", name: "delay", config: "cn1", delayType: "custom", expression: "1604801000", preserveCtrlProps: true}, cfgNode];

            await helper.load([configNode, delayNode], flow, credentials);
            const dn1 = helper.getNode("dn1");
            dn1.receive({payload: "test"});
            dn1.error.should.be.calledWith("node-red-contrib-chronos/chronos-config:common.error.intervalOutOfRange", {errorDetails: {expression: "1604801000", result: 1604801000}});
            dn1.msgQueue.should.have.length(0);
        });

        it("should handle time error due to invalid string time (diff < 1)", async function()
        {
            const flow = [{id: "dn1", type: "chronos-delay", name: "delay", config: "cn1", delayType: "custom", expression: "'1970-01-12T13:46:40'", preserveCtrlProps: true}, cfgNode];

            await helper.load([configNode, delayNode], flow, credentials);
            const dn1 = helper.getNode("dn1");
            dn1.receive({payload: "test"});
            dn1.error.should.be.calledWith("node-red-contrib-chronos/chronos-config:common.error.intervalOutOfRange", {errorDetails: {expression: "'1970-01-12T13:46:40'", result: '1970-01-12T13:46:40'}});
            dn1.msgQueue.should.have.length(0);
        });

        it("should handle time error due to invalid string time (diff > 604.800.000))", async function()
        {
            const flow = [{id: "dn1", type: "chronos-delay", name: "delay", config: "cn1", delayType: "custom", expression: "'1970-01-19T13:46:41'", preserveCtrlProps: true}, cfgNode];

            await helper.load([configNode, delayNode], flow, credentials);
            const dn1 = helper.getNode("dn1");
            dn1.receive({payload: "test"});
            dn1.error.should.be.calledWith("node-red-contrib-chronos/chronos-config:common.error.intervalOutOfRange", {errorDetails: {expression: "'1970-01-19T13:46:41'", result: '1970-01-19T13:46:41'}});
            dn1.msgQueue.should.have.length(0);
        });

        it("should handle time error due to invalid string time (no time))", async function()
        {
            const flow = [{id: "dn1", type: "chronos-delay", name: "delay", config: "cn1", delayType: "custom", expression: "'invalid'", preserveCtrlProps: true}, cfgNode];

            await helper.load([configNode, delayNode], flow, credentials);
            const dn1 = helper.getNode("dn1");
            dn1.receive({payload: "test"});
            dn1.error.should.be.calledWith("node-red-contrib-chronos/chronos-config:common.error.notTime", {errorDetails: {expression: "'invalid'", result: 'invalid'}});
            dn1.msgQueue.should.have.length(0);
        });
    });

    context("control and override properties", function()
    {
        let clock = null;

        beforeEach(function()
        {
            clock = sinon.useFakeTimers({toFake: ["Date", "setTimeout", "clearTimeout"]});
            sinon.stub(chronos, "getCurrentTime").returns(moment().utc());
        });

        afterEach(function()
        {
            helper.unload();
            sinon.restore();
        });

        it("should drop messages", async function()
        {
            const flow = [{id: "dn1", type: "chronos-delay", name: "delay", config: "cn1", delayType: "pointInTime", whenType: "time", whenValue: "00:01", offset: 0, random: false, preserveCtrlProps: true}, cfgNode];
            sinon.spy(clock, "setTimeout");

            await helper.load([configNode, delayNode], flow, credentials);
            const dn1 = helper.getNode("dn1");

            dn1.receive({payload: "test1"});
            clock.setTimeout.should.be.calledWith(sinon.match.any, 60000);
            dn1.msgQueue.should.have.length(1);
            dn1.receive({payload: "test2"});
            clock.setTimeout.should.be.calledWith(sinon.match.any, 60000);
            dn1.msgQueue.should.have.length(2);
            dn1.receive({drop: true});
            dn1.msgQueue.should.have.length(0);
        });

        it("should drop messages and re-enqueue", function(done)
        {
            const flow = [{id: "dn1", type: "chronos-delay", name: "delay", config: "cn1", wires: [["hn1"]], delayType: "pointInTime", whenType: "time", whenValue: "00:01", offset: 0, random: false, preserveCtrlProps: true}, hlpNode, cfgNode];
            sinon.spy(clock, "setTimeout");

            helper.load([configNode, delayNode], flow, credentials, function()
            {
                try
                {
                    const dn1 = helper.getNode("dn1");
                    const hn1 = helper.getNode("hn1");

                    hn1.on("input", function(msg)
                    {
                        try
                        {
                            msg.should.have.property("drop", true);
                            msg.should.have.property("enqueue", true);
                            done();
                        }
                        catch (e)
                        {
                            done(e);
                        }
                    });

                    dn1.receive({payload: "test1"});
                    clock.setTimeout.should.be.calledWith(sinon.match.any, 60000);
                    dn1.msgQueue.should.have.length(1);
                    dn1.receive({payload: "test2"});
                    clock.setTimeout.should.be.calledWith(sinon.match.any, 60000);
                    dn1.msgQueue.should.have.length(2);
                    dn1.receive({drop: true, enqueue: true});
                    dn1.msgQueue.should.have.length(1);
                    clock.tick(60000);  // advance clock by 1 min
                    dn1.msgQueue.should.have.length(0);
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should delete control properties for drop message", function(done)
        {
            const flow = [{id: "dn1", type: "chronos-delay", name: "delay", config: "cn1", wires: [["hn1"]], delayType: "pointInTime", whenType: "time", whenValue: "00:01", offset: 0, random: false, preserveCtrlProps: false}, hlpNode, cfgNode];
            sinon.spy(clock, "setTimeout");

            helper.load([configNode, delayNode], flow, credentials, function()
            {
                try
                {
                    const dn1 = helper.getNode("dn1");
                    const hn1 = helper.getNode("hn1");

                    hn1.on("input", function(msg)
                    {
                        try
                        {
                            msg.should.not.have.property("drop");
                            msg.should.not.have.property("enqueue");
                            done();
                        }
                        catch (e)
                        {
                            done(e);
                        }
                    });

                    dn1.receive({payload: "test"});
                    clock.setTimeout.should.be.calledWith(sinon.match.any, 60000);
                    dn1.msgQueue.should.have.length(1);
                    dn1.receive({drop: true, enqueue: true});
                    dn1.msgQueue.should.have.length(1);
                    clock.tick(60000);  // advance clock by 1 min
                    dn1.msgQueue.should.have.length(0);
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should ignore drop property", async function()
        {
            const flow = [{id: "dn1", type: "chronos-delay", name: "delay", config: "cn1", whenType: "time", delayType: "pointInTime", whenValue: "00:01", offset: 0, random: false, preserveCtrlProps: true, ignoreCtrlProps: true}, cfgNode];
            sinon.spy(clock, "setTimeout");

            await helper.load([configNode, delayNode], flow, credentials);
            const dn1 = helper.getNode("dn1");

            dn1.receive({payload: "test1"});
            clock.setTimeout.should.be.calledWith(sinon.match.any, 60000);
            dn1.msgQueue.should.have.length(1);
            dn1.receive({payload: "test2"});
            clock.setTimeout.should.be.calledWith(sinon.match.any, 60000);
            dn1.msgQueue.should.have.length(2);
            dn1.receive({drop: true});
            clock.setTimeout.should.be.calledWith(sinon.match.any, 60000);
            dn1.msgQueue.should.have.length(3);
        });

        it("should flush messages", function(done)
        {
            const flow = [{id: "dn1", type: "chronos-delay", name: "delay", config: "cn1", wires: [["hn1"]], delayType: "pointInTime", whenType: "time", whenValue: "00:01", offset: 0, random: false, preserveCtrlProps: true}, hlpNode, cfgNode];
            sinon.spy(clock, "setTimeout");

            helper.load([configNode, delayNode], flow, credentials, function()
            {
                try
                {
                    const dn1 = helper.getNode("dn1");
                    const hn1 = helper.getNode("hn1");
                    let msgCount = 0;

                    hn1.on("input", function(msg)
                    {
                        try
                        {
                            msgCount++;
                            msg.should.have.property("payload", "test" + msgCount);
                            if (msgCount == 2)
                            {
                                done();
                            }
                        }
                        catch (e)
                        {
                            done(e);
                        }
                    });

                    dn1.receive({payload: "test1"});
                    clock.setTimeout.should.be.calledWith(sinon.match.any, 60000);
                    dn1.msgQueue.should.have.length(1);
                    dn1.receive({payload: "test2"});
                    clock.setTimeout.should.be.calledWith(sinon.match.any, 60000);
                    dn1.msgQueue.should.have.length(2);
                    dn1.receive({flush: true});
                    dn1.msgQueue.should.have.length(0);
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should flush messages and re-enqueue", function(done)
        {
            const flow = [{id: "dn1", type: "chronos-delay", name: "delay", config: "cn1", wires: [["hn1"]], delayType: "pointInTime", whenType: "time", whenValue: "00:01", offset: 0, random: false, preserveCtrlProps: true}, hlpNode, cfgNode];
            sinon.spy(clock, "setTimeout");

            helper.load([configNode, delayNode], flow, credentials, function()
            {
                try
                {
                    const dn1 = helper.getNode("dn1");
                    const hn1 = helper.getNode("hn1");
                    let msgCount = 0;

                    hn1.on("input", function(msg)
                    {
                        try
                        {
                            msgCount++;
                            if (msgCount < 3)
                            {
                                msg.should.have.property("payload", "test" + msgCount);
                            }
                            else
                            {
                                msg.should.have.property("flush", true);
                                msg.should.have.property("enqueue", true);
                                done();
                            }
                        }
                        catch (e)
                        {
                            done(e);
                        }
                    });

                    dn1.receive({payload: "test1"});
                    clock.setTimeout.should.be.calledWith(sinon.match.any, 60000);
                    dn1.msgQueue.should.have.length(1);
                    dn1.receive({payload: "test2"});
                    clock.setTimeout.should.be.calledWith(sinon.match.any, 60000);
                    dn1.msgQueue.should.have.length(2);
                    dn1.receive({flush: true, enqueue: true});
                    dn1.msgQueue.should.have.length(1);
                    clock.tick(60000);  // advance clock by 1 min
                    dn1.msgQueue.should.have.length(0);
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should delete control properties for flush message", function(done)
        {
            const flow = [{id: "dn1", type: "chronos-delay", name: "delay", config: "cn1", wires: [["hn1"]], delayType: "pointInTime", whenType: "time", whenValue: "00:01", offset: 0, random: false, preserveCtrlProps: false}, hlpNode, cfgNode];
            sinon.spy(clock, "setTimeout");

            helper.load([configNode, delayNode], flow, credentials, function()
            {
                try
                {
                    const dn1 = helper.getNode("dn1");
                    const hn1 = helper.getNode("hn1");
                    let msgCount = 0;

                    hn1.on("input", function(msg)
                    {
                        try
                        {
                            msgCount++;
                            if (msgCount < 3)
                            {
                                msg.should.have.property("payload", "test" + msgCount);
                            }
                            else
                            {
                                msg.should.not.have.property("flush");
                                msg.should.not.have.property("enqueue");
                                done();
                            }
                        }
                        catch (e)
                        {
                            done(e);
                        }
                    });

                    dn1.receive({payload: "test1"});
                    clock.setTimeout.should.be.calledWith(sinon.match.any, 60000);
                    dn1.msgQueue.should.have.length(1);
                    dn1.receive({payload: "test2"});
                    clock.setTimeout.should.be.calledWith(sinon.match.any, 60000);
                    dn1.msgQueue.should.have.length(2);
                    dn1.receive({flush: true, enqueue: true});
                    dn1.msgQueue.should.have.length(1);
                    clock.tick(60000);  // advance clock by 1 min
                    dn1.msgQueue.should.have.length(0);
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should ignore flush property", async function()
        {
            const flow = [{id: "dn1", type: "chronos-delay", name: "delay", config: "cn1", delayType: "pointInTime", whenType: "time", whenValue: "00:01", offset: 0, random: false, preserveCtrlProps: true, ignoreCtrlProps: true}, cfgNode];
            sinon.spy(clock, "setTimeout");

            await helper.load([configNode, delayNode], flow, credentials);
            const dn1 = helper.getNode("dn1");

            dn1.receive({payload: "test1"});
            clock.setTimeout.should.be.calledWith(sinon.match.any, 60000);
            dn1.msgQueue.should.have.length(1);
            dn1.receive({payload: "test2"});
            clock.setTimeout.should.be.calledWith(sinon.match.any, 60000);
            dn1.msgQueue.should.have.length(2);
            dn1.receive({flush: true});
            clock.setTimeout.should.be.calledWith(sinon.match.any, 60000);
            dn1.msgQueue.should.have.length(3);
        });

        it("should override fixed duration", function(done)
        {
            const flow = [{id: "dn1", type: "chronos-delay", name: "delay", config: "cn1", wires: [["hn1"]], delayType: "fixedDuration", fixedDuration: 3, fixedDurationUnit: "minutes", preserveCtrlProps: true}, hlpNode, cfgNode];
            sinon.spy(clock, "setTimeout");

            helper.load([configNode, delayNode], flow, credentials, function()
            {
                try
                {
                    const dn1 = helper.getNode("dn1");
                    const hn1 = helper.getNode("hn1");
                    let msgCount = 0;

                    hn1.on("input", function(msg)
                    {
                        try
                        {
                            msgCount++;
                            if (msgCount == 1)
                            {
                                msg.should.have.property("payload", "no override");
                            }
                            else if (msgCount == 2)
                            {
                                msg.should.have.property("payload", "with override");
                                msg.should.have.property("fixedDuration", {value: 10, unit: "seconds"});
                                done();
                            }
                        }
                        catch (e)
                        {
                            done(e);
                        }
                    });

                    dn1.receive({payload: "no override"});
                    clock.setTimeout.should.be.calledWith(sinon.match.any, 180000);
                    dn1.msgQueue.should.have.length(1);
                    dn1.receive({payload: "with override", fixedDuration: {value: 10, unit: "seconds"}});
                    clock.setTimeout.should.be.calledWith(sinon.match.any, 10000);
                    dn1.msgQueue.should.have.length(2);
                    clock.tick(10000);  // advance clock by 3 mins
                    dn1.msgQueue.should.have.length(0);
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should override fixed duration and not preserve", function(done)
        {
            const flow = [{id: "dn1", type: "chronos-delay", name: "delay", config: "cn1", wires: [["hn1"]], delayType: "fixedDuration", fixedDuration: 3, fixedDurationUnit: "minutes", preserveCtrlProps: false}, hlpNode, cfgNode];
            sinon.spy(clock, "setTimeout");

            helper.load([configNode, delayNode], flow, credentials, function()
            {
                try
                {
                    const dn1 = helper.getNode("dn1");
                    const hn1 = helper.getNode("hn1");
                    let msgCount = 0;

                    hn1.on("input", function(msg)
                    {
                        try
                        {
                            msgCount++;
                            if (msgCount == 1)
                            {
                                msg.should.have.property("payload", "no override");
                            }
                            else if (msgCount == 2)
                            {
                                msg.should.have.property("payload", "with override");
                                msg.should.not.have.property("fixedDuration");
                                done();
                            }
                        }
                        catch (e)
                        {
                            done(e);
                        }
                    });

                    dn1.receive({payload: "no override"});
                    clock.setTimeout.should.be.calledWith(sinon.match.any, 180000);
                    dn1.msgQueue.should.have.length(1);
                    dn1.receive({payload: "with override", fixedDuration: {value: 10, unit: "seconds"}});
                    clock.setTimeout.should.be.calledWith(sinon.match.any, 10000);
                    dn1.msgQueue.should.have.length(2);
                    clock.tick(10000);  // advance clock by 3 mins
                    dn1.msgQueue.should.have.length(0);
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should override random duration", function(done)
        {
            const flow = [{id: "dn1", type: "chronos-delay", name: "delay", config: "cn1", wires: [["hn1"]], delayType: "randomDuration", randomDuration1: 1, randomDuration2: 9, randomDurationUnit: "seconds", randomizerMillis: false, preserveCtrlProps: true}, hlpNode, cfgNode];
            sinon.spy(clock, "setTimeout");
            sinon.stub(Math, "random").returns(0.5);

            helper.load([configNode, delayNode], flow, credentials, function()
            {
                try
                {
                    const dn1 = helper.getNode("dn1");
                    const hn1 = helper.getNode("hn1");
                    let msgCount = 0;

                    hn1.on("input", function(msg)
                    {
                        try
                        {
                            msgCount++;
                            if (msgCount == 1)
                            {
                                msg.should.have.property("payload", "no override");
                            }
                            else if (msgCount == 2)
                            {
                                msg.should.have.property("payload", "with override");
                                msg.should.have.property("randomDuration", {value1: 3, value2: 10, unit: "minutes", randomizerMillis: true});
                                done();
                            }
                        }
                        catch (e)
                        {
                            done(e);
                        }
                    });

                    dn1.receive({payload: "no override"});
                    clock.setTimeout.should.be.calledWith(sinon.match.any, 5000);
                    dn1.msgQueue.should.have.length(1);
                    dn1.receive({payload: "with override", randomDuration: {value1: 3, value2: 10, unit: "minutes", randomizerMillis: true}});
                    clock.setTimeout.should.be.calledWith(sinon.match.any, 390000);
                    dn1.msgQueue.should.have.length(2);
                    clock.tick(390000);  // advance clock by 390.000 milliseconds
                    dn1.msgQueue.should.have.length(0);
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should override random duration and not preserve", function(done)
        {
            const flow = [{id: "dn1", type: "chronos-delay", name: "delay", config: "cn1", wires: [["hn1"]], delayType: "randomDuration", randomDuration1: 1, randomDuration2: 9, randomizerMillis: false, randomDurationUnit: "seconds", preserveCtrlProps: false}, hlpNode, cfgNode];
            sinon.spy(clock, "setTimeout");
            sinon.stub(Math, "random").returns(0.5);

            helper.load([configNode, delayNode], flow, credentials, function()
            {
                try
                {
                    const dn1 = helper.getNode("dn1");
                    const hn1 = helper.getNode("hn1");
                    let msgCount = 0;

                    hn1.on("input", function(msg)
                    {
                        try
                        {
                            msgCount++;
                            if (msgCount == 1)
                            {
                                msg.should.have.property("payload", "no override");
                            }
                            else if (msgCount == 2)
                            {
                                msg.should.have.property("payload", "with override");
                                msg.should.not.have.property("randomDuration");
                                done();
                            }
                        }
                        catch (e)
                        {
                            done(e);
                        }
                    });

                    dn1.receive({payload: "no override"});
                    clock.setTimeout.should.be.calledWith(sinon.match.any, 5000);
                    dn1.msgQueue.should.have.length(1);
                    dn1.receive({payload: "with override", randomDuration: {value1: 3, value2: 10, unit: "minutes", randomizerMillis: true}});
                    clock.setTimeout.should.be.calledWith(sinon.match.any, 390000);
                    dn1.msgQueue.should.have.length(2);
                    clock.tick(390000);  // advance clock by 390.000 milliseconds
                    dn1.msgQueue.should.have.length(0);
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should override target time", function(done)
        {
            const flow = [{id: "dn1", type: "chronos-delay", name: "delay", config: "cn1", wires: [["hn1"]], delayType: "pointInTime", whenType: "time", whenValue: "00:02", offset: 0, random: false, preserveCtrlProps: true}, hlpNode, cfgNode];
            sinon.spy(clock, "setTimeout");

            helper.load([configNode, delayNode], flow, credentials, function()
            {
                try
                {
                    const dn1 = helper.getNode("dn1");
                    const hn1 = helper.getNode("hn1");
                    let msgCount = 0;

                    hn1.on("input", function(msg)
                    {
                        try
                        {
                            msgCount++;
                            if (msgCount == 1)
                            {
                                msg.should.have.property("payload", "no override");
                            }
                            else if (msgCount == 2)
                            {
                                msg.should.have.property("payload", "with override");
                                msg.should.have.property("when", {type: "time", value: "00:01", offset: 0, random: false});
                                done();
                            }
                        }
                        catch (e)
                        {
                            done(e);
                        }
                    });

                    dn1.receive({payload: "no override"});
                    clock.setTimeout.should.be.calledWith(sinon.match.any, 120000);
                    dn1.msgQueue.should.have.length(1);
                    dn1.receive({payload: "with override", when: {type: "time", value: "00:01", offset: 0, random: false}});
                    clock.setTimeout.should.be.calledWith(sinon.match.any, 60000);
                    dn1.msgQueue.should.have.length(2);
                    clock.tick(60000);  // advance clock by 2 mins
                    dn1.msgQueue.should.have.length(0);
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should override target time and not preserve", function(done)
        {
            const flow = [{id: "dn1", type: "chronos-delay", name: "delay", config: "cn1", wires: [["hn1"]], delayType: "pointInTime", whenType: "time", whenValue: "00:02", offset: 0, random: false, preserveCtrlProps: false}, hlpNode, cfgNode];
            sinon.spy(clock, "setTimeout");

            helper.load([configNode, delayNode], flow, credentials, function()
            {
                try
                {
                    const dn1 = helper.getNode("dn1");
                    const hn1 = helper.getNode("hn1");
                    let msgCount = 0;

                    hn1.on("input", function(msg)
                    {
                        try
                        {
                            msgCount++;
                            if (msgCount == 1)
                            {
                                msg.should.have.property("payload", "no override");
                            }
                            else if (msgCount == 2)
                            {
                                msg.should.have.property("payload", "with override");
                                msg.should.not.have.property("when");
                                done();
                            }
                        }
                        catch (e)
                        {
                            done(e);
                        }
                    });

                    dn1.receive({payload: "no override"});
                    clock.setTimeout.should.be.calledWith(sinon.match.any, 120000);
                    dn1.msgQueue.should.have.length(1);
                    dn1.receive({payload: "with override", when: {type: "time", value: "00:01", offset: 0, random: false}});
                    clock.setTimeout.should.be.calledWith(sinon.match.any, 60000);
                    dn1.msgQueue.should.have.length(2);
                    clock.tick(60000);  // advance clock by 2 mins
                    dn1.msgQueue.should.have.length(0);
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should override expression", function(done)
        {
            const flow = [{id: "dn1", type: "chronos-delay", name: "delay", config: "cn1", wires: [["hn1"]], delayType: "custom", expression: "180000", preserveCtrlProps: true}, hlpNode, cfgNode];
            sinon.spy(clock, "setTimeout");

            helper.load([configNode, delayNode], flow, credentials, function()
            {
                try
                {
                    const dn1 = helper.getNode("dn1");
                    const hn1 = helper.getNode("hn1");
                    let msgCount = 0;

                    hn1.on("input", function(msg)
                    {
                        try
                        {
                            msgCount++;
                            if (msgCount == 1)
                            {
                                msg.should.have.property("payload", "no override");
                            }
                            else if (msgCount == 2)
                            {
                                msg.should.have.property("payload", "with override");
                                msg.should.have.property("expression", "10000");
                                done();
                            }
                        }
                        catch (e)
                        {
                            done(e);
                        }
                    });

                    dn1.receive({payload: "no override"});
                    clock.setTimeout.should.be.calledWith(sinon.match.any, 180000);
                    dn1.msgQueue.should.have.length(1);
                    dn1.receive({payload: "with override", expression: "10000"});
                    clock.setTimeout.should.be.calledWith(sinon.match.any, 10000);
                    dn1.msgQueue.should.have.length(2);
                    clock.tick(10000);  // advance clock by 10 secs
                    dn1.msgQueue.should.have.length(0);
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should override expression and not preserve", function(done)
        {
            const flow = [{id: "dn1", type: "chronos-delay", name: "delay", config: "cn1", wires: [["hn1"]], delayType: "custom", expression: "180000", preserveCtrlProps: false}, hlpNode, cfgNode];
            sinon.spy(clock, "setTimeout");

            helper.load([configNode, delayNode], flow, credentials, function()
            {
                try
                {
                    const dn1 = helper.getNode("dn1");
                    const hn1 = helper.getNode("hn1");
                    let msgCount = 0;

                    hn1.on("input", function(msg)
                    {
                        try
                        {
                            msgCount++;
                            if (msgCount == 1)
                            {
                                msg.should.have.property("payload", "no override");
                            }
                            else if (msgCount == 2)
                            {
                                msg.should.have.property("payload", "with override");
                                msg.should.not.have.property("expression");
                                done();
                            }
                        }
                        catch (e)
                        {
                            done(e);
                        }
                    });

                    dn1.receive({payload: "no override"});
                    clock.setTimeout.should.be.calledWith(sinon.match.any, 180000);
                    dn1.msgQueue.should.have.length(1);
                    dn1.receive({payload: "with override", expression: "10000"});
                    clock.setTimeout.should.be.calledWith(sinon.match.any, 10000);
                    dn1.msgQueue.should.have.length(2);
                    clock.tick(10000);  // advance clock by 10 secs
                    dn1.msgQueue.should.have.length(0);
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should ignore override property", function(done)
        {
            const flow = [{id: "dn1", type: "chronos-delay", name: "delay", config: "cn1", wires: [["hn1"]], delayType: "pointInTime", whenType: "time", whenValue: "00:01", offset: 0, random: false, preserveCtrlProps: true, ignoreCtrlProps: true}, hlpNode, cfgNode];
            sinon.spy(clock, "setTimeout");

            helper.load([configNode, delayNode], flow, credentials, function()
            {
                try
                {
                    const dn1 = helper.getNode("dn1");
                    const hn1 = helper.getNode("hn1");
                    let msgCount = 0;

                    hn1.on("input", function(msg)
                    {
                        try
                        {
                            msgCount++;
                            if (msgCount == 1)
                            {
                                msg.should.have.property("payload", "no override");
                            }
                            else if (msgCount == 2)
                            {
                                msg.should.have.property("payload", "with override");
                                msg.should.have.property("when", {type: "time", value: "00:02", offset: 0, random: false});
                                done();
                            }
                        }
                        catch (e)
                        {
                            done(e);
                        }
                    });

                    dn1.receive({payload: "no override"});
                    clock.setTimeout.should.be.calledWith(sinon.match.any, 60000);
                    dn1.msgQueue.should.have.length(1);
                    dn1.receive({payload: "with override", when: {type: "time", value: "00:02", offset: 0, random: false}});
                    clock.setTimeout.should.be.calledWith(sinon.match.any, 60000);
                    dn1.msgQueue.should.have.length(2);
                    clock.tick(60000);  // advance clock by 1 min
                    dn1.msgQueue.should.have.length(0);
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        function testInvalidFixedDurationOverride(title, override)
        {
            it("should fall back to configured fixed duration: " + title, function(done)
            {
                const flow = [{id: "dn1", type: "chronos-delay", name: "delay", config: "cn1", wires: [["hn1"]], delayType: "fixedDuration", fixedDuration: 10, fixedDurationUnit: "seconds", preserveCtrlProps: true}, hlpNode, cfgNode];
                sinon.spy(clock, "setTimeout");

                helper.load([configNode, delayNode], flow, credentials, function()
                {
                    try
                    {
                        const dn1 = helper.getNode("dn1");
                        const hn1 = helper.getNode("hn1");

                        hn1.on("input", function(msg)
                        {
                            try
                            {
                                msg.should.have.property("payload", "test");
                                msg.should.have.property("fixedDuration", override);
                                done();
                            }
                            catch (e)
                            {
                                done(e);
                            }
                        });

                        dn1.receive({payload: "test", fixedDuration: override});
                        clock.setTimeout.should.be.calledWith(sinon.match.any, 10000);
                        dn1.msgQueue.should.have.length(1);
                        clock.tick(10000);  // advance clock by 10 secs
                        dn1.msgQueue.should.have.length(0);
                    }
                    catch (e)
                    {
                        done(e);
                    }
                });
            });
        }

        testInvalidFixedDurationOverride("invalid override", "invalid");
        testInvalidFixedDurationOverride("null override", null);

        testInvalidFixedDurationOverride("override no value", {unit: "seconds"});
        testInvalidFixedDurationOverride("override value wrong type", {value: "invalid", unit: "seconds"});
        testInvalidFixedDurationOverride("override value too low", {value: 0, unit: "seconds"});
        testInvalidFixedDurationOverride("override no unit", {value: 10});
        testInvalidFixedDurationOverride("override unit wrong type", {value: 10, unit: true});
        testInvalidFixedDurationOverride("override unit invalid value", {value: 10, unit: "invalid"});

        function testInvalidRandomDurationOverride(title, override)
        {
            it("should fall back to configured random duration: " + title, function(done)
            {
                const flow = [{id: "dn1", type: "chronos-delay", name: "delay", config: "cn1", wires: [["hn1"]], delayType: "randomDuration", randomDuration1: 1, randomDuration2: 9, randomDurationUnit: "seconds", preserveCtrlProps: true}, hlpNode, cfgNode];
                sinon.spy(clock, "setTimeout");
                sinon.stub(Math, "random").returns(0.5);

                helper.load([configNode, delayNode], flow, credentials, function()
                {
                    try
                    {
                        const dn1 = helper.getNode("dn1");
                        const hn1 = helper.getNode("hn1");

                        hn1.on("input", function(msg)
                        {
                            try
                            {
                                msg.should.have.property("payload", "test");
                                msg.should.have.property("randomDuration", override);
                                done();
                            }
                            catch (e)
                            {
                                done(e);
                            }
                        });

                        dn1.receive({payload: "test", randomDuration: override});
                        clock.setTimeout.should.be.calledWith(sinon.match.any, 5000);
                        dn1.msgQueue.should.have.length(1);
                        clock.tick(5000);  // advance clock by 5 secs
                        dn1.msgQueue.should.have.length(0);
                    }
                    catch (e)
                    {
                        done(e);
                    }
                });
            });
        }

        testInvalidRandomDurationOverride("invalid override", "invalid");
        testInvalidRandomDurationOverride("null override", null);

        testInvalidRandomDurationOverride("override no value1", {value2: 50, unit: "seconds"});
        testInvalidRandomDurationOverride("override no value2", {value1: 50, unit: "seconds"});
        testInvalidRandomDurationOverride("override value1 wrong type", {value1: "invalid", unit: "seconds"});
        testInvalidRandomDurationOverride("override value2 wrong type", {value2: "invalid", unit: "seconds"});
        testInvalidRandomDurationOverride("override value1 too low", {value1: 0, unit: "seconds"});
        testInvalidRandomDurationOverride("override value2 too low", {value2: 0, unit: "seconds"});
        testInvalidRandomDurationOverride("override no unit", {value1: 10, value2: 20});
        testInvalidRandomDurationOverride("override unit wrong type", {value1: 10, value2: 20, unit: true});
        testInvalidRandomDurationOverride("override unit invalid value", {value1: 10, value2: 20, unit: "invalid"});
        testInvalidRandomDurationOverride("override randomizer millis wrong type", {value1: 10, value2: 20, unit: "seconds", randomizerMillis: "invalid"});

        function testInvalidWhenOverride(title, override)
        {
            it("should fall back to configured target time: " + title, function(done)
            {
                const flow = [{id: "dn1", type: "chronos-delay", name: "delay", config: "cn1", wires: [["hn1"]], delayType: "pointInTime", whenType: "time", whenValue: "01:00", offset: 0, random: false, preserveCtrlProps: true}, hlpNode, cfgNode];
                sinon.spy(clock, "setTimeout");

                helper.load([configNode, delayNode], flow, credentials, function()
                {
                    try
                    {
                        const dn1 = helper.getNode("dn1");
                        const hn1 = helper.getNode("hn1");

                        hn1.on("input", function(msg)
                        {
                            try
                            {
                                msg.should.have.property("payload", "test");
                                msg.should.have.property("when", override);
                                done();
                            }
                            catch (e)
                            {
                                done(e);
                            }
                        });

                        dn1.receive({payload: "test", when: override});
                        clock.setTimeout.should.be.calledWith(sinon.match.any, 3600000);
                        dn1.msgQueue.should.have.length(1);
                        clock.tick(3600000);  // advance clock by 1 hour
                        dn1.msgQueue.should.have.length(0);
                    }
                    catch (e)
                    {
                        done(e);
                    }
                });
            });
        }

        testInvalidWhenOverride("invalid override", "invalid");
        testInvalidWhenOverride("null override", null);

        testInvalidWhenOverride("override type no string", {type: 5, value: "00:01", offset: 0, random: false});
        testInvalidWhenOverride("override type wrong string", {type: "invalid", value: "00:01", offset: 0, random: false});
        testInvalidWhenOverride("override value wrong type", {type: "time", value: null, offset: 0, random: false});
        testInvalidWhenOverride("override value invalid time", {type: "time", value: "12_14", offset: 0, random: false});
        testInvalidWhenOverride("override value invalid sun position", {type: "sun", value: "invalid", offset: 0, random: false});
        testInvalidWhenOverride("override value invalid moon position", {type: "moon", value: "invalid", offset: 0, random: false});
        testInvalidWhenOverride("override offset wrong type", {type: "time", value: "00:01", offset: "invalid", random: false});
        testInvalidWhenOverride("override offset too small", {type: "time", value: "00:01", offset: -301, random: false});
        testInvalidWhenOverride("override offset too large", {type: "time", value: "00:01", offset: 301, random: false});
        testInvalidWhenOverride("override random wrong type", {type: "time", value: "00:01", offset: 0, random: "invalid"});

        function testInvalidExpressionOverride(title, override)
        {
            it("should fall back to configured expression: " + title, function(done)
            {
                const flow = [{id: "dn1", type: "chronos-delay", name: "delay", config: "cn1", wires: [["hn1"]], delayType: "custom", expression: "180000", preserveCtrlProps: true}, hlpNode, cfgNode];
                sinon.spy(clock, "setTimeout");

                helper.load([configNode, delayNode], flow, credentials, function()
                {
                    try
                    {
                        const dn1 = helper.getNode("dn1");
                        const hn1 = helper.getNode("hn1");

                        hn1.on("input", function(msg)
                        {
                            try
                            {
                                msg.should.have.property("payload", "test");
                                msg.should.have.property("expression", override);
                                done();
                            }
                            catch (e)
                            {
                                done(e);
                            }
                        });

                        dn1.receive({payload: "test", expression: override});
                        clock.setTimeout.should.be.calledWith(sinon.match.any, 180000);
                        dn1.msgQueue.should.have.length(1);
                        clock.tick(180000);  // advance clock by 3 mins
                        dn1.msgQueue.should.have.length(0);
                    }
                    catch (e)
                    {
                        done(e);
                    }
                });
            });
        }

        testInvalidExpressionOverride("invalid override", true);
        testInvalidExpressionOverride("null override", null);
    });
});
