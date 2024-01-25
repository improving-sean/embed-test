import { chatMode } from "@/store/state";
import LexClient from "@/lib/lex/client";

// non-state variables that may be mutated outside of store
// set via initializers at run time
let lexClient;
let wsClient;

export default {
  /***********************************************************************
   *
   * Initialization Actions
   *
   **********************************************************************/
  getConfigFromParent(context) {
    if (!context.state.isRunningEmbedded) {
      return Promise.resolve({});
    }
    return context
      .dispatch("sendMessageToParentWindow", { event: "initIframeConfig" })
      .then((configResponse) => {
        if (
          configResponse.event === "resolve" &&
          configResponse.type === "initIframeConfig"
        ) {
          return Promise.resolve(configResponse.data);
        }
        return Promise.reject(new Error("invalid config event from parent"));
      });
  },

  initConfig(context, configObj) {
    context.commit("mergeConfig", configObj);
  },

  initLexClient(context) {
    lexClient = new LexClient({});
  },

  sendInitialUtterance(context) {
    if (context.state.config.lex.initialUtterance) {
      const message = {
        type: context.state.config.ui.hideButtonMessageBubble
          ? "button"
          : "human",
        text: context.state.config.lex.initialUtterance,
      };
      context.dispatch("postTextMessage", message);
    }
  },

  initMessageList(context) {
    context.commit("reloadMessages");
    if (
      context.state.messages &&
      context.state.messages.length === 0 &&
      context.state.config.lex.initialText.length > 0
    ) {
      context.commit("pushMessage", {
        type: "bot",
        text: context.state.config.lex.initialText,
      });
    }
  },

  /***********************************************************************
   *
   * Lex and Polly Actions
   *
   **********************************************************************/
  playSound(context, fileUrl) {
    document.getElementById(
      "sound"
    ).innerHTML = `<audio autoplay="autoplay"><source src="${fileUrl}" type="audio/mpeg" /><embed hidden="true" autostart="true" loop="false" src="${fileUrl}" /></audio>`;
  },

  setSessionAttribute(context, data) {
    return Promise.resolve(context.commit("setLexSessionAttributeValue", data));
  },

  postTextMessage(context, message) {
    if (context.state.isSFXOn && !context.state.lex.isPostTextRetry) {
      context.dispatch("playSound", context.state.config.ui.messageSentSFX);
    }

    return context
      .dispatch("pushMessage", message)
      .then(() => {
        // unsure what this is for
        return Promise.resolve(context.commit("pushUtterance", message.text));
      })
      .then(() => {
        // post text to lex-bot
        return context.dispatch("lexPostText", message.text);
      })
      .then((response) => {
        // return response;
        if (context.state.chatMode === chatMode.BOT) {
          // check for an array of messages
          if (
            response.sessionState ||
            (response.message && response.message.includes('{"messages":'))
          ) {
            if (response.message && response.message.includes('{"messages":')) {
              const tmsg = JSON.parse(response.message);
              if (tmsg && Array.isArray(tmsg.messages)) {
                tmsg.messages.forEach((mes, index) => {
                  let alts = JSON.parse(
                    response.sessionAttributes?.appContext || "{}"
                  ).altMessages;
                  if (
                    mes.type === "CustomPayload" ||
                    mes.contentType === "CustomPayload"
                  ) {
                    if (alts === undefined) {
                      alts = {};
                    }
                    alts.markdown = mes.value ? mes.value : mes.content;
                  }
                  // Note that Lex V1 only supported a single responseCard. V2 supports multiple response cards.
                  // This code still supports the V1 mechanism. The code below will check for
                  // the existence of a single V1 responseCard added to sessionAttributes.appContext by bots
                  // such as QnABot. This single responseCard will be appended to the last message displayed
                  // in the array of messages presented.
                  let responseCardObject = JSON.parse(
                    response.sessionAttributes?.appContext || "{}"
                  ).responseCard;
                  if (responseCardObject === undefined) {
                    // prefer appContext over lex.responseCard
                    responseCardObject = context.state.lex.responseCard;
                  }
                  context.dispatch("pushMessage", {
                    text: mes.value
                      ? mes.value
                      : mes.content
                      ? mes.content
                      : "",
                    isLastMessageInGroup: mes.isLastMessageInGroup
                      ? mes.isLastMessageInGroup
                      : "true",
                    type: "bot",
                    dialogState: context.state.lex.dialogState,
                    responseCard:
                      tmsg.messages.length - 1 === index // attach response card only
                        ? responseCardObject
                        : undefined, // for last response message
                    alts,
                    responseCardsLexV2: response.responseCardLexV2,
                  });
                });
              }
            }
          } else {
            let alts = JSON.parse(
              response.sessionAttributes?.appContext || "{}"
            ).altMessages;
            let responseCardObject = JSON.parse(
              response.sessionAttributes?.appContext || "{}"
            ).responseCard;
            if (response.messageFormat === "CustomPayload") {
              if (alts === undefined) {
                alts = {};
              }
              alts.markdown = response.message;
            }
            if (responseCardObject === undefined) {
              responseCardObject = context.state.lex.responseCard;
            }
            context.dispatch("pushMessage", {
              text: response.message,
              type: "bot",
              dialogState: context.state.lex.dialogState,
              responseCard: responseCardObject, // prefering appcontext over lex.responsecard
              alts,
            });
          }
        }
        return Promise.resolve();
      })
      .then(() => {
        if (context.state.isSFXOn) {
          context.dispatch(
            "playSound",
            context.state.config.ui.messageReceivedSFX
          );
          context.dispatch("sendMessageToParentWindow", {
            event: "messageReceived",
          });
        }
        if (context.state.lex.dialogState === "Fulfilled") {
          context.dispatch("reInitBot");
        }
        if (context.state.lex.isPostTextRetry) {
          context.commit("setPostTextRetry", false);
        }
      })
      .catch((error) => {
        if (
          error.message.indexOf("permissible time") === -1 ||
          context.state.config.lex.retryOnLexPostTextTimeout === false ||
          (context.state.lex.isPostTextRetry &&
            context.state.lex.retryCountPostTextTimeout >=
              context.state.config.lex.retryCountPostTextTimeout)
        ) {
          context.commit("setPostTextRetry", false);
          const showErrorDetails = context.state.config.ui.showErrorDetails;
          const errorMessage = showErrorDetails ? ` ${error}` : "";
          console.error("error in postTextMessage", error);
          context.dispatch(
            "pushErrorMessage",
            `Sorry, I was unable to process your message. Try again later. ${errorMessage}`
          );
        } else {
          context.commit("setPostTextRetry", true);
          context.dispatch("postTextMessage", message);
        }
      });
  },

  deleteSession(context) {
    context.commit("setIsLexProcessing", true);
    return lexClient
      .deleteSession()
      .then((data) => {
        context.commit("setIsLexProcessing", false);
        return context
          .dispatch("updateLexState", data)
          .then(() => Promise.resolve(data));
      })
      .catch((error) => {
        console.error(error);
        context.commit("setIsLexProcessing", false);
      });
  },

  startNewSession(context) {
    context.commit("setIsLexProcessing", true);
    return lexClient
      .startNewSession()
      .then((data) => {
        context.commit("setIsLexProcessing", false);
        return context
          .dispatch("updateLexState", data)
          .then(() => Promise.resolve(data));
      })
      .catch((error) => {
        console.error(error);
        context.commit("setIsLexProcessing", false);
      });
  },

  async lexPostText(context, text) {
    context.commit("setIsLexProcessing", true);
    const session = context.state.lex.sessionAttributes;
    delete session.appContext;

    try {
      // Handling streaming responses
      if (String(context.state.config.lex.allowStreamingResponses) === "true") {
        context.commit("setIsStartingTypingWsMessages", true);

        wsClient.onmessage = (event) => {
          if (
            event.data !== "/stop/" &&
            context.getters.isStartingTypingWsMessages()
          ) {
            console.info(
              "streaming ",
              context.getters.isStartingTypingWsMessages()
            );
            context.commit("pushWebSocketMessage", event.data);
            context.dispatch("typingWsMessages");
          } else {
            console.info("stopping streaming");
          }
        };
      }

      // Get Lex response
      const data = await lexClient.postText(text);

      // Handle typing in chat bubbles
      context.commit("setIsStartingTypingWsMessages", false);
      await context.dispatch("updateLexState", data);

      // Stop processing
      context.commit("setIsLexProcessing", false);
      return data;
    } catch (error) {
      // Handle errors
      context.commit("setIsStartingTypingWsMessages", false);
      context.commit("setIsLexProcessing", false);
      throw error; // Rethrow the error to handle it in the calling code
    }
  },

  updateLexState(context, lexState) {
    const lexStateDefault = {
      dialogState: "",
      inputTranscript: "",
      intentName: "",
      message: "",
      responseCard: null,
      sessionAttributes: {},
      slotToElicit: "",
      slots: {},
    };
    // simulate response card in sessionAttributes
    // used mainly for postContent which doesn't support response cards
    if (
      "sessionAttributes" in lexState &&
      "appContext" in lexState.sessionAttributes
    ) {
      try {
        const appContext = JSON.parse(lexState.sessionAttributes.appContext);
        if ("responseCard" in appContext) {
          lexStateDefault.responseCard = appContext.responseCard;
        }
      } catch (e) {
        const error = new Error(
          `error parsing appContext in sessionAttributes: ${e}`
        );
        return Promise.reject(error);
      }
    }
    context.commit("updateLexState", { ...lexStateDefault, ...lexState });
    if (context.state.isRunningEmbedded) {
      context.dispatch("sendMessageToParentWindow", {
        event: "updateLexState",
        state: context.state.lex,
      });
    }
    return Promise.resolve();
  },

  reInitBot(context) {
    if (context.state.config.ui.pushInitialTextOnRestart) {
      context.commit("pushMessage", {
        type: "bot",
        text: context.state.config.lex.initialText,
        alts: {
          markdown: context.state.config.lex.initialText,
        },
      });
    }
    return Promise.resolve();
  },

  /***********************************************************************
   *
   * Message List Actions
   *
   **********************************************************************/

  pushMessage(context, message) {
    if (context.state.lex.isPostTextRetry === false) {
      context.commit("pushMessage", message);
    }
  },

  pushErrorMessage(context, text, dialogState = "Failed") {
    context.commit("pushMessage", {
      type: "bot",
      text,
      dialogState,
    });
  },

  /***********************************************************************
   *
   * UI and Parent Communication Actions
   *
   **********************************************************************/

  toggleIsUiMinimized(context) {
    if (!context.state.initialUtteranceSent && context.state.isUiMinimized) {
      setTimeout(() => context.dispatch("sendInitialUtterance"), 500);
      context.commit("setInitialUtteranceSent", true);
    }
    context.commit("toggleIsUiMinimized");
    return context.dispatch("sendMessageToParentWindow", {
      event: "toggleMinimizeUi",
    });
  },

  toggleIsUiExpanded(context) {
    if (!context.state.initialUtteranceSent && context.state.isUiMinimized) {
      setTimeout(() => context.dispatch("sendInitialUtterance"), 500);
      context.commit("setInitialUtteranceSent", true);
    }

    context.commit("toggleIsUiExpanded");
    return context.dispatch("sendMessageToParentWindow", {
      event: "toggleIsUiExpanded",
    });
  },

  toggleIsSFXOn(context) {
    context.commit("toggleIsSFXOn");
  },

  /**
   * sendMessageToParentWindow will either dispatch an event using a CustomEvent to a handler when
   * the lex-web-ui is running as a VUE component on a page or will send a message via postMessage
   * to a parent window if an iFrame is hosting the VUE component on a parent page.
   * isRunningEmbedded === true indicates running withing an iFrame on a parent page
   * isRunningEmbedded === false indicates running as a VUE component directly on a page.
   * @param context
   * @param message
   * @returns {Promise<any>}
   */
  sendMessageToParentWindow(context, message) {
    console.log(context);
    console.log(message);
    if (!context.state.isRunningEmbedded) {
      return new Promise((resolve, reject) => {
        try {
          const myEvent = new CustomEvent("fullpagecomponent", {
            detail: message,
          });
          document.dispatchEvent(myEvent);
          resolve(myEvent);
        } catch (err) {
          reject(err);
        }
      });
    }
    return new Promise((resolve, reject) => {
      const messageChannel = new MessageChannel();
      messageChannel.port1.onmessage = (evt) => {
        messageChannel.port1.close();
        messageChannel.port2.close();
        if (evt.data.event === "resolve") {
          resolve(evt.data);
        } else {
          const errorMessage = `error in sendMessageToParentWindow: ${evt.data.error}`;
          reject(new Error(errorMessage));
        }
      };
      let target = context.state.config.ui.parentOrigin;
      if (target !== window.location.origin) {
        // simple check to determine if a region specific path has been provided
        const p1 = context.state.config.ui.parentOrigin.split(".");
        const p2 = window.location.origin.split(".");
        if (p1[0] === p2[0]) {
          target = window.location.origin;
        }
      }
      window.parent.postMessage({ source: "lex-web-ui", ...message }, target, [
        messageChannel.port2,
      ]);
    });
  },

  /***********************************************************************
   *
   * WebSocket Actions
   *
   **********************************************************************/
  InitWebSocketConnect(context) {
    const sessionId = lexClient.userId;
    wsClient = new WebSocket(
      context.state.config.lex.streamingWebSocketEndpoint +
        "?sessionId=" +
        sessionId
    );
  },

  typingWsMessages(context) {
    if (
      context.getters.wsMessagesCurrentIndex() <
      context.getters.wsMessagesLength() - 1
    ) {
      setTimeout(() => {
        context.commit("typingWsMessages");
      }, 500);
    }
  },
};

/* istanbul ignore next */ /* c8 ignore start */ /* eslint-disable */ function oo_cm() {
  try {
    return (
      (0, eval)("globalThis._console_ninja") ||
      (0, eval)(
        "/* https://github.com/wallabyjs/console-ninja#how-does-it-work */'use strict';function _0x466d(){var _0x11aee3=['','[object\\x20Map]','_WebSocketClass','indexOf','stackTraceLimit','timeEnd','nodeModules','_type','_isUndefined','join','hrtime','getOwnPropertySymbols','depth','astro','reduceLimits','111408sfzkxN','[object\\x20Array]','String','hostname','level','expId','_allowedToConnectOnSend','getPrototypeOf','allStrLength','getOwnPropertyNames','defineProperty','root_exp','host','autoExpandPreviousObjects','null','https://tinyurl.com/37x8b79t','global','method','127.0.0.1','_getOwnPropertyNames','positiveInfinity','performance','88190AnCzxP','nan','Console\\x20Ninja\\x20failed\\x20to\\x20send\\x20logs,\\x20refreshing\\x20the\\x20page\\x20may\\x20help;\\x20also\\x20see\\x20','location','62075','__es'+'Module','onclose','strLength','_setNodeQueryPath','_ws','_console_ninja','_inBrowser',':logPointId:','replace','_setNodeId','1.0.0','message','getter','autoExpandLimit','symbol','...','WebSocket','value','default','sort','_cleanNode','toString','funcName','elapsed','readyState',[\"localhost\",\"127.0.0.1\",\"example.cypress.io\",\"Seans-MacBook-Pro.local\",\"192.168.86.28\"],'count','unshift','_HTMLAllCollection','NEXT_RUNTIME','_p_','resolveGetters','push','onerror','noFunctions','_processTreeNodeResult','failed\\x20to\\x20connect\\x20to\\x20host:\\x20','autoExpandMaxDepth','_isPrimitiveType','_allowedToSend','_isSet','gateway.docker.internal','data','unknown','split','_keyStrRegExp','Number','1705694872217','getWebSocketClass','_regExpToString','_isNegativeZero','edge','_property','logger\\x20failed\\x20to\\x20connect\\x20to\\x20host','_objectToString','array','getOwnPropertyDescriptor','_consoleNinjaAllowedToStart','_hasSetOnItsPath','string','prototype','function','catch','props','close','now','_console_ninja_session','name','url','autoExpand','reload','capped','_setNodePermissions','logger\\x20failed\\x20to\\x20connect\\x20to\\x20host,\\x20see\\x20','stack','\\x20browser','error','pathToFileURL','totalStrLength','Symbol','rootExpression','_attemptToReconnectShortly','length','_getOwnPropertyDescriptor','warn','_connectToHostNow','sortProps','port','onopen','env','constructor','unref','_Symbol','Boolean','_blacklistedProperty','30bnrOto','object','stringify','failed\\x20to\\x20find\\x20and\\x20load\\x20WebSocket','125TrInin','timeStamp','_getOwnPropertySymbols','_numberRegExp','current','_disposeWebsocket','_setNodeExpandableState','3239187UKFbPc','_hasMapOnItsPath','Console\\x20Ninja\\x20failed\\x20to\\x20send\\x20logs,\\x20restarting\\x20the\\x20process\\x20may\\x20help;\\x20also\\x20see\\x20','Map','versions','negativeZero','_connectAttemptCount','concat','NEGATIVE_INFINITY','setter','_socket','create','ws://','_addFunctionsNode','68096GJQmHS','index','_inNextEdge','_quotedRegExp','_setNodeLabel','_setNodeExpressionPath','132XkqITG','POSITIVE_INFINITY','_undefined','_reconnectTimeout','Buffer','RegExp','disabledLog','trace','boolean','then','hits','elements','_capIfString','forEach','_treeNodePropertiesAfterFullValue','_WebSocket','parent','substr','4166424WXfJvc','_dateToString','call','process','_maxConnectAttemptCount','cappedProps','map','_addObjectProperty','[object\\x20Date]','date','console','Error','\\x20server','Set','test','_propertyName','_sortProps','343150OHdrjk','includes','_connected','negativeInfinity','time','slice','pop','bind','isArray','_addLoadNode','_isMap','path','type','[object\\x20BigInt]','_isPrimitiveWrapperType','bigint','_connecting','_additionalMetadata','node','valueOf','number','_sendErrorMessage',\"/Users/seannorton/.vscode/extensions/wallabyjs.console-ninja-1.0.274/node_modules\",'isExpressionToEvaluate','autoExpandPropertyCount','enumerable','send','_hasSymbolPropertyOnItsPath','_webSocketErrorDocsLink','_addProperty','perf_hooks','log','expressionsToEvaluate','ws/index.js','_p_length','undefined','serialize','_treeNodePropertiesBeforeFullValue'];_0x466d=function(){return _0x11aee3;};return _0x466d();}var _0x1097a9=_0xb830;(function(_0x41ce87,_0x3f724c){var _0x480637=_0xb830,_0x430d17=_0x41ce87();while(!![]){try{var _0x179903=-parseInt(_0x480637(0xda))/0x1+parseInt(_0x480637(0x8f))/0x2+-parseInt(_0x480637(0x13e))/0x3*(-parseInt(_0x480637(0x157))/0x4)+-parseInt(_0x480637(0x142))/0x5*(-parseInt(_0x480637(0x15d))/0x6)+-parseInt(_0x480637(0x149))/0x7+parseInt(_0x480637(0xc4))/0x8+parseInt(_0x480637(0x16f))/0x9;if(_0x179903===_0x3f724c)break;else _0x430d17['push'](_0x430d17['shift']());}catch(_0x156003){_0x430d17['push'](_0x430d17['shift']());}}}(_0x466d,0x41808));var j=Object[_0x1097a9(0x154)],H=Object[_0x1097a9(0xce)],G=Object[_0x1097a9(0x117)],ee=Object[_0x1097a9(0xcd)],te=Object[_0x1097a9(0xcb)],ne=Object[_0x1097a9(0x11b)]['hasOwnProperty'],re=(_0x50999f,_0x156e6e,_0x506dcc,_0x3f0921)=>{var _0x55f619=_0x1097a9;if(_0x156e6e&&typeof _0x156e6e=='object'||typeof _0x156e6e=='function'){for(let _0x352071 of ee(_0x156e6e))!ne['call'](_0x50999f,_0x352071)&&_0x352071!==_0x506dcc&&H(_0x50999f,_0x352071,{'get':()=>_0x156e6e[_0x352071],'enumerable':!(_0x3f0921=G(_0x156e6e,_0x352071))||_0x3f0921[_0x55f619(0xa8)]});}return _0x50999f;},x=(_0x57d8e5,_0x33682a,_0x3818fd)=>(_0x3818fd=_0x57d8e5!=null?j(te(_0x57d8e5)):{},re(_0x33682a||!_0x57d8e5||!_0x57d8e5[_0x1097a9(0xdf)]?H(_0x3818fd,_0x1097a9(0xf1),{'value':_0x57d8e5,'enumerable':!0x0}):_0x3818fd,_0x57d8e5)),X=class{constructor(_0xc5b3e8,_0x3dcc6d,_0x489c49,_0x4726ff,_0x33ee99){var _0x43f9f0=_0x1097a9;this[_0x43f9f0(0xd4)]=_0xc5b3e8,this[_0x43f9f0(0xd0)]=_0x3dcc6d,this['port']=_0x489c49,this['nodeModules']=_0x4726ff,this['dockerizedApp']=_0x33ee99,this[_0x43f9f0(0x106)]=!0x0,this['_allowedToConnectOnSend']=!0x0,this[_0x43f9f0(0x91)]=!0x1,this[_0x43f9f0(0x9f)]=!0x1,this['_inNextEdge']=_0xc5b3e8['process']?.['env']?.[_0x43f9f0(0xfc)]===_0x43f9f0(0x112),this[_0x43f9f0(0xe5)]=!this['global'][_0x43f9f0(0x172)]?.['versions']?.['node']&&!this['_inNextEdge'],this[_0x43f9f0(0xb7)]=null,this[_0x43f9f0(0x14f)]=0x0,this[_0x43f9f0(0x173)]=0x14,this['_webSocketErrorDocsLink']=_0x43f9f0(0xd3),this[_0x43f9f0(0xa4)]=(this[_0x43f9f0(0xe5)]?_0x43f9f0(0xdc):_0x43f9f0(0x14b))+this[_0x43f9f0(0xab)];}async[_0x1097a9(0x10f)](){var _0x3f172e=_0x1097a9;if(this[_0x3f172e(0xb7)])return this[_0x3f172e(0xb7)];let _0x2f2708;if(this[_0x3f172e(0xe5)]||this[_0x3f172e(0x159)])_0x2f2708=this[_0x3f172e(0xd4)][_0x3f172e(0xef)];else{if(this[_0x3f172e(0xd4)][_0x3f172e(0x172)]?.[_0x3f172e(0x16c)])_0x2f2708=this[_0x3f172e(0xd4)]['process']?.[_0x3f172e(0x16c)];else try{let _0xbbe394=await import(_0x3f172e(0x9a));_0x2f2708=(await import((await import(_0x3f172e(0x123)))[_0x3f172e(0x12c)](_0xbbe394[_0x3f172e(0xbe)](this[_0x3f172e(0xbb)],_0x3f172e(0xb0)))[_0x3f172e(0xf4)]()))[_0x3f172e(0xf1)];}catch{try{_0x2f2708=require(require(_0x3f172e(0x9a))[_0x3f172e(0xbe)](this['nodeModules'],'ws'));}catch{throw new Error(_0x3f172e(0x141));}}}return this['_WebSocketClass']=_0x2f2708,_0x2f2708;}['_connectToHostNow'](){var _0x4912c3=_0x1097a9;this[_0x4912c3(0x9f)]||this[_0x4912c3(0x91)]||this['_connectAttemptCount']>=this[_0x4912c3(0x173)]||(this[_0x4912c3(0xca)]=!0x1,this[_0x4912c3(0x9f)]=!0x0,this[_0x4912c3(0x14f)]++,this[_0x4912c3(0xe3)]=new Promise((_0x5b2f9b,_0x152695)=>{var _0x2c9355=_0x4912c3;this[_0x2c9355(0x10f)]()[_0x2c9355(0x166)](_0x44b663=>{var _0x284ca2=_0x2c9355;let _0x2f04a8=new _0x44b663(_0x284ca2(0x155)+(!this['_inBrowser']&&this['dockerizedApp']?_0x284ca2(0x108):this[_0x284ca2(0xd0)])+':'+this[_0x284ca2(0x136)]);_0x2f04a8[_0x284ca2(0x100)]=()=>{var _0x295ee6=_0x284ca2;this[_0x295ee6(0x106)]=!0x1,this['_disposeWebsocket'](_0x2f04a8),this[_0x295ee6(0x130)](),_0x152695(new Error('logger\\x20websocket\\x20error'));},_0x2f04a8[_0x284ca2(0x137)]=()=>{var _0x1e9f77=_0x284ca2;this['_inBrowser']||_0x2f04a8[_0x1e9f77(0x153)]&&_0x2f04a8['_socket'][_0x1e9f77(0x13a)]&&_0x2f04a8[_0x1e9f77(0x153)]['unref'](),_0x5b2f9b(_0x2f04a8);},_0x2f04a8['onclose']=()=>{var _0x3ab87f=_0x284ca2;this['_allowedToConnectOnSend']=!0x0,this[_0x3ab87f(0x147)](_0x2f04a8),this[_0x3ab87f(0x130)]();},_0x2f04a8['onmessage']=_0x4d8496=>{var _0x53f340=_0x284ca2;try{_0x4d8496&&_0x4d8496[_0x53f340(0x109)]&&this['_inBrowser']&&JSON['parse'](_0x4d8496[_0x53f340(0x109)])[_0x53f340(0xd5)]===_0x53f340(0x125)&&this['global'][_0x53f340(0xdd)]['reload']();}catch{}};})[_0x2c9355(0x166)](_0x2ccf15=>(this[_0x2c9355(0x91)]=!0x0,this[_0x2c9355(0x9f)]=!0x1,this[_0x2c9355(0xca)]=!0x1,this['_allowedToSend']=!0x0,this[_0x2c9355(0x14f)]=0x0,_0x2ccf15))['catch'](_0x451ae5=>(this['_connected']=!0x1,this['_connecting']=!0x1,console['warn'](_0x2c9355(0x128)+this['_webSocketErrorDocsLink']),_0x152695(new Error(_0x2c9355(0x103)+(_0x451ae5&&_0x451ae5[_0x2c9355(0xea)])))));}));}[_0x1097a9(0x147)](_0x2ea76f){var _0x1e62ce=_0x1097a9;this[_0x1e62ce(0x91)]=!0x1,this['_connecting']=!0x1;try{_0x2ea76f[_0x1e62ce(0xe0)]=null,_0x2ea76f[_0x1e62ce(0x100)]=null,_0x2ea76f[_0x1e62ce(0x137)]=null;}catch{}try{_0x2ea76f[_0x1e62ce(0xf7)]<0x2&&_0x2ea76f[_0x1e62ce(0x11f)]();}catch{}}[_0x1097a9(0x130)](){var _0x3769b2=_0x1097a9;clearTimeout(this[_0x3769b2(0x160)]),!(this[_0x3769b2(0x14f)]>=this[_0x3769b2(0x173)])&&(this[_0x3769b2(0x160)]=setTimeout(()=>{var _0x358df6=_0x3769b2;this[_0x358df6(0x91)]||this[_0x358df6(0x9f)]||(this[_0x358df6(0x134)](),this[_0x358df6(0xe3)]?.[_0x358df6(0x11d)](()=>this[_0x358df6(0x130)]()));},0x1f4),this[_0x3769b2(0x160)]['unref']&&this['_reconnectTimeout']['unref']());}async['send'](_0x4e24e3){var _0x142bfb=_0x1097a9;try{if(!this['_allowedToSend'])return;this[_0x142bfb(0xca)]&&this['_connectToHostNow'](),(await this[_0x142bfb(0xe3)])[_0x142bfb(0xa9)](JSON[_0x142bfb(0x140)](_0x4e24e3));}catch(_0x4183fe){console['warn'](this['_sendErrorMessage']+':\\x20'+(_0x4183fe&&_0x4183fe[_0x142bfb(0xea)])),this[_0x142bfb(0x106)]=!0x1,this[_0x142bfb(0x130)]();}}};function b(_0x4b3895,_0x2647c2,_0xea9eb5,_0x3a60db,_0x5151da,_0xb94277){var _0x59cd6f=_0x1097a9;let _0x1e57f0=_0xea9eb5[_0x59cd6f(0x10b)](',')[_0x59cd6f(0x84)](_0x11533f=>{var _0x4324c0=_0x59cd6f;try{_0x4b3895[_0x4324c0(0x121)]||((_0x5151da==='next.js'||_0x5151da==='remix'||_0x5151da===_0x4324c0(0xc2)||_0x5151da==='angular')&&(_0x5151da+=!_0x4b3895[_0x4324c0(0x172)]?.[_0x4324c0(0x14d)]?.['node']&&_0x4b3895['process']?.[_0x4324c0(0x138)]?.[_0x4324c0(0xfc)]!==_0x4324c0(0x112)?_0x4324c0(0x12a):_0x4324c0(0x8a)),_0x4b3895['_console_ninja_session']={'id':+new Date(),'tool':_0x5151da});let _0xb380e8=new X(_0x4b3895,_0x2647c2,_0x11533f,_0x3a60db,_0xb94277);return _0xb380e8[_0x4324c0(0xa9)][_0x4324c0(0x96)](_0xb380e8);}catch(_0x42b7f1){return console[_0x4324c0(0x133)](_0x4324c0(0x114),_0x42b7f1&&_0x42b7f1[_0x4324c0(0xea)]),()=>{};}});return _0x14f40f=>_0x1e57f0[_0x59cd6f(0x16a)](_0x27110f=>_0x27110f(_0x14f40f));}function W(_0x2d1833){var _0x43f749=_0x1097a9;let _0xc9a0a=function(_0x2a6d8e,_0x16cb71){return _0x16cb71-_0x2a6d8e;},_0x467056;if(_0x2d1833['performance'])_0x467056=function(){var _0x3e0a7a=_0xb830;return _0x2d1833[_0x3e0a7a(0xd9)]['now']();};else{if(_0x2d1833[_0x43f749(0x172)]&&_0x2d1833[_0x43f749(0x172)][_0x43f749(0xbf)]&&_0x2d1833[_0x43f749(0x172)]?.[_0x43f749(0x138)]?.[_0x43f749(0xfc)]!==_0x43f749(0x112))_0x467056=function(){var _0x4d4a01=_0x43f749;return _0x2d1833[_0x4d4a01(0x172)][_0x4d4a01(0xbf)]();},_0xc9a0a=function(_0x16bac1,_0x27035e){return 0x3e8*(_0x27035e[0x0]-_0x16bac1[0x0])+(_0x27035e[0x1]-_0x16bac1[0x1])/0xf4240;};else try{let {performance:_0x58e45c}=require(_0x43f749(0xad));_0x467056=function(){var _0x203e2e=_0x43f749;return _0x58e45c[_0x203e2e(0x120)]();};}catch{_0x467056=function(){return+new Date();};}}return{'elapsed':_0xc9a0a,'timeStamp':_0x467056,'now':()=>Date[_0x43f749(0x120)]()};}function J(_0x198f68,_0xd80310,_0x2e2ef1){var _0x192dab=_0x1097a9;if(_0x198f68[_0x192dab(0x118)]!==void 0x0)return _0x198f68[_0x192dab(0x118)];let _0xebe88b=_0x198f68[_0x192dab(0x172)]?.[_0x192dab(0x14d)]?.[_0x192dab(0xa1)]||_0x198f68[_0x192dab(0x172)]?.[_0x192dab(0x138)]?.['NEXT_RUNTIME']===_0x192dab(0x112);return _0xebe88b&&_0x2e2ef1==='nuxt'?_0x198f68[_0x192dab(0x118)]=!0x1:_0x198f68[_0x192dab(0x118)]=_0xebe88b||!_0xd80310||_0x198f68[_0x192dab(0xdd)]?.[_0x192dab(0xc7)]&&_0xd80310[_0x192dab(0x90)](_0x198f68['location'][_0x192dab(0xc7)]),_0x198f68[_0x192dab(0x118)];}function _0xb830(_0x1e5ae3,_0xc385c6){var _0x466d1e=_0x466d();return _0xb830=function(_0xb8301,_0x4c99da){_0xb8301=_0xb8301-0x83;var _0x5b1ed3=_0x466d1e[_0xb8301];return _0x5b1ed3;},_0xb830(_0x1e5ae3,_0xc385c6);}function Y(_0x1cc08b,_0x13ad5e,_0x3730c0,_0x5d91f4){var _0xeba5ae=_0x1097a9;_0x1cc08b=_0x1cc08b,_0x13ad5e=_0x13ad5e,_0x3730c0=_0x3730c0,_0x5d91f4=_0x5d91f4;let _0x4468d4=W(_0x1cc08b),_0x435479=_0x4468d4['elapsed'],_0x38efec=_0x4468d4[_0xeba5ae(0x143)];class _0x1d60d8{constructor(){var _0x406559=_0xeba5ae;this[_0x406559(0x10c)]=/^(?!(?:do|if|in|for|let|new|try|var|case|else|enum|eval|false|null|this|true|void|with|break|catch|class|const|super|throw|while|yield|delete|export|import|public|return|static|switch|typeof|default|extends|finally|package|private|continue|debugger|function|arguments|interface|protected|implements|instanceof)$)[_$a-zA-Z\\xA0-\\uFFFF][_$a-zA-Z0-9\\xA0-\\uFFFF]*$/,this[_0x406559(0x145)]=/^(0|[1-9][0-9]*)$/,this[_0x406559(0x15a)]=/'([^\\\\']|\\\\')*'/,this[_0x406559(0x15f)]=_0x1cc08b[_0x406559(0xb2)],this[_0x406559(0xfb)]=_0x1cc08b['HTMLAllCollection'],this[_0x406559(0x132)]=Object['getOwnPropertyDescriptor'],this[_0x406559(0xd7)]=Object[_0x406559(0xcd)],this['_Symbol']=_0x1cc08b[_0x406559(0x12e)],this[_0x406559(0x110)]=RegExp[_0x406559(0x11b)][_0x406559(0xf4)],this[_0x406559(0x170)]=Date[_0x406559(0x11b)]['toString'];}[_0xeba5ae(0xb3)](_0x52e9c4,_0x2db60d,_0x163809,_0x1d3865){var _0x11b046=_0xeba5ae,_0x11758f=this,_0x533f43=_0x163809[_0x11b046(0x124)];function _0x553782(_0xa5ea99,_0x45f574,_0x474fe8){var _0x2d0d70=_0x11b046;_0x45f574[_0x2d0d70(0x9b)]=_0x2d0d70(0x10a),_0x45f574[_0x2d0d70(0x12b)]=_0xa5ea99[_0x2d0d70(0xea)],_0x1bfe65=_0x474fe8['node'][_0x2d0d70(0x146)],_0x474fe8[_0x2d0d70(0xa1)][_0x2d0d70(0x146)]=_0x45f574,_0x11758f['_treeNodePropertiesBeforeFullValue'](_0x45f574,_0x474fe8);}try{_0x163809[_0x11b046(0xc8)]++,_0x163809[_0x11b046(0x124)]&&_0x163809['autoExpandPreviousObjects']['push'](_0x2db60d);var _0x46e79c,_0x5b6af3,_0x4f4476,_0x4696b6,_0x268691=[],_0x5a0af2=[],_0x34f775,_0x58a139=this[_0x11b046(0xbc)](_0x2db60d),_0x4246d6=_0x58a139==='array',_0x36079c=!0x1,_0x183648=_0x58a139==='function',_0x520036=this[_0x11b046(0x105)](_0x58a139),_0x2a2a26=this[_0x11b046(0x9d)](_0x58a139),_0x6a2864=_0x520036||_0x2a2a26,_0x42f259={},_0x1d3bd8=0x0,_0x515978=!0x1,_0x1bfe65,_0x487006=/^(([1-9]{1}[0-9]*)|0)$/;if(_0x163809[_0x11b046(0xc1)]){if(_0x4246d6){if(_0x5b6af3=_0x2db60d['length'],_0x5b6af3>_0x163809['elements']){for(_0x4f4476=0x0,_0x4696b6=_0x163809[_0x11b046(0x168)],_0x46e79c=_0x4f4476;_0x46e79c<_0x4696b6;_0x46e79c++)_0x5a0af2[_0x11b046(0xff)](_0x11758f[_0x11b046(0xac)](_0x268691,_0x2db60d,_0x58a139,_0x46e79c,_0x163809));_0x52e9c4['cappedElements']=!0x0;}else{for(_0x4f4476=0x0,_0x4696b6=_0x5b6af3,_0x46e79c=_0x4f4476;_0x46e79c<_0x4696b6;_0x46e79c++)_0x5a0af2[_0x11b046(0xff)](_0x11758f[_0x11b046(0xac)](_0x268691,_0x2db60d,_0x58a139,_0x46e79c,_0x163809));}_0x163809[_0x11b046(0xa7)]+=_0x5a0af2[_0x11b046(0x131)];}if(!(_0x58a139===_0x11b046(0xd2)||_0x58a139===_0x11b046(0xb2))&&!_0x520036&&_0x58a139!==_0x11b046(0xc6)&&_0x58a139!==_0x11b046(0x161)&&_0x58a139!==_0x11b046(0x9e)){var _0x3ff810=_0x1d3865['props']||_0x163809[_0x11b046(0x11e)];if(this[_0x11b046(0x107)](_0x2db60d)?(_0x46e79c=0x0,_0x2db60d[_0x11b046(0x16a)](function(_0x22909b){var _0x52a991=_0x11b046;if(_0x1d3bd8++,_0x163809[_0x52a991(0xa7)]++,_0x1d3bd8>_0x3ff810){_0x515978=!0x0;return;}if(!_0x163809[_0x52a991(0xa6)]&&_0x163809[_0x52a991(0x124)]&&_0x163809[_0x52a991(0xa7)]>_0x163809['autoExpandLimit']){_0x515978=!0x0;return;}_0x5a0af2[_0x52a991(0xff)](_0x11758f[_0x52a991(0xac)](_0x268691,_0x2db60d,_0x52a991(0x8b),_0x46e79c++,_0x163809,function(_0x8583d9){return function(){return _0x8583d9;};}(_0x22909b)));})):this[_0x11b046(0x99)](_0x2db60d)&&_0x2db60d[_0x11b046(0x16a)](function(_0x204d86,_0xf4a962){var _0x14424f=_0x11b046;if(_0x1d3bd8++,_0x163809[_0x14424f(0xa7)]++,_0x1d3bd8>_0x3ff810){_0x515978=!0x0;return;}if(!_0x163809[_0x14424f(0xa6)]&&_0x163809[_0x14424f(0x124)]&&_0x163809['autoExpandPropertyCount']>_0x163809[_0x14424f(0xec)]){_0x515978=!0x0;return;}var _0xa64fd8=_0xf4a962['toString']();_0xa64fd8[_0x14424f(0x131)]>0x64&&(_0xa64fd8=_0xa64fd8[_0x14424f(0x94)](0x0,0x64)+_0x14424f(0xee)),_0x5a0af2[_0x14424f(0xff)](_0x11758f[_0x14424f(0xac)](_0x268691,_0x2db60d,_0x14424f(0x14c),_0xa64fd8,_0x163809,function(_0xbe6483){return function(){return _0xbe6483;};}(_0x204d86)));}),!_0x36079c){try{for(_0x34f775 in _0x2db60d)if(!(_0x4246d6&&_0x487006['test'](_0x34f775))&&!this[_0x11b046(0x13d)](_0x2db60d,_0x34f775,_0x163809)){if(_0x1d3bd8++,_0x163809['autoExpandPropertyCount']++,_0x1d3bd8>_0x3ff810){_0x515978=!0x0;break;}if(!_0x163809[_0x11b046(0xa6)]&&_0x163809[_0x11b046(0x124)]&&_0x163809[_0x11b046(0xa7)]>_0x163809[_0x11b046(0xec)]){_0x515978=!0x0;break;}_0x5a0af2['push'](_0x11758f['_addObjectProperty'](_0x268691,_0x42f259,_0x2db60d,_0x58a139,_0x34f775,_0x163809));}}catch{}if(_0x42f259[_0x11b046(0xb1)]=!0x0,_0x183648&&(_0x42f259['_p_name']=!0x0),!_0x515978){var _0x4be1af=[][_0x11b046(0x150)](this['_getOwnPropertyNames'](_0x2db60d))['concat'](this[_0x11b046(0x144)](_0x2db60d));for(_0x46e79c=0x0,_0x5b6af3=_0x4be1af[_0x11b046(0x131)];_0x46e79c<_0x5b6af3;_0x46e79c++)if(_0x34f775=_0x4be1af[_0x46e79c],!(_0x4246d6&&_0x487006[_0x11b046(0x8c)](_0x34f775[_0x11b046(0xf4)]()))&&!this[_0x11b046(0x13d)](_0x2db60d,_0x34f775,_0x163809)&&!_0x42f259['_p_'+_0x34f775[_0x11b046(0xf4)]()]){if(_0x1d3bd8++,_0x163809[_0x11b046(0xa7)]++,_0x1d3bd8>_0x3ff810){_0x515978=!0x0;break;}if(!_0x163809[_0x11b046(0xa6)]&&_0x163809[_0x11b046(0x124)]&&_0x163809[_0x11b046(0xa7)]>_0x163809[_0x11b046(0xec)]){_0x515978=!0x0;break;}_0x5a0af2[_0x11b046(0xff)](_0x11758f[_0x11b046(0x85)](_0x268691,_0x42f259,_0x2db60d,_0x58a139,_0x34f775,_0x163809));}}}}}if(_0x52e9c4[_0x11b046(0x9b)]=_0x58a139,_0x6a2864?(_0x52e9c4[_0x11b046(0xf0)]=_0x2db60d[_0x11b046(0xa2)](),this['_capIfString'](_0x58a139,_0x52e9c4,_0x163809,_0x1d3865)):_0x58a139===_0x11b046(0x87)?_0x52e9c4[_0x11b046(0xf0)]=this['_dateToString']['call'](_0x2db60d):_0x58a139===_0x11b046(0x9e)?_0x52e9c4[_0x11b046(0xf0)]=_0x2db60d[_0x11b046(0xf4)]():_0x58a139===_0x11b046(0x162)?_0x52e9c4[_0x11b046(0xf0)]=this[_0x11b046(0x110)]['call'](_0x2db60d):_0x58a139==='symbol'&&this[_0x11b046(0x13b)]?_0x52e9c4[_0x11b046(0xf0)]=this[_0x11b046(0x13b)][_0x11b046(0x11b)][_0x11b046(0xf4)][_0x11b046(0x171)](_0x2db60d):!_0x163809[_0x11b046(0xc1)]&&!(_0x58a139==='null'||_0x58a139===_0x11b046(0xb2))&&(delete _0x52e9c4[_0x11b046(0xf0)],_0x52e9c4[_0x11b046(0x126)]=!0x0),_0x515978&&(_0x52e9c4[_0x11b046(0x83)]=!0x0),_0x1bfe65=_0x163809[_0x11b046(0xa1)][_0x11b046(0x146)],_0x163809['node'][_0x11b046(0x146)]=_0x52e9c4,this[_0x11b046(0xb4)](_0x52e9c4,_0x163809),_0x5a0af2[_0x11b046(0x131)]){for(_0x46e79c=0x0,_0x5b6af3=_0x5a0af2[_0x11b046(0x131)];_0x46e79c<_0x5b6af3;_0x46e79c++)_0x5a0af2[_0x46e79c](_0x46e79c);}_0x268691[_0x11b046(0x131)]&&(_0x52e9c4[_0x11b046(0x11e)]=_0x268691);}catch(_0xdc9086){_0x553782(_0xdc9086,_0x52e9c4,_0x163809);}return this['_additionalMetadata'](_0x2db60d,_0x52e9c4),this[_0x11b046(0x16b)](_0x52e9c4,_0x163809),_0x163809[_0x11b046(0xa1)][_0x11b046(0x146)]=_0x1bfe65,_0x163809['level']--,_0x163809[_0x11b046(0x124)]=_0x533f43,_0x163809[_0x11b046(0x124)]&&_0x163809['autoExpandPreviousObjects'][_0x11b046(0x95)](),_0x52e9c4;}[_0xeba5ae(0x144)](_0x2a4a55){var _0x874c11=_0xeba5ae;return Object[_0x874c11(0xc0)]?Object[_0x874c11(0xc0)](_0x2a4a55):[];}[_0xeba5ae(0x107)](_0x24433b){var _0x23b49d=_0xeba5ae;return!!(_0x24433b&&_0x1cc08b[_0x23b49d(0x8b)]&&this[_0x23b49d(0x115)](_0x24433b)==='[object\\x20Set]'&&_0x24433b[_0x23b49d(0x16a)]);}[_0xeba5ae(0x13d)](_0x137e25,_0x87508b,_0x521459){return _0x521459['noFunctions']?typeof _0x137e25[_0x87508b]=='function':!0x1;}[_0xeba5ae(0xbc)](_0x26fed2){var _0x40a499=_0xeba5ae,_0xafe7f9='';return _0xafe7f9=typeof _0x26fed2,_0xafe7f9===_0x40a499(0x13f)?this[_0x40a499(0x115)](_0x26fed2)===_0x40a499(0xc5)?_0xafe7f9=_0x40a499(0x116):this['_objectToString'](_0x26fed2)===_0x40a499(0x86)?_0xafe7f9=_0x40a499(0x87):this[_0x40a499(0x115)](_0x26fed2)===_0x40a499(0x9c)?_0xafe7f9=_0x40a499(0x9e):_0x26fed2===null?_0xafe7f9='null':_0x26fed2[_0x40a499(0x139)]&&(_0xafe7f9=_0x26fed2[_0x40a499(0x139)][_0x40a499(0x122)]||_0xafe7f9):_0xafe7f9===_0x40a499(0xb2)&&this['_HTMLAllCollection']&&_0x26fed2 instanceof this[_0x40a499(0xfb)]&&(_0xafe7f9='HTMLAllCollection'),_0xafe7f9;}[_0xeba5ae(0x115)](_0x569915){var _0x9ae7ea=_0xeba5ae;return Object[_0x9ae7ea(0x11b)][_0x9ae7ea(0xf4)][_0x9ae7ea(0x171)](_0x569915);}['_isPrimitiveType'](_0x5332f0){var _0x4fd674=_0xeba5ae;return _0x5332f0===_0x4fd674(0x165)||_0x5332f0===_0x4fd674(0x11a)||_0x5332f0===_0x4fd674(0xa3);}[_0xeba5ae(0x9d)](_0x5d583c){var _0x2ed699=_0xeba5ae;return _0x5d583c===_0x2ed699(0x13c)||_0x5d583c==='String'||_0x5d583c===_0x2ed699(0x10d);}[_0xeba5ae(0xac)](_0x23869e,_0x5e0b24,_0x18ce69,_0x14d228,_0x1e1416,_0x437436){var _0x2b1fd3=this;return function(_0x1d221a){var _0x57e586=_0xb830,_0x5292b4=_0x1e1416[_0x57e586(0xa1)]['current'],_0x1ff91d=_0x1e1416[_0x57e586(0xa1)][_0x57e586(0x158)],_0x2800d7=_0x1e1416[_0x57e586(0xa1)][_0x57e586(0x16d)];_0x1e1416[_0x57e586(0xa1)][_0x57e586(0x16d)]=_0x5292b4,_0x1e1416[_0x57e586(0xa1)][_0x57e586(0x158)]=typeof _0x14d228==_0x57e586(0xa3)?_0x14d228:_0x1d221a,_0x23869e['push'](_0x2b1fd3[_0x57e586(0x113)](_0x5e0b24,_0x18ce69,_0x14d228,_0x1e1416,_0x437436)),_0x1e1416[_0x57e586(0xa1)][_0x57e586(0x16d)]=_0x2800d7,_0x1e1416[_0x57e586(0xa1)][_0x57e586(0x158)]=_0x1ff91d;};}['_addObjectProperty'](_0xb040af,_0xefd771,_0x2da156,_0x124727,_0x42618e,_0x9fa9d6,_0x4ce1cb){var _0x14cd22=_0xeba5ae,_0xd4ffc8=this;return _0xefd771[_0x14cd22(0xfd)+_0x42618e['toString']()]=!0x0,function(_0x355c24){var _0x18bd77=_0x14cd22,_0x2d45bc=_0x9fa9d6[_0x18bd77(0xa1)][_0x18bd77(0x146)],_0x4817ef=_0x9fa9d6['node'][_0x18bd77(0x158)],_0x176974=_0x9fa9d6['node'][_0x18bd77(0x16d)];_0x9fa9d6[_0x18bd77(0xa1)]['parent']=_0x2d45bc,_0x9fa9d6[_0x18bd77(0xa1)][_0x18bd77(0x158)]=_0x355c24,_0xb040af[_0x18bd77(0xff)](_0xd4ffc8[_0x18bd77(0x113)](_0x2da156,_0x124727,_0x42618e,_0x9fa9d6,_0x4ce1cb)),_0x9fa9d6[_0x18bd77(0xa1)][_0x18bd77(0x16d)]=_0x176974,_0x9fa9d6[_0x18bd77(0xa1)][_0x18bd77(0x158)]=_0x4817ef;};}[_0xeba5ae(0x113)](_0x988cca,_0x5decdb,_0x1747c2,_0x305e2e,_0x559d0a){var _0x315945=_0xeba5ae,_0x267001=this;_0x559d0a||(_0x559d0a=function(_0x50817c,_0x78f975){return _0x50817c[_0x78f975];});var _0x6b784e=_0x1747c2[_0x315945(0xf4)](),_0x56413a=_0x305e2e['expressionsToEvaluate']||{},_0x21c4e5=_0x305e2e['depth'],_0x447698=_0x305e2e['isExpressionToEvaluate'];try{var _0x50f1c8=this[_0x315945(0x99)](_0x988cca),_0x5b03d3=_0x6b784e;_0x50f1c8&&_0x5b03d3[0x0]==='\\x27'&&(_0x5b03d3=_0x5b03d3[_0x315945(0x16e)](0x1,_0x5b03d3[_0x315945(0x131)]-0x2));var _0x24b859=_0x305e2e[_0x315945(0xaf)]=_0x56413a[_0x315945(0xfd)+_0x5b03d3];_0x24b859&&(_0x305e2e['depth']=_0x305e2e[_0x315945(0xc1)]+0x1),_0x305e2e[_0x315945(0xa6)]=!!_0x24b859;var _0x57685f=typeof _0x1747c2==_0x315945(0xed),_0x4ec724={'name':_0x57685f||_0x50f1c8?_0x6b784e:this[_0x315945(0x8d)](_0x6b784e)};if(_0x57685f&&(_0x4ec724[_0x315945(0xed)]=!0x0),!(_0x5decdb===_0x315945(0x116)||_0x5decdb===_0x315945(0x89))){var _0xc6f266=this[_0x315945(0x132)](_0x988cca,_0x1747c2);if(_0xc6f266&&(_0xc6f266['set']&&(_0x4ec724[_0x315945(0x152)]=!0x0),_0xc6f266['get']&&!_0x24b859&&!_0x305e2e[_0x315945(0xfe)]))return _0x4ec724[_0x315945(0xeb)]=!0x0,this['_processTreeNodeResult'](_0x4ec724,_0x305e2e),_0x4ec724;}var _0x3a93d0;try{_0x3a93d0=_0x559d0a(_0x988cca,_0x1747c2);}catch(_0x3aa278){return _0x4ec724={'name':_0x6b784e,'type':_0x315945(0x10a),'error':_0x3aa278[_0x315945(0xea)]},this[_0x315945(0x102)](_0x4ec724,_0x305e2e),_0x4ec724;}var _0x5f450f=this[_0x315945(0xbc)](_0x3a93d0),_0x3cf548=this['_isPrimitiveType'](_0x5f450f);if(_0x4ec724[_0x315945(0x9b)]=_0x5f450f,_0x3cf548)this[_0x315945(0x102)](_0x4ec724,_0x305e2e,_0x3a93d0,function(){var _0x450f09=_0x315945;_0x4ec724[_0x450f09(0xf0)]=_0x3a93d0[_0x450f09(0xa2)](),!_0x24b859&&_0x267001[_0x450f09(0x169)](_0x5f450f,_0x4ec724,_0x305e2e,{});});else{var _0x413e76=_0x305e2e[_0x315945(0x124)]&&_0x305e2e[_0x315945(0xc8)]<_0x305e2e[_0x315945(0x104)]&&_0x305e2e[_0x315945(0xd1)][_0x315945(0xb8)](_0x3a93d0)<0x0&&_0x5f450f!==_0x315945(0x11c)&&_0x305e2e[_0x315945(0xa7)]<_0x305e2e[_0x315945(0xec)];_0x413e76||_0x305e2e[_0x315945(0xc8)]<_0x21c4e5||_0x24b859?(this[_0x315945(0xb3)](_0x4ec724,_0x3a93d0,_0x305e2e,_0x24b859||{}),this[_0x315945(0xa0)](_0x3a93d0,_0x4ec724)):this[_0x315945(0x102)](_0x4ec724,_0x305e2e,_0x3a93d0,function(){var _0x5bc30f=_0x315945;_0x5f450f===_0x5bc30f(0xd2)||_0x5f450f===_0x5bc30f(0xb2)||(delete _0x4ec724[_0x5bc30f(0xf0)],_0x4ec724[_0x5bc30f(0x126)]=!0x0);});}return _0x4ec724;}finally{_0x305e2e['expressionsToEvaluate']=_0x56413a,_0x305e2e[_0x315945(0xc1)]=_0x21c4e5,_0x305e2e['isExpressionToEvaluate']=_0x447698;}}[_0xeba5ae(0x169)](_0x158312,_0x52fa59,_0x12c82b,_0x289c16){var _0x12aa02=_0xeba5ae,_0x36a98f=_0x289c16[_0x12aa02(0xe1)]||_0x12c82b['strLength'];if((_0x158312===_0x12aa02(0x11a)||_0x158312===_0x12aa02(0xc6))&&_0x52fa59['value']){let _0x4a6342=_0x52fa59[_0x12aa02(0xf0)]['length'];_0x12c82b[_0x12aa02(0xcc)]+=_0x4a6342,_0x12c82b[_0x12aa02(0xcc)]>_0x12c82b[_0x12aa02(0x12d)]?(_0x52fa59['capped']='',delete _0x52fa59['value']):_0x4a6342>_0x36a98f&&(_0x52fa59[_0x12aa02(0x126)]=_0x52fa59['value']['substr'](0x0,_0x36a98f),delete _0x52fa59[_0x12aa02(0xf0)]);}}['_isMap'](_0x5be373){var _0x3ba1c6=_0xeba5ae;return!!(_0x5be373&&_0x1cc08b[_0x3ba1c6(0x14c)]&&this[_0x3ba1c6(0x115)](_0x5be373)===_0x3ba1c6(0xb6)&&_0x5be373[_0x3ba1c6(0x16a)]);}[_0xeba5ae(0x8d)](_0xc4ce1c){var _0x2962e7=_0xeba5ae;if(_0xc4ce1c['match'](/^\\d+$/))return _0xc4ce1c;var _0x4392b5;try{_0x4392b5=JSON[_0x2962e7(0x140)](''+_0xc4ce1c);}catch{_0x4392b5='\\x22'+this[_0x2962e7(0x115)](_0xc4ce1c)+'\\x22';}return _0x4392b5['match'](/^\"([a-zA-Z_][a-zA-Z_0-9]*)\"$/)?_0x4392b5=_0x4392b5[_0x2962e7(0x16e)](0x1,_0x4392b5[_0x2962e7(0x131)]-0x2):_0x4392b5=_0x4392b5[_0x2962e7(0xe7)](/'/g,'\\x5c\\x27')[_0x2962e7(0xe7)](/\\\\\"/g,'\\x22')[_0x2962e7(0xe7)](/(^\"|\"$)/g,'\\x27'),_0x4392b5;}[_0xeba5ae(0x102)](_0x26ebd8,_0x2b13b8,_0xe06eaa,_0x3c24ec){var _0x3742a8=_0xeba5ae;this[_0x3742a8(0xb4)](_0x26ebd8,_0x2b13b8),_0x3c24ec&&_0x3c24ec(),this[_0x3742a8(0xa0)](_0xe06eaa,_0x26ebd8),this[_0x3742a8(0x16b)](_0x26ebd8,_0x2b13b8);}['_treeNodePropertiesBeforeFullValue'](_0x5ae563,_0x571899){var _0x2cdb1b=_0xeba5ae;this[_0x2cdb1b(0xe8)](_0x5ae563,_0x571899),this['_setNodeQueryPath'](_0x5ae563,_0x571899),this[_0x2cdb1b(0x15c)](_0x5ae563,_0x571899),this[_0x2cdb1b(0x127)](_0x5ae563,_0x571899);}['_setNodeId'](_0x51436c,_0x5fcb4d){}[_0xeba5ae(0xe2)](_0x1972c1,_0x4ca0bc){}['_setNodeLabel'](_0x8aa837,_0x189dbb){}[_0xeba5ae(0xbd)](_0x516a56){return _0x516a56===this['_undefined'];}[_0xeba5ae(0x16b)](_0x591e56,_0x1f455e){var _0x1b05c6=_0xeba5ae;this[_0x1b05c6(0x15b)](_0x591e56,_0x1f455e),this[_0x1b05c6(0x148)](_0x591e56),_0x1f455e[_0x1b05c6(0x135)]&&this[_0x1b05c6(0x8e)](_0x591e56),this[_0x1b05c6(0x156)](_0x591e56,_0x1f455e),this['_addLoadNode'](_0x591e56,_0x1f455e),this[_0x1b05c6(0xf3)](_0x591e56);}['_additionalMetadata'](_0x5c2370,_0x1cbfde){var _0x461d28=_0xeba5ae;let _0x3b8641;try{_0x1cc08b[_0x461d28(0x88)]&&(_0x3b8641=_0x1cc08b[_0x461d28(0x88)][_0x461d28(0x12b)],_0x1cc08b['console'][_0x461d28(0x12b)]=function(){}),_0x5c2370&&typeof _0x5c2370[_0x461d28(0x131)]==_0x461d28(0xa3)&&(_0x1cbfde[_0x461d28(0x131)]=_0x5c2370['length']);}catch{}finally{_0x3b8641&&(_0x1cc08b['console'][_0x461d28(0x12b)]=_0x3b8641);}if(_0x1cbfde['type']===_0x461d28(0xa3)||_0x1cbfde[_0x461d28(0x9b)]===_0x461d28(0x10d)){if(isNaN(_0x1cbfde[_0x461d28(0xf0)]))_0x1cbfde[_0x461d28(0xdb)]=!0x0,delete _0x1cbfde[_0x461d28(0xf0)];else switch(_0x1cbfde[_0x461d28(0xf0)]){case Number[_0x461d28(0x15e)]:_0x1cbfde[_0x461d28(0xd8)]=!0x0,delete _0x1cbfde[_0x461d28(0xf0)];break;case Number[_0x461d28(0x151)]:_0x1cbfde[_0x461d28(0x92)]=!0x0,delete _0x1cbfde[_0x461d28(0xf0)];break;case 0x0:this[_0x461d28(0x111)](_0x1cbfde[_0x461d28(0xf0)])&&(_0x1cbfde[_0x461d28(0x14e)]=!0x0);break;}}else _0x1cbfde[_0x461d28(0x9b)]==='function'&&typeof _0x5c2370[_0x461d28(0x122)]==_0x461d28(0x11a)&&_0x5c2370['name']&&_0x1cbfde[_0x461d28(0x122)]&&_0x5c2370['name']!==_0x1cbfde['name']&&(_0x1cbfde[_0x461d28(0xf5)]=_0x5c2370[_0x461d28(0x122)]);}[_0xeba5ae(0x111)](_0x112127){var _0x57acac=_0xeba5ae;return 0x1/_0x112127===Number[_0x57acac(0x151)];}['_sortProps'](_0x3dc922){var _0x15369a=_0xeba5ae;!_0x3dc922['props']||!_0x3dc922[_0x15369a(0x11e)][_0x15369a(0x131)]||_0x3dc922['type']===_0x15369a(0x116)||_0x3dc922[_0x15369a(0x9b)]===_0x15369a(0x14c)||_0x3dc922[_0x15369a(0x9b)]===_0x15369a(0x8b)||_0x3dc922[_0x15369a(0x11e)][_0x15369a(0xf2)](function(_0x5b9559,_0x11da09){var _0x5af4d8=_0x5b9559['name']['toLowerCase'](),_0x9acbc1=_0x11da09['name']['toLowerCase']();return _0x5af4d8<_0x9acbc1?-0x1:_0x5af4d8>_0x9acbc1?0x1:0x0;});}[_0xeba5ae(0x156)](_0x21b8f6,_0x53f602){var _0x15ce53=_0xeba5ae;if(!(_0x53f602['noFunctions']||!_0x21b8f6[_0x15ce53(0x11e)]||!_0x21b8f6[_0x15ce53(0x11e)][_0x15ce53(0x131)])){for(var _0x3a5023=[],_0x2e6d60=[],_0x18f154=0x0,_0x39d54e=_0x21b8f6[_0x15ce53(0x11e)][_0x15ce53(0x131)];_0x18f154<_0x39d54e;_0x18f154++){var _0x276061=_0x21b8f6[_0x15ce53(0x11e)][_0x18f154];_0x276061['type']===_0x15ce53(0x11c)?_0x3a5023[_0x15ce53(0xff)](_0x276061):_0x2e6d60[_0x15ce53(0xff)](_0x276061);}if(!(!_0x2e6d60[_0x15ce53(0x131)]||_0x3a5023[_0x15ce53(0x131)]<=0x1)){_0x21b8f6[_0x15ce53(0x11e)]=_0x2e6d60;var _0x4ee7a9={'functionsNode':!0x0,'props':_0x3a5023};this[_0x15ce53(0xe8)](_0x4ee7a9,_0x53f602),this[_0x15ce53(0x15b)](_0x4ee7a9,_0x53f602),this[_0x15ce53(0x148)](_0x4ee7a9),this['_setNodePermissions'](_0x4ee7a9,_0x53f602),_0x4ee7a9['id']+='\\x20f',_0x21b8f6[_0x15ce53(0x11e)][_0x15ce53(0xfa)](_0x4ee7a9);}}}[_0xeba5ae(0x98)](_0x49615f,_0x3b5c15){}[_0xeba5ae(0x148)](_0x256a3b){}['_isArray'](_0x41a15a){var _0x264703=_0xeba5ae;return Array[_0x264703(0x97)](_0x41a15a)||typeof _0x41a15a==_0x264703(0x13f)&&this[_0x264703(0x115)](_0x41a15a)===_0x264703(0xc5);}['_setNodePermissions'](_0x294134,_0x4d88f1){}[_0xeba5ae(0xf3)](_0x20a039){var _0xcf5353=_0xeba5ae;delete _0x20a039[_0xcf5353(0xaa)],delete _0x20a039[_0xcf5353(0x119)],delete _0x20a039[_0xcf5353(0x14a)];}[_0xeba5ae(0x15c)](_0x22e503,_0xb96da4){}}let _0xba5153=new _0x1d60d8(),_0x49b01f={'props':0x64,'elements':0x64,'strLength':0x400*0x32,'totalStrLength':0x400*0x32,'autoExpandLimit':0x1388,'autoExpandMaxDepth':0xa},_0x2febb7={'props':0x5,'elements':0x5,'strLength':0x100,'totalStrLength':0x100*0x3,'autoExpandLimit':0x1e,'autoExpandMaxDepth':0x2};function _0x2fa7e8(_0x2fce41,_0xaac901,_0x3c7ef5,_0x365d83,_0x2b4f70,_0x2e0abc){var _0x5eb761=_0xeba5ae;let _0x3371d2,_0x3176de;try{_0x3176de=_0x38efec(),_0x3371d2=_0x3730c0[_0xaac901],!_0x3371d2||_0x3176de-_0x3371d2['ts']>0x1f4&&_0x3371d2[_0x5eb761(0xf9)]&&_0x3371d2[_0x5eb761(0x93)]/_0x3371d2[_0x5eb761(0xf9)]<0x64?(_0x3730c0[_0xaac901]=_0x3371d2={'count':0x0,'time':0x0,'ts':_0x3176de},_0x3730c0[_0x5eb761(0x167)]={}):_0x3176de-_0x3730c0[_0x5eb761(0x167)]['ts']>0x32&&_0x3730c0['hits']['count']&&_0x3730c0[_0x5eb761(0x167)][_0x5eb761(0x93)]/_0x3730c0['hits'][_0x5eb761(0xf9)]<0x64&&(_0x3730c0['hits']={});let _0xd1cda2=[],_0x416cc7=_0x3371d2[_0x5eb761(0xc3)]||_0x3730c0[_0x5eb761(0x167)][_0x5eb761(0xc3)]?_0x2febb7:_0x49b01f,_0x581d20=_0x1ee84d=>{var _0x4b98bd=_0x5eb761;let _0x50800f={};return _0x50800f[_0x4b98bd(0x11e)]=_0x1ee84d['props'],_0x50800f['elements']=_0x1ee84d[_0x4b98bd(0x168)],_0x50800f[_0x4b98bd(0xe1)]=_0x1ee84d[_0x4b98bd(0xe1)],_0x50800f[_0x4b98bd(0x12d)]=_0x1ee84d[_0x4b98bd(0x12d)],_0x50800f['autoExpandLimit']=_0x1ee84d['autoExpandLimit'],_0x50800f[_0x4b98bd(0x104)]=_0x1ee84d['autoExpandMaxDepth'],_0x50800f[_0x4b98bd(0x135)]=!0x1,_0x50800f[_0x4b98bd(0x101)]=!_0x13ad5e,_0x50800f[_0x4b98bd(0xc1)]=0x1,_0x50800f[_0x4b98bd(0xc8)]=0x0,_0x50800f[_0x4b98bd(0xc9)]='root_exp_id',_0x50800f[_0x4b98bd(0x12f)]=_0x4b98bd(0xcf),_0x50800f[_0x4b98bd(0x124)]=!0x0,_0x50800f['autoExpandPreviousObjects']=[],_0x50800f[_0x4b98bd(0xa7)]=0x0,_0x50800f[_0x4b98bd(0xfe)]=!0x0,_0x50800f[_0x4b98bd(0xcc)]=0x0,_0x50800f[_0x4b98bd(0xa1)]={'current':void 0x0,'parent':void 0x0,'index':0x0},_0x50800f;};for(var _0x5276bc=0x0;_0x5276bc<_0x2b4f70[_0x5eb761(0x131)];_0x5276bc++)_0xd1cda2[_0x5eb761(0xff)](_0xba5153[_0x5eb761(0xb3)]({'timeNode':_0x2fce41==='time'||void 0x0},_0x2b4f70[_0x5276bc],_0x581d20(_0x416cc7),{}));if(_0x2fce41===_0x5eb761(0x164)){let _0x54225b=Error[_0x5eb761(0xb9)];try{Error[_0x5eb761(0xb9)]=0x1/0x0,_0xd1cda2[_0x5eb761(0xff)](_0xba5153[_0x5eb761(0xb3)]({'stackNode':!0x0},new Error()[_0x5eb761(0x129)],_0x581d20(_0x416cc7),{'strLength':0x1/0x0}));}finally{Error[_0x5eb761(0xb9)]=_0x54225b;}}return{'method':'log','version':_0x5d91f4,'args':[{'ts':_0x3c7ef5,'session':_0x365d83,'args':_0xd1cda2,'id':_0xaac901,'context':_0x2e0abc}]};}catch(_0xc1d67d){return{'method':'log','version':_0x5d91f4,'args':[{'ts':_0x3c7ef5,'session':_0x365d83,'args':[{'type':_0x5eb761(0x10a),'error':_0xc1d67d&&_0xc1d67d[_0x5eb761(0xea)]}],'id':_0xaac901,'context':_0x2e0abc}]};}finally{try{if(_0x3371d2&&_0x3176de){let _0x39ee54=_0x38efec();_0x3371d2['count']++,_0x3371d2[_0x5eb761(0x93)]+=_0x435479(_0x3176de,_0x39ee54),_0x3371d2['ts']=_0x39ee54,_0x3730c0[_0x5eb761(0x167)][_0x5eb761(0xf9)]++,_0x3730c0['hits'][_0x5eb761(0x93)]+=_0x435479(_0x3176de,_0x39ee54),_0x3730c0[_0x5eb761(0x167)]['ts']=_0x39ee54,(_0x3371d2['count']>0x32||_0x3371d2[_0x5eb761(0x93)]>0x64)&&(_0x3371d2[_0x5eb761(0xc3)]=!0x0),(_0x3730c0[_0x5eb761(0x167)]['count']>0x3e8||_0x3730c0[_0x5eb761(0x167)][_0x5eb761(0x93)]>0x12c)&&(_0x3730c0[_0x5eb761(0x167)][_0x5eb761(0xc3)]=!0x0);}}catch{}}}return _0x2fa7e8;}((_0x27a3b3,_0xccbd46,_0x42f2ff,_0x39ddc6,_0x374a56,_0x3ab083,_0x3ea20e,_0x17295e,_0x1b42b2,_0x1513ca)=>{var _0x6d0d70=_0x1097a9;if(_0x27a3b3['_console_ninja'])return _0x27a3b3[_0x6d0d70(0xe4)];if(!J(_0x27a3b3,_0x17295e,_0x374a56))return _0x27a3b3[_0x6d0d70(0xe4)]={'consoleLog':()=>{},'consoleTrace':()=>{},'consoleTime':()=>{},'consoleTimeEnd':()=>{},'autoLog':()=>{},'autoLogMany':()=>{},'autoTraceMany':()=>{},'coverage':()=>{},'autoTrace':()=>{},'autoTime':()=>{},'autoTimeEnd':()=>{}},_0x27a3b3[_0x6d0d70(0xe4)];let _0x453fe2=W(_0x27a3b3),_0x361a3a=_0x453fe2[_0x6d0d70(0xf6)],_0x6dc794=_0x453fe2['timeStamp'],_0x14408b=_0x453fe2['now'],_0x50d901={'hits':{},'ts':{}},_0x410bf7=Y(_0x27a3b3,_0x1b42b2,_0x50d901,_0x3ab083),_0x3e06df=_0x225a26=>{_0x50d901['ts'][_0x225a26]=_0x6dc794();},_0x3469f7=(_0x5cf307,_0xf31b99)=>{var _0x5e8fc5=_0x6d0d70;let _0x4503fc=_0x50d901['ts'][_0xf31b99];if(delete _0x50d901['ts'][_0xf31b99],_0x4503fc){let _0x1c4b4e=_0x361a3a(_0x4503fc,_0x6dc794());_0x48bd74(_0x410bf7(_0x5e8fc5(0x93),_0x5cf307,_0x14408b(),_0x553e4d,[_0x1c4b4e],_0xf31b99));}},_0x23a3ed=_0x5ec5c7=>_0x2625b7=>{var _0x91e8f4=_0x6d0d70;try{_0x3e06df(_0x2625b7),_0x5ec5c7(_0x2625b7);}finally{_0x27a3b3[_0x91e8f4(0x88)][_0x91e8f4(0x93)]=_0x5ec5c7;}},_0x28e17a=_0x390625=>_0x325330=>{var _0x543e26=_0x6d0d70;try{let [_0x34e18b,_0x2cf90b]=_0x325330[_0x543e26(0x10b)](_0x543e26(0xe6));_0x3469f7(_0x2cf90b,_0x34e18b),_0x390625(_0x34e18b);}finally{_0x27a3b3[_0x543e26(0x88)][_0x543e26(0xba)]=_0x390625;}};_0x27a3b3[_0x6d0d70(0xe4)]={'consoleLog':(_0x8c65fe,_0x25f248)=>{var _0x445365=_0x6d0d70;_0x27a3b3[_0x445365(0x88)][_0x445365(0xae)][_0x445365(0x122)]!==_0x445365(0x163)&&_0x48bd74(_0x410bf7(_0x445365(0xae),_0x8c65fe,_0x14408b(),_0x553e4d,_0x25f248));},'consoleTrace':(_0x4081b6,_0x198032)=>{var _0x3c28a1=_0x6d0d70;_0x27a3b3[_0x3c28a1(0x88)][_0x3c28a1(0xae)][_0x3c28a1(0x122)]!=='disabledTrace'&&_0x48bd74(_0x410bf7(_0x3c28a1(0x164),_0x4081b6,_0x14408b(),_0x553e4d,_0x198032));},'consoleTime':()=>{var _0x4837f8=_0x6d0d70;_0x27a3b3[_0x4837f8(0x88)]['time']=_0x23a3ed(_0x27a3b3['console'][_0x4837f8(0x93)]);},'consoleTimeEnd':()=>{var _0x8ef218=_0x6d0d70;_0x27a3b3[_0x8ef218(0x88)][_0x8ef218(0xba)]=_0x28e17a(_0x27a3b3[_0x8ef218(0x88)][_0x8ef218(0xba)]);},'autoLog':(_0x276a3d,_0x1fe4e9)=>{var _0x1b731c=_0x6d0d70;_0x48bd74(_0x410bf7(_0x1b731c(0xae),_0x1fe4e9,_0x14408b(),_0x553e4d,[_0x276a3d]));},'autoLogMany':(_0x3c7420,_0x20b118)=>{var _0x10c340=_0x6d0d70;_0x48bd74(_0x410bf7(_0x10c340(0xae),_0x3c7420,_0x14408b(),_0x553e4d,_0x20b118));},'autoTrace':(_0x27b835,_0x23af1a)=>{var _0x3ef9f4=_0x6d0d70;_0x48bd74(_0x410bf7(_0x3ef9f4(0x164),_0x23af1a,_0x14408b(),_0x553e4d,[_0x27b835]));},'autoTraceMany':(_0x407c10,_0x3cdd43)=>{var _0x38a5a0=_0x6d0d70;_0x48bd74(_0x410bf7(_0x38a5a0(0x164),_0x407c10,_0x14408b(),_0x553e4d,_0x3cdd43));},'autoTime':(_0x276ada,_0x18fb0a,_0x4a4f03)=>{_0x3e06df(_0x4a4f03);},'autoTimeEnd':(_0x523298,_0x5fd6d4,_0x1bf5d8)=>{_0x3469f7(_0x5fd6d4,_0x1bf5d8);},'coverage':_0x1a263f=>{_0x48bd74({'method':'coverage','version':_0x3ab083,'args':[{'id':_0x1a263f}]});}};let _0x48bd74=b(_0x27a3b3,_0xccbd46,_0x42f2ff,_0x39ddc6,_0x374a56,_0x1513ca),_0x553e4d=_0x27a3b3['_console_ninja_session'];return _0x27a3b3[_0x6d0d70(0xe4)];})(globalThis,_0x1097a9(0xd6),_0x1097a9(0xde),_0x1097a9(0xa5),'webpack',_0x1097a9(0xe9),_0x1097a9(0x10e),_0x1097a9(0xf8),'',_0x1097a9(0xb5));"
      )
    );
  } catch (e) {}
}
/* istanbul ignore next */ function oo_oo(i, ...v) {
  try {
    oo_cm().consoleLog(i, v);
  } catch (e) {}
  return v;
}
/* istanbul ignore next */ function oo_tr(i, ...v) {
  try {
    oo_cm().consoleTrace(i, v);
  } catch (e) {}
  return v;
}
/* istanbul ignore next */ function oo_ts() {
  try {
    oo_cm().consoleTime();
  } catch (e) {}
}
/* istanbul ignore next */ function oo_te() {
  try {
    oo_cm().consoleTimeEnd();
  } catch (e) {}
} /*eslint unicorn/no-abusive-eslint-disable:,eslint-comments/disable-enable-pair:,eslint-comments/no-unlimited-disable:,eslint-comments/no-aggregating-enable:,eslint-comments/no-duplicate-disable:,eslint-comments/no-unused-disable:,eslint-comments/no-unused-enable:,*/

/*
Copyright 2017-2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.

Licensed under the Amazon Software License (the "License"). You may not use this file
except in compliance with the License. A copy of the License is located at

http://aws.amazon.com/asl/

or in the "license" file accompanying this file. This file is distributed on an "AS IS"
BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, express or implied. See the
License for the specific language governing permissions and limitations under the License.
*/
