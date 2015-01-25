var c = require('./constants')
var m = require('mandrill-api/mandrill')
var mandrill = new m.Mandrill(c.mandrill)

var resend = [
  {ticketString:'6 Non-dining Tickets',recipient:{'email': 'hannah.bossers@st-hildas.ox.ac.uk','name': 'Hannah Bossers'}}]

for (var i = 0; i < resend.length; i++)
  mandrill.messages.sendTemplate({
    'template_name':'confirmation',
    'template_content':[],
    'message': 
    {
      'to': [resend[i].recipient],
      'subject': 'Ticket confirmation',
      'from_name': 'Oriel College Ball',
      'from_email': 'tickets@orielball.uk',
      'global_merge_vars': [
        {"name": 'TICKET_STRING', 'content': resend[i].ticketString}
      ]
    }
    },
    function(result){
      if (result[0].status == 'sent')
        console.log('Sent confirmation to '+i)
    }, 
    function(error) {
      console.log(error)
    }
  )