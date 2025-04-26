module.exports = {
  "1-getting-started": {
    "1_hello_world": () => require("./examples/1-getting-started/1_hello_world/napi/hello.js"),
    "2_function_arguments": () => require("./examples/1-getting-started/2_function_arguments/napi/addon.js"),
    "3_callbacks": () => require("./examples/1-getting-started/3_callbacks/napi/addon.js"),
    "4_object_factory": () => require("./examples/1-getting-started/4_object_factory/napi/addon.js"),
    "5_function_factory": () => require("./examples/1-getting-started/5_function_factory/napi/addon.js"),
  },
  "5-async-work": {
    // TODO: This crashes (SIGABRT)
    "async_work_thread_safe_function": () => require("./examples/5-async-work/async_work_thread_safe_function/napi/index.js"),
  }
};
