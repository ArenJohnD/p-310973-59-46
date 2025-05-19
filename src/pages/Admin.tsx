import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "@/components/ui/use-toast";
import { Header } from "@/components/Header";
import { AdminCategoryTable } from "@/components/AdminCategoryTable";
import { UserManagement } from "@/components/UserManagement";
import { PolicyStatistics } from "@/components/PolicyStatistics";
import { useAuth } from "@/context/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, LayoutGrid, BookOpen, Users, BarChart, ShieldCheck } from "lucide-react";

interface PolicyCategory {
  id: string;
  title: string;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

const Admin = () => {
  const { isAdmin, isLoading } = useAuth();
  const [categories, setCategories] = useState<PolicyCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAdmin && !isLoading) {
      fetchCategories();
    } else if (!isLoading && !isAdmin) {
      setLoading(false);
    }
  }, [isAdmin, isLoading]);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('policy_categories')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error("Error fetching categories:", error);
      toast({
        title: "Error",
        description: "Failed to load policy categories",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryUpdate = async (category: PolicyCategory) => {
    try {
      const { error } = await supabase
        .from('policy_categories')
        .update({
          title: category.title,
          is_active: category.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', category.id);

      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Category updated successfully",
      });
      
      setCategories(categories.map(c => 
        c.id === category.id ? { ...c, ...category } : c
      ));
    } catch (error) {
      console.error("Error updating category:", error);
      toast({
        title: "Error",
        description: "Failed to update category",
        variant: "destructive",
      });
    }
  };

  const handleCategoryDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('policy_categories')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Category deleted successfully",
      });
      
      setCategories(categories.filter(c => c.id !== id));
    } catch (error) {
      console.error("Error deleting category:", error);
      toast({
        title: "Error",
        description: "Failed to delete category",
        variant: "destructive",
      });
    }
  };

  const handleCategoryCreate = async (title: string) => {
    try {
      const maxOrder = categories.length > 0 
        ? Math.max(...categories.map(c => c.display_order))
        : 0;
      
      const { data, error } = await supabase
        .from('policy_categories')
        .insert({
          title,
          display_order: maxOrder + 1,
        })
        .select();

      if (error) throw error;
      
      toast({
        title: "Success",
        description: "New category created successfully",
      });
      
      if (data && data.length > 0) {
        setCategories([...categories, data[0] as PolicyCategory]);
      }
    } catch (error) {
      console.error("Error creating category:", error);
      toast({
        title: "Error",
        description: "Failed to create new category",
        variant: "destructive",
      });
    }
  };

  const handleReorderCategories = async (reorderedCategories: PolicyCategory[]) => {
    try {
      setCategories(reorderedCategories);
      
      const updates = reorderedCategories.map((category, index) => ({
        id: category.id,
        display_order: index + 1,
        updated_at: new Date().toISOString(),
      }));
      
      await Promise.all(
        updates.map(update => 
          supabase
            .from('policy_categories')
            .update({ display_order: update.display_order, updated_at: update.updated_at })
            .eq('id', update.id)
        )
      );
      
      toast({
        title: "Success",
        description: "Categories reordered successfully",
      });
    } catch (error) {
      console.error("Error reordering categories:", error);
      toast({
        title: "Error",
        description: "Failed to reorder categories",
        variant: "destructive",
      });
      fetchCategories();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-[rgba(49,159,67,0.1)] via-[#F1F1F1] to-white">
        <Header />
        <main className="container mx-auto px-4 flex-1">
          <div className="max-w-[1200px] mx-auto bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm mt-8 p-8">
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-[rgba(49,159,67,1)]" />
              <span className="ml-3 text-gray-600">Loading dashboard...</span>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-[rgba(49,159,67,0.1)] via-[#F1F1F1] to-white">
        <Header />
        <main className="container mx-auto px-4 flex-1">
          <div className="max-w-[1200px] mx-auto bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm mt-8 p-8">
            <div className="flex flex-col justify-center items-center h-64">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H8m4-6V4" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
              <p className="text-gray-700 text-center">
                You don't have admin privileges to access this page.
              </p>
              <p className="text-gray-500 mt-2 text-center">
                Only accounts with @neu.edu.ph email addresses can access the admin panel.
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[rgba(49,159,67,0.1)] via-[#F1F1F1] to-white">
      <Header />
      <main className="container mx-auto px-4 flex-1">
        <div className="max-w-[1200px] mx-auto">
          {/* Dashboard Header */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm mt-8 p-6 sm:p-8 border border-[rgba(49,159,67,0.2)]">
            <div className="max-w-2xl">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-3">
                <ShieldCheck className="h-8 w-8 text-[rgba(49,159,67,1)]" />
                Admin Dashboard
              </h1>
              <p className="text-gray-600 mt-2">
                Manage Policy Categories, Users & View Statistics
              </p>
            </div>
          </div>

          {/* Main Content */}
          <div className="mt-8">
            <Tabs defaultValue="categories" className="space-y-8">
              <TabsList className="inline-flex h-auto p-1.5 items-center justify-start gap-2 rounded-lg bg-white/60 backdrop-blur-sm w-fit">
                <TabsTrigger 
                  value="categories" 
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md hover:bg-white data-[state=active]:bg-white data-[state=active]:text-[rgba(49,159,67,1)] data-[state=active]:shadow-sm transition-all"
                >
                  <LayoutGrid className="h-4 w-4" />
                  <span className="font-medium">Categories</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="users"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md hover:bg-white data-[state=active]:bg-white data-[state=active]:text-[rgba(49,159,67,1)] data-[state=active]:shadow-sm transition-all"
                >
                  <Users className="h-4 w-4" />
                  <span className="font-medium">Users</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="statistics"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md hover:bg-white data-[state=active]:bg-white data-[state=active]:text-[rgba(49,159,67,1)] data-[state=active]:shadow-sm transition-all"
                >
                  <BarChart className="h-4 w-4" />
                  <span className="font-medium">Statistics</span>
                </TabsTrigger>
              </TabsList>

              <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm p-6 sm:p-8 border border-gray-100/20">
                <TabsContent value="categories" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
                  <AdminCategoryTable 
                    categories={categories}
                    onUpdate={handleCategoryUpdate}
                    onDelete={handleCategoryDelete}
                    onCreate={handleCategoryCreate}
                    onReorder={handleReorderCategories}
                  />
                </TabsContent>
                <TabsContent value="users" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
                  <UserManagement />
                </TabsContent>
                <TabsContent value="statistics" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
                  <PolicyStatistics />
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Admin;
