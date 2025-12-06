using System.Data;
using FuncScript.Core;
using FuncScript.Model;

namespace FuncScript.Block
{

    public enum ReferenceMode
    {
        Standard,
        SkipSiblings,
        ParentsThenSiblings
    }
    public class ReferenceBlock : ExpressionBlock
    {
        private string _name, _nameLower;
        private ReferenceMode _referenceMode;
            
        public string Name => _name;
        public ReferenceBlock( string name, string nameLower, ReferenceMode referenceMode)
        {
            _name = name;
            _nameLower = nameLower;
            this._referenceMode = referenceMode;
        }


        public override object Evaluate(KeyValueCollection provider,DepthCounter depth)
        {
            var entryState = depth.Enter(this);
            object result = null;
            try
            {
                switch (_referenceMode)
                {
                    case ReferenceMode.Standard:
                        result = provider.Get(_nameLower);
                        break;
                    case ReferenceMode.SkipSiblings:
                        result = provider.ParentProvider?.Get(_nameLower);
                        break;
                    case ReferenceMode.ParentsThenSiblings:
                        if (provider.ParentProvider != null && provider.ParentProvider.IsDefined(_nameLower))
                            result = provider.ParentProvider.Get(_nameLower);
                        else
                            result = provider.Get(_nameLower);
                        break;
                    default:
                        result = new FsError(FsError.ERROR_TYPE_INVALID_PARAMETER,
                            $"Unsupported reference mode {_referenceMode}");
                        break;
                }

                if (result is FsError error)
                    result = AttachCodeLocation(this, error);

                return result;
            }
            finally
            {
                depth.Exit(entryState, result, this);
            }
        }

        public override IEnumerable<ExpressionBlock> GetChilds() => Array.Empty<ExpressionBlock>();


        public override string ToString()
        {
            return Name;
        }

        public override string AsExpString()
        {
            return Name;
        }

    }

}
