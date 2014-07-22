/* TODO references
 *
 */


// dependencies
// ------------
var http = require('http');
var io = require('socket.io');
var path = require('path');
var shortid = require('shortid');
// config file
var app = require('./lib/config')();
// declare and setup servers
var server = http.createServer(app);
var io = require('socket.io')(server);
//storage of files
var fs = require('fs');
// Socket based id handling module
var sockId = require('./lib/socketId');


// app logic
// ---------

// page load /entry point
app.get('/', function(req, res) {
	
	var vars = { title: '}----{}--{ritmo quattro stationi}--{}---{' };

	sockId.landingPage(vars); // extend the template vars for the landing page

	res.render('layout', vars); // render the page with the set variables
});

// Socket events
io.on('connection', function(socket) {

	// set the socket events to listent to for the id logic
	sockId.listenEvents(io, socket);

	//receiving\\\\\\\\\
	socket.on('message', function(message) {
		var type = message.type;
		console.log(message);
		switch (type) {
			case 'sendingMaxArray':
				saveMaxarraysamples(message.values);
				break;
		}
	});

	function saveMaxarraysamples(values) {
		var samplearray = values.samplearray;
		var id = values.myID;
		var filename = id + '-event' + ".csv";
		console.log('saving: ' + id + '-event' + ".csv");
		fs.writeFileSync(path.join('./data', filename), samplearray.toString());
		//combine files into one file with: 'pr -tmJ phone1-event.csv phone2-event.csv > phones.csv'
	}
	
});

// server
// --------
// launch HTTP server
server.listen(app.get('port'), function() {
	console.log('Express server listening on port ' + app.get('port'));
});