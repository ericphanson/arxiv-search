const path = require("path");
module.exports = {
    entry : "./client/main.tsx",
    module : {
        rules : [
            {test : /\.tsx?$/, use : "ts-loader", exclude: /node_modules/},
            {test : /\.(png|svg|jpg|gif)$/, use : "file-loader"}
        ]
    },
    devtool: "inline-source-map",
    resolve : {extensions : [".tsx", ".ts", ".js"]},
    output : {
        filename : "bundle.js",
        path : path.resolve(__dirname, 'dist')
    },
    externals:{
        "react":"React",
        "react-dom":"ReactDOM"
    }
}