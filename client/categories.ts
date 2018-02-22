import { category } from "./types";
const c = {
"darkred": {bg:"#e7040f", dark : false},
"red": {bg:"#ff4136", dark : false},
"lightred": {bg:"#ff725c", dark : true},
"orange": {bg:"#ff6300", dark : false},
"gold": {bg:"#ffb700", dark : false},
"yellow": {bg:"#ffde37", dark : true},
"lightyellow": {bg:"#fbf1a9", dark : true},
"purple": {bg:"#5e2ca5", dark : false},
"lightpurple": {bg:"#a463f2", dark : true},
"darkpink": {bg:"#d5008f", dark : false},
"hotpink": {bg:"#ff41b4", dark : true},
"pink": {bg:"#ff80cc", dark : true},
"lightpink": {bg:"#ffa3d7", dark : true},
"darkgreen": {bg:"#137752", dark : false},
"green": {bg:"#19a974", dark : false},
"lightgreen": {bg:"#9eebcf", dark : true},
"navy": {bg:"#001b44", dark : true},
"darkblue": {bg:"#00449e", dark : false},
"blue": {bg:"#357edd", dark : false},
"lightblue": {bg:"#96ccff", dark : true},
"lightestblue": {bg:"#cdecff", dark : true},
"washedblue": {bg:"#f6fffe", dark : true},
"washedgreen": {bg:"#e8fdf5", dark : true},
"washedyellow": {bg:"#fffceb", dark : true},
"washedred": {bg:"#ffdfdf", dark : true},
"black" : {bg : "#ffffff", dark : false},
"grey" : {bg : "#999999", dark : false},
}
const col_table = [
  {rule : /^astro/, ...c.purple},
  {rule : /^cond/, ...c.washedblue},
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
  {rule : /^math\.(CT|OA|RA)/, ...c.washedgreen},
  {rule : /^math\.(CO|PR)/, ...c.yellow},
  {rule : /^math\.(DG|FA|GN|KT|MG)/, ...c.darkgreen},

  {rule : /^math\.(GR|RT)/, ...c.purple},
  {rule : /^math\.(GM|HO)/, ...c.washedred},
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
