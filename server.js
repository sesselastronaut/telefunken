/* TODO 
 * Object with times and phases to be send
 * laufzeitunterschied in db mappen
 * 6db between left and right
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

var eventIndex = 0;

function saveArray(array, filename) {
	var saveStr = array.join(',\n') + ',\n';
	fs.writeFile(path.join('./data/onsets', filename), saveStr, function(err) {
		if (err) throw err;
	});
}

function saveMultipleArraysInterleaved(arrayOfArrays, numArrays, filename) {
	var minLength = arrayOfArrays[0].length;
	var saveStr = '';
	var i, k;

	for (i = 1; i < numArrays; i++) {
		if (arrayOfArrays[i].length < minLength)
			minLength = arrayOfArrays[i].length;
	}

	for (k = 0; k < minLength; k++) {
		for (i = 0; i < numArrays; i++) {
			saveStr += arrayOfArrays[i][k];
			saveStr += ', ';
		}

		saveStr += '\n';
	}

	fs.writeFile(path.join('./data/onsets', filename), saveStr, function(err) {
		if (err) throw err;
	});
}

var diffOnsetTimes = [];
for (i = 0; i < sockId.maxClients; i++) {
	diffOnsetTimes[i] = Infinity;
}

var telefunkerOnsetTimes = [];
for (i = 0; i < sockId.maxClients; i++) {
	telefunkerOnsetTimes[i] = 0;
}
var telefunkerBuffers = [null, null, null, null, null, null, null, null, null, null, null, null];
var telefunkerProblemo = [];

var eventOnsetArrays = [];
for (i = 0; i < sockId.maxClients; i++) {
	eventOnsetArrays[i] = [];
}

var diffdiffArrays = [];
for (i = 0; i < sockId.maxClients; i++) {
	diffdiffArrays[i] = [];
}

var numReceivedTelefunkers = 0;

var minInterOnsetTime = 0.080;

var sendEventsTimeout = null;
var resetOnsetsTimeout = null;
var muteTime = 0;

var lastTime = 0;

// app logic
// ---------

// page load /entry point
app.get('/', function(req, res) {

	var vars = {
		title: '}----{}--{ritmo quattro stationi}--{}---{'
	};

	sockId.landingPage(vars); // extend the template vars for the landing page

	res.render('layout', vars); // render the page with the set variables
	muteTime = 0;
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

	function sendEventOnsetArrays() {
		var clientIndex;
		var numOnsets = eventOnsetArrays[0].length;
		if (numOnsets > 0) {
			var T = eventOnsetArrays[0][numOnsets - 1] - eventOnsetArrays[0][0] + 2;
			console.log('----------------------------------------------');

			for (clientIndex = 0; clientIndex < sockId.maxClients; clientIndex++) {
				var onsets = eventOnsetArrays[clientIndex];
				//add T to array
				for (var j = 0; j < onsets.length; j++) {
					onsets[j] += T;
				}

				var eventGains = diffdiffArrays[clientIndex];
				// console.log('diffdiffArrays of: ' + clientIndex + ' = ' + diffdiffArrays[clientIndex]);
				// map samples to volume 6 db maximum at +- 200samples 
				// vol = 6 / (1/44100 * 200) = 1323
				for (j = 1; j < eventGains.length; j++) {
					eventGains[j] = (eventGains[j] * 1764); //1323
					if (eventGains[j] > 6)
						eventGains[j] = 6;
					else if (eventGains[j] < -6)
						eventGains[j] = -6;

					// console.log('event '+ j + ' - volume: ' + eventGains[j]);
					eventGains[j] = Math.pow(10, (eventGains[j]/20));
					// console.log('event '+ j + ' - gain: ' + eventGains[j]);

				}
				
				///emiting to client
				console.log('>> sending array to client-' + (clientIndex + 1) + ' onsets: ' + onsets + ' volumes: ' + eventGains);
				io.emit('message', {
					type: 'eventOnsetArrays',
					id: clientIndex,
					data: onsets,
					gains: eventGains
				});

				//get mute time from reference clients last onset + 
				if (clientIndex === 0) {
					muteTime = onsets[onsets.length - 1] + 1.5;
					//console.log('set muteTime to: ' + muteTime);
				}
				// muteTime = -Infinity;

				eventOnsetArrays[clientIndex] = [];
				diffdiffArrays[clientIndex] = [];
				eventIndex = 0;
			}

			resetOnsets();
		}
	}

	function resetOnsets() {
		numReceivedTelefunkers = 0;

		for (var clientIndex = 0; clientIndex < sockId.maxClients; clientIndex++)
			telefunkerBuffers[clientIndex] = null;
	}

	function getDiff(i,j,e) {
		var diffClient = (eventOnsetArrays[i][e] - eventOnsetArrays[i][0]);
		var diffClientNext = (eventOnsetArrays[j][e] - eventOnsetArrays[j][0]);
		var diffDiff = diffClientNext - diffClient;
		// console.log('    ' + eventOnsetArrays[i][e]);
		return diffDiff;
	}

	function receiveOnsetSamples(values) {
		var idx = values.myID - 1;
		var onsetSamples = values.onsetSamples;
		var onsetTime = values.onsetTime;
		var sampleRate = values.sampleRate;
		var corrSampleOffset = values.corrSampleOffset;
		var corrWindowSize = values.corrWindowSize;
		var hack480problemo = values.hack480problemo;
		var clientIndex;

		console.log('.' + idx);

		if (telefunkerBuffers[idx] === null)
			numReceivedTelefunkers++;

		telefunkerBuffers[idx] = onsetSamples;
		telefunkerOnsetTimes[idx] = onsetTime;
		telefunkerProblemo[idx] = hack480problemo;

		if (numReceivedTelefunkers === sockId.maxClients) {

			if (telefunkerOnsetTimes[0] > muteTime) { // wir sind vor der auszeit
				var bufferSize = telefunkerBuffers[0].length;
				var corrWindow = telefunkerBuffers[0].slice(corrSampleOffset, corrSampleOffset + corrWindowSize);
				var eventOnsets = [];
				eventOnsets[0] = telefunkerOnsetTimes[0];

				var crossCorrQuality = [];

				crossCorrQuality[0] = Infinity;

				//console.log('ReferenceOnsetTimes of client: 1 = ' + eventOnsetArrays[0]);
				for (clientIndex = 1; clientIndex < sockId.maxClients; clientIndex++) {
					var crossCorr = normCrossCorrelation(telefunkerBuffers[clientIndex], corrWindow);
					var maxValues = getMaximumValues(crossCorr);
					var maxIndex = maxValues[0] + corrSampleOffset;
					var crossCorrDiffTime = maxIndex / sampleRate;
					var correctedOnsetTime = telefunkerOnsetTimes[clientIndex] + crossCorrDiffTime;
					// console.log('crossCorrDiffTime: '+ crossCorrDiffTime);

					//write onset corrected by cross-correlation to array
					eventOnsets[clientIndex] = correctedOnsetTime;
					//console.log('correctedOnsetTimes of client: ' + (clientIndex + 1) + ' = ' + eventOnsets[clientIndex]);

					var quality = maxValues[1];

					if (quality < 0.4) {
						console.log('x--o (' + quality + ')');
						return;
					}

					crossCorrQuality[clientIndex] = quality;
					// console.log('quality: '+ quality);
				}

				//write onset corrected by crosscorrelation to array
				//use client with idx 0 as reference
				for (clientIndex = 0; clientIndex < sockId.maxClients; clientIndex++)
					eventOnsetArrays[clientIndex][eventIndex] = eventOnsets[clientIndex];

				//difference calculaton----------------------------------

				if (eventIndex === 0) {
					console.log('###### 0 (0samples)');
				} else {
					for (clientIndex = 0; clientIndex < sockId.maxClients; clientIndex++) {
						nextClientIndex = (clientIndex + 1) % sockId.maxClients;
						//console.log('clientIndex: '+ clientIndex);
						diffDiff = getDiff(clientIndex, nextClientIndex, eventIndex);
						diffdiffArrays[clientIndex][eventIndex] = diffDiff;

						var diffDiffSamples = Math.floor(diffDiff * sampleRate + 0.5);
						if (Math.abs(diffDiff) > 0.02) {
							console.log('<--> (' + diffDiff + ')');
							return;
						}
						// if (clientIndex > 0)
							console.log('####### ' + eventIndex + ' (' + diffDiffSamples + ' samples - diffDiff: ' + diffdiffArrays[clientIndex][eventIndex] + ' quality: ' + crossCorrQuality[clientIndex] + ')');
						
					}
				}

				//comment this to store event criterias
				//saveMultipleArraysInterleaved(telefunkerBuffers, sockId.maxClients, eventIndex + '-onset-samples' + '.txt');

				if (sendEventsTimeout)
					clearTimeout(sendEventsTimeout);

				sendEventsTimeout = setTimeout(sendEventOnsetArrays, 1300);

				eventIndex++;
			} else {
				// console.log('muted---incoming telefunkerOnsetTimes: ' + telefunkerOnsetTimes[0] + ' --- muteTime: ' + muteTime);
				console.log('.m');
			}

			resetOnsets();
			// reset receiver
		}
	}

	function getMaximumValues(array) {
		var max = array[0];
		var maxIndex = 0;
		var maxValue = 0;

		for (var i = 1; i < array.length; i++) {
			if (array[i] > max) {
				max = array[i];
				maxIndex = i;
				maxValue = max;
			}
		}
		// console.log('---maxIndex: ' + maxIndex + ' maxValue: ' + maxValue);
		return [maxIndex, maxValue];
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


	function normCrossCorrelation(buffer, window) {
		var windowSize = window.length;
		var crossCorrSize = buffer.length - windowSize;
		var crossCorr = [];
		var norm = 1 / windowSize;
		var bufferSum = 0;
		var bufferSumOfSquare = 0;
		var b, w;

		var windowSum = 0;
		var windowSumOfSquare = 0;

		for (i = 0; i < windowSize; i++) {
			w = window[i];
			windowSum += w;
			windowSumOfSquare += w * w;

			b = buffer[i];
			bufferSum += b;
			bufferSumOfSquare += b * b;
		}

		var windowMean = norm * windowSum;
		var windowMeanOfSquare = norm * windowSumOfSquare;
		var windowSquareOfmean = windowMean * windowMean;
		var windowStdDev = 0;

		if (windowMeanOfSquare > windowSquareOfmean)
			windowStdDev = Math.sqrt(windowMeanOfSquare - windowSquareOfmean);

		var bufferMean = norm * bufferSum;
		var bufferMeanOfSquare = norm * bufferSumOfSquare;
		var bufferSquareOfmean = bufferMean * bufferMean;
		var bufferStdDev = 0;

		if (bufferMeanOfSquare > bufferSquareOfmean)
			bufferStdDev = Math.sqrt(bufferMeanOfSquare - bufferSquareOfmean);

		var crossCorrSum = 0;

		for (i = 0; i < windowSize; i++) {
			w = window[i];
			b = buffer[i];
			crossCorrSum += (b - bufferMean) / bufferStdDev * (w - windowMean) / windowStdDev;
		}

		crossCorr[0] = norm * crossCorrSum;
		//console.log('  ', crossCorr[0]);

		for (var j = 1; j < crossCorrSize; j++) {
			crossCorrSum = 0;

			var prevB = buffer[j - 1];
			var nextB = buffer[j + crossCorrSize - 1];
			bufferSum += (nextB - prevB);
			bufferSumOfSquare += (nextB * nextB - prevB * prevB);

			for (i = 0; i < windowSize; i++) {
				w = window[i];
				b = buffer[i + j];
				crossCorrSum += (b - bufferMean) / bufferStdDev * (w - windowMean) / windowStdDev;
			}

			crossCorr[j] = norm * crossCorrSum;
			//console.log('  ', crossCorr[j]);
		}

		return crossCorr;
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