// Adding to ticket holder mailing list
              var users = [{email:{email:r.email},merge_vars:{NAME: r.name,TYPE: r.type,GUEST:'No'}}]
              for (var i = 0; i < r.guests; i++)
                users.push({email:{email:r.guestEmails[i]},merge_vars:{NAME: r.guestNames[i],TYPE: r.type,GUEST:'Yes'}})
  
              mailchimp(users,'a52cfddcf4',function(error,response,body){
                if (!error && response.statusCode == 200)
                  console.log('Added %s and guests to ticket holder email list',r.email)
                else 
                  logError('Mailchimp',error || body.error,'Trying to add to ticket holder list',r.email)
              })
              
              
var mailchimp = function(batch,id,callback){
  request({
      uri: 'https://us9.api.mailchimp.com/2.0/lists/batch-subscribe',
      method: 'POST',
      json: {
        apikey: c.mailchimp,
        id:id,
        batch:batch,
        double_optin:false,
        update_existing:true
      }
    }, 
    callback
  )
}
