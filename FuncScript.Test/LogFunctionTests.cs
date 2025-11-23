using FuncScript.Functions.Misc;
using NUnit.Framework;
using System.Collections.Generic;

namespace FuncScript.Test
{
    public class LogFunctionTests
    {
        [Test]
        public void LogWithoutMessagePrintsFormattedValue()
        {
            var capture = new CaptureLogger();
            var original = Fslogger.DefaultLogger;
            Fslogger.SetDefaultLogger(capture);

            try
            {
                var expectedValue = FuncScriptRuntime.Evaluate("{sample: { value: 5 }}");
                var expectedLog = FuncScriptRuntime.FormatToJson(expectedValue);

                FuncScriptRuntime.Evaluate("log({sample: { value: 5 }})");

                Assert.That(capture.Messages, Is.Not.Empty);
                Assert.That(capture.Messages[^1], Is.EqualTo(expectedLog));
            }
            finally
            {
                Fslogger.SetDefaultLogger(original ?? new ConsoleLogger());
            }
        }

        private sealed class CaptureLogger : Fslogger
        {
            public List<string> Messages { get; } = new();

            public override void WriteLine(string text)
            {
                Messages.Add(text);
            }

            public override void Clear()
            {
                Messages.Clear();
            }
        }
    }
}
