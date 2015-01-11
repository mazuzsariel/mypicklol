var fs = require('fs');

var readJson = function(filePath, cb){
    fs.readFile(
	filePath, 
	'utf8', 
	function(err, data){
	    if (err) throw err;
	    cb(JSON.parse(data));
	});
};
 

exports.readJson=readJson;