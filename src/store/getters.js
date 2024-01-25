/*
Copyright 2017-2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.

Licensed under the Amazon Software License (the "License"). You may not use this file
except in compliance with the License. A copy of the License is located at

http://aws.amazon.com/asl/

or in the "license" file accompanying this file. This file is distributed on an "AS IS"
BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, express or implied. See the
License for the specific language governing permissions and limitations under the License.
*/

// TODO: remove unused imports
// const jwt = require("jsonwebtoken");

export default {
  isLexProcessing: (state) => state.lex.isProcessing,
  isBackProcessing: (state) => state.isBackProcessing,
  lastUtterance: (state) => () => {
    if (state.utteranceStack.length === 0) return "";
    return state.utteranceStack[state.utteranceStack.length - 1].t;
  },

  wsMessages: (state) => () => state.streaming.wsMessages,

  wsMessagesCurrentIndex: (state) => () =>
    state.streaming.wsMessagesCurrentIndex,

  wsMessagesLength: (state) => () => state.streaming.wsMessages.length,

  isStartingTypingWsMessages: (state) => () =>
    state.streaming.isStartingTypingWsMessages,
};
