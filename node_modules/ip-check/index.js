'use strict'
var http = require('http')
var host = 'jsonip.org'

var check = module.exports = function(cb){
    var req = http.request({host: host})
    req.end()
    req.on('error', cb)
    req.on('response', function(res){
        res.setEncoding('utf8')
        var data = ''
        res.on('data', function(d){
            data += d
        })
        res.on('end', function(){
            var json = JSON.parse(data)
            cb(null, json.ip)
        })
    })
}

if(require.main == module){
    check(function(err, ip){
        if(err) throw err
        console.log(ip)
    })
}
