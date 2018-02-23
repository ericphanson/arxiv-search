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

class Image extends React.Component<any, { failed }> {
    constructor(props) {
        super(props);
        this.state = { failed: false };
    }
    fallback() {
        this.setState({ failed: true });
    }
    render() {
        let { fallbackSrc, src, ...rest } = this.props;
        if (this.state.failed) {
            if (fallbackSrc) {
                return <img src={fallbackSrc} {...rest} />;
            }
            else {
                return null;
            }
        } else {
            return <img src={src} onError={() => { console.log("image error"); this.fallback() }} {...rest} />;
        }
    }
}



export function Paper(props: { p: paper, onToggle: (on: boolean) => void, onCategoryClick: (cat: category) => void, onAuthorClick: (author: string) => void }) {
    let { p, onAuthorClick } = props
    let pdf_link = p.link.replace("abs", "pdf");
    let pdf_url = pdf_link === p.link ? pdf_link : pdf_link + ".pdf";
    return <div className="apaper bb pa4 b--black-10" id={p.pid}>
        {/* The below line has something to do with  " OpenURL COinS metadata element -- readable by Zotero, Mendeley, etc." */}
        {/* <span className="Z3988" title={build_ocoins_str(p)}></span> */}
        <div className="paperdesc mr3">
            <a href={p.link} target="_blank" className="link b black hover-ul"> <WithMaths text={p.title} /></a>
            {p.score && [<span className="ma1 green f5"> Relevance: {p.score.toPrecision(3)}</span>]}
            <br />
            <span>
                {p.authors.map((a: string) =>
                    <a key={a} className="f6 link maroon hover-ul" onClick={() => onAuthorClick(a)}>{a}</a>)
                    .interlace(", " as any)}
            </span>
            <br />
            <span title="publication date of latest version on arxiv.org" className="f6 mr1 purple">{p.published_time}</span>
            {p.originally_published_time !== p.published_time
                ? <span title="original publication date on arxiv.org" className="f6 light-purple mh1">(v1: {p.originally_published_time})</span>
                : undefined}
            <span>{
                p.tags.map(c =>
                    <CatBadge key={c} cat={c}
                        onClick={() => props.onCategoryClick(c)} />
                )
            }</span>
            {p.comment && <div title="comments from arxiv.org" className="f6 gray mb1">{p.comment}</div>}
        </div>
        <div className="tr dllinks">
            <span className="mid-gray ma1 f6">{p.pid}</span>
            <a href={pdf_url} target="_blank">pdf</a>
            <br/>
            <a href={`https://scirate.com/arxiv/${p.pid.split("v")[0]}`} style={{ color: "black" }} >scirate</a>
            <br/>
            <img
                src={p.in_library ? "static/saved.png" : "static/save.png"}
                className="pointer ma1"
                style={{width : "24px", height : "24px"}}
                title={p.in_library ? "unsave paper" : "save paper to library (requires login)"}
                id={"lib" + p.pid}
                onClick={() =>
                    sendRequest("libtoggle", { pid: p.pid }, ({ on }) => (on !== "FAIL") && props.onToggle(on))}
            />
        </div>
        {p.img !== undefined && (p.havethumb === undefined || p.havethumb === true) && <div className="animg"><Image src={p.img} /></div>}
        {p.abstract && <div className="f5 tj abstract"><WithMaths text={p.abstract} /></div>}
    </div>
}