import * as React from 'react';
import { query, category, timeFilter, meta } from './types';
import Select from 'react-select'
import { all_categories } from './all_categories'
interface inTag { kind: "in", value: category, key: number }
interface primTag { kind: "prim", value: category, key: number }
interface textTag { kind: "text", value: string, key: number }
interface timeTag { kind: "time", value: timeFilter, error?: boolean, key: number }
interface sortTag { kind: "sort", value: sortTag, error?: boolean, key: number }
type tag = inTag | primTag | textTag | timeTag | sortTag
let tag_count = 1;

function Tag(t: tag) {

}

export class SearchEditor extends React.Component<{ tags: tag[] }, { focussed: boolean, position: number }> {
    onKeyDown(e) {

    }
    render() {
        let { position, focussed } = this.state;
        let { tags } = this.props
        let a: any[]
        if (focussed) {
            let left = tags.slice(0, position)
            let inp = <input type="text" />
            let right = tags.slice(position);
            a = [...left, inp, ...right]
        }
        return <div>

        </div>
    }
}

interface state {
    searchString: string,
    sort: query["sort"],
    prim: undefined | string,
    time: query["time"],
    cats: any[],
    tags: tag[]
}
let category_options = all_categories.map(x => ({ value: x, label: x }))
let timeFilters = ["day", "3days", "week", "month", "year", "alltime"] as timeFilter[]
export class SearchBox extends React.Component<{ onSearch(q: query): void, meta?: meta }, state> {
    constructor(props) {
        super(props);
        this.state = {
            searchString: "",
            sort: "date",
            prim: undefined,
            time: "alltime",
            cats: [],
            tags: []
        }
    }
    handleOnSearch() {
        this.props.onSearch({
            query: this.state.searchString,
            category: this.state.cats.map(c => [c.value]),
            time: this.state.time,
            v1: false,
            sort: this.state.sort,
            primaryCategory: this.state.prim as category,
            only_lib: false
        });
    }
    handleTime(tf : timeFilter) {
        this.setState({time : tf}, () => this.handleOnSearch())
    }
    render() {
        let { onSearch, meta } = this.props;
        let { searchString, sort, prim } = this.state;
        let options = category_options;
        const radio = (field, options) => options.map(o => <label><input type="radio" name={field} id={o} checked={this.state[field] === o} onChange={() => this.setState({ [field]: o }, () => this.handleOnSearch())} />{o}</label>)

        const tf_data = (tf: timeFilter) => {
            if (meta === undefined || meta.time_filter_data === undefined) { return undefined; }
            let tf_data = meta.time_filter_data.find(x => x.time_range === tf);
            if (tf_data === undefined) { return undefined; }
            return `(${tf_data.num_results})`;
        }

        return <div className="search">
            <div id="sbox">
                <input id="qfield" type="text" value={searchString}
                    onChange={e => this.setState({ searchString: e.target.value })}
                    onKeyDown={e => e.keyCode === 13 && onSearch && this.handleOnSearch()} />
            </div>
            <h3>Advanced Search</h3>
            <div>
                <div>
                    <h4>sort:</h4>
                    {radio("sort", ["date", "relevance"])}
                </div>
                <div>
                    <h4>prim:</h4>
                    <p>Filter by primary category.</p>
                    <Select
                        onBlurResetsInput={false}
                        onSelectResetsInput={false}
                        options={options}
                        simpleValue
                        clearable={true}
                        name="prim"
                        value={prim}
                        searchable={true}
                        onChange={(selected) => { this.setState({ prim: selected }, () => this.handleOnSearch()) }}
                    />
                </div>
                <div>
                    <h4>time:</h4>
                    <table>
                        {timeFilters.map(tf => <tr key={tf.toString()}>
                            <td onClick={() => this.handleTime(tf)}>
                                <input type="radio" name="time"
                                    checked={this.state.time === tf} />
                                {tf.toString()}
                            </td>
                            <td>{tf_data(tf)}</td>
                        </tr>)}
                    </table>
                </div>
                <div>
                    <h4>in:</h4>
                    <Select.Creatable multi={true} options={options} value={this.state.cats} onChange={cats => { this.setState({ cats }, () => this.handleOnSearch()) }} />
                </div>
            </div>
        </div>
    }
}