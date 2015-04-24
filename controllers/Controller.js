var app = require('../app'),
    poolAsync = app.get('dbPoolAsync');


function Controller(){}

/**
 * add routes like:
 *     GET    /blog/1           action: findById
 *     POST   /blogs/searches   action: search
 *     POST   /blogs            action: create
 *     PUT    /blog/1           action: edit
 *     DELETE /blog/1           action: delete
 */
Controller.prototype.addRestRoutes = function ControllerAddRestRoutes(router) {    
    var lowercaseFirstLetter = require('../lib/string').lowercaseFirstLetter,
        lowercased_model_name = lowercaseFirstLetter(this.model_name),
        pluralize = require('pluralize').plural;

    router.get('/' + lowercased_model_name + '/:id', this.getById());
    router.post('/' + pluralize(lowercased_model_name) + '/searches', this.search());
    router.post('/' + pluralize(lowercased_model_name) + '/', this.create());
    router.put('/' + lowercased_model_name + '/:id', this.edit());
    router.delete('/' + lowercased_model_name + '/:id', this.delete());
};

//put the condition in the format accepted by the models
Controller.prototype.parseConditions = function(req){
    var conditions = req.body.conditions;
    req.body.conditions = [];

    for (var field in conditions){
        req.body.conditions.push([field + ' = ?', conditions[field]]);
    }
};

Controller.prototype.search = function ControllerSearch (){
    var self = this;

    return function(req, res, next){
            if (typeof self.model_name === 'undefined'){
                return next();
            }

            self.parseConditions(req);

            var conn;
            app.get('dbPoolAsync').getConnectionAsync()
                .then(function(_conn){
                    conn = _conn;
                    var Model = require('../model/' + self.model_name),
                    model = new Model(conn);

                    return model.find({
                        limit : req.body.limit,
                        order : req.body.order,
                        conditions : req.body.conditions
                    });
                })            
                .then(function(results){
                    res.send({success : true, data : results});
                })
                .catch(function(err){
                    if (typeof conn !== 'undefined'){
                      conn.release();
                    }

                    app.get('logger').error(err.message + err.stack);

                    res.status(500).send({success : false, error : 'Internal Server Error'});
                });
    };
};

Controller.prototype.getById = function ControllerGetById (){
    var self = this;

    return function(req, res, next){
        if (typeof self.model_name === 'undefined'){
            return next();
        }

        var conn;
        app.get('dbPoolAsync')
            .getConnectionAsync()
            .then(function(_conn){
                conn = _conn;

                var Model = require('../model/' + self.model_name),
                    model = new Model(conn);

                return model.findById(req.params.id);
            })    
            .then(function(result){
                conn.release();
                conn = undefined;
                res.send({success : true, data : result});
            })
            .catch(function(error){
                if (typeof conn !== 'undefined') conn.release();

                app.get('logger').error(error.stack);
                res.status(500).send({success : false, error : 'Internal server error.'});
            });         
    };          
};

Controller.prototype.delete = function ControllerDelete(){
    var self = this;

    return function(req, res, next){
        if (typeof self.model_name === 'undefined'){
            return next();
        }

        var conn;
        poolAsync.getConnectionAsync()
            .then(function(_conn){
                conn = _conn;

                var Model = require('../model/' + self.model_name),
                    model = new Model(conn);

                return model.delete({
                    conditions : [
                        [' id = ? ', req.params.id]
                    ]
                });
            })
            .then(function(){
                conn.release();
                conn = undefined;

                res.send({success : true});
            })
            .catch(function(error){
                if (typeof conn !== 'undefined') conn.release();

                app.get('logger').error(error.message + error.stack);
                res.status(500).send({success : false, error : 'Internal server error.'});
            });
    };     
};

Controller.prototype.create =  function ControllerCreate(){
    var self = this;

    return function(req, res, next){
        if (typeof self.model_name === 'undefined'){
            return next();
        }

        var conn;
        poolAsync.getConnectionAsync()
            .then(function(_conn){
                conn = _conn;

                var Model = require('../model/' + self.model_name),
                    model = new Model(conn);

                return model.save(req.body);
            })
            .then(function(){
                conn.release();
                conn = undefined;

                res.send({success : true});
            })
            .catch(function(err){
                if (typeof conn !== 'undefined') conn.release();

                app.get('logger').error(err + err.stack);
                res.status(500).send({success : false, error : 'Internal server error.'});
            });
    };
};

Controller.prototype.edit = function ControllerEdit(){
    var self = this;

    return function (req, res, next) {
        if (typeof self.model_name === 'undefined'){
            return next();
        }

        poolAsync.getConnectionAsync()
            .then(function(conn){
                var Model = require('../model/' + self.model_name),
                    model = new Model(conn);

                req.body.id = req.params.id;
                return model.save(req.body);
            })
            .then(function(){
                res.send({success : true});
            })
            .catch(function(err){
                app.get('logger').error(err.message + err.stack);
                res.status(500).send({success : false, error : 'Internal server error.'});
            });    
    };
};

module.exports = Controller;