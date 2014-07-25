importScripts('lib/recorder.js');
var playbackTime = 0;
//var playbackCount = 0;

var ringSamples = [];
var ringIndex = 0;
var ringSize = 3000;

var syncTime = 0.0;
var syncCount = 0;

var lastSample = 0;
var lastLastSample = 0;

var lastRefSample = 0;
var lastEdge = -1;

var maxSample = -999;
var maxSampleTime = 99999999999;
var maxSampleCount = 0;
var maxSampleTimes = [];
var maxSampleTimesCounter = 0;
var maxTimeOut = 0.13; //timeout after maximum is detected

var lastOnsetTime = -999;

var syncOnOnset = true;

var recording = false;
var recordingTime = 5;

var threshold;
var bufferSize;
var id;
var sampleRate;
var audiostream;



this.onmessage = function(e) {
  switch (e.data.command) {
    case 'init':
      init(e.data);
      break;
    case 'processaudio':
      audioProcessing(e.data.inputFrame, e.data.timeRefFrame);
      break;
    case 'resetTimeSync':
      syncOnOnset = true;
      break;
    case 'startRecording':
      startRecording();
      break;
    case 'stopRecording':
      stopRecording();
      break;

    case 'blob':
      console.log(___blub_____);
      break;
  }
};

function init(data) {
  threshold = data.values.threshold;
  console.log("threshold set to: " + threshold);
  bufferSize = data.values.bufferSize;
  id = data.values.id;
  sampleRate = data.values.sampleRate;
  //console.log(data.values.sampleRate);

  //instantiate the recorder
  recorder = new Recorder(recordingTime, 1, sampleRate);
}

function startRecording(e) {
  this.recording = true;
  console.log('----recording state: ' + this.recording);

}

function stopRecording(e) {
  var audioBlob = recorder.setupSave();

  this.postMessage({
    type: 'saveRecording',
    values: audioBlob
  });
}

function audioProcessing(inputFrame, timeRefFrame) {
  var time = playbackTime;
  //var count = playbackCount;
  var timeIncr = 1.0 / sampleRate;
  var gapTime = 0.0;
  var gapCount = 0;
  var refSample = timeRefFrame[0];

  this.audioStream = inputFrame;
  //var refSample = Math.floor(0.5 * sampleRate * (timeRefFrame[0] + 1) + 0.5);

  //console.log('inputFrame ' + inputFrame[0]);
  //console.log('timeRefFrame ' + timeRefFrame[0]);
  //console.log("__________");
  //console.log("refSample: " + refSample);

  if (lastRefSample > 0) {
    var deltaCount = refSample - lastRefSample;

    if (deltaCount < bufferSize)
      deltaCount += sampleRate;

    //console.log("delta: " + deltaCount);

    gapCount = deltaCount - bufferSize;
    gapTime = gapCount * timeIncr;

    if (gapCount !== 0) {

      this.postMessage({
        type: 'through', //'sending_max_array',
        sub: {
          type: 'sendingGap', //sendingMaxArray',
          values: {
            myID: id,
            gapCount: gapCount, //maxSampleTimes.join('\n')
            gapTime: gapTime
          }
        }
      });

    }

    //console.log("gapCount: " + gapCount);

    // if (gapCount !== 0) {
    //   console.log("_____________");
    //   console.log("refSample: " + refSample);
    //   console.log("lastRefSample: " + lastRefSample);
    //   console.log("deltaCount: " + deltaCount);
    //   console.log("gapCount: " + gapCount);
    // }
  }

  // comment this to disable time correction
  lastRefSample = refSample;

  time += gapTime;

  //audio analysis of microphone input on channel 0                         
  for (var i = 0; i < inputFrame.length; i++) {
    var sample = Math.abs(inputFrame[i]);

    //recording------------------------------------------------
    if (this.recording) {
      this.recording = this.recorder.input(inputFrame[i]);

      if (!this.recording) stopRecording();
    }

    //start maxdetection----------------------------------------------      
    if (time > (maxSampleTime + maxTimeOut) && maxSampleTime > lastOnsetTime) {

      // console.log('_______sample: ' + sample);
      // console.log('____maxSample: ' + maxSample);
      // console.log('maxSampleTime: ' + maxSampleTime);
      // console.log('___maxTimeOut: ' + maxTimeOut);
      // console.log('_________time: ' + time);
      // console.log('lastOnsetTime: ' + lastOnsetTime);

      // take first stimulus as a calibration for the time
      if (syncOnOnset === true) {

        //uncomment this to start recording with sync onset
        //startRecording();

        //console.log(maxSampleTime - syncTime);
        syncOnOnset = false;
        syncTime = maxSampleTime;
        //syncCount = maxSampleCount;
        maxSampleTimesCounter = 0;

        this.postMessage({
          type: 'through', //'sending_max_array',
          sub: {
            type: 'sendingMaximumTime', //sendingMaxArray',
            values: {
              myID: id,
              maxTime: (maxSampleTime - syncTime), //maxSampleTimes.join('\n')
              sample: maxSample
              //count: maxSampleTimesCounter
            }
          }
        });


      } else {
        //console.log('---stopping---');
        maxSampleTimesCounter++;

        //console.log("maxSample: " + maxSample);

        this.postMessage({
          type: 'through', //'sending_max_array',
          sub: {
            type: 'sendingMaximumTime', //sendingMaxArray',
            values: {
              myID: id,
              maxTime: (maxSampleTime - syncTime), //maxSampleTimes.join('\n')
              sample: maxSample
              //count: maxSampleTimesCounter
            }
          }
        });

        //this.postMessage ( {type: 'stopRecording'});

      }

      lastOnsetTime = maxSampleTime;
    }

    //find maximum in signal but first apply threshold on signal to filter noise
    if (sample > threshold) {


      if (time > (maxSampleTime + maxTimeOut) || sample > maxSample) {

        maxSample = sample;
        maxSampleTime = time;
        //maxSampleCount = count;

      }
    }

    //ringIndex = (ringIndex + 1) % ringSize;
    lastLastSample = lastSample;
    lastSample = sample;

    //end maxdetection----------------------------------------------

    time += timeIncr;
    //count++;

  }

  //playbackCount += bufferSize;
  playbackTime += bufferSize / sampleRate;

}