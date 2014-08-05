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
	// k = k || 'telefunker';
	// for (var i = 0; i < n; i++) o[k + (i + 1)] = false;
	for (var i = 0; i < n; i++) o[(i + 1)] = false;
	return o;
}

var telefunkerOnsetTimes = generateValues(sockId.maxClients);
var telefunkerBuffers = generateValues(sockId.maxClients);
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
				console.log('##################reset received: ');
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
			case 'sendingCriteriaString':
				saveCriteriaString(message.values);
				break;
		}
		switch (type) {
			case 'sendingOnsetSamples':
				//receiveOnsetSamples(message.values);
				break;
		}


	});


	function getOnsetTime(values) {
		var onsetTime = values.onsetTime;
		var idx = values.myID - 1;
		var count = values.count;
		var sample = values.sample;
		var filename = values.myID + '-onsetTime-' + count;

		//console.log(id + ' - samplevalue: ' + sample);
		console.log('--------------------------------------');
		//console.log('>>lastOnsetTime: ' + lastOnsetTime);
		console.log('>>onset from: ' + values.myID + ' - timevalue: ' + onsetTime + ' - sample: ' + sample);
		//console.log('>>lastOnsetTime - onsetTime: ' + (onsetTime - lastOnsetTime));

		return;
		
		if (onsetTime - lastOnsetTime > timeGap) {
			//console.log('###numReceivedTelefunkers: '+ numReceivedTelefunkers);
			numReceivedTelefunkers = 0;
		}

		telefunkerOnsetTimes[idx] = onsetTime;
		numReceivedTelefunkers++;

		if(numReceivedTelefunkers >= sockId.maxClients) {
			differenceCalculation();
			numReceivedTelefunkers = 0;
		}

		//checkOnsetTimeDiff();
		lastOnsetTime = onsetTime;
		//console.log('<<lastOnsetTime: ' + lastOnsetTime + ' from: '+ id);
	}

	function receiveOnsetSamples (values){
		var idx = values.myID - 1;
		var onsetSamples = values.onsetSamples;
		var onsetTime = values.onsetTime;
		var sampleRate = values.sampleRate;
		var i, j;

		console.log('receiving rec samples at ' + lastOnsetTime + ' for index '+ idx);

		if (onsetTime - lastOnsetTime > timeGap) {
			// reset receiver
			numReceivedTelefunkers = 0;

			for(i = 0; i < sockId.maxClients; i++)
				telefunkerOnsetTimes[i] = -1;
		}

		if(telefunkerOnsetTimes[idx] === -1)
			numReceivedTelefunkers++;

		telefunkerBuffers[idx] = onsetSamples;
		telefunkerOnsetTimes[idx] = onsetTime;

		// var saveStr = onsetSamples.join(',\n') + ',\n';
		// var filename = values.myID + '-onset-samples' + ".txt";
		// console.log('###saving: ' + filename);
		// fs.writeFile(path.join('./data', filename), saveStr, function(err) {
		//	if (err) throw err;
		//	console.log('Onset samples saved!');
		// });

		if(numReceivedTelefunkers === sockId.maxClients) {

			console.log('__________________________');
			telefunkerBuffers[idx] = onsetSamples;

			var bufferSize = telefunkerBuffers[0].length;
			var corrSpace = bufferSize / 4;
			var corrDiffTimes = [];
		
			for(i = 0; i < sockId.maxClients; i++) {
				corrDiffTimes[i] = [];

				for(j = 0; j < sockId.maxClients; j++) {
					var crossCorr = crossCorrelation(telefunkerBuffers[i], telefunkerBuffers[j].slice(corrSpace, bufferSize - corrSpace));
					var maxIndex = getMaximumIndex(crossCorr) - corrSpace;
					var diffSamples = (telefunkerOnsetTimes[i] - telefunkerOnsetTimes[j]) * sampleRate;

					corrDiffTimes[i][j] = maxIndex;

					//console.log('####crossCorr[' + i + '][ ' + j + ']');
					//var printStr = crossCorr.join(',\n') + ',\n';
					//console.log(printStr);
					console.log('delta time (samples): onset: ' + diffSamples + ', cross corr: ' + maxIndex);
				}
			}

			// reset receiver
			numReceivedTelefunkers = 0;
			for(i = 0; i < sockId.maxClients; i++)
				telefunkerOnsetTimes[i] = -1;
		}

		//checkOnsetTimeDiff();
		lastOnsetTime = onsetTime;
	}

	function getMaximumIndex (array){
		var max = array[0];
		var maxIndex = 0;

		for (var i = 1; i < array.length; i++) {
			if (array[i] > max) {
				max = array[i];
				maxIndex = i;
			}
		}

		return maxIndex;
	}


	function crossCorrelation(buffer, window) {
		var crossCorrSize = buffer.length - window.length;
		var crossCorr = [];

		for (var j = 0; j < crossCorrSize; j++) {
			var sum = 0;
	
			for (var i = 0; i < window.length; i++) {
				sum += buffer[i + j] * window[i];
			}

			crossCorr[j] = sum;
		}

		return crossCorr;
	}

	function differenceCalculation() {
			//check for minimum
			var min = 9999;
			var minKey = null;
			for (var key in telefunkerOnsetTimes) {
				if (telefunkerOnsetTimes[key] < min) {
					min = telefunkerOnsetTimes[key];
					minKey = key;
				}
			}
			console.log('--------------------------------------');
			console.log(minKey + ' - time minval: ' + telefunkerOnsetTimes[minKey]);
			for (key in telefunkerOnsetTimes) {
				if (key !== minKey) {
					console.log(key + ' - time  value: ' + telefunkerOnsetTimes[key] + ' diff: ' + (telefunkerOnsetTimes[key] - min) + ' = samples: ' + ((telefunkerOnsetTimes[key] - min) * 44100));
					//console.log('max on: ' + maxKey + ' - ' + key + ' = ' + (max - telefunkerOnsetTimes[key]));
				}
			}
			console.log('________________________________________________________________________');
	}
	

	function reportClipping(values) {
		var id = values.myID;
		var frameTime = values.frameTime;
		var numClipping = values.numClipping;
		console.log('////////' + id + ' - reports ' + numClipping + ' clippings at frame time: ' + frameTime);
	}

	function reportGapInfos(values) {
		var id = values.myID;
		var gapCount = values.gapCount;
		var gapTime = values.gapTime;
		console.log('////////' + id + ' - reports gap count: ' + gapCount);
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

	function saveCriteriaString(values) {
		var id = values.myID;
		var string = values.criteriaString;
		var filename = id + '-event' + ".csv";
		console.log('###saving: ' + filename);
		fs.writeFile(path.join('./data', filename), string, function(err) { //.toString()????
			if (err) throw err;
			console.log('CriteriaString saved!');
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