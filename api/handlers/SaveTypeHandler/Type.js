var logger = require('tracer').console();
var FieldVal = require('fieldval');
var bval = require('fieldval-basicval');
var ValidationRule = require('fieldval-rules');

function Type(item) {
    var type = this;

    type.item = item;

    type.name = item.name;
}

Type.prototype.init = function(type_data){
    var type = this;

    type.item.type = type_data;
}

Type.validate = function(data, creation){
    var validator = new FieldVal(data);

    var rule = new ValidationRule();
    var type_error = rule.init(data);

    return type_error;
}

Type.prototype.create_save_data = function(callback){
    var type = this;

    var to_save = JSON.parse(JSON.stringify(type.data));
    callback(null, to_save);
}

Type.prototype.save = function(api, callback){
    var type = this;

    type.item.path = "/Mino/types/";

    new api.handlers.save(api, {
        "typename": "Mino"
    }, {
        "objects": [
            type.item
        ]
    }, function(save_err, save_res){
        logger.log(JSON.stringify(save_err,null,4), save_res);

        callback(null, save_res);
    })
}

Type.get = function(typename, api, callback){
    new api.handlers.get(api, {
        "typename": "Mino"
    }, {
        "addresses": [
            "/Mino/types/"+typename
        ]
    }, function(get_err, get_res){
        logger.log(get_err, get_res);

        if(get_err){
            throw new Error("Unexpected API error");
        }

        var type_item = get_res.objects[0];
        if(type_item){
            callback(null, new Type(type_item));
        } else {
            callback(null, null);
        }
    })
}

Type.create = function(data, api, callback){
    
    var error = Type.validate(data, true);
    if(error){
        callback(error,null);
        return;
    }

    var type = new Type(data);
    type.save(api, callback);
}

module.exports = Type;