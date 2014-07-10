var express = require('express')
var http = require('http')
var path = require('path')
var mysql = require('mysql')
var fs = require('fs')
var request = require('request')
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
  var csv = fs.readFileSync('private/committee.csv')
    .toString()
    .replace(/\\n/g,'<br>')
    .split('\n')
    .map(function(line){return line.split(',')})
  res.render('index',{committee:csv})
})

server.get('/topsecret',function(req,res){
  var csv = fs.readFileSync('private/committee.csv').toString().replace(/\\n/g,'<br>').split('\n').map(function(line){return line.split(',')})
  res.render('topsecret',{committee:csv})
})

/* Updates */
server.get('/updates/:number',function(req,res){
  var message = JSON.parse(fs.readFileSync('public/updates'+req.param('number')))
  res.render('update',message)
})

/* Tickets */
server.get('/tickets',function(req,res){
  db.query(
    'SELECT COUNT(*) FROM bookings',
    function(err,rows,fields){
      if (constants.tickets.date > Date.now())
        res.render('ticketsCountdown',{ date: constants.tickets.date })
      else if (err)
        res.send(500,"Internal server error")
      else if (constants.tickets.total - rows[0][0] <= 0)
        res.render('ticketsSoldOut')
      else
        res.render('tickets',{ left: constants.tickets.total - rows[0][0] })
    }
  )
})

server.post('/tickets',function(req,res){

})

server.get('/remainingTickets',function(req,res){
  db.query(
    'SELECT COUNT(*) FROM bookings',
    function(err,rows,fields){
      if (err)
          res.send(500)
      else
        res.send(200, ""+(constants.tickets.total - rows[0][0]))
    })
})

/* Health check */
server.get('/check', function(req,res) {
    res.send(200)
})

/* Email subscription */
server.get('/subscribe', function(req,res) {
  db.query(
    'INSERT INTO mailingList (email,type) VALUES (?,?)',
    [req.query['email'],/^.+@oriel\.ox\.ac\.uk$/.test(req.query['email'])],
    function(err, rows, fields) { res.send((err) ? 500 : 200) }
    )
})

server.get('/unsubscribe/:email',function(req,res){
  var email = req.param('email')
  db.query(
    'DELETE FROM mailingList WHERE email = ?',
    [email],
    function(err,rows,fields){
      if (err) 
        res.send(500, "error")
      else
        res.send(200, email+" unsubscribed")
    })
})

/* Sending updates */
server.get('/processUpdate/:subject',function(req,res){
  var date = new Date()
  var message = {
    subject: req.param('subject'),
    number: fs.readdirSync('public/updates').length,
    date: date.getDay()+"."+date.getMonth()+"."+date.getFullYear()
  }  

  var markdown = fs.readFileSync('public/updates'+message.subject)
  request.post(
    {
      headers: {
        'content-type' : 'text/plain',
        'user-agent' : 'orielball'
      },
      url:     'https://api.github.com/markdown/raw',
      body:    markdown
    },
    function(err, res2, body) {
      message['body'] = body
      fs.writeFileSync('public/updates'+message.number,JSON.stringify(message))
      fs.unlinkSync('public/updates'+message.subject)
      sendUpdate(message.number)
      res.writeHead(301,{"Location":"https://orielball.uk/updates/"+message.number})
      res.end()
    }
  )
})

function sendUpdate(number)
{
  var message = JSON.parse(fs.readFileSync('public/updates'+number))
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
        }
        var recipients = []
        for (var i = 0, len = rows.length; i < len; i++)
        {
          mailOptions['to'] = rows[i]['email']
          mailOptions['html'] = message.body+
            "<center><br>If the message doesn't display properly, click here: <a href='https://orielball.uk/updates/"+
            message.number+"'>https://orielball.uk/updates/"+message.number+"</a><br>"+
            "To unscubscribe, click <a href='http://orielball.uk/unsubscribe/"+encodeURIComponent(rows[i]['email'])+"'>here</a></center>"
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
          "key": fs.readFileSync('/private/certificates/push-key.pem'),
          "cert": fs.readFileSync('/private/certificates/push-cert.pem')  
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

/* HTTP server */
http.createServer(server).listen(80,function(){
  console.log('Listening for HTTP requests on port 80')
})
