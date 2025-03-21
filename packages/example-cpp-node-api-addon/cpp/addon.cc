#include <napi.h>

Napi::String GetWorld(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  return Napi::String::New(env, "world");
}

Napi::Object InitCppExample(Napi::Env env, Napi::Object exports) {
  exports.Set(
    Napi::String::New(env, "HelloWorld"),
    Napi::Function::New(env, GetWorld)
  );
  return exports;
}

NODE_API_MODULE(addon, InitCppExample)
