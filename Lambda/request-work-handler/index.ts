'use strict';
const AWS = require("aws-sdk");
AWS.config.region = 'us-east-1';

const db = new AWS.DynamoDB({
    apiVersion: '2012-08-10'
});
const s3 = new AWS.S3({
    apiVersion: '2006-03-01'
});

/** The bucket to make URLs for placing downloads in */
const BUCKET = 'arxiv-incoming';

/**
 * Simple function to flatten arrays.
 * @param arr array to flatten
 * @param result flattened array
 */
const flatten = function (arr, result = []) {
    for (let i = 0, length = arr.length; i < length; i++) {
        const value = arr[i];
        if (Array.isArray(value)) {
            flatten(value, result);
        } else {
            result.push(value);
        }
    }
    return result;
};

/** Called by AWS */
exports.handler = (event, context, callback) => {

    // the API should pass through a client_id
    const send_string = "sent_to_client=" + event.client_id;

    const MAX_NUM_TO_DOWNLOAD = 20;
    const url_keys = ["tar_url", "pdf_url"];
    const status_keys = ["tar", "pdf"];

    //all the fields we want to return
    const get_fields = [...url_keys, ...status_keys, "idvv"]

    // Step 1. convert our lists of urls and statuses into parameters for a db scan
    let expr = (r) => r + " = :w";
    let or_reducer = (accumulator, currentValue) => {
        return accumulator + ' OR ' + currentValue;
    };
    let FilterExpression = status_keys.map(expr).reduce(or_reducer);

    let comma_reducer = (accumulator, currentValue) => {
        return accumulator + ', ' + currentValue;
    };
    let ProjectionExpression = get_fields.reduce(comma_reducer);

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

    let num_items = 0;
    let num_pages = 0;
    /** The central object: a list of download parameters to return to the gateway. */    
    let list_of_download_params = [];
    let num_urls_so_far = 0;

    // Step 2. Page the database, find relevant records.
    /**
     * A recursive function for paginating through the database,
     * processing any records which meet the FilterExpression.
     * @param first true for the first round of recursion, false otherwise
     * @param start_key after the first round, a key should be sent for pagination
     * @param list_of_download_params keep track of the list the function is generating. Should start empty.
     */
    let recurse = async (first : Boolean, start_key, list_of_download_params) => {
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

            let outputs;
            try {
                outputs = flatten(await Promise.all(data.Items.map(process_record)));
            } catch (e) {
                console.log("error on processing records")
                console.log(e)
                return list_of_download_params
            }

            // flatten the list
            list_of_download_params = [...list_of_download_params, ...flatten(outputs)];

            // proceed to the next phase of recusion once the urls are processed
            let continue_key = data.LastEvaluatedKey;
            if (num_urls_so_far > MAX_NUM_TO_DOWNLOAD) {
                continue_key = false;
            }
            try {
                list_of_download_params = await recurse(false, continue_key, list_of_download_params);
            } catch (e) {
                console.log("Caught error when recursing:")
                console.log(e)
            }

        }
        return list_of_download_params;
    };


    // fire off the recursion
    recurse(true, undefined, list_of_download_params).then((result) => {
        // Lastly: return the download params to the waiting API
        callback(null, result);
    }).catch((err) => {
        console.log("Recurse had an error")
        callback(err)
    });

    // Step 3.  process the records that come through
    /** For each record, we check each possible URL to see if it is wanted.
     * If so, we collect the download parameters, and update the database
     * to say we are sending it to the client to download.
     * @param record a record returned from dynamodb
     */
    async function process_record(record) {
        let local_list_for_download = []
        let db_update_promises = []
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
                    continue;
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
                    continue;
                }
                let fetch_url;
                try {
                    fetch_url = record[uk].S;
                } catch (e) {
                    console.log(e)
                    console.log("^caught error from record[uk].s")
                    continue;
                }
                let signed_url = getUploadURL(idvv, sk)
                db_update_promises.push(update_db(idvv, sk));

                try {
                    local_list_for_download.push({
                        "fetch": fetch_url,
                        "submit": await signed_url
                    });
                    num_urls_so_far++;
                } catch (e) {
                    console.log("Error in getting signed URL")
                    console.log(e)
                }

            }
        }

        // make sure the db updates before moving on... not sure if this is needed or correct
        try {
            await Promise.all(db_update_promises)
        } catch (e) {
            console.log("Caught error when updating database:")
            console.log(e)
        }
        return local_list_for_download
    }

    /**
     * Returns a promise for a signed url for uploading a file to s3.
     * @param id should correspond to idvv of database. Used as the key for an s3 upload.
     * @param extension file extension
     */
    async function getUploadURL(id : String, extension : String) {
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

    /**
     * Update the database by changing "want"s to "sent to client"'s. Returns a promise that resolves when
     * the database updates.
     * @param idvv the id of the item in the database to update
     * @param field which field to declare as being sent to the client. e.g. "pdf".
     */
    async function update_db(idvv : String, field : String) {
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