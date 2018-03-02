import * as http from 'http';
import {DynamoDB} from 'aws-sdk';
let db = new DynamoDB({apiVersion: '2012-08-10'});
const TableName = "papers-status";
let url = (start, max_results) =>  `http://export.arxiv.org/api/query?start=${start}&max_results=${max_results}&sortBy=lastUpdatedDate&sortOrder=ascending`
const increment = 2000;

import * as request from 'request';
import {parseString} from 'xml2js';
let requestAsync = (param) => new Promise<any>((resolve, reject) => request(param, (err, res) => err ? reject(err) : resolve(res)));
let xml2jsAsync = (s) => new Promise<any>((resolve, reject) => parseString(s, (err, result) => err ? reject(err) : resolve(result)));

async function run(event) {

    for(let i = 0; i < 10; i++) {
        let response = await requestAsync(url(i * increment, (i + 1) * increment));
        let parsed = await xml2jsAsync(response.body);
        //yet to replace slashes with 
        for (let entry of parsed.feed.entry) {
            //TODO: also push the data to elastic search.
            let id = entry.id[0].match(/http:\/\/arxiv\.org\/abs\/([\w\.\/-]+)$/)[1];
            let idvv = id.replace("/","");

            let have = await db.getItem({
                TableName, Key : {"idvv": {"S":idvv}}
            }).promise();
            if (!have.Item) {
                let db_result = await db.putItem({
                    TableName,
                    Item : {
                        "idvv" : {"S":idvv},
                        "pdf" : {"S":"want"},
                        "thumb" : {"S" : "want"},
                        "pdf_url" : {"S" : `https://export.arxiv.org/pdf/${id}.pdf`},
                        "source" : {"S": "want"},
                        "source_url": {"S" : `https://export.arxiv.org/e-print/${id}`}
                        //TODO meta : have and update elasticsearch.
                    },
                    ConditionExpression : "idvv <> :idvv", //only put if its not already there
                    ExpressionAttributeValues : {":idvv" : {"S":idvv}},
                    ReturnValues : "NONE"
                }).promise();
            }
            else {
                //hit a database entry that we have. So stop requesting.
                return;
            }

        }
    }
}


exports.handler = function (event, context, callback) {
    run(event).then(r => callback(null, r)).catch(e => callback(e));
}