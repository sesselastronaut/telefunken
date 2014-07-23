
var playbackTime = 0;
//var playbackCount = 0;

var recordingTime = 2;

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

var threshold;
var bufferSize;
var id;
var sampleRate;


this.onmessage = function(e){
  switch(e.data.command){
    case 'init':
      init(e.data);
      break;
    case 'processaudio':
      audioProcessing(e.data.inputFrame, e.data.timeRefFrame);
      break;
    case 'resetTimeSync':
      syncOnOnset = true;
      break;
  }
};

function init (data){
  threshold = data.values.threshold;
  bufferSize = data.values.bufferSize;
  id = data.values.id;
  sampleRate = data.values.sampleRate;
  //console.log(data.values.sampleRate);
}

function audioProcessing (inputFrame, timeRefFrame){
  var time = playbackTime;
  //var count = playbackCount;
  var timeIncr = 1.0 / sampleRate;
  var edge = -1;

  //console.log(sampleRate);

  //analysis of oscillator on channel 1 to detect gaps
  for (var k = 0; k < timeRefFrame.length; k++) {
    var refSample = timeRefFrame[k];

    if (lastRefSample < 0.5 && refSample > 0.5) {
      edge = k;
      break;
    }

    this.lastRefSample = refSample;
  }

  if (lastEdge < 0)
    lastEdge = edge;

  var gap = lastEdge - edge;

  if (gap < 0)
    gap += timeRefFrame.length;

  if (gap !== 0)
    console.log('gap:' + gap);

  time += gap * timeIncr;
  //count += gap;

  lastEdge = edge;


  //audio analysis of microphone input on channel 0                         
  for (var i = 0; i < inputFrame.length; i++) {

    var sample = Math.abs(inputFrame[i]);
    //ringSamples[ringIndex] = sample; //inputFrame[i];

    //start maxdetection----------------------------------------------      
    if (time > (maxSampleTime + maxTimeOut) && maxSampleTime > lastOnsetTime) {

      // console.log('_______sample: ' + sample);
      // console.log('____maxSample: ' + maxSample);
      // console.log('maxSampleTime: ' + maxSampleTime);
      // console.log('___maxTimeOut: ' + maxTimeOut);
      // console.log('_________time: ' + time);
      // console.log('lastOnsetTime: ' + lastOnsetTime);

      //use first onset as sync
      if (syncOnOnset === true) {

        //console.log(maxSampleTime - syncTime);
        syncOnOnset = false;
        syncTime = maxSampleTime;
        //syncCount = maxSampleCount;
        maxSampleTimesCounter = 0;

        //comment this!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
        //document.querySelector('.status-holder').innerHTML = 'sychronized time now ' + sample;
        //console.log('-- sychronized time now: ' + (maxSampleTime - syncTime));
        //comment this!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

      // } else if (maxSampleTimes.length < 5) {
      //   maxSampleTimes[maxSampleTimesCounter] = maxSampleTime - syncTime;
      //   maxSampleTimesCounter++;
      //   //play();
      //   //console.log('maxSampleTimes: ', maxSampleTimes.length);
      //   //console.log('-- maximum at time: ', maxSampleTime - syncTime);
      } else { //stop that.recording and send max array to server
        //console.log('---stopping---');
        maxSampleTimesCounter++;

        this.postMessage ( {
          type: 'through', //'sending_max_array',
          sub: {
            type: 'sendingMaximumTime', //sendingMaxArray',
            values: {
              myID: id,
              maxTime: (maxSampleTime - syncTime), //maxSampleTimes.join('\n')
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


      