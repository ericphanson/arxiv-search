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
    meta : meta
}

export interface meta {
    tot_num_papers : number
    date_hist_data? : date_data[]
    prim_data? : cat_data[]
    in_data? : cat_data[]
    time_filter_data? : tf_data[]
    lib_data? : lib_data
    
}

export interface lib_data {
    /** Number of results in your library */
    in_lib : number
    /** Number of results not in your library */
    out_lib : number
}
export interface tf_data {
    /** time_range is "alltime" or "week", etc. */
    time_range : timeFilter
    num_results : number
}
export interface date_data {
    /**  time is in seconds since the unix epoch. 
    Right now, the times should be Jan 1 of each year
    for which there is a non-zero amount of papers.*/
    time : timestamp

    /** num_results is the number of results in that bucket.  */
    num_results : number
}

export interface cat_data {
    category : string
    num_results : number
}
