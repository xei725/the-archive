(function () {
  "use strict";

  var STORAGE_KEY = "the-archive-visitor-v1";
  var root = document.documentElement;
  var scene = document.getElementById("scene");
  var scanInterface = document.getElementById("scan-interface");
  var latitude = document.getElementById("latitude");
  var longitude = document.getElementById("longitude");
  var intro = document.getElementById("intro");
  var introGreeting = document.getElementById("intro-greeting");
  var introScan = document.getElementById("intro-scan");
  var introEnter = document.getElementById("intro-enter");
  var introSkip = document.getElementById("intro-skip");
  var introIdentity = document.getElementById("intro-identity");
  var localTime = document.getElementById("local-time");
  var recordPanel = document.getElementById("record-panel");
  var panelBackdrop = document.getElementById("panel-backdrop");
  var panelClose = document.getElementById("panel-close");
  var panelCode = document.getElementById("panel-code");
  var panelTitle = document.getElementById("panel-title");
  var panelIntro = document.getElementById("panel-intro");
  var recordMeta = document.getElementById("record-meta");
  var panelBody = document.getElementById("panel-body");
  var panelStatus = document.getElementById("panel-status");
  var observerState = document.getElementById("observer-state");
  var accessState = document.getElementById("access-state");
  var notice = document.getElementById("notice");
  var soundToggle = document.getElementById("sound-toggle");
  var fragment = document.getElementById("fragment");
  var fragmentRecover = document.getElementById("fragment-recover");
  var fragmentProgress = document.getElementById("fragment-progress");
  var fragmentContent = document.getElementById("fragment-content");
  var nullAccess = document.getElementById("null-access");
  var lastFocusedElement = null;
  var scanFrame = 0;
  var scanNoticeShown = false;
  var introTimers = [];
  var ambientAudio = null;
  var qaMode = new URLSearchParams(window.location.search).get("qa");

  var records = {
    subject: {
      code: "RECORD / 01",
      title: "SUBJECT",
      intro: "不是一份简历，而是一份仍在持续更新的身份记录。",
      meta: {
        "FILE ID": "SUBJECT_001",
        "STATE": "ACTIVE",
        "VISIBILITY": "PUBLIC",
        "LAST SYNC": "NOW"
      },
      body: [
        "这里将保存关于我的线索：正在做的事情、长期兴趣、重要经历，以及那些无法被职位或标签完整描述的部分。",
        "真实内容会在后续归档中逐渐替换这份初始记录。"
      ],
      status: "IDENTITY RECORD / INCOMPLETE"
    },
    works: {
      code: "RECORD / 02",
      title: "WORKS",
      intro: "作品不是陈列品，而是某段时间真实存在过的证据。",
      meta: {
        "FILE ID": "CASE_INDEX",
        "STATE": "AWAITING RECORDS",
        "VISIBILITY": "PUBLIC",
        "RECOVERED": "0 / 6"
      },
      body: [
        "这里会收录完成的项目、仍在进行的实验，以及曾被放弃但值得留下的尝试。",
        "每一个项目都将拥有自己的编号、时间、背景与恢复状态。"
      ],
      status: "CASE FILES / READY FOR INGESTION"
    },
    visuals: {
      code: "RECORD / 03",
      title: "VISUAL RECORDS",
      intro: "同一地点可以保存不止一个时间。移动指针，观察风景的另一层记录。",
      meta: {
        "FILE ID": "VISUAL_017",
        "LOCATION": "61.3790° N / 07.1511° E",
        "CAPTURE": "BLUE HOUR / EARLY SUMMER",
        "VARIANCE": "SEASONAL"
      },
      body: [
        "当前背景由两份同构图影像组成。扫描区域显示另一季节，边界之外保留蓝调时刻。",
        "未来可以将这种方式用于照片的过去与现在、现实与记忆，或者公开版本与原始版本。"
      ],
      status: "VISUAL INCONSISTENCY / STABLE"
    }
  };

  function readVisitor() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { visits: 0, records: [], fragmentRecovered: false, nullVisited: false };
      var parsed = JSON.parse(raw);
      return {
        visits: Number(parsed.visits) || 0,
        records: Array.isArray(parsed.records) ? parsed.records : [],
        lastVisit: parsed.lastVisit || null,
        fragmentRecovered: Boolean(parsed.fragmentRecovered),
        nullVisited: Boolean(parsed.nullVisited)
      };
    } catch (error) {
      return { visits: 0, records: [], fragmentRecovered: false, nullVisited: false };
    }
  }

  var visitor = readVisitor();

  function writeVisitor() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(visitor));
    } catch (error) {
      // The experience still works if storage is unavailable.
    }
  }

  function updateVisitorUI() {
    var opened = visitor.records.length;
    observerState.textContent = visitor.nullVisited ? "ARCHIVED" : visitor.visits > 1 ? "RECOGNIZED" : opened > 0 ? "OBSERVED" : "UNKNOWN";
    accessState.textContent = visitor.fragmentRecovered ? "LEVEL 02" : opened >= 3 ? "ARCHIVE" : opened > 0 ? "LEVEL 01" : "TEMPORARY";
    nullAccess.hidden = !visitor.fragmentRecovered;
    if (visitor.fragmentRecovered) showRecoveredFragment(false);
  }

  function updateClock() {
    var now = new Date();
    var display = new Intl.DateTimeFormat("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).format(now);
    localTime.textContent = display;
    localTime.dateTime = now.toISOString();
    updateEnvironment(now);
  }

  function updateEnvironment(now) {
    var hour = now.getHours();
    var phase = hour >= 7 && hour < 17 ? "day" : hour >= 17 && hour < 21 ? "blue-hour" : "night";
    var weather = now.getDate() % 3 === 0 ? "clear" : "mist";
    document.body.dataset.phase = phase;
    document.body.dataset.weather = weather;
  }

  function setScanPosition(clientX, clientY) {
    var rect = scene.getBoundingClientRect();
    var x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    var y = Math.max(0, Math.min(rect.height, clientY - rect.top));
    var xPercent = (x / rect.width) * 100;
    var yPercent = (y / rect.height) * 100;
    root.style.setProperty("--scan-x", xPercent.toFixed(2) + "%");
    root.style.setProperty("--scan-y", yPercent.toFixed(2) + "%");

    var lat = 60.72 + (1 - y / rect.height) * 1.08;
    var lon = 6.52 + (x / rect.width) * 1.1;
    latitude.textContent = lat.toFixed(4) + "° N";
    longitude.textContent = lon.toFixed(4) + "° E";

    if (!scanNoticeShown) {
      scanNoticeShown = true;
      showNotice("SEASONAL VARIANCE DETECTED");
    }
  }

  function handlePointerMove(event) {
    if (recordPanel.classList.contains("is-open")) return;
    if (scanFrame) cancelAnimationFrame(scanFrame);
    scanFrame = requestAnimationFrame(function () {
      setScanPosition(event.clientX, event.clientY);
    });
  }

  function handleTouchMove(event) {
    if (!event.touches || !event.touches[0]) return;
    setScanPosition(event.touches[0].clientX, event.touches[0].clientY);
  }

  function showNotice(message) {
    notice.textContent = message;
    notice.classList.add("is-visible");
    window.setTimeout(function () {
      notice.classList.remove("is-visible");
    }, 2500);
  }

  function renderMeta(meta) {
    recordMeta.innerHTML = "";
    Object.keys(meta).forEach(function (key) {
      var term = document.createElement("dt");
      var detail = document.createElement("dd");
      term.textContent = key;
      detail.textContent = meta[key];
      recordMeta.appendChild(term);
      recordMeta.appendChild(detail);
    });
  }

  function openRecord(key) {
    var record = records[key];
    if (!record) return;
    lastFocusedElement = document.activeElement;
    panelCode.textContent = record.code;
    panelTitle.textContent = record.title;
    panelIntro.textContent = record.intro;
    renderMeta(record.meta);
    panelBody.innerHTML = "";
    record.body.forEach(function (paragraph) {
      var element = document.createElement("p");
      element.textContent = paragraph;
      panelBody.appendChild(element);
    });
    panelStatus.textContent = record.status;
    recordPanel.classList.add("is-open");
    panelBackdrop.classList.add("is-open");
    recordPanel.setAttribute("aria-hidden", "false");
    scanInterface.style.opacity = "0.24";
    panelClose.focus();

    if (visitor.records.indexOf(key) === -1) {
      visitor.records.push(key);
      writeVisitor();
      updateVisitorUI();
    }
  }

  function closeRecord() {
    recordPanel.classList.remove("is-open");
    panelBackdrop.classList.remove("is-open");
    recordPanel.setAttribute("aria-hidden", "true");
    scanInterface.style.opacity = "";
    if (lastFocusedElement && typeof lastFocusedElement.focus === "function") {
      lastFocusedElement.focus();
    }
  }

  function setView(viewName) {
    closeRecord();
    var indexView = document.getElementById("index-view");
    var limboView = document.getElementById("limbo-view");
    var nullView = document.getElementById("null-view");
    var isLimbo = viewName === "limbo";
    var isNull = viewName === "null" && visitor.fragmentRecovered;
    indexView.hidden = isLimbo || isNull;
    limboView.hidden = !isLimbo;
    nullView.hidden = !isNull;
    requestAnimationFrame(function () {
      indexView.classList.toggle("is-active", !isLimbo && !isNull);
      limboView.classList.toggle("is-active", isLimbo);
      nullView.classList.toggle("is-active", isNull);
    });
    document.body.classList.toggle("is-null", isNull);
    scanInterface.style.opacity = isLimbo || isNull ? "0" : "";
    document.querySelectorAll(".nav-link").forEach(function (link) {
      link.classList.toggle("is-active", link.getAttribute("data-view") === viewName);
    });
    if (isLimbo) {
      showNotice("UNFILED REGION OPENED");
    } else if (isNull) {
      visitor.nullVisited = true;
      writeVisitor();
      updateVisitorUI();
      showNotice("UNLISTED REGION OPENED");
    } else {
      showNotice("ARCHIVE INDEX RESTORED");
    }
  }

  function showRecoveredFragment(animate) {
    fragment.classList.add("is-recovered");
    fragmentProgress.textContent = "RECOVERED / 100%";
    fragmentContent.hidden = false;
    fragmentContent.classList.toggle("is-recovered", Boolean(animate));
  }

  function recoverFragment() {
    if (visitor.fragmentRecovered) return;
    fragmentRecover.disabled = true;
    var progress = 17;
    var timer = window.setInterval(function () {
      progress = Math.min(100, progress + 9);
      fragmentProgress.textContent = "RECOVERING / " + progress + "%";
      if (progress >= 100) {
        window.clearInterval(timer);
        visitor.fragmentRecovered = true;
        writeVisitor();
        showRecoveredFragment(true);
        updateVisitorUI();
        showNotice("UNLISTED REGION DETECTED");
      }
    }, 80);
  }

  function clearIntroTimers() {
    introTimers.forEach(window.clearTimeout);
    introTimers = [];
  }

  function revealIntroSequence() {
    if (visitor.visits > 0) {
      document.querySelector(".intro__zh").textContent = "欢迎回来。";
      document.querySelector(".intro__en").textContent = "PREVIOUS TRACE DETECTED.";
      introIdentity.textContent = "RECOGNIZED";
    }

    introTimers.push(window.setTimeout(function () {
      introGreeting.classList.add("is-hidden");
      introScan.classList.add("is-visible");
    }, 1900));

    introTimers.push(window.setTimeout(function () {
      introEnter.classList.add("is-visible");
    }, 3600));
  }

  function enterArchive() {
    clearIntroTimers();
    visitor.visits += 1;
    visitor.lastVisit = new Date().toISOString();
    writeVisitor();
    updateVisitorUI();
    intro.classList.remove("is-active");
    intro.setAttribute("aria-hidden", "true");
    window.setTimeout(function () {
      document.querySelector('[data-record="subject"]').focus();
    }, 600);
  }

  function createAmbientAudio() {
    var AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    var context = new AudioContextClass();
    var master = context.createGain();
    var filter = context.createBiquadFilter();
    var oscillator = context.createOscillator();
    var upper = context.createOscillator();
    var upperGain = context.createGain();
    master.gain.value = 0;
    filter.type = "lowpass";
    filter.frequency.value = 520;
    oscillator.type = "sine";
    oscillator.frequency.value = 55;
    upper.type = "sine";
    upper.frequency.value = 82.4;
    upperGain.gain.value = 0.3;
    oscillator.connect(filter);
    upper.connect(upperGain);
    upperGain.connect(filter);
    filter.connect(master);
    master.connect(context.destination);
    oscillator.start();
    upper.start();
    return { context: context, master: master, enabled: false };
  }

  function toggleSound() {
    if (!ambientAudio) ambientAudio = createAmbientAudio();
    if (!ambientAudio) {
      showNotice("AUDIO UNAVAILABLE");
      return;
    }
    ambientAudio.enabled = !ambientAudio.enabled;
    ambientAudio.context.resume();
    ambientAudio.master.gain.cancelScheduledValues(ambientAudio.context.currentTime);
    ambientAudio.master.gain.linearRampToValueAtTime(
      ambientAudio.enabled ? 0.035 : 0,
      ambientAudio.context.currentTime + 0.8
    );
    soundToggle.setAttribute("aria-pressed", String(ambientAudio.enabled));
    soundToggle.querySelector(".sound-toggle__label").textContent = ambientAudio.enabled ? "SOUND ON" : "SOUND OFF";
    showNotice(ambientAudio.enabled ? "AMBIENT SIGNAL ENABLED" : "AMBIENT SIGNAL MUTED");
  }

  document.addEventListener("pointermove", handlePointerMove, { passive: true });
  document.addEventListener("touchmove", handleTouchMove, { passive: true });
  document.querySelectorAll("[data-record]").forEach(function (button) {
    button.addEventListener("click", function () {
      openRecord(button.getAttribute("data-record"));
    });
  });
  document.querySelectorAll("[data-view]").forEach(function (button) {
    button.addEventListener("click", function () {
      setView(button.getAttribute("data-view"));
    });
  });
  panelClose.addEventListener("click", closeRecord);
  panelBackdrop.addEventListener("click", closeRecord);
  introEnter.addEventListener("click", enterArchive);
  introSkip.addEventListener("click", enterArchive);
  soundToggle.addEventListener("click", toggleSound);
  fragmentRecover.addEventListener("click", recoverFragment);
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && recordPanel.classList.contains("is-open")) {
      closeRecord();
    }
  });

  updateClock();
  window.setInterval(updateClock, 1000);
  updateVisitorUI();
  if (qaMode) {
    intro.classList.remove("is-active");
    intro.setAttribute("aria-hidden", "true");
    if (qaMode === "record") {
      window.setTimeout(function () { openRecord("visuals"); }, 250);
    } else if (qaMode === "limbo") {
      window.setTimeout(function () { setView("limbo"); }, 250);
    } else if (qaMode === "null") {
      visitor.fragmentRecovered = true;
      window.setTimeout(function () { setView("null"); }, 250);
    }
  } else {
    revealIntroSequence();
  }
})();
