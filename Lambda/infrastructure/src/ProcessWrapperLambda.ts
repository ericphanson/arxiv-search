'use strict';

import * as AWS from "aws-sdk";
import * as path from 'path';
import { getClient } from "./es_connection";

const REGION = 'us-east-1';
AWS.config.region = REGION;

const db = new AWS.DynamoDB({
    apiVersion: '2012-08-10'
});

const s3 = new AWS.S3({
    apiVersion: '2006-03-01'
});




function uploadES(idvv: string, field: string, value: string) {
    let es_client = getClient()
    let id = idvv.split("v")[0]
    console.log(`Setting ${field} to ${value.substring(0, 200) + "..."} for ${idvv} on ES.`)
    let doc = {}
    doc[field] = value
    let body = {doc};
    return es_client.update({
    index: 'arxiv_pointer', type: 'paper', id, body
    })
    // seems to overwrite the whole ES document... I should search the logs and restore the messed up docs.
    // failed on: 1005.1190v1, 1007.4004v7, 1002.2938v2
}

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


type bk =  { "Bucket": string, "Key": string } ;
type es_resp = string ;

interface event {
    idvv: string,
    resources: { [name:string] : s3_resource | es_resource },
    outputs: { [name:string] : s3_resource | es_resource },
    lambda_name: string
}

async function run(event: event, context) {
    console.log(`Running on event ${JSON.stringify(event)}`)
    let idvv = event.idvv
    let resources = event.resources
    let outputs = event.outputs
    let lambda_name = event.lambda_name

    function make_bk(r: s3_resource): bk {
        if (r === undefined) { throw new Error("need to specify a bucket"); }
            let Key = r.subdir ? (r.subdir + "/" + idvv + r.ext) : (idvv + r.ext);
            let buck_key = {
                "Bucket": r.bucket,
                "Key": Key
            };
        return buck_key;
    }

    async function fetch_es(r : es_resource) : Promise<es_resp>  {
        
        // TODO: fetch a field from elasticsearch
        return Promise.resolve("")
    }

    async function validate_s3(bk_pair : bk) {
        try {
            await s3.headObject(bk_pair).promise();
        } catch (err) {
            if (err.errorType === "Forbidden") {
                throw new Error(`Forbidden access the needed bucket: ${JSON.stringify(bk_pair)}. ${err}`);
            }
            else {
                throw new Error(`Failed to find the resource: ${JSON.stringify(bk_pair)}. ${err}`);
            }
        }
    }
    let validated_resources : {[name : string] : bk | es_resp };
    validated_resources = {};
    // 1. Validate resources and build payload
    try {

    for (let k of Object.getOwnPropertyNames(resources))
    {
        let d : bk | string;
        if (resources[k].res_type==='s3_resource')
        {
            d = make_bk(resources[k] as s3_resource)
            await validate_s3(d)
        } else if (resources[k].res_type==='es_resource'){
            d = await fetch_es(resources[k] as es_resource)
        }
        validated_resources[k] = d
    }
    }  catch (err) {
        await call_db("error");
        throw err;
    }

    let s3_outs : { [name : string] : bk};
    s3_outs = {};
    let es_outs : { [name : string] : es_resource };
    es_outs = {};
    for (let k of Object.getOwnPropertyNames(outputs))
    {
        if (outputs[k].res_type==='s3_resource')
        {
            s3_outs[k] = make_bk(outputs[k] as s3_resource)
        } else if (outputs[k].res_type ==='es_resource') 
        {
            es_outs[k] = outputs[k] as es_resource
        }
    }

    // 2. Fire lambda
    let lambda = new AWS.Lambda();
    let Payload = JSON.stringify({
        'resources': validated_resources,
        'outputs': s3_outs,
        'region': REGION
    });
    let params = {
        FunctionName: lambda_name, // the lambda function we are going to invoke
        InvocationType: 'RequestResponse',
        LogType: 'None',
        Payload
    }
    console.log("firing " + lambda_name + " with payload=" + Payload);
    let resp : AWS.Lambda.InvocationResponse;
    try {
        resp  = await lambda.invoke(params).promise();
        console.log(`The lambda ${lambda_name}returned without error`);
        
        // validate s3 outputs
        let bks = Object.getOwnPropertySymbols(s3_outs) as any        
        await Promise.all(bks.map(validate_s3))
        console.log(`The lambda created the correct outputs in s3.`);
        for (let k of Object.getOwnPropertyNames(es_outs))
        {
            let field  = es_outs[k].ESfield
            let value = JSON.stringify(resp.Payload[k]) as es_resp
            uploadES(idvv, field, value).then( (resp) => console.log(`Response ${JSON.stringify(resp)}`)).catch((err) => {throw err;})
        }
        
        await call_db("have");
    } catch (err) {
        await call_db("error");
        throw err;
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
    if (typeof event === "string") { event = JSON.parse(event); }
    run(event, context).then(() => callback(null)).catch((err) => callback(err));
}