require.config({
    paths : {
        //our code
        "index" : ["bundle"],
        
        //katex
        "katex" :  ["https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.9.0/katex.min"],

        //react
        "react" : ["https://unpkg.com/react@16/umd/react.development"],
        "react-dom" : ["https://unpkg.com/react-dom@16/umd/react-dom.development"],
        
        //react-select
        "prop-types" : "https://unpkg.com/prop-types@15.5.10/prop-types",
        "classnames" : "https://unpkg.com/classnames@2.2.5/index",
        "react-input-autosize" : "https://unpkg.com/react-input-autosize@2.0.0/dist/react-input-autosize",
        "react-select" : "https://unpkg.com/react-select@1.2.1/dist/react-select",

        //react-router
        // "react-router" : "https://unpkg.com/react-router/umd/react-router.min",
        // "react-router-dom" : "https://unpkg.com/react-router-dom/umd/react-router-dom.min",
    }
});
require(["index"]);
