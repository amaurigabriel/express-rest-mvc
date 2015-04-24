var db_config = require('../../config').database;
var mysql = require('mysql2');
var Promise = require('bluebird');

exports.pool = mysql.createPool(db_config.default);
exports.poolAsync =  Promise.promisifyAll(exports.pool);