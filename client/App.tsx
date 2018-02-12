import { notimpl } from './basic';
import { paper, request, response, query, meta, category, timeFilter } from './types';
import * as React from 'react';
import * as Infinite from 'react-infinite-scroller';
import { SearchBox } from './SearchBox';
import { Paper } from './Paper';
interface state {
    papers: paper[],
    /**The number of papers that should be visible */
    requestCount: number,
    isLoading: boolean,
    error?: string,
    isDone: boolean
    meta: meta,
    /**Query used to fetch results */
    activeQuery: query
    /**Query currently being edited. */
    nextQuery : query
}
let timeFilters = ["day", "3days", "week", "month", "year", "alltime"] as timeFilter[]
const defaultQuery : query = {
    query: "",
    category: [],
    v1: false,
    only_lib: false,
    time: "alltime"
}
declare const beta_results_url: string;

function sendRequest(url : string, request, callback : (response : any) => void) {
    window.fetch(url,  {
        method: "POST",
        body: JSON.stringify(request),
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin"
    }).then(
        response => response.ok ? response.json() : console.log("couldn't connect to server."),
        error => console.log(`Network error: ${error}`)
        ).then(callback);
}

export class App extends React.Component<{}, state> {
    constructor(props) {
        super(props);
        this.state = {
            activeQuery: defaultQuery,
            nextQuery : defaultQuery,
            meta: { },
            isDone: false,
            requestCount: 10,
            papers: [],
            isLoading: true,
        }
    }
    componentDidMount() {
        this.activateQuery();
    }
    getPapers() {
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
            let { dynamic, start_at, papers } = r;
            let p = [...this.state.papers];
            for (let i = 0; i < papers.length; i++) {
                p[r.start_at + i] = papers[i];
            }
            this.setState({ papers: p, isLoading: false, isDone: papers.length < num_get, meta: r.meta });
        });
    }
    /**Replace activeQuery with nextQuery and fetch papers. */
    activateQuery() {
        this.setState({ activeQuery: this.state.nextQuery, requestCount: 10, papers: [], isDone: false }, () => {
            this.getPapers();
            let request = {query : this.state.activeQuery};
            sendRequest("_getmeta", request, (meta : Partial<meta>) => this.setState({meta: {...this.state.meta, ...meta}}));
            sendRequest("_getslowmeta", request, (meta : Partial<meta>) => this.setState({meta: {...this.state.meta, ...meta}}));
        });
    }
    setNextQuery(query : Partial<query>, callback?) {
        this.setState({nextQuery : {...this.state.nextQuery, ...query}}, callback);
    }
    handleQueryboxChange(event) {
        this.setNextQuery({query:event.target.value});
    }
    handleLoadMore() {
        if (this.state.isLoading || this.state.isDone) { return; }
        console.log("loadmore called");
        this.setState({ requestCount: this.state.requestCount + 10 }, () => this.getPapers());
    }
    handleTime(tf: timeFilter) { this.setNextQuery({ time: tf }, () => this.activateQuery())}
    render() {
        let { papers, isDone, isLoading, meta, nextQuery:query } = this.state;
        const tf_data = (tf: timeFilter) => {let n = meta.time_filter_data && meta.time_filter_data[tf.toString()]; return n === undefined ? undefined : `(${n})`}
        return <div className="app-root">
            <h1 className="logo app-banner">ARXIV-SEARCH</h1>
            <div className="app-searchbar">
                <input type="text" className="searchinput"
                    value={query.query}
                    onChange={e => this.handleQueryboxChange(e)}
                    onKeyDown={e => e.keyCode === 13 && this.activateQuery()} />
                <button id="qbutton" onClick={e => this.activateQuery()}></button>
            </div>
            <div className="app-filters">
                <div>
                    {meta && (<p className="app-total"><strong>{meta.tot_num_papers}</strong> results</p>)}
                    <h4>time:</h4>
                    <table>
                        <tbody>
                            {timeFilters.map(tf => <tr key={tf.toString()}>
                                <td onClick={() => this.handleTime(tf)}>
                                    <input type="radio" name="time"
                                        checked={query.time === tf} />
                                    {tf.toString()}
                                </td>
                                <td className="result-count">{tf_data(tf)}</td>
                            </tr>)}
                        </tbody>
                    </table>
                </div>
            </div>
            <Infinite
                className="app-results"
                pageStart={0}
                loadMore={() => this.handleLoadMore()}
                hasMore={!isDone}
                loader={<div>Loading...</div>}
                threshold={500} >
                <div id="maindiv">
                    <div id="rtable">
                        {papers.map(p => <Paper p={p} key={p.pid} />)}
                    </div>
                </div>
            </Infinite>
        </div>
    }
}
