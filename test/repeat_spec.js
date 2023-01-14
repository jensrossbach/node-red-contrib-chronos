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
const cfgNodeInvalidTZ = {id: "cn1", type: "chronos-config", name: "config", timezone: "invalid"};
const repeatNode = require("../nodes/repeat.js");
const chronos = require("../nodes/common/chronos.js");
const moment = require("moment");
const cronosjs = require("cronosjs");

require("should-sinon");

const cfgNode = {id: "cn1", type: "chronos-config", name: "config"};
const hlpNode = {id: "hn1", type: "helper"};
const credentials = {"cn1": {latitude: "50", longitude: "10"}};

describe("repeat until node", function()
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
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", interval: 1, intervalUnit: "seconds", untilType: "time", untilValue: "12:00", untilOffset: 0, untilRandom: false, preserveCtrlProps: true}, cfgNode];

            await helper.load([configNode, repeatNode], flow, credentials);
            const rn1 = helper.getNode("rn1");
            rn1.status.should.be.calledOnce();
            rn1.should.have.property("name", "repeat");
            rn1.should.have.property("interval", 1);
            rn1.should.have.property("intervalUnit", "seconds");
            rn1.should.have.property("untilType", "time");
            rn1.should.have.property("untilValue", "12:00");
            rn1.should.have.property("untilOffset", 0);
            rn1.should.have.property("untilRandom", false);
            rn1.should.have.property("preserveCtrlProps", true);
        });

        it("should fail due to missing configuration", async function()
        {
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat"}];

            await helper.load(repeatNode, flow, {});
            const rn1 = helper.getNode("rn1");
            rn1.status.should.be.calledOnce();
            rn1.error.should.be.calledOnce().and.calledWith("node-red-contrib-chronos/chronos-config:common.error.noConfig");
        });

        it("should fail due to invalid latitude", async function()
        {
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1"}, cfgNode];
            const invalidCredentials = {"cn1": {latitude: "", longitude: "10"}};

            await helper.load([configNode, repeatNode], flow, invalidCredentials);
            const rn1 = helper.getNode("rn1");
            rn1.status.should.be.calledOnce();
            rn1.error.should.be.calledOnce().and.calledWith("node-red-contrib-chronos/chronos-config:common.error.invalidConfig");
        });

        it("should fail due to invalid longitude", async function()
        {
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1"}, cfgNode];
            const invalidCredentials = {"cn1": {latitude: "50", longitude: ""}};

            await helper.load([configNode, repeatNode], flow, invalidCredentials);
            const rn1 = helper.getNode("rn1");
            rn1.status.should.be.calledOnce();
            rn1.error.should.be.calledOnce().and.calledWith("node-red-contrib-chronos/chronos-config:common.error.invalidConfig");
        });

        it("should fail due to invalid time zone", async function()
        {
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1"}, cfgNodeInvalidTZ];

            await helper.load([configNode, repeatNode], flow, credentials);
            const rn1 = helper.getNode("rn1");
            rn1.status.should.be.calledOnce();
            rn1.error.should.be.calledOnce().and.calledWith("node-red-contrib-chronos/chronos-config:common.error.invalidConfig");
        });

        it("should fail due to invalid cron table", async function()
        {
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", mode: "advanced", interval: 1, intervalUnit: "seconds", crontab: "invalid", untilType: "time", untilValue: "invalid", untilOffset: 0, untilRandom: false, preserveCtrlProps: true}, cfgNode];

            await helper.load([configNode, repeatNode], flow, credentials);
            const rn1 = helper.getNode("rn1");
            rn1.status.should.be.calledOnce();
            rn1.error.should.be.calledOnce().and.calledWith("node-red-contrib-chronos/chronos-config:common.error.invalidConfig");
        });

        it("should fail due to invalid until time", async function()
        {
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", mode: "simple", interval: 1, intervalUnit: "seconds", crontab: "", untilType: "time", untilValue: "invalid", untilOffset: 0, untilRandom: false, preserveCtrlProps: true}, cfgNode];

            await helper.load([configNode, repeatNode], flow, credentials);
            const rn1 = helper.getNode("rn1");
            rn1.status.should.be.calledTwice();
            rn1.error.should.be.calledOnce().and.calledWith("node-red-contrib-chronos/chronos-config:common.error.invalidConfig");
        });

        it("should preserve backward compatibility to v1.14.x and earlier", async function()
        {
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", interval: 1, intervalUnit: "seconds", untilType: "nextMsg", untilValue: "", untilOffset: 0, untilRandom: false, preserveCtrlProps: true}, cfgNode];

            await helper.load([configNode, repeatNode], flow, credentials);
            const rn1 = helper.getNode("rn1");
            rn1.mode.should.equal("simple");
            rn1.crontab.should.equal("");
            rn1.msgIngress.should.equal("forward:forced");
        });
    });

    context("message ingress behavior", function()
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

        it("should never forward message on ingress", function(done)
        {
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", wires: [["hn1"]], mode: "simple", interval: 1, intervalUnit: "seconds", crontab: "", untilType: "nextMsg", untilValue: "", untilOffset: 0, untilRandom: false, msgIngress: "noop", preserveCtrlProps: true}, hlpNode, cfgNode];
            sinon.spy(clock, "setTimeout");

            helper.load([configNode, repeatNode], flow, credentials, function()
            {
                try
                {
                    const rn1 = helper.getNode("rn1");
                    const hn1 = helper.getNode("hn1");

                    hn1.on("input", function(msg)
                    {
                        done("unexpected message received");
                    });

                    rn1.receive({payload: "test"});
                    done();
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should not forward message on ingress due to exceeded until time", function(done)
        {
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", wires: [["hn1"]], mode: "simple", interval: 1, intervalUnit: "seconds", crontab: "", untilType: "time", untilValue: "00:00", untilOffset: 0, untilRandom: false, msgIngress: "forward", preserveCtrlProps: true}, hlpNode, cfgNode];
            sinon.spy(clock, "setTimeout");

            helper.load([configNode, repeatNode], flow, credentials, function()
            {
                try
                {
                    const rn1 = helper.getNode("rn1");
                    const hn1 = helper.getNode("hn1");

                    hn1.on("input", function(msg)
                    {
                        done("unexpected message received");
                    });

                    curTime += 60000;
                    rn1.receive({payload: "test"});
                    done();
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should forward message on ingress (until time not reached)", function(done)
        {
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", wires: [["hn1"]], mode: "simple", interval: 1, intervalUnit: "seconds", crontab: "", untilType: "time", untilValue: "00:00", untilOffset: 0, untilRandom: false, msgIngress: "forward", preserveCtrlProps: true}, hlpNode, cfgNode];
            sinon.spy(clock, "setTimeout");

            helper.load([configNode, repeatNode], flow, credentials, function()
            {
                try
                {
                    const rn1 = helper.getNode("rn1");
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

                    rn1.receive({payload: "test"});
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should forward message on ingress (no until time)", function(done)
        {
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", wires: [["hn1"]], mode: "simple", interval: 1, intervalUnit: "seconds", crontab: "", untilType: "nextMsg", untilValue: "", untilOffset: 0, untilRandom: false, msgIngress: "forward", preserveCtrlProps: true}, hlpNode, cfgNode];
            sinon.spy(clock, "setTimeout");

            helper.load([configNode, repeatNode], flow, credentials, function()
            {
                try
                {
                    const rn1 = helper.getNode("rn1");
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

                    rn1.receive({payload: "test"});
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should forward message on ingress (forced)", function(done)
        {
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", wires: [["hn1"]], mode: "simple", interval: 1, intervalUnit: "seconds", crontab: "", untilType: "time", untilValue: "00:00", untilOffset: 0, untilRandom: false, msgIngress: "forward:forced", preserveCtrlProps: true}, hlpNode, cfgNode];
            sinon.spy(clock, "setTimeout");

            helper.load([configNode, repeatNode], flow, credentials, function()
            {
                try
                {
                    const rn1 = helper.getNode("rn1");
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

                    curTime += 60000;
                    rn1.receive({payload: "test"});
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should override ingress behavior", function(done)
        {
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", wires: [["hn1"]], mode: "simple", interval: 1, intervalUnit: "seconds", crontab: "", untilType: "nextMsg", untilValue: "", untilOffset: 0, untilRandom: false, msgIngress: "noop", preserveCtrlProps: true}, hlpNode, cfgNode];
            sinon.spy(clock, "setTimeout");

            helper.load([configNode, repeatNode], flow, credentials, function()
            {
                try
                {
                    const rn1 = helper.getNode("rn1");
                    const hn1 = helper.getNode("hn1");

                    hn1.on("input", function(msg)
                    {
                        try
                        {
                            msg.should.have.property("payload", "test");
                            msg.should.have.property("ingress", "forward");
                            done();
                        }
                        catch (e)
                        {
                            done(e);
                        }
                    });

                    rn1.receive({payload: "test", ingress: "forward"});
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should override ingress behavior and not preserve", function(done)
        {
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", wires: [["hn1"]], mode: "simple", interval: 1, intervalUnit: "seconds", crontab: "", untilType: "nextMsg", untilValue: "", untilOffset: 0, untilRandom: false, msgIngress: "noop", preserveCtrlProps: false}, hlpNode, cfgNode];
            sinon.spy(clock, "setTimeout");

            helper.load([configNode, repeatNode], flow, credentials, function()
            {
                try
                {
                    const rn1 = helper.getNode("rn1");
                    const hn1 = helper.getNode("hn1");

                    hn1.on("input", function(msg)
                    {
                        try
                        {
                            msg.should.have.property("payload", "test");
                            msg.should.not.have.property("ingress");
                            done();
                        }
                        catch (e)
                        {
                            done(e);
                        }
                    });

                    rn1.receive({payload: "test", ingress: "forward"});
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        function testInvalidIngressOverride(title, override)
        {
            it("should fall back to configured ingress behavior: " + title, function(done)
            {
                const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", wires: [["hn1"]], mode: "simple", interval: 1, intervalUnit: "seconds", crontab: "", untilType: "nextMsg", untilValue: "", untilOffset: 0, untilRandom: false, msgIngress: "forward", preserveCtrlProps: true}, hlpNode, cfgNode];
                sinon.spy(clock, "setTimeout");

                helper.load([configNode, repeatNode], flow, credentials, function()
                {
                    try
                    {
                        const rn1 = helper.getNode("rn1");
                        const hn1 = helper.getNode("hn1");

                        hn1.on("input", function(msg)
                        {
                            try
                            {
                                msg.should.have.property("payload", "test");
                                msg.should.have.property("ingress", override);
                                done();
                            }
                            catch (e)
                            {
                                done(e);
                            }
                        });

                        rn1.receive({payload: "test", ingress: override});
                    }
                    catch (e)
                    {
                        done(e);
                    }
                });
            });
        }

        testInvalidIngressOverride("null override", null);
        testInvalidIngressOverride("empty override", "");
        testInvalidIngressOverride("invalid override", 42);
        testInvalidIngressOverride("invalid ingress", "invalid");
    });

    context("message repeating in simple mode (until next message)", function()
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

        function testRepeatInterval(interval, unit)
        {
            it("should repeat message every " + interval + " " + unit, function(done)
            {
                const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", wires: [["hn1"]], interval: interval, intervalUnit: unit, untilType: "nextMsg", untilValue: "", untilOffset: 0, untilRandom: false, preserveCtrlProps: true}, hlpNode, cfgNode];
                sinon.spy(clock, "setTimeout");

                const intvMs = (unit == "seconds") ? interval * 1000 : (unit == "minutes") ? interval * 60000 : interval * 3600000;

                helper.load([configNode, repeatNode], flow, credentials, function()
                {
                    try
                    {
                        const rn1 = helper.getNode("rn1");
                        const hn1 = helper.getNode("hn1");

                        hn1.on("input", function(msg)
                        {
                            try
                            {
                                msg.should.have.property("payload", "test");
                            }
                            catch (e)
                            {
                                done(e);
                            }
                        });

                        rn1.receive({payload: "test"});
                        clock.tick(intvMs);
                        clock.tick(intvMs);
                        clock.tick(intvMs);
                        clock.setTimeout.should.be.calledWith(sinon.match.any, intvMs).and.have.callCount(4);
                        done();
                    }
                    catch (e)
                    {
                        done(e);
                    }
                });
            });
        }

        testRepeatInterval(4, "seconds");
        testRepeatInterval(3, "minutes");
        testRepeatInterval(2, "hours");

        it("should repeat message until next message is received", function(done)
        {
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", wires: [["hn1"]], mode: "simple", interval: 1, intervalUnit: "seconds", crontab: "", untilType: "nextMsg", untilValue: "", untilOffset: 0, untilRandom: false, msgIngress: "forward:forced", preserveCtrlProps: true}, hlpNode, cfgNode];
            sinon.spy(clock, "setTimeout");

            helper.load([configNode, repeatNode], flow, credentials, function()
            {
                try
                {
                    const rn1 = helper.getNode("rn1");
                    const hn1 = helper.getNode("hn1");
                    let count = 0;

                    hn1.on("input", function(msg)
                    {
                        try
                        {
                            count++;
                            msg.should.have.property("payload", "test" + ((count <= 3) ? 1 : 2));
                        }
                        catch (e)
                        {
                            done(e);
                        }
                    });

                    rn1.receive({payload: "test1"});
                    clock.tick(1000);
                    clock.tick(1000);
                    rn1.receive({payload: "test2"});
                    clock.tick(1000);
                    clock.tick(1000);
                    clock.setTimeout.should.be.calledWith(sinon.match.any, 1000).and.have.callCount(6);
                    done();
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should repeat message until stopped", function(done)
        {
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", wires: [["hn1"]], mode: "simple", interval: 1, intervalUnit: "seconds", crontab: "", untilType: "nextMsg", untilValue: "", untilOffset: 0, untilRandom: false, msgIngress: "forward:forced", preserveCtrlProps: true}, hlpNode, cfgNode];
            sinon.spy(clock, "setTimeout");

            helper.load([configNode, repeatNode], flow, credentials, function()
            {
                try
                {
                    const rn1 = helper.getNode("rn1");
                    const hn1 = helper.getNode("hn1");
                    let count = 0;

                    hn1.on("input", function(msg)
                    {
                        try
                        {
                            count++;
                            if (count <= 3)
                            {
                                msg.should.have.property("payload", "test");
                            }
                            else
                            {
                                done("unexpected message received");
                            }
                        }
                        catch (e)
                        {
                            done(e);
                        }
                    });

                    rn1.receive({payload: "test"});
                    clock.tick(1000);
                    clock.tick(1000);
                    clock.setTimeout.should.be.calledWith(sinon.match.any, 1000).and.have.callCount(3);
                    clock.setTimeout.resetHistory()
                    rn1.receive({stop: true});
                    clock.tick(1000);
                    clock.tick(1000);
                    clock.setTimeout.should.not.be.called();
                    done();
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should override interval", function(done)
        {
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", wires: [["hn1"]], mode: "simple", interval: 1, intervalUnit: "seconds", crontab: "", untilType: "nextMsg", untilValue: "", untilOffset: 0, untilRandom: false, msgIngress: "forward:forced", preserveCtrlProps: true}, hlpNode, cfgNode];
            sinon.spy(clock, "setTimeout");

            helper.load([configNode, repeatNode], flow, credentials, function()
            {
                try
                {
                    const rn1 = helper.getNode("rn1");
                    const hn1 = helper.getNode("hn1");
                    let count = 0;

                    hn1.on("input", function(msg)
                    {
                        try
                        {
                            count++;
                            msg.should.have.property("payload", "test" + ((count <= 3) ? 1 : 2));
                            msg.should.have.property("interval", {value: ((count <= 3) ? 2 : 3), unit: "seconds"});
                        }
                        catch (e)
                        {
                            done(e);
                        }
                    });

                    rn1.receive({payload: "test1", interval: {value: 2, unit: "seconds"}});
                    clock.tick(1000);
                    clock.tick(1000);
                    clock.tick(1000);
                    clock.tick(1000);
                    clock.setTimeout.should.be.calledWith(sinon.match.any, 2000).and.have.callCount(3);
                    clock.setTimeout.resetHistory();
                    rn1.receive({payload: "test2", interval: {value: 3, unit: "seconds"}});
                    clock.tick(1000);
                    clock.tick(1000);
                    clock.tick(1000);
                    clock.tick(1000);
                    clock.tick(1000);
                    clock.tick(1000);
                    clock.setTimeout.should.be.calledWith(sinon.match.any, 3000).and.have.callCount(3);
                    done();
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should override interval and not preserve", function(done)
        {
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", wires: [["hn1"]], mode: "simple", interval: 1, intervalUnit: "seconds", crontab: "", untilType: "nextMsg", untilValue: "", untilOffset: 0, untilRandom: false, msgIngress: "forward:forced", preserveCtrlProps: false}, hlpNode, cfgNode];
            sinon.spy(clock, "setTimeout");

            helper.load([configNode, repeatNode], flow, credentials, function()
            {
                try
                {
                    const rn1 = helper.getNode("rn1");
                    const hn1 = helper.getNode("hn1");
                    let count = 0;

                    hn1.on("input", function(msg)
                    {
                        try
                        {
                            count++;
                            msg.should.have.property("payload", "test" + ((count <= 3) ? 1 : 2));
                            msg.should.not.have.property("interval");
                        }
                        catch (e)
                        {
                            done(e);
                        }
                    });

                    rn1.receive({payload: "test1", interval: {value: 2, unit: "seconds"}});
                    clock.tick(1000);
                    clock.tick(1000);
                    clock.tick(1000);
                    clock.tick(1000);
                    clock.setTimeout.should.be.calledWith(sinon.match.any, 2000).and.have.callCount(3);
                    clock.setTimeout.resetHistory();
                    rn1.receive({payload: "test2", interval: {value: 3, unit: "seconds"}});
                    clock.tick(1000);
                    clock.tick(1000);
                    clock.tick(1000);
                    clock.tick(1000);
                    clock.tick(1000);
                    clock.tick(1000);
                    clock.setTimeout.should.be.calledWith(sinon.match.any, 3000).and.have.callCount(3);
                    done();
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        function testInvalidIntervalOverride(title, override)
        {
            it("should fall back to configured interval: " + title, function(done)
            {
                const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", wires: [["hn1"]], mode: "simple", interval: 1, intervalUnit: "seconds", crontab: "", untilType: "nextMsg", untilValue: "", untilOffset: 0, untilRandom: false, msgIngress: "forward:forced", preserveCtrlProps: true}, hlpNode, cfgNode];
                sinon.spy(clock, "setTimeout");

                helper.load([configNode, repeatNode], flow, credentials, function()
                {
                    try
                    {
                        const rn1 = helper.getNode("rn1");
                        const hn1 = helper.getNode("hn1");

                        hn1.on("input", function(msg)
                        {
                            try
                            {
                                msg.should.have.property("payload", "test");
                                msg.should.have.property("interval", override);
                            }
                            catch (e)
                            {
                                done(e);
                            }
                        });

                        rn1.receive({payload: "test", interval: override});
                        clock.tick(1000);
                        clock.tick(1000);
                        clock.tick(1000);
                        clock.tick(1000);
                        clock.setTimeout.should.be.calledWith(sinon.match.any, 1000).and.have.callCount(5);
                        done();
                    }
                    catch (e)
                    {
                        done(e);
                    }
                });
            });
        }

        testInvalidIntervalOverride("invalid override", "invalid");
        testInvalidIntervalOverride("null override", null);
        testInvalidIntervalOverride("empty override", {});

        testInvalidIntervalOverride("no value", {unit: "hours"});
        testInvalidIntervalOverride("no uniot", {value: 4});

        testInvalidIntervalOverride("invalid unit", {value: 4, unit: "invalid"});
        testInvalidIntervalOverride("invalid value", {value: "invalid", unit: "seconds"});
        testInvalidIntervalOverride("value too small for seconds", {value: 0, unit: "seconds"});
        testInvalidIntervalOverride("value too large for seconds", {value: 60, unit: "seconds"});
        testInvalidIntervalOverride("value too small for minutes", {value: 0, unit: "minutes"});
        testInvalidIntervalOverride("value too large for minutes", {value: 60, unit: "minutes"});
        testInvalidIntervalOverride("value too small for hours", {value: 0, unit: "hours"});
        testInvalidIntervalOverride("value too large for hours", {value: 25, unit: "hours"});

        it("should ignore overridden interval", function(done)
        {
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", wires: [["hn1"]], mode: "simple", interval: 1, intervalUnit: "seconds", crontab: "", untilType: "nextMsg", untilValue: "", untilOffset: 0, untilRandom: false, msgIngress: "forward:forced", preserveCtrlProps: true, ignoreCtrlProps: true}, hlpNode, cfgNode];
            sinon.spy(clock, "setTimeout");

            helper.load([configNode, repeatNode], flow, credentials, function()
            {
                try
                {
                    const rn1 = helper.getNode("rn1");
                    const hn1 = helper.getNode("hn1");

                    hn1.on("input", function(msg)
                    {
                        try
                        {
                            msg.should.have.property("payload", "test");
                            msg.should.have.property("interval", 4000);
                        }
                        catch (e)
                        {
                            done(e);
                        }
                    });

                    rn1.receive({payload: "test", interval: 4000});
                    clock.tick(1000);
                    clock.tick(1000);
                    clock.tick(1000);
                    clock.tick(1000);
                    clock.setTimeout.should.be.calledWith(sinon.match.any, 1000).and.have.callCount(5);
                    done();
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should handle time error", async function()
        {
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", mode: "simple", interval: 1, intervalUnit: "seconds", crontab: "", untilType: "time", untilValue: "00:00", untilDate: "", untilOffset: 0, untilRandom: false, msgIngress: "forward:forced", preserveCtrlProps: false}, cfgNode];

            sinon.stub(chronos, "getTime").throws(function() { return new chronos.TimeError("time error", {type: "sun", value: "sunset"}); });

            await helper.load([configNode, repeatNode], flow, credentials);
            const rn1 = helper.getNode("rn1");

            rn1.receive({payload: "test"});
            rn1.error.should.be.calledWith("time error", {_msgid: sinon.match.any, payload: "test", errorDetails: {type: "sun", value: "sunset"}});
        });

        it("should handle time error (rename errorDetails)", async function()
        {
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", mode: "simple", interval: 1, intervalUnit: "seconds", crontab: "", untilType: "time", untilValue: "00:00", untilDate: "", untilOffset: 0, untilRandom: false, msgIngress: "forward:forced", preserveCtrlProps: false}, cfgNode];

            sinon.stub(chronos, "getTime").throws(function() { return new chronos.TimeError("time error", {type: "sun", value: "sunset"}); });

            await helper.load([configNode, repeatNode], flow, credentials);
            const rn1 = helper.getNode("rn1");

            rn1.receive({payload: "test", errorDetails: "details"});
            rn1.error.should.be.calledWith("time error", {_msgid: sinon.match.any, payload: "test", _errorDetails: "details", errorDetails: {type: "sun", value: "sunset"}});
        });

        it("should handle time error (no details)", async function()
        {
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", mode: "simple", interval: 1, intervalUnit: "seconds", crontab: "", untilType: "time", untilValue: "00:00", untilDate: "", untilOffset: 0, untilRandom: false, msgIngress: "forward:forced", preserveCtrlProps: false}, cfgNode];

            sinon.stub(chronos, "getTime").throws(function() { return new chronos.TimeError("time error", null); });

            await helper.load([configNode, repeatNode], flow, credentials);
            const rn1 = helper.getNode("rn1");

            rn1.receive({payload: "test"});
            rn1.error.should.be.calledWith("time error", {_msgid: sinon.match.any, payload: "test"});
        });

        it("should handle other error", async function()
        {
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", mode: "simple", interval: 1, intervalUnit: "seconds", crontab: "", untilType: "time", untilValue: "00:00", untilDate: "", untilOffset: 0, untilRandom: false, msgIngress: "forward:forced", preserveCtrlProps: false}, cfgNode];

            sinon.stub(chronos, "getTime").throws("error", "error message");

            await helper.load([configNode, repeatNode], flow, credentials);
            const rn1 = helper.getNode("rn1");

            rn1.receive({payload: "test"});
            rn1.error.should.be.calledWith("error message");
        });

        it("should handle time error caused by ending time (invalid JSONata expression 1)", async function()
        {
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", mode: "simple", interval: 1, intervalUnit: "seconds", crontab: "", untilType: "jsonata", untilValue: "invalid[", untilDate: "", untilOffset: 0, untilRandom: false, msgIngress: "forward:forced", preserveCtrlProps: false}, cfgNode];

            await helper.load([configNode, repeatNode], flow, credentials);
            const rn1 = helper.getNode("rn1");

            rn1.receive({payload: "test"});
            rn1.error.should.be.calledWith("node-red-contrib-chronos/chronos-config:common.error.evaluationFailed", {payload: "test", _msgid: sinon.match.any, errorDetails: {expression: "invalid[", code: sinon.match.any, description: sinon.match.any, position: sinon.match.any, token: sinon.match.any, value: sinon.match.any}});
        });

        it("should handle time error caused by ending time (invalid JSONata expression 2)", async function()
        {
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", mode: "simple", interval: 1, intervalUnit: "seconds", crontab: "", untilType: "jsonata", untilValue: "$invalFunc()", untilDate: "", untilOffset: 0, untilRandom: false, msgIngress: "forward:forced", preserveCtrlProps: false}, cfgNode];

            await helper.load([configNode, repeatNode], flow, credentials);
            const rn1 = helper.getNode("rn1");

            rn1.receive({payload: "test"});
            rn1.error.should.be.calledWith("node-red-contrib-chronos/chronos-config:common.error.evaluationFailed", {payload: "test", _msgid: sinon.match.any, errorDetails: {expression: "$invalFunc()", code: sinon.match.any, description: sinon.match.any, position: sinon.match.any, token: sinon.match.any}});
        });

        it("should handle time error caused by ending time (not boolean)", async function()
        {
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", mode: "simple", interval: 1, intervalUnit: "seconds", crontab: "", untilType: "jsonata", untilValue: "42", untilDate: "", untilOffset: 0, untilRandom: false, msgIngress: "forward:forced", preserveCtrlProps: false}, cfgNode];

            await helper.load([configNode, repeatNode], flow, credentials);
            const rn1 = helper.getNode("rn1");

            rn1.receive({payload: "test"});
            rn1.error.should.be.calledWith("node-red-contrib-chronos/chronos-config:common.error.notBoolean", {payload: "test", _msgid: sinon.match.any, errorDetails: {expression: "42", result: 42}});
        });
    });

    context("message repeating in simple mode (until specifc time)", function()
    {
        let clock = null;
        let curTime = 0;

        beforeEach(function()
        {
            curTime = 0;
            clock = sinon.useFakeTimers({toFake: ["setTimeout", "clearTimeout"]});
            sinon.stub(chronos, "getCurrentTime").callsFake(function() { return moment.utc(curTime); });
            sinon.stub(chronos, "getUserDate").callsFake(function(RED, node, value) { return moment.utc(value, "YYYY-MM-DD"); });
        });

        afterEach(function()
        {
            helper.unload();
            sinon.restore();
        });

        it("should repeat message until ending time is reached", function(done)
        {
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", wires: [["hn1"]], mode: "simple", interval: 1, intervalUnit: "seconds", crontab: "", untilType: "time", untilValue: "00:00:03", untilOffset: 0, untilRandom: false, msgIngress: "forward:forced", preserveCtrlProps: true}, hlpNode, cfgNode];
            sinon.spy(clock, "setTimeout");

            helper.load([configNode, repeatNode], flow, credentials, function()
            {
                try
                {
                    const rn1 = helper.getNode("rn1");
                    const hn1 = helper.getNode("hn1");

                    hn1.on("input", function(msg)
                    {
                        try
                        {
                            msg.should.have.property("payload", "test");
                        }
                        catch (e)
                        {
                            done(e);
                        }
                    });

                    rn1.receive({payload: "test"});
                    curTime += 1000;
                    clock.tick(1000);
                    curTime += 1000;
                    clock.tick(1000);
                    curTime += 1000;
                    clock.tick(1000);
                    curTime += 1000;
                    clock.tick(1000);
                    curTime += 1000;
                    clock.tick(1000);
                    curTime += 1000;
                    clock.tick(1000);
                    clock.setTimeout.should.be.calledWith(sinon.match.any, 1000).and.have.callCount(3);
                    done();
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should repeat message until ending time at specific date is reached", function(done)
        {
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", wires: [["hn1"]], mode: "simple", interval: 24, intervalUnit: "hours", crontab: "", untilType: "time", untilValue: "00:05:00", untilDate: "2000-01-03", untilOffset: 0, untilRandom: false, msgIngress: "forward:forced", preserveCtrlProps: true}, hlpNode, cfgNode];
            sinon.spy(clock, "setTimeout");
            curTime = 946684800000;  // 2000-01-01 00:00:00

            helper.load([configNode, repeatNode], flow, credentials, function()
            {
                try
                {
                    const rn1 = helper.getNode("rn1");
                    const hn1 = helper.getNode("hn1");

                    hn1.on("input", function(msg)
                    {
                        try
                        {
                            msg.should.have.property("payload", "test");
                        }
                        catch (e)
                        {
                            done(e);
                        }
                    });

                    rn1.receive({payload: "test"});
                    curTime += 86400000;
                    clock.tick(86400000);
                    curTime += 86400000;
                    clock.tick(86400000);
                    curTime += 86400000;
                    clock.tick(86400000);
                    curTime += 86400000;
                    clock.tick(86400000);
                    curTime += 86400000;
                    clock.tick(86400000);
                    curTime += 86400000;
                    clock.tick(86400000);
                    clock.setTimeout.should.be.calledWith(sinon.match.any, 86400000).and.have.callCount(2);
                    done();
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should repeat message until ending time with offset is reached", function(done)
        {
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", wires: [["hn1"]], mode: "simple", interval: 1, intervalUnit: "minutes", crontab: "", untilType: "time", untilValue: "00:02:00", untilOffset: 1, untilRandom: false, msgIngress: "forward:forced", preserveCtrlProps: true}, hlpNode, cfgNode];
            sinon.spy(clock, "setTimeout");

            helper.load([configNode, repeatNode], flow, credentials, function()
            {
                try
                {
                    const rn1 = helper.getNode("rn1");
                    const hn1 = helper.getNode("hn1");

                    hn1.on("input", function(msg)
                    {
                        try
                        {
                            msg.should.have.property("payload", "test");
                        }
                        catch (e)
                        {
                            done(e);
                        }
                    });

                    rn1.receive({payload: "test"});
                    curTime += 60000;
                    clock.tick(60000);
                    curTime += 60000;
                    clock.tick(60000);
                    curTime += 60000;
                    clock.tick(60000);
                    curTime += 60000;
                    clock.tick(60000);
                    curTime += 60000;
                    clock.tick(60000);
                    curTime += 60000;
                    clock.tick(60000);
                    clock.setTimeout.should.be.calledWith(sinon.match.any, 60000).and.have.callCount(3);
                    done();
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should repeat message until ending time with random offset is reached", function(done)
        {
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", wires: [["hn1"]], mode: "simple", interval: 1, intervalUnit: "minutes", crontab: "", untilType: "time", untilValue: "00:02:00", untilOffset: 2, untilRandom: true, msgIngress: "forward:forced", preserveCtrlProps: true}, hlpNode, cfgNode];
            sinon.spy(clock, "setTimeout");
            sinon.stub(Math, "random").returns(0.5);

            helper.load([configNode, repeatNode], flow, credentials, function()
            {
                try
                {
                    const rn1 = helper.getNode("rn1");
                    const hn1 = helper.getNode("hn1");

                    hn1.on("input", function(msg)
                    {
                        try
                        {
                            msg.should.have.property("payload", "test");
                        }
                        catch (e)
                        {
                            done(e);
                        }
                    });

                    rn1.receive({payload: "test"});
                    curTime += 60000;
                    clock.tick(60000);
                    curTime += 60000;
                    clock.tick(60000);
                    curTime += 60000;
                    clock.tick(60000);
                    curTime += 60000;
                    clock.tick(60000);
                    curTime += 60000;
                    clock.tick(60000);
                    curTime += 60000;
                    clock.tick(60000);
                    clock.setTimeout.should.be.calledWith(sinon.match.any, 60000).and.have.callCount(3);
                    done();
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should repeat message until JSONata based ending time is reached", function(done)
        {
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", wires: [["hn1"]], mode: "simple", interval: 1, intervalUnit: "minutes", crontab: "", untilType: "jsonata", untilValue: "($next = 180000) ? true : false", untilOffset: 0, untilRandom: false, msgIngress: "forward:forced", preserveCtrlProps: true}, hlpNode, cfgNode];
            sinon.spy(clock, "setTimeout");

            helper.load([configNode, repeatNode], flow, credentials, function()
            {
                try
                {
                    const rn1 = helper.getNode("rn1");
                    const hn1 = helper.getNode("hn1");

                    hn1.on("input", function(msg)
                    {
                        try
                        {
                            msg.should.have.property("payload", "test");
                        }
                        catch (e)
                        {
                            done(e);
                        }
                    });

                    rn1.receive({payload: "test"});
                    curTime += 60000;
                    clock.tick(60000);
                    curTime += 60000;
                    clock.tick(60000);
                    curTime += 60000;
                    clock.tick(60000);
                    curTime += 60000;
                    clock.tick(60000);
                    curTime += 60000;
                    clock.tick(60000);
                    curTime += 60000;
                    clock.tick(60000);
                    clock.setTimeout.should.be.calledWith(sinon.match.any, 60000).and.have.callCount(2);
                    done();
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should override until time", function(done)
        {
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", wires: [["hn1"]], mode: "simple", interval: 1, intervalUnit: "seconds", crontab: "", untilType: "time", untilValue: "00:00:06", untilOffset: 0, untilRandom: false, msgIngress: "forward:forced", preserveCtrlProps: true}, hlpNode, cfgNode];
            sinon.spy(clock, "setTimeout");

            helper.load([configNode, repeatNode], flow, credentials, function()
            {
                try
                {
                    const rn1 = helper.getNode("rn1");
                    const hn1 = helper.getNode("hn1");

                    hn1.on("input", function(msg)
                    {
                        try
                        {
                            msg.should.have.property("payload", "test");
                            msg.should.have.property("until", {type: "time", value: "00:00:03", offset: 0, random: false});
                        }
                        catch (e)
                        {
                            done(e);
                        }
                    });

                    rn1.receive({payload: "test", until: {type: "time", value: "00:00:03", offset: 0, random: false}});
                    curTime += 1000;
                    clock.tick(1000);
                    curTime += 1000;
                    clock.tick(1000);
                    curTime += 1000;
                    clock.tick(1000);
                    curTime += 1000;
                    clock.tick(1000);
                    curTime += 1000;
                    clock.tick(1000);
                    curTime += 1000;
                    clock.tick(1000);
                    clock.setTimeout.should.be.calledWith(sinon.match.any, 1000).and.have.callCount(3);
                    done();
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should override until time and not preserve", function(done)
        {
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", wires: [["hn1"]], mode: "simple", interval: 1, intervalUnit: "seconds", crontab: "", untilType: "time", untilValue: "00:00:06", untilOffset: 0, untilRandom: false, msgIngress: "forward:forced", preserveCtrlProps: false}, hlpNode, cfgNode];
            sinon.spy(clock, "setTimeout");

            helper.load([configNode, repeatNode], flow, credentials, function()
            {
                try
                {
                    const rn1 = helper.getNode("rn1");
                    const hn1 = helper.getNode("hn1");

                    hn1.on("input", function(msg)
                    {
                        try
                        {
                            msg.should.have.property("payload", "test");
                            msg.should.not.have.property("until");
                        }
                        catch (e)
                        {
                            done(e);
                        }
                    });

                    rn1.receive({payload: "test", until: {type: "time", value: "00:00:03", offset: 0, random: false}});
                    curTime += 1000;
                    clock.tick(1000);
                    curTime += 1000;
                    clock.tick(1000);
                    curTime += 1000;
                    clock.tick(1000);
                    curTime += 1000;
                    clock.tick(1000);
                    curTime += 1000;
                    clock.tick(1000);
                    curTime += 1000;
                    clock.tick(1000);
                    clock.setTimeout.should.be.calledWith(sinon.match.any, 1000).and.have.callCount(3);
                    done();
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should override until time with next message", function(done)
        {
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", wires: [["hn1"]], mode: "simple", interval: 1, intervalUnit: "seconds", crontab: "", untilType: "time", untilValue: "00:00:03", untilOffset: 0, untilRandom: false, msgIngress: "forward:forced", preserveCtrlProps: true}, hlpNode, cfgNode];
            sinon.spy(clock, "setTimeout");

            helper.load([configNode, repeatNode], flow, credentials, function()
            {
                try
                {
                    const rn1 = helper.getNode("rn1");
                    const hn1 = helper.getNode("hn1");
                    let count = 0;

                    hn1.on("input", function(msg)
                    {
                        try
                        {
                            count++;
                            msg.should.have.property("payload", "test" + ((count <= 7) ? 1 : 2));
                            if (count <= 7)
                            {
                                msg.should.have.property("until", null);
                            }
                        }
                        catch (e)
                        {
                            done(e);
                        }
                    });

                    rn1.receive({payload: "test1", until: null});
                    curTime += 1000;
                    clock.tick(1000);
                    curTime += 1000;
                    clock.tick(1000);
                    curTime += 1000;
                    clock.tick(1000);
                    curTime += 1000;
                    clock.tick(1000);
                    curTime += 1000;
                    clock.tick(1000);
                    curTime += 1000;
                    clock.tick(1000);
                    clock.setTimeout.should.be.calledWith(sinon.match.any, 1000).and.have.callCount(7);
                    clock.setTimeout.resetHistory();
                    curTime = 0;
                    rn1.receive({payload: "test2"});
                    curTime += 1000;
                    clock.tick(1000);
                    curTime += 1000;
                    clock.tick(1000);
                    curTime += 1000;
                    clock.tick(1000);
                    curTime += 1000;
                    clock.tick(1000);
                    curTime += 1000;
                    clock.tick(1000);
                    curTime += 1000;
                    clock.tick(1000);
                    clock.setTimeout.should.be.calledWith(sinon.match.any, 1000).and.have.callCount(3);
                    done();
                }
                catch (e)
                {
                    done(e);
                }
            });

        });

        function testInvalidUntilOverride(title, override)
        {
            it("should fall back to configured ending time: " + title, function(done)
            {
                const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", wires: [["hn1"]], mode: "simple", interval: 1, intervalUnit: "seconds", crontab: "", untilType: "time", untilValue: "00:00:03", untilOffset: 0, untilRandom: false, msgIngress: "forward:forced", preserveCtrlProps: true}, hlpNode, cfgNode];
                sinon.spy(clock, "setTimeout");

                helper.load([configNode, repeatNode], flow, credentials, function()
                {
                    try
                    {
                        const rn1 = helper.getNode("rn1");
                        const hn1 = helper.getNode("hn1");

                        hn1.on("input", function(msg)
                        {
                            try
                            {
                                msg.should.have.property("payload", "test");
                                msg.should.have.property("until", override);
                            }
                            catch (e)
                            {
                                done(e);
                            }
                        });

                        rn1.receive({payload: "test", until: override});
                        curTime += 1000;
                        clock.tick(1000);
                        curTime += 1000;
                        clock.tick(1000);
                        curTime += 1000;
                        clock.tick(1000);
                        curTime += 1000;
                        clock.tick(1000);
                        curTime += 1000;
                        clock.tick(1000);
                        curTime += 1000;
                        clock.tick(1000);
                        clock.setTimeout.should.be.calledWith(sinon.match.any, 1000).and.have.callCount(3);
                        done();
                    }
                    catch (e)
                    {
                        done(e);
                    }
                });
            });
        }

        testInvalidUntilOverride("invalid override", "invalid");
        testInvalidUntilOverride("empty override", {});

        testInvalidUntilOverride("no type", {value: "00:01", offset: 0, random: false});
        testInvalidUntilOverride("no value", {type: "time", offset: 0, random: false});

        testInvalidUntilOverride("override type no string", {type: 5, value: "00:01", offset: 0, random: false});
        testInvalidUntilOverride("override type wrong string", {type: "invalid", value: "00:01", offset: 0, random: false});
        testInvalidUntilOverride("override value wrong type", {type: "time", value: null, offset: 0, random: false});
        testInvalidUntilOverride("override value invalid time", {type: "time", value: "12_14", offset: 0, random: false});
        testInvalidUntilOverride("override value invalid sun position", {type: "sun", value: "invalid", offset: 0, random: false});
        testInvalidUntilOverride("override value invalid moon position", {type: "moon", value: "invalid", offset: 0, random: false});
        testInvalidUntilOverride("override date wrong type", {type: "time", value: "00:01", date: 42, offset: "invalid", random: false});
        testInvalidUntilOverride("override date invalid format", {type: "time", value: "00:01", date: "invalid", offset: "invalid", random: false});
        testInvalidUntilOverride("override offset wrong type", {type: "time", value: "00:01", offset: "invalid", random: false});
        testInvalidUntilOverride("override offset too small", {type: "time", value: "00:01", offset: -301, random: false});
        testInvalidUntilOverride("override offset too large", {type: "time", value: "00:01", offset: 301, random: false});
        testInvalidUntilOverride("override random wrong type", {type: "time", value: "00:01", offset: 0, random: "invalid"});
    });

    context("message repeating in advanced mode", function()
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

        it("should repeat according to cron table", function(done)
        {
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", wires: [["hn1"]], mode: "advanced", interval: 1, intervalUnit: "seconds", crontab: "*/2 * * * * *", untilType: "nextMsg", untilValue: "", untilOffset: 0, untilRandom: false, msgIngress: "forward:forced", preserveCtrlProps: true}, hlpNode, cfgNode];

            helper.load([configNode, repeatNode], flow, credentials, function()
            {
                try
                {
                    const rn1 = helper.getNode("rn1");
                    const hn1 = helper.getNode("hn1");

                    let numOutMsgs = 0;
                    hn1.on("input", function(msg)
                    {
                        try
                        {
                            numOutMsgs++;
                            msg.should.have.property("payload", "test");

                            if (numOutMsgs == 4)
                            {
                                done();
                            }
                        }
                        catch (e)
                        {
                            done(e);
                        }
                    });

                    rn1.receive({payload: "test"});
                    clock.tick(2000);
                    clock.tick(2000);
                    clock.tick(2000);
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should not repeat due to no first trigger", function(done)
        {
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", wires: [["hn1"]], mode: "advanced", interval: 1, intervalUnit: "seconds", crontab: "*/2 * * * * *", untilType: "nextMsg", untilValue: "", untilOffset: 0, untilRandom: false, msgIngress: "noop", preserveCtrlProps: true}, hlpNode, cfgNode];

            cronosjs.CronosExpression.parse.restore();
            sinon.stub(cronosjs.CronosExpression, "parse").returns({nextDate: () => null});

            helper.load([configNode, repeatNode], flow, credentials, function()
            {
                try
                {
                    const rn1 = helper.getNode("rn1");
                    const hn1 = helper.getNode("hn1");

                    hn1.on("input", function(msg)
                    {
                        done("unexpected message received");
                    });

                    rn1.receive({payload: "test"});
                    clock.tick(2000);
                    should(rn1.sendTime).be.null();
                    should(rn1.repeatTimer).be.undefined();
                    done();
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should not repeat due to exceeded end time", function(done)
        {
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", wires: [["hn1"]], mode: "advanced", interval: 1, intervalUnit: "seconds", crontab: "*/2 * * * * *", untilType: "time", untilValue: "00:00", untilOffset: 0, untilRandom: false, msgIngress: "noop", preserveCtrlProps: true}, hlpNode, cfgNode];

            helper.load([configNode, repeatNode], flow, credentials, function()
            {
                try
                {
                    const rn1 = helper.getNode("rn1");
                    const hn1 = helper.getNode("hn1");

                    hn1.on("input", function(msg)
                    {
                        done("unexpected message received");
                    });

                    rn1.receive({payload: "test"});
                    clock.tick(2000);
                    should(rn1.sendTime).be.null();
                    should(rn1.repeatTimer).be.undefined();
                    done();
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should repeat only once due to no second trigger", function(done)
        {
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", wires: [["hn1"]], mode: "advanced", interval: 1, intervalUnit: "seconds", crontab: "0 0 0 1 12 * 1970", untilType: "nextMsg", untilValue: "", untilOffset: 0, untilRandom: false, msgIngress: "noop", preserveCtrlProps: true}, hlpNode, cfgNode];

            helper.load([configNode, repeatNode], flow, credentials, function()
            {
                try
                {
                    const rn1 = helper.getNode("rn1");
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

                    rn1.receive({payload: "test"});
                    clock.tick(28857600000);
                    should(rn1.sendTime).be.null();
                    should(rn1.repeatTimer).be.undefined();
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should repeat only once due to exceeded end time", function(done)
        {
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", wires: [["hn1"]], mode: "advanced", interval: 1, intervalUnit: "seconds", crontab: "0 * * * * *", untilType: "time", untilValue: "00:01", untilOffset: 0, untilRandom: false, msgIngress: "noop", preserveCtrlProps: true}, hlpNode, cfgNode];

            helper.load([configNode, repeatNode], flow, credentials, function()
            {
                try
                {
                    const rn1 = helper.getNode("rn1");
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

                    rn1.receive({payload: "test"});
                    clock.tick(60000);
                    should(rn1.sendTime).be.null();
                    should(rn1.repeatTimer).be.undefined();
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should override cron table", function(done)
        {
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", wires: [["hn1"]], mode: "advanced", interval: 1, intervalUnit: "seconds", crontab: "*/2 * * * * *", untilType: "nextMsg", untilValue: "", untilOffset: 0, untilRandom: false, msgIngress: "forward:forced", preserveCtrlProps: true}, hlpNode, cfgNode];

            helper.load([configNode, repeatNode], flow, credentials, function()
            {
                try
                {
                    const rn1 = helper.getNode("rn1");
                    const hn1 = helper.getNode("hn1");

                    let numOutMsgs = 0;
                    hn1.on("input", function(msg)
                    {
                        try
                        {
                            numOutMsgs++;
                            msg.should.have.property("payload", "test");
                            msg.should.have.property("crontab", "*/4 * * * * *");

                            if (numOutMsgs == 4)
                            {
                                done();
                            }
                        }
                        catch (e)
                        {
                            done(e);
                        }
                    });

                    rn1.receive({payload: "test", crontab: "*/4 * * * * *"});
                    clock.tick(4000);
                    clock.tick(4000);
                    clock.tick(4000);
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should override cron table and not preserve", function(done)
        {
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", wires: [["hn1"]], mode: "advanced", interval: 1, intervalUnit: "seconds", crontab: "*/2 * * * * *", untilType: "nextMsg", untilValue: "", untilOffset: 0, untilRandom: false, msgIngress: "forward:forced", preserveCtrlProps: false}, hlpNode, cfgNode];

            helper.load([configNode, repeatNode], flow, credentials, function()
            {
                try
                {
                    const rn1 = helper.getNode("rn1");
                    const hn1 = helper.getNode("hn1");

                    let numOutMsgs = 0;
                    hn1.on("input", function(msg)
                    {
                        try
                        {
                            numOutMsgs++;
                            msg.should.have.property("payload", "test");
                            msg.should.not.have.property("crontab");

                            if (numOutMsgs == 4)
                            {
                                done();
                            }
                        }
                        catch (e)
                        {
                            done(e);
                        }
                    });

                    rn1.receive({payload: "test", crontab: "*/4 * * * * *"});
                    clock.tick(4000);
                    clock.tick(4000);
                    clock.tick(4000);
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        function testInvalidCrontabOverride(title, override)
        {
            it("should fall back to configured cron table: " + title, function(done)
            {
                const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", wires: [["hn1"]], mode: "advanced", interval: 1, intervalUnit: "seconds", crontab: "*/2 * * * * *", untilType: "nextMsg", untilValue: "", untilOffset: 0, untilRandom: false, msgIngress: "forward:forced", preserveCtrlProps: true}, hlpNode, cfgNode];

                helper.load([configNode, repeatNode], flow, credentials, function()
                {
                    try
                    {
                        const rn1 = helper.getNode("rn1");
                        const hn1 = helper.getNode("hn1");

                        let numOutMsgs = 0;
                        hn1.on("input", function(msg)
                        {
                            try
                            {
                                numOutMsgs++;
                                msg.should.have.property("payload", "test");
                                msg.should.have.property("crontab", override);

                                if (numOutMsgs == 4)
                                {
                                    done();
                                }
                            }
                            catch (e)
                            {
                                done(e);
                            }
                        });

                        rn1.receive({payload: "test", crontab: override});
                        clock.tick(2000);
                        clock.tick(2000);
                        clock.tick(2000);
                    }
                    catch (e)
                    {
                        done(e);
                    }
                });
            });
        }

        testInvalidCrontabOverride("null override", null);
        testInvalidCrontabOverride("empty override", "");
        testInvalidCrontabOverride("invalid override", 42);
        testInvalidCrontabOverride("invalid cron table", "* * X * * J");
    });

    context("message repeating in custom mode", function()
    {
        let clock = null;
        let curTime = 0;

        beforeEach(function()
        {
            curTime = 0;
            clock = sinon.useFakeTimers({toFake: ["Date", "setTimeout", "clearTimeout"]});
            sinon.stub(chronos, "getCurrentTime").callsFake(function() { return moment.utc(curTime); });
        });

        afterEach(function()
        {
            helper.unload();
            sinon.restore();
        });

        it("should repeat with relative next time", function(done)
        {
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", wires: [["hn1"]], mode: "custom", interval: 1, intervalUnit: "seconds", crontab: "", expression: "true", untilType: "nextMsg", untilValue: "", untilOffset: 0, untilRandom: false, msgIngress: "forward:forced", preserveCtrlProps: true}, hlpNode, cfgNode];

            sinon.stub(helper._RED.util, "evaluateJSONataExpression").returns(2000);
            helper.load([configNode, repeatNode], flow, credentials, function()
            {
                try
                {
                    const rn1 = helper.getNode("rn1");
                    const hn1 = helper.getNode("hn1");

                    let numOutMsgs = 0;
                    hn1.on("input", function(msg)
                    {
                        try
                        {
                            numOutMsgs++;
                            msg.should.have.property("payload", "test");

                            if (numOutMsgs == 4)
                            {
                                done();
                            }
                        }
                        catch (e)
                        {
                            done(e);
                        }
                    });

                    curTime = 1000000;
                    rn1.receive({payload: "test"});
                    curTime += 2000;
                    clock.tick(2000);
                    curTime += 2000;
                    clock.tick(2000);
                    curTime += 2000;
                    clock.tick(2000);
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should repeat with absolute next time", function(done)
        {
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", wires: [["hn1"]], mode: "custom", interval: 1, intervalUnit: "seconds", crontab: "", expression: "true", untilType: "nextMsg", untilValue: "", untilOffset: 0, untilRandom: false, msgIngress: "forward:forced", preserveCtrlProps: true}, hlpNode, cfgNode];

            sinon.stub(helper._RED.util, "evaluateJSONataExpression")
                        .onCall(0).returns(1002000)
                        .onCall(1).returns(1004000)
                        .onCall(2).returns(1006000)
                        .onCall(3).returns(1008000);

            helper.load([configNode, repeatNode], flow, credentials, function()
            {
                try
                {
                    const rn1 = helper.getNode("rn1");
                    const hn1 = helper.getNode("hn1");

                    let numOutMsgs = 0;
                    hn1.on("input", function(msg)
                    {
                        try
                        {
                            numOutMsgs++;
                            msg.should.have.property("payload", "test");

                            if (numOutMsgs == 4)
                            {
                                done();
                            }
                        }
                        catch (e)
                        {
                            done(e);
                        }
                    });

                    curTime = 1000000;
                    rn1.receive({payload: "test"});
                    curTime += 2000;
                    clock.tick(2000);
                    curTime += 2000;
                    clock.tick(2000);
                    curTime += 2000;
                    clock.tick(2000);
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should repeat with string-based absolute next time", function(done)
        {
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", wires: [["hn1"]], mode: "custom", interval: 1, intervalUnit: "seconds", crontab: "", expression: "true", untilType: "nextMsg", untilValue: "", untilOffset: 0, untilRandom: false, msgIngress: "forward:forced", preserveCtrlProps: true}, hlpNode, cfgNode];

            sinon.stub(helper._RED.util, "evaluateJSONataExpression")
                        .onCall(0).returns("1970-01-01T00:16:42.000+0000")
                        .onCall(1).returns("1970-01-01T00:16:44.000+0000")
                        .onCall(2).returns("1970-01-01T00:16:46.000+0000")
                        .onCall(3).returns("1970-01-01T00:16:48.000+0000");

            helper.load([configNode, repeatNode], flow, credentials, function()
            {
                try
                {
                    const rn1 = helper.getNode("rn1");
                    const hn1 = helper.getNode("hn1");

                    let numOutMsgs = 0;
                    hn1.on("input", function(msg)
                    {
                        try
                        {
                            numOutMsgs++;
                            msg.should.have.property("payload", "test");

                            if (numOutMsgs == 4)
                            {
                                done();
                            }
                        }
                        catch (e)
                        {
                            done(e);
                        }
                    });

                    curTime = 1000000;
                    rn1.receive({payload: "test"});
                    curTime += 2000;
                    clock.tick(2000);
                    curTime += 2000;
                    clock.tick(2000);
                    curTime += 2000;
                    clock.tick(2000);
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should repeat only once due to exceeded end time", function(done)
        {
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", wires: [["hn1"]], mode: "custom", interval: 1, intervalUnit: "seconds", crontab: "", expression: "60000", untilType: "time", untilValue: "00:01", untilOffset: 0, untilRandom: false, msgIngress: "noop", preserveCtrlProps: true}, hlpNode, cfgNode];

            helper.load([configNode, repeatNode], flow, credentials, function()
            {
                try
                {
                    const rn1 = helper.getNode("rn1");
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

                    rn1.receive({payload: "test"});
                    curTime += 60000;
                    clock.tick(60000);
                    should(rn1.sendTime).be.null();
                    should(rn1.repeatTimer).be.undefined();
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should override expression", function(done)
        {
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", wires: [["hn1"]], mode: "custom", interval: 1, intervalUnit: "seconds", crontab: "", expression: "2000", untilType: "nextMsg", untilValue: "", untilOffset: 0, untilRandom: false, msgIngress: "forward:forced", preserveCtrlProps: true}, hlpNode, cfgNode];

            helper.load([configNode, repeatNode], flow, credentials, function()
            {
                try
                {
                    const rn1 = helper.getNode("rn1");
                    const hn1 = helper.getNode("hn1");

                    let numOutMsgs = 0;
                    hn1.on("input", function(msg)
                    {
                        try
                        {
                            numOutMsgs++;
                            msg.should.have.property("payload", "test");
                            msg.should.have.property("expression", "4000");

                            if (numOutMsgs == 4)
                            {
                                done();
                            }
                        }
                        catch (e)
                        {
                            done(e);
                        }
                    });

                    rn1.receive({payload: "test", expression: "4000"});
                    clock.tick(4000);
                    clock.tick(4000);
                    clock.tick(4000);
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should override expression and not preserve", function(done)
        {
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", wires: [["hn1"]], mode: "custom", interval: 1, intervalUnit: "seconds", crontab: "", expression: "2000", untilType: "nextMsg", untilValue: "", untilOffset: 0, untilRandom: false, msgIngress: "forward:forced", preserveCtrlProps: false}, hlpNode, cfgNode];

            helper.load([configNode, repeatNode], flow, credentials, function()
            {
                try
                {
                    const rn1 = helper.getNode("rn1");
                    const hn1 = helper.getNode("hn1");

                    let numOutMsgs = 0;
                    hn1.on("input", function(msg)
                    {
                        try
                        {
                            numOutMsgs++;
                            msg.should.have.property("payload", "test");
                            msg.should.not.have.property("expression");

                            if (numOutMsgs == 4)
                            {
                                done();
                            }
                        }
                        catch (e)
                        {
                            done(e);
                        }
                    });

                    rn1.receive({payload: "test", expression: "4000"});
                    clock.tick(4000);
                    clock.tick(4000);
                    clock.tick(4000);
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        function testInvalidExpressionOverride(title, override)
        {
            it("should fall back to configured expression: " + title, function(done)
            {
                const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", wires: [["hn1"]], mode: "custom", interval: 1, intervalUnit: "seconds", crontab: "", expression: "2000", untilType: "nextMsg", untilValue: "", untilOffset: 0, untilRandom: false, msgIngress: "forward:forced", preserveCtrlProps: true}, hlpNode, cfgNode];

                helper.load([configNode, repeatNode], flow, credentials, function()
                {
                    try
                    {
                        const rn1 = helper.getNode("rn1");
                        const hn1 = helper.getNode("hn1");

                        let numOutMsgs = 0;
                        hn1.on("input", function(msg)
                        {
                            try
                            {
                                numOutMsgs++;
                                msg.should.have.property("payload", "test");
                                msg.should.have.property("expression", override);

                                if (numOutMsgs == 4)
                                {
                                    done();
                                }
                            }
                            catch (e)
                            {
                                done(e);
                            }
                        });

                        rn1.receive({payload: "test", expression: override});
                        clock.tick(2000);
                        clock.tick(2000);
                        clock.tick(2000);
                    }
                    catch (e)
                    {
                        done(e);
                    }
                });
            });
        }

        testInvalidExpressionOverride("null override", null);
        testInvalidExpressionOverride("empty override", "");
        testInvalidExpressionOverride("invalid override", 42);

        it("should handle time error caused by JSONata expression (invalid expression 1)", async function()
        {
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", mode: "custom", interval: 1, intervalUnit: "seconds", crontab: "", expression: "invalid[", untilType: "nextMsg", untilValue: "", untilDate: "", untilOffset: 0, untilRandom: false, msgIngress: "forward:forced", preserveCtrlProps: false}, cfgNode];

            await helper.load([configNode, repeatNode], flow, credentials);
            const rn1 = helper.getNode("rn1");

            rn1.receive({payload: "test"});
            rn1.error.should.be.calledWith("node-red-contrib-chronos/chronos-config:common.error.evaluationFailed", {payload: "test", _msgid: sinon.match.any, errorDetails: {expression: "invalid[", code: sinon.match.any, description: sinon.match.any, position: sinon.match.any, token: sinon.match.any, value: sinon.match.any}});
        });

        it("should handle time error caused by JSONata expression (invalid expression 2)", async function()
        {
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", mode: "custom", interval: 1, intervalUnit: "seconds", crontab: "", expression: "$invalFunc()", untilType: "nextMsg", untilValue: "", untilDate: "", untilOffset: 0, untilRandom: false, msgIngress: "forward:forced", preserveCtrlProps: false}, cfgNode];

            await helper.load([configNode, repeatNode], flow, credentials);
            const rn1 = helper.getNode("rn1");

            rn1.receive({payload: "test"});
            rn1.error.should.be.calledWith("node-red-contrib-chronos/chronos-config:common.error.evaluationFailed", {payload: "test", _msgid: sinon.match.any, errorDetails: {expression: "$invalFunc()", code: sinon.match.any, description: sinon.match.any, position: sinon.match.any, token: sinon.match.any}});
        });

        it("should handle time error caused by JSONata expression (not time value)", async function()
        {
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", mode: "custom", interval: 1, intervalUnit: "seconds", crontab: "", expression: "true", untilType: "nextMsg", untilValue: "", untilDate: "", untilOffset: 0, untilRandom: false, msgIngress: "forward:forced", preserveCtrlProps: false}, cfgNode];

            await helper.load([configNode, repeatNode], flow, credentials);
            const rn1 = helper.getNode("rn1");

            rn1.receive({payload: "test"});
            rn1.error.should.be.calledWith("node-red-contrib-chronos/chronos-config:common.error.notTime", {payload: "test", _msgid: sinon.match.any, errorDetails: {expression: "true", result: true}});
        });

        it("should handle time error caused by JSONata expression (interval too small)", async function()
        {
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", mode: "custom", interval: 1, intervalUnit: "seconds", crontab: "", expression: "999", untilType: "nextMsg", untilValue: "", untilDate: "", untilOffset: 0, untilRandom: false, msgIngress: "forward:forced", preserveCtrlProps: false}, cfgNode];

            await helper.load([configNode, repeatNode], flow, credentials);
            const rn1 = helper.getNode("rn1");

            rn1.receive({payload: "test"});
            rn1.error.should.be.calledWith("node-red-contrib-chronos/chronos-config:common.error.intervalOutOfRange", {payload: "test", _msgid: sinon.match.any, errorDetails: {expression: "999", result: 999}});
        });

        it("should handle time error caused by JSONata expression (interval too large)", async function()
        {
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", mode: "custom", interval: 1, intervalUnit: "seconds", crontab: "", expression: "604800001", untilType: "nextMsg", untilValue: "", untilDate: "", untilOffset: 0, untilRandom: false, msgIngress: "forward:forced", preserveCtrlProps: false}, cfgNode];

            await helper.load([configNode, repeatNode], flow, credentials);
            const rn1 = helper.getNode("rn1");

            rn1.receive({payload: "test"});
            rn1.error.should.be.calledWith("node-red-contrib-chronos/chronos-config:common.error.intervalOutOfRange", {payload: "test", _msgid: sinon.match.any, errorDetails: {expression: "604800001", result: 604800001}});
        });

        it("should handle time error caused by JSONata expression (invalid time)", async function()
        {
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", mode: "custom", interval: 1, intervalUnit: "seconds", crontab: "", expression: "\"invalid\"", untilType: "nextMsg", untilValue: "", untilDate: "", untilOffset: 0, untilRandom: false, msgIngress: "forward:forced", preserveCtrlProps: false}, cfgNode];

            await helper.load([configNode, repeatNode], flow, credentials);
            const rn1 = helper.getNode("rn1");

            rn1.receive({payload: "test"});
            rn1.error.should.be.calledWith("node-red-contrib-chronos/chronos-config:common.error.notTime", {payload: "test", _msgid: sinon.match.any, errorDetails: {expression: "\"invalid\"", result: "invalid"}});
        });
    });
});
