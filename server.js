var express = require('express')
var http = require('http')
var https = require('https')
var path = require('path')
var mysql = require('mysql')
var fs = require('fs')
var apn = require('apn')
var bodyParser = require('body-parser')
var nodemailer = require('nodemailer')
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

server.get('/updates/:number',function(req,res){
  var message = JSON.parse(fs.readFileSync('updates/'+req.param('number')))
  res.render('update',message)
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


function sendUpdate(subject, body)
{
  var message = {
    subject: subject,
    body: body,
    number: fs.readdirSync('updates/').length + 1
  }

  fs.writeFile('updates/'+message.number,JSON.stringify(message))

  /* Sending emails */
  db.query('SELECT email FROM mailingList',
    function(err,rows,fields)
    {
      if (err)
        console.log('Database error')
      else
      {
        var transport = nodemailer.createTransport("SES",constants.ses)
        var mailOptions = {
          from: "Oriel College Ball <marketing@orielball.uk>",
          subject: message.subject,
          html: "If the message doesn't display properly, click here: <a href='https://orielball.uk/updates/"+message.number+"'>https://orielball.uk/updates/"+message.number+"</a><br>"+message.body
        }
        var recipients = []
        for (var i = 0, len = rows.length; i < len; i++)
        {
          mailOptions['to'] = rows[i]['email']
          transport.sendMail(mailOptions,function(err,res){ if (err) console.log(err) })
        }
        transport.close()
      }
    }
  )

  /* Sending push notification */
  db.query('SELECT device FROM pushList',
    function(err,rows,fields)
    {
      if (err)
        console.log('Database error')
      else
      {
        var devices = []
        for (var i = 0, len = rows.length; i < len; i++)
          devices.push(new apn.Device(rows[i]['device']))  

        var notification = new apn.Notification()
        notification.expiry = Math.floor(Date.now()/1000) + 3600 * 24 * 7
        notification.alert = {
          "title": "Oriel Ball Update #"+message.number,
          "body": message.subject,
          "action":"Read"
        }
        notification.urlArgs = [""+message.number] 


        var connection = new apn.Connection({
          "production": true,
          "key": fs.readFileSync('certificates/ssl-key.pem'),
          "cert": fs.readFileSync('certificates/push-cert.pem')  
        })
        connection.pushNotification(notification,devices)
        connection.shutdown()
      }
    }
  )
}

/* Push subscription */
server.post('/v1/pushPackages/web.uk.orielball',function(req,res){
  res.sendfile('public/pushPackage.zip')
})

server.post('/v1/devices/:token/registrations/web.uk.orielball',function(req,res){
  db.query(
    'INSERT IGNORE INTO pushList (device) VALUE (?)',
    [req.param('token')],
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
