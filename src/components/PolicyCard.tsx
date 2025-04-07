
import { useNavigate } from "react-router-dom";

interface PolicyCardProps {
  title: string;
  id: string;
}

export const PolicyCard = ({ title, id }: PolicyCardProps) => {
  const navigate = useNavigate();
  
  return (
    <div className="w-full">
      <button
        className="bg-[rgba(49,159,67,1)] shadow-[0px_4px_4px_rgba(0,0,0,0.25)] w-full h-[180px] text-[22px] text-white font-semibold text-center px-5 py-6 rounded-[20px] transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 flex items-center justify-center"
        onClick={() => navigate(`/policy-viewer/${id}`)}
      >
        <span className="line-clamp-3">{title}</span>
      </button>
    </div>
  );
};
