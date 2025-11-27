using System;
using System.Linq;
using System.Reflection;

namespace FuncScript.Core
{
    public static class LanguageBindingLoader
    {
        public static void LoadFromAssembly(Assembly assembly)
        {
            if (assembly == null)
                throw new ArgumentNullException(nameof(assembly));

            foreach (var type in assembly.GetTypes())
            {
                var attributes = type.GetCustomAttributes<FsLanguageBindingAttribute>(false)?.ToArray();
                if (attributes == null || attributes.Length == 0)
                    continue;

                if (!typeof(ILanguageBinding).IsAssignableFrom(type))
                {
                    throw new InvalidOperationException(
                        $"Type '{type.FullName}' is marked with {nameof(FsLanguageBindingAttribute)} but does not implement {nameof(ILanguageBinding)}.");
                }

                ILanguageBinding bindingInstance;
                try
                {
                    bindingInstance = (ILanguageBinding)Activator.CreateInstance(type);
                }
                catch (Exception ex)
                {
                    throw new InvalidOperationException(
                        $"Failed to create an instance of '{type.FullName}' for language binding registration.", ex);
                }

                foreach (var attribute in attributes)
                {
                    foreach (var identifier in attribute.LanguageIdentifiers ?? Array.Empty<string>())
                    {
                        if (string.IsNullOrWhiteSpace(identifier))
                            continue;

                        LanguageBindingRegistry.Register(identifier, bindingInstance);
                    }
                }
            }
        }
    }
}
