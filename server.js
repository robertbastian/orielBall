var constants = require('./constants')

// Email template service
var jade = require('jade')
// Mail service
var mailer = require('nodemailer').createTransport('direct')

// Payment service
var stripe = require('stripe')(constants.stripe.secret)
// Database service
var db = require('mysql').createConnection(constants.mysql)
// Date formatting
var moment = require('moment')

// Creating server
var express = require('express')
var server = express()

// Bodyparser to parse post requests
var bodyParser = require('body-parser')
server.use(bodyParser.json())
server.use(bodyParser.urlencoded({extended:false}))

// Setting jade as view engine
server.set('view engine', 'jade')

// Directory for static files
var path = require('path')
server.use(express.static(path.join(__dirname, 'public')))

// Redirecting everything to https://www.orielball.uk (missing www., .co.uk, http://)
server.all('*',function(req,res,next){
  if (req.headers.host != constants.host || !req.secure)
    res.redirect('https://' + constants.host + req.url)
  else
    next()
})

/* ROUTES */

// Index
server.get('/', function(req, res){
  db.query(
    'SELECT position, name, email FROM committee ORDER BY id ASC',
    function(err,rows,fields)
    {
      res.render('index',{
        committee: (!err) ? rows : false,
        bookingDateString: moment(constants.tickets.date).format('dddd, DD MMMM [at] h a'),
        // is the trailer public
        trailer: constants.trailer,
        // are the prices public
        pricesPublic: constants.tickets.public,
        // ticket prices
        prices: constants.tickets.prices,
        // activate the ticket button on the day of booking
        showTicketLinks: new Date(constants.tickets.date.setHours(0,0,0,0)) <= Date.now()
      })
    }
  )
})

// Tickets
server.get('/tickets',function(req,res){
  // After release date
  if (Date.now() > constants.tickets.date || constants.ticketdebug)
  {
    ticketsLeft(res, function(total,dining){
      // Tickets sold out
      if (total <= 0)
        res.render('tickets/soldOut')
      // Tickets available
      else
        res.render('tickets/form',{ 
          left: [total,dining],
          prices: constants.tickets.prices,
          stripe: constants.stripe.public
        })
    })
  } 
  // Before release date 
  else
    res.render('tickets/countdown',{ date: constants.tickets.date }) 
  
})

// Send the numbers of remaining tickets
server.get('/ticketsLeft',function(req,res){
  ticketsLeft(res,function(total,dining){
    res.json(200,[total,dining])
  })
})

var ticketsLeft = function(res,callback)
{
  db.query(
    'SELECT (SELECT COUNT(*) FROM bookings) AS total, (SELECT COUNT(*) FROM bookings WHERE type = "dining") AS dining',
    function(err,rows,fields){
      if (err)
        res.send(500,err)
      else
        callback(constants.tickets.total - rows[0]['total'],constants.tickets.dining - rows[0]['dining'])
    }
  )
}

// Reply from ticket form & payment processing
server.post('/tickets',function(req,res){
  var charge = stripe.charges.create(
    {
      amount: constants.tickets.prices[req.body.type]*100,
      currency: 'gbp',
      card: req.body.stripeToken,
      description: req.body.email,
      statement_description: (req.body.type == 'standard') ? 'Ticket' : 'Dining Ticket'
    },
    function(err, charge){
      if (err || !charge.paid)
      {
        if(err.type == 'card_error')
          res.render('tickets/error',{type: 'payment', message:err.message})
        else
          res.render('tickets/error',{type: 'payment', message:'Server error'})
      }
      else
      {
        db.query(
          'INSERT INTO bookings (name,email,bodcard,charge,type) VALUES (?,?,?,?,?)',
          [req.body.name,req.body.email,req.body.bodcard,charge.id,req.body.type],
          function(error,rows,fields)
          {
            if (error)
              res.render('tickets/error',{type: 'database', charge: charge.id, error: error})
            else
            {
              mailer.sendMail(
              {
                from: 'Oriel College Ball <no-reply@orielball.uk>',
                to: (req.body.name + '<' + req.body.email + '>'),
                subject: 'Ticket confirmation',
                html: 'html',
                text: 'text'
              })
              res.render('tickets/success',{type:req.body.type})
            }
          }
        )
      }
  })
})

// Email subscription processing
server.get('/subscribe', function(req,res) {
  db.query(
    'INSERT IGNORE INTO mailingList (email,type) VALUES (?,?)',
    [req.query['email'],(/^.+@oriel\.ox\.ac\.uk$/.test(req.query['email']))?'oriel':'oxford'],
    function(err, rows, fields) { res.send((err) ? 500 : 200) }
    )
})

// Unsubscribe email processing (not accessible from website)
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

// Display subscription email
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

// Serving push package
server.post('/v1/pushPackages/web.uk.orielball',function(req,res){
  res.sendfile('public/pushPackage.zip')
})

// Registering device
server.post('/v1/devices/:token/registrations/web.uk.orielball',function(req,res){
  db.query(
    'INSERT IGNORE INTO pushList (device) VALUE (?)',
    [req.param('token')],
    function(err, rows, fields) { res.send((err) ? 500 : 200) }
    )
})

// Deleting device
server.delete('/v1/devices/:token/registrations/web.uk.orielball',function(req,res){
  db.query(
    'DELETE FROM pushList WHERE device = ?',
    [req.param('token')],
    function(err, rows, fields) { res.send((err) ? 500 : 200) }
    )
})

// Push logs
server.post('/v1/log', function(req,res){
  console.log(req.body.logs)
})

// HTTPS server
require('https').createServer(constants.ssl,server).listen(443,function(){
  console.log('Listening for HTTPS requests on port 443')
})

// HTTP SERVER
require('http').createServer(server).listen(80,function(){
  console.log('Listening for HTTP requests on port 80')
})
