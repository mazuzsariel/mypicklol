/*
	Read data from files and put it in to the memory
*/
function load(app){
    app.get('/act/', function(req,res){
	res.send('act'); 
    });
}

exports.load = load;