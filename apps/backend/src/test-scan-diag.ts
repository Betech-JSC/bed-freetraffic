import prisma from './lib/prisma';
import { scrapeFacebookGroup } from './services/socialListeningScraper';
import { getEmbedding, cosineSimilarity } from './lib/embeddings';

async function main() {
  const campaign = await prisma.socialListeningCampaign.findUnique({
    where: { id: 1 },
  });

  if (!campaign) {
    console.error('Campaign #1 not found.');
    return;
  }

  console.log('Campaign keywords:', campaign.keywords);
  console.log('Semantic Filter Enabled:', campaign.enableSemanticFilter);
  console.log('Semantic Threshold:', campaign.semanticThreshold);

  const queryEmbedding = await getEmbedding(campaign.keywords);
  if (!queryEmbedding) {
    console.error('Failed to generate query embedding.');
    return;
  }

  const groupUrlsList = campaign.groupUrls
    .split(',')
    .map(g => g.trim())
    .filter(Boolean);

  for (const groupUrl of groupUrlsList) {
    console.log(`\n--- Group: ${groupUrl} ---`);
    try {
      const posts = await scrapeFacebookGroup(groupUrl, campaign.facebookCookie!);
      console.log(`Found ${posts.length} posts.`);

      for (const post of posts) {
        console.log(`\nPost by: ${post.authorName}`);
        console.log(`Content: "${post.content.slice(0, 150)}..."`);
        
        const postEmbedding = await getEmbedding(post.content);
        if (postEmbedding) {
          const similarity = cosineSimilarity(queryEmbedding, postEmbedding);
          console.log(`=> Semantic Similarity Score: ${similarity.toFixed(4)}`);
          const matches = similarity >= campaign.semanticThreshold;
          console.log(`=> Is Match (Threshold: ${campaign.semanticThreshold}): ${matches ? 'YES' : 'NO'}`);
        } else {
          console.log('=> Failed to get post embedding.');
        }

        // Print comments if any
        if (post.comments && post.comments.length > 0) {
          console.log(`Comments count: ${post.comments.length}`);
          for (const comment of post.comments) {
            console.log(`  Comment by ${comment.authorName}: "${comment.content.slice(0, 80)}..."`);
            const commentEmbedding = await getEmbedding(comment.content);
            if (commentEmbedding) {
              const similarity = cosineSimilarity(queryEmbedding, commentEmbedding);
              console.log(`  => Comment Similarity Score: ${similarity.toFixed(4)}`);
              const matches = similarity >= campaign.semanticThreshold;
              console.log(`  => Comment Is Match: ${matches ? 'YES' : 'NO'}`);
            }
          }
        }
      }
    } catch (err: any) {
      console.error('Scrape error:', err.message);
    }
  }
}

main().catch(console.error);
