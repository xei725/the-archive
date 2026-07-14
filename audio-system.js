(function () {
  "use strict";

  var DEFAULTS = {
    masterVolume: 0.075,
    chordSeconds: 18,
    fadeSeconds: 0.45
  };

  var CHORDS = [
    [110, 164.81, 220, 246.94],
    [87.31, 130.81, 174.61, 220],
    [82.41, 123.47, 164.81, 196],
    [98, 146.83, 196, 246.94]
  ];

  function createNoiseBuffer(context) {
    var length = context.sampleRate * 3;
    var buffer = context.createBuffer(1, length, context.sampleRate);
    var samples = buffer.getChannelData(0);
    var previous = 0;

    for (var index = 0; index < length; index += 1) {
      var white = Math.random() * 2 - 1;
      previous = previous * 0.985 + white * 0.015;
      samples[index] = white * 0.42 + previous * 0.58;
    }

    return buffer;
  }

  function ArchiveAudio(options) {
    this.options = Object.assign({}, DEFAULTS, options || {});
    this.context = null;
    this.master = null;
    this.musicBus = null;
    this.roomBus = null;
    this.weatherBus = null;
    this.pad = [];
    this.chordIndex = 0;
    this.chordTimer = null;
    this.enabled = false;
    this.weather = "unavailable";
  }

  ArchiveAudio.prototype.createPad = function () {
    var audio = this;
    var filter = this.context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 680;
    filter.Q.value = 0.5;
    filter.connect(this.musicBus);

    CHORDS[0].forEach(function (frequency, index) {
      var oscillator = audio.context.createOscillator();
      var gain = audio.context.createGain();
      oscillator.type = index % 2 === 0 ? "sine" : "triangle";
      oscillator.frequency.value = frequency;
      oscillator.detune.value = index % 2 === 0 ? -4 : 4;
      gain.gain.value = index === 0 ? 0.085 : 0.047;
      oscillator.connect(gain);
      gain.connect(filter);
      oscillator.start();
      audio.pad.push(oscillator);
    });

    var lfo = this.context.createOscillator();
    var lfoGain = this.context.createGain();
    lfo.frequency.value = 0.035;
    lfoGain.gain.value = 85;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();
  };

  ArchiveAudio.prototype.createRoomTone = function (noiseBuffer) {
    var noise = this.context.createBufferSource();
    var filter = this.context.createBiquadFilter();
    var gain = this.context.createGain();
    noise.buffer = noiseBuffer;
    noise.loop = true;
    filter.type = "lowpass";
    filter.frequency.value = 340;
    gain.gain.value = 0.18;
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.roomBus);
    noise.start();

    var hum = this.context.createOscillator();
    var humGain = this.context.createGain();
    hum.type = "sine";
    hum.frequency.value = 50;
    humGain.gain.value = 0.055;
    hum.connect(humGain);
    humGain.connect(this.roomBus);
    hum.start();
  };

  ArchiveAudio.prototype.createWeatherTone = function (noiseBuffer) {
    var rain = this.context.createBufferSource();
    var highPass = this.context.createBiquadFilter();
    var lowPass = this.context.createBiquadFilter();
    rain.buffer = noiseBuffer;
    rain.loop = true;
    highPass.type = "highpass";
    highPass.frequency.value = 900;
    lowPass.type = "lowpass";
    lowPass.frequency.value = 6200;
    rain.connect(highPass);
    highPass.connect(lowPass);
    lowPass.connect(this.weatherBus);
    rain.start();
  };

  ArchiveAudio.prototype.create = function () {
    var AudioContext = window.AudioContext || window.webkitAudioContext;

    if (!AudioContext) {
      return false;
    }

    this.context = new AudioContext();
    this.master = this.context.createGain();
    this.musicBus = this.context.createGain();
    this.roomBus = this.context.createGain();
    this.weatherBus = this.context.createGain();
    this.master.gain.value = 0;
    this.musicBus.gain.value = 0.34;
    this.roomBus.gain.value = 0.2;
    this.weatherBus.gain.value = 0;
    this.musicBus.connect(this.master);
    this.roomBus.connect(this.master);
    this.weatherBus.connect(this.master);
    this.master.connect(this.context.destination);

    var noiseBuffer = createNoiseBuffer(this.context);
    this.createPad();
    this.createRoomTone(noiseBuffer);
    this.createWeatherTone(noiseBuffer);
    this.applyWeather();
    this.scheduleChords();
    return true;
  };

  ArchiveAudio.prototype.scheduleChords = function () {
    var audio = this;
    this.chordTimer = window.setInterval(function () {
      if (!audio.context) {
        return;
      }

      audio.chordIndex = (audio.chordIndex + 1) % CHORDS.length;
      var chord = CHORDS[audio.chordIndex];
      var now = audio.context.currentTime;

      audio.pad.forEach(function (oscillator, index) {
        oscillator.frequency.cancelScheduledValues(now);
        oscillator.frequency.setTargetAtTime(chord[index], now, 2.8);
      });
    }, this.options.chordSeconds * 1000);
  };

  ArchiveAudio.prototype.applyWeather = function () {
    if (!this.context || !this.weatherBus) {
      return;
    }

    var levels = {
      clear: 0.008,
      cloudy: 0.012,
      fog: 0.018,
      rain: 0.28,
      storm: 0.38,
      snow: 0.004,
      unavailable: 0.008
    };
    var now = this.context.currentTime;
    var target = levels[this.weather] === undefined ? levels.unavailable : levels[this.weather];
    this.weatherBus.gain.cancelScheduledValues(now);
    this.weatherBus.gain.setTargetAtTime(target, now, 0.7);
  };

  ArchiveAudio.prototype.setWeather = function (condition) {
    this.weather = condition || "unavailable";
    this.applyWeather();
  };

  ArchiveAudio.prototype.toggle = function () {
    var audio = this;

    if (!this.context && !this.create()) {
      return Promise.resolve(false);
    }

    return this.context.resume().then(function () {
      var now = audio.context.currentTime;
      var nextEnabled = !audio.enabled;
      var target = nextEnabled ? audio.options.masterVolume : 0;

      audio.master.gain.cancelScheduledValues(now);
      audio.master.gain.setValueAtTime(audio.master.gain.value, now);
      audio.master.gain.linearRampToValueAtTime(target, now + audio.options.fadeSeconds);
      audio.enabled = nextEnabled;

      if (!nextEnabled) {
        window.setTimeout(function () {
          if (!audio.enabled && audio.context && audio.context.state === "running") {
            audio.context.suspend();
          }
        }, (audio.options.fadeSeconds + 0.1) * 1000);
      }

      return nextEnabled;
    });
  };

  ArchiveAudio.prototype.stop = function () {
    window.clearInterval(this.chordTimer);
    this.chordTimer = null;

    if (this.context && this.context.state !== "closed") {
      this.context.close();
    }
  };

  window.ArchiveAudio = ArchiveAudio;
})();
