var c = require('./constants')

/********************************** Setup *************************************/

// Email template service
var jade = require('jade')
// Mail service
var mailer = require('nodemailer').createTransport("SMTP",c.smtp)

// Payment service
var stripe = require('stripe')(c.stripe.secret)
// Database service
var db = require('mysql').createConnection(c.mysql)
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
server.set('view engine','jade')

// Directory for static files
var path = require('path')
server.use(express.static(path.join(__dirname, 'public')))

// Redirecting everything to https://www.orielball.uk/...
server.all('*',function(req,res,next){
  if (req.headers.host == c.host && req.secure) 
    next()
  else 
    res.redirect('https://' + c.host + req.url)
})

// Locating user
var inOriel = function(req){
  return false
}

/********************************* Home page ***********************************/

server.get('/', function(req, res){
  var date = (inOriel(req)) ? c.tickets.orielDate : c.tickets.date
  res.render('index',{
    trailer: c.trailer,
    pricesPublic: c.tickets.pricesPublic,
    prices: c.tickets.prices,
    // Show date when booking opens, if in the future
    bookingDateString: (Date.now() < date) ? moment(date).format('dddd, DD MMMM [at] h:mm a') : false
  })
})

/******************************* Ticket server *********************************/

// Ticket booking form
server.get('/tickets',function(req,res){
  var date = (inOriel(req)) ? c.tickets.orielDate : c.tickets.date
  ticketsLeft(function(error,nonDining,dining){
    // Tickets released
    if (Date.now() > date || c.ticketdebug) {
      // Can't sell tickets because database is offline
      if (error)
        res.render('tickets/error',{type:'connection'})
      // Tickets sold out
      else if (nonDining <= 0 && dining <= 0)
        res.render('tickets/soldOut')
      // Tickets available
      else
        res.render('tickets/form',{ 
          prices: c.tickets.prices,
          stripe: c.stripe.public
        })
    }
    // Tickets not yet released
    else
      res.render('tickets/countdown',{date:date})
  })
})

// Reply from ticket form & payment processing
server.post('/tickets',function(req,res){
  var r = req.body
  stripe.charges.create({
      amount: c.tickets.prices[r.type]*100,
      currency: 'gbp',
      card: r.stripeToken,
      description: r.email,
      statement_description: '1x ' + r.type.toLowerCase()
    },
    function(error, charge){
      // Stripe/card error. Nothing charged, no ticket bought
      if (error || !charge.paid) {
        if (error.type == 'card_error')
          res.render('tickets/error',{type:'payment', message: error.message})
        else {
          console.log('+++ Stripe error: %s, %s',error.message,r.name)
          res.render('tickets/error',{type:'payment'})
        }
      }
      else {
        db.query(
          'INSERT INTO bookings (name,email,bodcard,college,type,charge) VALUES (?,?,?,?,?,?)',
          [r.name,r.email,r.bodcard,r.college,r.type,charge.id],
          function(error,rows,fields){
            // BIG ERROR. CUSTOMER WAS CHARGED BUT NOT ENTERED INTO THE DATABASE
            if (error) {
              console.log('+++++ Database error: %s; %s; %s',error,charge,r)
              mailer.sendMail({
                from: 'Oriel College Ball <no-reply@orielball.uk>',
                to: 'Robert Bastian <it@orielball.uk>',
                subject: 'Database error',
                text: 'Error:\n' + error + '\n\n' + 'Charge:\n' + charge.id + '\n\n' + 'Request:\n' + JSON.stringify(r)
              })
              res.render('tickets/error',{type: 'database', charge: charge.id, error: error})
            }
            // All good, send confirmation mail
            else {
              mailer.sendMail({
                from: 'Oriel College Ball <no-reply@orielball.uk>',
                to: r.name + '<'+r.email+'>',
                subject: 'Ticket confirmation',
                text: '' // TODO
              })
              res.render('tickets/success',{type:r.type})
            }
          }
        )
      }
    }
  )
})

// Remaining tickets helper function
server.post('/ticketsLeft',function(req,res){
  if (!c.tickets.amountPublic)
    res.status(403).end()
  else
    ticketsLeft(function(error,nonDining,dining){
      if (error) 
        res.status(500).end()
      else 
        res.json([nonDining,dining])
    })
})
var ticketsLeft = function(callback){
  db.query(
    'SELECT (SELECT COUNT(*) FROM bookings) AS total, (SELECT COUNT(*) FROM bookings WHERE type = "Dining") AS dining',
    function(error,rows,fields){
      if (error)
      {
        console.log('+++ Database error: %s',error)
        callback(error,0,0)
      }
      else
      {
        var totalLeft = c.tickets.total - rows[0]['total']
        var diningLeft = c.tickets.dining - rows[0]['dining']
        callback(false,Math.max(0,totalLeft-diningLeft),Math.max(0,diningLeft))
      }
    }
  )
}

/******************************* Mailing lists *********************************/

// Email subscription processing
server.post('/subscribeEmail', function(req,res){
  db.query(
    'INSERT IGNORE INTO mailingList (email,type) VALUES (?,?)',
    [req.body.email,(/^.+@oriel\.ox\.ac\.uk$/.test(req.body.email))?'oriel':'oxford'],
    function(error, rows, fields){
      if (error) {
        console.log('+++ Database error: %s',error)
        res.status(500).end() 
      }
      else {
        console.log('Added %s to mailing list',req.body.email)
        res.status(200).end()
      }
    }
  )
})


// Email unsubscription processing
server.get('/unsubscribe/:email',function(req,res){
  db.query(
    'DELETE FROM mailingList WHERE email = ?',
    [req.param('email')],
    function(error,rows,fields){
      if (error)
        console.log('+++ Database error: %s',error)
      else
        console.log('Removed %s from mailing list',req.param('email'))
      res.render('emailUnsubscribed',{error:error,email:req.param('email')})
    }
  )
})

// Waiting list processing
server.post('/subscribeWaitingList',function(req,res){
  db.query(
    'INSERT INTO waitingList (email,name) VALUES (?,?)',
    [req.body.email,req.body.name],
    function(error,rows,fields){ 
      if (error) {
        console.log('+++ Database error: %s',error)
        res.status(500).end()
      }
      else {
        console.log('Added %s, %s to waiting list',req.body.name,req.body.email)
        res.status(200).end()
      }
    }
  )
})

/**************************** Push notifications ******************************/

// Push package
server.post('/v1/pushPackages/web.uk.orielball',function(req,res){
  res.sendfile('public/pushPackage.zip')
})
// Registering
server.post('/v1/devices/:token/registrations/web.uk.orielball',function(req,res){
  db.query(
    'INSERT IGNORE INTO pushList device VALUE ?',
    [req.param('token')],
    function(error, rows, fields){
      if (error) {
        console.log('+++ Database error: %s',error)
        res.status(500).end()
      }
      else {
        console.log('Added %s to push list',req.param('token'))
        res.status(200).end()
      }
    }
  )
})
// Deleting
server.delete('/v1/devices/:token/registrations/web.uk.orielball',function(req,res){
  db.query(
    'DELETE FROM pushList WHERE device = ?',
    [req.param('token')],
    function(error, rows, fields){
      if (error) {
        console.log('+++ Database error: %s',error)
        res.status(500).end()
      }
      else {
        console.log('Removed %s from push list',req.param('token'))
        res.status(200).end()
      }
    }
  )
})
// Logging
server.post('/v1/log',function(req,res){
  console.log('+++ Push log: %s',req.body.logs)
})

/********************************** Debug *************************************/

server.get('/ticketerror1',function(req,res){
  res.render('tickets/error',{type:'connection'})
})

server.get('/ticketerror2',function(req,res){
  res.render('tickets/error',{type:'database', charge:'ch_asfj8a948j23j8rqpfjf2', error: 'AAAAHRGH'})
})

server.get('/ticketerror3',function(req,res){
  res.render('tickets/error',{type: 'payment', message: 'Your card was declined'})  
})

server.get('/ticketsuccess',function(req,res){
  res.render('tickets/success',{type:'non-dining'})
})

server.get('/ticketcountdown',function(req,res){
  res.render('tickets/countdown',{date:c.tickets.orielDate})
})

server.get('/ticketsoldout',function(req,res){
  res.render('tickets/soldOut')
})

server.get('/robots.txt',function(req,res){
  res.send('User-agent: *\nDisallow: /')
})

/********************************** Server *************************************/

// 404 errors
server.use(function(req,res){
  res.status(404).render('404')
})
// HTTPS server
require('https').createServer(c.ssl,server).listen(443,function(){
  console.log('Listening for HTTPS requests on port 443')
})

// HTTP SERVER
require('http').createServer(server).listen(80,function(){
  console.log('Listening for HTTP requests on port 80')
})