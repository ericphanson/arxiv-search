import * as React from 'react';
import { query, category } from './types';
import  Select from 'react-select'

interface state {
    searchString: string,
    sort: query["sort"],
    prim : undefined | string,
    time : query["time"]
}
export class SearchBox extends React.Component<{ onSearch(q: query): void }, state> {
    constructor(props) {
        super(props);
        this.state = {
            searchString: "",
            sort: "date",
            prim : undefined,
            time : "all"
        }
    }
    handleOnSearch() {
        this.props.onSearch({
            query: this.state.searchString,
            category: [],
            time: this.state.time,
            v1: false,
            sort: this.state.sort,
            primaryCategory : this.state.prim as category
        });
    }
    render() {
        let { onSearch } = this.props;
        let { searchString, sort, prim } = this.state;
        let options = ["quant-ph", "quant-ducks", "hep-ex", "hep-lat", "hep-ph", "hep-th", "math-ph", "nucl-ex", "nucl-th"].map(x => ({value:x, label : x, className:x}))
        options.push({value : undefined, label : "none", className : "none"})

        const radio = (field, options) => options.map(o => <label><input type="radio" name={field} id={o} checked={this.state[field] === o} onChange={() => this.setState({[field] : o}, () => this.handleOnSearch())}/>{o}</label>)

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
                    {radio("sort",["date", "relevance"])}
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
                        onChange={(selected) => {this.setState({prim : selected},() => this.handleOnSearch())}}
                    />
                </div>
                <div>
                    <h4>time:</h4>
                    {radio("time", ["day", "3days", "week", "month", "year", "all"])}
                </div>
            </div>
        </div>
    }
}