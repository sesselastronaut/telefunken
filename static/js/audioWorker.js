importScripts('lib/recorder.js');

var playbackTime = 0;

//gap detection
var lastRefSample = 0;

// onset detector 
var lastOnsetTime = -999;

var lastSlowLogRms = 999;
var slowRmsSum = 0;
var slowRingSamples = [];
var slowRingIndex = 0;
var slowRingSize = 0;

var fastRmsSum = 0;
var fastRingSamples = [];
var fastRingIndex = 0;
var fastRingSize = 0;

// onset recorder (for correlation on server)
var numOnsetSamples = 0;

var preOnsetRingBuffer = [];
var preOnsetRingIndex = 0;
var preOnsetRingSize = 0;

var postOnsetSamples = [];
var numPostOnsetSamples = 0;
var postOnsetSampleCount = -1;

// wav file recorder
var recording = false;
var recordingTime = 5;

// onset criteria (string) recorder
var triggerRecCriteria = false;
var recCriteriaString = '';
var recCriteriaCount = -1;
var numRecCriteria = 88200;

var osFamily;

// common client parameters send from server
var id;
var onsetThreshold;
var sampleRate;
var bufferSize;
var minInterOnsetTime = 0.08; //inter onset time gate

onmessage = function(e) {
  switch (e.data.command) {
    case 'init':
      init(e.data);
      break;
    case 'processaudio':
      audioProcessing(e.data.inputFrame, e.data.timeRefFrame);
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
  var i;

  id = data.values.id;
  bufferSize = data.values.bufferSize;
  sampleRate = data.values.sampleRate;
  onsetThreshold = data.values.onsetThreshold;
  hack480problemo = data.values.hack480problemo;

  //instantiate the wav recorder
  recorder = new Recorder(recordingTime, 1, sampleRate);

  slowRingSize = Math.floor(0.020 * sampleRate);

  for (i = 0; i < slowRingSize; i++)
    slowRingSamples[i] = 0;

  fastRingSize = Math.floor(0.002 * sampleRate);

  for (i = 0; i < fastRingSize; i++)
    fastRingSamples[i] = 0;

  numOnsetSamples = Math.floor(0.010 * sampleRate);
  preOnsetRingSize = Math.floor(numOnsetSamples / 4);
  numPostOnsetSamples = numOnsetSamples - preOnsetRingSize;

  console.log('init client (worker): ' + id + ', onsetThreshold: ' + onsetThreshold + ', numOnsetSamples: ' + numOnsetSamples);
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
  var timeIncr = 1.0 / sampleRate;

  //clip detection variables
  var numClippedSamples = 0;

  //channel 1: analysis of reference signal for gap time correction ======================
  var gapTime = 0.0;
  var gapCount = 0;
  var refSample = timeRefFrame[0];

  if (lastRefSample > 0) {
    var deltaCount = refSample - lastRefSample;

    if (deltaCount < bufferSize)
      deltaCount += sampleRate;

    gapCount = deltaCount - bufferSize;
    gapTime = gapCount * timeIncr;

    if (gapCount !== 0) {
      this.postMessage({
        type: 'through',
        sub: {
          type: 'sendingGap',
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
    var sqSample = sample * sample;
    var sampleLogRms = 0.5 * Math.log(sqSample);

    //--- onset detection ------------------------------------------
    //slow ring buffer
    slowRmsSum -= slowRingSamples[slowRingIndex];
    slowRmsSum += sqSample;
    slowRingSamples[slowRingIndex] = sqSample;
    slowRingIndex = (slowRingIndex + 1) % slowRingSize;

    var slowLogRms = 0.5 * Math.log(slowRmsSum / slowRingSize + 0.000001);

    //fast ring buffer
    fastRmsSum -= fastRingSamples[fastRingIndex];
    fastRmsSum += sqSample;
    fastRingSamples[fastRingIndex] = sqSample;
    fastRingIndex = (fastRingIndex + 1) % fastRingSize;

    var fastLogRms = 0.5 * Math.log(fastRmsSum / fastRingSize + 0.000001);

    //send fastLogRms to server

    var odf = fastLogRms - lastSlowLogRms; //onset-detection-function
    lastSlowLogRms = slowLogRms;

    // check for onset ------------------------------------------
    if (odf >= onsetThreshold && time - lastOnsetTime > minInterOnsetTime) {
      lastOnsetTime = time;
      postOnsetSampleCount = 0; // start recording onset samples after onset
    }

    // --- record onset samples ---------------------------------------------
    if(postOnsetSampleCount < 0) {
      // record pre-onset samples in ringbuffer
      preOnsetRingBuffer[preOnsetRingIndex] = sample;
      preOnsetRingIndex = (preOnsetRingIndex + 1) % preOnsetRingSize;
    } else if(postOnsetSampleCount < numPostOnsetSamples) {
      // record post-onset samples
      postOnsetSamples[postOnsetSampleCount] = sample;
      postOnsetSampleCount++;
    }

    if (postOnsetSampleCount === numPostOnsetSamples) {
      // join pre-onset samples from ringuffer and post-onset sample 
      var sendBuffer = preOnsetRingBuffer.slice(preOnsetRingIndex, preOnsetRingSize);

      if(preOnsetRingIndex > 0) {
        sendBuffer = sendBuffer.concat(preOnsetRingBuffer.slice(0, preOnsetRingIndex));
      }

      sendBuffer = sendBuffer.concat(postOnsetSamples);

      // send array of onset samples to server
      this.postMessage({
        type: 'through',
        sub: {
          type: 'sendingOnsetSamples',
          values: {
            myID: id,
            onsetSamples: sendBuffer,
            onsetTime: lastOnsetTime,
            fastLogRms: fastLogRms,
            sampleRate: sampleRate,
            corrSampleOffset: preOnsetRingSize,
            corrWindowSize: numOnsetSamples - 2 * preOnsetRingSize,
            hack480problemo: hack480problemo
          }
        }
      });

      postOnsetSampleCount = -1;
    }

    // --- record criteria ----------------------------------- 
    if(triggerRecCriteria) {
      recCriteriaString = '';
      recCriteriaCount = 0;
      triggerRecCriteria = false;
    }

    // concat criteria
    if(recCriteriaCount >= 0) {
      recCriteriaString += (sample + ',' + (fastLogRms - lastSlowLogRms) + '\n');
      recCriteriaCount++;
    }

    // send criteria
    if (recCriteriaCount === numRecCriteria) {
      console.log('###sending criteria to server#####' + recCriteriaCount);
      this.postMessage({
        type: 'through',
        sub: {
          type: 'sendingCriteriaString',
          values: {
            myID: id,
            criteriaString: recCriteriaString,
          }
        }
      });

      recCriteriaCount = -1;
    }

    // wav recording
    if (this.recording) {
      this.recording = this.recorder.input(inputFrame[i]);

      if (!this.recording)
        stopRecording();
    }

    // count clipping
    if (Math.abs(sample) > 0.98) {
      numClippedSamples++;
    }

    time += timeIncr;
  }
  //end channel 0 =========================================================================

  // report clipping
  if (numClippedSamples > 0) {
    this.postMessage({
      type: 'through',
      sub: {
        type: 'sendClipping',
        values: {
          myID: id,
          frameTime: playbackTime,
          numClipping: numClippedSamples
        }
      }
    });
  }

  playbackTime += bufferSize / sampleRate;
}
