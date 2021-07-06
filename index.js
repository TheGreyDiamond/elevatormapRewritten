// Imports
var express = require("express");
var fs = require("fs");
var Eta = require("eta");
var winston = require("winston");
var mysql = require("mysql");
var bodyParser = require("body-parser");
// const csp = require(`helmet`);
var session = require("express-session");
var nodemailer = require("nodemailer");
// Inting the logger
var logger = winston.createLogger({
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
    ]
});
logger.add(new winston.transports.Console({
    format: winston.format.simple()
}));
var app = express();
app.use(express.static("static"));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(function (req, res, next) {
    var pathesWhichRequireDB = ["map", "login", "register"];
    var pathesWhichRequireLogin = ["createElevator"];
    var path = req.path;
    var pathesDes = path.split("/");
    var requiresDB = false;
    var requiresLogin = false;
    var allowContinue = true;
    console.log(pathesDes);
    if (pathesWhichRequireLogin.indexOf(pathesDes[1]) > -1) {
        requiresLogin = true;
    }
    if (pathesDes[1] == "api") {
        requiresDB = true;
    }
    if (pathesWhichRequireDB.indexOf(pathesDes[1]) > -1) {
        requiresDB = true;
    }
    if (requiresDB) {
        if (!mysqlIsUpAndOkay) {
            allowContinue = false;
            var data = fs.readFileSync("templates/dbError.html", "utf8");
            var displayText = "This might be an artifact of a recent restart. Maybe wait a few minutes and reload this page.";
            if (startUpTime + 60 <= Math.floor(new Date().getTime() / 1000)) {
                displayText =
                    "The server failed to connect to the MySQL server. This means it was unable to load any data.";
            }
            if (mySQLstate == 1) {
                displayText =
                    "There is a problem with the database servers setup. Please check the log for more info.";
            }
            res.send(Eta.render(data, {
                author: metainfo.author,
                desc: metainfo.desc,
                siteTitel: metainfo.sitePrefix + "Error",
                fontawesomeKey: fontawesomeKey,
                displayText: displayText
            }));
        }
    }
    if (requiresLogin) {
        allowContinue = false;
        var data = fs.readFileSync("templates/redirect.html", "utf8");
        res.send(Eta.render(data, {
            author: metainfo.author,
            desc: metainfo.desc,
            siteTitel: metainfo.sitePrefix + "Redirect",
            fontawesomeKey: fontawesomeKey,
            url: "/login?r=" + path
        }));
    }
    console.log('Time:', Date.now());
    if (allowContinue) {
        next();
    }
    else {
        console.log("Stopped further exec of route");
    }
});
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
var port = 3000;
var startUpTime = Math.floor(new Date().getTime() / 1000);
var fontawesomeKey = "";
var mapboxAccessToken = "";
var mysqlData = { "user": "", "password": "", "database": "", "allowCreation": false };
var hCaptcha = { "sitekey": "", "secret": "" };
var mailConf = { "host": "", "port": 0, "username": "", "password": "" };
var serverAdress = "";
var cookieSecret = "";
var jsonConfigGlobal = {};
// Load config
try {
    var data = fs.readFileSync("config/default.json", "utf8");
    var jsonContent = JSON.parse(data);
    var jsonConfig = jsonContent;
    if (jsonContent.redirectConfig) {
        var data_1 = fs.readFileSync("config/" + jsonContent.redirectConfig, "utf8");
        jsonConfig = JSON.parse(data_1);
    }
    fontawesomeKey = jsonConfig.fontAwesome;
    mapboxAccessToken = jsonConfig.mapboxAccessToken;
    mysqlData = jsonConfig.mysql;
    mailConf = jsonConfig.mail;
    serverAdress = jsonConfig.serverAdress;
    cookieSecret =
        jsonConfig.cookieSecret || "saF0DSF65AS4DF0S4D6F0S54DF0Fad";
    jsonConfigGlobal = jsonConfig;
}
catch (error) {
    logger.error("While reading the config an error occured. The error was: " + error);
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
        pass: mailConf.password
    }
});
//let transporter = nodemailer.createTransport(transport)
//console.log(transport.host)
logger.info("Testing SMTP connection");
transport.verify(function (error) {
    if (error) {
        logger.error(error);
    }
    else {
        logger.info("SMPT server is ready to accept messages");
    }
});
app.use(session({ secret: cookieSecret }));
// Basic defines for html
var metainfo = {
    author: "TheGreydiamond",
    desc: "The Elevatormap. A map for elevator spotters!",
    sitePrefix: "Elevatormap - "
};
var mysqlIsUpAndOkay = false;
var mySQLstate = 0; // 0 -> Default failure   1 -> Missing strucutre
// Prepare MYSQL
var con = mysql.createConnection({
    host: "localhost",
    user: mysqlData.user,
    password: mysqlData.password,
    database: mysqlData.database
});
function checkIfMySQLStructureIsReady() {
    if (mysqlIsUpAndOkay) {
        // Only if MySQL is ready
        logger.debug("Checking MySQL strucutre");
        con.query("SHOW TABLES;", function (err, result, fields) {
            if (err)
                throw err;
            if (result.length == 0) {
                // There are no tables. Not good.
                logger.warn("There are no tables found");
                if (mysqlData.allowCreation) {
                    // Lets create it then
                    logger.warn("Creating a new table");
                    var sql = "CREATE TABLE `" +
                        mysqlData.database +
                        "`.`elevators` ( `id` INT NOT NULL AUTO_INCREMENT , `lat` FLOAT NOT NULL , `lng` FLOAT NOT NULL , `manufacturer` VARCHAR(512) NOT NULL , `modell` VARCHAR(512) NOT NULL , `info` VARCHAR(512) NOT NULL , `visitabilty` INT NOT NULL , `technology` INT NOT NULL , `images` JSON NOT NULL , `amountOfFloors` INT NOT NULL , `maxPassangers` INT NOT NULL , `maxWeight` INT NOT NULL , `creator` INT NOT NULL, PRIMARY KEY (`id`)) ENGINE = InnoDB;";
                    var newSql = "CREATE TABLE `" +
                        mysqlData.database +
                        "`.`users` ( `id` INT NOT NULL AUTO_INCREMENT , `email` VARCHAR(255) NOT NULL , `username` VARCHAR(255) NOT NULL , `passwordHash` VARCHAR(512) NOT NULL , `permLevel` INT NOT NULL DEFAULT '0' , `verificationState` INT NOT NULL DEFAULT '0' , PRIMARY KEY (`id`), UNIQUE KEY (`email`)) ENGINE = InnoDB;";
                    var newSqlMailVeri = "CREATE TABLE `" +
                        mysqlData.database +
                        "`.`mailverification` ( `id` INT NOT NULL AUTO_INCREMENT , `targetMail` VARCHAR(512) NOT NULL , `userID` INT NOT NULL , `token` VARCHAR(255) NOT NULL , PRIMARY KEY (`id`)) ENGINE = InnoDB;";
                    con.query(sql, function (err, result) {
                        if (err)
                            throw err;
                        logger.info("Table created");
                    });
                    con.query(newSql, function (err, result) {
                        if (err)
                            throw err;
                        logger.info("Usertable created");
                    });
                    con.query(newSqlMailVeri, function (err, result) {
                        if (err)
                            throw err;
                        logger.info("Email verification table created");
                    });
                }
                else {
                    // We cannot do that. Welp.
                    logger.warn("MySQL tables are missing and the config denies creation of new ones.");
                    mysqlIsUpAndOkay = false;
                    mySQLstate = 1;
                }
            }
        });
    }
    else {
        logger.warn("Tried checking the tables even though MySQL wasn't ready.");
    }
}
con.connect(function (err) {
    if (err) {
        mysqlIsUpAndOkay = false;
        logger.error("Connction to MySQL failed");
        console.log(err);
    }
    else {
        logger.info("Mysql is ready.");
        mysqlIsUpAndOkay = true;
        checkIfMySQLStructureIsReady();
    }
});
// Routes
app.get("/", function (req, res) {
    var data = fs.readFileSync("templates/index.html", "utf8");
    res.send(Eta.render(data, {
        author: metainfo.author,
        desc: metainfo.desc,
        siteTitel: metainfo.sitePrefix + "Start",
        fontawesomeKey: fontawesomeKey
    }));
});
app.get("/map", function (req, res) {
    var data = fs.readFileSync("templates/map.html", "utf8");
    res.send(Eta.render(data, {
        author: metainfo.author,
        desc: metainfo.desc,
        siteTitel: metainfo.sitePrefix + "Map",
        fontawesomeKey: fontawesomeKey,
        mapboxAccessToken: mapboxAccessToken
    }));
});
app.get("/createElevator", function (req, res) {
    var data = fs.readFileSync("templates/createElevator.html", "utf8");
    res.send(Eta.render(data, {
        author: metainfo.author,
        desc: metainfo.desc,
        siteTitel: metainfo.sitePrefix + "New elevator",
        fontawesomeKey: fontawesomeKey,
        mapboxAccessToken: mapboxAccessToken
    }));
});
require('./Routes/api.route.ts')(app, con, mysqlIsUpAndOkay, logger, metainfo);
require('./Routes/debug.route.ts')(app, con, logger, metainfo);
require('./Routes/auth.route.ts')(app, con, logger, metainfo, jsonConfigGlobal);
// Some loops for handeling stuff
setInterval(function () {
    if (mysqlIsUpAndOkay == false) {
        logger.warn("Retrying to connect to MySQL");
        con = mysql.createConnection({
            host: "localhost",
            user: mysqlData.user,
            password: mysqlData.password,
            database: mysqlData.database
        });
        con.connect(function (err) {
            if (err) {
                mysqlIsUpAndOkay = false;
                logger.error("Connction to MySQL failed");
                console.log(err);
            }
            else {
                logger.info("Mysql is ready.");
                mysqlIsUpAndOkay = true;
            }
        });
    }
}, 60000);
// App start
app.listen(port, function () {
    logger.info("Elevator map ready at http://localhost:" + port);
});
