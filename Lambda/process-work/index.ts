'use strict';
import * as AWS from 'aws-sdk';
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

type requestEvent = {
    kind: "request"
    client_id: string,
}

type errorEvent = {
    kind: "error",
    client_id: string
    errors: { idvv : string, field : string }[]
}
type event = errorEvent | requestEvent;

const MAX_NUM_TO_DOWNLOAD = 20;
const url_keys = ["src_url", "pdf_url"];
const status_keys = ["src", "pdf"];
const TableName = "papers-status";

async function handleRequest(event: requestEvent) {
    // the API should pass through a client_id
    const send_string = "sent_to_client=" + event.client_id;


    // Step 1. convert our lists of urls and statuses into parameters for a db scan
    let FilterExpression = status_keys.map(r => r + " = :w").join(" OR ");
    //all the fields we want to return
    const get_fields = [...url_keys, ...status_keys, "idvv"]
    let ProjectionExpression = get_fields.join(", ")

    let scan_params: AWS.DynamoDB.ScanInput = {
        TableName,
        ProjectionExpression,
        ExpressionAttributeValues: { ":w": { "S": "want" } },
        FilterExpression
    };

    /**
    * Returns a promise for a signed url for uploading a file to s3.
    * @param id should correspond to idvv of database. Used as the key for an s3 upload.
    * @param extension file extension
    */
    function getUploadURL(id: string, extension: string) {
        let key = id + "." + extension;
        let params = {
            Bucket: BUCKET,
            Key: key
        };
        let URL = new Promise<string>(function (resolve, reject) {
            s3.getSignedUrl('putObject', params, function (err, url) {
                resolve(url);
            });
        });
        return URL;
    }

    /**
     * Update the database by changing "want"s to "sent to client"'s. Returns a promise that resolves when
     * the database updates.
     * @param idvv the id of the item in the database to update
     * @param field which field to declare as being sent to the client. e.g. "pdf".
     */
    function update_db(idvv: string, field: string) {
        return db.updateItem({
            TableName,
            Key: { "idvv": { "S": idvv } },
            ExpressionAttributeValues: { ":sent": { "S": send_string } },
            UpdateExpression: `SET ${field} = :sent`,
            ReturnValues: "NONE"
        }).promise();
    }

    let list_of_download_params: { idvv: string, field: string, fetch: string, submit: string }[] = [];
    let first = true;
    let continue_key = undefined;
    let num_pages = 0;
    let num_items = 0;
    do {
        let sp = { ...scan_params };
        if (continue_key) { sp.ExclusiveStartKey = continue_key; }
        let data = await db.scan(sp).promise();
        if (data.Items === undefined) {
            break;
        }
        num_pages++;
        console.log("On page " + num_pages);
        num_items += data.Items.length;
        for (let record of data.Items) {
            for (let i in url_keys) {
                /* For each record, we check each possible URL to see if it is wanted.
                 * If so, we collect the download parameters, and update the database
                 * to say we are sending it to the client to download.*/
                let sk = status_keys[i];
                let uk = url_keys[i];
                if (record[sk] && record[sk].S === "want" && list_of_download_params.length <= MAX_NUM_TO_DOWNLOAD) {
                    if (!record.idvv) {
                        console.log("record doesn't have an `idvv` term: ", record);
                        continue;
                    }
                    if (!record.idvv.S) {
                        console.log("record.idvv is not a string ", record.idvv)
                        continue;
                    }
                    let idvv = record.idvv.S;
                    if (record[uk] === undefined || record[uk].S === undefined) {
                        console.log(`record[${uk}].S was not found:  ${record}`)
                        continue;
                    }
                    let fetch_url = record[uk].S;
                    await update_db(idvv, sk);
                    let uploadUrl = await getUploadURL(idvv, sk);
                    list_of_download_params.push({
                        "idvv": idvv,
                        "field": sk,
                        "fetch": fetch_url,
                        "submit": uploadUrl
                    });
                }
            }
        }
        continue_key = data.LastEvaluatedKey;
        if (list_of_download_params.length > MAX_NUM_TO_DOWNLOAD) {
            continue_key = false;
        }
    } while (continue_key)

    return list_of_download_params;
}

async function handleError(event : errorEvent) {
    let {client_id, errors} = event;
    for (let {idvv, field} of errors) {
        //perform some validation so the api can't change things willy nilly.
        if(field === undefined || idvv === undefined) {continue;}
        if (!status_keys.some(k => field === k)) {continue;}
        await db.updateItem({
            TableName,
            Key: { "idvv": { "S": idvv } },
            ConditionExpression : `idvv = :idvv AND ${field} <> :have AND ${field} <> :dead`, //don't update if the idvv isn't there or if we regress the state.
            ExpressionAttributeValues: { 
                ":error": { "S": "error" }, 
                ":idvv" : {"S":idvv}, 
                ":have" : {"S":"have"},
                ":dead" : {"S":"dead"},
            },
            UpdateExpression: `SET ${field} = :error`,
            ReturnValues: "NONE"
        }).promise();
    }
    return {};
}

/** Called by AWS */
exports.handler = (http_resp, context, callback) => {
    let event : event
    event = JSON.parse(http_resp.body)

    console.log("Got event: " +  event)
    let promise;
    if (event.kind === "request") {
        promise = handleRequest(event);
    }
    else if (event.kind === "error") {
        promise = handleError(event);
    }
    else {
        let e = "unknown event type: " + event!.kind
        end_eval(e,null,callback)
        return;
    }
    promise.then(r =>  end_eval(null,r,callback)).catch(e => end_eval(e,null,callback));

};

function end_eval(error,success, end_callback) {
    let PR = new LambdaProxyResponse(undefined);
    let resp;
    if (error) {
        resp = PR.serverError({ 'X-header': 'Your headers value' }, { 'bodyData': JSON.stringify(error) });
    } else {
        resp = PR.ok({ 'X-header': 'Your headers value' }, { 'bodyData': JSON.stringify(success) });
    }
    return end_callback(null,resp)
}

// from https://www.npmjs.com/package/lambda-proxy-response
class LambdaProxyResponse {
    options;
    constructor(options) {
      this.options = options || { headers: {}, body: {}, status: null, extendHeader: true };
    }
  
    config(options) {
      if (typeof options === 'object' && options !== null) {
        Object.assign(this.options, options);
      }
    }
  
    response(status, headers, body, cb?, options?) {
      let responseStatus = {};
      let responseHeader = {};
      let responseBody = {};
  
      responseStatus = status || this.options.status || 400;
  
      // set headers
      if (typeof headers !== 'object' || headers === null ) {
        if (this.options && this.options.headers) {
          responseHeader = this.options.headers;
        } else {
          responseHeader = {};
        }
      } else {
        if (this.options.headers && this.options.extendHeader) {
          responseHeader = Object.assign(responseHeader, headers, this.options.headers);
        } else {
          responseHeader = headers;
        }
      }
  
      // set body
      if (typeof body === 'undefined' || body === null) {
        if (this.options && this.options.body) {
          responseBody = this.options.body;
        } else {
          responseBody = {};
        }
      } else {
        responseBody = body;
      }
  
      const responseTemplate = this._createResponseTemplate(responseStatus, responseHeader, responseBody);
  
      // call cb
      if (typeof cb === 'function') {
        cb(null, responseTemplate);
      }
  
      return responseTemplate;
    }
  
    ok(headers, body, cb?, options?) {
      return this.response(200, headers, body, cb, options || {});
    }
  
    created(headers, body, cb?, options?) {
      return this.response(201, headers, body, cb, options || {});
    }
  
    badRequest(headers, body, cb?, options?) {
      return this.response(400, headers, body, cb, options || {});
    }
  
    notAuthorized(headers, body, cb?, options?) {
      return this.response(401, headers, body, cb, options || {});
    }
  
    forbidden(headers, body, cb?, options?) {
      return this.response(403, headers, body, cb, options || {});
    }
  
    notFound(headers, body, cb?, options?) {
      return this.response(404, headers, body, cb, options || {});
    }
  
    serverError(headers, body, cb?, options?) {
      return this.response(500, headers, body, cb, options || {});
    }
  
    _createResponseTemplate(status, headers, body) {
      return {
        statusCode: status,
        body: JSON.stringify(body),
        headers: headers
      }; 
    }
  }
  
  