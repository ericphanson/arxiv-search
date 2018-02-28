'use strict';
const AWS = require("aws-sdk");
AWS.config.region = 'us-east-1';

const db = new AWS.DynamoDB({
    apiVersion: '2012-08-10'
});
const s3 = new AWS.S3({
    apiVersion: '2006-03-01'
});

const BUCKET = 'arxiv-incoming';

exports.handler = (event, context, callback) => {



    // the API should pass through a client_id
    const send_string = "sent_to_client=" + event.client_id;

    const MAX_NUM_TO_DOWNLOAD = 20;
    const url_keys = ["tar_url", "pdf_url"];
    const status_keys = ["tar", "pdf"];
    const get_fields = [...url_keys, ...status_keys, "idvv"]

    // 1. convert our lists of urls and statuses into parameters for a db scan
    let expr = (r) => r + " = :w";
    let or_reducer = (accumulator, currentValue) => {
        return accumulator + ' OR ' + currentValue;
    };
    let FilterExpression = status_keys.map(expr).reduce(or_reducer);

    let comma_reducer = (accumulator, currentValue) => {
        return accumulator + ', ' + currentValue;
    };
    let ProjectionExpression = get_fields.reduce(comma_reducer);
    console.log(FilterExpression);

    let scan_params = {
        TableName: "papers-status",
        ProjectionExpression,
        ExpressionAttributeValues: {
            ":w": {
                "S": "want"
            }
        },
        FilterExpression
    };

    // 2. Scan the table, and find items which want downloading. We'll do this recursively so we can paginate.

    let num_items = 0;
    let num_pages = 0;
    let recurse = async (first, start_key, list_of_download_params) => {
        let list_of_download_params_recurse = []
        if (first || start_key) {

            // make a copy of scan_params for this iteration
            let sp = scan_params;
            if (!(first)) {
                sp['ExclusiveStartKey'] = start_key; //if it's not the first, there should be a resumption key
            }
            let data = await db.scan(sp).promise()
            if (data.Items === undefined) {
                return list_of_download_params;
            }
            num_pages++;
            console.log("On page " + num_pages);

            
            num_items += data.Items.length;
            


            let outputs = await data.Items.map(process_record);

            // flatten the list
            list_of_download_params = list_of_download_params.concat.apply([], outputs)

            // proceed to the next phase of recusion once the urls are processed
            let continue_key = data.LastEvaluatedKey;
            if (num_urls_so_far > MAX_NUM_TO_DOWNLOAD) {
                continue_key = false;
            }
            list_of_download_params = recurse(false, continue_key, list_of_download_params);


        } else {
            return list_of_download_params;
        }

    };

    let list_of_download_params = [];
    let num_urls_so_far = 0;
    // fire off the recursion
    recurse(true, undefined, list_of_download_params).then((result) => {
            // 5. return the download params to the waiting API
            callback(null, result);
        })

    //3.  process the records that come through
    async function process_record(record) {
        let local_list_for_download = []
        for (let i in url_keys) {
            let sk = status_keys[i];
            let uk = url_keys[i];
            let get_item = false;
            if (record[sk]) {
                try {
                    get_item = record[sk].S === "want";
                } catch (e) {
                    console.log(e)
                    console.log("^caught error from record[sk].S")

                }
            }
            if (get_item && num_urls_so_far <= MAX_NUM_TO_DOWNLOAD) {
                let idvv;
                try {
                    idvv = record.idvv.S;
                } catch (e) {
                    console.log(e)
                    console.log("^caught error from record.idvv.S")
                    console.log("printing whole record:")
                    console.log(record)
                    idvv = ""
                }
                let signed_url = getUploadURL(idvv, sk)
                let updated = update_db(idvv, sk);
                let fetch_url;
                try {
                    fetch_url = record[uk].S;
                } catch (e) {
                    fetch_url = ""
                    console.log(e)
                    console.log("^caught error from record[uk].s")
                }
                local_list_for_download.push({
                    "fetch": fetch_url,
                    "submit": await signed_url
                });
                num_urls_so_far++;

                // make sure the dictionary updates before moving on... not sure if this is needed or correct
                await updated

            }
        }
        return local_list_for_download
    }


    async function getUploadURL(id, extension) {
        let key = id + "." + extension;
        let params = {
            Bucket: BUCKET,
            Key: key
        };

        let URL = new Promise(function (resolve, reject) {
            s3.getSignedUrl('putObject', params, function (err, url) {
                resolve(url);
            });
        });

        return URL
    }

    async function update_db(idvv, field) {
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
            UpdateExpression: "SET " + field + " = :sent",
            ReturnValues: "NONE"

        });
    }



};