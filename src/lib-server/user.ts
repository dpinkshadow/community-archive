import { createServerClient } from '@/utils/supabase'
import { cookies } from 'next/headers'
import { getSchemaName } from '@/lib-client/getTableName'
import { formatUserData } from '@/lib-client/user-utils'

const tweetSelectString = `
        *,
        ${'account'}!inner (
          profile (
            avatar_media_url
          ),
          username,
          account_display_name
        )
      `
const formatTweet = (tweet: any) => {
  return {
    tweet_id: tweet.tweet_id,
    username: tweet.account?.username || 'Unknown',
    display_name: tweet.account?.account_display_name || 'Unknown',
    profile_image_url: tweet.account?.profile[0]?.avatar_media_url || '',
    text: tweet.full_text,
    favorite_count: tweet.favorite_count,
    retweet_count: tweet.retweet_count,
    created_at: tweet.created_at,
    in_reply_to_screen_name: tweet.in_reply_to_screen_name,
  }
}

export const getFirstTweets = async (
  account_id: string,
  limit: number = 100,
) => {
  const supabase = createServerClient(cookies())
  const { data } = await supabase
    .schema('public')
    .from('tweets')
    .select(tweetSelectString)
    .eq('account_id', account_id)
    .order('created_at', { ascending: true })
    .limit(limit)
  return data ? data.map(formatTweet) : []
}

export const getTopTweets = async (account_id: string, limit: number = 20) => {
  const supabase = createServerClient(cookies())
  const { data } = await supabase
    .schema('public')
    .from('tweets')
    .select(tweetSelectString)
    .eq('account_id', account_id)
    .order('retweet_count', { ascending: false })
    .order('favorite_count', { ascending: false })
    .limit(limit)
  return data ? data.map(formatTweet) : []
}

export const getUserData = async (account_id: string) => {
  const supabase = createServerClient(cookies())
  const { data } = await supabase
    .schema('public')
    .from('account')
    .select(
      `
      account_id,
      username,
      account_display_name,
      created_at,
      profile:profile(bio, website, location, avatar_media_url),
      archive_upload:archive_upload(archive_at)
    `,
    )
    .eq('account_id', account_id)
    .single()

  if (!data) {
    return null
  }

  const { count } = await supabase
    .schema('public')
    .from('tweets')
    .select('tweet_id', { count: 'planned', head: true })
    .eq('account_id', account_id)

  const formattedUser = formatUserData(data)

  return {
    account: formattedUser,
    tweetCount: count,
  }
}