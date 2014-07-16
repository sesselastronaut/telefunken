// Hack to handle vendor prefixes
navigator.getUserMedia = (navigator.getUserMedia ||
    navigator.webkitGetUserMedia ||
    navigator.mozGetUserMedia ||
    navigator.msGetUserMedia);

window.requestAnimFrame = (function() {
    return window.requestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        function(callback, element) {
            window.setTimeout(callback, 1000 / 60);
        };
})();

// initialising and setting the global audio context
window.AudioContext = (function() {
    return window.webkitAudioContext || window.AudioContext || window.mozAudioContext;
})();

window.audioContext = window.audioContext || new AudioContext();


// General helper functions
// ------------------------

function onError(e) {
    console.log(e);
}