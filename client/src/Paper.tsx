import { paper, category } from "./types";
import { notimpl, sendRequest } from "./basic";
import * as React from 'react';
import { Math } from './Math';
import { CatBadge } from "./CatBadge";
export function WithMaths(props: { text: string }) {
    let { text } = props;
    return <span>{text.split("$").map((s: string, i) => (i % 2 === 0) ? s : <Math latex={s} key={i} />)}</span>
}
let replacements = [
    {x: /\\'A/g, r : "Á"},
    {x: /\\'E/g, r : "É"},
    {x: /\\'I/g, r : "Í"},
    {x: /\\'O/g, r : "Ó"},
    {x: /\\'U/g, r : "Ú"},
    {x: /\\'a/g, r : "á"},
    {x: /\\'e/g, r : "é"},
    {x: /\\'i/g, r : "í"},
    {x: /\\'o/g, r : "ó"},
    {x: /\\'u/g, r : "ú"}, 

    {x: /\\"A/, r : 'Ä'},
    {x: /\\"E/, r : 'Ë'},
    {x: /\\"I/, r : 'Ï'},
    {x: /\\"O/, r : 'Ö'},
    {x: /\\"U/, r : 'Ü'},
    {x: /\\"a/, r : 'ä'},
    {x: /\\"e/, r : 'ë'},
    {x: /\\"i/, r : 'ï'},
    {x: /\\"o/, r : 'ö'},
    {x: /\\"u/, r : 'ü'}, 
    {x: /\\"y/, r : 'ÿ'}, 
];
export function Author(props : {a : string, onClick(a : string) : void}) {
    let {a, onClick} = props;
    let show = a;
    for (let {x,r} of replacements) {
        show = show.replace(x,r);
    }
    return <a className="f6 link maroon hover-ul" onClick={() => onClick(a)}>{show}</a>
}
//TODO: ÀÂÃÅÆÇÈÊÌÎÐÑÒÔÕØÙÛÝÞßàâãåæçèêìîðñòôõøùúûýþŒœŠšŸ
    
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
    return (
        <div className="bb pa4 b--light-gray" id={p.pid}>
            <div className="tr fr">
                <span className="mid-gray ma1 f6">{p.pid}</span>
                <a href={pdf_url} target="_blank">pdf</a>
                <br />
                <a href={`https://scirate.com/arxiv/${p.pid.split("v")[0]}`} style={{ color: "black" }} >scirate</a>
                <br />
                <img
                    src={p.in_library ? "static/saved.png" : "static/save.png"}
                    className="pointer ma1"
                    style={{ width: "24px", height: "24px" }}
                    title={p.in_library ? "unsave paper" : "save paper to library (requires login)"}
                    id={"lib" + p.pid}
                    onClick={() =>
                        sendRequest("libtoggle", { pid: p.pid }, ({ on }) => (on !== "FAIL") && props.onToggle(on))}
                />
            </div>
            <div className="paperdesc mr3">
                <a href={p.link} target="_blank" className="link b black hover-ul"> <WithMaths text={p.title} /></a>
                {p.score && [<span className="ma1 green f5" title={p.explain_sentence || ""}> Relevance: {p.score.toPrecision(3)}</span>]}
                <br />
                <span>
                    {p.authors.map((a: string) =>
                        <Author key={a} onClick={props.onAuthorClick} a={a}/>)
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

            {p.img !== undefined && <div className="animg"><Image src={p.img} /></div>}
            {p.abstract && <div className="f5 tj abstract"><WithMaths text={p.abstract} /></div>}
        </div>
    )
}