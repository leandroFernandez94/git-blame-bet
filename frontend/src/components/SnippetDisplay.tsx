export function SnippetDisplay({
  code,
  filePath,
}: {
  code: string;
  language: string;
  filePath?: string;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-700 bg-gray-900">
      {filePath && (
        <div className="border-b border-gray-700 bg-gray-800/50 px-4 py-2 text-xs text-gray-400">
          {filePath}
        </div>
      )}
      <pre className="overflow-x-auto p-4">
        <code className="text-sm leading-relaxed text-gray-200">{code}</code>
      </pre>
    </div>
  );
}
