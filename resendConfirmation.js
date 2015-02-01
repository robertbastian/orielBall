var c = require('./constants')
var db = require('mysql').createConnection(c.mysql)
var m = require('mandrill-api/mandrill')
var mandrill = new m.Mandrill(c.mandrill)

var sendTo = function(email,name,guests,type){
  mandrill.messages.sendTemplate({
      'template_name':'confirmation',
      'template_content':[],
      'message': {
        'to': [{'email': email,'name': name}],
        'subject': 'Ticket confirmation',
        'from_name': 'Oriel College Ball',
        'from_email': 'tickets@orielball.uk',
        'global_merge_vars': [
          {"name": 'TICKET_STRING', 'content': (1+guests)+' '+type+' Ticket'+(guests?'s':'')}
        ]
      }
    },
    function(result){
      console.log('Sent confirmation to %s',email)
    }, 
    function(error) {
      console.log(error)
      logError('Mandrill',error,'Trying to send confirmation to',name)
    }
  )
}

sendTo(process.argv[2],process.argv[3],0,'Non-dining')