export function QRCode({ dataUrl }: { dataUrl: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <img
        src={dataUrl}
        alt="QR Code"
        className="h-48 w-48 rounded-lg bg-white p-2"
      />
      <span className="text-xs text-gray-500">Scan to join</span>
    </div>
  );
}
