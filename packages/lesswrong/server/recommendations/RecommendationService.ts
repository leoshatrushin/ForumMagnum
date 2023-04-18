import {
  StrategySpecification,
  RecommendationStrategyName,
} from "../../lib/collections/users/recommendationSettings";
import { randomId } from "../../lib/random";
import { getSqlClientOrThrow } from "../../lib/sql/sqlClient";
import MoreFromAuthorStrategy from "./MoreFromAuthorStrategy";
import MoreFromTagStrategy from "./MoreFromTagStrategy";
import BestOfStrategy from "./BestOfStrategy";
import CollabFilterStrategy from "./CollabFilterStrategy";
import RecommendationStrategy from "./RecommendationStrategy";
import { loggerConstructor } from "../../lib/utils/logging";

type ConstructableStrategy = {
  new (): RecommendationStrategy,
}

class RecommendationService {
  private logger = loggerConstructor("recommendation-service");

  private strategies: Record<RecommendationStrategyName, ConstructableStrategy> = {
    moreFromTag: MoreFromTagStrategy,
    moreFromAuthor: MoreFromAuthorStrategy,
    bestOf: BestOfStrategy,
    collabFilter: CollabFilterStrategy,
  };

  async recommend(
    currentUser: DbUser|null,
    count: number,
    strategy: StrategySpecification,
  ): Promise<DbPost[]> {
    if (strategy.forceLoggedOutView) {
      currentUser = null;
    }

    const strategies = this.getStrategyStack(strategy.name);
    let posts: DbPost[] = [];

    while (count > 0 && strategies.length) {
      this.logger("Recommending for", strategy.postId, "with", strategies[0]);
      const newPosts = (await this.recommendWithStrategyName(
        currentUser,
        count,
        strategy,
        strategies[0],
      )).filter(
        ({_id}) => !posts.some((post) => post._id === _id),
      );

      if (currentUser) {
        void this.recordRecommendations(currentUser, strategies[0], newPosts);
      }

      posts = posts.concat(newPosts);
      count -= newPosts.length;

      strategies.shift();
    }

    return posts;
  }

  private getStrategyStack(
    primaryStrategy: RecommendationStrategyName,
  ): RecommendationStrategyName[] {
    const strategies = Object.keys(this.strategies) as RecommendationStrategyName[];
    return [
      primaryStrategy,
      ...strategies.filter((s) => s !== primaryStrategy),
    ];
  }

  private recommendWithStrategyName(
    currentUser: DbUser|null,
    count: number,
    strategy: StrategySpecification,
    strategyName: RecommendationStrategyName,
  ): Promise<DbPost[]> {
    const Provider = this.strategies[strategyName];
    if (!Provider) {
      throw new Error("Invalid recommendation strategy name: " + strategyName);
    }
    const source = new Provider();
    return source.recommend(currentUser, count, strategy);
  }

  private async recordRecommendations(
    currentUser: DbUser,
    strategyName: RecommendationStrategyName,
    posts: DbPost[],
  ): Promise<void> {
    const db = getSqlClientOrThrow();
    await Promise.all(posts.map(({_id}) => db.none(`
      INSERT INTO "PostRecommendations" (
        "_id",
        "userId",
        "postId",
        "strategyName",
        "recommendationCount",
        "lastRecommendedAt",
        "createdAt"
      ) VALUES (
        $1, $2, $3, $4, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      ) ON CONFLICT ("userId", "postId") DO UPDATE SET
        "strategyName" = $4,
        "recommendationCount" = "PostRecommendations"."recommendationCount" + 1,
        "lastRecommendedAt" = CURRENT_TIMESTAMP
    `, [randomId(), currentUser._id, _id, strategyName])));
  }
}

export default RecommendationService;
