var express = require('express');
var logger = require('morgan');

var bodyParser = require('body-parser');
var config = require('./config');
var app = express();

app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.set('dbPool', require('./model/datasource/mysql').pool);
app.set('dbPoolAsync', require('./model/datasource/mysql').poolAsync);

app.set('logger', require('tracer').console({level : config.logger.level}));

module.exports = app;

var routes = require('./routes/index');
app.use('/', routes);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    res.status(404);    
    res.send({success : false, error : 'Not found'});
});

// error handler
app.use(function(err, req, res, next) {
    app.get('logger').error(err.message + err.stack);
    res.status(500).send({success : false, error : 'Internal Server Error'});
});