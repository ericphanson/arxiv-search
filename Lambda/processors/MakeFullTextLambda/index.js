'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const AWS = require("aws-sdk");
const fs = require("fs");
const PDFJS = require('pdfjs-dist');
exports.handler = (event, context, callback) => {
    const s3 = new AWS.S3();
    let get_params = event.resources["pdf"];
    console.log(JSON.stringify(get_params));
    let put_params = event.outputs["thumb"];
    console.log(JSON.stringify(put_params));
    s3.getObject(get_params, (err, data) => {
        if (err) {
            callback(err);
            return;
        }
        let inputFile = `/tmp/inputFile.pdf`;
        fs.writeFileSync(inputFile, data.Body);
        let outputFile = `/tmp/text.text`;
        // do something to write output file
        function gettext(file) {
            var pdf = PDFJS.getDocument(file);
            return pdf.then(function (pdf) {
                var maxPages = pdf.numPages;
                var countPromises = []; // collecting all page promises
                for (var j = 1; j <= maxPages; j++) {
                    var page = pdf.getPage(j);
                    var txt = "";
                    countPromises.push(page.then(function (page) {
                        var textContent = page.getTextContent();
                        return textContent.then(function (text) {
                            return text.items.map(function (s) {
                                return s.str;
                            }).join(''); // value page text 
                        });
                    }));
                }
                // Wait for all pages and join text
                return Promise.all(countPromises).then(function (texts) {
                    return texts.join('');
                });
            });
        }
        gettext(inputFile).then((text) => {
            fs.writeFileSync(outputFile, text);
            put_params['Body'] = fs.readFileSync(outputFile);
            put_params['ContentType'] = "text/plain";
            console.log(`Text successfully extracted, writing to S3: ${put_params['Key']}`);
            s3.putObject(put_params, (err, result) => {
                if (err) {
                    console.error("couldn't put to S3 bucket: ", err);
                    callback(err);
                    return;
                }
                else {
                    callback(null, text);
                    return;
                }
            });
        });
    });
};
