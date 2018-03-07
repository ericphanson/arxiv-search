'use strict';

import * as AWS from "aws-sdk";
import * as path from 'path';
const REGION = 'us-east-1';
AWS.config.region = REGION;

const db = new AWS.DynamoDB({
    apiVersion: '2012-08-10'
});

const s3 = new AWS.S3({
    apiVersion: '2006-03-01'
});



/*
const thumbs = {
    'resources': {
        'pdf': {
            'bucket': 'arxiv-temp-pdfs',
            'subdir': 'pdfs',
            'ext': '.pdf'
        }
    },
    'outputs': {
        'thumb': {
            'bucket': 'arxiv-temp-pdfs',
            'subdir': 'thumbs',
            'ext': '.jpg'
        }
    }
};


const Lambdas = {
    'make-thumb-from-papers-status-update': thumbs
};
*/

type resource_dict = { [resource: string]: { bucket: string, subdir: string, ext: string } };
type bucket_key_dict = { [resource: string]: { "Bucket": string, "Key": string } };

interface event {
    idvv: string,
    resources: resource_dict,
    outputs: resource_dict,
    lambda_name: string
}

async function run(event: event, context) {
    console.log(`Running on event ${JSON.stringify(event)}`)
    let idvv = event.idvv
    let resources = event.resources
    let outputs = event.outputs
    let lambda_name = event.lambda_name
    /** Given a dictionary of resources, like
    {
        'pdf': {
            'bucket': BUCKET,
            'subdir': 'pdfs',
            'ext': '.pdf'
        },
        'tex': {
            'bucket': BUCKET,
            'subdir': 'texfiles',
            'ext': '.tex'
        }
    }
     return a dictionary like
         {
        'pdf': {
            'Bucket': BUCKET,
            'Key': 'pdfs/1705.1233.pdf',
        },
        'tex': {
            'Bucket': BUCKET,
            'Key': 'texfiles/1705.1233.tex',
        }
    } 
    that can be fed into s3 commands.*/
    function make_bucket_key_dict(resource_dict: resource_dict): bucket_key_dict {
        let buck_key_dict: bucket_key_dict = {}
        for (let k of Object.getOwnPropertyNames(resource_dict)) {
            let r = resource_dict[k];
            if (r === undefined) {throw new Error("need to specify a bucket");}
            let Key = r.subdir ? (r.subdir + "/" + idvv + r.ext) : (idvv + r.ext);
            buck_key_dict[k] = {
                "Bucket": r.bucket,
                "Key" : Key
            };
        }
        return buck_key_dict;
    }
    let bk_res = make_bucket_key_dict(resources);
    let bk_outs = make_bucket_key_dict(outputs);
    /** Given a bucket-key dictionary, check that each key has a valid document. */
    function validate(bk_dict: bucket_key_dict) {
        return Promise.all(Object.getOwnPropertyNames(bk_dict).map(k => {
            return s3.headObject(bk_dict[k]).promise();
        }));
    }
    // 1. Validate resources
    try {
        console.log(`Validating ${JSON.stringify(bk_res)}`)
        await validate(bk_res);
    } catch (err) {
        console.error("Resource validation failed.")
        throw err;
    }
    // 2. Fire lambda
    let lambda = new AWS.Lambda();
    let Payload = JSON.stringify({
        'resources': bk_res,
        'outputs': bk_outs,
        'region': REGION
    });
    let params = {
        FunctionName: lambda_name, // the lambda function we are going to invoke
        InvocationType: 'RequestResponse',
        LogType: 'None',
        Payload
    }
    console.log("firing " + lambda_name + " with payload=" + Payload);
    try {
        let resp = await lambda.invoke(params).promise();
        console.log(`The lambda ${lambda_name}returned without error`);
        await validate(bk_outs);
        console.log(`The lambda created the correct outputs.`);
        await call_db("have");
    } catch (err) {
        await call_db("error");
    }
    // 3. Update db
    async function call_db(value) {
        let UpdateExpression = Object.getOwnPropertyNames(outputs).map(r => "SET " + r + " = :v").join(", ");
        console.log(UpdateExpression);
        try {
            await db.updateItem({
                TableName: process.env["StatusTable"].split("/")[1],
                Key: { "idvv": { "S": idvv } },
                ExpressionAttributeValues: { ":v": { "S": value } },
                UpdateExpression,
                ReturnValues: "NONE"
            }).promise();
        } catch (err) {
            console.log("Error updating the dynamodb. Wanted set the outputs to " + value + ".")
            throw err;
        }
    }
}

export const handler = (event, context, callback) => {
    if (typeof event === "string") {event = JSON.parse(event);}
    run(event, context).then(() => callback(null)).catch((err) => callback(err));
}