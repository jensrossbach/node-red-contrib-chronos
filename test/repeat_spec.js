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
const cfgNodeInvalidTZ = {id: "cn1", type: "chronos-config", name: "config", timezone: "invalid"};
const repeatNode = require("../nodes/repeat.js");
const chronos = require("../nodes/common/chronos.js");
const moment = require("moment");
const cronosjs = require("cronosjs");

require("should-sinon");

const cfgNode = {id: "cn1", type: "chronos-config", name: "config"};
const hlpNode = {id: "hn1", type: "helper"};
const credentials = {"cn1": {latitude: "50", longitude: "10"}};

describe("repeat node", function()
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
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", mode: "simple", interval: 1, intervalUnit: "seconds", crontab: "*/5 * * * * *", customRepetitionType: "flow", customRepetitionValue: "myVar", untilType: "time", untilValue: "12:00", untilOffset: 0, untilRandom: false, preserveCtrlProps: true, ignoreCtrlProps: true, msgIngress: "forward"}, cfgNode];

            await helper.load([configNode, repeatNode], flow, credentials);
            const rn1 = helper.getNode("rn1");
            rn1.status.should.be.calledOnce();
            rn1.should.have.property("name", "repeat");
            rn1.should.have.property("mode", "simple");
            rn1.should.have.property("interval", 1);
            rn1.should.have.property("intervalUnit", "seconds");
            rn1.should.have.property("crontab", "*/5 * * * * *");
            rn1.should.have.property("customRepetitionType", "flow");
            rn1.should.have.property("customRepetitionValue", "myVar");
            rn1.should.have.property("untilType", "time");
            rn1.should.have.property("untilValue", "12:00");
            rn1.should.have.property("untilOffset", 0);
            rn1.should.have.property("untilRandom", false);
            rn1.should.have.property("preserveCtrlProps", true);
            rn1.should.have.property("ignoreCtrlProps", true);
            rn1.should.have.property("msgIngress", "forward");
        });

        it("should preserve backward compatibility", async function()
        {
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", interval: 1, intervalUnit: "seconds", expression: "myExpression", untilType: "time", untilValue: "12:00", untilOffset: 0, untilRandom: false, preserveCtrlProps: true}, cfgNode];

            await helper.load([configNode, repeatNode], flow, credentials);
            const rn1 = helper.getNode("rn1");
            rn1.status.should.be.calledOnce();
            rn1.should.have.property("name", "repeat");
            rn1.should.have.property("mode", "simple");
            rn1.should.have.property("interval", 1);
            rn1.should.have.property("intervalUnit", "seconds");
            rn1.should.have.property("crontab", "");
            rn1.should.have.property("customRepetitionType", "jsonata");
            rn1.should.have.property("customRepetitionValue", "myExpression");
            rn1.should.have.property("untilValue", "12:00");
            rn1.should.have.property("untilType", "time");
            rn1.should.have.property("untilValue", "12:00");
            rn1.should.have.property("untilOffset", 0);
            rn1.should.have.property("untilRandom", false);
            rn1.should.have.property("preserveCtrlProps", true);
            rn1.should.have.property("msgIngress", "forward:forced");
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

        it("should fail due to invalid expression", async function()
        {
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", mode: "custom", interval: 1, intervalUnit: "seconds", crontab: "", customRepetitionType: "jsonata", customRepetitionValue: "invalid[", untilType: "nextMsg", untilValue: "", untilDate: "", untilOffset: 0, untilRandom: false, msgIngress: "forward:forced", preserveCtrlProps: false}, cfgNode];

            await helper.load([configNode, repeatNode], flow, credentials);
            const rn1 = helper.getNode("rn1");

            rn1.receive({payload: "test"});
            rn1.error.getCall(0).should.be.calledWith("Expected \"]\" before end of expression");
            rn1.error.getCall(1).should.be.calledWith("node-red-contrib-chronos/chronos-config:common.error.invalidConfig");
        });

        it("should fail due to invalid until time", async function()
        {
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", mode: "simple", interval: 1, intervalUnit: "seconds", crontab: "", untilType: "time", untilValue: "invalid", untilOffset: 0, untilRandom: false, preserveCtrlProps: true}, cfgNode];

            await helper.load([configNode, repeatNode], flow, credentials);
            const rn1 = helper.getNode("rn1");
            rn1.status.should.be.calledTwice();
            rn1.error.should.be.calledOnce().and.calledWith("node-red-contrib-chronos/chronos-config:common.error.invalidConfig");
        });

        it("should fail due to invalid until expression", async function()
        {
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", mode: "simple", interval: 1, intervalUnit: "seconds", crontab: "", untilType: "jsonata", untilValue: "invalid[", untilDate: "", untilOffset: 0, untilRandom: false, msgIngress: "forward:forced", preserveCtrlProps: false}, cfgNode];

            await helper.load([configNode, repeatNode], flow, credentials);
            const rn1 = helper.getNode("rn1");

            rn1.receive({payload: "test"});
            rn1.error.getCall(0).should.be.calledWith("Expected \"]\" before end of expression");
            rn1.error.getCall(1).should.be.calledWith("node-red-contrib-chronos/chronos-config:common.error.invalidConfig");
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
                    const rn1 = helper.getNode("rn1");
                    const hn1 = helper.getNode("hn1");
                    let statusCount = 0;
                    let inputCount = 0;

                    hn1.on("input", function(msg)
                    {
                        try
                        {
                            inputCount++;
                            msg.should.have.property("payload", "test");

                            if (inputCount == 4)  // 1 message after receive + 3 messages after 3 intervals
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
                    rn1.on("call:status", status =>
                    {
                        try
                        {
                            statusCount++;

                            if (statusCount > 1)  // first status is inital empty one
                            {
                                status.should.be.calledWith({fill: "blue", shape: "dot", text: sinon.match.any});
                                clock.setTimeout.should.be.calledWith(sinon.match.any, intvMs);

                                if (statusCount < 5)
                                {
                                    clock.tick(intvMs);  // advance clock 3 times
                                }
                            }
                        }
                        catch (e)
                        {
                            done(e);
                        }
                    });
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
                const rn1 = helper.getNode("rn1");
                const hn1 = helper.getNode("hn1");
                let statusCount = 0;
                let inputCount = 0;

                hn1.on("input", function(msg)
                {
                    try
                    {
                        inputCount++;
                        msg.should.have.property("payload", "test" + ((inputCount <= 3) ? 1 : 2));

                        if (inputCount == 6)  // 2 messages after 2 receives + 4 messages after 4 intervals
                        {
                            done();
                        }
                    }
                    catch (e)
                    {
                        done(e);
                    }
                });

                rn1.receive({payload: "test1"});
                rn1.on("call:status", status =>
                {
                    try
                    {
                        statusCount++;

                        if (statusCount > 1)  // first status is inital empty one
                        {
                            status.should.be.calledWith({fill: "blue", shape: "dot", text: sinon.match.any});
                            clock.setTimeout.should.be.calledWith(sinon.match.any, 1000);

                            if (statusCount < 4)
                            {
                                clock.tick(1000);  // advance clock 2 times
                            }
                            else if (statusCount == 4)
                            {
                                rn1.receive({payload: "test2"});
                            }
                            else if (statusCount < 7)
                            {
                                clock.tick(1000);  // advance clock 2 times
                            }
                        }
                    }
                    catch (e)
                    {
                        done(e);
                    }
                });
            });
        });

        it("should repeat message until stopped", function(done)
        {
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", wires: [["hn1"]], mode: "simple", interval: 1, intervalUnit: "seconds", crontab: "", untilType: "nextMsg", untilValue: "", untilOffset: 0, untilRandom: false, msgIngress: "forward:forced", preserveCtrlProps: true}, hlpNode, cfgNode];
            sinon.spy(clock, "setTimeout");
            sinon.spy(clock, "clearTimeout");

            helper.load([configNode, repeatNode], flow, credentials, function()
            {
                const rn1 = helper.getNode("rn1");
                const hn1 = helper.getNode("hn1");
                let statusCount = 0;
                let inputCount = 0;

                hn1.on("input", function(msg)
                {
                    try
                    {
                        inputCount++;
                        if (inputCount <= 3)  // 1 message after receive + 2 messages after 2 intervals
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
                rn1.on("call:status", status =>
                {
                    try
                    {
                        statusCount++;

                        if (statusCount > 1)  // first status is inital empty one
                        {
                            if (statusCount < 4)
                            {
                                status.should.be.calledWith({fill: "blue", shape: "dot", text: sinon.match.any});
                                clock.tick(1000);  // advance clock 2 times
                            }
                            else if (statusCount == 4)
                            {
                                status.should.be.calledWith({fill: "blue", shape: "dot", text: sinon.match.any});
                                clock.setTimeout.should.be.calledWith(sinon.match.any, 1000).and.have.callCount(3);
                                clock.setTimeout.resetHistory()
                                rn1.receive({stop: true});
                            }
                            else if (statusCount == 5)
                            {
                                status.should.be.calledWith({});
                                clock.clearTimeout.should.be.called();
                                should(rn1.sendTime).be.null();
                                done();
                            }
                        }
                    }
                    catch (e)
                    {
                        done(e);
                    }
                });
            });
        });

        it("should override interval", function(done)
        {
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", wires: [["hn1"]], mode: "simple", interval: 1, intervalUnit: "seconds", crontab: "", untilType: "nextMsg", untilValue: "", untilOffset: 0, untilRandom: false, msgIngress: "forward:forced", preserveCtrlProps: true}, hlpNode, cfgNode];
            sinon.spy(clock, "setTimeout");

            helper.load([configNode, repeatNode], flow, credentials, function()
            {
                const rn1 = helper.getNode("rn1");
                const hn1 = helper.getNode("hn1");
                let statusCount = 0;
                let inputCount = 0;

                hn1.on("input", function(msg)
                {
                    try
                    {
                        inputCount++;
                        msg.should.have.property("payload", "test" + ((inputCount <= 3) ? 1 : 2));
                        msg.should.have.property("interval", {value: ((inputCount <= 3) ? 2 : 3), unit: "seconds"});

                        if (inputCount == 6)  // 2 messages after 2 receives + 4 messages after 4 intervals
                        {
                            done();
                        }
                    }
                    catch (e)
                    {
                        done(e);
                    }
                });

                rn1.receive({payload: "test1", interval: {value: 2, unit: "seconds"}});
                rn1.on("call:status", status =>
                {
                    try
                    {
                        statusCount++;

                        if (statusCount > 1)  // first status is inital empty one
                        {
                            if (statusCount < 4)
                            {
                                status.should.be.calledWith({fill: "blue", shape: "dot", text: sinon.match.any});
                                clock.setTimeout.should.be.calledWith(sinon.match.any, 2000);
                                clock.tick(2000);  // advance clock 2 times
                            }
                            else if (statusCount == 4)
                            {
                                status.should.be.calledWith({fill: "blue", shape: "dot", text: sinon.match.any});
                                rn1.receive({payload: "test2", interval: {value: 3, unit: "seconds"}});
                            }
                            else if (statusCount < 7)
                            {
                                status.should.be.calledWith({fill: "blue", shape: "dot", text: sinon.match.any});
                                clock.setTimeout.should.be.calledWith(sinon.match.any, 3000);
                                clock.tick(3000);  // advance clock 2 times
                            }
                        }
                    }
                    catch (e)
                    {
                        done(e);
                    }
                });
            });
        });

        it("should override interval and not preserve", function(done)
        {
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", wires: [["hn1"]], mode: "simple", interval: 1, intervalUnit: "seconds", crontab: "", untilType: "nextMsg", untilValue: "", untilOffset: 0, untilRandom: false, msgIngress: "forward:forced", preserveCtrlProps: false}, hlpNode, cfgNode];
            sinon.spy(clock, "setTimeout");

            helper.load([configNode, repeatNode], flow, credentials, function()
            {
                const rn1 = helper.getNode("rn1");
                const hn1 = helper.getNode("hn1");
                let statusCount = 0;
                let inputCount = 0;

                hn1.on("input", function(msg)
                {
                    try
                    {
                        inputCount++;
                        msg.should.have.property("payload", "test" + ((inputCount <= 3) ? 1 : 2));
                        msg.should.not.have.property("interval");

                        if (inputCount == 6)  // 2 messages after 2 receives + 4 messages after 4 intervals
                        {
                            done();
                        }
                    }
                    catch (e)
                    {
                        done(e);
                    }
                });

                rn1.receive({payload: "test1", interval: {value: 2, unit: "seconds"}});
                rn1.on("call:status", status =>
                {
                    try
                    {
                        statusCount++;

                        if (statusCount > 1)  // first status is inital empty one
                        {
                            if (statusCount < 4)
                            {
                                status.should.be.calledWith({fill: "blue", shape: "dot", text: sinon.match.any});
                                clock.setTimeout.should.be.calledWith(sinon.match.any, 2000);
                                clock.tick(2000);  // advance clock 2 times
                            }
                            else if (statusCount == 4)
                            {
                                status.should.be.calledWith({fill: "blue", shape: "dot", text: sinon.match.any});
                                rn1.receive({payload: "test2", interval: {value: 3, unit: "seconds"}});
                            }
                            else if (statusCount < 7)
                            {
                                status.should.be.calledWith({fill: "blue", shape: "dot", text: sinon.match.any});
                                clock.setTimeout.should.be.calledWith(sinon.match.any, 3000);
                                clock.tick(3000);  // advance clock 2 times
                            }
                        }
                    }
                    catch (e)
                    {
                        done(e);
                    }
                });
            });
        });

        function testIgnoredIntervalOverride(title, override, ignore = false)
        {
            it("should fall back to configured interval: " + title, function(done)
            {
                const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", wires: [["hn1"]], mode: "simple", interval: 1, intervalUnit: "seconds", crontab: "", untilType: "nextMsg", untilValue: "", untilOffset: 0, untilRandom: false, msgIngress: "forward:forced", preserveCtrlProps: true, ignoreCtrlProps: ignore}, hlpNode, cfgNode];
                sinon.spy(clock, "setTimeout");

                helper.load([configNode, repeatNode], flow, credentials, function()
                {
                    const rn1 = helper.getNode("rn1");
                    const hn1 = helper.getNode("hn1");
                    let statusCount = 0;
                    let inputCount = 0;

                    hn1.on("input", function(msg)
                    {
                        try
                        {
                            inputCount++;
                            msg.should.have.property("payload", "test");
                            msg.should.have.property("interval", override);

                            if (inputCount == 5)  // 1 messages after receive + 4 messages after 4 intervals
                            {
                                done();
                            }
                        }
                        catch (e)
                        {
                            done(e);
                        }
                    });

                    rn1.receive({payload: "test", interval: override});
                    rn1.on("call:status", status =>
                    {
                        try
                        {
                            statusCount++;

                            if (statusCount > 1)  // first status is inital empty one
                            {
                                if (statusCount < 6)
                                {
                                    status.should.be.calledWith({fill: "blue", shape: "dot", text: sinon.match.any});
                                    clock.setTimeout.should.be.calledWith(sinon.match.any, 1000);
                                    clock.tick(2000);  // advance clock 4 times
                                }
                                else if (statusCount > 6)
                                {
                                    done("Too many status calls");
                                }
                            }
                        }
                        catch (e)
                        {
                            done(e);
                        }
                    });
                });
            });
        }

        testIgnoredIntervalOverride("invalid override", "invalid");
        testIgnoredIntervalOverride("null override", null);
        testIgnoredIntervalOverride("empty override", {});

        testIgnoredIntervalOverride("no value", {unit: "hours"});
        testIgnoredIntervalOverride("no uniot", {value: 4});

        testIgnoredIntervalOverride("invalid unit", {value: 4, unit: "invalid"});
        testIgnoredIntervalOverride("invalid value", {value: "invalid", unit: "seconds"});
        testIgnoredIntervalOverride("value too small for seconds", {value: 0, unit: "seconds"});
        testIgnoredIntervalOverride("value too large for seconds", {value: 60, unit: "seconds"});
        testIgnoredIntervalOverride("value too small for minutes", {value: 0, unit: "minutes"});
        testIgnoredIntervalOverride("value too large for minutes", {value: 60, unit: "minutes"});
        testIgnoredIntervalOverride("value too small for hours", {value: 0, unit: "hours"});
        testIgnoredIntervalOverride("value too large for hours", {value: 25, unit: "hours"});

        testIgnoredIntervalOverride("ignore control commands", 4000, true);

        function testErrorHandling(done, msg, errorArg1, errorArg2)
        {
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", mode: "simple", interval: 1, intervalUnit: "seconds", crontab: "", untilType: "time", untilValue: "00:00", untilDate: "", untilOffset: 0, untilRandom: false, msgIngress: "forward:forced", preserveCtrlProps: false}, cfgNode];

            helper.load([configNode, repeatNode], flow, credentials, function()
            {
                const rn1 = helper.getNode("rn1");

                rn1.receive(msg);
                rn1.on("call:error", error =>
                {
                    try
                    {
                        if (errorArg2)
                        {
                            error.should.be.calledWith(errorArg1, errorArg2);
                        }
                        else
                        {
                            error.should.be.calledWith(errorArg1);
                        }
                        done();
                    }
                    catch (e)
                    {
                        done(e);
                    }
                });
            });
        }

        it("should handle time error", function(done)
        {
            sinon.stub(chronos, "getTime").throws(function() { return new chronos.TimeError("time error", {type: "sun", value: "sunset"}); });
            testErrorHandling(done, {payload: "test"}, "time error", {_msgid: sinon.match.any, payload: "test", errorDetails: {type: "sun", value: "sunset"}});
        });

        it("should handle time error (rename errorDetails)", function(done)
        {
            sinon.stub(chronos, "getTime").throws(function() { return new chronos.TimeError("time error", {type: "sun", value: "sunset"}); });
            testErrorHandling(done, {payload: "test", errorDetails: "details"}, "time error", {_msgid: sinon.match.any, payload: "test", _errorDetails: "details", errorDetails: {type: "sun", value: "sunset"}});
        });

        it("should handle time error (no details)", function(done)
        {
            sinon.stub(chronos, "getTime").throws(function() { return new chronos.TimeError("time error", null); });
            testErrorHandling(done, {payload: "test"}, "time error", {_msgid: sinon.match.any, payload: "test"});
        });

        it("should handle other error", function(done)
        {
            sinon.stub(chronos, "getTime").throws("error", "error message");
            testErrorHandling(done, {payload: "test"}, "error message");
        });

        it("should handle time error caused by ending time (invalid JSONata expression)", function(done)
        {
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", mode: "simple", interval: 1, intervalUnit: "seconds", crontab: "", untilType: "jsonata", untilValue: "$invalFunc()", untilDate: "", untilOffset: 0, untilRandom: false, msgIngress: "forward:forced", preserveCtrlProps: false}, cfgNode];

            helper.load([configNode, repeatNode], flow, credentials, function()
            {
                const rn1 = helper.getNode("rn1");

                rn1.receive({payload: "test"});
                rn1.on("call:error", error =>
                {
                    try
                    {
                        error.should.be.calledWith("node-red-contrib-chronos/chronos-config:common.error.evaluationFailed", {payload: "test", _msgid: sinon.match.any, errorDetails: {expression: "$invalFunc()", code: sinon.match.any, description: sinon.match.any, position: sinon.match.any, token: sinon.match.any}});
                        done();
                    }
                    catch (e)
                    {
                        done(e);
                    }
                });
            });
        });

        it("should handle time error caused by ending time (not boolean)", function(done)
        {
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", mode: "simple", interval: 1, intervalUnit: "seconds", crontab: "", untilType: "jsonata", untilValue: "42", untilDate: "", untilOffset: 0, untilRandom: false, msgIngress: "forward:forced", preserveCtrlProps: false}, cfgNode];

            helper.load([configNode, repeatNode], flow, credentials, function()
            {
                const rn1 = helper.getNode("rn1");

                rn1.receive({payload: "test"});
                rn1.on("call:error", error =>
                {
                    try
                    {
                        error.should.be.calledWith("node-red-contrib-chronos/chronos-config:common.error.notBoolean", {payload: "test", _msgid: sinon.match.any, errorDetails: {expression: "42", result: 42}});
                        done();
                    }
                    catch (e)
                    {
                        done(e);
                    }
                });
            });
        });

        it("should handle time error caused by invalid ending time from context variable", function(done)
        {
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", mode: "simple", interval: 1, intervalUnit: "seconds", crontab: "", untilType: "flow", untilValue: "invalidVariable", untilDate: "", untilOffset: 0, untilRandom: false, msgIngress: "forward:forced", preserveCtrlProps: false}, cfgNode];
            const ctx = {flow: {}, global: {}};

            sinon.stub(helper._RED.util, "parseContextStore").returns({key: "testKey", store: "testStore"});

            helper.load([configNode, repeatNode], flow, credentials, function()
            {
                const rn1 = helper.getNode("rn1");

                sinon.stub(rn1, "context").returns(ctx);
                ctx.flow.get = sinon.fake.returns("42");
                ctx.global.get = sinon.fake.returns(undefined);

                rn1.receive({payload: "test"});
                rn1.on("call:error", error =>
                {
                    try
                    {
                        error.should.be.calledWith("node-red-contrib-chronos/chronos-config:common.error.invalidContext", {payload: "test", _msgid: sinon.match.any, errorDetails: {store: "testStore", key: "testKey", value: "42"}});
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
            sinon.spy(clock, "clearTimeout");

            helper.load([configNode, repeatNode], flow, credentials, function()
            {
                const rn1 = helper.getNode("rn1");
                const hn1 = helper.getNode("hn1");
                let statusCount = 0;
                let inputCount = 0;

                hn1.on("input", function(msg)
                {
                    try
                    {
                        inputCount++;
                        msg.should.have.property("payload", "test");

                        if (inputCount > 4)  // 1 messages after receive + 3 messages after 3 intervals
                        {
                            done("Too many messages received");
                        }
                    }
                    catch (e)
                    {
                        done(e);
                    }
                });

                rn1.receive({payload: "test"});
                rn1.on("call:status", status =>
                {
                    try
                    {
                        statusCount++;

                        if (statusCount > 1)  // first status is inital empty one
                        {
                            if (statusCount < 5)
                            {
                                status.should.be.calledWith({fill: "blue", shape: "dot", text: sinon.match.any});
                                clock.setTimeout.should.be.calledWith(sinon.match.any, 1000);

                                // advance clock 3 times
                                curTime += 1000;
                                clock.tick(1000);
                            }
                            else
                            {
                                status.should.be.calledWith({});
                                should(rn1.sendTime).be.null();

                                done();
                            }
                        }
                    }
                    catch (e)
                    {
                        done(e);
                    }
                });
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

        it("should repeat message until ending time from context variable is reached", function(done)
        {
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", wires: [["hn1"]], mode: "simple", interval: 1, intervalUnit: "seconds", crontab: "", untilType: "flow", untilValue: "testVariable", untilOffset: 0, untilRandom: false, msgIngress: "forward:forced", preserveCtrlProps: true}, hlpNode, cfgNode];
            const ctx = {flow: {}, global: {}};

            sinon.spy(clock, "setTimeout");
            sinon.stub(helper._RED.util, "parseContextStore").returns({key: "testKey", store: "testStore"});

            helper.load([configNode, repeatNode], flow, credentials, function()
            {
                try
                {
                    const rn1 = helper.getNode("rn1");
                    const hn1 = helper.getNode("hn1");

                    sinon.stub(rn1, "context").returns(ctx);
                    ctx.flow.get = sinon.fake.returns({type: "time", value: "00:00:03", offset: 0, random: false});
                    ctx.global.get = sinon.fake.returns(undefined);

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

                    helper._RED.util.parseContextStore.should.be.calledWith("testVariable");
                    rn1.context.should.be.calledOnce();
                    ctx.flow.get.should.be.calledWith("testKey", "testStore");

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

        it("should repeat message until ending date and time from context variable is reached", function(done)
        {
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", wires: [["hn1"]], mode: "simple", interval: 24, intervalUnit: "hours", crontab: "", untilType: "global", untilValue: "testVariable", untilOffset: 0, untilRandom: false, msgIngress: "forward:forced", preserveCtrlProps: true}, hlpNode, cfgNode];
            const ctx = {flow: {}, global: {}};

            sinon.spy(clock, "setTimeout");
            sinon.stub(helper._RED.util, "parseContextStore").returns({key: "testKey", store: "testStore"});
            curTime = 946684800000;  // 2000-01-01 00:00:00

            helper.load([configNode, repeatNode], flow, credentials, function()
            {
                try
                {
                    const rn1 = helper.getNode("rn1");
                    const hn1 = helper.getNode("hn1");

                    sinon.stub(rn1, "context").returns(ctx);
                    ctx.flow.get = sinon.fake.returns(undefined);
                    ctx.global.get = sinon.fake.returns({type: "time", value: "00:05:00", date: "2000-01-03", offset: 0, random: false});

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

                    helper._RED.util.parseContextStore.should.be.calledWith("testVariable");
                    rn1.context.should.be.calledOnce();
                    ctx.global.get.should.be.calledWith("testKey", "testStore");

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

        it("should repeat message until next message via context variable", function(done)
        {
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", wires: [["hn1"]], mode: "simple", interval: 1, intervalUnit: "seconds", crontab: "", untilType: "flow", untilValue: "testVariable", untilOffset: 0, untilRandom: false, msgIngress: "forward:forced", preserveCtrlProps: true}, hlpNode, cfgNode];
            const ctx = {flow: {}, global: {}};

            sinon.spy(clock, "setTimeout");
            sinon.stub(helper._RED.util, "parseContextStore").returns({key: "testKey", store: "testStore"});

            helper.load([configNode, repeatNode], flow, credentials, function()
            {
                try
                {
                    const rn1 = helper.getNode("rn1");
                    const hn1 = helper.getNode("hn1");
                    let count = 0;

                    sinon.stub(rn1, "context").returns(ctx);
                    ctx.flow.get = sinon.fake.returns(null);
                    ctx.global.get = sinon.fake.returns(undefined);

                    hn1.on("input", function(msg)
                    {
                        try
                        {
                            count++;
                            msg.should.have.property("payload", "test" + ((count <= 7) ? 1 : 2));
                        }
                        catch (e)
                        {
                            done(e);
                        }
                    });

                    rn1.receive({payload: "test1"});

                    helper._RED.util.parseContextStore.should.be.calledWith("testVariable");
                    rn1.context.should.be.calledOnce();
                    ctx.flow.get.should.be.calledWith("testKey", "testStore");

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
                    clock.setTimeout.should.be.calledWith(sinon.match.any, 1000).and.have.callCount(7);
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
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", wires: [["hn1"]], mode: "custom", interval: 1, intervalUnit: "seconds", crontab: "", customRepetitionType: "jsonata", customRepetitionValue: "true", untilType: "nextMsg", untilValue: "", untilOffset: 0, untilRandom: false, msgIngress: "forward:forced", preserveCtrlProps: true}, hlpNode, cfgNode];

            sinon.stub(chronos, "evaluateJSONataExpression").returns(2000);
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
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", wires: [["hn1"]], mode: "custom", interval: 1, intervalUnit: "seconds", crontab: "", customRepetitionType: "jsonata", customRepetitionValue: "true", untilType: "nextMsg", untilValue: "", untilOffset: 0, untilRandom: false, msgIngress: "forward:forced", preserveCtrlProps: true}, hlpNode, cfgNode];

            sinon.stub(chronos, "evaluateJSONataExpression")
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
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", wires: [["hn1"]], mode: "custom", interval: 1, intervalUnit: "seconds", crontab: "", customRepetitionType: "jsonata", customRepetitionValue: "true", untilType: "nextMsg", untilValue: "", untilOffset: 0, untilRandom: false, msgIngress: "forward:forced", preserveCtrlProps: true}, hlpNode, cfgNode];

            sinon.stub(chronos, "evaluateJSONataExpression")
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
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", wires: [["hn1"]], mode: "custom", interval: 1, intervalUnit: "seconds", crontab: "", customRepetitionType: "jsonata", customRepetitionValue: "60000", untilType: "time", untilValue: "00:01", untilOffset: 0, untilRandom: false, msgIngress: "noop", preserveCtrlProps: true}, hlpNode, cfgNode];

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

        it("should repeat according to interval from context variable", function(done)
        {
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", wires: [["hn1"]], mode: "custom", interval: 5, intervalUnit: "minutes", crontab: "", customRepetitionType: "flow", customRepetitionValue: "testVariable", untilType: "nextMsg", untilValue: "", untilOffset: 0, untilRandom: false, msgIngress: "forward:forced", preserveCtrlProps: true}, hlpNode, cfgNode];
            const ctx = {flow: {}, global: {}};

            sinon.spy(clock, "setTimeout");
            sinon.stub(helper._RED.util, "parseContextStore").returns({key: "testKey", store: "testStore"});

            helper.load([configNode, repeatNode], flow, credentials, function()
            {
                try
                {
                    const rn1 = helper.getNode("rn1");
                    const hn1 = helper.getNode("hn1");

                    sinon.stub(rn1, "context").returns(ctx);
                    ctx.flow.get = sinon.fake.returns({value: 1, unit: "seconds"});
                    ctx.global.get = sinon.fake.returns(undefined);

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

                    helper._RED.util.parseContextStore.should.be.calledWith("testVariable");
                    rn1.context.should.be.calledOnce();
                    ctx.flow.get.should.be.calledWith("testKey", "testStore");

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

        it("should repeat according to cron table from context variable", function(done)
        {
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", wires: [["hn1"]], mode: "custom", interval: 1, intervalUnit: "seconds", crontab: "*/5 * * * *", customRepetitionType: "global", customRepetitionValue: "testVariable", untilType: "nextMsg", untilValue: "", untilOffset: 0, untilRandom: false, msgIngress: "forward:forced", preserveCtrlProps: true}, hlpNode, cfgNode];
            const ctx = {flow: {}, global: {}};

            sinon.stub(helper._RED.util, "parseContextStore").returns({key: "testKey", store: "testStore"});

            helper.load([configNode, repeatNode], flow, credentials, function()
            {
                try
                {
                    const rn1 = helper.getNode("rn1");
                    const hn1 = helper.getNode("hn1");

                    sinon.stub(rn1, "context").returns(ctx);
                    ctx.flow.get = sinon.fake.returns(undefined);
                    ctx.global.get = sinon.fake.returns("*/2 * * * * *");

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

                    helper._RED.util.parseContextStore.should.be.calledWith("testVariable");
                    rn1.context.should.be.calledOnce();
                    ctx.global.get.should.be.calledWith("testKey", "testStore");

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

        it("should handle time error caused by JSONata expression (invalid expression)", async function()
        {
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", mode: "custom", interval: 1, intervalUnit: "seconds", crontab: "", customRepetitionType: "jsonata", customRepetitionValue: "$invalFunc()", untilType: "nextMsg", untilValue: "", untilDate: "", untilOffset: 0, untilRandom: false, msgIngress: "forward:forced", preserveCtrlProps: false}, cfgNode];

            await helper.load([configNode, repeatNode], flow, credentials);
            const rn1 = helper.getNode("rn1");

            rn1.receive({payload: "test"});
            rn1.error.should.be.calledWith("node-red-contrib-chronos/chronos-config:common.error.evaluationFailed", {payload: "test", _msgid: sinon.match.any, errorDetails: {expression: "$invalFunc()", code: sinon.match.any, description: sinon.match.any, position: sinon.match.any, token: sinon.match.any}});
        });

        it("should handle time error caused by JSONata expression (not time value)", async function()
        {
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", mode: "custom", interval: 1, intervalUnit: "seconds", crontab: "", customRepetitionType: "jsonata", customRepetitionValue: "true", untilType: "nextMsg", untilValue: "", untilDate: "", untilOffset: 0, untilRandom: false, msgIngress: "forward:forced", preserveCtrlProps: false}, cfgNode];

            await helper.load([configNode, repeatNode], flow, credentials);
            const rn1 = helper.getNode("rn1");

            rn1.receive({payload: "test"});
            rn1.error.should.be.calledWith("node-red-contrib-chronos/chronos-config:common.error.notTime", {payload: "test", _msgid: sinon.match.any, errorDetails: {expression: "true", result: true}});
        });

        it("should handle time error caused by JSONata expression (interval too small)", async function()
        {
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", mode: "custom", interval: 1, intervalUnit: "seconds", crontab: "", customRepetitionType: "jsonata", customRepetitionValue: "999", untilType: "nextMsg", untilValue: "", untilDate: "", untilOffset: 0, untilRandom: false, msgIngress: "forward:forced", preserveCtrlProps: false}, cfgNode];

            await helper.load([configNode, repeatNode], flow, credentials);
            const rn1 = helper.getNode("rn1");

            rn1.receive({payload: "test"});
            rn1.error.should.be.calledWith("node-red-contrib-chronos/chronos-config:common.error.intervalOutOfRange", {payload: "test", _msgid: sinon.match.any, errorDetails: {expression: "999", result: 999}});
        });

        it("should handle time error caused by JSONata expression (interval too large)", async function()
        {
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", mode: "custom", interval: 1, intervalUnit: "seconds", crontab: "", customRepetitionType: "jsonata", customRepetitionValue: "604800001", untilType: "nextMsg", untilValue: "", untilDate: "", untilOffset: 0, untilRandom: false, msgIngress: "forward:forced", preserveCtrlProps: false}, cfgNode];

            await helper.load([configNode, repeatNode], flow, credentials);
            const rn1 = helper.getNode("rn1");

            rn1.receive({payload: "test"});
            rn1.error.should.be.calledWith("node-red-contrib-chronos/chronos-config:common.error.intervalOutOfRange", {payload: "test", _msgid: sinon.match.any, errorDetails: {expression: "604800001", result: 604800001}});
        });

        it("should handle time error caused by JSONata expression (invalid time)", async function()
        {
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", mode: "custom", interval: 1, intervalUnit: "seconds", crontab: "", customRepetitionType: "jsonata", customRepetitionValue: "\"invalid\"", untilType: "nextMsg", untilValue: "", untilDate: "", untilOffset: 0, untilRandom: false, msgIngress: "forward:forced", preserveCtrlProps: false}, cfgNode];

            await helper.load([configNode, repeatNode], flow, credentials);
            const rn1 = helper.getNode("rn1");

            rn1.receive({payload: "test"});
            rn1.error.should.be.calledWith("node-red-contrib-chronos/chronos-config:common.error.notTime", {payload: "test", _msgid: sinon.match.any, errorDetails: {expression: "\"invalid\"", result: "invalid"}});
        });

        it("should handle time error caused by invalid context variable", async function()
        {
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", mode: "custom", interval: 1, intervalUnit: "seconds", crontab: "", customRepetitionType: "flow", customRepetitionValue: "invalidVariable", untilType: "nextMsg", untilValue: "", untilDate: "", untilOffset: 0, untilRandom: false, msgIngress: "forward:forced", preserveCtrlProps: false}, cfgNode];
            const ctx = {flow: {}, global: {}};

            sinon.stub(helper._RED.util, "parseContextStore").returns({key: "testKey", store: "testStore"});

            await helper.load([configNode, repeatNode], flow, credentials);
            const rn1 = helper.getNode("rn1");

            sinon.stub(rn1, "context").returns(ctx);
            ctx.flow.get = sinon.fake.returns(false);
            ctx.global.get = sinon.fake.returns(undefined);

            rn1.receive({payload: "test"});
            rn1.error.should.be.calledWith("node-red-contrib-chronos/chronos-config:common.error.invalidContext", {payload: "test", _msgid: sinon.match.any, errorDetails: {store: "testStore", key: "testKey", value: false}});
        });
    });
});
