var Validator = require('fieldval');
var bval = require('fieldval-basicval');
var logger = require('tracer').console();

var DataStore = require('./datastore');

var GetHandler = require('./handlers/GetHandler/GetHandler.js');
var SaveHandler = require('./handlers/SaveHandler/SaveHandler.js');
var SaveRuleHandler = require('./handlers/SaveRuleHandler/SaveRuleHandler.js');

function API(minodb, db_address){
	var api = this;

	api.minodb = minodb;

    api.ds = new DataStore({
        address: db_address
    })

    api.connect(function(){
        logger.log("API CONNECTED");
    })
}

API.prototype.connect = function(callback){
    var api = this;

    api.ds.connect(function(err){
        if(err) throw err;

        callback();
    })
}

API.prototype.call = function(user, request, callback){
	var api = this;

    var api_val = new FieldVal(request);

    var function_name = api_val.get("function", bval.string(true), bval.one_of(["get","save","save_rule"]));
    var parameters = api_val.get("parameters", bval.object(true));

    var handler = null;
    if (function_name === "get") {
        handler = GetHandler;
    } else if (function_name === "save") {
        handler = SaveHandler;
    } else if (function_name === "save_rule") {
        handler = SaveRuleHandler;
    }

    var error = api_val.end();
    if(error){
        callback(error);
        return;
    }

    if (handler != null) {
        logger.log(parameters);
        new handler(api, user, parameters, function(error, response) {
            logger.log(error);
            logger.log(response);
            if (error != null) {
                return callback(api_val.invalid("parameters", error).end());
            } else {
                callback(null, response);
            }
        })
    }
}

module.exports = API;