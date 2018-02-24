'use strict';
const AWS = require("aws-sdk");
const fs = require("fs");
const {spawn} = require("child_process");

exports.handler = (event, context, callback) => {
    const s3 = new AWS.S3();
    let s3_inst = event.Records[0].s3;
    let bucket = s3_inst.bucket.name;
    let srcKey = decodeURIComponent(s3_inst.object.key).replace(/\+/g, ' ');
    if (!(srcKey.startsWith("pdf_for_thumbs/"))) {
        console.error("key must be in `pdf_for_thumbs/` directory. Key: ", srcKey);
        return;
    }
    let thumbs_dir = "thumbs"
    let pid = srcKey.replace(/\.\w+$/, "").replace(/pdf_for_thumbs\//, "");
    let out_key_without_ext = thumbs_dir + "/" + pid;
    let fileType = srcKey.match(/\.\w+$/);
    if (fileType === null) {
        console.error("invalid filetype for key: " + srcKey);
        return;
    }
    fileType = fileType[0].substr(1);
    if (fileType !== "pdf") {
        console.error(`Filetype ${fileType} is not valid for thumbnail.`);
        return;
    }
    s3.getObject({ Bucket: bucket, Key: srcKey }, (err, data) => {
        if (err) { return err; }
        let inputFile = `/tmp/inputFile.pdf`;
        fs.writeFileSync(inputFile, data.Body);
        let outputFile = `/tmp/thumb.jpg`;
        //based on https://github.com/awslabs/serverless-application-model/blob/master/examples/apps/image-processing-service/index.js
        //montage "/tmp/inputFile.pdf[0-7]" -mode Concatenate -thumbnail x156 -quality 80 -tile x1 /tmp/thumb.jpg
        console.log("spawning magick");
        let magick = spawn("montage", [inputFile + "[0-7]", '-mode', 'Concatenate', '-thumbnail', 'x156', '-quality', '80', '-tile', 'x1', outputFile]);
        magick.on("close", (code, signal) => {
            if (code !== 0) {
                console.error(`thumbnail generation failed: code=${code} signal=${signal}`);
                callback(err);
            } else {
                let data = fs.readFileSync(outputFile);
                let out_key = out_key_without_ext + ".jpg";
                console.log(`thumbnail successfully generated, writing to S3: ${out_key}`);
                s3.putObject({
                    Bucket: bucket,
                    Key: out_key,
                    Body: data,
                    ContentType: "image/jpg"
                }, (err, result) => {
                    if (err) { 
                        console.error("couldn't put to S3 bucket: ", err); 
                        callback(err); 
                    }
                    else {
                        console.log("wrote thumbnail to S3. Success.");
                        //TODO delete the source pdf.
                        //TODO extract plaintext and upload to elastic search.
                        context.done();
                    }
                })
            }
        })
    })
}