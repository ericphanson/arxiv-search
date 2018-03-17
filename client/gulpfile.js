
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

gulp.task("scripts", function () {
    return gulp.src(["src/*.ts", "src/*.tsx"])
        .pipe(sourcemaps.init())
        .pipe(tsproj())
        .pipe(sourcemaps.write())
        .pipe(gulp.dest(outDir))
});

gulp.task("css", function () {
    return gulp.src(["src/*.css"])
        .pipe(sourcemaps.init())
        .pipe(concat("style.css"))
        .pipe(gulp.dest(outDir))
});

gulp.task("build", gulp.parallel(
    "scripts",
    "css",
    function assets() { return gulp.src("assets/*").pipe(gulp.dest(outDir)); },
    function requires() { return gulp.src("require/*").pipe(gulp.dest(outDir)); },
    function json() {return gulp.src("../shared/*.json").pipe(gulp.dest(outDir));}
));