'use strict';
import * as AWS from 'aws-sdk';
import { processors } from 'xml2js';
AWS.config.region = 'us-east-1';
const db = new AWS.DynamoDB({
    apiVersion: '2012-08-10'
});

const ProcessWrapperLambda = process.env["ProcessWrapperLambda"];

interface s3_resource {
    bucket: string, 
    ext: string, 
    subdir?: string
    res_type : "s3_resource"
}
interface es_resource {
    ESfield : string,
    res_type : "es_resource"
}


interface process {
    resources: { [name:string] : s3_resource | es_resource },
    outputs: { [name:string] : s3_resource | es_resource },
    lambda_name: string
}


const incomingBucket = (process.env["IncomingBucket"] && process.env["IncomingBucket"].split("arn:aws:s3:::")[1])|| "arxivincomingbucket"


function have_all_resources(res: process["resources"], image) {
    let have_all_res = true;
    for (let k of Object.getOwnPropertyNames(res)) {
        if (image[k] === undefined) {
            have_all_res = false;
        } else if (!(image[k].S === 'have')) {
            have_all_res = false;
        }
    }
    return have_all_res;
}

function want_any_output(outputs: process["outputs"], image) {
    let want_any_output = false;
    for (let o of Object.getOwnPropertyNames(outputs)) {
        if (image[o] != undefined) {
            if (image[o].S === 'want') {
                want_any_output = true;
            }
        }
    }
    return want_any_output;
}

function shouldFire(lambda_db_params: process, image) {
    let have_resources = have_all_resources(lambda_db_params.resources, image);
    let want = want_any_output(lambda_db_params.outputs, image);
    return have_resources && want;
}

interface record {
    eventName: "INSERT" | "MODIFY" | string,
    eventID: string,
    eventVersion: string,
    eventSource: string,
    awsRegion: string,
    eventSourceARN: string
    dynamodb: {
        "ApproximateCreationDateTime": number,
        Keys: { "idvv": { "S": string } },
        NewImage: { [key: string]: any },
        OldImage?: { [key: string]: any },
        SequenceNumber: string,
        SizeBytes: 32,
        StreamViewType: string,
    }
}
interface event {
    Records: record[]
}

async function run(event: event, context) {
    const thumbs: process = {
        'resources': {
            'pdf': {
                'res_type' : 's3_resource',
                'bucket': incomingBucket,
                'ext': '.pdf'
            }
        },
        'outputs': {
            'thumb': {
                'res_type' : 's3_resource',
                'bucket': process.env["PublicBucket"].split("arn:aws:s3:::")[1],
                'subdir': 'thumbs',
                'ext': '.jpg'
            }
        },
        'lambda_name': process.env["MakeThumbLambda"]
    };
    const fulltext: process = {
        'resources': {
            'pdf': {
                'res_type' : 's3_resource',
                'bucket': incomingBucket,
                'ext': '.pdf'
            }
        },
        'outputs' : {
            'fulltext' : {
                'res_type' : 'es_resource',
                'ESfield' : 'fulltext'
            }
        },
        'lambda_name': process.env["MakeFullTextLambda"]
    };
    const processors = [thumbs, fulltext]
    let lambdas_fired = 0;
    for (let record of event.Records) {
        console.log(`Stream record: ${JSON.stringify(record, undefined, 2)}`);
        if (record.eventName === "INSERT" || record.eventName === "MODIFY") {
            let NewImage = record.dynamodb.NewImage;
            let OldImage = record.dynamodb.OldImage;
            let idvv = NewImage.idvv.S;
            for (let i = 0; i < processors.length; i++) {
                let p = processors[i];
                let { lambda_name, resources, outputs } = p;
                // only fire a lambda function if the old record wasn't ready, but the new record is
                let fire =
                    (OldImage === undefined)
                        ? shouldFire(p, NewImage)
                        : (!(shouldFire(p, OldImage)) && shouldFire(p, NewImage));
                if (!fire) {
                    if (want_any_output(outputs, NewImage)) {
                        let resource_keys = Object.getOwnPropertyNames(resources);
                        for (let k of resource_keys) {
                            if (NewImage[k] === undefined) {
                                await db.updateItem({
                                    TableName: process.env["StatusTable"].split("/")[1],
                                    Key: { "idvv": { "S": idvv } },
                                    ExpressionAttributeValues: { ":w": { "S": "want" } },
                                    UpdateExpression: `SET ${k} = :w`,
                                    ReturnValues: "NONE"
                                }).promise();
                            }
                        }
                    }
                }
                else { //we should fire the lambda
                    let lambda = new AWS.Lambda();
                    let params = {
                        FunctionName: ProcessWrapperLambda, // the lambda function we are going to invoke
                        InvocationType: 'Event',
                        LogType: 'None',
                        Payload: JSON.stringify({ ...processors[i], idvv })
                    };
                    console.log(`Firing ${lambda_name} for idvv=${idvv}.`);
                    lambdas_fired++;
                    //Don't await the lambdas.
                    lambda.invoke(params, function (err, data) {
                        if (err) {
                            console.log(err);
                        } else {
                            console.log(lambda_name + ' said ' + JSON.stringify(data));
                        }
                    });
                }
            }
        }
    }
    return `Successfully processed ${event.Records.length} records. Fired ${lambdas_fired} lambdas.`;
}
export const handler = (event, context, callback) => {
    run(event, context).then((result) => callback(null, result)).catch(err => callback(err));
};