/*
Copyright 2017-2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.

Licensed under the Amazon Software License (the "License"). You may not use this file
except in compliance with the License. A copy of the License is located at

http://aws.amazon.com/asl/

or in the "license" file accompanying this file. This file is distributed on an "AS IS"
BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, express or implied. See the
License for the specific language governing permissions and limitations under the License.
*/

/**
 * Store mutations
 */

/* eslint no-console: ["error", { allow: ["info", "warn", "error"] }] */
/* eslint no-param-reassign: ["error", { "props": false }] */
/* eslint spaced-comment: ["error", "always", { "exceptions": ["*"] }] */

import { mergeConfig } from "@/config";

export default {
  /**
   * state mutations
   */
  // Checks whether a state object exists in sessionStorage and sets the states
  // messages to the previous session.
  reloadMessages(state) {
    const value = sessionStorage.getItem("store");
    if (value !== null) {
      const sessionStore = JSON.parse(value);
      // convert date string into Date object in messages
      state.messages = sessionStore.messages.map((message) => ({
        ...message,
        date: new Date(message.date),
      }));
    }
  },

  /***********************************************************************
   *
   * Lex and Polly Mutations
   *
   **********************************************************************/

  /**
   * Updates Lex State from Lex responses
   */
  updateLexState(state, lexState) {
    state.lex = { ...state.lex, ...lexState };
  },

  /**
   * set to true while calling lexPost{Text,Content}
   * to mark as processing
   */
  setIsLexProcessing(state, bool) {
    if (typeof bool !== "boolean") {
      console.error("setIsLexProcessing status not boolean", bool);
      return;
    }
    state.lex.isProcessing = bool;
  },
  /**
   * set to true if lex is being interrupted while speaking
   */
  setIsLexInterrupting(state, bool) {
    if (typeof bool !== "boolean") {
      console.error("setIsLexInterrupting status not boolean", bool);
      return;
    }
    state.lex.isInterrupting = bool;
  },

  /***********************************************************************
   *
   * UI and General Mutations
   *
   **********************************************************************/

  /**
   * Merges the general config of the web ui
   * with a dynamic config param and merges it with
   * the existing config (e.g. initialized from ../config)
   */
  mergeConfig(state, config) {
    if (typeof config !== "object") {
      console.error("config is not an object", config);
      return;
    }

    // security: do not accept dynamic parentOrigin
    const parentOrigin =
      state.config && state.config.ui && state.config.ui.parentOrigin
        ? state.config.ui.parentOrigin
        : config.ui.parentOrigin || window.location.origin;
    const configFiltered = {
      ...config,
      ...{ ui: { ...config.ui, parentOrigin } },
    };
    if (
      state.config &&
      state.config.ui &&
      state.config.ui.parentOrigin &&
      config.ui &&
      config.ui.parentOrigin &&
      config.ui.parentOrigin !== state.config.ui.parentOrigin
    ) {
      console.warn("ignoring parentOrigin in config: ", config.ui.parentOrigin);
    }
    state.config = mergeConfig(state.config, configFiltered);
  },
  /**
   * Set to true if running embedded in an iframe
   */
  setIsRunningEmbedded(state, bool) {
    if (typeof bool !== "boolean") {
      console.error("setIsRunningEmbedded status not boolean", bool);
      return;
    }
    state.isRunningEmbedded = bool;
  },
  /**
   * used to track the expand/minimize status of the window when
   * running embedded in an iframe
   */
  toggleIsUiMinimized(state) {
    state.isUiMinimized = !state.isUiMinimized;
  },

  toggleIsUiExpanded(state) {
    state.isUiExpanded = !state.isUiExpanded;
  },

  setInitialUtteranceSent(state) {
    state.initialUtteranceSent = true;
  },

  reset(state) {
    const s = {
      messages: [],
      utteranceStack: [],
    };
    Object.keys(s).forEach((key) => {
      state[key] = s[key];
    });
  },

  /**
   * Push new message into messages array
   */
  pushMessage(state, message) {
    state.messages.push({
      id: state.messages.length,
      date: new Date(),
      ...message,
    });
  },

  /**
   * Push a user's utterance onto the utterance stack to be used with back functionality
   */
  pushUtterance(state, utterance) {
    if (!state.isBackProcessing) {
      state.utteranceStack.push({
        t: utterance,
      });
      // max of 1000 utterances allowed in the stack
      if (state.utteranceStack.length > 1000) {
        state.utteranceStack.shift();
      }
    } else {
      state.isBackProcessing = !state.isBackProcessing;
    }
  },

  clearMessages(state) {
    state.messages = [];
    state.lex.sessionAttributes = {};
  },
  setPostTextRetry(state, bool) {
    if (typeof bool !== "boolean") {
      console.error("setPostTextRetry status not boolean", bool);
      return;
    }
    if (bool === false) {
      state.lex.retryCountPostTextTimeout = 0;
    } else {
      state.lex.retryCountPostTextTimeout += 1;
    }
    state.lex.isPostTextRetry = bool;
  },

  /**
   * use to set the voice output
   */
  toggleIsVoiceOutput(state, bool) {
    state.botAudio.isVoiceOutput = bool;
  },

  // Push WS Message to streamingMessage[]
  pushWebSocketMessage(state, wsMessages) {
    state.streaming.wsMessages.push(wsMessages);
  },

  // Append wsMessage to wsMessageString in MessageLoading.vue
  typingWsMessages(state) {
    if (state.streaming.isStartingTypingWsMessages) {
      state.streaming.wsMessagesString =
        state.streaming.wsMessagesString.concat(
          state.streaming.wsMessages[state.streaming.wsMessagesCurrentIndex]
        );
      state.streaming.wsMessagesCurrentIndex++;
    } else if (state.streaming.isStartingTypingWsMessages) {
      state.streaming.isStartingTypingWsMessages = false;
      // reset wsMessage to default
      state.streaming.wsMessagesString = "";
      state.streaming.wsMessages = [];
      state.streaming.wsMessagesCurrentIndex = 0;
    }
  },

  setIsStartingTypingWsMessages(state, bool) {
    state.streaming.isStartingTypingWsMessages = bool;
    if (!bool) {
      // reset wsMessage to default
      state.streaming.wsMessagesString = "";
      state.streaming.wsMessages = [];
      state.streaming.wsMessagesCurrentIndex = 0;
    }
  },
};
