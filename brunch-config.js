module.exports = {
    paths : {
        watched : ["client"],
        public: "static"
    },
    files: {
        javascripts: {
            entryPoints: {'client/main.tsx' : {
                "bundle.js" : /^client/,
                "vendor.js" : /^(?!client)/
            }}
        },
        stylesheets : {
            joinTo : "style.css"
        }
    },
    plugins : {
        brunchTypescript : {ignoreErrors:true}
    },
    modules: {
		autoRequire: {
			'bundle.js': ['client/main.tsx']
		}
	}
}
