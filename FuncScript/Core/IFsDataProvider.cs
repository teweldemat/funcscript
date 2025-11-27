namespace FuncScript.Core
{
    public interface IFsDataProvider        
    {
        object Get(String name);
        public IFsDataProvider ParentProvider { get; }
        bool IsDefined(string key, bool hierarchy = true);
    }
}
