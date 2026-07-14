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
  var previewTimer = null;
  var transitionLocked = false;

  var environment = new window.ArchiveEnvironment({
    timeElement: document.getElementById("local-time"),
    dateElement: document.getElementById("local-date"),
    weatherValueElement: document.getElementById("weather-value"),
    weatherLocationElement: document.getElementById("weather-location")
  });
  var archiveAudio = new window.ArchiveAudio();

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

  environment.start();
})();
