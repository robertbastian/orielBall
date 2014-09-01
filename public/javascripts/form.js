// Initializes stripe window
var handler = StripeCheckout.configure({
  key: stripe,
  currency: 'gbp',
  image: '/images/logo.svg',
  allowRememberMe: false,
  // Callback function: appends the charge token and send the form
  token: function(token){
    $('#payment-form').append($('<input type="hidden" name="stripeToken" />').val(token.id))
    $('#payment-form').get(0).submit()
  }
})

$(document).ready(function(){
  // Initializes bodcard tooltip
  $('#bodcardHelp').tooltip({placement: 'left'})
  // Initializes college selector
  $('#college select').selectize({
    maxItems: 1,
    sortField: {
      field: 'text',
      direction: 'asc'
    }
  })

  $('#nonDiningToggle').click()

  // Verifies inputs and proceeds to payment
  $('#pay').click(function(){
    // Assumes everything went alright
    $('.has-error').removeClass('has-error')
    
    // Name has to be first and last name
    if (!/^.+ .+$/.test($('#name input').val()))
      $('#name').addClass('has-error')
    // Email has to be .ox.ac.uk
    if (!/^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-.]+\.ox\.ac\.uk$/.test($('#email input').val()))
      $('#email').addClass('has-error')
    // Bodcard has to be seven digits
    if (!/^[0-9]{7}$/.test($('#bodcard input').val()))
      $('#bodcard').addClass('has-error')
    // College has to be non-empty
    if ($('#college select').val() == '')
      $('#college').addClass('has-error')
    
    // Everything ok
    if ($('.has-error').length == 0)
    {
      // Determines type to charge the right amount
      var type = $('input[name=type]:checked').val()
      // Opens the stripe window
      handler.open({
        email: $('#email input').val(),
        name: $('#name input').val(),
        description: type + ' Ticket',
        amount: prices[type] * 100
      })
    }
    // Disables submitting the form
    return false
  })
  // Updates remaining tickets in menubar
  updateTickets = function()
  {
    $.post('/ticketsLeft')
    .done(function(left)
    {
      // If no tickets are left, reload, this will automatically become a different page
      if (left[0] <= 0 && left[1] <= 0)
        location.reload()
      // If no tickets of either type are left, disable this button
      else if (left[0] <= 0)
      {
        $('#nonDiningToggle').addClass('disabled')
        $('#diningToggle').click()
      }
      else if (left[1] <= 0)
      {
        $('#diningToggle').addClass('disabled')
        $('#nonDiningToggle').click()
      }
      // In every case, update the menubar 
      $('#nonDiningLeft').html('&nbsp;'+left[0])
      $('#diningLeft').html('&nbsp;'+left[1])
      // And load again in 10s
      setTimeout(updateTickets,10000)
    })
    .fail(function(err){
      // On fail, retry in 30s
      setTimeout(updateTickets,30000)
    })
  }
  // Start querying
  updateTickets()
})