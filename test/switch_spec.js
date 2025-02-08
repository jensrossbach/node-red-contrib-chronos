/*
 * Copyright (c) 2020 - 2025 Jens-Uwe Rossbach
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
const switchNode = require("../nodes/switch.js");
const chronos = require("../nodes/common/chronos.js");
const sfUtils = require("../nodes/common/sfutils.js");

require("should-sinon");

const cfgNode = {id: "cn1", type: "chronos-config", name: "config"};
const hlpNode = {id: "hn1", type: "helper"};
const credentials = {"cn1": {latitude: "50", longitude: "10"}};

describe("time switch node", function()
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
            const flow = [{id: "sn1", type: "chronos-switch", name: "switch", config: "cn1", baseTimeType: "msgIngress", baseTime: "", conditions: [{operator: "before", operands: {type: "time", value: "10:00", offset: 0, random: false}}], stopOnFirstMatch: false}, cfgNode];

            await helper.load([configNode, switchNode], flow, credentials);
            const sn1 = helper.getNode("sn1");
            sn1.should.have.property("name", "switch");
            sn1.should.have.property("baseTimeType", "msgIngress");
            sn1.should.have.property("baseTime", "");
            sn1.should.have.property("conditions").which.is.an.Array();
            sn1.should.have.property("stopOnFirstMatch", false);
        });

        it("should be backward compatible", async function()
        {
            const flow = [{id: "sn1", type: "chronos-switch", name: "switch", config: "cn1", conditions: [{operator: "before", operands: {type: "time", value: "10:00", offset: 0, random: false}}], stopOnFirstMatch: false}, cfgNode];

            await helper.load([configNode, switchNode], flow, credentials);
            const sn1 = helper.getNode("sn1");
            sn1.should.have.property("name", "switch");
            sn1.should.have.property("baseTimeType", "msgIngress");
            sn1.should.have.property("conditions").which.is.an.Array();
            sn1.should.have.property("stopOnFirstMatch", false);
        });

        it("should fail due to missing configuration", async function()
        {
            const flow = [{id: "sn1", type: "chronos-switch", name: "switch"}];

            await helper.load(switchNode, flow, {});
            const sn1 = helper.getNode("sn1");
            sn1.status.should.be.calledOnce();
            sn1.error.should.be.calledOnce().and.calledWith("node-red-contrib-chronos/chronos-config:common.error.noConfig");
        });

        it("should fail due to invalid latitude", async function()
        {
            const flow = [{id: "sn1", type: "chronos-switch", name: "switch", config: "cn1"}, cfgNode];
            const invalidCredentials = {"cn1": {latitude: "", longitude: "10"}};

            await helper.load([configNode, switchNode], flow, invalidCredentials);
            const sn1 = helper.getNode("sn1");
            sn1.status.should.be.calledOnce();
            sn1.error.should.be.calledOnce().and.calledWith("node-red-contrib-chronos/chronos-config:common.error.invalidConfig");
        });

        it("should fail due to invalid longitude", async function()
        {
            const flow = [{id: "sn1", type: "chronos-switch", name: "switch", config: "cn1"}, cfgNode];
            const invalidCredentials = {"cn1": {latitude: "50", longitude: ""}};

            await helper.load([configNode, switchNode], flow, invalidCredentials);
            const sn1 = helper.getNode("sn1");
            sn1.status.should.be.calledOnce();
            sn1.error.should.be.calledOnce().and.calledWith("node-red-contrib-chronos/chronos-config:common.error.invalidConfig");
        });

        it("should fail due to invalid time zone", async function()
        {
            const flow = [{id: "sn1", type: "chronos-switch", name: "switch", config: "cn1"}, cfgNodeInvalidTZ];

            await helper.load([configNode, switchNode], flow, credentials);
            const sn1 = helper.getNode("sn1");
            sn1.status.should.be.calledOnce();
            sn1.error.should.be.calledOnce().and.calledWith("node-red-contrib-chronos/chronos-config:common.error.invalidConfig");
        });

        it("should fail due to invalid condition", async function()
        {
            const flow = [{id: "sn1", type: "chronos-switch", name: "switch", config: "cn1", baseTimeType: "msgIngress", baseTime: "", conditions: [{operator: "before", operands: {type: "time", value: "10:00", offset: 0, random: false}}], stopOnFirstMatch: false}, cfgNode];
            sinon.stub(sfUtils, "validateCondition").returns(false);

            await helper.load([configNode, switchNode], flow, credentials);
            const sn1 = helper.getNode("sn1");
            sn1.status.should.be.called();
            sn1.error.should.be.calledOnce();
        });

        function testInvalidConfig(title, flow, exp)
        {
            it("should fail due to " + title, async function()
            {
                await helper.load([configNode, switchNode], flow, credentials);
                const sn1 = helper.getNode("sn1");
                sn1.status.should.be.called();
                sn1.error.should.be.calledOnce().and.calledWith(exp);
            });
        }

        const invalidConfig = "node-red-contrib-chronos/chronos-config:common.error.invalidConfig";
        testInvalidConfig("invalid basetime", [{id: "sn1", type: "chronos-switch", name: "switch", config: "cn1", baseTimeType: "msg", baseTime: "", conditions: [{}], stopOnFirstMatch: false}, cfgNode], invalidConfig);
        testInvalidConfig("missing conditions", [{id: "sn1", type: "chronos-switch", name: "switch", config: "cn1", baseTimeType: "msgIngress", baseTime: "", conditions: [], stopOnFirstMatch: false}, cfgNode], "node-red-contrib-chronos/chronos-config:common.error.noConditions");
        testInvalidConfig("only otherwise", [{id: "sn1", type: "chronos-switch", name: "switch", config: "cn1", baseTimeType: "msgIngress", baseTime: "", conditions: [{operator: "otherwise"}], stopOnFirstMatch: false}, cfgNode], invalidConfig);
        testInvalidConfig("multiple otherwise", [{id: "sn1", type: "chronos-switch", name: "switch", config: "cn1", baseTimeType: "msgIngress", baseTime: "", conditions: [{operator: "before", operands: {type: "time", value: "10:00", offset: 0, random: false}}, {operator: "otherwise"}, {operator: "otherwise"}], stopOnFirstMatch: false}, cfgNode], invalidConfig);
    });

    context("message routing", function()
    {
        let clock = null;

        beforeEach(function()
        {
            clock = sinon.useFakeTimers({toFake: ["Date"]});
        });

        afterEach(function()
        {
            helper.unload();
            sinon.restore();
        });

        function testInvalidBasetime(title, flow)
        {
            it("should handle invalid basetime: " + title, async function()
            {
                sinon.stub(sfUtils, "getBaseTime").returns(null);
                sinon.stub(helper._RED.util, "parseContextStore").returns({key: "testKey", store: "testStore"});

                await helper.load([configNode, switchNode], flow, credentials);
                const sn1 = helper.getNode("sn1");

                sn1.receive({});
                sn1.error.should.be.calledOnce().and.calledWith("node-red-contrib-chronos/chronos-config:common.error.invalidBaseTime");
            });
        }

        testInvalidBasetime("message ingress", [{id: "sn1", type: "chronos-switch", name: "switch", config: "cn1", baseTimeType: "msgIngress", baseTime: "", conditions: [{operator: "before", operands: {type: "time", value: "10:00", offset: 0, random: false}}], stopOnFirstMatch: false}, cfgNode]);
        testInvalidBasetime("flow", [{id: "sn1", type: "chronos-switch", name: "switch", config: "cn1", baseTimeType: "flow", baseTime: "testVariable", conditions: [{operator: "before", operands: {type: "time", value: "10:00", offset: 0, random: false}}], stopOnFirstMatch: false}, cfgNode]);

        it("should handle time error during condition evaluation", async function()
        {
            const flow = [{id: "sn1", type: "chronos-switch", name: "switch", config: "cn1", baseTimeType: "msgIngress", baseTime: "", conditions: [{operator: "before", operands: {type: "time", value: "10:00", offset: 0, random: false}}], stopOnFirstMatch: false}, cfgNode];
            sinon.stub(sfUtils, "evaluateCondition").throws(function() { return new chronos.TimeError("time error", {type: "sun", value: "sunset"}); });

            await helper.load([configNode, switchNode], flow, credentials);
            const sn1 = helper.getNode("sn1");

            sn1.receive({payload: "test"});
            sn1.error.should.be.calledWith("time error", {_msgid: sinon.match.any, payload: "test", errorDetails: {type: "sun", value: "sunset"}});
        });

        it("should handle time error during condition evaluation (rename errorDetails)", async function()
        {
            const flow = [{id: "sn1", type: "chronos-switch", name: "switch", config: "cn1", baseTimeType: "msgIngress", baseTime: "", conditions: [{operator: "before", operands: {type: "time", value: "10:00", offset: 0, random: false}}], stopOnFirstMatch: false}, cfgNode];
            sinon.stub(sfUtils, "evaluateCondition").throws(function() { return new chronos.TimeError("time error", {type: "sun", value: "sunset"}); });

            await helper.load([configNode, switchNode], flow, credentials);
            const sn1 = helper.getNode("sn1");

            sn1.receive({payload: "test", errorDetails: "details"});
            sn1.error.should.be.calledWith("time error", {_msgid: sinon.match.any, payload: "test", _errorDetails: "details", errorDetails: {type: "sun", value: "sunset"}});
        });

        it("should handle time error during condition evaluation (no details)", async function()
        {
            const flow = [{id: "sn1", type: "chronos-switch", name: "switch", config: "cn1", baseTimeType: "msgIngress", baseTime: "", conditions: [{operator: "before", operands: {type: "time", value: "10:00", offset: 0, random: false}}], stopOnFirstMatch: false}, cfgNode];
            sinon.stub(sfUtils, "evaluateCondition").throws(function() { return new chronos.TimeError("time error", null); });

            await helper.load([configNode, switchNode], flow, credentials);
            const sn1 = helper.getNode("sn1");

            sn1.receive({payload: "test"});
            sn1.error.should.be.calledWith("time error", {_msgid: sinon.match.any, payload: "test"});
        });

        it("should handle other error during condition evaluation", async function()
        {
            const flow = [{id: "sn1", type: "chronos-switch", name: "switch", config: "cn1", baseTimeType: "msgIngress", baseTime: "", conditions: [{operator: "before", operands: {type: "time", value: "10:00", offset: 0, random: false}}], stopOnFirstMatch: false}, cfgNode];
            sinon.stub(sfUtils, "evaluateCondition").throws("error", "error message");

            await helper.load([configNode, switchNode], flow, credentials);
            const sn1 = helper.getNode("sn1");

            sn1.receive({payload: "test"});
            sn1.error.should.be.calledWith("error message");
        });

        it("should route to first", function(done)
        {
            const flow = [{id: "sn1", type: "chronos-switch", name: "switch", config: "cn1", wires: [["hn1"], ["hn2"]], baseTimeType: "msgIngress", baseTime: "", conditions: [{operator: "before", operands: {type: "time", value: "10:00", offset: 0, random: false}}, {operator: "after", operands: {type: "time", value: "10:00", offset: 0, random: false}}], stopOnFirstMatch: false}, hlpNode, {id: "hn2", type: "helper"}, cfgNode];
            sinon.stub(sfUtils, "evaluateCondition").onFirstCall().returns(true).onSecondCall().returns(false);

            helper.load([configNode, switchNode], flow, credentials, function()
            {
                try
                {
                    const sn1 = helper.getNode("sn1");
                    const hn1 = helper.getNode("hn1");
                    const hn2 = helper.getNode("hn2");

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

                    hn2.on("input", function(msg)
                    {
                        done("unexpected message on port 2");
                    });

                    sn1.receive({payload: "test"});
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should route to second", function(done)
        {
            const flow = [{id: "sn1", type: "chronos-switch", name: "switch", config: "cn1", wires: [["hn1"], ["hn2"]], baseTimeType: "msgIngress", baseTime: "", conditions: [{operator: "before", operands: {type: "time", value: "10:00", offset: 0, random: false}}, {operator: "after", operands: {type: "time", value: "10:00", offset: 0, random: false}}], stopOnFirstMatch: false}, hlpNode, {id: "hn2", type: "helper"}, cfgNode];
            sinon.stub(sfUtils, "evaluateCondition").onFirstCall().returns(false).onSecondCall().returns(true);

            helper.load([configNode, switchNode], flow, credentials, function()
            {
                try
                {
                    const sn1 = helper.getNode("sn1");
                    const hn1 = helper.getNode("hn1");
                    const hn2 = helper.getNode("hn2");

                    hn1.on("input", function(msg)
                    {
                        done("unexpected message on port 1");
                    });

                    hn2.on("input", function(msg)
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

                    sn1.receive({payload: "test"});
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should route to both", function(done)
        {
            const flow = [{id: "sn1", type: "chronos-switch", name: "switch", config: "cn1", wires: [["hn1"], ["hn2"]], baseTimeType: "msgIngress", baseTime: "", conditions: [{operator: "before", operands: {type: "time", value: "10:00", offset: 0, random: false}}, {operator: "after", operands: {type: "time", value: "10:00", offset: 0, random: false}}], stopOnFirstMatch: false}, hlpNode, {id: "hn2", type: "helper"}, cfgNode];
            sinon.stub(sfUtils, "evaluateCondition").returns(true);

            helper.load([configNode, switchNode], flow, credentials, function()
            {
                try
                {
                    const sn1 = helper.getNode("sn1");
                    const hn1 = helper.getNode("hn1");
                    const hn2 = helper.getNode("hn2");
                    let firstSeen = false;

                    hn1.on("input", function(msg)
                    {
                        msg.should.have.property("payload", "test");
                        firstSeen = true;
                    });

                    hn2.on("input", function(msg)
                    {
                        try
                        {
                            msg.should.have.property("payload", "test");
                            firstSeen.should.be.true();

                            done();
                        }
                        catch (e)
                        {
                            done(e);
                        }
                    });

                    sn1.receive({payload: "test"});
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should route to none", function(done)
        {
            const flow = [{id: "sn1", type: "chronos-switch", name: "switch", config: "cn1", wires: [["hn1"], ["hn2"]], baseTimeType: "msgIngress", baseTime: "", conditions: [{operator: "before", operands: {type: "time", value: "10:00", offset: 0, random: false}}, {operator: "after", operands: {type: "time", value: "10:00", offset: 0, random: false}}], stopOnFirstMatch: false}, hlpNode, {id: "hn2", type: "helper"}, cfgNode];
            sinon.stub(sfUtils, "evaluateCondition").returns(false);

            helper.load([configNode, switchNode], flow, credentials, function()
            {
                try
                {
                    const sn1 = helper.getNode("sn1");
                    const hn1 = helper.getNode("hn1");
                    const hn2 = helper.getNode("hn2");

                    hn1.on("input", function(msg)
                    {
                        done("unexpected message on port 1");
                    });

                    hn2.on("input", function(msg)
                    {
                        done("unexpected message on port 2");
                    });

                    sn1.receive({payload: "test"});
                    done();
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should stop on first match", function(done)
        {
            const flow = [{id: "sn1", type: "chronos-switch", name: "switch", config: "cn1", wires: [["hn1"], ["hn2"]], baseTimeType: "msgIngress", baseTime: "", conditions: [{operator: "before", operands: {type: "time", value: "10:00", offset: 0, random: false}}, {operator: "after", operands: {type: "time", value: "10:00", offset: 0, random: false}}], stopOnFirstMatch: true}, hlpNode, {id: "hn2", type: "helper"}, cfgNode];
            sinon.stub(sfUtils, "evaluateCondition").returns(true);

            helper.load([configNode, switchNode], flow, credentials, function()
            {
                try
                {
                    const sn1 = helper.getNode("sn1");
                    const hn1 = helper.getNode("hn1");
                    const hn2 = helper.getNode("hn2");

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

                    hn2.on("input", function(msg)
                    {
                        done("unexpected message on port 2");
                    });

                    sn1.stopOnFirstMatch.should.be.true();
                    sn1.receive({payload: "test"});
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should route to otherwise", function(done)
        {
            const flow = [{id: "sn1", type: "chronos-switch", name: "switch", config: "cn1", wires: [["hn1"], ["hn2"]], baseTimeType: "msgIngress", baseTime: "", conditions: [{operator: "before", operands: {type: "time", value: "10:00", offset: 0, random: false}}, {operator: "otherwise"}], stopOnFirstMatch: false}, hlpNode, {id: "hn2", type: "helper"}, cfgNode];
            sinon.stub(sfUtils, "evaluateCondition").returns(false);

            helper.load([configNode, switchNode], flow, credentials, function()
            {
                try
                {
                    const sn1 = helper.getNode("sn1");
                    const hn1 = helper.getNode("hn1");
                    const hn2 = helper.getNode("hn2");

                    hn1.on("input", function(msg)
                    {
                        done("unexpected message on port 1");
                    });

                    hn2.on("input", function(msg)
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

                    sn1.receive({payload: "test"});
                }
                catch (e)
                {
                    done(e);
                }
            });
        });
    });
});
