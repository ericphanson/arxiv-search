import * as elasticsearch from 'elasticsearch';
import * as fs from 'fs'

export const getClient = () => {
    const es_user = fs.readFileSync(process.env["LAMBDA_TASK_ROOT"] + '/out/keys/ES_USER.txt', 'utf8');
    const es_pass = fs.readFileSync(process.env["LAMBDA_TASK_ROOT"] +  '/out/keys/ES_PASS.txt', 'utf8');
    const url = '0638598f91a536280b20fd25240980d2.us-east-1.aws.found.io';
    const port = '9243';    
    const host = `https://${es_user}:${es_pass}@${url}:${port}/`;
    return new elasticsearch.Client({ host });
}