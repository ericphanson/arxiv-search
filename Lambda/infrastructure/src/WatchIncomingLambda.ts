import {S3, DynamoDB} from "aws-sdk";
const s3 = new S3();
const db = new DynamoDB({ apiVersion: '2012-08-10' });

//TODO set these using AWS Lambda environment variables.
const Bucket = "arxiv-incoming";
const TableName = "papers-status";

const updateHave = (pid, field, callback) => {
    let UpdateExpression = `SET ${field} = :h, thumb = :w`; 
    db.updateItem({
        TableName,
        Key: { "idvv": { "S": pid } },
        ExpressionAttributeValues: { ":h": { "S": "have" }, ":w" : {"S":"want"} },
        UpdateExpression,
        ReturnValues: "NONE"
    }, callback);
};

export const handler = (event, context, callback) => {
    let rawKey = event.Records[0].s3.object.key;
    let srcKey = decodeURIComponent(rawKey).replace(/\+/g, ' ');
    console.log("rawKey=",rawKey);
    console.log("srcKey=", srcKey);
    if (rawKey !== srcKey) {
        let sanitisedKey = srcKey.replace(/[^!#$&-;=?-\[\]_a-z~]/g, "_");
        console.log(`renaming '${srcKey}' to '${sanitisedKey}'`);
        s3.copyObject({
            Bucket, 
            CopySource : Bucket + "/" + rawKey, 
            Key : sanitisedKey
        }, () => {
            console.log("deleting");
            s3.deleteObject({Bucket, Key: srcKey}, callback);
        });
        return;
    }
    let pid = srcKey.replace(/\.\w+$/, "");
    //TODO do some validation that pid is a good arxiv id.
    let fileTypeMatchArray = srcKey.match(/\.\w+$/);
    if (fileTypeMatchArray === null) { console.error("invalid file type"); return; }
    let filetype = fileTypeMatchArray[0].substr(1);
    console.log(`incoming item: pid=${pid} filetype=${filetype}`);
    if (filetype === "pdf") {
        updateHave(pid, "pdf", callback);
    }
    else if (filetype === "src") {
        updateHave(pid, "src", callback);
    }
    else {
        callback("unrecognised extension " + filetype);
    }
};
