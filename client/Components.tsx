import {notimpl} from './basic';
import {paper} from './types';
import * as React from 'react';

interface state {
    query : string,
    papers : paper[]
}

class App extends React.Component<{},state> {
    onQueryChange(query) {
        this.setState({query});
    }
    render() {
        let {query, papers} = this.state;
        return [
            <SearchBox query={query} onQueryChange={this.onQueryChange.bind(this)}/>,
            <Papers papers={papers}/>]
    }
}

function SearchBox(props : {query : string, onQueryChange(q : string) : void}) {
    let {query, onQueryChange} = props;
    return <div className="sbox">
        <form>
            <input id="qfield" name="q" type="text" value={query} onChange={onQueryChange} />
        </form>
        <div id="search_hint"></div>
    </div>
}

function Papers(props : {ps : paper[], done : boolean}) {
    let {ps, done} = props;
    let num = ps.length;
    return <div id="maindiv">
        <div id="rtable">
        {ps.map(p => <Paper p={p}/>)}
        </div>
        {done && <div id="loadmore"> <button id="loadmorebtn">Load more...</button></div>}
    </div>
}

function Paper(props : {p : paper}) {
    let {p} = props
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
                    .interlace(", ")}
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
            <span className="sim" id={'sim' + p.pid} onclick={notimpl}>show similar</span>
            <span className="sim" style="margin-left:5px; padding-left: 5px; border-left: 1px solid black;">
                <a href={`https://scirate.com/arxiv/${strip_version(p.pid)}`} style={{ color: "black" }}>scirate</a>
            </span>
            <br />
            <img src={p.in_library ? 'static/saved.png' : 'static/save.png'} className="save-icon" title="toggle save paper to library (requires login)" id={"lib" + p.pid} onclick={notimpl} />
        </div>
        <div style="clear:both;"></div>
        {p.img && <div className="animg"><img src={p.img} /></div>}
        {p.abstract && <div><span className="tt">{p.abstract}</span></div>}
    </div>
}