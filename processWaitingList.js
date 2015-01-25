var c = require('./constants')
var m = require('mandrill-api/mandrill')
var mandrill = new m.Mandrill(c.mandrill)
var db = require('mysql').createConnection(c.mysql)
var crypto = require('crypto')

// Send 'invitation' emails
if (process.argv[2] == 'step1'){
  db.query(
    "SELECT (SELECT COUNT(*) FROM bookings) + (SELECT COUNT(*) FROM waitingList WHERE emailed = 1) as possiblySold",
    [],
    function(error,rows,fields){
      if (error)
        console.log(error)
      else {
        var ticketsLeft = c.tickets.amount.total - rows[0]['possiblySold']
        db.query("SELECT name, email FROM waitingList WHERE emailed = 0 ORDER BY time ASC LIMIT ?",
        [ticketsLeft],
        function(error,rows,fields){
          if (error)
            console.log(error)
          else {
            for (var i = 0; i < rows.length; i++){
              mandrill.messages.send(
                {'message': 
                  {
                    'text': 'Dear '+rows[i]['name'].split(' ')[0]+',\n\nWe\'re happy to tell you that due to your position on the waiting list we can offer you a ticket to the Oriel Ball this summer!\nIf you\'d like to purchase a ticket, please reply to this email and we will send you more details in a couple of days. \n\nBest wishes,\nCharlie',
                    'subject': 'Oriel Ball: Waiting list update',
                    'from_email': 'tickets@orielball.uk',
                    'from_name': 'Charlie Cornish',
                    "headers": {
                        "Reply-To": "Robert Bastian <it@orielball.uk>"
                    },
                    'to': [rows[i]],
                  }
                },
                function(result){
                  console.log(result)
                  db.query('UPDATE waitingList SET emailed = 1 WHERE email = ?',
                  [result[0].email],
                  function(error,rows,fields){
                    if (error)
                      console.log(error)
                    else
                      console.log("Noted delivery in database")
                  })
                }, 
                function(error){
                  console.log(error)
                }
              )
            }   
          }
        }) 
      }
    }
  )
}

// Send credentials
else if (process.argv[2] == 'step2'){
  db.query("SELECT name, email FROM waitingList WHERE emailed = 1 AND password = '-'",[],
  function(error,rows,fields){
    if (!error){
      for (var i = 0; i < rows.length; i++){
        var password = crypto.randomBytes(5).toString('hex')
        var name = rows[i].name
        var email = rows[i].email
        db.query('UPDATE waitingList SET password = ? WHERE email = ?',
        [password, email],
        function(error2,rows2,fields2){
          if (!error2){
            mandrill.messages.send(
              {'message': 
                {
                  'text': 'Dear '+name.split(' ')[0]+',\n\nTo buy your ticket, please go to https://orielball.uk/waitingListTickets. \n\nYou will need to log in using the following credentials:\nUsername: '+email+'\nPassword: '+password+'\n\nThe rest of the booking process is as before, you will need a credit card and your bodcard.\n\n Best wishes,\nRobert',
                  'subject': 'Oriel Ball: Waiting list update',
                  'from_email': 'it@orielball.uk',
                  'from_name': 'Robert Bastian',
                  'to': [{'email':email,'name':name}],
                }
              },
              function(result){
                console.log(result)
              }, 
              function(error){
                console.log(error)
              }
            )
          }
        })
      }
    }
  })
}


















