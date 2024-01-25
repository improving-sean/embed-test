<template>
  <div app fixed class="chat-footer">
    <v-layout row justify-space-between ma-0 class="input-container">
      <v-toolbar
        class="footer-toolbar"
        color="white"
        v-bind:dense="this.$store.state.isRunningEmbedded"
      >
        <v-flex>
          <v-text-field
            class="chat-text-field"
            v-bind:placeholder="textInputPlaceholder"
            v-show="shouldShowTextInput"
            v-bind:disabled="isLexProcessing"
            v-model="textInput"
            v-on:keyup.enter.stop="postTextMessage"
            v-on:focus="onTextFieldFocus"
            v-on:blur="onTextFieldBlur"
            @input="onKeyUp"
            ref="textInput"
            id="text-input"
            name="text-input"
            outline
            single-line
            hide-details
          >
            <template v-slot:append>
              <v-btn icon @click="postTextMessage">
                <RightArrowSvg />
              </v-btn>
            </template>
          </v-text-field>
          <a
            href="https://www.couchbase.com/privacy-policy/"
            class="privacy-policy-link"
            target="_blank"
          >
            Couchbase Privacy Policy
          </a>
        </v-flex>
      </v-toolbar>
    </v-layout>
  </div>
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
/* eslint no-console: ["error", { allow: ["warn", "error"] }] */
import RightArrowSvg from "./RightArrowSvg.vue";

export default {
  name: "input-container",
  data() {
    return {
      textInput: "",
      isTextFieldFocused: false,
      shouldShowTooltip: false,
      shouldShowAttachmentClear: false,
      // workaround: vuetify tooltips doesn't seem to support touch events
      tooltipEventHandlers: {
        mouseenter: this.onInputButtonHoverEnter,
        mouseleave: this.onInputButtonHoverLeave,
        touchstart: this.onInputButtonHoverEnter,
        touchend: this.onInputButtonHoverLeave,
        touchcancel: this.onInputButtonHoverLeave,
      },
    };
  },
  props: ["textInputPlaceholder"],
  components: {
    RightArrowSvg,
  },
  computed: {
    isLexProcessing() {
      return this.$store.state.lex.isProcessing;
    },
    isSendButtonDisabled() {
      return this.textInput.length < 1;
    },
    shouldShowSendButton() {
      return this.textInput.length && this.isTextFieldFocused;
    },
    shouldShowTextInput() {
      return true;
    },
    shouldShowUpload() {
      return false;
    },
  },
  methods: {
    onInputButtonHoverEnter() {
      this.shouldShowTooltip = true;
    },
    onInputButtonHoverLeave() {
      this.shouldShowTooltip = false;
    },
    onTextFieldFocus() {
      this.isTextFieldFocused = true;
    },
    onTextFieldBlur() {
      if (!this.textInput.length && this.isTextFieldFocused) {
        this.isTextFieldFocused = false;
      }
    },
    onKeyUp() {
      // nothing to do on keyUp currently
      // this.$store.dispatch("sendTypingEvent");
    },
    setInputTextFieldFocus() {
      // focus() needs to be wrapped in setTimeout for IE11
      setTimeout(() => {
        if (this.$refs && this.$refs.textInput && this.shouldShowTextInput) {
          this.$refs.textInput.$refs.input.focus();
        }
      }, 10);
    },
    postTextMessage() {
      this.onInputButtonHoverLeave();
      this.textInput = this.textInput.trim();
      // empty string
      if (!this.textInput.length) {
        return Promise.resolve();
      }

      const message = {
        type: "human",
        text: this.textInput,
      };

      return this.$store.dispatch("postTextMessage", message).then(() => {
        this.textInput = "";
        if (this.shouldShowTextInput) {
          this.setInputTextFieldFocus();
        }
      });
    },
  },
};
</script>
<style>
.chat-footer .v-toolbar__content {
  height: 120px !important;
  border-left: 4px solid black;
  border-bottom: 4px solid black;
  border-right: 4px solid black;
  border-radius: 0px 0px 20px 20px;
  box-shadow: unset !important;
}
.footer-toolbar {
  box-shadow: unset !important;
}

.theme--light.v-text-field--outline > .v-input__control > .v-input__slot {
  border-radius: 15px;
}

.input-container {
  /* make footer same height as dense toolbar */
  min-height: 100px;
  position: fixed;
  bottom: 100px;
  /* bottom: env(safe-area-inset-bottom); */
  left: 0;
  left: env(safe-area-inset-left);
  right: 0;
  right: env(safe-area-inset-right);
  margin-bottom: 5px;
}

.privacy-policy-link {
  z-index: 1000;
  padding-left: 5px;
  font-size: 12px;
}

.v-input__append-inner {
  margin-top: 0px !important;
}
.v-toolbar .v-input {
  margin-bottom: 10px !important;
}
/* .v-input input {
  max-height: unset !important;
}

.v-text-field--box input,
.v-text-field--full-width input,
.v-text-field--outline input {
  margin-top: 0px !important;
  max-height: 30px !important;
}

.v-text-field--outline > .v-input__control > .v-input__slot {
  align-items: stretch;
  min-height: 30px !important;
} */
</style>
