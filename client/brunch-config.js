module.exports = {
    paths : {
        watched : ["src"],
        public: "../static"
    },
    npm : {
        styles : {
            "react-select" : ["dist/react-select.css"],
            "katex" : ["dist/katex.min.css", "dist/fonts"]
        },
        static : [
            "./node_modules/katex/dist/fonts/"
        ]
    },
    files: {
        javascripts: {
            entryPoints: {'src/main.tsx' : {
                "bundle.js" : [/^src/],
                "vendor.js" : /^(?!src)/
            }}
        },
        stylesheets : {
            joinTo : "style.css"
        }
    },
    plugins : {
        brunchTypescript : {ignoreErrors:true},
        copycat : {
            onlyChanged:true,
            fonts : [
                "node_modules/katex/dist/fonts"
            ]
        }
    },
    modules: {
		autoRequire: {
			'bundle.js': ['src/main.tsx']
		}
	}
}
