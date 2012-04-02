
/**
 * Module dependencies.
 */

var express = require('express')
  , mongoose = require('mongoose')
  , Schema = mongoose.Schema
  , routes = require('./routes');

var app = module.exports = express.createServer();

// Configuration

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function(){
  app.use(express.errorHandler());
});

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

// Routes
app.get('/', routes.index);
app.get('/m', function (req, res) {
    m.findOne({})
        .run(function (err, m) {
            var data = m.toObject();
            
            //Balances and amounts paid - everything from transactions
            data.Balance = 0;
            data.InterestPaid = 0;
            data.PrincipalPaid = 0;
            data.LastPayment = data.OrginDate;
            for ( var t in data.Transaction) {
                data.Balance += parseFloat(data.Transaction[t].Amount);
                data.InterestPaid += parseFloat(data.Transaction[t].Interest);
                data.PrincipalPaid += parseFloat(data.Transaction[t].Principal);
                data.LastPayment = ( data.Transaction[t].Date > data.LastPayment ? data.Transaction[t].Date : data.LastPayment );
            }
            
            //Outstanding Interest -- This only works if we assume all unpaid interest was paid at last payment
            data.InterestDaily = (( data.APY / 100 ) / 365 ) * data.Balance;
            var today = new Date();
            data.daysToPayInterestOn = days_between(today, data.LastPayment)-1; //The last payment would have paid the interest through that day. (bug: before 1st payment, you get 1 day free interest)
            data.InterestUnpaid = (data.daysToPayInterestOn * data.InterestDaily);
            
            //Render
            res.render('mortgage', { title: 'Mortgage' , mortgage : data });
        });
});

app.listen(process.env.PORT);
console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
