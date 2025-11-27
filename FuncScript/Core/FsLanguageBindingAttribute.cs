using System;

namespace FuncScript.Core
{
    [AttributeUsage(AttributeTargets.Class, AllowMultiple = true, Inherited = false)]
    public sealed class FsLanguageBindingAttribute : Attribute
    {
        public FsLanguageBindingAttribute(params string[] languageIdentifiers)
        {
            LanguageIdentifiers = languageIdentifiers ?? Array.Empty<string>();
        }

        public string[] LanguageIdentifiers { get; }
    }
}
