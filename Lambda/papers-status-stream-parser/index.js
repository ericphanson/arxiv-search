'use strict';
const AWS = require("aws-sdk");
AWS.config.region = 'us-east-1';
const db = new AWS.DynamoDB({
    apiVersion: '2012-08-10'
});

//const RESOURCES = ['pdf', 'tex', 'meta']

const thumbs = {
    'resources': ['pdf'],
    'outputs': ['thumb']
};

const parse_def = {
    'resources': ['def'],
    'outputs': ['parsed_def']
};

const Lambdas = {
    'make-thumb-from-papers-status-update': thumbs
};

function have_all_resources(res, image) {
    let have_all_res = true;
    for (let r of res) {
        if (image[r] === undefined)
        {
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
        if (image[o] != undefined)
        {
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

exports.handler = (event, context, callback) => {


    let lambdas_fired = 0
    event.Records.forEach((record) => {
        console.log('Stream record: ', JSON.stringify(record, null, 2));

        if (record.eventName === 'INSERT' || record.eventName === 'MODIFY') {
            let NewImage = record.dynamodb.NewImage;
            let OldImage = record.dynamodb.OldImage;
            let idvv = NewImage.idvv.S;

            for (let lambda_name in Lambdas) {

                let fire
                // only fire a lambda function if the old record wasn't ready, but the new record is
                if (OldImage === undefined)
                {
                    fire = shouldFire(lambda_name, NewImage)
                } else {
                    fire = (!(shouldFire(lambda_name, OldImage)) && shouldFire(lambda_name, NewImage));
                }

                // if we want an output but don't have the resources, set all the resouces that are undefined (i.e. don't want) to "want".
                if (!(fire)) {
                    if (want_any_output(Lambdas[lambda_name].outputs, NewImage)) {
                        for (let r of Lambdas[lambda_name].resources) {
                            if (NewImage[r] === undefined) {
                                // TODO: update the dynamodb record for NewImage.idvv to have resource r set to want
                                db.updateItem({
                                    TableName: "papers-status",
                                    Key: {
                                        "idvv": {
                                            "S": idvv
                                        }
                                    },
                                    ExpressionAttributeValues: {
                                        ":w": {
                                            "S": "want"
                                        }
                                    },
                                    UpdateExpression: "SET " + r + " = :w",
                                    ReturnValues: "NONE"
                                }, (err, result) => {
                                    if (err) {
                                        console.log("error setting " + r + " to want in idvv=" + idvv);
                                    }
                                    console.log(result);
                                });
                            }
                        }

                    }
                } else //Fire the Lambda
                {
                    let lambda = new AWS.Lambda();

                    let params = {
                        FunctionName: lambda_name, // the lambda function we are going to invoke
                        InvocationType: 'Event',
                        LogType: 'None',
                        Payload: '{ "idvv" : "' + idvv + '" }'
                    };
                    console.log("firing " + lambda_name + " for idvv=" + idvv);
                    lambdas_fired = lambdas_fired+1;
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

    });
    callback(null, `Successfully processed ${event.Records.length} records. Fired ${lambdas_fired} lambdas.`);
};