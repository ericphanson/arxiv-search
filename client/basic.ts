export function notimpl() {
    throw new Error("not implemented.")
}

export function sendRequest(url: string, request, callback: (response: any) => void) {
    window.fetch(url, {
        method: "POST",
        body: JSON.stringify(request),
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin"
    }).then(
        response => response.ok ? response.json() : console.log("couldn't connect to server."),
        error => console.log(`Network error: ${error}`)
        ).then(callback);
}
declare global {
    interface Object {
        toKeyValueArray() :{k:string, v : any}[];
    }
}
declare global {
    interface Array<T> {
        interlace(sep: T): T[];
        find(pred : (item : T, index : number) => boolean) : T | undefined;
        exists(pred : (item : T, index : number) => boolean) : boolean;
        findIndex(pred : (item : T, index : number) => boolean) : number;
        drop(index : number) : T[];
        /**Immutably add `item` unless it is already on the array. */
        addUnique(item : T) : T[];
    }
}
if (!Array.prototype.interlace) {
    Array.prototype.interlace = function <T>(sep: T): T[] {
        let ts : any = this as any;
        if (ts.length === 0) { return ts; }
        let r = new Array<T>();
        r.push(ts[0]);
        for (let i = 1; i < ts.length; i++) {
            r.push(sep);
            r.push(ts[i]);
        }
        return r;
    };
}
if(!Array.prototype.find) {Array.prototype.find = function (pred) {
    for (let i = 0; i < this.length; i++) {
       if (pred(this[i],i)) {return this[i];} 
    }
    return undefined;
}}
if (!Array.prototype.exists) {Array.prototype.exists = function (pred) {
    for (let i = 0; i < this.length; i++) {
        if (pred(this[i],i)) {return true;}
    }
    return false;
}}
if (!Array.prototype.findIndex) {Array.prototype.findIndex = function (pred) {
    for (let i = 0; i < this.length; i++) {
        if (pred(this[i],i)) {return i;}
    }
    return -1;
}}
if (!Array.prototype.drop) {Array.prototype.drop = function (i) {
    return [...this.slice(0,i),...this.slice(i+1)];
}}
if (!Array.prototype.addUnique) {Array.prototype.addUnique = function (item) {
    return this.exists(x => x === item) ? this : [...this,item];
}}
if (!Object.prototype.toKeyValueArray) {Object.prototype.toKeyValueArray = function () {
    let a = []
    let ks = Object.getOwnPropertyNames(this);
    for (let k of ks) {
        a.push({k,v:this[k]});
    }
    return a;
}}