var auProc = {

  id: null,
  recording : false,
  buffer : null,
  bufferSize: 16384, //2048, // number of samples to collect before analyzing

  syncTime: 0.0,
  syncCount: 0,
  peaksample: -1,

  ringSamples: [],
  ringIndex: 0,
  ringSize: 3000,

  lastSample: 0,
  lastLastSample: 0,

  maxSample: -999,
  maxSampleTime: 99999999999,
  maxSampleCount: 0,
  maxSampleTimes: [],
  maxSampleTimesCounter: 0,
  maxTimeOut: 0.13, //timeout after maximum is detected

  playbackTime: 0,
  playbackCount: 0,

  syncOnOnset: true,
  lastOnsetTime: -999,

  sampleThreshold: 0.189, //Linux = 0.32
  sampleThresholdPhone: 0.55, //nexus 3 = 0.7

  recordingTime: 2,

  //set threshold depending on OS
  setThreshold: function setThreshold(string) {
    var a = string.split(' ');
    //console.log(a[0]);
    if(a[0] === "Android") this.sampleThreshold = this.sampleThresholdPhone;
  },


  // Entry point
  init: function init(stream) {

    var that = this;

    this.audioStream = stream;
    this.recorder = new Recorder(this.recordingTime);

    // create the media stream from the audio input source (microphone)
    this.sourceNode = audioContext.createMediaStreamSource(stream);

    this.jsNode = audioContext.createScriptProcessor(this.bufferSize, 1, 1);

    console.log('____________starting analyzing mic audio_______ on:', platform.os.family);
    this.setThreshold(platform.os.family);

    console.log('sampleThreshold: ', this.sampleThreshold);

    // analyze audio from microphone
    // take first stimulus as a calibration for the time
    this.jsNode.onaudioprocess = function(event) {
      var frame = event.inputBuffer.getChannelData(0);
      var time = that.playbackTime;
      var count = that.playbackCount;
      var timeIncr = 1.0 / audioContext.sampleRate;

      //audio analysis                        
      for (var i = 0; i < frame.length; i++) {

        //recording------------------------------------------------
        if (that.recording) {
          that.recording = that.recorder.input(frame[i]);

          if (!that.recording) that.recorder.setupSave('output.wav');
        }
        //----------------------------------------------------------

        var sample = Math.abs(frame[i]);
        that.ringSamples[that.ringIndex] = sample; //frame[i];

        //start maxdetection----------------------------------------------      
        if (time > (that.maxSampleTime + that.maxTimeOut) && that.maxSampleTime > that.lastOnsetTime) {

          var ringStartCount = count - that.ringSize;
          var maxRingIndex = that.maxSampleCount - ringStartCount;

          // debugtime(this.maxSampleTime - syncTime);
          //console.log(that.maxSampleTime - that.syncTime);

/*          var initialRingSamples = []; //setup an array to write the initial ringsamples for debugging
          for (var j = 0; j < that.ringSamples.length; j++) {
            var k = (j + that.ringIndex) % that.ringSize;

            initialRingSamples[j] = that.ringSamples[k];
            //console.log ('k',k, 'j',j,'samplevalue',initialRingSamples [j], 'this.maxSampleTime', this.maxSampleTime);

            if (j === maxRingIndex) {
              // console.log('maximum value: ', that.ringSamples[k]);
              //print value of sample at maximum on screen
              // debugsamplevalue(that.ringSamples[k]);
              //initialRingSamples [maxRingIndex] = that.ringSamples[k];
            } else {
              //console.log('......', j, ':', that.ringSamples[k]);
              //initialRingSamples [j] = that.ringSamples[k];
            }
          }*/

          // WHEN PROCESS IS RUNNING NO UI NO DEBUG NO SOCKET
          // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!


          //use first onset as sync
          if (that.syncOnOnset === true) {

            //console.log(that.maxSampleTime - that.syncTime);
            that.syncOnOnset = false;
            that.syncTime = that.maxSampleTime;
            that.syncCount = that.maxSampleCount;
            that.maxSampleTimesCounter = 0;

            //comment this!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
            //document.querySelector('.status-holder').innerHTML = 'sychronized time now ' + sample;
            //console.log('-- sychronized time now: ', that.maxSampleTime - that.syncTime);
            //comment this!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

          } else if (that.maxSampleTimes.length < 10){
            that.maxSampleTimes [that.maxSampleTimesCounter] = that.maxSampleTime - that.syncTime;
            that.maxSampleTimesCounter++;
            //that.play();
            //console.log('maxSampleTimes: ',that.maxSampleTimes.length);
            //console.log('-- maximum at time: ', that.maxSampleTime - that.syncTime);
          } else {  //stop that.recording and send max array to server
            console.log('---stopping---');
            that.recorder.setupSave('output.wav');
            that.jsNode.onaudioprocess = null;
            if (this.audioStream) this.audioStream.stop();
            if (that.sourceNode) that.sourceNode.disconnect();

            ////////emitting to client
            socket.emit('message', {
              type: 'sending_max_array',
              data: {
                myID: that.id,
                samplearray: that.maxSampleTimes.join('\n')
              }
            });
            document.querySelector('.status-holder').innerHTML = '--sending max array--';
          }

          that.lastOnsetTime = that.maxSampleTime;
        }
        
        //find maximum in signal but first apply threshold on signal to filter noise
        if (sample > that.sampleThreshold) {
            //console.log('samplevalue over threshold: ', sample);

          if (time > (that.maxSampleTime + that.maxTimeOut) || sample > that.maxSample) {
          
            that.maxSample = sample;
            that.maxSampleTime = time;
            that.maxSampleCount = count;
          
          }
        }

        that.ringIndex = (that.ringIndex + 1) % that.ringSize;
        that.lastLastSample = that.lastSample;
        that.lastSample = sample;

        //end maxdetection----------------------------------------------

        time += timeIncr;
        count++;

      }

      that.playbackCount += this.bufferSize;
      that.playbackTime += this.bufferSize / audioContext.sampleRate;
    };


    //start highpass filter----------------------------------
/*    var filter = audioContext.createBiquadFilter();
    filter.type = filter.HIGHPASS;
    filter.frequency.value = 20;
    this.sourceNode.connect(filter);
    filter.connect(this.jsNode);*/
    //end highpass filter----------------------------------
    this.sourceNode.connect(this.jsNode);
    this.jsNode.connect(audioContext.destination);
    console.log('////audio nodes set up');

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