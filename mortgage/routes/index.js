
/*
 * GET home page.
 */

exports.index = function(req, res){
  res.render('index', { title: 'Express' });
};

exports.mortgage = function(req, res) {
    res.render('mortgage', { title: 'Mortgage' , mortgage : MyMortgage});
};