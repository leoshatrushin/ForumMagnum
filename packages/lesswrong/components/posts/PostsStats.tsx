import { Components as C, registerComponent } from '../../lib/vulcan-lib';
import React from 'react';

const styles = (theme: ThemeType): JssStyles => ({
  root: {
    opacity:.5,
    [theme.breakpoints.down('sm')]: {
      display:"none"
    }
  }
})

const PostsStats = ({post, classes}: {
  post: PostsDetails,
  classes: ClassesType,
}) => {

  return (
    <span className={classes.root}>
      {post.score &&
        <C.MetaInfo title="Score">
          {Math.floor(post.score*10000)/10000}
        </C.MetaInfo>
      }
      <C.MetaInfo title="Views">
        {post.viewCount || 0}
      </C.MetaInfo>
    </span>
  )
}

const PostsStatsComponent = registerComponent('PostsStats', PostsStats, {styles});

declare global {
  interface ComponentTypes {
    PostsStats: typeof PostsStatsComponent
  }
}
