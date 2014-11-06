const c = require('./constants')

// !Mail & request service
var m = require('mandrill-api/mandrill')
var mandrill = new m.Mandrill(c.mandrill)
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
  return (require('range_check').in_range(req.ip,c.orielIPs))
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
    bookingDates: c.tickets.datesPublic ? {
      normal: (Date.now() < c.tickets.dates.normal) ? moment(c.tickets.dates.normal).format('dddd, DD MMMM [at] h:mm a') : false,
      oriel: (Date.now() < c.tickets.dates.oriel) ? moment(c.tickets.dates.oriel).format('dddd, DD MMMM [at] h:mm a') : false
    } : false,
    committee: c.committee
  })
})

// !Ticket booking form
server.get('/tickets',function(req,res,next){
  if (!c.tickets.datesPublic)
    next()
  else {
    var date = (inOriel(req)) ? c.tickets.dates.oriel : c.tickets.dates.normal
    var orielOnly = Date.now() < c.tickets.dates.normal && Date.now() > c.tickets.dates.oriel
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
            orielOnly: orielOnly,
            ticketsLeft: [nonDining,dining],
            colleges: c.colleges
          })
      }
      // Tickets not yet released
      else
        res.render('tickets/countdown',{date:date,orielOnly:orielOnly})
    })
  }
})

var pwProtection = require('basic-auth-connect')(function(user,pw,fn){
  if (pw != c.ticketPasswords[user])
    fn(false,false)
  else{
    db.query(
      'SELECT COUNT(*) FROM bookings WHERE email = ?',[user+'@oriel.ox.ac.uk'],
      function(error,rows,fields){
        fn(false,rows[0]['COUNT(*)'] == 0)
      }
    )
  }
})

server.get('/protectedTickets',pwProtection,function(req,res){
  ticketsLeft(function(error,nonDining,dining){
    res.render('tickets/form',{ 
      prices: c.tickets.prices,
      stripe: c.stripe.public,
      orielOnly: true,
      ticketsLeft: [nonDining,dining],
      colleges: c.colleges
    })
  })
})

// !Payment processing
server.post('/tickets',function(req,res){
 
  // req.body is going to be used a lot
  var r = req.body
  r.guests = parseInt(r.guests)
  var orielOnly = (Date.now() < c.tickets.date && Date.now() > c.tickets.orielDate)

  // Checking: correct name, .ox.ac.uk email, tickets are open to customer, bodcard, number of guests
  if (!/.+ .+/.test(r.name) || !/^.+@(.+)\.ox\.ac\.uk$/.test(r.email) || (r.college != 'Oriel' && orielOnly) || !/^[0-9]{7}$/.test(r.bodcard) || (r.guests > 0 && (r.guestNames.length != r.guests || r.guests > 9 || (r.guests > 1 && orielOnly)))){
    res.render('tickets/error',{type:'input'})
    return false
  }
  
  // Checking if tickets were previously bought
  db.query('SELECT COUNT(*) AS count FROM bookings WHERE email = ? OR payment = ?',
    [r.email,'Guest of: '+r.email],
    function(error,rows,fields){
      if (error){
        logError('Database',error,'Trying to get ticket count for',r.email)
        res.render('tickets/error',{type:'databaseCount'})
      }
      if (rows[0]['count'] > 0)
        res.render('tickets/error',{type:'duplicate',number:rows[0]['count']})
      else {
        // Charging the customer
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
                  mandrill.messages.send(
                    {'message': 
                      {
                        'text': 'Error:\n' + error + '\n\n' + 'Data:\n' + data,
                        'subject': 'Database error',
                        'from_email': 'server@orielball.uk',
                        'to': [{'email': 'it@orielball.uk'}],
                      }
                    }, function(result){}, 
                    function(error) {
                      logError('Mandrill',error,'Trying to email','about db error')
                    }
                  )
                  res.render('tickets/error',{type: 'database', charge: charge.id, error: error})
                }
                // All good, send confirmation mail
                else {
                  mandrill.messages.sendTemplate({
                    'template_name':'confirmation',
                    'template_content':[],
                    'message': 
                    {
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
                      if (result[0].status == 'sent')
                        console.log('Sent confirmation to %s',r.email)
                      else
                        logError('Mandrill',result,'Trying to send confirmation to',r.name)
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
                  
                  // Adding to ticket holder mailing list
                  var users = [{email:{email:r.email},merge_vars:{NAME: r.name,TYPE: r.type,GUEST:'No'}}]
                  for (var i = 0; i < r.guests; i++)
                    users.push({email:{email:r.guestEmails[i]},merge_vars:{NAME: r.guestNames[i],TYPE: r.type,GUEST:'Yes'}})

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

server.get('/addGuests',function(req,res){
    ticketsLeft(function(error,nonDining,dining){
      // Tickets released
      if (Date.now() > c.tickets.dates.normal || c.ticketdebug) {
        // Can't sell tickets because database is offline
        if (error)
          res.render('tickets/error',{type:'connection'})
        // Tickets sold out
        else if (nonDining + dining == 0)
          res.render('tickets/soldOut')
        // Tickets available
        else
          res.render('tickets/guests',{ 
            ticketsLeft: [nonDining,dining]
          })
      }
      // Tickets not yet released
      else
        res.render('tickets/countdown',{date:c.tickets.dates.normal,orielOnly:false})
    })
})


server.post('/loadGuests',function(req,res){
  db.query(
    'SELECT name, email, type FROM bookings WHERE name = ? AND email = ? AND bodcard = ?',
    [req.body.name, req.body.email, req.body.email],
    function(error, rows, fields){
      if (rows.length == 0)
        res.send('No tickets')
      else{
        db.query(
          'SELECT name, email FROM bookings WHERE payment = ?',['Guest of: '+req.body.email],
          function(error2,guests,fields){
            res.send({
              type: rows[0]['type'],
              guests: guests
            })
          }
        )
      }
    }
  )
})

server.post('/addGuests',function(req,res){

})


// !Remaining tickets helper function
server.post('/ticketsLeft',function(req,res){
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
        var totalLeft = c.tickets.amount.total - rows[0]['total']
        var diningLeft = c.tickets.amount.dining - rows[0]['dining']
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
    'INSERT IGNORE INTO pushList (device) VALUE (?)',
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

server.get('/robots.txt',function(req,res){
  res.type('text/plain')
  if (c.host != 'orielball.uk') // Dev
    res.send("User-agent: *\nDisallow: /")
  else // Production
    res.send('')
  
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