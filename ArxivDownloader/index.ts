'use strict';

let rp = require('request-promise-native')
let request = require('request')
let fs = require('fs')

type api_params = {
    key: string
    id: string,
};
var api_vals: api_params = require('./aws-api-key.json');


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

type paper_data = {
    idvv: string,
    field: string,
    fetch: string,
    submit: string
};

type failed_paper = {
    idvv: string,
    field: string
};

let fails: failed_paper[] = [];
let succ: string[] = [];

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
let count = 0
let file_promises = []
rp.post(options)
    .then(async function (resp: paper_data[]) {
        console.log("Got response " + JSON.stringify(resp))
        for (let paper of resp) {
            count++
            // if (count > 3) {
            // return;
            // }
            let filename = paper.idvv + "." + paper.field

            file_promises.push(new Promise( (resolve,reject) => {
                
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
                    fs.unlink(filename, (ferr) => {
                        if (ferr){console.log("Error deleting " + filename + " : " + ferr)};
                      });

                    if (err) {
                        console.log(err)
                        fails.push({
                            idvv: paper.idvv,
                            field: paper.field
                        });
                        reject()
                    } else {
                        succ.push(filename);
                        console.log("Uploaded " + filename)
                        resolve()
                    }
        

                }))
            })} ));

            await sleep(1001)

        }
        return Promise.all(file_promises)
        
    }).then( () => {
        console.log("Succeeded papers: " + succ)
    })
    .catch(function (err) {
        // API call failed...
        console.log("Got error : " + JSON.stringify(err))
        if (fails) {
            console.log("Failed papers: " + JSON.stringify(fails));
        }
    });