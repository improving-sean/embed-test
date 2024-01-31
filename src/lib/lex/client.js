/*
 Copyright 2017-2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.

 Licensed under the Amazon Software License (the "License"). You may not use this file
 except in compliance with the License. A copy of the License is located at

 http://aws.amazon.com/asl/

 or in the "license" file accompanying this file. This file is distributed on an "AS IS"
 BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, express or implied. See the
 License for the specific language governing permissions and limitations under the License.
 */
export default class {
  constructor({ userId }) {
    this.userId =
      userId ||
      "lex-web-ui-" +
        `${Math.floor((1 + Math.random()) * 0x10000)
          .toString(16)
          .substring(1)}`;

    this.apiUri = "https://lxb0fe009i.execute-api.us-east-1.amazonaws.com/";
  }

  initCredentials(credentials) {
    this.credentials = credentials;
    this.lexRuntimeClient.config.credentials = this.credentials;
    this.userId = credentials.identityId ? credentials.identityId : this.userId;
  }

  deleteSession() {
    console.log(
      `lex-client: deleting session for user ${this.userId} and bot ${this.botName}`
    );
    const apiUrl = this.apiUri + "/session";
    const requestBody = {
      sessionId: this.userId,
    };
    const requestOptions = {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    };

    return this.credentials.getPromise().then((creds) => {
      if (creds) {
        this.initCredentials(creds);
        return fetch(apiUrl, requestOptions).then((response) => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.json();
        });
      } else {
        throw new Error("Credentials are undefined");
      }
    });
  }

  startNewSession() {
    console.log(
      `lex-client: starting new session for user ${this.userId} and bot ${this.botName}`
    );
    const apiUrl = this.apiUri + "/session";
    const requestBody = { sessionId: this.userId };

    // Headers and request options
    const requestOptions = {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    };

    return this.credentials.getPromise().then((creds) => {
      if (creds) {
        this.initCredentials(creds);
        return fetch(apiUrl, requestOptions).then((response) => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.json(); // or .text() if the response is not in JSON format
        });
      } else {
        throw new Error("Credentials are undefined");
      }
    });
  }

  postText(message) {
    const apiUrl = this.apiUri + "/text";
    const requestBody = { sessionId: this.userId, text: message.text };

    // feedback responses require more data so we can properly track the feedback
    if (message.type === "feedback") {
      requestBody.type = message.type;
      requestBody.prompt = message.prompt ?? "err - prompt not found";
      requestBody.response = message.response ?? "err - response not found";
    }

    // Headers and request options
    const requestOptions = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    };

    return fetch(apiUrl, requestOptions).then((res) => {
      if (res.sessionState) {
        // this is v2 response
        res.sessionAttributes = res.sessionState.sessionAttributes;
        if (res.sessionState.intent) {
          res.intentName = res.sessionState.intent.name;
          res.slots = res.sessionState.intent.slots;
          res.dialogState = res.sessionState.intent.state;
          res.slotToElicit = res.sessionState.dialogAction.slotToElicit;
        } else {
          // Fallback for some responses that do not have an intent (ElicitIntent, etc)
          res.intentName = res.interpretations[0].intent.name;
          res.slots = res.interpretations[0].intent.slots;
          res.dialogState = "";
          res.slotToElicit = "";
        }
        const finalMessages = [];
        if (res.messages && res.messages.length > 0) {
          res.messages.forEach((mes) => {
            if (mes.contentType === "ImageResponseCard") {
              res.responseCardLexV2 = res.responseCardLexV2
                ? res.responseCardLexV2
                : [];
              const newCard = {};
              newCard.version = "1";
              newCard.contentType = "application/vnd.amazonaws.card.generic";
              newCard.genericAttachments = [];
              newCard.genericAttachments.push(mes.imageResponseCard);
              res.responseCardLexV2.push(newCard);
            } else {
              /* eslint-disable no-lonely-if */
              if (mes.contentType) {
                // push a v1 style messages for use in the UI along with a special property which indicates if
                // this is the last message in this response. "isLastMessageInGroup" is used to indicate when
                // an image response card can be displayed.
                const v1Format = {
                  type: mes.contentType,
                  value: mes.content,
                  isLastMessageInGroup: "false",
                };
                finalMessages.push(v1Format);
              }
            }
          });
        }
        if (finalMessages.length > 0) {
          // for the last message in the group, set the isLastMessageInGroup to "true"
          finalMessages[finalMessages.length - 1].isLastMessageInGroup = "true";
          const msg = `{"messages": ${JSON.stringify(finalMessages)} }`;
          res.message = msg;
        } else {
          // handle the case where no message was returned in the V2 response. Most likely only a
          // ImageResponseCard was returned. Append a placeholder with an empty string.
          finalMessages.push({ type: "PlainText", value: "" });
          const msg = `{"messages": ${JSON.stringify(finalMessages)} }`;
          res.message = msg;
        }
      }
      return res.json();
    });
  }

  // We may want to break out the feedback code into a separate API call
  // This is here as a starting point for that to happen.
  // postFeedback(feedback = "") {
  //   const apiUrl = this.apiUri + "/feedback";
  //   const requestBody = { sessionId: this.userId, feedback: feedback };

  //   // Headers and request options
  //   const requestOptions = {
  //     method: "POST",
  //     headers: {
  //       "Content-Type": "application/json",
  //     },
  //     body: JSON.stringify(requestBody),
  //   };

  //   return fetch(apiUrl, requestOptions).then((res) => {
  //     return res.json();
  //   });
  // }
}
