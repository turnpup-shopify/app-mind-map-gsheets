/* Built-in sample content, so the page is never blank while you set it up. */

export const DEMO_MASTER = `Title,Description,Tags,CSV URL,Color
Q4 marketing plan,Channels and campaigns for the holiday quarter,marketing;planning,demo:q4,#7f6bff
Onboarding flow,Every step a new customer sees in the first 30 days,product;customer,demo:onboarding,#2fd4c9
Product roadmap,What ships when and why,product;planning,demo:roadmap,#ffab7a`;

export const DEMO_MAPS = {
  q4: `Level 1,Level 2,Level 3,Level 4,Notes,Color
Q4 marketing plan,,,,Owner: growth team,
,Paid,,,Total budget $140k,#7f6bff
,,Meta,,,
,,,Prospecting,Broad + lookalike,
,,,Retargeting,7-day window,
,,Google,,,
,,,Brand search,,
,,,Shopping,,
,,TikTok,,Testing only,
,Organic,,,,#2fd4c9
,,SEO,,,
,,,Gift guides,Publish by Oct 20,
,,,Comparison pages,,
,,Email,,,
,,,Black Friday sequence,5 sends,
,,,Win-back,,
,Partnerships,,,,#ffab7a
,,Creators,,,
,,Retail co-marketing,,,`,

  onboarding: `Level 1,Level 2,Level 3,Notes,Color
Onboarding flow,,,,
,Day 0,,Order confirmed,#2fd4c9
,,Confirmation email,,
,,Welcome text,Opt-in only,
,Day 3,,Package delivered,#7f6bff
,,How-to video,,
,,First-use tips,,
,Day 14,,,#ffab7a
,,Check-in survey,3 questions max,
,,Subscription offer,,
,Day 30,,,#ff7aa8
,,Review request,,
,,Referral invite,,`,

  roadmap: `Level 1,Level 2,Level 3,Notes
Product roadmap,,,
,Now,,In progress
,,New checkout,
,,Bundle builder,
,Next,,Starts after checkout ships
,,Loyalty program,
,,Mobile app beta,
,Later,,Not yet scoped
,,International shipping,
,,Wholesale portal,`,
};
