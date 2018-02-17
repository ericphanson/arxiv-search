import os
import json
import time
import pickle
import argparse
import dateutil.parser
from dateutil.tz import tzutc
from datetime import datetime, timedelta
from pytz import timezone

import copy

from random import shuffle, randrange, uniform
from flask.json import jsonify
from sqlite3 import dbapi2 as sqlite3
from hashlib import md5
from flask import Flask, request, session, url_for, redirect, \
     render_template, abort, g, flash, _app_ctx_stack
from flask_limiter import Limiter
from werkzeug import check_password_hash, generate_password_hash
from utils import safe_pickle_dump, strip_version, isvalidid, Config
import re

from elasticsearch import Elasticsearch, RequestsHttpConnection

from elasticsearch.helpers import streaming_bulk, bulk, parallel_bulk
import elasticsearch
from itertools import islice
import certifi
from elasticsearch_dsl import Search, Q, A, Mapping
from elasticsearch_dsl import FacetedSearch, TermsFacet, RangeFacet, DateHistogramFacet

from elasticsearch_dsl.query import MultiMatch, Match, DisMax
from aws_requests_auth.aws_auth import AWSRequestsAuth
from cmreslogging.handlers import CMRESHandler
import requests
from requests_aws4auth import AWS4Auth

from pyparsing import Word, alphas, Literal, Group, Suppress, OneOrMore, oneOf
import threading

# -----------------------------------------------------------------------------

root_dir = os.path.join(".")
def key_dir(file): return os.path.join(root_dir,"keys",file)
def server_dir(file): return os.path.join(root_dir,"server", file);

# database configuration
if os.path.isfile(key_dir('secret_key.txt')):
  SECRET_KEY = open(key_dir('secret_key.txt'), 'r').read()
else:
  SECRET_KEY = 'devkey, should be in a file'

AWS_ACCESS_KEY = open(key_dir('AWS_ACCESS_KEY.txt'), 'r').read().strip()
AWS_SECRET_KEY = open(key_dir('AWS_SECRET_KEY.txt'), 'r').read().strip()

ES_USER = open(key_dir('ES_USER.txt'), 'r').read().strip()
ES_PASS = open(key_dir('ES_PASS.txt'), 'r').read().strip()
es_host = es_host = '0638598f91a536280b20fd25240980d2.us-east-1.aws.found.io'



log_AWS_ACCESS_KEY = open(key_dir('log_AWS_ACCESS_KEY.txt'), 'r').read().strip()
log_AWS_SECRET_KEY = open(key_dir('log_AWS_SECRET_KEY.txt'), 'r').read().strip()
CLOUDFRONT_URL = 'https://d3dq07j9ipgft2.cloudfront.net/'

with open(server_dir("all_categories.txt"), 'r') as cats:
  ALL_CATEGORIES =  cats.read().splitlines()


# jwskey = jwk.JWK.generate(kty='oct', size=256)
cache_key = open(key_dir('cache_key.txt'), 'r').read().strip()

AUTO_CACHE = False

user_features = True

user_interactivity = False
print('read in AWS keys')
  
app = Flask(__name__, static_folder=os.path.join("..","static"))
app.config.from_object(__name__)
# limiter = Limiter(app, default_limits=["1000 per hour", "20 per minute"])

# -----------------------------------------------------------------------------
# utilities for database interactions 
# -----------------------------------------------------------------------------
# to initialize the database: sqlite3 as.db < schema.sql
def connect_db():
  sqlite_db = sqlite3.connect(Config.database_path)
  sqlite_db.row_factory = sqlite3.Row # to return dicts rather than tuples
  return sqlite_db

def query_db(query, args=(), one=False):
  """Queries the database and returns a list of dictionaries."""
  cur = g.db.execute(query, args)
  rv = cur.fetchall()
  return (rv[0] if rv else None) if one else rv

def get_user_id(username):
  """Convenience method to look up the id for a username."""
  rv = query_db('select user_id from user where username = ?',
                [username], one=True)
  return rv[0] if rv else None

def get_username(user_id):
  """Convenience method to look up the username for a user."""
  rv = query_db('select username from user where user_id = ?',
                [user_id], one=True)
  return rv[0] if rv else None

# -----------------------------------------------------------------------------
# connection handlers
# -----------------------------------------------------------------------------

@app.before_request
def before_request():
  g.libids = None

  # this will always request database connection, even if we dont end up using it ;\
  g.db = connect_db()
  # retrieve user object from the database if user_id is set
  g.user = None
  if 'user_id' in session:
    g.user = query_db('select * from user where user_id = ?',
                      [session['user_id']], one=True)
    added = addUserSearchesToCache()
    if added:
      print('addUser fired from before_request')
  
  # g.libids = None
  if g.user:
    if 'libids' in session:
      g.libids = session['libids']
    else:
      update_libids()

def update_libids():
  uid = session['user_id']
  user_library = query_db('''select * from library where user_id = ?''', [uid])
  libids = [strip_version(x['paper_id']) for x in user_library]
  session['libids'] = libids
  g.libids = libids



@app.teardown_request
def teardown_request(exception):
  db = getattr(g, 'db', None)
  if db is not None:
    db.close()

#------------------------------------------------------
# Pass data to client
#------------------------------------------------------ 

def render_date(timestr):
  timestruct = dateutil.parser.parse(timestr)
  rendered_str = '%s %s %s' % (timestruct.day, timestruct.strftime('%b'), timestruct.year)
  return rendered_str


def encode_hit(p, send_images=True, send_abstracts=True):
  
  pid = str(p['rawid'])
  idvv = '%sv%d' % (p['rawid'], p['paper_version'])
  struct = {}
  if "score" in p.meta:
    if p.meta.score is not None:
      struct['score'] = p.meta.score
  
  if 'havethumb' in p:
    struct['havethumb'] = p['havethumb']
  struct['title'] = p['title']
  struct['pid'] = idvv
  struct['rawpid'] = p['rawid']
  struct['category'] = p['primary_cat']
  struct['authors'] = [a for a in p['authors']]
  struct['link'] = p['link']
  if 'abstract' in p:
    struct['abstract'] = p['abstract']
  # print(p.to_dict())
  # exit()
  if send_images:
    # struct['img'] = '/static/thumbs/' + idvv.replace('/','') + '.pdf.jpg'
    struct['img'] = CLOUDFRONT_URL + 'thumbs/' + pid.replace('/','') + '.pdf.jpg'
  

  struct['tags'] = [t for t in p['cats']]

  # struct['tags'] = [t['term'] for t in p['tags']]
  
  # render time information nicely
  struct['published_time'] = render_date(p['updated'])
  struct['originally_published_time'] = render_date(p['published'])

  # fetch amount of discussion on this paper
  struct['num_discussion'] = 0

  # arxiv comments from the authors (when they submit the paper)
  # cc = p.get('arxiv_comment', '')
  try:
    cc  = p['arxiv_comment']
  except Exception as e:
    cc = ""

  if len(cc) > 100:
    cc = cc[:100] + '...' # crop very long comments
  struct['comment'] = cc
  return struct

def add_user_data_to_hit(struct):
  libids = set()
  if g.libids:
    libids = set(g.libids)
  
  struct['in_library'] = 1 if struct['rawpid'] in libids else 0
  return struct




def getResults(search):
  search_dict = search.to_dict()
  query_hash = make_hash(search_dict)
  have = False

  with cached_queries_lock:
    if query_hash in cached_queries:
      d = cached_queries[query_hash]
      list_of_ids = d["list_of_ids"]
      meta = d["meta"]
      have = True

  if not have:
    es_response = search.execute()
    meta = get_meta_from_response(es_response)
    list_of_ids = process_query_to_cache(query_hash, es_response, meta)

  with cached_docs_lock:
    records = [ cached_docs[_id] for _id in list_of_ids ]

  records = [add_user_data_to_hit(r) for r in records]
  return records, meta

# def test_hash_speed():
  # {'size': 10, 'query': {'match_all': {}}, 'sort': [{'updated': {'order': 'desc'}}], 'from': 0}

# -----------------------------------------------------------------------------
# Build and filter query
# -----------------------------------------------------------------------------

def cat_filter(groups_of_cats):
    filt_q = Q()
    for group in groups_of_cats:
      if len(group)==1:
        filt_q = filt_q & Q('term', cats=group[0])
      elif len(group) > 1:
        # perform an OR filter among the different categories in this group                
        filt_q = filt_q & Q('terms', cats=group)

    return filt_q

def prim_filter(prim_cat):
    filt_q = Q()
    if prim_cat is not "any":
      filt_q = Q('term', primary_cat=prim_cat)
    return filt_q

def time_filter(time):
  filt_q = Q()
  if time == "all":
    return filt_q
  if time in ["3days" , "week" , "day" , "month" , "year"]:
      filt_q = filt_q & getTimeFilterQuery(time)
  else:
      filt_q = filt_q &  Q('range', updated={'gte': time['start'] })
      filt_q = filt_q &  Q('range', updated={'lte': time['end'] })
  return filt_q

def ver_filter(v1):
    filt_q = Q()
    if v1:
      filt_q = filt_q & Q('term', paper_version=1)
    return filt_q

def lib_filter(only_lib):
    filt_q = Q()
    if only_lib:
      # filt_q = Q('ids', type="paper", values= papers_from_library())
      pids = ids_from_library()
      if pids:
        filt_q = Q('bool', filter=[Q('terms', _id=pids)])
      # filt_q = filt_q & Q('term', paper_version=1)
    return filt_q

def extract_query_params(query_info):
  query_info = sanitize_query_object(query_info)
  search = Search(using=es, index='arxiv')
  SORT_QUERY = 1
  SORT_LIB = 2
  SORT_DATE = 3

  # author stuff not implemented yet
  sort_auth = False

  #step 1: determine sorting
  sort = SORT_DATE  
  if 'query' in query_info:
    if query_info['query'].strip() is not '':
      sort = SORT_QUERY
  if 'sort' in query_info:
    if query_info['sort'] == "relevance":
      sort = SORT_LIB
    elif query_info['sort'] == "date":
      sort = SORT_DATE
    elif (query_info['sort'] == "query") and (query_info['query'].strip() is not ''):
      sort = SORT_QUERY
  
  if 'author' in query_info:
    if query_info['author'].strip() is not '':
      sort_auth = True

  # add filters
  Q_lib = Q()
  if 'only_lib' in query_info:
    Q_lib =  lib_filter(query_info['only_lib'])
    
  Q_cat = Q()
  if 'category' in query_info:
    Q_cat = cat_filter(query_info['category'])
  
  Q_prim = Q()
  if 'primaryCategory' in query_info:
    Q_prim = prim_filter(query_info['primaryCategory'])

  Q_time = Q()
  if 'time' in query_info:
    Q_time = time_filter(query_info['time'])
    
  Q_v1 = Q()
  if 'v1' in query_info:
    Q_v1= ver_filter(query_info['v1'])

  
  # add sorting
  if sort == SORT_QUERY:
    q = query_info['query'].strip()
    search = search.query("simple_query_string", query=q, default_operator = "AND", \
      fields=['title','abstract', 'fulltext', 'all_authors', '_id'])
    print(search.to_dict())
  elif sort == SORT_DATE:
    search = search.sort('-updated')
  elif sort == SORT_LIB:
    search = add_rec_query(search)
    print("sorting by relevance")

  return search, Q_cat, Q_prim, Q_time, Q_v1, Q_lib

def build_query(query_info):
  search, Q_cat, Q_prim, Q_time, Q_v1, Q_lib = extract_query_params(query_info)
  # add filters
  search = search.filter(Q_cat & Q_prim & Q_time & Q_v1 & Q_lib)
  
  return search

def add_counts_aggs(search, Q_cat, Q_prim, Q_time, Q_v1, Q_lib):
  Q_lib_on =  lib_filter(True)
  
  # define and add the aggregations, each filtered by all the filters except
  # variables corresopnding to what the aggregation is binning over
  prim_agg = A('terms', field='primary_cat')
  prim_filt = A('filter', filter=(Q_cat & Q_time & Q_v1 & Q_lib) )
  search.aggs.bucket("prim_filt",prim_filt).bucket("prim_agg", prim_agg)

  year_filt = A('filter', filter = (Q_cat & Q_prim & Q_v1 & Q_lib))
  year_agg = A('date_histogram', field='published', interval="year")
  search.aggs.bucket('year_filt', year_filt).bucket('year_agg', year_agg)

  in_filt = A('filter', filter=(Q_cat & Q_prim & Q_time & Q_v1 & Q_lib))
  in_agg = A('terms', field='cats')
  search.aggs.bucket('in_filt', in_filt).bucket('in_agg',in_agg)

  time_filt = A('filter', filter = (Q_cat & Q_prim & Q_v1 & Q_lib))
  cutoffs = getTimesForFilters()
  time_agg = A('date_range', field='updated', ranges = [{"to" : "now", "key" : "alltime"}, \
                                                              {"from" : cutoffs["year"], "key" : "year"}, \
                                                              {"from" : cutoffs["month"], "key" : "month"}, \
                                                              {"from" : cutoffs["week"], "key" : "week"}, \
                                                              {"from" : cutoffs["3days"], "key" : "3days"}, \
                                                              {"from" : cutoffs["day"], "key" : "day"}])
  search.aggs.bucket('time_filt', time_filt).bucket('time_agg', time_agg)

  lib_filt =  A('filter', filter=(Q_cat & Q_prim & Q_time & Q_v1 & Q_lib))
  lib_agg = A('filters', filters= {"in_lib" : Q_lib_on, "out_lib": ~(Q_lib_on)})
  search.aggs.bucket('lib_filt', lib_filt).bucket('lib_agg', lib_agg)

  return search


def build_slow_meta_query(query_info):
  search, Q_cat, Q_prim, Q_time, Q_v1, Q_lib = extract_query_params(query_info)  
  sig_filt =  A('filter', filter=(Q_cat & Q_prim & Q_time & Q_v1 & Q_lib))

  sampler_agg = A('sampler', shard_size=200)

  auth_agg = A('significant_terms', field='authors')

  search.aggs.bucket('sig_filt', sig_filt).bucket('sampler_agg', sampler_agg).bucket('auth_agg', auth_agg)

  keywords_agg = A('significant_terms', field='abstract')
  
  search.aggs['sig_filt']['sampler_agg'].bucket('keywords_agg', keywords_agg)

  return search

def build_meta_query(query_info):
  search, Q_cat, Q_prim, Q_time, Q_v1, Q_lib = extract_query_params(query_info)
  search = add_counts_aggs(search, Q_cat, Q_prim, Q_time, Q_v1, Q_lib)
  return search

def parse_author_name(name_in):
  name_out = re.sub('(\(.*$)|(\(.*?\))', '', name_in)
  name_out = re.sub('^.*?\)', '', name_out)
  name_out = name_out.strip()
  # if name_out is not name_in:
    # print(name_in)
    # print(name_out)
  return name_out

def get_meta_from_response(response):
  meta = {}
  if "aggregations" in response:
    if "sig_filt" in response.aggregations:
      if "sampler_agg" in response.aggregations.sig_filt:
        if "auth_agg" in response.aggregations.sig_filt.sampler_agg:
          auth_data = {}      
          for buck in response.aggregations.sig_filt.sampler_agg.auth_agg.buckets:
            name = parse_author_name(buck.key)
            score = buck.score
            if name is not '':
              auth_data[name] = score
          meta["auth_data"] = auth_data
        if "keywords_agg" in response.aggregations.sig_filt.sampler_agg:
          keyword_data = {}
          for buck in response.aggregations.sig_filt.sampler_agg.keywords_agg.buckets:
            keyword = buck.key
            keyword_data[keyword] = buck.score
          meta["keyword_data"] = keyword_data
    if "lib_filt" in response.aggregations:
      bucks = response.aggregations.lib_filt.lib_agg.buckets
      lib_data = {"in_lib" : bucks.in_lib.doc_count, "out_lib" : bucks.out_lib.doc_count}
      meta["lib_data"] = lib_data

    if "year_filt" in response.aggregations:
      date_hist_data = {}
      for x in response.aggregations.year_filt.year_agg.buckets:
        timestamp = round(x.key/1000)
        num_results = x.doc_count
        date_hist_data[timestamp] = num_results
      meta["date_hist_data"] = date_hist_data

    if "prim_filt" in response.aggregations:
      prim_data = {}
      for prim in response.aggregations.prim_filt.prim_agg.buckets:
        cat = prim.key
        num_results = prim.doc_count
        prim_data[cat] = num_results
      meta["prim_data"] = prim_data

    if "in_filt" in response.aggregations:
      in_data = {}
      for buck in response.aggregations.in_filt.in_agg.buckets:
        cat = buck.key
        num_results = buck.doc_count
        in_data[cat] = num_results
      meta["in_data"] = in_data

    if "time_filt" in response.aggregations:
      time_filter_data = {}
      for buck in response.aggregations.time_filt.time_agg.buckets:
        time_range=buck.key
        num_results=buck.doc_count
        time_filter_data[time_range] = num_results
      meta["time_filter_data"] = time_filter_data
  return meta

@app.route('/_getmeta', methods=['POST'])
def _getmeta():
    data = request.get_json()
    query_info = data['query']
    search = build_meta_query(query_info)
    search = search[0:0]
    papers, meta = getResults(search)
    return jsonify(meta)

@app.route('/_getslowmeta', methods=['POST'])
def _getslowmeta():
    # data = request.get_json()
    # query_info = data['query']
    # search = build_slow_meta_query(query_info)
    # search = search[0:0]
    # papers, meta = getResults(search)
    meta = {'abc' : 'def'}
    
    return jsonify(meta)

def testmeta(query_info):
  search = build_meta_query(query_info)
  search = search[0:0]
  papers, meta = getResults(search)
  print("meta:")
  print(meta)
  # print("meta-papers:")
  # print(papers)
  # print("meta-meta:")    
  # print(meta)

def testslowmeta(query_info):
  search = build_slow_meta_query(query_info)
  search = search[0:0]
  papers, meta = getResults(search)
  print("slowmeta:")
  print(meta)

@app.route('/_getpapers', methods=['POST'])
def _getpapers():
  print("getting papers")
  data = request.get_json()
  start = data['start_at']
  number = data['num_get']
  dynamic = data['dyn']
  query_info = data['query']

  #need to build the query from the info given here
  search = build_query(query_info)

  search = search.source(includes=['havethumb','rawid','paper_version','title','primary_cat', 'authors', 'link', 'abstract', 'cats', 'updated', 'published','arxiv_comment'])
  search = search[start:start+number]

  tot_num_papers = search.count()
  # print(tot_num_papers)
  log_dict = {}
  log_dict.update(search= search.to_dict())
  log_dict.update(client_ip = request.remote_addr)
  log_dict.update(client_route = request.access_route)
  if 'X-Real-IP' in request.headers:
    log_dict.update(client_x_real_ip = request.headers['X-Real-IP'])

  access_log.info("ES search request", extra=log_dict )
  # access_log.info(msg="ip %s sent ES search fired: %s" % search.to_dict())
  papers, meta = getResults(search)
  scored_papers = 0
  tot_score = 0
  max_score = 0
  for p in papers:
    if "score" in p:
      scored_papers +=1
      tot_score += p["score"]
      if p["score"] > max_score:
        max_score = p["score"]
  if scored_papers > 0:
    avg_score = tot_score/scored_papers
    print("avg_score")
    print(avg_score)
    print("max_score")
    print(max_score)
  print('done papers')
  # testmeta(query_info)
  # testslowmeta(query_info)
  return jsonify(dict(papers=papers,dynamic=dynamic, start_at=start, num_get=number, tot_num_papers=tot_num_papers))


#----------------------------------------------------------------
# Sanitize data from the client
#----------------------------------------------------------------

# from
# https://gist.github.com/eranhirs/5c9ef5de8b8731948e6ed14486058842
def sanitize_string(text):
  # Escape special characters
  # http://lucene.apache.org/core/old_versioned_docs/versions/2_9_1/queryparsersyntax.html#Escaping Special Characters
  text = re.sub('([{}])'.format(re.escape('\\+\-&|!(){}\[\]^~*?:\/')), r"\1", text)

  # AND, OR and NOT are used by lucene as logical operators. We need
  # to escape them
  for word in ['AND', 'OR', 'NOT']:
      if word is 'AND':
        escaped_word = "+"
      elif word is "OR":
        escaped_word = "|"
      elif word is "NOT":
        escaped_word = "-"
      # escaped_word = "".join(["\\" + letter for letter in word])
      text = re.sub(r'\s*\b({})\b\s*'.format(word), r" {} ".format(escaped_word), text)

  # text = re.sub( r"\-(?=\w)", r"+-", text)

  
  # Escape odd quotes
  quote_count = text.count('"')
  return re.sub(r'(.*)"(.*)', r'\1\"\2', text) if quote_count % 2 == 1 else text



def san_dict_value(dictionary, key, typ, valid_options):
    if key in dictionary:
      value = dictionary[key]
      if not isinstance(value, typ):
        dictionary.pop(key, None)
        # print("popped value")
        # print(value)
      elif not (value in valid_options):
        dictionary.pop(key,None)
        # print("popped value")
        # print(value)
    return dictionary

def san_dict_bool(dictionary, key):
    if key in dictionary:
      value = dictionary[key]
      if not isinstance(value, bool):
        dictionary.pop(key, None)
    return dictionary

def san_dict_str(dictionary, key):
    if key in dictionary:
      value = dictionary[key]
      if not isinstance(value, str):
        dictionary.pop(key, None)
      else:
        dictionary[key] = sanitize_string(value)
    return dictionary

def san_dict_int(dictionary, key):
    if key in dictionary:
      value = dictionary[key]
      if not isinstance(value, int):
        dictionary.pop(key, None)
    return dictionary

def san_dict_keys(dictionary, valid_keys):
  dictionary = { key: dictionary[key] for key in valid_keys if key in dictionary}
  return dictionary

def valid_list_of_cats(group):
  valid_list = True
  if not isinstance(group, list):
    valid_list = False
  else:
    valid_list = all( [g in ALL_CATEGORIES for g in group])
  return valid_list

def sanitize_query_object(query_info):
  valid_keys = ['query', 'sort', 'category', 'time', 'primaryCategory', 'author','v1', 'only_lib']
  query_info = san_dict_keys(query_info, valid_keys)

  if 'category' in query_info:
    cats = query_info['category']
    if not isinstance(cats,list):
      query_info.pop('category')
    for group in cats:
      if not valid_list_of_cats(group):
        cats.remove(group)


  query_info = san_dict_value(query_info, 'primaryCategory', str, ALL_CATEGORIES)

  query_info = san_dict_str(query_info, 'query')

  query_info = san_dict_str(query_info, 'author')

  query_info = san_dict_value(query_info, 'sort', str, ["relevance","date", "query"])

  query_info = san_dict_value(query_info, 'primaryCategory', str, ALL_CATEGORIES)
  
  query_info = san_dict_bool(query_info, 'only_lib')
  
  query_info = san_dict_bool(query_info, 'v1')
  
  if 'time' in query_info:
    time = query_info['time']
    if isinstance(time, dict):
        time = san_dict_keys(time, ['start','end'])
        time = san_dict_int(time, 'start')
        time = san_dict_int(time, 'end')
        if not ( ('start' in time) and ('end' in time)):
          query_info.pop('time',None)
    else:
      valid_times = ["3days" , "week" , "day" , "all" , "month" , "year"]
      query_info = san_dict_value(query_info, 'time', str, valid_times)
  return query_info

#--------------------------------------------------------
# Caching
#--------------------------------------------------------

def make_hash(o):

  """
  Makes a hash from a dictionary, list, tuple or set to any level, that contains
  only other hashable types (including any lists, tuples, sets, and
  dictionaries).
  """

  if isinstance(o, (set, tuple, list)):

    return tuple([make_hash(e) for e in o])    

  elif not isinstance(o, dict):

    return hash(o)

  new_o = copy.deepcopy(o)
  for k, v in new_o.items():
    new_o[k] = make_hash(v)

  return hash(tuple(frozenset(sorted(new_o.items()))))



def process_query_to_cache(query_hash, es_response, meta):
  list_of_ids = []

  for record in es_response:
    
    _id = record.meta.id

    list_of_ids.append(_id)
    with cached_docs_lock:
      if _id not in cached_docs:
        cached_docs[_id] = encode_hit(record)


  with cached_queries_lock:
    cached_queries[query_hash] =  dict(list_of_ids=list_of_ids,meta=meta)

  return list_of_ids



def addUserSearchesToCache():
  if AUTO_CACHE:
    # if 'user_id' not in session:
      # return False
    if not g.user:
      return False
    
    uid = session['user_id']
    with list_of_users_lock:
      if uid in list_of_users_cached:
        return False
      print('adding user %d to cache' % uid)
      list_of_users_cached.append(uid)
    ttstrs = {'day', '3days', 'week', 'month', 'alltime','none'}

    # search = Search(using=es, index="arxiv")

    svm = papers_from_svm()
    if svm:
      searches = [svm, svm.filter('term', paper_version=1)]
      pages = [(0,10)]
      for s in searches:
        for p in pages:
            for ttstr in ttstrs:
              s2 = applyTimeFilter(s,ttstr)
              s2 = s2.source(includes=['havethumb','rawid','paper_version','title','primary_cat', 'authors', 'link', 'abstract', 'cats', 'updated', 'published','arxiv_comment'])
              s2 = s2[p[0]:p[1]]
              async_add_to_cache(s2)

    lib = papers_from_library()
    if lib:
      searches = [lib.sort('-updated')]
      pages = [(0,10),(10,15),(15,20),(20,25)]
      for s in searches:
        for p in pages:
          s2 = s.source(includes=['havethumb','rawid','paper_version','title','primary_cat', 'authors', 'link', 'abstract', 'cats', 'updated', 'published','arxiv_comment'])
          s2 = s2[p[0]:p[1]]
          async_add_to_cache(s2)
  return AUTO_CACHE

def addDefaultSearchesToCache():
  if AUTO_CACHE:
    search = Search(using=es, index="arxiv")
    ttstrs = {'day', '3days', 'week', 'month', 'year', 'alltime', 'none'}
    searches = [search.sort('-updated'), search.filter('term', paper_version=1).sort('-published')]
    pages = [(0,10),(10,15),(15,20),(20,25),(25,30),(35,40),(45,50)]
    for s in searches:
      for p in pages:
        for ttstr in ttstrs:
          s2 = applyTimeFilter(s,ttstr)
          s2 = s2.source(includes=['havethumb','rawid','paper_version','title','primary_cat', 'authors', 'link', 'abstract', 'cats', 'updated', 'published','arxiv_comment'])
          s2 = s2[p[0]:p[1]]
          async_add_to_cache(s2)
  return AUTO_CACHE
 

def async_add_to_cache(search):
  search_dict = search.to_dict()
  query_hash = make_hash(search_dict)
  with cached_queries_lock:
    check_in  = query_hash in cached_queries
  if not check_in:
    t = threading.Thread(target=add_to_cache, args=(query_hash, search), daemon=True)
    t.start()




def add_to_cache(query_hash, search):
  with es_query_semaphore:
    es_response = search.execute()
  meta = get_meta_from_response(es_response)
  process_query_to_cache(query_hash, es_response, meta)


@app.route('/_invalidate_cache')
def _invalidate_cache():
  secret = request.args.get('secret', False)
  if secret == cache_key:
    print('successfully invalidated cache')
    flash('successfully invalidated cache')
    global cached_queries
    with cached_queries_lock:
      cached_queries = {}
    global list_of_users_cached
    with list_of_users_lock:
      list_of_users_cached = []

    global cached_docs
    with cached_docs_lock:
      cached_docs = {}
    addDefaultSearchesToCache()

  return redirect(url_for('intmain'))

#-------------------------------------------------
# Old search functions
#-------------------------------------------------

def countpapers():
  s = Search(using=es, index="arxiv")
  return s.count()

# def getrecentpapers():
#   session['recent_sort'] = True
#   s = Search(using=es, index="arxiv")
#   return s




def getpapers(pidlist):
  search = Search(using = es, index='arxiv').update_from_dict({'query': {
      "ids" : {
        "type" : "paper",
        "values" : pidlist
    }
    }
  })
  session['recent_sort'] = True
  # print(pidlist)
  return search


def getpaper(pid):
  return Search(using=es, index="arxiv").query("match", _id=pid)

def isvalid(pid):
  return not (getpaper(pid).count() == 0)


def makepaperdict(pid):
    d = {
        "_index" : 'arxiv',
        "_type" : 'paper',
        "_id" : pid
    }
    return d

def add_papers_similar_query(search, pidlist):
  session['recent_sort'] = False
  dlist = [ makepaperdict(strip_version(v)) for v in pidlist ]
  if pidlist:
    q = Q("more_like_this", like=dlist, fields=['fulltext', 'title', 'abstract', 'all_authors'], include=False)
    mlts=search.query(q)
    # mlts = search.update_from_dict({'query': {
    # "more_like_this" : {
    # "fields" : ['fulltext', 'title', 'abstract', 'all_authors'],
    # "include" : False,
    # "like" : dlist,
    #  }
    #  }
    # })
  else:
    mlts = search
  return mlts


def papers_similar_to_list_query(pidlist):
  session['recent_sort'] = False
  dlist = [ makepaperdict(strip_version(v)) for v in pidlist ]
  if pidlist:
    mlts = Search(using = es, index='arxiv').update_from_dict({'query': {
    "more_like_this" : {
    "fields" : ['fulltext', 'title', 'abstract', 'all_authors'],
    "include" : False,
    "like" : dlist,
     }
     }
    })
  else:
    mlts = []
  return mlts


def papers_similar(vpid):
  pid = strip_version(vpid)
  mlts = Search(using = es, index='arxiv').update_from_dict({'query': {
    "more_like_this" : {
    "fields" : ['fulltext', 'title', 'abstract', 'all_authors'],
    "include" : True,
    "like" : [makepaperdict(pid)],
     }
   }
  })
  session['recent_sort'] = False

  return mlts

def ids_from_library():
  if g.libids:
    out = g.libids
  else:
    out = None
  # print(out) 
  return out

def papers_from_library():
  if g.libids:
    out = getpapers(g.libids)
  else:
    out = None
    # out = sorted(out, key=lambda k: k['updated'], reverse=True)
  return out


def add_rec_query(search):
  # libids = []
  if g.libids:
    out = add_papers_similar_query(search, g.libids)
  else:
    out = search
  return out


def papers_from_svm():
  # libids = []
  if g.libids:
    out = papers_similar_to_list_query(g.libids)
  else:
    out = None
  return out


#---------------------------------------------
# Old pages and endpoints
#----------------------------------------


def default_context(**kws):
  
  num_hits = 0
  session['search_obj'] = {}
  first_papers = dict(papers={},dynamic=False)
  
  tot_papers = countpapers()
  if 'msg' in kws:
    if kws['msg'] == 'Most recent papers:':
      kws['msg'] = 'Most recent papers (%d):' % num_hits
    if kws['msg'] == 'Sorting by personalized relevance:':
      kws['msg'] = 'Sorting by personalized relevance (%d):' % num_hits
  ans = dict(first_papers=first_papers,numresults=num_hits, totpapers=tot_papers, tweets=[], msg='', show_prompt=False, pid_to_users={}, user_features = user_features, user_interactivity = user_interactivity)
  ans.update(kws)
  return ans

@app.route("/")
def intmain():
  ctx = default_context(render_format='recent',
                        msg='Most recent papers:')
  return render_template('main.html', **ctx)


@app.route("/<request_cat>/<request_pid>")
def rankold(request_cat,request_pid):
  request_pid =  request_cat+"/"+request_pid
  if not isvalidid(request_pid):
    return '' # these are requests for icons, things like robots.txt, etc
  search = papers_similar(request_pid)
  ctx = default_context(render_format='paper')
  return render_template('main.html', **ctx)

@app.route("/<request_pid>")
def rank(request_pid=None):
  if not isvalidid(request_pid):
    return '' # these are requests for icons, things like robots.txt, etc
  search = papers_similar(request_pid)
  ctx = default_context(render_format='paper')
  return render_template('main.html', **ctx)




#------------------------------------------------- 
# Recs and account
#------------------------------------------------- 
@app.route('/recommend', methods=['GET'])
def recommend():
  ctx = default_context(render_format='recommend',
                        msg='Sorting by personalized relevance:' if g.user else 'You must be logged in and have some papers saved in your library.')
  return render_template('main.html', **ctx)

@app.route('/library')
def library():
  """ render user's library """
  papers = papers_from_library()
  # papers = papers.source(includes=['rawid','paper_version','title','primary_cat', 'authors', 'link', 'abstract', 'cats', 'updated', 'published','arxiv_comment'])

  num_papers = papers.count()
  if g.user:
    msg = '%d papers in your library:' % (num_papers, )
  else:
    msg = 'You must be logged in. Once you are, you can save papers to your library (with the save icon on the right of each paper) and they will show up here.'
  ctx = default_context(render_format='library', msg=msg)
  return render_template('main.html', **ctx)

@app.route('/libtoggle', methods=['POST'])
def review():
  """ user wants to toggle a paper in his library """
  
  # make sure user is logged in
  if not g.user:
    return 'FAIL' # fail... (not logged in). JS should prevent from us getting here.
  data = request.get_json()
  idvv = data['pid'] # includes version
  if not isvalidid(idvv):
    return 'FAIL' # fail, malformed id. weird.
  pid = strip_version(idvv)
  if not isvalid(pid):
    return 'FAIL' # we don't know this paper. wat

  uid = session['user_id'] # id of logged in user

  # check this user already has this paper in library
  record = query_db('''select * from library where
          user_id = ? and paper_id = ?''', [uid, pid], one=True)
  # print(record)

  ret = "FAIL"
  if record:
    # record exists, erase it.
    g.db.execute('''delete from library where user_id = ? and paper_id = ?''', [uid, pid])
    g.db.commit()
    #print('removed %s for %s' % (pid, uid))
    ret = False
  else:
    # record does not exist, add it.
    rawpid = strip_version(pid)
    g.db.execute('''insert into library (paper_id, user_id, update_time) values (?, ?, ?)''',
        [rawpid, uid, int(time.time())])
    g.db.commit()

    #print('added %s for %s' % (pid, uid))
    ret = True
  
  with list_of_users_lock:
    if uid in list_of_users_cached:
      list_of_users_cached.remove(uid)
  update_libids()
  addUserSearchesToCache()

  return jsonify(dict(on=ret))


@app.route('/account')
def account():
  return library()
  # library()
    # ctx = { 'totpapers': countpapers() }
#     followers = []
#     following = []
#     # fetch all followers/following of the logged in user
#     if g.user:
#         username = get_username(session['user_id'])
        
#         # following_db = list(follow_collection.find({ 'who':username }))
#         # for e in following_db:
#             # following.append({ 'user':e['whom'], 'active':e['active'] })
# # 
#         # followers_db = list(follow_collection.find({ 'whom':username }))
#         # for e in followers_db:
#             # followers.append({ 'user':e['who'], 'active':e['active'] })
# # 
#     ctx['followers'] = followers
#     ctx['following'] = following
#     return render_template('account.html', **ctx)


@app.route('/login', methods=['POST'])
def login():
  """ logs in the user. if the username doesn't exist creates the account """
  
  if not request.form['username']:
    flash('You have to enter a username')
  elif not request.form['password']:
    flash('You have to enter a password')
  elif get_user_id(request.form['username']) is not None:
    # username already exists, fetch all of its attributes
    user = query_db('''select * from user where
          username = ?''', [request.form['username']], one=True)
    if check_password_hash(user['pw_hash'], request.form['password']):
      # password is correct, log in the user
      session['user_id'] = get_user_id(request.form['username'])
      added = addUserSearchesToCache()
      if added:
        print('addUser fired')
      flash('User ' + request.form['username'] + ' logged in.')
    else:
      # incorrect password
      flash('User ' + request.form['username'] + ' already exists, wrong password.')
  else:
    # create account and log in
    creation_time = int(time.time())
    g.db.execute('''insert into user (username, pw_hash, creation_time) values (?, ?, ?)''',
      [request.form['username'], 
      generate_password_hash(request.form['password']), 
      creation_time])
    user_id = g.db.execute('select last_insert_rowid()').fetchall()[0][0]
    g.db.commit()

    session['user_id'] = user_id
    flash('New account %s created' % (request.form['username'], ))
  
  return redirect(url_for('intmain'))

@app.route('/logout')
def logout():
  session.pop('user_id', None)
  flash('You were logged out')
  return redirect(url_for('intmain'))

@app.route('/static/<path:path>')
def send_static(path):
    return send_from_directory('static', path)




@app.route('/goaway', methods=['POST'])
def goaway():
  if not g.user: return # weird
  uid = session['user_id']
  entry = goaway_collection.find_one({ 'uid':uid })
  if not entry: # ok record this user wanting it to stop
    username = get_username(session['user_id'])
    print('adding', uid, username, 'to goaway.')
    goaway_collection.insert_one({ 'uid':uid, 'time':int(time.time()) })
  return 'OK'

#--------------------------------
# Times and time filters
#--------------------------------

def getNextArXivPublishCutoff(time):
  dow = time.weekday()

  # Most days of the week, either go to 18h later that day, or 18h the next day 
  if dow == 0 or dow == 1 or dow == 2 or dow == 3:
    cutoff = time.replace(hour=14,minute=0,second=0,microsecond=0)
    if cutoff < time:
      cutoff = cutoff +  timedelta(days=1)

  # Friday morning, go to Friday night. Friday > 14h, go to Monday 14h.
  if dow == 4:
    cutoff = time.replace(hour=14,minute=0,second=0,microsecond=0)
    if cutoff < time:
      cutoff = cutoff +  timedelta(days=3)

  if dow == 5:
    # any time on Saturday, go back to 14h on Monday
    cutoff = time.replace(hour=14,minute=0,second=0,microsecond=0) +  timedelta(days=2)

  if dow == 6:
    # any time on Sunday, go back to 14h on Monday
    cutoff = time.replace(hour=14,minute=0,second=0,microsecond=0) +  timedelta(days=1)
  return cutoff


def getLastArXivPublishCutoff(time):
  dow = time.weekday()

  # Most days of the week, either go to 18h earlier, or 18h the day before
  if dow == 1 or dow == 2 or dow == 3 or dow == 4:
    cutoff = time.replace(hour=14,minute=0,second=0,microsecond=0)
    if cutoff > time:
      cutoff = cutoff +  timedelta(days=-1)

  # Monday morning, go back to Friday night. Monday > 14h, go to Monday 14h.
  if dow == 0:
    cutoff = time.replace(hour=14,minute=0,second=0,microsecond=0)
    if cutoff > time:
      cutoff = cutoff +  timedelta(days=-3)

  if dow == 5:
    # any time on Saturday, go back to 14h on Friday
    cutoff = time.replace(hour=14,minute=0,second=0,microsecond=0) +  timedelta(days=-1)

  if dow == 6:
    # any time on Sunday, go back to 14h on Friday
    cutoff = time.replace(hour=14,minute=0,second=0,microsecond=0) +  timedelta(days=-2)
  return cutoff

def getLastCutoffs():
  tz = timezone('America/New_York')
  now = datetime.now(tz)
  global arxiv_invalidation_time
  if now > arxiv_invalidation_time:
    cutoffs = []
    cutoffs.append(getLastArXivPublishCutoff(now))
    for j in range(1,10):
      cutoffs.append(getLastArXivPublishCutoff(cutoffs[-1] + timedelta(hours=-1)))
    
    arxiv_invalidation_time = getNextArXivPublishCutoff(now)

    global arxiv_cutoffs
    arxiv_cutoffs= cutoffs

  else:
    cutoffs = arxiv_cutoffs
  # print('--------')
  # for c in cutoffs:
  #   rendered_str = '%s %s %s' % (c.day, c.strftime('%b'), c.year)
  #   print(rendered_str)

  # print('--------')

  return cutoffs

def getTimesForFilters():
  legend = {'day':1, '3days':3, 'week':5, 'month':30, 'year':365}  
  cutoffs = {}
  for day,cutoff in legend.items():
    cutoffs[day] = get_time_for_days_ago(cutoff)
  return cutoffs


def get_time_for_days_ago(days):
  
  now = datetime.now(tzutc())

  if days < 10:
    cutoffs= getLastCutoffs()

    cutoff = cutoffs[days+1]
  else:
    # account for published vs announced
    back = now + timedelta(days=-1) +timedelta(days=-1*days)

    back18 = back.replace(hour=18,minute=0,second=0,microsecond=0)
    if back > back18:
      back = back18
    if back < back18:
      back = back18 + timedelta(days=-1)
    cutoff = back+ timedelta(seconds = -1)
  time_cutoff = round(cutoff.timestamp()* 1000)
  
  return time_cutoff

  

def getTimeFilterQuery(ttstr) :
  legend = {'day':1, '3days':3, 'week':5, 'month':30, 'year':365}

  if ttstr not in legend:
    return Q()
  # legend = {'new':1, 'recent':5, 'week':7, 'month':30, 'year':365}

  tt = legend.get(ttstr, 7)
  time_cutoff = get_time_for_days_ago(tt)
  
  return Q('range', updated={'gte': time_cutoff })

def applyTimeFilter(search, ttstr):
  return search.post_filter(getTimeFilterQuery(ttstr))



# -----------------------------------------------------------------------------
# int main
# -----------------------------------------------------------------------------
if __name__ == "__main__":

  now = datetime.now(tzutc())
  arxiv_invalidation_time = now
  arxiv_cutoffs= []
  getLastCutoffs()
  


  parser = argparse.ArgumentParser()
  # parser.add_argument('-p', '--prod', dest='prod', action='store_true',  help='run in prod?')
  parser.add_argument('-r', '--num_results', dest='num_results', type=int, default=200, help='number of results to return per query')
  parser.add_argument('--port', dest='port', type=int, default=8500, help='port to serve on')
  args = parser.parse_args()
  print(args)

  if not os.path.isfile(Config.database_path):
    print('did not find as.db, trying to create an empty database from schema.sql...')
    print('this needs sqlite3 to be installed!')
    os.system('sqlite3 as.db < schema.sql')



  print('connecting to elasticsearch...')
  es = Elasticsearch(
   ["https://%s:%s@%s:9243" % (ES_USER,ES_PASS,es_host)], scheme="https", verify_certs=False) 
  # print(es.info())
  # m = Mapping.from_es('arxiv', 'paper', using=es)
  # print(m.authors)

  ES_log_handler = CMRESHandler(hosts=[{'host': es_host, 'port': 80}],
                           auth_type=CMRESHandler.AuthType.AWS_SIGNED_AUTH, aws_access_key= log_AWS_ACCESS_KEY,
                           aws_secret_key=log_AWS_SECRET_KEY,aws_region='us-east-1',index_name_frequency=CMRESHandler.IndexNameFrequency.MONTHLY,
                           es_index_name="logs")
  comments = []
  tags_collection = []
  goaway_collection = []
  follow_collection = []
  cached_docs = {}
  cached_queries = {}
  max_connections = 2
  es_query_semaphore = threading.BoundedSemaphore(value=max_connections)
  cached_queries_lock = threading.Lock()
  cached_docs_lock = threading.Lock()

  list_of_users_cached = []
  list_of_users_lock = threading.Lock()

  addDefaultSearchesToCache()
  

  # start
  # if args.prod:
    # run on Tornado instead, since running raw Flask in prod is not recommended


  print('starting tornado!')
  from tornado.wsgi import WSGIContainer
  from tornado.httpserver import HTTPServer
  from tornado.ioloop import IOLoop
  from tornado.log import enable_pretty_logging
  from tornado.log import logging
  from tornado.options import options
  from tornado import autoreload
  class RequestFormatter(logging.Formatter):
    def format(self, record):
        record.url = request.url
        record.remote_addr = request.remote_addr
        return super().format(record)
  formatter = RequestFormatter(
    '[%(asctime)s] %(remote_addr)s requested %(url)s\n'
    '%(levelname)s in %(module)s: %(message)s')
  # app.debug = False
  options.log_file_prefix = "tornado.log"
  # options.logging = "debug"
  enable_pretty_logging()
  # logging.debug("testlog")
  logging.basicConfig(level=logging.INFO)
  access_log = logging.getLogger("tornado.access")
  access_log.setLevel(logging.INFO)

  access_log.addHandler(ES_log_handler)
  access_log.info("test log")
  # watchtower_request_handler.setFormatter(formatter)

  app_log = logging.getLogger("tornado.application")
  gen_log = logging.getLogger("tornado.general")
  # access_log.addHandler(watchtower_handler)
  # access_log.addHandler(watchtower_request_handler)
  app_log.addHandler(ES_log_handler)
  gen_log.addHandler(ES_log_handler)

  http_server = HTTPServer(WSGIContainer(app))
  http_server.listen(args.port, address='127.0.0.1')
  autoreload.start()
  for dir, _, files in os.walk(server_dir('templates')):
        [autoreload.watch(dir + '/' + f) for f in files if not f.startswith('.')]
  for dir, _, files in os.walk(os.path.join('..','static')):
        [autoreload.watch(dir + '/' + f) for f in files if not f.startswith('.')]
  IOLoop.instance().start()



  # # else:
  # print('starting flask!')
  # app.debug = True
  # app.run(port=args.port, host='127.0.0.1')
