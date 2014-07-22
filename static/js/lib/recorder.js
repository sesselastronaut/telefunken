function Recorder(duration, numChannels) {
  var sampleRate = audioContext.sampleRate;
  var numFrames = duration * sampleRate;

  if (!numChannels)
    numChannels = 1;

  this.headerSize = 44;

  var buffer = new ArrayBuffer(44 + numFrames * numChannels * 2);
  this.view = new DataView(buffer);

  this.numFrames = numFrames;
  this.numChannels = numChannels;

  this.index = 0;

  this.writeWavHeader(this.view, numFrames, numChannels, sampleRate);
}

Recorder.prototype.input = function(value) {
  if (this.index < this.numFrames) {
    //floats from sample to 16bit PCM
    var sample = Math.max(-1, Math.min(1, value));
    var sampleIndex = this.headerSize + 2 * this.index;

    this.view.setInt16(sampleIndex, (sample < 0) ? (sample * 0x8000) : (sample * 0x7FFF), true);
    this.index++;
    return true;
  }

  return false;
};

Recorder.prototype.setupSave = function(filename) {
  console.log('save');
  var audioBlob = new Blob([this.view], {
    type: 'audio/wav'
  });
  var url = (window.URL || window.webkitURL).createObjectURL(audioBlob);
  var save = document.getElementById("save");
  save.href = url;
  save.disabled = false;
  save.download = filename;
  //console.log(audioBlob);
};


Recorder.prototype.writeString = function(view, offset, string) {
  for (var i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
};

Recorder.prototype.writeWavHeader = function(view, numFrames, numChannels, sampleRate) {
  /* RIFF identifier */
  this.writeString(view, 0, 'RIFF');

  /* file length */
  view.setUint32(4, 32 + numFrames * 2, true);

  /* RIFF type */
  this.writeString(view, 8, 'WAVE');

  /* format chunk identifier */
  this.writeString(view, 12, 'fmt ');

  /* format chunk length */
  view.setUint32(16, 16, true);

  /* sample format (raw) */
  view.setUint16(20, 1, true);

  /* channel count */
  view.setUint16(22, numChannels, true);

  /* sample rate */
  view.setUint32(24, sampleRate, true);

  /* byte rate (sample rate * block align) */
  view.setUint32(28, sampleRate * numChannels * 2, true);

  /* block align (channel count * bytes per sample) */
  view.setUint16(32, numChannels * 2, true);

  /* bits per sample */
  view.setUint16(34, 16, true);

  /* data chunk identifier */
  this.writeString(view, 36, 'data');

  /* data chunk length */
  view.setUint32(40, numFrames * 2, true);
};