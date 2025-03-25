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

module.exports = function(RED)
{
    RED.httpAdmin.get("/chronos_config", RED.auth.needsPermission("chronos.read"), function(req, res)
    {
        if (req.query.command === "getenv")
        {
            let value = process.env[req.query.varname];
            res.json((typeof value == "undefined") ? "not found" : value);
        }
    });

    function ChronosConfigNode(config)
    {
        const chronos = require("./common/chronos.js");

        RED.nodes.createNode(this, config);

        this.name = config.name;
        this.timezone = config.timezone;

        if (config.latitudeType === "global")
        {
            this.latitude = this.credentials.latitude;
        }
        else if (config.latitudeType === "env")
        {
            this.latitude = parseFloat(
                                RED.util.evaluateNodeProperty(
                                            this.credentials.latitude,
                                            config.latitudeType,
                                            this));
        }
        else
        {
            this.latitude = parseFloat(this.credentials.latitude);
        }

        if (config.longitudeType === "global")
        {
            this.longitude = this.credentials.longitude;
        }
        else if (config.longitudeType === "env")
        {
            this.longitude = parseFloat(
                                RED.util.evaluateNodeProperty(
                                            this.credentials.longitude,
                                            config.longitudeType,
                                            this));
        }
        else
        {
            this.longitude = parseFloat(this.credentials.longitude);
        }

        if (validateCustomTimes(config.sunPositions))
        {
            chronos.initCustomTimes(config.sunPositions);
        }

        function validateCustomTimes(data)
        {
            if (data && (data.length > 0))
            {
                const EXP = /^[0-9a-zA-Z_]+$/;
                const names = [];
                let valid = true;

                // check for invalid names
                for (let i=0; i<data.length; ++i)
                {
                    if (!EXP.test(data[i].riseName) || !EXP.test(data[i].setName))
                    {
                        valid = false;
                        break;
                    }

                    names.push(data[i].riseName);
                    names.push(data[i].setName);
                    if (hasDuplicates(names))
                    {
                        valid = false;
                        break;
                    }
                }

                return valid;
            }
            else
            {
                return false;
            }

            function hasDuplicates(arr)
            {
                return arr.some(item =>
                {
                    return (arr.indexOf(item) !== arr.lastIndexOf(item));
                });
            }
        }

    }

    RED.nodes.registerType("chronos-config", ChronosConfigNode,
    {
        credentials:
        {
            latitude: {type: "text"},
            longitude: {type: "text"}
        }
    });
};
