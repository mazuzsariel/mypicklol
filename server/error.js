var fs = require('fs');
var mustache = require('mustache'); 

var use404 = function(page, cb){
    app.use(function(req, res, next){
	res.status(404);
	
	// respond with html page
	if (req.accepts('html')) {
	    res.send(page.split("{{url}}").join(req.url));
	    return;
	}

	// default to plain-text. send()
	res.type('txt').send('Not found');
    });
    console.log("rendered: 404.html");
    return cb();
};

var use500 = function(page, cb){
    app.use(function(err, req, res, next){
	// we may use properties of the error object
	// here and next(err) appropriately, or if
	// we possibly recovered from the error, simply next().
	var code = err.status || 500;
	res.status(code);
	res.send(page.split("[[error]]").join(err).split("[[error.code]]").join(code));
    });

    console.log("rendered: 500.html");
    return cb();
};

var render = function(url, tags, cb){
    fs.readFile(
	url,
	'utf8',
	function(err, data){
	    if(err)throw err;

	    mustache.clearCache();
	    var page = mustache.render(data, tags);
	    
	    cb(page);
	});
};

var render404 = function(tags, cb){
    render(app.__.config.utilpages.err404, tags, function(page){
	use404(page, cb);
    });
};

var render500 = function(tags, cb){
    render(app.__.config.utilpages.err500, tags, function(page){
	use500(page, cb);
    });
};

var app = null;
function serve(_app, tags, cb){ 
    app =_app;

    render404(tags, function(){
	render500(tags, function(){
	    // Routes
	    app.get('/404', function(req, res, next){
		// trigger a 404 since no other middleware
		// will match /404 after this one, and we're not
		// responding here
		next();
	    });

	    app.get('/403', function(req, res, next){
		// trigger a 403 error
		var err = new Error('not allowed!');
		err.status = 403;
		next(err);
	    });

	    app.get('/500', function(req, res, next){
		// trigger a generic (500) error
		next(new Error('This is 500 page'));
	    });

	    return cb();
	});
    });
}

exports.serve = serve;