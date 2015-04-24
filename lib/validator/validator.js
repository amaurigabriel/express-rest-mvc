var validator = require('validation-engine'),
    app = require('../../app'),
    db_pool = app.get('dbPoolAsync'),
    Promise = require('bluebird');

validator.addValidator('unique', function validatorExists(rule, field_name, data){
    return new Promise(function(resolve, reject){
      if (typeof data[field_name] === 'undefined') resolve();

      db_pool.getConnectionAsync()
        .then(function(conn){
          var Model = require('../../model/' + rule.model);
            model = new Model(conn);

          var conditions = [
              [field_name + ' = ?', data[field_name]]
          ];

          if (typeof data[validator.primary] !== 'undefined'){
            conditions.push([validator.primary + ' != ?', data[validator.primary]]);
          }

          model.find({
            conditions : conditions 
          })
          .then(function(result){
            conn.release();
            if (result.length === 0){
              return resolve();
            }

            var message = '';

            if (typeof rule.message === 'undefined'){
              message = require('util').format('Already exists a %s with %s = %s.', rule.model, field_name, data[field_name]);
            }
            else{
              message = rule.message;
            }

            reject(new validator.ValidatorException(message, field_name, rule, data));
          })
          .catch(function(err){
              conn.release();
              reject(err);
          });
        })
        .catch(reject);
    });
});

module.exports = validator;
