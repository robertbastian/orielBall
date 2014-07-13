/* Sending updates */
server.get('/processUpdate/:subject',function(req,res){
  var date = new Date()
  var message = {
    subject: req.param('subject'),
    number: fs.readdirSync('public/updates').length,
    date: date.getDay()+"."+date.getMonth()+"."+date.getFullYear()
  }  

  var markdown = fs.readFileSync('public/updates'+message.subject)
  request.post(
    {
      headers: {
        'content-type' : 'text/plain',
        'user-agent' : 'orielball'
      },
      url:     'https://api.github.com/markdown/raw',
      body:    markdown
    },
    function(err, res2, body) {
      message['body'] = body
      fs.writeFileSync('public/updates'+message.number,JSON.stringify(message))
      fs.unlinkSync('public/updates'+message.subject)
      sendUpdate(message.number)
      res.writeHead(301,{"Location":"https://orielball.uk/updates/"+message.number})
      res.end()
    }
  )
})

function sendUpdate(number)
{
  var message = JSON.parse(fs.readFileSync('public/updates'+number))
  /* Sending emails */
  db.query('SELECT email FROM mailingList',
    function(err,rows,fields)
    {
      if (err)
        console.log('Database error')
      else
      {
        var transport = nodemailer.createTransport("SES",constants.ses)
        var mailOptions = {
          from: "Oriel College Ball <marketing@orielball.uk>",
          subject: message.subject,
        }
        var recipients = []
        for (var i = 0, len = rows.length; i < len; i++)
        {
          mailOptions['to'] = rows[i]['email']
          mailOptions['html'] = message.body+
            "<center><br>If the message doesn't display properly, click here: <a href='https://orielball.uk/updates/"+
            message.number+"'>https://orielball.uk/updates/"+message.number+"</a><br>"+
            "To unscubscribe, click <a href='http://orielball.uk/unsubscribe/"+encodeURIComponent(rows[i]['email'])+"'>here</a></center>"
          transport.sendMail(mailOptions,function(err,res){ if (err) console.log(err) })
        }
        transport.close()
      }
    }
  )

  /* Sending push notification */
  db.query('SELECT device FROM pushList',
    function(err,rows,fields)
    {
      if (err)
        console.log('Database error')
      else
      {
        var devices = []
        for (var i = 0, len = rows.length; i < len; i++)
          devices.push(new apn.Device(rows[i]['device']))  

        var notification = new apn.Notification()
        notification.expiry = Math.floor(Date.now()/1000) + 3600 * 24 * 7
        notification.alert = {
          "title": "Oriel Ball Update #"+message.number,
          "body": message.subject,
          "action":"Read"
        }
        notification.urlArgs = [""+message.number] 


        var connection = new apn.Connection({
          "production": true,
          "key": fs.readFileSync('/private/certificates/push-key.pem'),
          "cert": fs.readFileSync('/private/certificates/push-cert.pem')  
        })
        connection.pushNotification(notification,devices)
        connection.shutdown()
      }
    }
  )
}