var express = require('express')
var http = require('http')
var https = require('https')
var path = require('path')
var mysql = require('mysql')
var bodyParser = require('body-parser')
var constants = require('./constants')
var db = mysql.createConnection(constants.mysql)


/* Configuring server */
var server = express()
server.set('view engine', 'jade')
server.use(express.static(path.join(__dirname, 'public')))
server.use(bodyParser.json())



/* Index */
server.get('/', function(req, res) {
  res.render('index')
})

/* Health check */
server.get('/check', function(req,res) {
    res.send(200)
})

/* Email subscription */
server.get('/subscribe', function(req,res) {
  db.query(
    'INSERT INTO mailingList (email,type) VALUES (?,?)',
    [req.query['email'],req.query['type']],
    function(err, rows, fields) { res.send((err) ? 500 : 200) }
    )
})

/* Push subscription */

server.post('/v1/pushPackages/web.uk.orielball',function(req,res){
  res.sendfile('public/pushPackage.zip')
})

server.post('/v1/devices/:token/registrations/web.uk.orielball',function(req,res){
  db.query(
    'INSERT INTO pushList (device,type) VALUES (?,?)',
    [req.param('token'),'oxford'],
    function(err, rows, fields) { res.send((err) ? 500 : 200) }
    )
})

server.delete('/v1/devices/:token/registrations/web.uk.orielball',function(req,res){
  db.query(
    'DELETE FROM pushList WHERE device = ?',
    [req.param('token')],
    function(err, rows, fields) { res.send((err) ? 500 : 200) }
    )
})

server.post('/v1/log', function(req,res){
  console.log(req.body.logs)
})


/* HTTPS main server */
https.createServer(constants.certs,server).listen(443,function(){
  console.log('Listening on port 443')
})

/* HTTP main server because firefox rejects certificates, will be replaced */
http.createServer(server).listen(80,function(){
  console.log('Listening on port 80')
})

/* HTTP redirect server */
/*http.createServer(function(req,res){
  res.writeHead(301,{"Location":"https://orielball.uk"+req.url})
  res.end()
}).listen(80)*/
