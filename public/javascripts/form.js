var guestNumber = 0
var type

var handler = StripeCheckout.configure({
  key: STRIPE,
  currency: 'gbp',
  image: 'https://www.orielball.uk/images/apple-touch-icon.png',
  allowRememberMe: false,
  // Callback function: appends the charge token and send the form
  token: function(token){
    if (adjustGuests()){
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
  // Initializes bodcard tooltip
  $('#bodcardHelp').tooltip({
    placement: 'top',
    title:'This is the seven-digit number above the barcode',
    container:'body'
  })
  
  // Initializes college selector
  $('.selectpicker').selectpicker()
  if (ORIEL_ONLY) {
    $('.selectpicker').selectpicker('val', 'Oriel')
    $('.selectpicker').prop('disabled',true)
    $('.selectpicker').selectpicker('refresh')
    $('#payment-form').append($('<input type="hidden" name="college" value="Oriel" />'))
  }

  $('#pay').click(function(){
    if (verifyInput()) {
      $(this).button('loading')
      // Opens the stripe window
      handler.open({
        email: $('#email input').val(),
        name: $('#name input').val(),
        description: (1+guestNumber) + ' ' + type.toLowerCase() + ' ticket' + ((guestNumber>0)?'s':''),
        amount: PRICES[type] * 100 * (1+guestNumber)
      })
    }
    else 
      $('body').scrollTop(0)
    // Disables actually submitting the form
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


  $('#type label').change(function(){
    type = $('input[name=type]:checked').val()
    adjustGuests()
  })
  $('#nonDiningToggle').click()

  // Start updating tickets
  updateTickets()
})

// Checks whether a guest can be added
var moreGuestsAllowed = function(){
  if (guestNumber + 1 == MAX_GUEST_NUMBER) {
    var alert = $('<div class="alert alert-danger">You can only buy a maximum of '+MAX_GUEST_NUMBER+' tickets <button type="button" class="close" data-dismiss="alert"><span aria-hidden="true">&times;</span><span class="sr-only">Close</span></button></div>')
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

// Verifies inputs
var verifyInput = function(){
  // Assumes everything went alright
  $('.has-error').removeClass('has-error')
  $('.alert').alert('close')
  // Name has to be first and last name
  if (!/^.+ .+$/.test($('#name input').val()))
    $('#name').addClass('has-error')

  // Bodcard has to be seven digits
  if (!/^[0-9]{7}$/.test($('#bodcard input').val()))
    $('#bodcard').addClass('has-error')

  // College has to be non-empty and the correct email
  var college = $('#college select').val()
  var domains = {"All Souls":"all-souls","Balliol":"balliol","Blackfriars":"bfriars","Brasenose":"bnc","Campion Hall":"campion","Christ Church":"chch","Corpus Christi":"ccc","Exeter":"exeter","Green Templeton":"gtc","Harris Manchester":"hmc","Hertford":"hertford","Jesus":"jesus","Keble":"keble","Kellogg":"kellog","Lady Margaret Hall":"","Linacre":"linacre","Lincoln":"lincoln","Magdalen":"magd","Mansfield":"mansfield","Merton":"merton","New":"new","Nuffield":"nuffield","Oriel":"oriel","Pembroke":"pmb","Queen's":"queens","Regent's Park":"regents","Somerville":"some","St Anne's":"st-annes","St Antony's":"sant","St Benet's Hall":"stb","St Catherine's":"stcatz","St Cross":"stx","St Edmund Hall":"seh","St Hilda's":"sthildas","St Hugh's":"st-hughs","St John's":"sjc","St Peter's":"spc","St Stephen's House":"ssho","Trinity":"trinity","University":"univ","Wadham":"wadh","Wolfson":"wolfson","Worcester":"worc","Wycliffe Hall":"wycliffe","":""}
  if (college == 'Select college...')
    $('#college').addClass('has-error')
  
  // Email has to .ox.ac.uk
  if (!/^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9_.+-]+\.ox\.ac\.uk$/.test($('#email input').val()))
    $('#email').addClass('has-error')
  else if (!(new RegExp('@'+domains[college]+'.ox.ac.uk').test($('#email input').val())))
  {
    var alert = $('<div class="alert alert-danger">Your email doesn\'t match your college<button type="button" class="close" data-dismiss="alert"><span aria-hidden="true">&times;</span><span class="sr-only">Close</span></button></div>')
    alert.alert()
    alert.insertAfter($('#email'))
    $('#email').addClass('has-error')
  }
  // Everything ok
  return $('.has-error').length == 0
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
    $('#nonDiningLeft').html('&nbsp;'+remaining['Non-dining'])
    $('#diningLeft').html('&nbsp;'+remaining['Dining'])

    // And load again in 10s
    setTimeout(updateTickets,10000)
  })
  .fail(function(err){
    // On fail, retry in 30s
    setTimeout(updateTickets,30000)
  })
}