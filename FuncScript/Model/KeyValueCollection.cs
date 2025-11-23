using System.Collections;
using System.Collections.Specialized;
using System.Linq;
using FuncScript.Core;

namespace FuncScript.Model
{

    public interface  KeyValueCollection
    {
        public object Get(string key);
        public KeyValueCollection ParentProvider { get; }
        public bool IsDefined(string key);
        
        
        public T ConvertTo<T>()
        {
            return Newtonsoft.Json.JsonConvert.DeserializeObject<T>(Engine.FormatToJson(this));
        }
        public object ConvertTo(Type t)
        {
            var json = Engine.FormatToJson(this);
            return Newtonsoft.Json.JsonConvert.DeserializeObject(json,t);
        }
        public abstract IList<KeyValuePair<String, object>> GetAll();
        public static bool Equals( KeyValueCollection thisKvc, object otherkv)
        {
            var other = otherkv as KeyValueCollection;
            if (other == null)
                return false;
            foreach(var k in other.GetAll())
            {
                if (!thisKvc.IsDefined(k.Key.ToLowerInvariant()))
                    return false;
                var thisVal= thisKvc.Get(k.Key);
                var otherVal= other.Get(k.Key);
                if (thisVal == null && otherVal == null)
                    return true;
                if (thisVal == null || otherVal == null)
                    return false;
                if (!thisVal.Equals(otherVal))
                    return false;
            }
            return true;
        }
        
        static KeyValueCollection NormalizeForMerge(KeyValueCollection col)
        {
            if (col == null)
                return null;

            if (col.ParentProvider == null)
                return col;

            var normalized = col.GetAll()
                .Select(kv => KeyValuePair.Create(kv.Key, kv.Value))
                .ToArray();

            return new SimpleKeyValueCollection(null, normalized);
        }

        public static KeyValueCollection Merge(KeyValueCollection col1,KeyValueCollection col2)
        {
            col1 = NormalizeForMerge(col1);
            col2 = NormalizeForMerge(col2);

            if (col1 == null && col2 == null)
                return null;
            if (col1 == null)
                return col2;
            if (col2 == null)
                return col1;
            var dict = new OrderedDictionary();
            foreach (var kv in col1.GetAll())
                dict[kv.Key] = kv.Value;
            foreach (var kv in col2.GetAll())
            {
                if(dict.Contains(kv.Key))
                {
                    var left = dict[kv.Key] as KeyValueCollection;
                    if (left != null && kv.Value is KeyValueCollection)
                    {
                        dict[kv.Key] = KeyValueCollection.Merge(left,(KeyValueCollection)kv.Value);
                    }
                    else
                        dict[kv.Key] = kv.Value;
                }
                else
                    dict.Add(kv.Key,kv.Value);
            }
            var kvs = new KeyValuePair<string, object>[dict.Count];
            var en = (IDictionaryEnumerator)dict.GetEnumerator();
            int k = 0;
            while (en.MoveNext())
            {
                kvs[k] = new KeyValuePair<string, object>((string)en.Key, en.Value);
                k++;
            }

            if (col1.ParentProvider != col2.ParentProvider)
                return new SimpleKeyValueCollection(null, new[]
                {
                    new KeyValuePair<string, object>(string.Empty,
                        new FsError(FsError.ERROR_TYPE_INVALID_PARAMETER,
                            "Key value collections from different contexts can't be merged"))
                });
            return new SimpleKeyValueCollection(col1.ParentProvider,kvs);
        }
        public static int GetHashCode(KeyValueCollection kvc)
        {
            int hash = 0;
            foreach(var kv in kvc.GetAll())
            {
                var thisHash = kv.Value == null ? kv.Key.GetHashCode() : HashCode.Combine(kv.Key.GetHashCode(), kv.Value.GetHashCode());
                if (hash == 0)
                    hash = thisHash;
                else
                    hash = HashCode.Combine(hash, thisHash);
            }
            return hash;
        }
    }
}
