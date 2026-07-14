(function () {
  "use strict";

  window.loadEzLibraryPage = function (viewScript) {
    var dataScript = document.createElement("script");
    dataScript.src = "library-data.js?refresh=" + Date.now();
    dataScript.onload = function () {
      var pageScript = document.createElement("script");
      pageScript.src = viewScript;
      document.body.appendChild(pageScript);
    };
    dataScript.onerror = function () {
      var emptyState = document.querySelector(".empty-state p");
      if (emptyState) emptyState.textContent = "Library data could not be loaded. Please refresh.";
    };
    document.head.appendChild(dataScript);
  };
})();
