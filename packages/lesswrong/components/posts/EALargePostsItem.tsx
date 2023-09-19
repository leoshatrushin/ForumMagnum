import React, { useRef } from "react";
import { Components, registerComponent } from "../../lib/vulcan-lib";
import { useHover } from "../common/withHover";
import { postGetPageUrl } from "../../lib/collections/posts/helpers";
import { siteImageSetting } from "../vulcan-core/App";
import { AnalyticsContext } from "../../lib/analyticsEvents";
import { Link } from "../../lib/reactRouterWrapper";
import { InteractionWrapper } from "../common/useClickableCell";
import moment from "moment";
import classNames from "classnames";

const styles = (theme: ThemeType) => ({
  postListItem: {
    display: "flex",
    width: "100%",
    borderRadius: theme.borderRadius.default,
    background: theme.palette.panelBackground.default,
    padding: "16px 16px",
    marginTop: 16,
  },
  postListItemTextSection: {
    fontFamily: theme.palette.fonts.sansSerifStack,
    display: "flex",
    flexDirection: "column",
    fontWeight: 500,
    flex: 1,
    maxHeight: 160,
    minWidth: 0, // Magic flexbox property to prevent overflow, see https://stackoverflow.com/a/66689926
    marginRight: 8,
  },
  postListItemTitle: {
    fontSize: 18,
    marginBottom: 8,
    lineHeight: "25px",
    overflow: "hidden",
    display: "-webkit-box",
    "-webkit-box-orient": "vertical",
    "-webkit-line-clamp": 2,
  },
  postListItemMeta: {
    display: "flex",
    marginBottom: 8,
    fontSize: 14,
    lineHeight: "20px",
    color: theme.palette.grey[600],
  },
  commentCount: {
    minWidth: 58,
    marginLeft: 4,
    display: "flex",
    alignItems: "center",
    cursor: "pointer",
    "& svg": {
      height: 18,
      marginRight: 1,
    },
    "&:hover": {
      color: theme.palette.grey[800],
      opacity: 1,
    },
  },
  postListItemPreview: {
    fontSize: 14,
    lineHeight: "20px",
    color: theme.palette.grey[600],
    position: "relative",
    overflow: "hidden",
    display: "-webkit-box",
    "-webkit-box-orient": "vertical",
    "-webkit-line-clamp": 3,
    marginTop: "auto",
    marginBottom: "auto",
  },
  postListItemImage: {
    height: 140,
    maxWidth: 150,
    objectFit: "cover",
    borderRadius: theme.borderRadius.default,
    [theme.breakpoints.down("xs")]: {
      display: "none",
    },
  },
  xsHide: {
    [theme.breakpoints.down("xs")]: {
      display: "none",
    },
  },
});

const EALargePostsItem = ({post, isNarrow = false, classes}: {
  post: PostsWithNavigation | PostsWithNavigationAndRevision,
  isNarrow?: boolean,
  classes: ClassesType,
}) => {
  const authorExpandContainer = useRef(null);

  const {eventHandlers} = useHover({
    pageElementContext: "postListItem",
    documentId: post._id,
    documentSlug: post?.slug,
  });

  const postLink = post ? postGetPageUrl(post) : "";

  const timeFromNow = moment(new Date(post.postedAt)).fromNow();
  const ago = timeFromNow !== "now"
    ? <span className={classes.xsHide}>&nbsp;ago</span>
    : null;

  const imageUrl = post.socialPreviewData.imageUrl || siteImageSetting.get();

  const {TruncatedAuthorsList, ForumIcon} = Components;
  return (
    <AnalyticsContext documentSlug={post?.slug ?? "unknown-slug"}>
      <div {...eventHandlers} className={classes.postListItem}>
        <div className={classes.postListItemTextSection}>
          <div className={classes.postListItemTitle}>
            <Link to={postLink}>{post.title}</Link>
          </div>
          <div className={classes.postListItemMeta}>
            <div ref={authorExpandContainer}>
              <InteractionWrapper>
                <TruncatedAuthorsList
                  post={post}
                  expandContainer={authorExpandContainer}
                />
              </InteractionWrapper>
            </div>
            &nbsp;·&nbsp;
            {timeFromNow}
            {ago}
            &nbsp;·&nbsp;
            {post.readTimeMinutes}m read
            <div>
              {!isNarrow && (
                <span className={classNames(classes.commentCount, classes.xsHide)}>
                  &nbsp;·&nbsp;
                  <Link to={`${postLink}#comments`} className={classes.commentCount}>
                    <ForumIcon icon="Comment" />
                    {post.commentCount}
                  </Link>
                </span>
              )}
            </div>
          </div>
          <div className={classes.postListItemPreview}>
            {post.contents?.plaintextDescription}
          </div>
        </div>
        <img className={classes.postListItemImage} src={imageUrl} />
      </div>
    </AnalyticsContext>
  );
};

const EALargePostsItemComponent = registerComponent(
  "EALargePostsItem",
  EALargePostsItem,
  {styles},
);

declare global {
  interface ComponentTypes {
    EALargePostsItem: typeof EALargePostsItemComponent;
  }
}
