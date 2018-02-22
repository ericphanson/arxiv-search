import { paper, category } from "./types";
import { notimpl, sendRequest } from "./basic";
import * as React from 'react';
import { cat_col, cat_desc } from "./categories";
import { Math } from './Math';
import { CatBadge } from "./CatBadge";
export function WithMaths(props: { text: string }) {
    let { text } = props;
    return <span>{text.split("$").map((s: string, i) => (i % 2 === 0) ? s : <Math latex={s} key={i} />)}</span>
}

export function Paper(props: { p: paper, onToggle: (on: boolean) => void, onCategoryClick: (cat: category) => void, onAuthorClick: (author : string) => void }) {
    let { p, onAuthorClick } = props
    let pdf_link = p.link.replace("abs", "pdf");
    let pdf_url = pdf_link === p.link ? pdf_link : pdf_link + ".pdf";
    return <div className="apaper" id={p.pid}>
        {/* The below line has something to do with  " OpenURL COinS metadata element -- readable by Zotero, Mendeley, etc." */}
        {/* <span className="Z3988" title={build_ocoins_str(p)}></span> */}
        <div className="paperdesc">
            <span className="ts">
                <a href={p.link} target="_blank"> <WithMaths text={p.title} /></a>
            </span>
            {p.score && [<span className="ds2"> Relevance: {p.score.toPrecision(3)}</span>]}
            <br />
            <span className="as">
                {p.authors.map((a: string) =>
                    <a key={a} onClick={() => onAuthorClick(a)}>{a}</a>)
                    .interlace(", " as any)}
            </span>
            <br />
            <span title="publication date of latest version on arxiv.org" className="ds">{p.published_time}</span>
            {p.originally_published_time !== p.published_time
                ? <span title="original publication date on arxiv.org" className="ds2">(v1: {p.originally_published_time})</span>
                : undefined}
            <span className="cs">{
                p.tags.map(c =>
                    <CatBadge key={c} cat={c}
                        onClick={() => props.onCategoryClick(c)}/>
                        )
            }</span>
            <br/>
            {p.comment && <span title="comments from arxiv.org" className="paper-comment">{p.comment}</span>}
        </div>
        <div className="dllinks">
            <span className="spid">{p.pid}</span>
            <a href={pdf_url} target="_blank">pdf</a>
            <br />
            <a href={`https://scirate.com/arxiv/${p.pid.split("v")[0]}`} style={{ color: "black" }} >scirate</a>
            <br />
            <img
                src={p.in_library ? "static/saved.png" : "static/save.png"}
                className="save-icon"
                title={p.in_library ? "unsave paper" : "save paper to library (requires login)"}
                id={"lib" + p.pid}
                onClick={() =>
                    sendRequest("libtoggle", { pid: p.pid }, ({ on }) => (on !== "FAIL") && props.onToggle(on))}
            />
        </div>
        {p.img !== undefined && (p.havethumb === undefined || p.havethumb === true) && <div className="animg"><img src={p.img} /></div>}
        {p.abstract && <div className="abstract"><WithMaths text={p.abstract} /></div>}
    </div>
}