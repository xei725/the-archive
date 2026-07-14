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

  WeatherSystem.prototype.renderUnavailable = function () {
    document.body.dataset.weather = "unavailable";
    this.valueElement.textContent = "NOT CONNECTED";
    this.locationElement.textContent = "";
    this.locationElement.hidden = true;
  };

  WeatherSystem.prototype.render = function (weather) {
    if (!weather || !weather.condition) {
      throw new Error("Weather provider returned an invalid payload.");
    }

    var condition = normalizeCondition(weather.condition);
    var conditionLabel = String(weather.condition).trim().toUpperCase();
    var temperature = Number(weather.temperature);
    var unit = weather.unit === "F" ? "F" : "C";
    var value = conditionLabel;

    if (Number.isFinite(temperature)) {
      value = Math.round(temperature) + "°" + unit + " · " + conditionLabel;
    }

    document.body.dataset.weather = condition;
    this.valueElement.textContent = value;
    this.locationElement.textContent = weather.location ? String(weather.location).toUpperCase() : "";
    this.locationElement.hidden = !this.locationElement.textContent;
  };

  WeatherSystem.prototype.refresh = function () {
    var providerMethod = this.getProviderMethod();
    var weatherSystem = this;

    if (!providerMethod) {
      this.renderUnavailable();
      return Promise.resolve(null);
    }

    this.valueElement.textContent = "SYNCING";

    return Promise.resolve()
      .then(function () {
        return providerMethod();
      })
      .then(function (weather) {
        weatherSystem.render(weather);
        return weather;
      })
      .catch(function () {
        weatherSystem.renderUnavailable();
        return null;
      });
  };

  WeatherSystem.prototype.start = function () {
    var weatherSystem = this;
    this.refresh();

    if (this.getProviderMethod()) {
      this.timer = window.setInterval(function () {
        weatherSystem.refresh();
      }, 15 * 60 * 1000);
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

  window.ArchiveEnvironment = ArchiveEnvironment;
})();
