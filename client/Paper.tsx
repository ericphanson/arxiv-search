import { paper } from "./types";
import { notimpl } from "./basic";
import * as React from 'react'

export function Paper(props: { p: paper }) {
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
                p.tags.map(c => <a key={c} className="link-to-update" href={`/?in=${c.replace(/ /g, "+")}`}>{c}</a>).interlace(" | " as any)
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
        {p.img && <div className="animg"><img src={p.img} /></div>}
        {p.abstract && <div className="abstract"><span className="tt">{p.abstract}</span></div>}
    </div>
}