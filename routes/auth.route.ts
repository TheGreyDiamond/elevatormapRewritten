module.exports = function (app, con, logger, metainfo, jsonConfig) {
    const greetingTime = require("greeting-time");
    const fs = require("fs");
    const Eta = require("eta");
    const { verify } = require("hcaptcha");
    const bcrypt = require("bcrypt");
    const cryptoF = require("crypto");
    const saltRounds = 10;

    const mailRegex =
        /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/;

    app.get("/logout", function (req, res) {
        req.session.destroy();
        const data = fs.readFileSync("templates/redirect.html", "utf8");
        res.send(
            Eta.render(data, {
                author: metainfo.author,
                desc: metainfo.desc,
                siteTitel: metainfo.sitePrefix + "Logout",
                fontawesomeKey: jsonConfig.fontAwesome,
                url: "/",
            })
        );
    });
    app.get("/verify*", function (req, res) {
        console.log(req.url.split("/")[2]);
        const stmt = "SELECT * FROM mailverification WHERE token = ?;";

        con.query(stmt, [req.url.split("/")[2]], function (err, result) {
            if (err) {
                res.status(404);
                res.send(
                    JSON.stringify({ state: "Failed", message: "Database error occured" })
                );
                logger.error(err);
            } else {
                if (result.length == 0) {
                    res.status(404);
                    res.send(
                        JSON.stringify({ state: "Failed", message: "Link already done" })
                    );
                } else {
                    console.log(result);
                    res.status(200);
                    const stmt2 = "DELETE FROM mailverification WHERE id=?";
                    console.log(result[0].id);
                    con.query(stmt2, [result[0].id], function (err, result, fields) {
                        // TODO handling of this
                        //logger.debug(err)
                        //console.log(result)
                    });
                    const stmt3 = "UPDATE users SET verificationState=1 WHERE email=?";
                    con.query(
                        stmt3,
                        [result[0].targetMail],
                        function (err, result, fields) {
                            // TODO handling of this
                            //logger.debug(err)
                            //console.log(result)
                        }
                    );
                    res.send(JSON.stringify({ state: "OK", message: "Done!" }));
                }
            }
        });
    });



    app.post("/register", function (req, res) {
        const sess = req.session;
        let resu;
        verify(jsonConfig.hCaptcha.secret, req.body["g-recaptcha-response"]).then(
            (data) => (resu = data)
        );
        /*.catch(setTimeout(() => {
              //if(resu.success == false){
                console.log("HERE");
                const data = fs.readFileSync("templates/genericError.html", "utf8");
                resu = "-1";
                con
                res.send(
                  Eta.render(data, {
                    author: metainfo.author,
                    desc: metainfo.desc,
                    siteTitel: metainfo.sitePrefix + "Error",
                    fontawesomeKey: jsonConfig.fontAwesome,
                    displayText: "There was an issue with the Captcha",
                  })
                );
              //}
              
            }, 0)
          );*/

        if (req.body.pass == req.body.pass2) {

            if (mailRegex.test(req.body.email)) {
                setTimeout(() => {
                    console.log(resu);
                    if (resu.success == true) {
                        bcrypt.hash(req.body.pass, saltRounds, (err, hash) => {
                            const data = fs.readFileSync(
                                "templates/genericError.html",
                                "utf8"
                            );
                            // SQL INSERT

                            const stmt =
                                "INSERT INTO users(email, username, passwordHash) VALUES(?, ?, ?)";
                            const stmt2 =
                                "INSERT INTO mailverification(targetMail, userID, token) VALUES(?, ?, ?)";
                            cryptoF.randomBytes(48, function (err, buffer) {
                                const token = buffer.toString("hex");
                                con.query(
                                    stmt,
                                    [req.body.email, req.body.username, hash],
                                    (err, results1) => {
                                        if (err) {
                                            res.send(
                                                Eta.render(data, {
                                                    author: metainfo.author,
                                                    desc: metainfo.desc,
                                                    siteTitel: metainfo.sitePrefix + "Error",
                                                    fontawesomeKey: jsonConfig.fontAwesome,
                                                    displayText:
                                                        "An error occured while creating your account.",
                                                })
                                            );
                                            return console.error(err.message);
                                        } else {
                                            // Create mail verification
                                            con.query(
                                                stmt2,
                                                [req.body.email, results1.insertId, token],
                                                (err, results) => {
                                                    if (err) {
                                                        res.send(
                                                            Eta.render(data, {
                                                                author: metainfo.author,
                                                                desc: metainfo.desc,
                                                                siteTitel: metainfo.sitePrefix + "Error",
                                                                fontawesomeKey: jsonConfig.fontAwesome,
                                                                displayText:
                                                                    "An error occured while creating your account.",
                                                            })
                                                        );
                                                        return console.error(err.message);
                                                    } else {
                                                        sess.username = req.body.username;
                                                        sess.uid = String(results1.insertId);
                                                        sess.mail = req.body.email;
                                                        // get inserted id
                                                        logger.info("Inserted Id:" + results.insertId);
                                                        res.send(
                                                            Eta.render(data, {
                                                                author: metainfo.author,
                                                                desc: metainfo.desc,
                                                                siteTitel: metainfo.sitePrefix + "Error",
                                                                fontawesomeKey: jsonConfig.fontAwesome,
                                                                displayText: "OK " + hash,
                                                            })
                                                        );
                                                        sendVerificationMail(results.insertId);
                                                    }
                                                }
                                            );
                                        }
                                    }
                                );
                            });
                        });
                    } else {
                        const data = fs.readFileSync("templates/register.html", "utf8");
                        res.send(
                            Eta.render(data, {
                                author: metainfo.author,
                                desc: metainfo.desc,
                                siteTitel: metainfo.sitePrefix + "Register",
                                fontawesomeKey: jsonConfig.fontAwesome,
                                sitekey: jsonConfig.hCaptcha.sitekey,
                                error: true,
                                errorMessage: "You failed the captcha, please try again.",
                            })
                        );
                    }
                }, 200);
            } else {
                // Passwords don't match up
                const data = fs.readFileSync("templates/register.html", "utf8");
                res.send(
                    Eta.render(data, {
                        author: metainfo.author,
                        desc: metainfo.desc,
                        siteTitel: metainfo.sitePrefix + "Register",
                        fontawesomeKey: jsonConfig.fontAwesome,
                        sitekey: jsonConfig.hCaptcha.sitekey,
                        error: true,
                        errorMessage: "The E-Mail given is not valid",
                    })
                );
            }
        } else {
            // Passwords don't match up
            const data = fs.readFileSync("templates/register.html", "utf8");
            res.send(
                Eta.render(data, {
                    author: metainfo.author,
                    desc: metainfo.desc,
                    siteTitel: metainfo.sitePrefix + "Register",
                    fontawesomeKey: jsonConfig.fontAwesome,
                    sitekey: jsonConfig.hCaptcha.sitekey,
                    error: true,
                    errorMessage: "The password have to match up.",
                })
            );
        }
    });


    app.get("/register", function (req, res) {
        const data = fs.readFileSync("templates/register.html", "utf8");
        res.send(
            Eta.render(data, {
                author: metainfo.author,
                desc: metainfo.desc,
                siteTitel: metainfo.sitePrefix + "Register",
                fontawesomeKey: jsonConfig.fontAwesome,
                sitekey: jsonConfig.hCaptcha.sitekey,
            })
        );

    });



    app.get("/profile", function (req, res) {
        if (req.session.username != undefined) {
            let greeting = greetingTime(new Date());
            greeting += req.session.username;
            const hash = cryptoF
                .createHash("md5")
                .update(req.session.mail.replace(" ", "").toLowerCase())
                .digest("hex");
            const gravatarURL = "https://www.gravatar.com/avatar/" + hash;
            const data = fs.readFileSync("templates/profile.html", "utf8");
            res.send(
                Eta.render(data, {
                    author: metainfo.author,
                    desc: metainfo.desc,
                    siteTitel: metainfo.sitePrefix + "Profile",
                    fontawesomeKey: jsonConfig.fontAwesome,
                    greeting: greeting,
                    gravatarURL: gravatarURL,
                })
            );
        } else {
            const data = fs.readFileSync("templates/redirect.html", "utf8");
            res.send(
                Eta.render(data, {
                    author: metainfo.author,
                    desc: metainfo.desc,
                    siteTitel: metainfo.sitePrefix + "Profile",
                    fontawesomeKey: jsonConfig.fontAwesome,
                    url: "/login",
                })
            );
        }

    });

    app.get("/login", function (req, res) {

        const data = fs.readFileSync("templates/login.html", "utf8");
        res.send(
            Eta.render(data, {
                author: metainfo.author,
                desc: metainfo.desc,
                siteTitel: metainfo.sitePrefix + "Login",
                fontawesomeKey: jsonConfig.fontAwesome,
            })
        );

    });


    app.post("/login", function (req, res) {
        const password = req.body.pass;
        const mail = req.body.email;
        const sess = req.session;
        console.log(req.body.pass);

        // Check if okay
        if (
            mail != undefined &&
            mail != "" &&
            password != undefined &&
            password != ""
        ) {
            if (mailRegex.test(mail)) {
                const stmt = "SELECT * FROM users WHERE email='?';";
                con.query(stmt, [mail], function (err, result) {
                    if (err) throw err; // TODO proper error page
                    if (result.length == 0) {
                        const data = fs.readFileSync("templates/login.html", "utf8");
                        res.send(
                            Eta.render(data, {
                                author: metainfo.author,
                                desc: metainfo.desc,
                                siteTitel: metainfo.sitePrefix + "Ok",
                                fontawesomeKey: jsonConfig.fontAwesome,
                                error: true,
                                errorMessage: "This user does not exist!",
                            })
                        );
                    } else {
                        bcrypt.compare(
                            password,
                            result[0].passwordHash,
                            function (error, response) {
                                if (response) {
                                    // Login okay
                                    sess.username = result[0].username;
                                    sess.uid = String(result[0].id);
                                    sess.mail = result[0].email;

                                    const data = fs.readFileSync("templates/redirect.html", "utf8");
                                    if (req.query.r != undefined && req.query.r != "") {
                                        res.send(
                                            Eta.render(data, {
                                                author: metainfo.author,
                                                desc: metainfo.desc,
                                                siteTitel: metainfo.sitePrefix + "Ok",
                                                fontawesomeKey: jsonConfig.fontAwesome,
                                                url: req.query.r,
                                            })
                                        );

                                    } else {
                                        res.send(
                                            Eta.render(data, {
                                                author: metainfo.author,
                                                desc: metainfo.desc,
                                                siteTitel: metainfo.sitePrefix + "Ok",
                                                fontawesomeKey: jsonConfig.fontAwesome,
                                                url: "/profile",
                                            })
                                        );
                                    }

                                } else {
                                    // Password falsch
                                    const data = fs.readFileSync("templates/login.html", "utf8");
                                    res.send(
                                        Eta.render(data, {
                                            author: metainfo.author,
                                            desc: metainfo.desc,
                                            siteTitel: metainfo.sitePrefix + "Ok",
                                            fontawesomeKey: jsonConfig.fontAwesome,
                                            error: true,
                                            errorMessage: "The given password is wrong.",
                                        })
                                    );
                                }
                            }
                        );
                    }
                });
            } else {
                const data = fs.readFileSync("templates/login.html", "utf8");
                res.send(
                    Eta.render(data, {
                        author: metainfo.author,
                        desc: metainfo.desc,
                        siteTitel: metainfo.sitePrefix + "Ok",
                        fontawesomeKey: jsonConfig.fontAwesome,
                        error: true,
                        errorMessage: "The given E-Mail is invalid.",
                    })
                );
            }
        } else {
            logger.warn(
                "The login form did not sent all data. Dump: \n Password: " +
                password +
                " \n E-Mail: " +
                mail
            );
            const data = fs.readFileSync("templates/genericError.html", "utf8");
            const displayText = "The form did not sent all the information needed.";
            res.send(
                Eta.render(data, {
                    author: metainfo.author,
                    desc: metainfo.desc,
                    siteTitel: metainfo.sitePrefix + "Error",
                    fontawesomeKey: jsonConfig.fontAwesome,
                    displayText: displayText,
                })
            );
        }
    });

    // sendVerificationMail(2);
    function sendVerificationMail(userId) {
        // Query for the mail
        const stmt = "SELECT * FROM mailverification WHERE id=?";// + userId;
        con.query(stmt, [userId], function (err, result, fields) {
            if (err) throw err; // TODO proper error handling
            if (result.length == 0) {
                logger.warn(
                    "sendVerificationMail failed because ID " + userId + " doesnt exist!"
                );
            } else {
                const emailContent =
                    "Hi! \n You have created an account for the open elevator map. To finalize the process please verify your E-Mail adress. Use this link: http://" +
                    serverAdress +
                    "/verify/" +
                    result[0].token;
                transport.sendMail({
                    from: '"Elevator map " <' + mailConf.username + ">", // sender address
                    to: result[0].targetMail, // list of receivers
                    subject: "[Elevator map] Please verify your Mailadress", // Subject line
                    text: emailContent, // plain text body
                    html: emailContent.replace("\n", "<br>"), // html body
                });
            }

            console.log(result);
        });

        /*
        let info = await transporter.sendMail({
          from: '"Elevator map " <' + mysqlData.username + '>', // sender address
          to: "bar@example.com, baz@example.com", // list of receivers
          subject: "Hello ✔", // Subject line
          text: "Hello world?", // plain text body
          html: "<b>Hello world?</b>", // html body
        });*/
    }


}