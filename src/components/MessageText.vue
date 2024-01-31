<template>
  <div v-if="messageIsHumanOrFeedback" class="message-text">
    <span class="sr-only">I say: </span>{{ message.text }}
  </div>

  <div
    v-else-if="altHtmlMessage && AllowSuperDangerousHTMLInMessage"
    v-html="altHtmlMessage"
    class="message-text"
  ></div>

  <div v-else-if="messageIsBotOrAgent" class="message-text bot-message-plain">
    <span class="sr-only">{{ message.type }} says: </span>
    <div v-for="(chunk, index) in messageChunks" :key="index">
      <!-- Render a CodeBlock component for code chunks -->
      <CodeBlock v-if="isCodeBlock(chunk)" :code="getCodeFromChunk(chunk)" />

      <span
        v-else-if="shouldRenderAsHtml"
        v-html="textMessageAsHtml(encodeAsHtml(chunk))"
      ></span>

      <!-- Render plain text for non-code chunks -->
      <span v-else>{{
        shouldStripTags ? stripTagsFromMessage(chunk) : chunk
      }}</span>
    </div>
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
const marked = require("marked");
import CodeBlock from "@/components/CodeBlock.vue";

const renderer = {};
renderer.link = function link(href, title, text) {
  return `<a href="${href}" title="${title}" target="_blank">${text}</a>`;
};
marked.use({ renderer });

export default {
  name: "message-text",
  props: ["message"],
  components: {
    CodeBlock,
  },
  data() {
    return {
      // Matches code blocks, capturing the content inside
      codeBlockRegex: /```(?:\s*\w+)?\s*([\s\S]*?)\s*```/g,
    };
  },
  computed: {
    messageText() {
      return this.message.text;
    },
    messageChunks() {
      const chunks = [];
      let lastIndex = 0;

      // Match all code blocks and split the text into chunks
      this.messageText.replace(this.codeBlockRegex, (match, code, offset) => {
        // Add the text before the code block
        chunks.push(this.messageText.slice(lastIndex, offset));
        // Add the code block
        chunks.push(match);
        lastIndex = offset + match.length;
      });

      // Add any remaining text after the last code block
      if (lastIndex < this.messageText.length) {
        chunks.push(this.messageText.slice(lastIndex));
      }

      return chunks;
    },
    shouldConvertUrlToLinks() {
      return true;
    },
    shouldStripTags() {
      return this.$store.state.config.ui.stripTagsFromBotMessages;
    },
    AllowSuperDangerousHTMLInMessage() {
      return this.$store.state.config.ui.AllowSuperDangerousHTMLInMessage;
    },
    altHtmlMessage() {
      let out = false;
      if (this.message.alts) {
        if (this.message.alts.html) {
          out = this.message.alts.html;
        } else if (this.message.alts.markdown) {
          out = marked.parse(this.message.alts.markdown);
        }
      }
      if (out) out = this.prependBotScreenReader(out);
      return out;
    },
    shouldRenderAsHtml() {
      return (
        ["bot", "agent"].includes(this.message.type) &&
        this.shouldConvertUrlToLinks
      );
    },
    botMessageAsHtml() {
      // Security Note: Make sure that the content is escaped according
      // to context (e.g. URL, HTML). This is rendered as HTML
      const messageWithLinks = this.botMessageWithLinks(messageText);
      const messageText = this.stripTagsFromMessage(this.message.text);
      const messageWithSR = this.prependBotScreenReader(messageWithLinks);
      return messageWithSR;
    },
    messageIsHumanOrFeedback() {
      return (
        this.message.text &&
        (this.message.type === "human" || this.message.type === "feedback")
      );
    },
    messageIsBotOrAgent() {
      return (
        this.message.text &&
        (this.message.type === "bot" || this.message.type === "agent")
      );
    },
  },
  methods: {
    encodeAsHtml(value) {
      return value
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, "<br>");
    },
    botMessageWithLinks(messageText) {
      const markdownRegex = new RegExp(
        "\\[([^\\[]+)\\]\\((https?://[^\\)]+)\\)",
        "gi"
      );

      // Use negative lookbehind to ensure that the URL is not part of an <a> tag
      const webRegex = new RegExp(
        "(?<!<a [^>]*href=[\"'])(https?://[\\w-]+(?:\\.[\\w-]+)+(?::\\d+)?(?:/[^\\s]*)?)",
        "ig"
      );

      // First, replace markdown links
      let processedMessage = messageText.replace(
        markdownRegex,
        (match, text, url) => {
          return `<a target="_blank" href="${encodeURI(
            url
          )}">${this.encodeAsHtml(text)}</a>`;
        }
      );

      // Then, replace web links that are not part of an existing <a> tag
      processedMessage = processedMessage.replace(webRegex, (match) => {
        const url = !/^https?:\/\//.test(match) ? `http://${match}` : match;
        return `<a target="_blank" href="${encodeURI(url)}">${this.encodeAsHtml(
          url
        )}</a>`;
      });

      return processedMessage;
    },

    // used for stripping SSML (and other) tags from bot responses
    stripTagsFromMessage(messageText) {
      const doc = document.implementation.createHTMLDocument("").body;
      doc.innerHTML = messageText;
      return doc.textContent || doc.innerText || "";
    },
    prependBotScreenReader(messageText) {
      return `<span class="sr-only">bot says: </span>${messageText}`;
    },
    isCodeBlock(chunk) {
      return this.codeBlockRegex.test(chunk);
    },
    getCodeFromChunk(chunk) {
      const matches = chunk.match(this.codeBlockRegex);
      return matches ? matches[0].trim() : "";
    },
    textMessageAsHtml(text) {
      // Security Note: Make sure that the content is escaped according
      // to context (e.g. URL, HTML). This is rendered as HTML
      // const messageText = this.stripTagsFromMessage(text);
      // return this.botMessageWithLinks(text);
      return this.botMessageWithLinks(text);
    },
  },
};
</script>

<style scoped>
.message-text {
  hyphens: auto;
  overflow-wrap: break-word;
  padding: 0.8em;
  white-space: normal;
  word-break: break-word;
  width: 100%;
}
</style>

<style>
.sr-only {
  position: absolute !important;
  width: 1px !important;
  height: 1px !important;
  padding: 0 !important;
  margin: -1px !important;
  overflow: hidden !important;
  clip: rect(1px, 1px, 1px, 1px) !important;
  clip-path: inset(50%) !important;
  white-space: nowrap !important;
  border: 0 !important;
}
</style>
