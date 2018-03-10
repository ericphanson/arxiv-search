'use strict';
import * as AWS from "aws-sdk"
import * as fs from "fs"
const child_process = require("child_process");

type bucket_key_dict = {
    [resource: string]: {
        "Bucket": string,
        "Key": string
    }
};

export const handler = (event, context, callback) => {
    
    process.env["PATH"] = process.env["PATH"] + ":" + process.env["LAMBDA_TASK_ROOT"];
    const s3 = new AWS.S3();
    let get_params = (event.resources as bucket_key_dict)["pdf"];
    console.log(JSON.stringify(get_params));
    let put_params = (event.outputs as bucket_key_dict)["fulltext"];

    console.log(JSON.stringify(put_params));
    s3.getObject(get_params, (err, data) => {
        if (err) {
            callback(err);
            return;
        }
        let inputFile = `/tmp/inputFile.pdf`;
        fs.writeFileSync(inputFile, data.Body);
        let outputFile = `/tmp/text.txt`;

        // do something to write output file

        // function gettext(file: string) {
        //     var pdf = PDFJS.getDocument(file);
        //     return pdf.then(function (pdf) { // get all pages text
        //         var maxPages = pdf.numPages;
        //         var countPromises = []; // collecting all page promises
        //         for (var j = 1; j <= maxPages; j++) {
        //             var page = pdf.getPage(j);

        //             var txt = "";
        //             countPromises.push(page.then(function (page) { // add page promise
        //                 //@ts-ignore
        //                 var textContent = page.getTextContent({normalizeWhitespace : true});
        //                 return textContent.then(function (text) { // return content promise
        //                     return text.items.map(function (s) {
        //                         return s.str;
        //                     }).join(''); // value page text 

        //                 });
        //             }));
        //         }
        //         // Wait for all pages and join text
        //         return Promise.all(countPromises).then(function (texts) {
        //             return texts.join('');
        //         });
        //     });
        // }
        const execFile = (file, args, options) =>
            new Promise((resolve, reject) => {
                child_process.execFile(file, args, options, (error, stdout, stderr) => {
                    if (error) {
                        reject(error);
                    }
                    resolve({
                        stdout,
                        stderr
                    });
                });
            });

        execFile("pdftotext", ["-enc", "UTF-8", "-layout", inputFile, "-"], {
            encoding: "utf8"
        }).then(({ stdout }) => stdout).then((text) => {
            fs.writeFileSync(outputFile, text)
            put_params['Body'] = fs.readFileSync(outputFile);
            put_params['ContentType'] = "text/plain";
            console.log(`Text successfully extracted, writing to S3: ${put_params['Key']}`);
            s3.putObject(put_params, (err, result) => {
                if (err) {
                    console.error("couldn't put to S3 bucket: ", err);
                    callback(err);
                    return;
                } else {
                    callback(null, text);
                    return;
                }
            });
        });
    });
};