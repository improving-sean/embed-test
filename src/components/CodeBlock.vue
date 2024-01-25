<template>
  <pre v-if="formattedCode">
    <div class="code-block-header">
      <span class="language">{{ detectedLanguage }}</span>
      <div class="copy-code-container" @click="copyCode">
        <v-btn flat class="copy-btn" >
          <CopySvg right class="copy-icon" />
          <span class="copy-text">Copy</span>
        </v-btn>
      </div>
    </div>

    <code ref="codeBlock" v-html="formattedCode"></code>
  </pre>
</template>

<script>
import hljs from "highlight.js";
import CopySvg from "./CopySvg.vue";
// import "highlight.js/styles/github.css";
// style is included below for customization

export default {
  name: "CodeBlock",
  props: {
    code: {
      type: String,
      required: true,
    },
  },
  data() {
    return {
      formattedCode: "",
      detectedLanguage: "",
      defaultLanguage: "bash",
      codeBlockRegex: /^```(\w+)\s+|```$/g,
    };
  },
  mounted() {
    this.processCode(this.code);
  },
  computed: {
    codeWithoutBackticks() {
      // Remove the initial and final backticks and language specifier
      return this.code.replace(this.codeBlockRegex, "");
    },
  },
  methods: {
    processCode(codeBlock) {
      // Extract the language
      const language = this.extractLanguage(codeBlock);

      // Validate the language against highlight.js
      if (hljs.getLanguage(language)) {
        this.detectedLanguage = language;
        this.highlightCode(this.codeWithoutBackticks, language);
      } else {
        // no lang detected, set default
        this.detectedLanguage = this.defaultLanguage;
        this.highlightCode(this.codeWithoutBackticks, this.defaultLanguage);
        console.warn(
          `The language "${language}" is not supported by highlight.js. defaulting to ${this.defaultLanguage}`
        );
      }
    },
    extractLanguage(codeBlock) {
      // Extract the language
      const languageMatch = codeBlock.match(/^```(\w+)/);
      const language =
        languageMatch && languageMatch[1]
          ? languageMatch[1]
          : this.defaultLanguage;

      return language;
    },
    async copyCode() {
      // Check if clipboard API is available
      if (!navigator.clipboard) {
        console.error("Clipboard API is not available.");
        return;
      }

      // Access the text from the code block
      const codeToCopy = this.$refs.codeBlock
        ? this.$refs.codeBlock.innerText
        : "";

      try {
        await navigator.clipboard.writeText(codeToCopy);
        console.log("Code copied to clipboard!");
      } catch (err) {
        console.error("Could not copy text: ", err);
      }
    },
    highlightCode(code, language) {
      // Highlight the code with the detected language
      this.formattedCode = hljs.highlight(code, { language }).value;
    },
  },
  components: { CopySvg },
};
</script>

<style>
@import url("https://fonts.googleapis.com/css2?family=Source+Code+Pro:wght@400;600&display=swap");
.copy-code-container {
  cursor: pointer;
  display: flex;
  align-items: center;
  flex-direction: row;
  height: 25px;
}
.code-block-header {
  display: flex;
  height: 40px;
  border-radius: 8px 8px 0px 0px;
  border-bottom: 2px solid black;
  padding: 0px 10px;
  flex-direction: row;
  background-color: white;
  align-items: center;
  justify-content: space-between;
}
.copy-icon {
  height: 20px;
}

.copy-btn {
  width: 85px;
}
.copy-text {
  padding-right: 5px;
}

pre {
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  margin: 15px 0px;
  border: 2px solid black;
}

code {
  font-family: "Source Code Pro", monospace;
  border-radius: 0px 0px 8px 8px !important;
  color: rgb(59, 59, 59);
  padding: 10px;
  background: #fff0db !important;
}
code::before {
  content: "";
  display: block;
  height: 0;
}

pre code.hljs {
  display: block;
  overflow-x: auto;
  padding: 1em;
}
code.hljs {
  padding: 3px 5px;
}
/*

*/
.hljs {
  background: #fff0db !important;
  color: rgb(59, 59, 59);
}
.hljs-comment,
.hljs-quote,
.hljs-variable {
  color: #8b9e73;
}
.hljs-keyword,
.hljs-selector-tag,
.hljs-built_in,
.hljs-name,
.hljs-tag {
  color: #585cc5;
}
.hljs-string,
.hljs-title,
.hljs-section,
.hljs-attribute,
.hljs-literal,
.hljs-template-tag,
.hljs-template-variable,
.hljs-type,
.hljs-addition {
  color: #a31515;
}
.hljs-deletion,
.hljs-selector-attr,
.hljs-selector-pseudo,
.hljs-meta {
  color: #2b91af;
}
.hljs-doctag {
  color: #808080;
}
.hljs-attr {
  color: #f00;
}
.hljs-symbol,
.hljs-bullet,
.hljs-link {
  color: #00b0e8;
}
.hljs-emphasis {
  font-style: italic;
}
.hljs-strong {
  font-weight: bold;
}
</style>
