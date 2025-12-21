using System;
using System.Diagnostics;
using System.Threading;

namespace FuncScript;

public static class Instrumentation
{
    private sealed class ScopeState
    {
        public long Id;
        public long ParseCount;
        public long BlockEvaluateCount;
        public int MaxDepth;
        public long StartTicks;
        public string? Label;
    }

    private sealed class ScopeHandle : IDisposable
    {
        private readonly ScopeState _state;
        private readonly ScopeState? _previous;
        private bool _disposed;

        public ScopeHandle(ScopeState state, ScopeState? previous)
        {
            _state = state;
            _previous = previous;
        }

        public void Dispose()
        {
            if (_disposed)
            {
                return;
            }

            _disposed = true;
            _current.Value = _previous;
            var elapsedMs = TicksToMs(Stopwatch.GetTimestamp() - _state.StartTicks);
            Console.Error.WriteLine(
                $"[funcscript.profile] Eval #{_state.Id} " +
                $"parse={_state.ParseCount} blocks={_state.BlockEvaluateCount} maxDepth={_state.MaxDepth} " +
                $"total={elapsedMs:F1}ms{FormatLabel(_state.Label)}");
        }
    }

    private static readonly AsyncLocal<ScopeState?> _current = new();
    private static long _sequence;

    public static bool Enabled { get; set; } =
        string.Equals(Environment.GetEnvironmentVariable("FUNCSCRIPT_PROFILE"), "1", StringComparison.OrdinalIgnoreCase);

    public static bool HasScope => _current.Value != null;

    public static IDisposable? BeginScope(string? label)
    {
        if (!Enabled)
        {
            return null;
        }

        var previous = _current.Value;
        var state = new ScopeState
        {
            Id = Interlocked.Increment(ref _sequence),
            StartTicks = Stopwatch.GetTimestamp(),
            Label = label
        };
        _current.Value = state;
        return new ScopeHandle(state, previous);
    }

    public static void RecordParse()
    {
        if (!Enabled)
        {
            return;
        }

        var state = _current.Value;
        if (state != null)
        {
            state.ParseCount += 1;
        }
    }

    public static void RecordBlockEvaluate(int depth)
    {
        if (!Enabled)
        {
            return;
        }

        var state = _current.Value;
        if (state == null)
        {
            return;
        }

        state.BlockEvaluateCount += 1;
        if (depth > state.MaxDepth)
        {
            state.MaxDepth = depth;
        }
    }

    private static string FormatLabel(string? label)
    {
        if (string.IsNullOrWhiteSpace(label))
        {
            return string.Empty;
        }

        return " " + label;
    }

    private static double TicksToMs(long ticks)
    {
        return ticks * 1000.0 / Stopwatch.Frequency;
    }
}
