import * as http from 'http';
import { DynamoDB } from 'aws-sdk';
let db = new DynamoDB({ apiVersion: '2012-08-10' });


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
            id: [string],
            "journal-ref": [string],
            licence: [string],
            "msc-class": [string],
            "submitter": [string],
            "title": [string],
            "version": { "$": {/** `v1`,`v2` etc*/ version: string }, date: [string], size: [string] }[],
        }]
    }]
}

interface OAIResponse {
    "OAI-PMH": {
        error ?: any
        "responseDate": string[],
        request: any,
        ListRecords: [{
            record: OAIRecord[],
            resumptionToken?: [{ "_": string, "$": { cursor: string, completeListSize: string } }]
        }]
    }
}

async function fromOAI(event) {
    const stop_if_we_already_have_this_many_in_a_row = 100;
    const fromDate = "2018-03-01";
    const base_url = `http://export.arxiv.org/oai2?`;
    const query = `verb=ListRecords&metadataPrefix=arXivRaw&from=${fromDate}`;
    const DONT_WRITE_TO_DB = false;
    const ONLY_GENERATE_THIS_MANY_ENTRIES = 50; //set to undefined in production mode TODO make this an env variable.
    const LATEST_ONLY = true;
    let resumptionToken : undefined | string = undefined;
    let grandTotal = 0;
    while(true) {
        let url = base_url + (resumptionToken === undefined ? query : `verb=ListRecords&resumptionToken=${resumptionToken}`);
        console.log(url);
        let resp = await requestAsync(url);
        let timeout = timeoutAsync(11000);
        if (resp.statusCode === 503) {
            //wait 10 seconds and try again
        }
        else if (resp.statusCode === 200) {
            let oai: OAIResponse = await xml2jsAsync(resp.body);
            let error = oai["OAI-PMH"].error
            if (error) {
                let msg = error[0]._
                let code = error[0].$.code;
                console.log("request error: " + msg);
                if (code === "noRecordsMatch") {
                    //no papers were submitted.
                    return;
                }
                else {
                    throw new Error(msg);
                }
            }
            let listRecords = oai["OAI-PMH"].ListRecords[0];
            resumptionToken = listRecords.resumptionToken[0]._;
            let oaiRecords = listRecords.record;
            //let haveCount = 0;
            //let haves_in_a_row = 0;
            //let total = 0;
            //let wait_for_these = [];
            let wasANewPaper = await Promise.all(oaiRecords.map(record => {
                let header = record.header[0];
                let meta = record.metadata[0].arXivRaw[0];
                let id = meta.id[0];
                let vNumbers = meta.version.map(v => Number(v.$.version.substr(1)));
                let maxVNumber = Math.max(...vNumbers);
                let versions = LATEST_ONLY ? [meta.version[vNumbers.findIndex(x => x === maxVNumber)]] : meta.version;
                for (let v of versions) {
                    if (v === undefined) {continue;}
                    let vv = v.$.version;
                    let date = v.date[0]; //in format "Thu, 21 Jun 2007 14:27:55 GMT"
                    let idvv_with_slash = id + vv;
                    if (DONT_WRITE_TO_DB) {return Promise.resolve(true);}
                    return addToDB(idvv_with_slash);
                }
            }))
            let total = wasANewPaper.length;
            let newPaperCount = wasANewPaper.reduce((n,b) => n + (b ? 1 : 0), 0);
            grandTotal += newPaperCount;
            if (ONLY_GENERATE_THIS_MANY_ENTRIES !== undefined && grandTotal >= ONLY_GENERATE_THIS_MANY_ENTRIES) {
                console.log(`Only generating ${ONLY_GENERATE_THIS_MANY_ENTRIES} entries because the constant 'ONLY_GENERATE_THIS_MANY_ENTRIES' is not undefined.`);
                return;
            }
            console.log(`Processed ${total} entries. ${newPaperCount} new entries added to database. Resumption token = ${resumptionToken}`);
            if (resumptionToken === undefined) {return;}
        }
        else {
            throw new Error("unrecognised response status code: "+ resp.statusCode);
        }
        //TODO check the context to see if we have time to do another loop.
        await timeout;
    }
}

/**Add idvv to database. If the request failed because we already had the entry, returns false */
async function addToDB(idvv_with_slash: string) {
    let idvv = idvv_with_slash.replace("/", "");
    try {
        //console.log(`adding ${idvv_with_slash} to database.`);
        await db.putItem({
            TableName : process.env["StatusTable"].split("/")[1],
            Item: {
                "idvv": { "S": idvv },
                "pdf": { "S": "want" },
                "thumb": { "S": "want" },
                "pdf_url": { "S": `https://export.arxiv.org/pdf/${idvv_with_slash}.pdf` },
                "src": { "S": "want" },
                "src_url": { "S": `https://export.arxiv.org/e-print/${idvv_with_slash}` },
            },
            ConditionExpression: "idvv <> :idvv", //only put if its not already there
            ExpressionAttributeValues: { ":idvv": { "S": idvv } },
            ReturnValues: "NONE"
        }).promise();
    }
    catch (e) {
        if (e.message === "The conditional request failed") {
            //console.log(`already have ${idvv} in database.`);
            return false;
        }
        else {
            //it failed for some other reason.
            throw e;
        }
    }
    return true;
}

async function fromAPI(event) {
    const increment = 10;
    const number_of_iterations = 2
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
            let idvv_with_slash = entry.id[0].match(/http:\/\/arxiv\.org\/abs\/([\w\.\/-]+)$/)[1];
            let was_added = addToDB(idvv_with_slash);
            if (!was_added) { have_count++; }
        }
        if (have_count * 2 >= increment) {
            console.log("Half of the last requests were already in the database, so assume up to date.")
            return;
        }
        //wait so we don't get blocked
        await timeoutAsync(1001);
    }
}

export const handler = function (event, context, callback) {
    fromOAI(event).then(r => callback(null, r)).catch(e => callback(e));
}