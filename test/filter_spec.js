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
const filterNode = require("../nodes/filter.js");
const chronos = require("../nodes/common/chronos.js");
const sfUtils = require("../nodes/common/sfutils.js");

require("should-sinon");

const cfgNode = {id: "cn1", type: "chronos-config", name: "config"};
const hlpNode = {id: "hn1", type: "helper"};
const credentials = {"cn1": {latitude: "50", longitude: "10"}};

describe("time filter node", function()
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
            const flow = [{id: "fn1", type: "chronos-filter", name: "filter", config: "cn1", baseTimeType: "msgIngress", baseTime: "", conditions: [{operator: "before", operands: {type: "time", value: "10:00", offset: 0, random: false}}], allMustMatch: false, annotateOnly: false}, cfgNode];

            await helper.load([configNode, filterNode], flow, credentials);
            const fn1 = helper.getNode("fn1");
            fn1.should.have.property("name", "filter");
            fn1.should.have.property("baseTimeType", "msgIngress");
            fn1.should.have.property("baseTime", "");
            fn1.should.have.property("conditions").which.is.an.Array();
            fn1.should.have.property("allMustMatch", false);
            fn1.should.have.property("annotateOnly", false);
        });

        it("should be backward compatible", async function()
        {
            const flow = [{id: "fn1", type: "chronos-filter", name: "filter", config: "cn1", conditions: [{operator: "before", operands: {type: "time", value: "10:00", offset: 0, random: false}}], allMustMatch: false, annotateOnly: false}, cfgNode];

            await helper.load([configNode, filterNode], flow, credentials);
            const fn1 = helper.getNode("fn1");
            fn1.should.have.property("name", "filter");
            fn1.should.have.property("baseTimeType", "msgIngress");
            fn1.should.have.property("conditions").which.is.an.Array();
            fn1.should.have.property("allMustMatch", false);
            fn1.should.have.property("annotateOnly", false);
        });

        it("should fail due to missing configuration", async function()
        {
            const flow = [{id: "fn1", type: "chronos-filter", name: "filter"}];

            await helper.load(filterNode, flow, {});
            const fn1 = helper.getNode("fn1");
            fn1.status.should.be.calledOnce();
            fn1.error.should.be.calledOnce();
        });

        it("should fail due to invalid latitude", async function()
        {
            const flow = [{id: "fn1", type: "chronos-filter", name: "filter", config: "cn1"}, cfgNode];
            const invalidCredentials = {"cn1": {latitude: "", longitude: "10"}};

            await helper.load([configNode, filterNode], flow, invalidCredentials);
            const fn1 = helper.getNode("fn1");
            fn1.status.should.be.calledOnce();
            fn1.error.should.be.calledOnce();
        });

        it("should fail due to invalid longitude", async function()
        {
            const flow = [{id: "fn1", type: "chronos-filter", name: "filter", config: "cn1"}, cfgNode];
            const invalidCredentials = {"cn1": {latitude: "50", longitude: ""}};

            await helper.load([configNode, filterNode], flow, invalidCredentials);
            const fn1 = helper.getNode("fn1");
            fn1.status.should.be.calledOnce();
            fn1.error.should.be.calledOnce();
        });

        it("should fail due to invalid condition", async function()
        {
            const flow = [{id: "fn1", type: "chronos-filter", name: "filter", config: "cn1", baseTimeType: "msgIngress", baseTime: "", conditions: [{operator: "before", operands: {type: "time", value: "10:00", offset: 0, random: false}}], allMustMatch: false, annotateOnly: false}, cfgNode];
            sinon.stub(sfUtils, "validateCondition").returns(false);

            await helper.load([configNode, filterNode], flow, credentials);
            const fn1 = helper.getNode("fn1");
            fn1.status.should.be.called();
            fn1.error.should.be.calledOnce();
        });

        function testInvalidConfig(title, flow)
        {
            it("should fail due to " + title, async function()
            {
                await helper.load([configNode, filterNode], flow, credentials);
                const fn1 = helper.getNode("fn1");
                fn1.status.should.be.called();
                fn1.error.should.be.calledOnce();
            });
        }

        testInvalidConfig("invalid basetime", [{id: "fn1", type: "chronos-filter", name: "filter", config: "cn1", baseTimeType: "msg", baseTime: "", conditions: [{}], allMustMatch: false, annotateOnly: false}, cfgNode]);
        testInvalidConfig("missing conditions", [{id: "fn1", type: "chronos-filter", name: "filter", config: "cn1", baseTimeType: "msgIngress", baseTime: "", conditions: [], allMustMatch: false, annotateOnly: false}, cfgNode]);
    });

    context("message filtering", function()
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

                await helper.load([configNode, filterNode], flow, credentials);
                const fn1 = helper.getNode("fn1");
                sinon.stub(helper._RED.util, "parseContextStore").returns({key: "testKey", store: "testStore"});

                fn1.receive({});
                fn1.error.should.be.calledOnce();
            });
        }

        testInvalidBasetime("message ingress", [{id: "fn1", type: "chronos-filter", name: "filter", config: "cn1", baseTimeType: "msgIngress", baseTime: "", conditions: [{operator: "before", operands: {type: "time", value: "10:00", offset: 0, random: false}}], allMustMatch: false, annotateOnly: false}, cfgNode]);
        testInvalidBasetime("flow", [{id: "fn1", type: "chronos-filter", name: "filter", config: "cn1", baseTimeType: "flow", baseTime: "testVariable", conditions: [{operator: "before", operands: {type: "time", value: "10:00", offset: 0, random: false}}], allMustMatch: false, annotateOnly: false}, cfgNode]);

        it("should handle time error during condition evaluation", async function()
        {
            const flow = [{id: "fn1", type: "chronos-filter", name: "filter", config: "cn1", baseTimeType: "msgIngress", baseTime: "", conditions: [{operator: "before", operands: {type: "time", value: "10:00", offset: 0, random: false}}], allMustMatch: false, annotateOnly: false}, cfgNode];
            sinon.stub(sfUtils, "evaluateCondition").throws(function() { return new chronos.TimeError("time error", {type: "sun", value: "sunset"}); });

            await helper.load([configNode, filterNode], flow, credentials);
            const fn1 = helper.getNode("fn1");

            fn1.receive({payload: "test"});
            fn1.error.should.be.calledWith("time error", {_msgid: sinon.match.any, payload: "test", errorDetails: {type: "sun", value: "sunset"}});
        });

        it("should handle time error during condition evaluation (rename errorDetails)", async function()
        {
            const flow = [{id: "fn1", type: "chronos-filter", name: "filter", config: "cn1", baseTimeType: "msgIngress", baseTime: "", conditions: [{operator: "before", operands: {type: "time", value: "10:00", offset: 0, random: false}}], allMustMatch: false, annotateOnly: false}, cfgNode];
            sinon.stub(sfUtils, "evaluateCondition").throws(function() { return new chronos.TimeError("time error", {type: "sun", value: "sunset"}); });

            await helper.load([configNode, filterNode], flow, credentials);
            const fn1 = helper.getNode("fn1");

            fn1.receive({payload: "test", errorDetails: "details"});
            fn1.error.should.be.calledWith("time error", {_msgid: sinon.match.any, payload: "test", _errorDetails: "details", errorDetails: {type: "sun", value: "sunset"}});
        });

        it("should handle time error during condition evaluation (no details)", async function()
        {
            const flow = [{id: "fn1", type: "chronos-filter", name: "filter", config: "cn1", baseTimeType: "msgIngress", baseTime: "", conditions: [{operator: "before", operands: {type: "time", value: "10:00", offset: 0, random: false}}], allMustMatch: false, annotateOnly: false}, cfgNode];
            sinon.stub(sfUtils, "evaluateCondition").throws(function() { return new chronos.TimeError("time error", null); });

            await helper.load([configNode, filterNode], flow, credentials);
            const fn1 = helper.getNode("fn1");

            fn1.receive({payload: "test"});
            fn1.error.should.be.calledWith("time error", {_msgid: sinon.match.any, payload: "test"});
        });

        it("should handle other error during condition evaluation", async function()
        {
            const flow = [{id: "fn1", type: "chronos-filter", name: "filter", config: "cn1", baseTimeType: "msgIngress", baseTime: "", conditions: [{operator: "before", operands: {type: "time", value: "10:00", offset: 0, random: false}}], allMustMatch: false, annotateOnly: false}, cfgNode];
            sinon.stub(sfUtils, "evaluateCondition").throws("error", "error message");

            await helper.load([configNode, filterNode], flow, credentials);
            const fn1 = helper.getNode("fn1");

            fn1.receive({payload: "test"});
            fn1.error.should.be.calledWith("error message");
        });

        it("should pass through (one match)", function(done)
        {
            const flow = [{id: "fn1", type: "chronos-filter", name: "filter", config: "cn1", wires: [["hn1"]], baseTimeType: "msgIngress", baseTime: "", conditions: [{operator: "before", operands: {type: "time", value: "10:00", offset: 0, random: false}}, {operator: "after", operands: {type: "time", value: "10:00", offset: 0, random: false}}], allMustMatch: false, annotateOnly: false}, hlpNode, cfgNode];
            sinon.stub(sfUtils, "evaluateCondition").onFirstCall().returns(false).onSecondCall().returns(true);

            helper.load([configNode, filterNode], flow, credentials, function()
            {
                try
                {
                    const fn1 = helper.getNode("fn1");
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

                    fn1.receive({payload: "test"});
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should pass through (all match)", function(done)
        {
            const flow = [{id: "fn1", type: "chronos-filter", name: "filter", config: "cn1", wires: [["hn1"]], baseTimeType: "msgIngress", baseTime: "", conditions: [{operator: "before", operands: {type: "time", value: "10:00", offset: 0, random: false}}, {operator: "after", operands: {type: "time", value: "10:00", offset: 0, random: false}}], allMustMatch: false, annotateOnly: false}, hlpNode, cfgNode];
            sinon.stub(sfUtils, "evaluateCondition").returns(true);

            helper.load([configNode, filterNode], flow, credentials, function()
            {
                try
                {
                    const fn1 = helper.getNode("fn1");
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

                    fn1.receive({payload: "test"});
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should pass through (annotation mode)", function(done)
        {
            const flow = [{id: "fn1", type: "chronos-filter", name: "filter", config: "cn1", wires: [["hn1"]], baseTimeType: "msgIngress", baseTime: "", conditions: [{operator: "before", operands: {type: "time", value: "10:00", offset: 0, random: false}}, {operator: "after", operands: {type: "time", value: "10:00", offset: 0, random: false}}], allMustMatch: false, annotateOnly: true}, hlpNode, cfgNode];
            sinon.stub(sfUtils, "evaluateCondition").onFirstCall().returns(false).onSecondCall().returns(true);

            helper.load([configNode, filterNode], flow, credentials, function()
            {
                try
                {
                    const fn1 = helper.getNode("fn1");
                    const hn1 = helper.getNode("hn1");

                    hn1.on("input", function(msg)
                    {
                        try
                        {
                            msg.should.have.property("payload", "test");
                            msg.should.have.property("evaluation", [false, true]);
                            done();
                        }
                        catch (e)
                        {
                            done(e);
                        }
                    });

                    fn1.receive({payload: "test"});
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should pass through (annotation mode with existing evaluation property)", function(done)
        {
            const flow = [{id: "fn1", type: "chronos-filter", name: "filter", config: "cn1", wires: [["hn1"]], baseTimeType: "msgIngress", baseTime: "", conditions: [{operator: "before", operands: {type: "time", value: "10:00", offset: 0, random: false}}, {operator: "after", operands: {type: "time", value: "10:00", offset: 0, random: false}}], allMustMatch: false, annotateOnly: true}, hlpNode, cfgNode];
            sinon.stub(sfUtils, "evaluateCondition").onFirstCall().returns(false).onSecondCall().returns(true);

            helper.load([configNode, filterNode], flow, credentials, function()
            {
                try
                {
                    const fn1 = helper.getNode("fn1");
                    const hn1 = helper.getNode("hn1");

                    hn1.on("input", function(msg)
                    {
                        try
                        {
                            msg.should.have.property("payload", "test");
                            msg.should.have.property("evaluation", [false, true]);
                            msg.should.have.property("_evaluation", "result");
                            done();
                        }
                        catch (e)
                        {
                            done(e);
                        }
                    });

                    fn1.receive({payload: "test", evaluation: "result"});
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should filter out (no match)", function(done)
        {
            const flow = [{id: "fn1", type: "chronos-filter", name: "filter", config: "cn1", wires: [["hn1"]], baseTimeType: "msgIngress", baseTime: "", conditions: [{operator: "before", operands: {type: "time", value: "10:00", offset: 0, random: false}}, {operator: "after", operands: {type: "time", value: "10:00", offset: 0, random: false}}], allMustMatch: false, annotateOnly: false}, hlpNode, cfgNode];
            sinon.stub(sfUtils, "evaluateCondition").returns(false);

            helper.load([configNode, filterNode], flow, credentials, function()
            {
                try
                {
                    const fn1 = helper.getNode("fn1");
                    const hn1 = helper.getNode("hn1");

                    hn1.on("input", function(msg)
                    {

                        done("unexpected message received");
                    });

                    fn1.receive({payload: "test"});
                    done();
                }
                catch (e)
                {
                    done(e);
                }
            });
        });

        it("should filter out (one match, but all must match)", function(done)
        {
            const flow = [{id: "fn1", type: "chronos-filter", name: "filter", config: "cn1", wires: [["hn1"]], baseTimeType: "msgIngress", baseTime: "", conditions: [{operator: "before", operands: {type: "time", value: "10:00", offset: 0, random: false}}, {operator: "after", operands: {type: "time", value: "10:00", offset: 0, random: false}}], allMustMatch: true, annotateOnly: false}, hlpNode, cfgNode];
            sinon.stub(sfUtils, "evaluateCondition").onFirstCall().returns(false).onSecondCall().returns(true);

            helper.load([configNode, filterNode], flow, credentials, function()
            {
                try
                {
                    const fn1 = helper.getNode("fn1");
                    const hn1 = helper.getNode("hn1");

                    hn1.on("input", function(msg)
                    {

                        done("unexpected message received");
                    });

                    fn1.allMustMatch.should.be.true();
                    fn1.receive({payload: "test"});
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
