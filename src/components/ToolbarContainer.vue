<template>
  <!-- eslint-disable max-len -->
  <v-toolbar
    v-bind:color="toolbarColor"
    app
    dark
    fixed
    height="100px"
    flat
    v-if="!isUiMinimized"
    v-on="toolbarClickHandler"
    v-bind:dense="this.$store.state.isRunningEmbedded && !isUiMinimized"
    v-bind:class="{ minimized: isUiMinimized }"
    class="chat-header-toolbar"
    style="padding: 0px 15px"
    aria-label="Toolbar with minimise chat window button and option chat back a step button"
  >
    <!-- eslint-enable max-len -->
    <img
      class="toolbar-image"
      v-if="toolbarLogo"
      v-bind:src="toolbarLogo"
      alt="logo"
      aria-hidden="true"
    />

    <v-toolbar-title
      class="hidden-xs-and-down title"
      v-on:click.stop="toggleChatSize"
      v-show="!isUiMinimized"
    >
      <h3>{{ toolbarTitle }}</h3>
    </v-toolbar-title>

    <v-spacer />

    <v-tooltip
      v-model="shouldShowTooltip"
      content-class="tooltip-custom"
      activator=".min-max-toggle"
      left
    >
      <span id="min-max-tooltip">{{ toolTipMinimize }}</span>
    </v-tooltip>

    <v-btn
      v-if="$store.state.isRunningEmbedded"
      v-on:click.stop="toggleChatSize"
      v-on="tooltipEventHandlers"
      class="min-max-toggle"
      icon
      v-bind:aria-label="isUiExpanded ? 'Shrink chat box.' : 'Expand chat box.'"
    >
      <ShrinkSvg v-if="isUiExpanded" class="toggle-icon" />
      <ExpandSvg v-else class="toggle-icon" />
    </v-btn>
  </v-toolbar>
</template>

<script>
import CBLogo from "@/components/CBLogo.vue";
import ShrinkSvg from "@/components/ShrinkSvg.vue";
import ExpandSvg from "@/components/ExpandSvg.vue";

export default {
  name: "toolbar-container",
  data() {
    return {
      shouldShowTooltip: false,
      tooltipEventHandlers: {
        mouseenter: this.onInputButtonHoverEnter,
        mouseleave: this.onInputButtonHoverLeave,
        touchstart: this.onInputButtonHoverEnter,
        touchend: this.onInputButtonHoverLeave,
        touchcancel: this.onInputButtonHoverLeave,
      },
    };
  },
  components: {
    CBLogo,
    ShrinkSvg,
    ExpandSvg,
  },
  props: [
    "toolbarTitle",
    "toolbarColor",
    "toolbarLogo",
    "isUiMinimized",
    "isUiExpanded",
    "userName",
  ],
  computed: {
    toolbarClickHandler() {
      return { click: this.toggleChatSize };
    },
    toolTipMinimize() {
      return this.isUiExpanded ? "Shrink" : "Expand";
    },
    isLexProcessing() {
      return (
        this.$store.state.isBackProcessing || this.$store.state.lex.isProcessing
      );
    },
  },
  methods: {
    onInputButtonHoverEnter() {
      this.shouldShowTooltip = !this.isUiMinimized;
    },
    onInputButtonHoverLeave() {
      this.shouldShowTooltip = false;
    },
    toggleChatSize() {
      if (this.$store.state.isRunningEmbedded) {
        this.onInputButtonHoverLeave();
        this.$store.dispatch("toggleIsUiExpanded");
      }
    },
  },
};
</script>
<style scoped>
.toolbar-image {
  margin-left: 10px !important;
  margin-right: 0px !important;
  max-height: 40%;
}

.v-toolbar__title {
  margin-left: 10px !important;
}

.toggle-icon {
  color: white !important;
  fill: white;
}
</style>

<!-- Copyright 2017-2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
Licensed under the Amazon Software License (the "License"). You may not use this
file except in compliance with the License. A copy of the License is located at
http://aws.amazon.com/asl/ or in the "license" file accompanying this file. This
file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, express or implied. See the License for the specific language governing
permissions and limitations under the License.  -->
