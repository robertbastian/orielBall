const c = require('./constants')
var db = require('mysql').createConnection(c.mysql)

var ticketCounts = function(){
  count++
  db.query(
    "SELECT \
        (SELECT SUM(nonDining) FROM payments) + (SELECT SUM(nonDining) FROM blocks) as nonDining, \
        (SELECT SUM(dining) FROM payments) + (SELECT SUM(dining) FROM blocks) as dining, \
        (SELECT SUM(vip) FROM payments) + (SELECT SUM(vip) FROM blocks) as vip, \
        (SELECT nonDining + dining + vip) as total, \
        (SELECT COUNT(*) FROM waitingList WHERE NOT state = 'Waiting') as eligible, \
        (SELECT COUNT(*) FROM waitingList) as waitingList",[],
    function(err,rows,fields){
      if (!err){
        console.log(
          "\n\nTotal sold:\t%s (%s non-dining, %s dining, %s VIP)",
          rows[0].total, rows[0].nonDining,rows[0].dining,rows[0].vip
        )
        console.log(
          "Waiting list:\t%s (%s emailed for a total of %s)\n\n",
          rows[0].waitingList, rows[0].eligible, rows[0].total + rows[0].eligible
        )
      }
      if (--count == 0)
        process.exit()
    }
  )
}

// Selects people who have no payment record
var noPaymentRecord = function(){
  count++
  db.query(
    "SELECT * \
     FROM guestList \
     WHERE payment NOT IN ( \
       SELECT email \
       FROM payments ) OR payment IS NULL",
    function(err,rows,fields){
      if (!err){
        if (rows.length)
          for (var i in rows)
            console.log("No payment record for: %s (%s)",rows[i].name, rows[i].payment)
        else
          console.log("All payments exist")
        console.log("\n")
      }
      if (--count == 0)
        process.exit()
    }
  )
}

// Total money paid
var income = function(){
  count++
  db.query(
    // 633.77 is correction factor for mixed payments
    "SELECT (SELECT SUM(amount) FROM payments WHERE NOT type = 'Stripe') - 650 as transfers, \
        (SELECT SUM(amount*0.976-0.2) FROM payments WHERE type = 'Stripe') + 632.5 as stripe ",
    [],function(err,rows,fields){
      if (!err){
        require('stripe')(c.stripe.liveSecret).transfers.list({ limit: 100 }, function(err, transfers){
          if (transfers && transfers.data){
            paid = 0
            for (var i in transfers.data)
              paid += transfers.data[i].amount
            console.log("Transfers:\t£%d",rows[0].transfers)
            console.log("Stripe:\t\t£%s (£%d outstanding)",rows[0].stripe,Math.round(rows[0].stripe*100-paid)/100)
            console.log("Total:\t\t£%s\n",rows[0].transfers + rows[0].stripe)
          }
          if (--count == 0)
            process.exit()
        })
      }
    }
  )
}

//Selects people who have paid for an incorrect amount of tickets
var outstandingTransfers = function(){
  count++
  db.query(
    "SELECT * FROM ( \
      SELECT email, cast(155*nonDining + 185*dining + 250*vip - discount AS SIGNED) - cast(amount AS signed) as outstanding \
      FROM payments \
      ) a \
     WHERE NOT outstanding = 0",
    [],function(err,rows,fields){
      if (!err){
        if (rows.length)
          for (var i in rows)
            console.log("Incorrect amount: %s %s £%s",rows[i].email, (rows[i].outstanding < 0) ? "overpaid by" : "owes",rows[i].outstanding)
        else
          console.log("All amount entries are correct")
        console.log("\n")
      }
      if (--count == 0)
        process.exit()
    }
  )
}

// Verifies payments <-> guestList relation
var incorrectAmounts = function(){
  count++
  db.query(
    "SELECT * FROM (  \
       SELECT email, nonDining as paidND, (SELECT count(b.id) FROM guestList b WHERE b.type = 'Non-dining' AND b.payment = p.email) as actualND, \
                    dining as paidD, (SELECT count(b.id) FROM guestList b WHERE b.type = 'Dining' AND b.payment = p.email) as actualD, \
                    vip as paidVIP, (SELECT count(b.id) FROM guestList b WHERE b.type = 'VIP' AND b.payment = p.email) as actualVIP \
     FROM payments p) a \
     WHERE NOT a.paidND = a.actualND OR NOT a.paidD = a.actualD OR NOT a.paidVIP = a.actualVIP",
    [],function(err,rows,fields){
      if (!err){
        if (rows.length)
          for (var i in rows)
            console.log("Paid/actual tickets don't match: %s \t(Outstanding: %s ND, %s D, %s VIP)",rows[i].email,rows[i].actualND-rows[i].paidND,rows[i].actualD-rows[i].paidD,rows[i].actualVIP-rows[i].paidVIP)
        else
          console.log("Everyone paid for correct tickets")
        console.log("\n")
      }
      if (--count == 0)
        process.exit()
    }
  )
}

// Verifies only Oriel students received discount
var discounts = function(){
  count++
  db.query(
    "SELECT * \
     FROM payments \
     WHERE NOT (email LIKE '%@oriel.ox.ac.uk') * 10 = discount",
    [],function(err,rows,fields){
      if (!err){
        if (rows.length > 0)
          for (var i in rows)
            console.log("Incorrect discount: £%d\t%s",rows[i].discount,rows[i].email)
        else
          console.log("All discounts applied correctly")
        console.log("\n")
      }
      if (--count == 0)
        process.exit()
    }
  )
}

// Selects individuals for whom more than one ticket was bought
var duplicateTickets = function(){
  count++
  db.query(
    "SELECT name, count(*) as amount \
     FROM guestList \
     WHERE NOT name = '' \
     GROUP BY name \
     HAVING count(*) > 1",
    [],function(err,rows,fields){
      if (!err){
        if (rows.length > 0)
          for (var i in rows)
            console.log("'%s' has %s tickets",rows[i].name,rows[i].amount)
        else
          console.log("Nobody has more than one ticket")
        console.log('\n')
      }
      if (--count == 0)
        process.exit()
    }
  )
}

var collegeComposition = function(){
  count++
  db.query(
    "SELECT college, \
            count(NAME) AS absolute, \
            count(NAME)/(SELECT COUNT(*) FROM guestList)*100 AS relative \
     FROM guestList \
     GROUP BY college\
     ORDER BY absolute DESC",
    [],function(err,rows,fields){
      if (!err){
        for (var i in rows){
          console.log("%s\t%s\t%s%",rows[i].college+Array(18-rows[i].college.length).join(" "),rows[i].absolute,Math.round(rows[i].relative*100)/100)
        }
      }
      if (--count == 0)
        process.exit()
    }
  )
}


var count = 0

if (process.argv.length == 2){
  ticketCounts()
  noPaymentRecord()
  income()
  incorrectAmounts()
  outstandingTransfers()
  discounts()
  duplicateTickets()
}
else if (process.argv[2] == 'integrity'){
  noPaymentRecord()
  incorrectAmounts()
  discounts()
  duplicateTickets()
}
else if (process.argv[2] == 'finances'){
  ticketCounts()
  income()
  outstandingTransfers()
}
else if (process.argv[2] == 'colleges')
  collegeComposition()

