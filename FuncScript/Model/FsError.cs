using FuncScript.Core;

namespace FuncScript.Model;

public class FsError
{
    public const string ERROR_DEFAULT = "Default";
    public const string ERROR_PARAMETER_COUNT_MISMATCH="TOO_FEW_PARAMETER";
    public const string ERROR_TYPE_MISMATCH = "TYPE_MISMATCH";
    public const string ERROR_TYPE_INVALID_PARAMETER = "TYPE_INVALID_PARAMETER";

    public const string ERROR_EVALUATION_DEPTH_OVERFLOW = "EVALUATION_DEPTH_OVERFLOW";
    
    public string ErrorType { get; set; }
    public string ErrorMessage { get; set; }
    public object ErrorData { get; set; }
    public CodeLocation CodeLocation { get; set; }

    public FsError(string messsage) : this(ERROR_DEFAULT, messsage, null)
    {
        
    }
    public FsError(string type,string messsage) : this(type, messsage, null)
    {
        
    }

    public FsError(string type, string message, string data)
    {
        this.ErrorType = type;
        this.ErrorMessage = message;
        this.ErrorData = data;
    }

    public static FsError EvaluationDepthError =>
        new FsError(ERROR_EVALUATION_DEPTH_OVERFLOW, $"Maximum evaluation depth of {ExpressionBlock.MaxEvaluationDepth} exceeded.");

    public override string ToString()
    {
        return $"{this.ErrorMessage} ({this.ErrorType})";
    }
}
