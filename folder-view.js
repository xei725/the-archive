(function () {
  "use strict";

  var library = window.EZ_LIBRARY || { folders: [] };
  var params = new URLSearchParams(window.location.search);
  var folderId = params.get("folder") || "";
  var itemId = params.get("item") || "";
  var folder = library.folders.find(function (candidate) {
    return candidate.id === folderId;
  });

  var folderIndex = document.getElementById("folder-index");
  var recordView = document.getElementById("record-view");
  var returnLink = document.getElementById("return-link");

  if (!folder) {
    document.getElementById("folder-title").textContent = "Unknown Folder";
    document.getElementById("breadcrumb-folder").textContent = "Unknown Folder";
    document.getElementById("empty-state").querySelector("p").textContent = "Folder not found.";
    return;
  }

  var items = Array.isArray(folder.items) ? folder.items : [];
  document.title = folder.title + " - EZ Library";
  document.getElementById("folder-icon").src = library.folderIcon;
  document.getElementById("folder-title").textContent = folder.title;
  document.getElementById("breadcrumb-folder").textContent = folder.title;
  document.getElementById("folder-meta").textContent = items.length + " item(s)";

  if (itemId) {
    renderItem(items.find(function (candidate) { return candidate.id === itemId; }));
  } else if (items.length) {
    renderItems(items);
  }

  function renderItems(folderItems) {
    var list = document.getElementById("folder-items");
    document.getElementById("empty-state").hidden = true;
    list.hidden = false;

    folderItems.forEach(function (item) {
      var row = document.createElement("li");
      var link = document.createElement("a");
      var label = document.createElement("span");
      var type = document.createElement("span");
      row.className = "folder-item";
      link.className = "folder-item__link";
      link.href = "folder.html?folder=" + encodeURIComponent(folder.id) + "&item=" + encodeURIComponent(item.id);
      label.textContent = item.title || "Untitled item";
      if (item.type === "file") {
        var thumbnailUrl = getSafeRecordUrl(item.url);
        if (thumbnailUrl && isImageFile(item, thumbnailUrl)) {
          var thumbnail = document.createElement("img");
          thumbnail.className = "folder-item__thumb";
          thumbnail.src = thumbnailUrl;
          thumbnail.alt = "";
          thumbnail.loading = "lazy";
          link.appendChild(thumbnail);
        }
      }
      link.appendChild(label);
      type.className = "folder-item__type";
      type.textContent = "[" + String(item.type || "text").toUpperCase() + "]";
      row.appendChild(link);
      row.appendChild(type);
      list.appendChild(row);
    });
  }

  function renderItem(item) {
    folderIndex.hidden = true;
    recordView.hidden = false;
    returnLink.href = "folder.html?folder=" + encodeURIComponent(folder.id);
    returnLink.textContent = "[ RETURN TO " + folder.title.toUpperCase() + " ]";

    if (!item) {
      document.getElementById("record-title").textContent = "Record not found";
      return;
    }

    document.title = item.title + " - " + folder.title;
    document.getElementById("breadcrumb-item-wrap").hidden = false;
    document.getElementById("breadcrumb-item").textContent = item.title;
    document.getElementById("record-type").textContent = String(item.type || "text").toUpperCase();
    document.getElementById("record-title").textContent = item.title || "Untitled item";
    document.getElementById("record-description").textContent = item.description || "";

    if (item.type === "link" || item.type === "file") {
      var safeUrl = getSafeRecordUrl(item.url);
      var openLink = document.getElementById("record-open");
      if (safeUrl) {
        openLink.hidden = false;
        openLink.href = safeUrl;
        openLink.textContent = item.type === "file" ? "[ OPEN FILE ]" : "[ OPEN LINK ]";
      }

      if (item.type === "file" && safeUrl && isImageFile(item, safeUrl)) {
        var image = document.getElementById("record-image");
        image.hidden = false;
        image.src = safeUrl;
        image.alt = item.title || "EZ Library image file";
      }
    } else {
      document.getElementById("record-content").textContent = item.content || "";
    }
  }

  function getSafeRecordUrl(value) {
    var candidate = String(value || "").trim();
    if (!candidate || candidate.indexOf("//") === 0) return "";
    if (!/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(candidate)) return candidate;
    if (/^(https?:|mailto:)/i.test(candidate)) return candidate;
    return "";
  }

  function isImageFile(item, url) {
    if (/^image\//i.test(String(item.mimeType || ""))) return true;
    return /\.(avif|gif|jpe?g|png|webp)$/i.test(url.split(/[?#]/)[0]);
  }
})();
