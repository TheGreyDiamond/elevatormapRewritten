// Imports
const express = require("express");
const fs = require("fs");
const Eta = require("eta");
const winston = require("winston");
const { log } = require("util");

// Inting the logger
const logger = winston.createLogger({
  level: "info",
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

// Settings
const port = 3000;

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
} catch (error) {
  logger.error(
    "While reading the config an error occured. The error was: " + error
  );
}

// Basic defines for html
const author = "TheGreydiamond";
const desc = "Elevatormap";
const sitePrefix = "Elevatormap - ";

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

// App start
app.listen(port, () => {
  logger.info(`Elevator map ready at http://localhost:${port}`);
});
