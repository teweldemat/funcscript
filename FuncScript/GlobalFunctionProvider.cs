using FuncScript.Core;
using FuncScript.Model;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Text;
using System.Threading.Tasks;

namespace FuncScript
{
    public class DefaultFsDataProvider : KeyValueCollection
    {
        static readonly Dictionary<string, IFsFunction> s_funcByName = new Dictionary<string, IFsFunction>();
        static readonly Dictionary<string, Dictionary<string, object>> s_providerCollections = new Dictionary<string, Dictionary<string, object>>(StringComparer.OrdinalIgnoreCase);
        private static readonly object s_registryLock = new object();
        static DefaultFsDataProvider()
        {
            LoadFromAssembly(Assembly.GetExecutingAssembly()); //always load builtin functions. May be we don't need this
        }
        public bool IsDefined(string key, bool hierarchy = true)
        {
            if (key == null)
                return false;
            var normalized = key.ToLowerInvariant();
            if (_data != null && _data.ContainsKey(normalized))
                return true;
            lock (s_registryLock)
            {
                if (s_funcByName.ContainsKey(normalized))
                    return true;
                if (s_providerCollections.ContainsKey(normalized))
                    return true;
            }
            return false;
        }

        public IList<KeyValuePair<string, object>> GetAll()
        {
            if (_data == null || _data.Count == 0)
                return Array.Empty<KeyValuePair<string, object>>();

            var list = new List<KeyValuePair<string, object>>(_data.Count);
            foreach (var kv in _data)
            {
                list.Add(new KeyValuePair<string, object>(kv.Key, Get(kv.Key)));
            }
            return list;
        }

        public IList<string> GetAllKeys()
        {
            var keys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            if (_data != null && _data.Count > 0)
            {
                keys.UnionWith(_data.Keys);
            }

            lock (s_registryLock)
            {
                keys.UnionWith(s_funcByName.Keys);
                keys.UnionWith(s_providerCollections.Keys);
            }

            if (keys.Count == 0)
            {
                return Array.Empty<string>();
            }

            return keys.ToArray();
        }

        public static void LoadFromAssembly(Assembly a)
        {
            foreach (var t in a.GetTypes())
            {
                if (t.GetInterface(nameof(IFsFunction)) != null)
                {
                    if (t.GetConstructor(Type.EmptyTypes) != null) //load only functions with default constructor
                    {
                        var f = Activator.CreateInstance(t) as IFsFunction;
                        var registeredNames = new List<string>();

                        var lowerSymbol = f.Symbol.ToLowerInvariant();
                        lock (s_registryLock)
                        {
                            if (!s_funcByName.TryAdd(lowerSymbol, f))
                                throw new Exception($"{f.Symbol} already defined");
                        }
                        registeredNames.Add(f.Symbol);

                        var alias = t.GetCustomAttribute<FunctionAliasAttribute>();
                        if (alias != null)
                        {
                            foreach (var al in alias.Aliaces ?? Array.Empty<string>())
                            {
                                if (string.IsNullOrWhiteSpace(al))
                                    continue;
                                var normalizedAlias = al.ToLowerInvariant();
                                lock (s_registryLock)
                                {
                                    if (!s_funcByName.TryAdd(normalizedAlias, f))
                                        throw new Exception($"{f.Symbol} already defined");
                                }
                                registeredNames.Add(al);
                            }

                        }
                        foreach (var providerAttribute in t.GetCustomAttributes<ProviderCollectionAttribute>() ?? Array.Empty<ProviderCollectionAttribute>())
                        {
                            RegisterProviderCollections(providerAttribute, registeredNames, f);
                        }
                    }
                }

                RegisterConstantsDefinedOnType(t);
            }
        }
        Dictionary<string, object> _data;
        public DefaultFsDataProvider()
        {
            _data = null;
        }
        public DefaultFsDataProvider(IList<KeyValuePair<string, object>> data)
        {
            _data = new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase);
            foreach (var k in data)
            {
                if (k.Value is Func<object>)
                    _data.Add(k.Key, k.Value);
                else
                    _data.Add(k.Key, Engine.NormalizeDataType(k.Value));
            }
        }
        public object Get(string name)
        {
            if (name == null)
                return null;
            var normalized = name.ToLowerInvariant();
            if (_data != null)
            {
                if (_data.TryGetValue(normalized, out var v))
                {
                    if (v is Func<object>)
                    {
                        v = ((Func<object>)v)();
                        _data[normalized] = v;
                    }
                    return v;
                }
            }
            IFsFunction ret;
            lock (s_registryLock)
            {
                s_funcByName.TryGetValue(normalized, out ret);
            }
            if (ret != null)
            {
                return ret;
            }

            KeyValuePair<string, object>[] providerSnapshot = null;
            lock (s_registryLock)
            {
                if (s_providerCollections.TryGetValue(normalized, out var providerMembers))
                {
                    providerSnapshot = providerMembers.ToArray();
                }
            }

            if (providerSnapshot != null)
            {
                var pairs = providerSnapshot
                    .OrderBy(kvp => kvp.Key, StringComparer.OrdinalIgnoreCase)
                    .Select(kvp => new KeyValuePair<string, object>(kvp.Key, kvp.Value))
                    .ToArray();
                return new SimpleKeyValueCollection(this, pairs);
            }
            return null;
        }

        public KeyValueCollection ParentProvider { get; }

        static void RegisterProviderCollections(ProviderCollectionAttribute attribute, IList<string> names, object member)
        {
            lock (s_registryLock)
            {
                foreach (var collectionName in attribute.CollectionNames)
                {
                    if (string.IsNullOrWhiteSpace(collectionName))
                        continue;

                    var normalizedCollection = collectionName.ToLowerInvariant();
                    if (!s_providerCollections.TryGetValue(normalizedCollection, out var members))
                    {
                        members = new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase);
                        s_providerCollections[normalizedCollection] = members;
                    }

                    var collectionNames = names
                        .Concat(attribute.MemberNames ?? Array.Empty<string>());

                    foreach (var name in collectionNames)
                    {
                        if (string.IsNullOrWhiteSpace(name))
                            continue;

                        if (!members.TryAdd(name, member))
                        {
                            if (!ReferenceEquals(members[name], member))
                                throw new Exception($"{name} already defined in provider collection '{collectionName}'");
                        }
                    }
                }
            }
        }

        static void RegisterCollectionMember(string collectionName, string memberName, object value)
        {
            if (string.IsNullOrWhiteSpace(collectionName) || string.IsNullOrWhiteSpace(memberName))
                return;

            lock (s_registryLock)
            {
                var normalizedCollection = collectionName.ToLowerInvariant();
                if (!s_providerCollections.TryGetValue(normalizedCollection, out var members))
                {
                    members = new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase);
                    s_providerCollections[normalizedCollection] = members;
                }

                if (!members.TryAdd(memberName, value))
                {
                    var existing = members[memberName];
                    if (!ReferenceEquals(existing, value) && !(existing?.Equals(value) ?? value is null))
                        throw new Exception($"{memberName} already defined in provider collection '{collectionName}'");
                }
            }
        }

        static void RegisterConstantsDefinedOnType(Type type)
        {
            var collectionAttributes = type.GetCustomAttributes<FsConstantAttribute>()?.ToArray();
            if (collectionAttributes == null || collectionAttributes.Length == 0)
                return;

            var collectionNames = collectionAttributes
                .Select(attr => attr.Name)
                .Where(name => !string.IsNullOrWhiteSpace(name))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToArray();

            if (collectionNames.Length == 0)
                return;

            const BindingFlags flags = BindingFlags.Public | BindingFlags.Static | BindingFlags.FlattenHierarchy;
            foreach (var member in type.GetMembers(flags))
            {
                var constantAttribute = member.GetCustomAttribute<FsConstantAttribute>();
                if (constantAttribute == null)
                    continue;

                if (string.IsNullOrWhiteSpace(constantAttribute.Name))
                    continue;

                object value = member switch
                {
                    FieldInfo fieldInfo => fieldInfo.GetValue(null),
                    PropertyInfo propertyInfo when propertyInfo.GetMethod != null && propertyInfo.GetMethod.IsStatic => propertyInfo.GetValue(null),
                    _ => throw new InvalidOperationException($"Member '{member.Name}' on '{type.FullName}' must be a static field or property to use FsConstantAttribute.")
                };

                foreach (var collectionName in collectionNames)
                    RegisterCollectionMember(collectionName, constantAttribute.Name, value);
            }
        }
    }

    public class KvcProvider :KeyValueCollection
    {
        KeyValueCollection _kvc;
        KeyValueCollection _parent;
        public KvcProvider(KeyValueCollection kvc, KeyValueCollection parent)
        {
            _kvc = kvc;
            _parent = parent;
        }

        public object Get(string name)
        {
            if (_kvc.IsDefined(name))
            {
                var value = _kvc.Get(name);
                return value;
            }
            if (_parent == null)
            {
                return null;
            }
            var parentValue = _parent.Get(name);
            return parentValue;
        }

        public KeyValueCollection ParentProvider => _parent;
        public KeyValueCollection Pare => _parent;
        public bool IsDefined(string key, bool hierarchy = true)
        {
            if (_kvc.IsDefined(key, hierarchy))
                return true;
            if (!hierarchy)
                return false;
            if (_parent != null)
                return _parent.IsDefined(key);
            return false;
        }

        public IList<KeyValuePair<string, object>> GetAll()
        {
            var result = new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase);
            if (_parent != null)
            {
                foreach (var kv in _parent.GetAll())
                {
                    if (!result.ContainsKey(kv.Key))
                        result[kv.Key] = kv.Value;
                }
            }

            foreach (var kv in _kvc.GetAll())
            {
                result[kv.Key] = kv.Value;
            }

            return result.Select(kv => KeyValuePair.Create(kv.Key, kv.Value)).ToList();
        }

        public IList<string> GetAllKeys()
        {
            var keys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            if (_parent != null)
            {
                foreach (var key in _parent.GetAllKeys())
                {
                    keys.Add(key);
                }
            }

            foreach (var key in _kvc.GetAllKeys())
            {
                keys.Add(key);
            }

            return keys.ToList();
        }
    }

}
