(function () {
  "use strict";

  var STORAGE_KEY = "the-archive-weather-location-v1";
  var WEATHER_ENDPOINT = "https://api.open-meteo.com/v1/forecast";
  var LOCATION_ENDPOINT = "https://api.bigdatacloud.net/data/reverse-geocode-client";
  var REQUEST_TIMEOUT = 12000;

  var WEATHER_CODES = {
    0: { condition: "clear", label: "CLEAR" },
    1: { condition: "clear", label: "MOSTLY CLEAR" },
    2: { condition: "cloudy", label: "PARTLY CLOUDY" },
    3: { condition: "cloudy", label: "OVERCAST" },
    45: { condition: "fog", label: "FOG" },
    48: { condition: "fog", label: "RIME FOG" },
    51: { condition: "rain", label: "LIGHT DRIZZLE" },
    53: { condition: "rain", label: "DRIZZLE" },
    55: { condition: "rain", label: "HEAVY DRIZZLE" },
    56: { condition: "rain", label: "FREEZING DRIZZLE" },
    57: { condition: "rain", label: "FREEZING DRIZZLE" },
    61: { condition: "rain", label: "LIGHT RAIN" },
    63: { condition: "rain", label: "RAIN" },
    65: { condition: "rain", label: "HEAVY RAIN" },
    66: { condition: "rain", label: "FREEZING RAIN" },
    67: { condition: "rain", label: "FREEZING RAIN" },
    71: { condition: "snow", label: "LIGHT SNOW" },
    73: { condition: "snow", label: "SNOW" },
    75: { condition: "snow", label: "HEAVY SNOW" },
    77: { condition: "snow", label: "SNOW GRAINS" },
    80: { condition: "rain", label: "LIGHT SHOWERS" },
    81: { condition: "rain", label: "SHOWERS" },
    82: { condition: "rain", label: "HEAVY SHOWERS" },
    85: { condition: "snow", label: "SNOW SHOWERS" },
    86: { condition: "snow", label: "HEAVY SNOW SHOWERS" },
    95: { condition: "storm", label: "THUNDERSTORM" },
    96: { condition: "storm", label: "THUNDERSTORM" },
    99: { condition: "storm", label: "HEAVY THUNDERSTORM" }
  };

  function weatherError(code, message) {
    var error = new Error(message || code);
    error.archiveCode = code;
    return error;
  }

  function readSavedLocation() {
    try {
      var value = window.localStorage.getItem(STORAGE_KEY);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      return null;
    }
  }

  function saveLocation(location) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(location));
    } catch (error) {
      // Weather still works for this visit when storage is unavailable.
    }
  }

  function fetchJson(url) {
    var controller = typeof AbortController === "function" ? new AbortController() : null;
    var timeout = window.setTimeout(function () {
      if (controller) {
        controller.abort();
      }
    }, REQUEST_TIMEOUT);

    return window
      .fetch(url, {
        headers: { Accept: "application/json" },
        signal: controller ? controller.signal : undefined
      })
      .then(function (response) {
        if (!response.ok) {
          throw weatherError("NETWORK", "Weather request failed.");
        }
        return response.json();
      })
      .finally(function () {
        window.clearTimeout(timeout);
      });
  }

  function requestPosition() {
    if (!navigator.geolocation) {
      return Promise.reject(weatherError("UNSUPPORTED", "Geolocation is not supported."));
    }

    return new Promise(function (resolve, reject) {
      navigator.geolocation.getCurrentPosition(
        resolve,
        function (error) {
          if (error && error.code === 1) {
            reject(weatherError("PERMISSION_DENIED", "Location permission was denied."));
            return;
          }
          reject(weatherError("LOCATION_UNAVAILABLE", "Location could not be determined."));
        },
        {
          enableHighAccuracy: false,
          maximumAge: 10 * 60 * 1000,
          timeout: REQUEST_TIMEOUT
        }
      );
    });
  }

  function resolveLocationName(latitude, longitude) {
    var url =
      LOCATION_ENDPOINT +
      "?latitude=" +
      encodeURIComponent(latitude) +
      "&longitude=" +
      encodeURIComponent(longitude) +
      "&localityLanguage=zh";

    return fetchJson(url)
      .then(function (data) {
        return (
          data.city ||
          data.locality ||
          data.principalSubdivision ||
          data.countryName ||
          "LOCAL AREA"
        );
      })
      .catch(function () {
        return "LOCAL AREA";
      });
  }

  function currentWeather(location) {
    var currentFields = [
      "temperature_2m",
      "relative_humidity_2m",
      "apparent_temperature",
      "is_day",
      "precipitation",
      "rain",
      "showers",
      "snowfall",
      "weather_code",
      "cloud_cover",
      "wind_speed_10m"
    ].join(",");
    var url =
      WEATHER_ENDPOINT +
      "?latitude=" +
      encodeURIComponent(location.latitude) +
      "&longitude=" +
      encodeURIComponent(location.longitude) +
      "&current=" +
      encodeURIComponent(currentFields) +
      "&temperature_unit=celsius&wind_speed_unit=kmh&precipitation_unit=mm&timezone=auto";

    return fetchJson(url).then(function (data) {
      if (!data.current) {
        throw weatherError("INVALID_RESPONSE", "Weather data is incomplete.");
      }

      var current = data.current;
      var code = Number(current.weather_code);
      var description = WEATHER_CODES[code] || { condition: "cloudy", label: "CURRENT WEATHER" };

      return {
        condition: description.condition,
        label: description.label,
        temperature: Number(current.temperature_2m),
        unit: "C",
        location: location.name,
        isDay: Number(current.is_day) === 1,
        precipitation: Number(current.precipitation) || 0,
        rain: (Number(current.rain) || 0) + (Number(current.showers) || 0),
        snowfall: Number(current.snowfall) || 0,
        cloudCover: Number(current.cloud_cover) || 0,
        windSpeed: Number(current.wind_speed_10m) || 0,
        observedAt: current.time,
        timezone: data.timezone || "auto"
      };
    });
  }

  var provider = {
    location: readSavedLocation(),

    hasLocation: function () {
      return Boolean(this.location && Number.isFinite(this.location.latitude) && Number.isFinite(this.location.longitude));
    },

    connect: function () {
      var weatherProvider = this;

      return requestPosition().then(function (position) {
        var latitude = Number(position.coords.latitude.toFixed(3));
        var longitude = Number(position.coords.longitude.toFixed(3));

        return resolveLocationName(latitude, longitude).then(function (name) {
          weatherProvider.location = { latitude: latitude, longitude: longitude, name: name };
          saveLocation(weatherProvider.location);
          return currentWeather(weatherProvider.location);
        });
      });
    },

    getCurrent: function () {
      if (!this.hasLocation()) {
        return Promise.reject(weatherError("LOCATION_REQUIRED", "Location permission is required."));
      }
      return currentWeather(this.location);
    }
  };

  window.ArchiveWeatherProvider = provider;
})();
