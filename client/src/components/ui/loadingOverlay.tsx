import loadingGif from "@/assets/loading.gif";

interface LoadingOverlayProps {
  message?: string;
}

export function LoadingOverlay({ message = "Loading" }: LoadingOverlayProps) {
  return (
    <div className="loadingOverlay" role="status" aria-live="polite" aria-busy="true">
      <img className="loadingImage" src={loadingGif} alt="Loading" />
      <span className="loadingText">{message}</span>
    </div>
  );
}
