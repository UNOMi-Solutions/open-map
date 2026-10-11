import '../../Spinner.css';

interface LoadingBarProps {
  isOpen: boolean;
  onClose: () => void;
  progress?: number | null;
}

const LoadingBar = ({ isOpen, progress }: LoadingBarProps) => {

  if (!isOpen) return null;

  const showProgress = progress != null;
  const normalizedProgress =
    showProgress && Number.isFinite(progress)
      ? Math.min(100, Math.max(0, progress))
      : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="relative flex items-center justify-center rounded-[30px] border-2 border-white/70 bg-transparent p-6 shadow-2xl">
        {showProgress ? (
          <div className="w-64" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={normalizedProgress}>
            <div className="h-2 overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-white transition-[width] duration-200"
                style={{ width: `${normalizedProgress}%` }}
              />
            </div>
            <div className="mt-2 text-center text-sm text-white">
              {normalizedProgress}%
            </div>
          </div>
        ) : (
          <div className="spinner-container">
            <div className="spinner"></div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoadingBar;