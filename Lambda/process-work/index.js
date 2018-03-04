'use strict';
var __assign = (this && this.__assign) || Object.assign || function(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
        s = arguments[i];
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
    }
    return t;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = y[op[0] & 2 ? "return" : op[0] ? "throw" : "next"]) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [0, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
var AWS = require("aws-sdk");
AWS.config.region = 'us-east-1';
var db = new AWS.DynamoDB({
    apiVersion: '2012-08-10'
});
var s3 = new AWS.S3({
    apiVersion: '2006-03-01',
    signatureVersion: 'v4'
});
/** The bucket to make URLs for placing downloads in */
var BUCKET = 'arxiv-incoming';
/**
 * Simple function to flatten arrays.
 * @param arr array to flatten
 * @param result flattened array
 */
var flatten = function (arr, result) {
    if (result === void 0) { result = []; }
    for (var i = 0, length = arr.length; i < length; i++) {
        var value = arr[i];
        if (Array.isArray(value)) {
            flatten(value, result);
        }
        else {
            result.push(value);
        }
    }
    return result;
};
var MAX_NUM_TO_DOWNLOAD = 20;
var url_keys = ["src_url", "pdf_url"];
var status_keys = ["src", "pdf"];
var TableName = "papers-status";
function handleRequest(event) {
    return __awaiter(this, void 0, void 0, function () {
        /**
        * Returns a promise for a signed url for uploading a file to s3.
        * @param id should correspond to idvv of database. Used as the key for an s3 upload.
        * @param extension file extension
        */
        function getUploadURL(id, extension) {
            var key = id + "." + extension;
            var params = {
                Bucket: BUCKET,
                Key: key
            };
            var URL = new Promise(function (resolve, reject) {
                s3.getSignedUrl('putObject', params, function (err, url) {
                    resolve(url);
                });
            });
            return URL;
        }
        /**
         * Update the database by changing "want"s to "sent to client"'s. Returns a promise that resolves when
         * the database updates.
         * @param idvv the id of the item in the database to update
         * @param field which field to declare as being sent to the client. e.g. "pdf".
         */
        function update_db(idvv, field) {
            return db.updateItem({
                TableName: TableName,
                Key: { "idvv": { "S": idvv } },
                ExpressionAttributeValues: { ":sent": { "S": send_string } },
                UpdateExpression: "SET " + field + " = :sent",
                ReturnValues: "NONE"
            }).promise();
        }
        var send_string, FilterExpression, get_fields, ProjectionExpression, scan_params, list_of_download_params, first, continue_key, num_pages, num_items, sp, data, _i, _a, record, _b, _c, _d, i, sk, uk, idvv, fetch_url, uploadUrl;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    if (event.client_id === undefined) {
                        return [2 /*return*/, Promise.reject("client_id undefined.")];
                    }
                    send_string = "sent_to_client=" + event.client_id;
                    FilterExpression = status_keys.map(function (r) { return r + " = :w"; }).join(" OR ");
                    get_fields = url_keys.concat(status_keys, ["idvv"]);
                    ProjectionExpression = get_fields.join(", ");
                    scan_params = {
                        TableName: TableName,
                        ProjectionExpression: ProjectionExpression,
                        ExpressionAttributeValues: { ":w": { "S": "want" } },
                        FilterExpression: FilterExpression
                    };
                    list_of_download_params = [];
                    first = true;
                    continue_key = undefined;
                    num_pages = 0;
                    num_items = 0;
                    _e.label = 1;
                case 1:
                    sp = __assign({}, scan_params);
                    if (continue_key) {
                        sp.ExclusiveStartKey = continue_key;
                    }
                    return [4 /*yield*/, db.scan(sp).promise()];
                case 2:
                    data = _e.sent();
                    if (data.Items === undefined) {
                        return [3 /*break*/, 11];
                    }
                    num_pages++;
                    console.log("On page " + num_pages);
                    num_items += data.Items.length;
                    _i = 0, _a = data.Items;
                    _e.label = 3;
                case 3:
                    if (!(_i < _a.length)) return [3 /*break*/, 9];
                    record = _a[_i];
                    _b = [];
                    for (_c in url_keys)
                        _b.push(_c);
                    _d = 0;
                    _e.label = 4;
                case 4:
                    if (!(_d < _b.length)) return [3 /*break*/, 8];
                    i = _b[_d];
                    sk = status_keys[i];
                    uk = url_keys[i];
                    if (!(record[sk] && record[sk].S === "want" && list_of_download_params.length <= MAX_NUM_TO_DOWNLOAD)) return [3 /*break*/, 7];
                    if (!record.idvv) {
                        console.log("record doesn't have an `idvv` term: ", record);
                        return [3 /*break*/, 7];
                    }
                    if (!record.idvv.S) {
                        console.log("record.idvv is not a string ", record.idvv);
                        return [3 /*break*/, 7];
                    }
                    idvv = record.idvv.S;
                    if (record[uk] === undefined || record[uk].S === undefined) {
                        console.log("record[" + uk + "].S was not found:  " + record);
                        return [3 /*break*/, 7];
                    }
                    fetch_url = record[uk].S;
                    return [4 /*yield*/, update_db(idvv, sk)];
                case 5:
                    _e.sent();
                    return [4 /*yield*/, getUploadURL(idvv, sk)];
                case 6:
                    uploadUrl = _e.sent();
                    list_of_download_params.push({
                        "idvv": idvv,
                        "field": sk,
                        "fetch": fetch_url,
                        "submit": uploadUrl
                    });
                    _e.label = 7;
                case 7:
                    _d++;
                    return [3 /*break*/, 4];
                case 8:
                    _i++;
                    return [3 /*break*/, 3];
                case 9:
                    continue_key = data.LastEvaluatedKey;
                    if (list_of_download_params.length > MAX_NUM_TO_DOWNLOAD) {
                        continue_key = false;
                    }
                    _e.label = 10;
                case 10:
                    if (continue_key) return [3 /*break*/, 1];
                    _e.label = 11;
                case 11: return [2 /*return*/, list_of_download_params];
            }
        });
    });
}
function handleError(event) {
    return __awaiter(this, void 0, void 0, function () {
        var client_id, errors, db_items, _loop_1, _i, errors_1, _a, idvv, field;
        return __generator(this, function (_b) {
            client_id = event.client_id, errors = event.errors;
            if (client_id === undefined) {
                return [2 /*return*/, Promise.reject("client_id undefined.")];
            }
            if (errors === undefined) {
                return [2 /*return*/, Promise.reject("No errors provided.")];
            }
            db_items = [];
            _loop_1 = function (idvv, field) {
                //perform some validation so the api can't change things willy nilly.
                if (field === undefined || idvv === undefined) {
                    return "continue";
                }
                if (!status_keys.some(function (k) { return field === k; })) {
                    return "continue";
                }
                db_items.push(db.updateItem({
                    TableName: TableName,
                    Key: { "idvv": { "S": idvv } },
                    ConditionExpression: "idvv = :idvv AND " + field + " <> :have AND " + field + " <> :dead",
                    ExpressionAttributeValues: {
                        ":error": { "S": "error" },
                        ":idvv": { "S": idvv },
                        ":have": { "S": "have" },
                        ":dead": { "S": "dead" }
                    },
                    UpdateExpression: "SET " + field + " = :error",
                    ReturnValues: "NONE"
                }).promise());
            };
            for (_i = 0, errors_1 = errors; _i < errors_1.length; _i++) {
                _a = errors_1[_i], idvv = _a.idvv, field = _a.field;
                _loop_1(idvv, field);
            }
            return [2 /*return*/, Promise.all(db_items)];
        });
    });
}
/** Called by AWS */
exports.handler = function (http_resp, context, callback) {
    var event = JSON.parse(http_resp.body);
    // try {
    // event = JSON.parse(JSON.parse(http_resp.body));
    // }
    // catch (e) {
    //     console.log(e)
    //     event =JSON.parse(http_resp.body);
    // }
    var promise;
    if (event.kind === "request") {
        promise = handleRequest(event);
    }
    else if (event.kind === "error") {
        promise = handleError(event);
    }
    else {
        var e = "unknown event type: " + event.kind;
        end_eval(e, null, callback);
        return;
    }
    promise.then(function (r) { return end_eval(null, r, callback); })["catch"](function (e) { return end_eval(e, null, callback); });
};
/**
 * Function to end evaulation of the Lambda and format the response for the API.
 * @param error error to pass out ot the API
 * @param success data to pass out of the API if it succeeds
 * @param end_callback the callback from exports.handler
 */
function end_eval(error, success, end_callback) {
    var responseHeaders = {
        'Content-Type': 'application/json',
        // Required for CORS support to work
        'Access-Control-Allow-Origin': '*',
        // Required for cookies, authorization headers with HTTPS
        'Access-Control-Allow-Credentials': true
    };
    var response = {
        "headers": responseHeaders,
        "isBase64Encoded": false
    };
    if (error) {
        response['statusCode'] = 500;
        response['body'] = JSON.stringify(error);
    }
    else {
        response['statusCode'] = 200;
        response['body'] = JSON.stringify(success);
    }
    return end_callback(null, response);
}
