using FuncScript.Core;
using FuncScript.Model;
using FuncScript.Error;

#nullable enable

namespace FuncScript.Package
{
    public interface IFsPackageResolver
    {
        IEnumerable<PackageNodeDescriptor> ListChildren(IReadOnlyList<string> path);

        PackageExpressionDescriptor? GetExpression(IReadOnlyList<string> path);

        IFsPackageResolver? Package(string name);
    }

    public readonly record struct PackageNodeDescriptor
    {
        public PackageNodeDescriptor(string name)
        {
            if (string.IsNullOrWhiteSpace(name))
                throw new ArgumentException("Package node name cannot be empty.", nameof(name));
            Name = name;
        }

        public string Name { get; }

        public static implicit operator PackageNodeDescriptor(string name)
            => new PackageNodeDescriptor(name);
    }

    public readonly record struct PackageExpressionDescriptor
    {
        public PackageExpressionDescriptor(string expression, string? language = null)
        {
            Expression = expression ?? throw new ArgumentNullException(nameof(expression));
            Language = string.IsNullOrWhiteSpace(language) ? PackageLanguages.FuncScript : language!;
        }

        public string Expression { get; }
        public string Language { get; }

        public static implicit operator PackageExpressionDescriptor(string expression)
            => new PackageExpressionDescriptor(expression, PackageLanguages.FuncScript);
    }

    public static class PackageLanguages
    {
        public const string FuncScript = "funcscript";
        public const string JavaScript = "javascript";
    }
}
