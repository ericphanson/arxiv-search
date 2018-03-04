# Infrastructure lambdas

All lambdas that are ran as part of the infrastructure. Lambdas to process incoming arxiv files should go into `../processors`.

When you want to add a lambda, make sure to include it in `../lambdas.yaml` to make sure it gets deployed.

## Currently implemented lambdas

### Add new papers to DB

Run it once a day or whatever to find ids of new papers from the arxiv.

### arXiV incoming process

Triggered when something is added to the `arxiv-incoming` bucket.
If it's a pdf; it adds an entry to `papers-status` with the idvv being the new file name.

### Papers status stream parser

Reads a stream of chenges to `papers-status` and fires lambdas to update entries marked as `want` when all of the resources are available.

### Process work

In progress; trying to use typescript. The idea is an external client can request download work from an amazon API gateway, which passes the request to this Lambda. This function returns a list of dictionaries each with a "fetch" url and a "submit" url. The client's job is to download whatever is at the fetch url, and upload it to the submit url.

### Try errors again

Run this to iterate through the database and try any lambda which errored again.

### Wrapper

A lambda that wraps another Lambda and handles updating the `papers-status` table.
