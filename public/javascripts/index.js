var navbar = 50
$(document).ready(function(){
  //Init scrollspy
  $('body').scrollspy({target:'.navbar-collapse',offset:navbar})


  function adjustToScreenSize()
  {
    // First section = height of viewport
    $('#top').css('height', (window.innerHeight-navbar)+'px')

    // Minimize letterboxing for trailer (in both directions)
    $('#trailer').css('height', Math.min(window.innerWidth*9/16, window.innerHeight-navbar))

    // Give the logo 80% of the space between the navbar and the opening text
    var spaceForLogo = Math.min(window.innerHeight-navbar-$('#top .col-md-6').height(),window.innerWidth)
    var logoSize = spaceForLogo*0.8
    var logoY = spaceForLogo*0.5+50-logoSize/2

    // Function to position the logo (centers automatically)
    var positionLogo = function(top,size)
    {
      $('#logo').css('top',top)
      $('#logo').css('width',size)
      $('#logo').css('height',size)
      $('#logo').css('margin-left',-size/2)
      $('#navbarGap').css('width',80-top*80/logoY)
    }

    var m = (logoSize-80)/(logoY-420)
    var n = 80-m*420

    var updateLogo = function()
    {
      var off = window.pageYOffset
      // If logo isn't yet touching the top, just move it along
      if (off <= logoY)
        positionLogo(logoY-off,logoSize)
      // If it is touching the top, linearly decrease its size
      else if (off <= 420)
        positionLogo(0,m*off+n)
      // Until it is size 80 after scrolling down 420 pixels
      else
        positionLogo(0,80)
    }

    // Resizes on scrolling
    $(window).scroll(updateLogo)
    updateLogo()
  }

  // Vimeo player api
  var player = $f($('#vimeo')[0])

  // When the player is ready, add listener for finish
  player.addEvent('ready', function() {
    player.addEvent('pause',function(){})
    player.addEvent('playProgress',function(){})
    player.addEvent('finish', function(){
      $('#entertainment').animatescroll({padding:navbar})       
    })
  })

  // Enter button scrolls down to trailer or entertainment if there is no trailer
  $('#enter').click(function(){
    if ($('#trailer').length)
    {
      $('#trailer').animatescroll({padding:navbar})
      player.api('play')
    }
    else
      $('#entertainment').animatescroll({padding:navbar})
  })

  // Using animatescroll for the navigation links
  $("#navbar-collapse-1 ul li a[href^='#']").click(function(e)
  {
    e.preventDefault()
    $(this.hash).animatescroll({padding:navbar-5})
    player.api('pause')
  })

  // Logo is an anchor to return to the very top
  $('#logo').click(function(){
    $('body').animatescroll({padding:navbar})
    player.api('pause')
  })

  $(window).resize(adjustToScreenSize)
  adjustToScreenSize()
})

validateEmail = function()
{
  var inp = $('#emailInput')

  $('#emailFeedback').removeClass('has-error') 
  $('.form-control-feedback').addClass('hidden')
  if(/^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-.]+\.ox\.ac\.uk$/.test(inp.val()))
    return true
  $('#emailFeedback').addClass('has-error')
  $('.glyphicon-remove').removeClass('hidden')
  inp.focus()
  return false
}
subscribeEmail = function()
{
  if (validateEmail())
  {
    var btn = $(this)
    btn.button('loading')
    $.ajax({
      url: '/subscribe',
      data: { 
        email: $('#emailInput').val()
      }
    })
    .done(function(){
      btn.html('Success!')
      setTimeout(function(){
        $('#emailModal').modal('hide')
        $('#emailInput').val('')
        btn.button('reset')
      },1000)
    })
    .fail(function(){
      alert("An error occured. Please try again")
    })
  }
}
