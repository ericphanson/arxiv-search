import { category } from "./types";
const c = {
  "purple" :    {bg : "#8b008b", dark : false},
  "greyblue" :  {bg : "#5f9ea0", dark : false},
  "greygreen" :  {bg : "#8fbc8f", dark : false},
  "grey" :      {bg : "#808080", dark : false},
  "darkgreen" : {bg : "#006400", dark : false},
  "darkblue"  : {bg : "#000064", dark : false},
  "orange" :    {bg : "#ffa500", dark : true},
  "yellow" :    {bg : "#dddd00", dark : true},
  "pink" :      {bg : "#ff00ff", dark : true},
  "green" :     {bg : "#008000", dark : false},
  "blue" :     {bg : "#0000a0", dark : false},
  "lightgreen" :{bg : "#00ff00", dark : true },
  "black" :{bg : "#000000", dark : false },
  "brown" : {bg :"#d2691e", dark : false},
  "red" : {bg :"#8b0000", dark : false},
}
const col_table = [
  {rule : /^astro/, ...c.purple},
  {rule : /^cond/, ...c.greyblue},
  {rule : /^gr/, ...c.darkgreen},
  {rule : /^hep/, ...c.orange},
  {rule : /^cs\.(AI|CV|NE)/, ...c.pink},
  {rule : /^cs\.(CC|CL|DM|DS|FL|LO)/, ...c.yellow},
  {rule : /^cs\.(IT)/, bg : "#008080", dark : true},
  {rule : /^math\.MP/, ...c.lightgreen},
  {rule : /^math-ph/, ...c.lightgreen},
  {rule : /^math\.(AG|AT|GT|QA)/, ...c.green},
  {rule : /^math\.(LO|NT)/, ...c.blue},
  {rule : /^math\.(AP|DS)/, ...c.orange},
  {rule : /^math\.(CA|AC|CV)/, ...c.black},
  {rule : /^math\.(CT|OA|RA)/, ...c.greygreen},
  {rule : /^math\.(CO|PR)/, ...c.yellow},
  {rule : /^math\.(DG|FA|GN|KT|MG)/, ...c.darkgreen},

  {rule : /^math\.(GR|RT)/, ...c.purple},
  {rule : /^math\.(GM|HO)/, ...c.brown},
  {rule : /^math\.(NA|OC)/, ...c.red},
  {rule : /^math\.(SP|ST)/, ...c.darkblue},

  {rule : /^nlin/, ...c.grey},
  {rule : /^nucl/, bg : "#808000", dark : false},
  {rule : /^physics/, ...c.darkgreen},
  {rule : /^q-bio/, ...c.lightgreen},
  {rule : /^stat/, ...c.darkblue},
  {rule : /^quant/, ...c.darkgreen},
]
export const is_ams = (cat : category) => cat.search(/,/) !== -1;
export const cat_col = (cat : category) => {
  for (let {rule, bg, dark} of col_table) {
    if (rule.test(cat)) {return {bg, dark}}
  }
  return {bg : "grey", dark : false}
}
export const all_categories : {c : category, d : string}[] = require("../shared/all_categories.json")
let desc_table = {};
for (let {c,d} of all_categories) {
  desc_table[c] = d;
}
/**Look up the description of a given category. */
export const cat_desc = (cat : category) : string | undefined => desc_table[cat]
