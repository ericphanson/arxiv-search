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
        if (image[r] === undefined) {
            have_all_res = false;
        } else if (!(image[r].S === 'have')) {
            have_all_res = false;
        }

    }
    return have_all_res;
}

function any_output_error(outputs, image) {
    let any_output_error = false;
    for (let o of outputs) {
        if (image[o] != undefined) {
            if (image[o].S === 'error') {
                any_output_error = true;
            }
        }

    }
    return any_output_error;
}

function shouldFire(lambda_name, image) {
    let lambda_db_params = Lambdas[lambda_name];
    let have_resources = have_all_resources(lambda_db_params.resources, image);
    let want = any_output_error(lambda_db_params.outputs, image);
    return have_resources && want;
}

exports.handler = (event, context, callback) => {
    let lambdas_fired = 0;

    let process_record = (record) => {
                let idvv = record.idvv.S;

                for (let lambda_name in Lambdas) {

                    if (shouldFire(lambda_name, record)) {
                        let lambda = new AWS.Lambda();

                        let params = {
                            FunctionName: lambda_name, // the lambda function we are going to invoke
                            InvocationType: 'Event',
                            LogType: 'Tail',
                            Payload: '{ "idvv" : "' + idvv + '" }'
                        };
                        console.log("firing " + lambda_name + " for idvv=" + idvv);
                        lambdas_fired = lambdas_fired + 1;
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

    let num_results = 0;
    let num_pages = 0
    let recurse = (first, start_key) => {
        if (first || start_key) {
            let sp
            if (first) {
                sp = {TableName : "papers-status"}
            } else {
                sp = {TableName : "papers-status", ExclusiveStartKey : start_key}
            }
            db.scan(sp, (err, data) => {
                if (err) {//TODO 
                console.log(err, err.stack); 
                }
                else {
                    num_pages ++;
                    console.log("On page " + num_pages)
                    num_results += data.Items.length;
                    data.Items.forEach(process_record);
                    recurse(false, data.LastEvaluatedKey);
                }
            })
        }
        else {
            //after
            callback(null, `Successfully processed ${num_results} records. Fired ${lambdas_fired} lambdas.`);
        }
    }
    recurse(true, undefined);


};