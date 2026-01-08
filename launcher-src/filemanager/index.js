var elements = require("../gp2/elements.js");
elements.appendElementsFromJSON(document.body, require("./elms.js"));
var { loadFilesystem } = require("./load.js");
var { joinPaths } = require("./pathutil.js");
var dialog = require("./dialog.js");
var Module = {};
if (window["Module"]) {
  var Module = window["Module"];
}
var jszip = require("jszip");
var loadingScreen = elements.getGPId("loadingScreen");

var FS = null;
var filePathInput = elements.getGPId("filePathInput");
var fileListContainer = elements.getGPId("fileListContainer");
var clickDropdownMenu = elements.getGPId("clickDropdownMenu");
var currentPath = "/addons/userdata";
clickDropdownMenu.hidden = true;
async function syncFs() {
    return new Promise((resolve, reject) => {
        FS.syncfs(false, (err) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}
function getPathIsDirectory(fullPath) {
    return FS.isDir(FS.stat(fullPath).mode);
}
function refreshFileList() {
    var files = FS.readdir(currentPath).slice(2);
    elements.setInnerJSON(fileListContainer, [
        {
            element: "div",
            className: "fileListItem",
            children: [
                {
                    element: "img",
                    src: "images/back.svg",
                    style: {
                        width: "16px",
                        height: "16px"
                    }
                },
                {
                    element: "span",
                    textContent: "UP...",
                }
            ],
            onclick: function() {
                if (currentPath != "/") {
                    currentPath = "/"+joinPaths(currentPath, "..");
                    refreshFileList();
                }
            }
        }
    ].concat(files.sort((fileName) => {
        return getPathIsDirectory(joinPaths(currentPath, fileName)) ? -1 : 1;
    }).map((fileName) => {
        var fullPath = joinPaths(currentPath, fileName);
        var isDir = getPathIsDirectory(fullPath);
        return {
            element: "div",
            className: "fileListItem",
            children: [
                {
                    element: "img",
                    src: isDir ? "images/folder.svg" : "images/file.svg",
                    style: {
                        width: "16px",
                        height: "16px"
                    }
                },
                {
                    element: "span",
                    textContent: isDir ? (fileName + "/") : fileName,
                }
            ],
            oncontextmenu: function(e) {
                e.preventDefault();
                clickDropdownMenu.style.opacity = 0;
                setTimeout(() => {clickDropdownMenu.style.opacity = 1;showFileDropdownMenu(e, fullPath, isDir, fileName);}, 1);
                return false;
            },
            onclick: function(e) {
                if (isDir) {
                    var previous = currentPath;
                    try{
                        currentPath = "/"+joinPaths(currentPath, fileName);
                        refreshFileList();
                    }catch(e){
                        currentPath = previous;
                        refreshFileList();
                    }
                } else {
                    setTimeout(() => {showFileDropdownMenu(e, fullPath, isDir, fileName);},1);
                    e.preventDefault();
                    return false;
                }
            }
        };
    })).concat([
        {
            element: "div",
            className: "bottomFileMarker"
        }
    ]));
    filePathInput.value = currentPath;
}
window.addEventListener("click", function() {
    clickDropdownMenu.hidden = true;
});
function showDropdownMenu(e) {
    clickDropdownMenu.style.top = e.clientY + "px";
    clickDropdownMenu.style.left = e.clientX + "px";
    clickDropdownMenu.hidden = false;
    elements.setInnerJSON(clickDropdownMenu, [
        {
            element: "div",
            className: "dropdownItem",
            textContent: "Refresh",
            onclick: function() {
                FS.syncfs(false, (err) => {
                    refreshFileList();
                });
            }
        },
        {
            element: "div",
            className: "dropdownItem",
            textContent: "Upload file(s)",
            onclick: function() {
                var fileInput = document.createElement("input");
                fileInput.type = "file";
                fileInput.multiple = true;
                fileInput.onchange = function() {
                    var files = fileInput.files;
                    if (!files[0]) {
                        return;
                    }
                    function loadFile(index) { 
                        var file = files[index];
                        var fullPath = joinPaths(currentPath, file.name);
                        loadingScreen.hidden = false;
                        loadingScreen.textContent = "Uploading \""+file.name+"\" to this folder...";
                        var reader = new FileReader();
                        reader.onload = async function() {
                            var arrayBuffer = reader.result;
                            var uint8Array = new Uint8Array(arrayBuffer);
                            FS.writeFile(fullPath, uint8Array);
                            refreshFileList();
                            await syncFs();
                            loadingScreen.hidden = true;
                            if (index + 1 < files.length) {
                                loadFile(index + 1);
                            }
                        };
                        reader.readAsArrayBuffer(file);
                    }
                    loadFile(0);
                };
                fileInput.click();
            }
        }
    ]);
}

function showFileDropdownMenu(e, fullPath, isDir, fileName) {
    clickDropdownMenu.style.top = e.clientY + "px";
    clickDropdownMenu.style.left = e.clientX + "px";
    clickDropdownMenu.hidden = false;
    elements.setInnerJSON(clickDropdownMenu, [
        {
            element: "div",
            className: "dropdownItem",
            textContent: "Delete",
            onclick: function() {
                dialog.confirm("Are you sure you want to delete \"" + fileName + "\"?").then(async (confirmed) => {
                    if (confirmed) {
                        loadingScreen.hidden = false;
                        loadingScreen.textContent = "Deleting \""+fileName+"\"...";
                        if (isDir) {
                            function removeDirContents(path) {
                                var items = FS.readdir(path).slice(2);
                                for (var i = 0; i < items.length; i++) {
                                    var itemPath = joinPaths(path, items[i]);
                                    var stat = FS.stat(itemPath);
                                    if (FS.isDir(stat.mode)) {
                                        removeDirContents(itemPath);
                                        FS.rmdir(itemPath);
                                    }
                                    else {
                                        FS.unlink(itemPath);
                                    }
                                }
                            }
                            removeDirContents(fullPath);
                            FS.rmdir(fullPath);
                        } else {
                            FS.unlink(fullPath);
                        }
                        refreshFileList();
                        await syncFs();
                        loadingScreen.hidden = true;
                    }
                });
            }
        },
        {
            element: "div",
            className: "dropdownItem",
            textContent: "Replace file",
            hidden: isDir,
            onclick: function() {
                var fileInput = document.createElement("input");
                fileInput.type = "file";
                fileInput.onchange = function() {
                    var file = fileInput.files[0];
                    if (!file) {
                        return;
                    }
                    loadingScreen.hidden = false;
                    loadingScreen.textContent = "Uploading \""+fileName+"\" and replacing file...";
                    var reader = new FileReader();
                    reader.onload = async function() {
                        var arrayBuffer = reader.result;
                        var uint8Array = new Uint8Array(arrayBuffer);
                        FS.writeFile(fullPath, uint8Array);
                        refreshFileList();
                        await syncFs();
                        loadingScreen.hidden = true;
                    };
                    reader.readAsArrayBuffer(file);
                };
                fileInput.click();
            }
        },
        {
            element: "div",
            className: "dropdownItem",
            textContent: "Rename",
            hidden: isDir,
            onclick: function() {
                dialog.prompt("Enter a new name for \"" + fileName + "\":", fileName).then(async (newName) => {
                    if (newName && newName != fileName) {
                        loadingScreen.hidden = false;
                        loadingScreen.textContent = "Renaming \""+fileName+"\" to \""+newName+"\"...";
                        var newFullPath = joinPaths(currentPath, newName);
                        FS.rename(fullPath, newFullPath);
                        refreshFileList();
                        await syncFs();
                        loadingScreen.hidden = true;
                    }
                });
            }
        },
        {
            element: "div",
            className: "dropdownItem",
            textContent: "Download",
            hidden: isDir,
            onclick: function() {
                loadingScreen.hidden = false;
                loadingScreen.textContent = "Preparing download for \""+fileName+"\"...";
                var fileData = FS.readFile(fullPath);
                var blob = new Blob([fileData], {type: "application/octet-stream"});
                var a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = fileName;
                document.body.append(a);
                a.click();
                a.remove();
                loadingScreen.hidden = true;
            }
        },
        {
            element: "div",
            className: "dropdownItem",
            textContent: "Download (save to zip)",
            hidden: !isDir,
            onclick: function() {
                loadingScreen.hidden = false;
                loadingScreen.textContent = "Preparing download for \""+fileName+"\"...";
                var zip = new jszip();
                function addFolderToZip(zipFolder, path) {
                    var items = FS.readdir(path).slice(2);
                    for (var i = 0; i < items.length; i++) {
                        var itemPath = joinPaths(path, items[i]);
                        var stat = FS.stat(itemPath);
                        if (FS.isDir(stat.mode)) {
                            var newZipFolder = zipFolder.folder(items[i]);
                            addFolderToZip(newZipFolder, itemPath);
                        }
                        else {
                            var fileData = FS.readFile(itemPath);
                            zipFolder.file(items[i], fileData);
                        }
                    }
                }
                addFolderToZip(zip.folder(fileName), fullPath);
                zip.generateAsync({type:"blob"}).then(function(content) {
                    var a = document.createElement("a");
                    a.href = URL.createObjectURL(content);
                    a.download = fileName + ".zip";
                    document.body.append(a);
                    a.click();
                    a.remove();
                    loadingScreen.hidden = true;
                });
            }
        }
    ]);
}

fileListContainer.addEventListener("contextmenu", function(e) {
    e.preventDefault();
    showDropdownMenu(e);
    return false;
});

filePathInput.addEventListener("change", function() {
    var newPath = filePathInput.value;
    try {
        var stat = FS.stat(newPath);
        if (FS.isDir(stat.mode)) {
            currentPath = newPath;
            refreshFileList();
        } else {
            filePathInput.value = currentPath;
        }
    } catch(e) {
        filePathInput.value = currentPath;
    }
});

(async function () {
    try{
        await loadFilesystem();
        loadingScreen.hidden = true;

        FS = Module.FS;
        //document.body.textContent = (Object.keys(FS));
        FS.syncfs(true, (err) => {
            refreshFileList();
        });
    }catch(e){
        window.alert("Failed to load filesystem: " + e + "\nReload to try again.");
        window.location.reload();
    }
})();
