(function () {
  "use strict";

  var REPOSITORY = "xei725/the-archive";
  var BRANCH = "main";
  var DATA_PATH = "library-data.js";
  var MAX_FILE_SIZE = 5 * 1024 * 1024;
  var token = "";
  var library = null;
  var dataSha = "";
  var activeFolderIndex = 0;
  var dirty = false;

  var loginPanel = document.getElementById("login-panel");
  var loginForm = document.getElementById("login-form");
  var tokenInput = document.getElementById("token-input");
  var editor = document.getElementById("admin-editor");
  var status = document.getElementById("admin-status");
  var folderList = document.getElementById("folder-admin-list");
  var folderIdInput = document.getElementById("folder-id-input");
  var folderTitleInput = document.getElementById("folder-title-input");
  var folderLinesInput = document.getElementById("folder-lines-input");
  var itemList = document.getElementById("item-editor-list");
  var fileInput = document.getElementById("file-input");

  loginForm.addEventListener("submit", connect);
  document.getElementById("save-button").addEventListener("click", saveLibrary);
  document.getElementById("reload-button").addEventListener("click", loadLibrary);
  document.getElementById("logout-button").addEventListener("click", logout);
  document.getElementById("add-folder-button").addEventListener("click", addFolder);
  document.getElementById("delete-folder-button").addEventListener("click", deleteFolder);
  document.getElementById("add-text-button").addEventListener("click", function () { addItem("text"); });
  document.getElementById("add-link-button").addEventListener("click", function () { addItem("link"); });
  document.getElementById("upload-file-button").addEventListener("click", function () { fileInput.click(); });
  fileInput.addEventListener("change", uploadFile);
  folderTitleInput.addEventListener("input", updateFolderFields);
  folderLinesInput.addEventListener("input", updateFolderFields);

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
    await loadLibrary();
  }

  async function loadLibrary() {
    if (!token) return;
    if (dirty && !window.confirm("Discard unsaved changes and reload from GitHub?")) return;
    setStatus("CONNECTING TO GITHUB...");

    try {
      var payload = await githubRequest(contentsEndpoint(DATA_PATH) + "?ref=" + encodeURIComponent(BRANCH));
      var source = decodeBase64Utf8(payload.content);
      var firstEquals = source.indexOf("=");
      var lastSemicolon = source.lastIndexOf(";");
      if (firstEquals === -1 || lastSemicolon === -1) throw new Error("Library data format is invalid.");
      library = JSON.parse(source.slice(firstEquals + 1, lastSemicolon).trim());
      if (!Array.isArray(library.folders)) throw new Error("Folder data is missing.");
      library.folders.forEach(normalizeFolder);
      dataSha = payload.sha;
      activeFolderIndex = Math.min(activeFolderIndex, Math.max(0, library.folders.length - 1));
      dirty = false;
      loginPanel.hidden = true;
      editor.hidden = false;
      renderAll();
      setStatus("CONNECTED / READY");
    } catch (error) {
      token = "";
      loginPanel.hidden = false;
      editor.hidden = true;
      setStatus(error.message || "Unable to connect.", true);
    }
  }

  function normalizeFolder(folder) {
    if (!Array.isArray(folder.lines) || !folder.lines.length) folder.lines = [folder.title || "Untitled Folder"];
    if (!Array.isArray(folder.items)) folder.items = [];
  }

  function renderAll() {
    renderFolderList();
    renderFolderEditor();
  }

  function renderFolderList() {
    folderList.innerHTML = "";
    library.folders.forEach(function (folder, index) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "folder-admin-button" + (index === activeFolderIndex ? " is-active" : "");
      button.textContent = folder.title;
      button.addEventListener("click", function () {
        activeFolderIndex = index;
        renderAll();
      });
      folderList.appendChild(button);
    });
  }

  function renderFolderEditor() {
    var folder = currentFolder();
    if (!folder) {
      folderIdInput.value = "";
      folderTitleInput.value = "";
      folderLinesInput.value = "";
      itemList.innerHTML = "";
      return;
    }

    folderIdInput.value = folder.id;
    folderTitleInput.value = folder.title;
    folderLinesInput.value = folder.lines.join("\n");
    renderItems(folder);
  }

  function updateFolderFields() {
    var folder = currentFolder();
    if (!folder) return;
    folder.title = folderTitleInput.value || "Untitled Folder";
    folder.lines = folderLinesInput.value.split(/\r?\n/).map(function (line) { return line.trim(); }).filter(Boolean);
    if (!folder.lines.length) folder.lines = [folder.title];
    dirty = true;
    renderFolderList();
    setStatus("UNSAVED CHANGES");
  }

  function renderItems(folder) {
    itemList.innerHTML = "";
    folder.items.forEach(function (item, index) {
      var card = document.createElement("section");
      card.className = "item-card";
      card.innerHTML =
        '<div class="item-heading"><h4>ITEM ' + String(index + 1).padStart(2, "0") + '</h4><button type="button" data-remove>[ DELETE ]</button></div>' +
        '<div class="item-fields">' +
          '<label>TITLE<input type="text" data-field="title" /></label>' +
          '<label>TYPE<select data-field="type"><option value="text">TEXT</option><option value="link">LINK</option><option value="file">FILE</option></select></label>' +
          '<label class="field-wide">DESCRIPTION<textarea rows="2" data-field="description"></textarea></label>' +
          '<label class="field-wide" data-content-wrap>TEXT CONTENT<textarea rows="7" data-field="content"></textarea></label>' +
          '<label class="field-wide" data-url-wrap>URL OR FILE PATH<input type="text" data-field="url" /></label>' +
        '</div>';

      var title = card.querySelector('[data-field="title"]');
      var type = card.querySelector('[data-field="type"]');
      var description = card.querySelector('[data-field="description"]');
      var content = card.querySelector('[data-field="content"]');
      var url = card.querySelector('[data-field="url"]');
      title.value = item.title || "";
      type.value = item.type || "text";
      description.value = item.description || "";
      content.value = item.content || "";
      url.value = item.url || "";

      [title, type, description, content, url].forEach(function (control) {
        control.addEventListener("input", function () {
          item[control.dataset.field] = control.value;
          dirty = true;
          updateItemFieldVisibility(card, item.type);
          setStatus("UNSAVED CHANGES");
        });
      });

      card.querySelector("[data-remove]").addEventListener("click", function () {
        if (!window.confirm("Delete this item from the folder?")) return;
        folder.items.splice(index, 1);
        dirty = true;
        renderItems(folder);
        setStatus("UNSAVED CHANGES");
      });

      updateItemFieldVisibility(card, item.type);
      itemList.appendChild(card);
    });
  }

  function updateItemFieldVisibility(card, type) {
    card.querySelector("[data-content-wrap]").hidden = type !== "text";
    card.querySelector("[data-url-wrap]").hidden = type === "text";
  }

  function addFolder() {
    var id = "folder-" + Date.now();
    library.folders.push({ id: id, title: "New Folder", lines: ["New Folder"], items: [] });
    activeFolderIndex = library.folders.length - 1;
    dirty = true;
    renderAll();
    folderTitleInput.focus();
    setStatus("NEW FOLDER / UNSAVED");
  }

  function deleteFolder() {
    var folder = currentFolder();
    if (!folder || !window.confirm("Delete folder '" + folder.title + "' and all of its directory entries?")) return;
    library.folders.splice(activeFolderIndex, 1);
    activeFolderIndex = Math.max(0, activeFolderIndex - 1);
    dirty = true;
    renderAll();
    setStatus("FOLDER DELETED / UNSAVED");
  }

  function addItem(type) {
    var folder = currentFolder();
    if (!folder) return;
    folder.items.push({
      id: "item-" + Date.now(),
      title: type === "link" ? "New Link" : "New Record",
      type: type,
      description: "",
      content: "",
      url: ""
    });
    dirty = true;
    renderItems(folder);
    setStatus("NEW ITEM / UNSAVED");
  }

  async function uploadFile() {
    var file = fileInput.files && fileInput.files[0];
    var folder = currentFolder();
    fileInput.value = "";
    if (!file || !folder) return;
    if (file.size > MAX_FILE_SIZE) {
      setStatus("FILE TOO LARGE / 5 MB MAXIMUM", true);
      return;
    }

    var safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
    var path = "library-files/" + folder.id + "/" + Date.now() + "-" + safeName;
    setStatus("UPLOADING " + file.name.toUpperCase() + "...");

    try {
      await githubRequest(contentsEndpoint(path), {
        method: "PUT",
        body: JSON.stringify({
          message: "Upload EZ Library file",
          content: await fileToBase64(file),
          branch: BRANCH
        })
      });
      folder.items.push({
        id: "file-" + Date.now(),
        title: file.name,
        type: "file",
        description: "",
        content: "",
        url: path
      });
      dirty = true;
      renderItems(folder);
      setStatus("FILE UPLOADED / SAVE DIRECTORY CHANGES");
    } catch (error) {
      setStatus(error.message || "File upload failed.", true);
    }
  }

  async function saveLibrary() {
    if (!token || !library || !dataSha) return;
    setStatus("SAVING TO GITHUB...");
    try {
      var source = "window.EZ_LIBRARY = " + JSON.stringify(library, null, 2) + ";\n";
      var result = await githubRequest(contentsEndpoint(DATA_PATH), {
        method: "PUT",
        body: JSON.stringify({
          message: "Update EZ Library content",
          content: encodeBase64Utf8(source),
          sha: dataSha,
          branch: BRANCH
        })
      });
      dataSha = result.content.sha;
      dirty = false;
      setStatus("SAVED / GITHUB PAGES WILL REFRESH SHORTLY");
    } catch (error) {
      setStatus(error.message || "Save failed.", true);
    }
  }

  function logout() {
    if (dirty && !window.confirm("Log out and discard unsaved changes?")) return;
    token = "";
    library = null;
    dataSha = "";
    dirty = false;
    editor.hidden = true;
    loginPanel.hidden = false;
    setStatus("LOGGED OUT / READ ONLY");
  }

  function currentFolder() {
    return library && library.folders[activeFolderIndex];
  }

  function contentsEndpoint(path) {
    var encodedPath = path.split("/").map(encodeURIComponent).join("/");
    return "https://api.github.com/repos/" + REPOSITORY + "/contents/" + encodedPath;
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
    if (!response.ok) throw new Error(payload.message || ("GitHub request failed: " + response.status));
    return payload;
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

  async function fileToBase64(file) {
    return bytesToBase64(new Uint8Array(await file.arrayBuffer()));
  }

  function bytesToBase64(bytes) {
    var binary = "";
    var chunkSize = 32768;
    for (var offset = 0; offset < bytes.length; offset += chunkSize) {
      binary += String.fromCharCode.apply(null, bytes.subarray(offset, offset + chunkSize));
    }
    return btoa(binary);
  }

  function setStatus(message, isError) {
    status.textContent = message;
    status.classList.toggle("is-error", Boolean(isError));
  }
})();
