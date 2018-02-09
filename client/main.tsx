import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { App } from './Components';

console.log("hello from main.tsx");
 window.onload = function () {
    let root = document.getElementById("root");
    ReactDOM.render(<App />, root);
}