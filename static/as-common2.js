// various JS utilities shared by all templates
var valid_params = ['sort', 'in', 'ver', 'prim','range']

// var options_lookup_key = ['']
var valid_options = {'sort': ['date','rec'], 
                      'ver': ['1','all'],
                      'range': ['day','3days','week','month','year','all']}

function include_pair(param,value){
  include = false
  if (valid_params.includes(param))
  {
    if (param in valid_options) {
      if (valid_options[param].includes(value)) { 
        include = true
        }
    } else {
      include = true
      }
  }
    return include
}
// helper function so that we can access keys in url bar
var QueryString = function () {
  // This function is anonymous, is executed immediately and 
  // the return value is assigned to QueryString!
  var query_string = {};
  var query = window.location.search.substring(1);
  var vars = query.split("&");
  for (var i=0;i<vars.length;i++) {
    var pair = vars[i].split("=");
        // If first entry with this name
    if (typeof query_string[pair[0]] === "undefined") {
      query_string[pair[0]] = decodeURIComponent(pair[1]);
        // If second entry with this name
    } else if (typeof query_string[pair[0]] === "string") {
      var arr = [ query_string[pair[0]],decodeURIComponent(pair[1]) ];
      query_string[pair[0]] = arr;
        // If third or later entry with this name
    } else {
      query_string[pair[0]].push(decodeURIComponent(pair[1]));
    }
  }
    return query_string;
}();

function jq( myid ) { return myid.replace( /(:|\.|\[|\]|,)/g, "\\$1" ); } // for dealing with ids that have . in them

function build_ocoins_str(p) {
  var ocoins_info = {
    "ctx_ver": "Z39.88-2004",
    "rft_val_fmt": "info:ofi/fmt:kev:mtx:journal",
    "rfr_id": "info:sid/arxiv-sanity.com:arxiv-sanity",

    "rft_id": p.link,
    "rft.atitle": p.title,
    "rft.jtitle": "arXiv:" + p.pid + " [" + p.category.substring(0, p.category.indexOf('.')) + "]",
    "rft.date": p.published_time,
    "rft.artnum": p.pid,
    "rft.genre": "preprint",

    // NB: Stolen from Dublin Core; Zotero understands this even though it's
    // not part of COinS
    "rft.description": p.abstract,
  };
  ocoins_info = $.param(ocoins_info);
  ocoins_info += "&" + $.map(p.authors, function(a) {
      return "rft.au=" + encodeURIComponent(a);
    }).join("&");

  return ocoins_info;
}

function build_authors_html(authors) {
  var res = '';
  for(var i=0,n=authors.length;i<n;i++) {
    var link = '/search?q=' + authors[i].replace(/ /g, "+");
    res += '<a href="' + link + '">' + authors[i] + '</a>';
    if(i<n-1) res += ', ';
  }
  return res;
}

function get_param(param) 
{
  var value = null
  const url_params = new URLSearchParams(location.search);

  var orig_query = url_params.get('q')
  if (orig_query === null){
    return null
  }
  var found = parse_query(orig_query)
  if (found.params.includes(param))
  {
    var ind = found.params.indexOf(param)
    value = found.values[ind]
  }
  return value
}

function arraysEqual(arr1, arr2) {
    if(arr1.length !== arr2.length)
        return false;
    for(var i = arr1.length; i--;) {
        if(arr1[i] !== arr2[i])
            return false;
    }

    return true;
}


function remove_defaults(found) {
  if (found.params.length === 0){
    return found
  } 
  var joint_params =[]
  for(var i=0, n=found.params.length; i<n; i++){ 
  joint_params.push([found.params[i], found.values[i]])
  }

  var defaults = [ ['ver', 'all'], ['prim', 'any'], ['range', 'all'] ]

  var new_joint_params =[]
  for(var i=0, n=joint_params.length; i<n; i++){ 
    var include = true
    for (var d=0; d<defaults.length; d++)
    {
      if (arraysEqual(joint_params[i], defaults[d]))
      {
        include = false
      }
    }
    if (include){
      new_joint_params.push(joint_params[i])
    }
  }
  joint_params = new_joint_params
  var keep_params = []
  var keep_values = []

  for(var i=0, n=joint_params.length; i<n; i++){ 
  keep_params.push(joint_params[i][0])
  keep_values.push(joint_params[i][1])
  }

  found.params = keep_params
  found.values = keep_values

return found

}
function parse_query(string, html_chars = false) {
 string = string.replace(String.fromCharCode(160), ' ')
  string = string.replace( /\s\s+/g, ' ' )
  // var valid_params = [ 'prim','in', 'ver', 'sort', 'range']
  var words

  var raw_query = ""
  if (html_chars){
  words = string.split('%20')
  } else {
    words = string.split(' ')
  }
  var found_params = []
  var found_values = []
  // console.log(words)
  for(var i=0, n=words.length; i<n; i++){
    var colons
    if (html_chars) {
      colons = words[i].split('%3A')
    } else {
      colons = words[i].split(':')
    }
    var included_as_param = false
    // console.log(colons.length)
    if (colons.length === 2){
      var param = colons[0]
      var option = colons[1]
      if (include_pair(param,option))
      {
        included_as_param = true
        found_params.push(param)
        found_values.push(option)
      }
    }
    if( !(included_as_param) ) {
      raw_query = raw_query + ' ' + words[i]
    }
  }
  return {values : found_values, params : found_params, query : raw_query}
}

function kill_param(found, param){
  var keep_params = []
  var keep_values = []
  // remove all old instances of param
  for(var i=0, n=found.params.length; i<n; i++){ 
    if (!(found.params[i] === param)){
      keep_params.push(found.params[i])
      keep_values.push(found.values[i])
    }
  }
  found.params = keep_params
  found.values = keep_values
return found
}

function uniq_fast(a) {
    var seen = {};
    var out = [];
    var len = a.length;
    var j = 0;
    for(var i = 0; i < len; i++) {
         var item = a[i];
         if(seen[item] !== 1) {
               seen[item] = 1;
               out[j++] = item;
         }
    }
    return out;
}


function dedup_params(found){
  if (found.params.length === 0){
    return found
  } 

  var joint_params =[]
  for(var i=0, n=found.params.length; i<n; i++){ 
  joint_params.push([found.params[i], found.values[i]])
  }

  joint_params = uniq_fast(joint_params)

  var keep_params = []
  var keep_values = []

  for(var i=0, n=joint_params.length; i<n; i++){ 
  keep_params.push(joint_params[i][0])
  keep_values.push(joint_params[i][1])
  }

  found.params = keep_params
  found.values = keep_values

return found
}

function query_to_string()
{
const url_params = new URLSearchParams(location.search);
  var orig_query = url_params.get('q')
  var new_query = ""
  if (orig_query === null)
  {
  new_query =  ""
  } 
  else 
  {
  var found = parse_query(orig_query)
  new_query = found.query
  // var valid_params = ['sort', 'prim','in', 'ver', 'range']

  found = dedup_params(found)
  found = remove_defaults(found)
  for(var v=0, totv = valid_params.length; v< totv; v++){
    for(var i=0, n=found.params.length; i<n; i++){ 
      if (found.params[i] === valid_params[v]) {
        if (new_query === "")
        {
        new_query =  found.params[i] + ':' + found.values[i]          
        } else
        {
        new_query = new_query +' ' + found.params[i] + ':' + found.values[i]          
        }
      }
    }
  }
  }
  return new_query
}


function get_search_url(string)
{
var found = parse_query(string)
var is_query = true
if (found.query === null){
is_query = false
} else if (found.query.trim() === "") 
{
is_query = false
}

if (is_query){
  found = kill_param(found, 'sort')
  // found.params.push('sort')
  // found.values.push('date')
}
  found = dedup_params(found)
  found = remove_defaults(found)
  // var valid_params = ['sort', 'prim','in', 'ver', 'range']

  var new_query = found.query.trim()

  for(var v=0, totv = valid_params.length; v< totv; v++){
    for(var i=0, n=found.params.length; i<n; i++){ 
      if (found.params[i] === valid_params[v]) {
        new_query = new_query +'%20' + found.params[i] + '%3A' + found.values[i]
      }
    }
  }
  var link = '/search?q=' + new_query;

  return link
}



function make_link(param, value, replace = false, kill_query = false) {
   // var q = document.getElementById('qfield')
  // var string = q.innerText
  // string = string.replace(String.fromCharCode(160), ' ')
  // string = string.replace( /\s\s+/g, ' ' )
  // window.location.href = get_search_url(string)

  const url_params = new URLSearchParams(location.search);
  // const url_params = new URLSearchParams(get_search_url(string))
  var orig_query = url_params.get('q')
  // var orig_query = get_search_url(string).replace('/search?q=','')
  var new_query = ""
  if (orig_query === null)
  {
  new_query =  param+'%3A'+ value

  } 
  else 
  {
  var found = parse_query(orig_query)
  if (replace) {
    found = kill_param(found, param)
  }
  // var valid_params = ['sort', 'prim','in', 'ver', 'range']
  // now build new query
  if (kill_query || found.query === null){
    found.query = ""
  } 
    

  if (!(found.query.trim() === ""))
    {
    found = kill_param(found, 'sort')
    // found.params.push('sort')
    // found.keep_values.push('date')
    new_query = found.query.trim() 
    }
  
  
  found.params.push(param)
  found.values.push(value)
  found = dedup_params(found)
  found = remove_defaults(found)
  for(var v=0, totv = valid_params.length; v< totv; v++){
    for(var i=0, n=found.params.length; i<n; i++){ 
      if (found.params[i] === valid_params[v]) {
        if (new_query === "")
        {
        new_query =  found.params[i] + '%3A' + found.values[i]          
        } else
        {
        new_query = new_query +'%20' + found.params[i] + '%3A' + found.values[i]          
        }
      }
    }
  }
  }

//   if ( orig_query === ""){
//   new_query =  param+'%3A'+ value
//   } else{
//   new_query = orig_query + '%20' + param + '%3A'+ value
//   }
// }
  var link = '/search?q=' + new_query;
  return link
}

function build_categories_html(tags) {
  var res = '';
  for(var i=0,n=tags.length;i<n;i++) {
    var link = '/?in=' + tags[i].replace(/ /g, "+");
    // var link = make_link('in', tags[i].replace(/ /g, "+"))
    res += '<a class="link-to-update" href="' + link + '">' + tags[i] + '</a>';
    if(i<n-1) res += ' | ';
  }
  return res;
}

function strip_version(pidv) {
  var lst = pidv.split('v');
  return lst[0];
}

// populate papers into #rtable
// we have some global state here, which is gross and we should get rid of later.
var pointer_ix = 0; // points to next paper in line to be added to #rtable
var showed_end_msg = false;

function addPapers(num, dynamic) {
  if (pointer_ix < numresults) {
      requestPapers(pointer_ix, num, dynamic)
      wait_for_write = true;
    }
  if (pointer_ix + num >= numresults) {
    return true
  } else {
    return false
  }
}


function requestPapers(start,num, dynamic) {
$.ajax({
        type: 'POST',
        url: results_url,
        dataType: 'json',
        contentType: "application/json",
        data: JSON.stringify({start_at : start, num_get : num, dyn : dynamic}),
        success: writePapers
    })
return false
// $.getJSON(results_url, {squery : search, start_at : start, num_get : num}, writePapers)
}

// var wait_for_write = false;

function writePapers (data) {
  dynamic = data.dynamic
  papers = data.papers
  num = papers.length
  // if num == 0
  //   return false
  if (pointer_ix + num >= numresults){
    more = false
  } else {
    more = true
  }
  
  if(numresults === 0) {
  wait_for_write = false;
   return true; } // nothing to display, and we're done

  var root = d3.select("#rtable");

  var base_ix = pointer_ix;
  for(var i=0;i<num;i++) {
    var ix = base_ix + i;
    pointer_ix++;


    var p = papers[i];
    var div = root.append('div').classed('apaper', true).attr('id', p.pid);

    // Generate OpenURL COinS metadata element -- readable by Zotero, Mendeley, etc.
    var ocoins_span = div.append('span').classed('Z3988', true).attr('title', build_ocoins_str(p));

    var tdiv = div.append('div').classed('paperdesc', true);
    tdiv.append('span').classed('ts', true).append('a').attr('href', p.link).attr('target', '_blank').html(p.title);
    tdiv.append('br');
    tdiv.append('span').classed('as', true).html(build_authors_html(p.authors));
    tdiv.append('br');
    tdiv.append('span').classed('ds', true).html(p.published_time);
    if(p.originally_published_time !== p.published_time) {
      tdiv.append('span').classed('ds2', true).html('(v1: ' + p.originally_published_time + ')');
    }
    tdiv.append('span').classed('cs', true).html(build_categories_html(p.tags));
    tdiv.append('br');
    tdiv.append('span').classed('ccs', true).html(p.comment);

    // action items for each paper
    var ldiv = div.append('div').classed('dllinks', true);
    // show raw arxiv id
    ldiv.append('span').classed('spid', true).html(p.pid);
    // access PDF of the paper
    var pdf_link = p.link.replace("abs", "pdf"); // convert from /abs/ link to /pdf/ link. url hacking. slightly naughty
    if(pdf_link === p.link) { var pdf_url = pdf_link } // replace failed, lets fall back on arxiv landing page
    else { var pdf_url = pdf_link + '.pdf'; }
    ldiv.append('a').attr('href', pdf_url).attr('target', '_blank').html('pdf');
    
    // rank by tfidf similarity
    ldiv.append('br');
    var similar_span = ldiv.append('span').classed('sim', true).attr('id', 'sim'+p.pid).html('show similar');
    similar_span.on('click', function(pid){ // attach a click handler to redirect for similarity search
      return function() { window.location.replace('/' + pid); }
    }(p.pid)); // closer over the paper id

    // var review_span = ldiv.append('span').classed('sim', true).attr('style', 'margin-left:5px; padding-left: 5px; border-left: 1px solid black;').append('a').attr('href', 'http://www.shortscience.org/paper?bibtexKey='+p.pid).html('review');
    // var discuss_text = p.num_discussion === 0 ? 'discuss' : 'discuss [' + p.num_discussion + ']';
    var discuss_text = 'scirate';

    var discuss_color = 'black' ;
    var review_span = ldiv.append('span').classed('sim', true).attr('style', 'margin-left:5px; padding-left: 5px; border-left: 1px solid black;')
                      .append('a').attr('href', 'https://scirate.com/arxiv/'+strip_version(p.pid)).attr('style', 'color:'+discuss_color).html(discuss_text);
    ldiv.append('br');

    var lib_state_img = p.in_library === 1 ? 'static/saved.png' : 'static/save.png';
    var saveimg = ldiv.append('img').attr('src', lib_state_img)
                    .classed('save-icon', true)
                    .attr('title', 'toggle save paper to library (requires login)')
                    .attr('id', 'lib'+p.pid);
    // attach a handler for in-library toggle
    saveimg.on('click', function(pid, elt){
      return function() {
        if(username !== '') {
          // issue the post request to the server
          $.post("/libtoggle", {pid: pid})
           .done(function(data){
              // toggle state of the image to reflect the state of the server, as reported by response
              if(data === 'ON') {
                elt.attr('src', 'static/saved.png');
              } else if(data === 'OFF') {
                elt.attr('src', 'static/save.png');
              }
           });
        } else {
          alert('you must be logged in to save papers to library.')
        }
      }
    }(p.pid, saveimg)); // close over the pid and handle to the image

    div.append('div').attr('style', 'clear:both');

    if(typeof p.img !== 'undefined') {
      div.append('div').classed('animg', true).append('img').attr('src', p.img);
    }

    if(typeof p.abstract !== 'undefined') {
      var abdiv = div.append('span').classed('tt', true).html(p.abstract);
      if(dynamic) {
        MathJax.Hub.Queue(["Typeset",MathJax.Hub,abdiv[0]]); //typeset the added paper
      }
    }

    // in friends tab, list users who the user follows who had these papers in libary
    if(render_format === 'friends') {
      if(pid_to_users.hasOwnProperty(p.rawpid)) {
        var usrtxt = pid_to_users[p.rawpid].join(', ');
        div.append('div').classed('inlibsof', true).html('In libraries of: ' + usrtxt);
      }
    }


    if(render_format == 'paper' && ix === 0) {
      // lets insert a divider/message
      div.append('div').classed('paperdivider', true).html('Most similar papers:');
    }
  }
  if (!more) {
      if(!showed_end_msg) {
          var msg = 'Results complete.';
          var root = d3.select("#rtable");
          root.append('div').classed('msg', true).html(msg);
          showed_end_msg = true;
        }
    } 
  wait_for_write = false;

  if (pointer_ix + num >= numresults) {
    return true
  } else {
    return false
  } 
}




function timeConverter(UNIX_timestamp){
  var a = new Date(UNIX_timestamp * 1000);
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var year = a.getFullYear();
  var month = months[a.getMonth()];
  var date = a.getDate().toString();
  var hour = a.getHours().toString();
  var min = a.getMinutes().toString();
  var sec = a.getSeconds().toString();
  if(hour.length === 1) { hour = '0' + hour; }
  if(min.length === 1) { min = '0' + min; }
  if(sec.length === 1) { sec = '0' + sec; }
  var time = date + ' ' + month + ' ' + year + ', ' + hour + ':' + min + ':' + sec ;
  return time;
}
