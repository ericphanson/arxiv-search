import * as React from 'react';
import { query, category, timeFilter } from './types';
import Select from 'react-select'

interface inTag { kind: "in", value: category, key: number }
interface primTag { kind: "prim", value: category, key: number }
interface textTag { kind: "text", value: string, key: number }
interface timeTag { kind: "time", value: timeFilter, error?: boolean, key: number }
interface sortTag { kind: "sort", value: sortTag, error?: boolean, key: number }
type tag = inTag | primTag | textTag | timeTag | sortTag
let tag_count = 1;

function Tag(t : tag) {

}

export class SearchEditor extends React.Component<{ tags: tag[] }, { focussed : boolean, position: number }> {
    onKeyDown(e) {

    }
    render() {
        let {position, focussed} = this.state;
        let {tags} = this.props
        let a : any[]
        if (focussed) {
            let left = tags.slice(0,position)
            let inp = <input type="text"/>
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
export class SearchBox extends React.Component<{ onSearch(q: query): void }, state> {
    constructor(props) {
        super(props);
        this.state = {
            searchString: "",
            sort: "date",
            prim: undefined,
            time: "all",
            cats: [],
            tags : []
        }
    }
    handleOnSearch() {
        this.props.onSearch({
            query: this.state.searchString,
            category: this.state.cats.map(c => [c.value]),
            time: this.state.time,
            v1: false,
            sort: this.state.sort,
            primaryCategory: this.state.prim as category
        });
    }
    render() {
        let { onSearch } = this.props;
        let { searchString, sort, prim } = this.state;
        let options = ["quant-ph", "quant-ducks", "hep-ex", "hep-lat", "hep-ph", "hep-th", "math-ph", "nucl-ex", "nucl-th"].map(x => ({ value: x, label: x, className: x }))
        options.push({ value: undefined, label: "none", className: "none" })

        const radio = (field, options) => options.map(o => <label><input type="radio" name={field} id={o} checked={this.state[field] === o} onChange={() =>  this.setState({ [field]: o }, () => this.handleOnSearch())} />{o}</label>)

        return <div>
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
                    {radio("time", ["day", "3days", "week", "month", "year", "all"])}
                </div>
                <div>
                    <h4>in:</h4>
                    <Select.Creatable multi={true} options={options} value={this.state.cats} onChange={cats => { this.setState({ cats }, () => this.handleOnSearch()) }} />
                </div>
            </div>
        </div>
    }
}