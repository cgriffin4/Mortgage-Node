var fs = require('fs');

module.exports = function(app){
    var loadUser = require('../libs/loadUser')(app)
    
    app.get("/", loadUser, function(req, res) {
        res.render("index", {title:'Mortgage'});
    });
    
    //load the others
    fs.readdirSync(__dirname).forEach(function(file) {
        if (file == "index.js") return;
        var name = file.substr(0, file.indexOf('.'));
        require('./' + name)(app);
    });
}