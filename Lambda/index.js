var async = require("async");
var AWS = require("aws-sdk");
var AWS = require("aws-sdk");
// var ReadWriteLock = require('rwlock');
var gm = require("gm").subClass({imageMagick: true});
var fs = require("fs");
var mktemp = require("mktemp");

var THUMB_HEIGHT = 156,
    ALLOWED_FILETYPES = ['pdf'];

var utils = {
  decodeKey: function(key) {
    return decodeURIComponent(key).replace(/\+/g, ' ');
  }
};

function gmToBuffer (data) {
  return new Promise((resolve, reject) => {
    data.stream((err, stdout, stderr) => {
      if (err) { return reject(err) }
      const chunks = []
      stdout.on('data', (chunk) => { chunks.push(chunk) })
      // these are 'once' because they can and do fire multiple times for multiple errors,
      // but this is a promise so you'll have to deal with them one at a time
      stdout.once('end', () => { resolve(Buffer.concat(chunks)) })
      stderr.once('data', (data) => { reject(String(data)) })
    })
  })
}

var s3 = new AWS.S3();


exports.handler = function(event, context) {
  var bucket = event.Records[0].s3.bucket.name,
  srcKey = utils.decodeKey(event.Records[0].s3.object.key),
  thumbs_dir = "thumbs";
  if (!(srcKey.startsWith('pdf_for_thumbs/')))
  {
    console.error("Error: key must be in pdf_for_thumbs/. Key: " + srcKey);
    return;
  }
  var pid = srcKey.replace(/\.\w+$/, "").replace(/pdf_for_thumbs\//,""),
  out_key_without_ext = thumbs_dir + "/" + pid,
  fileType = srcKey.match(/\.\w+$/);


  if (fileType === null) {
    console.error("Invalid filetype found for key: " + srcKey);
    return;
  }

  fileType = fileType[0].substr(1);

  if (ALLOWED_FILETYPES.indexOf(fileType) === -1) {
    console.error("Filetype " + fileType + " not valid for thumbnail, exiting");
    return;
  }
  
  const wf = (whichImage, response, cb) => async.waterfall([
      function createThumbnail(next) {
        var temp_file, image;
        temp_file = mktemp.createFileSync("/tmp/XXXXXXXXXX.pdf")
        fs.writeFileSync(temp_file, response.Body);
        image = gm(temp_file + "[" + whichImage + "]");
        image.resize(null, THUMB_HEIGHT)
        .noProfile()
        .interlace('None')
        .write(temp_file, function (err) {
          if (err) {
             next(err);
          } else {
              next(null, temp_file, whichImage)
          }
            });
      },
      cb
      ],
      function(err) {
        if (err) {
          console.error(
            "Unable to generate thumbnail '" + bucket + "/" + out_key_without_ext +  "[" + whichImage + "].png"+ "'" +
            " due to error: " + err
            );
        } else {
          console.log("Created thumbnail '" + bucket + "/" + out_key_without_ext +  "[" + whichImage + "].png" + "'");
        }}
      );
    

    const response = s3.getObject({
          Bucket: bucket,
          Key: srcKey
        },
        function(err, data) {
    // Handle any error and exit
    if (err)
        return err;

    // No error happened
    // var lock = new ReadWriteLock();
     function uploadThumbnail(contentType, data, cb) {
        s3.putObject({
          Bucket: bucket,
          Key: out_key_without_ext + ".jpg",
          Body: data,
          ContentType: contentType
        }, cb);
      };
    var done = (blah) => { 
      console.log(blah)
      context.done() };
    
    var make_montage = (paths) => 
    {
      var g = gm(paths[7])
      for(var i = 0; i < 7; i++){
        g.montage(paths[i]);
        }
        
        g.in("-mode","concatenate")
        g.in("-tile","x1").setFormat('jpg').quality(80)
        gmToBuffer(g).then(function( buffer) {
          for(var i = 0; i < 8; i++){
            if(paths[i]) {
              fs.unlinkSync(paths[i]);
            }
          }
          uploadThumbnail("image/jpg", buffer, done);
        }).catch(function (err) {
            console.log("error:" + err)
              return (err);
          })
          
          
    }
    var num_callbacks = 0
    var files = {}
    
    var wfcallback = (temp_file, whichImage) => {
      // lock.writeLock(function (release) {
      // do stuff 
      files[whichImage] = temp_file
       num_callbacks = num_callbacks + 1
      if (num_callbacks > 7)
      {
        // done
        console.log(files)
        make_montage(files);
      }
      // release();
      // });
      
    }
    for(var i = 0; i < 8; i++){
      wf(String(i), data ,wfcallback)
    }
    
    
    
    });
        
  
};