import * as React from "react";
import {rec_tuning} from './types';
import {lens, update} from './basic';

export class Tuning extends React.Component<{ rt: rec_tuning, onChange: (r: rec_tuning) => void }, { rt: rec_tuning }> {
    constructor(props) {
        super(props);
        this.state = { rt: props.rt }
    }
    componentWillReceiveProps(newProps: this["props"]) {
        if (newProps.rt !== this.state.rt) {
            this.setState({ rt: newProps.rt })
        }
    }
    handleChange(rt: rec_tuning) {
        this.setState({ rt });
    }
    render() {
        let rt = this.state.rt;
        let ch = (p1: keyof rec_tuning, p2?: keyof rec_tuning["weights"]) => 
        (e) => 
        this.handleChange(lens(rt, ...(p2 ? [p1, p2] : [p1]))(Number(e.target.value)) as any)
        return <div>
            <h3>Tuning</h3>
            <table>
                <tbody>
                    {/* <tr>
                            <td>fulltext weight</td>
                            <td><input type="number" step="0.1" min="0" max="100"
                                value={rt.weights.fulltext}
                                onChange={ch("weights", "fulltext")} /></td>
                        </tr>
                        <tr>
                            <td>title weight</td>
                            <td><input type="number" step="0.1" min="0" max="100"
                                value={rt.weights.title}
                                onChange={ch("weights", "title")} /></td>
                        </tr>
                        <tr>
                            <td>abstract weight</td>
                            <td><input type="number" step="0.1" min="0" max="100"
                                value={rt.weights.abstract}
                                onChange={ch("weights", "abstract")} /></td>
                        </tr>
                        <tr>
                            <td>all_authors weight</td>
                            <td><input type="number" step="0.1" min="0" max="100"
                                value={rt.weights.all_authors}
                                onChange={ch("weights", "all_authors")} /></td>
                        </tr> */}
                    <tr>
                        <td>max query terms</td>
                        <td><input type="number" value={rt.max_query_terms} onChange={ch("max_query_terms")} /></td>
                    </tr>
                    <tr>
                        <td>min doc frequency</td>
                        <td><input type="number" value={rt.min_doc_freq} onChange={ch("min_doc_freq")} /></td>
                    </tr>
                    <tr>
                        <td>max doc frequency</td>
                        <td><input type="number" value={rt.max_doc_freq} onChange={ch("max_doc_freq")} /></td>
                    </tr>
                    <tr>
                        <td>minimum should match</td>
                        <td><input type="text" value={rt.minimum_should_match}
                            onChange={(e) => this.handleChange(update(rt, { "minimum_should_match": e.target.value }))} />
                        </td>
                    </tr>
                    <tr>
                        <td>boost terms</td>
                        <td><input type="number" value={rt.boost_terms} onChange={ch("boost_terms")} /></td>
                    </tr>
                    <tr>
                        <td>pair fields</td>
                        <td><input type="checkbox" checked={rt.pair_fields} onChange={(e) => this.handleChange(update(rt, { "pair_fields": e.target.checked }))} /></td>
                    </tr>
                </tbody>
            </table>
            {this.props.rt !== rt && <button onClick={() => this.props.onChange(this.state.rt)}>Update!</button>}
        </div>
    }

}
