(function () {
  "use strict";

  var ROOM_FOCUS = {
    library: { x: "8%", y: "48%" },
    gallery: { x: "28%", y: "42%" },
    journal: { x: "68%", y: "42%" },
    studio: { x: "92%", y: "48%" }
  };

  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var hall = document.getElementById("archive-hall");
  var status = document.getElementById("hall-status");
  var roomControls = Array.prototype.slice.call(document.querySelectorAll("[data-room]"));
  var soundToggle = document.getElementById("sound-toggle");
  var soundLabel = document.getElementById("sound-label");
  var previewTimer = null;
  var transitionLocked = false;

  var environment = new window.ArchiveEnvironment({
    timeElement: document.getElementById("local-time"),
    dateElement: document.getElementById("local-date"),
    weatherValueElement: document.getElementById("weather-value"),
    weatherLocationElement: document.getElementById("weather-location")
  });

  function setSceneFocus(room, element) {
    var fallback = ROOM_FOCUS[room] || { x: "50%", y: "50%" };
    var x = element && element.dataset.focusX ? element.dataset.focusX : fallback.x;
    var y = element && element.dataset.focusY ? element.dataset.focusY : fallback.y;

    hall.style.setProperty("--focus-x", x);
    hall.style.setProperty("--focus-y", y);
  }

  function resetSceneFocus() {
    hall.style.setProperty("--focus-x", "50%");
    hall.style.setProperty("--focus-y", "50%");
  }

  function previewRoom(room, element) {
    if (transitionLocked) {
      return;
    }

    window.clearTimeout(previewTimer);
    setSceneFocus(room, element);
    document.body.classList.add("is-previewing");
    status.textContent = room.toUpperCase() + " / IN PREPARATION";

    previewTimer = window.setTimeout(function () {
      document.body.classList.remove("is-previewing");
      status.textContent = "";
      resetSceneFocus();
    }, reducedMotion ? 400 : 1150);
  }

  function enterRoom(room, href, element) {
    if (transitionLocked) {
      return;
    }

    transitionLocked = true;
    setSceneFocus(room, element);
    status.textContent = room.toUpperCase() + " / OPEN";
    document.body.classList.remove("is-previewing");
    document.body.classList.add("is-transitioning");

    window.setTimeout(function () {
      window.location.assign(href);
    }, reducedMotion ? 40 : 820);
  }

  roomControls.forEach(function (control) {
    var room = control.dataset.room;

    control.addEventListener("pointerenter", function () {
      setSceneFocus(room, control);
    });

    control.addEventListener("focus", function () {
      setSceneFocus(room, control);
    });

    control.addEventListener("click", function (event) {
      var href = control.getAttribute("href");

      if (href) {
        event.preventDefault();
        enterRoom(room, href, control);
        return;
      }

      previewRoom(room, control);
    });
  });

  function AmbientRoomTone() {
    this.context = null;
    this.output = null;
    this.noise = null;
    this.hum = null;
    this.enabled = false;
  }

  AmbientRoomTone.prototype.create = function () {
    var AudioContext = window.AudioContext || window.webkitAudioContext;

    if (!AudioContext) {
      return false;
    }

    this.context = new AudioContext();
    this.output = this.context.createGain();
    this.output.gain.value = 0;
    this.output.connect(this.context.destination);

    var bufferLength = this.context.sampleRate * 2;
    var noiseBuffer = this.context.createBuffer(1, bufferLength, this.context.sampleRate);
    var samples = noiseBuffer.getChannelData(0);

    for (var index = 0; index < bufferLength; index += 1) {
      samples[index] = Math.random() * 2 - 1;
    }

    var lowPass = this.context.createBiquadFilter();
    lowPass.type = "lowpass";
    lowPass.frequency.value = 420;

    this.noise = this.context.createBufferSource();
    this.noise.buffer = noiseBuffer;
    this.noise.loop = true;
    this.noise.connect(lowPass);
    lowPass.connect(this.output);
    this.noise.start();

    var humGain = this.context.createGain();
    humGain.gain.value = 0.13;

    this.hum = this.context.createOscillator();
    this.hum.type = "sine";
    this.hum.frequency.value = 50;
    this.hum.connect(humGain);
    humGain.connect(this.output);
    this.hum.start();

    return true;
  };

  AmbientRoomTone.prototype.toggle = function () {
    var roomTone = this;

    if (!this.context && !this.create()) {
      return Promise.resolve(false);
    }

    return this.context.resume().then(function () {
      var now = roomTone.context.currentTime;
      var nextValue = roomTone.enabled ? 0 : 0.012;

      roomTone.output.gain.cancelScheduledValues(now);
      roomTone.output.gain.setValueAtTime(roomTone.output.gain.value, now);
      roomTone.output.gain.linearRampToValueAtTime(nextValue, now + 0.28);
      roomTone.enabled = !roomTone.enabled;
      return roomTone.enabled;
    });
  };

  var roomTone = new AmbientRoomTone();

  soundToggle.addEventListener("click", function () {
    roomTone.toggle().then(function (enabled) {
      soundToggle.setAttribute("aria-pressed", String(enabled));
      soundToggle.setAttribute("aria-label", enabled ? "关闭大厅环境声" : "开启大厅环境声");
      soundLabel.textContent = enabled ? "SOUND ON" : "SOUND OFF";

      if (!roomTone.context) {
        status.textContent = "SOUND / UNAVAILABLE";
      }
    });
  });

  window.addEventListener("pageshow", function () {
    transitionLocked = false;
    document.body.classList.remove("is-transitioning", "is-previewing");
    status.textContent = "";
    resetSceneFocus();
  });

  window.addEventListener("pagehide", function () {
    environment.stop();
  });

  environment.start();
})();
