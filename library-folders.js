(function () {
  "use strict";

  var FOLDER_ICON =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB4AAAAYCAYAAADtaU2/AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAABoSURBVEhL7ZJRCoAwDEN79N582pr9iDjFtBPWMHgMOh4pk9+ktf14rmkzquqkZSTttFmafCQ7097Qm6fFKzxsyiC079f8ldBOFfv1QAKhrcbxhHbNxveDbEJbnyue0FbjeEK7YuP8iGxT5E2acu9mSwAAAABJRU5ErkJggg==";

  /*
   * Edit this list to rename, add, remove, or reorder folders.
   * `lines` controls the exact legacy line breaks used by the reference page.
   * A future admin panel or database can replace this array without changing the page layout.
   */
  var folders = [
    { id: "whats-new", title: "What's New", lines: ["What's New"] },
    {
      id: "bombs-destruction-vandalism",
      title: "Bombs, Destruction & Vandalism",
      lines: ["Bombs, Destruction &", "Vandalism"]
    },
    {
      id: "underground-hacking-phreaking",
      title: "Underground Hacking and Phreaking",
      lines: ["Underground", "Hacking and", "Phreaking"]
    },
    { id: "legal-system", title: "Legal System", lines: ["Legal System"] },
    {
      id: "religion-occultism-theology-philosophy",
      title: "Religion, Occultism, Theology & Philosophy",
      lines: ["Religion, Occultism,", "Theology &", "Philosophy"]
    },
    {
      id: "nazism-nationalism-racism-revisionism-fascism-ariosophy",
      title: "Nazism, Nationalism, Racism, Revisionism, Fascism & Ariosophy",
      lines: ["Nazism, Nationalism,", "Racism, Revisionism,", "Fascism & Ariosophy"]
    },
    {
      id: "conspiracy-theories",
      title: "Conspiracy Theories",
      lines: ["Conspiracy", "Theories"]
    },
    {
      id: "theft-fraud-scams-carding-tricking-system",
      title: "Theft, Fraud, Scams, Carding and tricking the System",
      lines: ["Theft, Fraud, Scams,", "Carding and tricking the", "System"]
    },
    { id: "lock-picking", title: "Lock-picking", lines: ["Lock-picking"] },
    {
      id: "privacy-cryptography-ciphering",
      title: "Privacy, Cryptography and Ciphering",
      lines: ["Privacy, Cryptography and", "Ciphering"]
    },
    { id: "visual-data-crime", title: "Visual Data Crime", lines: ["Visual Data Crime"] },
    { id: "computer-viruses", title: "Computer viruses", lines: ["Computer viruses"] },
    {
      id: "anarchy-privacy-control",
      title: "Anarchy & Privacy control",
      lines: ["Anarchy & Privacy", "control"]
    },
    {
      id: "war-weaponry-terrorism-pyrotechnics",
      title: "War, Weaponry, Terrorism & Pyrotechnics",
      lines: ["War, Weaponry, Terrorism &", "Pyrotechnics"]
    },
    {
      id: "science-technology",
      title: "Science & Technology",
      lines: ["Science &", "Technology"]
    },
    { id: "hoaxes", title: "Hoaxes", lines: ["Hoaxes"] },
    { id: "misc", title: "Misc", lines: ["Misc"] },
    { id: "biographies", title: "Biographies", lines: ["Biographies"] },
    { id: "drugs", title: "Drugs", lines: ["Drugs"] },
    {
      id: "government-information",
      title: "Government Information",
      lines: ["Government", "Information"]
    },
    { id: "aliens-ufos", title: "Aliens & UFOs", lines: ["Aliens & UFOs"] },
    { id: "it", title: "I.T.", lines: ["I.T."] },
    { id: "mathematics", title: "Mathematics", lines: ["Mathematics"] },
    { id: "thought-writing", title: "Thought & Writing", lines: ["Thought & Writing"] }
  ];

  var columns = [180, 376, 569, 745];
  var rows = [199, 315, 422, 520, 618, 708];
  var columnWidths = [190, 220, 180, 190];
  var grid = document.getElementById("library-grid");

  folders.forEach(function (folder, index) {
    var column = index % 4;
    var row = Math.floor(index / 4);
    var link = document.createElement("a");
    var icon = document.createElement("img");
    var title = document.createElement("span");

    link.className = "folder-link";
    link.href = "#" + folder.id;
    link.dataset.folderId = folder.id;
    link.setAttribute("aria-label", folder.title + " - empty folder");
    link.style.setProperty("--folder-x", columns[column] + "px");
    link.style.setProperty("--folder-y", rows[row] + "px");
    link.style.setProperty("--folder-width", columnWidths[column] + "px");

    icon.className = "folder-link__icon";
    icon.src = FOLDER_ICON;
    icon.alt = "";
    icon.width = 30;
    icon.height = 24;

    title.className = "folder-link__title";
    folder.lines.forEach(function (line) {
      var lineElement = document.createElement("span");
      lineElement.className = "folder-link__line";
      lineElement.textContent = line;
      title.appendChild(lineElement);
    });

    link.appendChild(icon);
    link.appendChild(title);
    link.addEventListener("click", function (event) {
      event.preventDefault();
    });
    grid.appendChild(link);
  });
})();
