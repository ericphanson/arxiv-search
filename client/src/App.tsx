import { notimpl, sendRequest, update, lens, toKeyValueArray } from './basic';
import { paper, request, response, query, meta, timeFilter, category, rec_tuning } from './types';
import * as React from 'react';
import { InfiniteScroll as Infinite } from './Infinite';
import { Paper } from './Paper';
import { BrowserRouter as Router, Route, Link } from 'react-router-dom';
import { Filters } from './Filters';

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


function AppHeader(props) {
    return (
        <header className="bg-maroon">
            <div className="container">
                <nav className="ma1 flex justify-between">
                    <div className="di">
                        <h1 className="ma2 white f3">ARXIV-SEARCH.COM</h1>
                        <h2 className="ma1 f5 white">Based on <a className="link white" href="http://arxiv-sanity.com">arxiv-sanity</a> built by <a className="link white" href="https://twitter.com/karpathy">@karpathy</a></h2>
                    </div>
                    {
                        user === "None" ?
                            (<form action="login" method="post" className="f5 mv2">
                                <input className="ba bw1 b--white br2 dib pa2 ma1" type="text" name="username" placeholder="Username" />
                                <input className="ba bw1 b--white br2 dib pa2 ma1" type="password" name="password" placeholder="Password" />
                                <input type="submit" value="Login or Create"
                                    className="ma1 link white ba bw1 b--white bg-transparent br2 pointer dib b tc v-mid pa2 pointer hover-bg-dark-red" />
                            </form>)
                            :
                            <span className="ma2">
                                <span style={{ fontWeight: 700, color: "white" }}>Hello, {username}</span>
                                <a href="logout" className="link white ba bw1 b--white bg-transparent br2 pointer dib b tc v-mid pa2 pointer hover-bg-dark-red" style={{ marginLeft: "16px" }}>log out</a>
                            </span>
                    }
                </nav>
            </div>
        </header>
    )
}

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

    handleFilterQueryUpdate(q: Partial<query>) { this.setNextQuery(q, () => this.activateQuery()) }
    render() {
        let { papers, isDone, isLoading, meta, nextQuery: query } = this.state;
        let loggedIn = user !== "None"
        let cats = query.category.map(x => x[0]);
        return (
            <div className="helvetica bg-washed-yellow">
                <AppHeader />
                <section>
                    <div className="container maingrid">
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
                        <Filters loggedIn={loggedIn} user={user} query={query} meta={meta} onQueryUpdate={(q) => this.handleFilterQueryUpdate(q)} />
                        <Infinite
                            className="app-results ba br2 b--light-gray bg-white"
                            pageStart={0}
                            loadMore={() => this.handleLoadMore()}
                            hasMore={!isDone}
                            loader={<div key="loading" className="pa4 tc f3">Loading...</div>}
                            threshold={500} >
                            <div key="rtable">
                                {this.state.tot_num_papers && (
                                    <div className="bb pa4 b--black-10">
                                        <strong>
                                            {this.state.tot_num_papers.toLocaleString()}
                                        </strong>
                                        {this.state.tot_num_papers === 1 ? "result" : "results"}
                                    </div>)}
                                {papers.map((p, i) => <Paper p={p} key={p.pid}
                                    onToggle={(on) => { let p = [...this.state.papers]; p[i].in_library = on; this.setState({ papers: p }) }}
                                    onCategoryClick={(c) => this.handleFilterQueryUpdate({ "category": cats.addUnique(c).map(x => [x]) })}
                                    onAuthorClick={a => this.handleFilterQueryUpdate({ "author": a })}
                                />)}
                                {this.state.isDone && <h2 className="pa4 tc f3">no more results</h2>}
                            </div>
                        </Infinite>
                    </div>
                </section>
            </div>
        )
    }
}



