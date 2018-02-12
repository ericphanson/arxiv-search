import { notimpl } from './basic';
import { paper, request, response, query, meta } from './types';
import * as React from 'react';
import * as Infinite from 'react-infinite-scroller';
import { SearchBox } from './SearchBox';
import {Paper} from './Paper';
interface state {
    /**Query used to fetch papers. */
    currentQuery: query,
    papers: paper[],
    /**The number of papers that should be visible */
    requestCount : number,
    isLoading: boolean,
    error?: string,
    isDone : boolean
    meta? : meta
}
declare const beta_results_url : string;
export class App extends React.Component<{}, state> {
    constructor(props) {
        super(props);
        this.state = {
            currentQuery: {
                query: "",
                category: [],
                time: "alltime",
                v1: false,
                only_lib: false,
            },
            meta : undefined,
            isDone : false,
            requestCount : 10,
            papers: [],
            isLoading: true,
        }
    }
    componentDidMount() {
        this.onSearch(this.state.currentQuery);
    }
    getPapers() {
        let num_get = this.state.requestCount - this.state.papers.length
        let request: request = {
            query: this.state.currentQuery,
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
        this.setState({isLoading : true})
        //TODO update the state to a spinning wheel or something while the results are being loaded.
        response
            .then(
            response => response.ok ? response.json() : this.setState({ error: "couldn't connect to server." }),
            error => this.setState({ error: `Network error: ${error}` })
            )
            .then((r: response) => {
                let {dynamic, start_at,  papers} = r;
                let p = [...this.state.papers];
                for (let i = 0; i < papers.length; i++) {
                    p[r.start_at + i] = papers[i];
                }
                this.setState({ papers: p , isLoading : false, isDone : papers.length < num_get, meta:r.meta});
            })
    }
    onSearch(q: query) {
        this.setState({ currentQuery: q, requestCount : 10, papers : [], isDone : false }, () => this.getPapers());
    }
    onLoadMore() {
        if (this.state.isLoading || this.state.isDone) {return;}
        console.log("loadmore called");
        this.setState({requestCount : this.state.requestCount + 10}, () => this.getPapers());
    }
    render() {
        let { papers, isDone, isLoading, meta } = this.state;
        return [
            <SearchBox onSearch={(q) => this.onSearch(q)} meta={meta}/>,
            meta && (<p><strong>{meta.tot_num_papers}</strong> results</p>),
            <Infinite
                pageStart={0}
                loadMore={() => this.onLoadMore()}
                hasMore={!isDone}
                loader={<div>Loading...</div>}
                threshold={500} >
                <div id="maindiv">
                    <div id="rtable">
                    {papers.map(p => <Paper p={p} key={p.pid}/>)}
                    </div>
                </div>
            </Infinite>
        ]
    }
}
