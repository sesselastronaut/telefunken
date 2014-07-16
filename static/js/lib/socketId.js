function socketId(socket) {

  if (!(this instanceof socketId)) return new socketId(socket);

  var that = this;

  if(!serverID) {
    console.error('You need to set the serverID global in the template for this to work.');
    return;
  }

  this.id = null;

  socket.on('message', function(message) {
    var type = message.type;
    
    switch (type) {
      case 'reset':
        localStorage.clear();
        break;

      case 'allConnected':
        that.allConnected();
        //console.log('Socket status allconnected received : ', that.allConnected);
        break;
    }
  });



  //if localStorage cookie/ID is not set 
  this.id = localStorage.getItem('myID');

  //start ID-check---------------------------------
  if (!this.id) {
    localStorage.setItem('myID', serverID);
    this.id = localStorage.getItem('myID');

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

socketId.prototype.micReady = function() {
  ////////emitting to client
  socket.emit('message', {
    type: 'micReady',
    data: this.id
  });
};