// MongoDB
var mongoose = require('mongoose')
  , Schema = mongoose.Schema
  
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

module.exports.m = mongoose.model('Mortgage', Mortgage, 'mortgage');
module.exports.u = mongoose.model('users', Users, 'users');