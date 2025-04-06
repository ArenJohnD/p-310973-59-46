import { useState } from "react";

export const SearchBar = () => {
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Implement search functionality
    console.log("Searching for:", searchQuery);
  };

  return (
    <form onSubmit={handleSearch} className="w-full max-w-[1002px] mx-auto">
      <div className="bg-white shadow-[0px_4px_4px_rgba(0,0,0,0.25)] border flex items-stretch gap-5 text-[22px] text-[rgba(142,139,139,1)] font-normal justify-between px-[37px] py-[19px] rounded-[30px] border-[rgba(0,0,0,0.2)] border-solid max-md:px-5">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search for a specific policy (eg. Attendance policy, Dress code)..."
          className="grow bg-transparent outline-none"
          aria-label="Search policies"
        />
        <button type="submit" aria-label="Search">
          <img
            src="https://cdn.builder.io/api/v1/image/assets/e3c6b0ec50df45b58e99e24af78e19b0/6c5f8713780285bb21db7ef4bce44edd2987cea7?placeholderIfAbsent=true"
            alt="Search"
            className="aspect-[1] object-contain w-[25px] shrink-0"
          />
        </button>
      </div>
    </form>
  );
};
