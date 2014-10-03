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
      $('#payment-form').append($('<input type="hidden" name="college" />').val($('#college input').val()))
      $('#payment-form').append($('<input type="hidden" name="guests" />').val(guestNumber))
      $('#payment-form').append($('<input type="hidden" name="stripeToken" />').val(token.id))
      $('#payment-form').get(0).submit()
    }
  },
  closed: function(){
    $('#pay').button('reset')
  }
})

$(document).ready(function(){

  $('#bodcardHelp').tooltip({
    placement: 'top',
    title:'This is the seven-digit number above the barcode',
    container:'body'
  })

  $('#pay').click(function(){
    if($('.alert').length > 0)
      $('.alert').remove();
    $('#name input, #email input, #college input, #bodcard input').trigger('change')
    
    if ($('.has-error').length == 0 && $('#terms input').is(':checked')) {
      $(this).button('loading')
      var amount = PRICES[($('#college input').val() == 'Oriel' && type == 'Non-dining') ? 'Oriel' : type] + PRICES[type] * guestNumber
        handler.open({
        email: $('#email input').val(),
        name: $('#name input').val(),
        description: (1+guestNumber) + ' ' + type.toLowerCase() + ' Ticket' + ((guestNumber>0)?'s':''),
        amount: amount * 100
      })
    }
    else 
      $('body').scrollTop(0)
    return false
  })

  $('#addGuest').click(function(){
    if (moreGuestsAllowed()){
      guestNumber++
      $('#guestList').append($('<div class="form-group"><div class="input-group"><span class="input-group-addon"><i class="fa fa-user fa-fw"></i></span><input name="guestNames['+guestNumber+']" type="text" placeholder="Name as on ID" class="form-control"><span class="input-group-btn"><button class="btn btn-default" id="removeGuest'+guestNumber+'" type="button"><i class="fa fa-minus"></i></button></span></div><div class="input-group"><span class="input-group-addon"><i class="fa fa-at fa-fw"></i></span><input name="guestEmails['+guestNumber+']" type="email" placeholder="Email address" class="form-control"></div></div>'))
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
    $('#nonDiningToggle small').html('&pound;'+PRICES['Non-dining'])
    if(test) {
      // Sets college
      if (COLLEGES[test[1]]) {
        $('#college input').val(COLLEGES[test[1]])
        if (test[1] == 'oriel')
          $('#nonDiningToggle small').html('&pound;'+PRICES['Oriel'])
      }
      else
        $('#college input').val('No college')
      $('#college input').trigger('change')
      $(this).parent().parent().removeClass('has-error')
    }
    else
      $(this).parent().parent().addClass('has-error')    
  })
  
  $('#college input').change(function(){
    if ($(this).val() != '') {
      if (ORIEL_ONLY && $(this).val() != 'Oriel') {
        $('#orielWarning').remove()
        var alert = $('<div class="alert alert-danger" id="orielWarning">Booking is only open to Oriel College members right now!<button type="button" class="close" data-dismiss="alert"><span aria-hidden="true">&times;</span><span class="sr-only">Close</span></button></div>')
        alert.alert()
        alert.insertAfter($('#college'))
        $('#college').addClass('has-error')
      }
      else {
        $('#college').removeClass('has-error')
        $('#orielWarning').remove()
      }
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
  if (guestNumber + 1 == MAX_TICKET_NUMBER) {
    var alert = $('<div class="alert alert-danger">You can only buy a maximum of '+MAX_TICKET_NUMBER+' tickets <button type="button" class="close" data-dismiss="alert"><span aria-hidden="true">&times;</span><span class="sr-only">Close</span></button></div>')
    alert.alert()
    alert.insertAfter($('#guestList'))
  }
  else if (1 + guestNumber >= remaining[type]) {
    var alert = $('<div class="alert alert-danger">There are not enough tickets of this type left <button type="button" class="close" data-dismiss="alert"><span aria-hidden="true">&times;</span><span class="sr-only">Close</span></button></div>')
    alert.alert()
    alert.insertAfter($('#guestList'))
  }
  else
    return true
  return false
}

var adjustGuests = function(){
  var tooMany = ($('#guestList .form-group').length + 1) - remaining[type]
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
  if (remaining['Non-dining'] == 0 && type == 'Non-dining' || remaining['Dining'] == 0 && type == 'Dining'){
    var alert = $('<div class="alert alert-danger">Your ticket type was changed because '+type.toLowerCase()+' tickets just sold out. <button type="button" class="close" data-dismiss="alert"><span aria-hidden="true">&times;</span><span class="sr-only">Close</span></button></div>')
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