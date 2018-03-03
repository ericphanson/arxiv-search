let { promisify, inherits } = require("util");
let path = require("path");
"use strict";
exports.__esModule = true;
let fs = require("fs");
const { Transform } = require("stream");
let fileType = require("file-type");
let tar = require("tar-fs");
let writeFileAsync = (path, data, options) => new Promise((res, rej) => fs.writeFile(path, data, options, (err, result) => err ? rej(err) : res(result)));
let sleepAsync = (n) => new Promise((resolve, reject) => { setTimeout(resolve, n); });

function dl(idvv) {
    let outputPath = path.join("dl", idvv);
    let unzipped = request({ url: `https://export.arxiv.org/e-print/${idvv.replace("_","/")}`, headers: { "User-Agent": "request", "Accept-Encoding": "gzip" } })
        .pipe(zlib.createGunzip())
        .pipe(FtTr())
    unzipped.on("havetype", (ty) => {
        console.log(`${idvv}.${ty}`);
        if (ty === "tar") {
            unzipped.pipe(tar.extract(outputPath)).on("error", (err) => {
                console.log("error for " + outputPath);
            });
        }
    });
}

async function run() {
    let entries = ["1711.07945v1"];
    for (let entry of entries) {
        let idvv = entry;
        dl(idvv);
        await sleepAsync(1001);
    }
}
run().then(() => {
    console.log("job done");
}).catch(err => console.log(err.toString().substr(0, 1000)));
