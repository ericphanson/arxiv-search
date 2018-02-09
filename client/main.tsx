import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { App } from './Components';

 window.onload = function () {
    let root = document.getElementById("root");
    ReactDOM.render(<App />, root);
}