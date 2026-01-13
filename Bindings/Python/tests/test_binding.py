import unittest
import uuid
import datetime

from funcscript import FsError, FsFunction, FsObject, FsList, FsRange, FsVm, eval as fs_eval, to_fs_literal


class FuncScriptCorePythonBindingTests(unittest.TestCase):
    def test_eval_number(self) -> None:
        self.assertEqual(fs_eval("1+2"), 3)

    def test_eval_string(self) -> None:
        self.assertEqual(fs_eval('"a" + "b"'), "ab")
        self.assertEqual(fs_eval('3 + "cool"'), "3cool")
        self.assertEqual(fs_eval('"cool" + 4'), "cool4")

    def test_compile_error_has_location(self) -> None:
        vm = FsVm()
        try:
            with self.assertRaises(FsError) as ctx:
                vm.eval("If(true, 1, )")
            err = ctx.exception
            self.assertEqual(err.code, 1000)
            self.assertEqual(err.line, 1)
            self.assertGreaterEqual(err.column, 1)
        finally:
            vm.close()

    def test_value_error_propagates(self) -> None:
        vm = FsVm()
        try:
            with self.assertRaises(FsError) as ctx:
                vm.eval("Range(1, -1)")
            err = ctx.exception
            self.assertEqual(err.code, 1)
        finally:
            vm.close()

    def test_range_converts_to_python_iterable(self) -> None:
        vm = FsVm()
        try:
            r = vm.eval("Range(3, 4)")
            self.assertIsInstance(r, FsRange)
            self.assertEqual(list(r), [3, 4, 5, 6])
            self.assertEqual(r[0], 3)
            self.assertEqual(r[-1], 6)
        finally:
            vm.close()

    def test_to_fs_literal_and_call(self) -> None:
        vm = FsVm()
        try:
            self.assertEqual(to_fs_literal([1, 2, 3]), "[1,2,3]")
            self.assertEqual(to_fs_literal({"a": 1, "b": [2, 3]}), "{a:1,b:[2,3]}")
            self.assertEqual(vm.call("(x)=>x+1", 2), 3)
            self.assertEqual(vm.call("(x,y)=>x*y", 3, 4), 12)
        finally:
            vm.close()

    def test_returned_function_is_callable_in_python(self) -> None:
        vm = FsVm()
        try:
            fn = vm.eval("(x)=>x+1")
            self.assertIsInstance(fn, FsFunction)
            self.assertEqual(fn(2), 3)
        finally:
            vm.close()

    def test_list_and_object_wrappers(self) -> None:
        vm = FsVm()
        try:
            lst = vm.eval("[1,2,3]")
            self.assertIsInstance(lst, FsList)
            self.assertEqual(len(lst), 3)
            self.assertEqual(lst[1], 2)
            self.assertEqual(list(lst), [1, 2, 3])

            obj = vm.eval("{a:1,b:2}")
            self.assertIsInstance(obj, FsObject)
            self.assertEqual(sorted(obj.keys()), ["a", "b"])
            self.assertEqual(obj["a"], 1)
        finally:
            vm.close()

    def test_bigint_sum_is_exact(self) -> None:
        vm = FsVm()
        try:
            v = vm.eval("Sum(Range(1, 1000000000))")
            self.assertIsInstance(v, int)
            self.assertEqual(v, 500000000500000000)
        finally:
            vm.close()

    def test_change_type_guid_datetime_and_bytearray(self) -> None:
        vm = FsVm()
        try:
            g = vm.eval("ChangeType('00000000-0000-0000-0000-000000000000','Guid')")
            self.assertEqual(g, uuid.UUID(int=0))

            ticks = 637134336000000000
            dt = vm.eval(f"ChangeType({ticks}l,'DateTime')")
            self.assertIsInstance(dt, datetime.datetime)

            b = vm.eval("ChangeType('AQID','ByteArray')")
            self.assertEqual(b, b"\x01\x02\x03")
        finally:
            vm.close()


if __name__ == "__main__":
    unittest.main()

