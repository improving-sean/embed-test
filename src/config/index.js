/*
 Copyright 2017-2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.

 Licensed under the Amazon Software License (the "License"). You may not use this file
 except in compliance with the License. A copy of the License is located at

 http://aws.amazon.com/asl/

 or in the "license" file accompanying this file. This file is distributed on an "AS IS"
 BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, express or implied. See the
 License for the specific language governing permissions and limitations under the License.
 */

/**
 * Application configuration management.
 * This file contains default config values and merges the environment
 * and URL configs.
 *
 * The environment dependent values are loaded from files
 * with the config.<ENV>.json naming syntax (where <ENV> is a NODE_ENV value
 * such as 'prod' or 'dev') located in the same directory as this file.
 *
 * The URL configuration is parsed from the `config` URL parameter as
 * a JSON object
 *
 * NOTE: To avoid having to manually merge future changes to this file, you
 * probably want to modify default values in the config.<ENV>.js files instead
 * of this one.
 */

/* eslint no-console: ["error", { allow: ["warn", "error"] }] */

// TODO turn this into a class

// get env shortname to require file
const envShortName = ["dev", "prod", "test"].find((env) =>
  process.env.NODE_ENV.startsWith(env)
);

if (!envShortName) {
  console.error("unknown environment in config: ", process.env.NODE_ENV);
}

// eslint-disable-next-line import/no-dynamic-require
const configEnvFile =
  process.env.BUILD_TARGET === "lib"
    ? {}
    : require(`./config.${envShortName}.json`);

// default config used to provide a base structure for
// environment and dynamic configs
const configDefault = {
  lex: {
    initialText:
      "How can I help you? Answers are powered by Al. Review all output before using. - Default",
    reInitSessionAttributesOnRestart: false,
    region: "us-east-1",
    retryOnLexPostTextTimeout: "false",
    retryCountPostTextTimeout: "1",
  },
  ui: {
    parentOrigin: "http://localhost:8000",
    toolbarTitle: "Couchbase",
    toolbarLogo:
      "https://www.couchbase.com/wp-content/uploads/sites/3/2023/10/SDKs_Ottoman.svg",
    positiveFeedbackIntent: "Thumbs up",
    negativeFeedbackIntent: "Thumbs down",
    helpIntent: "",
    enableLogin: false,
    forceLogin: false,
    AllowSuperDangerousHTMLInMessage: true,
    shouldDisplayResponseCardTitle: false,
    saveHistory: false,
    minButtonContent: "",
    hideInputFieldsForButtonResponse: false,
    pushInitialTextOnRestart: false,
    directFocusToBotInput: false,
    showDialogStateIcon: false,
    backButton: false,
    messageMenu: true,
    hideButtonMessageBubble: false,
    enableLiveChat: false,
  },
  iframe: {
    iframeOrigin: "http://localhost:8080",
    shouldLoadIframeMinimized: true,
    iframeSrcPath: "/#/?lexWebUiEmbed=true",
  },
};

/**
 * Obtains the URL query params and returns it as an object
 * This can be used before the router has been setup
 */
function getUrlQueryParams(url) {
  try {
    return (
      url
        .split("?", 2) // split query string up to a max of 2 elems
        .slice(1, 2) // grab what's after the '?' char
        // split params separated by '&'
        .reduce((params, queryString) => queryString.split("&"), [])
        // further split into key value pairs separated by '='
        .map((params) => params.split("="))
        // turn into an object representing the URL query key/vals
        .reduce((queryObj, param) => {
          const [key, value = true] = param;
          const paramObj = {
            [key]: decodeURIComponent(value),
          };
          return { ...queryObj, ...paramObj };
        }, {})
    );
  } catch (e) {
    console.error("error obtaining URL query parameters", e);
    return {};
  }
}

/**
 * Obtains and parses the config URL parameter
 */
function getConfigFromQuery(query) {
  try {
    return query.lexWebUiConfig ? JSON.parse(query.lexWebUiConfig) : {};
  } catch (e) {
    console.error("error parsing config from URL query", e);
    return {};
  }
}

/**
 * Merge two configuration objects
 * The merge process takes the base config as the source for keys to be merged.
 * The values in srcConfig take precedence in the merge.
 *
 * If deep is set to false (default), a shallow merge is done down to the
 * second level of the object. Object values under the second level fully
 * overwrite the base. For example, srcConfig.lex.sessionAttributes overwrite
 * the base as an object.
 *
 * If deep is set to true, the merge is done recursively in both directions.
 */
export function mergeConfig(baseConfig, srcConfig, deep = false) {
  function mergeValue(base, src, key, shouldMergeDeep) {
    // nothing to merge as the base key is not found in the src
    if (!(key in src)) {
      return base[key];
    }

    // deep merge in both directions using recursion
    if (shouldMergeDeep && typeof base[key] === "object") {
      return {
        ...mergeConfig(src[key], base[key], shouldMergeDeep),
        ...mergeConfig(base[key], src[key], shouldMergeDeep),
      };
    }

    // shallow merge key/values
    // overriding the base values with the ones from the source
    return typeof base[key] === "object"
      ? { ...base[key], ...src[key] }
      : src[key];
  }

  // use the baseConfig first level keys as the base for merging
  return (
    Object.keys(baseConfig)
      .map((key) => {
        const value = mergeValue(baseConfig, srcConfig, key, deep);
        return { [key]: value };
      })
      // merge key values back into a single object
      .reduce((merged, configItem) => ({ ...merged, ...configItem }), {})
  );
}

// merge build time parameters
const configFromFiles = mergeConfig(configDefault, configEnvFile);

// TODO move query config to a store action
// run time config from url query parameter
const queryParams = getUrlQueryParams(window.location.href);
const configFromQuery = getConfigFromQuery(queryParams);
// security: delete origin from dynamic parameter
if (configFromQuery.ui && configFromQuery.ui.parentOrigin) {
  delete configFromQuery.ui.parentOrigin;
}

const configFromMerge = mergeConfig(configFromFiles, configFromQuery);

export const config = {
  ...configFromMerge,
  urlQueryParams: queryParams,
};
