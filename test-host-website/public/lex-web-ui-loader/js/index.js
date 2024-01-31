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

/**
 * Entry point to the chatbot-ui-loader.js library
 * Exports the loader classes
 */

// import from lib
const IframeComponentLoader = require("./iframe-component-loader.js");

/**
 * Base class used by the full page and iframe loaders
 */
class Loader {
  /**
   * @param {object} options - options controlling how the dependencies and
   *   component configa are loaded
   */
  constructor(options) {
    const { baseUrl } = options;
    // polyfill needed for IE11
    // setCustomEventShim();
    this.options = options;

    // append a trailing slash if not present in the baseUrl
    this.options.baseUrl =
      this.options.baseUrl && baseUrl[baseUrl.length - 1] === "/"
        ? this.options.baseUrl
        : `${this.options.baseUrl}/`;
  }

  load(configParam = {}) {
    // merge empty constructor config and parameter config
    this.config = IframeComponentLoader.mergeConfig(this.config, configParam);

    // load dependencies
    return this.compLoader.load(this.config);
  }
}

/**
 * Class used to to dynamically load the chatbot ui in an iframe
 */
class IframeLoader extends Loader {
  /**
   * @param {object} options - options controlling how the dependencies and
   *   component config are loaded
   */
  constructor(options = {}) {
    super({ ...optionsIframe, ...options });

    // chatbot UI component config
    this.config = configBase;

    this.compLoader = new IframeComponentLoader({
      config: this.config,
      containerClass: this.options.containerClass || "lex-web-ui",
      elementId: this.options.elementId || "lex-web-ui",
    });
  }

  load(configParam = {}) {
    return super.load(configParam).then(() => {
      // assign API to this object to make calls more succint
      this.api = this.compLoader.api;
      // make sure iframe and iframeSrcPath are set to values if not
      // configured by standard mechanisms. At this point, default
      // values from ./defaults/loader.js will be used.
      this.config.iframe = this.config.iframe || {};
      this.config.iframe.iframeSrcPath =
        this.config.iframe.iframeSrcPath || this.mergeSrcPath(configParam);
    });
  }

  /**
   * Merges iframe src path from options and iframe config
   */
  mergeSrcPath(configParam) {
    const { iframe: iframeConfigFromParam } = configParam;
    const srcPathFromParam =
      iframeConfigFromParam && iframeConfigFromParam.iframeSrcPath;
    const { iframe: iframeConfigFromThis } = this.config;
    const srcPathFromThis =
      iframeConfigFromThis && iframeConfigFromThis.iframeSrcPath;

    return srcPathFromParam || this.options.iframeSrcPath || srcPathFromThis;
  }
}

/**
 * Default iframe specific loader options
 */
const options = {
  baseUrl: "/",
  configEventTimeoutInMs: 10000,
  configUrl: "./lex-web-ui-loader-config.json",
  shouldIgnoreConfigWhenEmbedded: true,
  shouldLoadConfigFromEvent: false,
  shouldLoadConfigFromJsonFile: true,
  shouldLoadMinDeps: false,
};
const optionsIframe = {
  ...options,

  // DOM element ID where the chatbot UI will be mounted
  elementId: "lex-web-ui-iframe",

  // div container class to insert iframe
  containerClass: "lex-web-ui-iframe",

  // iframe source path. this is appended to the iframeOrigin
  // must use the LexWebUiEmbed=true query string to enable embedded mode
  iframeSrcPath: "/index.html#/?lexWebUiEmbed=true",

  shouldLoadConfigFromEvent: true,
  shouldLoadMinDeps: false,
};

const configBase = {
  ui: { parentOrigin: "" },
  iframe: {
    iframeOrigin: "",
    iframeSrcPath: "",
  },
};

/**
 * chatbot loader library entry point
 */
const ChatBotUiLoader = {
  IframeLoader,
};

module.exports = ChatBotUiLoader;
