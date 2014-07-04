var express = require('express')
var http = require('http')
var https = require('https')
var fs = require('fs')
var path = require('path')
var mysql = require('mysql')
var constants = require('./constants')

var server = express()

server.set('view engine', 'jade')
server.use(express.static(path.join(__dirname, 'public')))

/*** ROUTES ***/

server.get('/', function(req, res) {
  res.render('index')
})

server.get('/subscribe', function(req,res) {
    var connection = mysql.createConnection(constants.credentials)
    connection.connect()
    connection.query('INSERT INTO mailingList (email,type) VALUES (?,?)', [req.query['email'],req.query['type']],function(err, rows, fields) {
      if (err) res.send(500)
      else res.send(200)
    })
    connection.end()
})

server.get('/healthy', function(req,res) {
    res.send('ok')
})


https.createServer(constants.certs,server).listen(443,function(){
  console.log('Server listening on port 443')
})
http.createServer(function(req,res){
  res.writeHead(301,{"Location":"https://orielball.uk/"+req.url})
  res.end()
}).listen(80)
