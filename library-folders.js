(function () {
  "use strict";

  var library = window.EZ_LIBRARY;
  if (!library || !Array.isArray(library.folders)) return;

  var columns = [180, 376, 569, 745];
  var rows = [199, 315, 422, 520, 618, 708];
  var columnWidths = [190, 220, 180, 190];
  var grid = document.getElementById("library-grid");
  var shell = document.querySelector(".library-shell");

  library.folders.forEach(function (folder, index) {
    var column = index % 4;
    var row = Math.floor(index / 4);
    var rowPosition = rows[row] || rows[rows.length - 1] + (row - rows.length + 1) * 98;
    var link = document.createElement("a");
    var icon = document.createElement("img");
    var title = document.createElement("span");
    var lines = Array.isArray(folder.lines) && folder.lines.length ? folder.lines : [folder.title];

    link.className = "folder-link";
    link.href = "folder.html?folder=" + encodeURIComponent(folder.id);
    link.dataset.folderId = folder.id;
    link.setAttribute("aria-label", "Open " + folder.title);
    link.style.setProperty("--folder-x", columns[column] + "px");
    link.style.setProperty("--folder-y", rowPosition + "px");
    link.style.setProperty("--folder-width", columnWidths[column] + "px");

    icon.className = "folder-link__icon";
    icon.src = library.folderIcon;
    icon.alt = "";
    icon.width = 30;
    icon.height = 24;

    title.className = "folder-link__title";
    lines.forEach(function (line) {
      var lineElement = document.createElement("span");
      lineElement.className = "folder-link__line";
      lineElement.textContent = line;
      title.appendChild(lineElement);
    });

    link.appendChild(icon);
    link.appendChild(title);
    grid.appendChild(link);

    if (shell && rowPosition + 51 > shell.offsetHeight) {
      shell.style.minHeight = rowPosition + 51 + "px";
    }
  });
})();
