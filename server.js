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

function generateValues(n, k){
	var o = {};
	k = k || 'phone';
	for (var i = 0; i < n; i++) o[k+i] = false;
	return o;
}

var phoneMaxValues = generateValues(sockId.maxClients);


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

	//receiving from client\\\\\\\\\
	socket.on('message', function(message) {
		var type = message.type;
		//console.log(message);
		switch (type) {
			case 'sendingMaxArray':
				saveMaxarraysamples(message.values);
				break;
		}
		switch (type) {
			case 'sendingMaximumTime':
				getMaximumTime(message.values);
				break;
		}
		switch (type) {
			case 'resetTime':
				console.log('reset received');
				sentTimeReset();
				break;
		}
	});

	function getMaximumTime(values) {
		var maxTime = values.maxTime;
		var id = values.myID;
		var count = values.count;
		var filename = id + '-maxTime-' + count;
		console.log('______received maximum from: ' + id + ' - value: ' + maxTime);
		phoneMaxValues[id] = values.maxTime;
		differenceCalculation ();
		//console.log('saving: ' + id + '-maxTime' + count);
		//fs.writeFileSync(path.join('./data', filename), maxTime.toString());
		//combine files into one file with: 'pr -tmJ phone1-event.csv phone2-event.csv > phones.csv'
	}

	function differenceCalculation() {

		var phonesMaxState = false;
		for (var key in phoneMaxValues) {
			if (phoneMaxValues[key] === false) return;
			else phonesMaxState = true;
		}

		if (phonesMaxState) {

			var max = 0;
			var maxKey = null;
			for(key in phoneMaxValues){
				if(phoneMaxValues[key] > max) {
					max = phoneMaxValues[key];
					maxKey = key;
				}
			}

			console.log('----Maximum on: ' + maxKey + '- maximum value: ' + max);

			//console.log('difference: ' + (phoneMaxValues.phone1 - phoneMaxValues.phone2));
			//reset values
			for (key in phoneMaxValues) {
				phoneMaxValues[key] = null;
			}
		}
	}


	function saveMaxarraysamples(values) {
		var samplearray = values.samplearray;
		var id = values.myID;
		var filename = id + '-event' + ".csv";
		console.log('saving: ' + id + '-event' + ".csv");
		console.log('received maximum: ' + samplearray);
		fs.writeFileSync(path.join('./data', filename), samplearray.toString());
		//combine files into one file with: 'pr -tmJ phone1-event.csv phone2-event.csv > phones.csv'
	}

	//sent time reset received from one client to all clients
	function sentTimeReset(){
		io.emit('message', {
			type: 'timeReset'
		});
	}
	
});

// server
// --------
// launch HTTP server
server.listen(app.get('port'), function() {
	console.log('Express server listening on port ' + app.get('port'));
});