import { S3, DynamoDB } from "aws-sdk";
const s3 = new S3();
const db = new DynamoDB({ apiVersion: '2012-08-10' });

interface record {
    "eventVersion": "2.0",
      "eventTime": string,
      "requestParameters": {
        "sourceIPAddress": string
      },
      "s3": {
        "configurationId": "testConfigRule",
        "object": {
          "eTag": "0123456789abcdef0123456789abcdef",
          "sequencer": "0A1B2C3D4E5F678901",
          /** eg `HappyFace.jpg` */
          "key": string,
          "size": number
        },
        "bucket": {
          "arn": string,
          "name": string,
          "ownerIdentity": {
            "principalId": string
          }
        },
        "s3SchemaVersion": "1.0"
      },
      "responseElements": {
        "x-amz-id-2": "EXAMPLE123/5678abcdefghijklambdaisawesome/mnopqrstuvwxyzABCDEFGH",
        "x-amz-request-id": "EXAMPLE123456789"
      },
      "awsRegion": "us-east-1",
      "eventName": "ObjectCreated:Put",
      "userIdentity": {
        "principalId": string
      },
      "eventSource": "aws:s3"
}
interface bucketNotifyEvent {Records : record[]}

const updateHave = async (pid, field) => {
    let UpdateExpression = `SET ${field} = :h`;
    await db.updateItem({
        TableName: process.env["StatusTable"].split("/")[1],
        Key: { "idvv": { "S": pid } },
        ExpressionAttributeValues: { ":h": { "S": "have" }},
        UpdateExpression,
        ReturnValues: "NONE"
    }).promise();
};

async function processRecord(record : record) {
    let Bucket = record.s3.bucket.name;
    let rawKey = record.s3.object.key;
    let srcKey = decodeURIComponent(rawKey).replace(/\+/g, ' ');
    console.log("rawKey=", rawKey);
    console.log("srcKey=", srcKey);
    if (rawKey !== srcKey) {
        //perform a rename if the key is dodgy. (eg contains slashes).
        let sanitisedKey = srcKey.replace(/[^!#$&-;=?-\[\]_a-z~]/g, "_");
        console.log(`renaming '${srcKey}' to '${sanitisedKey}'`);
        await s3.copyObject({
            Bucket,
            CopySource: Bucket + "/" + rawKey,
            Key: sanitisedKey
        }).promise();
        console.log("deleting");
        await s3.deleteObject({ Bucket: Bucket, Key: srcKey }).promise();
        return;
    }
    let pid = srcKey.replace(/\.\w+$/, "");
    //TODO do some validation that pid is a good arxiv id.
    let fileTypeMatchArray = srcKey.match(/\.\w+$/);
    if (fileTypeMatchArray === null) { console.error("invalid file type"); return; }
    let filetype = fileTypeMatchArray[0].substr(1);
    console.log(`incoming item: pid=${pid} filetype=${filetype}`);
    if (filetype === "pdf") {
        await updateHave(pid, "pdf");
    }
    else if (filetype === "src") {
        await updateHave(pid, "src");
    }
    else {
        throw new Error(`Unrecognised extension ${filetype}`);
    }
}




export const handler = (event : bucketNotifyEvent, context, callback) => {
    Promise.all(event.Records.map(processRecord))
        .then(() => callback(null))
        .catch(err => callback(err));
};
