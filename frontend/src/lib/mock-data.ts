


export const MOCK_CAMPAIGNS = [
  {
    id: "camp-001",
    name: "XDeposit Launch - Phase 1",
    status: "completed",
    createdAt: "2026-02-25T10:30:00Z",
    sentAt: "2026-02-26T09:00:00Z",
    subject: "🚀 XDeposit: 1% Higher Returns, Just For You",
    body: `Dear [Customer Name],

We are excited to introduce XDeposit — SuperBFSI's flagship Term Deposit product that gives you 1 percentage point HIGHER returns than our competitors! 🎯

🌟 Why XDeposit?
✅ Higher returns than market
✅ Flexible tenure options
✅ 100% secure with RBI guarantee
✅ Special 0.25% bonus for female senior citizens 👩‍🦳

Don't miss this exclusive opportunity!
👉 Explore Now: https://superbfsi.com/xdeposit/explore/

Best regards,
SuperBFSI Team`,
    targetSegment: "all",
    totalCustomers: 5000,
    openRate: 34.2,
    clickRate: 18.7,
    variant: "A",
    temperature: 0.7,
    useEmojis: true,
    tone: "friendly",
    optimizationRound: 1,
  },
  {
    id: "camp-002",
    name: "XDeposit - Senior Women Segment",
    status: "completed",
    createdAt: "2026-02-27T11:00:00Z",
    sentAt: "2026-02-27T14:00:00Z",
    subject: "Exclusive Offer for You: Extra 0.25% Returns on XDeposit",
    body: `Dear Valued Customer,

As one of our most valued senior female customers, we have a special offer exclusively for you!

SuperBFSI's new XDeposit product offers:
- Market-leading returns (1% higher than competitors)
- ADDITIONAL 0.25% exclusively for female senior citizens
- Complete safety and security guaranteed

This is our way of saying thank you for your trust.

Visit: https://superbfsi.com/xdeposit/explore/

Warm Regards,
SuperBFSI Team`,
    targetSegment: "senior_female",
    totalCustomers: 842,
    openRate: 41.8,
    clickRate: 24.3,
    variant: "B",
    temperature: 0.4,
    useEmojis: false,
    tone: "professional",
    optimizationRound: 1,
  },
  {
    id: "camp-003",
    name: "XDeposit - Optimized Re-engagement",
    status: "active",
    createdAt: "2026-02-28T09:15:00Z",
    sentAt: "2026-02-28T10:30:00Z",
    subject: "⏰ Last Chance: Lock In Your 9.5% Returns Today",
    body: `Hi [Customer Name]! 👋

Still thinking about XDeposit? Here's why you shouldn't wait:

💰 9.5% p.a. — highest in the market
🔒 100% RBI-backed security
⏰ Limited-time launch offer ending soon!

✨ Special for you: Personalized investment consultation
📱 Book a 15-min call with our expert

Open your XDeposit account NOW 👇
https://superbfsi.com/xdeposit/explore/

Team SuperBFSI 🚀`,
    targetSegment: "inactive_reopened",
    totalCustomers: 1240,
    openRate: 0,
    clickRate: 0,
    variant: "C",
    temperature: 0.9,
    useEmojis: true,
    tone: "urgent",
    optimizationRound: 2,
  },
];

export const MOCK_CUSTOMER_COHORT = {
  total_count: 5000,
  segments: {
    age_groups: [
      { label: "18-25", count: 420, percentage: 8.4 },
      { label: "26-35", count: 1150, percentage: 23.0 },
      { label: "36-45", count: 1380, percentage: 27.6 },
      { label: "46-55", count: 1120, percentage: 22.4 },
      { label: "56-65", count: 680, percentage: 13.6 },
      { label: "65+", count: 250, percentage: 5.0 },
    ],
    gender: [
      { label: "Male", count: 2800, percentage: 56 },
      { label: "Female", count: 2200, percentage: 44 },
    ],
    status: [
      { label: "Active", count: 3760, percentage: 75.2 },
      { label: "Inactive", count: 1240, percentage: 24.8 },
    ],
    region: [
      { label: "North India", count: 1400, percentage: 28 },
      { label: "South India", count: 1250, percentage: 25 },
      { label: "West India", count: 1100, percentage: 22 },
      { label: "East India", count: 850, percentage: 17 },
      { label: "Central India", count: 400, percentage: 8 },
    ],
  },
};

export const MOCK_ANALYSIS_REPORT = {
  "camp-001": {
    campaignId: "camp-001",
    totalSent: 5000,
    totalOpened: 1710,
    totalClicked: 935,
    openRate: 34.2,
    clickRate: 18.7,
    timeSeriesData: [
      { time: "09:00", opens: 142, clicks: 87, hour: 9 },
      { time: "10:00", opens: 289, clicks: 156, hour: 10 },
      { time: "11:00", opens: 341, clicks: 198, hour: 11 },
      { time: "12:00", opens: 298, clicks: 142, hour: 12 },
      { time: "13:00", opens: 187, clicks: 98, hour: 13 },
      { time: "14:00", opens: 215, clicks: 127, hour: 14 },
      { time: "15:00", opens: 238, clicks: 127, hour: 15 },
    ],
    segmentPerformance: [
      { segment: "18-25", openRate: 28.4, clickRate: 15.2, count: 420 },
      { segment: "26-35", openRate: 38.7, clickRate: 22.1, count: 1150 },
      { segment: "36-45", openRate: 36.2, clickRate: 19.8, count: 1380 },
      { segment: "46-55", openRate: 31.8, clickRate: 16.4, count: 1120 },
      { segment: "56-65", openRate: 35.9, clickRate: 20.3, count: 680 },
      { segment: "65+", openRate: 29.2, clickRate: 13.6, count: 250 },
    ],
    regionPerformance: [
      { region: "North India", openRate: 36.1, clickRate: 20.4 },
      { region: "South India", openRate: 38.9, clickRate: 22.1 },
      { region: "West India", openRate: 32.7, clickRate: 17.8 },
      { region: "East India", openRate: 28.4, clickRate: 14.9 },
      { region: "Central India", openRate: 31.2, clickRate: 16.3 },
    ],
    genderPerformance: [
      { gender: "Male", openRate: 31.8, clickRate: 17.2 },
      { gender: "Female", openRate: 37.4, clickRate: 20.9 },
    ],
    deviceBreakdown: [
      { device: "Mobile", percentage: 64 },
      { device: "Desktop", percentage: 28 },
      { device: "Tablet", percentage: 8 },
    ],
    hourlyBestPerformance: "10-12 AM",
    topPerformingSegment: "26-35, Female",
  },
  "camp-002": {
    campaignId: "camp-002",
    totalSent: 842,
    totalOpened: 352,
    totalClicked: 205,
    openRate: 41.8,
    clickRate: 24.3,
    timeSeriesData: [
      { time: "14:00", opens: 89, clicks: 52, hour: 14 },
      { time: "15:00", opens: 124, clicks: 78, hour: 15 },
      { time: "16:00", opens: 98, clicks: 54, hour: 16 },
      { time: "17:00", opens: 41, clicks: 21, hour: 17 },
    ],
    segmentPerformance: [
      { segment: "56-65 Female", openRate: 43.2, clickRate: 25.6, count: 512 },
      { segment: "65+ Female", openRate: 38.9, clickRate: 21.4, count: 330 },
    ],
    genderPerformance: [{ gender: "Female (Senior)", openRate: 41.8, clickRate: 24.3 }],
    regionPerformance: [
      { region: "North India", openRate: 44.2, clickRate: 26.1 },
      { region: "South India", openRate: 46.1, clickRate: 27.8 },
      { region: "West India", openRate: 39.8, clickRate: 22.4 },
      { region: "East India", openRate: 37.2, clickRate: 20.1 },
      { region: "Central India", openRate: 41.5, clickRate: 24.8 },
    ],
    deviceBreakdown: [
      { device: "Mobile", percentage: 71 },
      { device: "Desktop", percentage: 22 },
      { device: "Tablet", percentage: 7 },
    ],
    hourlyBestPerformance: "2-4 PM",
    topPerformingSegment: "South India, 56-65 Female",
  },
};

export const MOCK_EMAIL_VARIANTS = [
  {
    id: "var-a",
    label: "Variant A",
    badge: "Professional",
    badgeColor: "blue",
    subject: "Introducing XDeposit: Earn 1% More on Your Term Deposits",
    body: `Dear [Customer Name],

We are pleased to introduce XDeposit, SuperBFSI's newest Term Deposit product designed to maximize your savings.

Key Benefits:
• 1 percentage point higher returns than leading competitors
• Flexible tenure: 6 months to 5 years
• 100% secured by RBI mandate
• Special 0.25% additional returns for female senior citizens

We invite you to explore how XDeposit can help you achieve your financial goals.

Explore XDeposit: https://superbfsi.com/xdeposit/explore/

Sincerely,
SuperBFSI Financial Services`,
    metrics: { expectedOpenRate: "32-36%", expectedClickRate: "16-20%" },
    tags: ["formal", "detailed", "trust-building"],
  },
  {
    id: "var-b",
    label: "Variant B",
    badge: "Friendly + Emojis",
    badgeColor: "purple",
    subject: "🎉 Great News! XDeposit Gives You 1% More Returns",
    body: `Hi [Customer Name]! 👋

Big news — SuperBFSI just launched XDeposit and it's a game-changer! 🚀

Here's why you'll love it:
✅ Earn 1% MORE than competitor FDs
💰 Your money works harder for you
🔒 100% safe & RBI guaranteed
👩‍🦳 Extra 0.25% bonus for female senior citizens!

Ready to grow your wealth? 
👉 https://superbfsi.com/xdeposit/explore/

SuperBFSI Team 💙`,
    metrics: { expectedOpenRate: "36-40%", expectedClickRate: "20-25%" },
    tags: ["casual", "emojis", "engaging", "younger-audience"],
  },
  {
    id: "var-c",
    label: "Variant C",
    badge: "Urgency-Driven",
    badgeColor: "orange",
    subject: "⏰ Act Now: Exclusive Launch Rates on XDeposit — Limited Time",
    body: `[Customer Name],

This is time-sensitive. 

XDeposit — SuperBFSI's new flagship FD — launched with special introductory rates that won't last:

⚡ 1% ABOVE market rate
⚡ Up to 9.5% p.a. returns
⚡ Additional 0.25% for female senior citizens
⚡ Lock in today's rate for 5 years

Every day you wait = money left on the table.

Secure your rate NOW → https://superbfsi.com/xdeposit/explore/

— SuperBFSI`,
    metrics: { expectedOpenRate: "38-44%", expectedClickRate: "22-28%" },
    tags: ["urgency", "scarcity", "bold", "action-oriented"],
  },
];

export const MOCK_OPTIMIZATION_SUGGESTIONS = [
  {
    id: "opt-001",
    title: "Shift Send Time to Morning Window",
    priority: "high",
    expectedImpact: "+12% Open Rate",
    reasoning:
      "ReAct Agent Analysis: Campaign 1 performance data shows peak opens at 10-11 AM (289 opens vs 142 at 9 AM). Indian BFSI customers have highest email engagement during morning commute (9-11 AM). RAG retrieval from historical BFSI campaigns confirms 74% higher CTR in morning slots. Recommend shifting campaign send time from 2 PM to 10 AM.",
    currentValue: "2:00 PM send time",
    suggestedValue: "10:00 AM send time",
    category: "timing",
    icon: "clock",
    agentThoughts: [
      "Analyzing time-series open data...",
      "Comparing with industry benchmarks...",
      "Retrieving BFSI email best practices from knowledge base...",
      "Cross-referencing with customer timezone distribution...",
      "Conclusion: Morning window statistically significant (+p<0.05)",
    ],
    status: "pending",
  },
  {
    id: "opt-002",
    title: "Add Personalized Emojis for 26-35 Segment",
    priority: "high",
    expectedImpact: "+8% Click Rate",
    reasoning:
      "ReAct Agent: Segment analysis reveals 26-35 age group (23% of cohort) has highest digital engagement but shows below-average click rate (22.1% vs 24.3% benchmark). RAG retrieval indicates emoji usage in subject lines increases open rates by 8-15% for millennial audiences. A/B testing with Variant B (emojis) showed +6.8% CTR vs Variant A for this segment. Recommend targeted emoji variant for this segment.",
    currentValue: "Standard subject line for all",
    suggestedValue: "Emoji-enhanced subject for 26-35 segment",
    category: "content",
    icon: "smile",
    agentThoughts: [
      "Segmenting performance by age group...",
      "Identifying underperforming segment: 26-35...",
      "Querying emoji impact research from knowledge base...",
      "Validating with A/B variant comparison...",
      "Recommendation generated with 87% confidence",
    ],
    status: "pending",
  },
  {
    id: "opt-003",
    title: "Personalize Subject Line with Customer Name",
    priority: "medium",
    expectedImpact: "+15% Open Rate",
    reasoning:
      "ReAct Agent: Generic subject lines across all 5000 customers shows flat open curve. Name personalization in subject lines shows consistent +12-18% open rate improvement across BFSI sector (RAG knowledge base: 127 similar campaigns analyzed). Current 34.2% open rate can reach 39-40% with personalization. Low implementation cost, high ROI potential.",
    currentValue: "Generic subject for all customers",
    suggestedValue: 'Subject: "Anita, Your Exclusive XDeposit Rate Is Ready"',
    category: "personalization",
    icon: "user",
    agentThoughts: [
      "Analyzing subject line patterns...",
      "Measuring name personalization impact in database...",
      "Found 127 relevant BFSI campaigns in knowledge base...",
      "Statistical confidence: 94.2% positive correlation...",
      "Priority: HIGH — quick win with significant impact",
    ],
    status: "approved",
  },
  {
    id: "opt-004",
    title: "Target South India Segment with Regional Language CTA",
    priority: "medium",
    expectedImpact: "+18% Click Rate",
    reasoning:
      "ReAct Agent: South India shows highest open rate (38.9%) but click rate (22.1%) lags behind open-to-click conversion potential. RAG analysis of regional campaign data indicates Tamil/Telugu/Kannada language CTAs improve conversion by 15-22% for this demographic. Recommend bilingual CTA button: English + regional language for South India customers.",
    currentValue: "English-only CTA for all regions",
    suggestedValue: "Bilingual CTA (English + regional) for South India",
    category: "localization",
    icon: "globe",
    agentThoughts: [
      "Identifying highest opportunity region...",
      "South India: High open, lower click-through gap detected...",
      "Querying regional language impact studies...",
      "Found 43 South India BFSI campaigns with language data...",
      "Bilingual approach shows 18% avg CTR improvement",
    ],
    status: "pending",
  },
  {
    id: "opt-005",
    title: "Re-engage Inactive Customers with Special Incentive",
    priority: "low",
    expectedImpact: "+5% Overall Open Rate",
    reasoning:
      "ReAct Agent: 1,240 customers (24.8% cohort) are marked inactive but campaign brief specified not to skip them. RAG analysis shows inactive BFSI customers respond to exclusive/VIP framing and limited-time offers. Recommend separate micro-campaign with 'exclusive reactivation offer' framing and unique discount code to differentiate from main campaign.",
    currentValue: "Same content sent to inactive segment",
    suggestedValue: "Dedicated re-engagement campaign with VIP framing",
    category: "segmentation",
    icon: "users",
    agentThoughts: [
      "Analyzing inactive customer response patterns...",
      "Retrieving re-engagement best practices...",
      "Calculating potential uplift from dedicated campaign...",
      "Risk assessment: Low risk, medium effort...",
      "ROI positive if >3.2% conversion rate achieved",
    ],
    status: "pending",
  },
];

export const MOCK_AGENT_LOGS = [
  { timestamp: "09:00:01", level: "INFO", agent: "Orchestrator", message: "Campaign brief received. Parsing intent..." },
  { timestamp: "09:00:02", level: "INFO", agent: "ReAct-Planner", message: "THOUGHT: Identifying key campaign parameters from brief" },
  { timestamp: "09:00:03", level: "INFO", agent: "ReAct-Planner", message: "ACTION: extract_campaign_intent(brief='Run email campaign for XDeposit...')" },
  { timestamp: "09:00:04", level: "INFO", agent: "ReAct-Planner", message: "OBSERVATION: Extracted: product=XDeposit, goal=open_rate+click_rate, special_segment=female_senior_citizens" },
  { timestamp: "09:00:05", level: "INFO", agent: "RAG-Retriever", message: "Querying knowledge base for BFSI email campaign best practices..." },
  { timestamp: "09:00:07", level: "INFO", agent: "RAG-Retriever", message: "Retrieved 23 relevant documents on term deposit marketing" },
  { timestamp: "09:00:08", level: "INFO", agent: "Content-Generator", message: "Generating 3 email variants (A: professional, B: friendly+emoji, C: urgency)" },
  { timestamp: "09:00:12", level: "INFO", agent: "Content-Generator", message: "All 3 variants generated successfully" },
  { timestamp: "09:00:13", level: "INFO", agent: "Strategy-Agent", message: "Recommending A/B/C testing across customer cohort" },
  { timestamp: "09:00:14", level: "INFO", agent: "Strategy-Agent", message: "Optimal send time: 10:00 AM IST (based on historical data)" },
  { timestamp: "09:00:15", level: "SUCCESS", agent: "Orchestrator", message: "Campaign plan ready. Awaiting human-in-loop approval." },
];

export const DASHBOARD_STATS = {
  totalCampaigns: 3,
  totalCustomersReached: 6082,
  avgOpenRate: 38.0,
  avgClickRate: 21.5,
  activeOptimizations: 3,
  pendingApprovals: 2,
};
