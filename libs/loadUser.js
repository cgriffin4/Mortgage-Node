module.exports = function (app) {
    var db = require('./db');
    
    return function (req, res, next) {
        if (process.env.node_env == 'production') {
            defaultUser = 'undefined';
        } else {
            defaultUser = {email:'chris.sgriffin@gmail.com',name:'Chris'};
        }
        
        if ( defaultUser != 'undefined' || (req.session && req.session.email) ) {
            var half = false;
            var email;
            if (req.session && req.session.email) {
                email = req.session.email;
            } else {
                email = defaultUser.email;
            }
            
            db.u.findOne({email:email}, function(error, data) {
                user = data.toObject();
                app.dynamicHelpers({user:function(req, res){
                    return user;
                  }});
                //res.locals.user = user;
                console.log(user);
                if (half) {
                    next();
                } else {
                    half = true;
                }
            });
            db.m.find({Users:email}, function(error, data) {
                app.dynamicHelpers({mortgages:function(req, res){
                    return data;
                  }});
                //res.locals.mortgages = data;
                if (half) {
                    next();
                } else {
                    half = true;
                }
            });
        } else {
            app.dynamicHelpers({user:function(req, res){
                    return defaultUser;
                  }});
            //res.locals.user = defaultUser;
            next();
        }
    }
};