<template>
  <v-flex d-flex class="message">
    <!-- contains message and response card -->
    <v-layout column ma-2 class="message-layout">
      <!-- contains message bubble and date -->
      <v-flex d-flex class="message-bubble-date-container">
        <v-layout column class="message-bubble-column">
          <!-- Message Bubble and Avatar -->
          <v-flex d-flex class="message-bubble-avatar-container">
            <v-layout row class="message-bubble-row">
              <div
                tabindex="0"
                v-on:focus="onMessageFocus"
                v-on:blur="onMessageBlur"
                class="message-bubble focusable"
              >
                <message-text
                  v-bind:message="message"
                  v-if="
                    'text' in message &&
                    message.text !== null &&
                    message.text.length
                  "
                ></message-text>
              </div>
            </v-layout>
          </v-flex>

          <!-- Message Date -->
          <v-flex
            v-if="shouldShowMessageDate && isMessageFocused"
            class="text-xs-center message-date"
            aria-hidden="true"
          >
            {{ messageHumanDate }}
          </v-flex>

          <!-- Thumbs Up/Down Feedback -->
          <div
            v-if="
              message.id === this.$store.state.messages.length - 1 &&
              isLastMessageFeedback &&
              message.type === 'bot' &&
              botDialogState &&
              showDialogFeedback
            "
            class="feedback-state"
          >
            <v-btn
              icon
              v-on:click="onButtonClick(positiveIntent)"
              v-bind:class="{
                'feedback-icons-positive': !positiveClick,
                positiveClick: positiveClick,
              }"
              class="feedback-icon"
              tabindex="0"
            >
              <thumbs-up-svg />
            </v-btn>

            <v-btn
              icon
              v-on:click="onButtonClick(negativeIntent)"
              v-bind:class="{
                'feedback-icons-negative': !negativeClick,
                negativeClick: negativeClick,
              }"
              class="feedback-icon"
              tabindex="0"
            >
              <thumbs-up-svg />
            </v-btn>
          </div>
        </v-layout>
      </v-flex>
    </v-layout>
  </v-flex>
</template>

<script>
/*
Copyright 2017-2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.

Licensed under the Amazon Software License (the "License"). You may not use this file
except in compliance with the License. A copy of the License is located at

http://aws.amazon.com/asl/

or in the "license" file accompanying this file. This file is distributed on an "AS IS"
BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, express or implied. See the
License for the specific language governing permissions and limitations under the License.
*/
import MessageText from "./MessageText";
import ThumbsUpSvg from "./ThumbsUpSvg";

export default {
  name: "message",
  props: ["message", "feedback"],
  components: {
    MessageText,
    ThumbsUpSvg,
  },
  data() {
    return {
      isMessageFocused: false,
      messageHumanDate: "Now",
      datetime: new Date(),
      textFieldProps: {
        appendIcon: "event",
      },
      positiveClick: false,
      negativeClick: false,
      hasButtonBeenClicked: false,
      positiveIntent: this.$store.state.config.ui.positiveFeedbackIntent,
      negativeIntent: this.$store.state.config.ui.negativeFeedbackIntent,
      hideInputFields:
        this.$store.state.config.ui.hideInputFieldsForButtonResponse,
    };
  },
  computed: {
    botDialogState() {
      if (!("dialogState" in this.message)) {
        return null;
      }
      switch (this.message.dialogState) {
        case "Failed":
          return { icon: "error", color: "red", state: "fail" };
        case "Fulfilled":
        case "ReadyForFulfillment":
          return { icon: "done", color: "green", state: "ok" };
        default:
          return null;
      }
    },
    isLastMessageFeedback() {
      if (
        this.$store.state.messages.length > 2 &&
        this.$store.state.messages[this.$store.state.messages.length - 2]
          .type !== "feedback"
      ) {
        return true;
      }
      return false;
    },
    showDialogFeedback() {
      if (
        this.$store.state.config.ui.positiveFeedbackIntent.length > 2 &&
        this.$store.state.config.ui.negativeFeedbackIntent.length > 2
      ) {
        return true;
      }
      return false;
    },
    shouldShowMessageDate() {
      return this.$store.state.config.ui.showMessageDate;
    },
  },
  provide() {},
  methods: {
    onButtonClick(feedback) {
      console.log("onButtonClick is called");
      if (!this.hasButtonBeenClicked) {
        this.hasButtonBeenClicked = true;
        if (feedback === this.$store.state.config.ui.positiveFeedbackIntent) {
          this.positiveClick = true;
        } else {
          this.negativeClick = true;
        }
        const message = {
          type: "feedback",
          text: feedback,
        };
        this.$emit("feedbackButton");
        this.$store.dispatch("postTextMessage", message);
      }
    },
    onMessageFocus() {
      if (!this.shouldShowMessageDate) {
        return;
      }
      this.messageHumanDate = this.getMessageHumanDate();
      this.isMessageFocused = true;
      if (this.message.id === this.$store.state.messages.length - 1) {
        this.$emit("scrollDown");
      }
    },
    onMessageBlur() {
      if (!this.shouldShowMessageDate) {
        return;
      }
      this.isMessageFocused = false;
    },
    getMessageHumanDate() {
      const dateDiff = Math.round((new Date() - this.message.date) / 1000);
      const secsInHr = 3600;
      const secsInDay = secsInHr * 24;
      if (dateDiff < 60) {
        return "Now";
      }
      if (dateDiff < secsInHr) {
        return `${Math.floor(dateDiff / 60)} min ago`;
      }
      if (dateDiff < secsInDay) {
        return this.message.date.toLocaleTimeString();
      }
      return this.message.date.toLocaleString();
    },
  },
  created() {},
};
</script>

<style scoped>
.smicon {
  font-size: 14px;
}

.message,
.message-bubble-column {
  flex: 0 0 auto;
}

.message,
.message-bubble-row {
  max-width: 80vw;
}

.message-bubble {
  border-radius: 24px;
  display: inline-flex;
  font-size: calc(1em + 0.25vmin);
  padding: 0 12px;
  width: fit-content;
  align-self: center;
}

.interactive-row {
  display: block;
}

.focusable {
  box-shadow: 0 0.25px 0.75px rgba(0, 0, 0, 0.12),
    0 0.25px 0.5px rgba(0, 0, 0, 0.24);
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  cursor: default;
}

.focusable:focus {
  box-shadow: 0 1.25px 3.75px rgba(0, 0, 0, 0.25),
    0 1.25px 2.5px rgba(0, 0, 0, 0.22);
  outline: none;
}

.message-bot .message-bubble {
  background-color: #ebebec;
}

.message-agent .message-bubble {
  background-color: #ebebec;
}

.message-human .message-bubble {
  background-color: black;
  color: white;
}

.message-feedback .message-bubble {
  background-color: #ebebec;
}

.feedback-state {
  display: inline-flex;
  align-self: flex-start;
  width: 80px;
  justify-content: flex-start;
  padding-left: 1em;
  justify-content: space-around;
  padding-top: 10px;
}

.icon.feedback-icons-positive {
  color: grey;
  /* color: #E8EAF6; */
  /* color: green; */
  padding: 0.125em;
}

.positiveClick {
  padding: 0.125em;
}

.negativeClick {
  padding: 0.125em;
}

.icon.feedback-icons-negative {
  color: grey;
  padding: 0.125em;
}

.feedback-icons-negative {
  /* safari requires the transform happen here rather than on the svg. */
  transform: scale(-1, -1);
}

.feedback-icon {
  height: 20px;
  width: 20px;
  display: inline;
  justify-self: start;
  fill: gray;
}
</style>
