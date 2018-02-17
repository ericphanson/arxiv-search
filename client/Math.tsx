import * as React from 'react';
import * as Katex from 'katex';

export class Math extends React.Component<{latex : string}> {
    element;
    componentDidMount() {
        //component was mounted to DOM.
        Katex.render(this.props.latex, this.element);
    }
    componentWillReceiveProps(nextProps) {
        if (this.element && nextProps.latex) {
            Katex.render(nextProps.latex, this.element);
        }
    }
    render() {
        return <span ref={element => {this.element = element}}></span>
    }
}