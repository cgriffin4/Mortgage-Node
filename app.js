/**
 * Module dependencies.
 */
var express = require('express')
  , mongoose = require('mongoose')
  , Schema = mongoose.Schema
  , routes = require('./routes')
  , accounting = require('./public/javascripts/accounting.min.js')
  , _ = require('underscore')
  , url = require('url')
  , auth= require('connect-auth');
  
var app = module.exports = express.createServer();
var defaultUser = 'undefined';

// Utilise the 'events' to do something on first load (test whether the user exists etc. etc. ) 
function firstLoginHandler( authContext, executionResult, callback ) {

  // The originally request URL will be stored in : executionResult.originalUrl 
  // this could be used for redirection in 'real' cases.
  u.findOne({email:executionResult.user.email},function(error, data) {
    if (data) {
        var user = data.toObject();
        authContext.request.session.email = user.email;
        
        console.log('Known USER: ' + user.email);
        redirect( authContext.request, authContext.response, '/');
    } else {
        console.log('Brand new USER: ' + executionResult.user.email);
        user = {email:executionResult.user.email, name:executionResult.user.given_name};
        var i = new u(user);
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
}

function redirect(req, res, location) {
  res.writeHead(303, { 'Location': location });
  res.end('');
}

// This middleware detects login requests (in this case requests with a query param of ?login_with=xxx where xxx is a known strategy)
var example_auth_middleware= function() {
  return function(req, res, next) {
    var urlp= url.parse(req.originalUrl, true)
    if( urlp.query.login_with ) {
      req.authenticate([urlp.query.login_with], function(error, authenticated) {
        if( error ) {
          // Something has gone awry, behave as you wish.
          console.log( error );
          res.end();
      }
      else {
          if( authenticated === undefined ) {
            // The authentication strategy requires some more browser interaction, suggest you do nothing here!
          } else {
            // We've either failed to authenticate, or succeeded (req.isAuthenticated() will confirm, as will the value of the received argument)
            if (req.isAuthenticated()) {
                req.session.email = req.getAuthDetails().user.email;
            } else {
                req.session.email = defaultUser.email;
            }
            redirect( req, res, '/');
            next();
          }
      }});
    }
    else {
        next();
    }
  }
}

function loadUser (req, res, next) {
    if ( defaultUser != 'undefined' || (req.session && req.session.email) ) {
        var half = false;
        var email;
        if (req.session && req.session.email) {
            email = req.session.email;
        } else {
            email = defaultUser.email;
        }
        
        u.findOne({email:email}, function(error, data) {
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
        m.find({Users:email}, function(error, data) {
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
        firstLoginHandler: firstLoginHandler,
        logoutHandler: require('connect-auth/lib/events').redirectOnLogout("/")}))
    .use(example_auth_middleware())
    .use('/logout', function(req, res, params) {
        req.logout(); // Using the 'event' model to do a redirect on logout.
    });
    
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
});

app.configure('development', function(){
    app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
    defaultUser = {email:'chris.sgriffin@gmail.com', name:'Chris'};
});

app.configure('production', function(){
    app.use(express.errorHandler());
});

//configure currency setting
accounting.settings.currency.format = {
    pos : "%s %v",   // for positive values, eg. "$ 1.00" (required)
	neg : "%s (%v)", // for negative values, eg. "$ (1.00)" [optional]
	zero: "%s  -- "  // for zero values, eg. "$  --" [optional]
};

// Utilities
function days_between(date1, date2) {

    // The number of milliseconds in one day
    var ONE_DAY = 1000 * 60 * 60 * 24

    // Convert both dates to milliseconds
    var date1_ms = date1.getTime()
    var date2_ms = date2.getTime()

    // Calculate the difference in milliseconds
    var difference_ms = Math.abs(date1_ms - date2_ms)
    
    // Convert back to days and return
    return Math.round(difference_ms/ONE_DAY)

}

// MongoDB   
mongoose.connect('mongodb://dbuser:dbuser@ds031627.mongolab.com:31627/mortgage');

var Transactions = new Schema({
      Date          : { type: Date }
    , Amount        : { type: Number }
    , Principal     : { type: Number }
    , Interest      : { type: Number }
});

var Mortgage = new Schema({
    Name            :   { type: String }
  , OrginAmount     :  { type: Number }
  , OrginDate       :  { type: Date }
  , FirstPayment    :  { type: Number }
  , APY             :  { type: Number }
  , Length          :  { type: Number }
  , Payment         :  { type: Number }
  , PrincipalPaid   :  { type: Number }
  , InterestPaid    :  { type: Number }
  , Transaction     :  [Transactions]
});

var Users = new Schema({
    name            :   { type: String }
  , email           :   { type: String }
});

var m = mongoose.model('Mortgage', Mortgage, 'mortgage');
var u = mongoose.model('users', Users, 'users');

app.get("/", loadUser, function(req, res) {
    res.render("index", {title:'Mortgage'});
});

app.get("/mortgage/:id", loadUser, function(req, res) {
    m.findById(req.params.id,function (err, m) {
        var data = m.toObject();
        console.log(data);
        //Initialize Variables
        data.Balance = 0;
        data.InterestPaid = 0;
        data.PrincipalPaid = 0;
        data.InterestDaily = 0;
        data.InterestUnpaid = 0;
        data.LastPayment = data.OrginDate;
        
        //Sort the Transactions as Newest to Oldest
        data.Transaction = _.sortBy(data.Transaction, 'Date').reverse();
        
        //Balances and amounts paid - everything from transactions
        for ( var t in data.Transaction) {
            data.Balance += parseFloat(data.Transaction[t].Principal);
            data.InterestPaid += parseFloat(data.Transaction[t].Interest);
            if (parseFloat(data.Transaction[t].Principal) < 0) data.PrincipalPaid += Math.abs(parseFloat(data.Transaction[t].Principal));
            data.LastPayment = ( data.Transaction[t].Date > data.LastPayment ? data.Transaction[t].Date : data.LastPayment );
            
            //Format Money
            data.Transaction[t].Principal = accounting.formatMoney(data.Transaction[t].Principal);
            data.Transaction[t].Interest = accounting.formatMoney(data.Transaction[t].Interest);
            data.Transaction[t].Amount = accounting.formatMoney(data.Transaction[t].Amount);
            
            //Format Date
            data.Transaction[t].Date = new Date(data.Transaction[t].Date).toDateString();
        }
        
        //Outstanding Interest -- This only works if we assume all unpaid interest was paid at last payment
        data.InterestDaily = (( data.APY / 100 ) / 365 ) * data.Balance;
        var today = new Date();
        data.daysToPayInterestOn = days_between(today, data.LastPayment)-1; //The last payment would have paid the interest through that day. (bug: before 1st payment, you get 1 day free interest)
        data.InterestUnpaid = (data.daysToPayInterestOn * data.InterestDaily);
        
        //Format Date
        data.LastPayment = new Date(data.LastPayment).toDateString();
            
        //Format Money
        data.OrginAmount = accounting.formatMoney(data.OrginAmount);
        data.Balance = accounting.formatMoney(data.Balance);
        data.InterestPaid = accounting.formatMoney(Math.abs(data.InterestPaid));
        data.PrincipalPaid = accounting.formatMoney(data.PrincipalPaid);
        data.InterestDaily = accounting.formatMoney(data.InterestDaily);
        data.InterestUnpaid = accounting.formatMoney(data.InterestUnpaid);
        
        //Render
        res.render('mortgage', { title: 'Mortgage' , mortgage : data });
    });
});

app.listen(process.env.PORT || 8001);
console.log("Express server listening in %s mode", app.settings.env);