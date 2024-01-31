# Lex Bot UI - for Couchbase

This is the lex bot ui appilication for the couchbase docs chat feature

## Table of Contents

- [Lex Bot UI - for Couchbase](#lex-bot-ui---for-couchbase)
  - [Table of Contents](#table-of-contents)
  - [Installation](#installation)
    - [LocalHost](#localhost)
    - [Hosted](#hosted)
  - [More Info](#more-info)

## Installation
- `npm install`
- `npm run start`

This will launch the chat application @ `localhost:8080` in a fullPage type view. Later this is what we will load into our iFrame.

### LocalHost
  When running locally, you can use the test-host-website project to launch the parent page and chatbot iFrame.

### Hosted
  When hosting this application elsewhere make sure to update the config files url's for both the chatbot `/config/*`.
  
  The hosts UI config will need updated as well (see test-host-website README)

## More Info
  For more information checkout the README-Original-AWS.md
  
  This file includes more indepth information about the project, and was taken from the example project for the lex-chat-ui by aws.