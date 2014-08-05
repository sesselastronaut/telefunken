var auProc = {

  id: null,
  buffer : null,
  bufferSize: 16384, //2048, // number of samples to collect before analyzing

  sampleThreshold: 0.189, //Linux = 0.32
  sampleThresholdPhone: 0.93, //nexus 3 = 0.7 nexus 4 = 0.55

  onsetThreshold: 0.0,
  onsetThresholdOnAndroidPhone: 0.8,
  onstThresholdByDefault: 0.8,


  worker: new Worker("js/audioWorker.js"),

  //set threshold depending on OS
  setThreshold: function setThreshold(string) {
    var a = string.split(' ');
    console.log("a[0]: " + a[0]);

    if(a[0] === "Android")
      this.onsetThreshold = this.onsetThresholdOnAndroidPhone;
    else
      this.onsetThreshold = this.onstThresholdByDefault;
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

    //platform/OS check to set threshold
    this.setThreshold(platform.os.family);

    //console.log('posting init to worker');
    ////sending init to worker
    this.worker.postMessage({
      command: 'init',
      values: {
        id: this.id,
        onsetThreshold: this.onsetThreshold,
        bufferSize: this.bufferSize,
        sampleRate: audioContext.sampleRate,
        minInterOnsetTime: this.minInterOnsetTime
      }
    });

    // create a sawtooth as a reference signal
    this.audioBuffer = audioContext.createBuffer(1, audioContext.sampleRate, audioContext.sampleRate);
    var buf = this.audioBuffer.getChannelData(0);

    for(var i = 0; i < buf.length; i ++)
      buf[i] = i;

    this.refSource = audioContext.createBufferSource();
    this.refSource.buffer = this.audioBuffer;
    this.refSource.loop = true;
    this.refSource.start(0);


    // create the media stream from the audio input source (microphone)
    this.audioInput = audioContext.createMediaStreamSource(stream);
    this.audioInputSplitter = audioContext.createChannelSplitter(2);
    this.merger = audioContext.createChannelMerger(2);
    this.jsNode = audioContext.createScriptProcessor(this.bufferSize, 2, 2);

    //filter----------------------------------
    this.filter = audioContext.createBiquadFilter();
    this.filter.type = this.filter.LOWPASS;
    this.filter.frequency.value = 10000;
    this.filter.Q.value = 0;

    this.audioInput.connect(this.audioInputSplitter);
    this.audioInputSplitter.connect(this.filter, 0, 0);
    this.filter.connect(this.merger, 0, 0);

    this.refSource.connect(this.merger, 0, 1);
    this.merger.connect(this.jsNode);
    this.jsNode.connect(audioContext.destination);

    console.log('////audio nodes set up');

    console.log('____________starting analyzing mic audio_______ on:', platform.os.family);

    // analyze audio from microphone
    // take first stimulus as a calibration for the time
    this.jsNode.onaudioprocess = function(event) {
      that.worker.postMessage({
        command: 'processaudio',
        inputFrame: event.inputBuffer.getChannelData(0),
        timeRefFrame: event.inputBuffer.getChannelData(1),
      });

    };

    this.worker.onmessage = function(event) {
      switch (event.data.type) {
        case 'saveRecording':
          //save recording
          var audioBlob = event.data.values;
          var url = (window.URL || window.webkitURL).createObjectURL(audioBlob);
          var save = document.getElementById("save");
          save.href = url;
          save.disabled = false;
          save.download = 'output.wav';
          console.log(audioBlob);

          //stop recording----------------------------
          that.jsNode.onaudioprocess = null;
          // if (that.audioStream) that.audioStream.stop();
          if (that.audioInput) that.audioInput.disconnect();
          document.querySelector('.status-holder').innerHTML = '--stopped recording--';
          // console.log(event);
          break;

        case 'through':
          socket.emit('message', event.data.sub);
          break;
          
        case 'play':
          that.play();
          break;
      }
    };

  },

  startRecording: function startRecording(e) {
    //sent start recording to worker 
    this.worker.postMessage({
      command: 'startRecording',
    });
  },

  stopRecording: function stopRecording(e) {
    //sent stop recording to worker
    this.worker.postMessage({
      command: 'stopRecording',
    });
  },

  startCriteriaRec: function startCriteriaRec(e) {
    //sent start startCriteriaRec to worker 
    this.worker.postMessage({
      command: 'startCriteriaRec',
    });
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