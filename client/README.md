# Arxiv-Search client.

This folder contains all of the code which will run on the user's browser.

## How dependencies work

I think that we should aim to have as few dependencies as possible, and these should be gigantic framework-style libraries instead of lots of tiny dependencies. Following this philosophy, I've shrunk the dependencies to a manageable size and maintain a list of CDN links in `config.js` from which we can download the source code for these libraries. The problem with this approach is that the system will break in umpteen years when the CDNs I have chosen get shut down. But I think its a lighter-weight solution for now.

## Folders

- `assets/`: Things that will be copied directly into the public server folder. Images, fonts etc.
- `require/`: Some scripts to bootstrap the application with. Uses [require.js](https://www.requirejs.org). See also the template at `../server/templates/index.html`.
    + `config.js`: a script that indicates to `require.js` where modules should be downloaded from.
    + `require.js`: copied from [the require js download page](http://www.requirejs.org/docs/download.html). Should never need to be edited (hence it is minified!).
- `src/`: Contains the typescript source code for the app which will be compiled down into a single 'bundle' file `bundle.js`.
- `gulpfile.js`: Contains the build instructions.