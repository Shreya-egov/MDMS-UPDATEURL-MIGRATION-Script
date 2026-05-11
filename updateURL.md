I need a production-ready automation script for MDMS URL migration.

Objective:
Search all MDMS records using the search API, identify any occurrence of:

"/workbench-ui/employee"

and replace it with:

"/chad/hcm-digit-ui/employee"

Then update the modified records back using the update API.

SEARCH API CURL:

curl --location 'https://campaigns.afro.who.int/mdms-v2/v2/_search' 
--header 'content-type: application/json;charset=UTF-8' 
--data '{
"MdmsCriteria": {
"tenantId": "chad",
"limit": 100000,
"schemaCode": "ACCESSCONTROL-ACTIONS-TEST.actions-test"
},
"RequestInfo": {
"authToken": "<TOKEN>"
}
}'

UPDATE API CURL:

curl --location 'https://campaigns.afro.who.int/mdms-v2/v2/_update/ACCESSCONTROL-ACTIONS-TEST.actions-test' 
--header 'content-type: application/json;charset=UTF-8' 
--data-raw '{
"Mdms": {
...
},
"RequestInfo": {
"authToken": "<TOKEN>"
}
}'

Requirements:

1. Flow

* Call the search API first
* Fetch all MDMS records
* Recursively scan every object/array/string field
* Detect occurrences of:
  "/workbench-ui/employee"
* Replace with:
  "/chad/hcm-digit-ui/employee"
* Call update API only for modified records

2. Recursive Replacement
   The script must update values inside:

* navigationURL
* url
* nested objects
* arrays
* deeply nested structures
* any string containing the old path

Example:

Before:
"/workbench-ui/employee/hrms/create"

After:
"/chad/hcm-digit-ui/employee/hrms/create"

3. Script Features

* Dry-run mode
* Backup JSON export before update
* Retry mechanism for failed API calls
* Graceful error handling
* Parallel/batch processing support
* Detailed logging

4. Logging Requirements
   Print:

* schemaCode
* uniqueIdentifier
* old URL
* new URL
* API response status
* success/failure count
* skipped count
* total replacements count

5. Configuration
   Use:

* .env file
* configurable base URL
* configurable schemaCode
* configurable tenantId
* configurable auth token




7. Code Quality
   Generate:

* modular clean architecture
* reusable functions
* enterprise-level code
* proper comments
* async/await implementation
* production-ready folder structure

8. Include:

* full runnable script
* package.json
* sample .env
* installation commands
* execution commands
* sample API response handling
* sample logs
* README instructions

9. Important Conditions

* Preserve complete JSON structure exactly
* Skip invalid/null records safely
* Do not update unchanged records
* Support multiple schemaCodes
* Handle large datasets efficiently

10. Bonus
    Add:

* CSV report generation
* rollback capability using backup files
* summary report at end of execution

Generate complete working code end-to-end.
