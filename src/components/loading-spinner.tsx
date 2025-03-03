import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSpinner } from "@fortawesome/free-solid-svg-icons";

export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-screen">
        <FontAwesomeIcon 
            icon={faSpinner}
            height={18}
            width={18}
            className="h-18 w-18 animate-spin text-gray-500"
        />
    </div>
  );
}