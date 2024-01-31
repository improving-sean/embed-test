<template>
  <v-container fluid class="min-button-container">
    <!-- Message Bubble -->
    <div v-if="showMessageBubble" class="cta-bubble">
      <span style="">Ask me about Couchbase!</span>
      <button @click="closeMessageBubble">x</button>
    </div>

    <v-tooltip
      v-model="shouldShowTooltip"
      content-class="tooltip-min-button"
      activator=".min-button"
      left
    >
      <span id="min-button-tooltip">{{ minButtonToolTipContent }}</span>
    </v-tooltip>
    <v-fab-transition>
      <v-btn
        bottom
        dark
        depressed
        fab
        fixed
        right
        color="black"
        v-on:click.stop="toggleMinimize"
        v-on="tooltipEventHandlers"
        aria-label="show chat window"
        class="min-button"
      >
        <CBLogo v-if="isUiMinimized" />
        <!-- TODO: Replace V with chevron vector -->
        <ChevronDownSvg v-else />
      </v-btn>
    </v-fab-transition>
  </v-container>
</template>

<script>
/*
Copyright 2017-2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.

Licensed under the Amazon Software License (the "License"). You may not use this file
except in compliance with the License. A copy of the License is located at

http://aws.amazon.com/asl/

or in the "license" file accompanying this file. This file is distributed on an "AS IS"
BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, express or implied. See the
License for the specific language governing permissions and limitations under the License.
*/
import CBLogo from "@/components/CBLogo.vue";
import ChevronDownSvg from "@/components/ChevronDownSvg.vue";

export default {
  name: "min-button",
  components: {
    CBLogo,
    ChevronDownSvg,
  },
  data() {
    return {
      shouldShowTooltip: false,
      showMessageBubble: false,
      tooltipEventHandlers: {
        mouseenter: this.onInputButtonHoverEnter,
        mouseleave: this.onInputButtonHoverLeave,
        touchstart: this.onInputButtonHoverEnter,
        touchend: this.onInputButtonHoverLeave,
        touchcancel: this.onInputButtonHoverLeave,
      },
    };
  },
  props: ["toolbarColor", "isUiMinimized"],
  mounted() {
    if (!sessionStorage.getItem("bubbleClosed")) {
      setTimeout(() => {
        // Check again, incase user clicked button within 5 seconds
        if (!sessionStorage.getItem("bubbleClosed")) {
          this.showMessageBubble = true;
        }
      }, 5000);
    }
  },
  computed: {
    minButtonContent() {
      const n = this.$store.state.config.ui.minButtonContent.length;
      return n > 1 ? this.$store.state.config.ui.minButtonContent : false;
    },
    minButtonToolTipContent() {
      return this.isUiMinimized ? "Show chat." : "Hide chat.";
    },
  },
  methods: {
    onInputButtonHoverEnter() {
      this.shouldShowTooltip = true;
    },
    onInputButtonHoverLeave() {
      this.shouldShowTooltip = false;
    },
    toggleMinimize() {
      if (this.isUiMinimized) {
        this.closeMessageBubble();
      }
      if (this.$store.state.isRunningEmbedded) {
        this.onInputButtonHoverLeave();
        this.$emit("toggleMinimizeUi");
      }
    },
    closeMessageBubble() {
      this.showMessageBubble = false;
      sessionStorage.setItem("bubbleClosed", "true");
    },
  },
};
</script>
<style>
.min-button-content {
  border-radius: 60px;
}

.cta-bubble {
  position: fixed;
  bottom: 90px; /* Adjust based on FAB button position */
  right: 20px;
  padding: 10px;
  background-color: white;
  border: 1px solid gray;
  border-radius: 8px;
  /* box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2); */
  z-index: 10; /* Ensure it's above other elements */
  width: 200px;
}
.cta-bubble::before {
  content: "";
  position: absolute;
  top: calc(100% - 4px);
  right: 19px;
  height: 10px;
  width: 10px;
  background: white;
  transform: rotate(45deg);
  border-bottom: inherit;
  border-right: inherit;
  z-index: 9;
}
.cta-bubble button {
  position: absolute;
  top: -1px;
  right: 6px;
  font-size: 1.1em;
  border: none;
  background: none;
}
</style>
