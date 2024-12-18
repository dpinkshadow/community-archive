DROP MATERIALIZED VIEW IF EXISTS public.account_activity_summary;

CREATE MATERIALIZED VIEW public.account_activity_summary AS
WITH account_mentions AS (
  SELECT 
    t.account_id,
    um.mentioned_user_id,
    COUNT(*) as mention_count
  FROM public.tweets t
  JOIN public.user_mentions um ON t.tweet_id = um.tweet_id
  GROUP BY t.account_id, um.mentioned_user_id
),
top_tweets AS (
  SELECT 
    account_id,
    json_agg(
      json_build_object(
        'tweet_id', tweet_id,
        'account_id', account_id,
        'created_at', created_at,
        'full_text', full_text,
        'retweet_count', retweet_count,
        'favorite_count', favorite_count,
        'reply_to_tweet_id', reply_to_tweet_id,
        'reply_to_user_id', reply_to_user_id,
        'reply_to_username', reply_to_username,
        'archive_upload_id', archive_upload_id
      ) ORDER BY retweet_count DESC
    ) FILTER (WHERE retweet_count > 0 AND rt_rank <= 100) as most_retweeted_tweets,
    json_agg(
      json_build_object(
        'tweet_id', tweet_id,
        'account_id', account_id,
        'created_at', created_at,
        'full_text', full_text,
        'retweet_count', retweet_count,
        'favorite_count', favorite_count,
        'reply_to_tweet_id', reply_to_tweet_id,
        'reply_to_user_id', reply_to_user_id,
        'reply_to_username', reply_to_username,
        'archive_upload_id', archive_upload_id
      ) ORDER BY favorite_count DESC
    ) FILTER (WHERE favorite_count > 0 AND fav_rank <= 100) as most_favorited_tweets
  FROM (
    SELECT 
      *,
      ROW_NUMBER() OVER (PARTITION BY account_id ORDER BY retweet_count DESC) as rt_rank,
      ROW_NUMBER() OVER (PARTITION BY account_id ORDER BY favorite_count DESC) as fav_rank
    FROM public.tweets
  ) t
  GROUP BY account_id
),
mentioned_accounts AS (
  SELECT 
    am.account_id,
    json_agg(
      json_build_object(
        'user_id', am.mentioned_user_id,
        'name', mu.name,
        'screen_name', mu.screen_name,
        'mention_count', am.mention_count
      ) ORDER BY am.mention_count DESC
    ) FILTER (WHERE am.mention_count > 0 AND mention_rank <= 20) as mentioned_accounts
  FROM (
    SELECT 
      *,
      ROW_NUMBER() OVER (PARTITION BY account_id ORDER BY mention_count DESC) as mention_rank
    FROM account_mentions
  ) am
  LEFT JOIN public.mentioned_users mu ON mu.user_id = am.mentioned_user_id
  GROUP BY am.account_id
)
SELECT
  a.account_id,
  a.username,
  a.num_tweets,
  a.num_followers,
  COALESCE((
    SELECT COUNT(*)
    FROM public.likes l 
    WHERE l.account_id = a.account_id
  ), 0) AS total_likes,
  COALESCE((
    SELECT COUNT(*)
    FROM public.user_mentions um 
    JOIN public.tweets t ON um.tweet_id = t.tweet_id 
    WHERE t.account_id = a.account_id
  ), 0) AS total_mentions,
  COALESCE(ma.mentioned_accounts, '[]'::json) AS mentioned_accounts,
  COALESCE(tt.most_retweeted_tweets, '[]'::json) AS most_retweeted_tweets,
  COALESCE(tt.most_favorited_tweets, '[]'::json) AS most_favorited_tweets,
  CURRENT_TIMESTAMP AS last_updated
FROM public.account a
LEFT JOIN mentioned_accounts ma ON ma.account_id = a.account_id
LEFT JOIN top_tweets tt ON tt.account_id = a.account_id;

CREATE UNIQUE INDEX idx_account_activity_summary2_account_id
ON public.account_activity_summary2 (account_id);
