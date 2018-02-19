module.exports = {
    paths : {
        watched : ["client", "shared"],
        public: "static"
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
            entryPoints: {'client/main.tsx' : {
                "bundle.js" : [/^client/, "/^shared/"],
                "vendor.js" : /^(?!client)/
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
			'bundle.js': ['client/main.tsx']
		}
	}
}
