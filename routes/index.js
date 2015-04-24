var express = require('express');
var router = express.Router();
var app = require('../app');

var fs = require('fs');
//posts, languages

/*check if the requested resource may be accessed*/
function checkApiAccess(req, res, next){
    next();
}

function addRoutes(){
    fs.readdirSync('./controllers').forEach(function (file) {
      if(file !== 'Controller.js' && file.substr(-3) === '.js') {
          var Controller = require('../controllers/' + file),
              controller = new Controller();
        
        controller.addRestRoutes(router);

        if (typeof controller.addCustomRoutes === 'function') {
            controller.addCustomRoutes(router);
        }
      }
    });
}

router.all('*', checkApiAccess);
addRoutes();

module.exports = router;
