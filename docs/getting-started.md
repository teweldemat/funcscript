# Getting Started

This chapter walks you through installing the tooling, running a simple FuncScript expression, and
understanding the moving pieces that sit behind the language.

## Prerequisites
- .NET 8 SDK (includes the .NET 6 tooling used by the runtime projects)
- Optional: Node.js 20+ if you plan to explore the JavaScript port or the FuncScript Studio UI
- Python 3.9+ (only required for building the documentation via MkDocs)

## Evaluate Your First Script
```bash
# restore and build the solution
 dotnet restore FuncScript.sln
 dotnet build FuncScript.sln

# evaluate an inline expression with the CLI
dotnet run --project FuncScript.Cli -- "{ rate:0.13; net:(g)=>g*(1-rate); return net(5200); }"
```

The CLI prints the evaluated value together with type metadata. You can supply data via the
`--data` flag, or load a `.fs` script from disk.

## Embedding in .NET
```csharp
var globals = new DefaultFsDataProvider(new [] {
    FsVariable.Value("taxRate", 0.15m),
    FsVariable.Value("message", "Payroll run"),
});
var expression = "{ net:(gross)=>gross*(1-taxRate); return net(gross); }";
var context = new ObjectKvc(new { gross = 5200m });
var result = FuncScript.Engine.Evaluate(new KvcProvider(context, globals), expression);
Console.WriteLine(FuncScript.Engine.ToJson(result));
```

For more details, explore the sample project under `FuncScript.Example/` in the repository and the
[language overview](language/overview.md).

## Next Steps
- Read through the [language overview](language/overview.md) for the core concepts
- Explore [expressions](language/expressions.md) to learn how evaluation works
- Browse the [standard library reference](reference/builtins.md) for available helpers
- Launch the FuncScript Studio (React) playground inside `js-port/funcscript-studio` for a guided
  editing experience
