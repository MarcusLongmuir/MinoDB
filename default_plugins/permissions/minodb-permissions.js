var logger = require('tracer').console();
var express = require('express');
var ConfigServer = require('./config_server/ConfigServer');

function MinoDBPermissions(options) {
	var plugin = this;

    plugin.path = options.path;
    if (!plugin.path) {
        throw "Plugin requires path to be specified in options"
    }

    plugin.username = options.username;
    if (!plugin.username) {
        throw "Plugin requires username to be specified in options"
    }

    plugin.name = options.name || "minodb-permissions"
    plugin.display_name = options.display_name || plugin.name;

    plugin.permission_path = plugin.path + "permissions/";
    plugin.group_path = plugin.path + "groups/";

    plugin.config_server = new ConfigServer();
}

MinoDBPermissions.prototype.get_config_server = function(){
    var plugin = this;
    return plugin.config_server.express_server;
}

MinoDBPermissions.prototype.info = function(){
    var plugin = this;

    return {
        name: plugin.name,
        display_name: plugin.display_name
    };
}

MinoDBPermissions.prototype.init = function(minodb, callback){
    var plugin = this;
    plugin.minodb = minodb;

    var waiting_for = 2;
    var finished_one = function() {
        waiting_for--;
        if (waiting_for == 0) {
            callback();
        }
    }

    plugin.create_folders(finished_one);
    plugin.create_types(finished_one);
}

MinoDBPermissions.prototype.create_folders = function(callback) {
    var plugin = this;

    plugin.minodb.save([{
        name: 'permissions',
        path: plugin.path,
        folder: true
    },{
        name: 'groups',
        path: plugin.path,
        folder: true
    }], function(err, res) {
        logger.log(err,res);
        callback(err,res);
    });
}

MinoDBPermissions.prototype.create_types = function(callback) {
    var plugin = this;

    plugin.minodb.save_type({
        "name": "minodb_group_permission",
        "display_name": "MinoDB Group Permission",
        "type": "object",
        "any": false,
        "fields": [
            {
                "name": "group",
                "display_name": "Group",
                "type": "text"
            },
            {
                "name": "permission",
                "display_name": "Permission",
                "type": "text"
            }
        ]
    }, function(err, res) {
        logger.log(err, res);

        if (err) {
            callback(err);
            return;
        }

        plugin.minodb.save_type({
            "name": "minodb_identifier_permission",
            "display_name": "MinoDB Identifier Permission",
            "type": "object",
            "any": false,
            "fields": [
                {
                    "name": "identifier",
                    "display_name": "Identifier",
                    "type": "text"
                },
                {
                    "name": "permission",
                    "display_name": "Permission",
                    "type": "text"
                }
            ]
        }, function(err, res) {
            logger.log(err, res);

            if (err) {
                callback(err);
                return;
            }

            plugin.minodb.save_type({
                "name": "minodb_identifier_group",
                "display_name": "MinoDB Identifier Group",
                "type": "object",
                "any": false,
                "fields": [
                    {
                        "name": "identifier",
                        "display_name": "Identifier",
                        "type": "text"
                    },
                    {
                        "name": "group",
                        "display_name": "Group",
                        "type": "text"
                    }
                ]
            }, function(err, res) {
                logger.log(err, res);

                if (err) {
                    callback(err);
                    return;
                }

                callback();
            });

        })

    })
}


MinoDBPermissions.prototype.assign_permission_to_id = function(permission, id, callback) {
    var plugin = this;

    var escaped_id = plugin.encode_text(id);
    var escaped_permission = plugin.encode_text(permission);

    plugin.minodb.save([{
        name: escaped_permission,
        path: plugin.permission_path,
        folder: true
    }], function(err, res) {
        logger.log(err, res);

        plugin.minodb.save([{
            name: "id:"+escaped_id,
            path: plugin.permission_path + escaped_permission + '/',
            minodb_identifier_permission: {
                permission: permission,
                identifier: id
            }
        }], function(err, res) {
            logger.log(err,res);
            if (err) {
                callback(err);
            } else {
                callback(null, res.objects[0]);
            }
        })
    });
}

MinoDBPermissions.prototype.remove_permission_from_id = function(permission, id, callback) {
    var plugin = this;

    var escaped_id = plugin.encode_text(id);
    var escaped_permission = plugin.encode_text(permission);
    var path = plugin.permission_path + escaped_permission + '/id:'+escaped_id;

    plugin.minodb.delete([path], function(err, res) {
        if (err) {
            callback(err);
        } else {
            callback(null, res.objects[0])
        }
    });
}

MinoDBPermissions.prototype.has_permission = function(permission, id, callback) {
    var plugin = this;

    plugin.has_permissions([permission], id, function(err, has_permissions) {
        logger.log(err, has_permissions);
        if (err) {
            callback(err);
        } else {
            callback(null, has_permissions[0]);
        }
    });
}

MinoDBPermissions.prototype.has_permissions = function(permissions, id, callback) {
    var plugin = this;

    var permission_results = {}
    for (var i=0; i<permissions.length; i++) {
        var permission = permissions[i];
        permission_results[permission] = false;
    }

    var check_individual_permissions = function(callback) {
        plugin.minodb.call({
            "function": "search",
            "parameters": {
                "paths": [plugin.permission_path],
                "query": {
                    "minodb_identifier_permission.identifier": id,
                    "minodb_identifier_permission.permission": {
                        "$in": permissions
                    }
                },
                "include_subfolders": true
            }
        }, function(err, res) {
            logger.log(err, res);
            if (res.objects) {
                for (var i=0; i<res.objects.length; i++) {
                    var permission = res.objects[i].minodb_identifier_permission.permission;
                    permission_results[permission] = true;
                }
            }
            callback();
        });
    }

    var check_group_permissions = function(callback) {
        plugin.minodb.call({
            "function": "search",
            "parameters": {
                "paths": [plugin.permission_path],
                "query": {
                    "minodb_group_permission.permission": {
                        "$in" : permissions
                    }
                },
                "include_subfolders": true
            }
        }, function(err, res) {

            if (err || !res.objects) {
                callback();
                return;
            }

            var groups = [];
            var group_permissions = {}
            for (var i=0; i< res.objects.length; i++) {
                var group = res.objects[i].minodb_group_permission.group;
                groups.push(group);
                if (!group_permissions[group]) {
                    group_permissions[group] = []
                }
                group_permissions[group].push(res.objects[i].minodb_group_permission.permission);
            }
            logger.log(groups);

            plugin.minodb.call({
                "function": "search",
                "parameters": {
                    "paths": [plugin.group_path],
                    "query": {
                        "minodb_identifier_group.identifier": id,
                        "minodb_identifier_group.group": {
                            "$in": groups
                        }
                    },
                    "include_subfolders": true
                }
            }, function(err, res) {
                logger.log(res);
                if (err || !res.objects) {
                    callback();
                    return;
                }

                for (var i=0; i<res.objects.length; i++) {
                    var group = res.objects[i].minodb_identifier_group.group;
                    for (var j=0; j<group_permissions[group].length; j++) {
                        var permission  = group_permissions[group][j];
                        if (permission_results[permission] === false) {
                            permission_results[permission] = true;
                        }
                    }
                }

                callback();
            });

        });
    }

    check_individual_permissions(function() {
        check_group_permissions(function() {
            var result = []
            for (var i=0; i<permissions.length; i++) {
                var permission = permissions[i];
                result.push(permission_results[permission]);
            }
            callback(null, result);
        })
    })
}

MinoDBPermissions.prototype.assign_group_to_id = function(group, id, callback) {
    var plugin = this;

    var escaped_id = plugin.encode_text(id);
    var escaped_group = plugin.encode_text(group);

    plugin.minodb.save([{
        name: escaped_group,
        path: plugin.group_path,
        folder: true
    }], function(err, res) {
        logger.log(err, res);

        plugin.minodb.save([{
            name: "id:"+escaped_id,
            path: plugin.group_path + escaped_group + '/',
            minodb_identifier_group: {
                group: group,
                identifier: id
            }
        }], function(err, res) {
            logger.log(err,res);
            if (err) {
                callback(err);
            } else {
                callback(null, res.objects[0]);
            }
        })
    });
}

MinoDBPermissions.prototype.remove_group_from_id = function(group, id, callback) {
    var plugin = this;

    var escaped_id = plugin.encode_text(id);
    var escaped_group = plugin.encode_text(group);
    var path = plugin.group_path + escaped_group + '/id:'+escaped_id;

    plugin.minodb.delete([path], function(err, res) {
        if (err) {
            callback(err);
        } else {
            callback(null, res.objects[0])
        }
    });
}

MinoDBPermissions.prototype.assign_permission_to_group = function(permission, group, callback) {
    var plugin = this;

    var escaped_group = plugin.encode_text(group);
    var escaped_permission = plugin.encode_text(permission);

    plugin.minodb.save([{
        name: escaped_permission,
        path: plugin.permission_path,
        folder: true
    }], function(err, res) {
        logger.log(err, res);

        plugin.minodb.save([{
            name: "group:"+escaped_group,
            path: plugin.permission_path + escaped_permission + '/',
            minodb_group_permission: {
                permission: permission,
                group: group
            }
        }], function(err, res) {
            logger.log(err,res);
            if (err) {
                callback(err);
            } else {
                callback(null, res.objects[0]);
            }
        })
    });
}

MinoDBPermissions.prototype.remove_permission_from_group = function(permission, group, callback) {
    var plugin = this;

    var escaped_permission = plugin.encode_text(permission);
    var escaped_group = plugin.encode_text(group);
    var path = plugin.permission_path + escaped_permission + '/group:'+escaped_group;

    plugin.minodb.delete([path], function(err, res) {
        if (err) {
            callback(err);
        } else {
            callback(null, res.objects[0])
        }
    });
}

MinoDBPermissions.prototype.encode_text = function(text) {
    return encodeURIComponent(text);
}

MinoDBPermissions.prototype.decode_text = function(text) {
    return decodeURIComponent(text);
}

module.exports = MinoDBPermissions;