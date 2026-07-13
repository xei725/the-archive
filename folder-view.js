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
      var type = document.createElement("span");
      row.className = "folder-item";
      link.href = "folder.html?folder=" + encodeURIComponent(folder.id) + "&item=" + encodeURIComponent(item.id);
      link.textContent = item.title || "Untitled item";
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
      var openLink = document.getElementById("record-open");
      openLink.hidden = false;
      openLink.href = item.url || "#";
      openLink.textContent = item.type === "file" ? "[ OPEN FILE ]" : "[ OPEN LINK ]";
    } else {
      document.getElementById("record-content").textContent = item.content || "";
    }
  }
})();
