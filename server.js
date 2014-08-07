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

var commonOnsetCounter = 0;

function saveArray(array, filename) {
	var saveStr = array.join(',\n') + ',\n';
	fs.writeFile(path.join('./data/onsets', filename), saveStr, function(err) { if (err) throw err; });
}

function saveMultipleArraysInterleaved(arrayOfArrays, numArrays, filename) {
	var minLength = arrayOfArrays[0].length;
	var saveStr = '';
	var i, k;

	for(i = 1; i < numArrays; i++) {
		if(arrayOfArrays[i].length < minLength)
			minLength = arrayOfArrays[i].length;
	}

	for(k = 0; k < minLength; k++) {
		for(i = 0; i < numArrays; i++) {
			saveStr += arrayOfArrays[i][k];
			saveStr += ', ';
		}

		saveStr += '\n';
	}

	fs.writeFile(path.join('./data/onsets', filename), saveStr, function(err) { if (err) throw err; });
}

var telefunkerOnsetTimes = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
var telefunkerBuffers = [null, null, null, null, null, null, null, null, null, null, null, null];
var lastOnsetTime = 0;
var numReceivedTelefunkers = 0;
var onsetTimeDiff = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
var distTimeDiff = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; // time shift related to displacement

var minInterOnsetTime = 0.080;

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
			case 'resetTime':
				console.log('################## reset time');
				lastOnsetTime = 0;
				break;

			case 'sendingOnsetSamples':
				receiveOnsetSamples(message.values);
				break;

			case 'sendingGap':
				reportGapInfos(message.values);
				break;

			case 'sendClipping':
				reportClipping(message.values);
				break;

			case 'sendingCriteriaString':
				saveCriteriaString(message.values);
				break;
		}
	});

	function receiveOnsetSamples (values){
		var idx = values.myID - 1;
		var onsetSamples = values.onsetSamples;
		var onsetTime = values.onsetTime;
		var sampleRate = values.sampleRate;
		var corrSampleOffset = values.corrSampleOffset;
		var corrWindowSize = values.corrWindowSize;
		var i;

		if(telefunkerBuffers[idx] === null)
			numReceivedTelefunkers++;

		telefunkerBuffers[idx] = onsetSamples;
		telefunkerOnsetTimes[idx] = onsetTime;

		if(numReceivedTelefunkers === sockId.maxClients) {
			commonOnsetCounter++;

			saveMultipleArraysInterleaved(telefunkerBuffers, sockId.maxClients, commonOnsetCounter + '-onset-samples' + '.txt');

			var bufferSize = telefunkerBuffers[0].length;
		
			console.log('__________________________');

			var corrWindow = telefunkerBuffers[0].slice(corrSampleOffset, corrSampleOffset + corrWindowSize);

			onsetTimeDiff[0] = 0;
			distTimeDiff[0] = 0;

			console.log('onset times: ' + telefunkerOnsetTimes[0] + ' - ' + telefunkerOnsetTimes[1] + ' diff:' + (telefunkerOnsetTimes[0]-telefunkerOnsetTimes[1]) + ' s');

			for (i = 1; i < sockId.maxClients; i++) {
				var crossCorr = crossCorrelation(telefunkerBuffers[i], corrWindow);
				var maxIndex = getMaximumIndex(crossCorr) - corrSampleOffset;
				var crossCorrDiffTime = maxIndex / sampleRate;
				var correctedOnsetTimeDiff = telefunkerOnsetTimes[i] + crossCorrDiffTime - telefunkerOnsetTimes[0];

				if(lastOnsetTime > 0) {
					var dist = correctedOnsetTimeDiff - onsetTimeDiff[i];
					distTimeDiff[i] = dist;
					console.log('client ' + (i + 1) + ' distance: ' +
						dist + ' s, ' +
						dist * sampleRate + ' samples, ' +
						dist * 330000 + ' mm' +
						' (cc: ' + maxIndex + ')'
					);
				}

				onsetTimeDiff[i] = correctedOnsetTimeDiff;
			}

			// reset receiver
			numReceivedTelefunkers = 0;
			for(i = 0; i < sockId.maxClients; i++)
				telefunkerBuffers[i] = null;
		}

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

	// function differenceCalculation() {
	// 		//check for minimum
	// 		var min = 9999;
	// 		var minKey = null;

	// 		for (var key in telefunkerOnsetTimes) {
	// 			if (telefunkerOnsetTimes[key] < min) {
	// 				min = telefunkerOnsetTimes[key];
	// 				minKey = key;
	// 			}
	// 		}

	// 		console.log('--------------------------------------');
	// 		console.log(minKey + ' - time minval: ' + telefunkerOnsetTimes[minKey]);

	// 		for (key in telefunkerOnsetTimes) {
	// 			if (key !== minKey) {
	// 				console.log(key + ' - time  value: ' + telefunkerOnsetTimes[key] + ' diff: ' + (telefunkerOnsetTimes[key] - min) + ' = samples: ' + ((telefunkerOnsetTimes[key] - min) * 44100));
	// 				//console.log('max on: ' + maxKey + ' - ' + key + ' = ' + (max - telefunkerOnsetTimes[key]));
	// 			}
	// 		}
	// 		console.log('________________________________________________________________________');
	// }


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

	function saveCriteriaString(values) {
		var id = values.myID;
		var string = values.criteriaString;
		var filename = 'telefunker-' + id + '-criteria' + ".txt";
		console.log('###saving: ' + filename);
		fs.writeFile(path.join('./data', filename), string, function(err) { //.toString()????
			if (err) throw err;
			console.log('CriteriaString saved!');
		});
		//combine files into one file with: 'pr -tmJ telefunker1-event.csv telefunker2-event.csv > telefunkers.csv'
	}
});

// server
// --------
// launch HTTP server
server.listen(app.get('port'), function() {
	console.log('Express server listening on port ' + app.get('port'));
});