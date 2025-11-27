# Breaking changes

## Pending release

### `reduce` lambda argument order

- **New behaviour:** `[{a:5},{a:6}] reduce ((accum, item) => accum + item.a)`
- **Old behaviour:** `[{a:5},{a:6}] reduce ((item, accum) => accum + item.a)`

The reducer callback now receives `(accum, item, index)` (accumulator first, current value second) to match common functional-programming conventions. Audit any `reduce` usage and swap the first two parameters in the lambda if necessary.
