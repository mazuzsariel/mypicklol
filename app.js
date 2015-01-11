var express = require('express');
var error = require('./server/error.js');
var dynamic = require('./server/dynamic.js');
var action = require('./server/action.js');
var app = express();
var utils = require('./server/utils.js');
var _ = require('underscore');
var auth = require('./server/auth.js');

function hostPolicies(){
    var site = app.__.config.domain.site;
    var host = site.substring(site.indexOf("://")+3);
    app.use(function (req, res, next) {
	if(req.header('host')!= host){
	    var err = new Error('host ' + req.header('host') + '('+host+')'+' not allowed!');
	    err.status = 403;
	    return next(err);		    
	}	
	next();
    });    
}

// configure Express
app.configure(function() {
    app.use(express.cookieParser());
    app.use(express.bodyParser());
    app.use(express.session({ secret: 'dpa is superman and batman and supermario hero!' }));
    app.use(app.router);
});

//configuration
//TODO: refactore to use setting from one json property in app rather different strings
utils.readJson("./server/config/local.json", function(configL){
    app["__"]={config:configL};
 
    utils.readJson("./server/config/global.json",function(configG){ 
	app.__.config=_.extend(app.__.config, configG);
	
	hostPolicies();

	//dynamic server
	dynamic.load(app, function(tags){
	    //static server
	    app.use(express.directory(app.__.config.folder.static));
	    app.use(express.static(app.__.config.folder.static));
	    
	    //error handling
	    error.serve(app, tags, function(){console.log('all data has been loaded')});
	});

	//start server
	app.listen(app.__.config.port, app.__.config.domain.bind);

	console.log(
	    'Listening on '+
		app.__.config.domain.bind+
		":"+
		app.__.config.port);
    });
})
