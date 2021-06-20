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
const repeatNode = require("../nodes/repeat.js");
const chronos = require("../nodes/common/chronos.js");
const moment = require("moment");

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

        it("should fail due to invalid until time", async function()
        {
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", interval: 1, intervalUnit: "seconds", untilType: "time", untilValue: "invalid", untilOffset: 0, untilRandom: false, preserveCtrlProps: true}, cfgNode];

            await helper.load([configNode, repeatNode], flow, credentials);
            const rn1 = helper.getNode("rn1");
            rn1.status.should.be.calledTwice();
            rn1.error.should.be.calledOnce().and.calledWith("node-red-contrib-chronos/chronos-config:common.error.invalidConfig");
        });
    });

    context("message repeating (until next message)", function()
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
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", wires: [["hn1"]], interval: 1, intervalUnit: "seconds", untilType: "nextMsg", untilValue: "", untilOffset: 0, untilRandom: false, preserveCtrlProps: true}, hlpNode, cfgNode];
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
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", wires: [["hn1"]], interval: 1, intervalUnit: "seconds", untilType: "nextMsg", untilValue: "", untilOffset: 0, untilRandom: false, preserveCtrlProps: true}, hlpNode, cfgNode];
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
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", wires: [["hn1"]], interval: 1, intervalUnit: "seconds", untilType: "nextMsg", untilValue: "", untilOffset: 0, untilRandom: false, preserveCtrlProps: true}, hlpNode, cfgNode];
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
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", wires: [["hn1"]], interval: 1, intervalUnit: "seconds", untilType: "nextMsg", untilValue: "", untilOffset: 0, untilRandom: false, preserveCtrlProps: false}, hlpNode, cfgNode];
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
                const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", wires: [["hn1"]], interval: 1, intervalUnit: "seconds", untilType: "nextMsg", untilValue: "", untilOffset: 0, untilRandom: false, preserveCtrlProps: true}, hlpNode, cfgNode];
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

        testInvalidIntervalOverride("invalid unit", {value: 4, unit: "invalid"});
        testInvalidIntervalOverride("invalid value", {value: "invalid", unit: "seconds"});
        testInvalidIntervalOverride("value too small for seconds", {value: 0, unit: "seconds"});
        testInvalidIntervalOverride("value too large for seconds", {value: 60, unit: "seconds"});
        testInvalidIntervalOverride("value too small for minutes", {value: 0, unit: "minutes"});
        testInvalidIntervalOverride("value too large for minutes", {value: 60, unit: "minutes"});
        testInvalidIntervalOverride("value too small for hours", {value: 0, unit: "hours"});
        testInvalidIntervalOverride("value too large for hours", {value: 24, unit: "hours"});
    });

    context("message repeating (until specifc time)", function()
    {
        let clock = null;
        let curTime = 0;

        beforeEach(function()
        {
            curTime = 0;
            clock = sinon.useFakeTimers({toFake: ["setTimeout", "clearTimeout"]});
            sinon.stub(chronos, "getCurrentTime").callsFake(function() { return moment(curTime).utc(); });
        });

        afterEach(function()
        {
            helper.unload();
            sinon.restore();
        });

        it("should repeat message until ending time is reached", function(done)
        {
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", wires: [["hn1"]], interval: 1, intervalUnit: "seconds", untilType: "time", untilValue: "00:00:03", untilOffset: 0, untilRandom: false, preserveCtrlProps: true}, hlpNode, cfgNode];
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

        it("should repeat message until ending time with offset is reached", function(done)
        {
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", wires: [["hn1"]], interval: 1, intervalUnit: "minutes", untilType: "time", untilValue: "00:02:00", untilOffset: 1, untilRandom: false, preserveCtrlProps: true}, hlpNode, cfgNode];
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
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", wires: [["hn1"]], interval: 1, intervalUnit: "minutes", untilType: "time", untilValue: "00:02:00", untilOffset: 2, untilRandom: true, preserveCtrlProps: true}, hlpNode, cfgNode];
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

        it("should override until time", function(done)
        {
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", wires: [["hn1"]], interval: 1, intervalUnit: "seconds", untilType: "time", untilValue: "00:00:06", untilOffset: 0, untilRandom: false, preserveCtrlProps: true}, hlpNode, cfgNode];
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
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", wires: [["hn1"]], interval: 1, intervalUnit: "seconds", untilType: "time", untilValue: "00:00:06", untilOffset: 0, untilRandom: false, preserveCtrlProps: false}, hlpNode, cfgNode];
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
            const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", wires: [["hn1"]], interval: 1, intervalUnit: "seconds", untilType: "time", untilValue: "00:00:03", untilOffset: 0, untilRandom: false, preserveCtrlProps: true}, hlpNode, cfgNode];
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
                const flow = [{id: "rn1", type: "chronos-repeat", name: "repeat", config: "cn1", wires: [["hn1"]], interval: 1, intervalUnit: "seconds", untilType: "time", untilValue: "00:00:03", untilOffset: 0, untilRandom: false, preserveCtrlProps: true}, hlpNode, cfgNode];
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

        testInvalidUntilOverride("override type no string", {type: 5, value: "00:01", offset: 0, random: false});
        testInvalidUntilOverride("override type wrong string", {type: "invalid", value: "00:01", offset: 0, random: false});
        testInvalidUntilOverride("override value wrong type", {type: "time", value: null, offset: 0, random: false});
        testInvalidUntilOverride("override value invalid time", {type: "time", value: "12_14", offset: 0, random: false});
        testInvalidUntilOverride("override value invalid sun position", {type: "sun", value: "invalid", offset: 0, random: false});
        testInvalidUntilOverride("override value invalid moon position", {type: "moon", value: "invalid", offset: 0, random: false});
        testInvalidUntilOverride("override offset wrong type", {type: "time", value: "00:01", offset: "invalid", random: false});
        testInvalidUntilOverride("override offset too small", {type: "time", value: "00:01", offset: -301, random: false});
        testInvalidUntilOverride("override offset too large", {type: "time", value: "00:01", offset: 301, random: false});
        testInvalidUntilOverride("override random wrong type", {type: "time", value: "00:01", offset: 0, random: "invalid"});
    });
});
