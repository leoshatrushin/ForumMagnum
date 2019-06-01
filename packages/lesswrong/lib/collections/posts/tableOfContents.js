import { Utils } from 'meteor/vulcan:core';
import cheerio from 'cheerio';
import { Comments } from '../comments'
import { Posts } from './collection';
import { questionAnswersSort } from '../comments/views';
import { getSetting } from 'meteor/vulcan:core';

// Number of headings below which a table of contents won't be generated.
const MIN_HEADINGS_FOR_TOC = 3;

// Tags which define headings. Currently <h1>-<h4>, <strong>, and <b>. Excludes
// <h5> and <h6> because their usage in historical (HTML) wasn't as a ToC-
// worthy heading.
const headingTags = {
  h1: 1,
  h2: 2,
  h3: 3,
  h4: 4,
  // <b> and <strong> are at the same level
  strong: 7,
  b: 7,
}

const headingIfWholeParagraph = {
  strong: true,
  b: true,
};

const headingSelector = _.keys(headingTags).join(",");

// Given an HTML document, extract a list of sections for a table of contents
// from it, and add anchors. The result is modified HTML with added anchors,
// plus a JSON array of sections, where each section has a
// `title`, `anchor`, and `level`, like this:
//   {
//     html: "<a anchor=...">,
//     sections: [
//       {title: "Preamble", anchor: "preamble", level: 1},
//       {title: "My Cool Idea", anchor: "mycoolidea", level: 1},
//         {title: "An Aspect of My Cool Idea", anchor:"anaspectofmycoolidea", level: 2},
//         {title: "Why This Is Neat", anchor:"whythisisneat", level: 2},
//       {title: "Conclusion", anchor: "conclusion", level: 1},
//     ]
//   }
export function extractTableOfContents(postHTML)
{
  if (!postHTML) return null;
  const postBody = cheerio.load(postHTML);
  let headings = [];
  let usedAnchors = {};

  // First, find the headings in the document, create a linear list of them,
  // and insert anchors at each one.
  let headingTags = postBody(headingSelector);
  for (let i=0; i<headingTags.length; i++) {
    let tag = headingTags[i];

    if (tagIsHeadingIfWholeParagraph(tag.tagName) && !tagIsWholeParagraph(tag)) {
      continue;
    }

    let title = cheerio(tag).text();
    
    if (title && title.trim()!=="") {
      let anchor = titleToAnchor(title, usedAnchors);
      usedAnchors[anchor] = true;
      cheerio(tag).attr("id", anchor);
      headings.push({
        title: title,
        anchor: anchor,
        level: tagToHeadingLevel(tag.tagName),
      });
    }
  }

  // Filter out unused heading levels, mapping the heading levels to consecutive
  // numbers starting from 1. So if a post uses <h1>, <h3> and <strong>, those
  // will be levels 1, 2, and 3 (not 1, 3 and 7).

  // Get a list of heading levels used
  let headingLevelsUsedDict = {};
  for(let i=0; i<headings.length; i++)
    headingLevelsUsedDict[headings[i].level] = true;

  // Generate a mapping from raw heading levels to compressed heading levels
  let headingLevelsUsed = _.keys(headingLevelsUsedDict).sort();
  let headingLevelMap = {};
  for(let i=0; i<headingLevelsUsed.length; i++)
    headingLevelMap[ headingLevelsUsed[i] ] = i;

  // Mark sections with compressed heading levels
  for(let i=0; i<headings.length; i++)
    headings[i].level = headingLevelMap[headings[i].level]+1;

  if (headings.length) {
    headings.push({divider:true, level: 0, anchor: "postHeadingsDivider"})
  }
  return headings
}

const reservedAnchorNames = ["top", "comments"];

// Given the text in a heading block and a dict of anchors that have been used
// in the post so far, generate an anchor, and return it. An anchor is a
// URL-safe string that can be used for within-document links, and which is
// not one of a few reserved anchor names.
function titleToAnchor(title, usedAnchors)
{
  let charsToUse = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_0123456789";
  let sb = [];

  for(let i=0; i<title.length; i++) {
    let ch = title.charAt(i);
    if(charsToUse.indexOf(ch) >= 0) {
      sb.push(ch);
    } else {
      sb.push('_');
    }
  }

  let anchor = sb.join('');
  if(!usedAnchors[anchor] && !_.find(reservedAnchorNames, x=>x===anchor))
    return anchor;

  let anchorSuffix = 1;
  while(usedAnchors[anchor + anchorSuffix])
    anchorSuffix++;
  return anchor+anchorSuffix;
}

// `<b>` and `<strong>` tags are headings iff they are the only thing in their
// paragraph. Return whether the given tag name is a tag with that property
// (ie, is `<strong>` or `<b>`).
function tagIsHeadingIfWholeParagraph(tagName)
{
  return tagName.toLowerCase() in headingIfWholeParagraph;
}

function tagIsWholeParagraph(tag) {
  if (!tag) return false;
  let parents = cheerio(tag).parent();
  if (!parents || !parents.length) return false;
  let parent = parents[0];
  if (parent.tagName.toLowerCase() !== 'p') return false;
  let selfAndSiblings = cheerio(parent).contents();
  if (selfAndSiblings.length != 1) return false;

  return true;
}

function tagToHeadingLevel(tagName)
{
  let lowerCaseTagName = tagName.toLowerCase();
  if (lowerCaseTagName in headingTags)
    return headingTags[lowerCaseTagName];
  else if (lowerCaseTagName in headingIfWholeParagraph)
    return headingIfWholeParagraph[lowerCaseTagName];
  else
    return 0;
}

async function getTocAnswers (document) {
  if (!document.question) return []

  let answersTerms = {
    answer:true,
    postId: document._id,
    deleted:false,
  }
  if (getSetting('forumType') === 'AlignmentForum') {
    answersTerms.af = true
  }
  const answers = await Comments.find(answersTerms, {sort:questionAnswersSort}).fetch()
  const answerSections = answers.map((answer) => ({
    title: `${answer.baseScore} ${answer.author}`,
    answer: answer,
    anchor: answer._id,
    level: 2
  }))

  if (answerSections.length) {
    return [{anchor: "answers", level:1, title:"Answers"}, ...answerSections]
  } else {
    return []
  }
}

async function getTocComments (document) {
  const commentSelector = {
    answer: false,
    parentAnswerId: null,
    postId: document._id

  }
  if (document.af && getSetting('forumType') === 'AlignmentForum') {
    commentSelector.af = true
  }
  const commentCount = await Comments.find(commentSelector).count()
  return [{anchor:"comments", level:0, title: Posts.getCommentCountStr(document, commentCount)}]
}

const getTableOfContentsData = async (document, args, options) => {
  const { html } = document.contents || {}
  let tocSections = extractTableOfContents(html) || []

  const tocAnswers = await getTocAnswers(document)
  const tocComments = await getTocComments(document)

  tocSections.push(...tocAnswers)
  tocSections.push(...tocComments)
  
  if (tocSections.length >= MIN_HEADINGS_FOR_TOC) {
    return {
      html: html,
      sections: tocSections,
      headingsCount: tocSections.length
    }
  }
}

Utils.getTableOfContentsData = getTableOfContentsData;
Utils.extractTableOfContents = extractTableOfContents;
