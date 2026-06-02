const fs = require("fs");
const path = require("path");

const source = path.resolve(__dirname, "../node_modules/@pdftron/webviewer/public");
const destination = path.resolve(__dirname, "../public/webviewer");

fs.mkdirSync(destination, { recursive: true });
fs.cpSync(source, destination, { recursive: true });
