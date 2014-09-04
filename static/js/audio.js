window.audioContext = window.audioContext || new AudioContext();

var prevfreq = 0;

var eventGain = 1;

var auProc = {

  id: null,
  buffer: null,
  bufferSize: 16384, //2048, // number of samples to collect before analyzing

  isEnabled: false,

  worker: new Worker("js/audioWorker.js"),

  playbackTime: 0,

  //player
  playerTimes: [],
  playerGains: [],
  playerEventIndex: -1,
  playerIndex: 0,
  playerBuffer: [],
  playerEventLength: -1,

  playNextEvent: function playNextEvent(time, skip) {
    this.playerEventIndex++;

     if (skip) {
      while (this.playerEventIndex < this.playerTimes.length && this.playerTimes[this.playerEventIndex] < time){
        this.playerEventIndex++;
      }
    }

    if (this.playerEventIndex < this.playerTimes.length) {
      var bufferDuration = this.playerBuffer.length / audioContext.sampleRate;
      var eventDuration = bufferDuration;
      var eventTime = this.playerTimes[this.playerEventIndex];
      var playerTime = time - eventTime;
      eventGain = this.playerGains[this.playerEventIndex];
      if (eventGain === null || eventGain === undefined)
        eventGain = 1;
      console.log('eventGain: ' + eventGain);

      if (this.playerEventIndex < this.playerTimes.length - 1) {
        var nextEventTime = this.playerTimes[this.playerEventIndex + 1];
        var interEventTime = nextEventTime - eventTime;

        //console.log('>>interEventTime: ' + interEventTime + ' eventDuration: ' + eventDuration + ' nextEventTime: ' + nextEventTime);

        if (eventDuration > interEventTime)
          eventDuration = interEventTime;
      }

      this.playerEventLength = Math.floor(eventDuration * audioContext.sampleRate + 0.5);
      this.playerIndex = Math.floor(playerTime * audioContext.sampleRate + 0.5);

      // console.log('play event: ' + this.playerEventIndex + ' ---------------------eventTime: ' + eventTime);
      //console.log('>>playerIndex: ' + this.playerIndex + ' playerEventLength: ' + this.playerEventLength);
    } else {
      //console.log('>>>>>play stop:' + ' ----------------------');
      this.playerEventIndex = -1;
      this.playerIndex = 0;
    }
  },

  playEvents: function(idx, times, gains) {
    if ((this.id - 1) === idx) {
      console.log('id: ' + (idx + 1) + ' times: ' + times + ' gains: ' + gains);
      this.playBuffer(this.buffer.getChannelData(0), times, gains);
    }
  },

  playBuffer: function playBuffer(buffer, times, gains) {
    this.playerEventIndex = -1;
    this.playerTimes = times;
    this.playerGains = gains;
    this.playerBuffer = buffer;

    this.playNextEvent(this.playbackTime, true);
  },

  resetTimeSync: function() {
    this.worker.postMessage({
      command: 'resetTimeSync',
      values: {
        syncOnOnset: true
      }
    });
  },

  receiveDistTimeDiff: function(distId, distance) {
    if ((this.id - 1) === distId) {
      //console.log('id: ' + distId + ' distanceTime: ' + (distance * 100000));
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

    if (a[0] === "Android") {
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
        hack480problemo: hack480problemo
      }
    });
    //oscillator---------------------
    // this.oscillatorNode = audioContext.createOscillator();
    // this.oscillatorNode.type = 1; //2;
    // this.oscillatorNode.frequency = 1000;
    // this.oscillatorNode.connect(audioContext.destination);
    // this.oscillatorNode.noteOn(0);

    //audiocontext------------------
    this.jsNode = audioContext.createScriptProcessor(this.bufferSize, 2, 1);
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

    for (var i = 0; i < buf.length; i++)
      buf[i] = i;

    this.refSource = audioContext.createBufferSource();
    this.refSource.buffer = this.audioBuffer;
    this.refSource.loop = true;
    this.refSource.start(0);
    this.refSource.connect(this.merger, 0, 1);

    console.log('////audio nodes set up');

    console.log('____________starting analyzing mic audio_______ on:', platform.os.family);

    // analyze audio from microphone
    this.jsNode.onaudioprocess = function(event) {

      if (that.isEnabled) {
        that.worker.postMessage({
          command: 'processaudio',
          time: that.playbackTime,
          inputFrame: event.inputBuffer.getChannelData(0),
          timeRefFrame: event.inputBuffer.getChannelData(1),
        });
      }

      // player      
      var outputFrame = event.outputBuffer.getChannelData(0);
      var outputIndex = 0;
      var i;

      //console.log('<<playerIndex: ' + that.playerIndex + ' - playerEventIndex: ' + that.playerEventIndex + ' - playerEventLength: ' + that.playerEventLength);
      //console.log('<<outputIndex: ' + outputIndex + ' buffersize: ' + that.bufferSize);

      while (that.playerEventIndex >= 0 && outputIndex < that.bufferSize) {

        if (that.playerIndex < 0) {
          var numSkip = -that.playerIndex;
          if (outputIndex + numSkip > that.bufferSize)
            numSkip = that.bufferSize - outputIndex;

          for (i = 0; i < numSkip; i++) {
            outputFrame[outputIndex] = 0;
            outputIndex++;
            that.playerIndex++;
          }
        }

        if (that.playerIndex >= 0 && that.playerIndex < that.playerEventLength) {
          var playLength = that.playerEventLength - that.playerIndex;
          var bufferSpace = that.bufferSize - outputIndex;

          if (playLength > bufferSpace)
            playLength = bufferSpace;

          for (i = 0; i < playLength; i++) {
            outputFrame[outputIndex] = that.playerBuffer[that.playerIndex] * eventGain;
            outputIndex++;
            that.playerIndex++;
          }

          if (that.playerIndex === that.playerEventLength)
            that.playNextEvent(that.playbackTime + outputIndex / audioContext.sampleRate);
          // else if (that.playerIndex > that.playerEventLength)
          //   debugger;
        }
      }

      for (i = outputIndex; i < that.bufferSize; i++)
        outputFrame[i] = 0;

      that.playbackTime += that.bufferSize / audioContext.sampleRate;
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
          save.download = 'recording.wav';

          //stop recording----------------------------
          that.jsNode.onaudioprocess = null;
          if (that.audioInput) that.audioInput.disconnect();
          document.querySelector('.status-holder').innerHTML = '--stopped recording--';
          // console.log(event);
          break;

        case 'through':
          socket.emit('message', event.data.sub);
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
  },

};