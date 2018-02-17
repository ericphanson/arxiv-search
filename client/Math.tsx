import * as React from 'react';
import * as Katex from 'katex';
const config : Katex.KatexOptions = {
    throwOnError: false,
    errorColor : "#000"
} as any
export class Math extends React.Component<{latex : string}> {
    element;
    doKatex(latex : string) {
        try {
            Katex.render(latex, this.element, config);
        }
        catch (e) {
            debugger;
            this.element.textContent = latex;
        }

    }
    componentDidMount() {
        //component was mounted to DOM.
        this.doKatex(this.props.latex);
    }
    componentWillReceiveProps(nextProps) {
        if (this.element && nextProps.latex && nextProps.latex !== this.props.latex) {
            this.doKatex(nextProps.latex);
        }
    }
    render() {
        return <span ref={element => {this.element = element}}></span>
    }
}