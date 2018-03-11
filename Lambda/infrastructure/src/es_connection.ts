import * as elasticsearch from 'elasticsearch';
import * as fs from 'fs'


export function getClient() {
    const es_user = fs.readFileSync('keys/ES_USER.txt', 'utf8');
    const es_pass = fs.readFileSync('keys/ES_PASS.txt', 'utf8');
    const host = '0638598f91a536280b20fd25240980d2.us-east-1.aws.found.io';
    const port = 9243;
    return new elasticsearch.Client({
        host: [
            `https://${es_user}:${es_pass}@${host}:${port}/`
        ],
        requestTimeout: 30000
    });
}