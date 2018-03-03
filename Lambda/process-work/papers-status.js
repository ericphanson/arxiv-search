"use strict";
exports.__esModule = true;
var aws_sdk_1 = require("aws-sdk");
var db = new aws_sdk_1.DynamoDB({ apiVersion: '2012-08-10' });
var TableName = "papers-status";
function setRecord(idvv, fields) {
    var ExpressionAttributeValues = {};
    var pns = Object.getOwnPropertyNames(fields);
    var UpdateExpression = "SET " + pns.map(function (pn, i) { return pn + "=:val" + i; }).join(", ");
    for (var i in pns) {
        ExpressionAttributeValues[":val" + i] = { "S": fields[pns[i]] };
    }
    return db.updateItem({
        TableName: TableName,
        Key: { "idvv": { "S": idvv } },
        ExpressionAttributeValues: ExpressionAttributeValues,
        UpdateExpression: UpdateExpression,
        ReturnValues: "NONE"
    }).promise();
}
exports.setRecord = setRecord;
