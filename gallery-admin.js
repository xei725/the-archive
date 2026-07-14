(function () {
  "use strict";

  var REPOSITORY = "xei725/the-archive";
  var BRANCH = "main";
  var DATA_PATH = "gallery-data.js";
  var UPLOAD_DIRECTORY = "assets/images/photo-corridor/uploads";
  var API_BASE = "https://api.github.com";
  var MAX_SOURCE_SIZE = 25 * 1024 * 1024;
  var MAX_OUTPUT_EDGE = 1920;
  var token = "";
  var connectedUser = "";
  var records = [];
  var dataSha = "";
  var activeRecordId = "";
  var dirty = false;
  var pendingUploads = Object.create(null);
  var pendingDeletes = [];
  var publishCheckVersion = 0;

  var loginPanel = document.getElementById("login-panel");
  var loginForm = document.getElementById("login-form");
  var tokenInput = document.getElementById("token-input");
  var loginDiagnostics = document.getElementById("login-diagnostics");
  var loginDiagnosticsMessage = document.getElementById("login-diagnostics-message");
  var editor = document.getElementById("admin-editor");
  var status = document.getElementById("admin-status");
  var connectionSummary = document.getElementById("connection-summary");
  var saveButton = document.getElementById("save-button");
  var publishedLink = document.getElementById("published-link");
  var photoCount = document.getElementById("photo-count");
  var photoList = document.getElementById("photo-admin-list");
  var fileInput = document.getElementById("photo-file-input");
  var emptyEditor = document.getElementById("photo-editor-empty");
  var editorFields = document.getElementById("photo-editor-fields");
  var selectedRecordId = document.getElementById("selected-record-id");
  var previewImage = document.getElementById("photo-preview-image");
  var previewMeta = document.getElementById("photo-preview-meta");

  var fieldControls = {
    title: document.getElementById("photo-title-input"),
    date: document.getElementById("photo-date-input"),
    category: document.getElementById("photo-category-input"),
    frame: document.getElementById("photo-frame-input"),
    size: document.getElementById("photo-size-input"),
    tilt: document.getElementById("photo-tilt-input"),
    alt: document.getElementById("photo-alt-input"),
    description: document.getElementById("photo-description-input")
  };

  loginForm.addEventListener("submit", connect);
  saveButton.addEventListener("click", saveRecords);
  document.getElementById("reload-button").addEventListener("click", loadRecords);
  document.getElementById("logout-button").addEventListener("click", logout);
  document.getElementById("upload-photo-button").addEventListener("click", function () {
    fileInput.dataset.mode = "add";
    fileInput.click();
  });
  document.getElementById("replace-photo-button").addEventListener("click", function () {
    fileInput.dataset.mode = "replace";
    fileInput.click();
  });
  document.getElementById("delete-photo-button").addEventListener("click", deleteActiveRecord);
  document.getElementById("move-up-button").addEventListener("click", function () { moveActiveRecord(-1); });
  document.getElementById("move-down-button").addEventListener("click", function () { moveActiveRecord(1); });
  fileInput.addEventListener("change", handleSelectedImage);

  Object.keys(fieldControls).forEach(function (fieldName) {
    fieldControls[fieldName].addEventListener("input", function () {
      var record = activeRecord();
      if (!record) return;
      record[fieldName] = fieldName === "tilt"
        ? clampNumber(fieldControls[fieldName].value, -1, 1, 0)
        : fieldControls[fieldName].value;
      markDirty();
      renderRecordList();
      updatePreviewMeta(record);
    });
  });

  window.addEventListener("beforeunload", function (event) {
    if (!dirty) return;
    event.preventDefault();
    event.returnValue = "";
  });

  async function connect(event) {
    event.preventDefault();
    token = tokenInput.value.trim();
    if (!token) return;
    tokenInput.value = "";
    hideLoginDiagnostics();
    await loadRecords();
  }

  async function loadRecords() {
    if (!token) return;
    if (dirty && !window.confirm("Discard unsaved Gallery changes and reload from GitHub?")) return;
    setStatus("CONNECTING TO GITHUB...");
    setBusy(true);
    publishedLink.hidden = true;
    publishCheckVersion += 1;
    var wasConnected = records.length > 0 || !editor.hidden;

    try {
      if (!connectedUser) {
        var user = await githubRequest(API_BASE + "/user");
        var repository = await githubRequest(API_BASE + "/repos/" + REPOSITORY);
        connectedUser = user.login || "unknown";

        if (repository.default_branch && repository.default_branch !== BRANCH) {
          throw createAdminError("Configured branch does not match the repository default branch.", "configuration");
        }
        if (repository.permissions && repository.permissions.push === false) {
          throw createAdminError("This token can read the repository but cannot write to it.", "permission");
        }
      }

      var payload = await githubRequest(contentsEndpoint(DATA_PATH) + "?ref=" + encodeURIComponent(BRANCH));
      records = parseRecordsSource(decodeBase64Utf8(payload.content));
      records.forEach(normalizeRecord);
      dataSha = payload.sha;
      clearPendingState();
      dirty = false;
      activeRecordId = records.some(function (record) { return record.id === activeRecordId; })
        ? activeRecordId
        : (records[0] ? records[0].id : "");
      loginPanel.hidden = true;
      editor.hidden = false;
      connectionSummary.textContent = "CONNECTED AS @" + connectedUser + " / " + REPOSITORY + " / " + BRANCH;
      renderAll();
      setStatus("CONNECTED / READY");
    } catch (error) {
      if (!wasConnected) {
        token = "";
        connectedUser = "";
        records = [];
        dataSha = "";
        loginPanel.hidden = false;
        editor.hidden = true;
        showLoginDiagnostics(error);
      }
      setStatus(formatGitHubError(error, "Unable to connect."), true);
    } finally {
      setBusy(false);
    }
  }

  function parseRecordsSource(source) {
    var start = source.indexOf("[");
    var end = source.lastIndexOf("]");
    if (start === -1 || end < start) {
      throw createAdminError("Gallery data format is invalid.", "data");
    }
    var parsed = JSON.parse(source.slice(start, end + 1));
    if (!Array.isArray(parsed)) throw createAdminError("Gallery records are missing.", "data");
    return parsed;
  }

  function normalizeRecord(record, index) {
    if (!record.id) record.id = makeId("photo");
    if (["real", "archive", "anomalies"].indexOf(record.category) === -1) record.category = "real";
    if (!record.title) record.title = "Untitled Photograph";
    if (!record.date) record.date = "UNDATED";
    if (!record.alt) record.alt = record.title;
    if (!record.description) record.description = "";
    if (["wood", "metal", "brass"].indexOf(record.frame) === -1) record.frame = "wood";
    if (["landscape", "portrait", "square"].indexOf(record.size) === -1) record.size = inferSize(record.width, record.height);
    record.width = Math.max(1, Number(record.width) || 1200);
    record.height = Math.max(1, Number(record.height) || 800);
    record.tilt = clampNumber(record.tilt, -1, 1, ((index % 5) - 2) * 0.15);
  }

  function renderAll() {
    renderRecordList();
    renderActiveRecord();
  }

  function renderRecordList() {
    photoList.innerHTML = "";
    photoCount.textContent = records.length;

    records.forEach(function (record, index) {
      var button = document.createElement("button");
      var title = document.createElement("strong");
      var category = document.createElement("span");
      var details = document.createElement("small");
      button.type = "button";
      button.className = "photo-admin-button" + (record.id === activeRecordId ? " is-active" : "");
      title.textContent = String(index + 1).padStart(3, "0") + " / " + record.title;
      category.textContent = record.category;
      details.textContent = record.date + (pendingUploads[record.id] ? " / READY TO UPLOAD" : "");
      button.appendChild(title);
      button.appendChild(category);
      button.appendChild(details);
      button.addEventListener("click", function () {
        activeRecordId = record.id;
        renderAll();
      });
      photoList.appendChild(button);
    });
  }

  function renderActiveRecord() {
    var record = activeRecord();
    emptyEditor.hidden = Boolean(record);
    editorFields.hidden = !record;

    if (!record) {
      previewImage.removeAttribute("src");
      return;
    }

    selectedRecordId.textContent = record.id;
    Object.keys(fieldControls).forEach(function (fieldName) {
      fieldControls[fieldName].value = record[fieldName] == null ? "" : record[fieldName];
    });
    previewImage.src = pendingUploads[record.id] ? pendingUploads[record.id].previewUrl : record.src;
    previewImage.alt = record.alt;
    updatePreviewMeta(record);
  }

  function updatePreviewMeta(record) {
    previewMeta.textContent = record.width + " × " + record.height + " / " + record.src;
    previewImage.alt = record.alt || record.title;
  }

  async function handleSelectedImage() {
    var file = fileInput.files && fileInput.files[0];
    var mode = fileInput.dataset.mode || "add";
    fileInput.value = "";
    if (!file) return;

    if (!/^image\//i.test(file.type)) {
      setStatus("UNSUPPORTED FILE / SELECT JPEG, PNG, WEBP OR AVIF", true);
      return;
    }
    if (file.size > MAX_SOURCE_SIZE) {
      setStatus("SOURCE IMAGE TOO LARGE / 25 MB MAXIMUM", true);
      return;
    }

    setStatus("OPTIMIZING " + file.name.toUpperCase() + "...");
    setBusy(true);

    try {
      var optimized = await optimizeImage(file);
      var record = mode === "replace" ? activeRecord() : null;
      var id = record ? record.id : makeId("photo");
      var safeName = slugify(file.name.replace(/\.[^.]+$/, ""));
      var extension = optimized.blob.type === "image/webp" ? "webp" : "jpg";
      var path = UPLOAD_DIRECTORY + "/" + id + "-" + Date.now() + "-" + safeName + "." + extension;

      if (record) {
        if (pendingUploads[id]) {
          URL.revokeObjectURL(pendingUploads[id].previewUrl);
        } else {
          queueDelete(record.src);
        }
      } else {
        record = {
          id: id,
          category: "real",
          src: path,
          width: optimized.width,
          height: optimized.height,
          alt: file.name.replace(/\.[^.]+$/, ""),
          title: humanizeFileName(file.name),
          date: currentDisplayDate(),
          description: "",
          frame: "wood",
          size: inferSize(optimized.width, optimized.height),
          tilt: ((records.length % 5) - 2) * 0.15
        };
        records.push(record);
      }

      record.src = path;
      record.width = optimized.width;
      record.height = optimized.height;
      if (mode === "replace") record.size = inferSize(optimized.width, optimized.height);
      pendingUploads[id] = {
        blob: optimized.blob,
        path: path,
        previewUrl: URL.createObjectURL(optimized.blob),
        sha: ""
      };
      activeRecordId = id;
      markDirty();
      renderAll();
      setStatus("IMAGE READY / REVIEW DETAILS THEN SAVE TO WEBSITE");
    } catch (error) {
      setStatus(error.message || "IMAGE COULD NOT BE PROCESSED", true);
    } finally {
      setBusy(false);
    }
  }

  async function optimizeImage(file) {
    var image = await decodeImage(file);
    var sourceWidth = image.width || image.naturalWidth;
    var sourceHeight = image.height || image.naturalHeight;
    if (!sourceWidth || !sourceHeight) throw new Error("IMAGE DIMENSIONS COULD NOT BE READ");
    var scale = Math.min(1, MAX_OUTPUT_EDGE / Math.max(sourceWidth, sourceHeight));
    var width = Math.max(1, Math.round(sourceWidth * scale));
    var height = Math.max(1, Math.round(sourceHeight * scale));
    var canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    var context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("IMAGE OPTIMIZER IS UNAVAILABLE");
    context.drawImage(image, 0, 0, width, height);
    if (typeof image.close === "function") image.close();

    var blob = await canvasToBlob(canvas, "image/webp", 0.84);
    if (!blob || blob.type !== "image/webp") {
      blob = await canvasToBlob(canvas, "image/jpeg", 0.86);
    }
    if (!blob) throw new Error("IMAGE COMPRESSION FAILED");
    if (blob.size > 5 * 1024 * 1024) throw new Error("OPTIMIZED IMAGE EXCEEDS 5 MB");
    return { blob: blob, width: width, height: height };
  }

  async function decodeImage(file) {
    if (typeof createImageBitmap === "function") {
      try {
        return await createImageBitmap(file, { imageOrientation: "from-image" });
      } catch (error) {
        try {
          return await createImageBitmap(file);
        } catch (secondError) {
          // Fall through to the image element path.
        }
      }
    }

    return new Promise(function (resolve, reject) {
      var image = new Image();
      var url = URL.createObjectURL(file);
      image.onload = function () {
        URL.revokeObjectURL(url);
        resolve(image);
      };
      image.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("IMAGE COULD NOT BE DECODED"));
      };
      image.src = url;
    });
  }

  function canvasToBlob(canvas, type, quality) {
    return new Promise(function (resolve) {
      canvas.toBlob(resolve, type, quality);
    });
  }

  function deleteActiveRecord() {
    var record = activeRecord();
    if (!record || !window.confirm("Delete '" + record.title + "' from the Photo Corridor?")) return;
    var index = records.indexOf(record);

    if (pendingUploads[record.id]) {
      URL.revokeObjectURL(pendingUploads[record.id].previewUrl);
      delete pendingUploads[record.id];
    } else {
      queueDelete(record.src);
    }

    records.splice(index, 1);
    activeRecordId = records[Math.min(index, records.length - 1)]
      ? records[Math.min(index, records.length - 1)].id
      : "";
    markDirty();
    renderAll();
    setStatus("RECORD DELETED / SAVE TO PUBLISH");
  }

  function moveActiveRecord(direction) {
    var record = activeRecord();
    if (!record) return;
    var index = records.indexOf(record);
    var nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= records.length) return;
    records.splice(index, 1);
    records.splice(nextIndex, 0, record);
    markDirty();
    renderAll();
    setStatus("ORDER CHANGED / SAVE TO PUBLISH");
  }

  async function saveRecords() {
    if (!token || !dataSha) return;
    setStatus("VALIDATING GALLERY...");
    setBusy(true);
    publishedLink.hidden = true;

    try {
      validateRecords();
      var uploadIds = Object.keys(pendingUploads);
      for (var index = 0; index < uploadIds.length; index += 1) {
        var upload = pendingUploads[uploadIds[index]];
        setStatus("UPLOADING IMAGE " + (index + 1) + " OF " + uploadIds.length + "...");
        var body = {
          message: "Upload Photo Corridor image",
          content: await blobToBase64(upload.blob),
          branch: BRANCH
        };
        if (upload.sha) body.sha = upload.sha;
        var uploadResult = await githubRequest(contentsEndpoint(upload.path), {
          method: "PUT",
          body: JSON.stringify(body)
        });
        upload.sha = uploadResult.content && uploadResult.content.sha ? uploadResult.content.sha : upload.sha;
      }

      var source = serializeRecords();
      setStatus("SAVING GALLERY DIRECTORY...");
      var result = await githubRequest(contentsEndpoint(DATA_PATH), {
        method: "PUT",
        body: JSON.stringify({
          message: "Update Photo Corridor collection",
          content: encodeBase64Utf8(source),
          sha: dataSha,
          branch: BRANCH
        })
      });
      dataSha = result.content && result.content.sha ? result.content.sha : dataSha;

      var deletionWarning = false;
      for (var deleteIndex = 0; deleteIndex < pendingDeletes.length; deleteIndex += 1) {
        try {
          await deleteGitHubFile(pendingDeletes[deleteIndex]);
        } catch (error) {
          deletionWarning = true;
        }
      }

      clearPendingState();
      dirty = false;
      renderAll();
      setStatus(deletionWarning ? "SAVED / AN OLD IMAGE COULD NOT BE REMOVED" : "SAVED TO GITHUB / PUBLISHING...");
      checkPublishedVersion(source, deletionWarning);
    } catch (error) {
      setStatus(formatGitHubError(error, "Save failed."), true);
    } finally {
      setBusy(false);
    }
  }

  function serializeRecords() {
    var cleanRecords = records.map(function (record) {
      return {
        id: record.id,
        category: record.category,
        src: record.src,
        width: record.width,
        height: record.height,
        alt: record.alt,
        title: record.title,
        date: record.date,
        description: record.description,
        frame: record.frame,
        size: record.size,
        tilt: record.tilt
      };
    });
    return "window.PHOTO_CORRIDOR_RECORDS = " + JSON.stringify(cleanRecords, null, 2) + ";\n";
  }

  function validateRecords() {
    var ids = Object.create(null);
    records.forEach(function (record, index) {
      normalizeRecord(record, index);
      record.title = String(record.title || "Untitled Photograph").trim() || "Untitled Photograph";
      record.alt = String(record.alt || record.title).trim() || record.title;
      record.date = String(record.date || "UNDATED").trim() || "UNDATED";
      record.description = String(record.description || "").trim();
      if (!record.src) throw createAdminError("Image path is missing for " + record.title + ".", "data");
      if (ids[record.id]) throw createAdminError("Duplicate photograph ID: " + record.id, "data");
      ids[record.id] = true;
    });
  }

  async function deleteGitHubFile(path) {
    if (!isManagedImage(path)) return;
    var payload;
    try {
      payload = await githubRequest(contentsEndpoint(path) + "?ref=" + encodeURIComponent(BRANCH));
    } catch (error) {
      if (error.status === 404) return;
      throw error;
    }
    await githubRequest(contentsEndpoint(path), {
      method: "DELETE",
      body: JSON.stringify({
        message: "Remove Photo Corridor image",
        sha: payload.sha,
        branch: BRANCH
      })
    });
  }

  function queueDelete(path) {
    if (!isManagedImage(path) || pendingDeletes.indexOf(path) !== -1) return;
    pendingDeletes.push(path);
  }

  function isManagedImage(path) {
    return typeof path === "string" && path.indexOf("assets/images/photo-corridor/") === 0 && !/corridor-environment\.jpg$/i.test(path);
  }

  function activeRecord() {
    return records.find(function (record) { return record.id === activeRecordId; }) || null;
  }

  function markDirty() {
    dirty = true;
    publishedLink.hidden = true;
    setStatus("UNSAVED CHANGES");
  }

  function clearPendingState() {
    Object.keys(pendingUploads).forEach(function (id) {
      URL.revokeObjectURL(pendingUploads[id].previewUrl);
    });
    pendingUploads = Object.create(null);
    pendingDeletes = [];
  }

  function logout() {
    if (dirty && !window.confirm("Log out and discard unsaved Gallery changes?")) return;
    token = "";
    connectedUser = "";
    records = [];
    dataSha = "";
    activeRecordId = "";
    dirty = false;
    publishCheckVersion += 1;
    clearPendingState();
    editor.hidden = true;
    loginPanel.hidden = false;
    connectionSummary.textContent = "";
    publishedLink.hidden = true;
    hideLoginDiagnostics();
    renderAll();
    setStatus("LOGGED OUT / READ ONLY");
  }

  function contentsEndpoint(path) {
    return API_BASE + "/repos/" + REPOSITORY + "/contents/" + path.split("/").map(encodeURIComponent).join("/");
  }

  async function githubRequest(url, options) {
    var requestOptions = options || {};
    requestOptions.headers = Object.assign({}, requestOptions.headers, {
      "Accept": "application/vnd.github+json",
      "Authorization": "Bearer " + token,
      "X-GitHub-Api-Version": "2022-11-28"
    });
    var response = await fetch(url, requestOptions);
    var payload = await response.json().catch(function () { return {}; });
    if (!response.ok) throw createGitHubError(response, payload);
    return payload;
  }

  function createGitHubError(response, payload) {
    var message = payload && payload.message ? payload.message : "GitHub request failed: " + response.status;
    var kind = "github";
    if (response.status === 401) kind = "authentication";
    if (response.status === 403 || response.status === 404) kind = "permission";
    if (response.status === 409 || response.status === 422) kind = "conflict";
    var error = createAdminError(message, kind);
    error.status = response.status;
    error.acceptedPermissions = response.headers.get("x-accepted-github-permissions") || "";
    return error;
  }

  function createAdminError(message, kind) {
    var error = new Error(message);
    error.kind = kind || "admin";
    return error;
  }

  function formatGitHubError(error, fallback) {
    if (!error) return fallback;
    if (error.kind === "authentication") return "TOKEN REJECTED / IT IS INVALID OR EXPIRED";
    if (error.kind === "permission") return "TOKEN HAS NO WRITE ACCESS TO " + REPOSITORY.toUpperCase();
    if (error.kind === "conflict") return "GITHUB DATA CHANGED / RELOAD BEFORE SAVING AGAIN";
    return error.message || fallback;
  }

  function showLoginDiagnostics(error) {
    loginDiagnosticsMessage.textContent = formatGitHubError(error, "Unable to connect.");
    loginDiagnostics.hidden = false;
  }

  function hideLoginDiagnostics() {
    loginDiagnostics.hidden = true;
    loginDiagnosticsMessage.textContent = "";
  }

  function setBusy(isBusy) {
    var controls = document.querySelectorAll("button, input, textarea, select");
    Array.prototype.forEach.call(controls, function (control) {
      control.disabled = Boolean(isBusy);
    });
  }

  function setStatus(message, isError) {
    status.textContent = message;
    status.classList.toggle("is-error", Boolean(isError));
  }

  function makeId(prefix) {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return prefix + "-" + window.crypto.randomUUID();
    }
    return prefix + "-" + Date.now() + "-" + Math.random().toString(16).slice(2);
  }

  function slugify(value) {
    return String(value || "photograph")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "photograph";
  }

  function humanizeFileName(value) {
    var name = String(value || "Untitled Photograph").replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
    return name || "Untitled Photograph";
  }

  function inferSize(width, height) {
    var ratio = Number(width) / Math.max(1, Number(height));
    if (ratio > 1.18) return "landscape";
    if (ratio < 0.82) return "portrait";
    return "square";
  }

  function currentDisplayDate() {
    var now = new Date();
    return now.getFullYear() + "." + String(now.getMonth() + 1).padStart(2, "0") + "." + String(now.getDate()).padStart(2, "0");
  }

  function clampNumber(value, minimum, maximum, fallback) {
    var number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(maximum, Math.max(minimum, number));
  }

  function decodeBase64Utf8(value) {
    var binary = atob(String(value).replace(/\s/g, ""));
    var bytes = new Uint8Array(binary.length);
    for (var index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return new TextDecoder().decode(bytes);
  }

  function encodeBase64Utf8(value) {
    return bytesToBase64(new TextEncoder().encode(value));
  }

  async function blobToBase64(blob) {
    return bytesToBase64(new Uint8Array(await blob.arrayBuffer()));
  }

  function bytesToBase64(bytes) {
    var binary = "";
    var chunkSize = 32768;
    for (var offset = 0; offset < bytes.length; offset += chunkSize) {
      binary += String.fromCharCode.apply(null, bytes.subarray(offset, offset + chunkSize));
    }
    return btoa(binary);
  }

  async function checkPublishedVersion(expectedSource, hasWarning) {
    var checkVersion = ++publishCheckVersion;
    for (var attempt = 0; attempt < 18; attempt += 1) {
      await delay(attempt === 0 ? 1500 : 5000);
      if (checkVersion !== publishCheckVersion) return;
      try {
        var response = await fetch(DATA_PATH + "?publish-check=" + Date.now(), { cache: "no-store" });
        var publicSource = response.ok ? await response.text() : "";
        if (publicSource.trim() === expectedSource.trim()) {
          setStatus(hasWarning ? "PUBLISHED / OLD UNUSED IMAGE REMAINS" : "PUBLISHED / LIVE");
          publishedLink.hidden = false;
          return;
        }
      } catch (error) {
        // GitHub Pages may need another deployment cycle.
      }
    }
    if (checkVersion === publishCheckVersion) {
      setStatus("SAVED / PUBLIC GALLERY IS STILL DEPLOYING");
      publishedLink.textContent = "[ CHECK PUBLIC GALLERY ]";
      publishedLink.hidden = false;
    }
  }

  function delay(milliseconds) {
    return new Promise(function (resolve) { window.setTimeout(resolve, milliseconds); });
  }
})();
