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
  , everyauth = require('everyauth');

var app = module.exports = express.createServer();

everyauth.debug = true;

var usersById = {};
var nextUserId = 0;

function addUser (source, sourceUser) {
  var user;
  if (arguments.length === 1) { // password-based
    user = sourceUser = source;
    user.id = ++nextUserId;
    return usersById[nextUserId] = user;
  } else { // non-password-based
    user = usersById[++nextUserId] = {id: nextUserId};
    user[source] = sourceUser;
  }
  return user;
}

var usersByGoogleId = {};
var conf = {}
conf.google = {
        clientId: '129675806980.apps.googleusercontent.com'
      , clientSecret: 'ca93uhyzKU0zhhF53Y9rK5nk'
    };
everyauth.everymodule
  .findUserById( function (id, callback) {
    callback(null, usersById[id]);
  });
everyauth.google
  .appId(conf.google.clientId)
  .appSecret(conf.google.clientSecret)
  .scope('https://www.googleapis.com/auth/userinfo.profile https://www.google.com/m8/feeds/')
  .findOrCreateUser( function (sess, accessToken, extra, googleUser) {
    googleUser.refreshToken = extra.refresh_token;
    googleUser.expiresIn = extra.expires_in;
    return usersByGoogleId[googleUser.id] || (usersByGoogleId[googleUser.id] = addUser('google', googleUser));
  })
  .redirectPath('/');

// Configuration
app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(__dirname + '/public'))
    .use(express.cookieParser())
    .use(express.session({secret:"secretkey"}))
    .use(everyauth.middleware())
});
   
app.get('/', function (req, res) {
       m.findOne({})
        .run(function (err, m) {
            if (req.user.loggedIn) {
                console.log(JSON.stringify(req.user));
            }
            var data = m.toObject();
            
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
            
            var user = JSON.stringify(req.user);
            //Render
            res.render('mortgage', { title: 'Mortgage' , mortgage : data , user : user });
        });
   });

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
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
    , Principal     : { tpye: Number }
    , Interest      : { tpye: Number }
});

var Mortgage = new Schema({
    OrginAmount     :  { type: Number }
  , OrginDate       :  { type: Date }
  , FirstPayment    :  { type: Number }
  , APY             :  { type: Number }
  , Length          :  { type: Number }
  , Payment         :  { type: Number }
  , PrincipalPaid   :  { type: Number }
  , InterestPaid    :  { type: Number }
  , Transaction     :  [Transactions]
});

var m = mongoose.model('Mortgage', Mortgage, 'mortgage');
/*
// Routes
app.get('/', function (req, res) {
    m.findOne({})
        .run(function (err, m) {
            if( req.isAuthenticated() ) {
                console.log('there');
            }
            if (req.query["access_token"]) {
                console.log('here');
            }
            var data = m.toObject();
            
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
*/
app.listen(process.env.PORT || 8001);
console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
