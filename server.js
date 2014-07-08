/* TODO
 *
 */


// dependencies
var http = require('http');
var io = require('socket.io');
var shortid = require('shortid');
// config file
var app = require('./config')();
// declare and setup servers
var server = http.createServer(app);
var io = require('socket.io')(server);
//storage of files
var fs = require('fs');

var maxClients = 4;
var connectedClients = [];
var counter = 1;



// entry point
app.get('/', function(req, res) {
	vars = {
		title: '}----{}--{ritmo quattro stationi}--{}---{'
	};

	if (connectedClients.length >= maxClients) {
		var ms = 'pardon, tutti completti - no more IDs available';
		vars.message = ms;
		vars.serverID = '';
		console.log(ms);
	} else {
		vars.message = '';
		vars.serverID = 'phone' + (counter); //shortid.generate()
	}
	//pass an unique id from server to the phone 
	res.render('layout', vars);
});

///// start socket communication---------------------------------------------------
// Socket events
io.on('connection', function(socket) {

/*	////////emitting to client
	socket.emit('message', {
		type: 'getIDfromclient'
	});*/

	//receiving\\\\\\\\\
	socket.on('message', function(message) {
		var type = message.type;
		switch (type) {
			case 'clear':
				clear(message.data);
				break;

			case 'clientID':
				setIDstatus(message.data);
				break;

			case 'sending_max_array':
				saveMaxarraysamples(message.data);
				break;
		}
	});


	function clear(id) {
		console.log('clear from client:', id);
		connectedClients = [];
		counter = 1;
		////////emitting to client
		io.emit('message', {
			type: 'reset',
			data: id
		});
		console.log('Nr of connected clients:', connectedClients.length);
		setStatus();
	}

	newIDaccepted = false;
	//did client accept new ID
	function setIDstatus(data) {
		var clientStatus = data.clientStatus;
		var id = data.myID;
		console.log('status of client ' + id + ' = ' + clientStatus);
		if (clientStatus === true) {
			counter += 1;
			newIDaccepted = true;
			console.log('newIDaccepted by___', id);
			//add ID to array
			connectedClients.push(id);
		}
		console.log('next assigned ID will be: ','phone' + (counter));
		setStatus();
	}


	function saveMaxarraysamples(data) {
		var ringSamples = data.samplearray;
		var id = data.myID;
		var filename = id + '-event' + ".csv";
		fs.writeFile(filename, ringSamples.toString(), function(err){
			if (err) throw err;
			console.log('saved incoming max samplearray from: ', id);
		});
	}

	function setStatus() {
		console.log('connectedClients = ', connectedClients.length);
		var status;
		if (connectedClients.length === 0) {
			status = '-- waiting for participants --';
		} else if (connectedClients.length === maxClients) {
			status = '-- ' + connectedClients.length + ' of ' + maxClients + ' - all in - let\'s synchronize--';
			io.emit('message', {
				type: 'allConnected'
			});
		} else {
			status = '- We\'re ' + connectedClients.length + ' of ' + maxClients + ' participants -';
		}
		////////emitting to client
		console.log('---Status sent to connected clients:', status);
		io.emit('message', {
			type: 'connectionStatus',
			data: status
		});
	}
});
///// end socket communication---------------------------------------------------



// launch HTTP server
server.listen(app.get('port'), function() {
	console.log('Express server listening on port ' + app.get('port'));
});