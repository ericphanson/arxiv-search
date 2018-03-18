import { toKeyValueArray } from "./basic";
import {is_ams} from './categories';
import * as React from 'react';
import {CatBadge} from './CatBadge';

export class LeaderBoard extends React.PureComponent<{ in_data?, primaryCategory, cats, handleCat }, { kvs: { k: string, v: number }[] }> {
    constructor(props) {
        super(props);
        this.state = { kvs: [] };
    }
    componentWillReceiveProps(newProps) {
        if (newProps.in_data !== undefined) {
            let kvs = toKeyValueArray(newProps.in_data)
                .filter(({ k }) => !is_ams(k) && k !== newProps.primaryCategory && !newProps.cats.exists(c => c === k))
                .sort((a, b) => b.v - a.v)
                .slice(0, 10)
            this.setState({ kvs });
        }
    }
    render() {
        let { in_data, primaryCategory, cats, handleCat } = this.props
        let { kvs } = this.state;
        return (
            <table style={{ height: "24em", maxHeight: "24em", display: "block" }}>
                {/* <CSSTransitionGroup
                        transitionName="leaderboard"
                        transitionEnterTimeout={500}
                        transitionLeaveTimeout={300}
                        component="tbody"
                        > */}
                <tbody>
                    {(() => {
                        return kvs.map(({ k, v }) => <tr key={k}>
                            <td>
                                <CatBadge
                                    onClick={() => {
                                        let i = cats.findIndex(k2 => k2 === k);
                                        if (i === -1) { handleCat([...cats, k as any]) }
                                        else { handleCat(cats.drop(i)) }
                                    }}
                                    cat={k} />
                            </td>
                            <td>{in_data && `(${v.toLocaleString()})`}</td>
                        </tr>)
                    })()}
                </tbody>
                {/* </CSSTransitionGroup> */}
            </table>
        )
    }
}
