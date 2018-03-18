
let gulp = require("gulp");
let ts = require("gulp-typescript");
let sourcemaps = require("gulp-sourcemaps");
let merge = require("merge2");
let concat = require("gulp-concat");

let outDir = "../static";

let tsproj = ts.createProject({
    jsx: "react",
    module: "amd",
    target : "es6",
    moduleResolution: "node",
    outFile: "bundle.js",
});

function scripts() {
    return gulp.src(["src/*.ts", "src/*.tsx"])
        .pipe(sourcemaps.init())
        .pipe(tsproj())
        .pipe(sourcemaps.write())
        .pipe(gulp.dest(outDir))
};

function styles() {
    return gulp.src(["src/*.css"])
        .pipe(sourcemaps.init())
        .pipe(concat("style.css"))
        .pipe(gulp.dest(outDir))
};

const build = gulp.parallel(
    scripts,
    styles,
    function assets() { return gulp.src("assets/*").pipe(gulp.dest(outDir)); },
    function requires() { return gulp.src("require/*").pipe(gulp.dest(outDir)); },
    function json() {return gulp.src("../shared/*.json").pipe(gulp.dest(outDir));}
);
exports.build = build;

function watch() {
    gulp.watch(["src/*.ts", "src/*.tsx"], scripts);
    gulp.watch(["src/*.css"], styles);
}
exports.watch = watch;

//TODO:
// - [ ] production; minify everything.
// - [ ] autoreload. browser-sync?