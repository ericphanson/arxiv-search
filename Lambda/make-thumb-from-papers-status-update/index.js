'use strict';
const AWS = require("aws-sdk");
const fs = require("fs");
const {spawn} = require("child_process");


exports.handler = (event, context, callback) => {
    const s3 = new AWS.S3();
    let get_params = event.resources.pdf
    let put_params = event.outputs.thumb

    
    s3.getObject(get_params, (err, data) => {
        if (err) { 
            callback(err);
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
                callback(err);
                return;
            } else {
                put_params['Body'] = fs.readFileSync(outputFile);
                put_params['ContentType'] = "image/jpg";
                console.log(`thumbnail successfully generated, writing to S3: ${put_params['Key']}`);
                s3.putObject(put_params, (err, result) => {
                    if (err) { 
                        console.error("couldn't put to S3 bucket: ", err); 
                        callback(err); 
                        return;
                    }
                    else {
                        console.log("setting `thumb` to `have`.");
                        callback(null,"Success.");
                        return;
                    }
                });
            }
        });
    });
};