# Lex Bot UI - for Couchbase

This is the lex bot ui appilication for the couchbase docs chat feature

## Table of Contents

- [Lex Bot UI - for Couchbase](#lex-bot-ui---for-couchbase)
  - [Table of Contents](#table-of-contents)
  - [Bot Installation](#bot-installation)
    - [LocalHost](#localhost)
  - [Embedding the Chatbot](#embedding-the-chatbot)
    - [Copy Files](#copy-files)
    - [Import Statements](#import-statements)
      - [CSS](#css)
      - [JQuery](#jquery)
      - [Loader Script](#loader-script)
      - [Config](#config)
        - [Other Configurations](#other-configurations)
        - [Optional Scripts](#optional-scripts)
  - [Chat API](#chat-api)
  - [More Info](#more-info)

## Bot Installation
- `npm install`
- `npm run start`

This will launch the chat application @ `localhost:8080` in a fullPage type view. Later this is what we will load into our iFrame.

### LocalHost
  When testing locally, you can use the test-host-website project to launch the parent.html page with the embedded chatbot iFrame. See `./test-host-website/README.md`

## Embedding the Chatbot

The Chatbot iteself is a simple vue application, that can be hosted anywhere.

To inject the chatbot onto another site, you'll need to host the bot (parent project) and it's code somewhere.
Once that's complete grab the url for the chat application. 

**NOTE:** To have the bot remain open during the users full session import the following code onto the file that injects your web application. Usually `index.html` or a layout page.

### Copy Files
The following files from this directory will need to be included in your project.

CSS - ` ./test-host-website/public/lex-web-ui-loader/css/chatbot.css`

JS - `./test-host-website/public/lex-web-ui-loader/js/chatbot.min.js`

### Import Statements

#### CSS 

Add to the head of the html.

```html
<link rel="stylesheet" href="<path_to>/chatbot.css" />
```

#### JQuery

```html
   <script
      src="https://code.jquery.com/jquery-3.2.1.min.js"
      integrity="sha256-hwg4gsxgFZhOsEEamdOYGBf13FyQuiTwlAQgxVSNgt4="
      crossorigin="anonymous"
    ></script>
```

#### Loader Script

```html
<script src="<path_to>/chatbot.min.js"></script>

<script>
  var iframeLoader = new ChatBotUiLoader.IframeLoader();

  var chatbotUiconfig = { ... }

  // load the iframe
  iframeLoader
    .load(chatbotUiconfig)
    .then(function () {
      iframeLoader.api.ping();
      // perform actions on the parent dependent on the chatbot loading.
      $("#send-intent").prop("disabled", false);
    })
    .catch(function (error) {
      console.error("chatbot UI failed to load", error);
    });
</script>
```

#### Config 

1. Add this config to the script above @ `var chatbotUIconfig = {...}`

2. Replace the `ui.parentOrigin` of the config with the host site url.
   - Chatbot will not work from files directory, requires url, localhost @ any port number will do.
   - **Note:** the `ui.parentOrigin` on the config that is hosted within the chatbot-ui-application needs to match.
3. Update the `iframe.iframeOrigin` of the config to the chatBot's url.

```json
{
  ui: {
    parentOrigin: "http://localhost:8000",
    toolbarTitle: "Couchbase",
    toolbarLogo: "https://www.couchbase.com/wp-content/uploads/sites/3/2023/10/SDKs_Ottoman.svg",
    positiveFeedbackIntent: "Thumbs up",
    negativeFeedbackIntent: "Thumbs down",
    helpIntent: "Help",
    enableLogin: false,
    forceLogin: false,
    AllowSuperDangerousHTMLInMessage: true,
    shouldDisplayResponseCardTitle: false,
    saveHistory: false,
    minButtonContent: "",
    hideInputFieldsForButtonResponse: false,
    pushInitialTextOnRestart: false,
    directFocusToBotInput: false,
    showDialogStateIcon: false,
    backButton: false,
    messageMenu: true,
    hideButtonMessageBubble: false,
    enableLiveChat: false,
  },
  iframe: {
    iframeOrigin: "http://localhost:8080",
    shouldLoadIframeMinimized: true,
    iframeSrcPath: "/#/?lexWebUiEmbed=true",
  },
};
```

##### Other Configurations

Mentioned above; You will need to update the config files within the chat bot's code: `config.prod.json` & `config.dev.json`. This is so it knows who to expect calls from. This cannot be dynamically updated from the iframe config for security reasons.

- replace the `ui.parentOrigin` with the host site url.
- update the `iframe.iframeOrigin` to the chatBot's url.

#####  Optional Scripts


You can import this script as well to start utlizing event updates to send or receive data to & from the chatbot UI. Current functionality does not require any of this. (this code can be found in the parent.html)

```html
    <script>
      $(document).ready(function chatbotHandler() {
        // When the chatbot ui iframe is ready to receive the
        // dynamic config it sends the 'receivelexconfig' event to the parent
        // For example, you can send dynamic config/parameters
        // (e.g. username, geolocation) to the chatbot ui from here
        $(document).one("receivelexconfig", function onReceiveLexConfig() {
          var event = new CustomEvent("loadlexconfig", {
            detail: { config: chatbotUiconfig },
          });
          document.dispatchEvent(event);
        });

        // Once the chatbot UI is ready, it sends a 'lexWebUiReady' event
        $(document).on("lexWebUiReady", function onUpdateLexState(evt) {
          // empty
        });

        // bot update event handler
        // parent page can be updated when lex state changes
        $(document).on("updatelexstate", function onUpdateLexState(evt) {
          // empty
        });
      });
    </script>
```

## Chat API
 The URI for the active lexbot API is defined as `this.apiUri = ''` in the constructor for `client.js` within the application.

## More Info
  For more information checkout the README-Original-AWS.md
  
  This file includes more indepth information about the project, and was taken from the example project for the lex-chat-ui by aws.