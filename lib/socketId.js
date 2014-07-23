var newIDaccepted = false;
var connectedClients = [];
var connectedMics = [];
var maxClients = 2;
var counter = 1;


function clear(io, id) {
  console.log('___client ', id, 'sended reset from client');
  connectedClients = [];
  connectedMics = [];
  counter = 1;
  ////////emitting to client
  io.emit('message', {
    type: 'reset',
    data: id
  });
  //console.log('___Nr of connected clients:', connectedClients.length);
  setStatus(io);
}



function setStatus(io) {

  console.log('____connected clients = ', connectedClients.length);
  var status;
  if (connectedClients.length === 0) {
    status = '-- waiting for participants --';
//   } else if (connectedClients.length === maxClients) {
//     status = '-- ' + connectedClients.length + ' of ' + maxClients + ' - all in - let\'s synchronize--';
// /*    io.emit('message', {
//       type: 'allConnected'
//     });*/
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


//did client accept new ID
function setIDstatus(io, data) {
  var clientStatus = data.clientStatus;
  var id = data.myID;
  //console.log('___client ' + id + ' status is: ' + clientStatus);
  if (clientStatus === true) {
    counter += 1;
    newIDaccepted = true;
    console.log('___client ' + id + ' accepted new ID');
    //add ID to array
    connectedClients.push(id);
  }
  console.log('next assigned ID will be: ','phone' + (counter));

  setStatus(io);
}

//are all mics of the clients set to 'allow'
function setMics(io, id) {
  
  connectedMics.push(id);
  console.log('___connected mics: ', connectedMics.length);
  
  if (connectedMics.length === maxClients){
    io.emit('message', {
      type: 'allConnected'
    });
    console.log('___emiting: all mics are connected - start synchronization');
  }
}



// landing page logic to update the template vars
module.exports.landingPage = function(vars) {
  if (connectedClients.length >= maxClients) {
    var ms = 'pardon, tutti completti - no more IDs available';
    vars.message = ms;
    vars.serverID = '';
    console.log(ms);
  } else {
    vars.message = '';
    vars.serverID = 'phone' + (counter); //shortid.generate()
  }
};

module.exports.maxClients = maxClients;

// hooks up id specific socket events
module.exports.listenEvents = function(io, socket) {

  socket.on('message', function(message) {
    var type = message.type;
    switch (type) {
      case 'clear':
        clear(io, message.data);
        break;

      case 'clientID':
        setIDstatus(io, message.data);
        break;

      case 'micReady':
        setMics(io, message.data);
        break;
    }
  });

};