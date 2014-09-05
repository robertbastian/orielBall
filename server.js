const c = require('./constants')

/********************************** Setup *************************************/

// !Mail & request service
var mailer = require('nodemailer').createTransport("SMTP",c.smtp)
var request = require('request');

// !Payment, database and date formatting service
var stripe = require('stripe')(c.stripe.secret)
var db = require('mysql').createConnection(c.mysql)
var moment = require('moment')

// !Creating server
var express = require('express')
var server = express()
server.set('view engine','jade')

// !Bodyparser to parse post requests
var bodyParser = require('body-parser')
server.use(bodyParser.json())
server.use(bodyParser.urlencoded({extended:true}))

// !Minifying, compressing and serving static files
var compression = require('compression')
server.use(compression())
var minify = require('express-minify')
server.use(minify({cache: __dirname + '/public/cache'}))
server.use(express.static(__dirname + '/public'))

var inOriel = function(req){
  return false//(req.ip == '93.217.81.241')
}

var logError = function(type,error,action,info){
  console.error('********** %s UTC',moment(Date.now()).format('DD/MM HH:mm:ss'))
  console.error('+++ '+type+' error: %s',error)
  if (action && info)
    console.error('+++ %s : %j',action,info)
  console.error('**********')  
}

// !Redirecting everything to https://www.orielball.uk/...
server.all('*',function(req,res,next){
  if (req.headers.host == c.host && !req.secure) 
    next()
  else 
    res.redirect('http://' + c.host + req.url)
})

// !Homepage
server.get('/', function(req, res){
  res.render('index',{
    trailer: c.trailer,
    pricesPublic: c.tickets.pricesPublic,
    prices: c.tickets.prices,
    // Show date when booking opens, if in the future
    bookingDate:{
      public: (Date.now() < c.tickets.date) ? moment(c.tickets.date).format('dddd, DD MMMM [at] h:mm a') : false,
      oriel: (Date.now() < c.tickets.orielDate) ? moment(c.tickets.orielDate).format('dddd, DD MMMM [at] h:mm a') : false
    },
    committee: c.committee
  })
})

// !Ticket booking form
server.get('/tickets',function(req,res){
  var date = (inOriel(req)) ? c.tickets.orielDate : c.tickets.date
  ticketsLeft(function(error,nonDining,dining){
    // Tickets released
    if (Date.now() > date || c.ticketdebug) {
      // Can't sell tickets because database is offline
      if (error)
        res.render('tickets/error',{type:'connection'})
      // Tickets sold out
      else if (nonDining + dining == 0)
        res.render('tickets/soldOut')
      // Tickets available
      else
        res.render('tickets/form',{ 
          prices: c.tickets.prices,
          stripe: c.stripe.public,
          orielOnly: (Date.now() < c.tickets.date && Date.now() > c.tickets.orielDate),
          ticketsLeft: [nonDining,dining],
          colleges: c.colleges
        })
    }
    // Tickets not yet released
    else
      res.render('tickets/countdown',{date:date,orielOnly:(Date.now() < c.tickets.date && Date.now() > c.tickets.orielDate)})
  })
})

// !Payment processing
server.post('/tickets',function(req,res){
 
  // req.body is going to be used a lot
  var r = req.body
  r.guests = parseInt(r.guests)
  var orielOnly = (Date.now() < c.tickets.date && Date.now() > c.tickets.orielDate)

  // Checking: correct name, .ox.ac.uk email, email matches college, tickets are open to customer, bodcard, number of guests
  var emailTest = /^.+@(.+)\.ox\.ac\.uk$/.exec(r.email)
  if (!/.+ .+/.test(r.name) || !emailTest || c.colleges[emailTest[1]] != r.college || (r.college != 'Oriel' && orielOnly) || !/^[0-9]{7}$/.test(r.bodcard) || (r.guests > 0 && r.guestNames.length != r.guests)){
    res.render('tickets/error',{type:'input'})
    return false
  }
  
  // Checking if tickets were previously bought
  db.query('SELECT COUNT(*) AS count FROM bookings WHERE email = ? OR payment = ?',
    [r.email,'Guest of: '+r.email],
    function(error,rows,fields){
      if (error){
        logError('Database',error,'Trying to get ticket count for',r.email)
        res.render('tickest/errror',{type:'databaseCount'})
      }
      if (rows[0]['count'] > 0)
        res.render('tickets/error',{type:'duplicate',number:rows[0]['count']})
      else {
        // Charging the customer
        stripe.charges.create({
          amount: c.tickets.prices[r.type]*100*(1+r.guests),
          currency: 'gbp',
          card: r.stripeToken,
          description: r.email,
          statement_description: (1+r.guests)+'x ' + r.type.toLowerCase()
        },
        function(error, charge){
          // Stripe/card error. Nothing charged, no ticket bought
          if (error || !charge.paid) {
            logError('Payment',error,'Processing purchase request',r)
            res.render('tickets/error',{type:'payment', stripe: error})
          }
          else {
            // Inserting customer + guests into DB
            var data = [[r.name,r.email,r.college,r.bodcard,'Stripe: '+charge.id,r.type]]
            for (var i = 0; i < r.guests; i++)
              data.push([r.guestNames[i],r.guestEmails[i],'N/A','N/A','Guest of: '+r.email,r.type])
            db.query(
              'INSERT INTO bookings (name,email,college,bodcard,payment,type) VALUES ?',
              [data],
              function(error,rows,fields){
                // Big error: customer was charged but not entered into DB
                if (error) {
                  logError('Database',error,'Trying to insert',data)
                  mailer.sendMail({
                    from: 'Oriel College Ball <no-reply@orielball.uk>',
                    to: 'Robert Bastian <it@orielball.uk>',
                    subject: 'Database error',
                    text: 'Error:\n' + error + '\n\n' + 'Data:\n' + data
                  })
                  res.render('tickets/error',{type: 'database', charge: charge.id, error: error})
                }
                // All good, send confirmation mail
                else {
/*
                  mailer.sendMail({
                    from: 'Oriel College Ball <no-reply@orielball.uk>',
                    to: r.name + '<'+r.email+'>',
                    subject: 'Ticket confirmation',
                    text: '' // TODO
                  })
*/
                  res.render('tickets/success',{
                    type:r.type,
                    email:r.email,
                    amount: 1+r.guests,
                    guests:r.guestNames
                  })
                  
                  // Adding to ticket holder mailing list
                  var users = [{email:{email:r.email},merge_vars:{NAME: r.name,TYPE: r.type}}]
                  for (var i = 0; i < r.guests; i++)
                    users.push({email:{email:r.guestEmails[i]},merge_vars:{NAME: r.guestNames[i],TYPE: r.type}})
                      
                  mailchimp(users,'a52cfddcf4',function(error,response,body){
                    if (!error && response.statusCode == 200)
                      console.log('Added %s and guests to ticket holder email list',r.email)
                    else 
                      logError('Mailchimp',error || body.error,'Trying to add to ticket holder list',r.email)
                  })
                }
              }
            )
          }
        })
      }
    }
  )
})

// !Remaining tickets helper function
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
      if (error) {
        logError('Database',error,'Trying to count','tickets')
        callback(error,0,0)
      }
      else {
        var totalLeft = c.tickets.total - rows[0]['total']
        var diningLeft = c.tickets.dining - rows[0]['dining']
        callback(false,Math.max(0,totalLeft-diningLeft),Math.max(0,diningLeft))
      }
    }
  )
}

var mailchimp = function(batch,id,callback){
  request({
      uri: 'https://us9.api.mailchimp.com/2.0/lists/batch-subscribe',
      method: 'POST',
      json: {
        apikey: c.mailchimp,
        id:id,
        batch:batch,
        double_optin:false,
        update_existing:true
      }
    }, 
    callback
  )
}

// !Email subscription processing
server.post('/subscribeEmail', function(req,res){
  mailchimp([{email:{email:req.body.email},merge_vars:{}}],'6f63740421',function(error,response,body){
    if (!error && response.statusCode == 200) {
      console.log('Added %s to mailing list',req.body.email)
      res.status(200).end()
    }
    else {
      logError('Mailchimp',error || body.error,'Trying to add to mailing list',req.body.email)
      res.status(500).end() 
    }  
  }) 
})

// !Waiting list processing
server.post('/subscribeWaitingList',function(req,res){
  db.query(
    'INSERT INTO waitingList (email,name) VALUES (?,?)',
    [req.body.email,req.body.name],
    function(error,rows,fields){ 
      if (error) {
        logError('Database',error,'Trying to add to waiting list',req.body.email)
        res.status(500).end()
      }
      else {
        console.log('Added %s, %s to waiting list',req.body.name,req.body.email)
        res.status(200).end()
      }
    }
  )
})

// !Push package
server.post('/v1/pushPackages/web.uk.orielball',function(req,res){
  res.sendfile('public/pushPackage.zip')
})
// !Registering push notification
server.post('/v1/devices/:token/registrations/web.uk.orielball',function(req,res){
  db.query(
    'INSERT IGNORE INTO pushList device VALUE ?',
    [req.param('token')],
    function(error, rows, fields){
      if (error) {
        logError('Database',error,'Trying to add to push list',req.param('token'))
        res.status(500).end()
      }
      else {
        console.log('Added %s to push list',req.param('token'))
        res.status(200).end()
      }
    }
  )
})
// !Deregistering push notifications
server.delete('/v1/devices/:token/registrations/web.uk.orielball',function(req,res){
  db.query(
    'DELETE FROM pushList WHERE device = ?',
    [req.param('token')],
    function(error, rows, fields){
      if (error) {
        logError('Database',error,'Trying to remove from push list',req.param('token'))
        res.status(500).end()
      }
      else {
        console.log('Removed %s from push list',req.param('token'))
        res.status(200).end()
      }
    }
  )
})
// !Logging push notifications
server.post('/v1/log',function(req,res){
  console.log('+++ Push log: %s',req.body.logs)
})

server.get('/pushNotification/:id',function(req,res){
  // Do something
  res.status(200).end()
})

// !404 errors
server.use(function(req,res){
  res.status(404).render('error',{type:404,error:'The requested page does not exist'})
})

// !500 errors
server.use(function(error,req,res,next){
  res.status(500).render('error',{type:error.status || 500, error:error.toString().slice(7,error.length)})
})

// !HTTPS server
require('https').createServer(c.ssl,server).listen(443,function(){
  console.log('Listening for HTTPS requests on port 443')
})

// !HTTP SERVER
require('http').createServer(server).listen(80,function(){
  console.log('Listening for HTTP requests on port 80')
})