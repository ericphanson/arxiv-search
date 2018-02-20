import { notimpl, sendRequest } from './basic';
import { paper, request, response, query, meta, timeFilter, category, rec_tuning } from './types';
import * as React from 'react';
import * as Infinite from 'react-infinite-scroller';
import Select from "react-select";
import { Paper } from './Paper';
import { all_categories, cat_desc, cat_col, is_ams } from './categories';
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
const rec_tuning_default: rec_tuning = {
    weights: { fulltext: 1.0, title: 1.0, abstract: 1.0, all_authors: 1.0 },
    max_query_terms: 25,
    min_doc_freq: 5,
    max_doc_freq: 0,
    minimum_should_match: "30%",
    boost_terms: 0,
    pair_fields: false
}
const defaultQuery: query = {
    query: "",
    rec_lib: false,
    category: [],
    v1: false,
    only_lib: false,
    time: "alltime",
    rec_tuning : rec_tuning_default
}
declare const beta_results_url: string;
declare const user: any;
declare const username: string;
let categories = all_categories.map(x => ({ value: x.c, label: x.c, desc: x.d }))

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
            if (r === undefined) { console.log("swallowing server error"); return;}
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
        this.setNextQuery({ query: event.target.value });
    }
    handleLoadMore() {
        if (this.state.isLoading || this.state.isDone) { return; }
        console.log("loadmore called");
        this.setState({ requestCount: this.state.requestCount + 10 }, () => this.getPapers());
    }
    handlePrimCat(cat: category) { this.setNextQuery({ primaryCategory: cat }, () => this.activateQuery()) }
    handleCat(andCats: category[]) { this.setNextQuery({ category: andCats.map(x => [x]) }, () => this.activateQuery()) }
    handleAuthor(a: string) { this.setNextQuery({ query: a }, () => this.activateQuery()) }
    handleTime(tf: timeFilter) { this.setNextQuery({ time: tf }, () => this.activateQuery()) }
    render() {
        let { papers, isDone, isLoading, meta, nextQuery: query } = this.state;
        let loggedIn = user !== "None"
        let cats = query.category.map(x => x[0]);
        return <div className="app-root">
            <div className="header-bg"></div>
            <nav className="header">
                <h1 className="header-logo nav-item">ARXIV-SEARCH.COM</h1>
                {
                    user === "None" ?
                        (<form action="login" method="post">
                            <input className="form-control" type="text" name="username" placeholder="Username" />
                            <input className="form-control" type="password" name="password" placeholder="Password" />
                            <input type="submit" value="Login or Create" className="btn btn-primary" />
                        </form>)
                        :
                        <span><span style={{ fontWeight: 700, color: "white" }}>Hello, {username}</span>
                            <a href="logout" className="btn btn-primary" style={{ marginLeft: "16px" }}>log out</a></span>
                }
            </nav>

            <div className="app-searchbar">
                <input type="text" className="searchinput"
                    value={query.query}
                    onChange={e => this.handleQueryboxChange(e)}
                    onKeyDown={e => e.keyCode === 13 && this.activateQuery()}
                    placeholder="Search" />
                <button id="qbutton" className="btn" onClick={e => this.activateQuery()}></button>
            </div>
            <div className="app-filters">
                <TimeGrid handleTime={(t) => this.handleTime(t)} current={query.time} time_filter_data={meta.time_filter_data} />
                <br />
                <Select
                    onBlurResetsInput={false}
                    onSelectResetsInput={false}
                    placeholder="primary category"
                    options={categories as any}
                    simpleValue
                    clearable={true}
                    name="prim"
                    value={query.primaryCategory || ""}
                    searchable={true}
                    onChange={(selected: any) => this.handlePrimCat(selected)} />
                <br />
                <Select
                    onBlurResetsInput={false}
                    onSelectResetsInput={false}
                    placeholder="categories"
                    options={categories as any}
                    simpleValue
                    clearable={true}
                    name="categories"
                    value={cats}
                    searchable={true}
                    multi
                    onChange={(selected: any) => this.handleCat(selected.split(","))} />
                <LeaderBoard cats={cats} in_data={meta.in_data} primaryCategory={query.primaryCategory} handleCat={x => this.handleCat(x)} />


                <br />
                {loggedIn && <label htmlFor="my-arxiv-checkbox">Reccomended<input type="checkbox" checked={query.rec_lib} name="v1" id="my-arxiv-checkbox" onChange={(e) => this.setNextQuery({ rec_lib: e.target.checked }, () => this.activateQuery())} /></label>}
                {user !== "None" && <label>In library: <input type="checkbox" checked={query.only_lib} onChange={(event) => this.setNextQuery({ only_lib: event.target.checked }, () => this.activateQuery())} /></label>}
                <label htmlFor="v1-checkbox">v1 only: <input id="v1-checkbox" type="checkbox" checked={query.v1} onChange={(e) => this.setNextQuery({ v1: e.target.checked }, () => this.activateQuery())} /></label>
                <br />
                <Tuning rt={query.rec_tuning} onChange={rt => this.setNextQuery({rec_tuning : rt}, () => this.activateQuery())}/>
            </div>
            <Infinite
                className="app-results"
                pageStart={0}
                loadMore={() => this.handleLoadMore()}
                hasMore={!isDone}
                loader={<div key="loading">Loading...</div>}
                threshold={500} >
                {[this.state.tot_num_papers && (<p><strong>{this.state.tot_num_papers.toLocaleString()}</strong> results</p>),
                <div id="rtable" key="rtable">
                    {papers.map((p, i) => <Paper p={p} key={p.pid}
                        onToggle={(on) => { let p = [...this.state.papers]; p[i].in_library = on; this.setState({ papers: p }) }}
                        onCategoryClick={(c) => this.handleCat(cats.addUnique(c))}
                        onAuthorClick={a => this.handleAuthor(a)}
                    />)}
                </div>,
                this.state.isDone && <h2 className="app-done">Done</h2>]}
            </Infinite>
        </div>
    }
}

class Tuning extends React.Component<{rt : rec_tuning, onChange : (r : rec_tuning) => void}, {rt : rec_tuning}> {
    constructor(props) {
        super(props);
        this.state = {rt : props.rt}
    }
    componentWillReceiveProps(newProps : this["props"]) {
        if (newProps.rt !== this.state.rt) {
            this.setState({rt : newProps.rt})
        }
    }
    handleChange(rt : rec_tuning) {
        this.setState({rt});
    }
    render() {
        let rt = this.state.rt;
        let ch = (p1: keyof rec_tuning, p2?: keyof rec_tuning["weights"]) => (e) => this.handleChange((rt as Object).lens(...(p2 ? [p1, p2] : [p1]))(Number(e.target.value)) as any)
        return <div>
            <h3>Tuning</h3>
                <table>
                    <tbody>
                        <tr>
                            <td>fulltext weight</td>
                            <td><input type="number" step="0.1" min="0" max="100"
                                value={rt.weights.fulltext}
                                onChange={ch("weights", "fulltext")} /></td>
                        </tr>
                        <tr>
                            <td>title weight</td>
                            <td><input type="number" step="0.1" min="0" max="100"
                                value={rt.weights.title}
                                onChange={ch("weights", "title")} /></td>
                        </tr>
                        <tr>
                            <td>abstract weight</td>
                            <td><input type="number" step="0.1" min="0" max="100"
                                value={rt.weights.abstract}
                                onChange={ch("weights", "abstract")} /></td>
                        </tr>
                        <tr>
                            <td>all_authors weight</td>
                            <td><input type="number" step="0.1" min="0" max="100"
                                value={rt.weights.all_authors}
                                onChange={ch("weights", "all_authors")} /></td>
                        </tr>
                        <tr>
                            <td>max query terms</td>
                            <td><input type="number" value={rt.max_query_terms} onChange={ch("max_query_terms")} /></td>
                        </tr>
                        <tr>
                            <td>min doc frequency</td>
                            <td><input type="number" value={rt.min_doc_freq} onChange={ch("min_doc_freq")} /></td>
                        </tr>
                        <tr>
                            <td>max doc frequency</td>
                            <td><input type="number" value={rt.max_doc_freq} onChange={ch("max_doc_freq")} /></td>
                        </tr>
                        <tr>
                            <td>minimum should match</td>
                            <td><input type="text" value={rt.minimum_should_match}
                                onChange={(e) => this.handleChange((rt as any).with({ "minimum_should_match": e.target.value }))} />
                            </td>
                        </tr>
                        <tr>
                            <td>max query terms</td>
                            <td><input type="number" value={rt.max_query_terms} onChange={ch("max_query_terms")} /></td>
                        </tr>
                        <tr>
                            <td>pair fields</td>
                            <td><input type="checkbox" checked={rt.pair_fields} onChange={(e) => this.handleChange((rt as any).with({ "pair_fields": e.target.checked }))} /></td>
                        </tr>
                    </tbody>
                </table>
            {this.props.rt !== rt && <button onClick={() => this.props.onChange(this.state.rt)}>Update!</button>}
        </div>
    }

}

function RadioGrid(props) {
    let { options } = props;
    let gridStyle = {
        display: "grid",
        gridGap: "1px",
        border: "1px solid transparent",
        borderRadius: "4px"
    }
    let buttonStyle = {
        fontWeight: 400, textAlign: "center", whiteSpace: "nowrap", verticalAlign: "middle", userSelect: "none", borderRadius: "0px",
        transition: "color 0.15s ease-in-out, background-color 0.15s ease-in-out, border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out",
        color: "#fff",
        backgroundColor: "rgb(173, 173, 173)"
    }
}

function TimeGrid({ handleTime, time_filter_data, current }) {
    let cl = t => t === current ? "timeButton btn-primary checked" : "timeButton btn-primary"
    const tf_data = (tf: timeFilter) => { let n = time_filter_data && time_filter_data[tf.toString()]; return n === undefined ? undefined : `(${n.toLocaleString()})` }
    return <div className="radioGrid">
        <div key="day" title="Only show papers from the last day." onClick={() => handleTime("day")} style={{ borderTopLeftRadius: "4px", gridColumn: "1", gridRow: "1", }} className={cl("day")}><div className="timeName" style={{ gridRow: "1", gridColumn: "1" }}>day</div><div className="timeScore" style={{ gridRow: "2", gridColumn: "1" }}>{tf_data("day")}</div></div>
        <div key="3days" title="Only show papers from the last 3 days." onClick={() => handleTime("3days")} style={{ gridColumn: "2", gridRow: "1", }} className={cl("3days")}><div className="timeName" style={{ gridRow: "1", gridColumn: "1" }}>3 days</div><div className="timeScore" style={{ gridRow: "2", gridColumn: "1" }}>{tf_data("3days")}</div></div>
        <div key="week" title="Only show papers from the last week." onClick={() => handleTime("week")} style={{ borderTopRightRadius: "4px", gridColumn: "3", gridRow: "1" }} className={cl("week")}><div className="timeName" style={{ gridRow: "1", gridColumn: "1" }}>week</div><div className="timeScore" style={{ gridRow: "2", gridColumn: "1" }}>{tf_data("week")}</div></div>
        <div key="month" title="Only show papers from the last month." onClick={() => handleTime("month")} style={{ borderBottomLeftRadius: "4px", gridColumn: "1", gridRow: "2", }} className={cl("month")}><div className="timeName" style={{ gridRow: "1", gridColumn: "1" }}>month</div><div className="timeScore" style={{ gridRow: "2", gridColumn: "1" }}>{tf_data("month")}</div></div>
        <div key="year" title="Only show papers from the last year." onClick={() => handleTime("year")} style={{ gridColumn: "2", gridRow: "2", }} className={cl("year")}><div className="timeName" style={{ gridRow: "1", gridColumn: "1" }}>year</div><div className="timeScore" style={{ gridRow: "2", gridColumn: "1" }}>{tf_data("year")}</div></div>
        <div key="alltime" title="Show papers from any time" onClick={() => handleTime("alltime")} style={{ borderBottomRightRadius: "4px", gridColumn: "3", gridRow: "2" }} className={cl("alltime")}><div className="timeName" style={{ gridRow: "1", gridColumn: "1" }}>all time</div><div className="timeScore" style={{ gridRow: "2", gridColumn: "1" }}>{tf_data("alltime")}</div></div>
        {/* {timeFilters.map(tf => <li 
        key={tf.toString()} 
        onClick={() => this.handleTime(tf)}
        style={{}}>
            <div>
                <input type="radio" name="time"
                    checked={query.time === tf} onChange={() => this.handleTime(tf)} />
                {tf.toString()}
            </div>
            <div className="result-count">{tf_data(tf)}</div>
        </li>)} */}
    </div>
}

class LeaderBoard extends React.PureComponent<{ in_data?, primaryCategory, cats, handleCat }, { kvs: { k: string, v: number }[] }> {
    constructor(props) {
        super(props);
        this.state = { kvs: [] };
    }
    componentWillReceiveProps(newProps) {
        if (newProps.in_data !== undefined) {
            let kvs = newProps.in_data
                .toKeyValueArray()
                .filter(({ k }) => !is_ams(k) && k !== newProps.primaryCategory && !newProps.cats.exists(c => c === k))
                .sort((a, b) => b.v - a.v)
                .slice(0, 10)
            this.setState({ kvs });
        }
    }
    render() {
        let { in_data, primaryCategory, cats, handleCat } = this.props
        let { kvs } = this.state;
        return <table>
            <tbody>
                {(() => {
                    return kvs.map(({ k, v }) => <tr className="anim-item" key={k}>
                        <td> <CatBadge onClick={() => {
                            let i = cats.findIndex(k2 => k2 === k);
                            if (i === -1) { handleCat([...cats, k as any]) }
                            else { handleCat(cats.drop(i)) }
                        }} cat={k} /></td>
                        <td>{in_data && `(${v.toLocaleString()})`}</td>
                    </tr>)
                })()}
            </tbody>
        </table>
    }

}
