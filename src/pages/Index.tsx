import { Header } from "@/components/Header";
import { PolicyGrid } from "@/components/PolicyGrid";
import { FAQAccordion } from "@/components/FAQAccordion";
import { BookOpen, Users, Shield } from "lucide-react";
import { PoliChat } from "@/components/PoliChat";

export default function Index() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F1F1F1] to-white">
      <Header />
      
      {/* Hero Section */}
      <div className="relative bg-[#F1F1F1] py-16 sm:py-20 overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-r from-[rgba(49,159,67,0.05)] to-transparent" />
          <div className="absolute right-0 bottom-0 transform translate-x-1/3">
            <svg
              className="w-[600px] h-[600px] text-[rgba(49,159,67,0.03)]"
              fill="currentColor"
              viewBox="0 0 200 200"
            >
              <path
                d="M44.5,-76.5C59.2,-69.8,73.8,-60.1,83.7,-46.4C93.6,-32.7,98.9,-15.3,97.7,1.2C96.5,17.8,88.9,33.6,79,47.1C69.1,60.6,57,71.8,42.3,77.8C27.7,83.8,10.5,84.5,-4.9,91.8C-20.3,99.1,-33.9,113,-50.1,112.1C-66.3,111.3,-85.1,95.7,-94.9,76.5C-104.7,57.3,-105.5,34.5,-104.9,13.7C-104.3,-7.1,-102.2,-26,-93.8,-41.7C-85.4,-57.4,-70.6,-69.9,-54.3,-76.2C-38,-82.5,-20.2,-82.6,-2.2,-79.2C15.8,-75.8,29.8,-83.2,44.5,-76.5Z"
                transform="translate(100 100)"
              />
            </svg>
          </div>
        </div>
        <div className="container mx-auto px-4">
          <div className="max-w-[1075px] mx-auto relative">
            <div className="max-w-2xl">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 sm:mb-8 leading-tight text-gray-900">
                NEU<span className="text-[rgba(49,159,67,1)]">Poli</span>Seek
              </h1>
              <p className="text-lg sm:text-xl lg:text-2xl text-gray-700 font-normal leading-relaxed mb-6 sm:mb-8">
                Find, search, and explore New Era University's institutional 
                policies across different colleges, departments, and areas 
                of university life.
              </p>
              <p className="text-base sm:text-lg text-gray-600 mb-8 sm:mb-10">
                Our goal is to provide accessibility and transparency to all university policies.
              </p>

              {/* Feature Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:border-[rgba(49,159,67,0.5)] hover:shadow-md transition-all group">
                  <div className="w-12 h-12 bg-[rgba(49,159,67,0.1)] rounded-lg flex items-center justify-center mb-4 group-hover:bg-[rgba(49,159,67,1)] transition-colors">
                    <BookOpen className="h-6 w-6 text-[rgba(49,159,67,1)] group-hover:text-white transition-colors" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Easy Access</h3>
                  <p className="text-gray-600">Quick and simple access to all university policies</p>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:border-[rgba(49,159,67,0.5)] hover:shadow-md transition-all group">
                  <div className="w-12 h-12 bg-[rgba(49,159,67,0.1)] rounded-lg flex items-center justify-center mb-4 group-hover:bg-[rgba(49,159,67,1)] transition-colors">
                    <Users className="h-6 w-6 text-[rgba(49,159,67,1)] group-hover:text-white transition-colors" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">User Friendly</h3>
                  <p className="text-gray-600">Designed for students, faculty, and staff</p>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:border-[rgba(49,159,67,0.5)] hover:shadow-md transition-all group">
                  <div className="w-12 h-12 bg-[rgba(49,159,67,0.1)] rounded-lg flex items-center justify-center mb-4 group-hover:bg-[rgba(49,159,67,1)] transition-colors">
                    <Shield className="h-6 w-6 text-[rgba(49,159,67,1)] group-hover:text-white transition-colors" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Secure Access</h3>
                  <p className="text-gray-600">Protected and controlled access to policies</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12 sm:py-16">
        <div className="max-w-[1075px] mx-auto">
          <PolicyGrid />
          
          <div className="mt-16 sm:mt-20">
            <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8 hover:border-[rgba(49,159,67,0.5)] hover:shadow-md transition-all">
              <FAQAccordion />
            </div>
          </div>
        </div>
      </div>

      {/* Chat Component */}
      <PoliChat />
    </div>
  );
}
