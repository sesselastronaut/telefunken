importScripts('lib/recorder.js');
var playbackTime = 0;
//var playbackCount = 0;

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

var lastSlowLogRms = 0;
var slowRingSamples = [];
var slowRingIndex = 0;
slowRingSamples[880] = 0;

var fastRingSamples = [];
var fastRingIndex = 0;
fastRingSamples[88] = 0;

var recording = false;
var recordingTime = 5;

var rmsLogCount = -1;
var rmsValuesConcatenated = '';
var numRecFrames = 60000;

var micThreshold;
var rmsThreshold;
var bufferSize;
var id;
var sampleRate;
var timeGap;

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
  }
};

function init(data) {
  rmsThreshold = data.values.rmsThreshold;
  console.log("rms threshold set to: " + rmsThreshold);
  bufferSize = data.values.bufferSize;
  id = data.values.id;
  sampleRate = data.values.sampleRate;
  timeGap = data.values.timeGap;
  console.log('timegap set to: ' + data.values.timeGap);

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
  var maxRms = -999;


  var rmsValues = [];

  this.audioStream = inputFrame;
  //var refSample = Math.floor(0.5 * sampleRate * (timeRefFrame[0] + 1) + 0.5);

  //analysis of reference signal to check for gaps
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

  }
  // comment this to disable time correction
  lastRefSample = refSample;

  time += gapTime;



  //audio analysis of microphone input on channel 0                         
  for (var i = 0; i < inputFrame.length; i++) {
    var sample = inputFrame[i];
    var sqsample = sample * sample;
    var sampleLogRms = 0.5 * Math.log(sqsample);
    var j;

    //Sync and OnSet Detector------------------------------------------
    // calculate slow RMS
    slowRingSamples[slowRingIndex] = sqsample;
    slowRingIndex = (slowRingIndex + 1) % slowRingSamples.length;

    var slowSum = 0;

    for (j = 0; j < slowRingSamples.length; j++)
      slowSum += slowRingSamples[j];

    //console.log('meanSquare: '+ meanSquare);

    var slowLogRms = 0.5 * Math.log(slowSum / slowRingSamples.length + 0.000001);

    // calculate fast RMS
    fastRingSamples[fastRingIndex] = sqsample;
    fastRingIndex = (fastRingIndex + 1) % fastRingSamples.length;

    var fastSum = 0;

    for (j = 0; j < fastRingSamples.length; j++)
      fastSum += fastRingSamples[j];

    var fastLogRms = 0.5 * Math.log(fastSum / fastRingSamples.length + 0.000001);

    //log rms/lastRMS values:
    if (rmsLogCount >=0 && rmsLogCount < numRecFrames) {
      rmsValuesConcatenated += (slowLogRms + ',' + sample + ',' + (fastLogRms - lastSlowLogRms) + '\n');
      rmsLogCount++;
    }
    //console.log('rmsValues[i]: ' + rmsValues);

    // console.log('_____________');
    // console.log('lastSlowLogRms: ' + lastSlowLogRms);
    // console.log('____rms: ' + slowLogRms);
    // console.log('rms - lastRms: ' + (slowLogRms - lastSlowLogRms));

    // console.log('_time-local: ' + time);
    // console.log('time-synced: ' + (time - syncTime));
    if (fastLogRms - lastSlowLogRms >= 0.6 && time - lastOnsetTime > timeGap) {
    
      //sychronize time on first maximum
      if (syncOnOnset === true) {
        console.log('-------time synced--------');
        syncOnOnset = false;
        syncTime = time;
        rmsLogCount = 0;
        rmsValuesConcatenated = '';

        this.postMessage({
          type: 'through',
          sub: {
            type: 'sendingOnsetTime',
            values: {
              myID: id,
              onsetTime: (time - syncTime),
              sample: sample
              //count: maxSampleTimesCounter
            }
          }
        });

        // this.postMessage({
        //   type: 'play',
        // });

      } else {

        this.postMessage({
          type: 'through',
          sub: {
            type: 'sendingOnsetTime',
            values: {
              myID: id,
              onsetTime: (time - syncTime),
              sample: sample
              //count: maxSampleTimesCounter
            }
          }
        });
      }

      lastOnsetTime = time;
    }

    lastSlowLogRms = slowLogRms;

    //recording------------------------------------------------
    if (this.recording) {
      this.recording = this.recorder.input(inputFrame[i]);

      if (!this.recording) stopRecording();
    }

    //report clipping
    if (sample > 0.98) {
      this.postMessage({
        type: 'through', //'sending_max_array',
        sub: {
          type: 'sendClipping', //sendingMaxArray',
          values: {
            myID: id,
            clipTime: (time - syncTime),
            clipSample: sample
          }
        }
      });
    }

    time += timeIncr;
  }
  
  ////send files to 
  // if(rmsLogCount === numRecFrames) {
  //   rmsLogCount = -1;

  //   console.log('###sendingRmsValues to server#####' + rmsLogCount);
  //   //console.log(rmsValuesConcatenated);
  //   this.postMessage({
  //     type: 'through',
  //     sub: {
  //       type: 'sendingRmsValues',
  //       values: {
  //         myID: id,
  //         rmsValues: rmsValuesConcatenated,
  //         //rmscounter: rmsLogCount
  //       }
  //     }
  //   });
  // }

   //playbackCount += bufferSize;
  playbackTime += bufferSize / sampleRate;

}