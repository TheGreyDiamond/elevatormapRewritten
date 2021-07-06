module.exports = function (app, con, mysqlIsUpAndOkay, logger) {
    const multer = require("multer");
    const upload = multer({ dest: "static/uploads/" });
    const fs = require("fs");
    const path = require("path");

    app.get("/api/getElevatorById", function (req, res) {
        console.log(req.query);
        if (req.query.id != undefined) {
            // All parameters are there
            res.setHeader("Content-Type", "application/json");
            try {
                const id = parseFloat(req.query.id);
            } catch (error) {
                res.send(
                    JSON.stringify({ state: "Failed", message: "Invalid arguments" })
                );
                res.status(400);
                return;
            }
            const id = parseFloat(req.query.id);

            con.query(
                "SELECT * FROM elevators WHERE id=" + id,
                function (err, result) {
                    if (err) {
                        res.status(500);
                        res.send(
                            JSON.stringify({
                                state: "Failed",
                                message: "A server side error occured.",
                                results: [],
                            })
                        );
                        logger.error("The server failed to execute a request");
                        console.log(err);
                        mysqlIsUpAndOkay = false;
                    } else {
                        console.log(result[0]);
                        res.status(200);
                        res.send(
                            JSON.stringify({
                                state: "Ok",
                                message: "Successful.",
                                results: result,
                            })
                        );
                    }
                }
            );
        } else {
            // Welp something is missing
            res.status(400);
            res.setHeader("Content-Type", "application/json");
            res.send(JSON.stringify({ state: "Failed", message: "Missing arguments" }));
        }
    });

    app.get("/api/resolveNameById", function (req, res) {
        if (req.query.id != undefined && req.query.id != "") {

            const sql = "SELECT username FROM users WHERE id=?";
            con.query(sql, [req.query.id], function (err, result) {
                if (err) {
                    res.status(500);
                    res.send(
                        JSON.stringify({
                            state: "Failed",
                            message: "A server side error occured.",
                            results: [],
                        })
                    );
                    logger.error("The server failed to execute a request");
                    mysqlIsUpAndOkay = false;
                } else {
                    console.log(result[0]);
                    res.status(200);
                    res.setHeader("Content-Type", "application/json");
                    res.send(
                        JSON.stringify({ state: "Ok", message: "", results: result })
                    );
                }
            }
            );
        } else {
            res.status(400);
            res.setHeader("Content-Type", "application/json");
            res.send(JSON.stringify({ state: "Failed", message: "Missing argument: id" }));
        }
    });


    app.get("/api/getElevatorLocation", function (req, res) {
        if (
            req.query.lan != undefined &&
            req.query.lat != undefined &&
            req.query.radius != undefined
        ) {
            // All parameters are there
            res.setHeader("Content-Type", "application/json");
            try {
                const lan = parseFloat(req.query.lan);
                const lat = parseFloat(req.query.lat);
                const radius = parseFloat(req.query.radius);
            } catch (error) {
                res.send(
                    JSON.stringify({ state: "Failed", message: "Invalid arguments" })
                );
                res.status(400);
                return;
            }
            const lan = parseFloat(req.query.lan);
            const lat = parseFloat(req.query.lat);
            const radius = parseFloat(req.query.radius);

            // TODO: Return just the elevators in the viewers area

            con.query(
                "SELECT id, lat, lng FROM elevators",
                function (err, result, fields) {
                    if (err) {
                        res.status(500);
                        res.send(
                            JSON.stringify({
                                state: "Failed",
                                message: "A server side error occured.",
                                results: [],
                            })
                        );
                        logger.error("The server failed to execute a request");
                        mysqlIsUpAndOkay = false;
                    } else {
                        console.log(result[0]);
                        res.status(200);
                        res.send(
                            JSON.stringify({ state: "Ok", message: "", results: result })
                        );
                    }
                }
            );
        } else {
            // Welp something is missing
            res.status(400);
            res.setHeader("Content-Type", "application/json");
            res.send(JSON.stringify({ state: "Failed", message: "Missing arguments" }));
        }
    });

    // returns an object with the cookies' name as keys
    const getAppCookies = (req) => {
        // We extract the raw cookies from the request headers
        const rawCookies = req.headers.cookie.split("; ");
        // rawCookies = ['myapp=secretcookie, 'analytics_cookie=beacon;']

        const parsedCookies = {};
        rawCookies.forEach((rawCookie) => {
            const parsedCookie = rawCookie.split("=");
            // parsedCookie = ['myapp', 'secretcookie'], ['analytics_cookie', 'beacon']
            parsedCookies[parsedCookie[0]] = parsedCookie[1];
        });
        return parsedCookies;
    };

    app.post("/api/saveNewElevatorMeta", function (req, res) {
        const sess = req.session;
        const tempJs = JSON.parse(decodeURIComponent(getAppCookies(req)["tempStore"]));
        const sql =
            "INSERT INTO elevators (lat, lng, manufacturer, modell, info, visitabilty, technology, amountOfFloors, maxPassangers, maxWeight, images, creator) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '{ \"images\": []}', ?)";
        con.query(
            sql,
            [
                tempJs.lat,
                tempJs.lng,
                tempJs.manuf,
                tempJs.model,
                tempJs.description,
                tempJs.visit,
                tempJs.type,
                tempJs.flor,
                tempJs.pepl,
                tempJs.weig,
                sess.uid
            ],
            function (err, result) {
                if (err) throw err;
                console.log("1 record inserted with id " + result.insertId);
                res.setHeader("Content-Type", "application/json");

                res.send(
                    JSON.stringify({ state: "Okay", message: "Ok. No fault!", id: result.insertId })
                );
                res.status(200);
            }
        );
    });


    app.post("/api/uploadImage", upload.any(), function (req, res) {
        console.log(req.query.id)
        let i = 0;
        const sql = 'SELECT id, images FROM elevators WHERE id=?';
        const allImages = []
        while (i < req.files.length) {
            const fObj = req.files[i];
            const currentPath = path.join(fObj["path"]);
            const destinationPath =
                currentPath +
                "." +
                fObj["originalname"].split(".")[
                fObj["originalname"].split(".").length - 1
                ]; // Add the file end

            fs.rename(currentPath, destinationPath, function (err) {
                if (err) {
                    throw err;
                } else {
                    console.log("Successfully moved the file!");
                }
            });
            allImages.push({ "path": destinationPath, "alt": "No alt was provided." })
            i++;
        }

        con.query(
            sql, [req.query.id],
            function (err, result, fields) {
                if (err) {
                    res.status(500);
                    res.send(
                        JSON.stringify({
                            state: "Failed",
                            message: "A server side error occured.",
                            results: [],
                        })
                    );
                    logger.error("The server failed to execute a request");
                    mysqlIsUpAndOkay = false;
                } else {
                    const jData = JSON.parse(result[0].images)
                    console.log(jData)
                    jData.images.push.spread(jData.images, allImages)
                    console.log(jData);
                    console.log(result);
                    const sql = "UPDATE elevators SET images = ? WHERE id = ?";
                    con.query(sql, [JSON.stringify(jData), req.query.id], function (err) {
                        if (err) {
                            console.log("Update failure")
                        } else {
                            console.log("Okay")
                        }

                    })
                }
            }
        );

        // Save Image End
    });


    app.get("/api/getElevators", function (req, res) {
        console.log(req.query);
        if (
            req.query.lan != undefined &&
            req.query.lat != undefined &&
            req.query.radius != undefined
        ) {
            // All parameters are there
            res.setHeader("Content-Type", "application/json");
            try {
                const lan = parseFloat(req.query.lan);
                const lat = parseFloat(req.query.lat);
                const radius = parseFloat(req.query.radius);
            } catch (error) {
                res.send(
                    JSON.stringify({ state: "Failed", message: "Invalid arguments" })
                );
                res.status(400);
                return;
            }
            const lan = parseFloat(req.query.lan);
            const lat = parseFloat(req.query.lat);
            const radius = parseFloat(req.query.radius);

            // TODO: Return just the elevators in the viewers area

            con.query("SELECT * FROM elevators", function (err, result) {
                if (err) {
                    res.status(500);
                    res.send(
                        JSON.stringify({
                            state: "Failed",
                            message: "A server side error occured.",
                            results: [],
                        })
                    );
                    logger.error("The server failed to execute a request");
                    mysqlIsUpAndOkay = false;
                } else {
                    console.log(result[0]);
                    res.status(200);
                    res.send(JSON.stringify({ state: "Ok", message: "", results: result }));
                }
            });
        } else {
            // Welp something is missing
            res.status(400);
            res.setHeader("Content-Type", "application/json");
            res.send(JSON.stringify({ state: "Failed", message: "Missing arguments" }));
        }
    });
}