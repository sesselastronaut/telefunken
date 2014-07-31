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

//receiving from server\\\\\\\\\
socket.on('message', function(message) {
	var type = message.type;
	console.log('message type received: ', message.type);
	switch (type) {
		case 'connectionStatus':
			setConnectionStatus(message.data);
			break;
		case 'timeReset':
			auProc.resetTimeSync();
			break;
		case 'setTimeGap':
			//console.log('-----------timeGap: ' + message.data);
			auProc.timeGap = message.data;
			break;
	}
});

//status display
function setConnectionStatus(status) {
	console.log('status received: ', status);
	document.querySelector('.status-holder').innerHTML = status;
}

// function resetTime {

// }

function microReady(stream) {
	//display telefunker ID in UI
	document.querySelector('h1 span').innerHTML = sockId.id;

	auProc.id = sockId.id;
	sockId.micReady(); //emit mic ready
	sockId.allConnected = function() {
		auProc.init(stream);
		document.querySelector('.status-holder').innerHTML = '--all in - let\'s synchronize--';
	};
}


function init() {

	sockId = socketId(socket);
	
	//display ID on UI
	document.querySelector('h1 > span').innerHTML = localStorage.getItem('myID');

	//recording buttonis
	document.querySelector('#record').addEventListener('click', function() {
		auProc.startRecording();
		this.disabled = true;
	});

	document.querySelector('#stopRec').addEventListener('click', function() {
		auProc.stopRecording();
		//this.disabled = true;
	});

	//clear buttoni
	document.querySelector(".clear_button").addEventListener('click', function() {
		////////emitting to server
		socket.emit('message', {
			type: 'clear',
			data: sockId.id
		});
	});

	//reset buttoni
	document.querySelector(".reset_button").addEventListener('click', function() {
		////////emitting to server
		socket.emit('message', {
			type: 'resetTime',
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


	// get the input audio stream and set up the nodes
	try {
		var settings = {
			video: false,
			audio: true
		};
		
		console.log('asking for mic access');
		document.querySelector('.status-holder').innerHTML = 'asking for mic access';
		
		navigator.getUserMedia(settings, microReady, onError);
	} catch (e) {
		alert('webkitGetUserMedia threw exception :' + e);
	}

}