var c = require('./constants')
var m = require('mandrill-api/mandrill')
var mandrill = new m.Mandrill(c.mandrill)
var db = require('mysql').createConnection(c.mysql)


var ticketString = function(row){
  var nd = row.nonDining
  var d = row.dining
  var vip = row.vip
  if (nd > 0 && d > 0)
    return (nd + ' non-dining and ' + d + ' dining ticket' + ((d > 1) ? 's' : ''))
  else if (nd > 0)
    return (nd + ' non-dining ticket' + ((nd > 1) ? 's' : ''))
  else if (d > 0)
    return (d + ' dining ticket' + ((d > 1) ? 's' : ''))
  else if (vip > 0)
      return (vip + ' VIP ticket' + ((vip > 1) ? 's' : ''))
}

var slot = function(letter){
  var s = {
    'a':'A',
    'b':'A',
    'c':'A',
    'd':'B',
    'e':'B',
    'f':'B',
    'g':'B',
    'h':'B',
    'i':'C',
    'j':'C',
    'k':'C',
    'l':'C',
    'm':'C',
    'n':'D',
    'o':'D',
    'p':'D',
    'q':'D',
    'r':'D',
    's':'D',
    't':'E',
    'u':'E',
    'v':'E',
    'w':'E',
    'x':'E',
    'y':'E',
    'z':'E'
  }[letter]
  return ((s === undefined) ? 'C' : s)
}

/* Bodcard version */
db.query(
  "SELECT g.name, g.email, p.barcode, p.nonDining, p.dining, p.vip, SUBSTRING(SUBSTRING_INDEX(SUBSTRING_INDEX(p.email, '@', 1),'.',-1),1,1) as letter, SUBSTRING_INDEX(name, ' ', 1) as fname FROM payments p, guestList g WHERE g.email = g.payment AND g.payment = p.email AND p.barcode < 5000000 AND (p.email LIKE 'galuzor@gmail.com');",
  [],
  function(error,rows,fields){
    if (error)
      console.log(error)
    else {
      var to = []
      var mergeVars = []
      for (var i = 0; i < rows.length; i++){
        to.push({name: rows[i].name, email: rows[i].email})
        mergeVars.push({rcpt: rows[i].email, vars: [
          {name:"NAME", content: rows[i].fname},
          {name:"BODCARD", content: rows[i].barcode},
          {name:"TICKET_STRING",content: ticketString(rows[i])},
          {name:"SLOT", content:slot(rows[i].letter)}
        ]})
      }
      mandrill.messages.sendTemplate({
          'template_name':'ticket-collection-bodcards',
          'template_content':[],
          'message': {
            'to': to,
            'subject': 'Wristband collection',
            'from_name': 'Oriel College Ball',
            'from_email': 'tickets@orielball.uk',
            'merge_vars': mergeVars
          }
        },
        function(result){
          console.log('Sent collection email (bodcards) to %j',to)
        },
        function(error) {
          console.log(error)
        }
      )
    }
  }
)
db.query(
  "SELECT g.name, g.email, p.barcode, p.nonDining, p.dining, p.vip, SUBSTRING(SUBSTRING_INDEX(SUBSTRING_INDEX(p.email, '@', 1),'.',-1),1,1) as letter, SUBSTRING_INDEX(name, ' ', 1) as fname FROM payments p, guestList g WHERE g.email = g.payment AND g.payment = p.email AND p.barcode >= 5000000 AND (p.email LIKE 'galuzor@gmail.com');",
  [],
  function(error,rows,fields){
    if (error)
      console.log(error)
    else {
      var to = []
      var mergeVars = []
      for (var i = 0; i < rows.length; i++){
        to.push({name: rows[i].name, email: rows[i].email})
        mergeVars.push({rcpt: rows[i].email, vars: [
          {name:"NAME", content: rows[i].fname},
          {name:"BARCODE", content: rows[i].barcode},
          {name:"TICKET_STRING",content: ticketString(rows[i])},
          {name:"SLOT", content:slot(rows[i].letter)}
        ]})
      }
      mandrill.messages.sendTemplate({
          'template_name':'ticket-collection-barcodes',
          'template_content':[],
          'message': {
            'to': to,
            'subject': 'Wristband collection',
            'from_name': 'Oriel College Ball',
            'from_email': 'tickets@orielball.uk',
            'merge_vars': mergeVars
          }
        },
        function(result){
          console.log('Sent collection email (barcodes) to %j',to)
        },
        function(error) {
          console.log(error)
        }
      )
    }
  }
)
