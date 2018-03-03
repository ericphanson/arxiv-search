'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
let rp = require('request-promise-native');
let request = require('request');
let fs = require('fs');
var api_vals = require('./aws-api-key.json');
var options = {
    uri: 'https://z9m8rwiox4.execute-api.us-east-1.amazonaws.com/Prod/process-work',
    headers: {
        'XAPIKEY_HEADER': api_vals.key,
        'User-Agent': 'Request-Promise'
    },
    body: {
        'kind': 'request',
        'client_id': 'arxiv-downloader'
    },
    json: true // Automatically parses the JSON string in the response
};
let fails = [];
let succ = [];
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
let count = 0;
rp.post(options)
    .then(function (resp) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("Got response " + JSON.stringify(resp));
        for (let paper of resp) {
            count++;
            // if (count > 3) {
            // return;
            // }
            let filename = paper.idvv + "." + paper.field;
            request.get({
                'uri': paper.fetch,
                headers: {
                    "User-Agent": "request"
                }
            }).pipe(fs.createWriteStream(filename)).on('finish', () => {
                var stats = fs.statSync(filename);
                fs.createReadStream(filename).pipe(request.put({
                    uri: paper.submit,
                    headers: {
                        'Content-Length': stats['size']
                    }
                }, function (err, res, body) {
                    if (err) {
                        console.log(err);
                        fails.push({
                            idvv: paper.idvv,
                            field: paper.field
                        });
                    }
                    else {
                        succ.push(paper.idvv);
                        console.log("Uploaded " + paper.idvv + "." + paper.field);
                    }
                    fs.unlink(filename);
                }));
            });
            yield sleep(1001);
        }
        console.log("Failed papers: " + JSON.stringify(fails));
        console.log("Succeeded papers: " + succ);
    });
})
    .catch(function (err) {
    // API call failed...
    console.log("Got error : " + JSON.stringify(err));
});
//# sourceMappingURL=index.js.map