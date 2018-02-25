'use strict';
const AWS = require("aws-sdk");
const fs = require("fs");
const {spawn} = require("child_process");

const setThumb = (pid, value, callback) => {
    const db = new AWS.DynamoDB({ apiVersion: '2012-08-10' });
    db.updateItem({
        TableName : "papers-status",
        Key : {"idvv" : {"S":pid}},
        ExpressionAttributeValues : {":h" : {"S": value}},
        UpdateExpression : "SET thumb = :h",
        ReturnValues : "NONE"
    }, callback);
};

exports.handler = (event, context, callback) => {
    const s3 = new AWS.S3();
    let idvv = event.idvv;
    if (idvv===undefined){
        callback(new Error("idvv field undefined! Exiting."));
        return;
    }
    //let bucket = "arxiv-temp-pdfs";
    //let srcKey = "pdf_for_thumbs/" + idvv + ".pdf";

    let in_bucket = "arxiv-incoming";
    let out_bucket = "arxiv-temp-pdfs";

    let srcKey = idvv + ".pdf"
    
    let thumbs_dir = "thumbs";

    let out_key_without_ext = thumbs_dir + "/" + idvv;
    
    const error = (err) => {
        setThumb(idvv, "error", () => {
            callback(err);
        });
    };
   console.log(`Getting key ${srcKey} from ${in_bucket}. `);
    s3.getObject({ Bucket: in_bucket, Key: srcKey }, (err, data) => {
        if (err) { 
            error(err);
            return; 
        }
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
                error(err);
                return;
            } else {
                let data = fs.readFileSync(outputFile);
                let out_key = out_key_without_ext + ".jpg";
                console.log(`thumbnail successfully generated, writing to S3: ${out_key}`);
                s3.putObject({
                    Bucket: out_bucket,
                    Key: out_key,
                    Body: data,
                    ContentType: "image/jpg"
                }, (err, result) => {
                    if (err) { 
                        console.error("couldn't put to S3 bucket: ", err); 
                        error(err); 
                        return;
                    }
                    else {
                        console.log("setting `thumb` to `have`.");
                        setThumb(idvv, "have", callback);
                        return;
                    }
                });
            }
        });
    });
};