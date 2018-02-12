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
export class App extends React.Component<{}, state> {
    constructor(props) {
        super(props);
        this.state = {
            activeQuery: defaultQuery,
            nextQuery : defaultQuery,
            meta: { tot_num_papers: 0 },
            isDone: false,
            requestCount: 10,
            papers: [],
            isLoading: true,
        }
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
        let response = window.fetch(url, {
            method: "POST",
            body: JSON.stringify(request),
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin"
        })
        this.setState({ isLoading: true })
        //TODO update the state to a spinning wheel or something while the results are being loaded.
        response
            .then(
            response => response.ok ? response.json() : this.setState({ error: "couldn't connect to server." }),
            error => this.setState({ error: `Network error: ${error}` })
            )
            .then((r: response) => {
                let { dynamic, start_at, papers } = r;
                let p = [...this.state.papers];
                for (let i = 0; i < papers.length; i++) {
                    p[r.start_at + i] = papers[i];
                }
                this.setState({ papers: p, isLoading: false, isDone: papers.length < num_get, meta: r.meta });
            })
    }
    /**Replace activeQuery with nextQuery and fetch papers. */
    activateQuery() {
        this.setState({ activeQuery: this.state.nextQuery, requestCount: 10, papers: [], isDone: false }, () => this.getPapers());
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
        const tf_data = (tf: timeFilter) => {
            if (meta.time_filter_data === undefined) { return undefined; }
            let tf_data = meta.time_filter_data.find(x => x.time_range === tf);
            if (tf_data === undefined) { return undefined; }
            return `(${tf_data.num_results})`;
        }
        return <div className="app-root">
            <h1 className="logo app-banner">ARXIV-SEARCH</h1>
            <div className="app-searchbar">
                <input type="text" className="searchInput"
                    value={query.query}
                    onChange={e => this.handleQueryboxChange(e)}
                    onKeyDown={e => e.keyCode === 13 && this.activateQuery()} />
                <button id="qbutton" onClick={e => this.activateQuery()}></button>
            </div>
            <div className="app-filters">
                <div>
                    <h4>prim:</h4>
                </div>
                <div>
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
            {meta && (<p className="app-total"><strong>{meta.tot_num_papers}</strong> results</p>)}
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
