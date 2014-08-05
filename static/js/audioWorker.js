importScripts('lib/recorder.js');
var playbackTime = 0;
//var playbackCount = 0;

var syncTime = 0.0; //to be removed!!!
var serverOnsetTime = 0;
var syncOnOnset = true;


var lastRefSample = 0; //used for gap detection

// onset detector 
var lastOnsetTime = -999;

var lastSlowLogRms = 0;
var slowRingSamples = [];
var slowRingIndex = 0;
slowRingSamples[880] = 0;

var fastRingSamples = [];
var fastRingIndex = 0;
fastRingSamples[88] = 0;

// onset recorder (for correlation on server)
var numOnsetSamples = 300;

var preOnsetRingBuffer = [];
var preOnsetRingIndex = 0;
var preOnsetRingSize = numOnsetSamples / 4;
preOnsetRingBuffer[preOnsetRingSize - 1] = 0;

var numPostOnsetSamples = numOnsetSamples - preOnsetRingSize;
var postOnsetSampleCount = -1;
var postOnsetSamples = [];
postOnsetSamples[numPostOnsetSamples - 1] = 0;

// wav file recorder
var recCount = -1;
var recording = false;
var recordingTime = 5;

// onset criteria (string) recorder
var triggerRecCriteria = false;
var recCriteriaString = '';
var recCriteriaCount = -1;
var numRecCriteria = 88200;

// common client parameters
var id;
var onsetThreshold;
var minInterOnsetTime; //inter onset time gate
var sampleRate;
var bufferSize;

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
    case 'startCriteriaRec':
      triggerRecCriteria = true;
      break;
      
  }
};

function init(data) {
  id = data.values.id;
  onsetThreshold = data.values.onsetThreshold;
  minInterOnsetTime = data.values.minInterOnsetTime;
  bufferSize = data.values.bufferSize;
  sampleRate = data.values.sampleRate;

  console.log('init client: ' + id + ', onsetThreshold: ' + onsetThreshold + ', minInterOnsetTime: ' + minInterOnsetTime);

  //instantiate the wav recorder
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

  //gap detection variables
  var gapTime = 0.0;
  var gapCount = 0;
  var refSample = timeRefFrame[0];

  //clip detection variables
  var numClippedSamples = 0;

  var rmsValues = [];

  this.audioStream = inputFrame;

  //channel 1: analysis of reference signal for gap time correction ======================
  if (lastRefSample > 0) {
    var deltaCount = refSample - lastRefSample;

    if (deltaCount < bufferSize)
      deltaCount += sampleRate;

    gapCount = deltaCount - bufferSize;
    gapTime = gapCount * timeIncr;

    if (gapCount !== 0) {

      this.postMessage({
        type: 'through', //'sending_max_array',
        sub: {
          type: 'sendingGap', //sendingMaxArray',
          values: {
            myID: id,
            gapCount: gapCount,
            gapTime: gapTime
          }
        }
      });
    }
  }

  lastRefSample = refSample;
  time += gapTime; //time correction
  //end channel 1 =========================================================================

  //channel 0: audio analysis of microphone input =========================================                       
  for (var i = 0; i < inputFrame.length; i++) {
    var sample = inputFrame[i];
    var sqsample = sample * sample;
    var sampleLogRms = 0.5 * Math.log(sqsample);
    var j;

    //--- onset detection ------------------------------------------
    //slow ring buffer
    slowRingSamples[slowRingIndex] = sqsample;
    slowRingIndex = (slowRingIndex + 1) % slowRingSamples.length;

    var slowSum = 0;

    for (j = 0; j < slowRingSamples.length; j++)
      slowSum += slowRingSamples[j];

    var slowLogRms = 0.5 * Math.log(slowSum / slowRingSamples.length + 0.000001);

    //fast ring buffer
    fastRingSamples[fastRingIndex] = sqsample;
    fastRingIndex = (fastRingIndex + 1) % fastRingSamples.length;

    var fastSum = 0;

    for (j = 0; j < fastRingSamples.length; j++)
      fastSum += fastRingSamples[j];

    var fastLogRms = 0.5 * Math.log(fastSum / fastRingSamples.length + 0.000001);

    // check for onset ------------------------------------------
    if (fastLogRms - lastSlowLogRms >= onsetThreshold && time - lastOnsetTime > minInterOnsetTime) {

      // start recording onset samples after onset
      postOnsetSampleCount = 0;

      var sendTime;

      // sychronize time on first maximum
      if (syncOnOnset === true) {
        sendTime = time;
        syncOnOnset = false;
        syncTime = time;
        recCount = 0;
      } else {
        sendTime = time - syncTime;
      }

      serverOnsetTime = time - syncTime; //to be removed!!!!!!!

      this.postMessage({
        type: 'through',
        sub: {
          type: 'sendingOnsetTime',
          values: {
            myID: id,
            onsetTime: sendTime, // sync time
            sample: sample,
          }
        }
      });

      lastOnsetTime = time;
    } // end onset ---------------------------------------------

    lastSlowLogRms = slowLogRms;

    // // --- record onset samples ---------------------------------------------
    // if(postOnsetSampleCount < 0) {
    //   // record pre-onset samples in ringbuffer
    //   preOnsetRingBuffer[preOnsetRingIndex] = sample;
    //   preOnsetRingIndex = (preOnsetRingIndex + 1) % preOnsetRingBuffer.length;
    // } else if(postOnsetSampleCount < numPostOnsetSamples) {
    //   // record post-onset samples
    //   postOnsetSamples[postOnsetSampleCount] = sample;
    //   postOnsetSampleCount++;
    // }

    // if (postOnsetSampleCount === numPostOnsetSamples) {
    //   // join pre-onset samples from ringuffer and post-onset sample 
    //   var sendBuffer = preOnsetRingBuffer.slice(preOnsetRingIndex, preOnsetRingSize);

    //   if(preOnsetRingIndex > 0) {
    //     sendBuffer = sendBuffer.concat(preOnsetRingBuffer.slice(0, preOnsetRingIndex));
    //   }

    //   sendBuffer = sendBuffer.concat(postOnsetSamples);

    //   // send array of onset samples to server
    //   this.postMessage({
    //     type: 'through',
    //     sub: {
    //       type: 'sendingOnsetSamples',
    //       values: {
    //         myID: id,
    //         onsetSamples: sendBuffer,
    //         onsetTime: serverOnsetTime,
    //         sampleRate: sampleRate
    //       }
    //     }
    //   });

    //   postOnsetSampleCount = -1;
    // }

    // // --- record criteria ----------------------------------- 
    // if(triggerRecCriteria) {
    //   recCriteriaString = '';
    //   recCriteriaCount = 0;
    //   triggerRecCriteria = false;
    // }

    // // concat criteria
    // if(recCriteriaCount >= 0) {
    //   recCriteriaString += (sample + ',' + (fastLogRms - lastSlowLogRms) + '\n');
    //   recCriteriaCount++;
    // }

    // // send criteria
    // if (recCriteriaCount === numRecCriteria) {
    //   console.log('###sending criteria to server#####' + recCriteriaCount);
    //   this.postMessage({
    //     type: 'through',
    //     sub: {
    //       type: 'sendingCriteriaString',
    //       values: {
    //         myID: id,
    //         criteriaString: recCriteriaString,
    //       }
    //     }
    //   });

    //   recCriteriaCount = -1;
    // }

    // // wav recording
    // if (this.recording) {
    //   this.recording = this.recorder.input(inputFrame[i]);

    //   if (!this.recording) stopRecording();
    // }

    // // count clipping
    // if (Math.abs(sample) > 0.98) {
    //   numClippedSamples++;
    // }

    time += timeIncr;
  }
  //end channel 0 =========================================================================

  // // report clipping
  // if (numClippedSamples > 0) {
  //   this.postMessage({
  //     type: 'through',
  //     sub: {
  //       type: 'sendClipping',
  //       values: {
  //         myID: id,
  //         frameTime: playbackTime,
  //         numClipping: numClippedSamples
  //       }
  //     }
  //   });
  // }

  playbackTime += bufferSize / sampleRate;
}
