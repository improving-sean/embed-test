<template>
  <div aria-live="polite" class="layout message-list column fill-height">
    <message
      ref="messages"
      v-for="message in messages"
      v-bind:message="message"
      v-bind:key="message.id"
      v-bind:class="`message-${message.type}`"
      v-on:scrollDown="scrollDown"
    ></message>
    <MessageLoading v-if="loading"></MessageLoading>
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
import Message from "./Message";
import MessageLoading from "./MessageLoading";

export default {
  name: "message-list",
  components: {
    Message,
    MessageLoading,
  },
  computed: {
    messages() {
      return this.$store.state.messages;
    },
    loading() {
      return this.$store.state.lex.isProcessing;
    },
  },
  watch: {
    // autoscroll message list to the bottom when messages change
    messages() {
      this.scrollDown();
    },
    loading() {
      this.scrollDown();
    },
  },
  mounted() {
    setTimeout(() => {
      this.scrollDown();
    }, 1000);
  },
  methods: {
    scrollDown() {
      return this.$nextTick(() => {
        if (this.$el.lastElementChild) {
          const lastMessageHeight =
            this.$el.lastElementChild.getBoundingClientRect().height;
          const isLastMessageLoading =
            this.$el.lastElementChild.classList.contains("messsge-loading");
          if (isLastMessageLoading) {
            this.$el.scrollTop = this.$el.scrollHeight;
          } else {
            this.$el.scrollTop = this.$el.scrollHeight - lastMessageHeight;
          }
        }
      });
    },
  },
};
</script>

<style scoped>
.message-list {
  background-color: #fefefe;
  border: 4px solid black;
  border-bottom: unset;
  padding-top: 1rem;
  overflow-y: auto;
  overflow-x: hidden;
}

.message-bot {
  align-self: flex-start;
}

.message-agent {
  align-self: flex-start;
}

.message-human {
  align-self: flex-end;
}

.message-feedback {
  align-self: flex-end;
}
</style>
