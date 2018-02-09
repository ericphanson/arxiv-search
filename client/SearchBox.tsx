import * as React from 'react';
import { query } from './types';

export class SearchBox extends React.Component<{ onSearch(q: query): void }, { searchString: string }> {
    constructor(props) {
        super(props);
        this.state = {
            searchString: ""
        }
    }
    handleOnSearch() {
        this.props.onSearch({
            query: this.state.searchString,
            category: [],
            time: "all",
            v1: false
        });
    }
    render() {
        let { onSearch } = this.props;
        let { searchString } = this.state;
        return <div>
            <div id="sbox">
                    <input id="qfield" type="text" value={searchString}
                        onChange={e => this.setState({ searchString: e.target.value })}
                        onKeyDown={e => e.keyCode === 13 && onSearch && this.handleOnSearch()} />
            </div>
        </div>
    }
}