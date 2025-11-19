using System.Collections;
using System.ComponentModel;
using System.Reflection;
using System.Text;

namespace FuncScript.Model
{
    public interface FsList:IEnumerable<object>
    {
        //public abstract  IEnumerable<object> Data { get; }
        public abstract object this[int index] { get; }
        public abstract int Length { get; }
        public abstract IEnumerator<object> GetEnumerator();

        public static bool Equals(FsList thisList, object obj)
        {
            if (obj == null || thisList.GetType() != obj.GetType())
            {
                return false;
            }
            var other = (FsList)obj;
            var otherData = other.ToArray();
            var thisData = thisList.ToArray();
            if (otherData.Length != thisData.Length)
                return false;
            for(int i=0;i<otherData.Length;i++)
            {
                var val1 = thisData[i];
                var val2 = otherData[i];
                if (val1==null && val2==null)
                    return true;
                if (val1 == null || val2 == null)
                    return false;
                if (!val1.Equals(val2))
                    return false;
            }
            return true;
        }
        public static string ToString(FsList thisList)
        {
            var sb = new StringBuilder();
            sb.Append("[");
            if (thisList.Any())
            {
                var first = true;
                foreach (var d in thisList)
                {
                    if (first)
                        first = false;
                    else
                        sb.Append(",");
                    if (d == null)
                        sb.Append("null");
                    else
                        sb.Append(d.ToString());

                }
            }
            sb.Append("]");
            return sb.ToString();
        }
        // override object.GetHashCode
        public static bool IsListType(Type t) =>
            t.IsAssignableTo(typeof(System.Collections.IEnumerable)) || t.IsAssignableTo(typeof(System.Collections.IList)) || IsGenericList(t);
        static bool IsGenericList(Type t)
        {
            return t != typeof(byte[]) && t.IsGenericType && (t.GetGenericTypeDefinition().IsAssignableTo(typeof(IList<>))
                || t.GetGenericTypeDefinition().IsAssignableTo(typeof(List<>)));
        }
        
    }

    public class ArrayFsList : FsList
    {
        object[] _data;
        public ArrayFsList(object data)
        {
            if (data == null)
                throw new Error.TypeMismatchError("Null can't be converted to list");
            else
            {
                var t = data.GetType();
                if(t.IsAssignableTo(typeof(System.Collections.IList)))
                {
                    var l = (System.Collections.IList)data;
                    _data = new object[l.Count];
                    for (int i = 0; i < l.Count; i++)
                        _data[i] = Engine.NormalizeDataType(l[i]);
                }
                else if (t.IsAssignableTo(typeof(System.Collections.IEnumerable)))
                {
                    var l = (System.Collections.IEnumerable)data;
                    var list = new List<object>();
                    foreach (var o in l)
                        list.Add(Engine.NormalizeDataType(o));
                    _data = list.ToArray();
                }
                else
                {
                    throw new Error.TypeMismatchError($"{t} can't be used as list");
                }
            }
        }
        public override int GetHashCode()
        {
            return this.GetHashCode();
        }

        IEnumerator IEnumerable.GetEnumerator()
        {
            return GetEnumerator();
        }


        public  object this[int index] => (index<0||index>=_data.Length)?null:_data[index];
        public int Length =>_data.Length;
        public  IEnumerator<object> GetEnumerator() => ((System.Collections.Generic.IEnumerable<object>)_data).GetEnumerator();
    }
}
