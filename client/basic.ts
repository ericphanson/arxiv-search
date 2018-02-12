export function notimpl() {
    throw new Error("not implemented.")
}

declare global {
    interface Array<T> {
        interlace(sep: T): T[];
        find(pred : (item : T, index : number) => boolean) : T | undefined;
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