export function GameFilters({
  pathFilter,
  onPathChange,
  onApply,
}: {
  pathFilter: string;
  onPathChange: (path: string) => void;
  onApply: () => void;
}) {
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900 p-4">
      <h3 className="mb-3 text-sm font-semibold text-gray-400">Filters</h3>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs text-gray-500">
            Path filter
          </label>
          <input
            type="text"
            value={pathFilter}
            onChange={(e) => onPathChange(e.target.value)}
            placeholder="e.g. src/components"
            className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-brand-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">
            File types
          </label>
          <div className="flex flex-wrap gap-2">
            <label className="flex items-center gap-1.5 rounded bg-gray-800 px-3 py-1.5 text-xs">
              <input type="checkbox" checked disabled className="accent-brand-500" />
              TypeScript
            </label>
            <label className="flex items-center gap-1.5 rounded bg-gray-800/50 px-3 py-1.5 text-xs text-gray-600">
              <input type="checkbox" disabled />
              JavaScript
              <span className="text-[10px] text-gray-600">(coming soon)</span>
            </label>
            <label className="flex items-center gap-1.5 rounded bg-gray-800/50 px-3 py-1.5 text-xs text-gray-600">
              <input type="checkbox" disabled />
              Python
              <span className="text-[10px] text-gray-600">(coming soon)</span>
            </label>
          </div>
        </div>
        <button
          onClick={onApply}
          className="w-full rounded-md bg-gray-700 px-3 py-2 text-sm font-medium hover:bg-gray-600 transition-colors"
        >
          Apply Filters
        </button>
      </div>
    </div>
  );
}
