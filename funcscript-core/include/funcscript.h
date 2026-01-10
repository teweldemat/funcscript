// FuncScript core C API (stable ABI surface)
//
// Ownership:
// - Any `char*` returned via out params is owned by FuncScript and must be freed with `fs_free_string`.
// - Any `FsErrorC.message` must be freed with `fs_error_free` (or `fs_free_string` on the message pointer).
//
// Threading:
// - `FsVm*` is not thread-safe. Use one VM per thread or add external synchronization.

#ifndef FUNCSCRIPT_CORE_H
#define FUNCSCRIPT_CORE_H

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct FsVm FsVm;

typedef struct FsValue {
  uint64_t id;
} FsValue;

typedef struct FsErrorC {
  uint32_t code;
  int32_t line;
  int32_t column;
  char* message;
} FsErrorC;

typedef void (*FsHostWriteFn)(void* ctx, const uint8_t* bytes, uint64_t len);

typedef struct FsHostCallbacks {
  void* user_data;

  int32_t (*file_read_text)(void* user_data, const char* path, void* out_ctx, FsHostWriteFn out_write, FsErrorC* out_error);

  int32_t (*file_exists)(void* user_data, const char* path, int32_t* out_exists, FsErrorC* out_error);
  int32_t (*is_file)(void* user_data, const char* path, int32_t* out_is_file, FsErrorC* out_error);

  int32_t (*dir_list)(void* user_data, const char* path, void* out_ctx, FsHostWriteFn out_write, FsErrorC* out_error);

  void (*log_line)(void* user_data, const char* text);
} FsHostCallbacks;

extern const uint32_t FS_CORE_ABI_VERSION;

extern const uint32_t FS_VALUE_NIL;
extern const uint32_t FS_VALUE_BOOL;
extern const uint32_t FS_VALUE_NUMBER;
extern const uint32_t FS_VALUE_INT;
extern const uint32_t FS_VALUE_BIGINT;
extern const uint32_t FS_VALUE_BYTES;
extern const uint32_t FS_VALUE_GUID;
extern const uint32_t FS_VALUE_DATETIME;
extern const uint32_t FS_VALUE_STRING;
extern const uint32_t FS_VALUE_LIST;
extern const uint32_t FS_VALUE_KVC;
extern const uint32_t FS_VALUE_RANGE;
extern const uint32_t FS_VALUE_FUNCTION;
extern const uint32_t FS_VALUE_NATIVE;
extern const uint32_t FS_VALUE_ERROR;

FsVm* fs_vm_new(void);
void fs_vm_free(FsVm* vm);


int32_t fs_vm_set_host_callbacks(FsVm* vm, const FsHostCallbacks* callbacks);

int32_t fs_vm_eval(FsVm* vm, const char* source, char** out_json, FsErrorC* out_error);

int32_t fs_vm_eval_value(FsVm* vm, const char* source, FsValue* out_value, FsErrorC* out_error);
int32_t fs_vm_value_free(FsVm* vm, FsValue value);
uint32_t fs_vm_value_type(FsVm* vm, FsValue value);
int32_t fs_vm_value_to_json(FsVm* vm, FsValue value, char** out_json, FsErrorC* out_error);

int32_t fs_vm_value_len(FsVm* vm, FsValue value, uint64_t* out_len, FsErrorC* out_error);
int32_t fs_vm_value_index(FsVm* vm, FsValue receiver, int64_t index, FsValue* out_value, FsErrorC* out_error);
int32_t fs_vm_value_get_key(FsVm* vm, FsValue receiver, const char* key, FsValue* out_value, FsErrorC* out_error);
int32_t fs_vm_value_keys_json(FsVm* vm, FsValue receiver, char** out_json, FsErrorC* out_error);
int32_t fs_vm_value_range_info(FsVm* vm, FsValue value, int64_t* out_start, uint64_t* out_count, FsErrorC* out_error);

int32_t fs_vm_value_call(FsVm* vm, FsValue callee, uint64_t argc, const FsValue* argv, FsValue* out_value, FsErrorC* out_error);

char* fs_eval_json(const char* source);
void fs_free_string(char* ptr);
void fs_error_free(FsErrorC* err);

#ifdef __cplusplus
}
#endif

#endif
