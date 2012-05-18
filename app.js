/**
 * Module dependencies.
 */
var express = require('express')
  , url = require('url')
  , auth= require('connect-auth')
  , db = require('./libs/db');

var app = module.exports = express.createServer();

function redirect(req, res, location) {
  res.writeHead(303, { 'Location': location });
  res.end('');
}

// Configuration
app.configure(function(){
  app.use(express.static(__dirname + '/public'))
    .use(express.cookieParser('secretkey'))
    .use(express.session({secret:"secretkey"}))
    .use(express.bodyParser())
    .use(auth({strategies:[ auth.Anonymous(),
        auth.Google2({appId : '129675806980.apps.googleusercontent.com', appSecret: 'ca93uhyzKU0zhhF53Y9rK5nk', callback: 'http://mortgage-42.herokuapp.com/oauth2callback', requestEmailPermission: true})
        ], 
        trace: true, 
        firstLoginHandler: function ( authContext, executionResult, callback ) {
              db.u.findOne({email:executionResult.user.email},function(error, data) {
                if (data) {
                    var user = data.toObject();
                    authContext.request.session.email = user.email;
                    
                    console.log('Known USER: ' + user.email);
                    redirect( authContext.request, authContext.response, '/');
                } else {
                    console.log('Brand new USER: ' + executionResult.user.email);
                    user = {email:executionResult.user.email, name:executionResult.user.given_name};
                    var i = new db.u(user);
                    i.save(function(err, user_Saved){
                        if(err){
                            throw err;
                            console.log(err);
                        }else{
                            console.log('saved!');
                            authContext.request.session.email = user.email;
                            redirect( authContext.request, authContext.response, '/');
                        }
                    });
                }
              });
            },
        logoutHandler: require('connect-auth/lib/events').redirectOnLogout("/")}))
    .use(function(req, res, next) {
        var urlp= url.parse(req.originalUrl, true);
        
        if( urlp.query.login_with ) {
            req.authenticate([urlp.query.login_with], function(error, authenticated) {
                if( error ) {
                  console.log( error );
                  res.end();
                } else {
                  if( authenticated !== undefined ) {
                    if (req.isAuthenticated()) {
                        req.session.email = req.getAuthDetails().user.email;
                    } else {
                        req.session.destroy();
                    }
                    redirect( req, res, '/');
                    next();
                  }
                }
            });
        } else {
            next();
        }
      })
    .use('/logout', function(req, res, params) {
        req.session.destroy();
        if((req.session && req.session.email)) {
            delete req.session;
        }
        
        req.logout(); // Using the 'event' model to do a redirect on logout.
    });
    
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
});

app.configure('development', function(){
    app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function(){
    app.use(express.errorHandler());
});

var routes = require('./routes')(app);
app.listen(process.env.PORT || 8001);
console.log("Express server listening in %s mode", app.settings.env);