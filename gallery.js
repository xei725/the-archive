(function () {
  "use strict";

  var BATCH_SIZE = 12;
  var records = Array.isArray(window.PHOTO_CORRIDOR_RECORDS)
    ? window.PHOTO_CORRIDOR_RECORDS.slice()
    : [];
  var filterButtons = Array.prototype.slice.call(document.querySelectorAll("[data-filter]"));
  var recordContainer = document.getElementById("corridor-records");
  var recordCount = document.getElementById("corridor-count");
  var sentinel = document.getElementById("corridor-sentinel");
  var dialog = document.getElementById("photo-dialog");
  var dialogClose = document.getElementById("dialog-close");
  var dialogImage = document.getElementById("dialog-image");
  var dialogTitle = document.getElementById("dialog-title");
  var dialogDate = document.getElementById("dialog-date");
  var dialogCategory = document.getElementById("dialog-category");
  var dialogDescription = document.getElementById("dialog-description");
  var filteredRecords = records;
  var renderedCount = 0;
  var activeFilter = "all";
  var sentinelObserver = null;

  var CATEGORY_LABELS = {
    real: "REAL PHOTOGRAPH",
    archive: "ARCHIVE RECORD",
    anomalies: "ANOMALY RECORD"
  };

  function createTextElement(tagName, className, value) {
    var element = document.createElement(tagName);
    if (className) {
      element.className = className;
    }
    element.textContent = value;
    return element;
  }

  function createRecord(record, index) {
    var item = document.createElement("article");
    var button = document.createElement("button");
    var frame = document.createElement("span");
    var image = document.createElement("img");
    var reflection = document.createElement("span");
    var plaque = document.createElement("span");
    var side = index % 2 === 0 ? "left" : "right";

    item.className = [
      "photo-record",
      "photo-record--" + (record.frame || "wood"),
      "photo-record--" + (record.size || "landscape")
    ].join(" ");
    item.dataset.side = side;
    item.dataset.category = record.category;
    item.dataset.recordId = record.id;
    item.setAttribute("role", "listitem");
    item.style.setProperty("--tilt", Number(record.tilt || 0) + "deg");
    item.style.setProperty("--record-delay", Math.min(index, 8) * 35 + "ms");

    button.className = "photo-record__button";
    button.type = "button";
    button.dataset.recordId = record.id;
    button.setAttribute("aria-label", "Open " + record.title + ", " + record.date);

    frame.className = "photo-record__frame";
    image.src = record.src;
    image.alt = record.alt;
    image.width = record.width;
    image.height = record.height;
    image.decoding = "async";
    image.loading = index < 2 ? "eager" : "lazy";
    reflection.className = "photo-record__reflection";
    reflection.setAttribute("aria-hidden", "true");

    plaque.className = "photo-record__plaque";
    plaque.appendChild(createTextElement("strong", "", record.title));
    plaque.appendChild(createTextElement("time", "", record.date));

    frame.appendChild(image);
    frame.appendChild(reflection);
    button.appendChild(frame);
    button.appendChild(plaque);
    item.appendChild(button);

    return item;
  }

  function updateCount() {
    var total = filteredRecords.length;
    recordCount.textContent = total + (total === 1 ? " RECORD" : " RECORDS");
    recordContainer.setAttribute(
      "aria-label",
      activeFilter === "all"
        ? "All photographs, " + total + " records"
        : CATEGORY_LABELS[activeFilter] + ", " + total + " records"
    );
  }

  function updateSentinel() {
    if (!sentinelObserver) {
      return;
    }

    sentinelObserver.unobserve(sentinel);
    if (renderedCount < filteredRecords.length) {
      sentinelObserver.observe(sentinel);
    }
  }

  function renderNextBatch() {
    if (renderedCount >= filteredRecords.length) {
      updateSentinel();
      return;
    }

    var fragment = document.createDocumentFragment();
    var nextRecords = filteredRecords.slice(renderedCount, renderedCount + BATCH_SIZE);

    nextRecords.forEach(function (record, batchIndex) {
      fragment.appendChild(createRecord(record, renderedCount + batchIndex));
    });

    recordContainer.insertBefore(fragment, sentinel);
    renderedCount += nextRecords.length;
    updateSentinel();
  }

  function setFilter(filter) {
    activeFilter = filter;
    filteredRecords = filter === "all"
      ? records
      : records.filter(function (record) {
          return record.category === filter;
        });
    renderedCount = 0;
    recordContainer.replaceChildren(sentinel);
    recordContainer.scrollTop = 0;

    filterButtons.forEach(function (button) {
      var selected = button.dataset.filter === filter;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-pressed", String(selected));
    });

    updateCount();
    renderNextBatch();
  }

  function openRecord(recordId) {
    var record = records.find(function (candidate) {
      return candidate.id === recordId;
    });

    if (!record) {
      return;
    }

    dialogImage.src = record.src;
    dialogImage.alt = record.alt;
    dialogImage.width = record.width;
    dialogImage.height = record.height;
    dialogTitle.textContent = record.title;
    dialogDate.textContent = record.date;
    dialogCategory.textContent = CATEGORY_LABELS[record.category] || "ARCHIVE RECORD";
    dialogDescription.textContent = record.description;

    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
  }

  filterButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      setFilter(button.dataset.filter);
    });
  });

  recordContainer.addEventListener("click", function (event) {
    var button = event.target.closest(".photo-record__button");
    if (button && recordContainer.contains(button)) {
      openRecord(button.dataset.recordId);
    }
  });

  dialogClose.addEventListener("click", function () {
    dialog.close();
  });

  dialog.addEventListener("click", function (event) {
    if (event.target === dialog) {
      dialog.close();
    }
  });

  dialog.addEventListener("close", function () {
    dialogImage.removeAttribute("src");
  });

  if ("IntersectionObserver" in window) {
    sentinelObserver = new IntersectionObserver(
      function (entries) {
        if (entries[0] && entries[0].isIntersecting) {
          renderNextBatch();
        }
      },
      {
        root: recordContainer,
        rootMargin: "0px 0px 360px 0px"
      }
    );
  }

  setFilter("all");

  if (!sentinelObserver) {
    while (renderedCount < filteredRecords.length) {
      renderNextBatch();
    }
  }
})();
