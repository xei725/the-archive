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
  var locationButton = document.getElementById("location-button");
  var weatherEffectsToggle = document.getElementById("weather-effects-toggle");
  var visitorIdElement = document.getElementById("visitor-id");
  var visitorMemoryElement = document.getElementById("visitor-memory");
  var previewTimer = null;
  var transitionLocked = false;
  var WEATHER_EFFECTS_KEY = "the-archive-weather-effects-v1";
  var VISITOR_MEMORY_KEY = "the-archive-visitor-memory-v1";
  var VISITOR_SESSION_KEY = "the-archive-visitor-session-v1";

  var environment = new window.ArchiveEnvironment({
    timeElement: document.getElementById("local-time"),
    dateElement: document.getElementById("local-date"),
    weatherValueElement: document.getElementById("weather-value"),
    weatherLocationElement: document.getElementById("weather-location")
  });
  var archiveAudio = new window.ArchiveAudio();

  function padNumber(value, length) {
    return String(value).padStart(length, "0");
  }

  function createVisitorId() {
    var value = Math.floor(Math.random() * 9000) + 1000;

    if (window.crypto && window.crypto.getRandomValues) {
      var values = new Uint32Array(1);
      window.crypto.getRandomValues(values);
      value = (values[0] % 9000) + 1000;
    }

    return padNumber(value, 4);
  }

  function readVisitorMemory() {
    try {
      var raw = window.localStorage.getItem(VISITOR_MEMORY_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function writeVisitorMemory(memory) {
    try {
      window.localStorage.setItem(VISITOR_MEMORY_KEY, JSON.stringify(memory));
    } catch (error) {
      // Visitor memory is optional and local-only.
    }
  }

  function isNewSession() {
    try {
      if (window.sessionStorage.getItem(VISITOR_SESSION_KEY)) {
        return false;
      }
      window.sessionStorage.setItem(VISITOR_SESSION_KEY, "active");
      return true;
    } catch (error) {
      return true;
    }
  }

  function formatLastAccess(value) {
    var date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "LAST ACCESS UNKNOWN";
    }

    return "LAST ACCESS " + date.toLocaleDateString("en-CA");
  }

  function updateVisitorDisplay(memory, previousLastVisit) {
    visitorIdElement.textContent = "VISITOR " + memory.visitorId;

    if (memory.visitCount <= 1) {
      visitorMemoryElement.textContent = "FIRST ACCESS RECORDED";
      return;
    }

    visitorMemoryElement.textContent = formatLastAccess(previousLastVisit || memory.firstVisit);
  }

  function rememberVisitor() {
    if (!visitorIdElement || !visitorMemoryElement) {
      return;
    }

    var now = new Date().toISOString();
    var memory = readVisitorMemory();
    var previousLastVisit = memory && memory.lastVisit;
    var newSession = isNewSession();

    if (!memory) {
      memory = {
        visitorId: createVisitorId(),
        firstVisit: now,
        lastVisit: now,
        visitCount: 0,
        lastRoom: "hall"
      };
    }

    if (newSession) {
      memory.visitCount += 1;
      memory.lastVisit = now;
    }

    memory.lastRoom = memory.lastRoom || "hall";
    writeVisitorMemory(memory);
    updateVisitorDisplay(memory, previousLastVisit);
  }

  function rememberRoom(room) {
    var memory = readVisitorMemory();

    if (!memory) {
      return;
    }

    memory.lastRoom = room || "hall";
    writeVisitorMemory(memory);
  }

  function readWeatherEffectsPreference() {
    try {
      return window.localStorage.getItem(WEATHER_EFFECTS_KEY) !== "off";
    } catch (error) {
      return true;
    }
  }

  function setWeatherEffects(enabled, persist) {
    document.body.dataset.weatherEffects = enabled ? "on" : "off";
    weatherEffectsToggle.setAttribute("aria-pressed", String(enabled));
    weatherEffectsToggle.setAttribute(
      "aria-label",
      enabled ? "Turn off visual weather effects" : "Turn on visual weather effects"
    );
    weatherEffectsToggle.textContent = enabled ? "FX ON" : "FX OFF";

    if (persist) {
      try {
        window.localStorage.setItem(WEATHER_EFFECTS_KEY, enabled ? "on" : "off");
      } catch (error) {
        // The preference remains active for this visit when storage is unavailable.
      }
    }
  }

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
    rememberRoom(room);
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

  soundToggle.addEventListener("click", function () {
    archiveAudio
      .toggle()
      .then(function (enabled) {
        soundToggle.setAttribute("aria-pressed", String(enabled));
        soundToggle.setAttribute("aria-label", enabled ? "关闭大厅氛围音乐和环境声" : "开启大厅氛围音乐和环境声");
        soundLabel.textContent = enabled ? "SOUND ON" : "SOUND OFF";
        status.textContent = enabled ? "ATMOSPHERE / ON" : "";

        if (!archiveAudio.context) {
          status.textContent = "SOUND / UNAVAILABLE";
        }
      })
      .catch(function () {
        status.textContent = "SOUND / UNAVAILABLE";
      });
  });

  locationButton.addEventListener("click", function () {
    locationButton.disabled = true;
    locationButton.textContent = "LOCATING...";
    status.textContent = "WEATHER / REQUESTING LOCATION";

    environment
      .connectWeather()
      .then(function () {
        status.textContent = "WEATHER / CONNECTED";
      })
      .catch(function (error) {
        status.textContent = error && error.archiveCode === "PERMISSION_DENIED" ? "WEATHER / LOCATION BLOCKED" : "WEATHER / UNAVAILABLE";
      })
      .finally(function () {
        locationButton.disabled = false;
      });
  });

  weatherEffectsToggle.addEventListener("click", function () {
    var enabled = document.body.dataset.weatherEffects !== "on";
    setWeatherEffects(enabled, true);
    status.textContent = enabled ? "WEATHER EFFECTS / ON" : "WEATHER EFFECTS / OFF";
  });

  document.addEventListener("archive:weatherchange", function (event) {
    archiveAudio.setWeather(event.detail.condition);
  });

  document.addEventListener("archive:weatherstate", function (event) {
    var state = event.detail.state;

    if (state === "connected") {
      locationButton.textContent = "UPDATE LOCATION";
      return;
    }
    if (state === "locating") {
      locationButton.textContent = "LOCATING...";
      return;
    }
    if (state === "syncing") {
      locationButton.textContent = "SYNCING...";
      return;
    }
    locationButton.textContent = state === "permission-denied" ? "RETRY LOCATION" : "USE MY LOCATION";
  });

  window.addEventListener("pageshow", function (event) {
    transitionLocked = false;
    document.body.classList.remove("is-transitioning", "is-previewing");
    status.textContent = "";
    resetSceneFocus();

    if (event.persisted) {
      environment.start();
    }
  });

  window.addEventListener("pagehide", function () {
    environment.stop();
  });

  setWeatherEffects(readWeatherEffectsPreference(), false);
  rememberVisitor();
  environment.start();
})();
