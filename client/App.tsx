import { notimpl, sendRequest } from './basic';
import { paper, request, response, query, meta, timeFilter, category } from './types';
import * as React from 'react';
import * as Infinite from 'react-infinite-scroller';
import Select from "react-select";
import { Paper } from './Paper';
import { all_categories, cat_desc, cat_col, is_ams } from './all_categories';
import { CatBadge } from './CatBadge';
interface state {
    papers: paper[],
    /**The number of papers that should be visible */
    requestCount: number,
    isLoading: boolean,
    error?: string,
    isDone: boolean
    meta: meta,
    tot_num_papers: number,
    /**Query used to fetch results */
    activeQuery: query
    /**Query currently being edited. */
    nextQuery: query
}
let timeFilters = ["day", "3days", "week", "month", "year", "alltime"] as timeFilter[]
const defaultQuery: query = {
    query: "",
    sort: "query",
    category: [],
    v1: false,
    only_lib: false,
    time: "alltime"
}
declare const beta_results_url: string;
declare const user: any;
declare const username: string;
let categories = all_categories.map(x => ({ value: x.c, label: x.c, desc : x.d }))

export class App extends React.Component<{}, state> {
    constructor(props) {
        super(props);
        this.state = {
            activeQuery: defaultQuery,
            nextQuery: defaultQuery,
            meta: {},
            isDone: false,
            requestCount: 10,
            papers: [],
            isLoading: true,
            tot_num_papers: undefined
        }
    }
    componentDidMount() {
        this.activateQuery();
    }
    getPapers() {
        let query = this.state.activeQuery;
        let num_get = this.state.requestCount - this.state.papers.length
        let request: request = {
            query: this.state.activeQuery,
            start_at: this.state.papers.length,
            num_get,
            dyn: false,
        }
        let url = beta_results_url;
        this.setState({ isLoading: true })
        sendRequest(url, request, (r: response) => {
            if (this.state.activeQuery !== query) { return; }
            let { dynamic, start_at, papers } = r;
            let p = [...this.state.papers];
            for (let i = 0; i < papers.length; i++) {
                p[r.start_at + i] = papers[i];
            }
            this.setState({ papers: p, isLoading: false, isDone: papers.length < num_get, tot_num_papers: r.tot_num_papers });
        });
    }
    /**Replace activeQuery with nextQuery and fetch papers. */
    activateQuery() {
        this.setState({ activeQuery: this.state.nextQuery, requestCount: 10, papers: [], isDone: false, meta: {} }, () => {
            this.getPapers();
            let request = { query: this.state.activeQuery };
            sendRequest("_getmeta", request, (meta: Partial<meta>) =>
                this.setState({ meta: { ...this.state.meta, ...meta } }));
            sendRequest("_getslowmeta", request, (meta: Partial<meta>) =>
                this.setState({ meta: { ...this.state.meta, ...meta } }));
        });
    }
    setNextQuery(query: Partial<query>, callback?) {
        this.setState({ nextQuery: { ...this.state.nextQuery, ...query } }, callback);
    }
    handleQueryboxChange(event) {
        this.setNextQuery({ query: event.target.value, sort: "query" });
    }
    handleLoadMore() {
        if (this.state.isLoading || this.state.isDone) { return; }
        console.log("loadmore called");
        this.setState({ requestCount: this.state.requestCount + 10 }, () => this.getPapers());
    }
    handlePrimCat(cat: category) { this.setNextQuery({ primaryCategory: cat }, () => this.activateQuery()) }
    handleCat(andCats: category[]) { this.setNextQuery({ category: andCats.map(x => [x]) }, () => this.activateQuery()) }
    handleTime(tf: timeFilter) { this.setNextQuery({ time: tf }, () => this.activateQuery()) }
    render() {
        let { papers, isDone, isLoading, meta, nextQuery: query } = this.state;
        let loggedIn = user !== "None"
        let cats = query.category.map(x => x[0]);
        const tf_data = (tf: timeFilter) => { let n = meta.time_filter_data && meta.time_filter_data[tf.toString()]; return n === undefined ? undefined : `(${n})` }
        return <div className="app-root">
            <div className="header-bg"></div>
            <nav className="header">
                <h1 className="header-logo nav-item">ARXIV-SEARCH</h1>
                {
                    user === "None" ?
                        (<form action="login" method="post">
                            <input className="form-control" type="text" name="username" placeholder="Username"/>
                            <input className="form-control" type="password" name="password" placeholder="Password"/>
                            <input type="submit" value="Login or Create" className="btn btn-secondary" />
                        </form>)
                        :
                        [<span>{username}</span>,
                        <a href="logout" className="btn btn-secondary">log out</a>]
                }
            </nav>

            <div className="app-searchbar">
                <input type="text" className="searchinput"
                    value={query.query}
                    onChange={e => this.handleQueryboxChange(e)}
                    onKeyDown={e => e.keyCode === 13 && this.activateQuery()} />
                <button id="qbutton" className="btn" onClick={e => this.activateQuery()}></button>
            </div>
            <div className="app-filters">
                {this.state.tot_num_papers && (<p className="app-total"><strong>{this.state.tot_num_papers}</strong> results</p>)}
                <h4>time:</h4>
                <table>
                    <tbody>
                        {timeFilters.map(tf => <tr key={tf.toString()} onClick={() => this.handleTime(tf)}>
                            <td >
                                <input type="radio" name="time"
                                    checked={query.time === tf} onChange={() => this.handleTime(tf)} />
                                {tf.toString()}
                            </td>
                            <td className="result-count">{tf_data(tf)}</td>
                        </tr>)}
                    </tbody>
                </table>
                <h4>category:</h4>
                <Select
                    onBlurResetsInput={false}
                    onSelectResetsInput={false}
                    placeholder="type categories"
                    options={categories}
                    simpleValue
                    clearable={true}
                    name="categories"
                    value={cats}
                    searchable={true}
                    multi
                    onChange={(selected) => this.handleCat(selected.split(","))} />
                {meta.in_data && <table>
                    <tbody>
                        {(() => {
                            let kvs = meta.in_data.toKeyValueArray().filter(({k}) => is_ams(k))
                            return kvs.sort((a, b) => b.v - a.v).slice(0, 10).map(({ k, v }) => <tr >
                                <td> <CatBadge onClick={() => {
                                let i = cats.exists(k2 => k2 === k);
                                if (i === undefined) { this.handleCat([...cats, k as any]) }
                                else { this.handleCat(cats.drop(i)) }
                            }} cat={k}/></td>
                                <td>({v})</td>
                            </tr>)
                        })()}
                    </tbody>
                </table>}
                <h4>primary category:</h4>
                <Select
                    onBlurResetsInput={false}
                    onSelectResetsInput={false}
                    placeholder="type a primary category"
                    options={categories}
                    simpleValue
                    clearable={true}
                    name="prim"
                    value={query.primaryCategory || ""}
                    searchable={true}
                    onChange={(selected) => this.handlePrimCat(selected)} />
                {meta.prim_data && <table>
                    <tbody>
                        {(() => {
                            let kvs = meta.prim_data.toKeyValueArray();
                            return kvs.sort((a, b) => b.v - a.v).slice(0, 10).map(({ k, v }) => <tr className={k === query.primaryCategory && "strong"} >
                                <td><CatBadge cat={k} onClick={() => this.handlePrimCat(k as any)}/></td>
                                <td>({v})</td>
                            </tr>)
                        })()}
                    </tbody>
                </table>}
                <h4>Other options:</h4>
                {loggedIn && <label htmlFor="my-arxiv-checkbox">Reccomended<input type="checkbox" checked={query.sort === "relevance"} name="v1" id="my-arxiv-checkbox" onChange={(e) => this.setNextQuery({ sort: (e.target.checked ? "relevance" : "query") }, () => this.activateQuery())} /></label>}
                {user !== "None" && <label>In library: <input type="checkbox" checked={query.only_lib} onChange={(event) => this.setNextQuery({ only_lib: event.target.checked }, () => this.activateQuery())} /></label>}
                <label htmlFor="v1-checkbox">v1 only: <input id="v1-checkbox" type="checkbox" checked={query.v1} onChange={(e) => this.setNextQuery({ v1: e.target.checked }, () => this.activateQuery())} /></label>
            </div>
            <Infinite
                className="app-results"
                pageStart={0}
                loadMore={() => this.handleLoadMore()}
                hasMore={!isDone}
                loader={<div key="loading">Loading...</div>}
                threshold={500} >
                <div id="maindiv" key="maindiv">
                    <div id="rtable" key="rtable">
                        {papers.map((p, i) => <Paper p={p} key={p.pid}
                            onToggle={(on) => { let p = [...this.state.papers]; p[i].in_library = on; this.setState({ papers: p }) }}
                            onCategoryClick={(c) => this.handleCat(cats.addUnique(c))} />)}
                    </div>
                </div>
            </Infinite>
            {this.state.isDone && <h2 className="app-done">Done</h2>}
        </div>
    }
}
