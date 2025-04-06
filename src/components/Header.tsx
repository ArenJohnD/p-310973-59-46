import { Link } from "react-router-dom";

export const Header = () => {
  return (
    <header className="bg-[rgba(233,233,233,1)] shadow-[0px_4px_4px_rgba(0,0,0,0.25)] pt-[30px]">
      <div className="self-center flex w-full max-w-[1374px] mx-auto items-stretch gap-[40px_100px] flex-wrap max-md:max-w-full">
        <div className="grow shrink basis-auto max-md:max-w-full">
          <div className="gap-5 flex max-md:flex-col max-md:items-stretch">
            <div className="w-1/5 max-md:w-full max-md:ml-0">
              <img
                src="https://cdn.builder.io/api/v1/image/assets/e3c6b0ec50df45b58e99e24af78e19b0/1cb33a4f0fb596171796038573ac1522f5a08704?placeholderIfAbsent=true"
                alt="Logo"
                className="aspect-[1] object-contain w-[101px] shrink-0 max-w-full max-md:mt-10"
              />
            </div>
            <nav className="w-4/5 ml-5 max-md:w-full max-md:ml-0">
              <div className="text-black text-[22px] font-semibold self-stretch my-auto max-md:mt-10">
                <Link to="/" className="mr-4 hover:text-gray-700">
                  Home
                </Link>
                <Link to="/about" className="mx-4 hover:text-gray-700">
                  About Us
                </Link>
                <Link to="/contact" className="mx-4 hover:text-gray-700">
                  Contact
                </Link>
              </div>
            </nav>
          </div>
        </div>
        <div className="flex items-stretch gap-9 my-auto">
          <img
            src="https://cdn.builder.io/api/v1/image/assets/e3c6b0ec50df45b58e99e24af78e19b0/b8781c762a93ef81927709ba7b69cb9ec9bc9d10?placeholderIfAbsent=true"
            alt="Icon 1"
            className="aspect-[1] object-contain w-10 shrink-0 my-auto"
          />
          <div className="flex items-stretch">
            <img
              src="https://cdn.builder.io/api/v1/image/assets/e3c6b0ec50df45b58e99e24af78e19b0/e71d353f0cdafa62e037a6d7a491ecc18e20f674?placeholderIfAbsent=true"
              alt="Icon 2"
              className="aspect-[1.05] object-contain w-20 shrink-0"
            />
            <img
              src="https://cdn.builder.io/api/v1/image/assets/e3c6b0ec50df45b58e99e24af78e19b0/59482616a61d60d64d2712becd5bb11aca52bf05?placeholderIfAbsent=true"
              alt="Icon 3"
              className="aspect-[1] object-contain w-[50px] shrink-0 my-auto"
            />
          </div>
        </div>
      </div>
    </header>
  );
};
