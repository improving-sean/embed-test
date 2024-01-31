# LocalHost ChatBot UI

This is the Node.js server that makes it easy to debug the Chat Bot UI locally.

## Table of Contents

- [LocalHost ChatBot UI](#localhost-chatbot-ui)
  - [Table of Contents](#table-of-contents)
  - [Installation](#installation)
  - [Usage](#usage)
  - [Inject Chatbot Anywhere](#inject-chatbot-anywhere)
    - [Copy code](#copy-code)
    - [CSS](#css)
    - [JQuery](#jquery)
    - [Loader Script](#loader-script)
    - [Config](#config)
    - [Other Configurations](#other-configurations)

## Installation

Navigate to project directory `cd test-host-website`
- run `npm install`
- run `npm run serve`


## Usage
The server.js script hosts the parent.html file on [localhost:3000](http://localhost:3000)

The parent.html file includes the required imports & scripts to launch our chatbot via an iFrame.

the `/lex-web-ui-loader` dir holds all of our code to actually launch/run the chatbot

The chatbot itself will be hosted elsewhere.

## Inject Chatbot Anywhere

The Chatbot iteself is a simple vue application, that can be hosted anywhere.

To inject the chatbot onto another site, you'll need to host the bot (parent project) and it's code somewhere.
Once that's complete grab the url for the chat application. 

**NOTE:** To have the bot remain open during the users full session import the following code onto the file that injects your web application. Usually `index.html` or a layout page.

### Copy code
Include the `/lex-web-ui-loader` directory into your application.
Just make sure it's in a spot you can link to from your application.

**NOTE**: Some links in the code below may need upated depending on where the loader is hosted.

### CSS 
Add to the head of the html.
```
<link
  rel="stylesheet"
  href="./lex-web-ui-loader/css/lex-web-ui-iframe.css"
/>
```

### JQuery
```
   <script
      src="https://code.jquery.com/jquery-3.2.1.min.js"
      integrity="sha256-hwg4gsxgFZhOsEEamdOYGBf13FyQuiTwlAQgxVSNgt4="
      crossorigin="anonymous"
    ></script>
```

### Loader Script
```
   <script type="module">
      import ChatBotUiLoader from "../lex-web-ui-loader/js/index.js";
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


### Config 
- Add this config to the script above @ `var chatbotUIconfig = {...}`
- Replace the `ui.parentOrigin` of the config with the host site url.
- Update the `iframe.iframeOrigin` of the config to the chatBot's url.
```
{
  ui: {
    parentOrigin: "http://localhost:3000",
    toolbarTitle: "Couchbase",
    toolbarLogo:
      "https://www.couchbase.com/wp-content/uploads/sites/3/2023/10/SDKs_Ottoman.svg",
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
### Other Configurations
You will need to update the config files within the chat bot code: `config.prod.json` & `config.dev.json`. This is so it knows who to expect calls from.

- replace the `ui.parentOrigin` with the host site url.
- update the `iframe.iframeOrigin` to the chatBot's url.