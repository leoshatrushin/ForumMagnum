import { registerMigration } from './migrationUtils';
import Posts from '../../lib/collections/posts/collection';

registerMigration({
  name: "updateCoauthorsSchema",
  dateWritten: "2022-06-02",
  idempotent: true,
  action: async () => {
    const posts = await Posts.find({}).fetch();
    console.log("posts", posts);
    for (const post of posts) {
      const coauthorUserIds = (post as { coauthorUserIds?: string[] }).coauthorUserIds;
      if (coauthorUserIds?.length) {
        await Posts.rawUpdateOne(
          {
            _id: post._id,
          },
          {
            $set: {
              coauthorStatuses: coauthorUserIds.map((userId) => ({
                userId,
                confirmed: true,
                requested: false,
              })),
            },
          },
        );
      }
    }
  },
});
