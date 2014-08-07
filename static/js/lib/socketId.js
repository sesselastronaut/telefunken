function socketId(socket) {

  if (!(this instanceof socketId)) return new socketId(socket);

  var that = this;

  if(!serverID) {
    console.error('You need to set the serverID global in the template for this to work.');
    return;
  }

  this.id = -1;

  socket.on('message', function(message) {
    var type = message.type;
    
    switch (type) {
      case 'reset':
        console.log('>reset_received<');
        localStorage.clear();
        break;

      case 'allConnected':
        //console.log('Socket status allconnected received : ', type);
        that.allConnected();
        break;
    }
  });

  //if localStorage cookie/ID is not set 
  var idStr = localStorage.getItem('myID');

  //start ID-check---------------------------------
  if (idStr) {
    this.id = Number.parseInt(idStr);
  } else {
    localStorage.setItem('myID', serverID);
    idStr = localStorage.getItem('myID');

    this.id = Number.parseInt(idStr);

    ////////emitting to server
    socket.emit('message', {
      type: 'clientID',
      data: {
        myID: this.id,
        clientStatus: true
      }
    });
  }
}
