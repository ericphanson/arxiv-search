import * as React from 'react';
import { query, category } from './types';
import  Select from 'react-select'

interface state {
    searchString: string,
    sort: "relevance" | "date",
    prim : undefined | string
}
export class SearchBox extends React.Component<{ onSearch(q: query): void }, state> {
    constructor(props) {
        super(props);
        this.state = {
            searchString: "",
            sort: "date",
            prim : undefined
        }
    }
    handleOnSearch() {
        this.props.onSearch({
            query: this.state.searchString,
            category: [],
            time: "all",
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
                    <label> <input type="radio" name="sort" id="date" checked={sort === "date"} onChange={() => this.setState({sort : "date"})} /> date </label>
                    <label> <input type="radio" name="sort" id="relevance" checked={sort === "relevance"}  onChange={() => this.setState({sort : "relevance"})}/> relevance </label>
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
            </div>
        </div>
    }
}