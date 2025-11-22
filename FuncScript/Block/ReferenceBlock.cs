using System.Data;
using FuncScript.Core;
using FuncScript.Error;
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


        protected override object EvaluateCore(KeyValueCollection provider)
        {
            switch (_referenceMode)
            {
                case ReferenceMode.Standard:
                    return provider.Get(_nameLower);
                case ReferenceMode.SkipSiblings:
                    return provider.ParentProvider?.Get(_nameLower);
                case ReferenceMode.ParentsThenSiblings:
                    if (provider.ParentProvider!=null && provider.ParentProvider.IsDefined(_nameLower))
                        return provider.ParentProvider.Get(_nameLower);
                    return provider.Get(_nameLower);
            }

            throw new EvaluationTimeException("Unsupported reference mode " + _referenceMode);

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
