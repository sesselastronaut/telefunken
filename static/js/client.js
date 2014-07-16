<<<<<<< HEAD
// we set a global instance of the webaudio
window.audioContext = window.audioContext || new AudioContext();

document.addEventListener('DOMContentLoaded', init);

// General helper functions
// ------------------------

function onError(e) {
    console.error(e);
}

function loadFile(url, cb) {
    var request = new XMLHttpRequest();
    request.open('GET', url, true);
    request.responseType = 'arraybuffer';
    request.onload = function() {
        audioContext.decodeAudioData(request.response, function(b) {
            cb(b);
        }, onError);
    };
    request.send();
}


///// start ID check and socket communication---------------------------------------------------
var socket = io(document.URL);
var sockId;
=======
// Global Variables for Audio recording
var analyserNode;
var javascriptNode;
var bufferSize = 16384; // number of samples to collect before analyzing
var amplitudeArray; // array to hold frequency data
var audioStream;
var buffer;

var syncTime = 0.0;
var syncCount = 0;
var peaksample = -1;

var ringSamples = [];
var ringIndex = 0;
var ringSize = 3000;

var lastSample = 0;
var lastLastSample = 0;

var maxSample = -999;
var maxSampleTime = 99999999999;
var maxSampleCount = 0;

var playbackTime = 0;
var playbackCount = 0;

var syncOnOnset = false;
var lastOnsetTime = -999;
var nrConnections = -1;

//debugging on screen
function debugtime(string) {
    document.getElementById("time").innerHTML = string;
}
function debugpeaksample(string) {
    document.getElementById("peaksample").innerHTML = string;
}
function debugsamplevalue(string) {
    document.getElementById("samplevalue").innerHTML = string;
}



///// start socket communication---------------------------------------------------
var socket = io(document.URL);

//if localStorage cookie/ID is not set 
var myID = localStorage.getItem('myID');

document.addEventListener('DOMContentLoaded', init);
>>>>>>> 330c0c30dd13e6d27e181079145fd3f007356d93

//receiving\\\\\\\\\
socket.on('message', function(message) {
	var type = message.type;
	console.log('message type received: ', message.type);
	switch (type) {
<<<<<<< HEAD
			case 'connectionStatus':
			setConnectionStatus(message.data);
			break;
	}
});

//status display
function setConnectionStatus(status) {
	console.log('status received: ', status);
	document.querySelector('.status-holder').innerHTML = status;
}

function microReady(stream) {
  //display phone ID in UI
	document.querySelector('h1 span').innerHTML = sockId.id;

  auProc.id = sockId.id;
  sockId.micReady();
  sockId.allConnected = function() {
		auProc.init(stream);
		document.querySelector('.status-holder').innerHTML = '--all in - let\'s synchronize--';
  };
}


function init() {

	//platform check
/*	cosima.check.platform();
	var osVersion = parseVersionString(platform.os.version);*/
	//console.log(platform.os.family);

	sockId = socketId(socket);
	
	//display ID on UI
	document.querySelector('h1 > span').innerHTML = localStorage.getItem('myID');

	document.querySelector('#record').addEventListener('click', function() {
		auProc.startRecording();
		this.disabled = true;
	});

	//clear buttoni
	document.querySelector(".clear_button").addEventListener('click', function() {
		////////emitting to client
		socket.emit('message', {
			type: 'clear',
			data: sockId.id
		});
	});

	//load sample file
	loadFile('./snd/quak.wav', function(b) {
		auProc.buffer = b;
		console.log('///sound loaded!');
	});

	// playing the sound
	// auProc.play()


=======

		case 'connectionStatus':
			setConnectionStatus(message.data);
			break;

		case 'allConnected':
			syncOnOnset = true;
			console.log(syncOnOnset);
			break;

		case 'reset':
			resetLocalstorage(message.data);
			break;
	}
});


//status display
function setConnectionStatus(status) {
	console.log('status received: ',status);
	document.querySelector('.status-holder').innerHTML = status;
}

//reset localstorage
function resetLocalstorage(id) {
	console.log('reseting', id);
	localStorage.clear();
}

///// end socket communication---------------------------------------------------

function loadFile(url, cb) {
	var request = new XMLHttpRequest();
	request.open('GET', url, true);
	request.responseType = 'arraybuffer';
	request.onload = function() {
		audioContext.decodeAudioData(request.response, function(b) {
			cb(b);
		}, onError);
	};
	request.send();
}

function playFile() {
	var source = audioContext.createBufferSource(); // creates a sound source
	source.buffer = buffer; // tell the source which sound to play
	source.connect(audioContext.destination); // connect the source to the context's destination (the speakers)
	source.start(0); // play the source now
	console.log('///play signal!');
	var time = audioContext.currentTime; //set a timestamp
	debugtime(time);
}



function setupAudioNodes(stream) {

	if (!myID) {
		localStorage.setItem('myID', serverID);
		myID = localStorage.getItem('myID');
		////////emitting to client
		socket.emit('message', {
			type: 'clientID',
			data: {myID: myID, clientStatus: true}
		});
	}
	//display phone ID in UI
	document.querySelector('h1 span').innerHTML = myID;

	// create the media stream from the audio input source (microphone)
	sourceNode = audioContext.createMediaStreamSource(stream);
	audioStream = stream;

	javascriptNode = audioContext.createScriptProcessor(bufferSize, 1, 1);

	// analyze audio from microphone
	// take first stimulus as a calibration for the time
	javascriptNode.onaudioprocess = function(event) {
		var frame = event.inputBuffer.getChannelData(0);
		var time = playbackTime;
		var count = playbackCount;
		var timeIncr = 1.0 / audioContext.sampleRate;

		//audio analysis                        
		for (var i = 0; i < frame.length; i++) {
			var sample = Math.abs(frame[i]);
			//console.log('inside frame');
			ringSamples[ringIndex] = sample;

			if (time > maxSampleTime + 0.05 && maxSampleTime > lastOnsetTime) {
				debugtime(maxSampleTime - syncTime);

				debugsamplevalue(sample); //value of sample at onset
				console.log('abs max at:', maxSampleTime);

				var ringStartCount = count - ringSize;
				var maxRingIndex = maxSampleCount - ringStartCount;

				console.log('max in Ring at Index: ', maxRingIndex);
				debugpeaksample(maxRingIndex);

				var initialRingSamples = []; //setup an array to write the initial ringsamples for debugging
				for (var j = 0; j < ringSamples.length; j++) {
					var k = (j + ringIndex) % ringSize;

					initialRingSamples[j] = ringSamples[k];
					//console.log ('k',k, 'j',j,'samplevalue',initialRingSamples [j], 'maxSampleTime', maxSampleTime);

					if (j === maxRingIndex) {
						console.log('maximum: ', ringSamples[k]);
						debugsamplevalue(ringSamples[k]); //print value of sample at maximum on screen
						//initialRingSamples [maxRingIndex] = ringSamples[k];
					} else {
						//console.log('......', j, ':', ringSamples[k]);
						//initialRingSamples [j] = ringSamples[k];
					}
				}

				//sending the second maximum array to server and stop
				if (syncOnOnset === false) {

					////////emitting to client
					socket.emit('message', {
						type: 'sending_max_array',
						data: {myID: myID, samplearray: initialRingSamples.join('\n')}
					});
					document.querySelector('.status-holder').innerHTML = 'sending data to server';

					//stop recording
					console.log('-----stopping-----');
					javascriptNode.onaudioprocess = null;
					if (audioStream) audioStream.stop();
					if (sourceNode) sourceNode.disconnect();
				}

				//sychronize time on first maximum
				if (syncOnOnset === true) {
					console.log('time synchronization!');
					syncOnOnset = false;
					syncTime = maxSampleTime;
					syncCount = count;
					document.querySelector('.status-holder').innerHTML = 'sychronized time now';

					////////emitting to client
					socket.emit('message', {
						type: 'sending_max_array',
						data: {myID: myID+'sync', samplearray: initialRingSamples.join('\n')}
					});
				}

				lastOnsetTime = maxSampleTime;
			}

			//find maximum in signal but first apply threshold on signal to filter noise
			if (sample > 0.07) {
				if (time > maxSampleTime + 0.050 || sample > maxSample) {
					maxSample = sample;
					maxSampleTime = time;
					maxSampleCount = count;
				}
			}

			time += timeIncr;
			count++;

			ringIndex = (ringIndex + 1) % ringSize;

			lastLastSample = lastSample;
			lastSample = sample;
		}

		playbackCount += bufferSize;
		playbackTime += bufferSize / audioContext.sampleRate;
	};

	sourceNode.connect(javascriptNode);
	javascriptNode.connect(audioContext.destination);
	console.log('////audio nodes set up');

}


function init(){
	document.querySelector('h1 > span').innerHTML = localStorage.getItem('myID');

	//load sample file
	loadFile('./snd/quak.wav', function(b) {
		buffer = b;
		console.log('///sound loaded!');
	});

>>>>>>> 330c0c30dd13e6d27e181079145fd3f007356d93
	// get the input audio stream and set up the nodes
	try {
		var settings = {
			video: false,
			audio: true
		};
<<<<<<< HEAD
		
		console.log('asking for mic access');
		document.querySelector('.status-holder').innerHTML = 'asking for mic access';
		
		navigator.getUserMedia(settings, microReady, onError);
	} catch (e) {
		alert('webkitGetUserMedia threw exception :' + e);
	}

}
=======
		console.log('asking for mic access');
		document.querySelector('.status-holder').innerHTML = 'asking for mic access';
		navigator.getUserMedia(settings, setupAudioNodes, onError);
	} catch (e) {
		alert('webkitGetUserMedia threw exception :' + e);
	}
	//clear buttoni
	document.querySelector(".clear_button").addEventListener('click', function() {
		////////emitting to client
		socket.emit('message', {
			type: 'clear',
			data: myID
		});
	});
	
}
>>>>>>> 330c0c30dd13e6d27e181079145fd3f007356d93
