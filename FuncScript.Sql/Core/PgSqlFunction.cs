using global::FuncScript.Core;
using global::FuncScript.Model;
using Npgsql;

namespace FuncScript.Sql.Core
{
    public class PgSqlFunction : IFsFunction
    {
        public int MaxParsCount => 3;

        public CallType CallType => CallType.Prefix;

        public string Symbol => "pgsql";

        public int Precedence => 0;

        public object Evaluate(object par)
        {
            if (!(par is FsList pars))
                throw new Error.TypeMismatchError($"List argument expected");
            if (pars[0] is not string connectionStr)
                throw new InvalidOperationException($"{Symbol} - {ParName(0)} is required");

            if (pars[1] is not string query)
                throw new InvalidOperationException($"{Symbol} - {ParName(1)} is required");

            using var conn = new NpgsqlConnection(connectionStr);
            conn.Open();

            using var cmd = new NpgsqlCommand(query, conn);
            cmd.CommandTimeout = 0;

            if (pars.Length > 2 && pars[2] is not null)
            {
                cmd.Parameters.AddWithValue("@param", pars[2]);
            }

            using var reader = cmd.ExecuteReader();
            var results = new List<SimpleKeyValueCollection>();
            while (reader.Read())
            {
                var row = new List<KeyValuePair<string, object?>>();
                for (var i = 0; i < reader.FieldCount; i++)
                {
                    var value = FuncScriptSql.NormalizeDataType(reader.GetValue(i));
                    row.Add(new KeyValuePair<string, object?>(reader.GetName(i), value));
                }
                results.Add(new SimpleKeyValueCollection(null,row.ToArray()));
            }

            var normalizedResults = FuncScriptRuntime.NormalizeDataType(results);
            return normalizedResults ?? "null";
        }

        public string? ParName(int index)
        {
            return index switch
            {
                0 => "ConnectionString",
                1 => "Query",
                2 => "QueryParam",
                _ => null,
            };
        }
    }
}
