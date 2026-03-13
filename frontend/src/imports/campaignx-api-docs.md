 
 
InXiteOut CampaignX API v1.0 - Documentation 
1. Introduction 
Welcome to the CampaignX API! This high-performance API allows you to programmatically manage 
your marketing campaigns. You can retrieve customer cohorts, submit new campaigns, and fetch 
detailed reports. 
Our API is built around RESTful principles and returns JSON responses. This document provides all 
the necessary information to integrate with CampaignX successfully. 
Base URL: https://campaignx.inxiteout.ai 
API Version: 1.0 
Documentation Version: 1.0 
2. Getting Started 
2.1. Authentication & API Keys 
To interact with the CampaignX API, you must authenticate all your requests (except for the signup 
endpoint) using an API key. 
• 
How to obtain an API Key: You will receive your unique API key upon successful registration 
via the /api/v1/signup endpoint. Store this key securely, as it is shown only once. 
• 
How to use it: The API key must be included in the X-API-Key header of every request. 
Example Header: 
X-API-Key: xK8mP3nR7sT9vW2yZ5bN4mQ6jL1hG0fD 
2.2. Rate Limiting 
To ensure fair usage and system stability, the API enforces rate limits based on your API key. 
• 
Limit: 100 requests per day. 
• 
Scope: This limit applies to all authenticated endpoints (e.g., getting cohorts, sending 
campaigns, fetching reports). 
• 
Monitoring: Exceeding this limit will result in a 429 Too Many Requests response. 
2.3. Making Requests & Handling Responses 
• 
Request Format: For POST requests, the request body must be sent in JSON format with 
the Content-Type: application/json header. 
• 
Response Format: All successful responses (2xx status codes) will be in JSON format. 
• 
Error Handling: API errors will return appropriate HTTP status codes (e.g., 4xx for client 
errors, 5xx for server errors) along with a JSON body containing details about the error. Refer 
to the Error Handling section for more information. 
 
 
 
 
3. API Endpoints 
This section details all available API endpoints. You can also use the provided examples to test the 
API. 
3.1. Authentication 
3.1.1. Signup 
Registers a new team and generates a secure API key. 
• 
Endpoint: POST /api/v1/signup 
• 
Description: This is the only unauthenticated endpoint. It validates team information, 
ensures uniqueness, creates a team record, generates an API key, and sends a welcome email 
containing the key. 
Request Body: 
Parameter 
Type 
Required 
Description 
team_name 
String 
Yes 
Team name. Must be alphanumeric and 3-100 characters 
long. 
team_email 
String (email) 
Yes 
A valid team email address. Must be unique in the system. 
 
Example Request: 
bash 
curl -X POST https://api.campaignx.com/api/v1/signup \ 
  -H "Content-Type: application/json" \ 
  -d '{ 
    "team_name": "Marketing Team", 
    "team_email": "marketing@example.com" 
  }' 
Success Response (201 Created): 
json 
{ 
  "api_key": "xK8mP3nR7sT9vW2yZ5bN4mQ6jL1hG0fD", 
  "team_name": "Marketing Team", 
  "team_email": "marketing@example.com", 
  "created_at": "2026-02-17T15:30:00Z", 
  "message": "Team registered successfully. API key sent to your email." 
} 
 
 
 
3.2. Customer Data 
3.2.1. Get Customer Cohort 
Retrieves the list of customers that campaigns can be sent to. 
• 
Endpoint: GET /api/v1/get_customer_cohort 
• 
Description: Fetches the customer cohort data. This data includes customer identifiers and 
attributes needed for targeting. 
• 
Authentication: Required (API Key via X-API-Key header) 
• 
Rate Limit: Yes (100/day) 
Success Response (200 OK): 
Parameter 
Type 
Description 
data 
Array[Object] 
An array of customer objects. 
total_count 
Integer 
The total number of customer records in the cohort. 
response_code 
Integer 
The HTTP status code (200). 
message 
String 
A descriptive message about the response. 
Example Request: 
bash 
curl -X GET https://api.campaignx.com/api/v1/get_customer_cohort \ 
  -H "X-API-Key: xK8mP3nR7sT9vW2yZ5bN4mQ6jL1hG0fD" 
Example Response: 
json 
{ 
  "data": [ 
    { 
      "customer_id": "CUST001", 
      "email": "john@example.com", 
      "name": "John Doe" 
    }, 
    { 
      "customer_id": "CUST002", 
      "email": "jane@example.com", 
      "name": "Jane Smith" 
    } 
  ], 
  "total_count": 5000, 
  "response_code": 200, 
  "message": "Customer cohort retrieved successfully" 
} 
 
 
3.3. Campaigns 
3.3.1. Send Campaign: Submit a new marketing campaign to a targeted customer cohort. 
• 
Endpoint: POST /api/v1/send_campaign 
• 
Description: This endpoint Submit a new marketing campaign to a targeted customer cohort. 
It accepts the message content as subject, body, target customer, and send time. The API 
validates that all provided customer_ids exist in the cohort and that there are no duplicates. 
• 
Authentication: Required (API Key via X-API-Key header) 
• 
Rate Limit: Yes (100/day) 
Request Body: 
Parameter 
Type 
Required 
Description 
body 
String 
Yes 
The main content of the campaign message. 
Supports UTF-8 (e.g., emoji) and URLs. 
Maximum 5000 characters. 
list_customer_ids 
Array[String] 
Yes 
List of unique customer IDs to contact. 
Customer IDs passed must be present in 
Customer Cohort. 
send_time 
String 
Yes 
The planned send time. Format: DD:MM:YY 
HH:MM:SS (e.g., 23:02:26 15:30:00). 
subject 
String or null 
No 
Email subject (required for Email). Supports text 
and emojis. Max 200 characters. 
 
Example Request: 
bash 
curl -X POST https://api.campaignx.com/api/v1/send_campaign \ 
  -H "X-API-Key: xK8mP3nR7sT9vW2yZ5bN4mQ6jL1hG0fD" \ 
  -H "Content-Type: application/json" \ 
  -d '{ 
    "subject": "Special Offer - 20% Off!", 
    "body": "Don'\''t miss out on our exclusive offer!   Visit https://example.com for details.", 
    "list_customer_ids": ["CUST001", "CUST002", "CUST003"], 
    "send_time": "23:02:26 15:30:00" 
  }' 
 
 
 
 
Success Response (200 OK): 
json 
{ 
  "campaign_id": "123e4567-e89b-12d3-a456-426614174000", 
  "response_code": 200, 
  "invokation_time": "23:02:26 15:30:00", 
  "message": "Campaign submitted successfully" 
} 
3.4. Reports 
3.4.1. Get Report 
Retrieves the performance report for a specific campaign. 
• 
Endpoint: GET /api/v1/get_report 
• 
Description: Fetches detailed engagement data for a campaign, such as opens, and clicks. 
• 
Authentication: Required (API Key via X-API-Key header) 
• 
Rate Limit: Yes (100/day) 
Query Parameters: 
Parameter 
Type 
Required 
Description 
campaign_id 
String 
Yes 
The unique ID of the campaign ID to retrieve 
report 
 
 
 
 
 
 
 
 
Parameter 
Type 
Description 
campaign_id 
String 
The unique identifier for the newly created campaign (UUID). 
response_code 
Integer 
The HTTP status code (200). 
invokation_time 
String 
Timestamp of when the API call was processed. Format: DD:MM:YY 
HH:MM:SS. 
message 
String 
A success message confirming submission. 
 
 
Example Request: 
bash 
curl -X GET "https://api.campaignx.com/api/v1/get_report?campaign_id=123e4567-e89b-12d3-a456-
426614174000" \ 
  -H "X-API-Key: xK8mP3nR7sT9vW2yZ5bN4mQ6jL1hG0fD" 
 
Success Response (200 OK): 
json 
{ 
  "campaign_id": "123e4567-e89b-12d3-a456-426614174000", 
  "data": [ 
    { 
     "invokation_time": "04:31:00", 
     "invokation_date": "25:02:26", 
   "campaign_id": "b77f9b02-562c-41fb-a262-20c74c8a70cb", 
   "customer_id": "CUST0006", 
    "send_time": "23:02:26 05:00:00", 
   "subject": "Special Offer - 20% Off!", 
   "body": "Don't miss out on our exclusive offer!   Visit https://example.com for details.", 
   "EO": "N", 
   "EC": "N" 
    }, 
    { 
    "invokation_time": "04:31:00", 
            "invokation_date": "25:02:26", 
            "campaign_id": "b77f9b02-562c-41fb-a262-20c74c8a70cb", 
            "customer_id": "CUST0007", 
            "send_time": "23:02:26 05:00:00", 
            "subject": "Special Offer - 20% Off!", 
            "body": "Don't miss out on our exclusive offer!   Visit https://example.com for details.", 
            "EO": "N", 
            "EC": "N" 
Parameter 
Type 
Description 
campaign_id 
String 
The campaign ID the report belongs to. 
data 
Array[Object] 
An array of objects, each representing a customer's interaction status. 
total_rows 
Integer 
The total number of records in the report (should match the number of 
customers targeted). 
response_code 
Integer 
The HTTP status code (200). 
message 
String 
A descriptive message. 
 
 
    } 
  ], 
  "total_rows": 2, 
  "response_code": 200, 
  "message": "Report retrieved successfully" 
"campaign_id": "b77f9b02-562c-41fb-a262-20c74c8a70cb" 
} 
 
4. Error Handling 
The CampaignX API uses conventional HTTP response codes to indicate the success or failure of an 
API request. In general, codes in the 2xx range indicate success, codes in the 4xx range indicate an 
error that resulted from the provided information (e.g., a required parameter was missing, a 
validation failed), and codes in the 5xx range indicate an error with CampaignX's servers. 
When a 4xx or 5xx error occurs, the response body will contain a JSON object describing the error, 
typically a ValidationError or HTTPValidationError. 
Common Error Codes: 
Status Code 
Title 
Description 
400 
Bad Request 
The request was malformed or contains invalid parameters. 
401 
Unauthorized 
Missing or invalid API key. Ensure your X-API-Key header is set correctly. 
403 
Forbidden 
The API key is valid but does not have permission to access the resource. 
404 
Not Found 
The requested resource (e.g., a campaign or endpoint) was not found. 
422 
Unprocessable 
Entity 
The request body or parameters were well-formed but contain semantic 
errors (e.g., a customer ID in the list does not exist, or a field failed 
validation). The response body will detail the specific errors. 
429 
Too Many Requests 
You have exceeded your rate limit of 100 requests per day. 
5xx 
Server Error 
An internal server error occurred. Please contact support if the problem 
persists. 
 
 
 
 
 
 
 
 
 
Example 422 Validation Error Response: json 
{ 
  "detail": [ 
    { 
      "loc": ["body", "list_customer_ids", 0], 
      "msg": "Customer ID 'CUST999' not found in cohort.", 
      "type": "value_error" 
    }, 
    { 
      "loc": ["body", "send_time"], 
      "msg": "Invalid datetime format. Use DD:MM:YY HH:MM:SS", 
      "type": "value_error.format" 
    } 
  ] 
} 
