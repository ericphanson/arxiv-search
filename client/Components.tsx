import { notimpl } from './basic';
import { paper, request, response, query } from './types';
import * as React from 'react';
import * as Infinite from 'react-infinite-scroller';
import { SearchBox } from './SearchBox';

interface state {
    /**Query used to fetch papers. */
    currentQuery: query,
    papers: paper[],
    /**The number of papers that should be visible */
    requestCount : number,
    isLoading: boolean,
    error?: string,
    isDone : boolean
}
declare const beta_results_url : string;
export class App extends React.Component<{}, state> {
    constructor(props) {
        super(props);
        this.state = {
            currentQuery: {
                query: "",
                category: [],
                time: "all",
                v1: false,
            },
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
                this.setState({ papers: p , isLoading : false, isDone : papers.length < num_get});
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
        let { papers, isDone, isLoading } = this.state;
        return [
            <SearchBox onSearch={(q) => this.onSearch(q)} />,
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

function Paper(props: { p: paper }) {
    let { p } = props
    let pdf_link = p.link.replace("abs", "pdf");
    let pdf_url = pdf_link === p.link ? pdf_link : pdf_link + ".pdf";
    return <div className="apaper" id={p.pid}>
        {/* The below line has something to do with  " OpenURL COinS metadata element -- readable by Zotero, Mendeley, etc." */}
        {/* <span className="Z3988" title={build_ocoins_str(p)}></span> */}
        <div className="paperdesc">
            <span className="ts">
                <a href={p.link} target="_blank"> {p.title} </a>
            </span>
            <br/>
            <span className="as">
                {p.authors.map((a: string) =>
                    <a key={a} href={`/search?q=${a.replace(/ /g, "+")}`}>{a}</a>)
                    .interlace(", " as any)}
            </span>
            <br/>
            <span className="ds">{p.published_time}</span>
            {p.originally_published_time !== p.published_time
                ? <span className="ds2">(v1: {p.originally_published_time})</span>
                : undefined}
            <span className="cs">{
                p.tags.map(c => <a key={c} className="link-to-update" href={`/?in=${c.replace(/ /g, "+")}`}>{c}</a>).interlace(" | ")
            }</span>
        </div>
        <div className="dllinks">
            <span className="spid">{p.pid}</span>
            <a href={pdf_url} target="_blank">pdf</a>
            <br />
            <span className="sim" id={'sim' + p.pid} onClick={notimpl}>show similar</span>
            <span className="sim" style={{ marginLeft: "5px", paddingLeft: "5px", borderLeft: "1px solid black" }}>
                <a href={`https://scirate.com/arxiv/${p.pid.split("v")[0]}`} style={{ color: "black" }}>scirate</a>
            </span>
            <br />
            <img src={p.in_library ? "static/save.png" : "static/saved.png"} className="save-icon" title="toggle save paper to library (requires login)" id={"lib" + p.pid} onClick={notimpl} />
        </div>
        <div style={{ clear: "both" }}></div>
        {p.img && <div className="animg"><img src={p.img} /></div>}
        {p.abstract && <div><span className="tt">{p.abstract}</span></div>}
    </div>
}