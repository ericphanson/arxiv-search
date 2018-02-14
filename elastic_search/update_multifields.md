# add the multi-fields of raw

curl -XPUT 'https://search-arxiv-esd-ahgls3q7eb5236pj2u5qxptdtq.us-east-1.es.amazonaws.com/arxiv/_mapping/paper?pretty' -H 'Content-Type: application/json' -d'
{
  "properties": {
    "tags": {
      "properties": {
        "term": {
          "type": "string",
          "fields": {
            "raw": {
              "type": "string",
              "index": "not_analyzed"
            }
          }
        }
      }
    },
    "arxiv_primary_category": {
      "properties": {
        "term": {
          "type": "string",
          "fields": {
            "raw": {
              "type": "string",
              "index": "not_analyzed"
            }
          }
        }
      }
    },
        "fulltext": {
          "type": "string",
          "fields": {
            "raw": {
              "type": "string",
              "index": "not_analyzed",
                "ignore_above": 20
            },
            "bool": {
              "type": "boolean"
            }
          }
    }
  }
}
'

# update

curl -XPOST 'https://search-arxiv-esd-ahgls3q7eb5236pj2u5qxptdtq.us-east-1.es.amazonaws.com/arxiv/_update_by_query?pretty&conflicts=proceed&refresh'


# full false
curl -XGET 'https://search-arxiv-esd-ahgls3q7eb5236pj2u5qxptdtq.us-east-1.es.amazonaws.com/arxiv/paper/_search?pretty' -H 'Content-Type: application/json' -d'
{
  "_source": ["id", "fulltext"],
  "query": {
    "term": {
      "fulltext.bool": false
    }
  }
}'


curl -XGET 'https://search-arxiv-esd-ahgls3q7eb5236pj2u5qxptdtq.us-east-1.es.amazonaws.com/arxiv/paper/_search?pretty' -H 'Content-Type: application/json' -d'
{
  "_source": ["id"],
  "query": {
    "term": {
      "fulltext.bool": true
    }
  }
}'



# new index
curl -XPUT 'https://search-arxiv-esd-ahgls3q7eb5236pj2u5qxptdtq.us-east-1.es.amazonaws.com/logs'

# search logs
curl -XGET 'https://search-arxiv-esd-ahgls3q7eb5236pj2u5qxptdtq.us-east-1.es.amazonaws.com/logs/_search?q=*&pretty&pretty'



curl -XGET 'https://search-arxiv-esd-ahgls3q7eb5236pj2u5qxptdtq.us-east-1.es.amazonaws.com/arxiv/paper/_search?pretty' -H 'Content-Type: application/json' -d'
{
    "query" : {
        "constant_score" : {
            "filter" : {
                "missing" : { "field" : "fulltext"
              }
            }
        }
    }
}
'

