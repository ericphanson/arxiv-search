'use strict';
import * as AWS from 'aws-sdk';
AWS.config.region = 'us-east-1';
const db = new AWS.DynamoDB({
    apiVersion: '2012-08-10'
});

const ProcessWrapperLambda = process.env["ProcessWrapperLambda"];

interface process {
    resources: { [name: string]: { bucket: string, ext: string, subdir?: string } },
    outputs: { [name: string]: { bucket: string, ext: string, subdir?: string } },
    lambda_name: string
}

const thumbs: process = {
    'resources': {
        'pdf': {
            'bucket': process.env["IncomingBucket"],
            'ext': '.pdf'
        }
    },
    'outputs': {
        'thumb': {
            'bucket': process.env["PublicBucket"],
            'subdir': 'thumbs',
            'ext': '.jpg'
        }
    },
    'lambda_name': process.env["MakeThumbLambda"]
};


const Lambdas = [thumbs]

function have_all_resources(res, image) {
    let have_all_res = true;
    for (let r of res) {
        if (image[r] === undefined) {
            have_all_res = false;
        } else if (!(image[r].S === 'have')) {
            have_all_res = false;
        }
    }
    return have_all_res;
}

function want_any_output(outputs, image) {
    let want_any_output = false;
    for (let o of outputs) {
        if (image[o] != undefined) {
            if (image[o].S === 'want') {
                want_any_output = true;
            }
        }
    }
    return want_any_output;
}

function shouldFire(lambda_name, image) {
    let lambda_db_params = Lambdas[lambda_name];
    let have_resources = have_all_resources(lambda_db_params.resources, image);
    let want = want_any_output(lambda_db_params.outputs, image);
    return have_resources && want;
}

interface event {
    Records
}

async function run(event : event, context) {
    let lambdas_fired = 0;
    for (let record of event.Records) {
        console.log(`Stream record: ${JSON.stringify(record, undefined, 2)}`);
        if (record.eventName === "INSERT" || record.eventName === "MODIFY") {
            let NewImage = record.dynamodb.NewImage;
            let OldImage = record.dynamodb.OldImage;
            let idvv = NewImage.idvv.S;
            for (let i = 0; i < Lambdas.length; i++) {
                let {lambda_name, resources, outputs} = Lambdas[i];
                // only fire a lambda function if the old record wasn't ready, but the new record is
                let fire =
                    (OldImage === undefined)
                        ? shouldFire(lambda_name, NewImage)
                        : (!(shouldFire(lambda_name, OldImage)) && shouldFire(lambda_name, NewImage));
                if (!fire) {
                    if (want_any_output(outputs, NewImage)) {
                        let resource_keys = Object.getOwnPropertyNames(resources);
                        for (let k of resource_keys) {
                            if (NewImage[k] === undefined) {
                                await db.updateItem({
                                    TableName: process.env["StatusTable"],
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
                        Payload : Lambdas[i]
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