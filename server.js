var express = require('express')
var http = require('http')
var https = require('https')
var fs = require('fs')
var path = require('path')
var mysql = require('mysql')

var constants = require('./constants')

var options = {
    key: fs.readFileSync('cert/key.pem').toString(),
    cert: fs.readFileSync('cert/certificate.pem').toString()
}
var http = express.createServer().listen(80)
var https = express.createServer(options).listen(443)

express.set('view engine', 'jade')
express.use(express.static(path.join(__dirname, 'public')))

/*** ROUTES ***/

http.get('*',function(req,res){  
    res.redirect('https://orielball.uk'+req.url)
})

https.get('/', function(req, res) {
    res.render('index')
})

https.get('/subscribe', function(req,res) {
    var connection = mysql.createConnection(constants.credentials)
    connection.connect()
    connection.query('INSERT INTO mailingList (email,type) VALUES (?,?)', [req.query['email'],req.query['type']],function(err, rows, fields) {
      if (err) res.send(500)
      else res.send(200)
    })
    connection.end()
})

https.get('/healthy', function(req,res) {
    res.send('ok')
})

