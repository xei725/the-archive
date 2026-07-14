(function () {
  "use strict";

  var MONTHS = [
    "JAN",
    "FEB",
    "MAR",
    "APR",
    "MAY",
    "JUN",
    "JUL",
    "AUG",
    "SEP",
    "OCT",
    "NOV",
    "DEC"
  ];

  var WEATHER_ALIASES = {
    clear: "clear",
    sunny: "clear",
    clouds: "cloudy",
    cloudy: "cloudy",
    overcast: "cloudy",
    rain: "rain",
    drizzle: "rain",
    thunderstorm: "storm",
    storm: "storm",
    snow: "snow",
    fog: "fog",
    mist: "fog",
    haze: "fog"
  };

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function periodForHour(hour) {
    if (hour < 5 || hour >= 21) {
      return "night";
    }

    if (hour < 8) {
      return "dawn";
    }

    if (hour >= 17) {
      return "dusk";
    }

    return "day";
  }

  function normalizeCondition(condition) {
    var key = String(condition || "").trim().toLowerCase();
    return WEATHER_ALIASES[key] || "unavailable";
  }

  function emit(name, detail) {
    document.dispatchEvent(new CustomEvent(name, { detail: detail }));
  }

  function Clock(options) {
    this.timeElement = options.timeElement;
    this.dateElement = options.dateElement;
    this.timer = null;
  }

  Clock.prototype.render = function () {
    var now = new Date();
    var timeText = pad(now.getHours()) + ":" + pad(now.getMinutes());
    var dateText = pad(now.getDate()) + " " + MONTHS[now.getMonth()] + " " + now.getFullYear();

    this.timeElement.textContent = timeText;
    this.timeElement.dateTime = now.toISOString();
    this.dateElement.textContent = dateText;
    document.body.dataset.period = periodForHour(now.getHours());
  };

  Clock.prototype.start = function () {
    var clock = this;
    this.stop();
    this.render();
    this.timer = window.setInterval(function () {
      clock.render();
    }, 1000);
  };

  Clock.prototype.stop = function () {
    window.clearInterval(this.timer);
    this.timer = null;
  };

  function WeatherSystem(options) {
    this.valueElement = options.valueElement;
    this.locationElement = options.locationElement;
    this.provider = options.provider || null;
    this.timer = null;
  }

  WeatherSystem.prototype.getProviderMethod = function () {
    if (typeof this.provider === "function") {
      return this.provider;
    }

    if (this.provider && typeof this.provider.getCurrent === "function") {
      return this.provider.getCurrent.bind(this.provider);
    }

    return null;
  };

  WeatherSystem.prototype.hasLocation = function () {
    if (!this.provider) {
      return false;
    }

    if (typeof this.provider.hasLocation === "function") {
      return this.provider.hasLocation();
    }

    return true;
  };

  WeatherSystem.prototype.setState = function (state, message, weather) {
    document.body.dataset.weatherStatus = state;
    emit("archive:weatherstate", {
      state: state,
      message: message || "",
      weather: weather || null
    });
  };

  WeatherSystem.prototype.showMessage = function (message, state) {
    document.body.dataset.weather = "unavailable";
    document.body.dataset.weatherIntensity = "none";
    this.valueElement.textContent = message;
    this.locationElement.textContent = "";
    this.locationElement.hidden = true;
    this.setState(state, message);
  };

  WeatherSystem.prototype.showError = function (error) {
    var code = error && error.archiveCode;

    if (code === "PERMISSION_DENIED") {
      this.showMessage("LOCATION BLOCKED", "permission-denied");
      return;
    }
    if (code === "LOCATION_REQUIRED") {
      this.showMessage("LOCATION REQUIRED", "location-required");
      return;
    }
    if (code === "LOCATION_UNAVAILABLE" || code === "UNSUPPORTED") {
      this.showMessage("LOCATION UNAVAILABLE", "location-error");
      return;
    }
    this.showMessage("WEATHER OFFLINE", "weather-error");
  };

  WeatherSystem.prototype.render = function (weather) {
    if (!weather || !weather.condition) {
      throw new Error("Weather provider returned an invalid payload.");
    }

    var condition = normalizeCondition(weather.condition);
    var conditionLabel = String(weather.label || weather.condition).trim().toUpperCase();
    var temperature = Number(weather.temperature);
    var unit = weather.unit === "F" ? "F" : "C";
    var value = conditionLabel;

    if (Number.isFinite(temperature)) {
      value = Math.round(temperature) + "°" + unit + " · " + conditionLabel;
    }

    document.body.dataset.weather = condition;
    document.body.dataset.weatherIntensity = /^(light|moderate|heavy)$/.test(weather.intensity)
      ? weather.intensity
      : "none";
    document.body.dataset.solar = weather.isDay === false ? "night" : "day";
    this.valueElement.textContent = value;
    this.locationElement.textContent = weather.location ? String(weather.location).toUpperCase() : "";
    this.locationElement.hidden = !this.locationElement.textContent;
    this.setState("connected", value, weather);
    emit("archive:weatherchange", weather);
  };

  WeatherSystem.prototype.refresh = function () {
    var providerMethod = this.getProviderMethod();
    var weatherSystem = this;

    if (!providerMethod) {
      this.showMessage("NOT CONNECTED", "provider-missing");
      return Promise.resolve(null);
    }

    if (!this.hasLocation()) {
      this.showMessage("LOCATION REQUIRED", "location-required");
      return Promise.resolve(null);
    }

    this.valueElement.textContent = "SYNCING";
    this.setState("syncing", "SYNCING");

    return Promise.resolve()
      .then(function () {
        return providerMethod();
      })
      .then(function (weather) {
        weatherSystem.render(weather);
        return weather;
      })
      .catch(function (error) {
        weatherSystem.showError(error);
        return null;
      });
  };

  WeatherSystem.prototype.connect = function () {
    var weatherSystem = this;

    if (!this.provider || typeof this.provider.connect !== "function") {
      var missingError = new Error("Weather provider cannot request a location.");
      missingError.archiveCode = "UNSUPPORTED";
      this.showError(missingError);
      return Promise.reject(missingError);
    }

    this.valueElement.textContent = "LOCATING";
    this.setState("locating", "LOCATING");

    return this.provider
      .connect()
      .then(function (weather) {
        weatherSystem.render(weather);
        weatherSystem.ensureTimer();
        return weather;
      })
      .catch(function (error) {
        weatherSystem.showError(error);
        throw error;
      });
  };

  WeatherSystem.prototype.ensureTimer = function () {
    var weatherSystem = this;
    window.clearInterval(this.timer);
    this.timer = window.setInterval(function () {
      weatherSystem.refresh();
    }, 15 * 60 * 1000);
  };

  WeatherSystem.prototype.start = function () {
    this.stop();
    this.refresh();

    if (this.getProviderMethod() && this.hasLocation()) {
      this.ensureTimer();
    }
  };

  WeatherSystem.prototype.stop = function () {
    window.clearInterval(this.timer);
    this.timer = null;
  };

  function ArchiveEnvironment(options) {
    this.clock = new Clock({
      timeElement: options.timeElement,
      dateElement: options.dateElement
    });
    this.weather = new WeatherSystem({
      valueElement: options.weatherValueElement,
      locationElement: options.weatherLocationElement,
      provider: options.weatherProvider || window.ArchiveWeatherProvider || null
    });
  }

  ArchiveEnvironment.prototype.start = function () {
    this.clock.start();
    this.weather.start();
  };

  ArchiveEnvironment.prototype.stop = function () {
    this.clock.stop();
    this.weather.stop();
  };

  ArchiveEnvironment.prototype.refreshWeather = function () {
    return this.weather.refresh();
  };

  ArchiveEnvironment.prototype.connectWeather = function () {
    return this.weather.connect();
  };

  window.ArchiveEnvironment = ArchiveEnvironment;
})();
