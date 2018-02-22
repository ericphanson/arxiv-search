import { cat_col, cat_desc } from "./categories";
import * as React from 'react';
export function CatBadge({onClick, cat}) {
    let {bg,dark} = cat_col(cat);
    return <a 
        className="badge" 
        style={{backgroundColor:bg, color : dark ? "black" : "white"}} 
        onClick={onClick} 
        title={cat_desc(cat)}>{cat}</a>
}