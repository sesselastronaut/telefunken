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

function generateValues(n, k) {
	var o = {};
	k = k || 'telefunker';
	for (var i = 0; i < n; i++) o[k + (i + 1)] = false;
	return o;
}

var telefunkerMaxValues = generateValues(sockId.maxClients);

// app logic
// ---------

// page load /entry point
app.get('/', function(req, res) {

	var vars = {
		title: '}----{}--{ritmo quattro stationi}--{}---{'
	};

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
		switch (type) {
			case 'sendingGap':
				getGapInfos(message.values);
				break;
		}
	});

	function getGapInfos(values) {
		var maxTime = values.maxTime;
		var id = values.myID;
		var gapCount = values.gapCount;
		var gapTime = values.gapTime;
		console.log('////////' + id + ' - reports gap count: ' + gapCount);
	}

	function getMaximumTime(values) {
		var maxTime = values.maxTime;
		var id = values.myID;
		var count = values.count;
		var sample = values.sample;
		var filename = id + '-maxTime-' + count;
		console.log(id + ' - samplevalue: ' + sample);
		// console.log('______received maximum from: ' + id + ' - timevalue: ' + maxTime + ' - sample: ' + sample);
		telefunkerMaxValues[id] = values.maxTime;
		differenceCalculation();
		//console.log('saving: ' + id + '-maxTime' + count);
		//fs.writeFileSync(path.join('./data', filename), maxTime.toString());
		//combine files into one file with: 'pr -tmJ telefunker1-event.csv telefunker2-event.csv > telefunkers.csv'
	}

	function differenceCalculation() {

		var telefunkersMaxState = false;
		for (var key in telefunkerMaxValues) {
			if (telefunkerMaxValues[key] === false) return;
			else telefunkersMaxState = true;
		}

		if (telefunkersMaxState) {

			var max = 0;
			var maxKey = null;
			var min = 9999;
			var minKey = null;
			for (key in telefunkerMaxValues) {
				if (telefunkerMaxValues[key] > max) {
					max = telefunkerMaxValues[key];
					maxKey = key;
				}
				// if (telefunkerMaxValues[key] < min) {
				//	min = telefunkerMaxValues[key];
				//	minKey = key;
				// }
			}
			console.log('--------------------------------------');
			console.log(maxKey + ' - time maxval: ' + telefunkerMaxValues[maxKey]);
			for (key in telefunkerMaxValues) {
				if (key !== maxKey) {
					console.log(key + ' - time  value: ' + telefunkerMaxValues[key] + ' diff: ' + (max - telefunkerMaxValues[key]));
					//console.log('max on: ' + maxKey + ' - ' + key + ' = ' + (max - telefunkerMaxValues[key]));
				}
			}
			console.log('________________________________________________________________________');
			//console.log('maxTime: ' + maxKey + ' - val: ' + max);
			//console.log('minTime: ' + minKey + ' - val: ' + min + ' diff: ' + (telefunkerMaxValues[maxKey] - telefunkerMaxValues[minKey]));

			//reset values
			for (key in telefunkerMaxValues) {
				telefunkerMaxValues[key] = false;
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
		//combine files into one file with: 'pr -tmJ telefunker1-event.csv telefunker2-event.csv > telefunkers.csv'
	}

	//sent time reset received from one client to all clients
	function sentTimeReset() {
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