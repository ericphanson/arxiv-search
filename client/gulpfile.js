
let gulp = require("gulp");
let ts = require("gulp-typescript");
let sourcemaps = require("gulp-sourcemaps");
let merge = require("merge2");
let concat = require("gulp-concat");
let uglifyCSS = require("gulp-clean-css");
let uglifyJS = require("gulp-uglify");
let del = require("del");

let outDir = "../static";
let stylesSrc = ["src/**/*.css"];
let scriptsSrc = ["src/**/*.ts", "src/**/*.tsx"];

let tsproj = ts.createProject({
    jsx: "react",
    module: "amd",
    target : "es5",
    lib : ["es6", "dom"],
    moduleResolution: "node",
    outFile: "bundle.js",
});

function scripts() {
    return gulp.src(scriptsSrc)
        .pipe(sourcemaps.init())
        .pipe(tsproj())
        .pipe(sourcemaps.write())
        .pipe(gulp.dest(outDir))
};

function styles() {
    return gulp.src(stylesSrc)
        .pipe(concat("style.css"))
        .pipe(gulp.dest(outDir))
};

const allAssets = gulp.parallel(
    function assets() { return gulp.src("assets/*").pipe(gulp.dest(outDir)); },
    function requires() { return gulp.src("require/*").pipe(gulp.dest(outDir)); },
    function json() {return gulp.src("../shared/*.json").pipe(gulp.dest(outDir));}
)

const build = gulp.parallel(
    scripts,
    styles,
    allAssets
);
exports.build = build;

function watch() {
    gulp.watch(scriptsSrc, scripts);
    gulp.watch(stylesSrc, styles);
}
exports.watch = watch;
function clean() {
    return del([outDir]);
}
const production = gulp.series(
    allAssets,
    function stylesProduction() {
        return gulp.src(stylesSrc)
        .pipe(concat("style.css"))
        .pipe(uglifyCSS())
        .pipe(gulp.dest(outDir));
    },
    function scriptsProduction() {
        return gulp.src(scriptsSrc)
            .pipe(tsproj())
            .pipe(uglifyJS())
            .pipe(gulp.dest(outDir));
    }
)
exports.production = production;

//TODO:
// - [ ] production; minify everything.
// - [ ] autoreload. browser-sync?