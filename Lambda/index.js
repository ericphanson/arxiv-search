'use strict';
const AWS = require("aws-sdk");
const gm = require("gm").subClass({ imageMagick: true });
const fs = require("fs");
const s3 = new AWS.S3();

const decodeKey = key => decodeURIComponent(key).replace(/\+/g,' ');

exports.handler = (event, context, callback) => {
    let s3_inst = event.Records[0].s3;
    let bucket = s3_inst.bucket.name;
    let srcKey = decodeKey(s3_inst.object.key);
    if (!(srcKey.startsWith("pdf_for_thumbs/"))) {
        console.error("key must be in `pdf_for_thumbs\` directory. Key: ", srcKey);
        return;
    }
    let thumbs_dir = "thumbs"
    let pid = srcKey.replace(/\.\w+$/,"").replace(/pdf_for_thumbs\//,"");
    let out_key_without_ext = thumbs_dir + "/" + pid;
    let fileType = srcKey.match(/\.\w+$/);
    if (fileType === null) {
        console.error("invalid filetype for key: " + srcKey);
        return;
    }
    fileType = fileType[0].substr(1);
    console.log(`fileType: ${fileType}`);
    if (fileType !== "pdf") {
        console.error(`Filetype ${fileType} is not valid for thumbnail.`);
        return;
    }
    s3.getObject({Bucket : bucket, Key : srcKey}, (err, data) => {
        if (err){return err;}
        let inputFile = `/tmp/inputFile.pdf`;
        fs.writeFileSync(inputFile, data.Body);
        let outputFile = `/tmp/thumb.jpg`;
        //based on https://github.com/awslabs/serverless-application-model/blob/master/examples/apps/image-processing-service/index.js
        //montage "/tmp/inputFile.pdf[0-7]" -mode Concatenate -thumbnail x156 -quality 80 -tile x1 /tmp/thumb.jpg
        gm(inputFile + '[0-7]').montage()
            .out(
            '-mode', 'Concatenate',
            '-thumbnail', 'x156',
            '-quality', '80',
            '-tile', 'x1'
        ).write(outputFile ,(err) => {
            if (err) {
                console.error("thumbnail generation failed:", err);
                callback(err);
            } else {
                console.log("thumbnail successfully generated");
                let data = fs.readFileSync(outputFile);
                s3.putObject({
                    Bucket: bucket,
                    Key : out_key_without_ext + ".jpg",
                    Body : data,
                    ContentType : "image/jpg"
                }, (err, result) => {
                    if (err) {console.error("couldn't put to s3 bucket", err);}
                    else {
                        context.done();
                    }
                })
            }
        });
    })
}