var c = require('./constants')
var m = require('mandrill-api/mandrill')
var mandrill = new m.Mandrill(c.mandrill)
var db = require('mysql').createConnection(c.mysql)


db.query(
  "SELECT b.name, b.email, p.bodcard FROM payments p, bookings b WHERE b.email = b.payment AND b.payment = p.payer AND p.reference = 'Test'",
  [],
  function(error,rows,fields){
    if (error)
      console.log(error)
    else {
      var to = []
      var mergeVars = []
      for (var i = 0; i < rows.length; i++){
        to.push({name: rows[i].name, email: rows[i].email})
        mergeVars.push({rcpt: rows[i].email, vars: [{name:"NAME", content: rows[i].name.split(' ')[0]},{name: "BARCODE", content: rows[i].bodcard}]})
      }
      mandrill.messages.sendTemplate({
          'template_name':'ticket-collection',
          'template_content':[],
          'message': {
            'to': to,
            'subject': 'Ticket collection',
            'from_name': 'Oriel College Ball',
            'from_email': 'tickets@orielball.uk',
            'merge_vars': mergeVars
          }
        },
        function(result){
          console.log('Sent collection email to %s',to)
        }, 
        function(error) {
          console.log(error)
        }
      )
    }
  }
)
