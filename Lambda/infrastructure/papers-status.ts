import {DynamoDB} from 'aws-sdk';
const db = new DynamoDB({apiVersion: '2012-08-10'});
const TableName = "papers-status";

type status =  "have" | "want" | "error" | "dead";
type statusField = "thumb" | "pdf" | "tar";
type statuses = {[field in statusField]? : status}
type record = {
    idvv : string,
    tar_url?  : string,
    pdf_url? : string
} & statuses

export function setRecord(idvv, fields : Partial<record>) {
    let ExpressionAttributeValues = {};
    let pns = Object.getOwnPropertyNames(fields);
    let UpdateExpression = "SET " + pns.map((pn, i) => `${pn}=:val${i}`).join(", ");
    for (let i in pns) {
        ExpressionAttributeValues[`:val${i}`] = {"S" : fields[pns[i]]};
    }
    return db.updateItem({
        TableName, 
        Key : {"idvv" : {"S":idvv}},
        ExpressionAttributeValues,
        UpdateExpression,
        ReturnValues : "NONE"
    }).promise();
}




