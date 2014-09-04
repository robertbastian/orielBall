$(document).ready(function(){
  // Height of navbar for offsets
  var navbar = 50

  //Init scrollspy
  $('body').scrollspy({target:'.navbar-collapse',offset:navbar})
  
  // Initalizes Vimeo API if trailer exists
  if ($('#vimeo').length) {
    var player = $f($('#vimeo')[0])
    // When the player is ready, add listener for finish
    player.addEvent('ready', function() {
      var fired = false
      player.addEvent('playProgress', function(progress){
        if (progress.seconds > 111 && !fired) {
          fired = true
          $('html, body').stop().animate({'scrollTop':$('#entertainment').offset().top-navbar+5},1600,'swing',function(){
            fired = false})
        }
      })
    })
  }

  // Animates scrolling to element
  var scrollTo = function(elem){
    $('html, body').stop().animate({'scrollTop':elem.offset().top-navbar+5},600)
		if (player)
		  player.api('pause')
  }
  // Animating menu
  $(".navbar-collapse ul li a[href^='#']").click(function(e){
    e.preventDefault()
    scrollTo($($(this).attr('href')))
  })  
  $('#logo').click(function(){
    scrollTo($('html'))
  })
  
  // Enter button scrolls down and starts trailer if it exists
  $('#enterBtn').click(function(){
    if ($('#vimeo').length) {
      scrollTo($('#trailer'))
      player.api('play')
    }
    else
      scrollTo($('#entertainment'))
  })

  // Various buttons
  $('#joinNewsletterBtn').click(function(){
    var email = $('#emailInput').val()
    $('#emailFeedback').removeClass('has-error') 
    if(!/^[a-zA-Z0-9_.-]+@[a-zA-Z0-9-]+.[a-zA-Z0-9-.]+$/.test(email)){
      $('#emailFeedback').addClass('has-error')
      $('#emailInput').focus()
      return false
    }
    var btn = $(this)
    btn.button('loading')
    $.post('/subscribeEmail',{email:email})
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
  }) 
  adjustPushBtn = function(){
    if ('safari' in window && 'pushNotification' in window.safari) {
      if(window.safari.pushNotification.permission('web.uk.orielball').permission === 'default') {
        $('#pushBtn').removeClass('disabled')
        $('#pushBtn').parent().tooltip({title:'Push notifications',placement:'bottom',container:'body'})
      }
      else
        $('#pushBtn').parent().tooltip({title:"Adjust in Safari settings",placement:'bottom',container:'body'}) 
    }
    else 
      $('#pushBtn').parent().tooltip({title:"Push notifications require Safari",placement:'bottom',container:'body'}) 
  }
  $('#pushBtn').click(function(){
    if ('safari' in window)
      window.safari.pushNotification.requestPermission('https://www.orielball.uk','web.uk.orielball',{},adjustPushBtn)
    return false
  })
  $('#ticketBtn').click(function(){
    $('html,body').stop().animate({opacity:0},500,'swing',function(){
      window.location = '/tickets'
    })
    return false
  })
  
  $('#facebookBtn').parent().tooltip({title:'Facebook',placement:'top',container:'body'})
  $('#twitterBtn').parent().tooltip({title:'Twitter',placement:'top',container:'body'})
  $('#newsletterBtn').parent().tooltip({title:'Newsletter',placement:'bottom',container:'body'})
  adjustPushBtn()
  
  var windowResize = function(){ 
    // First section = height of viewport
    $('#top').css('height', (window.innerHeight-navbar)+'px')
  
    // Minimize letterboxing for trailer (in both directions)
    $('#trailer').css('height', Math.min(window.innerWidth*9/16, window.innerHeight-navbar))
   
    // Only animate logo on non-touch devices
    if(!('ontouchstart' in window))
    {
      // Give the logo 80% of the space between the navbar and the opening text
      var spaceForLogo = Math.min(window.innerHeight-navbar-$('#top .col-md-6').height(),window.innerWidth)
      var logoSize = Math.max(spaceForLogo*0.8,80)
      var logoY = (spaceForLogo-logoSize)*0.5+navbar
  
      // Mathematical functions computing logo diameter, spacing and menu gap from scroll position
      var size = function(offset){
        if (offset <= logoY) return logoSize
        else if (offset < logoY + logoSize - 80) return logoSize-(offset-logoY)
        else return 80
      }   
      var pos = function(offset){
        if (offset <= logoY) return logoY-offset
        else return 0
      }
      var gap = function(offset){
        var n = navbar - 10
        if (offset <= logoY - n) return 0
        else if (offset <= logoY) return -0.5*logoSize/n/n*(offset-logoY)*(offset-logoY) + 0.5*logoSize
        else if (offset <= logoY + logoSize - 80) return (0.5*logoSize-80)/(80-logoSize)*(offset-logoY)+0.5*logoSize
        else return 80
      }
  
      // Resizes on scrolling
      var windowScroll = function(){
        var offset = window.pageYOffset
        var s = Math.round(size(offset)), p = Math.round(pos(offset)), g = Math.round(gap(offset))
        $('#logo').css('top',p)
        $('#logo').css('width',s)
        $('#logo').css('height',s)
        $('#logo').css('margin-left',-s/2)
        $('#navbarGap').css('width',g)
      }      
      $(window).scroll(windowScroll)
      windowScroll()
    }
    // On touchscreens, move the text up to not make the screen look empty
    else 
      $('#top .col-md-6').css('bottom','25%')
  }
  $(window).resize(windowResize)
  windowResize()
})