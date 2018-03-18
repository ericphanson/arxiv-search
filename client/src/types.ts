/** ArXiv categories. Full list is in `all_categories.txt`. */
export type category = string;
/** As implemented now, start and end should be a timestamp in milliseconds since the epoch see https://www.epochconverter.com/. For example `1517425200000` is Wednesday, January 31, 2018 7:00:00 PM. */
export type timestamp = number
export type timeFilter = "3days" | "week" | "day" | "alltime" | "month" | "year" | {start : timestamp, end : timestamp}


/** rec_tuning exposes parameters for tweaking how recommended searches are made to the client. Maybe we never want to actually give this much
 * complexity to the client, but I think it would be really useful to have some rough controls to move in order to pin down the right weights to use
 * as the default ones. And maybe we can keep it for logged in users...
 */
export interface rec_tuning {
    /** Dictionary that assigns a weight to each field. For example, {'authors' : 2.0} means
     * that matching the author field is worth 2 whereas matching other fields is 1.0 by default.
     * The key field should be one of 'fulltext', 'title', 'abstract', or 'all_authors'.
     */
    weights :  {
        fulltext : number, title : number, abstract : number, all_authors : number
    }
    /** From ES: The maximum number of query terms that will be selected. 
     * Increasing this value gives greater accuracy at the expense of query execution speed. Defaults to 25 */
    max_query_terms? : number
    /** The minimum document frequency below which the terms will be ignored from the input document. Defaults to 5. */
    min_doc_freq? : number
    /** The maximum document frequency above which the terms will be ignored from the input document. 
     * This could be useful in order to ignore highly frequent words such as stop words. Defaults to unbounded (0).*/
    max_doc_freq? : number
    /** From ES: After the disjunctive query has been formed, this parameter controls the number of terms that must match. Defaults to 30%.
     * See https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl-minimum-should-match.html for syntax.
     */
    minimum_should_match? : string
    /** From ES: Each term in the formed query could be further boosted by their tf-idf score. 
     * This sets the boost factor to use when using this feature. Defaults to deactivated (0). Any other positive value activates terms boosting with the given boost factor.
    */
    boost_terms? : number
    /** If true, e.g., papers with the same authors as from papers in your library add to the score, but papers who cite those authors
     * (so the author's name appears in the fulltext) do not get points to their score. If false, terms that appear anywhere in papers in your library contribute
     * count towards any field (fulltext, title, abstract, or all_authors) for which they show up in search documents.
     */
    pair_fields? : boolean
}

/** The object which is passed to the server to request author autocompletions */
export interface auth_complete {
    /** the partial name which has been typed so for, for which you want autocompletions */
    partial_name : string
}

/** the object which is passed to the server to request papers from a certain query */
export interface query {
    /** pass info to tune how recommended searches are made. */
    rec_tuning ?: rec_tuning
    /** A string representing the search query. Can use AND (or +), NOT (or -), etc. */
    query? : string,
    /**Score higher if related to papers in the library. */
    rec_lib : boolean,
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
    /** only show papers in the library */
    only_lib : boolean
    /** list of ids to boost the score of papers similar to them. */
    sim_to? : string[],
    /**A number used to track distinct queries client-side */
    queryID? : number
}
/**JSON object sent to _get_results() */
export interface request {
    query : query,
    start_at : number,
    num_get : number,
    dyn : boolean
}

export interface paper {
    /** Extra comments about the paper; truncated to 100 characters + ... */
    comment? : string
    score? : number
    explain_sentence? : string
    title : string
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
    abstract? : string
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
    /** is there a thumbnail picture? */
    havethumb? : boolean
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