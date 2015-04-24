var methods = {
    capitalizeFirstLetter : function(str){
        return str.charAt(0).toUpperCase() + str.slice(1);
    },
    lowercaseFirstLetter : function(str){
        return str.charAt(0).toLowerCase() + str.slice(1);    
    }
};

module.exports = methods;