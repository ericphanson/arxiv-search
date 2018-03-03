import * as http from 'http';
import { DynamoDB } from 'aws-sdk';
let db = new DynamoDB({ apiVersion: '2012-08-10' });
const TableName = "papers-status";
const increment = 10;
const number_of_iterations = 2

import * as request from 'request';
import { parseString } from 'xml2js';
import { resolve } from 'url';
let requestAsync = (param) => new Promise<any>((resolve, reject) => request(param, (err, res) => err ? reject(err) : resolve(res)));
let xml2jsAsync = (s) => new Promise<any>((resolve, reject) => parseString(s, (err, result) => err ? reject(err) : resolve(result)));
let timeoutAsync = (ms) => new Promise<void>((resolve, reject) => setTimeout(resolve, ms));

interface OAIRecord {
    header: [{
        datestamp: [string],
        identifier: [string],
        setSpec: [string]
    }],
    metadata: [{
        arXivRaw: [{
            abstract: [string],
            authors: [string],
            categories: [string],
            comments: [string],
            doi: [string],
            "journal-ref": [string],
            licence: [string],
            "msc-class": [string],
            "submitter": [string],
            "title": [string],
            "version" : [string],
        }]
    }]
}

interface OAIResponse {
    "OAI-PMH": {
        "responseDate": string[],
        request: any,
        ListRecords: [{
            record: OAIRecord[],
            resumptionToken: [{ "_": string, "$": { cursor: string, completeListSize: string } }]
        }]
    }
}

async function run(event) {
    for (let i = 0; i < number_of_iterations; i++) {
        let start = i * increment;
        let max_results = increment;
        let url = `http://export.arxiv.org/api/query?search_query=all:electron&start=${start}&max_results=${max_results}`;//&sortBy=lastUpdatedDate&sortOrder=ascending`
        console.log("getting from " + url);
        let response = await requestAsync(url);
        let parsed = await xml2jsAsync(response.body);
        if (!parsed.feed || !parsed.feed.entry) {
            throw new Error("bad query result: " + JSON.stringify(parsed));
        }
        //yet to replace slashes with 
        let have_count = 0;
        for (let entry of parsed.feed.entry) {
            //TODO: also push the data to elastic search.
            let id = entry.id[0].match(/http:\/\/arxiv\.org\/abs\/([\w\.\/-]+)$/)[1];
            let idvv = id.replace("/", "");
            console.log("got " + idvv);
            try {
                await db.putItem({
                    TableName,
                    Item: {
                        "idvv": { "S": idvv },
                        "pdf": { "S": "want" },
                        "thumb": { "S": "want" },
                        "pdf_url": { "S": `https://export.arxiv.org/pdf/${id}.pdf` },
                        "src": { "S": "want" },
                        "src_url": { "S": `https://export.arxiv.org/e-print/${id}` }
                        //TODO meta : have and update elasticsearch.
                    },
                    ConditionExpression: "idvv <> :idvv", //only put if its not already there
                    ExpressionAttributeValues: { ":idvv": { "S": idvv } },
                    ReturnValues: "NONE"
                }).promise();
            }
            catch (e) {
                if (e.message === "The conditional request failed") {
                    console.log(`already have ${idvv} in database.`);
                    have_count++;
                }
                else {
                    //it failed for some other reason.
                    throw e;
                }
            }
        }
        if (have_count * 2 >= increment) {
            console.log("Half of the last requests were already in the database, so assume up to date.")
            return;
        }
        //wait so we don't get blocked
        await timeoutAsync(1001);
    }
}


exports.handler = function (event, context, callback) {
    run(event).then(r => callback(null, r)).catch(e => callback(e));
}