module.exports = function (app) {
    app.get("/debug/showSessionInfo", function (req, res) {
        res.send(JSON.stringify(req.session));
      });
      
}