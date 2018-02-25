'use strict';

console.log('Loading function');

const AWS = require("aws-sdk"); //hello eric
const db = new AWS.DynamoDB({ apiVersion: '2012-08-10' });

/**Take the properties of the given object `o` and apply `f` to each property */
const mapOwnProperties = (f, o) => {let r = {}; for (let k of Object.getOwnPropertyNames(o)) {r[k] = f(o[k],k);} return r;}; 
const jsonToDBItem = (item) => {
    const rec = (item) => {
        switch (typeof item) {
            case "boolean": return { "B": item };
            case "number": return { "N": item };
            case "string": return { "S": item };
            case "object": return (Array.isArray(item)) ? { "L": item.map(rec) } : {"M": mapOwnProperties(rec,item)};
            default: throw new Error("json-like things only please");
        }
    };
    return mapOwnProperties(rec,item);
};
const DBItemToJSON = (item) => {
    const r1 = (item) => typeof item !== "object" ? item : Array.isArray(item) ? item.map(r2) : mapOwnProperties(r2,item);
    const r2 = (item) => {for (let k of Object.getOwnPropertyNames(item)) { return r1(item[k]); }};
    return r1(item);
};

exports.handler = (event, context, callback) => {
    console.log('Received event:', JSON.stringify(event, null, 2));
    let TableName = "papers-status";
    let data = JSON.parse(event.body);
    console.log(data);
    const done = (err, res) => callback(null, {
        statusCode: err ? '400' : '200',
        body: err ? err.message : JSON.stringify(res),
        headers: {'Content-Type': 'application/json'}
    });
    if (typeof data.idvv !== "string") {done("missing idvv field"); return;}
    //TODO do some validation of idvv?
    if (typeof data.document !== "string") {done("missing document field"); return;}
    
    
    
    
    
    let Key = { "idvv": { "S": body.idvv } };
    switch (event.httpMethod) {
        case 'GET':
            console.log("getting ", Key);
            db.getItem({ TableName, Key }, (err, data) => callback(err, DBItemToJSON(data.Item)));
            break;
        case 'PUT': //delete any entry with this key and replace with a new entry
            let params = { TableName, Item: jsonToDBItem(body) };
            console.log("putting ", params);
            db.putItem(params, done);
            break;
        default:
            done(new Error(`Unsupported method "${event.httpMethod}"`));
            break;
    }
    return;




};
