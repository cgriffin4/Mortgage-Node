var accounting = require('../public/javascripts/accounting.min.js')
  
function days_between (date1, date2) {

    // The number of milliseconds in one day
    var ONE_DAY = 1000 * 60 * 60 * 24

    // Convert both dates to milliseconds
    var date1_ms = date1.getTime()
    var date2_ms = date2.getTime()

    // Calculate the difference in milliseconds
    var difference_ms = date1_ms - date2_ms
    
    // Convert back to days and return
    return Math.round(difference_ms/ONE_DAY)

}

//configure currency setting
accounting.settings.currency.format = {
    pos : "%s %v",   // for positive values, eg. "$ 1.00" (required)
    neg : "%s (%v)", // for negative values, eg. "$ (1.00)" [optional]
	zero: "%s  -- "  // for zero values, eg. "$  --" [optional]
};

module.exports = function(app) {
    var db = require('../libs/db')
        , loadUser = require('../libs/loadUser')(app)
        , _ = require('underscore');
    
    app.get("/mortgage/:id", loadUser, function(req, res) {
        db.m.findById(req.params.id,function (err, m) {
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
                data.Payment = accounting.formatMoney(data.Payment);
                
                //Format Date
                data.Transaction[t].Date = new Date(data.Transaction[t].Date).toDateString();
            }
            
            //Outstanding Interest -- This only works if we assume all unpaid interest was paid at last payment
            data.InterestDaily = (( data.APY / 100 ) / 365 ) * data.Balance;
            var today = new Date();
            
            //The last payment would have paid the interest through that day. (bug: before 1st payment, you get 1 day free interest)
            //Bug fixed 5/16/2012
            var paidInterest = 1;
            if (data.InterestPaid == 0) {
                paidInterest = 0;
            }
            
            data.daysToPayInterestOn = days_between(today, data.LastPayment)-paidInterest;
            //Future dating
            if (data.daysToPayInterestOn > 0) {
                data.InterestUnpaid = (data.daysToPayInterestOn * data.InterestDaily);
            }
            
            //Format Date
            if (paidInterest) {
                data.LastPayment = new Date(data.LastPayment).toDateString();
            } else {
                data.LastPayment = '--';
            }
                
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
}