using FuncScript.Core;

namespace FuncScript.Model;

public class FsError
{
    public const string ERROR_DEFAULT = "Default";
    public const string ERROR_PARAMETER_COUNT_MISMATCH="TOO_FEW_PARAMETER";
    public const string ERROR_TYPE_MISMATCH = "TYPE_MISMATCH";
    public const string ERROR_TYPE_INVALID_PARAMETER = "TYPE_INVALID_PARAMETER";

    public const string ERROR_EVALUATION_DEPTH_OVERFLOW = "EVALUATION_DEPTH_OVERFLOW";
    public const string ERROR_SYNTAX_ERROR = "SYNTAX_ERROR";
    public const string ERROR_UNKNOWN_ERROR = "UNKNOWN_ERROR";
    
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

    public override bool Equals(object? obj)
    {
        if (obj is not FsError other) return false;
        return string.Equals(ErrorType, other.ErrorType)
               && string.Equals(ErrorMessage, other.ErrorMessage)
               && Equals(ErrorData, other.ErrorData)
               && Equals(CodeLocation, other.CodeLocation);
    }

    public override int GetHashCode()
    {
        unchecked
        {
            int hash = 17;
            hash = hash * 23 + (ErrorType?.GetHashCode() ?? 0);
            hash = hash * 23 + (ErrorMessage?.GetHashCode() ?? 0);
            hash = hash * 23 + (ErrorData?.GetHashCode() ?? 0);
            hash = hash * 23 + (CodeLocation?.GetHashCode() ?? 0);
            return hash;
        }
    }

    
}
