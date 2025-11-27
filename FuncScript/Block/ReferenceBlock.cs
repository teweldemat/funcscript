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
            depth.Enter();
            object ret;
            switch (_referenceMode)
            {
                case ReferenceMode.Standard:
                    ret= provider.Get(_nameLower);
                    break;
                case ReferenceMode.SkipSiblings:
                    ret= provider.ParentProvider?.Get(_nameLower);
                    break;
                case ReferenceMode.ParentsThenSiblings:
                    if (provider.ParentProvider!=null && provider.ParentProvider.IsDefined(_nameLower))
                        ret= provider.ParentProvider.Get(_nameLower);
                    else
                        ret=provider.Get(_nameLower);
                    break;
                default:
                    ret= new FsError(FsError.ERROR_TYPE_INVALID_PARAMETER,
                        $"Unsupported reference mode {_referenceMode}");
                    break;
            }
            depth.Exit();
            if (ret is FsError error)
                return AttachCodeLocation(this, error);
            return ret;
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
