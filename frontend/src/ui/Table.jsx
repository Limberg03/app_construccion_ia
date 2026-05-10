export function Table({ columns = [], rows = [], rowKey = 'id', renderActions }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 dark:bg-slate-900/40">
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                className="text-left font-semibold text-slate-700 dark:text-slate-200 px-4 py-3"
              >
                {c.header}
              </th>
            ))}
            {renderActions && (
              <th className="text-right font-semibold text-slate-700 dark:text-slate-200 px-4 py-3">
                Acciones
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-900">
          {rows.map((r) => (
            <tr key={String(r?.[rowKey] ?? Math.random())}>
              {columns.map((c) => (
                <td
                  key={c.key}
                  className="px-4 py-3 text-slate-900 dark:text-slate-100"
                >
                  {c.render ? c.render(r) : String(r?.[c.key] ?? '')}
                </td>
              ))}
              {renderActions && (
                <td className="px-4 py-3 text-right">{renderActions(r)}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
