var express = require('express');
var router = express.Router();
var constants = require('../constants')
var mysql = require('mysql')

/* GET home page. */
router.get('/', function(req, res) {
  res.render('index');
});

router.get('/subscribe', function(req,res) {
    var connection = mysql.createConnection(constants.credentials)
    connection.connect();
    connection.query('INSERT INTO mailingList (email,type) VALUES (?,?)', [req.query['email'],req.query['type']],function(err, rows, fields) {
      if (err) res.send('err')
      else res.send('ok')
      connection.end();
    });
})

router.get('/healthy', function(req,res) {
    res.send('ok')
})

module.exports = router;
