import { cat_col, cat_desc } from "./categories";
import * as React from 'react';
export function CatBadge({onClick, cat}) {
    return <a className="badge" style={{backgroundColor:cat_col(cat)}} onClick={onClick} title={cat_desc(cat)}>{cat}</a>
}