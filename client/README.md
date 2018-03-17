# Arxiv-Search client.



## Folders

- `assets/`: Things that will be copied directly into the public server folder. Images, fonts etc.
- `require/`: Some scripts to bootstrap the application with. Uses [require.js](https://www.requirejs.org). See also the template at `../server/templates/index.html`.
    + `config.js`: a script that indicates to `require.js` where modules should be downloaded from.
    + `require.js`: copied from [the require js download page](http://www.requirejs.org/docs/download.html). Should never need to be edited (hence it is minified!).
- `src/`: Contains the typescript source code for the app which will be compiled down into a single 'bundle' file `bundle.js`.