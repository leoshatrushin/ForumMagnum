import React from "react";
import { Components, registerComponent } from "../../lib/vulcan-lib";
import { usePostsPageContext } from "../posts/PostsPage/PostsPageContext";
import type {
  RecommendationsAlgorithmWithStrategy,
  RecommendationStrategyName,
} from "../../lib/collections/users/recommendationSettings";

const PostsPageRecommendationsList = ({
  title = "More posts like this",
  strategy = "moreFromTag",
  forceLoggedOutView,
}: {
  title?: string,
  strategy?: RecommendationStrategyName,
  forceLoggedOutView?: boolean,
}) => {
  const post = usePostsPageContext();
  if (!post) {
    return null;
  }

  const recommendationsAlgorithm: RecommendationsAlgorithmWithStrategy = {
    strategy: {
      name: strategy,
      postId: post._id,
      forceLoggedOutView,
    },
    count: 3,
  };

  const {SectionTitle, RecommendationsList, PostsItemIntroSequence} = Components;
  return (
    <div>
      {title && <SectionTitle title={title} />}
      <RecommendationsList
        algorithm={recommendationsAlgorithm}
        ListItem={({post, translucentBackground}: {
          post: PostsListWithVotesAndSequence,
          translucentBackground?: boolean,
        }) =>
          <PostsItemIntroSequence
            post={post}
            sequence={post.canonicalSequence ?? undefined}
            withImage={!!post.canonicalSequence?.gridImageId}
            translucentBackground={translucentBackground}
          />
        }
      />
    </div>
  );
}

const PostsPageRecommendationsListComponent = registerComponent(
  "PostsPageRecommendationsList",
  PostsPageRecommendationsList,
);

declare global {
  interface ComponentTypes {
    PostsPageRecommendationsList: typeof PostsPageRecommendationsListComponent
  }
}
