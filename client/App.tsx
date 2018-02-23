import { notimpl, sendRequest, update, lens, toKeyValueArray } from './basic';
import { paper, request, response, query, meta, timeFilter, category, rec_tuning } from './types';
import * as React from 'react';
import * as Infinite from 'react-infinite-scroller';
import Select from "react-select";
import { CSSTransitionGroup } from 'react-transition-group';
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
    minimum_should_match: "1%",
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
    rec_tuning: rec_tuning_default
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
            if (r === undefined) { console.log("swallowing server error"); return; }
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
        return <div className="app-root helvetica bg-washed-yellow">
            <div className="header-bg bg-maroon"></div>
            <nav className="header ma1">
                <h1 className="ma2 white f3 di">ARXIV-SEARCH.COM</h1>
                {
                    user === "None" ?
                        (<form action="login" method="post" className="f5">
                            <input className="form-control" type="text" name="username" placeholder="Username" />
                            <input className="form-control" type="password" name="password" placeholder="Password" />
                            <input type="submit" value="Login or Create" className="link white ba bw1 b--white bg-transparent br2 pointer dib b tc v-mid pa2 pointer hover-bg-dark-red" />
                        </form>)
                        :
                        <span><span style={{ fontWeight: 700, color: "white" }}>Hello, {username}</span>
                            <a href="logout" className="btn btn-primary" style={{ marginLeft: "16px" }}>log out</a></span>
                }
            </nav>

            <div className="app-searchbar">
                <input type="text" className="ba br2 br--left b--moon-gray f2 pa2 w-100"
                    value={query.query}
                    onChange={e => this.handleQueryboxChange(e)}
                    onKeyDown={e => e.keyCode === 13 && this.activateQuery()}
                    placeholder="Search" />
                <button
                    id="qbutton"
                    className="link ba bl-0-l br2 br--right b--moon-gray bg-white hover-bg-light-blue"
                    onClick={e => this.activateQuery()}></button>
            </div>
            <div className="app-filters">
                <TimeGrid className="mb2" handleTime={(t) => this.handleTime(t)} current={query.time} time_filter_data={meta.time_filter_data} />
                <Select
                    className="mb2"
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
                <Select
                    className="mb2"
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
                {loggedIn && <label htmlFor="my-arxiv-checkbox">Recommended<input type="checkbox" checked={query.rec_lib} name="v1" id="my-arxiv-checkbox" onChange={(e) => this.setNextQuery({ rec_lib: e.target.checked }, () => this.activateQuery())} /></label>}
                {user !== "None" && <label>In library: <input type="checkbox" checked={query.only_lib} onChange={(event) => this.setNextQuery({ only_lib: event.target.checked }, () => this.activateQuery())} /></label>}
                <label htmlFor="v1-checkbox">v1 only: <input id="v1-checkbox" type="checkbox" checked={query.v1} onChange={(e) => this.setNextQuery({ v1: e.target.checked }, () => this.activateQuery())} /></label>
                <Tuning rt={query.rec_tuning} onChange={rt => this.setNextQuery({ rec_tuning: rt }, () => this.activateQuery())} />
            </div>
            <Infinite
                className="app-results ba br2 b--light-gray bg-white"
                pageStart={0}
                loadMore={() => this.handleLoadMore()}
                hasMore={!isDone}
                loader={<div key="loading" className="pa4 tc f3">Loading...</div>}
                threshold={500} >

                <div key="rtable">
                    {this.state.tot_num_papers && (<div className="bb pa4 b--black-10"><strong>{this.state.tot_num_papers.toLocaleString()}</strong> {this.state.tot_num_papers === 1 ? "result" : "results"}</div>)}
                    {papers.map((p, i) => <Paper p={p} key={p.pid}
                        onToggle={(on) => { let p = [...this.state.papers]; p[i].in_library = on; this.setState({ papers: p }) }}
                        onCategoryClick={(c) => this.handleCat(cats.addUnique(c))}
                        onAuthorClick={a => this.handleAuthor(a)}
                    />)}
                    {this.state.isDone && <h2 className="pa4 tc f3">no more results</h2>}
                </div>

            </Infinite>
        </div>
    }
}

class Tuning extends React.Component<{ rt: rec_tuning, onChange: (r: rec_tuning) => void }, { rt: rec_tuning }> {
    constructor(props) {
        super(props);
        this.state = { rt: props.rt }
    }
    componentWillReceiveProps(newProps: this["props"]) {
        if (newProps.rt !== this.state.rt) {
            this.setState({ rt: newProps.rt })
        }
    }
    handleChange(rt: rec_tuning) {
        this.setState({ rt });
    }
    render() {
        let rt = this.state.rt;
        let ch = (p1: keyof rec_tuning, p2?: keyof rec_tuning["weights"]) => (e) => this.handleChange(lens(rt, ...(p2 ? [p1, p2] : [p1]))(Number(e.target.value)) as any)
        return <div>
            <h3>Tuning</h3>
            <table>
                <tbody>
                    {/* <tr>
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
                        </tr> */}
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
                            onChange={(e) => this.handleChange(update(rt, { "minimum_should_match": e.target.value }))} />
                        </td>
                    </tr>
                    <tr>
                        <td>boost terms</td>
                        <td><input type="number" value={rt.boost_terms} onChange={ch("boost_terms")} /></td>
                    </tr>
                    <tr>
                        <td>pair fields</td>
                        <td><input type="checkbox" checked={rt.pair_fields} onChange={(e) => this.handleChange(update(rt, { "pair_fields": e.target.checked }))} /></td>
                    </tr>
                </tbody>
            </table>
            {this.props.rt !== rt && <button onClick={() => this.props.onChange(this.state.rt)}>Update!</button>}
        </div>
    }

}

const times = [
    { k: "day", d: "the last day", b: "day", r: "br2 br--left br--top " },
    { k: "3days", d: "the last three days", b: "3 days", r: "br0 " },
    { k: "week", d: "the last week", b: "week", r: "br2 br--right br--top " },
    { k: "month", d: "the last month", b: "month", r: "br2 br--left br--bottom " },
    { k: "year", d: "the last year", b: "year", r: "br0 " },
    { k: "alltime", d: "any time", b: "all time", r: "br2 br--right br--bottom " },
]

function TimeGrid({ handleTime, time_filter_data, current, className }) {
    const tf_data = (tf: timeFilter) => { let n = time_filter_data && time_filter_data[tf.toString()]; return n === undefined ? undefined : `(${n.toLocaleString()})` }
    return <div className={className}>
        <div className="bg-moon-gray b--moon-gray ba br2" style={{
            display: "grid", gridGap: "1px",
            gridTemplateRows: "40px 40px", gridTemplateColumns: "1fr 1fr 1fr",
            gridTemplateAreas: `"day 3days week" "month year alltime"`
        }}>
            {
                times.map(({ k, d, b, r }, i) => {
                    let n = time_filter_data && time_filter_data[k.toString()];
                    let has_meta = n !== undefined;

                    return (
                        <div key={k}
                            className={"link tc v-mid pv1 ph1 pointer pa1 hover-bg-light-blue " + (k === current ? "bg-lightest-blue checked " : "bg-near-white ") + r}
                            style={{ gridArea: k }}
                            title={`Show papers from ${d}`}
                            onClick={() => handleTime(k)}>
                            <div className="f6">{b}</div>
                            <div className={"f7 anim-opacity " + (has_meta ? "" : "hide ")}>{has_meta ? `(${n.toLocaleString()})` : ""}</div>
                        </div>
                    );
                })
            }
        </div>
    </div>
}

class LeaderBoard extends React.PureComponent<{ in_data?, primaryCategory, cats, handleCat }, { kvs: { k: string, v: number }[] }> {
    constructor(props) {
        super(props);
        this.state = { kvs: [] };
    }
    componentWillReceiveProps(newProps) {
        if (newProps.in_data !== undefined) {
            let kvs = toKeyValueArray(newProps.in_data)
                .filter(({ k }) => !is_ams(k) && k !== newProps.primaryCategory && !newProps.cats.exists(c => c === k))
                .sort((a, b) => b.v - a.v)
                .slice(0, 10)
            this.setState({ kvs });
        }
    }
    render() {
        let { in_data, primaryCategory, cats, handleCat } = this.props
        let { kvs } = this.state;
        return (
            <table style={{height:"24em", maxHeight:"24em", display : "block"}}>
                    {/* <CSSTransitionGroup
                        transitionName="leaderboard"
                        transitionEnterTimeout={500}
                        transitionLeaveTimeout={300}
                        component="tbody"
                        > */}
                    <tbody>
                        {(() => {
                            return kvs.map(({ k, v }) => <tr key={k}>
                                <td>
                                    <CatBadge
                                        onClick={() => {
                                            let i = cats.findIndex(k2 => k2 === k);
                                            if (i === -1) { handleCat([...cats, k as any]) }
                                            else { handleCat(cats.drop(i)) }
                                        }}
                                        cat={k} />
                                </td>
                                <td>{in_data && `(${v.toLocaleString()})`}</td>
                            </tr>)
                        })()}
                        </tbody>
                    {/* </CSSTransitionGroup> */}
            </table>
        )
    }

}
