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
const delayNode = require("../nodes/delay.js");
const chronos = require("../nodes/common/chronos.js");
const moment = require("moment");

require("should-sinon");

const cfgNode = {id: "cn1", type: "chronos-config", name: "config"};
const hlpNode = {id: "hn1", type: "helper"};
const credentials = {"cn1": {latitude: "50", longitude: "10"}};

describe("delay until node", function()
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
            const flow = [{id: "dn1", type: "chronos-delay", name: "delay", config: "cn1", whenType: "time", whenValue: "12:00", offset: 0, random: false, preserveCtrlProps: true}, cfgNode];

            await helper.load([configNode, delayNode], flow, credentials);
            const dn1 = helper.getNode("dn1");
            dn1.status.should.be.calledOnce();
            dn1.should.have.property("name", "delay");
            dn1.should.have.property("whenType", "time");
            dn1.should.have.property("whenValue", "12:00");
            dn1.should.have.property("offset", 0);
            dn1.should.have.property("random", false);
            dn1.should.have.property("preserveCtrlProps", true);
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

        it("should fail due to invalid when time", async function()
        {
            const flow = [{id: "dn1", type: "chronos-delay", name: "delay", config: "cn1", whenType: "time", whenValue: "invalid", offset: 0, random: false, preserveCtrlProps: true}, cfgNode];

            await helper.load([configNode, delayNode], flow, credentials);
            const dn1 = helper.getNode("dn1");
            dn1.status.should.be.calledTwice();
            dn1.error.should.be.calledOnce().and.calledWith("node-red-contrib-chronos/chronos-config:common.error.invalidConfig");
        });
    });

    context("message queueing (part 1)", function()
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
            const flow = [{id: "dn1", type: "chronos-delay", name: "delay", config: "cn1", wires: [["hn1"]], whenType: "time", whenValue: "00:01", offset: 0, random: false, preserveCtrlProps: true}, hlpNode, cfgNode];
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
            const flow = [{id: "dn1", type: "chronos-delay", name: "delay", config: "cn1", wires: [["hn1"]], whenType: "time", whenValue: "00:01", offset: 1, random: false, preserveCtrlProps: true}, hlpNode, cfgNode];
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
            const flow = [{id: "dn1", type: "chronos-delay", name: "delay", config: "cn1", wires: [["hn1"]], whenType: "time", whenValue: "00:01", offset: 2, random: true, preserveCtrlProps: true}, hlpNode, cfgNode];
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

        it("should drop messages", async function()
        {
            const flow = [{id: "dn1", type: "chronos-delay", name: "delay", config: "cn1", whenType: "time", whenValue: "00:01", offset: 0, random: false, preserveCtrlProps: true}, cfgNode];
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
            const flow = [{id: "dn1", type: "chronos-delay", name: "delay", config: "cn1", wires: [["hn1"]], whenType: "time", whenValue: "00:01", offset: 0, random: false, preserveCtrlProps: true}, hlpNode, cfgNode];
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
            const flow = [{id: "dn1", type: "chronos-delay", name: "delay", config: "cn1", wires: [["hn1"]], whenType: "time", whenValue: "00:01", offset: 0, random: false, preserveCtrlProps: false}, hlpNode, cfgNode];
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

        it("should flush messages", function(done)
        {
            const flow = [{id: "dn1", type: "chronos-delay", name: "delay", config: "cn1", wires: [["hn1"]], whenType: "time", whenValue: "00:01", offset: 0, random: false, preserveCtrlProps: true}, hlpNode, cfgNode];
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
            const flow = [{id: "dn1", type: "chronos-delay", name: "delay", config: "cn1", wires: [["hn1"]], whenType: "time", whenValue: "00:01", offset: 0, random: false, preserveCtrlProps: true}, hlpNode, cfgNode];
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
            const flow = [{id: "dn1", type: "chronos-delay", name: "delay", config: "cn1", wires: [["hn1"]], whenType: "time", whenValue: "00:01", offset: 0, random: false, preserveCtrlProps: false}, hlpNode, cfgNode];
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

        it("should handle time error during setup of timer", async function()
        {
            const flow = [{id: "dn1", type: "chronos-delay", name: "delay", config: "cn1", whenType: "sun", whenValue: "sunset", offset: 2, random: true, preserveCtrlProps: true}, cfgNode];

            sinon.stub(chronos, "getTime").throws(function() { return new chronos.TimeError("time error", {type: "sun", value: "sunset"}); });
            await helper.load([configNode, delayNode], flow, credentials);
            const dn1 = helper.getNode("dn1");
            dn1.receive({payload: "test"});
            dn1.error.should.be.calledWith("time error", {errorDetails: {type: "sun", value: "sunset"}});
            dn1.msgQueue.should.have.length(0);
        });

        it("should handle other error during setup of timer", async function()
        {
            const flow = [{id: "dn1", type: "chronos-delay", name: "delay", config: "cn1", whenType: "sun", whenValue: "sunset", offset: 2, random: true, preserveCtrlProps: true}, cfgNode];

            sinon.stub(chronos, "getTime").throws("error", "error message");
            await helper.load([configNode, delayNode], flow, credentials);
            const dn1 = helper.getNode("dn1");
            dn1.receive({payload: "test"});
            dn1.error.should.be.calledWith("error message");
            dn1.msgQueue.should.have.length(0);
        });

        it("should override target time", function(done)
        {
            const flow = [{id: "dn1", type: "chronos-delay", name: "delay", config: "cn1", wires: [["hn1"]], whenType: "time", whenValue: "00:01", offset: 0, random: false, preserveCtrlProps: true}, hlpNode, cfgNode];
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
                    clock.setTimeout.should.be.calledWith(sinon.match.any, 120000);
                    dn1.msgQueue.should.have.length(2);
                    clock.tick(120000);  // advance clock by 2 mins
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
            const flow = [{id: "dn1", type: "chronos-delay", name: "delay", config: "cn1", wires: [["hn1"]], whenType: "time", whenValue: "00:01", offset: 0, random: false, preserveCtrlProps: false}, hlpNode, cfgNode];
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
                    clock.setTimeout.should.be.calledWith(sinon.match.any, 60000);
                    dn1.msgQueue.should.have.length(1);
                    dn1.receive({payload: "with override", when: {type: "time", value: "00:02", offset: 0, random: false}});
                    clock.setTimeout.should.be.calledWith(sinon.match.any, 120000);
                    dn1.msgQueue.should.have.length(2);
                    clock.tick(120000);  // advance clock by 2 mins
                    dn1.msgQueue.should.have.length(0);
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        function testInvalidOverride(title, override)
        {
            it("should fall back to configured target time: " + title, function(done)
            {
                const flow = [{id: "dn1", type: "chronos-delay", name: "delay", config: "cn1", wires: [["hn1"]], whenType: "time", whenValue: "01:00", offset: 0, random: false, preserveCtrlProps: true}, hlpNode, cfgNode];
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

        testInvalidOverride("invalid override", "invalid");
        testInvalidOverride("null override", null);

        testInvalidOverride("override type no string", {type: 5, value: "00:01", offset: 0, random: false});
        testInvalidOverride("override type wrong string", {type: "invalid", value: "00:01", offset: 0, random: false});
        testInvalidOverride("override value wrong type", {type: "time", value: null, offset: 0, random: false});
        testInvalidOverride("override value invalid time", {type: "time", value: "12_14", offset: 0, random: false});
        testInvalidOverride("override value invalid sun position", {type: "sun", value: "invalid", offset: 0, random: false});
        testInvalidOverride("override value invalid moon position", {type: "moon", value: "invalid", offset: 0, random: false});
        testInvalidOverride("override offset wrong type", {type: "time", value: "00:01", offset: "invalid", random: false});
        testInvalidOverride("override offset too small", {type: "time", value: "00:01", offset: -301, random: false});
        testInvalidOverride("override offset too large", {type: "time", value: "00:01", offset: 301, random: false});
        testInvalidOverride("override random wrong type", {type: "time", value: "00:01", offset: 0, random: "invalid"});
    });

    context("message queueing (part 2)", function()
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
            const flow = [{id: "dn1", type: "chronos-delay", name: "delay", config: "cn1", wires: [["hn1"]], whenType: "time", whenValue: "00:30", offset: 0, random: false, preserveCtrlProps: true}, hlpNode, cfgNode];
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
            const flow = [{id: "dn1", type: "chronos-delay", name: "delay", config: "cn1", wires: [["hn1"]], whenType: "sun", whenValue: "sunrise", offset: 0, random: false, preserveCtrlProps: true}, hlpNode, cfgNode];
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
});
