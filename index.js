// Imports
const express = require("express");
const fs = require("fs");
const Eta = require("eta");
const winston = require("winston");
const mysql = require("mysql");
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");
const { verify } = require("hcaptcha");
const csp = require(`helmet`);
const session = require("express-session");
const nodemailer = require("nodemailer");
const crypto = require("crypto");

// Inting the logger
const logger = winston.createLogger({
  level: "debug",
  format: winston.format.json(),
  defaultMeta: { service: "user-service" },
  transports: [
    //
    // - Write all logs with level `error` and below to `error.log`
    // - Write all logs with level `info` and below to `combined.log`
    //
    new winston.transports.File({ filename: "error.log", level: "error" }),
    new winston.transports.File({ filename: "combined.log" }),
  ],
});

logger.add(
  new winston.transports.Console({
    format: winston.format.simple(),
  })
);

const app = express();

app.use(express.static("static"));

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

/*
app.use(csp.contentSecurityPolicy({
  useDefaults: true,
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  directives: {
    "default-src": [`'self'`],
    "img-src": [`'self'`],
    scriptSrc: [`'self'`, `https://hcaptcha.com`, `https://*.hcaptcha.com`, `https://*.fontawesome.com`, "unsafe-inline", "unsafe-eval","'unsafe-inline'"],
    "script-src-attr": [`'self'`, `https://hcaptcha.com`, `https://*.hcaptcha.com`, `https://*.fontawesome.com`, "unsafe-inline", "unsafe-eval"],
    "frame-src": [`'self'`, `https://hcaptcha.com`, `https://*.hcaptcha.com`],
    "style-src": [`'self'`, `https://hcaptcha.com`, `https://*.hcaptcha.com`, `https://*.fontawesome.com`, `'unsafe-inline'`],
    "connect-src": [`'self'`, `https://hcaptcha.com`, `https://*.hcaptcha.com`, `https://*.fontawesome.com`],
    "font-src": [`'self'`, `https://*.fontawesome.com`],
  },
  
}))

*/

// Settings
const port = 3000;
const startUpTime = Math.floor(new Date().getTime() / 1000);
const saltRounds = 10;

// Load config
try {
  const data = fs.readFileSync("config/default.json", "utf8");
  const jsonContent = JSON.parse(data);
  let jsonConfig = jsonContent;
  if (jsonContent.redirectConfig) {
    const data = fs.readFileSync(
      "config/" + jsonContent.redirectConfig,
      "utf8"
    );
    jsonConfig = JSON.parse(data);
  }
  var fontawesomeKey = jsonConfig.fontAwesome;
  var mapboxAccessToken = jsonConfig.mapboxAccessToken;
  var mysqlData = jsonConfig.mysql;
  var hCaptcha = jsonConfig.hCaptcha;
  var mailConf = jsonConfig.mail;
  var serverAdress = jsonConfig.serverAdress;
  var cookieSecret =
    jsonConfig.cookieSecret || "saF0DSF65AS4DF0S4D6F0S54DF0Fad";
} catch (error) {
  logger.error(
    "While reading the config an error occured. The error was: " + error
  );
}

var transport = nodemailer.createTransport({
  host: mailConf.host,
  port: mailConf.port,
  requireTLS: true,
  secure: false,
  debug: true,
  disableFileAccess: true,
  //authMethod: "START TLS",
  auth: {
    user: mailConf.username,
    pass: mailConf.password,
  },
});

//let transporter = nodemailer.createTransport(transport)
//console.log(transport.host)
logger.info("Testing SMTP connection");
transport.verify(function (error, success) {
  if (error) {
    logger.error(error);
  } else {
    logger.info("SMPT server is ready to accept messages");
  }
});

app.use(session({ secret: cookieSecret }));

// Basic defines for html
const author = "TheGreydiamond";
const desc = "The Elevatormap. A map for elevator spotters!";
const sitePrefix = "Elevatormap - ";
let mysqlIsUpAndOkay = false;
let mySQLstate = 0; // 0 -> Default failure   1 -> Missing strucutre

// Prepare MYSQL
var con = mysql.createConnection({
  host: "localhost",
  user: mysqlData.user,
  password: mysqlData.password,
  database: mysqlData.database,
});

// sendVerificationMail(2);
function sendVerificationMail(userId) {
  // Query for the mail
  const stmt = "SELECT * FROM mailverification WHERE id=" + userId;
  con.query(stmt, function (err, result, fields) {
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
      let info = transport.sendMail({
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

function checkIfMySQLStructureIsReady() {
  if (mysqlIsUpAndOkay) {
    // Only if MySQL is ready
    logger.debug("Checking MySQL strucutre");
    con.query("SHOW TABLES;", function (err, result, fields) {
      if (err) throw err;
      if (result.length == 0) {
        // There are no tables. Not good.
        logger.warn("There are no tables found");
        if (mysqlData.allowCreation) {
          // Lets create it then
          logger.warn("Creating a new table");
          const sql =
            "CREATE TABLE `" +
            mysqlData.database +
            "`.`elevators` ( `id` INT NOT NULL AUTO_INCREMENT , `lat` FLOAT NOT NULL , `lng` FLOAT NOT NULL , `manufacturer` VARCHAR(512) NOT NULL , `modell` VARCHAR(512) NOT NULL , `info` VARCHAR(512) NOT NULL , `visitabilty` INT NOT NULL , `technology` INT NOT NULL , `images` JSON NOT NULL , `amountOfFloors` INT NOT NULL , `maxPassangers` INT NOT NULL , `maxWeight` INT NOT NULL , PRIMARY KEY (`id`)) ENGINE = InnoDB;";
          const newSql =
            "CREATE TABLE `" +
            mysqlData.database +
            "`.`users` ( `id` INT NOT NULL AUTO_INCREMENT , `email` VARCHAR(255) NOT NULL , `username` VARCHAR(255) NOT NULL , `passwordHash` VARCHAR(512) NOT NULL , `permLevel` INT NOT NULL DEFAULT '0' , `verificationState` INT NOT NULL DEFAULT '0' , PRIMARY KEY (`id`), UNIQUE KEY (`email`)) ENGINE = InnoDB;";
          const newSqlMailVeri =
            "CREATE TABLE `" +
            mysqlData.database +
            "`.`mailverification` ( `id` INT NOT NULL AUTO_INCREMENT , `targetMail` VARCHAR(512) NOT NULL , `userID` INT NOT NULL , `token` VARCHAR(255) NOT NULL , PRIMARY KEY (`id`)) ENGINE = InnoDB;";
          con.query(sql, function (err, result) {
            if (err) throw err;
            logger.info("Table created");
          });

          con.query(newSql, function (err, result) {
            if (err) throw err;
            logger.info("Usertable created");
          });

          con.query(newSqlMailVeri, function (err, result) {
            if (err) throw err;
            logger.info("Email verification table created");
          });
        } else {
          // We cannot do that. Welp.
          logger.warn(
            "MySQL tables are missing and the config denies creation of new ones."
          );
          mysqlIsUpAndOkay = false;
          mySQLstate = 1;
        }
      }
    });
  } else {
    logger.warn("Tried checking the tables even though MySQL wasn't ready.");
  }
}

con.connect(function (err) {
  if (err) {
    mysqlIsUpAndOkay = false;
    logger.error("Connction to MySQL failed");
  } else {
    logger.info("Mysql is ready.");
    mysqlIsUpAndOkay = true;
    checkIfMySQLStructureIsReady();
  }
});

// Routes
app.get("/", function (req, res) {
  const data = fs.readFileSync("templates/index.html", "utf8");
  res.send(
    Eta.render(data, {
      author: author,
      desc: desc,
      siteTitel: sitePrefix + "Start",
      fontawesomeKey: fontawesomeKey,
    })
  );
});

app.post("/login", function (req, res) {
  const password = req.body.pass;
  const mail = req.body.email;
  var sess = req.session;
  console.log(req.body.pass);

  // Check if okay
  if (
    mail != undefined &&
    mail != "" &&
    password != undefined &&
    password != ""
  ) {
    const mailRegex =
      /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/;
    if (mailRegex.test(mail)) {
      const stmt = "SELECT * FROM users WHERE email='" + mail + "';";
      con.query(stmt, function (err, result, fields) {
        if (err) throw err; // TODO proper error page
        if (result.length == 0) {
          const data = fs.readFileSync("templates/login.html", "utf8");
          res.send(
            Eta.render(data, {
              author: author,
              desc: desc,
              siteTitel: sitePrefix + "Ok",
              fontawesomeKey: fontawesomeKey,
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
                sess.id = result[0].id;
                sess.mail = result[0].email;

                const data = fs.readFileSync("templates/redirect.html", "utf8");
                res.send(
                  Eta.render(data, {
                    author: author,
                    desc: desc,
                    siteTitel: sitePrefix + "Ok",
                    fontawesomeKey: fontawesomeKey,
                    url: "/profile",
                  })
                );
              } else {
                // Password falsch
                const data = fs.readFileSync("templates/login.html", "utf8");
                res.send(
                  Eta.render(data, {
                    author: author,
                    desc: desc,
                    siteTitel: sitePrefix + "Ok",
                    fontawesomeKey: fontawesomeKey,
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
          author: author,
          desc: desc,
          siteTitel: sitePrefix + "Ok",
          fontawesomeKey: fontawesomeKey,
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
    var displayText = "The form did not sent all the information needed.";
    res.send(
      Eta.render(data, {
        author: author,
        desc: desc,
        siteTitel: sitePrefix + "Error",
        fontawesomeKey: fontawesomeKey,
        displayText: displayText,
      })
    );
  }
});

app.get("/login", function (req, res) {
  if (mysqlIsUpAndOkay) {
    const data = fs.readFileSync("templates/login.html", "utf8");
    res.send(
      Eta.render(data, {
        author: author,
        desc: desc,
        siteTitel: sitePrefix + "Login",
        fontawesomeKey: fontawesomeKey,
      })
    );
  } else {
    const data = fs.readFileSync("templates/dbError.html", "utf8");
    var displayText =
      "This might be an artifact of a recent restart. Maybe wait a few minutes and reload this page.";
    if (startUpTime + 60 <= Math.floor(new Date().getTime() / 1000)) {
      displayText =
        "The server failed to connect to the MySQL server. This means it was unable to load any data.";
    }
    if (mySQLstate == 1) {
      displayText =
        "There is a problem with the database servers setup. Please check the log for more info.";
    }

    res.send(
      Eta.render(data, {
        author: author,
        desc: desc,
        siteTitel: sitePrefix + "Error",
        fontawesomeKey: fontawesomeKey,
        displayText: displayText,
      })
    );
  }
});

app.get("/profile", function (req, res) {
  if (mysqlIsUpAndOkay) {
    if (req.session.username != undefined) {
      var Hour = new Date().getHours();
      var greeting = "Good night, ";
      if (Hour > 18) {
        greeting = "Good evening, "
      } else if (Hour > 13) {
        greeting = "Good afternoon, ";
      } else if (Hour > 5) {
        greeting = "Good morning, ";
      }
      greeting += req.session.username
      const hash = crypto.createHash('md5').update(req.session.mail.replace(" ", "").toLowerCase()).digest('hex');
      gravatarURL = "https://www.gravatar.com/avatar/" + hash
      const data = fs.readFileSync("templates/profile.html", "utf8");
      res.send(
        Eta.render(data, {
          author: author,
          desc: desc,
          siteTitel: sitePrefix + "Profile",
          fontawesomeKey: fontawesomeKey,
          greeting: greeting,
          gravatarURL: gravatarURL
        })
      );
    } else {
      const data = fs.readFileSync("templates/redirect.html", "utf8");
      res.send(
        Eta.render(data, {
          author: author,
          desc: desc,
          siteTitel: sitePrefix + "Profile",
          fontawesomeKey: fontawesomeKey,
          url: "/login",
        })
      );
    }
  } else {
    const data = fs.readFileSync("templates/dbError.html", "utf8");
    var displayText =
      "This might be an artifact of a recent restart. Maybe wait a few minutes and reload this page.";
    if (startUpTime + 60 <= Math.floor(new Date().getTime() / 1000)) {
      displayText =
        "The server failed to connect to the MySQL server. This means it was unable to load any data.";
    }
    if (mySQLstate == 1) {
      displayText =
        "There is a problem with the database servers setup. Please check the log for more info.";
    }

    res.send(
      Eta.render(data, {
        author: author,
        desc: desc,
        siteTitel: sitePrefix + "Error",
        fontawesomeKey: fontawesomeKey,
        displayText: displayText,
      })
    );
  }
});

app.get("/register", function (req, res) {
  if (mysqlIsUpAndOkay) {
    const data = fs.readFileSync("templates/register.html", "utf8");
    res.send(
      Eta.render(data, {
        author: author,
        desc: desc,
        siteTitel: sitePrefix + "Register",
        fontawesomeKey: fontawesomeKey,
        sitekey: hCaptcha.sitekey,
      })
    );
  } else {
    const data = fs.readFileSync("templates/dbError.html", "utf8");
    var displayText =
      "This might be an artifact of a recent restart. Maybe wait a few minutes and reload this page.";
    if (startUpTime + 60 <= Math.floor(new Date().getTime() / 1000)) {
      displayText =
        "The server failed to connect to the MySQL server. This means it was unable to load any data.";
    }
    if (mySQLstate == 1) {
      displayText =
        "There is a problem with the database servers setup. Please check the log for more info.";
    }

    res.send(
      Eta.render(data, {
        author: author,
        desc: desc,
        siteTitel: sitePrefix + "Error",
        fontawesomeKey: fontawesomeKey,
        displayText: displayText,
      })
    );
  }
});

app.post("/register", function (req, res) {
  if (mysqlIsUpAndOkay) {
    var sess = req.session;
    var resu;
    verify(hCaptcha.secret, req.body["g-recaptcha-response"]).then(
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
                author: author,
                desc: desc,
                siteTitel: sitePrefix + "Error",
                fontawesomeKey: fontawesomeKey,
                displayText: "There was an issue with the Captcha",
              })
            );
          //}
          
        }, 0)
      );*/

    if (req.body.pass == req.body.pass2) {
      const mailRegex =
        /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/;
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

              var stmt =
                "INSERT INTO users(email, username, passwordHash) VALUES(?, ?, ?)";
              var stmt2 =
                "INSERT INTO mailverification(targetMail, userID, token) VALUES(?, ?, ?)";
              crypto.randomBytes(48, function (err, buffer) {
                var token = buffer.toString("hex");
                con.query(
                  stmt,
                  [req.body.email, req.body.username, token],
                  (err, results1, fields) => {
                    if (err) {
                      res.send(
                        Eta.render(data, {
                          author: author,
                          desc: desc,
                          siteTitel: sitePrefix + "Error",
                          fontawesomeKey: fontawesomeKey,
                          displayText:
                            "An error occured while creating your account.",
                        })
                      );
                      return console.error(err.message);
                    } else {
                      // Create mail verification
                      con.query(
                        stmt2,
                        [req.body.email, results1.insertId, hash],
                        (err, results, fields) => {
                          if (err) {
                            res.send(
                              Eta.render(data, {
                                author: author,
                                desc: desc,
                                siteTitel: sitePrefix + "Error",
                                fontawesomeKey: fontawesomeKey,
                                displayText:
                                  "An error occured while creating your account.",
                              })
                            );
                            return console.error(err.message);
                          } else {
                            sess.username = req.body.username;
                            sess.id = results1.insertId;
                            sess.mail = req.body.email;
                            // get inserted id
                            logger.info("Inserted Id:" + results.insertId);
                            res.send(
                              Eta.render(data, {
                                author: author,
                                desc: desc,
                                siteTitel: sitePrefix + "Error",
                                fontawesomeKey: fontawesomeKey,
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
                author: author,
                desc: desc,
                siteTitel: sitePrefix + "Register",
                fontawesomeKey: fontawesomeKey,
                sitekey: hCaptcha.sitekey,
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
            author: author,
            desc: desc,
            siteTitel: sitePrefix + "Register",
            fontawesomeKey: fontawesomeKey,
            sitekey: hCaptcha.sitekey,
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
          author: author,
          desc: desc,
          siteTitel: sitePrefix + "Register",
          fontawesomeKey: fontawesomeKey,
          sitekey: hCaptcha.sitekey,
          error: true,
          errorMessage: "The password have to match up.",
        })
      );
    }
  } else {
    const data = fs.readFileSync("templates/dbError.html", "utf8");
    var displayText =
      "This might be an artifact of a recent restart. Maybe wait a few minutes and reload this page.";
    if (startUpTime + 60 <= Math.floor(new Date().getTime() / 1000)) {
      displayText =
        "The server failed to connect to the MySQL server. This means it was unable to load any data.";
    }
    if (mySQLstate == 1) {
      displayText =
        "There is a problem with the database servers setup. Please check the log for more info.";
    }

    res.send(
      Eta.render(data, {
        author: author,
        desc: desc,
        siteTitel: sitePrefix + "Error",
        fontawesomeKey: fontawesomeKey,
        displayText: displayText,
      })
    );
  }
});

// Routes
app.get("/verify*", function (req, res) {
  console.log(req.url.split("/")[2]);
  const data = fs.readFileSync("templates/genericError.html", "utf8");
  const stmt = "SELECT * FROM mailverification WHERE token = ?;";

  con.query(stmt, [req.url.split("/")[2]], function (err, result, fields) {
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
        stmt2 = "DELETE FROM mailverification WHERE id=?";
        console.log(result[0].id);
        con.query(stmt2, [result[0].id], function (err, result, fields) {
          // TODO handling of this
          //logger.debug(err)
          //console.log(result)
        });
        stmt3 = "UPDATE users SET verificationState=1 WHERE email=?";
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

app.get("/logout", function (req, res) {
  req.session.destroy();
 const data = fs.readFileSync("templates/redirect.html", "utf8");
  res.send(
    Eta.render(data, {
      author: author,
      desc: desc,
      siteTitel: sitePrefix + "Logout",
      fontawesomeKey: fontawesomeKey,
      url: "/",
    })
  );

});


app.get("/debug/showSessionInfo", function (req, res) {
  res.send(JSON.stringify(req.session));
});

app.get("/map", function (req, res) {
  if (mysqlIsUpAndOkay) {
    const data = fs.readFileSync("templates/map.html", "utf8");
    res.send(
      Eta.render(data, {
        author: author,
        desc: desc,
        siteTitel: sitePrefix + "Map",
        fontawesomeKey: fontawesomeKey,
        mapboxAccessToken: mapboxAccessToken,
      })
    );
  } else {
    const data = fs.readFileSync("templates/dbError.html", "utf8");
    var displayText =
      "This might be an artifact of a recent restart. Maybe wait a few minutes and reload this page.";
    if (startUpTime + 60 <= Math.floor(new Date().getTime() / 1000)) {
      displayText =
        "The server failed to connect to the MySQL server. This means it was unable to load any data.";
    }
    if (mySQLstate == 1) {
      displayText =
        "There is a problem with the database servers setup. Please check the log for more info.";
    }

    res.send(
      Eta.render(data, {
        author: author,
        desc: desc,
        siteTitel: sitePrefix + "Error",
        fontawesomeKey: fontawesomeKey,
        displayText: displayText,
      })
    );
  }
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
      var lan = parseFloat(req.query.lan);
      var lat = parseFloat(req.query.lat);
      var radius = parseFloat(req.query.radius);
    } catch (error) {
      res.send(
        JSON.stringify({ state: "Failed", message: "Invalid arguments" })
      );
      res.status(400);
      return;
    }
    var lan = parseFloat(req.query.lan);
    var lat = parseFloat(req.query.lat);
    var radius = parseFloat(req.query.radius);

    // TODO: Return just the elevators in the viewers area

    con.query("SELECT * FROM elevators", function (err, result, fields) {
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

app.get("/api/getElevatorLocation", function (req, res) {
  console.log(req.query);
  if (
    req.query.lan != undefined &&
    req.query.lat != undefined &&
    req.query.radius != undefined
  ) {
    // All parameters are there
    res.setHeader("Content-Type", "application/json");
    try {
      var lan = parseFloat(req.query.lan);
      var lat = parseFloat(req.query.lat);
      var radius = parseFloat(req.query.radius);
    } catch (error) {
      res.send(
        JSON.stringify({ state: "Failed", message: "Invalid arguments" })
      );
      res.status(400);
      return;
    }
    var lan = parseFloat(req.query.lan);
    var lat = parseFloat(req.query.lat);
    var radius = parseFloat(req.query.radius);

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

app.get("/api/getElevatorById", function (req, res) {
  console.log(req.query);
  if (req.query.id != undefined) {
    // All parameters are there
    res.setHeader("Content-Type", "application/json");
    try {
      var id = parseFloat(req.query.id);
    } catch (error) {
      res.send(
        JSON.stringify({ state: "Failed", message: "Invalid arguments" })
      );
      res.status(400);
      return;
    }
    var id = parseFloat(req.query.id);

    con.query(
      "SELECT * FROM elevators WHERE id=" + id,
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

// Some loops for handeling stuff
setInterval(() => {
  if (mysqlIsUpAndOkay == false) {
    logger.warn("Retrying to connect to MySQL");
    con = mysql.createConnection({
      host: "localhost",
      user: mysqlData.user,
      password: mysqlData.password,
      database: mysqlData.database,
    });

    con.connect(function (err) {
      if (err) {
        mysqlIsUpAndOkay = false;
        logger.error("Connction to MySQL failed");
      } else {
        logger.info("Mysql is ready.");
        mysqlIsUpAndOkay = true;
      }
    });
  }
}, 60000);

// App start
app.listen(port, () => {
  logger.info(`Elevator map ready at http://localhost:${port}`);
});
