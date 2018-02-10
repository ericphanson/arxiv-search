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
from elasticsearch_dsl import Search, Q, A
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

# -----------------------------------------------------------------------------
# search/sort functionality
# -----------------------------------------------------------------------------

# class ArxivDateFacet(Facet):
#     agg_type = 'date_histogram'

#     DATE_INTERVALS = {
#         'alltime': lambda d: _getCutoff(d,'alltime'),
#         'month': lambda d: _getCutoff(d,'month'),
#         'week': lambda d: _getCutoff(d,'week'),
#         '3days': lambda d: _getCutoff(d,'3days'),
#         'day': lambda d: _getCutoff(d,'day'),
#     }

#     def _getCutoff(now, ttstr):
#       legend = {'day':1, '3days':3, 'week':7, 'month':30, 'year':365, 'alltime':10000}
#       tt = legend.get(ttstr, 7)
#       # account for published vs announced
#       back = now + timedelta(days=-1) +timedelta(days=-1*tt)
#       back18 = back.replace(hour=18,minute=0,second=0,microsecond=0)
#       if back > back18:
#         back = back18
#       if back < back18:
#         back = back18 + timedelta(days=-1)
#       back = back+ timedelta(seconds = -1)
#       time_cutoff = round(back.timestamp()* 1000)
#       return time_cutoff

#     def __init__(self, **kwargs):
#         kwargs.setdefault("min_doc_count", 0)
#         super(DateHistogramFacet, self).__init__(**kwargs)

#     def get_value(self, bucket):
#         if not isinstance(bucket['key'], datetime):
#             # Elasticsearch returns key=None instead of 0 for date 1970-01-01,
#             # so we need to set key to 0 to avoid TypeError exception
#             if bucket['key'] is None:
#                 bucket['key'] = 0
#             return datetime.utcfromtimestamp(int(bucket['key']) / 1000)
#         else:
#             return bucket['key']

#     def get_value_filter(self, filter_value):
#         return Q('range', **{
#             self._params['field']: {
#                 'gte': filter_value,
#                 'lt': self.DATE_INTERVALS[self._params['interval']](filter_value)
#             }
#         })  


# def getTimeCutoff(ttstr):
#       now = datetime.now(tzutc())
#       legend = {'day':1, '3days':3, 'week':7, 'month':30, 'year':365, 'alltime':10000}
#       tt = legend.get(ttstr, 7)
#       # account for published vs announced
#       back = now + timedelta(days=-1) +timedelta(days=-1*tt)
#       back18 = back.replace(hour=18,minute=0,second=0,microsecond=0)
#       if back >= back18:
#         back = back18
#       if back < back18:
#         back = back18 + timedelta(days=-1)
#       # back = back+ timedelta(seconds = -1)
#       time_cutoff = round(back.timestamp()* 1000)
#       return time_cutoff, round(now.timestamp()*1000)

# class ArxivSearch(FacetedSearch):
#     # doc_types = [papers, ]
#     # fields that should be searched
#     fields = ['title','summary', 'fulltext', 'all_authors', '_id']

#     recent_ranges = [
#           (legend, (getTimeCutoff(legend)[0], getTimeCutoff(legend)[1]))
#           for legend in ['day', '3days', 'week', 'month', 'year', 'alltime'] ]
#     facets = {
#         # use bucket aggregations to define facets
#         'cats': TermsFacet(field='tags.term.raw'),
#         'updated_hist': DateHistogramFacet(field='updated', interval='year'),
#         'published_hist': DateHistogramFacet(field='published', interval='year'),
#         'recent_updated_range' : RangeFacet(field="updated", ranges=recent_ranges),
#         'recent_published_range' : RangeFacet(field="published", ranges=recent_ranges)
#     }

#     def search(self):
#         # override methods to add custom pieces
#         s = super().search()
#         return s

# from
# https://gist.github.com/eranhirs/5c9ef5de8b8731948e6ed14486058842
def sanitize_string(text):
  # Escape special characters
  # http://lucene.apache.org/core/old_versioned_docs/versions/2_9_1/queryparsersyntax.html#Escaping Special Characters
  text = re.sub('([{}])'.format(re.escape('\\+\-&|!(){}\[\]^~*?:\/')), r"\\\1", text)

  # AND, OR and NOT are used by lucene as logical operators. We need
  # to escape them
  for word in ['AND', 'OR', 'NOT']:
      escaped_word = "".join(["\\" + letter for letter in word])
      text = re.sub(r'\s*\b({})\b\s*'.format(word), r" {} ".format(escaped_word), text)

  # Escape odd quotes
  quote_count = text.count('"')
  return re.sub(r'(.*)"(.*)', r'\1\"\2', text) if quote_count % 2 == 1 else text


def takeTokens(type_of_token, string):
  emptystr = ""
  found_tokens = []
  removes = []
  for tokens, matchstart, matchend in type_of_token.scanString(string):
    strtokens = [emptystr.join(instance) for instance in tokens.asList()]
    found_tokens.append(strtokens)
    removes.append(string[matchstart:matchend])

  temp = string
  for r in removes:
    temp =temp.replace(r,"")
  post_string = temp
  return found_tokens, post_string

def flatten_list(list_of_lists):
  return [item for sublist in list_of_lists for item in sublist]


def isTag(string):
  istag = False
  tag = Group(OneOrMore(Word(alphas) + oneOf('- .')) + Word(alphas))
  found_tokens, post_string = takeTokens(tag, string)
  if ( len(found_tokens) == 1 ):
    if post_string == "":
      istag = True
  return istag

def filter_in(q_in,search_in):
  tag = Group(OneOrMore(Word(alphas) + oneOf('- .')) + Word(alphas))

  cat = Suppress("in:") + tag
  cats = OneOrMore(cat)
  
  multcat = Suppress("in:") + OneOrMore(tag + Suppress(Literal(',')) ) + tag
  multcats = OneOrMore(multcat)
  
  found_mc, post_mc = takeTokens(multcats, q_in)

  found_c, post_c = takeTokens(cats, post_mc)
  all_cats = list(set(flatten_list(found_mc + found_c)))

  q_out = post_c
  search_out = search_in
  if len(all_cats) == 1:
    search_out = search_in.filter('term', tags__term__raw=all_cats[0])
  if len(all_cats) > 1:
    search_out = search_in.filter('terms', tags__term__raw=all_cats)

  return q_out, search_out

def filter_prim(q_in,search_in):
  tag = Group(OneOrMore(Word(alphas) + oneOf('- .')) + Word(alphas))

  prim = Suppress("prim:") + ( tag ^ Literal('any') )

  found_prim, post_prim = takeTokens(prim, q_in)
  found_prim = list(set(flatten_list(found_prim)))

  q_out = post_prim
  search_out = search_in
  if len(found_prim) == 1:
    if not (found_prim[0] == 'any'):
      search_out = search_in.filter('term', arxiv_primary_category__term__raw=found_prim[0])

  return q_out, search_out

def filter_time_range(q_in,search_in):
  time_range_values = oneOf('day 3days week month year all')

  ran_token = Suppress("range:") + time_range_values

  found_ran, post_ran = takeTokens(ran_token, q_in)
  found_ran = list(set(flatten_list(found_ran)))

  q_out = post_ran
  search_out = search_in
  if len(found_ran) == 1:
    search_out = applyTimeFilter(search_in, found_ran[0])

  return q_out, search_out

def filter_version(q_in,search_in):
  version_values = oneOf('1 all')

  ver_token = Suppress("ver:") + version_values

  found_ver, post_ver = takeTokens(ver_token, q_in)
  found_ver = list(set(flatten_list(found_ver)))

  q_out = post_ver
  search_out = search_in
  if len(found_ver) == 1:
    if found_ver[0] == '1':
      search_out = search_out.filter('term', paperversion=1)

  return q_out, search_out


def sort_and_finish(q_in,search_in):
  sort_options = oneOf("rec date")
  sort = Suppress("sort:") + sort_options

  found_sorts, post_sorts = takeTokens(sort, q_in)
  found_sorts = list(set(flatten_list(found_sorts)))

  print(post_sorts)
  print(found_sorts)
  q_out = post_sorts
  search_out = search_in
  sort_date = False
  if len(found_sorts) == 1:
    # if found_sorts[0] == "rec":
      # sort_date = False
    if found_sorts[0] == "date":
      sort_date = True
  if sort_date:
    search_out = search_in.sort('-updated')
  qsan = sanitize_string(q_out).strip()
  if qsan != "" :
    search_out = search_out.query(MultiMatch( query=qsan, type = 'most_fields', \
      fields=['title','summary', 'fulltext', 'all_authors', '_id']))
  else: 
    qsan = "" 
    search_out = add_rec_query(search_out)


  return qsan, search_out


def papers_search(qraw):
  s = Search(using=es, index="arxiv")

  q, s = filter_in(qraw, s)
  q, s = filter_prim(q, s)
  q, s = filter_time_range(q, s)
  q, s = filter_version(q, s)
  q, s = sort_and_finish(q, s)

  return s

def makepaperdict(pid):
    d = {
        "_index" : 'arxiv',
        "_type" : 'paper',
        "_id" : pid
    }
    return d

def add_papers_similar_query(search, pidlist):
  listdict = []
  session['recent_sort'] = False
  dlist = [ makepaperdict(strip_version(v)) for v in pidlist ]
  if pidlist:
    q = Q("more_like_this", like=dlist, fields=['fulltext', 'title', 'summary', 'all_authors'], include=False)
    mlts=search.query(q)
    # mlts = search.update_from_dict({'query': {
    # "more_like_this" : {
    # "fields" : ['fulltext', 'title', 'summary', 'all_authors'],
    # "include" : False,
    # "like" : dlist,
    #  }
    #  }
    # })
  else:
    mlts = search
  return mlts


def papers_similar_to_list_query(pidlist):
  listdict = []
  session['recent_sort'] = False
  dlist = [ makepaperdict(strip_version(v)) for v in pidlist ]
  if pidlist:
    mlts = Search(using = es, index='arxiv').update_from_dict({'query': {
    "more_like_this" : {
    "fields" : ['fulltext', 'title', 'summary', 'all_authors'],
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
    "fields" : ['fulltext', 'title', 'summary', 'all_authors'],
    "include" : True,
    "like" : [makepaperdict(pid)],
     }
   }
  })
  session['recent_sort'] = False

  return mlts



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



def render_date(timestr):
  timestruct = dateutil.parser.parse(timestr)
  rendered_str = '%s %s %s' % (timestruct.day, timestruct.strftime('%b'), timestruct.year)
  return rendered_str


def encode_hit(p, send_images=True, send_abstracts=True):
  pid = str(p['_rawid'])
  idvv = '%sv%d' % (p['_rawid'], p['paperversion'])
  struct = {}
  struct['title'] = p['title']
  struct['pid'] = idvv
  struct['rawpid'] = p['_rawid']
  struct['category'] = p['arxiv_primary_category']['term']
  struct['authors'] = [a['name'] for a in p['authors']]
  struct['link'] = p['link']
  if send_abstracts:
    struct['abstract'] = p['summary']
  if send_images:
    # struct['img'] = '/static/thumbs/' + idvv.replace('/','') + '.pdf.jpg'
    struct['img'] = CLOUDFRONT_URL + 'thumbs/' + pid.replace('/','') + '.pdf.jpg'
  struct['tags'] = [t['term'] for t in p['tags'] if isTag(t['term'])]
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




def getResults2(search):
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
      searches = [svm, svm.filter('term', paperversion=1)]
      pages = [(0,10)]
      for s in searches:
        for p in pages:
            for ttstr in ttstrs:
              s2 = applyTimeFilter(s,ttstr)
              s2 = s2.source(includes=['_rawid','paperversion','title','arxiv_primary_category.term', 'authors.name', 'link', 'summary', 'tags.term', 'updated', 'published','arxiv_comment'])
              s2 = s2[p[0]:p[1]]
              async_add_to_cache(s2)

    lib = papers_from_library()
    if lib:
      searches = [lib.sort('-updated')]
      pages = [(0,10),(10,15),(15,20),(20,25)]
      for s in searches:
        for p in pages:
          s2 = s.source(includes=['_rawid','paperversion','title','arxiv_primary_category.term', 'authors.name', 'link', 'summary', 'tags.term', 'updated', 'published','arxiv_comment'])
          s2 = s2[p[0]:p[1]]
          async_add_to_cache(s2)
  return AUTO_CACHE

def addDefaultSearchesToCache():
  if AUTO_CACHE:
    search = Search(using=es, index="arxiv")
    ttstrs = {'day', '3days', 'week', 'month', 'year', 'alltime', 'none'}
    searches = [search.sort('-updated'), search.filter('term', paperversion=1).sort('-published')]
    pages = [(0,10),(10,15),(15,20),(20,25),(25,30),(35,40),(45,50)]
    for s in searches:
      for p in pages:
        for ttstr in ttstrs:
          s2 = applyTimeFilter(s,ttstr)
          s2 = s2.source(includes=['_rawid','paperversion','title','arxiv_primary_category.term', 'authors.name', 'link', 'summary', 'tags.term', 'updated', 'published','arxiv_comment'])
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
  # search = search.params(request_timeout=60)
  with es_query_semaphore:
    es_response = search.execute()
  meta = get_meta_from_response(es_response)

  # with cached_queries_lock:
  process_query_to_cache(query_hash, es_response, meta)
    # cached_queries[h] = results
    # print(len(cached_queries))
    # print('async added %d' % h)

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
# def test_hash_speed():
  # {'size': 10, 'query': {'match_all': {}}, 'sort': [{'updated': {'order': 'desc'}}], 'from': 0}
# -----------------------------------------------------------------------------
# flask request handling
# -----------------------------------------------------------------------------

def default_context(search, **kws):
  search = False
  if search:
    # search = apply_global_filters(search)
    num_hits = search.count()
    session['search_obj'] = search.to_dict()
    print(search.to_dict())
    print(num_hits)
    # search = Search(using=es, index='arxiv').update_from_dict(session['search_obj'])
    search = search.source(includes=['_rawid','paperversion','title','arxiv_primary_category.term', 'authors.name', 'link', 'summary', 'tags.term', 'updated', 'published','arxiv_comment'])
    search = search[0:10]
   

    papers, meta = getResults2(search)
    # papers = encode_json(response)

    first_papers = dict(papers=papers,dynamic=True)


  else:
    num_hits = 0
    session['search_obj'] = {}
    first_papers = dict(papers={},dynamic=False)
  # else:
    # num_hits = 0

  
  tot_papers = countpapers()
  if 'msg' in kws:
    if kws['msg'] == 'Most recent papers:':
      kws['msg'] = 'Most recent papers (%d):' % num_hits
    if kws['msg'] == 'Sorting by personalized relevance:':
      kws['msg'] = 'Sorting by personalized relevance (%d):' % num_hits
  ans = dict(first_papers=first_papers,numresults=num_hits, totpapers=tot_papers, tweets=[], msg='', show_prompt=False, pid_to_users={}, user_features = user_features, user_interactivity = user_interactivity)
  ans.update(kws)
  return ans

def cat_filter(search_in, groups_of_cats):
    s = search_in
    for group in groups_of_cats:
      # perform an OR filter among the different categories in this group
      if len(group)==1:
        s = s.filter('term', tags__term__raw=group[0])
      elif len(group) > 1:
        s = s.filter('terms', tags__term__raw=group)
    search_out = s
    return search_out

def prim_filter(search_in, prim_cat):
    s = search_in
    if prim_cat is not "any":
      s = s.filter('term', arxiv_primary_category__term__raw=prim_cat)
    search_out = s
    return search_out

def time_filter(search_in, time):
  if time == "all":
    return search_in
  s = search_in  
  if time in ["3days" , "week" , "day" , "month" , "year"]:
    s = applyTimeFilter(s, time)
  else:
      s = s.filter('range', updated={'gte': time['start'] })
      s = s.filter('range', updated={'lte': time['end'] })

  search_out = s
  return search_out

def ver_filter(search_in, v1):
    s = search_in
    if v1:
      s = s.filter('term', paperversion=1)
    search_out = s
    return search_out

def san_dict_value(dictionary, key, typ, valid_options):
    if key in dictionary:
      value = dictionary[key]
      if not isinstance(value, typ):
        dictionary.pop(key, None)
      elif not (value in valid_options):
          dictionary.pop(key,None)
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
  valid_keys = ['query', 'sort', 'category', 'time', 'primaryCategory', 'author',' v1']
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

  query_info = san_dict_value(query_info, 'sort', str, ["relevance","date"])

  query_info = san_dict_value(query_info, 'primaryCategory', str, ALL_CATEGORIES)
  
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

def build_query(query_info):
  query_info = sanitize_query_object(query_info)
  search = Search(using=es, index='arxiv')
  SORT_QUERY = 1
  SORT_LIB = 2
  SORT_DATE = 3

  # author stuff not implemented yet

  sort_auth = False
  sort = SORT_DATE
  #step 1: determine sorting
  if 'query' in query_info:
    if query_info['query'].strip() is not '':
      sort = SORT_QUERY
  elif 'sort' in query_info:
    if query_info['sort'] == "relevance":
      sort = SORT_LIB
    elif query_info['sort'] == "date":
      sort = SORT_DATE
  
  if 'author' in query_info:
    if query_info['author'].strip() is not '':
      sort_auth = True
  
  # need to sanitize!!

  # add filters
  if 'category' in query_info:
    search = cat_filter(search, query_info['category'])
  
  if 'primaryCategory' in query_info:
    search = prim_filter(search, query_info['primaryCategory'])

  if 'time' in query_info:
    search = time_filter(search, query_info['time'])
    
  if 'v1' in query_info:
    search = ver_filter(search, query_info['v1'])
  
  # add sort

  if sort == SORT_QUERY:
    q = query_info['query'].strip()
    search = search.query(MultiMatch( query=q, type = 'most_fields', \
      fields=['title','summary', 'fulltext', 'all_authors', '_id']))
  elif sort == SORT_DATE:
    search = search.sort('-updated')
  elif sort == SORT_LIB:
    search = add_rec_query(search)

  return search

# def add_aggs_to_search(search):
#     a = A('date_histogram', field='published', interval="year")
#     search.aggs.bucket('published_dates', a)
#     return search
def get_meta_from_response(response):
  meta = dict(tot_num_papers=response.hits.total)
  # print(vars(response))
  if "aggregations" in response:
    # for a in response.aggregations:
      # print(a)
    if "published_dates" in response.aggregations:
      date_hist_data = []
      for x in response.aggregations.published_dates.buckets:
        time = round(x.key/1000)
        bucket = dict(time=time, num_results = x.doc_count)
        date_hist_data.append(bucket)
      meta["date_hist_data"] = date_hist_data
    if "prim" in response.aggregations:
      prim_data =[]
      for prim in response.aggregations.prim.buckets:
        bucket = dict(category=prim.key,num_results=prim.doc_count)
        prim_data.append(bucket)
      meta["prim_data"] = prim_data
  return meta


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

  search = search.source(includes=['_rawid','paperversion','title','arxiv_primary_category.term', 'authors.name', 'link', 'summary', 'tags.term', 'updated', 'published','arxiv_comment'])
  search = search[start:start+number]
  year_agg = A('date_histogram', field='published', interval="year")
  search.aggs.bucket('published_dates', year_agg)

  prim_agg = A('terms', field='arxiv_primary_category.term.raw')
  search.aggs.bucket('prim', prim_agg)
  
  # search = add_aggs_to_search(search)
  
  # if start+number >= num_results:
    # more = False
  # else:
    # more = True
  log_dict = {}
  log_dict.update(search= search.to_dict())
  log_dict.update(client_ip = request.remote_addr)
  log_dict.update(client_route = request.access_route)
  if 'X-Real-IP' in request.headers:
    log_dict.update(client_x_real_ip = request.headers['X-Real-IP'])

  access_log.info("ES search request", extra=log_dict )
  # access_log.info(msg="ip %s sent ES search fired: %s" % search.to_dict())
  papers, meta = getResults2(search)
  # print(len(response))
  # papers = encode_json(response)
  # print(papers)
  return jsonify(dict(papers=papers,dynamic=dynamic, start_at=start, num_get=number, meta=meta))
  


@app.route('/_getresults', methods=['POST'])
def _getresults():
  if 'search_obj' in session:
    search_query = session['search_obj']
  else:
    search_query = getrecentpapers()
  data = request.get_json()
  start = data['start_at']
  number = data['num_get']
  # number = 5
  dynamic = data['dyn']
  search = Search(using=es, index='arxiv').update_from_dict(search_query)
  # num_results = search.count()

  search = search.source(includes=['_rawid','paperversion','title','arxiv_primary_category.term', 'authors.name', 'link', 'summary', 'tags.term', 'updated', 'published','arxiv_comment'])
  search = search[start:start+number]
  # if start+number >= num_results:
    # more = False
  # else:
    # more = True
  log_dict = {};
  log_dict.update(search= search.to_dict())
  log_dict.update(client_ip = request.remote_addr)
  log_dict.update(client_route = request.access_route)
  if 'X-Real-IP' in request.headers:
    log_dict.update(client_x_real_ip = request.headers['X-Real-IP'])

  access_log.info("ES search request", extra=log_dict )
  # access_log.info(msg="ip %s sent ES search fired: %s" % search.to_dict())
  papers, meta = getResults2(search)
  # print(len(response))
  # papers = encode_json(response)
  # print(papers)
  return jsonify(dict(papers=papers,dynamic=dynamic))
  


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

def applyTimeFilter(search, ttstr):
  legend = {'day':1, '3days':3, 'week':5, 'month':30, 'year':365}

  if ttstr not in legend:
    return search
  # legend = {'new':1, 'recent':5, 'week':7, 'month':30, 'year':365}

  tt = legend.get(ttstr, 7)

  now = datetime.now(tzutc())

  if tt < 10:
    cutoffs= getLastCutoffs()

    cutoff = cutoffs[tt+1]
  else:
    # account for published vs announced
    back = now + timedelta(days=-1) +timedelta(days=-1*tt)

    back18 = back.replace(hour=18,minute=0,second=0,microsecond=0)
    if back > back18:
      back = back18
    if back < back18:
      back = back18 + timedelta(days=-1)
    cutoff = back+ timedelta(seconds = -1)

  
  time_cutoff = round(cutoff.timestamp()* 1000)
  
  return search.filter('range', updated={'gte': time_cutoff })

def apply_global_filters(search):
  vstr = request.args.get('vfilter', 'all')
  rsort = session.get('recent_sort', False)

  if rsort:
    search = search.sort('-updated')
  if vstr == '1':
    search = search.filter('term', paperversion=1)
    if rsort:
      search = search.sort('-published')
  
  ttstr = request.args.get('timefilter', 'none') # default is none
  search = applyTimeFilter(search, ttstr)

  CLstr = request.args.get('cl', 'allow') # default is allow crosslists
  cat_str = request.args.get('cat', 'quant-ph') # default is quant-ph

  if CLstr == 'deny':
    search = search.filter('term', arxiv_primary_category__term__raw=cat_str)
    # search = search.update_from_dict({
    #  "filter": {
    #   "term": {
    #     "arxiv_primary_category.term.raw": cat_str
    #   }
    # }})

  return search

def countpapers():
  s = Search(using=es, index="arxiv")
  return s.count()

def getrecentpapers():
  session['recent_sort'] = True
  s = Search(using=es, index="arxiv")
  return s

@app.route("/")
def intmain():
  search = getrecentpapers()

  ctx = default_context(search, render_format='recent',
                        msg='Most recent papers:')
  return render_template('main.html', **ctx)


@app.route("/<request_cat>/<request_pid>")
def rankold(request_cat,request_pid):
  request_pid =  request_cat+"/"+request_pid
  if not isvalidid(request_pid):
    return '' # these are requests for icons, things like robots.txt, etc
  search = papers_similar(request_pid)
  ctx = default_context(search, render_format='paper')
  return render_template('main.html', **ctx)

@app.route("/<request_pid>")
def rank(request_pid=None):
  if not isvalidid(request_pid):
    return '' # these are requests for icons, things like robots.txt, etc
  search = papers_similar(request_pid)
  ctx = default_context(search, render_format='paper')
  return render_template('main.html', **ctx)


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

# @app.route('/discuss', methods=['GET'])
# def discuss():
#   """ return discussion related to a paper """
#   pid = request.args.get('id', '') # paper id of paper we wish to discuss
#   p = getpaper(pid);
#   if p is None:
#     papers = []
#   else:
#     papers = [p];

#   # fetch the comments
#   comms_cursor = comments.find({ 'pid':pid }).sort([('time_posted', pymongo.DESCENDING)])
#   comms = list(comms_cursor)
#   for c in comms:
#     c['_id'] = str(c['_id']) # have to convert these to strs from ObjectId, and backwards later http://api.mongodb.com/python/current/tutorial.html

#   # fetch the counts for all tags
#   tag_counts = []
#   for c in comms:
#     cc = [tags_collection.count({ 'comment_id':c['_id'], 'tag_name':t }) for t in TAGS]
#     tag_counts.append(cc);

#   # and render
#   ctx = default_context(papers, render_format='default', comments=comms, gpid=pid, tags=TAGS, tag_counts=tag_counts)
#   return render_template('discuss.html', **ctx)

# @app.route('/comment', methods=['POST'])
# def comment():
#   """ user wants to post a comment """
#   anon = int(request.form['anon'])

#   if g.user and (not anon):
#     username = get_username(session['user_id'])
#   else:
#     # generate a unique username if user wants to be anon, or user not logged in.
#     username = 'anon-%s-%s' % (str(int(time.time())), str(randrange(1000)))

#   # process the raw pid and validate it, etc
#   try:
#     pid = request.form['pid']
#     if not isvalid(pid): raise Exception("invalid pid")
#     version = getpaper(pid)['paperversion'] # most recent version of this paper
#   except Exception as e:
#     print(e)
#     return 'bad pid. This is most likely Andrej\'s fault.'

#   # create the entry
#   entry = {
#     'user': username,
#     'pid': pid, # raw pid with no version, for search convenience
#     'version': version, # version as int, again as convenience
#     'conf': request.form['conf'],
#     'anon': anon,
#     'time_posted': time.time(),
#     'text': request.form['text'],
#   }

#   # enter into database
#   # print(entry)
#   comments.insert_one(entry)
#   return 'OK'

# @app.route("/discussions", methods=['GET'])
# def discussions():
#   # return most recently discussed papers
#   comms_cursor = comments.find().sort([('time_posted', pymongo.DESCENDING)]).limit(100)

#   # get the (unique) set of papers.
#   papers = []
#   have = set()
#   for e in comms_cursor:
#     pid = e['pid']
#     if isvalid(pid) and not pid in have:
#       have.add(pid)
#       papers.append(getpaper(pid))

#   ctx = default_context(papers, render_format="discussions")
#   return render_template('main.html', **ctx)

# @app.route('/toggletag', methods=['POST'])
# def toggletag():

#   if not g.user: 
#     return 'You have to be logged in to tag. Sorry - otherwise things could get out of hand FAST.'

#   # get the tag and validate it as an allowed tag
#   tag_name = request.form['tag_name']
#   if not tag_name in TAGS:
#     print('tag name %s is not in allowed tags.' % (tag_name, ))
#     return "Bad tag name. This is most likely Andrej's fault."

#   pid = request.form['pid']
#   comment_id = request.form['comment_id']
#   username = get_username(session['user_id'])
#   time_toggled = time.time()
#   entry = {
#     'username': username,
#     'pid': pid,
#     'comment_id': comment_id,
#     'tag_name': tag_name,
#     'time': time_toggled,
#   }

#   # remove any existing entries for this user/comment/tag
#   result = tags_collection.delete_one({ 'username':username, 'comment_id':comment_id, 'tag_name':tag_name })
#   if result.deleted_count > 0:
#     print('cleared an existing entry from database')
#   else:
#     print('no entry existed, so this is a toggle ON. inserting:')
#     # print(entry)
#     tags_collection.insert_one(entry)
#   return 'OK'

@app.route("/search", methods=['GET'])
def search():
  q = request.args.get('q', '') # get the search request
  search = papers_search(q) # perform the query and get sorted documents
  ctx = default_context(search, render_format="search")
  return render_template('main.html', **ctx)

@app.route('/recommend', methods=['GET'])
def recommend():
  """ return user's svm sorted list """
  # ttstr = request.args.get('timefilter', 'week') # default is week
  # vstr = request.args.get('vfilter', 'all') # default is all (no filter)
  # legend = {'day':1, '3days':3, 'week':7, 'month':30, 'year':365}
  # tt = legend.get(ttstr, None)
  # if g.user:
  papers = papers_from_svm()
  if not papers:
    papers = []
  # papers = papers_filterpaperversion(papers, vstr)
  ctx = default_context(papers, render_format='recommend',
                        msg='Sorting by personalized relevance:' if g.user else 'You must be logged in and have some papers saved in your library.')
  return render_template('main.html', **ctx)


# @app.route('/top', methods=['GET'])
# def top():
#   """ return top papers """
#   # ttstr = request.args.get('timefilter', 'week') # default is week
#   # legend = {'day':1, '3days':3, 'week':7, 'month':30, 'year':365, 'alltime':10000}
#   # tt = legend.get(ttstr, 7)
#   # curtime = int(time.time()) # in seconds

#   # mint =curtime - tt*24*60*60;

#   # search = Search(using=es).sort('-libcount').filter('range', time_published={'gte': mint })


#   ctx = default_context(search, render_format='top',
#                         msg="")
#   return render_template('main.html', **ctx)

# @app.route('/toptwtr', methods=['GET'])
# def toptwtr():
#   """ return top papers """
#   ttstr = request.args.get('timefilter', 'day') # default is day
#   tweets_top = {'day':tweets_top1, 'week':tweets_top7, 'month':tweets_top30}[ttstr]
#   cursor = tweets_top.find().sort([('vote', pymongo.DESCENDING)]).limit(100)
#   papers, tweets = [], []
#   for rec in cursor:
#     if isvalid(rec['pid']):
#       papers.append(getpaper(rec['pid']))
#       tweet = {k:v for k,v in rec.items() if k != '_id'}
#       tweets.append(tweet)
#   ctx = default_context(papers, render_format='toptwtr', tweets=tweets,
#                         msg='Top papers mentioned on Twitter over last ' + ttstr + ':')
#   return render_template('main.html', **ctx)

@app.route('/library')
def library():
  """ render user's library """
  papers = papers_from_library()
  # papers = papers.source(includes=['_rawid','paperversion','title','arxiv_primary_category.term', 'authors.name', 'link', 'summary', 'tags.term', 'updated', 'published','arxiv_comment'])

  num_papers = papers.count()
  if g.user:
    msg = '%d papers in your library:' % (num_papers, )
  else:
    msg = 'You must be logged in. Once you are, you can save papers to your library (with the save icon on the right of each paper) and they will show up here.'
  ctx = default_context(papers, render_format='library', msg=msg)
  return render_template('main.html', **ctx)

@app.route('/libtoggle', methods=['POST'])
def review():
  """ user wants to toggle a paper in his library """
  
  # make sure user is logged in
  if not g.user:
    return 'NO' # fail... (not logged in). JS should prevent from us getting here.

  idvv = request.form['pid'] # includes version
  if not isvalidid(idvv):
    return 'NO' # fail, malformed id. weird.
  pid = strip_version(idvv)
  if not isvalid(pid):
    return 'NO' # we don't know this paper. wat

  uid = session['user_id'] # id of logged in user

  # check this user already has this paper in library
  record = query_db('''select * from library where
          user_id = ? and paper_id = ?''', [uid, pid], one=True)
  # print(record)

  ret = 'NO'
  if record:
    # record exists, erase it.
    g.db.execute('''delete from library where user_id = ? and paper_id = ?''', [uid, pid])
    g.db.commit()
    #print('removed %s for %s' % (pid, uid))
    ret = 'OFF'
  else:
    # record does not exist, add it.
    rawpid = strip_version(pid)
    g.db.execute('''insert into library (paper_id, user_id, update_time) values (?, ?, ?)''',
        [rawpid, uid, int(time.time())])
    g.db.commit()

    #print('added %s for %s' % (pid, uid))
    ret = 'ON'
  
  with list_of_users_lock:
    list_of_users_cached.remove(uid)
  update_libids()
  addUserSearchesToCache()

  return ret

# @app.route('/friends', methods=['GET'])
# def friends():
    
#     ttstr = request.args.get('timefilter', 'week') # default is week
#     legend = {'day':1, '3days':3, 'week':7, 'month':30, 'year':365}
#     tt = legend.get(ttstr, 7)

#     papers = []
#     pid_to_users = {}
#     if g.user:
#         # gather all the people we are following
#         username = get_username(session['user_id'])
#         edges = list(follow_collection.find({ 'who':username }))
#         # fetch all papers in all of their libraries, and count the top ones
#         counts = {}
#         for edict in edges:
#             whom = edict['whom']
#             uid = get_user_id(whom)
#             user_library = query_db('''select * from library where user_id = ?''', [uid])
#             libids = [strip_version(x['paper_id']) for x in user_library]
#             for lid in libids:
#                 if not lid in counts:
#                     counts[lid] = []
#                 counts[lid].append(whom)

#         keys = list(counts.keys())
#         keys.sort(key=lambda k: len(counts[k]), reverse=True) # descending by count
#         papers = [getpaper(pid) for x in keys]
#         # finally filter by date
#         curtime = int(time.time()) # in seconds
#         papers = [x for x in papers if curtime - x['time_published'] < tt*24*60*60]
#         # trim at like 100
#         if len(papers) > 100: papers = papers[:100]
#         # trim counts as well correspondingly
#         pid_to_users = { p['_rawid'] : counts.get(p['_rawid'], []) for p in papers }

#     if not g.user:
#         msg = "You must be logged in and follow some people to enjoy this tab."
#     else:
#         if len(papers) == 0:
#             msg = "No friend papers present. Try to extend the time range, or add friends by clicking on your account name (top, right)"
#         else:
#             msg = "Papers in your friend's libraries:"

#     ctx = default_context(papers, render_format='friends', pid_to_users=pid_to_users, msg=msg)
#     return render_template('main.html', **ctx)

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

@app.route('/requestfollow', methods=['POST'])
def requestfollow():
    if request.form['newf'] and g.user:
        # add an entry: this user is requesting to follow a second user
        who = get_username(session['user_id'])
        whom = request.form['newf']
        # make sure whom exists in our database
        whom_id = get_user_id(whom)
        if whom_id is not None:
            e = { 'who':who, 'whom':whom, 'active':0, 'time_request':int(time.time()) }
            print('adding request follow:')
            print(e)
            follow_collection.insert_one(e)

    return redirect(url_for('account'))

@app.route('/removefollow', methods=['POST'])
def removefollow():
    user = request.form['user']
    lst = request.form['lst']
    if user and lst:
        username = get_username(session['user_id'])
        if lst == 'followers':
            # user clicked "X" in their followers list. Erase the follower of this user
            who = user
            whom = username
        elif lst == 'following':
            # user clicked "X" in their following list. Stop following this user.
            who = username
            whom = user
        else:
            return 'NOTOK'

        delq = { 'who':who, 'whom':whom }
        print('deleting from follow collection:', delq)
        follow_collection.delete_one(delq)
        return 'OK'
    else:
        return 'NOTOK'

@app.route('/addfollow', methods=['POST'])
def addfollow():
    user = request.form['user']
    lst = request.form['lst']
    if user and lst:
        username = get_username(session['user_id'])
        if lst == 'followers':
            # user clicked "OK" in the followers list, wants to approve some follower. make active.
            who = user
            whom = username
            delq = { 'who':who, 'whom':whom }
            print('making active in follow collection:', delq)
            follow_collection.update_one(delq, {'$set':{'active':1}})
            return 'OK'
        
    return 'NOTOK'

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
  es_host = 'search-arxiv-esd-ahgls3q7eb5236pj2u5qxptdtq.us-east-1.es.amazonaws.com'
  auth = AWSRequestsAuth(aws_access_key=AWS_ACCESS_KEY,
                       aws_secret_access_key=AWS_SECRET_KEY,
                       aws_host=es_host,
                       aws_region='us-east-1',
                       aws_service='es')


  es = Elasticsearch(host=es_host,
                          port=80,
                          connection_class=RequestsHttpConnection,
                          http_auth=auth)

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
  
  TAGS = ['insightful!', 'thank you', 'agree', 'disagree', 'not constructive', 'troll', 'spam']

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
