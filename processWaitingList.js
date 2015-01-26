var c = require('./constants')
var m = require('mandrill-api/mandrill')
var mandrill = new m.Mandrill(c.mandrill)
var db = require('mysql').createConnection(c.mysql)
var crypto = require('crypto')


// Determine eligible people and email them
if (process.argv[2] == 'emailEligible'){
  
  db.query(
    "SELECT (SELECT COUNT(*) FROM bookings) + (SELECT COUNT(*) FROM waitingList WHERE state = 'Eligible') as possiblySold",
    [],
    function(error,rows,fields){
      if (error)
        console.log(error)
      else {
        var ticketsLeft = c.tickets.amount.total - rows[0]['possiblySold']
        var limit = (process.argv.length < 4) ? ticketsLeft : Math.min(ticketsLeft,process.argv[3])
        findEligible(limit, emailRows)
      }
    }
  )
  
  var findEligible = function(limit, next){
    db.query(
      "SELECT name, email FROM waitingList WHERE state = 'Waiting' ORDER BY time ASC LIMIT ?",
      [x],
      function(error,rows,fields){
        if (error)
          console.log(error)
        else {
          console.log("Eligible:")
          next(rows)
        }   
      }
    ) 
  }

  var emailRows = function(rows){
    var to = []
    var mergeVars = []
    for (var i = 0; i < rows.length; i++){
      to.push({"name":rows[i].name, "email": rows[i].email})
      mergeVars.push({"rcpt":rows[i].email, "vars":[{name:"fname", content: rows[i].name.split(' ')[0]}]})
    }
    mandrill.messages.send(
      {'message': 
        {
          'text': 'Dear *|fname|*,\n\nWe\'re happy to tell you that due to your position on the waiting list we can offer you a ticket to the Oriel Ball this summer!\nIf you\'d like to purchase a ticket, please reply to this email and we will send you more details in a couple of days. \n\nBest wishes,\nCharlie',
          'subject': 'Oriel Ball: Waiting list update',
          'from_email': 'tickets@orielball.uk',
          'from_name': 'Charlie Cornish',
          "headers": {
              "Reply-To": "Robert Bastian <it@orielball.uk>"
          },
          'to': to,
          'merge_vars': mergeVars
        }
      },
      function(result){
        var emails = []
        for (var i = 0; i < result.length; i++)
          emails.push(result[i].email)
        db.query("UPDATE waitingList SET state = 'Eligible' WHERE email IN (?)",
        [emails],
        function(error,rows,fields){
          if (error)
            console.log(error)
          else
            console.log("Noted deliveries in database")
        })
      }, 
      function(error){
        console.log(error)
      }
    )
  }
}

// send passwords to 'Interested' people
else if (process.argv[2] == 'sendPasswords'){
  db.query(
    "SELECT name,email,password FROM waitingList WHERE state = 'Interested'",
    [],
    function(error,rows,fields){
      if (error)
        console.log(error)
      else {
        var to = []
        var mergeVars = []
        for (var i = 0; i < rows.length; i++){
          to.push({"name":rows[i].name, "email": rows[i].email})
          mergeVars.push({"rcpt":rows[i].email, "vars":[{name: "email", content:rows[i].email}, {name:"fname", content: rows[i].name.split(' ')[0]},{ name: "password", content: rows[i].password}]})
        }
        mandrill.messages.send(
          {'message': 
            {
              'text': 'Dear *|fname|*,\n\nTo buy your ticket, please go to https://orielball.uk/waitingListTickets. \n\nYou will need to log in using the following credentials:\nUsername: *|email|*\nPassword: *|password|*\n\nThe rest of the booking process is as before, you will need a credit card and your bodcard. You have until Sunday (Feb 1) to buy your ticket, after that it will be passed down the waiting list.\n\nBest wishes,\nRobert',
              'subject': 'Oriel Ball: Buy your ticket',
              'from_email': 'it@orielball.uk',
              'from_name': 'Robert Bastian',
              'to': to,
              'merge_vars':mergeVars
            }
          },
          function(result){
            var emails = []
            for (var i = 0; i < result.length; i++)
              emails.push(result[i].email)
            db.query("UPDATE waitingList SET state = 'Emailed' WHERE email IN (?)",
            [emails],
            function(error,rows,fields){
              if (error)
                console.log(error)
              else
                console.log("Noted deliveries in database")
            })
          }, 
          function(error){
            console.log(error)
          }
        )    
      }
    }
  )
}
