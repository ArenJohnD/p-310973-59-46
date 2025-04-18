import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { Header } from "@/components/Header";
import { AdminCategoryTable } from "@/components/AdminCategoryTable";
import { ReferenceDocumentManager } from "@/components/ReferenceDocumentManager";
import { UserManagement } from "@/components/UserManagement";
import { PolicyStatistics } from "@/components/PolicyStatistics";
import { useAuth } from "@/context/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
      <div className="min-h-screen flex flex-col bg-[rgba(233,233,233,1)]">
        <Header />
        <main className="bg-white flex-1 mt-[29px] px-20 py-[52px] rounded-[40px_40px_0px_0px] max-md:px-5">
          <div className="flex justify-center items-center h-64">
            <p className="text-xl">Loading...</p>
          </div>
        </main>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col bg-[rgba(233,233,233,1)]">
        <Header />
        <main className="bg-white flex-1 mt-[29px] px-20 py-[52px] rounded-[40px_40px_0px_0px] max-md:px-5">
          <div className="flex flex-col justify-center items-center h-64">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
            <p className="text-gray-700">
              You don't have admin privileges to access this page.
            </p>
            <p className="text-gray-500 mt-2">
              Only accounts with @neu.edu.ph email addresses can access the admin panel.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[rgba(233,233,233,1)]">
      <Header />
      <main className="bg-white flex-1 mt-[29px] px-20 py-[52px] rounded-[40px_40px_0px_0px] max-md:px-5">
        <section className="text-center mb-8">
          <h1 className="text-black text-3xl font-bold">
            Admin Dashboard
          </h1>
          <p className="text-black text-xl mt-2">
            Manage Policy Categories, AI Reference Documents, Users & View Statistics
          </p>
        </section>

        <Tabs defaultValue="categories" className="mb-8">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-4">
            <TabsTrigger value="categories">Categories</TabsTrigger>
            <TabsTrigger value="references">AI Reference Documents</TabsTrigger>
            <TabsTrigger value="users">User Management</TabsTrigger>
            <TabsTrigger value="statistics">Statistics</TabsTrigger>
          </TabsList>
          <TabsContent value="categories" className="mt-6">
            <AdminCategoryTable 
              categories={categories}
              onUpdate={handleCategoryUpdate}
              onDelete={handleCategoryDelete}
              onCreate={handleCategoryCreate}
              onReorder={handleReorderCategories}
            />
          </TabsContent>
          <TabsContent value="references" className="mt-6">
            <ReferenceDocumentManager />
          </TabsContent>
          <TabsContent value="users" className="mt-6">
            <UserManagement />
          </TabsContent>
          <TabsContent value="statistics" className="mt-6">
            <PolicyStatistics />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Admin;
