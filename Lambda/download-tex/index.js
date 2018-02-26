"use strict";

//nodejs
const { promisify, inherits } = require("util");
const path = require("path");
const fs = require("fs");
const { Transform } = require("stream");

//3rd party
const request = require("request");
const xml2js = require("xml2js");
const zlib = require("zlib");
const fileType = require("file-type");
const tar = require("tar-fs");

/**Sleep for `n` milliseconds. */
function msleep(n) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, n); }

/* Some promisified functions. */
let requestAsync = param => new Promise((resolve, reject) => request(param, (err, res) => err ? reject(err) : resolve(res)));
let parseAsync = (s) => new Promise((resolve, reject) => xml2js.parseString(s, (err, result) => err ? reject(err) : resolve(result)));
let writeFileAsync = (path, data, options) => new Promise((res, rej) => fs.writeFile(path, data, options, (err, result) => err ? rej(err) : res(result)));
let sleepAsync = (n) => new Promise((resolve, reject) => { msleep(n); resolve(); });

/**Stream Transformer that also figures out what the file type is.  */
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
    },
    flush(cb) {
        if (!this.emitted) {
            let ft = fileType(this.initBuffer).ext;
            this.emitted = true;
            this.emit("havetype", ft);
        }
        cb();
    }
});

/**Search the arxiv with the given search query and return a list of `idvvs` __with slashes__ from the arxiv API. */
function getEntries(search, max_results) {
    return requestAsync(`http://export.arxiv.org/api/query?search_query=all:${search || "quantum"}&max_results=${max_results || 10}`)
        .then(response => parseAsync(response.body))
        .then(parsed => parsed.feed.entry.map(entry => entry.id[0].match(/http:\/\/arxiv\.org\/abs\/([\w\.\/-]+)$/)[1]))
}

exports.handler = (event, context, callback) => {
    throw new Error("not implemented properly yet, just an outline");
    getEntries("cambyse", 10).then(entries => {
        for (let entry of entries) {
            let idvv = entry.replace("/", "");
            let outputPath = path.join("dl", idvv);
            let unzipped = request({
                url: `https://export.arxiv.org/e-print/${entry}`,
                headers: { "User-Agent": "request", "Accept-Encoding": "gzip" }
            })
                .pipe(zlib.createGunzip())
                .pipe(FtTr())
            unzipped.once("havetype", (ty) => {
                console.log(`${idvv}.${ty}`);
                if (ty === "tar") {
                    //we have a source object!
                    //TODO: I think that we should just add this as a tarball rather than try to maintain directories in S3.
                    //TODO: in a different lambda, place the extracted tar in the local temp directory and then process it into a 'semantic' xml document 
                    //      with pandoc or whatever.
                    unzipped.pipe(tar.extract(outputPath));
                }
                else if (ty === "pdf") {
                    //todo; add the pdf to the db.
                }
                else {
                    console.warn("unrecognised file format ", ty);
                }
            });
            //wait before performing the next request.
            msleep(1001);
        }
    })
}