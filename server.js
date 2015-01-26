const c = require('./constants')

// !Mail & request service
var m = require('mandrill-api/mandrill')
var mandrill = new m.Mandrill(c.mandrill)
var request = require('request');

// !Payment, database and date formatting services
var stripe = require('stripe')(c.stripe.secret)
var db = require('mysql').createConnection(c.mysql)
var moment = require('moment')

// !Passwords and access protection
var crypto = require('crypto')
var pwprotect = require('basic-auth-connect')

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
if (c.host == 'orielball.uk'){
  var minify = require('express-minify')
  server.use(minify({cache: __dirname + '/public/cache'}))  
}
server.use(express.static(__dirname + '/public'))

//! Helper functions
var inOriel = function(req){
  return (require('range_check').in_range(req.ip,c.orielIPs))
}

var logError = function(type,error,action,info){
  console.error('********** %s UTC',moment(Date.now()).format('DD/MM HH:mm:ss'))
  console.error('+++ '+type+' error: %s',error)
  if (action && info)
    console.error('+++ %s : %j',action,info)
  console.error('**********')  
}

// !Redirecting everything to https://orielball.uk/...
server.all('*',function(req,res,next){
  if (req.headers.host == c.host && req.secure) 
    next()
  else 
    res.redirect('https://' + c.host + req.url)
})

// !Homepage
server.get('/', function(req, res){
  res.render('index',{
    trailer: c.trailer,
    prices: c.tickets.pricesPublic ? c.tickets.prices : false,
    // Show date when booking opens, if in the future
    booking: c.tickets.datesPublic ? {
      normal: (Date.now() < c.tickets.dates.normal) ? moment(c.tickets.dates.normal).format('dddd, DD MMMM [at] h:mm a') : false,
      oriel: (Date.now() < c.tickets.dates.oriel) ? moment(c.tickets.dates.oriel).format('dddd, DD MMMM [at] h:mm a') : false
    } : (c.tickets.bookingOver ? 'closed' : false),
    committee: c.committee
  })
})

// !Ticket booking form
server.get('/tickets',function(req,res,next){
  
  // 404 if no date set
  if (!c.tickets.datesPublic)
    next()
  
  // We have a date
  else {
    var date = (inOriel(req)) ? c.tickets.dates.oriel : c.tickets.dates.normal
    var orielOnly = Date.now() < c.tickets.dates.normal && Date.now() > c.tickets.dates.oriel
  
    // Tickets not yet released
    if (Date.now() < date)
      res.render('tickets/countdown',{date:date,orielOnly:orielOnly})
    // Booking is over
    else if (c.tickets.bookingOver)
      res.render('tickets/soldOut',{waitingList: false})
    // Booking is open
    else
      ticketsLeft(function(error,nonDining,dining){
        // Can't sell tickets because database is offline
        if (error)
          res.render('tickets/error',{type:'connection'})
        // Tickets sold out
        else if (nonDining + dining == 0)
          res.render('tickets/soldOut',{waitingList: true})
        // Tickets available
        else
          res.render('tickets/form',{ 
            prices: c.tickets.prices,
            stripe: c.stripe.public,
            orielOnly: orielOnly,
            ticketsLeft: [nonDining,dining],
            colleges: c.colleges
          })
      })
  }
})

// !Ticket request
server.post('/tickets',function(req,res){
 
  // req.body is going to be used a lot
  var r = req.body
  r.guests = parseInt(r.guests)
  var orielOnly = (Date.now() < c.tickets.date && Date.now() > c.tickets.orielDate)

  // Checking: correct name, .ox.ac.uk email, tickets are open to customer, bodcard, number of guests
  if (!/.+ .+/.test(r.name) || !/^.+@(.+)\.ox\.ac\.uk$/.test(r.email) || (r.college != 'Oriel' && orielOnly) || !/^[0-9]{7}$/.test(r.bodcard) || (r.guests > 0 && (r.guestNames.length != r.guests || r.guests > 9 || (r.guests > 1 && orielOnly))))
    res.render('tickets/error',{type:'input'})
  else if {
    db.query(
      // If user doesn't have a ticket
      "SELECT COUNT(*) as count FROM bookings WHERE email = ?",
      [r.email],
      function(error,rows,fields){
        if (error){
          logError('Database',error,'Trying to validate ticket count for',r.email)
          res.render('tickets/error',{type:'databaseCount'})
        }
        else if (rows[0].count > 0)
          res.render('tickets/error',{type:'duplicate',number:rows[0].count})
        else
          processPayment(res,req.body)
      }
    )
  }
})


// !Ticket form for people on the waiting list (this is always open but password protected, for debugging or people on year abroad)
server.get('/waitingListTickets',
  pwProtect(function(email,password,callback){
    db.query(
      "SELECT password FROM waitingList WHERE email = ? AND state = 'Emailed'",
      [user],
      function(error,rows,fields){
        if (error)
          callback(error,false)
        // User has no access
        else if (rows.length == 0)
          callback(false,false)
        // User has access if he entered the correct password
        else
          callback(false, password == rows[0].password)
      }
    )
  }),
  function(req,res){
    res.render('tickets/form',{ 
      prices: c.tickets.prices,
      stripe: c.stripe.public,
      orielOnly: false,
      ticketsLeft: [1,0],
      colleges: c.colleges,
      singleTickets: true
    })
})

// !Waiting list ticket request
server.post('/waitingListTickets',function(req,res){
  var r = req.body 
  if (!/.+ .+/.test(r.name) || !/^.+@(.+)\.ox\.ac\.uk$/.test(r.email) || !/^[0-9]{7}$/.test(r.bodcard))
    res.render('tickets/error',{type:'input'})
  else if {
    db.query(
    //        Is on the waiting list and in correct state                                  && hasn't bought tickets before
    "SELECT ((SELECT COUNT(*) > 0 FROM waitingList WHERE email = ? AND state = 'Emailed') && (SELECT COUNT(*) = 0 FROM bookings WHERE email = ?)) AS allowed",
    [r.email,r.email],
    function(error,rows,fields){
      if (error){
        logError('Database',error,'Trying to validate waiting list ticket for',r.email)
        res.render('tickets/error',{type:'databaseCount'})
      }
      else if (rows[i].allowed = 0)
        res.render('tickets/error',{type:'disallowed'})
      else
        processPayment(res,req.body)
    )
  }
})

var processPayment = function(res, r){
  var amount = c.tickets.prices[r.type][r.college == 'Oriel'] + c.tickets.prices[r.type][false] * r.guests
  stripe.charges.create({
      amount: amount*100,
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
        var guests = [[r.name,r.email,r.college,r.type,r.email]]
        var emails = [r.email]
        for (var i = 0; i < r.guests; i++){
          data.push([r.guestNames[i],r.guestEmails[i],null,r.type,r.email])
          emails.push(r.guestEmails[i])
        }
        db.query(
          "START TRANSACTION;\
            INSERT INTO payments (payer,bodcard,type,reference,amount) VALUES (?,?,'Stripe',?,?);\
            INSERT INTO bookings (name,email,college,type,paidBy) VALUES ?;\
            DELETE FROM waitingList WHERE email IN ?;\
           COMMIT TRANSACTION;",
          [r.email,r.bodcard,charge.id,charge.amount / 100, guests, emails],
          function(error,rows,fields){
            // Big error: customer was charged but not entered into DB
            if (error) {
              logError('Database',error,'Trying to insert',data)
              mandrill.messages.send(
                {'message': {
                    'text': 'Error:\n' + error + '\n\n' + 'Data:\n' + r,
                    'subject': 'Database error',
                    'from_email': 'server@orielball.uk',
                    'to': [{'email': 'Robert Bastian <it@orielball.uk>'}],
                  }
                }, function(result){}, function(error) {}
              )
              res.render('tickets/error',{type: 'database', charge: charge.id, error: error})
            }
            // All good, send confirmation mail
            else {
              mandrill.messages.sendTemplate({
                  'template_name':'confirmation',
                  'template_content':[],
                  'message': {
                    'to': [{'email': r.email,'name': r.name}],
                    'subject': 'Ticket confirmation',
                    'from_name': 'Oriel College Ball',
                    'from_email': 'tickets@orielball.uk',
                    'global_merge_vars': [
                      {"name": 'TICKET_STRING', 'content': (1+r.guests)+' '+r.type+' Ticket'+(r.guests?'s':'')}
                    ]
                  }
                },
                function(result){
                  console.log('Sent confirmation to %s',r.email)
                }, 
                function(error) {
                  logError('Mandrill',error,'Trying to send confirmation to',r.name)
                }
              )
              res.render('tickets/success',{
                type:r.type,
                email:r.email,
                amount: 1+r.guests,
                guests:r.guestNames
              })
            }
          }
        )
      }
    }
  )
}


// !Remaining tickets helper function
server.post('/ticketsLeft',function(req,res){
  ticketsLeft(function(error,nonDining,dining){
    // If waiting list is closed
    if (error || c.tickets.bookingClosed) 
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
        var totalLeft = c.tickets.amount.total - rows[0]['total']
        var diningLeft = c.tickets.amount.dining - rows[0]['dining']
        callback(false,Math.max(0,totalLeft-diningLeft),Math.max(0,diningLeft))
      }
    }
  )
}

// !Email subscription processing
server.post('/subscribeEmail', function(req,res){
  request({
      uri: 'https://us9.api.mailchimp.com/2.0/lists/batch-subscribe',
      method: 'POST',
      json: {
        apikey: c.mailchimp,
        id: '6f63740421',
        batch: [{email:{email:req.body.email},merge_vars:{}}],
        double_optin: false,
        update_existing: true
      }
    }, 
    function(error,response,body){
      if (!error && response.statusCode == 200) {
        console.log('Added %s to mailing list',req.body.email)
        res.status(200).end()
      }
      else {
        logError('Mailchimp',error || body.error,'Trying to add to mailing list',req.body.email)
        res.status(500).end() 
      }  
    }
  )
}
  
  
// !Waiting list processing
server.post('/subscribeWaitingList',function(req,res){
  if (!c.tickets.waitingList)
    res.send(500)
  db.query(
    'INSERT IGNORE INTO waitingList (name, email, password) VALUES ?',
    [[req.body.name,req.body.email,crypto.randomBytes(5).toString('hex')]],
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

server.get('/robots.txt',function(req,res){
  res.type('text/plain')
  if (c.host != 'orielball.uk') 
    // Dev
    res.send("User-agent: *\nDisallow: /")
  else 
    // Production
    res.send('')
})

server.get('/sitemap.txt',function(req,res){
  res.type('text/plain')
  res.send('https://orielball.uk\nhttps://orielball.uk/tickets')
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
var httpsConf = c.ssl
httpsConf.secureOptions = require('constants').SSL_OP_NO_SSLv3
require('https').createServer(httpsConf,server).listen(443,function(){
  console.log('Listening for HTTPS requests on port 443')
})

// !HTTP SERVER
require('http').createServer(server).listen(80,function(){
  console.log('Listening for HTTP requests on port 80')
})