'use strict';
const AWS = require("aws-sdk");
AWS.config.region = 'us-east-1';

const db = new AWS.DynamoDB({
    apiVersion: '2012-08-10'
});
const s3 = new AWS.S3({
    apiVersion: '2006-03-01'
});

const BUCKET = 'arxiv-incoming'
exports.handler = (event, context, callback) => {
    // the API should pass through a client_id
    const send_string = "sent_to_client=" + event.client_id

    const MAX_NUM_TO_DOWNLOAD = 20
    const url_keys = ["tar_url", "pdf_url"]
    const status_keys = ["tar", "pdf"]

    // 1. convert our lists of urls and statuses into parameters for a db scan
    let expr = (r) => r + " = :w"
    let reducer = (accumulator, currentValue) => {
        return accumulator + ' OR ' + currentValue
    }
    let FilterExpression = status_keys.map(expr).reduce(reducer)
    console.log(FilterExpression)

    let scan_params = {
        TableName: "papers-status",
        ProjectionExpression: status_keys,
        ExpressionAttributeValues: {
            ":w": {
                "S": "want"
            }
        },
        FilterExpression
    }

    // 2. Scan the table, and find items which want downloading. We'll do this recursively so we can paginate.

    let num_items = 0
    let num_pages = 0
    let recurse = (first, start_key) => {
        if (first || start_key) {

            // make a copy of scan_params for this iteration
            let sp = scan_params.slice()
            if (!(first)) {
                sp['ExclusiveStartKey'] = start_key //if it's not the first, there should be a resumption key
            }
            db.scan(sp, (err, data) => {
                if (err) { //TODO 
                    console.log(err, err.stack);
                } else {
                    num_pages++;
                    console.log("On page " + num_pages)
                    num_items += data.Items.length;


                    process_urls_promise = Promise.all(data.Items.map(process_record));
                    process_urls_promise.then(() => {
                        // proceed to the next phase of recusion once the urls are processed
                        let continue_key = data.LastEvaluatedKey
                        if (num_urls_so_far > MAX_NUM_TO_DOWNLOAD) {
                            continue_key = false
                        }
                        recurse(false, continue_key);
                    }).catch((err) =>
                        console.log(err)
                    );

                }
            })
        }
    }

    let list_of_download_params = []
    let num_urls_so_far = 0
    // fire off the recursion
    recurse(true, undefined);

    //3.  process the records that come through
    function process_record(record) {
        let list_promises = []

        for (let i in status_urls) {
            let sk = status_keys[i];
            let uk = url_keys[i];
            let get = false;
            if (record[sk]) {
                let get = record[sk].S === "want"
            }
            if (get && num_urls_so_far <= MAX_NUM_TO_DOWNLOAD) {
                list_promises.push(getSignedURL(record.idvv.S, sk).then((signed_url) => {
                        return update_db(record.idvv.S, sk).then((result) => {
                            return new Promise(function (resolve, reject) {
                                let fetch_url = record[uk].S;
                                list_of_download_params.push({
                                    "fetch": fetch_url,
                                    "submit": signed_url
                                });
                                num_urls_so_far++
                                resolve("added params to download list")
                            });
                        })
                    })

                    //     .catch((err) => {
                    //         console.log("error updating database for idvv=" + record.idvv.S + " . Trying to set " + sk + " to " + send_string)
                    //     });
                    // }).catch((err) => {
                    //     console.log("error making signed URL");
                    // }));


                )
            }
        }
        return Promise.all(list_promises)
    }


    function getSignedURL(id, extension) {
        let key = id + "." + extension
        let params = {
            Bucket: BUCKET,
            Key: key
        };
        return s3.getSignedUrl('putObject', params).promise();
    }

    function update_db(idvv, field) {
        return db.updateItem({
            TableName: "papers-status",
            Key: {
                "idvv": {
                    "S": idvv
                }
            },
            ExpressionAttributeValues: {
                ":sent": {
                    "S": send_string
                }
            },
            UpdateExpression: "SET " + sk + " = :sent",
            ReturnValues: "NONE"

        });
    }


    // 5. return the download params to the waiting API
    callback(null, list_of_download_params)


};