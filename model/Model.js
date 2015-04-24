var Promise = require('Bluebird'),
    app = require('../app'),
    util = require('util'),
    _squel = require('squel'),
    validator = require('../lib/validator/validator.js');

_squel.registerValueHandler(Date, function(date){
  return date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate() + ' ' + date.getHours() + ':' + date.getMinutes() + ':' + date.getSeconds();
});

function Model(){}

//primary key for the model's database column
Model.prototype.primary = 'id';

//add validation rules to validator object
Model.prototype.addValidationRules = function ModelAddValidationRules(){
  validator.rules = this.validationRules;
};

//parse the options object, and add them to the squel object
Model.prototype.parseQuery = function ModelParseQuery(squel, options){
    if (typeof options.limit !== 'undefined'){
      squel = squel.limit(options.limit);
    }

    if (typeof options.offset !== 'undefined'){
      squel = squel.offset(options.offset);
    }

    if (typeof options.order !== 'undefined'){
      squel = squel.order.apply(squel, options.order);
    }

    if (typeof options.group !== 'undefined'){
      squel = squel.group(options.group);
    }

    for (var field in options.fields){
      var field = options.fields[field];

      if (typeof field === 'string'){
        squel = squel.field(field);
      }
      else{
        squel = squel.field(field.name, field.alias);
      }
    }
    for (var condition in options.conditions){
      squel = squel.where.apply(squel, options.conditions[condition]);
    }

    return squel;
};

//text and values are returned from squel.toParam method
Model.prototype.executeQuery = function ModelExecuteQuery(text, values){
  var self = this;

  return new Promise(function(resolve, reject){
      self.db.query(text, values, function(err, data){
          if (err){
              reject(err);
          }

          resolve(data);
      });
  });
};

Model.prototype.validate = function(data){
  return validator.validate(data);
};

/**
 * create or update data in the database. If data[self.primary] is present,
 * the query will be UPDATE. No verification is done to check if there is 
 * a record in the database with self.primary = data[self.primary]
 */
Model.prototype.save = function ModelSave(data){
  var self = this;
  return new Promise(function(resolve, reject){
      self.validate(data)
          .then(function(){
            var squel = _squel;

            if (typeof data[self.primary] === 'undefined'){
              squel = require('squel')
                .insert()
                .into(self.table);

                if (typeof self.created !== 'undefined' && typeof data[self.created] === 'undefined'){
                  squel = squel.set(self.created, new Date());
                }
            }
            else{
              squel = require('squel')
                .update()
                .table(self.table);
            }

            for (var field_name in data){
                squel = squel.set(field_name, data[field_name]);
            }

            if (typeof data[self.primary] !== 'undefined'){
              squel = squel.where(self.primary + ' = ?', data[self.primary]);
            }
            
            var params = squel.toParam();
            return self.executeQuery(params.text, params.values);
          })
          .then(resolve)
          .catch(reject);
  });
};

//put the hasManyResults array at the correct position on the results array
Model.prototype.afterFindHasMany = function ModelAfterFindHasMany(i, j, results){
  var self = this;

  return function(hasManyResults){            
    return new Promise(function(resolve){
      results[j][self.hasMany[i].model] = [];

      var count_has_many_results = hasManyResults.length;
      for (var k = 0; k < count_has_many_results; k++) {
        results[j][self.hasMany[i].model].push(hasManyResults[k]);
      }

      resolve();
    });     
  };
};

//put the hasOneResult data at the correct position on the results array
Model.prototype.afterFindHasOne = function ModelAfterFindHasMany(i, j, results){
  var self = this;

  return function(hasOneResult){            
    return new Promise(function(resolve){
      results[j][self.hasOne[i].model] = hasOneResult[0];
      resolve(results);
    });     
  };
};

//get data for the model associations, and put it to the results array
Model.prototype.findAssociations = function ModelFindAssociations(results, current_recursive){
  var self = this;

  var count_has_many = 0,
      count_has_one = 0,
      count_results = results.length;

  if (typeof self.hasMany !== 'undefined') count_has_many = self.hasMany.length;
  if (typeof self.hasOne !== 'undefined') count_has_one = self.hasOne.length;

  var promises = [];
 
  for (var i = 0; i < count_has_one; i++){
      var Model = require('./' + self.hasOne[i].model),
          model = new Model(self.db);

      for (var j = 0; j < count_results; j++){
        var find_data = {
          recursive : current_recursive - 1,
          conditions : [
            [self.hasOne[i].foreignKey + ' = ?', results[j][self.hasOne[i].selfKey]]
          ],
          limit : 1
        };

        var promise = model.find(find_data).then(self.afterFindHasOne(i, j, results));
        promises.push(promise);
      }
  }

  for (var i = 0; i < count_has_many; i++){
      var Model = require('./' + self.hasMany[i].model),
          model = new Model(self.db);

      for (var j = 0; j < count_results; j++){
        var find_data = {
          recursive : current_recursive - 1,
          conditions : [
            [self.hasMany[i].foreignKey + ' = ?', results[j][self.hasMany[i].selfKey]]
          ]
        };

        var promise = model.find(find_data).then(self.afterFindHasMany(i, j, results));
        promises.push(promise);
      }
  }

  return new Promise(function(resolve, reject){
    Promise.all(promises).then(function(){
      resolve(results);
    })
    .catch(reject);
  });
};

/**
 * get data from the database. valid options keys are:
 *   - conditions : an array which each element is a string or a two-element array. Read squel documentation for more details
 *   - limit : maximum of records to retrieve
 *   - offset : number of records to skip
 *   - order : array with order options to be passed directy to the squel object. The first option is the field name. The second is a boolean
 *             that is TRUE or undefined to ASC and false to DESC
 *   - group : group SQL clause
 *   - recursive : how deep to query the database to get associations data
 */
Model.prototype.find = function ModelFind(options){
    var self = this;
    squel = require('squel')  
        .select()
        .from(this.table);

    squel = this.parseQuery(squel, options);

    var query = squel.toParam();

    return new Promise(function(resolve, reject){
      self.executeQuery(query.text, query.values)
        .then(function(results){
          if (typeof options.recursive === 'undefined'){
            options.recursive = 1;
          } 

          if (options.recursive <= 0){
            return resolve(results);
          }
                  
          return self.findAssociations(results, options.recursive).then(resolve).catch(reject);        
        });
    });    
};

//return a rejected Promise if no data is found with the id provided
Model.prototype.findById = function ModelFindById(id){
    var self = this;

    return new Promise(function(resolve, reject){
        self.find({
            conditions : [
                ['id = ?', id]
            ]
        })
        .then(function(result){
            if (result && result.length === 1){
                resolve(result[0]);
            }
            else if (result.length > 1){
                reject(new Error('Duplicated record with id ' + id + ' for table ' + self.table + '.'));
            }
            else{
                reject(new Error('Not found.'));
            }
        })
        .catch(reject);
    });
};

//remove data from the database. you may use conditions, limit and offset like the find method.
Model.prototype.delete = function ModelDelete(options){
   squel = require('squel')  
            .delete()
            .from(this.table);

    squel = this.parseQuery(squel, options);
    var query = squel.toParam();
    return this.executeQuery(query.text, query.values);
};

module.exports = Model;
