interface PolicyCardProps {
  title: string;
}

export const PolicyCard = ({ title }: PolicyCardProps) => {
  return (
    <div className="w-[33%] max-md:w-full max-md:ml-0">
      <button
        className="bg-[rgba(49,159,67,1)] shadow-[0px_4px_4px_rgba(0,0,0,0.25)] w-full text-[22px] text-white font-semibold text-center px-[70px] py-[42px] rounded-[20px] transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 max-md:mt-5 max-md:px-5"
        onClick={() => console.log(`Selected policy: ${title}`)}
      >
        {title}
      </button>
    </div>
  );
};
