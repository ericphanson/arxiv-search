/** ArXiv categories. Full list is in `all_categories.txt`. */
export type category = "quant-ph" | "cond-mat" | "hep-th" //...and so on
/** As implemented now, start and end should be a timestamp in milliseconds since the epoch see https://www.epochconverter.com/. For example `1517425200000` is Wednesday, January 31, 2018 7:00:00 PM. */
export type timestamp = number
export type timeFilter = "3days" | "week" | "day" | "alltime" | "month" | "year" | {start : timestamp, end : timestamp}

export interface query {
    query? : string,
    sort? : "relevance" | "date",
    /** Categories to filter; outer list is AND, inner list is OR. */
    category : category[][],
    /**The time span to filter results by. */
    time : timeFilter,
    /** Only include results whose __primary__ category is this. */
    primaryCategory? : category,
    /**Search author fields using this string. So eg can search for two authors using `"Fredson Bobson"` */
    author? : string,
    /**Only search for the first iteration of the papers. */
    v1 : boolean
    only_lib : boolean
}
/**JSON object sent to _get_results() */
export interface request {
    query : query,
    start_at : number,
    num_get : number,
    dyn : boolean
}

export interface paper {
    title : string,
    /**ArXiv id. Eg `1802.02400v2` */
    pid : string
    /**`pid` without version. Eg `"1802.02400"`*/
    rawpid : string
    /**Primary arxiv cateogry */
    category : category
    /**Link to arxiv page. Eg `"http://arxiv.org/abs/1709.01942v3"`. */
    link : string
    authors : string[]
    /** Some text with math delimited with `$`. */
    abstract : string
    /**URL to imagemagic image of paper */
    img : string
    /**Cross-posting categories  */
    tags : category[]
    /** A formatted date. Eg `"8 Feb 2018"` */
    published_time : string
    /** A formatted date when v1 was published. Eg `"8 Feb 2018"` */
    originally_published_time : string
    /**In the user's library of papers. */
    in_library : boolean
}

export interface response {
    /**Something to do with rendering mathjax */
    dynamic : boolean,
    start_at : number
    /**The same as `num_get` in the request object. If `papers.length < num_get` then we are done. */
    num_get : number
    papers : paper[]
    tot_num_papers : number
}

export interface meta {
    date_hist_data? : {[timestamp : number]:number}
    prim_data? : {[cat : string]:number}
    in_data? : {[cat : string]:number}
    time_filter_data? : {[time : string]:number}
    lib_data? : {in_lib : number, out_lib : number}
    auth_data? : {[name : string] : number}
    keyword_data? : {[keyword : string] : number}
    
}