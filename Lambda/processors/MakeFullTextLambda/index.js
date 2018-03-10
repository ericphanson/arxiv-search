'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const AWS = require("aws-sdk");
const fs = require("fs");
const child_process = require("child_process");
exports.handler = (event, context, callback) => {
    process.env["PATH"] = process.env["PATH"] + ":" + process.env["LAMBDA_TASK_ROOT"];
    const s3 = new AWS.S3();
    let get_params = event.resources["pdf"];
    console.log(JSON.stringify(get_params));
    let put_params = event.outputs["fulltext"];
    console.log(JSON.stringify(put_params));
    s3.getObject(get_params, (err, data) => {
        if (err) {
            callback(err);
        }
        let inputFile = `/tmp/inputFile.pdf`;
        fs.writeFileSync(inputFile, data.Body);
        let outputFile = `/tmp/text.txt`;
        let writeStream = fs.createWriteStream(outputFile);
        let onClose = () => {
            put_params['Body'] = fs.readFileSync(outputFile);
            put_params['ContentType'] = "text/plain";
            console.log(`Text successfully extracted, writing to S3: ${put_params['Key']}`);
            s3.putObject(put_params, (err, result) => {
                if (err) {
                    console.error("couldn't put to S3 bucket: ", err);
                    callback(err);
                }
                else {
                    callback(null);
                }
            });
        };
        let proc = child_process
            .execFile("pdftotext", ["-enc", "UTF-8", "-layout", inputFile, "-"], { encoding: "utf8" });
        proc.on("close", onClose);
        proc.stdout.pipe(writeStream);
    });
};
