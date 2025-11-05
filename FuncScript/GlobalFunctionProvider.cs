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
    public class DefaultFsDataProvider : IFsDataProvider
    {
        static readonly Dictionary<string, IFsFunction> s_funcByName = new Dictionary<string, IFsFunction>();
        static readonly Dictionary<string, Dictionary<string, object>> s_providerCollections = new Dictionary<string, Dictionary<string, object>>(StringComparer.OrdinalIgnoreCase);
        static DefaultFsDataProvider()
        {
            LoadFromAssembly(Assembly.GetExecutingAssembly()); //always load builtin functions. May be we don't need this
        }
        public IFsDataProvider ParentProvider => null;
        public bool IsDefined(string key)
        {
            if (key == null)
                return false;
            var normalized = key.ToLowerInvariant();
            if (_data != null && _data.ContainsKey(normalized))
                return true;
            if (s_funcByName.ContainsKey(normalized))
                return true;
            if (s_providerCollections.ContainsKey(normalized))
                return true;
            return false;
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
                        if (!s_funcByName.TryAdd(lowerSymbol, f))
                            throw new Exception($"{f.Symbol} already defined");
                        registeredNames.Add(f.Symbol);

                        var alias = t.GetCustomAttribute<FunctionAliasAttribute>();
                        if (alias != null)
                        {
                            foreach (var al in alias.Aliaces ?? Array.Empty<string>())
                            {
                                if (string.IsNullOrWhiteSpace(al))
                                    continue;
                                var normalizedAlias = al.ToLowerInvariant();
                                if (!s_funcByName.TryAdd(normalizedAlias, f))
                                    throw new Exception($"{f.Symbol} already defined");
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
            if (s_funcByName.TryGetValue(normalized, out var ret))
                return ret;
            if (s_providerCollections.TryGetValue(normalized, out var providerMembers))
            {
                var pairs = providerMembers
                    .OrderBy(kvp => kvp.Key, StringComparer.OrdinalIgnoreCase)
                    .Select(kvp => new KeyValuePair<string, object>(kvp.Key, kvp.Value))
                    .ToArray();
                return new SimpleKeyValueCollection(this, pairs);
            }
            return null;
        }

        static void RegisterProviderCollections(ProviderCollectionAttribute attribute, IList<string> names, object member)
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

        static void RegisterCollectionMember(string collectionName, string memberName, object value)
        {
            if (string.IsNullOrWhiteSpace(collectionName) || string.IsNullOrWhiteSpace(memberName))
                return;

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

    /// <summary>
    /// IFSDataProvider backed by KeyValueCollection
    /// </summary>
    public class KvcProvider : IFsDataProvider
    {
        IFsDataProvider _kvc;
        IFsDataProvider _parent;
        public KvcProvider(IFsDataProvider kvc, IFsDataProvider parent)
        {
            _kvc = kvc;
            _parent = parent;
        }

        public object Get(string name)
        {
            if (_kvc.IsDefined(name))
                return _kvc.Get(name);
            if (_parent == null)
                return null;
            return _parent.Get(name);
        }
        public IFsDataProvider ParentProvider => _parent;
        public bool IsDefined(string key)
        {
            if (_kvc.IsDefined(key))
                return true;
            if (_parent != null)
                return _parent.IsDefined(key);
            return false;
        }
    }

}
