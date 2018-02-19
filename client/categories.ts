import { category } from "./types";
const col_table = {
  "astro": "blue",
  "gr" : "blue",
  "cs" : "dodgerblue",
  "math" : "crimson",
  "physics" : "purple",
  "hep" : "purple",
  "nucl" : "purple",
  "quant" : "maroon"
}
export const is_ams = (cat : category) => cat.search(/,/) !== -1;
export const cat_col = (cat : category) => col_table[cat.split(".")[0].split("-")[0]] || "grey";
export const all_categories : {c : category, d : string}[] = require("../shared/all_categories.json")
let desc_table = {};
for (let {c,d} of all_categories) {
  desc_table[c] = d;
}
/**Look up the description of a given category. */
export const cat_desc = (cat : category) : string | undefined => desc_table[cat]
