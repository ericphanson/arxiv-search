var fs = require('fs');
var request = require('request');
var AWS = require("aws-sdk");
var mktemp = require("mktemp");

// Promisified version of https://stackoverflow.com/a/32134846
var download = (url,dest) => new Promise(function(resolve, reject){
    var file = fs.createWriteStream(dest);
    var sendReq = request.get§(url);

    sendReq.on('response', function(response) {
        if (response.statusCode !== 200) {
            reject('Response status was ' + response.statusCode);
            return;
        }
    });

    sendReq.on('error', function (err) {
        fs.unlink(dest);
        reject(err.message);
        return;
    });

    sendReq.pipe(file);

    file.on('finish', function() {
        file.close(() => resolve('File written.'));  // close() is async, call cb after close completes.
        return;
    });

    file.on('error', function(err) { // Handle errors
        fs.unlink(dest); // Delete the file async. (But we don't check the result)
        reject(err.message);
        return;
    });
})

var s3 = new AWS.S3();

function uploadFile(bucket, key, contentType, data) {
    return new Promise((resolve, reject) => {
    s3.putObject({
      Bucket: bucket,
      Key: key,
      Body: data,
      ContentType: contentType
    }, function(err,data){
        if(err) {
            reject(err)
        } else {
            resolve(data)
        }
    });
    })
  }


exports.handler = function(event, context, callback) {
    // need to get the id and version somehow
    id = "1707.04249"
    version = "2"
    // from id an dversion, define the parameters
    bucket = 'arxiv-temp-pdfs'
    key1 = 'pdf_buffer/' + id + "v" + version + ".pdf"
    key2 = 'pdf_for_thumbs/' + id + "v" + version + ".pdf"
    
    content_type = "application/pdf"

    url = "https://arxiv.org/pdf/" + id + ".pdf"

    pdf_temp_file = mktemp.createFileSync("/tmp/XXXXXXXXXX.pdf")
    download(url, pdf_temp_file)
        .then(() => {
            p1 = uploadFile(bucket, key1, contentType, pdf_temp_file)
            p2 = uploadFile(bucket, key1, contentType, pdf_temp_file)
            Promise.all(p1,p2).then( () => {
                fs.unlinkSync(pdf_temp_file)
                callback("all pdfs uploaded")
            }).catch( (err) => {
                fs.unlinkSync(pdf_temp_file)
                console.log("error in uploading pdfs", err)
                callback(err)                
            })
        })
        .catch((error) => {
            console.log('error: ', error)
            callback(error)
    })
}
