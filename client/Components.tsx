import { notimpl } from './basic';
import { paper, request, response, query } from './types';
import * as React from 'react';
//TODO webpack lets you 'import' images, css etc but it's a bit of a kludge.
// @ts-ignore
import saveImg from "./save.png";
// @ts-ignore
import savedImg from "./saved.png";

interface state {
    /**Query used to fetch papers. */
    currentQuery: query,
    papers: paper[],
    isLoading: boolean,
    error?: string
}
declare const results_url : string;
export class App extends React.Component<{}, state> {
    constructor(props) {
        super(props);
        this.state = {
            currentQuery: {
                query: "",
                category: [],
                time: "all",
                v1: false
            },
            papers: [],
            isLoading: true,
        }
    }
    componentDidMount() {
        this.onSearch(this.state.currentQuery);
    }
    onSearch(q: query) {
        this.setState({ currentQuery: q });
        let request: request = {
            query: q,
            start_at: 0,
            num_get: 10,
            dyn: false
        }
        let url = results_url;
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
                let p = [...this.state.papers];
                for (let i = 0; i < r.papers.length; i++) {
                    p[r.start_at + i] = r.papers[i];
                }
                this.setState({ papers: p , isLoading : false});
            })
    }
    render() {
        let { papers } = this.state;
        return [
            <SearchBox onSearch={(q) => this.onSearch(q)} />,
            <Papers ps={papers} done={false} />]
    }
}

class SearchBox extends React.Component<{ onSearch(q: query): void }, { searchString: string }> {
    constructor(props) {
        super(props);
        this.state = {
            searchString: ""
        }
    }
    handleOnSearch() {
        this.props.onSearch({
            query: this.state.searchString,
            category: [],
            time: "all",
            v1: false
        });
    }
    render() {
        let { onSearch } = this.props;
        let { searchString } = this.state;
        return <div className="sbox">
            <form>
                <input id="qfield" name="q" type="text" value={searchString}
                    onChange={e => this.setState({ searchString: e.target.value })}
                    onKeyDown={e => e.keyCode === 13 && onSearch && this.handleOnSearch()} />
                <button onClick={() => this.handleOnSearch()} >Search!</button>
            </form>
        </div>
    }
}


function Papers(props: { ps: paper[], done: boolean }) {
    let { ps, done } = props;
    let num = ps.length;
    return <div id="maindiv">
        <div id="rtable">
            {ps.map(p => <Paper p={p} />)}
        </div>
        {done && <div id="loadmore"> <button id="loadmorebtn">Load more...</button></div>}
    </div>
}

function Paper(props: { p: paper }) {
    let { p } = props
    let pdf_link = p.link.replace("abs", "pdf");
    let pdf_url = pdf_link === p.link ? pdf_link : pdf_link + ".pdf";
    return <div className="apaper" id={p.pid} key={p.pid}>
        {/* The below line has something to do with  " OpenURL COinS metadata element -- readable by Zotero, Mendeley, etc." */}
        {/* <span className="Z3988" title={build_ocoins_str(p)}></span> */}
        <div className="paperdesc">
            <span className="ts">
                <a href={p.link} target="_blank"> {p.title} </a>
            </span>
            <br />
            <span className="as">
                {p.authors.map((a: string) =>
                    <a href={`/search?q=${a.replace(/ /g, "+")}`}>{a}</a>)
                    .interlace(", " as any)}
            </span>
            <br />
            <span className="ds">{p.published_time}</span>
            {p.originally_published_time !== p.published_time
                ? <span className="ds2">(v1: {p.originally_published_time})</span>
                : undefined}
            <span className="cs">{
                p.tags.map(c => <a className="link-to-update" href={`/?in=${c.replace(/ /g, "+")}`}>{c}</a>).interlace(" | ")
            }</span>
            <br />
            <span className="ccs">{p.comment}</span>
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
            <img src={p.in_library ? savedImg : saveImg} className="save-icon" title="toggle save paper to library (requires login)" id={"lib" + p.pid} onClick={notimpl} />
        </div>
        <div style={{ clear: "both" }}></div>
        {p.img && <div className="animg"><img src={p.img} /></div>}
        {p.abstract && <div><span className="tt">{p.abstract}</span></div>}
    </div>
}