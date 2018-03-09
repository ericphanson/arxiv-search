'use strict';
import * as AWS from 'aws-sdk';
AWS.config.region = 'us-east-1';
const db = new AWS.DynamoDB({ apiVersion: '2012-08-10' });

type resource = "tex" | "pdf" | "src" | "fulltext" | "thumb";
let resources : resource[] = ["tex", "pdf", "src", "fulltext", "thumb"]
type status = "have" | "want" | "error" | "dead" | "unset";
let statuses : status[] = ["have", "want", "error", "dead"]

type event = {[r in resource]?: {[s in status]?: status | null}}

async function run(event: event) {
    let TableName = process.env["StatusTable"].split("/")[1];
    let ExclusiveStartKey = undefined;
    let numPages = 0;
    let grandTotal = 0;
    do {
        let scanResult = await db.scan({ TableName, ExclusiveStartKey }).promise();
        if (!scanResult.Items) { throw new Error(`scanResult had no Items field: ${scanResult}`) }
        let items = scanResult.Items;
        numPages++;
        console.log(`On page ${numPages}. Processing ${items.length} records.`);
        let changes = await Promise.all(items.map(item => {
            let setters = {};
            let unset = []
            let Key = {"idvv" : item.idvv};
            for (let r of resources) {
                if (event[r]) {
                    let itemStatus = item[r] ? item[r].S : "unset";
                    let setTo = event[r]["*"] || event[r][itemStatus]
                    if (setTo !== undefined) {
                        if (setTo === "unset") {
                            unset.push(r);
                        }
                        else if ((typeof setTo) === "string") {
                            setters[r] = setTo;
                        }
                        else {
                            //totally ignore.
                        }
                    }
                }
            }
            let setterKeys = Object.getOwnPropertyNames(setters);
            if (setterKeys.length === 0 && unset.length === 0) {return Promise.resolve(false);}
            let setExpression = (setterKeys.length === 0) ? "" : ("SET " + setterKeys.map((pn, i) => `${pn}=:val${i}`).join(", "));
            let removeExpression = (unset.length === 0) ? "" : ("REMOVE " + unset.join(", "));
            let ExpressionAttributeValues = {};
            for (let i = 0; i < setterKeys.length; i++) {
                ExpressionAttributeValues[`:val${i}`] = {"S" : setters[setterKeys[i]]};
            }
            return db.updateItem({
                TableName,
                Key,
                UpdateExpression : setExpression + removeExpression,
                ExpressionAttributeValues,
                ReturnValues : "NONE"
            }).promise().then(() => true);
        }));
        grandTotal += changes.reduce((a,b:any) => a + b, 0);
        ExclusiveStartKey = scanResult.LastEvaluatedKey;
    } while (ExclusiveStartKey)
    console.log(`Made ${grandTotal} changes.`);
}

export const handler = (event, context, callback) => {run(event).then(x => callback(null, x)).catch(e => callback(e));}