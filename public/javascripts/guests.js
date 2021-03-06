var guestNumber = 0
var type

var handler = StripeCheckout.configure({
  key: STRIPE,
  currency: 'gbp',
  image: '/icons/apple-touch-icon.png',
  allowRememberMe: false,
  // Callback function: appends the charge token and send the form
  token: function(token){
    if (adjustGuests()){
      $('#payment-form').append($('<input type="hidden" name="name" />').val($('#name input').val()))
      $('#payment-form').append($('<input type="hidden" name="guests" />').val(guestNumber))
      $('#payment-form').append($('<input type="hidden" name="stripeToken" />').val(token.id))
      $('#payment-form').append($('<input type="hidden" name="email" />').val($('#email input').val())) 
      $('#payment-form').append($('<input type="hidden" name="type" />').val(type))    
      $('#payment-form').get(0).submit()
    }
  },
  closed: function(){
    $('#pay').button('reset')
  }
})

$(document).ready(function(){
  $('#loadGuests').click(function(){
    if($('.alert').length > 0)
      $('.alert').remove();
    $('#name input, #email input, #college input, #bodcard input').trigger('change')
    
    if ($('.has-error').length == 0) {
      $.post('/loadGuests',{
          name: $('#name input').val(),
          email: $('#email input').val(),
          bodcard: $('#bodcard input').val()
        },function(data){
          if (!data.guests) {
            var alert = $('<div class="alert alert-danger" style="margin-top:20px;">There are no bookings using this info.<button type="button" class="close" data-dismiss="alert"><span aria-hidden="true">&times;</span><span class="sr-only">Close</span></button></div>')
            alert.alert()
            alert.insertAfter($('#loadGuests'))
          }
          else {
            type = data.type
            for (var i = 0; i < data.guests.length; i++)
              $('#oldGuestList').append($('<div class="form-group"><div class="input-group"><span class="input-group-addon"><i class="fa fa-user fa-fw"></i></span><input type="text" placeholder="'+data.guests[i]['name']+'" class="form-control" disabled><span class="input-group-btn"><button class="btn btn-default disabled" type="button" disabled><i class="fa fa-minus"></i></button></span></div><div class="input-group"><span class="input-group-addon"><i class="fa fa-at fa-fw"></i></span><input type="email" placeholder="'+data.guests[i]['email']+'" class="form-control" disabled></div></div>'))
            $('#guests').removeClass('hidden')
            $('#payment').removeClass('hidden')
            $('input').attr('disabled',true)
            $('.checkbox input').attr('disabled',false)
            MAX_TICKET_NUMBER -= 1 + data.guests.length
            $('#loadGuests').addClass('hidden')
          }
        }
      )
    }
    return false
  })

  $('#bodcardHelp').tooltip({
    placement: 'top',
    title:'This is the seven-digit number above the barcode',
    container:'body'
  })

  $('#pay').click(function(){
    $(this).button('loading')
    var amount = PRICES[type][false] * guestNumber
      handler.open({
      email: $('#email input').val(),
      name: $('#name input').val(),
      description: guestNumber + ' ' + type.toLowerCase() + ' Ticket' + ((guestNumber>1)?'s':''),
      amount: amount * 100
    })
    return false
  })

  $('#addGuest').click(function(){
    if (moreGuestsAllowed()){
      guestNumber++
      $('#guestList').append($('<div class="form-group"><div class="input-group"><span class="input-group-addon"><i class="fa fa-user fa-fw"></i></span><input name="guestNames['+guestNumber+']" type="text" placeholder="Name" class="form-control"><span class="input-group-btn"><button class="btn btn-default" id="removeGuest'+guestNumber+'" type="button"><i class="fa fa-minus"></i></button></span></div><div class="input-group"><span class="input-group-addon"><i class="fa fa-at fa-fw"></i></span><input name="guestEmails['+guestNumber+']" type="email" placeholder="Email address" class="form-control"></div></div>'))
      $('#removeGuest'+guestNumber).click(function(){
        $(this).parent().parent().parent().remove()
        guestNumber--
        return false
      })
    }
    return false
  })

  $('#name input').change(function(){
    if (/.+ .+/.test($(this).val()))
      $(this).parent().parent().removeClass('has-error')
    else 
      $(this).parent().parent().addClass('has-error')
  })

  $('#email input').change(function(){
    var test = /^.+@(.+)\.ox\.ac\.uk$/.exec($(this).val())
    if(test) {
      // Sets college
      if (COLLEGES[test[1]])
        $('#college input').val(COLLEGES[test[1]])
      else
        $('#college input').val('No college')
      $('#college input').trigger('change')
      $(this).parent().parent().removeClass('has-error')
    }
    else
      $(this).parent().parent().addClass('has-error')    
  })
  
  $('#college input').change(function(){
    var col = $(this).val()
    if (col != '') {
      $('#orielWarning').remove()
      if (ORIEL_ONLY && col != 'Oriel') {
        var alert = $('<div class="alert alert-danger" id="orielWarning">Booking is only open to Oriel College members!<button type="button" class="close" data-dismiss="alert"><span aria-hidden="true">&times;</span><span class="sr-only">Close</span></button></div>')
        alert.alert()
        alert.insertAfter($('#college'))
        $('#college').addClass('has-error')
      }
      else
        $('#college').removeClass('has-error')
      $('#nonDiningToggle small').html('&pound;'+PRICES['Non-dining'][col == 'Oriel'])
      $('#diningToggle small').html('&pound;'+PRICES['Dining'][col == 'Oriel'])
    }
    else
      $('#college').addClass('has-error')
  })
  
  $('#bodcard input').change(function(){
    if (/^[0-9]{7}$/.test($(this).val()))
      $(this).parent().parent().removeClass('has-error')
    else 
      $(this).parent().parent().addClass('has-error')
  })
  
  $('#terms input').change(function(){
    if ($('#terms input').is(':checked'))
      $('#pay').removeClass('disabled')
    else
      $('#pay').addClass('disabled')
  })
    
  $('#type label').change(function(){
    type = $('input[name=type]:checked').val()
    adjustGuests()
  })
  
  $('#nonDiningToggle').click()
  updateTickets()
})

// Checks whether a guest can be added
var moreGuestsAllowed = function(){
  if (guestNumber == MAX_TICKET_NUMBER) {
    var alert = $('<div class="alert alert-danger">You can only buy a maximum of 10  tickets.<button type="button" class="close" data-dismiss="alert"><span aria-hidden="true">&times;</span><span class="sr-only">Close</span></button></div>')
    alert.alert()
    alert.insertAfter($('#guestList'))
  }
  else if (guestNumber >= remaining[type]) {
    var alert = $('<div class="alert alert-danger">You can\'t add any more guests because there are not enough '+type.toLowerCase()+' tickets left.<button type="button" class="close" data-dismiss="alert"><span aria-hidden="true">&times;</span><span class="sr-only">Close</span></button></div>')
    alert.alert()
    alert.insertAfter($('#guestList'))
  }
  else
    return true
  return false
}

var adjustGuests = function(){
  var tooMany = guestNumber - remaining[type]
  if (tooMany > 0)
  {
    for (var i = 0; i < tooMany; i++){
      $('#guestList .form-group:last').remove()
      guestNumber--
    }
    var alert = $('<div class="alert alert-danger">'+tooMany+' of your guests had to be removed, because there aren\'t enough tickets left. <button type="button" class="close" data-dismiss="alert"><span aria-hidden="true">&times;</span><span class="sr-only">Close</span></button></div>')
    alert.alert()
    alert.insertAfter($('#guestList'))
    return false
  }
  return true
}

var adjustButtons = function(){
  // Selected ticket just sold out, shows error message
  if (remaining[type] == 0 && guestNumber > 0){
    var alert = $('<div class="alert alert-danger">This type of tickets just sold out.<button type="button" class="close" data-dismiss="alert"><span aria-hidden="true">&times;</span><span class="sr-only">Close</span></button></div>')
    alert.alert()
    alert.insertAfter($('#guestList'))
  }

  // Disable and select other ticket
  if (remaining['Non-dining'] == 0) {
    $('#nonDiningToggle').addClass('disabled')
    $('#diningToggle').click()
  }
  else if (remaining['Dining'] == 0) {
    $('#diningToggle').addClass('disabled')
    $('#nonDiningToggle').click()
  }
}

// Updates remaining tickets in menubar
var updateTickets = function(){
  $.post('/ticketsLeft')
  .done(function(left)
  {
    remaining = {
      'Non-dining': left[0],
      'Dining': left[1]
    }

    // If no tickets are left, reload, this will become the 'sold out' page
    if (remaining['Non-dining'] + remaining['Dining'] == 0)
     location.reload()
    
    adjustButtons()
    adjustGuests()

    // Update menubar
    $('#nonDiningLeft').html(remaining['Non-dining'])
    $('#diningLeft').html(remaining['Dining'])

    // And load again in 10s
    setTimeout(updateTickets,10000)
  })
  .fail(function(err){
    // On fail, retry in 30s
    setTimeout(updateTickets,30000)
  })
}