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
        }
        let inputFile = `/tmp/inputFile.pdf`;
        fs.writeFileSync(inputFile, data.Body);
        let outputFile = `/tmp/text.txt`;
        let writeStream = fs.createWriteStream(outputFile, "utf8");
        let onClose =  () => {
            let text = fs.readFileSync(outputFile, "utf8");
            put_params['Body'] = text
            put_params['ContentType'] = "text/plain";
            console.log(`Text successfully extracted, writing to S3: ${put_params['Key']}`);
            s3.putObject(put_params, (err, result) => {
                if (err) {
                    console.error("couldn't put to S3 bucket: ", err);
                    callback(err);
                } else {
                    callback(null, text);
                }
            });};

        let proc = child_process
            .execFile("pdftotext", ["-enc", "UTF-8", "-layout", inputFile, "-"], {encoding: "utf8"});
        proc.on("close", onClose);
        proc.stdout.pipe(writeStream);
    });
};