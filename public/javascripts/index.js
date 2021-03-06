$(document).ready(function(){
  // Height of navbar for offsets
  var navbar = 50;
  
  // !Scrollspy
  $('body').scrollspy({target:'.navbar-collapse',offset:navbar+1})
  
  // !Vimeo API
  if ($('#vimeo').length) {
    var player = $f($('#vimeo')[0])
    var fired = true
    // When the player is ready, add listener for finish
    player.addEvent('ready', function() {
      // At 1:51 scroll down (only once though)
      player.addEvent('playProgress', function(progress){
        if (progress.seconds > 111 && progress.seconds < 113 && !fired) {
          fired = true
          $('html, body').stop().animate({'scrollTop':$('#entertainment').offset().top-navbar},1600)
        }
      })
      // Repositions player if use starts manually
      player.addEvent('play',function(){
          fired = false
          $('html, body').stop().animate({'scrollTop':$('#trailer').offset().top-navbar},300)
      })
    })
  }

  // Animates scrolling to element
  var scrollTo = function(elem){
    $('html, body').stop().animate({'scrollTop':elem.offset().top-navbar},600)
		if (player)
		  player.api('pause')
  }
  // !Animating menu
  $(".navbar-collapse ul li a[href^='#']").click(function(e){
    e.preventDefault()
    scrollTo($($(this).attr('href'))) 
  })
  $('#logo').click(function(){
    scrollTo($('html'))
  })
  
  // !Hiding mobile menu after click
  $(document).click('.navbar-collapse.in',function(e){
    if ($(e.target).is('a'))
      $(this).collapse('hide')
  })
  
  // !Enter button
  $('#enterBtn').click(function(){
    // If trailer exists, show and start
    if (player) {
      scrollTo($('#trailer'))
      player.api('play')
    }
    else
      scrollTo($('#entertainment'))
  })

  // !Email subscription
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
        $('#newsletterModal').modal('hide')
        $('#emailInput').val('')
        btn.button('reset')
      },1000)
    })
    .fail(function(){
      btn.html('Error, not subscribed')
      setTimeout(function(){btn.button('reset')},2000)
    })
  }) 
   
  // !News button tooltips
  $('#facebookBtn').parent().tooltip({title:'Facebook',placement:'top',container:'body'})
  $('#twitterBtn').parent().tooltip({title:'Twitter',placement:'top',container:'body'})
  $('#newsletterBtn').parent().tooltip({title:'Newsletter',placement:'bottom',container:'body'})
  $('#committeeBtn').parent().tooltip({title:'Email the commitee',placement:'bottom',container:'body'})
  
  // !Animates logo on non-touchscreens
  if(!('ontouchstart' in window)){
    var gap,pos,size

    // Repositions logo on scrolling
    var moveLogo = function(){
      var offset = window.pageYOffset
      var s = Math.round(size(offset)), p = Math.round(pos(offset)), g = Math.round(gap(offset))
      $('#logo').css('top',p)
      $('#logo').css('width',s)
      $('#logo').css('height',s)
      $('#logo').css('margin-left',-s/2)
      $('#navbarGap').css('width',g)
    }  
    $(window).scroll(moveLogo)

    // Computes gap, pos, size functions on resize
    var computeLogo = function(){ 
      // Give the logo 80% of the space between the navbar and the opening text
      var spaceForLogo = Math.min(window.innerHeight-navbar-$('#top .col-md-6').height(),window.innerWidth)
      var logoSize = Math.max(spaceForLogo*0.8,80)
      var logoY = (spaceForLogo-logoSize)*0.5+navbar
  
      size = function(offset){
        if (offset <= logoY) return logoSize
        else if (offset < logoY + logoSize - 80) return logoSize-(offset-logoY)
        else return 80
      }   
      pos = function(offset){
        if (offset <= logoY) return logoY-offset
        else return 0
      }
      gap = function(offset){
        var n = navbar - 10
        if (offset <= logoY - n) return 0
        else if (offset <= logoY) return -0.5*logoSize/n/n*(offset-logoY)*(offset-logoY) + 0.5*logoSize
        else if (offset <= logoY + logoSize - 80) return (0.5*logoSize-80)/(80-logoSize)*(offset-logoY)+0.5*logoSize
        else return 80
      }
      moveLogo()
    }
    $(window).resize(computeLogo)
    computeLogo()
    var resize = function(){
      $('#top,#trailer').css('height', (window.innerHeight-navbar)+'px')
    }
    resize()
    $(window).resize(resize)
  }
  // On touchscreens, move the text up to not make the screen look empty
  else {
    $('#top .col-md-6').css('top',(window.innerHeight-navbar-$('#top .col-md-6').height())/2)
    $('#top,#trailer').css('height', (window.innerHeight-navbar)+'px')
  }
})