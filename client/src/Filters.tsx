import { timeFilter, category, query } from "./types";
import * as React from 'react';
import * as Select from 'react-select';
import {Categories} from './categories';
import {LeaderBoard} from './LeaderBoard';
import {Tuning} from './Tuning';

let timeFilters = ["day", "3days", "week", "month", "year", "alltime"] as timeFilter[]
let categories = [];
Categories.all_categories_promise.then(ac => {
    categories = ac.map(x => ({ value: x.c, label: x.c, desc: x.d }));
})
interface props {
    onQueryUpdate? : (q : Partial<query>) => void
    query : query,
    meta
    loggedIn,
    user
}
interface state {

}
export class Filters extends React.Component<props,state> {

    handlePrimCat(cat: category) { this.props.onQueryUpdate({ primaryCategory: cat }) }
    handleCat(andCats: category[]) { this.props.onQueryUpdate({ category: andCats.map(x => [x]) }) }
    handleAuthor(a: string) { this.props.onQueryUpdate({ query: a }) }
    handleTime(tf: timeFilter) { this.props.onQueryUpdate({ time: tf }) }
    render() {
        let {query, meta, loggedIn, user} = this.props;
        let cats = query.category.map(x => x[0]);
        return <div className="app-filters">
        <TimeGrid 
        className="mb2" 
        handleTime={(t) => this.handleTime(t)} current={query.time} time_filter_data={meta.time_filter_data} />
        <Select
            className="mb2"
            onBlurResetsInput={false}
            onSelectResetsInput={false}
            placeholder="primary category"
            options={categories as any}
            simpleValue
            clearable={true}
            name="prim"
            value={query.primaryCategory || ""}
            searchable={true}
            onChange={(selected: any) => this.handlePrimCat(selected)} />
        <Select
            className="mb2"
            onBlurResetsInput={false}
            onSelectResetsInput={false}
            placeholder="categories"
            options={categories as any}
            simpleValue
            clearable={true}
            name="categories"
            value={cats}
            searchable={true}
            multisetNextQuery
            setNextQuery
            onChange={(selected: any) => this.handleCat(selected.split(","))} />
        <LeaderBoard
            cats={cats}
            in_data={meta.in_data}
            primaryCategory={query.primaryCategory}
            handleCat={x => this.handleCat(x)} />
        {loggedIn &&
            <label htmlFor="my-arxiv-checkbox">
                Recommended
            <input
                    type="checkbox"
                    checked={query.rec_lib}
                    name="v1"
                    id="my-arxiv-checkbox"
                    onChange={(e) => this.props.onQueryUpdate({ rec_lib: e.target.checked })} />
            </label>
        }
        {user !== "None" &&
            <label>In library:
                <input
                    type="checkbox"
                    checked={query.only_lib}
                    onChange={(event) => this.props.onQueryUpdate({ only_lib: event.target.checked })} />
            </label>
        }
        <label htmlFor="v1-checkbox">
            v1 only:
        <input
                id="v1-checkbox"
                type="checkbox"
                checked={query.v1}
                onChange={(e) => this.props.onQueryUpdate({ v1: e.target.checked })} />
        </label>
        <Tuning rt={query.rec_tuning} onChange={rt => this.props.onQueryUpdate({ rec_tuning: rt })} />
    </div>
    }
}


const times = [
    { k: "day", d: "the last day", b: "day", r: "br2 br--left br--top " },
    { k: "3days", d: "the last three days", b: "3 days", r: "br0 " },
    { k: "week", d: "the last week", b: "week", r: "br2 br--right br--top " },
    { k: "month", d: "the last month", b: "month", r: "br2 br--left br--bottom " },
    { k: "year", d: "the last year", b: "year", r: "br0 " },
    { k: "alltime", d: "any time", b: "all time", r: "br2 br--right br--bottom " },
]

function TimeGrid({ handleTime, time_filter_data, current, className }) {
    const tf_data = (tf: timeFilter) => { let n = time_filter_data && time_filter_data[tf.toString()]; return n === undefined ? undefined : `(${n.toLocaleString()})` }
    return <div className={className}>
        <div className="bg-moon-gray b--moon-gray ba br2" style={{
            display: "grid", gridGap: "1px",
            gridTemplateRows: "40px 40px", gridTemplateColumns: "1fr 1fr 1fr",
            gridTemplateAreas: `"day 3days week" "month year alltime"`
        }}>
            {
                times.map(({ k, d, b, r }, i) => {
                    let n = time_filter_data && time_filter_data[k.toString()];
                    let has_meta = n !== undefined;

                    return (
                        <div key={k}
                            className={"link tc v-mid pv1 ph1 pointer pa1 hover-bg-light-blue " + (k === current ? "bg-lightest-blue checked " : "bg-near-white ") + r}
                            style={{ gridArea: k }}
                            title={`Show papers from ${d}`}
                            onClick={() => handleTime(k)}>
                            <div className="f6">{b}</div>
                            <div className={"f7 anim-opacity " + (has_meta ? "" : "hide ")}>{has_meta ? `(${n.toLocaleString()})` : ""}</div>
                        </div>
                    );
                })
            }
        </div>
    </div>
}
