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
var stripe = require("stripe")(constants.stripesecret);
var db = mysql.createConnection(constants.mysql)


/* Configuring server */
var server = express()
server.use(bodyParser())
server.set('view engine', 'jade')
server.use(express.static(path.join(__dirname, 'public')))


/* Index */
server.get('/', function(req, res) {
  db.query(
    'SELECT position, name, email FROM committee ORDER BY id ASC',
    function(err,rows,fields)
    {
      res.render('index',{committee:(!err)?rows:false,bookingDate:constants.tickets.date})
    }
  )
})

server.get('/topsecret',function(req,res){
  db.query(
    'SELECT position, name, email FROM committee ORDER BY id ASC',
    function(err,rows,fields)
    {
      res.render('draft',{committee:(!err)?rows:false,bookingDate:constants.tickets.date})
    }
  )
})

/* Updates */
server.get('/updates/:number',function(req,res){
  db.query(
    'SELECT text FROM updates WHERE id = ?',
    [req.param('number')],
    function(err,rows,fields)
    {
      if (!err)
        res.render('update',rows[0]['text'])
      else 
        res.send('Database error')
    }
  )
})

/* Tickets */
server.get('/tickets',function(req,res){
  if (constants.tickets.date > Date.now())
    res.render('ticketsCountdown',{ date: constants.tickets.date })
  else 
  {
    db.query(
      'SELECT COUNT(*) FROM bookings',
      function(err,rows,fields){
        if (err)
          res.send(500,err)
        else if (rows[0]['COUNT(*)'] >= constants.tickets.total)
          res.render('ticketsSoldOut')
        else
          res.render('tickets',{ 
            left: constants.tickets.total - rows[0]['COUNT(*)'],
            prices: constants.tickets.prices
          })
      }
    )
  }
})

server.get('/ticketsformarkianandcharliebutdontgivethislinktoanyone',function(req,res){
  if (false)
    res.render('ticketsCountdown',{ date: constants.tickets.date })
  else 
  {
    db.query(
      'SELECT COUNT(*) FROM bookings',
      function(err,rows,fields){
        if (err)
          res.send(500,err)
        else if (rows[0]['COUNT(*)'] >= constants.tickets.total)
          res.render('ticketsSoldOut')
        else
          res.render('tickets',{ 
            left: constants.tickets.total - rows[0]['COUNT(*)'],
            prices: constants.tickets.prices
          })
      }
    )
  }
})

server.post('/tickets',function(req,res){
  var charge = stripe.charges.create(
    {
      amount: constants.tickets.prices[req.body.type]*100,
      currency: 'gbp',
      card: req.body.stripeToken,
      description: req.body.email,
      statement_description: (req.body.type == 'standard') ? 'Ticket' : 'Dining Ticket'
    },
    function(err, charge) {
      if (err && err.type === 'StripeCardError')
        res.send(200,'Payment error\n'+err)     // The card has been declined
      if (!err && charge.paid)
      {
        db.query(
          'INSERT INTO bookings (name,email,bodcard,charge,type) VALUES (?,?,?,?,?)',
          [req.body.name,req.body.email,req.body.bodcard,charge.id,req.body.type],
          function(error,rows,fields)
          {
            if (error)
              res.send('Your payment succeeded but there was a database error. Please contact us at it@orielball.uk with a copy of this page!\n\n\n'+charge+'\n'+error)
            else
            {
              res.send('Success! You should receive a confirmation email shortly')
              //TODO Send that email!
            }
          }
        )
      }
  })
})

server.get('/remainingTickets',function(req,res){
  db.query(
    'SELECT COUNT(*) FROM bookings',
    function(err,rows,fields){
      if (err)
          res.send(500)
      else
        res.send(200, ""+(constants.tickets.total - rows[0]['COUNT(*)']))
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
http.createServer(server).listen(443,function(){
  console.log('Listening for HTTP requests on port 443')
})

/* HTTP redirect server */
http.createServer(function(req,res){
  res.writeHead(301,{'Location':'https://www.orielball.uk'+req.url})
  res.end()
})
.listen(80,function(){
  console.log('Redirecting requests at port 80 to https')
})
