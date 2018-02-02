export function notimpl() {
    throw new Error("not implemented.")
}

declare global {
    interface Array<T> {
        interlace(sep: T): T[];
    }
}
if (!Array.prototype.interlace) {
    Array.prototype.interlace = function <T>(sep: T): T[] {
        let ts = this;
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