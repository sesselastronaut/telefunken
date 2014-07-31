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

var rmscounter = 0;

function generateValues(n, k) {
	var o = {};
	k = k || 'telefunker';
	for (var i = 0; i < n; i++) o[k + (i + 1)] = false;
	return o;
}

var telefunkerOnsetValues = generateValues(sockId.maxClients);
var lastOnsetTime = -1;
var numReceivedTelefunkers = 0;

var timeGap = 0.080;

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

	io.emit('message', {
			type: 'setTimeGap',
			data: timeGap
	});

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
			case 'sendingOnsetTime':
				getOnsetTime(message.values);
				break;
		}
		switch (type) {
			case 'resetTime':
				lastOnsetTime = 0;
				console.log('##################reset received: ' + lastOnsetTime);
				sentTimeReset();
				break;
		}
		switch (type) {
			case 'sendingGap':
				reportGapInfos(message.values);
				break;
		}
		switch (type) {
			case 'sendClipping':
				reportClipping(message.values);
				break;
		}
		switch (type) {
			case 'sendingRmsValues':
				saveRmsValues(message.values);
				break;
		}
		switch (type) {
			case 'sendingRmsValues':
				saveRmsValues(message.values);
				break;
		}


	});

	function reportClipping(values) {
		var id = values.myID;
		var clipSample = values.clipSample;
		var clipTime = values.clipTime;
		console.log('////////' + id + ' - reports clipping on time: ' + clipTime + ' sample: ' + clipSample);
	}

	function reportGapInfos(values) {
		var id = values.myID;
		var gapCount = values.gapCount;
		var gapTime = values.gapTime;
		console.log('////////' + id + ' - reports gap count: ' + gapCount);
	}

	function getOnsetTime(values) {
		var onsetTime = values.onsetTime;
		var id = values.myID;
		var count = values.count;
		var sample = values.sample;
		var filename = id + '-onsetTime-' + count;


		//console.log(id + ' - samplevalue: ' + sample);
		console.log('--------------------------------------');
		//console.log('>>lastOnsetTime: ' + lastOnsetTime);
		console.log('>>onset from: ' + id + ' - timevalue: ' + onsetTime + ' - sample: ' + sample);
		//console.log('>>lastOnsetTime - onsetTime: ' + (onsetTime - lastOnsetTime));
		
		if (onsetTime - lastOnsetTime > timeGap) {
			console.log('###numReceivedTelefunkers: '+ numReceivedTelefunkers);
			numReceivedTelefunkers = 0;
		}

		telefunkerOnsetValues[id] = onsetTime;
		numReceivedTelefunkers++;

		//console.log('<<onset from: ' + id + ' - timevalue: ' + onsetTime + ' - sample: ' + sample);

		if(numReceivedTelefunkers >= sockId.maxClients) {
			differenceCalculation();
			numReceivedTelefunkers = 0;
		}

		//checkOnsetTimeDiff();
		lastOnsetTime = onsetTime;
		//console.log('<<lastOnsetTime: ' + lastOnsetTime + ' from: '+ id);
	}

	function differenceCalculation() {
			//check for minimum
			var min = 9999;
			var minKey = null;
			for (var key in telefunkerOnsetValues) {
				if (telefunkerOnsetValues[key] < min) {
					min = telefunkerOnsetValues[key];
					minKey = key;
				}
			}
			console.log('--------------------------------------');
			console.log(minKey + ' - time minval: ' + telefunkerOnsetValues[minKey]);
			for (key in telefunkerOnsetValues) {
				if (key !== minKey) {
					console.log(key + ' - time  value: ' + telefunkerOnsetValues[key] + ' diff: ' + (telefunkerOnsetValues[key] - min) + ' = samples: ' + ((telefunkerOnsetValues[key] - min) * 44100));
					//console.log('max on: ' + maxKey + ' - ' + key + ' = ' + (max - telefunkerOnsetValues[key]));
				}
			}
			console.log('________________________________________________________________________');
	}
	
	function checkOnsetTimeDiff() {
		var max = 0;
		var maxKey = null;

		//find maximum
		for (var key in telefunkerOnsetValues) {
			if (telefunkerOnsetValues[key] > max) {
				max = telefunkerOnsetValues[key];
				maxKey = key;
			}
		}
		// console.log('------------------------------------');
		// console.log('maxKey: ' + maxKey);

		//check time difference between the values if smaller than threshold do difference calculation
		for (key in telefunkerOnsetValues) {

			if (key !== maxKey && (Math.abs(telefunkerOnsetValues[maxKey] - telefunkerOnsetValues[key]) < 0.080)) {
					// for (key in telefunkerOnsetValues) {
					//	console.log('---diffcalc with: ' + key + ' diff from max: ' + (telefunkerOnsetValues[maxKey] - telefunkerOnsetValues[key]));
					// }
					//do the difference calculation
					differenceCalculation ();
			}
		}
	}


	function saveMaxarraysamples(values) {
		var samplearray = values.samplearray;
		var id = values.myID;
		var filename = id + '-event' + ".csv";
		console.log('saving: ' + id + '-event' + ".csv");
		//console.log('received maximum: ' + samplearray);
		fs.writeFileSync(path.join('./data', filename), samplearray.toString());
		//combine files into one file with: 'pr -tmJ telefunker1-event.csv telefunker2-event.csv > telefunkers.csv'
	}

	function saveRmsValues(values) {
		var rmsarray = values.rmsValues;
		var id = values.myID;
		//var rmscounter = values.rmscounter;
		var filename = id + '-event' + ".csv";
		console.log('###saving: ' + filename);
		// console.log('###received RMS Values: ' + rmsarray);
		fs.writeFile(path.join('./data', filename), rmsarray.toString(), function(err) {
			if (err) throw err;
			console.log('It\'s saved!');
		});
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