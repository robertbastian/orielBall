var express = require('express')
var http = require('http')
var https = require('https')
var fs = require('fs')
var path = require('path')
var mysql = require('mysql')

var constants = require('./constants')

// HTTPS Server 
var app = express()
var port = process.env.port || 3000
app.set('env','production')
app.set('port',port)
https.createServer(constants.certs,app).listen(443,function(){
  console.log("HTTPS server listening on port "+port)
})

// HTTP Server
var httpApp = express()
var httpRouter = express.Router()
httpApp.use('/',httpRouter)
httpRouter.get('*', function(req,res){
  res.redirect('https://orielball.uk'+req.url)
})
var httpServer = http.createServer(httpApp).listen(80)

app.set('view engine', 'jade')
app.use(express.static(path.join(__dirname, 'public')))

/*** ROUTES ***/

app.get('/', function(req, res) {
    res.render('index')
})

app.get('/subscribe', function(req,res) {
    var connection = mysql.createConnection(constants.credentials)
    connection.connect()
    connection.query('INSERT INTO mailingList (email,type) VALUES (?,?)', [req.query['email'],req.query['type']],function(err, rows, fields) {
      if (err) res.send(500)
      else res.send(200)
    })
    connection.end()
})

app.get('/healthy', function(req,res) {
    res.send('ok')
})