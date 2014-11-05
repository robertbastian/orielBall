var c = require('./constants')
var m = require('mandrill-api/mandrill')
var mandrill = new m.Mandrill(c.mandrill)

var recipients = []
var mergeVars = []
for (var name in c.ticketPasswords){
  recipients.push({'email':name+'@oriel.ox.ac.uk'})
  mergeVars.push({
    'rcpt':name+'@oriel.ox.ac.uk',
    'vars': [
      {'name':'name','content':name},
      {'name':'pw','content':c.ticketPasswords[name]}
    ]
  })
}
var text = 'Hello,\n\
You requested remote access to the booking system during the Oriel only period. We have set up a password protected page under https://orielball.uk/protectedTickets which you will be able to access this using the following credentials:\n\n \
Username:\t*|name|*\n \
Password:\t*|pw|*\n\n \
If you have any questions or issues, reply to this email or message me on Facebook\n\nRobert'

mandrill.messages.send(
  {'message': 
    {
      'text': text,
      'subject': 'Oriel Ball: Remote ticketing access',
      'from_email': 'it@orielball.uk',
      'from_name': 'Robert Bastian',
      'to': recipients,
      "merge_vars": mergeVars
    }
  },
  function(result){}, 
  function(error) { console.log(error) }
)