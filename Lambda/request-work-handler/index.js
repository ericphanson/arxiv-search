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
    apiVersion: '2006-03-01'
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
/** Called by AWS */
exports.handler = function (event, context, callback) {
    // the API should pass through a client_id
    var send_string = "sent_to_client=" + event.client_id;
    var MAX_NUM_TO_DOWNLOAD = 20;
    var url_keys = ["tar_url", "pdf_url"];
    // Step 1. convert our lists of urls and statuses into parameters for a db scan
    var status_keys = ["tar", "pdf"];
    var FilterExpression = status_keys.map(function (r) { return r + " = :w"; }).join(" OR ");
    //all the fields we want to return
    var get_fields = url_keys.concat(status_keys, ["idvv"]);
    var ProjectionExpression = get_fields.join(", ");
    var scan_params = {
        TableName: "papers-status",
        ProjectionExpression: ProjectionExpression,
        ExpressionAttributeValues: { ":w": { "S": "want" } },
        FilterExpression: FilterExpression
    };
    // Step 2. Page the database, find relevant records.
    function getDownloadParams() {
        return __awaiter(this, void 0, void 0, function () {
            var list_of_download_params, first, continue_key, num_pages, num_items, sp, data, _i, _a, record, _b, _c, _d, i, sk, uk, idvv, fetch_url, uploadUrl;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
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
                            return [2 /*return*/, list_of_download_params];
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
                        // proceed to the next phase of recusion once the urls are processed
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
            TableName: "papers-status",
            Key: { "idvv": { "S": idvv } },
            ExpressionAttributeValues: { ":sent": { "S": send_string } },
            UpdateExpression: "SET " + field + " = :sent",
            ReturnValues: "NONE"
        }).promise();
    }
    getDownloadParams().then(function (result) {
        // Lastly: return the download params to the waiting API
        callback(null, result);
    })["catch"](function (err) {
        console.log("Recurse had an error");
        callback(err);
    });
};
