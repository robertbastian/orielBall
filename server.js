var express = require('express')
var http = require('http')
var https = require('https')
var fs = require('fs')
var path = require('path')
var mysql = require('mysql')
var constants = require('./constants')

var app = express()

app.set('view engine', 'jade')
app.use(express.static(path.join(__dirname, 'public')))

/*** ROUTES ***/
app.get('/', function(req, res) {
  res.render('index');
});

app.get('/subscribe', function(req,res) {
    var connection = mysql.createConnection(constants.credentials)
    connection.connect();
    connection.query('INSERT INTO mailingList (email,type) VALUES (?,?)', [req.query['email'],req.query['type']],function(err, rows, fields) {
      if (err) res.send(500)
      else res.send(200)
    });
    connection.end();
})

app.get('/healthy', function(req,res) {
    res.send('ok')
})

var options = {
    key: fs.readFileSync('cert/key.pem').toString(),
    cert: fs.readFileSync('cert/certificate.pem').toString()
}
http.createServer(app).listen(80)
https.createServer(options,app).listen(443)
