let { promisify, inherits } = require("util");
let path = require("path");
"use strict";
exports.__esModule = true;
var request = require("request");
var xml2js = require("xml2js");
let zlib = require("zlib");
let fs = require("fs");
const { Transform } = require("stream");
let fileType = require("file-type");
let tar = require("tar-fs");
function msleep(n) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, n); }

let requestAsync = param => new Promise((resolve, reject) => request(param, (err, res) => err ? reject(err) : resolve(res)));
let parseAsync = (s) => new Promise((resolve, reject) => xml2js.parseString(s, (err, result) => err ? reject(err) : resolve(result)));
let writeFileAsync = (path, data, options) => new Promise((res, rej) => fs.writeFile(path, data, options, (err, result) => err ? rej(err) : res(result)));
let sleepAsync = (n) => new Promise((resolve, reject) => { msleep(n); resolve(); });

let getFileType = (stream) => new Promise((resolve, reject) => {
    stream.once("data", chunk => {
        console.log(chunk.length);
        resolve(fileType(chunk).ext)
    });
})

const Id = new Transform({transform(chunk, enc, cb) { this.push(chunk); cb(); }})

const FtTr = () => new Transform({
    transform(chunk, enc, cb) {
        if (!this.initBuffer) { this.initBuffer = Buffer.alloc(4100); this.index = 0; }
        this.push(chunk);
        let buffer = (Buffer.isBuffer(chunk)) ? chunk : new Buffer(chunk, enc);
        buffer.copy(this.initBuffer, this.index);
        this.index += buffer.length;
        if (!this.emitted && this.index > this.initBuffer.length) {
            let ft = fileType(this.initBuffer).ext;
            this.emitted = true;
            this.emit("havetype", ft);
        }
        cb();
    }
});

function FileTypeTransform(options) {
    if (!(this instanceof FileTypeTransform)) { return new FileTypeTransform(options); }
    this.initBuffer = Buffer.alloc(4100);
    this.index = 0;
}
inherits(FileTypeTransform, Transform);
FileTypeTransform._transform = function (chunk, enc, cb) {
}


const dldir = "dl";

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

async function getEntries(search, number) {
    let response = await requestAsync(`http://export.arxiv.org/api/query?search_query=all:${search || "quantum"}&max_results=${number || 3}`);
    let parsed = await parseAsync(response.body);
    let entries = parsed.feed.entry.map(entry => entry.id[0].match(/http:\/\/arxiv\.org\/abs\/([\w\.\/-]+)$/)[1].replace(/\//g, "_"));
    return entries;
}

async function run() {
    let entries = await getEntries("cambyse", 10);
    //let entries = ["1711.07945v1"];
    for (let entry of entries) {
        let idvv = entry;
        dl(idvv);
        await sleepAsync(1001);
    }
}
run().then(() => {
    console.log("job done");
}).catch(err => console.log(err.toString().substr(0, 1000)));
