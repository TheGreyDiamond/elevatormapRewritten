// Imports
const express = require("express");
const fs = require("fs");
const Eta = require("eta");
const winston = require("winston");
const mysql = require("mysql");
const bodyParser = require("body-parser");
const bcrypt = require('bcrypt');
const {verify} = require('hcaptcha');
const csp = require(`helmet`)


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
} catch (error) {
  logger.error(
    "While reading the config an error occured. The error was: " + error
  );
}


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
            "`.`users` ( `id` INT NOT NULL AUTO_INCREMENT , `email` VARCHAR(255) NOT NULL , `username` VARCHAR(255) NOT NULL , `passwordHash` VARCHAR(512) NOT NULL , `permLevel` INT NOT NULL DEFAULT '0' , PRIMARY KEY (`id`)) ENGINE = InnoDB;";
          con.query(sql, function (err, result) {
            if (err) throw err;
            logger.info("Table created");
          });

          con.query(newSql, function (err, result) {
            if (err) throw err;
            logger.info("Usertable created");
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
  console.log(req.body.pass);
  
  // Check if okay
  if(mail != undefined && mail != "" && password != undefined && password != ""){

    const data = fs.readFileSync("templates/genericError.html", "utf8");
    var displayText =
      "There is no error";
      res.send(
        Eta.render(data, {
          author: author,
          desc: desc,
          siteTitel: sitePrefix + "Ok",
          fontawesomeKey: fontawesomeKey,
          displayText: displayText,
        })
      );

  }else{
    logger.warn("The login form did not sent all data. Dump: \n Password: " + password + " \n E-Mail: " + mail)
    const data = fs.readFileSync("templates/genericError.html", "utf8");
    var displayText =
      "The form did not sent all the information needed.";
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





app.get("/register", function (req, res) {
  if (mysqlIsUpAndOkay) {
    const data = fs.readFileSync("templates/register.html", "utf8");
    res.send(
      Eta.render(data, {
        author: author,
        desc: desc,
        siteTitel: sitePrefix + "Register",
        fontawesomeKey: fontawesomeKey,
        sitekey: hCaptcha.sitekey
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
    console.log(req.body)
    var resu;
    verify(hCaptcha.secret, req.body["g-recaptcha-response"])
  .then((data) => resu = data)
  .catch(setTimeout(() => {
    const data = fs.readFileSync("templates/genericError.html", "utf8");
      res.send(
        Eta.render(data, {
          author: author,
          desc: desc,
          siteTitel: sitePrefix + "Error",
          fontawesomeKey: fontawesomeKey,
          displayText: "There was an issue with the Captcha",
        })
      );
  }, 0));
  setTimeout(() => {
    console.log(resu)
    if(resu.success == true){
      res.send("OK")
    }else{
      const data = fs.readFileSync("templates/genericError.html", "utf8");
      res.send(
        Eta.render(data, {
          author: author,
          desc: desc,
          siteTitel: sitePrefix + "Error",
          fontawesomeKey: fontawesomeKey,
          displayText: "The captcha returned a negativ result",
        })
      );
    }
  }, 200);
  
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
