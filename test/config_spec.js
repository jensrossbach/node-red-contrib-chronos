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
const chronos = require("../nodes/common/chronos.js");

describe("configuration node", function()
{
    before(function(done)
    {
        helper.startServer(done);
    });

    after(function(done)
    {
        helper.stopServer(done);
    });

    beforeEach(function()
    {
        sinon.spy(chronos, "initCustomTimes");
    });

    afterEach(function()
    {
        helper.unload();
        sinon.restore();
    });

    it("should have valid coordinates", async function()
    {
        const flow = [{id: "cn1", type: "chronos-config", name: "config"}];
        const credentials = {"cn1": {latitude: "50", longitude: "10"}};

        await helper.load(configNode, flow, credentials);
        const cn1 = helper.getNode("cn1");
        cn1.should.have.ownProperty("latitude", 50);
        cn1.should.have.ownProperty("longitude", 10);
    });

    it("should init custom times", async function()
    {
        const flow = [{id: "cn1", type: "chronos-config", name: "config", sunPositions: [{angle: 5, riseName: "testRise", setName: "testSet"}, {angle: -3, riseName: "testRise2", setName: "testSet2"}]}];
        const credentials = {"cn1": {latitude: "50", longitude: "10"}};

        await helper.load(configNode, flow, credentials);
        chronos.initCustomTimes.should.be.calledOnce().and.calledWith(flow[0].sunPositions);
    });

    it("should not init custom times due to invalid names", async function()
    {
        const flow = [{id: "cn1", type: "chronos-config", name: "config", sunPositions: [{angle: 5, riseName: "invalid.name", setName: "testSet"}]}];
        const credentials = {"cn1": {latitude: "50", longitude: "10"}};

        await helper.load(configNode, flow, credentials);
        chronos.initCustomTimes.should.not.be.called();
    });

    it("should not init custom times due to duplicate names", async function()
    {
        const flow = [{id: "cn1", type: "chronos-config", name: "config", sunPositions: [{angle: 5, riseName: "testRise1", setName: "testSet1"}, {angle: -3, riseName: "testRise2", setName: "testSet1"}]}];
        const credentials = {"cn1": {latitude: "50", longitude: "10"}};

        await helper.load(configNode, flow, credentials);
        chronos.initCustomTimes.should.not.be.called();
    });
});
