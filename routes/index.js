var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res) {
  res.render('index', { title: 'Express' });
});

router.get('/subscribe', function(req,res) {
    console.log(req.query)
    res.send('ok')
})

module.exports = router;
