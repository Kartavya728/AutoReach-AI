 
FrostHack | XPECTO 2026 
CampaignX: AI Multi-Agent System for 
Marketing Campaign Automation 
InXiteOut | IIT Mandi Tech Fest 
 
This document acts as the Rule Book for CampaignX hackathon being conducted by InXiteOut 
as part of FrostHack, XPECTO 2026 Tech Fest at IIT Mandi. The rules laid out in this document 
governs the terms and conditions of this hackathon event. 
1 Objective 
Build AI Agent-based web application for end-to-end Digital Marketing Campaign Management 
for SuperBFSI, an Indian BFSI service provider catering to customers located across India. The 
application should have human-in-the-loop for critical approvals and a functional UI. 
2 Prizes 
2.1 Monetary Rewards for the Winning Teams 
• 
1st Prize: INR 25,000 to the respective team 
• 
2nd Prize: INR 15,000 to the respective team 
• 
3rd Prize: INR 10,000 to the respective team 
• 
Vouchers worth INR 30,000 in total to other good teams 
For matters regarding the selection of winners, InXiteOut’s decision will be final and binding. 
2.2 Other Potential Rewards to Outstanding Individuals 
The submissions will be judged by the co-founder(s) of InXiteOut. If you truly stand out, we may 
explore the following possible benefits based on merit and alignment: 
• 
Paid Internship opportunity (for 3-6 months duration) in our AI Engineering dept. 
• 
Opportunity to appear directly in the Final Technical Round of our Off-Campus 
Interview (i.e., by skipping the written test and initial technical rounds) for Full-Time 
Hiring in our AI Engineering dept (this is applicable for only final year students who, if 
selected, can join us within 6 months of the offer date). 
For matters regarding Internships and Off-Campus Interviews, InXiteOut’s decision will be final 
and binding.  
 
3 Background 
Modern marketing campaigns require coordination across multiple channels: email, text 
message, social media, paid ads, landing pages, and analytics platforms. Campaign managers 
often spend more time on repetitive tasks such as data gathering, segmentation, scheduling, and 
reporting than on optimization strategy and creativity. 
AI agents have the potential to transform this process by acting as autonomous campaign 
assistants that can plan, execute, monitor, and optimize campaigns. However, building such 
agents requires integrating multiple APIs, handling real-time feedback, and making intelligent 
decisions based on data. 
This hackathon challenges participants to design and build an AI-based multi-agent system for 
managing digital (Email only) marketing campaigns for SuperBFSI, a BFSI service provider 
catering to customers located across India. The solution needs to be delivered as a web 
application with a functional UI that allows human-in-the-loop approach for critical approvals. 
The scope is limited to India only. 
4 Core Problem Statement 
Build an AI agent solution that can plan, launch, monitor, and optimize a digital marketing 
campaign (via email), for launching a new Term Deposit product for SuperBFSI. The system 
should be capable of automatically: 
i. 
Understanding the campaign brief as provided by the marketer as natural language text 
input via the UI (e.g., “Run email campaign for launching XDeposit, a flagship term deposit 
product from SuperBFSI, that gives 1 percentage point higher returns than its 
competitors. Announce an additional 0.25 percentage point higher returns for female 
senior citizens. Optimise for open rate and click rate. Don’t skip emails to customers 
marked ‘inactive’. Include the call to action: https://superbfsi.com/xdeposit/explore/.”). 
a. Note: The URL mentioned above is dummy. 
ii. 
Identifying campaign strategy for optimal performance metrics (open rate and click rate). 
a. Note: Campaign performance metrics (i.e., open rate and click rate) may depend 
on various factors such as customer demography, behavioural segmentation, 
time slot when the email campaign was sent, email content (including but not 
limited to style, tone, font, length etc.). 
iii. 
Generating campaign assets/contents/creatives according to the campaign strategy 
identified. 
iv. 
Requesting UI-based human-in-loop approval for executing the strategy identified. 
v. 
Integrating and leveraging campaign management and reporting APIs as described in 
Section 5.2 to: 
a. Execute campaign actions. 
b. Collect performance metrics (open rate and click rate). 
vi. 
Analysing performance metrics. 
vii. 
Iterating steps ii-vi. 
 
5 Tech Stack 
• 
Use programming language(s), agentic framework(s), libraries, tools of your choice. 
• 
Cloud deployment is not mandatory. But a live demonstration is needed (from a local 
system if cloud deployment is not done). 
• 
Free tier / trial access of the following tools (a non-exhaustive, tentative list) can be used 
(however, participants may as well use other tools of their choice): 
o Cloud deployment (optional) 
▪ 
Appwrite: https://appwrite.io/pricing 
▪ 
Render: https://render.com/pricing 
▪ 
Netlify: https://www.netlify.com/pricing/ 
▪ 
Vercel: https://vercel.com/pricing 
o Databases (if/as required) 
▪ 
MongoDB 
▪ 
SQLite / MySQL 
▪ 
PostgreSQL 
5.1 GenAI Tools 
Use open-source LLMs and/or free tier / trial LLM APIs of any provider (e.g., Gemini / Groq / Mistral 
/ OpenRouter / Cohere / AnyScale / HuggingFace / AIMLAPI etc.). 
An indicative list (non-exhaustive) along with best practices and key setup guides is captured 
here: LLM API Key Setup Guide.  
However, participants are free to use APIs / LLMs of their choice. 
5.2 Email Campaign Management APIs 
API Documentation: 
• 
Downloadable OpenAPI Specification in ReDoc format. 
• 
PDF document. 
These APIs are made available to the participants for the purposes of this hackathon.  
A daily rate limit of 100 calls per day per registered team for each endpoint apply. Only one signup 
should be done per team. For more information, please refer to the API documentation link 
mentioned above. 
5.3 Tentative Solution Architecture 
The solution may have at least the following components: 
• 
Backend that supports agentic automation of: 
o 
Customer profiling 
o 
Campaign strategy for optimal performance metrics (open rate and click rate) 
o 
Campaign content generation 
o 
Campaign sending/scheduling (subject to human-in-loop approval) 
o 
Campaign report data collection 
o 
Campaign report data analysis 
• 
Frontend involving: 
 
o 
Simple, functional UI that allows human-in-loop decision-making before 
sending/scheduling campaigns 
6 Required Functional Capabilities 
6.1 Customer Cohort 
Get customer cohort by using APIs as described in Section 5.2. This will act as the customer 
master data including customer ids and their demographic details. 
6.2 Campaign Brief 
The agent system must be able to parse a campaign brief to be provided as an input (as free-
flowing natural language text) by the marketer to the application via UI (e.g., “Run email 
campaign for launching XDeposit, a flagship term deposit product from SuperBFSI, that gives 1 
percentage point higher returns than its competitors. Announce an additional 0.25 percentage 
point higher returns for female senior citizens. Optimise for open rate and click rate. Don’t skip 
emails 
to 
customers 
marked 
‘inactive’. 
Include 
the 
call 
to 
action: 
https://superbfsi.com/xdeposit/explore/.”) 
Note: The URL mentioned above is dummy. 
6.3 Campaign Planning 
The agent system must be able to generate automatically: 
• 
Campaign strategy 
o 
Note: To allow the agent system to make automated optimizations based on 
results in order to enhance the campaign performance metrics, it is 
recommended to use A/B testing or similar methodologies. 
• 
Customer segment (i.e. list of customer IDs) to which the campaign should be sent 
• 
Time to send the campaign 
6.4 Content Generation 
The email campaign body may contain only the following types of elements: 
• 
Any text in English 
• 
Any emoji 
• 
A specific URL: https://superbfsi.com/xdeposit/explore/ 
 The email campaign subject header may contain only the following types of elements: 
• 
Any text in English 
The agent system should automatically: 
• 
Generate text variations (title and body content, style, tone, length etc.) 
• 
Decide if any font variations (viz., underline, bold, italicize) to be done in the content and 
if yes, what and where in the content; and do accordingly 
• 
Decide whether to include any emoji and if yes, what and where in the content; and do 
accordingly 
 
• 
Decide whether to include the URL mentioned above and if yes, where in the content; and 
do accordingly 
6.5 Human-in-Loop Approval 
The application must: 
• 
Display campaign details (including content, list of customers to whom this content will 
be sent, time to send etc.) on UI to enable informed decision-making by human 
• 
Allow approval / rejection 
6.6 Campaign Scheduling 
The agent system must leverage APIs as described in Section 5.2 to schedule the campaign on 
any future date & time. 
Note:  
• 
For the purposes of this hackathon, scheduling a campaign will be considered as 
equivalent to executing the campaign.  
• 
Deterministic API calling should be avoided. Rather, for true agentic workflow, API 
documentation-based automatic and dynamic discovery for tool calling must be 
implemented. 
6.7 Performance Monitoring 
The agent system must automatically: 
• 
Fetch campaign performance report (opens and clicks) through APIs as described in 
Section 5.2. 
• 
Analyse them. 
Note: For the purposes of this hackathon, it will be possible to fetch campaign performance 
report immediately after the campaign is scheduled (even if the scheduled time is still in future). 
This is to expedite the development process by allowing participants to receive gamified 
performance metrics (in alignment with various campaign factors) immediately without needing 
to wait.  
6.8 Autonomous Optimization 
Based on performance metrics (open rate and click rate), the agent system should 
automatically: 
• 
Identify micro-segments 
o 
Generate optimized variants 
o 
Adjust: 
▪ 
Email (content, style, tone, font etc.) 
▪ 
Send time (scheduling on a future time is possible) 
• 
Relaunch: 
o 
Send updated / new campaign to specific segment(s) or entire cohort (subject to 
human-in-loop approval) 
 
7 Submission  
7.1 Phases 
We are dividing the hackathon timeline into two distinct phases: 
• 
Development phase (2 weeks long): From the start of CampaignX Rule Book launch (on 
27th February 2026) till 13th March 11:59:59 PM. 
• 
Test phase (2 days long): 14th March 12:00:00 AM to 16th March 2026. 
o Note: The customer cohort returned by the API during the Test phase might be 
different from the customer cohort returned by the API during the Development 
phase. That is, the customer cohort might be changed on 14th March 12:00:00 
AM. Participants must retrieve the new customer cohort for all the 
deliverables described below and avoid using the old customer cohort. 
7.2 Deliverables 
• 
Code in any Git-based repository for the web application prototype. 
o 
Note: A basic MVP solution is all that’s required. Scalability is out of scope.  
• 
Screen recording session (video less than 3 minutes long) showcasing the end-to-end 
working of the application. Teams must demonstrate at least one automated campaign 
optimization loop during the screen recording session. Teams must showcase code 
snippets that highlight API documentation-based dynamic discovery for campaign 
management API tool calling. 
o 
Note: The recording must happen during the Test phase. 
• 
Slide deck (not more than 5 slides excluding the cover slide and thank you slide) 
o 
An executive summary of customer insights based on campaigns runs during the 
Test phase (not more than 5 bullets). 
o 
Architecture, workflow, and tech stack overview. 
7.3 Submission Mechanism, Format, and Deadline 
Participants will get 2 weeks of time to develop their solution.  
The deliverables mentioned in Section 7.2 will need to be submitted by 14th March 2026, 
11:59:59 PM, by sending an email to campaignx@inxiteout.ai, with only <team name> 
mentioned as the subject header. 
The email body should include nothing but 3 links: 
i. 
Publicly accessible link to code repository (e.g., GitHub) containing the code developed 
ii. 
Publicly accessible link to screen recording video hosted on 3rd party storage location 
(e.g., YouTube, Google Drive etc.) 
iii. 
Publicly accessible link to deck hosted on 3rd party storage location (e.g., Google Drive). 
Notes: 
• 
All the links to be mentioned in the email body must be publicly accessible. Otherwise, 
the team will be automatically disqualified. Teams are requested to take caution to 
ensure and validate that the links included in the email are correct and publicly 
accessible. 
 
• 
Only one submission per team is allowed. In case of duplicate submissions by the same 
team, only the latest submission will be considered. 
• 
Submissions after the deadline (i.e., after 14th March, 11:59:59 PM) won’t be accepted. 
8 Evaluation 
The evaluation will happen in two steps. 
8.1 Step 1: Shortlisting 
8.1.1 Dates 
Based on the Test phase Submission as described in Section 7.3, top ten (10) teams will be 
shortlisted to make presentations in front of InXiteOut judges at IIT Mandi campus. The names 
of the shortlisted teams will be announced by 15th March 2026 11:59:59 PM. 
Any deviations from the rules and guidelines laid out in this document will result in 
disqualification. 
8.1.2 Criteria 
Criterion 
Weight 
Campaign performance metrics 
50% 
Functionality & completeness 
30% 
Deliverable quality 
20% 
Notes: 
• 
The open rate and click rate of the entire relevant customer cohort, based on the latest 
campaigns executed during the Test phase, will be considered as campaign performance 
metrics.  
o That is, the minimum set of latest campaigns that covered the entire 
customer cohort during the Test phase will be considered.  
• 
The weightage distribution across open rate and click rate while computing the scores 
for campaign performance metrics criteria will be: 
o Click rate: 70% 
o Open rate: 30% 
8.1.3 Red Flags 
• 
Screen recording with the old customer cohort that existed during Development phase 
(i.e., before 14th March 12:00:00 AM). 
• 
Only a chatbot or copy generator. 
• 
No agentic integration of campaign management APIs (i.e., deterministic API calling 
instead of API documentation-based dynamic discovery for tool calling). 
• 
Manual optimization instead of decisions by agent system. 
• 
Hardcoded campaign flows without automated reasoning. 
• 
No human-in-loop. 
 
8.2 Step 2: Live Presentation 
8.2.1 Date 
The shortlisted teams will make presentations in front of InXiteOut judges at IIT Mandi campus on 
16th March 2026. 
8.2.2 Format 
• 
Each team will get a maximum of 15 mins in total: 
o Up to 6 mins for Presentation 
o Followed by up to 4 mins for a Live Demo 
▪ 
Note: The campaign brief (see Section 6.2) may be requested to be 
changed by the judges during the Live Demo on an ad-hoc basis to 
validate the agentic workflow quality and stability. 
o Followed by 5 mins for Q&A 
• 
The Presentation should: 
o Explain the architecture and agentic workflow 
o Highlight the differentiating factors (along with appropriate substantiations) of 
the application developed by the team 
8.2.3 Criteria 
Criterion 
Weight 
Campaign performance metrics 
20% 
Quality of AI agent system logic 
20% 
User experience & stable execution 
15% 
Code modularity and readability 
15% 
Presentation skills 
15% 
Innovation & creativity 
15% 
Note: 
• 
For the campaign performance metrics criteria, the scores from the Shortlisting step will 
be used as is. 
• 
However, the remaining criteria will be scored based on Live Presentation performance. 
8.2.4 Bonus Points (Optional) 
• 
Logging of agent interaction / decision / reasoning data including input and output. 
• 
Real-time dashboards of campaign performance metrics. 
• 
Cloud deployment. 
Note: Achieve excellence in criteria mentioned in Section 8.2.3 before focusing on Bonus Points. 
8.3 Result Announcement 
The final result will be announced on 16th March 2026 based on Live Presentation performance. 
