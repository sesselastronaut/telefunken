var auProc = {

  id: null,
  recording : false,
  buffer : null,
  bufferSize: 16384, //2048, // number of samples to collect before analyzing



  sampleThreshold: 0.189, //Linux = 0.32
  sampleThresholdPhone: 0.7, //nexus 3 = 0.7 nexus 4 = 0.55

  recordingTime: 2,

  worker: new Worker("js/audioWorker.js"),

  //set threshold depending on OS
  setThreshold: function setThreshold(string) {
    var a = string.split(' ');
    //console.log(a[0]);
    if(a[0] === "Android") this.sampleThreshold = this.sampleThresholdPhone;
  },

  resetTimeSync: function(){
    this.worker.postMessage({
      command: 'resetTimeSync',
      values: {
        syncOnOnset: true
      }
    });
  },


  // Entry point
  init: function init(stream) {
    var that = this;

    //console.log('posting init to worker');
    ////sending init to worker
    this.worker.postMessage({
      command: 'init',
      values: {
        threshold: this.sampleThreshold,
        bufferSize: this.bufferSize,
        id: this.id,
        sampleRate: audioContext.sampleRate
      }
    });


    this.oscillatorNode = audioContext.createOscillator();
    this.oscillatorNode.type = 1; //2;
    this.oscillatorNode.frequency = audioContext.sampleRate / this.bufferSize;

    this.audioStream = stream;
    this.recorder = new Recorder(this.recordingTime);

    // create the media stream from the audio input source (microphone)
    this.sourceNode = audioContext.createMediaStreamSource(stream);
    this.merger = audioContext.createChannelMerger(2);
    this.jsNode = audioContext.createScriptProcessor(this.bufferSize, 2, 1);

    //start highpass filter----------------------------------
    // var filter = audioContext.createBiquadFilter();
    // filter.type = filter.HIGHPASS;
    // filter.frequency.value = 20;
    // this.sourceNode.connect(filter);
    // filter.connect(this.jsNode);
    // //end highpass filter----------------------------------

    this.sourceNode.connect(this.merger, 0, 0);
    this.oscillatorNode.connect(this.merger, 0, 1);

    this.merger.connect(this.jsNode);
    this.jsNode.connect(audioContext.destination);
    console.log('////audio nodes set up');

    console.log('____________starting analyzing mic audio_______ on:', platform.os.family);
    //platform/OS check to set threshold
    this.setThreshold(platform.os.family);

    console.log('sampleThreshold: ', this.sampleThreshold);

    // analyze audio from microphone
    // take first stimulus as a calibration for the time
    this.jsNode.onaudioprocess = function(event) {
      //var frame = event.inputBuffer.getChannelData(0);

      that.worker.postMessage({
        command: 'processaudio',
        inputFrame: event.inputBuffer.getChannelData(0),
        timeRefFrame: event.inputBuffer.getChannelData(1),
      });

      //recording------------------------------------------------
      if (that.recording) {
        that.recording = that.recorder.input(frame[i]);

        if (!that.recording) that.recorder.setupSave('output.wav');
      }
      //----------------------------------------------------------

    };

    this.worker.onmessage = function(event) {
      switch (event.data.type) {
        case 'stopRecording':
          //stop recording----------------------------
          that.recorder.setupSave('output.wav');
          that.jsNode.onaudioprocess = null;
          if (that.audioStream) that.audioStream.stop();
          if (that.sourceNode) that.sourceNode.disconnect();
          document.querySelector('.status-holder').innerHTML = '--sending max array--';
          // console.log(event);
          break;

        case 'through':
          socket.emit('message', event.data.sub);
          break;
      }
    };

  },

  startRecording: function startRecording(e) {
    this.recording = true;
    console.log('----this.recording state: ', this.recording);
  },

  play: function play() {
    var source = audioContext.createBufferSource(); // creates a sound source
    source.buffer = this.buffer; // tell the source which sound to play
    source.connect(audioContext.destination); // connect the source to the context's destination (the speakers)
    source.start(0); // play the source now
    console.log('///play signal!');
    var time = audioContext.currentTime; //set a timestamp
  }

};