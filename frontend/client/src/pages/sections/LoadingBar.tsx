import { Loader } from 'lucide-react';
import '../../Spinner.css';

interface LoadingBarProps {
  isOpen: boolean;
  onClose: () => void;
}

const LoadingBar = ({ isOpen }: LoadingBarProps) => {

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="relative flex items-center justify-center rounded-[30px] border-2 border-white/70 bg-transparent p-6 shadow-2xl">
        <div className="spinner-container">
          <div className="spinner"></div>
        </div>
      </div>
    </div>
  );
  };
  
  export default LoadingBar;