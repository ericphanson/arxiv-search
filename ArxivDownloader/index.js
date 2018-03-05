'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const rp = require("request-promise-native");
const fs = require("fs");
const request = require("request");
var api_vals = require('./aws-api-key.json');
var options = {
    uri: 'https://5r5jxlv6f3.execute-api.us-east-1.amazonaws.com/Prod/process-work',
    // uri: 'https://z9m8rwiox4.execute-api.us-east-1.amazonaws.com/Prod/process-work',
    headers: {
        'x-api-key': api_vals.key,
        'User-Agent': 'Request-Promise'
    },
    body: {
        'kind': 'request',
        'client_id': 'arxiv-downloader'
    },
    json: true // Automatically parses the JSON string in the response
};
const MAX_TRIES = 5;
let fails = [];
let succ = [];
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function awaitEvent(item, eventName) { return new Promise((resolve, reject) => item.on(eventName, resolve)); }
/**
 * Attempts to download the paper up to MAX_TRIES number of times.
 * Returns a promise which resolves when the download completes, or rejects if the maximum number of attempts was reached.
 * @param url url to download
 * @param filename filename to place the document
 */
function downloadPaper(url, filename) {
    return __awaiter(this, void 0, void 0, function* () {
        let try_again;
        let attempts = 0;
        do {
            attempts++;
            let r = request.get({
                'uri': url,
                headers: {
                    "User-Agent": "request"
                }
            });
            r.pause();
            // wait for the response
            let dl_response = yield awaitEvent(r, "response");
            if (dl_response.statusCode === 200) {
                let file = r.pipe(fs.createWriteStream(filename)); //pipe to where you want it to go
                r.resume();
                let e = yield awaitEvent(file, 'finish');
                return e;
            }
            else {
                console.log(`Got status ${dl_response.statusCode} on attempt ${attempts}`);
                if (attempts < MAX_TRIES) {
                    try_again = true;
                }
                else {
                    try_again = false;
                    throw new Error(`Failed on MAX_TRIES (${MAX_TRIES}) download attempts, so moving on...`);
                }
            }
        } while (try_again);
    });
}
function uploadPaper(url, filename) {
    let stats = fs.statSync(filename);
    return new Promise((resolve, reject) => {
        fs.createReadStream(filename).pipe(request.put({
            uri: url,
            headers: {
                'Content-Length': stats['size']
            }
        }, (err, res, body) => {
            if (err) {
                reject(err);
            }
            else {
                resolve(res);
            }
        }));
    });
}
function deleteFile(filename) {
    return new Promise((resolve, reject) => {
        fs.unlink(filename, (ferr) => {
            if (ferr) {
                console.log("Error deleting " + filename + " : " + ferr);
                reject(ferr);
            }
            else {
                resolve();
            }
        });
    });
}
rp.post(options)
    .then(function (resp) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`Got response of length ${resp.length}`);
        for (let paper of resp) {
            let filename = paper.idvv + "." + paper.field;
            try {
                yield downloadPaper(paper.fetch, filename);
                console.log(`Downloaded ${filename}`);
            }
            catch (e) {
                console.log("Download request failed. Probably set to dead?");
                fails.push({
                    idvv: paper.idvv,
                    field: paper.field
                });
                continue; // skip the rest for this paper, since we couldn't download it
            }
            // validate file ?
            try {
                yield uploadPaper(paper.submit, filename);
                console.log(`Uploaded ${filename}`);
            }
            catch (e) {
                console.log("Upload request failed. Probably set to error?");
                fails.push({
                    idvv: paper.idvv,
                    field: paper.field
                });
                continue; // skip the rest for this paper, since we couldn't download it
            }
            yield deleteFile(filename);
            yield sleep(1001);
        }
        console.log("Succeeded papers: " + succ);
        if (fails) {
            console.log("Failed papers: " + JSON.stringify(fails));
        }
    });
}).catch((err) => {
    console.log("Request error!");
    console.log(err);
});
//# sourceMappingURL=index.js.map