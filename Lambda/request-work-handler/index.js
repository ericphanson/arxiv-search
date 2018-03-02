'use strict';
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
var _this = this;
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
    var status_keys = ["tar", "pdf"];
    //all the fields we want to return
    var get_fields = url_keys.concat(status_keys, ["idvv"]);
    // Step 1. convert our lists of urls and statuses into parameters for a db scan
    var expr = function (r) { return r + " = :w"; };
    var or_reducer = function (accumulator, currentValue) {
        return accumulator + ' OR ' + currentValue;
    };
    var FilterExpression = status_keys.map(expr).reduce(or_reducer);
    var comma_reducer = function (accumulator, currentValue) {
        return accumulator + ', ' + currentValue;
    };
    var ProjectionExpression = get_fields.reduce(comma_reducer);
    var scan_params = {
        TableName: "papers-status",
        ProjectionExpression: ProjectionExpression,
        ExpressionAttributeValues: {
            ":w": {
                "S": "want"
            }
        },
        FilterExpression: FilterExpression
    };
    var num_items = 0;
    var num_pages = 0;
    /** The central object: a list of download parameters to return to the gateway. */
    var list_of_download_params = [];
    var num_urls_so_far = 0;
    // Step 2. Page the database, find relevant records.
    /**
     * A recursive function for paginating through the database,
     * processing any records which meet the FilterExpression.
     * @param first true for the first round of recursion, false otherwise
     * @param start_key after the first round, a key should be sent for pagination
     * @param list_of_download_params keep track of the list the function is generating. Should start empty.
     */
    var recurse = function (first, start_key, list_of_download_params) { return __awaiter(_this, void 0, void 0, function () {
        var list_of_download_params_recurse, sp, data, outputs, _a, e_1, continue_key, e_2;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    list_of_download_params_recurse = [];
                    if (!(first || start_key)) return [3 /*break*/, 9];
                    sp = scan_params;
                    if (!(first)) {
                        sp['ExclusiveStartKey'] = start_key; //if it's not the first, there should be a resumption key
                    }
                    return [4 /*yield*/, db.scan(sp).promise()];
                case 1:
                    data = _b.sent();
                    if (data.Items === undefined) {
                        return [2 /*return*/, list_of_download_params];
                    }
                    num_pages++;
                    console.log("On page " + num_pages);
                    num_items += data.Items.length;
                    outputs = void 0;
                    _b.label = 2;
                case 2:
                    _b.trys.push([2, 4, , 5]);
                    _a = flatten;
                    return [4 /*yield*/, Promise.all(data.Items.map(process_record))];
                case 3:
                    outputs = _a.apply(void 0, [_b.sent()]);
                    return [3 /*break*/, 5];
                case 4:
                    e_1 = _b.sent();
                    console.log("error on processing records");
                    console.log(e_1);
                    return [2 /*return*/, list_of_download_params];
                case 5:
                    // flatten the list
                    list_of_download_params = list_of_download_params.concat(flatten(outputs));
                    continue_key = data.LastEvaluatedKey;
                    if (num_urls_so_far > MAX_NUM_TO_DOWNLOAD) {
                        continue_key = false;
                    }
                    _b.label = 6;
                case 6:
                    _b.trys.push([6, 8, , 9]);
                    return [4 /*yield*/, recurse(false, continue_key, list_of_download_params)];
                case 7:
                    list_of_download_params = _b.sent();
                    return [3 /*break*/, 9];
                case 8:
                    e_2 = _b.sent();
                    console.log("Caught error when recursing:");
                    console.log(e_2);
                    return [3 /*break*/, 9];
                case 9: return [2 /*return*/, list_of_download_params];
            }
        });
    }); };
    // fire off the recursion
    recurse(true, undefined, list_of_download_params).then(function (result) {
        // Lastly: return the download params to the waiting API
        callback(null, result);
    })["catch"](function (err) {
        console.log("Recurse had an error");
        callback(err);
    });
    // Step 3.  process the records that come through
    /** For each record, we check each possible URL to see if it is wanted.
     * If so, we collect the download parameters, and update the database
     * to say we are sending it to the client to download.
     * @param record a record returned from dynamodb
     */
    function process_record(record) {
        return __awaiter(this, void 0, void 0, function () {
            var local_list_for_download, db_update_promises, _a, _b, _i, i, sk, uk, get_item, idvv, fetch_url, signed_url, _c, _d, _e, _f, e_3, e_4;
            return __generator(this, function (_g) {
                switch (_g.label) {
                    case 0:
                        local_list_for_download = [];
                        db_update_promises = [];
                        _a = [];
                        for (_b in url_keys)
                            _a.push(_b);
                        _i = 0;
                        _g.label = 1;
                    case 1:
                        if (!(_i < _a.length)) return [3 /*break*/, 6];
                        i = _a[_i];
                        sk = status_keys[i];
                        uk = url_keys[i];
                        get_item = false;
                        if (record[sk]) {
                            try {
                                get_item = record[sk].S === "want";
                            }
                            catch (e) {
                                console.log(e);
                                console.log("^caught error from record[sk].S");
                                return [3 /*break*/, 5];
                            }
                        }
                        if (!(get_item && num_urls_so_far <= MAX_NUM_TO_DOWNLOAD)) return [3 /*break*/, 5];
                        idvv = void 0;
                        try {
                            idvv = record.idvv.S;
                        }
                        catch (e) {
                            console.log(e);
                            console.log("^caught error from record.idvv.S");
                            console.log("printing whole record:");
                            console.log(record);
                            return [3 /*break*/, 5];
                        }
                        fetch_url = void 0;
                        try {
                            fetch_url = record[uk].S;
                        }
                        catch (e) {
                            console.log(e);
                            console.log("^caught error from record[uk].s");
                            return [3 /*break*/, 5];
                        }
                        signed_url = getUploadURL(idvv, sk);
                        db_update_promises.push(update_db(idvv, sk));
                        _g.label = 2;
                    case 2:
                        _g.trys.push([2, 4, , 5]);
                        _d = (_c = local_list_for_download).push;
                        _e = {
                            "fetch": fetch_url
                        };
                        _f = "submit";
                        return [4 /*yield*/, signed_url];
                    case 3:
                        _d.apply(_c, [(_e[_f] = _g.sent(),
                                _e)]);
                        num_urls_so_far++;
                        return [3 /*break*/, 5];
                    case 4:
                        e_3 = _g.sent();
                        console.log("Error in getting signed URL");
                        console.log(e_3);
                        return [3 /*break*/, 5];
                    case 5:
                        _i++;
                        return [3 /*break*/, 1];
                    case 6:
                        _g.trys.push([6, 8, , 9]);
                        return [4 /*yield*/, Promise.all(db_update_promises)];
                    case 7:
                        _g.sent();
                        return [3 /*break*/, 9];
                    case 8:
                        e_4 = _g.sent();
                        console.log("Caught error when updating database:");
                        console.log(e_4);
                        return [3 /*break*/, 9];
                    case 9: return [2 /*return*/, local_list_for_download];
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
        return __awaiter(this, void 0, void 0, function () {
            var key, params, URL;
            return __generator(this, function (_a) {
                key = id + "." + extension;
                params = {
                    Bucket: BUCKET,
                    Key: key
                };
                URL = new Promise(function (resolve, reject) {
                    s3.getSignedUrl('putObject', params, function (err, url) {
                        resolve(url);
                    });
                });
                return [2 /*return*/, URL];
            });
        });
    }
    /**
     * Update the database by changing "want"s to "sent to client"'s. Returns a promise that resolves when
     * the database updates.
     * @param idvv the id of the item in the database to update
     * @param field which field to declare as being sent to the client. e.g. "pdf".
     */
    function update_db(idvv, field) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, db.updateItem({
                        TableName: "papers-status",
                        Key: {
                            "idvv": {
                                "S": idvv
                            }
                        },
                        ExpressionAttributeValues: {
                            ":sent": {
                                "S": send_string
                            }
                        },
                        UpdateExpression: "SET " + field + " = :sent",
                        ReturnValues: "NONE"
                    })];
            });
        });
    }
};
