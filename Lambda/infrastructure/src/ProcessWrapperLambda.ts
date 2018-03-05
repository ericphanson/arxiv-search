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

type resource_dict = {[resource : string] : {bucket : string, subdir : string, ext : string}};
type bucket_key_dict = {[resource : string] : {"Bucket" :  string, "Key" : string}};

exports.handler = (event, context, callback) => {
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
    function make_bucket_key_dict(resource_dict : resource_dict) : bucket_key_dict {
        let buck_key_dict : bucket_key_dict = {}
        for (let k of Object.getOwnPropertyNames(resource_dict)) {
            let r = resource_dict[k];
            let Key = r.subdir ? (r.subdir + "/" + idvv + r.ext) : (idvv + r.ext);
            buck_key_dict[k] = {
                Bucket: r.bucket,
                Key
            }
        }
        return buck_key_dict;
    }

    /** Given a bucket-key dictionary, check that each key has a valid document. */
    function validate(bk_dict : bucket_key_dict) {
        return Promise.all(Object.getOwnPropertyNames(bk_dict).map(k => s3.headObject(bk_dict[k]).promise()));
    }
    let bk_res = make_bucket_key_dict(resources)
    let bk_outs = make_bucket_key_dict(outputs)

    // 1. Validate resources
    validate(bk_res).catch((err) => {
        callback(null, "Resource validation failed. Had error " + err);
    });

    // 2. Fire lambda
    let lambda = new AWS.Lambda();
    let Payload = {
        'resources': bk_res,
        'outputs': bk_outs,
        'region' : REGION
    };
    let params = {
        FunctionName: lambda_name, // the lambda function we are going to invoke
        InvocationType: 'RequestResponse',
        LogType: 'None',
        Payload
    }
    console.log("firing " + lambda_name + " with payload=" + Payload);

    lambda.invoke(params).promise().then((resp) => {
        validate(bk_outs).catch((err) => {

            // console.log("The lambda " + lambda_name + " returned without error, but the outputs don't exist where they should.")
            call_db('error');
            callback(null, "The lambda " + lambda_name + " returned without error, but the outputs don't exist where they should.")

        }).then(() => {
            console.log("The lambda " + lambda_name + 'returned without error, and the outputs exit.')
            // update dictionary
            call_db('have');
        });
    }).catch((err) => {
        call_db('error');
        callback(null,"The lambda " + lambda_name + ' returned with error '+ err)
    })

    // 3. Update db
    function call_db(value) {
        let expr = (r) => "SET " + r + " = :v"
        let dict_reducer = (accumulator, currentValue) => {
            return accumulator + ', ' + currentValue
        }
        let UpdateExpression = outputs.keys().map(expr).reduce(dict_reducer)
        console.log(UpdateExpression)
        db.updateItem({
            TableName: "papers-status",
            Key: {
                "idvv": {
                    "S": idvv
                }
            },
            ExpressionAttributeValues: {
                ":h": {
                    "S": value
                }
            },
            UpdateExpression,
            ReturnValues: "NONE"
        }).promise().then(
            () => {
                callback(null,"Successfully updated the dynamodb")
                return;
            }
        ).catch((err) => {
            console.log("Error updating the dynamodb. Wanted set the outputs to " + value + ".")
            callback(err)
            return;
        })
    }


}