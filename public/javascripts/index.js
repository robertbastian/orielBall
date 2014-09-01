var navbar = 50
$(document).ready(function(){
  //Init scrollspy
  $('body').scrollspy({target:'.navbar-collapse',offset:navbar})

  if ($('#vimeo').length)
  {
    // Vimeo player api
    var player = $f($('#vimeo')[0])

    // When the player is ready, add listener for finish
    player.addEvent('ready', function() {
      player.addEvent('finish', function(){
        $('#entertainment').animatescroll({padding:navbar})       
      })
    })
  }

  // Enter button scrolls down to trailer or entertainment if there is no trailer
  $('#enterBtn').click(function(){
    if ($('#vimeo').length)
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

  $('#emailBtn').click(subscribeEmail)

    if ('safari' in window && 'pushNotification' in window.safari)
    adjustButton()
  else
  {
    $('#pushBtn').addClass('disabled')
    $('#pushBtn').parent().tooltip({title: "Push notifications require Safari",placement:'bottom'})
  }

})

validateEmail = function()
{
  var inp = $('#emailInput')

  $('#emailFeedback').removeClass('has-error') 
  $('.form-control-feedback').addClass('hidden')
  if(/^[a-zA-Z0-9_.-]+@[a-zA-Z0-9-]+.[a-zA-Z0-9-.]+$/.test(inp.val()))
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
    $.post('/subscribeEmail',$('#emailInput').val())
    .done(function(){
      btn.html('Success!')
      setTimeout(function(){
        $('#emailModal').modal('hide')
        $('#emailInput').val('')
        btn.button('reset')
      },1000)
    })
    .fail(function(){
      btn.html('Error, not subscribed')
      setTimeout(function(){btn.button('reset')},2000)
    })
  }
}
subscribePush = function()
{
  window.safari.pushNotification.requestPermission(
    'https://www.orielball.uk',
    'web.uk.orielball',
    {},
    adjustButton
  )
}
adjustButton = function()
{
  var permission = window.safari.pushNotification.permission('web.uk.orielball').permission
  if (permission !== 'default') 
  {
    $('#pushBtn').addClass('disabled')
    $('#pushBtn').parent().tooltip({title: (permission === 'granted') ? "Already subscribed" : "Adjust your subscription in Safari settings",placement:'bottom'})
  }
}

function adjustToScreenSize()
  { 
    // First section = height of viewport
    $('#top').css('height', (window.innerHeight-navbar)+'px')

    // Minimize letterboxing for trailer (in both directions)
    $('#trailer').css('height', Math.min(window.innerWidth*9/16, window.innerHeight-navbar))
   
    if(!('ontouchstart' in window))
    {
      // Give the logo 80% of the space between the navbar and the opening text
      var spaceForLogo = Math.min(window.innerHeight-navbar-$('#top .col-md-6').height(),window.innerWidth)
      var logoSize = Math.max(spaceForLogo*0.8,80)
      var logoY = (spaceForLogo-logoSize)*0.5+navbar
  
      var size = function(offset){
        if (offset <= logoY) return logoSize
        else if (offset < logoY + logoSize - 80) return logoSize-(offset-logoY)
        else return 80
      } 
  
      var pos = function(offset){
        if (offset <= logoY) return logoY-offset
        else return 0
      }
  
      /* gap() is this beautiful polynomial: http://www.wolframalpha.com/input/?i=x*a%5E2%2By*a+%3D+0.6*b%2C+x*%28a%2Bb-80%29%5E2%2By%28a%2Bb-80%29%3D80+solve+for+x%2Cy where logoY=a, logoSize=b, x=ga, y=gb
      var ga = (-3*logoY*logoSize+400*logoY-3*logoSize*logoSize+240*logoSize)/(5*logoY*(logoSize-80)*(logoY+logoSize-80))
      var gb = (3*logoY*logoY*logoSize-400*logoY*logoY+6*logoY*logoSize*logoSize-480*logoY*logoSize+3*logoSize*logoSize*logoSize-480*logoSize*logoSize+19200*logoSize)/(5*logoY*(logoSize-80)*(logoY+logoSize-80))
      
      var gap = function(offset){
        if (offset <= logoY + logoSize - 80) return ga*offset*offset + gb * offset
        else return 80
      }
      */
  
      var gap = function(offset){
        var n = navbar - 10
        if (offset <= logoY - n) return 0
        else if (offset <= logoY) return -0.5*logoSize/n/n*(offset-logoY)*(offset-logoY) + 0.5*logoSize
        else if (offset <= logoY + logoSize - 80) return (0.5*logoSize-80)/(80-logoSize)*(offset-logoY)+0.5*logoSize
        else return 80
      }
  
      var updateLogo = function()
      {
        var offset = window.pageYOffset
        var s = Math.round(size(offset)), p = Math.round(pos(offset)), g = Math.round(gap(offset))
        $('#logo').css('top',p)
        $('#logo').css('width',s)
        $('#logo').css('height',s)
        $('#logo').css('margin-left',-s/2)
        $('#navbarGap').css('width',g)
      }      
  
      // Resizes on scrolling
      $(window).scroll(updateLogo)
      updateLogo()
    }
    else 
      $('#top .col-md-6').css('bottom','15%')
  }