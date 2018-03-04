from botocore.exceptions import ClientError
import boto3
from enum import Enum
import re


EXTRACTABLE_TYPES = {
    "theorem": ["thm", "theorem"],
    "definition": ["def", "definition"],
    "corollary": ["cor", "corollary"],
    "lemma": ["lem", "lemm", "lemma"],
}


class RegexParts(Enum):
    ExtraCharactersBeforeBeginTag = 0,
    MainBeginTag = 1,
    ExtraCharactersAfterBeginTag = 2,
    ExtraOptionsWithBrackets = 3,
    ExtraOptionsWithoutBrackets = 4,
    LabelWithoutBrackets = 5,
    MainContent = 6,
    ExtraCharactersBeforeEndTag = 7,
    MainEndTag = 8,
    ExtraCharactersAfterEndTag = 9,


class RegexBuilder:

    def __init__(self, type):

        self.type = type

        # Build the regex from the individual components
        self.regex = self.build_regex_options()
        self.regex += self.build_tag_matcher('begin', extra_options_brackets=True)
        self.regex += self.build_content_matcher()
        self.regex += self.build_tag_matcher('end')

    @staticmethod
    def build_regex_options():
        # Make regex case insensitive, non-greedy
        return '(?is)'

    @staticmethod
    def build_content_matcher():
        return '\s*(.*?)?\s*'

    def build_tag_matcher(self, tagname, extra_options_brackets=False):
        tag_matcher = '\\\\'
        tag_matcher += tagname
        tag_matcher += '\{'
        tag_matcher += self.build_tagname_matcher()
        tag_matcher += '\}'
        if extra_options_brackets:
            tag_matcher += '(\[([^\]]*)\]|\s*\\\\label\{([^\}]*)\})?'
        return tag_matcher

    def build_tagname_matcher(self):
        tag_names = '('
        for i, tag_name in enumerate(EXTRACTABLE_TYPES[self.type]):
            tag_names += tag_name
            if i != len(EXTRACTABLE_TYPES[self.type]) - 1:
                tag_names += '|'
        tag_names += ')'
        extra_characters_matcher = '([a-z_]*)'
        return '%s%s%s' % (extra_characters_matcher, tag_names, extra_characters_matcher)

    def get_regex(self):
        return self.regex


class MatchedOutputProcessor:

    def __init__(self, type):

        self.type = type

    def get_json(self, match):

        groups = match.groups()
        if groups[RegexParts.ExtraOptionsWithoutBrackets.value[0]]:
            name = self.get_name(groups[RegexParts.ExtraOptionsWithoutBrackets.value[0]])
        else:
            name = self.get_name(groups[RegexParts.LabelWithoutBrackets.value[0]])
        content = groups[RegexParts.MainContent.value[0]]
        if content is None:
            return None
        return {
            "name": name,
            "content": content
        }

    @staticmethod
    def get_name(extra_options):
        if extra_options is None or not len(extra_options):
            return ''
        if ':' in extra_options:
            # Name is given by a label, which is usually of the form cor:bla, so filter bla out
            # Either this is already the full name, OR this contains 'name='
            parts = extra_options.split(':')
            if len(parts) > 2:
                return ':'.join(parts[1:])
            else:
                return parts[0] if len(parts) == 1 else parts[1]
        else:
            # Either this is already the full name, OR this contains 'name='
            match = re.search('name=([^,]+)?', extra_options)
            if match:
                return match.groups()[0]
            else:
                return extra_options


def extract_into_json(tex_content):
    output_json = {}
    for type in EXTRACTABLE_TYPES:
        output_json[type] = []
        regex = RegexBuilder(type).get_regex()
        type_count = 0
        output_processor = MatchedOutputProcessor(type)
        pattern = re.compile(regex)
        for match in re.finditer(pattern, tex_content):
            json_elem = output_processor.get_json(match)
            if json_elem is not None:
                output_json[type].append(json_elem)
                type_count += 1
        print("Found %d valid elements of type %s." % (type_count, type))
    return output_json


def lambda_handler(event, context):

    if "resources" not in event or "tex" not in event["resources"]:
        return {
            "error": {
                "message": "Invalid request. Either event.resources or event.resources.tex does not exist."
            }
        }
    
    # Read TEX file from S3
    s3 = boto3.client('s3')

    try:
        obj = s3.get_object(**event["resources"]["tex"])
    except ClientError as e:
        return({
            "error": e.response["Error"]
        })

    # Process it
    json_defs = extract_into_json(obj['Body'].read().decode('utf-8'))

    return json_defs