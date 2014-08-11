window.audioContext = window.audioContext || new AudioContext();

var prevfreq = 0;

var auProc = {

  id: null,
  buffer : null,
  bufferSize: 16384, //2048, // number of samples to collect before analyzing

  isEnabled: false,

  worker: new Worker("js/audioWorker.js"),

  resetTimeSync: function(){
    this.worker.postMessage({
      command: 'resetTimeSync',
      values: {
        syncOnOnset: true
      }
    });
  },
  receiveDistTimeDiff: function(distId, distance){
    // play(0);
    if ((this.id -1) === distId) {
      console.log('id: '+ distId + ' distanceTime: ' + (distance*100000));
      //this.play(Math.abs(distance)*1000);
      var freq = distance * 10000;
      this.osc.frequency.value = (Math.abs(prevfreq - freq));
      prevfreq = freq;
    }
  },

  // Entry point
  init: function init(id, stream) {
    var that = this;

    this.id = id;

    //platform/OS dependend audio settings
    var onsetThreshold = 0.9;
    var hack480problemo = false;

    var a = platform.os.family.split(' ');
    console.log("a[0]: " + a[0]);

    if(a[0] === "Android"){
      //onsetThreshold = 0.8;
      hack480problemo = true;
    }

    console.log(this.id + ' is posting init to worker');
    ////sending init to worker
    this.worker.postMessage({
      command: 'init',
      values: {
        id: this.id,
        bufferSize: this.bufferSize,
        sampleRate: audioContext.sampleRate,
        onsetThreshold: onsetThreshold,
        hack480problemo: hack480problemo,
      }
    });

    //audiocontext------------------
    this.jsNode = audioContext.createScriptProcessor(this.bufferSize, 2, 2);
    this.jsNode.connect(audioContext.destination);

    this.merger = audioContext.createChannelMerger(2);
    this.merger.connect(this.jsNode);

    // input filter----------------------------------
    this.filter = audioContext.createBiquadFilter();
    this.filter.type = this.filter.LOWPASS;
    this.filter.frequency.value = 2000;
    this.filter.Q.value = 0;
    this.filter.connect(this.merger, 0, 0);

    // create the media stream from the audio input source (microphone)
    this.audioInputSplitter = audioContext.createChannelSplitter(2);
    // this.audioInputSplitter.connect(this.merger, 0, 0);
    this.audioInputSplitter.connect(this.filter, 0, 0);
    
    this.audioInput = audioContext.createMediaStreamSource(stream);
    this.audioInput.connect(this.audioInputSplitter);

    // create a sawtooth as a reference signal to be send on channel 1
    this.audioBuffer = audioContext.createBuffer(1, audioContext.sampleRate, audioContext.sampleRate);
    var buf = this.audioBuffer.getChannelData(0);

    for(var i = 0; i < buf.length; i ++)
      buf[i] = i;

    this.refSource = audioContext.createBufferSource();
    this.refSource.buffer = this.audioBuffer;
    this.refSource.loop = true;
    this.refSource.start(0);
    this.refSource.connect(this.merger, 0, 1);

    //create a sinewave to be modulated 
    this.osc = audioContext.createOscillator();
    this.osc.connect(audioContext.destination);
    this.osc.noteOn(0);
    this.osc.frequency.value = 0;

    console.log('////audio nodes set up');

    console.log('____________starting analyzing mic audio_______ on:', platform.os.family);

    // analyze audio from microphone
    this.jsNode.onaudioprocess = function(event) {
      if (that.isEnabled) {
        that.worker.postMessage({
          command: 'processaudio',
          inputFrame: event.inputBuffer.getChannelData(0),
          timeRefFrame: event.inputBuffer.getChannelData(1),
        });
      }
    };

    //receiving from worker
    this.worker.addEventListener("message", function(event) {
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
          if (that.audioInput) that.audioInput.disconnect();
          document.querySelector('.status-holder').innerHTML = '--stopped recording--';
          // console.log(event);
          break;

        case 'through':
          socket.emit('message', event.data.sub);
          break;
          
        case 'play':
          that.play(0);
          break;
      }
    }, false);
  },



  start: function start() {
    this.isEnabled = true;
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

  play: function play(time) {
    var source = audioContext.createBufferSource(); // creates a sound source
    source.buffer = this.buffer; // tell the source which sound to play
    source.connect(audioContext.destination); // connect the source to the context's destination (the speakers)
    source.start(time); // play the source now
    console.log('///play signal!');
    var curtime = audioContext.currentTime; //set a timestamp
  }
};
