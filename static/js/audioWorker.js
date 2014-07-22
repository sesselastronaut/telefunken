
var playbackTime = 0;
var playbackCount = 0;

var recordingTime = 2;

var ringSamples = [];
var ringIndex = 0;
var ringSize = 3000;

var syncTime = 0.0;
var syncCount = 0;

var lastSample = 0;
var lastLastSample = 0;

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
      audioProcessing(e.data.frame);
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

function audioProcessing (frame){
  var time = playbackTime;
  var count = playbackCount;
  var timeIncr = 1.0 / sampleRate;

  //console.log(sampleRate);

  //audio analysis                        
  for (var i = 0; i < frame.length; i++) {



    var sample = Math.abs(frame[i]);
    ringSamples[ringIndex] = sample; //frame[i];

    //start maxdetection----------------------------------------------      
    if (time > (maxSampleTime + maxTimeOut) && maxSampleTime > lastOnsetTime) {

      // console.log('_______sample: ' + sample);
      // console.log('____maxSample: ' + maxSample);
      // console.log('maxSampleTime: ' + maxSampleTime);
      // console.log('___maxTimeOut: ' + maxTimeOut);
      // console.log('_________time: ' + time);
      // console.log('lastOnsetTime: ' + lastOnsetTime);

      var ringStartCount = count - ringSize;
      var maxRingIndex = maxSampleCount - ringStartCount;

      // debugtime(maxSampleTime - syncTime);
      //console.log(maxSampleTime - syncTime);

      /*          var initialRingSamples = []; //setup an array to write the initial ringsamples for debugging
          for (var j = 0; j < ringSamples.length; j++) {
            var k = (j + ringIndex) % ringSize;

            initialRingSamples[j] = ringSamples[k];
            //console.log ('k',k, 'j',j,'samplevalue',initialRingSamples [j], 'maxSampleTime', maxSampleTime);

            if (j === maxRingIndex) {
              // console.log('maximum value: ', ringSamples[k]);
              //print value of sample at maximum on screen
              // debugsamplevalue(ringSamples[k]);
              //initialRingSamples [maxRingIndex] = ringSamples[k];
            } else {
              //console.log('......', j, ':', ringSamples[k]);
              //initialRingSamples [j] = ringSamples[k];
            }
          }*/

      // WHEN PROCESS IS RUNNING NO UI NO DEBUG NO SOCKET
      // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!


      //use first onset as sync
      if (syncOnOnset === true) {

        //console.log(maxSampleTime - syncTime);
        syncOnOnset = false;
        syncTime = maxSampleTime;
        syncCount = maxSampleCount;
        maxSampleTimesCounter = 0;

        //comment this!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
        //document.querySelector('.status-holder').innerHTML = 'sychronized time now ' + sample;
        //console.log('-- sychronized time now: ' + (maxSampleTime - syncTime));
        //comment this!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

      } else if (maxSampleTimes.length < 5) {
        maxSampleTimes[maxSampleTimesCounter] = maxSampleTime - syncTime;
        maxSampleTimesCounter++;
        //play();
        //console.log('maxSampleTimes: ', maxSampleTimes.length);
        //console.log('-- maximum at time: ', maxSampleTime - syncTime);
      } else { //stop that.recording and send max array to server
        console.log('---stopping---');
        
        this.postMessage ( {
          type: 'through', //'sending_max_array',
          sub: {
            type: 'sendingMaxArray',
            values: {
              myID: id,
              samplearray: maxSampleTimes.join('\n')
            }
          }
        });

        this.postMessage ( {type: 'stopRecording'});
        
      }

      lastOnsetTime = maxSampleTime;
    }

    //find maximum in signal but first apply threshold on signal to filter noise
    if (sample > threshold) {


      if (time > (maxSampleTime + maxTimeOut) || sample > maxSample) {

        maxSample = sample;
        maxSampleTime = time;
        maxSampleCount = count;

      }
    }

    ringIndex = (ringIndex + 1) % ringSize;
    lastLastSample = lastSample;
    lastSample = sample;

    //end maxdetection----------------------------------------------

    time += timeIncr;
    count++;

  }

  playbackCount += bufferSize;
  playbackTime += bufferSize / sampleRate;

}


      