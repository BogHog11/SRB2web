var elements = require("../gp2/elements.js");
elements.appendElementsFromJSON(document.body, require("./elms.js"));
var { loadFilesystem } = require("./load.js");
var { joinPaths } = require("./pathutil.js");
var Module = {};
if (window["Module"]) {
  var Module = window["Module"];
}
var loadingScreen = elements.getGPId("loadingScreen");

var FS = null;
var filePathInput = elements.getGPId("filePathInput");
var fileListContainer = elements.getGPId("fileListContainer");
var currentPath = "/";
function getPathIsDirectory(fullPath) {
    return FS.isDir(FS.stat(fullPath).mode);
}
function refreshFileList() {
    var files = FS.readdir(currentPath).slice(2);
    elements.setInnerJSON(fileListContainer, [
        {
            element: "div",
            className: "fileListItem",
            textContent: "../ (Go up one folder)",
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
            onclick: function() {
                if (isDir) {
                    currentPath = "/"+joinPaths(currentPath, fileName);
                    refreshFileList();
                } else {
                    
                }
            }
        };
    })));
    filePathInput.value = currentPath;
}

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
        loadingScreen.remove();

        FS = Module.FS;
        //document.body.textContent = (Object.keys(FS));
        refreshFileList();
    }catch(e){
        window.alert("Failed to load filesystem: " + e + "\nReload to try again.");
        window.location.reload();
    }
})();
