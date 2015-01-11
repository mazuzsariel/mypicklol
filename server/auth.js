var passport = require('passport');
var FacebookStrategy = require('passport-facebook').Strategy;

function init(app){
    passport.serializeUser(function(user, done) {
	//TO-DO: change to use database for store user profile
	done(null, user);
    });

    passport.deserializeUser(function(obj, done) {
	//TO-DO: change to use database for store user profile
	done(null, obj);
    });

    passport.use(new FacebookStrategy({
	clientID: app.__.config.secure.fb.id,
	clientSecret: app.__.config.secure.fb.secret,
	callbackURL: app.__.config.domain.site + "/auth/facebook/callback"
    },
    function(accessToken, refreshToken, profile, done) {
	User.findOrCreate({ facebookId: profile.id }, function (err, user) {
	    //TO-DO: change to use database for store user profile
	    return done(err, user);
	});
    }));

    app.use(passport.initialize());
    app.use(passport.session());

    app.get('/auth/facebook',
	    passport.authenticate('facebook'),
	    function(req, res){
		// The request will be redirected to Facebook for authentication, so this
		// function will not be called.
	    });
}



exports.init = init;