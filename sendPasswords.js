var c = require('./constants')
var db = require('mysql').createConnection(c.mysql)
var m = require('mandrill-api/mandrill')
var mandrill = new m.Mandrill(c.mandrill)
var sendTo = function(name){
  mandrill.messages.send(
    {'message': 
      {
        'text': 'Hello,\n\You requested remote access to the booking system during the Oriel only period. We have set up a password protected page under https://orielball.uk/protectedTickets which you will be able to access using the following credentials:\n\nUsername:\t*|name|*\nPassword:\t*|pw|*\n\nIf you have any questions or issues, reply to this email or message me on Facebook\n\nRobert',
        'subject': 'Oriel Ball: Remote ticketing access',
        'from_email': 'it@orielball.uk',
        'from_name': 'Robert Bastian',
        'to': [{'email':name+'@oriel.ox.ac.uk'}],
        "merge_vars": [{
          'rcpt':name+'@oriel.ox.ac.uk',
          'vars': [
            {'name':'name','content':name},
            {'name':'pw','content':c.ticketPasswords[name]}
          ]
        }]
      }
    },
    function(result){ console.log(result) }, 
    function(error) { console.log(error) }
  )
}

sendTo(process.argv[2])